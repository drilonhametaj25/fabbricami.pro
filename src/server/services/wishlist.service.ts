import { prisma } from '../config/database';
import { Prisma, WishlistItem } from '@prisma/client';
import logger from '../config/logger';

/**
 * Wishlist item with product details
 */
export interface WishlistItemWithProduct extends WishlistItem {
  product: {
    id: string;
    sku: string;
    name: string;
    price: Prisma.Decimal;
    webPrice: Prisma.Decimal | null;
    mainImageUrl: string | null;
    wcStockStatus: string;
    wcOnSale: boolean;
    wcSalePrice: Prisma.Decimal | null;
  };
  variant?: {
    id: string;
    sku: string;
    name: string;
    priceDelta: Prisma.Decimal;
    webPrice: Prisma.Decimal | null;
    mainImageUrl: string | null;
    wcStockStatus: string;
  } | null;
}

/**
 * Add to wishlist input
 */
export interface AddToWishlistInput {
  productId: string;
  variantId?: string;
  notifyRestock?: boolean;
}

/**
 * Wishlist Service
 * Gestisce wishlist utenti per e-commerce
 */
class WishlistService {
  /**
   * Ottiene wishlist cliente
   */
  async getCustomerWishlist(customerId: string): Promise<WishlistItemWithProduct[]> {
    const items = await prisma.wishlistItem.findMany({
      where: { customerId },
      include: this.getWishlistInclude(),
      orderBy: { addedAt: 'desc' },
    });

    return items as WishlistItemWithProduct[];
  }

  /**
   * Aggiunge prodotto alla wishlist
   */
  async addItem(customerId: string, input: AddToWishlistInput): Promise<WishlistItemWithProduct> {
    const { productId, variantId, notifyRestock = false } = input;

    // Verifica che il prodotto esista
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new Error('Prodotto non trovato o non disponibile');
    }

