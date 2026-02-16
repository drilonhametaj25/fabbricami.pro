/**
 * @jest-environment node
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';

// Create prisma mock at module level
const prismaMock = mockDeep<PrismaClient>();

// Mock database config
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create Decimal mock
const createDecimalMock = (value: number | string): Prisma.Decimal => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => numVal.toString(),
    valueOf: () => numVal.toString(),
    toFixed: (dp?: number) => numVal.toFixed(dp),
    add: (other: any) => createDecimalMock(numVal + (other?.toNumber?.() || Number(other))),
    sub: (other: any) => createDecimalMock(numVal - (other?.toNumber?.() || Number(other))),
    mul: (other: any) => createDecimalMock(numVal * (other?.toNumber?.() || Number(other))),
    div: (other: any) => createDecimalMock(numVal / (other?.toNumber?.() || Number(other))),
    equals: (other: any) => numVal === (other?.toNumber?.() || Number(other)),
    lessThan: (other: any) => numVal < (other?.toNumber?.() || Number(other)),
    greaterThan: (other: any) => numVal > (other?.toNumber?.() || Number(other)),
    comparedTo: (other: any) => {
      const otherVal = other?.toNumber?.() || Number(other);
      return numVal < otherVal ? -1 : numVal > otherVal ? 1 : 0;
    },
    isPositive: () => numVal > 0,
    isNegative: () => numVal < 0,
    isZero: () => numVal === 0,
  } as unknown as Prisma.Decimal;
};

// Import service after mocks
import cartService from '@server/services/cart.service';

describe('CartService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('getOrCreateCart', () => {
    it('should return existing cart and update expiry', async () => {
      const existingCart = {
        id: 'cart-1',
        sessionId: 'session-123',
        customerId: null,
        items: [],
        coupon: null,
        shippingMethod: null,
        expiresAt: new Date(),
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(existingCart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue({
        ...existingCart,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await cartService.getOrCreateCart('session-123');

      expect(result.id).toBe('cart-1');
      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );
    });

    it('should create new cart when none exists', async () => {
      const newCart = {
        id: 'cart-new',
        sessionId: 'session-new',
        customerId: null,
        items: [],
        coupon: null,
        shippingMethod: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.shoppingCart.create as jest.Mock).mockResolvedValue(newCart);

      const result = await cartService.getOrCreateCart('session-new');

      expect(result.id).toBe('cart-new');
      expect(prismaMock.shoppingCart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-new',
          }),
        })
      );
    });

    it('should create cart for customer', async () => {
      const newCart = {
        id: 'cart-customer',
        sessionId: null,
        customerId: 'cust-1',
        items: [],
        coupon: null,
        shippingMethod: null,
        expiresAt: new Date(),
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.shoppingCart.create as jest.Mock).mockResolvedValue(newCart);

      const result = await cartService.getOrCreateCart(undefined, 'cust-1');

      expect(result.customerId).toBe('cust-1');
      expect(prismaMock.shoppingCart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });
  });

  describe('findCart', () => {
    it('should find cart by session ID', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-123',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(cart);

      const result = await cartService.findCart('session-123');

      expect(result!.id).toBe('cart-1');
      expect(prismaMock.shoppingCart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionId: 'session-123',
          }),
        })
      );
    });

    it('should find cart by customer ID', async () => {
      const cart = {
        id: 'cart-2',
        customerId: 'cust-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(cart);

      const result = await cartService.findCart(undefined, 'cust-1');

      expect(result!.id).toBe('cart-2');
      expect(prismaMock.shoppingCart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should return null when no session or customer ID', async () => {
      const result = await cartService.findCart();

      expect(result).toBeNull();
      expect(prismaMock.shoppingCart.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when cart not found', async () => {
      (prismaMock.shoppingCart.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await cartService.findCart('session-unknown');

      expect(result).toBeNull();
    });
  });

  describe('getCartById', () => {
    it('should return cart by ID', async () => {
      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);

      const result = await cartService.getCartById('cart-1');

      expect(result!.id).toBe('cart-1');
      expect(prismaMock.shoppingCart.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
        })
      );
    });

    it('should return null when cart not found', async () => {
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await cartService.getCartById('cart-unknown');

      expect(result).toBeNull();
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const product = {
        price: createDecimalMock(100),
        webPrice: createDecimalMock(90),
      };

      const cart = {
        id: 'cart-1',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            product: { id: 'prod-1', price: createDecimalMock(90), webPrice: createDecimalMock(90) },
          },
        ],
        coupon: null,
        shippingMethod: null,
        subtotal: createDecimalMock(90),
        discount: 0,
        shipping: 0,
        tax: 0,
        total: createDecimalMock(90),
      };

      // Mock stock check
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      (prismaMock.product.findUnique as jest.Mock).mockResolvedValue(product);
      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.cartItem.create as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      const result = await cartService.addItem('cart-1', {
        productId: 'prod-1',
        quantity: 1,
      });

      expect(prismaMock.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 1,
          }),
        })
      );
    });

    it('should update existing item quantity', async () => {
      const product = {
        price: createDecimalMock(100),
        webPrice: createDecimalMock(90),
      };

      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      // Mock stock check
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      (prismaMock.product.findUnique as jest.Mock).mockResolvedValue(product);
      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(existingItem);
      (prismaMock.cartItem.update as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.addItem('cart-1', {
        productId: 'prod-1',
        quantity: 3,
      });

      expect(prismaMock.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            quantity: 5, // 2 + 3
          }),
        })
      );
    });

    it('should throw error when stock insufficient', async () => {
      // Mock insufficient stock
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 5 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 3 },
      });

      await expect(
        cartService.addItem('cart-1', {
          productId: 'prod-1',
          quantity: 10,
        })
      ).rejects.toThrow('Stock insufficiente');
    });

    it('should throw error when product not found', async () => {
      // Mock stock check
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      (prismaMock.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        cartService.addItem('cart-1', {
          productId: 'prod-unknown',
          quantity: 1,
        })
      ).rejects.toThrow('Prodotto non trovato');
    });

    it('should apply variant price delta', async () => {
      const product = {
        price: createDecimalMock(100),
        webPrice: createDecimalMock(100),
      };

      const variant = {
        id: 'var-1',
        priceDelta: createDecimalMock(20),
        webPrice: null,
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      // Mock stock check
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      (prismaMock.product.findUnique as jest.Mock).mockResolvedValue(product);
      (prismaMock.productVariant.findUnique as jest.Mock).mockResolvedValue(variant);
      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.cartItem.create as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.addItem('cart-1', {
        productId: 'prod-1',
        variantId: 'var-1',
        quantity: 1,
      });

      expect(prismaMock.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variantId: 'var-1',
          }),
        })
      );
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity', async () => {
      const item = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(item);

      // Mock stock check
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      (prismaMock.cartItem.update as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.updateItemQuantity('cart-1', 'item-1', { quantity: 5 });

      expect(prismaMock.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            quantity: 5,
          }),
        })
      );
    });

    it('should remove item when quantity is 0', async () => {
      const item = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(item);
      (prismaMock.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.updateItemQuantity('cart-1', 'item-1', { quantity: 0 });

      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1', cartId: 'cart-1' },
        })
      );
    });

    it('should throw error when item not found', async () => {
      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        cartService.updateItemQuantity('cart-1', 'item-unknown', { quantity: 5 })
      ).rejects.toThrow('Item non trovato nel carrello');
    });

    it('should throw error when stock insufficient', async () => {
      const item = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
      };

      (prismaMock.cartItem.findFirst as jest.Mock).mockResolvedValue(item);

      // Mock insufficient stock
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 3 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 0 },
      });

      await expect(
        cartService.updateItemQuantity('cart-1', 'item-1', { quantity: 10 })
      ).rejects.toThrow('Stock insufficiente');
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.removeItem('cart-1', 'item-1');

      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1', cartId: 'cart-1' },
        })
      );
    });
  });

  describe('clearCart', () => {
    it('should remove all items from cart', async () => {
      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.clearCart('cart-1');

      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cartId: 'cart-1' },
        })
      );
    });
  });

  describe('applyCoupon', () => {
    it('should apply valid coupon to cart', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'SAVE10',
        isActive: true,
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(10),
        minimumOrderAmount: null,
      };

      const cart = {
        id: 'cart-1',
        items: [],
        subtotal: createDecimalMock(100),
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.coupon.findFirst as jest.Mock).mockResolvedValue(coupon);
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue({
        ...cart,
        couponId: 'coupon-1',
      });

      await cartService.applyCoupon('cart-1', 'SAVE10');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
          data: { couponId: 'coupon-1' },
        })
      );
    });

    it('should throw error for invalid coupon', async () => {
      (prismaMock.coupon.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        cartService.applyCoupon('cart-1', 'INVALID')
      ).rejects.toThrow('Coupon non valido o scaduto');
    });

    it('should throw error when order below minimum', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'MIN50',
        isActive: true,
        minimumOrderAmount: createDecimalMock(50),
      };

      const cart = {
        id: 'cart-1',
        subtotal: createDecimalMock(30),
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.coupon.findFirst as jest.Mock).mockResolvedValue(coupon);
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);

      await expect(
        cartService.applyCoupon('cart-1', 'MIN50')
      ).rejects.toThrow('Ordine minimo per questo coupon');
    });
  });

  describe('removeCoupon', () => {
    it('should remove coupon from cart', async () => {
      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue({
        ...cart,
        couponId: null,
        discount: 0,
      });
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);

      await cartService.removeCoupon('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
          data: { couponId: null, discount: 0 },
        })
      );
    });
  });

  describe('setShippingMethod', () => {
    it('should set shipping method', async () => {
      const method = {
        id: 'ship-1',
        name: 'Standard Shipping',
        isActive: true,
        baseCost: createDecimalMock(10),
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shopShippingMethod.findUnique as jest.Mock).mockResolvedValue(method);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue({
        ...cart,
        shippingMethodId: 'ship-1',
      });
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);

      await cartService.setShippingMethod('cart-1', 'ship-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
          data: { shippingMethodId: 'ship-1' },
        })
      );
    });

    it('should throw error for inactive shipping method', async () => {
      (prismaMock.shopShippingMethod.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        cartService.setShippingMethod('cart-1', 'ship-inactive')
      ).rejects.toThrow('Metodo di spedizione non disponibile');
    });
  });

  describe('setShippingAddress', () => {
    it('should set shipping address', async () => {
      const address = {
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St',
        city: 'Rome',
        postcode: '00100',
        country: 'IT',
      };

      const cart = {
        id: 'cart-1',
        items: [],
        coupon: null,
        shippingMethod: null,
        shippingAddress: address,
      };

      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      const result = await cartService.setShippingAddress('cart-1', address);

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cart-1' },
          data: { shippingAddress: address },
        })
      );
      expect(result.shippingAddress).toEqual(address);
    });
  });

  describe('mergeGuestCart', () => {
    it('should merge guest cart items to customer cart', async () => {
      const guestCart = {
        id: 'guest-cart',
        sessionId: 'session-123',
        items: [
          { id: 'item-1', productId: 'prod-1', variantId: null, quantity: 2 },
          { id: 'item-2', productId: 'prod-2', variantId: null, quantity: 1 },
        ],
        coupon: null,
        shippingMethod: null,
      };

      const customerCart = {
        id: 'customer-cart',
        customerId: 'cust-1',
        items: [
          { id: 'item-3', productId: 'prod-1', variantId: null, quantity: 3 },
        ],
        coupon: null,
        shippingMethod: null,
      };

      const updatedCustomerCart = {
        id: 'customer-cart',
        customerId: 'cust-1',
        items: [
          {
            id: 'item-3',
            productId: 'prod-1',
            variantId: null,
            quantity: 5,
            product: { price: createDecimalMock(50), webPrice: createDecimalMock(50), weight: null },
            variant: null,
          },
          {
            id: 'item-2',
            productId: 'prod-2',
            variantId: null,
            quantity: 1,
            product: { price: createDecimalMock(30), webPrice: createDecimalMock(30), weight: null },
            variant: null,
          },
        ],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock)
        .mockResolvedValueOnce(guestCart) // Guest cart lookup
        .mockResolvedValueOnce(customerCart); // Customer cart lookup

      (prismaMock.cartItem.update as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.delete as jest.Mock).mockResolvedValue({});
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(updatedCustomerCart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(updatedCustomerCart);

      await cartService.mergeGuestCart('session-123', 'cust-1');

      // Should update existing item (prod-1)
      expect(prismaMock.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-3' },
          data: { quantity: 5 }, // 3 + 2
        })
      );

      // Should move new item (prod-2) to customer cart
      expect(prismaMock.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-2' },
          data: { cartId: 'customer-cart' },
        })
      );

      // Should delete guest cart
      expect(prismaMock.shoppingCart.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'guest-cart' },
        })
      );
    });

    it('should assign guest cart to customer when no customer cart exists', async () => {
      const guestCart = {
        id: 'guest-cart',
        sessionId: 'session-123',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2 }],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock)
        .mockResolvedValueOnce(guestCart) // Guest cart lookup
        .mockResolvedValueOnce(null); // No customer cart

      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue({
        ...guestCart,
        customerId: 'cust-1',
        sessionId: null,
      });

      await cartService.mergeGuestCart('session-123', 'cust-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'guest-cart' },
          data: {
            customerId: 'cust-1',
            sessionId: null,
          },
        })
      );
    });

    it('should return customer cart when no guest cart exists', async () => {
      const customerCart = {
        id: 'customer-cart',
        customerId: 'cust-1',
        items: [],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // No guest cart
        .mockResolvedValueOnce(customerCart); // Customer cart exists

      const result = await cartService.mergeGuestCart('session-123', 'cust-1');

      expect(result!.id).toBe('customer-cart');
    });
  });

  describe('checkStockAvailability', () => {
    it('should return available when stock is sufficient', async () => {
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 50 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 10 },
      });

      const result = await cartService.checkStockAvailability('prod-1', null, 20);

      expect(result.available).toBe(true);
      expect(result.quantity).toBe(40); // 50 - 10
    });

    it('should return unavailable when stock is insufficient', async () => {
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 10 },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: 5 },
      });

      const result = await cartService.checkStockAvailability('prod-1', null, 10);

      expect(result.available).toBe(false);
      expect(result.quantity).toBe(5);
    });

    it('should handle null inventory', async () => {
      (prismaMock.inventoryItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: null },
      });
      (prismaMock.cartItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { reservedQty: null },
      });

      const result = await cartService.checkStockAvailability('prod-1', null, 1);

      expect(result.available).toBe(false);
      expect(result.quantity).toBe(0);
    });
  });

  describe('recalculateTotals', () => {
    it('should calculate subtotal from items', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            quantity: 2,
            product: { price: createDecimalMock(50), webPrice: createDecimalMock(50), weight: createDecimalMock(1) },
            variant: null,
          },
          {
            quantity: 1,
            product: { price: createDecimalMock(100), webPrice: null, weight: createDecimalMock(2) },
            variant: null,
          },
        ],
        coupon: null,
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.recalculateTotals('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200, // (50*2) + (100*1)
          }),
        })
      );
    });

    it('should apply percentage coupon discount', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            quantity: 2,
            product: { price: createDecimalMock(100), webPrice: createDecimalMock(100), weight: null },
            variant: null,
          },
        ],
        coupon: {
          type: 'PERCENTAGE',
          discountValue: createDecimalMock(10),
          maximumDiscount: null,
        },
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.recalculateTotals('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200,
            discount: 20, // 10% of 200
          }),
        })
      );
    });

    it('should apply fixed coupon discount', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            quantity: 1,
            product: { price: createDecimalMock(100), webPrice: createDecimalMock(100), weight: null },
            variant: null,
          },
        ],
        coupon: {
          type: 'FIXED',
          discountValue: createDecimalMock(15),
        },
        shippingMethod: null,
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.recalculateTotals('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discount: 15,
          }),
        })
      );
    });

    it('should apply free shipping with coupon', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            quantity: 1,
            product: { price: createDecimalMock(100), webPrice: createDecimalMock(100), weight: null },
            variant: null,
          },
        ],
        coupon: {
          type: 'FREE_SHIPPING',
          discountValue: createDecimalMock(0),
        },
        shippingMethod: {
          baseCost: createDecimalMock(10),
          costPerKg: null,
          freeAboveAmount: null,
        },
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.recalculateTotals('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipping: 0,
          }),
        })
      );
    });

    it('should apply free shipping above threshold', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            quantity: 2,
            product: { price: createDecimalMock(100), webPrice: createDecimalMock(100), weight: null },
            variant: null,
          },
        ],
        coupon: null,
        shippingMethod: {
          baseCost: createDecimalMock(10),
          costPerKg: null,
          freeAboveAmount: createDecimalMock(150),
        },
      };

      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(cart);
      (prismaMock.shoppingCart.update as jest.Mock).mockResolvedValue(cart);

      await cartService.recalculateTotals('cart-1');

      expect(prismaMock.shoppingCart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipping: 0, // Subtotal 200 >= 150
          }),
        })
      );
    });

    it('should throw error when cart not found', async () => {
      (prismaMock.shoppingCart.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(cartService.recalculateTotals('cart-unknown')).rejects.toThrow(
        'Carrello non trovato'
      );
    });
  });

  describe('cleanupExpiredCarts', () => {
    it('should delete expired carts', async () => {
      (prismaMock.shoppingCart.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await cartService.cleanupExpiredCarts();

      expect(result).toBe(5);
      expect(prismaMock.shoppingCart.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expiresAt: { lt: expect.any(Date) },
          },
        })
      );
    });
  });

  describe('releaseExpiredReservations', () => {
    it('should release expired stock reservations', async () => {
      (prismaMock.cartItem.updateMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await cartService.releaseExpiredReservations();

      expect(result).toBe(10);
      expect(prismaMock.cartItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reservedUntil: { lt: expect.any(Date) },
            reservedQty: { gt: 0 },
          },
          data: {
            reservedUntil: null,
            reservedQty: null,
          },
        })
      );
    });
  });
});
