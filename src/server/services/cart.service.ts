import { prisma } from '../config/database';
import { Prisma, ShoppingCart, CartItem } from '@prisma/client';
import logger from '../config/logger';

/**
 * Cart configuration
 */
const CART_EXPIRY_DAYS = 7;
const STOCK_RESERVATION_MINUTES = 15;

/**
 * Cart with items and related data
 */
export interface CartWithItems extends ShoppingCart {
  items: Array<CartItem & {
    product: {
      id: string;
      sku: string;
      name: string;
      price: Prisma.Decimal;
      mainImageUrl: string | null;
      weight: Prisma.Decimal | null;
      wcStockStatus: string;
    };
    variant?: {
      id: string;
      sku: string;
      name: string;
      priceDelta: Prisma.Decimal;
      mainImageUrl: string | null;
    } | null;
  }>;
  coupon?: {
    id: string;
    code: string;
    type: string;
    discountValue: Prisma.Decimal;
  } | null;
  shippingMethod?: {
    id: string;
    name: string;
    carrier: string;
    baseCost: Prisma.Decimal;
  } | null;
}

/**
 * Add to cart input
 */
export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

/**
 * Update cart item input
 */
export interface UpdateCartItemInput {
  quantity: number;
}

/**
 * Cart totals calculation result
 */
export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
  totalWeight: number;
}

/**
 * Shopping Cart Service
 * Gestisce carrello per e-commerce con stock reservation
 */
class CartService {
  /**
   * Ottiene o crea un carrello per sessione o cliente
   */
  async getOrCreateCart(sessionId?: string, customerId?: string): Promise<CartWithItems> {
    // Cerca carrello esistente
    let cart = await this.findCart(sessionId, customerId);

    if (cart) {
      // Aggiorna expiry
      cart = await prisma.shoppingCart.update({
        where: { id: cart.id },
        data: { expiresAt: this.getExpiryDate() },
        include: this.getCartInclude(),
      });
      return cart as CartWithItems;
    }

    // Crea nuovo carrello
    cart = await prisma.shoppingCart.create({
      data: {
        sessionId,
        customerId,
        expiresAt: this.getExpiryDate(),
      },
      include: this.getCartInclude(),
    });

    return cart as CartWithItems;
  }

  /**
   * Trova carrello per sessione o cliente
   */
  async findCart(sessionId?: string, customerId?: string): Promise<CartWithItems | null> {
    if (!sessionId && !customerId) return null;

    const where: Prisma.ShoppingCartWhereInput = {
      expiresAt: { gt: new Date() },
    };

    if (customerId) {
      where.customerId = customerId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    }

    const cart = await prisma.shoppingCart.findFirst({
      where,
      include: this.getCartInclude(),
    });

    return cart as CartWithItems | null;
  }

