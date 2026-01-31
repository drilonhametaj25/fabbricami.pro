import { prisma } from '../config/database';
import { priceListRepository } from '../repositories/pricelist.repository';
import {
  CreatePriceListInput,
  UpdatePriceListInput,
  CreatePriceListItemInput,
  CreateCategoryDiscountInput,
  BulkPriceImportInput,
} from '../schemas/pricelist.schema';

/**
 * PriceList Service
 * Business logic per gestione listini prezzi B2B
 */
class PriceListService {
  /**
   * Lista listini con filtri e paginazione
   */
  async listPriceLists(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      search,
      isActive,
      sortBy = 'priority',
      sortOrder = 'desc',
    } = params;

    const [items, total] = await Promise.all([
      priceListRepository.findMany({
        skip: (page - 1) * limit,
        take: limit,
        isActive,
        search,
        orderBy: { [sortBy]: sortOrder },
      }),
      priceListRepository.count({ isActive, search }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio listino
   */
  async getPriceListById(id: string) {
    return await priceListRepository.findById(id);
  }

  /**
   * Crea nuovo listino
   */
  async createPriceList(data: CreatePriceListInput) {
    // Verifica codice univoco
    const existing = await priceListRepository.findByCode(data.code);
    if (existing) {
      throw new Error('Price list code already exists');
    }

    return await priceListRepository.create({
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
    });
  }

  /**
   * Aggiorna listino
   */
  async updatePriceList(id: string, data: UpdatePriceListInput) {
    const priceList = await priceListRepository.findById(id);
    if (!priceList) {
      throw new Error('Price list not found');
    }

    // Verifica codice univoco se cambiato
    if (data.code && data.code !== priceList.code) {
      const existing = await priceListRepository.findByCode(data.code);
      if (existing) {
        throw new Error('Price list code already exists');
      }
    }

    return await priceListRepository.update(id, {
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
    });
  }

  /**
   * Elimina listino (soft delete)
   */
  async deletePriceList(id: string) {
    const priceList = await priceListRepository.findById(id);
    if (!priceList) {
      throw new Error('Price list not found');
    }

    return await priceListRepository.delete(id);
  }

  /**
   * Aggiungi/aggiorna prezzo prodotto nel listino
   */
  async setPriceListItem(data: CreatePriceListItemInput) {
    return await priceListRepository.upsertPriceListItem(data);
  }

  /**
   * Rimuovi prezzo prodotto dal listino
   */
  async removePriceListItem(priceListId: string, productId: string, minQuantity: number = 1) {
    return await priceListRepository.deletePriceListItem(priceListId, productId, minQuantity);
  }

  /**
   * Aggiungi/aggiorna sconto categoria
   */
  async setCategoryDiscount(data: CreateCategoryDiscountInput) {
    return await priceListRepository.upsertCategoryDiscount(data);
  }

  /**
   * Rimuovi sconto categoria
   */
  async removeCategoryDiscount(priceListId: string, categoryId: string) {
    return await priceListRepository.deleteCategoryDiscount(priceListId, categoryId);
  }

  /**
   * Assegna listino a cliente B2B
   */
  async assignToCustomer(customerId: string, priceListId: string) {
    // Verifica cliente B2B
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new Error('Customer not found');
    }
    if (customer.type !== 'B2B') {
      throw new Error('Price lists can only be assigned to B2B customers');
    }

    // Verifica listino esiste
    const priceList = await priceListRepository.findById(priceListId);
    if (!priceList) {
      throw new Error('Price list not found');
    }

    return await priceListRepository.assignToCustomer(customerId, priceListId);
  }

  /**
   * Rimuovi listino da cliente
   */
  async removeFromCustomer(customerId: string) {
    return await priceListRepository.removeFromCustomer(customerId);
  }

  /**
   * Calcola prezzo per cliente e prodotto
   * Priorita':
   * 1. Prezzo fisso specifico prodotto nel listino (con fascia quantita)
   * 2. Sconto percentuale specifico prodotto nel listino (con fascia quantita)
   * 3. Sconto categoria nel listino
   * 4. Sconto globale del listino
   * 5. Sconto cliente
   * 6. Prezzo base prodotto
   */
  async calculatePrice(
    customerId: string,
    productId: string,
    quantity: number = 1,
    priceListIdOverride?: string // Optional override for the price list
  ): Promise<{
    basePrice: number;
    finalPrice: number;
    discount: number;
    discountType: string;
    discountSource: string;
    priceListName?: string;
  }> {
    // Ottieni prodotto con categoria
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
    if (!product) {
      throw new Error('Product not found');
    }

    const basePrice = Number(product.price);
    const primaryCategory = product.categories.find(c => c.isPrimary)?.category;

    // Ottieni cliente
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        priceList: priceListIdOverride ? undefined : {
          where: {
            isActive: true,
          },
          include: {
            items: {
              where: { productId },
              orderBy: { minQuantity: 'desc' },
            },
            categoryDiscounts: primaryCategory ? {
              where: { categoryId: primaryCategory.id },
            } : undefined,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Se è specificato un listino override, caricalo
    let priceList: any = null;
    if (priceListIdOverride) {
      priceList = await prisma.priceList.findUnique({
        where: { id: priceListIdOverride },
        include: {
          items: {
            where: { productId },
            orderBy: { minQuantity: 'desc' },
          },
          categoryDiscounts: primaryCategory ? {
            where: { categoryId: primaryCategory.id },
          } : undefined,
        },
      });
    } else {
      priceList = customer.priceList;
    }

    // Se non ha listino, usa sconto cliente o prezzo base
    if (!priceList) {
      const customerDiscount = Number(customer.discount || 0);
      const finalPrice = basePrice * (1 - customerDiscount / 100);

      return {
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: customerDiscount,
        discountType: customerDiscount > 0 ? 'PERCENTAGE' : 'NONE',
        discountSource: customerDiscount > 0 ? 'customer' : 'none',
      };
    }

    // Verifica validita' temporale
    const now = new Date();
    if (priceList.validFrom && priceList.validFrom > now) {
      return this.applyCustomerDiscount(basePrice, customer);
    }
    if (priceList.validTo && priceList.validTo < now) {
      return this.applyCustomerDiscount(basePrice, customer);
    }

    // 1. Prezzo specifico prodotto (trova la fascia corretta per quantita')
    const applicableItem = priceList.items.find((item: any) => quantity >= item.minQuantity);

    if (applicableItem) {
      // Prezzo fisso
      if (applicableItem.fixedPrice !== null) {
        return {
          basePrice,
          finalPrice: Number(applicableItem.fixedPrice),
          discount: ((basePrice - Number(applicableItem.fixedPrice)) / basePrice) * 100,
          discountType: 'FIXED',
          discountSource: 'product',
          priceListName: priceList.name,
        };
      }

      // Sconto percentuale prodotto
      if (applicableItem.discountPercent !== null && Number(applicableItem.discountPercent) > 0) {
        const finalPrice = basePrice * (1 - Number(applicableItem.discountPercent) / 100);
        return {
          basePrice,
          finalPrice: Math.round(finalPrice * 100) / 100,
          discount: Number(applicableItem.discountPercent),
          discountType: 'PERCENTAGE',
          discountSource: 'product',
          priceListName: priceList.name,
        };
      }
    }

    // 2. Sconto categoria
    const categoryDiscount = priceList.categoryDiscounts?.[0];
    if (categoryDiscount && Number(categoryDiscount.discountPercent) > 0) {
      const finalPrice = basePrice * (1 - Number(categoryDiscount.discountPercent) / 100);
      return {
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: Number(categoryDiscount.discountPercent),
        discountType: 'PERCENTAGE',
        discountSource: 'category',
        priceListName: priceList.name,
      };
    }

    // 3. Sconto globale listino
    if (priceList.globalDiscount && Number(priceList.globalDiscount) > 0) {
      const finalPrice = basePrice * (1 - Number(priceList.globalDiscount) / 100);
      return {
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: Number(priceList.globalDiscount),
        discountType: 'PERCENTAGE',
        discountSource: 'pricelist_global',
        priceListName: priceList.name,
      };
    }

    // 4. Fallback a sconto cliente
    return this.applyCustomerDiscount(basePrice, customer);
  }

  /**
   * Calcola prezzi per ordine completo
   */
  async calculateOrderPrices(
    customerId: string,
    items: Array<{ productId: string; quantity: number }>
  ) {
    const results = await Promise.all(
      items.map(async (item) => {
        const priceInfo = await this.calculatePrice(
          customerId,
          item.productId,
          item.quantity
        );
        return {
          productId: item.productId,
          quantity: item.quantity,
          ...priceInfo,
          lineTotal: priceInfo.finalPrice * item.quantity,
        };
      })
    );

    const subtotal = results.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalDiscount = results.reduce(
      (sum, item) => sum + (item.basePrice - item.finalPrice) * item.quantity,
      0
    );

    return {
      items: results,
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
    };
  }

  /**
   * Import bulk prezzi da file
   */
  async bulkImportPrices(data: BulkPriceImportInput) {
    const { priceListId, items } = data;

    // Verifica listino esiste
    const priceList = await priceListRepository.findById(priceListId);
    if (!priceList) {
      throw new Error('Price list not found');
    }

    // Risolvi productSku in productId se necessario
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          return item;
        }
        if (item.productSku) {
          const product = await prisma.product.findUnique({
            where: { sku: item.productSku },
          });
          if (product) {
            return { ...item, productId: product.id };
          }
        }
        return null;
      })
    );

    const validItems = resolvedItems.filter(
      (item): item is NonNullable<typeof item> & { productId: string } =>
        item !== null && item.productId !== undefined
    );

    if (validItems.length === 0) {
      throw new Error('No valid items to import');
    }

    const result = await priceListRepository.bulkUpsertItems(priceListId, validItems);

    return {
      imported: result.length,
      skipped: items.length - validItems.length,
    };
  }

  /**
   * Lista clienti associati a listino
   */
  async getCustomersByPriceList(priceListId: string) {
    return await priceListRepository.findCustomersByPriceList(priceListId);
  }

  /**
   * Statistiche listini
   */
  async getStats() {
    const [totalLists, activeLists, assignedCustomers, pricedProducts] = await Promise.all([
      prisma.priceList.count(),
      prisma.priceList.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { priceListId: { not: null } } }),
      prisma.priceListItem.count(),
    ]);

    return {
      totalLists,
      activeLists,
      assignedCustomers,
      pricedProducts,
    };
  }

  /**
   * Helper: applica sconto cliente
   */
  private applyCustomerDiscount(basePrice: number, customer: any) {
    const customerDiscount = Number(customer.discount || 0);
    const finalPrice = basePrice * (1 - customerDiscount / 100);

    return {
      basePrice,
      finalPrice: Math.round(finalPrice * 100) / 100,
      discount: customerDiscount,
      discountType: customerDiscount > 0 ? 'PERCENTAGE' : 'NONE',
      discountSource: customerDiscount > 0 ? 'customer' : 'none',
    };
  }
}

export const priceListService = new PriceListService();
export default priceListService;
