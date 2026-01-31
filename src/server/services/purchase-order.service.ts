// Imports
import purchaseOrderRepository from '../repositories/purchase-order.repository';
import supplierRepository from '../repositories/supplier.repository';
import notificationService from './notification.service';
import logger from '../config/logger';
import { PurchaseOrderStatus, InventoryLocation } from '@prisma/client';
import { prisma } from '../config/database';

// Types/Interfaces
interface CreatePurchaseOrderInput {
  supplierId: string;
  orderDate?: Date | string;
  expectedDeliveryDate?: Date | string | null;
  paymentTerms?: number;
  notes?: string;
  items: Array<{
    productId?: string | null;
    materialId?: string | null;
    quantity: number;
    unitPrice: number;
    tax?: number;
  }>;
  subtotalAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
}

interface UpdatePurchaseOrderInput {
  expectedDate?: Date;
  notes?: string;
  status?: PurchaseOrderStatus;
}

interface ReceiveItemsInput {
  orderId: string;
  items: Array<{
    itemId: string;
    receivedQuantity: number;
    lotNumber?: string;
  }>;
  warehouseId?: string;
  warehouseLocation?: string;
}

interface ListPurchaseOrdersQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  status?: PurchaseOrderStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Purchase Order Service
 * Business logic per gestione ordini d'acquisto
 */