  /**
   * Ottiene carrello per ID
   */
  async getCartById(cartId: string): Promise<CartWithItems | null> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { id: cartId },
      include: this.getCartInclude(),
    });
    return cart as CartWithItems | null;
  }

  /**
   * Aggiunge prodotto al carrello
   */
  async addItem(
    cartId: string,
    input: AddToCartInput
  ): Promise<CartWithItems> {
    const { productId, variantId, quantity } = input;

    // Verifica disponibilità stock
    const stockAvailable = await this.checkStockAvailability(productId, variantId, quantity);
    if (!stockAvailable.available) {
      throw new Error(`Stock insufficiente. Disponibile: ${stockAvailable.quantity}`);
    }

    // Ottiene prezzo prodotto
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { price: true, webPrice: true },
    });

    if (!product) {
      throw new Error('Prodotto non trovato');
    }

    let unitPrice = product.webPrice || product.price;

    // Applica delta variante se presente
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { priceDelta: true, webPrice: true },
      });
      if (variant) {
        if (variant.webPrice) {
          unitPrice = variant.webPrice;
        } else {
          unitPrice = unitPrice.add(variant.priceDelta);
        }
      }
    }

    // Cerca item esistente nel carrello
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        variantId: variantId || null,
      },
    });

    if (existingItem) {
      // Aggiorna quantità esistente
      const newQuantity = existingItem.quantity + quantity;

      // Verifica stock per nuova quantità
      const stockCheck = await this.checkStockAvailability(productId, variantId, newQuantity);
      if (!stockCheck.available) {
        throw new Error(`Stock insufficiente per quantità totale. Disponibile: ${stockCheck.quantity}`);
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          reservedUntil: this.getReservationExpiry(),
          reservedQty: newQuantity,
        },
      });
    } else {
      // Crea nuovo item
      await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          variantId,
          quantity,
          unitPrice,
          reservedUntil: this.getReservationExpiry(),
          reservedQty: quantity,
        },
      });
    }

    // Ricalcola totali
    return this.recalculateTotals(cartId);
  }

  /**
   * Aggiorna quantità item nel carrello
   */
  async updateItemQuantity(
    cartId: string,
    itemId: string,
    input: UpdateCartItemInput
  ): Promise<CartWithItems> {
    const { quantity } = input;

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });

    if (!item) {
      throw new Error('Item non trovato nel carrello');
    }

    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }

    // Verifica stock
    const stockCheck = await this.checkStockAvailability(item.productId, item.variantId, quantity);
    if (!stockCheck.available) {
      throw new Error(`Stock insufficiente. Disponibile: ${stockCheck.quantity}`);
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        reservedUntil: this.getReservationExpiry(),
        reservedQty: quantity,
      },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Rimuove item dal carrello
   */
  async removeItem(cartId: string, itemId: string): Promise<CartWithItems> {
    await prisma.cartItem.deleteMany({
      where: { id: itemId, cartId },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Svuota il carrello
   */
  async clearCart(cartId: string): Promise<CartWithItems> {
    await prisma.cartItem.deleteMany({
      where: { cartId },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Applica coupon al carrello
   */
  async applyCoupon(cartId: string, couponCode: string): Promise<CartWithItems> {
    // Trova coupon valido
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validTo: { gte: new Date() },
        OR: [
          { maxUses: null },
          { usageCount: { lt: prisma.coupon.fields.maxUses } },
        ],
      },
    });

    if (!coupon) {
      throw new Error('Coupon non valido o scaduto');
    }

    // Verifica importo minimo
    const cart = await this.getCartById(cartId);
    if (coupon.minimumOrderAmount && cart && Number(cart.subtotal) < Number(coupon.minimumOrderAmount)) {
      throw new Error(`Ordine minimo per questo coupon: €${coupon.minimumOrderAmount}`);
    }

    await prisma.shoppingCart.update({
      where: { id: cartId },
      data: { couponId: coupon.id },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Rimuove coupon dal carrello
   */
  async removeCoupon(cartId: string): Promise<CartWithItems> {
    await prisma.shoppingCart.update({
      where: { id: cartId },
      data: { couponId: null, discount: 0 },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Imposta metodo di spedizione
   */
  async setShippingMethod(cartId: string, methodId: string): Promise<CartWithItems> {
    const method = await prisma.shopShippingMethod.findUnique({
      where: { id: methodId, isActive: true },
    });

    if (!method) {
      throw new Error('Metodo di spedizione non disponibile');
    }

    await prisma.shoppingCart.update({
      where: { id: cartId },
      data: { shippingMethodId: methodId },
    });

    return this.recalculateTotals(cartId);
  }

  /**
   * Imposta indirizzo di spedizione
   */
  async setShippingAddress(cartId: string, address: Record<string, unknown>): Promise<CartWithItems> {
    const cart = await prisma.shoppingCart.update({
      where: { id: cartId },
      data: { shippingAddress: address as object },
      include: this.getCartInclude(),
    });

    return cart as CartWithItems;
  }

  /**
   * Trasferisce carrello da guest a cliente autenticato
   */
  async mergeGuestCart(sessionId: string, customerId: string): Promise<CartWithItems | null> {
    // Cerca carrello guest
    const guestCart = await this.findCart(sessionId);
    if (!guestCart || guestCart.items.length === 0) {
      // Nessun carrello guest, restituisce quello del cliente se esiste
      return this.findCart(undefined, customerId);
    }

    // Cerca carrello cliente esistente
    const customerCart = await this.findCart(undefined, customerId);

    if (customerCart) {
      // Merge items dal carrello guest
      for (const guestItem of guestCart.items) {
        const existingItem = customerCart.items.find(
          i => i.productId === guestItem.productId && i.variantId === guestItem.variantId
        );

        if (existingItem) {
          // Somma quantità
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + guestItem.quantity },
          });
        } else {
          // Sposta item al carrello cliente
          await prisma.cartItem.update({
            where: { id: guestItem.id },
            data: { cartId: customerCart.id },
          });
        }
      }

      // Elimina carrello guest
      await prisma.shoppingCart.delete({ where: { id: guestCart.id } });

      return this.recalculateTotals(customerCart.id);
    } else {
      // Assegna carrello guest al cliente
      const cart = await prisma.shoppingCart.update({
        where: { id: guestCart.id },
        data: {
          customerId,
          sessionId: null,
        },
        include: this.getCartInclude(),
      });

      return cart as CartWithItems;
    }
  }

  /**
   * Verifica disponibilità stock
   */
  async checkStockAvailability(
    productId: string,
    variantId?: string | null,
    quantity: number = 1
  ): Promise<{ available: boolean; quantity: number }> {
    // Calcola stock disponibile sommando tutti i location WEB
    const inventory = await prisma.inventoryItem.aggregate({
      where: {
        productId,
        variantId: variantId || null,
        location: 'WEB',
      },
      _sum: { quantity: true },
    });

    const availableStock = inventory._sum.quantity || 0;

    // Sottrai prenotazioni attive da altri carrelli
    const reservedItems = await prisma.cartItem.aggregate({
      where: {
        productId,
        variantId: variantId || null,
        reservedUntil: { gt: new Date() },
      },
      _sum: { reservedQty: true },
    });

    const reserved = reservedItems._sum.reservedQty || 0;
    const effectiveStock = availableStock - reserved;

    return {
      available: effectiveStock >= quantity,
      quantity: Math.max(0, effectiveStock),
    };
  }

  /**
   * Ricalcola totali carrello
   */
  async recalculateTotals(cartId: string): Promise<CartWithItems> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                price: true,
                webPrice: true,
                weight: true,
                taxRate: true,
              },
            },
            variant: {
              select: {
                priceDelta: true,
                webPrice: true,
                weight: true,
              },
            },
          },
        },
        coupon: true,
        shippingMethod: true,
      },
    });

    if (!cart) {
      throw new Error('Carrello non trovato');
    }

    // Calcola subtotale
    let subtotal = 0;
    let totalWeight = 0;

    for (const item of cart.items) {
      const basePrice = Number(item.product.webPrice || item.product.price);
      let itemPrice = basePrice;

      if (item.variant) {
        if (item.variant.webPrice) {
          itemPrice = Number(item.variant.webPrice);
        } else {
          itemPrice = basePrice + Number(item.variant.priceDelta);
        }
      }

      subtotal += itemPrice * item.quantity;

      // Peso
      const itemWeight = item.variant?.weight || item.product.weight;
      if (itemWeight) {
        totalWeight += Number(itemWeight) * item.quantity;
      }
    }

    // Calcola sconto coupon
    let discount = 0;
    if (cart.coupon) {
      if (cart.coupon.type === 'FIXED') {
        discount = Math.min(Number(cart.coupon.discountValue), subtotal);
      } else if (cart.coupon.type === 'PERCENTAGE') {
        discount = subtotal * (Number(cart.coupon.discountValue) / 100);
        // Applica cap se presente
        if (cart.coupon.maximumDiscount) {
          discount = Math.min(discount, Number(cart.coupon.maximumDiscount));
        }
      }
    }

    // Calcola spedizione
    let shipping = 0;
    if (cart.shippingMethod) {
      shipping = Number(cart.shippingMethod.baseCost);

      // Aggiungi costo per kg se applicabile
      if (cart.shippingMethod.costPerKg && totalWeight > 0) {
        shipping += Number(cart.shippingMethod.costPerKg) * totalWeight;
      }

      // Verifica spedizione gratuita
      if (cart.shippingMethod.freeAboveAmount) {
        const subtotalAfterDiscount = subtotal - discount;
        if (subtotalAfterDiscount >= Number(cart.shippingMethod.freeAboveAmount)) {
          shipping = 0;
        }
      }

      // Spedizione gratuita con coupon FREE_SHIPPING
      if (cart.coupon?.type === 'FREE_SHIPPING') {
        shipping = 0;
      }
    }

    // Calcola IVA (22% default)
    const taxRate = 0.22;
    const taxableAmount = subtotal - discount + shipping;
    const tax = taxableAmount * taxRate / (1 + taxRate); // IVA inclusa

    // Totale finale
    const total = subtotal - discount + shipping;

    // Aggiorna carrello
    const updatedCart = await prisma.shoppingCart.update({
      where: { id: cartId },
      data: {
        subtotal,
        discount,
        shipping,
        tax,
        total,
      },
      include: this.getCartInclude(),
    });

    return updatedCart as CartWithItems;
  }

  /**
   * Elimina carrelli scaduti
   */
  async cleanupExpiredCarts(): Promise<number> {
    const result = await prisma.shoppingCart.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    logger.info(`Eliminati ${result.count} carrelli scaduti`);
    return result.count;
  }

  /**
   * Rilascia prenotazioni stock scadute
   */
  async releaseExpiredReservations(): Promise<number> {
    const result = await prisma.cartItem.updateMany({
      where: {
        reservedUntil: { lt: new Date() },
        reservedQty: { gt: 0 },
      },
      data: {
        reservedUntil: null,
        reservedQty: null,
      },
    });

    logger.info(`Rilasciate ${result.count} prenotazioni stock scadute`);
    return result.count;
  }

  /**
   * Calcola data scadenza carrello
   */
  private getExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + CART_EXPIRY_DAYS);
    return date;
  }

  /**
   * Calcola data scadenza prenotazione stock
   */
  private getReservationExpiry(): Date {
    const date = new Date();
    date.setMinutes(date.getMinutes() + STOCK_RESERVATION_MINUTES);
    return date;
  }

  /**
   * Include standard per query carrello
   */
  private getCartInclude() {
    return {
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              price: true,
              mainImageUrl: true,
              weight: true,
              wcStockStatus: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              priceDelta: true,
              mainImageUrl: true,
            },
          },
        },
        orderBy: { addedAt: 'asc' as const },
      },
      coupon: {
        select: {
          id: true,
          code: true,
          type: true,
          discountValue: true,
        },
      },
      shippingMethod: {
        select: {
          id: true,
          name: true,
          carrier: true,
          baseCost: true,
        },
      },
    };
  }
}

export default new CartService();
