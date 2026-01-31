import { prisma } from '../config/database';

type CustomerType = 'B2C' | 'B2B';

/**
 * Customer Repository
 * Data access layer per clienti
 */
class CustomerRepository {
  /**
   * Trova cliente per ID
   */
  async findById(id: string) {
    return await prisma.customer.findUnique({
      where: { id },
    });
  }

  /**
   * Trova cliente per codice
   */
  async findByCode(code: string) {
    return await prisma.customer.findUnique({
      where: { code },
    });
  }

  /**
   * Trova cliente per email
   */
  async findByEmail(email: string) {
    return await prisma.customer.findFirst({
      where: { email },
    });
  }

  /**
   * Lista clienti con filtri
   */
  async findMany(options: {
    skip?: number;
    take?: number;
    type?: CustomerType;
    isActive?: boolean;
    search?: string;
    orderBy?: any;
  }) {
    const { skip, take, type, isActive, search, orderBy } = options;

    return await prisma.customer.findMany({
      where: {
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { businessName: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  /**
   * Conta clienti
   */
  async count(options: {
    type?: CustomerType;
    isActive?: boolean;
    search?: string;
  }) {
    const { type, isActive, search } = options;

    return await prisma.customer.count({
      where: {
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { businessName: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
    });
  }

  /**
   * Crea cliente
   */
  async create(data: any) {
    return await prisma.customer.create({
      data,
    });
  }

  /**
   * Aggiorna cliente
   */
  async update(id: string, data: any) {
    return await prisma.customer.update({
      where: { id },
      data,
    });
  }

  /**
   * Elimina cliente (soft delete)
   */
  async delete(id: string) {
    return await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Clienti con ordini recenti
   */
  async findActive(daysThreshold = 90) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await prisma.customer.findMany({
      where: {
        isActive: true,
        orders: {
          some: {
            orderDate: { gte: thresholdDate },
          },
        },
      },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });
  }

  /**
   * Clienti inattivi
   */
  async findInactive(daysThreshold = 180) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await prisma.customer.findMany({
      where: {
        isActive: true,
        orders: {
          every: {
            orderDate: { lt: thresholdDate },
          },
        },
      },
      include: {
        orders: {
          orderBy: { orderDate: 'desc' },
          take: 1,
        },
      },
    });
  }
}

export const customerRepository = new CustomerRepository();
export default customerRepository;