class PurchaseOrderService {
  /**
   * Lista ordini d'acquisto con filtri
   */
  async listPurchaseOrders(query: ListPurchaseOrdersQuery) {
    const { page = 1, limit = 20, supplierId, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: any = {};

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const result = await purchaseOrderRepository.findAll({
      skip,
      take: limit,
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    logger.info(`Listed purchase orders: ${result.items.length} of ${result.total}`);

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Ottieni ordine per ID
   */
  async getPurchaseOrderById(id: string) {
    const order = await purchaseOrderRepository.findById(id);

    if (!order) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    logger.info(`Retrieved purchase order: ${order.orderNumber}`);

    return order;
  }

  /**
   * Crea nuovo ordine d'acquisto
   */
  async createPurchaseOrder(data: CreatePurchaseOrderInput) {
    // Verifica esistenza fornitore
    const supplier = await supplierRepository.findById(data.supplierId);
    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Genera numero ordine
    const orderNumber = await purchaseOrderRepository.generateOrderNumber();

    // Calcola totali e prepara items con supporto per prodotti E materiali
    const taxRate = data.taxRate || 22;
    const items = data.items.map((item) => {
      const itemTax = item.tax ?? taxRate;
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTaxAmount = (itemSubtotal * itemTax) / 100;
      const itemTotal = itemSubtotal + itemTaxAmount;

      return {
        productId: item.productId || null,
        materialId: item.materialId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tax: itemTax,
        total: itemTotal,
      };
    });

    // Calcola totali ordine
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.tax) / 100, 0);
    const total = subtotal + tax;

    // Determina orderType: MATERIAL se tutti materiali, FINISHED_PRODUCT se tutti prodotti, MIXED altrimenti
    const hasProducts = items.some(i => i.productId);
    const hasMaterials = items.some(i => i.materialId);
    const orderType = hasProducts && hasMaterials ? 'MIXED' : hasMaterials ? 'MATERIAL' : 'FINISHED_PRODUCT';

    // Parse dates
    const expectedDate = data.expectedDeliveryDate
      ? new Date(data.expectedDeliveryDate)
      : null;

    // Crea ordine
    const order = await purchaseOrderRepository.createWithItems(
      {
        orderNumber,
        supplier: {
          connect: { id: data.supplierId },
        },
        subtotal,
        tax,
        total,
        expectedDate,
        paymentTerms: data.paymentTerms || 30,
        notes: data.notes || null,
        orderType: orderType as any,
      },
      items
    );

    logger.info(`Created purchase order: ${order.orderNumber} for supplier ${supplier.businessName} - Total: ${total}`);

    // Notifica magazziniere
    await notificationService.notifyRoles(['MAGAZZINIERE', 'ADMIN'], {
      type: 'SYSTEM',
      title: 'Nuovo Ordine d\'Acquisto',
      message: `Creato ordine ${order.orderNumber} da fornitore ${supplier.businessName}`,
      link: `/purchase-orders/${order.id}`,
    });

    return order;
  }

  /**
   * Aggiorna ordine d'acquisto
   */
  async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderInput) {
    const existing = await purchaseOrderRepository.findById(id);
    if (!existing) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    // Non permettere modifiche se già ricevuto
    if (existing.status === 'RECEIVED' || existing.status === 'CANCELLED') {
      throw new Error('Non è possibile modificare un ordine ricevuto o cancellato');
    }

    const order = await purchaseOrderRepository.update(id, data);

    logger.info(`Updated purchase order: ${order.orderNumber}`);

    return order;
  }

  /**
   * Registra ricezione merce
   */
  async receiveItems(data: ReceiveItemsInput) {
    const orderResult = await purchaseOrderRepository.findById(data.orderId);
    if (!orderResult) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    // Type assertion - findById always includes items and supplier
    const order = orderResult as typeof orderResult & {
      items: Array<{ id: string; productId: string | null; materialId: string | null }>;
      supplier?: { businessName?: string };
    };

    // Verifica che l'ordine sia in stato valido
    if (order.status === 'CANCELLED' || order.status === 'DRAFT') {
      throw new Error('Non è possibile ricevere merce per questo ordine');
    }

    // Usa warehouseId e location dalla richiesta o default
    const warehouseId = data.warehouseId || 'default-warehouse';
    const warehouseLocationStr = data.warehouseLocation || 'WEB';
    // Map string to InventoryLocation enum
    const warehouseLocation = (InventoryLocation[warehouseLocationStr as keyof typeof InventoryLocation] || InventoryLocation.WEB) as InventoryLocation;

    // Registra ricezione
    const updatedOrder = await purchaseOrderRepository.receiveItems(
      data.orderId,
      data.items
    );

    // Aggiorna inventario per ogni item ricevuto
    for (const item of data.items) {
      const orderItem = order.items.find((oi: any) => oi.id === item.itemId);
      if (!orderItem) continue;

      // GESTIONE PRODOTTI
      if (orderItem.productId) {
        const productId = orderItem.productId; // Type narrowing

        // Crea movimento di magazzino IN per prodotto
        await prisma.inventoryMovement.create({
          data: {
            productId,
            toLocation: warehouseLocation,
            type: 'IN',
            quantity: item.receivedQuantity,
            lotNumber: item.lotNumber,
            reference: `PO-${order.orderNumber}`,
            notes: `Ricezione da ordine fornitore ${order.supplier?.businessName || 'N/A'}`,
          },
        });

        // Aggiorna giacenza prodotto
        const lotNum = item.lotNumber || '';
        await prisma.inventoryItem.upsert({
          where: {
            warehouseId_productId_variantId_location_lotNumber: {
              warehouseId,
              productId,
              variantId: '',
              location: warehouseLocation,
              lotNumber: lotNum,
            },
          },
          create: {
            warehouseId,
            productId,
            location: warehouseLocation,
            quantity: item.receivedQuantity,
            lotNumber: item.lotNumber,
          },
          update: {
            quantity: {
              increment: item.receivedQuantity,
            },
          },
        });
      }

      // GESTIONE MATERIALI
      if (orderItem.materialId) {
        // Crea movimento materiale IN
        await prisma.materialMovement.create({
          data: {
            materialId: orderItem.materialId,
            toLocation: warehouseLocation,
            type: 'IN',
            quantity: item.receivedQuantity,
            lotNumber: item.lotNumber,
            reference: `PO-${order.orderNumber}`,
            notes: `Ricezione da ordine fornitore ${order.supplier?.businessName || 'N/A'}`,
          },
        });

        // Aggiorna currentStock sul materiale
        await prisma.material.update({
          where: { id: orderItem.materialId },
          data: {
            currentStock: {
              increment: item.receivedQuantity,
            },
          },
        });
      }
    }

    logger.info(`Received items for purchase order: ${order.orderNumber} - Warehouse: ${warehouseId}, Location: ${warehouseLocation}`);

    // Notifica se ordine completamente ricevuto
    if (updatedOrder.status === 'RECEIVED') {
      await notificationService.notifyRoles(['ADMIN', 'MANAGER'], {
        type: 'SYSTEM',
        title: 'Ordine Ricevuto Completamente',
        message: `Ordine ${order.orderNumber} ricevuto completamente`,
        link: `/purchase-orders/${order.id}`,
      });
    }

    return updatedOrder;
  }

  /**
   * Conferma ordine (invia a fornitore)
   */
  async confirmPurchaseOrder(id: string) {
    const order = await purchaseOrderRepository.findById(id);
    if (!order) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    if (order.status !== 'DRAFT') {
      throw new Error('Solo gli ordini in bozza possono essere confermati');
    }

    const updatedOrder = await purchaseOrderRepository.updateStatus(id, 'SENT');

    logger.info(`Confirmed purchase order: ${order.orderNumber}`);

    // TODO: Invia email a fornitore

    return updatedOrder;
  }

  /**
   * Cancella ordine
   */
  async cancelPurchaseOrder(id: string, reason?: string) {
    const order = await purchaseOrderRepository.findById(id);
    if (!order) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    if (order.status === 'RECEIVED') {
      throw new Error('Non è possibile cancellare un ordine già ricevuto');
    }

    const updatedOrder = await purchaseOrderRepository.cancel(id);

    logger.info(`Cancelled purchase order: ${order.orderNumber}. Reason: ${reason || 'N/A'}`);

    // Notifica
    await notificationService.notifyRoles(['ADMIN', 'MANAGER'], {
      type: 'SYSTEM',
      title: 'Ordine Cancellato',
      message: `Ordine ${order.orderNumber} cancellato. ${reason || ''}`,
      link: `/purchase-orders/${order.id}`,
    });

    return updatedOrder;
  }

  /**
   * Ottieni statistiche ordini fornitore
   */
  async getSupplierOrderStatistics(supplierId: string, startDate?: Date, endDate?: Date) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    const stats = await purchaseOrderRepository.getSupplierOrderStats(supplierId, startDate, endDate);

    return {
      supplier: {
        code: supplier.code,
        businessName: supplier.businessName,
      },
      ...stats,
    };
  }

