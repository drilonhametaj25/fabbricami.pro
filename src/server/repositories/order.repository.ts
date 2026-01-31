import { prisma } from '../config/database';

type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type OrderType = 'WEB' | 'B2B' | 'MANUAL' | 'WORDPRESS';

/**
 * Order Repository
 * Data access layer per ordini
 */
class OrderRepository {
  /**
   * Trova ordine per ID
   */
  async findById(id: string) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        } as any,
        invoice: true,
      },
    });
  }

  /**
   * Trova ordine per numero
   */
  async findByOrderNumber(orderNumber: string) {
    return await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Lista ordini con filtri
   */
  async findMany(options: {
    skip?: number;
    take?: number;
    status?: OrderStatus;
    type?: OrderType;
    customerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    orderBy?: any;
  }) {
    const { skip, take, status, type, customerId, dateFrom, dateTo, orderBy } = options;

    return await prisma.order.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(type && { type: type as any }),
        ...(customerId && { customerId }),
        ...(dateFrom || dateTo
          ? {
              orderDate: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  /**
   * Conta ordini con filtri
   */
  async count(options: {
    status?: OrderStatus;
    type?: OrderType;
    customerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const { status, type, customerId, dateFrom, dateTo } = options;

    return await prisma.order.count({
      where: {
        ...(status && { status: status as any }),
        ...(type && { type: type as any }),
        ...(customerId && { customerId }),
        ...(dateFrom || dateTo
          ? {
              orderDate: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      },
    });
  }

  /**
   * Crea ordine
   */
  async create(data: any) {
    return await prisma.order.create({
      data,
      include: {
        customer: true,
      },
    });
  }

  /**
   * Aggiorna ordine
   */
  async update(id: string, data: any) {
    return await prisma.order.update({
      where: { id },
      data,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Elimina ordine (soft delete)
   */
  async delete(id: string) {
    return await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
      },
    });
  }

  /**
   * Aggiungi item a ordine
   */
  async addItem(orderId: string, data: any) {
    return await prisma.orderItem.create({
      data: {
        ...data,
        orderId,
      },
      include: {
        product: true,
      } as any,
    });
  }

  /**
   * Rimuovi item da ordine
   */
  async removeItem(itemId: string) {
    return await prisma.orderItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Aggiorna totali ordine
   */
  async updateTotals(
    id: string,
    totals: {
      subtotal: number;
      tax: number;
      total: number;
    }
  ) {
    return await prisma.order.update({
      where: { id },
      data: totals,
    });
  }

  /**
   * Ordini in scadenza (da confermare/processare)
   */
  async findPending(daysThreshold = 3) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await prisma.order.findMany({
      where: {
        status: { in: ['DRAFT', 'PENDING'] as any },
        createdAt: { lte: thresholdDate },
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Statistiche ordini per periodo
   */
  async getStats(dateFrom: Date, dateTo: Date) {
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: { not: 'CANCELLED' },
      },
      select: {
        total: true,
        status: true,
        source: true,
      },
    });

    return {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
      byStatus: orders.reduce((acc: any, o: any) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {}),
      byType: orders.reduce((acc: any, o: any) => {
        acc[o.source] = (acc[o.source] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

export const orderRepository = new OrderRepository();
export default orderRepository;
