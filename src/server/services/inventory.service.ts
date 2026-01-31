import { prisma } from '../config/database';
import {
  CreateInventoryMovementInput,
  InventoryQuery,
  MovementQuery,
} from '../schemas/inventory.schema';
import bomService from './bom.service';
import alertService from './alert.service';
import logger from '../config/logger';

/**
 * Risultato della scalatura ricorsiva
 */
export interface InventoryDeductionResult {
  success: boolean;
  deductions: Array<{
    productId: string;
    sku: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    location: string;
  }>;
  errors: Array<{
    productId: string;
    sku?: string;
    required: number;
    available: number;
    message: string;
  }>;
  totalMovements: number;
}

/**
 * Inventory Service
 * Business logic per gestione magazzino multi-location
 * 
 * TODO: Full implementation of inventory management
 * - Stock movements (IN/OUT/TRANSFER)
 * - Real-time stock updates
 * - Inventory reservation for orders
 * - Stock alerts and notifications
 * - Multi-location management
 */
class InventoryService {
  /**
   * Lista inventari con filtri e paginazione
   */
  async listInventory(params: InventoryQuery) {
    const {
      page = 1,
      limit = 20,
      productId,
      locationId,
      lowStock,
      outOfStock,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {};
    
    if (productId) where.productId = productId;
    if (locationId) where.location = locationId;
    if (lowStock) {
      // TODO: Implement lowStock filter based on minimum quantity
    }
    if (outOfStock) where.quantity = 0;
    if (search) {
      where.product = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          variant: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio inventario per prodotto e location
   */
  async getInventoryItem(productId: string, location: string, variantId?: string) {
    return await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
        ...(variantId && { variantId }),
      },
      include: {
        product: true,
        variant: true,
      },
    });
  }

