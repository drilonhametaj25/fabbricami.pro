/**
 * Physical Inventory Service
 * Gestione inventario fisico: sessioni di conteggio, riconciliazione, reportistica varianze
 */

import { prisma } from '../config/database';
import { PhysicalCountStatus, PhysicalCountItemStatus, Prisma } from '@prisma/client';

// Types
interface CreateSessionInput {
  warehouseId: string;
  name: string;
  description?: string;
  countType?: 'FULL' | 'CYCLE' | 'SPOT';
  plannedDate?: Date;
  requireDoubleCount?: boolean;
  freezeInventory?: boolean;
  allowBlindCount?: boolean;
  filters?: {
    categories?: string[];
    locations?: string[];
    skuPrefix?: string;
    materialOnly?: boolean;
    productOnly?: boolean;
  };
  createdById: string;
}

interface CountItemInput {
  sessionId: string;
  itemId: string;
  countedQuantity: number;
  countedById: string;
  notes?: string;
}

interface VerifyItemInput {
  sessionId: string;
  itemId: string;
  verifiedQuantity: number;
  verifiedBy: string;
  notes?: string;
}

interface ReconcileItemInput {
  sessionId: string;
  itemId: string;
  finalQuantity: number;
  reconcileReason?: string;
}

interface SessionFilter {
  warehouseId?: string;
  status?: PhysicalCountStatus | PhysicalCountStatus[];
  countType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface VarianceReport {
  totalItems: number;
  countedItems: number;
  itemsWithVariance: number;
  positiveVariance: { count: number; units: number; value: number };
  negativeVariance: { count: number; units: number; value: number };
  netVariance: { units: number; value: number };
  byCategory: Record<string, { variance: number; value: number }>;
  topVariances: Array<{
    sku: string;
    description: string;
    expectedQuantity: number;
    finalQuantity: number;
    variance: number;
    varianceValue: number;
  }>;
}

class PhysicalInventoryService {
  /**
   * Genera codice univoco per sessione
   */
  private async generateSessionCode(warehouseCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${warehouseCode}-${year}`;

    const lastSession = await prisma.physicalCountSession.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' }
    });

    if (!lastSession) {
      return `${prefix}-001`;
    }

    const lastNumber = parseInt(lastSession.code.split('-').pop() || '0', 10);
    return `${prefix}-${String(lastNumber + 1).padStart(3, '0')}`;
  }

  /**
   * Crea una nuova sessione di inventario fisico
   */
  async createSession(input: CreateSessionInput): Promise<any> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: input.warehouseId }
    });

    if (!warehouse) {
      throw new Error('Warehouse non trovato');
    }

    const code = await this.generateSessionCode(warehouse.code);

    const session = await prisma.physicalCountSession.create({
      data: {
        code,
        warehouseId: input.warehouseId,
        name: input.name,
        description: input.description,
        countType: input.countType || 'FULL',
        plannedDate: input.plannedDate,
        requireDoubleCount: input.requireDoubleCount ?? false,
        freezeInventory: input.freezeInventory ?? false,
        allowBlindCount: input.allowBlindCount ?? true,
        filters: input.filters as Prisma.InputJsonValue,
        createdById: input.createdById,
        status: 'DRAFT'
      },
      include: {
        warehouse: true
      }
    });

    return session;
  }

  /**
   * Avvia una sessione di conteggio
   * Congela lo snapshot delle giacenze e crea gli items da contare
   */
  async startSession(sessionId: string, startedById: string): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId },
      include: { warehouse: true }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (session.status !== 'DRAFT') {
      throw new Error('La sessione non è in stato DRAFT');
    }

    const filters = session.filters as any || {};

    // Recupera tutti i prodotti da contare in base ai filtri
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true
    };

    if (filters.categories?.length) {
      productWhere.category = { in: filters.categories };
    }

    if (filters.skuPrefix) {
      productWhere.sku = { startsWith: filters.skuPrefix };
    }

    // Recupera inventario prodotti
    const inventoryItems = filters.materialOnly ? [] : await prisma.inventoryItem.findMany({
      where: {
        warehouseId: session.warehouseId,
        product: productWhere
      },
      include: {
        product: true,
        variant: true
      }
    });

    // Recupera anche materiali se non solo prodotti
    const materialWhere: Prisma.MaterialWhereInput = {
      isActive: true
    };

    if (filters.categories?.length) {
      materialWhere.category = { in: filters.categories };
    }

    if (filters.skuPrefix) {
      materialWhere.sku = { startsWith: filters.skuPrefix };
    }

    const materialInventory = filters.productOnly ? [] : await prisma.materialInventory.findMany({
      where: {
        warehouseId: session.warehouseId,
        material: materialWhere
      },
      include: {
        material: true
      }
    });

    // Crea gli items da contare
    const countItems: Prisma.PhysicalCountItemCreateManyInput[] = [];

    // Items prodotto
    for (const item of inventoryItems) {
      countItems.push({
        sessionId,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.variant?.sku || item.product.sku,
        description: item.variant?.name || item.product.name,
        unit: item.product.unit,
        location: item.location,
        expectedQuantity: item.quantity,
        unitCost: item.product.cost,
        status: 'NOT_COUNTED'
      });
    }

    // Items materiale
    for (const item of materialInventory) {
      countItems.push({
        sessionId,
        materialId: item.materialId,
        sku: item.material.sku,
        description: item.material.name,
        unit: item.material.unit,
        location: item.location,
        expectedQuantity: item.quantity,
        unitCost: item.material.cost,
        status: 'NOT_COUNTED'
      });
    }

    // Inserisci items e aggiorna sessione
    await prisma.$transaction([
      prisma.physicalCountItem.createMany({ data: countItems }),
      prisma.physicalCountSession.update({
        where: { id: sessionId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          startedById,
          totalItems: countItems.length
        }
      })
    ]);

    return this.getSession(sessionId);
  }

  /**
   * Ottiene dettagli sessione
   */
  async getSession(sessionId: string): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId },
      include: {
        warehouse: true,
        items: {
          orderBy: [
            { location: 'asc' },
            { sku: 'asc' }
          ]
        }
      }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    // Calcola statistiche
    const stats = {
      totalItems: session.items.length,
      countedItems: session.items.filter(i => i.status !== 'NOT_COUNTED').length,
      verifiedItems: session.items.filter(i => i.status === 'VERIFIED' || i.status === 'RECONCILED').length,
      discrepancyItems: session.items.filter(i => i.variance !== 0 && i.variance !== null).length,
      progress: session.items.length > 0
        ? Math.round((session.items.filter(i => i.status !== 'NOT_COUNTED').length / session.items.length) * 100)
        : 0
    };

    return { ...session, stats };
  }

  /**
   * Lista sessioni con filtri
   */
  async listSessions(filters: SessionFilter, pagination: PaginationParams = {}): Promise<any> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.PhysicalCountSessionWhereInput = {};

    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.countType) {
      where.countType = filters.countType;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.plannedDate = {};
      if (filters.dateFrom) where.plannedDate.gte = filters.dateFrom;
      if (filters.dateTo) where.plannedDate.lte = filters.dateTo;
    }

    const [sessions, total] = await Promise.all([
      prisma.physicalCountSession.findMany({
        where,
        include: {
          warehouse: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.physicalCountSession.count({ where })
    ]);

    return {
      items: sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Registra conteggio per un item
   */
  async countItem(input: CountItemInput): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: input.sessionId }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error('La sessione non è in corso');
    }

    const item = await prisma.physicalCountItem.findUnique({
      where: { id: input.itemId }
    });

    if (!item || item.sessionId !== input.sessionId) {
      throw new Error('Item non trovato nella sessione');
    }

    // Calcola varianza se non richiede double count
    const variance = input.countedQuantity - item.expectedQuantity;
    const varianceValue = Number(item.unitCost || 0) * Math.abs(variance);

    // Determina nuovo stato
    let newStatus: PhysicalCountItemStatus = 'COUNTED';
    if (session.requireDoubleCount) {
      newStatus = 'COUNTED'; // Richiede verifica
    } else if (variance !== 0) {
      newStatus = 'DISCREPANCY';
    } else {
      newStatus = 'RECONCILED'; // Nessuna varianza, automaticamente riconciliato
    }

    const updatedItem = await prisma.physicalCountItem.update({
      where: { id: input.itemId },
      data: {
        countedQuantity: input.countedQuantity,
        countedAt: new Date(),
        countedById: input.countedById,
        notes: input.notes,
        status: newStatus,
        // Se non richiede double count, imposta anche finale
        ...(!session.requireDoubleCount && {
          finalQuantity: input.countedQuantity,
          variance,
          varianceValue
        })
      }
    });

    // Aggiorna contatore sessione
    await this.updateSessionStats(input.sessionId);

    return updatedItem;
  }

  /**
   * Verifica conteggio (secondo conteggio)
   */
  async verifyItem(input: VerifyItemInput): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: input.sessionId }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (!session.requireDoubleCount) {
      throw new Error('La sessione non richiede doppio conteggio');
    }

    const item = await prisma.physicalCountItem.findUnique({
      where: { id: input.itemId }
    });

    if (!item || item.sessionId !== input.sessionId) {
      throw new Error('Item non trovato nella sessione');
    }

    if (item.status !== 'COUNTED') {
      throw new Error('Item non ancora conteggiato o già verificato');
    }

    // Se le due conte coincidono, usa quel valore. Altrimenti marca come discrepanza
    const countsMatch = input.verifiedQuantity === item.countedQuantity;
    const finalQty = countsMatch ? input.verifiedQuantity : null;
    const variance = finalQty !== null ? finalQty - item.expectedQuantity : null;
    const varianceValue = variance !== null ? Number(item.unitCost || 0) * Math.abs(variance) : null;

    const newStatus: PhysicalCountItemStatus = countsMatch
      ? (variance !== 0 ? 'DISCREPANCY' : 'VERIFIED')
      : 'DISCREPANCY'; // Le due conte non coincidono

    const updatedItem = await prisma.physicalCountItem.update({
      where: { id: input.itemId },
      data: {
        verifiedQuantity: input.verifiedQuantity,
        verifiedAt: new Date(),
        verifiedBy: input.verifiedBy,
        notes: input.notes ? `${item.notes || ''}\nVerifica: ${input.notes}` : item.notes,
        status: newStatus,
        finalQuantity: finalQty,
        variance,
        varianceValue
      }
    });

    await this.updateSessionStats(input.sessionId);

    return updatedItem;
  }

  /**
   * Riconcilia manualmente un item (per discrepanze)
   */
  async reconcileItem(input: ReconcileItemInput): Promise<any> {
    const item = await prisma.physicalCountItem.findUnique({
      where: { id: input.itemId }
    });

    if (!item || item.sessionId !== input.sessionId) {
      throw new Error('Item non trovato nella sessione');
    }

    const variance = input.finalQuantity - item.expectedQuantity;
    const varianceValue = Number(item.unitCost || 0) * Math.abs(variance);

    const updatedItem = await prisma.physicalCountItem.update({
      where: { id: input.itemId },
      data: {
        finalQuantity: input.finalQuantity,
        variance,
        varianceValue,
        status: 'RECONCILED',
        notes: input.reconcileReason
          ? `${item.notes || ''}\nRiconciliazione: ${input.reconcileReason}`
          : item.notes
      }
    });

    await this.updateSessionStats(input.sessionId);

    return updatedItem;
  }

  /**
   * Aggiorna statistiche sessione
   */
  private async updateSessionStats(sessionId: string): Promise<void> {
    const items = await prisma.physicalCountItem.findMany({
      where: { sessionId }
    });

    const countedItems = items.filter(i => i.status !== 'NOT_COUNTED').length;
    const discrepancyCount = items.filter(i => i.variance !== null && i.variance !== 0).length;
    const totalVariance = items.reduce((sum, i) => sum + Number(i.varianceValue || 0), 0);

    await prisma.physicalCountSession.update({
      where: { id: sessionId },
      data: {
        countedItems,
        discrepancyCount,
        totalVarianceValue: totalVariance
      }
    });
  }

  /**
   * Ottiene items da contare per una sessione
   */
  async getItemsToCount(sessionId: string, pagination: PaginationParams = {}): Promise<any> {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    const [items, total] = await Promise.all([
      prisma.physicalCountItem.findMany({
        where: {
          sessionId,
          status: 'NOT_COUNTED'
        },
        orderBy: [
          { location: 'asc' },
          { sku: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.physicalCountItem.count({
        where: {
          sessionId,
          status: 'NOT_COUNTED'
        }
      })
    ]);

    // Se blind count, non mostrare quantità attesa
    const itemsToReturn = session.allowBlindCount
      ? items.map(i => ({ ...i, expectedQuantity: undefined }))
      : items;

    return {
      items: itemsToReturn,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Ottiene items con discrepanze
   */
  async getDiscrepancyItems(sessionId: string): Promise<any[]> {
    return prisma.physicalCountItem.findMany({
      where: {
        sessionId,
        status: 'DISCREPANCY'
      },
      orderBy: [
        { varianceValue: 'desc' }
      ]
    });
  }

  /**
   * Completa una sessione e applica le rettifiche
   */
  async completeSession(sessionId: string, completedById: string, applyAdjustments: boolean = true): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId },
      include: { items: true }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (session.status !== 'IN_PROGRESS' && session.status !== 'PENDING_REVIEW') {
      throw new Error('La sessione non può essere completata in questo stato');
    }

    // Verifica che tutti gli items siano conteggiati/riconciliati
    const unreconciledItems = session.items.filter(i =>
      i.status === 'NOT_COUNTED' ||
      (i.status === 'COUNTED' && session.requireDoubleCount) ||
      i.status === 'DISCREPANCY'
    );

    if (unreconciledItems.length > 0) {
      throw new Error(`Ci sono ancora ${unreconciledItems.length} items non riconciliati`);
    }

    // Applica rettifiche all'inventario
    if (applyAdjustments) {
      await this.applyInventoryAdjustments(session);
    }

    // Completa sessione
    const completedSession = await prisma.physicalCountSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById
      },
      include: {
        warehouse: true
      }
    });

    return completedSession;
  }

  /**
   * Applica le rettifiche di inventario basate sul conteggio fisico
   */
  private async applyInventoryAdjustments(session: any): Promise<void> {
    const itemsWithVariance = session.items.filter((i: any) => i.variance !== 0 && i.finalQuantity !== null);

    for (const item of itemsWithVariance) {
      if (item.productId) {
        // Rettifica prodotto
        await prisma.inventoryItem.updateMany({
          where: {
            warehouseId: session.warehouseId,
            productId: item.productId,
            variantId: item.variantId,
            location: item.location
          },
          data: {
            quantity: item.finalQuantity
          }
        });

        // Crea movimento di rettifica
        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            type: 'ADJUSTMENT',
            quantity: item.variance > 0 ? item.variance : -item.variance, // positive for IN, store actual signed quantity
            reference: `Physical Count: ${session.code}`,
            notes: `Rettifica inventario fisico (${item.variance > 0 ? 'eccedenza' : 'ammanco'}) - Sessione ${session.code}`,
            performedBy: session.completedById || session.createdById
          }
        });
      } else if (item.materialId) {
        // Rettifica materiale
        await prisma.materialInventory.updateMany({
          where: {
            warehouseId: session.warehouseId,
            materialId: item.materialId,
            location: item.location
          },
          data: {
            quantity: item.finalQuantity
          }
        });

        // Aggiorna anche currentStock sul materiale
        const totalStock = await prisma.materialInventory.aggregate({
          where: { materialId: item.materialId },
          _sum: { quantity: true }
        });

        await prisma.material.update({
          where: { id: item.materialId },
          data: { currentStock: totalStock._sum.quantity || 0 }
        });

        // Crea movimento materiale
        await prisma.materialMovement.create({
          data: {
            materialId: item.materialId,
            type: 'ADJUSTMENT',
            quantity: item.variance > 0 ? item.variance : -item.variance,
            reference: `Physical Count: ${session.code}`,
            notes: `Rettifica inventario fisico (${item.variance > 0 ? 'eccedenza' : 'ammanco'}) - Sessione ${session.code}`,
            performedBy: session.completedById || session.createdById
          }
        });
      }
    }
  }

  /**
   * Genera report varianze
   */
  async generateVarianceReport(sessionId: string): Promise<VarianceReport> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          include: {
            product: true,
            material: true
          }
        }
      }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    const items = session.items;
    const countedItems = items.filter(i => i.finalQuantity !== null);
    const itemsWithVariance = countedItems.filter(i => i.variance !== 0);

    // Calcola varianze positive e negative
    const positive = itemsWithVariance.filter(i => (i.variance || 0) > 0);
    const negative = itemsWithVariance.filter(i => (i.variance || 0) < 0);

    // Raggruppa per categoria
    const byCategory: Record<string, { variance: number; value: number }> = {};
    for (const item of itemsWithVariance) {
      const category = item.product?.category || item.material?.category || 'Senza categoria';
      if (!byCategory[category]) {
        byCategory[category] = { variance: 0, value: 0 };
      }
      byCategory[category].variance += item.variance || 0;
      byCategory[category].value += Number(item.varianceValue || 0);
    }

    // Top varianze per valore
    const topVariances = itemsWithVariance
      .sort((a, b) => Number(b.varianceValue || 0) - Number(a.varianceValue || 0))
      .slice(0, 10)
      .map(i => ({
        sku: i.sku,
        description: i.description,
        expectedQuantity: i.expectedQuantity,
        finalQuantity: i.finalQuantity || 0,
        variance: i.variance || 0,
        varianceValue: Number(i.varianceValue || 0)
      }));

    return {
      totalItems: items.length,
      countedItems: countedItems.length,
      itemsWithVariance: itemsWithVariance.length,
      positiveVariance: {
        count: positive.length,
        units: positive.reduce((sum, i) => sum + (i.variance || 0), 0),
        value: positive.reduce((sum, i) => sum + Number(i.varianceValue || 0), 0)
      },
      negativeVariance: {
        count: negative.length,
        units: Math.abs(negative.reduce((sum, i) => sum + (i.variance || 0), 0)),
        value: negative.reduce((sum, i) => sum + Number(i.varianceValue || 0), 0)
      },
      netVariance: {
        units: itemsWithVariance.reduce((sum, i) => sum + (i.variance || 0), 0),
        value: itemsWithVariance.reduce((sum, i) => sum + Number(i.varianceValue || 0) * Math.sign(i.variance || 0), 0)
      },
      byCategory,
      topVariances
    };
  }

  /**
   * Annulla una sessione
   */
  async cancelSession(sessionId: string, reason?: string): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (session.status === 'COMPLETED') {
      throw new Error('Non è possibile annullare una sessione completata');
    }

    return prisma.physicalCountSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${session.notes || ''}\nMotivo annullamento: ${reason}` : session.notes
      }
    });
  }

  /**
   * Imposta sessione in revisione (prima di completare)
   */
  async submitForReview(sessionId: string): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId },
      include: { items: true }
    });

    if (!session) {
      throw new Error('Sessione non trovata');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error('La sessione non è in corso');
    }

    // Verifica che tutti gli items siano stati conteggiati
    const notCountedItems = session.items.filter(i => i.status === 'NOT_COUNTED');
    if (notCountedItems.length > 0) {
      throw new Error(`Ci sono ancora ${notCountedItems.length} items non conteggiati`);
    }

    return prisma.physicalCountSession.update({
      where: { id: sessionId },
      data: { status: 'PENDING_REVIEW' }
    });
  }

  /**
   * Conteggio rapido batch (per scanner barcode)
   */
  async batchCount(sessionId: string, counts: Array<{ sku: string; quantity: number }>, countedById: string): Promise<any> {
    const session = await prisma.physicalCountSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.status !== 'IN_PROGRESS') {
      throw new Error('Sessione non valida o non in corso');
    }

    const results = {
      success: 0,
      errors: [] as Array<{ sku: string; error: string }>
    };

    for (const count of counts) {
      try {
        const item = await prisma.physicalCountItem.findFirst({
          where: {
            sessionId,
            sku: count.sku
          }
        });

        if (!item) {
          results.errors.push({ sku: count.sku, error: 'SKU non trovato nella sessione' });
          continue;
        }

        await this.countItem({
          sessionId,
          itemId: item.id,
          countedQuantity: count.quantity,
          countedById
        });

        results.success++;
      } catch (error) {
        results.errors.push({ sku: count.sku, error: (error as Error).message });
      }
    }

    return results;
  }
}

export const physicalInventoryService = new PhysicalInventoryService();