  // =====================
  // ANALYTICS METHODS
  // =====================

  /**
   * Helper: genera range di date
   */
  private generateDateRange(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Timeline acquisti per grafico
   */
  async getPurchaseTimeline(days: number = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
      },
      include: {
        supplier: { select: { id: true, businessName: true } },
      },
    });

    // Raggruppa per giorno
    const byDay = new Map<string, { count: number; total: number; suppliers: Map<string, { name: string; total: number }> }>();

    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!byDay.has(date)) {
        byDay.set(date, { count: 0, total: 0, suppliers: new Map() });
      }
      const day = byDay.get(date)!;
      day.count++;
      day.total += Number(order.total || 0);

      const supplierId = order.supplier?.id || 'unknown';
      const supplierName = order.supplier?.businessName || 'Sconosciuto';
      if (!day.suppliers.has(supplierId)) {
        day.suppliers.set(supplierId, { name: supplierName, total: 0 });
      }
      day.suppliers.get(supplierId)!.total += Number(order.total || 0);
    });

    // Genera array date
    const dates = this.generateDateRange(startDate, new Date());

    return {
      labels: dates,
      ordersCount: dates.map((d) => byDay.get(d)?.count || 0),
      totalSpent: dates.map((d) => byDay.get(d)?.total || 0),
      summary: {
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        avgOrderValue:
          orders.length > 0
            ? orders.reduce((sum, o) => sum + Number(o.total || 0), 0) / orders.length
            : 0,
      },
    };
  }

  /**
   * Analisi stagionalità acquisti (12 mesi)
   */
  async getPurchaseSeasonality() {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        createdAt: { gte: twoYearsAgo },
        status: { in: ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
      },
      select: { createdAt: true, total: true },
    });

    // Raggruppa per mese (1-12)
    const monthlyData = new Map<number, { orders: number; total: number }>();

    for (let m = 1; m <= 12; m++) {
      monthlyData.set(m, { orders: 0, total: 0 });
    }

    orders.forEach((order) => {
      const month = order.createdAt.getMonth() + 1;
      const data = monthlyData.get(month)!;
      data.orders++;
      data.total += Number(order.total || 0);
    });

    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const monthlyPattern = Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      monthName: monthNames[month - 1],
      ordersCount: data.orders,
      totalSpent: data.total,
      avgOrderValue: data.orders > 0 ? data.total / data.orders : 0,
      percentageOfTotal: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
    }));

    // Identifica mesi picco e bassi
    const avgMonthlySpent = totalSpent / 12;
    const peakMonths = monthlyPattern.filter((m) => m.totalSpent > avgMonthlySpent * 1.2).map((m) => m.month);
    const lowMonths = monthlyPattern.filter((m) => m.totalSpent < avgMonthlySpent * 0.8).map((m) => m.month);

    return { monthlyPattern, peakMonths, lowMonths };
  }

  /**
   * Previsioni riordino materiali basate su consumi e giacenze
   */
  async getPurchaseForecasting() {
    // Carica materiali attivi con fornitore preferito
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      include: {
        supplierItems: {
          where: { isActive: true, isPreferred: true },
          include: { supplier: true, volumeDiscounts: true },
          take: 1,
        },
      },
    });

    // Calcola consumo medio ultimi 90 giorni
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const materialForecasts = await Promise.all(
      materials.map(async (material) => {
        // Consumo totale ultimi 90 giorni da MaterialConsumption
        const consumption = await prisma.materialConsumption.aggregate({
          where: {
            materialId: material.id,
            createdAt: { gte: ninetyDaysAgo },
          },
          _sum: { actualQuantity: true },
        });

        // Se non ci sono consumi, prova con MaterialMovement tipo OUT
        let totalConsumed = Number(consumption._sum.actualQuantity || 0);
        if (totalConsumed === 0) {
          const movements = await prisma.materialMovement.aggregate({
            where: {
              materialId: material.id,
              type: 'OUT',
              createdAt: { gte: ninetyDaysAgo },
            },
            _sum: { quantity: true },
          });
          totalConsumed = Number(movements._sum.quantity || 0);
        }

        const avgDailyConsumption = totalConsumed / 90;
        const currentStock = Number(material.currentStock || 0);
        const daysUntilStockout = avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : null;

        const preferredSupplier = material.supplierItems[0];
        const leadTimeDays = preferredSupplier?.leadTimeDays || material.leadTimeDays || 7;

        // Data suggerita riordino = oggi + (giorni fino esaurimento - lead time - buffer 7 giorni)
        let suggestedRecreatedAt: Date | null = null;
        if (daysUntilStockout !== null && daysUntilStockout < 60) {
          const daysToOrder = Math.max(0, daysUntilStockout - leadTimeDays - 7);
          suggestedRecreatedAt = new Date();
          suggestedRecreatedAt.setDate(suggestedRecreatedAt.getDate() + daysToOrder);
        }

        // Quantità suggerita = consumo 45 giorni (30 + buffer)
        const suggestedQuantity = Math.ceil(avgDailyConsumption * 45);

        // Status
        let status: 'CRITICAL' | 'LOW' | 'OK' = 'OK';
        if (currentStock <= Number(material.minStock || 0)) {
          status = 'CRITICAL';
        } else if (daysUntilStockout !== null && daysUntilStockout <= 30) {
          status = 'LOW';
        }

        return {
          materialId: material.id,
          materialName: material.name,
          code: material.sku,
          currentStock,
          minStock: Number(material.minStock || 0),
          avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
          daysUntilStockout: daysUntilStockout ? Math.round(daysUntilStockout) : null,
          suggestedRecreatedAt,
          suggestedQuantity,
          preferredSupplierId: preferredSupplier?.supplier?.id || null,
          preferredSupplierName: preferredSupplier?.supplier?.businessName || null,
          lastPurchasePrice: preferredSupplier ? Number(preferredSupplier.lastPurchasePrice) : null,
          leadTimeDays,
          status,
        };
      })
    );

    // Filtra solo quelli che necessitano attenzione
    const needsAttention = materialForecasts.filter(
      (m) => m.status !== 'OK' || (m.daysUntilStockout !== null && m.daysUntilStockout < 45)
    );

    return {
      materials: needsAttention.sort((a, b) => {
        if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1;
        if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1;
        return (a.daysUntilStockout || 999) - (b.daysUntilStockout || 999);
      }),
      summary: {
        criticalCount: materialForecasts.filter((m) => m.status === 'CRITICAL').length,
        lowCount: materialForecasts.filter((m) => m.status === 'LOW').length,
        totalMaterials: materials.length,
      },
    };
  }

  /**
   * Opportunità di sconto basate su storico acquisti
   */
  async getDiscountOpportunities() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Aggregato acquisti per item ultimo anno
    const purchases = await prisma.purchaseOrderItem.groupBy({
      by: ['productId', 'materialId'],
      where: {
        purchaseOrder: {
          createdAt: { gte: oneYearAgo },
          status: { in: ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
        },
      },
      _sum: { quantity: true, total: true },
    });

    const opportunities: any[] = [];

    for (const purchase of purchases) {
      const itemId = purchase.productId || purchase.materialId;
      if (!itemId) continue;

      const isProduct = !!purchase.productId;

      // Trova SupplierItem con sconti volume
      const supplierItems = await prisma.supplierItem.findMany({
        where: isProduct ? { productId: itemId } : { materialId: itemId },
        include: {
          supplier: true,
          volumeDiscounts: { orderBy: { minQuantity: 'asc' } },
          product: isProduct ? { select: { name: true, sku: true } } : undefined,
          material: !isProduct ? { select: { name: true, sku: true } } : undefined,
        },
      });

      for (const si of supplierItems) {
        const totalQty = Number(purchase._sum.quantity || 0);
        const totalSpent = Number(purchase._sum.total || 0);

        // Trova sconto attuale e prossimo
        const currentDiscount = si.volumeDiscounts
          .filter((d) => Number(d.minQuantity) <= totalQty)
          .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity))[0];

        const nextDiscount = si.volumeDiscounts
          .filter((d) => Number(d.minQuantity) > totalQty)
          .sort((a, b) => Number(a.minQuantity) - Number(b.minQuantity))[0];

        if (nextDiscount) {
          const qtyToNext = Number(nextDiscount.minQuantity) - totalQty;
          const potentialSavings = totalSpent * (Number(nextDiscount.discountPercent) / 100);

          opportunities.push({
            supplierId: si.supplier.id,
            supplierName: si.supplier.businessName,
            itemId,
            itemName: isProduct ? si.product?.name : si.material?.name,
            itemCode: isProduct ? si.product?.sku : si.material?.sku,
            itemType: isProduct ? 'PRODUCT' : 'MATERIAL',
            last12MonthsQuantity: totalQty,
            last12MonthsSpent: totalSpent,
            currentDiscount: currentDiscount
              ? {
                  minQuantity: Number(currentDiscount.minQuantity),
                  discountPercent: Number(currentDiscount.discountPercent),
                }
              : null,
            nextDiscount: {
              minQuantity: Number(nextDiscount.minQuantity),
              discountPercent: Number(nextDiscount.discountPercent),
            },
            quantityToNextDiscount: qtyToNext,
            potentialSavings,
            recommendation:
              qtyToNext <= totalQty * 0.2
                ? `Mancano solo ${qtyToNext} unità per sbloccare -${nextDiscount.discountPercent}%! Considera un ordine più grande.`
                : `Acquistando ${qtyToNext} unità in più otterrai -${nextDiscount.discountPercent}% di sconto.`,
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Storico ordini per un articolo specifico (prodotto o materiale)
   * Utile per verificare se un articolo è già stato ordinato di recente
   */
  async getItemOrderHistory(params: {
    productId?: string;
    materialId?: string;
    daysBack?: number;
    includeReceived?: boolean;
  }) {
    const { productId, materialId, daysBack = 180, includeReceived = true } = params;

    if (!productId && !materialId) {
      throw new Error('Specificare productId o materialId');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Status da includere
    const statusFilter = includeReceived
      ? ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED']
      : ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'];

    // Cerca ordini che contengono l'articolo
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: statusFilter as PurchaseOrderStatus[] },
        items: {
          some: {
            ...(productId && { productId }),
            ...(materialId && { materialId }),
          },
        },
      },
      include: {
        supplier: {
          select: { id: true, businessName: true, code: true, email: true },
        },
        items: {
          where: {
            ...(productId && { productId }),
            ...(materialId && { materialId }),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            material: { select: { id: true, name: true, sku: true } },
          },
        },
        goodsReceipts: {
          include: {
            items: {
              where: {
                purchaseOrderItem: {
                  ...(productId && { productId }),
                  ...(materialId && { materialId }),
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Processa risultati
    const history = orders.map((order: any) => {
      const item = order.items[0]; // Dovrebbe esserci sempre almeno 1 item
      if (!item) return null;

      // Calcola quantità ricevuta
      const receivedQty = order.goodsReceipts.reduce(
        (sum: number, gr: any) => sum + gr.items.reduce((s: number, i: any) => s + i.receivedQuantity, 0),
        0
      );

      const pendingQty = item.quantity - receivedQty;
      const isOpen = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        isOpen, // true = ordine ancora aperto, possibile consolidare
        createdAt: order.createdAt,
        expectedDeliveryDate: order.estimatedDeliveryDate,
        supplier: {
          id: order.supplier.id,
          name: order.supplier.businessName,
          code: order.supplier.code,
          email: order.supplier.email,
        },
        item: {
          id: item.id,
          type: item.productId ? 'PRODUCT' : 'MATERIAL',
          name: item.product?.name || item.material?.name || '-',
          sku: item.product?.sku || item.material?.sku || '-',
          orderedQty: item.quantity,
          receivedQty,
          pendingQty,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        },
        // Suggerimento consolidamento
        canConsolidate: isOpen && order.status === 'DRAFT',
        consolidateMessage: isOpen
          ? order.status === 'DRAFT'
            ? 'Puoi aggiungere articoli a questo ordine'
            : 'Ordine già inviato - contatta il fornitore per aggiungere articoli alla stessa spedizione'
          : null,
      };
    }).filter(Boolean);

    // Carica info articolo
    let itemInfo = null;
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, sku: true, price: true },
      });
      itemInfo = product ? { ...product, type: 'PRODUCT' } : null;
    } else if (materialId) {
      const material = await prisma.material.findUnique({
        where: { id: materialId },
        select: { id: true, name: true, sku: true, currentStock: true, minStock: true, reorderPoint: true },
      });
      itemInfo = material ? { ...material, type: 'MATERIAL' } : null;
    }

    // Riepilogo
    const openOrders = history.filter((h) => h?.isOpen);
    const totalOrderedOpen = openOrders.reduce((sum, h) => sum + (h?.item.orderedQty || 0), 0);
    const totalPendingOpen = openOrders.reduce((sum, h) => sum + (h?.item.pendingQty || 0), 0);

    return {
      item: itemInfo,
      history,
      summary: {
        totalOrders: history.length,
        openOrders: openOrders.length,
        totalOrderedInPeriod: history.reduce((sum, h) => sum + (h?.item.orderedQty || 0), 0),
        totalReceivedInPeriod: history.reduce((sum, h) => sum + (h?.item.receivedQty || 0), 0),
        totalOrderedOpen, // Quantità ordinata in ordini ancora aperti
        totalPendingOpen, // Quantità ancora da ricevere
        hasOpenOrders: openOrders.length > 0,
        canConsolidateWith: openOrders.filter((h) => h?.canConsolidate).map((h) => ({
          orderId: h?.orderId,
          orderNumber: h?.orderNumber,
          supplierName: h?.supplier.name,
        })),
      },
    };
  }
}

// Main logic & Exports
export default new PurchaseOrderService();
