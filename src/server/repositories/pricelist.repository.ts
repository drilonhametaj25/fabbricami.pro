import { prisma } from '../config/database';

/**
 * PriceList Repository
 * Data access layer per listini prezzi
 */
class PriceListRepository {
  /**
   * Trova listino per ID
   */
  async findById(id: string) {
    return await prisma.priceList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                price: true,
              },
            },
          },
        },
        categoryDiscounts: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });
  }

  /**
   * Trova listino per codice
   */
  async findByCode(code: string) {
    return await prisma.priceList.findUnique({
      where: { code },
    });
  }

  /**
   * Lista listini con filtri
   */
  async findMany(options: {
    skip?: number;
    take?: number;
    isActive?: boolean;
    search?: string;
    orderBy?: any;
  }) {
    const { skip, take, isActive, search, orderBy } = options;

    return await prisma.priceList.findMany({
      where: {
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        _count: {
          select: {
            items: true,
            customers: true,
            categoryDiscounts: true,
          },
        },
      },
      skip,
      take,
      orderBy: orderBy || { priority: 'desc' },
    });
  }

  /**
   * Conta listini
   */
  async count(options: { isActive?: boolean; search?: string }) {
    const { isActive, search } = options;

    return await prisma.priceList.count({
      where: {
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
    });
  }

  /**
   * Crea listino
   */
  async create(data: any) {
    return await prisma.priceList.create({
      data,
      include: {
        _count: {
          select: {
            items: true,
            customers: true,
          },
        },
      },
    });
  }

  /**
   * Aggiorna listino
   */
  async update(id: string, data: any) {
    return await prisma.priceList.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            items: true,
            customers: true,
          },
        },
      },
    });
  }

  /**
   * Elimina listino (soft delete)
   */
  async delete(id: string) {
    return await prisma.priceList.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Trova item listino per prodotto e quantita minima
   */
  async findPriceListItem(priceListId: string, productId: string, minQuantity: number = 1) {
    return await prisma.priceListItem.findUnique({
      where: {
        priceListId_productId_minQuantity: {
          priceListId,
          productId,
          minQuantity,
        },
      },
    });
  }

  /**
   * Crea o aggiorna item listino
   */
  async upsertPriceListItem(data: {
    priceListId: string;
    productId: string;
    discountPercent?: number;
    fixedPrice?: number;
    minQuantity?: number;
  }) {
    const { priceListId, productId, minQuantity = 1, ...rest } = data;

    return await prisma.priceListItem.upsert({
      where: {
        priceListId_productId_minQuantity: {
          priceListId,
          productId,
          minQuantity,
        },
      },
      update: rest,
      create: { priceListId, productId, minQuantity, ...rest },
    });
  }

  /**
   * Elimina item listino
   */
  async deletePriceListItem(priceListId: string, productId: string, minQuantity: number = 1) {
    return await prisma.priceListItem.delete({
      where: {
        priceListId_productId_minQuantity: {
          priceListId,
          productId,
          minQuantity,
        },
      },
    });
  }

  /**
   * Trova tutti gli items per un prodotto in un listino (per fasce di quantita)
   */
  async findPriceListItemsForProduct(priceListId: string, productId: string) {
    return await prisma.priceListItem.findMany({
      where: {
        priceListId,
        productId,
      },
      orderBy: {
        minQuantity: 'asc',
      },
    });
  }

  /**
   * Trova sconto categoria
   */
  async findCategoryDiscount(priceListId: string, categoryId: string) {
    return await prisma.categoryDiscount.findUnique({
      where: {
        priceListId_categoryId: {
          priceListId,
          categoryId,
        },
      },
    });
  }

  /**
   * Crea o aggiorna sconto categoria
   */
  async upsertCategoryDiscount(data: {
    priceListId: string;
    categoryId: string;
    discountPercent: number;
  }) {
    const { priceListId, categoryId, discountPercent } = data;

    return await prisma.categoryDiscount.upsert({
      where: {
        priceListId_categoryId: {
          priceListId,
          categoryId,
        },
      },
      update: { discountPercent },
      create: data,
    });
  }

  /**
   * Elimina sconto categoria
   */
  async deleteCategoryDiscount(priceListId: string, categoryId: string) {
    return await prisma.categoryDiscount.delete({
      where: {
        priceListId_categoryId: {
          priceListId,
          categoryId,
        },
      },
    });
  }

  /**
   * Assegna listino a cliente
   */
  async assignToCustomer(customerId: string, priceListId: string) {
    return await prisma.customer.update({
      where: { id: customerId },
      data: { priceListId },
    });
  }

  /**
   * Rimuovi listino da cliente
   */
  async removeFromCustomer(customerId: string) {
    return await prisma.customer.update({
      where: { id: customerId },
      data: { priceListId: null },
    });
  }

  /**
   * Lista clienti associati a listino
   */
  async findCustomersByPriceList(priceListId: string) {
    return await prisma.customer.findMany({
      where: { priceListId },
      select: {
        id: true,
        code: true,
        businessName: true,
        firstName: true,
        lastName: true,
        type: true,
        email: true,
      },
    });
  }

  /**
   * Bulk insert items listino
   */
  async bulkUpsertItems(priceListId: string, items: any[]) {
    const operations = items.map(item =>
      prisma.priceListItem.upsert({
        where: {
          priceListId_productId_minQuantity: {
            priceListId,
            productId: item.productId,
            minQuantity: item.minQuantity ?? 1,
          },
        },
        update: {
          discountPercent: item.discountPercent,
          fixedPrice: item.fixedPrice,
        },
        create: {
          priceListId,
          productId: item.productId,
          discountPercent: item.discountPercent,
          fixedPrice: item.fixedPrice,
          minQuantity: item.minQuantity ?? 1,
        },
      })
    );

    return await prisma.$transaction(operations);
  }
}

export const priceListRepository = new PriceListRepository();
export default priceListRepository;
