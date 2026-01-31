import { prisma } from '../config/database';

type InventoryLocation = 'WAREHOUSE_MAIN' | 'WAREHOUSE_WEB' | 'WAREHOUSE_B2B' | 'WAREHOUSE_EVENT' | 'WAREHOUSE_RETURNS' | 'IN_TRANSIT';

/**
 * Inventory Repository
 * Data access layer per inventario
 */
class InventoryRepository {
  /**
   * Trova inventory item per prodotto e location
   */
  async findByProductAndLocation(
    productId: string,
    location: InventoryLocation,
    variantId?: string
  ) {
    return await prisma.inventoryItem.findFirst({
      where: {
        productId,
        location: location as any,
        variantId: variantId || null,
      },
      include: {
        product: true,
        variant: true,
      },
    });
  }

  /**
   * Trova tutti gli inventory items per prodotto
   */
  async findByProduct(productId: string) {
    return await prisma.inventoryItem.findMany({
      where: { productId },
      include: {
        product: true,
      },
    });
  }

  /**
   * Trova inventory items per location
   */
  async findByLocation(location: InventoryLocation) {
    return await prisma.inventoryItem.findMany({
      where: { location: location as any },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Crea o aggiorna inventory item
   */
  async upsert(data: {
    productId: string;
    location: InventoryLocation;
    variantId?: string;
    quantity: number;
    lotNumber?: string;
    warehouseId?: string;
  }) {
    const { productId, location, variantId, quantity, lotNumber, warehouseId } = data;

    return await prisma.inventoryItem.upsert({
      where: {
        productId_variantId_location_lotNumber: {
          productId,
          variantId: variantId || null,
          location,
          lotNumber: lotNumber || null,
        },
      } as any,
      update: {
        quantity,
        updatedAt: new Date(),
      },
      create: {
        productId,
        variantId: variantId || null,
        location: location as any,
        quantity,
        lotNumber: lotNumber || null,
        reservedQuantity: 0,
        warehouseId: warehouseId || '',
      },
    });
  }

  /**
   * Aggiorna quantità
   */
  async updateQuantity(
    id: string,
    quantity: number,
    reservedQuantity?: number
  ) {
    return await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity,
        ...(reservedQuantity !== undefined && { reservedQuantity }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Crea movimento inventario
   */
  async createMovement(data: {
    productId: string;
    type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION' | 'RETURN';
    quantity: number;
    fromLocation?: InventoryLocation;
    toLocation?: InventoryLocation;
    reference?: string;
    notes?: string;
    performedBy?: string;
  }) {
    return await prisma.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: data.type as any,
        quantity: data.quantity,
        fromLocation: data.fromLocation as any,
        toLocation: data.toLocation as any,
        reference: data.reference,
        notes: data.notes,
        performedBy: data.performedBy,
      },
      include: {
        product: true,
      },
    });
  }

  /**
   * Storico movimenti per prodotto
   */
  async getMovementHistory(
    productId: string,
    options?: {
      limit?: number;
      type?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION' | 'RETURN';
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    return await prisma.inventoryMovement.findMany({
      where: {
        productId,
        ...(options?.type && { type: options.type }),
        ...(options?.dateFrom || options?.dateTo
          ? {
              createdAt: {
                ...(options.dateFrom && { gte: options.dateFrom }),
                ...(options.dateTo && { lte: options.dateTo }),
              },
            }
          : {}),
      },
      include: {
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
    });
  }

  /**
   * Prodotti con giacenza bassa
   */
  async getLowStockItems(threshold = 10) {
    return await prisma.inventoryItem.findMany({
      where: {
        quantity: { lte: threshold },
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: {
        quantity: 'asc',
      },
    });
  }

  /**
   * Totale giacenze per prodotto (cross-location)
   */
  async getTotalStock(productId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { productId },
    });

    return items.reduce(
      (acc: any, item: any) => ({
        totalQuantity: acc.totalQuantity + item.quantity,
        totalReserved: acc.totalReserved + item.reservedQuantity,
        totalAvailable: acc.totalAvailable + (item.quantity - item.reservedQuantity),
      }),
      { totalQuantity: 0, totalReserved: 0, totalAvailable: 0 }
    );
  }
}

export const inventoryRepository = new InventoryRepository();
export default inventoryRepository;
