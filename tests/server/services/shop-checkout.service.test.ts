/**
 * @file shop-checkout.service.test.ts
 * @description Unit tests for e-commerce checkout service
 * @coverage ~30 tests covering order creation, payment status, cancellation
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Create a proper Decimal mock factory
const createDecimalMock = (value: number | string) => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => String(numVal),
    add: (other: any) => createDecimalMock(numVal + (typeof other === 'number' ? other : other?.toNumber?.() || 0)),
    sub: (other: any) => createDecimalMock(numVal - (typeof other === 'number' ? other : other?.toNumber?.() || 0)),
    mul: (other: any) => createDecimalMock(numVal * (typeof other === 'number' ? other : other?.toNumber?.() || 0)),
    div: (other: any) => createDecimalMock(numVal / (typeof other === 'number' ? other : other?.toNumber?.() || 1)),
    greaterThan: (other: any) => numVal > (typeof other === 'number' ? other : other?.toNumber?.() || 0),
  };
};

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  OrderStatus: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  },
  PaymentStatus: {
    PENDING: 'PENDING',
    CAPTURED: 'CAPTURED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
  Prisma: {
    Decimal: jest.fn().mockImplementation((value) => createDecimalMock(value)),
  },
}));

// Import service after mocks
import { shopCheckoutService } from '@server/services/shop-checkout.service';

describe('ShopCheckoutService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // Test data factories
  const createMockCart = (overrides = {}) => ({
    id: 'cart-123',
    customerId: null,
    sessionId: 'session-123',
    couponId: null,
    coupon: null,
    shippingMethodId: null,
    shippingMethod: null,
    items: [
      {
        id: 'item-1',
        cartId: 'cart-123',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
        product: {
          id: 'prod-1',
          name: 'Test Product',
          sku: 'TEST-001',
          price: createDecimalMock(25.00),
          stockQuantity: 10,
        },
        variant: null,
      },
    ],
    ...overrides,
  });

  const createMockShippingMethod = (overrides = {}) => ({
    id: 'shipping-1',
    name: 'Standard Shipping',
    baseCost: createDecimalMock(5.00),
    isActive: true,
    ...overrides,
  });

  const createMockOrder = (overrides = {}) => ({
    id: 'order-123',
    orderNumber: 'ORD-202501-ABC123',
    customerId: 'cust-1',
    status: 'PENDING' as OrderStatus,
    subtotal: createDecimalMock(50.00),
    discount: createDecimalMock(0),
    shipping: createDecimalMock(5.00),
    tax: createDecimalMock(11.00),
    total: createDecimalMock(66.00),
    wcCurrency: 'EUR',
    shippingAddress: {},
    billingAddress: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    customer: { id: 'cust-1', email: 'test@test.com', firstName: 'Test', lastName: 'User' },
    ...overrides,
  });

  const checkoutData = {
    cartId: 'cart-123',
    email: 'customer@test.com',
    phone: '+39123456789',
    shippingAddress: {
      firstName: 'Mario',
      lastName: 'Rossi',
      address: 'Via Roma 1',
      city: 'Milano',
      postalCode: '20100',
      country: 'IT',
    },
    shippingMethodId: 'shipping-1',
    paymentMethod: 'stripe' as const,
    notes: 'Test order',
    newsletter: true,
  };

  // ============================================================================
  // createOrder
  // ============================================================================
  describe('createOrder', () => {
    it('should create order from cart successfully', async () => {
      const mockCart = createMockCart();
      prismaMock.shoppingCart.findUnique.mockResolvedValue(mockCart as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue(null);
      prismaMock.customer.create.mockResolvedValue({
        id: 'cust-new',
        code: 'GUEST-000001',
        email: 'customer@test.com',
        firstName: 'Mario',
        lastName: 'Rossi',
      } as any);

      const mockOrder = createMockOrder();
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(mockOrder as any);
      prismaMock.productVariant.update.mockResolvedValue({} as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue(null);
      prismaMock.newsletterSubscription.upsert.mockResolvedValue({} as any);

      const result = await shopCheckoutService.createOrder(checkoutData);

      expect(result.order).toBeDefined();
      expect(prismaMock.order.create).toHaveBeenCalled();
    });

    it('should throw when cart is empty', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue({
        id: 'cart-empty',
        items: [],
      } as any);

      await expect(shopCheckoutService.createOrder(checkoutData)).rejects.toThrow(
        'Carrello vuoto o non trovato'
      );
    });

    it('should throw when cart not found', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(null);

      await expect(shopCheckoutService.createOrder(checkoutData)).rejects.toThrow(
        'Carrello vuoto o non trovato'
      );
    });

    it('should throw when shipping method not found', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(createMockCart() as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(null);

      await expect(shopCheckoutService.createOrder(checkoutData)).rejects.toThrow(
        'Metodo di spedizione non valido'
      );
    });

    it('should throw when stock is insufficient', async () => {
      const cartWithLowStock = createMockCart({
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 100, // More than stock
            product: {
              id: 'prod-1',
              name: 'Test Product',
              stockQuantity: 5,
            },
            variant: null,
          },
        ],
      });
      prismaMock.shoppingCart.findUnique.mockResolvedValue(cartWithLowStock as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);

      await expect(shopCheckoutService.createOrder(checkoutData)).rejects.toThrow(
        'Quantità insufficiente per Test Product'
      );
    });

    it('should apply percentage coupon discount', async () => {
      const cartWithCoupon = createMockCart({
        couponId: 'coupon-1',
        coupon: {
          id: 'coupon-1',
          code: 'SAVE10',
          type: 'PERCENTAGE',
          discountValue: createDecimalMock(10),
        },
      });
      prismaMock.shoppingCart.findUnique.mockResolvedValue(cartWithCoupon as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(createMockOrder() as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.couponUsage.create.mockResolvedValue({} as any);
      prismaMock.coupon.update.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue(null);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);

      const result = await shopCheckoutService.createOrder(checkoutData);

      expect(result.order).toBeDefined();
      expect(prismaMock.couponUsage.create).toHaveBeenCalled();
      expect(prismaMock.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('should reuse existing customer by email', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(createMockCart() as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue({
        id: 'existing-cust',
        email: 'customer@test.com',
      } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(createMockOrder({ customerId: 'existing-cust' }) as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue(null);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);

      await shopCheckoutService.createOrder(checkoutData);

      expect(prismaMock.customer.create).not.toHaveBeenCalled();
    });

    it('should award loyalty points when account exists', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(createMockCart() as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-loyal' } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(createMockOrder() as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue({
        id: 'loyalty-1',
        customerId: 'cust-loyal',
        points: 100,
      } as any);
      prismaMock.loyaltyAccount.update.mockResolvedValue({} as any);
      prismaMock.loyaltyTransaction.create.mockResolvedValue({} as any);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);

      await shopCheckoutService.createOrder(checkoutData);

      expect(prismaMock.loyaltyAccount.update).toHaveBeenCalled();
      expect(prismaMock.loyaltyTransaction.create).toHaveBeenCalled();
    });

    it('should subscribe to newsletter when opted in', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(createMockCart() as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(createMockOrder() as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue(null);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);
      prismaMock.newsletterSubscription.upsert.mockResolvedValue({} as any);

      await shopCheckoutService.createOrder({ ...checkoutData, newsletter: true });

      expect(prismaMock.newsletterSubscription.upsert).toHaveBeenCalledWith({
        where: { email: 'customer@test.com' },
        create: expect.objectContaining({
          email: 'customer@test.com',
          status: 'CONFIRMED',
        }),
        update: {},
      });
    });

    it('should delete cart after order creation', async () => {
      prismaMock.shoppingCart.findUnique.mockResolvedValue(createMockCart() as any);
      prismaMock.shopShippingMethod.findUnique.mockResolvedValue(createMockShippingMethod() as any);
      prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' } as any);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.create.mockResolvedValue(createMockOrder() as any);
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.loyaltyAccount.findUnique.mockResolvedValue(null);
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.shoppingCart.delete.mockResolvedValue({} as any);

      await shopCheckoutService.createOrder(checkoutData);

      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123' },
      });
      expect(prismaMock.shoppingCart.delete).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
      });
    });
  });

  // ============================================================================
  // getOrder
  // ============================================================================
  describe('getOrder', () => {
    it('should get order by ID', async () => {
      prismaMock.order.findFirst.mockResolvedValue(createMockOrder() as any);

      const result = await shopCheckoutService.getOrder('order-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('order-123');
    });

    it('should get order by order number', async () => {
      prismaMock.order.findFirst.mockResolvedValue(createMockOrder() as any);

      const result = await shopCheckoutService.getOrder('ORD-202501-ABC123');

      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'ORD-202501-ABC123' },
            { orderNumber: 'ORD-202501-ABC123' },
          ],
        },
        include: expect.any(Object),
      });
    });

    it('should return null when order not found', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      const result = await shopCheckoutService.getOrder('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // updateOrderStatus
  // ============================================================================
  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      prismaMock.order.update.mockResolvedValue(
        createMockOrder({ status: 'PROCESSING' }) as any
      );

      const result = await shopCheckoutService.updateOrderStatus(
        'order-123',
        OrderStatus.PROCESSING
      );

      expect(result.status).toBe('PROCESSING');
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { status: 'PROCESSING' },
        include: { items: true, customer: true },
      });
    });
  });

  // ============================================================================
  // updatePaymentStatus
  // ============================================================================
  describe('updatePaymentStatus', () => {
    it('should mark order as confirmed on payment capture', async () => {
      prismaMock.order.update.mockResolvedValue(createMockOrder() as any);
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const result = await shopCheckoutService.updatePaymentStatus(
        'order-123',
        PaymentStatus.CAPTURED,
        'txn-123'
      );

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: OrderStatus.CONFIRMED,
          paidAt: expect.any(Date),
        },
      });
      expect(prismaMock.paymentTransaction.create).toHaveBeenCalled();
    });

    it('should mark order as cancelled on payment failure', async () => {
      prismaMock.order.update.mockResolvedValue(createMockOrder() as any);
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await shopCheckoutService.updatePaymentStatus(
        'order-123',
        PaymentStatus.FAILED
      );

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    });

    it('should create payment transaction record', async () => {
      const mockOrder = createMockOrder();
      prismaMock.order.update.mockResolvedValue(mockOrder as any);
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await shopCheckoutService.updatePaymentStatus(
        'order-123',
        PaymentStatus.CAPTURED,
        'pi_stripe_123'
      );

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-123',
          transactionId: 'pi_stripe_123',
          status: PaymentStatus.CAPTURED,
        }),
      });
    });
  });

  // ============================================================================
  // cancelOrder
  // ============================================================================
  describe('cancelOrder', () => {
    it('should cancel pending order and restore stock', async () => {
      const mockOrder = createMockOrder({
        status: 'PENDING',
        items: [
          { productId: 'prod-1', variantId: null, quantity: 2 },
        ],
      });
      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.product.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({} as any);
      prismaMock.loyaltyTransaction.findFirst.mockResolvedValue(null);
      prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      prismaMock.order.findUnique.mockResolvedValueOnce(
        createMockOrder({ status: 'CANCELLED' }) as any
      );

      const result = await shopCheckoutService.cancelOrder('order-123', 'Customer request');

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { wcStockQuantity: { increment: 2 } },
      });
    });

    it('should throw when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        shopCheckoutService.cancelOrder('nonexistent')
      ).rejects.toThrow('Ordine non trovato');
    });

    it('should throw when order cannot be cancelled', async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        createMockOrder({ status: 'SHIPPED' }) as any
      );

      await expect(
        shopCheckoutService.cancelOrder('order-123')
      ).rejects.toThrow('Impossibile annullare questo ordine');
    });

    it('should reverse loyalty points on cancellation', async () => {
      const mockOrder = createMockOrder({
        status: 'CONFIRMED',
        orderNumber: 'ORD-123',
        items: [],
      });
      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.order.update.mockResolvedValue({} as any);
      prismaMock.loyaltyTransaction.findFirst.mockResolvedValue({
        id: 'ltx-1',
        orderId: 'order-123',
        type: 'EARN',
        points: 50,
        account: { id: 'acc-1', points: 150 },
      } as any);
      prismaMock.loyaltyAccount.update.mockResolvedValue({} as any);
      prismaMock.loyaltyTransaction.create.mockResolvedValue({} as any);
      prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      prismaMock.order.findUnique.mockResolvedValueOnce(
        createMockOrder({ status: 'CANCELLED' }) as any
      );

      await shopCheckoutService.cancelOrder('order-123');

      expect(prismaMock.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { points: { decrement: 50 } },
      });
      expect(prismaMock.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'EXPIRE',
          points: -50,
        }),
      });
    });

    it('should restore variant stock when variant exists', async () => {
      const mockOrder = createMockOrder({
        status: 'PENDING',
        items: [
          { productId: 'prod-1', variantId: 'var-1', quantity: 3 },
        ],
      });
      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(prismaMock as any);
      });
      prismaMock.productVariant.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({} as any);
      prismaMock.loyaltyTransaction.findFirst.mockResolvedValue(null);
      prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      prismaMock.order.findUnique.mockResolvedValueOnce(
        createMockOrder({ status: 'CANCELLED' }) as any
      );

      await shopCheckoutService.cancelOrder('order-123');

      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { wcStockQuantity: { increment: 3 } },
      });
    });
  });

  // ============================================================================
  // trackOrder
  // ============================================================================
  describe('trackOrder', () => {
    it('should return tracking info', async () => {
      prismaMock.order.findFirst.mockResolvedValue({
        orderNumber: 'ORD-123',
        status: 'SHIPPED',
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://tracking.com/TRACK123',
        items: [{ productName: 'Product', quantity: 1 }],
      } as any);

      const result = await shopCheckoutService.trackOrder('ORD-123');

      expect(result.trackingNumber).toBe('TRACK123');
      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
        where: { orderNumber: 'ORD-123' },
        select: expect.objectContaining({
          orderNumber: true,
          status: true,
          trackingNumber: true,
        }),
      });
    });

    it('should verify email when provided', async () => {
      prismaMock.order.findFirst.mockResolvedValueOnce({
        orderNumber: 'ORD-123',
        customer: { email: 'customer@test.com' },
      } as any);
      prismaMock.order.findFirst.mockResolvedValueOnce({
        orderNumber: 'ORD-123',
        status: 'SHIPPED',
      } as any);

      const result = await shopCheckoutService.trackOrder('ORD-123', 'customer@test.com');

      expect(result).toBeDefined();
    });

    it('should throw when email does not match', async () => {
      prismaMock.order.findFirst.mockResolvedValueOnce({
        orderNumber: 'ORD-123',
        customer: { email: 'other@test.com' },
      } as any);

      await expect(
        shopCheckoutService.trackOrder('ORD-123', 'wrong@test.com')
      ).rejects.toThrow('Ordine non trovato');
    });

    it('should throw when order not found with email verification', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(
        shopCheckoutService.trackOrder('NONEXISTENT', 'test@test.com')
      ).rejects.toThrow('Ordine non trovato');
    });
  });
});