    // Verifica che la variante esista se specificata
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId, productId },
        select: { id: true, isActive: true },
      });

      if (!variant || !variant.isActive) {
        throw new Error('Variante non trovata o non disponibile');
      }
    }

    // Crea o aggiorna item
    const item = await prisma.wishlistItem.upsert({
      where: {
        customerId_productId_variantId: {
          customerId,
          productId,
          variantId: variantId || '',
        },
      },
      create: {
        customerId,
        productId,
        variantId,
        notifyRestock,
      },
      update: {
        notifyRestock,
        addedAt: new Date(),
      },
      include: this.getWishlistInclude(),
    });

    return item as WishlistItemWithProduct;
  }

  /**
   * Rimuove prodotto dalla wishlist
   */
  async removeItem(customerId: string, productId: string, variantId?: string): Promise<void> {
    await prisma.wishlistItem.deleteMany({
      where: {
        customerId,
        productId,
        variantId: variantId || null,
      },
    });
  }

  /**
   * Rimuove item per ID
   */
  async removeItemById(customerId: string, itemId: string): Promise<void> {
    await prisma.wishlistItem.deleteMany({
      where: {
        id: itemId,
        customerId,
      },
    });
  }

  /**
   * Svuota wishlist
   */
  async clearWishlist(customerId: string): Promise<void> {
    await prisma.wishlistItem.deleteMany({
      where: { customerId },
    });

    logger.info(`Wishlist svuotata per cliente ${customerId}`);
  }

  /**
   * Verifica se prodotto è nella wishlist
   */
  async isInWishlist(
    customerId: string,
    productId: string,
    variantId?: string
  ): Promise<boolean> {
    const item = await prisma.wishlistItem.findFirst({
      where: {
        customerId,
        productId,
        variantId: variantId || null,
      },
    });

    return !!item;
  }

  /**
   * Toggle prodotto in wishlist
   */
  async toggleItem(
    customerId: string,
    productId: string,
    variantId?: string
  ): Promise<{ added: boolean }> {
    const exists = await this.isInWishlist(customerId, productId, variantId);

    if (exists) {
      await this.removeItem(customerId, productId, variantId);
      return { added: false };
    } else {
      await this.addItem(customerId, { productId, variantId });
      return { added: true };
    }
  }

  /**
   * Imposta notifica restock
   */
  async setRestockNotification(
    customerId: string,
    itemId: string,
    notify: boolean
  ): Promise<WishlistItemWithProduct> {
    const item = await prisma.wishlistItem.update({
      where: {
        id: itemId,
        customerId,
      },
      data: { notifyRestock: notify },
      include: this.getWishlistInclude(),
    });

    return item as WishlistItemWithProduct;
  }

  /**
   * Conta items nella wishlist
   */
  async getCount(customerId: string): Promise<number> {
    return prisma.wishlistItem.count({
      where: { customerId },
    });
  }

  /**
   * Sposta tutti gli items dalla wishlist al carrello
   */
  async moveAllToCart(customerId: string, cartId: string): Promise<{
    moved: number;
    outOfStock: string[];
  }> {
    const items = await this.getCustomerWishlist(customerId);

    let moved = 0;
    const outOfStock: string[] = [];

    for (const item of items) {
      // Verifica stock
      const inStock = item.product.wcStockStatus === 'instock';

      if (inStock) {
        try {
          // Aggiungi al carrello (importa cart service dinamicamente per evitare dipendenze circolari)
          const cartService = (await import('./cart.service')).default;
          await cartService.addItem(cartId, {
            productId: item.productId,
            variantId: item.variantId || undefined,
            quantity: 1,
          });

          // Rimuovi dalla wishlist
          await this.removeItemById(customerId, item.id);
          moved++;
        } catch (error) {
          logger.warn(`Impossibile spostare ${item.product.sku} al carrello: ${error}`);
          outOfStock.push(item.product.name);
        }
      } else {
        outOfStock.push(item.product.name);
      }
    }

    return { moved, outOfStock };
  }

  /**
   * Ottiene clienti da notificare per restock
   */
  async getCustomersToNotify(productId: string, variantId?: string): Promise<string[]> {
    const items = await prisma.wishlistItem.findMany({
      where: {
        productId,
        variantId: variantId || null,
        notifyRestock: true,
      },
      select: { customerId: true },
    });

    return items.map(i => i.customerId);
  }

  /**
   * Notifica restock e rimuove flag notifica
   */
  async processRestockNotifications(
    productId: string,
    variantId?: string
  ): Promise<number> {
    const customerIds = await this.getCustomersToNotify(productId, variantId);

    if (customerIds.length === 0) {
      return 0;
    }

    // Qui si integrerebbe con il servizio email
    // Per ora loggiamo solo
    logger.info(
      `Notifica restock: ${customerIds.length} clienti per prodotto ${productId}`
    );

    // Rimuovi flag notifica
    await prisma.wishlistItem.updateMany({
      where: {
        productId,
        variantId: variantId || null,
        notifyRestock: true,
      },
      data: { notifyRestock: false },
    });

    return customerIds.length;
  }

  /**
   * Statistiche wishlist per prodotto
   */
  async getProductStats(productId: string): Promise<{
    totalWishlists: number;
    withNotifications: number;
  }> {
    const [totalWishlists, withNotifications] = await Promise.all([
      prisma.wishlistItem.count({
        where: { productId },
      }),
      prisma.wishlistItem.count({
        where: {
          productId,
          notifyRestock: true,
        },
      }),
    ]);

    return { totalWishlists, withNotifications };
  }

  /**
   * Prodotti più aggiunti alle wishlist
   */
  async getMostWanted(limit: number = 10): Promise<Array<{
    productId: string;
    productName: string;
    count: number;
  }>> {
    const results = await prisma.wishlistItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });

    const productIds = results.map(r => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map(p => [p.id, p.name]));

    return results.map(r => ({
      productId: r.productId,
      productName: productMap.get(r.productId) || 'Unknown',
      count: r._count.productId,
    }));
  }

  /**
   * Include standard per wishlist
   */
  private getWishlistInclude() {
    return {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          webPrice: true,
          mainImageUrl: true,
          wcStockStatus: true,
          wcOnSale: true,
          wcSalePrice: true,
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          priceDelta: true,
          webPrice: true,
          mainImageUrl: true,
          wcStockStatus: true,
        },
      },
    };
  }
}

export default new WishlistService();
