// Imports
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { PurchaseOrderStatus, OrderStatus, ProductionOrderStatus } from '@prisma/client';
import { getCache, setCache, deleteCache } from '../utils/cache.util';

// Cache keys
const CACHE_KEYS = {
  DASHBOARD: 'logistics:dashboard',
  INCOMING: 'logistics:incoming',
  FULFILLMENT: 'logistics:fulfillment',
  READY_TO_SHIP: 'logistics:ready-to-ship',
  PRODUCTION: 'logistics:production',
};

// Cache TTL in seconds
const CACHE_TTL = {
  DASHBOARD: 60, // 1 minuto
  INCOMING: 120, // 2 minuti
  FULFILLMENT: 60, // 1 minuto
  READY_TO_SHIP: 30, // 30 secondi
  PRODUCTION: 120, // 2 minuti
};

// Types/Interfaces
interface IncomingMaterial {
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  estimatedDeliveryDate: Date | null;
  deliveryStatus: string;
  items: Array<{
    productId?: string;
    materialId?: string;
    itemName: string;
    sku: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
  }>;
}

interface FulfillmentForecast {
  orderId: string;
  orderNumber: string;
  customerName: string;
  orderDate: Date;
  status: string;
  totalAmount: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  fulfillmentStatus: 'READY' | 'PARTIAL' | 'BLOCKED' | 'WAITING_MATERIALS';
  readyPercentage: number;
  missingItems: Array<{
    productId: string;
    productName: string;
    sku: string;
    requiredQty: number;
    availableQty: number;
    shortageQty: number;
    expectedArrivalDate?: Date;
  }>;
  estimatedFulfillmentDate?: Date;
}

interface ProductionScheduleItem {
  productionOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  startDate?: Date;
  dueDate?: Date;
  materialsReady: boolean;
  missingMaterials: Array<{
    materialId: string;
    materialName: string;
    code: string;
    requiredQty: number;
    availableQty: number;
    shortageQty: number;
  }>;
  linkedOrderId?: string;
  linkedOrderNumber?: string;
}

interface MaterialTimeline {
  materialId: string;
  materialName: string;
  code: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
  unit: string;
  timeline: Array<{
    date: Date;
    type: 'INCOMING' | 'CONSUMPTION' | 'CURRENT';
    description: string;
    quantity: number;
    balanceAfter: number;
    source?: string;
    sourceId?: string;
  }>;
  projectedStockout?: Date;
  suggestedReorderDate?: Date;
}

/**
 * Logistics Planning Service
 * Gestione pianificazione logistica: arrivi, evasione ordini, produzione
 */
