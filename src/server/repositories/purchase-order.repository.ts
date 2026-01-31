// Imports
import { prisma } from '../config/database';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

// Types/Interfaces
interface FindAllParams {
  skip?: number;
  take?: number;
  where?: Prisma.PurchaseOrderWhereInput;
  orderBy?: Prisma.PurchaseOrderOrderByWithRelationInput;
  include?: Prisma.PurchaseOrderInclude;
}

/**
 * Purchase Order Repository
 * Gestione accesso dati ordini d'acquisto fornitori
 */
class PurchaseOrderRepository {
  /**
   * Trova tutti gli ordini d'acquisto con filtri
   */
  async findAll(params: FindAllParams) {
    const { skip = 0, take = 20, where, orderBy, include } = params;

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        skip,
        take,
        where,
        orderBy,
        include: include || {
          supplier: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                },
              },
              material: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Trova ordine d'acquisto per ID
   */
  async findById(id: string, include?: Prisma.PurchaseOrderInclude) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: include || {
        supplier: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                barcode: true,
              },
            },
            material: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Trova ordine per numero
   */
  async findByOrderNumber(orderNumber: string) {
    return prisma.purchaseOrder.findUnique({
      where: { orderNumber },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            material: true,
          },
        },
      },
    });
  }

  /**
   * Crea nuovo ordine d'acquisto
   */
  async create(data: Prisma.PurchaseOrderCreateInput) {
    return prisma.purchaseOrder.create({
      data,
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            material: true,
          },
        },
      },
    });
  }

  /**
   * Crea ordine con items in transazione
   */
  async createWithItems(
    orderData: Omit<Prisma.PurchaseOrderCreateInput, 'items'>,
    items: Array<{
      productId: string | null;
      materialId: string | null;
      quantity: number;
      unitPrice: number;
      tax: number;
      total: number;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          ...orderData,
          items: {
            create: items,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
              material: true,
            },
          },
        },
      });

      return order;
    });
  }

  /**
   * Aggiorna ordine d'acquisto
   */
  async update(id: string, data: Prisma.PurchaseOrderUpdateInput) {
    return prisma.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            material: true,
          },
        },
      },
    });
  }

  /**
   * Aggiorna stato ordine
   */
  async updateStatus(id: string, status: PurchaseOrderStatus) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Registra ricezione parziale o totale
   */
  async receiveItems(
    orderId: string,
    itemsReceived: Array<{ itemId: string; receivedQuantity: number }>
  ) {
    return prisma.$transaction(async (tx) => {
      // Aggiorna quantità ricevute per ogni item
      for (const item of itemsReceived) {
        await tx.purchaseOrderItem.update({
          where: { id: item.itemId },
          data: {
            receivedQuantity: {
              increment: item.receivedQuantity,
            },
          },
        });
      }

      // Verifica se tutti gli items sono stati ricevuti completamente
      const order = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new Error('Purchase order not found');

      const allReceived = order.items.every(
        (item) => item.receivedQuantity >= item.quantity
      );
      const someReceived = order.items.some((item) => item.receivedQuantity > 0);

      let newStatus = order.status;
      if (allReceived) {
        newStatus = 'RECEIVED';
      } else if (someReceived) {
        newStatus = 'PARTIALLY_RECEIVED';
      }

      // Aggiorna stato ordine
      return tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          receivedDate: allReceived ? new Date() : null,
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
              material: true,
            },
          },
        },
      });
    });
  }

  /**
   * Cancella ordine
   */
  async cancel(id: string) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Ottieni statistiche ordini fornitore
   */
  async getSupplierOrderStats(supplierId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.PurchaseOrderWhereInput = {
      supplierId,
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const [totalOrders, totalSpent, _avgDeliveryTime] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.aggregate({
        where: { ...where, status: { in: ['RECEIVED', 'CONFIRMED'] } },
        _sum: { total: true },
      }),
      // Calcola tempo medio di consegna
      prisma.purchaseOrder.aggregate({
        where: {
          ...where,
          status: 'RECEIVED',
          receivedDate: { not: null },
        },
        _avg: {
          // Nota: questo è semplificato, dovrebbe calcolare la differenza tra expectedDate e receivedDate
        },
      }),
    ]);

    return {
      totalOrders,
      totalSpent: totalSpent._sum.total || 0,
    };
  }

  /**
   * Genera numero ordine progressivo
   */
  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO${year}`;

    const lastOrder = await prisma.purchaseOrder.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder) {
      const lastNumber = parseInt(lastOrder.orderNumber.replace(prefix, ''));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }
}

// Main logic & Exports
export default new PurchaseOrderRepository();
