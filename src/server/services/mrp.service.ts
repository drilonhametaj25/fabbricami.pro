import { prisma } from '../config/database';
import { logger } from '../config/logger';
import notificationService from './notification.service';

/**
 * MRP Service (Material Requirements Planning)
 * Algoritmo per calcolo fabbisogno materiali e suggerimenti riordino
 */

interface MaterialRequirement {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  requiredQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  shortageQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  leadTimeDays: number;
  supplierId?: string;
  supplierName?: string;
  suggestedOrderDate: Date | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedCost: number;
}

interface MRPResult {
  calculationDate: Date;
  planningHorizonDays: number;
  requirements: MaterialRequirement[];
  summary: {
    totalMaterials: number;
    criticalShortages: number;
    highPriorityItems: number;
    estimatedTotalCost: number;
    suppliersInvolved: number;
  };
  suggestedPurchaseOrders: SuggestedPurchaseOrder[];
}

interface SuggestedPurchaseOrder {
  supplierId: string;
  supplierName: string;
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  totalCost: number;
  suggestedOrderDate: Date;
  expectedDeliveryDate: Date;
}

interface DemandForecast {
  productId: string;
  forecastQuantity: number;
  confidence: number;
}

class MRPService {
  /**
   * Calcola fabbisogno materiali per ordini confermati
   */
  async calculateRequirementsForOrders(): Promise<MRPResult> {
    const planningHorizonDays = 30;
    const requirements: MaterialRequirement[] = [];

    // 1. Ottieni ordini confermati/in lavorazione che richiedono materiali
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING'] },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                bomItems: {
                  include: {
                    componentProduct: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 2. Calcola fabbisogno lordo per ogni componente
    const grossRequirements: Record<string, { quantity: number; neededBy: Date }> = {};

    for (const order of pendingOrders) {
      for (const item of order.items) {
        // Esplodi BOM per questo prodotto
        const bomItems = await this.explodeBomRecursive(item.productId, item.quantity);

        for (const bomItem of bomItems) {
          if (!grossRequirements[bomItem.componentId]) {
            grossRequirements[bomItem.componentId] = {
              quantity: 0,
              neededBy: order.orderDate,
            };
          }
          grossRequirements[bomItem.componentId].quantity += bomItem.totalQuantity;

          // Prendi la data più urgente
          if (order.orderDate < grossRequirements[bomItem.componentId].neededBy) {
            grossRequirements[bomItem.componentId].neededBy = order.orderDate;
          }
        }
      }
    }

    // 3. Calcola fabbisogno netto considerando giacenze
    for (const [productId, requirement] of Object.entries(grossRequirements)) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          supplier: true,
          inventory: true,
        },
      });

      if (!product) continue;

      // Calcola giacenza disponibile
      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const reservedStock = product.inventory.reduce((sum, inv) => sum + inv.reservedQuantity, 0);
      const availableStock = totalStock - reservedStock;

      // Calcola shortage
      const shortage = Math.max(0, requirement.quantity - availableStock);

      if (shortage > 0 || availableStock <= product.reorderPoint) {
        const leadTimeDays = product.leadTimeDays || 7;
        const suggestedOrderDate = new Date(requirement.neededBy);
        suggestedOrderDate.setDate(suggestedOrderDate.getDate() - leadTimeDays);

        // Determina priorità
        let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        if (availableStock <= 0) {
          priority = 'CRITICAL';
        } else if (availableStock <= product.minStock) {
          priority = 'HIGH';
        } else if (availableStock <= product.reorderPoint) {
          priority = 'MEDIUM';
        } else {
          priority = 'LOW';
        }

        // Quantità da ordinare (almeno reorderQuantity o shortage)
        const orderQuantity = Math.max(shortage, product.reorderQuantity || shortage);

        requirements.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          requiredQuantity: requirement.quantity,
          availableQuantity: availableStock,
          reservedQuantity: reservedStock,
          shortageQuantity: shortage,
          reorderPoint: product.reorderPoint,
          reorderQuantity: orderQuantity,
          leadTimeDays,
          supplierId: product.supplierId || undefined,
          supplierName: product.supplier?.businessName,
          suggestedOrderDate: suggestedOrderDate > new Date() ? suggestedOrderDate : new Date(),
          priority,
          estimatedCost: orderQuantity * Number(product.cost),
        });
      }
    }

    // 4. Ordina per priorità
    requirements.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 5. Genera suggerimenti ordini acquisto raggruppati per fornitore
    const suggestedPurchaseOrders = this.generateSuggestedPurchaseOrders(requirements);

    // 6. Calcola summary
    const summary = {
      totalMaterials: requirements.length,
      criticalShortages: requirements.filter(r => r.priority === 'CRITICAL').length,
      highPriorityItems: requirements.filter(r => r.priority === 'HIGH').length,
      estimatedTotalCost: requirements.reduce((sum, r) => sum + r.estimatedCost, 0),
      suppliersInvolved: new Set(requirements.map(r => r.supplierId).filter(Boolean)).size,
    };

    return {
      calculationDate: new Date(),
      planningHorizonDays,
      requirements,
      summary,
      suggestedPurchaseOrders,
    };
  }

  /**
   * Calcola fabbisogno materiali per produzione specifica
   */
  async calculateRequirementsForProduction(
    productId: string,
    quantity: number,
    requiredDate: Date
  ): Promise<MaterialRequirement[]> {
    const requirements: MaterialRequirement[] = [];

    // Esplodi BOM
    const bomItems = await this.explodeBomRecursive(productId, quantity);

    for (const bomItem of bomItems) {
      const product = await prisma.product.findUnique({
        where: { id: bomItem.componentId },
        include: {
          supplier: true,
          inventory: true,
        },
      });

      if (!product) continue;

      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const reservedStock = product.inventory.reduce((sum, inv) => sum + inv.reservedQuantity, 0);
      const availableStock = totalStock - reservedStock;
      const shortage = Math.max(0, bomItem.totalQuantity - availableStock);

      const leadTimeDays = product.leadTimeDays || 7;
      const suggestedOrderDate = new Date(requiredDate);
      suggestedOrderDate.setDate(suggestedOrderDate.getDate() - leadTimeDays);

      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      if (shortage > 0 && availableStock <= 0) {
        priority = 'CRITICAL';
      } else if (shortage > 0) {
        priority = 'HIGH';
      } else if (availableStock <= product.reorderPoint) {
        priority = 'MEDIUM';
      } else {
        priority = 'LOW';
      }

      requirements.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        requiredQuantity: bomItem.totalQuantity,
        availableQuantity: availableStock,
        reservedQuantity: reservedStock,
        shortageQuantity: shortage,
        reorderPoint: product.reorderPoint,
        reorderQuantity: Math.max(shortage, product.reorderQuantity || 0),
        leadTimeDays,
        supplierId: product.supplierId || undefined,
        supplierName: product.supplier?.businessName,
        suggestedOrderDate,
        priority,
        estimatedCost: Math.max(shortage, product.reorderQuantity || 0) * Number(product.cost),
      });
    }

    return requirements.filter(r => r.shortageQuantity > 0 || r.availableQuantity <= r.reorderPoint);
  }

  /**
   * Analisi scorte e suggerimenti riordino automatico
   */
  async analyzeInventoryAndSuggestReorders(): Promise<MaterialRequirement[]> {
    const requirements: MaterialRequirement[] = [];

    // Trova tutti i materiali/prodotti con scorte basse
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        reorderPoint: { gt: 0 },
      },
      include: {
        supplier: true,
        inventory: true,
      },
    });

    for (const product of products) {
      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const reservedStock = product.inventory.reduce((sum, inv) => sum + inv.reservedQuantity, 0);
      const availableStock = totalStock - reservedStock;

      // Verifica se sotto punto di riordino
      if (availableStock <= product.reorderPoint) {
        let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        if (availableStock <= 0) {
          priority = 'CRITICAL';
        } else if (availableStock <= product.minStock) {
          priority = 'HIGH';
        } else {
          priority = 'MEDIUM';
        }

        const leadTimeDays = product.leadTimeDays || 7;
        const suggestedOrderDate = new Date();
        suggestedOrderDate.setDate(suggestedOrderDate.getDate() + 1); // Ordina domani

        const reorderQty = product.reorderQuantity || Math.max(product.minStock * 2, 10);

        requirements.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          requiredQuantity: reorderQty,
          availableQuantity: availableStock,
          reservedQuantity: reservedStock,
          shortageQuantity: Math.max(0, product.minStock - availableStock),
          reorderPoint: product.reorderPoint,
          reorderQuantity: reorderQty,
          leadTimeDays,
          supplierId: product.supplierId || undefined,
          supplierName: product.supplier?.businessName,
          suggestedOrderDate,
          priority,
          estimatedCost: reorderQty * Number(product.cost),
        });
      }
    }

    return requirements.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Previsione domanda basata su storico vendite
   */
  async forecastDemand(
    productId: string,
    forecastDays: number = 30
  ): Promise<DemandForecast> {
    // Calcola media vendite ultimi 90 giorni
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const salesData = await prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          status: { in: ['DELIVERED', 'SHIPPED'] },
          orderDate: { gte: ninetyDaysAgo },
        },
      },
      _sum: {
        quantity: true,
      },
      _count: true,
    });

    const totalSold = salesData._sum.quantity || 0;
    const orderCount = salesData._count;

    // Media giornaliera
    const dailyAverage = totalSold / 90;

    // Proiezione per periodo forecast
    const forecastQuantity = Math.ceil(dailyAverage * forecastDays);

    // Confidenza basata su numero ordini
    let confidence = 0.5;
    if (orderCount >= 20) confidence = 0.9;
    else if (orderCount >= 10) confidence = 0.7;
    else if (orderCount >= 5) confidence = 0.6;

    return {
      productId,
      forecastQuantity,
      confidence,
    };
  }

  /**
   * Genera ordine acquisto automatico da requirements
   */
  async createPurchaseOrderFromRequirements(
    supplierId: string,
    requirements: MaterialRequirement[]
  ): Promise<string> {
    const supplierReqs = requirements.filter(r => r.supplierId === supplierId);

    if (supplierReqs.length === 0) {
      throw new Error('Nessun requisito per questo fornitore');
    }

    // Genera numero ordine
    const year = new Date().getFullYear();
    const lastOrder = await prisma.purchaseOrder.findFirst({
      where: { orderNumber: { startsWith: `PO-${year}-` } },
      orderBy: { orderNumber: 'desc' },
    });

    let nextNum = 1;
    if (lastOrder) {
      const match = lastOrder.orderNumber.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    const orderNumber = `PO-${year}-${nextNum.toString().padStart(6, '0')}`;

    // Calcola data consegna prevista (max lead time)
    const maxLeadTime = Math.max(...supplierReqs.map(r => r.leadTimeDays));
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + maxLeadTime);

    // Crea ordine
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          status: 'DRAFT',
          subtotal: 0,
          tax: 0,
          total: 0,
          expectedDate,
          notes: 'Ordine generato automaticamente da MRP',
        },
      });

      let subtotal = 0;
      for (const req of supplierReqs) {
        const product = await tx.product.findUnique({
          where: { id: req.productId },
        });

        if (!product) continue;

        const unitPrice = Number(product.cost);
        const total = unitPrice * req.reorderQuantity;
        subtotal += total;

        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: order.id,
            productId: req.productId,
            quantity: req.reorderQuantity,
            unitPrice,
            tax: total * 0.22,
            total: total * 1.22,
          },
        });
      }

      const tax = subtotal * 0.22;
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          subtotal,
          tax,
          total: subtotal + tax,
        },
      });

      return order;
    });

    logger.info(`Ordine acquisto ${orderNumber} creato automaticamente da MRP`);
    return purchaseOrder.id;
  }

  /**
   * Notifica scorte critiche
   */
  async notifyCriticalShortages(): Promise<number> {
    const requirements = await this.analyzeInventoryAndSuggestReorders();
    const critical = requirements.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH');

    if (critical.length === 0) {
      return 0;
    }

    // Trova admin e magazzinieri
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER', 'MAGAZZINIERE'] },
        isActive: true,
      },
      select: { id: true },
    });

    for (const user of users) {
      await notificationService.createNotification({
        userId: user.id,
        type: 'LOW_STOCK',
        title: `${critical.length} materiali con scorte critiche`,
        message: `Rilevati ${critical.length} materiali che richiedono riordino urgente. Verifica MRP per dettagli.`,
        link: '/inventory?filter=low-stock',
      });
    }

    return critical.length;
  }

  // =============================================
  // UTILITY PRIVATE
  // =============================================

  /**
   * Esplode BOM ricorsivamente
   */
  private async explodeBomRecursive(
    productId: string,
    quantity: number,
    level: number = 0,
    visited: Set<string> = new Set()
  ): Promise<Array<{ componentId: string; totalQuantity: number; level: number }>> {
    if (visited.has(productId)) {
      logger.warn(`Ciclo rilevato in BOM per prodotto ${productId}`);
      return [];
    }
    visited.add(productId);

    const result: Array<{ componentId: string; totalQuantity: number; level: number }> = [];

    const bomItems = await prisma.bomItem.findMany({
      where: { parentProductId: productId },
      include: { componentProduct: true },
    });

    for (const item of bomItems) {
      const requiredQty = Number(item.quantity) * quantity * (1 + Number(item.scrapPercentage) / 100);

      // Aggiungi componente
      result.push({
        componentId: item.componentProductId,
        totalQuantity: requiredQty,
        level: level + 1,
      });

      // Ricorsione per sub-componenti
      const subComponents = await this.explodeBomRecursive(
        item.componentProductId,
        requiredQty,
        level + 1,
        new Set(visited)
      );

      result.push(...subComponents);
    }

    return result;
  }

  /**
   * Genera suggerimenti ordini acquisto raggruppati per fornitore
   */
  private generateSuggestedPurchaseOrders(requirements: MaterialRequirement[]): SuggestedPurchaseOrder[] {
    const ordersBySupplier: Record<string, SuggestedPurchaseOrder> = {};

    for (const req of requirements) {
      if (!req.supplierId || req.reorderQuantity <= 0) continue;

      if (!ordersBySupplier[req.supplierId]) {
        const expectedDate = new Date(req.suggestedOrderDate || new Date());
        expectedDate.setDate(expectedDate.getDate() + req.leadTimeDays);

        ordersBySupplier[req.supplierId] = {
          supplierId: req.supplierId,
          supplierName: req.supplierName || 'N/A',
          items: [],
          totalCost: 0,
          suggestedOrderDate: req.suggestedOrderDate || new Date(),
          expectedDeliveryDate: expectedDate,
        };
      }

      ordersBySupplier[req.supplierId].items.push({
        productId: req.productId,
        sku: req.sku,
        name: req.name,
        quantity: req.reorderQuantity,
        unitCost: req.estimatedCost / req.reorderQuantity,
        totalCost: req.estimatedCost,
      });

      ordersBySupplier[req.supplierId].totalCost += req.estimatedCost;
    }

    return Object.values(ordersBySupplier).sort((a, b) => b.totalCost - a.totalCost);
  }
}

export const mrpService = new MRPService();
export default mrpService;