class LogisticsPlanningService {
  /**
   * Ottieni materiali in arrivo (pipeline arrivi)
   */
  async getIncomingMaterials(options?: {
    supplierId?: string;
    daysAhead?: number;
    status?: string[];
  }): Promise<{
    incoming: IncomingMaterial[];
    summary: {
      totalOrders: number;
      pendingDeliveries: number;
      inTransit: number;
      delayed: number;
      totalPendingItems: number;
      expectedThisWeek: number;
    };
  }> {
    const { supplierId, daysAhead = 30, status } = options || {};

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Trova ordini acquisto con consegne pendenti
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: (status as PurchaseOrderStatus[]) || ['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'] as PurchaseOrderStatus[],
        },
        ...(supplierId && { supplierId }),
        OR: [
          { estimatedDeliveryDate: { lte: futureDate } },
          { estimatedDeliveryDate: null },
        ],
      },
      include: {
        supplier: {
          select: { id: true, businessName: true, code: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            material: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        goodsReceipts: {
          include: {
            items: true,
          },
        },
      },
      orderBy: [
        { estimatedDeliveryDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Calcola quantità ricevute per ogni ordine
    const incoming: IncomingMaterial[] = purchaseOrders.map((po) => {
      // Calcola quantità ricevute per item
      const receivedQtyByItem: Record<string, number> = {};
      for (const gr of po.goodsReceipts) {
        for (const item of gr.items) {
          const key = item.purchaseOrderItemId;
          receivedQtyByItem[key] = (receivedQtyByItem[key] || 0) + item.receivedQuantity;
        }
      }

      return {
        purchaseOrderId: po.id,
        orderNumber: po.orderNumber,
        supplierId: po.supplierId,
        supplierName: po.supplier.businessName,
        estimatedDeliveryDate: po.estimatedDeliveryDate,
        deliveryStatus: po.deliveryStatus || 'PENDING',
        items: po.items.map((item) => {
          const receivedQty = receivedQtyByItem[item.id] || 0;
          return {
            productId: item.productId || undefined,
            materialId: item.materialId || undefined,
            itemName: item.product?.name || item.material?.name || '-',
            sku: item.product?.sku || item.material?.sku || '-',
            orderedQty: item.quantity,
            receivedQty,
            pendingQty: Math.max(0, item.quantity - receivedQty),
          };
        }).filter((item) => item.pendingQty > 0),
      };
    }).filter((po) => po.items.length > 0);

    // Calcola summary
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const summary = {
      totalOrders: incoming.length,
      pendingDeliveries: incoming.filter((i) => i.deliveryStatus === 'PENDING').length,
      inTransit: incoming.filter((i) => ['SHIPPED', 'IN_TRANSIT'].includes(i.deliveryStatus)).length,
      delayed: incoming.filter((i) =>
        i.deliveryStatus === 'DELAYED' ||
        (i.estimatedDeliveryDate && i.estimatedDeliveryDate < now && i.deliveryStatus !== 'DELIVERED')
      ).length,
      totalPendingItems: incoming.reduce((sum, po) =>
        sum + po.items.reduce((s, i) => s + i.pendingQty, 0), 0),
      expectedThisWeek: incoming.filter((i) =>
        i.estimatedDeliveryDate && i.estimatedDeliveryDate <= weekFromNow
      ).length,
    };

    return { incoming, summary };
  }

  /**
   * Previsione evasione ordini
   * Calcola quali ordini possono essere evasi e quando
   */
  async getOrderFulfillmentForecast(options?: {
    customerId?: string;
    limit?: number;
    includeShipped?: boolean;
  }): Promise<{
    orders: FulfillmentForecast[];
    summary: {
      totalOrders: number;
      readyToShip: number;
      partiallyReady: number;
      blocked: number;
      waitingMaterials: number;
    };
  }> {
    const { customerId, limit = 50, includeShipped = false } = options || {};

    // Trova ordini da evadere
    const statusFilter = (includeShipped
      ? ['CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED']
      : ['CONFIRMED', 'PROCESSING', 'READY']) as OrderStatus[];

    const orders = await prisma.order.findMany({
      where: {
        status: { in: statusFilter },
        ...(customerId && { customerId }),
      },
      include: {
        customer: {
          select: { id: true, businessName: true, firstName: true, lastName: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    });

    // Ottieni inventario corrente
    const productIds = [...new Set((orders as any[]).flatMap((o: any) =>
      o.items?.filter((i: any) => i.productId).map((i: any) => i.productId!) || []
    ))];

    const inventory = await prisma.inventoryItem.findMany({
      where: {
        productId: { in: productIds },
      },
      select: {
        productId: true,
        warehouseId: true,
        quantity: true,
      },
    });

    // Calcola disponibilità per prodotto
    const availableByProduct: Record<string, number> = {};
    for (const inv of inventory) {
      if (inv.productId) {
        availableByProduct[inv.productId] = (availableByProduct[inv.productId] || 0) + inv.quantity;
      }
    }

    // Ottieni materiali in arrivo per stima date
    const incomingMaterials = await this.getIncomingMaterials({ daysAhead: 60 });

    // Calcola previsione per ogni ordine
    const forecasts: FulfillmentForecast[] = [];

    for (const order of orders as any[]) {
      const missingItems: FulfillmentForecast['missingItems'] = [];
      let totalItems = 0;
      let readyItems = 0;

      for (const item of order.items || []) {
        if (!item.productId) continue;

        totalItems++;
        const requiredQty = item.quantity;
        const availableQty = availableByProduct[item.productId] || 0;

        if (availableQty >= requiredQty) {
          readyItems++;
          // Riduci disponibilità per ordini successivi
          availableByProduct[item.productId] -= requiredQty;
        } else {
          const shortageQty = requiredQty - availableQty;

          // Cerca arrivo previsto
          let expectedArrival: Date | undefined;
          for (const incoming of incomingMaterials.incoming) {
            const incomingItem = incoming.items.find((i) =>
              i.productId === item.productId && i.pendingQty >= shortageQty
            );
            if (incomingItem && incoming.estimatedDeliveryDate) {
              expectedArrival = incoming.estimatedDeliveryDate;
              break;
            }
          }

          missingItems.push({
            productId: item.productId,
            productName: item.product?.name || item.productName,
            sku: item.product?.sku || item.sku || '-',
            requiredQty,
            availableQty: Math.max(0, availableQty),
            shortageQty,
            expectedArrivalDate: expectedArrival,
          });

          // Usa ciò che è disponibile
          if (availableQty > 0) {
            availableByProduct[item.productId] = 0;
          }
        }
      }

      const readyPercentage = totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 100;

      // Determina stato fulfillment
      let fulfillmentStatus: FulfillmentForecast['fulfillmentStatus'];
      if (missingItems.length === 0) {
        fulfillmentStatus = 'READY';
      } else if (readyItems > 0) {
        fulfillmentStatus = 'PARTIAL';
      } else if (missingItems.some((i) => i.expectedArrivalDate)) {
        fulfillmentStatus = 'WAITING_MATERIALS';
      } else {
        fulfillmentStatus = 'BLOCKED';
      }

      // Stima data evasione
      let estimatedFulfillmentDate: Date | undefined;
      if (fulfillmentStatus === 'READY') {
        estimatedFulfillmentDate = new Date(); // Può essere evaso oggi
      } else if (fulfillmentStatus === 'WAITING_MATERIALS') {
        // Usa la data di arrivo più lontana
        const arrivalDates = missingItems
          .filter((i) => i.expectedArrivalDate)
          .map((i) => i.expectedArrivalDate!);
        if (arrivalDates.length > 0) {
          estimatedFulfillmentDate = new Date(Math.max(...arrivalDates.map((d) => d.getTime())));
        }
      }

      // Determina priorità
      let priority: FulfillmentForecast['priority'] = 'MEDIUM';
      if (order.priority === 'URGENT' || order.priority === 'HIGH') {
        priority = 'HIGH';
      } else if (order.priority === 'LOW') {
        priority = 'LOW';
      }

      // Calcola nome cliente
      const customerName = order.customer?.businessName ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        order.billingName ||
        '-';

      forecasts.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        orderDate: order.createdAt,
        status: order.status,
        totalAmount: Number(order.total),
        priority,
        fulfillmentStatus,
        readyPercentage,
        missingItems,
        estimatedFulfillmentDate,
      });
    }

    // Summary
    const summary = {
      totalOrders: forecasts.length,
      readyToShip: forecasts.filter((f) => f.fulfillmentStatus === 'READY').length,
      partiallyReady: forecasts.filter((f) => f.fulfillmentStatus === 'PARTIAL').length,
      blocked: forecasts.filter((f) => f.fulfillmentStatus === 'BLOCKED').length,
      waitingMaterials: forecasts.filter((f) => f.fulfillmentStatus === 'WAITING_MATERIALS').length,
    };

    return { orders: forecasts, summary };
  }

  /**
   * Ordini pronti per spedizione
   */
  async getReadyToShipOrders(): Promise<{
    orders: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      shippingAddress: string;
      totalAmount: number;
      itemCount: number;
      priority: string;
      createdAt: Date;
      shippingMethod?: string;
    }>;
    totalValue: number;
    totalOrders: number;
  }> {
    const orders = await prisma.order.findMany({
      where: {
        status: 'READY',
      },
      include: {
        customer: {
          select: { businessName: true, firstName: true, lastName: true },
        },
        items: {
          select: { quantity: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const result = orders.map((order: any) => {
      const customerName = order.customer?.businessName ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        order.billingName ||
        '-';

      const shippingAddress = [
        order.shippingAddress,
        order.shippingCity,
        order.shippingPostalCode,
        order.shippingCountry,
      ].filter(Boolean).join(', ');

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        shippingAddress,
        totalAmount: Number(order.total),
        itemCount: order.items.reduce((sum: number, i: any) => sum + i.quantity, 0),
        priority: String(order.priority || 'NORMAL'),
        createdAt: order.createdAt,
        shippingMethod: order.shippingMethod || undefined,
      };
    });

    return {
      orders: result as any,
      totalValue: result.reduce((sum, o) => sum + o.totalAmount, 0),
      totalOrders: result.length,
    };
  }

  /**
   * Programmazione produzione
   */
  async getProductionSchedule(options?: {
    status?: string[];
    daysAhead?: number;
  }): Promise<{
    schedule: ProductionScheduleItem[];
    summary: {
      totalOrders: number;
      readyToStart: number;
      inProgress: number;
      waitingMaterials: number;
      completed: number;
    };
  }> {
    const { status, daysAhead = 30 } = options || {};

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const productionOrders = await prisma.productionOrder.findMany({
      where: {
        status: status ? { in: status as ProductionOrderStatus[] } : { in: ['DRAFT', 'PLANNED', 'IN_PROGRESS'] as ProductionOrderStatus[] },
        OR: [
          { plannedEndDate: { lte: futureDate } },
          { plannedEndDate: null },
        ],
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
        salesOrder: {
          select: { id: true, orderNumber: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { plannedEndDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Ottieni materiali per tutti i prodotti
    const productIds = [...new Set(productionOrders.map((po) => po.productId))];

    const productMaterials = await prisma.productMaterial.findMany({
      where: {
        productId: { in: productIds },
      },
      include: {
        material: {
          select: { id: true, name: true, sku: true },
        },
      },
    });

    // Raggruppa materiali per prodotto
    const materialsByProduct: Record<string, typeof productMaterials> = {};
    for (const item of productMaterials) {
      if (!materialsByProduct[item.productId]) {
        materialsByProduct[item.productId] = [];
      }
      materialsByProduct[item.productId].push(item);
    }

    // Ottieni inventario materiali
    const materialIds = [...new Set(productMaterials.map((b) => b.materialId))];

    const materialInventory = await prisma.materialMovement.groupBy({
      by: ['materialId'],
      where: {
        materialId: { in: materialIds },
      },
      _sum: {
        quantity: true,
      },
    });

    const materialStock: Record<string, number> = {};
    for (const inv of materialInventory) {
      materialStock[inv.materialId] = inv._sum.quantity || 0;
    }

    // Calcola schedule
    const schedule: ProductionScheduleItem[] = [];

    for (const po of productionOrders) {
      const materials = materialsByProduct[po.productId] || [];
      const missingMaterials: ProductionScheduleItem['missingMaterials'] = [];

      for (const mat of materials) {
        const requiredQty = Number(mat.quantity) * po.quantity;
        const availableQty = materialStock[mat.materialId] || 0;

        if (availableQty < requiredQty) {
          missingMaterials.push({
            materialId: mat.materialId,
            materialName: mat.material.name,
            code: mat.material.sku,
            requiredQty,
            availableQty,
            shortageQty: requiredQty - availableQty,
          });
        }
      }

      const materialsReady = missingMaterials.length === 0;

      // Determina priorità
      let priority: ProductionScheduleItem['priority'] = 'MEDIUM';
      const poPriority = po.priority as any;
      if (poPriority === 'URGENT' || poPriority === 'HIGH' || poPriority >= 8) {
        priority = 'HIGH';
      } else if (poPriority === 'LOW' || poPriority <= 2) {
        priority = 'LOW';
      }

      const poAny = po as any;
      schedule.push({
        productionOrderId: po.id,
        orderNumber: po.orderNumber,
        productId: po.productId,
        productName: poAny.product?.name || '',
        sku: poAny.product?.sku || '',
        quantity: po.quantity,
        status: po.status,
        priority,
        startDate: po.plannedStartDate || undefined,
        dueDate: po.plannedEndDate || undefined,
        materialsReady,
        missingMaterials,
        linkedOrderId: poAny.salesOrder?.id,
        linkedOrderNumber: poAny.salesOrder?.orderNumber,
      });
    }

    // Summary
    const summary = {
      totalOrders: schedule.length,
      readyToStart: schedule.filter((s) => s.materialsReady && s.status === 'DRAFT').length,
      inProgress: schedule.filter((s) => s.status === 'IN_PROGRESS').length,
      waitingMaterials: schedule.filter((s) => !s.materialsReady).length,
      completed: 0, // Non inclusi nel filtro
    };

    return { schedule, summary };
  }

  /**
   * Timeline materiale
   * Mostra proiezione stock nel tempo con arrivi e consumi previsti
   */
  async getMaterialTimeline(materialId: string, daysAhead: number = 30): Promise<MaterialTimeline> {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        inventoryItems: true,
      },
    });

    if (!material) {
      throw new Error('Materiale non trovato');
    }

    // Stock corrente
    const currentStock = material.inventoryItems.reduce(
      (sum, inv) => sum + inv.quantity,
      0
    );

    // Timeline events
    const timeline: MaterialTimeline['timeline'] = [];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Aggiungi stock corrente
    timeline.push({
      date: new Date(),
      type: 'CURRENT',
      description: 'Stock attuale',
      quantity: currentStock,
      balanceAfter: currentStock,
    });

    // Ottieni arrivi previsti
    const incomingOrders = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'] as PurchaseOrderStatus[] },
        estimatedDeliveryDate: { lte: futureDate },
        items: {
          some: { materialId },
        },
      },
      include: {
        items: {
          where: { materialId },
        },
        goodsReceipts: {
          include: {
            items: {
              where: {
                purchaseOrderItem: {
                  materialId,
                },
              },
            },
          },
        },
      },
      orderBy: { estimatedDeliveryDate: 'asc' },
    });

    // Aggiungi arrivi alla timeline
    for (const po of incomingOrders) {
      if (!po.estimatedDeliveryDate) continue;

      for (const item of po.items) {
        // Calcola quantità già ricevuta
        const receivedQty = po.goodsReceipts.reduce(
          (sum, gr) => sum + gr.items.reduce((s, i) => s + i.receivedQuantity, 0),
          0
        );
        const pendingQty = item.quantity - receivedQty;

        if (pendingQty > 0) {
          timeline.push({
            date: po.estimatedDeliveryDate,
            type: 'INCOMING',
            description: `Arrivo da PO ${po.orderNumber}`,
            quantity: pendingQty,
            balanceAfter: 0, // Calcolato dopo
            source: 'PurchaseOrder',
            sourceId: po.id,
          });
        }
      }
    }

    // Ottieni consumi previsti da ordini di produzione
    const productionOrders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ['DRAFT', 'PLANNED', 'IN_PROGRESS'] },
        product: {
          productMaterials: {
            some: { materialId },
          },
        },
      },
      include: {
        product: {
          include: {
            productMaterials: {
              where: { materialId },
            },
          },
        },
      },
    });

    // Aggiungi consumi alla timeline
    for (const po of productionOrders) {
      for (const mat of po.product.productMaterials) {
        const consumptionQty = Number(mat.quantity) * po.quantity;
        const consumptionDate = po.plannedStartDate || po.plannedEndDate || new Date();

        timeline.push({
          date: consumptionDate,
          type: 'CONSUMPTION',
          description: `Produzione ${po.orderNumber} - ${po.product.name}`,
          quantity: -consumptionQty,
          balanceAfter: 0, // Calcolato dopo
          source: 'ProductionOrder',
          sourceId: po.id,
        });
      }
    }

    // Ordina timeline per data
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calcola balance after per ogni evento
    let balance = currentStock;
    for (const event of timeline) {
      if (event.type !== 'CURRENT') {
        balance += event.quantity;
      }
      event.balanceAfter = balance;
    }

    // Calcola data stockout prevista
    let projectedStockout: Date | undefined;
    for (const event of timeline) {
      if (event.balanceAfter <= 0) {
        projectedStockout = event.date;
        break;
      }
    }

    // Calcola data riordino suggerita (quando stock scende sotto reorderPoint)
    let suggestedReorderDate: Date | undefined;
    const reorderPoint = material.reorderPoint || material.minStock || 0;
    for (const event of timeline) {
      if (event.balanceAfter <= reorderPoint) {
        suggestedReorderDate = event.date;
        break;
      }
    }

    return {
      materialId: material.id,
      materialName: material.name,
      code: material.sku,
      currentStock,
      minStock: material.minStock || 0,
      reorderPoint: material.reorderPoint || 0,
      unit: material.unit,
      timeline,
      projectedStockout,
      suggestedReorderDate,
    };
  }

  /**
   * Dashboard logistica - KPI principali
   * Con caching per performance ottimali
   */
  async getLogisticsDashboard(): Promise<{
    incoming: {
      totalOrders: number;
      expectedThisWeek: number;
      delayed: number;
      totalValue: number;
    };
    fulfillment: {
      readyToShip: number;
      readyValue: number;
      blocked: number;
      avgFulfillmentRate: number;
    };
    production: {
      activeOrders: number;
      readyToStart: number;
      waitingMaterials: number;
    };
    alerts: Array<{
      type: 'WARNING' | 'ERROR' | 'INFO';
      message: string;
      entityType: string;
      entityId?: string;
    }>;
    _cached?: boolean;
  }> {
    // Prova a recuperare dalla cache
    try {
      const cached = await getCache(CACHE_KEYS.DASHBOARD);
      if (cached) {
        logger.debug('Logistics dashboard served from cache');
        return { ...cached, _cached: true };
      }
    } catch {
      // Cache miss o errore, continua con query
    }

    // Incoming materials
    const incoming = await this.getIncomingMaterials({ daysAhead: 7 });

    // Calcola valore ordini in arrivo
    const purchaseOrdersValue = await prisma.purchaseOrder.aggregate({
      where: {
        status: { in: ['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'] },
      },
      _sum: { total: true },
    });

    // Fulfillment
    const fulfillment = await this.getOrderFulfillmentForecast({ limit: 100 });
    const readyOrders = fulfillment.orders.filter((o) => o.fulfillmentStatus === 'READY');

    // Production
    const production = await this.getProductionSchedule();

    // Genera alerts
    const alerts: Array<{
      type: 'WARNING' | 'ERROR' | 'INFO';
      message: string;
      entityType: string;
      entityId?: string;
    }> = [];

    // Alert per consegne in ritardo
    if (incoming.summary.delayed > 0) {
      alerts.push({
        type: 'WARNING',
        message: `${incoming.summary.delayed} consegne in ritardo`,
        entityType: 'PurchaseOrder',
      });
    }

    // Alert per ordini bloccati
    if (fulfillment.summary.blocked > 0) {
      alerts.push({
        type: 'ERROR',
        message: `${fulfillment.summary.blocked} ordini bloccati per mancanza materiali`,
        entityType: 'Order',
      });
    }

    // Alert per produzioni in attesa materiali
    if (production.summary.waitingMaterials > 0) {
      alerts.push({
        type: 'WARNING',
        message: `${production.summary.waitingMaterials} ordini produzione in attesa materiali`,
        entityType: 'ProductionOrder',
      });
    }

    // Alert per ordini pronti da spedire
    if (fulfillment.summary.readyToShip > 5) {
      alerts.push({
        type: 'INFO',
        message: `${fulfillment.summary.readyToShip} ordini pronti per la spedizione`,
        entityType: 'Order',
      });
    }

    const result = {
      incoming: {
        totalOrders: incoming.summary.totalOrders,
        expectedThisWeek: incoming.summary.expectedThisWeek,
        delayed: incoming.summary.delayed,
        totalValue: Number(purchaseOrdersValue._sum.total || 0),
      },
      fulfillment: {
        readyToShip: fulfillment.summary.readyToShip,
        readyValue: readyOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        blocked: fulfillment.summary.blocked,
        avgFulfillmentRate: fulfillment.orders.length > 0
          ? Math.round(fulfillment.orders.reduce((sum, o) => sum + o.readyPercentage, 0) / fulfillment.orders.length)
          : 100,
      },
      production: {
        activeOrders: production.summary.totalOrders,
        readyToStart: production.summary.readyToStart,
        waitingMaterials: production.summary.waitingMaterials,
      },
      alerts,
    };

    // Salva in cache
    try {
      await setCache(CACHE_KEYS.DASHBOARD, result, CACHE_TTL.DASHBOARD);
    } catch {
      // Errore cache, ignora
    }

    return result;
  }

  /**
   * Invalida cache logistica
   * Da chiamare quando ci sono modifiche a ordini, PO o produzione
   */
  async invalidateCache(): Promise<void> {
    try {
      await Promise.all([
        deleteCache(CACHE_KEYS.DASHBOARD),
        deleteCache(CACHE_KEYS.INCOMING),
        deleteCache(CACHE_KEYS.FULFILLMENT),
        deleteCache(CACHE_KEYS.READY_TO_SHIP),
        deleteCache(CACHE_KEYS.PRODUCTION),
      ]);
      logger.debug('Logistics cache invalidated');
    } catch (error) {
      logger.error('Error invalidating logistics cache:', error);
    }
  }
}

// Exports
export const logisticsPlanningService = new LogisticsPlanningService();
export default logisticsPlanningService;