  /**
   * Movimentazione magazzino (IN/OUT/TRANSFER/ADJUSTMENT/RETURN)
   */
  async createMovement(data: CreateInventoryMovementInput) {
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reference: data.referenceId || null,
        notes: data.notes || null,
        performedBy: data.userId,
        lotNumber: data.lotNumber || null,
        // fromLocation/toLocation based on type
        ...(data.type === 'OUT' && { fromLocation: data.locationId as any }),
        ...(data.type === 'IN' && { toLocation: data.locationId as any }),
      },
      include: {
        product: true,
      },
    });

    // Update InventoryItem quantities based on movement
    if (data.type === 'IN') {
      await this.updateStockQuantity(
        data.productId,
        data.locationId,
        data.quantity,
        'add'
      );
    } else if (data.type === 'OUT') {
      await this.updateStockQuantity(
        data.productId,
        data.locationId,
        data.quantity,
        'subtract'
      );
    }

    return movement;
  }

  /**
   * Aggiorna quantità inventario
   */
  private async updateStockQuantity(
    productId: string,
    location: string,
    quantity: number,
    operation: 'add' | 'subtract'
  ) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
      },
    });

    const delta = operation === 'add' ? quantity : -quantity;

    if (inventoryItem) {
      // Aggiorna esistente
      return await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantity: inventoryItem.quantity + delta,
          updatedAt: new Date(),
        },
      });
    } else if (operation === 'add') {
      // Cerca magazzino primario
      const primaryWarehouse = await prisma.warehouse.findFirst({
        where: { isPrimary: true },
      });
      if (!primaryWarehouse) {
        throw new Error('Nessun magazzino primario configurato');
      }

      // Crea nuovo inventario item solo se è un carico
      return await prisma.inventoryItem.create({
        data: {
          productId,
          warehouseId: primaryWarehouse.id,
          location: location as any,
          quantity,
          reservedQuantity: 0,
        },
      });
    }

    return null;
  }

  /**
   * Lista movimenti con filtri
   */
  async listMovements(params: MovementQuery) {
    const {
      page = 1,
      limit = 50,
      productId,
      locationId,
      type,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {};
    
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (dateFrom) where.createdAt = { gte: new Date(dateFrom) };
    if (dateTo) where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    
    // Location filter needs OR condition for from/to
    if (locationId) {
      where.OR = [
        { fromLocation: locationId },
        { toLocation: locationId },
      ];
    }

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Trasferimento tra location
   */
  async transferStock(
    productId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    userId: string,
    notes?: string
  ) {
    // Prima riduci stock dalla location di partenza
    await this.updateStockQuantity(productId, fromLocationId, quantity, 'subtract');
    
    // Poi aumenta stock nella location di destinazione
    await this.updateStockQuantity(productId, toLocationId, quantity, 'add');

    // Crea movimento di trasferimento
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        fromLocation: fromLocationId as any,
        toLocation: toLocationId as any,
        type: 'TRANSFER',
        quantity,
        reference: `TRANSFER_${Date.now()}`,
        notes: notes || `Transfer from ${fromLocationId} to ${toLocationId}`,
        performedBy: userId,
      },
      include: {
        product: true,
      },
    });

    return movement;
  }

  /**
   * Riserva giacenza per ordine
   */
  async reserveStock(
    productId: string,
    location: string,
    quantity: number,
    orderId: string
  ) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
      },
    });

    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const availableStock = inventoryItem.quantity - inventoryItem.reservedQuantity;
    
    if (availableStock < quantity) {
      throw new Error('Insufficient stock available for reservation');
    }

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        reservedQuantity: inventoryItem.reservedQuantity + quantity,
      },
    });
    
    return {
      reserved: true,
      productId,
      location,
      quantity,
      orderId,
    };
  }

  /**
   * Rilascia riserva giacenza
   */
  async releaseReservation(
    productId: string,
    location: string,
    quantity: number,
    orderId: string
  ) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
      },
    });

    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        reservedQuantity: Math.max(0, inventoryItem.reservedQuantity - quantity),
      },
    });
    
    return {
      released: true,
      productId,
      location,
      quantity,
      orderId,
    };
  }

  /**
   * Verifica disponibilità giacenza
   */
  async checkAvailability(productId: string, location: string, quantity: number) {
    const item = await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
      },
    });

    if (!item) {
      return {
        available: false,
        currentStock: 0,
        availableStock: 0,
        requested: quantity,
      };
    }

    const availableStock = item.quantity - item.reservedQuantity;

    return {
      available: availableStock >= quantity,
      currentStock: item.quantity,
      availableStock,
      reservedStock: item.reservedQuantity,
      requested: quantity,
    };
  }

  /**
   * Scala inventario ricorsivamente per tutti i componenti BOM
   * Chiamato quando un ordine viene spedito
   *
   * @param productId - ID del prodotto da scalare
   * @param quantity - Quantita' da scalare
   * @param location - Location di riferimento
   * @param orderId - ID ordine per riferimento
   * @param userId - ID utente che esegue l'operazione
   */
  async deductInventoryRecursive(
    productId: string,
    quantity: number,
    location: string,
    orderId: string,
    userId: string
  ): Promise<InventoryDeductionResult> {
    const result: InventoryDeductionResult = {
      success: true,
      deductions: [],
      errors: [],
      totalMovements: 0,
    };

    try {
      // 1. Ottieni il prodotto principale
      const mainProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sku: true, name: true },
      });

      if (!mainProduct) {
        result.success = false;
        result.errors.push({
          productId,
          required: quantity,
          available: 0,
          message: `Prodotto ${productId} non trovato`,
        });
        return result;
      }

      // 2. Esplodi BOM per ottenere tutti i componenti foglia
      const leafComponents = await bomService.getLeafComponents(productId, quantity);

      // 3. Prepara lista item da scalare (prodotto + componenti foglia)
      interface ItemToDeduct {
        productId: string;
        sku: string;
        name: string;
        quantity: number;
        isParent: boolean;
      }

      const itemsToDeduct: ItemToDeduct[] = [];

      // Aggiungi prodotto principale
      itemsToDeduct.push({
        productId: mainProduct.id,
        sku: mainProduct.sku,
        name: mainProduct.name,
        quantity,
        isParent: true,
      });

      // Aggrega quantita' per prodotto (stesso prodotto potrebbe apparire piu' volte)
      const aggregatedComponents = new Map<string, ItemToDeduct>();

      for (const comp of leafComponents) {
        const existing = aggregatedComponents.get(comp.productId);
        if (existing) {
          existing.quantity += comp.quantity;
        } else {
          aggregatedComponents.set(comp.productId, {
            productId: comp.productId,
            sku: comp.sku,
            name: comp.name,
            quantity: comp.quantity,
            isParent: false,
          });
        }
      }

      itemsToDeduct.push(...aggregatedComponents.values());

      // 4. Esegui scalatura in transazione atomica
      await prisma.$transaction(async (tx) => {
        // Fase 1: Verifica disponibilita' per tutti gli item
        for (const item of itemsToDeduct) {
          const inventory = await tx.inventoryItem.findFirst({
            where: {
              productId: item.productId,
              location: location as any,
            },
          });

          const currentStock = inventory?.quantity || 0;
          const reservedStock = inventory?.reservedQuantity || 0;
          const availableStock = currentStock - reservedStock;

          if (availableStock < item.quantity) {
            result.errors.push({
              productId: item.productId,
              sku: item.sku,
              required: item.quantity,
              available: availableStock,
              message: `Stock insufficiente per ${item.name} (${item.sku}): richiesti ${item.quantity}, disponibili ${availableStock}`,
            });
          }
        }

        // Se ci sono errori, interrompi la transazione
        if (result.errors.length > 0) {
          result.success = false;
          throw new Error('Stock insufficiente per uno o piu componenti');
        }

        // Fase 2: Scala effettivamente le giacenze
        for (const item of itemsToDeduct) {
          const inventory = await tx.inventoryItem.findFirst({
            where: {
              productId: item.productId,
              location: location as any,
            },
          });

          if (inventory) {
            const previousStock = inventory.quantity;
            const newStock = previousStock - item.quantity;
            const newReserved = Math.max(0, inventory.reservedQuantity - item.quantity);

            // Aggiorna giacenza
            await tx.inventoryItem.update({
              where: { id: inventory.id },
              data: {
                quantity: newStock,
                reservedQuantity: newReserved,
                updatedAt: new Date(),
              },
            });

            // Registra movimento OUT
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'OUT',
                quantity: item.quantity,
                fromLocation: location as any,
                reference: `ORDER-${orderId}`,
                notes: item.isParent
                  ? 'Spedizione ordine'
                  : `Componente BOM scalato per ordine ${orderId}`,
                performedBy: userId,
              },
            });

            result.deductions.push({
              productId: item.productId,
              sku: item.sku,
              quantity: item.quantity,
              previousStock,
              newStock,
              location,
            });

            result.totalMovements++;
          }
        }
      });

      // 5. Check alert per prodotti scalati (asincrono, non blocca)
      this.triggerStockAlerts(result.deductions.map((d) => d.productId)).catch((err) => {
        logger.error(`Error triggering stock alerts: ${err.message}`);
      });

      logger.info(
        `Deducted inventory for order ${orderId}: ${result.totalMovements} movements, ${result.deductions.length} products`
      );
    } catch (error: any) {
      if (result.errors.length === 0) {
        result.success = false;
        result.errors.push({
          productId,
          required: quantity,
          available: 0,
          message: error.message || 'Errore durante la scalatura inventario',
        });
      }
      logger.error(`Error deducting inventory for order ${orderId}: ${error.message}`);
    }

    return result;
  }

  /**
   * Trigger check alert per prodotti specifici
   */
  private async triggerStockAlerts(productIds: string[]): Promise<void> {
    for (const productId of productIds) {
      const alert = await alertService.checkProductStock(productId);
      if (alert) {
        await alertService.sendAlertNotifications([alert]);
      }
    }
  }

  /**
   * Ottieni giacenza totale aggregata per prodotto (tutte le location)
   */
  async getTotalStock(productId: string): Promise<{
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
    byLocation: Array<{
      location: string;
      quantity: number;
      reserved: number;
      available: number;
    }>;
  }> {
    const items = await prisma.inventoryItem.findMany({
      where: { productId },
    });

    const byLocation = items.map((item) => ({
      location: item.location,
      quantity: item.quantity,
      reserved: item.reservedQuantity,
      available: item.quantity - item.reservedQuantity,
    }));

    return {
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalReserved: items.reduce((sum, item) => sum + item.reservedQuantity, 0),
      totalAvailable: items.reduce(
        (sum, item) => sum + (item.quantity - item.reservedQuantity),
        0
      ),
      byLocation,
    };
  }

  /**
   * Ottieni prodotti con giacenza bassa
   */
  async getLowStockProducts(threshold?: number): Promise<
    Array<{
      productId: string;
      sku: string;
      name: string;
      totalStock: number;
      minStockLevel: number;
      reorderPoint: number;
    }>
  > {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventory: true,
      },
    });

    return products
      .map((product) => {
        const totalStock = product.inventory.reduce(
          (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
          0
        );

        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          totalStock,
          minStockLevel: product.minStockLevel,
          reorderPoint: product.reorderPoint,
        };
      })
      .filter((p) => {
        const effectiveThreshold = threshold ?? p.minStockLevel;
        return p.totalStock <= effectiveThreshold;
      })
      .sort((a, b) => a.totalStock - b.totalStock);
  }

  /**
   * Calcola previsione stock per un prodotto
   * Basato sulla media dei movimenti OUT degli ultimi N giorni
   */
  async getStockPrediction(productId: string, daysToAnalyze: number = 90): Promise<{
    avgDailySales: number;
    avgWeeklySales: number;
    avgMonthlySales: number;
    daysUntilOutOfStock: number | null;
    estimatedOutOfStockDate: Date | null;
    suggestedReorderDate: Date | null;
    status: 'CRITICAL' | 'LOW' | 'OK' | 'OVERSTOCKED';
    statusMessage: string;
  }> {
    // 1. Ottieni giacenza attuale
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { productId },
    });
    const totalAvailable = inventoryItems.reduce(
      (sum, item) => sum + (item.quantity - item.reservedQuantity),
      0
    );

    // 2. Ottieni movimenti OUT degli ultimi N giorni
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    const outMovements = await prisma.inventoryMovement.findMany({
      where: {
        productId,
        type: 'OUT',
        createdAt: { gte: startDate },
      },
    });

    // 3. Calcola media giornaliera
    const totalOut = outMovements.reduce((sum, m) => sum + m.quantity, 0);
    const avgDailySales = totalOut / daysToAnalyze;
    const avgWeeklySales = avgDailySales * 7;
    const avgMonthlySales = avgDailySales * 30;

    // 4. Calcola giorni fino a esaurimento
    let daysUntilOutOfStock: number | null = null;
    let estimatedOutOfStockDate: Date | null = null;
    let suggestedReorderDate: Date | null = null;

    if (avgDailySales > 0 && totalAvailable > 0) {
      daysUntilOutOfStock = Math.floor(totalAvailable / avgDailySales);

      estimatedOutOfStockDate = new Date();
      estimatedOutOfStockDate.setDate(estimatedOutOfStockDate.getDate() + daysUntilOutOfStock);

      // Suggerisci riordino 30 giorni prima (o subito se meno)
      const reorderLeadDays = 30;
      const daysBeforeReorder = Math.max(0, daysUntilOutOfStock - reorderLeadDays);
      suggestedReorderDate = new Date();
      suggestedReorderDate.setDate(suggestedReorderDate.getDate() + daysBeforeReorder);
    }

    // 5. Ottieni minStockLevel del prodotto
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { minStockLevel: true, reorderPoint: true },
    });
    const minStock = product?.minStockLevel || 0;
    const reorderPoint = product?.reorderPoint || 0;

    // 6. Determina status
    let status: 'CRITICAL' | 'LOW' | 'OK' | 'OVERSTOCKED';
    let statusMessage: string;

    if (totalAvailable <= 0) {
      status = 'CRITICAL';
      statusMessage = 'Esaurito! Riordinare immediatamente.';
    } else if (totalAvailable <= minStock) {
      status = 'CRITICAL';
      statusMessage = `Sotto scorta minima (${minStock} pz). Riordinare subito!`;
    } else if (daysUntilOutOfStock !== null && daysUntilOutOfStock <= 30) {
      status = 'LOW';
      statusMessage = `Finirà tra ~${daysUntilOutOfStock} giorni. Considera riordino.`;
    } else if (totalAvailable <= reorderPoint) {
      status = 'LOW';
      statusMessage = `Raggiunto punto di riordino (${reorderPoint} pz).`;
    } else if (avgMonthlySales > 0 && totalAvailable > avgMonthlySales * 6) {
      status = 'OVERSTOCKED';
      statusMessage = `Stock elevato (${Math.round(totalAvailable / avgMonthlySales)} mesi di giacenza).`;
    } else {
      status = 'OK';
      if (daysUntilOutOfStock !== null) {
        statusMessage = `OK - circa ${daysUntilOutOfStock} giorni di stock.`;
      } else {
        statusMessage = 'OK - nessuna vendita recente per previsione.';
      }
    }

    return {
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      avgWeeklySales: Math.round(avgWeeklySales * 100) / 100,
      avgMonthlySales: Math.round(avgMonthlySales * 100) / 100,
      daysUntilOutOfStock,
      estimatedOutOfStockDate,
      suggestedReorderDate,
      status,
      statusMessage,
    };
  }

  /**
   * Ottieni dati storici e proiezione per grafico temporale
   * Ritorna punti dati per gli ultimi N giorni + proiezione futura
   */
  async getStockHistory(productId: string, daysHistory: number = 90, daysProjection: number = 60): Promise<{
    history: Array<{ date: string; quantity: number; type: 'actual' | 'projected' }>;
    events: Array<{ date: string; type: string; quantity: number; description: string }>;
    currentStock: number;
    prediction: {
      avgDailySales: number;
      avgWeeklySales: number;
      avgMonthlySales: number;
      daysUntilOutOfStock: number | null;
      estimatedOutOfStockDate: Date | null;
      suggestedReorderDate: Date | null;
      status: 'CRITICAL' | 'LOW' | 'OK' | 'OVERSTOCKED';
      statusMessage: string;
    };
  }> {
    // 1. Ottieni giacenza attuale
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { productId },
    });
    const currentStock = inventoryItems.reduce(
      (sum, item) => sum + (item.quantity - item.reservedQuantity),
      0
    );

    // 2. Ottieni tutti i movimenti degli ultimi N giorni
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysHistory);

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        productId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Ricostruisci lo storico giornaliero partendo da oggi e andando indietro
    const history: Array<{ date: string; quantity: number; type: 'actual' | 'projected' }> = [];
    const events: Array<{ date: string; type: string; quantity: number; description: string }> = [];

    // Calcola stock per ogni giorno (partendo da oggi e ricostruendo all'indietro)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Raggruppa movimenti per giorno
    const movementsByDay = new Map<string, { in: number; out: number }>();
    for (const mov of movements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const existing = movementsByDay.get(dateKey) || { in: 0, out: 0 };

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        existing.in += mov.quantity;
      } else if (mov.type === 'OUT') {
        existing.out += mov.quantity;
      }
      // TRANSFER non cambia il totale globale

      movementsByDay.set(dateKey, existing);

      // Aggiungi evento
      events.push({
        date: dateKey,
        type: mov.type,
        quantity: mov.quantity,
        description: mov.type === 'IN' ? 'Carico' : mov.type === 'OUT' ? 'Scarico' : mov.type,
      });
    }

    // Costruisci storico giorno per giorno (da oggi indietro)
    const dailyHistory: Array<{ date: string; quantity: number }> = [];
    let tempStock = currentStock;

    for (let i = 0; i <= daysHistory; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      dailyHistory.unshift({ date: dateKey, quantity: tempStock });

      // Inverti i movimenti per ricostruire lo stock passato
      const dayMov = movementsByDay.get(dateKey);
      if (dayMov) {
        tempStock = tempStock + dayMov.out - dayMov.in;
      }
    }

    // Aggiungi storico attuale
    for (const point of dailyHistory) {
      history.push({ ...point, type: 'actual' });
    }

    // 4. Calcola previsione
    const prediction = await this.getStockPrediction(productId, daysHistory);

    // 5. Aggiungi proiezione futura
    if (prediction.avgDailySales > 0) {
      let projectedStock = currentStock;

      for (let i = 1; i <= daysProjection; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];

        projectedStock = Math.max(0, projectedStock - prediction.avgDailySales);

        history.push({
          date: dateKey,
          quantity: Math.round(projectedStock * 100) / 100,
          type: 'projected',
        });

        // Stop se arriva a 0
        if (projectedStock <= 0) break;
      }
    }

    return {
      history,
      events,
      currentStock,
      prediction,
    };
  }

  /**
   * Lista inventario avanzata con previsioni stock
   * Include tutti i dati necessari per filtri intelligenti
   */
  async listInventoryWithPredictions(params: InventoryQuery & { statusFilter?: string }) {
    const {
      page = 1,
      limit = 20,
      productId,
      locationId,
      lowStock,
      outOfStock,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      statusFilter,
    } = params;

    const where: any = {};

    if (productId) where.productId = productId;
    if (locationId) where.location = locationId;
    if (outOfStock) where.quantity = 0;
    if (search) {
      where.product = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Ottieni tutti gli item per calcolare previsioni
    const allItems = await prisma.inventoryItem.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            minStockLevel: true,
            reorderPoint: true,
            cost: true,
          },
        },
        variant: true,
      },
      orderBy: { [sortBy]: sortOrder },
    });

    // Calcola previsioni per ogni item
    const itemsWithPredictions = await Promise.all(
      allItems.map(async (item) => {
        const prediction = await this.getStockPrediction(item.productId);
        const available = item.quantity - item.reservedQuantity;

        return {
          ...item,
          available,
          prediction,
        };
      })
    );

    // Filtra per status se richiesto
    let filteredItems = itemsWithPredictions;
    if (statusFilter) {
      filteredItems = itemsWithPredictions.filter(item => {
        switch (statusFilter) {
          case 'CRITICAL':
            return item.prediction.status === 'CRITICAL';
          case 'LOW':
            return item.prediction.status === 'LOW' || item.prediction.status === 'CRITICAL';
          case 'OK':
            return item.prediction.status === 'OK';
          case 'OVERSTOCKED':
            return item.prediction.status === 'OVERSTOCKED';
          case 'REORDER_SOON':
            return item.prediction.daysUntilOutOfStock !== null &&
                   item.prediction.daysUntilOutOfStock <= 30;
          default:
            return true;
        }
      });
    }

    // lowStock filter
    if (lowStock) {
      filteredItems = filteredItems.filter(item =>
        item.prediction.status === 'CRITICAL' || item.prediction.status === 'LOW'
      );
    }

    const total = filteredItems.length;
    const skip = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    // Calcola statistiche aggregate
    const stats = {
      totalItems: allItems.length,
      critical: itemsWithPredictions.filter(i => i.prediction.status === 'CRITICAL').length,
      low: itemsWithPredictions.filter(i => i.prediction.status === 'LOW').length,
      ok: itemsWithPredictions.filter(i => i.prediction.status === 'OK').length,
      overstocked: itemsWithPredictions.filter(i => i.prediction.status === 'OVERSTOCKED').length,
      reorderSoon: itemsWithPredictions.filter(i =>
        i.prediction.daysUntilOutOfStock !== null &&
        i.prediction.daysUntilOutOfStock <= 30
      ).length,
    };

    return {
      items: paginatedItems,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  // ============================================
  // MATERIAL INVENTORY METHODS
  // ============================================

  /**
   * Lista inventario materiali con previsioni
   * I materiali usano currentStock direttamente, non la tabella MaterialInventory
   */
  async listMaterialInventory(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    locationId?: string;
    statusFilter?: string;
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      statusFilter,
    } = params;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;

    // Get all materials - use currentStock field directly
    const materials = await prisma.material.findMany({
      where,
      include: {
        supplier: { select: { id: true, businessName: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate predictions for each material
    const itemsWithPredictions = await Promise.all(
      materials.map(async (material) => {
        const prediction = await this.getMaterialPrediction(material.id);
        // Materials use currentStock directly, not MaterialInventory
        const available = material.currentStock;

        return {
          id: material.id,
          type: 'MATERIAL' as const,
          sku: material.sku,
          name: material.name,
          unit: material.unit,
          category: material.category,
          location: 'PRODUCTION', // Materials are in production area
          quantity: material.currentStock,
          reservedQuantity: 0, // No reservation system for materials yet
          available,
          minStock: material.minStock,
          reorderPoint: material.reorderPoint,
          cost: Number(material.cost),
          supplier: material.supplier,
          prediction,
        };
      })
    );

    // Filter by status if requested
    let filteredItems = itemsWithPredictions;
    if (statusFilter) {
      filteredItems = itemsWithPredictions.filter(item => {
        switch (statusFilter) {
          case 'CRITICAL':
            return item.prediction.status === 'CRITICAL';
          case 'LOW':
            return item.prediction.status === 'LOW' || item.prediction.status === 'CRITICAL';
          case 'OK':
            return item.prediction.status === 'OK';
          case 'OVERSTOCKED':
            return item.prediction.status === 'OVERSTOCKED';
          case 'REORDER_SOON':
            return item.prediction.daysUntilOutOfStock !== null &&
                   item.prediction.daysUntilOutOfStock <= 30;
          default:
            return true;
        }
      });
    }

    const total = filteredItems.length;
    const skip = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    // Calculate stats
    const stats = {
      totalItems: materials.length,
      critical: itemsWithPredictions.filter(i => i.prediction.status === 'CRITICAL').length,
      low: itemsWithPredictions.filter(i => i.prediction.status === 'LOW').length,
      ok: itemsWithPredictions.filter(i => i.prediction.status === 'OK').length,
      overstocked: itemsWithPredictions.filter(i => i.prediction.status === 'OVERSTOCKED').length,
      reorderSoon: itemsWithPredictions.filter(i =>
        i.prediction.daysUntilOutOfStock !== null &&
        i.prediction.daysUntilOutOfStock <= 30
      ).length,
    };

    return {
      items: paginatedItems,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Calcola previsione per materiale basata sui consumi
   * I materiali usano currentStock direttamente
   */
  async getMaterialPrediction(materialId: string, daysToAnalyze: number = 90): Promise<{
    avgDailyConsumption: number;
    avgWeeklyConsumption: number;
    avgMonthlyConsumption: number;
    daysUntilOutOfStock: number | null;
    estimatedOutOfStockDate: Date | null;
    suggestedReorderDate: Date | null;
    status: 'CRITICAL' | 'LOW' | 'OK' | 'OVERSTOCKED';
    statusMessage: string;
  }> {
    // Get current stock - materials use currentStock field directly
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return {
        avgDailyConsumption: 0,
        avgWeeklyConsumption: 0,
        avgMonthlyConsumption: 0,
        daysUntilOutOfStock: null,
        estimatedOutOfStockDate: null,
        suggestedReorderDate: null,
        status: 'OK',
        statusMessage: 'Materiale non trovato',
      };
    }

    // Materials use currentStock directly
    const totalAvailable = material.currentStock;

    // Get consumption movements (OUT, PRODUCTION) from last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    const consumptions = await prisma.materialMovement.findMany({
      where: {
        materialId,
        type: { in: ['OUT', 'PRODUCTION'] },
        createdAt: { gte: startDate },
      },
    });

    // Calculate average daily consumption
    const totalConsumed = consumptions.reduce((sum, m) => sum + m.quantity, 0);
    const avgDailyConsumption = totalConsumed / daysToAnalyze;
    const avgWeeklyConsumption = avgDailyConsumption * 7;
    const avgMonthlyConsumption = avgDailyConsumption * 30;

    // Calculate days until out of stock
    let daysUntilOutOfStock: number | null = null;
    let estimatedOutOfStockDate: Date | null = null;
    let suggestedReorderDate: Date | null = null;

    if (avgDailyConsumption > 0 && totalAvailable > 0) {
      daysUntilOutOfStock = Math.floor(totalAvailable / avgDailyConsumption);

      estimatedOutOfStockDate = new Date();
      estimatedOutOfStockDate.setDate(estimatedOutOfStockDate.getDate() + daysUntilOutOfStock);

      // Suggested reorder: lead time + buffer
      const leadTimeDays = material.leadTimeDays || 7;
      const bufferDays = 7;
      const daysBeforeReorder = Math.max(0, daysUntilOutOfStock - leadTimeDays - bufferDays);
      suggestedReorderDate = new Date();
      suggestedReorderDate.setDate(suggestedReorderDate.getDate() + daysBeforeReorder);
    }

    // Determine status
    let status: 'CRITICAL' | 'LOW' | 'OK' | 'OVERSTOCKED';
    let statusMessage: string;

    if (totalAvailable <= 0) {
      status = 'CRITICAL';
      statusMessage = 'Esaurito! Riordinare immediatamente.';
    } else if (totalAvailable <= material.minStock) {
      status = 'CRITICAL';
      statusMessage = `Sotto scorta minima (${material.minStock} ${material.unit}). Riordinare!`;
    } else if (daysUntilOutOfStock !== null && daysUntilOutOfStock <= (material.leadTimeDays || 7)) {
      status = 'CRITICAL';
      statusMessage = `Finirà prima del lead time (${material.leadTimeDays || 7} giorni). Riordinare subito!`;
    } else if (totalAvailable <= material.reorderPoint) {
      status = 'LOW';
      statusMessage = `Raggiunto punto di riordino (${material.reorderPoint} ${material.unit}).`;
    } else if (daysUntilOutOfStock !== null && daysUntilOutOfStock <= 30) {
      status = 'LOW';
      statusMessage = `Finirà tra ~${daysUntilOutOfStock} giorni. Considera riordino.`;
    } else if (avgMonthlyConsumption > 0 && totalAvailable > avgMonthlyConsumption * 6) {
      status = 'OVERSTOCKED';
      statusMessage = `Stock elevato (${Math.round(totalAvailable / avgMonthlyConsumption)} mesi).`;
    } else {
      status = 'OK';
      if (daysUntilOutOfStock !== null) {
        statusMessage = `OK - circa ${daysUntilOutOfStock} giorni di stock.`;
      } else {
        statusMessage = 'OK - nessun consumo recente per previsione.';
      }
    }

    return {
      avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
      avgWeeklyConsumption: Math.round(avgWeeklyConsumption * 100) / 100,
      avgMonthlyConsumption: Math.round(avgMonthlyConsumption * 100) / 100,
      daysUntilOutOfStock,
      estimatedOutOfStockDate,
      suggestedReorderDate,
      status,
      statusMessage,
    };
  }

  /**
   * Storico consumo materiale per grafico
   * I materiali usano currentStock direttamente
   */
  async getMaterialHistory(materialId: string, daysHistory: number = 90, daysProjection: number = 60) {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return { history: [], events: [], currentStock: 0, prediction: null };
    }

    // Materials use currentStock directly
    const currentStock = material.currentStock;

    // Get movements
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysHistory);

    const movements = await prisma.materialMovement.findMany({
      where: {
        materialId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily history
    const history: Array<{ date: string; quantity: number; type: 'actual' | 'projected' }> = [];
    const events: Array<{ date: string; type: string; quantity: number; description: string }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group movements by day
    const movementsByDay = new Map<string, { in: number; out: number }>();
    for (const mov of movements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const existing = movementsByDay.get(dateKey) || { in: 0, out: 0 };

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        existing.in += mov.quantity;
      } else {
        existing.out += mov.quantity;
      }

      movementsByDay.set(dateKey, existing);

      events.push({
        date: dateKey,
        type: mov.type,
        quantity: mov.quantity,
        description: mov.type === 'PRODUCTION' ? 'Consumo produzione' : mov.type,
      });
    }

    // Build history backwards from today
    const dailyHistory: Array<{ date: string; quantity: number }> = [];
    let tempStock = currentStock;

    for (let i = 0; i <= daysHistory; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      dailyHistory.unshift({ date: dateKey, quantity: tempStock });

      const dayMov = movementsByDay.get(dateKey);
      if (dayMov) {
        tempStock = tempStock + dayMov.out - dayMov.in;
      }
    }

    for (const point of dailyHistory) {
      history.push({ ...point, type: 'actual' });
    }

    // Get prediction and add projection
    const prediction = await this.getMaterialPrediction(materialId, daysHistory);

    if (prediction.avgDailyConsumption > 0) {
      let projectedStock = currentStock;

      for (let i = 1; i <= daysProjection; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];

        projectedStock = Math.max(0, projectedStock - prediction.avgDailyConsumption);

        history.push({
          date: dateKey,
          quantity: Math.round(projectedStock * 100) / 100,
          type: 'projected',
        });

        if (projectedStock <= 0) break;
      }
    }

    return {
      history,
      events,
      currentStock,
      prediction,
    };
  }

  /**
   * Overview globale inventario (prodotti + materiali critici)
   */
  async getInventoryOverview(): Promise<{
    products: {
      total: number;
      critical: number;
      low: number;
      ok: number;
      totalValue: number;
    };
    materials: {
      total: number;
      critical: number;
      low: number;
      ok: number;
      totalValue: number;
    };
    criticalItems: Array<{
      type: 'PRODUCT' | 'MATERIAL';
      id: string;
      sku: string;
      name: string;
      available: number;
      daysUntilOut: number | null;
      status: string;
    }>;
  }> {
    // Get product stats
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { inventory: true },
    });

    let productsCritical = 0;
    let productsLow = 0;
    let productsOk = 0;
    let productsValue = 0;
    const criticalProducts: Array<any> = [];

    for (const product of products) {
      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );
      productsValue += totalStock * Number(product.cost);

      const prediction = await this.getStockPrediction(product.id, 90);

      if (prediction.status === 'CRITICAL') {
        productsCritical++;
        criticalProducts.push({
          type: 'PRODUCT',
          id: product.id,
          sku: product.sku,
          name: product.name,
          available: totalStock,
          daysUntilOut: prediction.daysUntilOutOfStock,
          status: prediction.status,
        });
      } else if (prediction.status === 'LOW') {
        productsLow++;
      } else {
        productsOk++;
      }
    }

    // Get material stats - materials use currentStock directly
    const materials = await prisma.material.findMany({
      where: { isActive: true },
    });

    let materialsCritical = 0;
    let materialsLow = 0;
    let materialsOk = 0;
    let materialsValue = 0;
    const criticalMaterials: Array<any> = [];

    for (const material of materials) {
      // Materials use currentStock field directly
      const totalStock = material.currentStock;
      materialsValue += totalStock * Number(material.cost);

      const prediction = await this.getMaterialPrediction(material.id, 90);

      if (prediction.status === 'CRITICAL') {
        materialsCritical++;
        criticalMaterials.push({
          type: 'MATERIAL',
          id: material.id,
          sku: material.sku,
          name: material.name,
          available: totalStock,
          daysUntilOut: prediction.daysUntilOutOfStock,
          status: prediction.status,
        });
      } else if (prediction.status === 'LOW') {
        materialsLow++;
      } else {
        materialsOk++;
      }
    }

    // Combine and sort critical items
    const criticalItems = [...criticalProducts, ...criticalMaterials]
      .sort((a, b) => {
        if (a.daysUntilOut === null) return 1;
        if (b.daysUntilOut === null) return -1;
        return a.daysUntilOut - b.daysUntilOut;
      })
      .slice(0, 10);

    return {
      products: {
        total: products.length,
        critical: productsCritical,
        low: productsLow,
        ok: productsOk,
        totalValue: productsValue,
      },
      materials: {
        total: materials.length,
        critical: materialsCritical,
        low: materialsLow,
        ok: materialsOk,
        totalValue: materialsValue,
      },
      criticalItems,
    };
  }

  /**
   * Andamento globale del valore inventario (prodotti + materiali)
   * Per il grafico nella dashboard giacenze
   */
  async getGlobalStockTrend(daysHistory: number = 60, daysProjection: number = 30): Promise<{
    history: Array<{
      date: string;
      productsValue: number;
      materialsValue: number;
      totalValue: number;
      type: 'actual' | 'projected';
    }>;
    currentTotals: {
      productsValue: number;
      materialsValue: number;
      totalValue: number;
    };
    projectedTotals: {
      productsValue: number;
      materialsValue: number;
      totalValue: number;
      daysUntil: number;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all products with inventory and cost
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        cost: true,
        inventory: {
          select: { quantity: true, reservedQuantity: true },
        },
      },
    });

    // Get all materials with inventory and cost
    // Materials use currentStock directly
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      select: {
        id: true,
        cost: true,
        currentStock: true,
      },
    });

    // Calculate current values
    let currentProductsValue = 0;
    let currentMaterialsValue = 0;

    for (const product of products) {
      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );
      currentProductsValue += totalStock * Number(product.cost);
    }

    for (const material of materials) {
      // Materials use currentStock field directly
      currentMaterialsValue += material.currentStock * Number(material.cost);
    }

    const currentTotalValue = currentProductsValue + currentMaterialsValue;

    // Get all movements for the period
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysHistory);

    const [productMovements, materialMovements] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where: { createdAt: { gte: startDate } },
        include: { product: { select: { cost: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.materialMovement.findMany({
        where: { createdAt: { gte: startDate } },
        include: { material: { select: { cost: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group movements by day and calculate value changes
    const productValueByDay = new Map<string, number>();
    const materialValueByDay = new Map<string, number>();

    for (const mov of productMovements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const value = mov.quantity * Number(mov.product?.cost || 0);
      const existing = productValueByDay.get(dateKey) || 0;

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        productValueByDay.set(dateKey, existing + value);
      } else if (mov.type === 'OUT') {
        productValueByDay.set(dateKey, existing - value);
      }
    }

    for (const mov of materialMovements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const value = mov.quantity * Number(mov.material?.cost || 0);
      const existing = materialValueByDay.get(dateKey) || 0;

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        materialValueByDay.set(dateKey, existing + value);
      } else if (mov.type === 'OUT' || mov.type === 'PRODUCTION') {
        materialValueByDay.set(dateKey, existing - value);
      }
    }

    // Build historical trend (going backwards from today)
    const history: Array<{
      date: string;
      productsValue: number;
      materialsValue: number;
      totalValue: number;
      type: 'actual' | 'projected';
    }> = [];

    let runningProductsValue = currentProductsValue;
    let runningMaterialsValue = currentMaterialsValue;

    // Reconstruct history backwards
    const dailyHistory: Array<{
      date: string;
      productsValue: number;
      materialsValue: number;
    }> = [];

    for (let i = 0; i <= daysHistory; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      dailyHistory.unshift({
        date: dateKey,
        productsValue: runningProductsValue,
        materialsValue: runningMaterialsValue,
      });

      // Reverse the movements to reconstruct past values
      const productChange = productValueByDay.get(dateKey) || 0;
      const materialChange = materialValueByDay.get(dateKey) || 0;

      runningProductsValue -= productChange;
      runningMaterialsValue -= materialChange;
    }

    // Add actual history to result
    for (const point of dailyHistory) {
      history.push({
        ...point,
        totalValue: point.productsValue + point.materialsValue,
        type: 'actual',
      });
    }

    // Calculate average daily value change for projection
    const totalProductChange = currentProductsValue - runningProductsValue;
    const totalMaterialChange = currentMaterialsValue - runningMaterialsValue;
    const avgDailyProductChange = totalProductChange / daysHistory;
    const avgDailyMaterialChange = totalMaterialChange / daysHistory;

    // Add projection
    let projectedProductsValue = currentProductsValue;
    let projectedMaterialsValue = currentMaterialsValue;

    for (let i = 1; i <= daysProjection; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];

      // Apply average daily change (typically negative for consumption)
      projectedProductsValue = Math.max(0, projectedProductsValue + avgDailyProductChange);
      projectedMaterialsValue = Math.max(0, projectedMaterialsValue + avgDailyMaterialChange);

      history.push({
        date: dateKey,
        productsValue: Math.round(projectedProductsValue * 100) / 100,
        materialsValue: Math.round(projectedMaterialsValue * 100) / 100,
        totalValue: Math.round((projectedProductsValue + projectedMaterialsValue) * 100) / 100,
        type: 'projected',
      });
    }

    return {
      history,
      currentTotals: {
        productsValue: Math.round(currentProductsValue * 100) / 100,
        materialsValue: Math.round(currentMaterialsValue * 100) / 100,
        totalValue: Math.round(currentTotalValue * 100) / 100,
      },
      projectedTotals: {
        productsValue: Math.round(projectedProductsValue * 100) / 100,
        materialsValue: Math.round(projectedMaterialsValue * 100) / 100,
        totalValue: Math.round((projectedProductsValue + projectedMaterialsValue) * 100) / 100,
        daysUntil: daysProjection,
      },
    };
  }

  // ============================================
  // ADVANCED FORECASTING WITH MULTI-SCENARIO
  // ============================================

  /**
   * Previsione avanzata multi-scenario con alert proattivi
   *
   * IMPORTANTE: La previsione si basa su:
   * - PRODOTTI: Ordini reali ricevuti (SHIPPED/DELIVERED), NON movimenti generici
   * - MATERIALI: Consumo effettivo in produzione (MaterialConsumption), NON movimenti generici
   * - DEAD STOCK: Prodotti con giacenza ma nessun ordine in 90+ giorni
   */
  async getAdvancedForecast(daysHistory = 90, daysProjection = 60): Promise<{
    history: Array<{ date: string; productsValue: number; materialsValue: number }>;
    scenarios: {
      optimistic: Array<{ date: string; productsValue: number; materialsValue: number }>;
      baseline: Array<{ date: string; productsValue: number; materialsValue: number }>;
      pessimistic: Array<{ date: string; productsValue: number; materialsValue: number }>;
    };
    trend: {
      products: { direction: 'increasing' | 'stable' | 'decreasing'; weeklyGrowthRate: number; volatility: 'low' | 'medium' | 'high'; avgDaily: number; avgDailyValue: number; stdDev: number };
      materials: { direction: 'increasing' | 'stable' | 'decreasing'; weeklyGrowthRate: number; volatility: 'low' | 'medium' | 'high'; avgDaily: number; avgDailyValue: number; stdDev: number };
    };
    timeline: Array<{
      date: string;
      label: string;
      urgency: 'critical' | 'warning' | 'info';
      actions: Array<{
        type: 'REORDER' | 'PRODUCE';
        items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
      }>;
    }>;
    deadStock: Array<{
      id: string;
      sku: string;
      name: string;
      quantity: number;
      value: number;
      daysSinceLastOrder: number | null;
    }>;
    current: {
      productsCostValue: number;      // Valore prodotti a costo
      productsRetailValue: number;    // Valore prodotti a prezzo vendita
      productsMargin: number;         // Margine assoluto (retail - cost)
      productsMarginPercent: number;  // Margine % sul prezzo vendita
      materialsValue: number;         // Valore materiali (solo costo)
      totalCostValue: number;         // Totale a costo (prodotti + materiali)
      totalRetailValue: number;       // Totale a vendita (solo prodotti hanno prezzo vendita)
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysHistory);

    // 1. Recupera dati: prodotti, materiali, ORDINI REALI, consumo materiali in produzione
    const [products, materials, orderItems, materialConsumptions, productMovements, materialMovements] = await Promise.all([
      // Prodotti con inventario
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true, sku: true, name: true, cost: true, price: true,
          minStockLevel: true, reorderPoint: true,
          inventory: { select: { quantity: true, reservedQuantity: true } }
        }
      }),
      // Materiali
      prisma.material.findMany({
        where: { isActive: true },
        select: {
          id: true, sku: true, name: true, cost: true, currentStock: true, unit: true,
          minStock: true, reorderPoint: true, reorderQuantity: true, leadTimeDays: true
        }
      }),
      // ORDINI REALI: solo quelli spediti/consegnati (vendite effettive)
      prisma.orderItem.findMany({
        where: {
          order: {
            status: { in: ['SHIPPED', 'DELIVERED'] },
            orderDate: { gte: startDate }
          }
        },
        select: {
          productId: true,
          quantity: true,
          order: { select: { orderDate: true, status: true } },
          product: { select: { cost: true } }
        }
      }),
      // CONSUMO MATERIALI: da produzione effettiva
      prisma.materialConsumption.findMany({
        where: {
          createdAt: { gte: startDate },
          actualQuantity: { gt: 0 }
        },
        select: {
          materialId: true,
          actualQuantity: true,
          createdAt: true,
          material: { select: { cost: true } }
        }
      }),
      // Movimenti prodotti (per storico grafico - tutti i movimenti)
      prisma.inventoryMovement.findMany({
        where: { createdAt: { gte: startDate } },
        include: { product: { select: { cost: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      // Movimenti materiali (per storico grafico)
      prisma.materialMovement.findMany({
        where: { createdAt: { gte: startDate } },
        include: { material: { select: { cost: true } } },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // 2. Calcola valori attuali (COSTO e VENDITA per marginalità)
    let currentProductsCostValue = 0;    // Valore a costo
    let currentProductsRetailValue = 0;  // Valore a prezzo vendita
    let currentMaterialsValue = 0;

    for (const product of products) {
      // Usa quantity TOTALE (non sottrarre reservedQuantity) per il valore stock
      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0
      );
      currentProductsCostValue += totalStock * Number(product.cost || 0);
      currentProductsRetailValue += totalStock * Number(product.price || 0);
    }

    for (const material of materials) {
      currentMaterialsValue += material.currentStock * Number(material.cost || 0);
    }

    // Calcola marginalità attuale
    const currentMargin = currentProductsRetailValue - currentProductsCostValue;
    const currentMarginPercent = currentProductsRetailValue > 0
      ? Math.round((currentMargin / currentProductsRetailValue) * 10000) / 100
      : 0;

    // 3. Costruisci storico giornaliero (usa movimenti per il grafico storico)
    const history = this.buildDailyHistoryAdvanced(
      currentProductsCostValue,
      currentMaterialsValue,
      productMovements,
      materialMovements,
      daysHistory,
      today
    );

    // 4. Analizza trend basato su ORDINI REALI (prodotti) e CONSUMO (materiali)
    const productTrend = this.analyzeTrendFromOrders(orderItems, daysHistory);
    const materialTrend = this.analyzeTrendFromConsumption(materialConsumptions, daysHistory);

    // 4b. Calcola consumo PER SINGOLO prodotto
    // PRIORITA': ordini reali -> fallback a movimenti OUT
    const productSalesMap = new Map<string, number>();

    if (orderItems.length > 0) {
      // Usa ordini reali (SHIPPED/DELIVERED)
      for (const item of orderItems) {
        const current = productSalesMap.get(item.productId) || 0;
        productSalesMap.set(item.productId, current + item.quantity);
      }
    } else {
      // FALLBACK: usa movimenti OUT se non ci sono ordini
      for (const mov of productMovements) {
        if (mov.type === 'OUT') {
          const current = productSalesMap.get(mov.productId) || 0;
          productSalesMap.set(mov.productId, current + mov.quantity);
        }
      }
    }

    // 4c. Calcola consumo PER SINGOLO materiale
    // PRIORITA': MaterialConsumption -> fallback a movimenti OUT/PRODUCTION
    const materialConsumptionMap = new Map<string, number>();

    if (materialConsumptions.length > 0) {
      // Usa consumo produzione reale
      for (const cons of materialConsumptions) {
        const current = materialConsumptionMap.get(cons.materialId) || 0;
        materialConsumptionMap.set(cons.materialId, current + Number(cons.actualQuantity || 0));
      }
    } else {
      // FALLBACK: usa movimenti OUT/PRODUCTION se non ci sono consumi
      for (const mov of materialMovements) {
        if (mov.type === 'OUT' || mov.type === 'PRODUCTION') {
          const current = materialConsumptionMap.get(mov.materialId) || 0;
          materialConsumptionMap.set(mov.materialId, current + mov.quantity);
        }
      }
    }

    // 5. Calcola scenari di proiezione
    const lastHistoryPoint = history[history.length - 1];
    const scenarios = this.buildScenariosAdvanced(
      lastHistoryPoint,
      productTrend,
      materialTrend,
      daysProjection,
      today
    );

    // 6. Genera timeline raggruppata per data (con consumo individuale)
    const timeline = this.generateTimelineAdvanced(
      products,
      materials,
      productSalesMap,
      materialConsumptionMap,
      daysHistory,
      today
    );

    // 7. Rileva DEAD STOCK: prodotti con giacenza ma nessun ordine in 90+ giorni
    const deadStock = await this.detectDeadStock(products, daysHistory);

    return {
      history,
      scenarios,
      trend: {
        products: productTrend,
        materials: materialTrend
      },
      timeline,
      deadStock,
      current: {
        productsCostValue: Math.round(currentProductsCostValue * 100) / 100,
        productsRetailValue: Math.round(currentProductsRetailValue * 100) / 100,
        productsMargin: Math.round(currentMargin * 100) / 100,
        productsMarginPercent: currentMarginPercent,
        materialsValue: Math.round(currentMaterialsValue * 100) / 100,
        totalCostValue: Math.round((currentProductsCostValue + currentMaterialsValue) * 100) / 100,
        totalRetailValue: Math.round((currentProductsRetailValue + currentMaterialsValue) * 100) / 100
      }
    };
  }

  /**
   * Analizza trend PRODOTTI basato su ORDINI REALI (non movimenti generici)
   * Conta solo ordini SHIPPED/DELIVERED = vendite effettive
   */
  private analyzeTrendFromOrders(
    orderItems: Array<{
      quantity: number;
      order: { orderDate: Date; status: string };
      product: { cost: any } | null;
    }>,
    daysHistory: number
  ): { direction: 'increasing' | 'stable' | 'decreasing'; weeklyGrowthRate: number; volatility: 'low' | 'medium' | 'high'; avgDaily: number; avgDailyValue: number; stdDev: number } {
    if (!orderItems.length) {
      return { direction: 'stable', weeklyGrowthRate: 0, volatility: 'low', avgDaily: 0, avgDailyValue: 0, stdDev: 0 };
    }

    const now = Date.now();
    const weeks: Map<number, number> = new Map();
    const weeksValue: Map<number, number> = new Map();

    // Raggruppa ordini per settimana
    for (const item of orderItems) {
      const weekNum = Math.floor((now - item.order.orderDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const cost = Number(item.product?.cost || 0);

      weeks.set(weekNum, (weeks.get(weekNum) || 0) + item.quantity);
      weeksValue.set(weekNum, (weeksValue.get(weekNum) || 0) + (item.quantity * cost));
    }

    const weeklyTotals = Array.from(weeks.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, qty]) => qty);

    if (weeklyTotals.length < 2) {
      const totalQty = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = orderItems.reduce((sum, item) => sum + (item.quantity * Number(item.product?.cost || 0)), 0);
      return {
        direction: 'stable',
        weeklyGrowthRate: 0,
        volatility: 'low',
        avgDaily: totalQty / daysHistory,
        avgDailyValue: totalValue / daysHistory,
        stdDev: 0
      };
    }

    // Calcola variazioni settimanali
    const changes: number[] = [];
    for (let i = 0; i < weeklyTotals.length - 1; i++) {
      if (weeklyTotals[i + 1] > 0) {
        changes.push((weeklyTotals[i] - weeklyTotals[i + 1]) / weeklyTotals[i + 1]);
      }
    }

    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const variance = changes.length > 0
      ? changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Media giornaliera
    const totalQty = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = orderItems.reduce((sum, item) => sum + (item.quantity * Number(item.product?.cost || 0)), 0);
    const avgDaily = totalQty / daysHistory;
    const avgDailyValue = totalValue / daysHistory;

    // Classifica
    let direction: 'increasing' | 'stable' | 'decreasing';
    if (avgChange > 0.02) direction = 'increasing';
    else if (avgChange < -0.02) direction = 'decreasing';
    else direction = 'stable';

    let volatility: 'low' | 'medium' | 'high';
    if (stdDev > 0.15) volatility = 'high';
    else if (stdDev > 0.08) volatility = 'medium';
    else volatility = 'low';

    return { direction, weeklyGrowthRate: Math.round(avgChange * 1000) / 10, volatility, avgDaily, avgDailyValue, stdDev };
  }

  /**
   * Analizza trend MATERIALI basato su CONSUMO PRODUZIONE (non movimenti generici)
   */
  private analyzeTrendFromConsumption(
    consumptions: Array<{
      actualQuantity: any;
      createdAt: Date;
      material: { cost: any } | null;
    }>,
    daysHistory: number
  ): { direction: 'increasing' | 'stable' | 'decreasing'; weeklyGrowthRate: number; volatility: 'low' | 'medium' | 'high'; avgDaily: number; avgDailyValue: number; stdDev: number } {
    if (!consumptions.length) {
      return { direction: 'stable', weeklyGrowthRate: 0, volatility: 'low', avgDaily: 0, avgDailyValue: 0, stdDev: 0 };
    }

    const now = Date.now();
    const weeks: Map<number, number> = new Map();

    // Raggruppa consumi per settimana
    for (const cons of consumptions) {
      const weekNum = Math.floor((now - cons.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const qty = Number(cons.actualQuantity || 0);
      weeks.set(weekNum, (weeks.get(weekNum) || 0) + qty);
    }

    const weeklyTotals = Array.from(weeks.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, qty]) => qty);

    if (weeklyTotals.length < 2) {
      const totalQty = consumptions.reduce((sum, c) => sum + Number(c.actualQuantity || 0), 0);
      const totalValue = consumptions.reduce((sum, c) => sum + (Number(c.actualQuantity || 0) * Number(c.material?.cost || 0)), 0);
      return {
        direction: 'stable',
        weeklyGrowthRate: 0,
        volatility: 'low',
        avgDaily: totalQty / daysHistory,
        avgDailyValue: totalValue / daysHistory,
        stdDev: 0
      };
    }

    // Calcola variazioni
    const changes: number[] = [];
    for (let i = 0; i < weeklyTotals.length - 1; i++) {
      if (weeklyTotals[i + 1] > 0) {
        changes.push((weeklyTotals[i] - weeklyTotals[i + 1]) / weeklyTotals[i + 1]);
      }
    }

    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const variance = changes.length > 0
      ? changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
      : 0;
    const stdDev = Math.sqrt(variance);

    const totalQty = consumptions.reduce((sum, c) => sum + Number(c.actualQuantity || 0), 0);
    const totalValue = consumptions.reduce((sum, c) => sum + (Number(c.actualQuantity || 0) * Number(c.material?.cost || 0)), 0);
    const avgDaily = totalQty / daysHistory;
    const avgDailyValue = totalValue / daysHistory;

    let direction: 'increasing' | 'stable' | 'decreasing';
    if (avgChange > 0.02) direction = 'increasing';
    else if (avgChange < -0.02) direction = 'decreasing';
    else direction = 'stable';

    let volatility: 'low' | 'medium' | 'high';
    if (stdDev > 0.15) volatility = 'high';
    else if (stdDev > 0.08) volatility = 'medium';
    else volatility = 'low';

    return { direction, weeklyGrowthRate: Math.round(avgChange * 1000) / 10, volatility, avgDaily, avgDailyValue, stdDev };
  }

  /**
   * Rileva DEAD STOCK: prodotti con giacenza ma nessun ordine negli ultimi N giorni
   * Questi prodotti NON devono essere riordinati, ma promossi/scontati
   */
  private async detectDeadStock(
    products: Array<{ id: string; sku: string; name: string; cost: any; inventory: Array<{ quantity: number; reservedQuantity: number }> }>,
    daysThreshold: number
  ): Promise<Array<{ id: string; sku: string; name: string; quantity: number; value: number; daysSinceLastOrder: number | null }>> {
    const deadStock: Array<{ id: string; sku: string; name: string; quantity: number; value: number; daysSinceLastOrder: number | null }> = [];
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Recupera ultimo ordine per ogni prodotto
    const lastOrders = await prisma.orderItem.groupBy({
      by: ['productId'],
      _max: { createdAt: true },
      where: {
        order: { status: { in: ['SHIPPED', 'DELIVERED'] } }
      }
    });

    const lastOrderByProduct = new Map(lastOrders.map(o => [o.productId, o._max.createdAt]));

    for (const product of products) {
      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );

      // Se ha giacenza > 0
      if (totalStock > 0) {
        const lastOrderDate = lastOrderByProduct.get(product.id);

        // Se non ha MAI avuto ordini, o l'ultimo è prima della soglia
        if (!lastOrderDate || lastOrderDate < thresholdDate) {
          const daysSince = lastOrderDate
            ? Math.floor((Date.now() - lastOrderDate.getTime()) / (24 * 60 * 60 * 1000))
            : null;

          deadStock.push({
            id: product.id,
            sku: product.sku,
            name: product.name,
            quantity: totalStock,
            value: Math.round(totalStock * Number(product.cost) * 100) / 100,
            daysSinceLastOrder: daysSince
          });
        }
      }
    }

    // Ordina per valore (maggiore prima)
    return deadStock.sort((a, b) => b.value - a.value);
  }

  /**
   * Costruisce storico giornaliero per forecast avanzato
   */
  private buildDailyHistoryAdvanced(
    currentProductsValue: number,
    currentMaterialsValue: number,
    productMovements: any[],
    materialMovements: any[],
    daysHistory: number,
    today: Date
  ): Array<{ date: string; productsValue: number; materialsValue: number }> {
    // Raggruppa movimenti per giorno
    const productValueByDay = new Map<string, number>();
    const materialValueByDay = new Map<string, number>();

    for (const mov of productMovements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const value = mov.quantity * Number(mov.product?.cost || 0);
      const existing = productValueByDay.get(dateKey) || 0;

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        productValueByDay.set(dateKey, existing + value);
      } else if (mov.type === 'OUT') {
        productValueByDay.set(dateKey, existing - value);
      }
    }

    for (const mov of materialMovements) {
      const dateKey = mov.createdAt.toISOString().split('T')[0];
      const value = mov.quantity * Number(mov.material?.cost || 0);
      const existing = materialValueByDay.get(dateKey) || 0;

      if (mov.type === 'IN' || mov.type === 'RETURN') {
        materialValueByDay.set(dateKey, existing + value);
      } else if (mov.type === 'OUT' || mov.type === 'PRODUCTION') {
        materialValueByDay.set(dateKey, existing - value);
      }
    }

    // Ricostruisci storico all'indietro
    const history: Array<{ date: string; productsValue: number; materialsValue: number }> = [];
    let runningProductsValue = currentProductsValue;
    let runningMaterialsValue = currentMaterialsValue;

    for (let i = 0; i <= daysHistory; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      history.unshift({
        date: dateKey,
        productsValue: Math.round(runningProductsValue * 100) / 100,
        materialsValue: Math.round(runningMaterialsValue * 100) / 100
      });

      const productChange = productValueByDay.get(dateKey) || 0;
      const materialChange = materialValueByDay.get(dateKey) || 0;
      runningProductsValue -= productChange;
      runningMaterialsValue -= materialChange;
    }

    return history;
  }

  /**
   * Costruisce scenari di proiezione (ottimistico, baseline, pessimistico)
   * Usa avgDailyValue (EUR) per calcolare la diminuzione del valore inventario
   */
  private buildScenariosAdvanced(
    current: { productsValue: number; materialsValue: number },
    productTrend: { avgDailyValue: number; stdDev: number },
    materialTrend: { avgDailyValue: number; stdDev: number },
    daysProjection: number,
    today: Date
  ): {
    optimistic: Array<{ date: string; productsValue: number; materialsValue: number }>;
    baseline: Array<{ date: string; productsValue: number; materialsValue: number }>;
    pessimistic: Array<{ date: string; productsValue: number; materialsValue: number }>;
  } {
    const scenarios = {
      optimistic: [] as Array<{ date: string; productsValue: number; materialsValue: number }>,
      baseline: [] as Array<{ date: string; productsValue: number; materialsValue: number }>,
      pessimistic: [] as Array<{ date: string; productsValue: number; materialsValue: number }>
    };

    // Moltiplicatori basati su deviazione standard (max 30%)
    // Ottimistico = consumo più lento (meno vendite/uso)
    // Pessimistico = consumo più veloce (più vendite/uso)
    const productMultipliers = {
      optimistic: Math.max(0.7, 1 - Math.min(productTrend.stdDev, 0.3)),
      baseline: 1,
      pessimistic: 1 + Math.min(productTrend.stdDev, 0.3)
    };

    const materialMultipliers = {
      optimistic: Math.max(0.7, 1 - Math.min(materialTrend.stdDev, 0.3)),
      baseline: 1,
      pessimistic: 1 + Math.min(materialTrend.stdDev, 0.3)
    };

    for (let day = 1; day <= daysProjection; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      for (const scenario of ['optimistic', 'baseline', 'pessimistic'] as const) {
        // Consumo giornaliero in VALORE (EUR) * moltiplicatore scenario
        const productDailyConsumptionValue = productTrend.avgDailyValue * productMultipliers[scenario];
        const materialDailyConsumptionValue = materialTrend.avgDailyValue * materialMultipliers[scenario];

        // Valore proiettato = valore attuale - consumo cumulativo in EUR
        // Il valore SCENDE sempre (consumo è sempre positivo)
        const projectedProductsValue = Math.max(0, current.productsValue - (productDailyConsumptionValue * day));
        const projectedMaterialsValue = Math.max(0, current.materialsValue - (materialDailyConsumptionValue * day));

        scenarios[scenario].push({
          date: dateStr,
          productsValue: Math.round(projectedProductsValue * 100) / 100,
          materialsValue: Math.round(projectedMaterialsValue * 100) / 100
        });
      }
    }

    return scenarios;
  }

  /**
   * Genera timeline raggruppata per data con azioni (riordino/produzione)
   * Usa consumo INDIVIDUALE per prodotto/materiale, non media globale
   *
   * @param productSalesMap - Mappa productId -> quantità vendute nel periodo (da OrderItems)
   * @param materialConsumptionMap - Mappa materialId -> quantità consumate nel periodo (da MaterialConsumption)
   * @param daysHistory - Giorni di storico per calcolare media giornaliera
   */
  private generateTimelineAdvanced(
    products: Array<{
      id: string; sku: string; name: string; cost: any;
      minStockLevel: number | null; reorderPoint: number | null;
      inventory: Array<{ quantity: number; reservedQuantity: number }>;
    }>,
    materials: Array<{
      id: string; sku: string; name: string; cost: any; currentStock: number; unit: string;
      minStock: number | null; reorderPoint: number | null; reorderQuantity: number | null; leadTimeDays: number | null;
    }>,
    productSalesMap: Map<string, number>,
    materialConsumptionMap: Map<string, number>,
    daysHistory: number,
    today: Date
  ): Array<{
    date: string;
    label: string;
    urgency: 'critical' | 'warning' | 'info';
    actions: Array<{
      type: 'REORDER' | 'PRODUCE';
      items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
    }>;
  }> {
    // Mappa temporanea: data -> { reorderItems, produceItems, urgency }
    const dateMap = new Map<string, {
      reorderItems: Array<{ id: string; name: string; quantity: number; unit?: string }>;
      produceItems: Array<{ id: string; name: string; quantity: number }>;
      urgency: 'critical' | 'warning' | 'info';
    }>();

    const formatLabel = (date: Date): string => {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    };

    // ========== MATERIALI -> data riordino (ACQUISTO) ==========
    for (const material of materials) {
      // Consumo SPECIFICO di questo materiale nel periodo
      const totalConsumed = materialConsumptionMap.get(material.id) || 0;
      const avgDailyConsumption = totalConsumed / daysHistory;

      // Salta materiali senza consumo
      if (avgDailyConsumption <= 0) continue;

      // Salta se stock infinito o zero
      if (material.currentStock <= 0) continue;

      const daysUntilStockout = material.currentStock / avgDailyConsumption;

      // Salta se esaurimento oltre 90 giorni
      if (!isFinite(daysUntilStockout) || daysUntilStockout > 90) continue;

      // Data esaurimento
      const stockoutDate = new Date(today);
      stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysUntilStockout));

      // Data riordino (stockout - leadTime - buffer)
      const leadTime = material.leadTimeDays || 14;
      const buffer = 7;
      const reorderDate = new Date(stockoutDate);
      reorderDate.setDate(reorderDate.getDate() - leadTime - buffer);

      // Se la data riordino è nel passato, usa oggi
      if (reorderDate < today) {
        reorderDate.setTime(today.getTime());
      }

      // Urgenza
      let urgency: 'critical' | 'warning' | 'info';
      if (daysUntilStockout <= leadTime) {
        urgency = 'critical';
      } else if (daysUntilStockout <= 30) {
        urgency = 'warning';
      } else {
        urgency = 'info';
      }

      // Quantità da ordinare: reorderQuantity oppure 30 giorni di consumo
      const reorderQty = material.reorderQuantity || Math.ceil(avgDailyConsumption * 30);

      const dateKey = reorderDate.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { reorderItems: [], produceItems: [], urgency });
      }
      const entry = dateMap.get(dateKey)!;
      entry.reorderItems.push({
        id: material.id,
        name: material.name,
        quantity: reorderQty,
        unit: material.unit
      });
      if (urgency === 'critical' || (urgency === 'warning' && entry.urgency === 'info')) {
        entry.urgency = urgency;
      }
    }

    // ========== PRODOTTI -> data produzione ==========
    for (const product of products) {
      const currentStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );

      // Vendite SPECIFICHE di questo prodotto nel periodo (da ordini reali)
      const totalSold = productSalesMap.get(product.id) || 0;
      const avgDailySales = totalSold / daysHistory;

      // Salta prodotti senza vendite
      if (avgDailySales <= 0) continue;

      // Salta se stock zero o negativo
      if (currentStock <= 0) continue;

      const daysUntilStockout = currentStock / avgDailySales;

      // Salta se esaurimento oltre 90 giorni
      if (!isFinite(daysUntilStockout) || daysUntilStockout > 90) continue;

      // Data esaurimento
      const stockoutDate = new Date(today);
      stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysUntilStockout));

      // Data inizio produzione (stockout - tempo produzione - buffer)
      const productionTime = 14;
      const buffer = 7;
      const productionStartDate = new Date(stockoutDate);
      productionStartDate.setDate(productionStartDate.getDate() - productionTime - buffer);

      // Se la data produzione è nel passato, usa oggi
      if (productionStartDate < today) {
        productionStartDate.setTime(today.getTime());
      }

      // Urgenza
      let urgency: 'critical' | 'warning' | 'info';
      if (daysUntilStockout <= productionTime) {
        urgency = 'critical';
      } else if (daysUntilStockout <= 45) {
        urgency = 'warning';
      } else {
        urgency = 'info';
      }

      // Quantità da produrre: 30 giorni di vendite
      const produceQty = Math.ceil(avgDailySales * 30);

      const dateKey = productionStartDate.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { reorderItems: [], produceItems: [], urgency });
      }
      const entry = dateMap.get(dateKey)!;
      entry.produceItems.push({
        id: product.id,
        name: product.name,
        quantity: produceQty
      });
      if (urgency === 'critical' || (urgency === 'warning' && entry.urgency === 'info')) {
        entry.urgency = urgency;
      }
    }

    // Converti mappa in array e ordina per data
    const timeline: Array<{
      date: string;
      label: string;
      urgency: 'critical' | 'warning' | 'info';
      actions: Array<{
        type: 'REORDER' | 'PRODUCE';
        items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
      }>;
    }> = [];

    const sortedDates = Array.from(dateMap.keys()).sort();

    for (const dateKey of sortedDates) {
      const entry = dateMap.get(dateKey)!;
      const actions: Array<{
        type: 'REORDER' | 'PRODUCE';
        items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
      }> = [];

      if (entry.reorderItems.length > 0) {
        actions.push({ type: 'REORDER', items: entry.reorderItems });
      }
      if (entry.produceItems.length > 0) {
        actions.push({ type: 'PRODUCE', items: entry.produceItems });
      }

      if (actions.length > 0) {
        const date = new Date(dateKey);
        timeline.push({
          date: dateKey,
          label: formatLabel(date),
          urgency: entry.urgency,
          actions
        });
      }
    }

    return timeline;
  }
}

export const inventoryService = new InventoryService();
