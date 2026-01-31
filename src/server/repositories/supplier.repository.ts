// Imports
import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

// Types/Interfaces
interface FindAllParams {
  skip?: number;
  take?: number;
  where?: Prisma.SupplierWhereInput;
  orderBy?: Prisma.SupplierOrderByWithRelationInput;
  include?: Prisma.SupplierInclude;
}

/**
 * Supplier Repository
 * Gestione accesso dati fornitori
 */
class SupplierRepository {
  /**
   * Trova tutti i fornitori con opzioni di filtro, ordinamento e paginazione
   */
  async findAll(params: FindAllParams) {
    const { skip = 0, take = 20, where, orderBy, include } = params;

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        skip,
        take,
        where,
        orderBy,
        include: include || {
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
              invoices: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Trova fornitore per ID
   */
  async findById(id: string, include?: Prisma.SupplierInclude) {
    return prisma.supplier.findUnique({
      where: { id },
      include: include || {
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
            invoices: true,
          },
        },
      },
    });
  }

  /**
   * Trova fornitore per codice
   */
  async findByCode(code: string) {
    return prisma.supplier.findUnique({
      where: { code },
    });
  }

  /**
   * Crea nuovo fornitore
   */
  async create(data: Prisma.SupplierCreateInput) {
    return prisma.supplier.create({
      data,
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Aggiorna fornitore
   */
  async update(id: string, data: Prisma.SupplierUpdateInput) {
    return prisma.supplier.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Elimina fornitore (soft delete - disattiva)
   */
  async delete(id: string) {
    return prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Ottieni statistiche fornitore
   */
  async getSupplierStats(id: string) {
    const [totalOrders, totalSpent, activeProducts] = await Promise.all([
      prisma.purchaseOrder.count({
        where: { supplierId: id },
      }),
      prisma.purchaseOrder.aggregate({
        where: {
          supplierId: id,
          status: { in: ['CONFIRMED', 'RECEIVED'] },
        },
        _sum: { total: true },
      }),
      prisma.product.count({
        where: { supplierId: id, isActive: true },
      }),
    ]);

    return {
      totalOrders,
      totalSpent: totalSpent._sum.total || 0,
      activeProducts,
    };
  }
}

// Main logic & Exports
export default new SupplierRepository();
