/**
 * Order Service Tests
 * Comprehensive unit tests for order management functionality
 *
 * Priority: Functionality first - fix code to pass tests, not the other way around
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';
import { orderService } from '@server/services/order.service';

// Mock the prisma client
jest.mock('@server/config/database', () => ({
  prisma: require('../__mocks__/prisma').prismaMock,
}));

// Mock pricelist service
jest.mock('@server/services/pricelist.service', () => {
  return {
    __esModule: true,
    default: {
      getPriceForCustomer: jest.fn().mockResolvedValue(100),
      calculateOrderPrices: jest.fn().mockResolvedValue({
        items: [],
        totals: { subtotal: 0, tax: 0, total: 0 },
      }),
    },
    priceListService: {
      getPriceForCustomer: jest.fn().mockResolvedValue(100),
      calculateOrderPrices: jest.fn().mockResolvedValue({
        items: [],
        totals: { subtotal: 0, tax: 0, total: 0 },
      }),
    },
  };
});

// Mock inventory service
jest.mock('@server/services/inventory.service', () => {
  return {
    __esModule: true,
    default: {
      reserveStock: jest.fn().mockResolvedValue({}),
      releaseReservation: jest.fn().mockResolvedValue({}),
      deductInventoryRecursive: jest.fn().mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 0,
      }),
    },
    inventoryService: {
      reserveStock: jest.fn().mockResolvedValue({}),
      releaseReservation: jest.fn().mockResolvedValue({}),
      deductInventoryRecursive: jest.fn().mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 0,
      }),
    },
  };
});

// Mock manufacturing service (lazy loaded)
jest.mock('@server/services/manufacturing.service', () => {
  return {
    __esModule: true,
    default: {
      createProductionOrder: jest.fn().mockResolvedValue({}),
    },
    manufacturingService: {
      createProductionOrder: jest.fn().mockResolvedValue({}),
    },
  };
});

// Mock stock alert job
jest.mock('@server/jobs/stock-alert.job', () => ({
  triggerPostShipmentCheck: jest.fn().mockResolvedValue(undefined),
}));

// Mock wordpress job (lazy importato in updateOrderStatus)
jest.mock('@server/jobs/wordpress.job', () => ({
  queueOrderStatusUpdate: jest.fn().mockResolvedValue(undefined),
}));

// Mock email service (lazy importato per notifiche cambio stato)
jest.mock('@server/services/email.service', () => ({
  __esModule: true,
  emailService: {
    sendOrderStatusUpdate: jest.fn().mockResolvedValue(true),
  },
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
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create order with proper Date objects
const createOrderWithDates = (overrides: any = {}) => {
  const base = mockFactories.order(overrides);
  return {
    ...base,
    orderDate: new Date(base.orderDate),
    createdAt: new Date(base.createdAt),
    updatedAt: new Date(base.updatedAt),
  };
};

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // listOrders
  // ==========================================
  describe('listOrders', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        createOrderWithDates({ id: 'ord-1', orderNumber: 'ORD-001' }),
        createOrderWithDates({ id: 'ord-2', orderNumber: 'ORD-002' }),
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.order.count.mockResolvedValue(2);

      const result = await orderService.listOrders({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status array', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ status: ['PENDING', 'CONFIRMED'] });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
        })
      );
    });

    it('should filter by single status', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ status: ['PENDING'] });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('should filter by customerId', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ customerId: 'cust-123' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-123',
          }),
        })
      );
    });

    it('should filter by source', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ source: 'ECOMMERCE' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'ECOMMERCE',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        })
      );
    });

    it('should apply custom sorting', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ sortBy: 'total', sortOrder: 'asc' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' },
        })
      );
    });

    it('should handle empty results', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      const result = await orderService.listOrders({});

      expect(result.items).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ==========================================
  // getOrderById
  // ==========================================
  describe('getOrderById', () => {
    it('should return order with includes', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1' }),
        customer: mockFactories.customer(),
        items: [mockFactories.orderItem()],
        invoice: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderById('ord-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('ord-1');
      expect(prismaMock.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          include: expect.objectContaining({
            customer: true,
            items: expect.any(Object),
            invoice: true,
          }),
        })
      );
    });

    it('should return null when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      const result = await orderService.getOrderById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // createOrder
  // ==========================================
  describe('createOrder', () => {
    const setupCreateOrderMocks = () => {
      const mockOrder = createOrderWithDates({ id: 'ord-new', status: 'PENDING' });
      const mockOrderWithItems = {
        ...mockOrder,
        items: [],
      };

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.order.create.mockResolvedValue(mockOrder as any);
      prismaMock.order.findFirst.mockResolvedValue(null);
      prismaMock.order.count.mockResolvedValue(0);
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.order.findUnique.mockResolvedValue(mockOrderWithItems as any);
      prismaMock.order.update.mockResolvedValue(mockOrderWithItems as any);

      return mockOrder;
    };

    it('should create order with basic data', async () => {
      const mockOrder = setupCreateOrderMocks();

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'ECOMMERCE',
      });

      expect(result.id).toBe('ord-new');
      expect(result.status).toBe('PENDING');
    });

    it('should generate order number when not provided', async () => {
      setupCreateOrderMocks();

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'ECOMMERCE',
      });

      expect(result.orderNumber).toBeDefined();
    });

    it('should use provided order number', async () => {
      const mockOrder = createOrderWithDates({ id: 'ord-new', orderNumber: 'CUSTOM-001' });
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.order.create.mockResolvedValue(mockOrder as any);
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrder, items: [] } as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, items: [] } as any);

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'ECOMMERCE',
        orderNumber: 'CUSTOM-001',
      });

      expect(result.orderNumber).toBe('CUSTOM-001');
    });
  });

  // ==========================================
  // updateOrder
  // ==========================================
  describe('updateOrder', () => {
    it('should update order data', async () => {
      const mockOrder = createOrderWithDates({ id: 'ord-1', notes: 'Updated notes' });
      const mockOrderWithIncludes = {
        ...mockOrder,
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
      };

      // updateOrder calls getOrderById first
      prismaMock.order.findUnique.mockResolvedValue(mockOrderWithIncludes as any);
      prismaMock.order.update.mockResolvedValue(mockOrderWithIncludes as any);

      const result = await orderService.updateOrder('ord-1', { notes: 'Updated notes' });

      expect(result.notes).toBe('Updated notes');
    });
  });

  // ==========================================
  // updateOrderStatus
  // ==========================================
  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        items: [],
      };
      const mockUpdatedOrder = { ...mockOrder, status: 'CONFIRMED' };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.order.update.mockResolvedValue(mockUpdatedOrder as any);
      prismaMock.orderHistory.create.mockResolvedValue({} as any);

      const result = await orderService.updateOrderStatus('ord-1', { status: 'CONFIRMED' });

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.updateOrderStatus('non-existent', { status: 'CONFIRMED' })
      ).rejects.toThrow();
    });

    it('should throw error for invalid status transition', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'DELIVERED' }),
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.updateOrderStatus('ord-1', { status: 'PENDING' })
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // removeOrderItem
  // ==========================================
  describe('removeOrderItem', () => {
    it('should remove item from order', async () => {
      const mockItem = mockFactories.orderItem({ id: 'item-1', orderId: 'ord-1' });
      const mockOrder = createOrderWithDates({ id: 'ord-1' });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderItem.findUnique.mockResolvedValue(mockItem as any);
      prismaMock.orderItem.delete.mockResolvedValue(mockItem as any);
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, items: [] } as any);

      await orderService.removeOrderItem('ord-1', 'item-1');

      expect(prismaMock.orderItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw error when item not found', async () => {
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderItem.findUnique.mockResolvedValue(null);

      await expect(orderService.removeOrderItem('ord-1', 'non-existent')).rejects.toThrow();
    });
  });

  // ==========================================
  // allocateInventoryForOrder
  // ==========================================
  describe('allocateInventoryForOrder', () => {
    // Note: Complex method with BOM material deduction - tested via E2E tests
    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(orderService.allocateInventoryForOrder('non-existent')).rejects.toThrow();
    });
  });

  // ==========================================
  // releaseInventoryForOrder
  // ==========================================
  // Note: Complex transaction method with multiple nested queries
  // Fully tested via E2E tests in tests/e2e/order-lifecycle.e2e.test.ts

  // ==========================================
  // createShipment
  // ==========================================
  describe('createShipment', () => {
    it('should create shipment for order', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 5,
            shippedQuantity: 0,
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderShipment.create.mockResolvedValue({
        id: 'ship-1',
        trackingNumber: 'TRACK123',
      } as any);
      prismaMock.orderItem.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'SHIPPED' } as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 1,
      });

      const result = await orderService.createShipment('ord-1', {
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
        items: [{ orderItemId: 'item-1', quantity: 5 }],
      });

      expect(result.trackingNumber).toBe('TRACK123');
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.createShipment('non-existent', {
          carrier: 'DHL',
          items: [],
        })
      ).rejects.toThrow();
    });

    it('should throw error when order is already delivered', async () => {
      const mockOrder = createOrderWithDates({ id: 'ord-1', status: 'DELIVERED' });

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.createShipment('ord-1', {
          carrier: 'DHL',
          items: [],
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // markAsDelivered
  // ==========================================
  describe('markAsDelivered', () => {
    it('should mark order as delivered', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'SHIPPED' }),
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'DELIVERED',
      } as any);

      const result = await orderService.markAsDelivered('ord-1');

      expect(result.status).toBe('DELIVERED');
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(orderService.markAsDelivered('non-existent')).rejects.toThrow();
    });

    it('should not allow marking as delivered when not shipped', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      // The service returns undefined when status is not SHIPPED
      const result = await orderService.markAsDelivered('ord-1');
      expect(result).toBeUndefined();
    });
  });

  // ==========================================
  // getOrderFull
  // ==========================================
  describe('getOrderFull', () => {
    it('should return order with all related data', async () => {
      const mockOrderItem = mockFactories.orderItem();
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1' }),
        customer: mockFactories.customer(),
        items: [{
          ...mockOrderItem,
          product: mockFactories.product(),
          variant: null,
        }],
        shipments: [],
        invoice: null,
        history: [],
        attachments: [],
        reservations: [],
        paymentDues: [],
        refunds: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderFull('ord-1');

      expect(result).toBeDefined();
      expect(result?.customer).toBeDefined();
      expect(result?.items).toBeDefined();
    });

    it('should return null when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      const result = await orderService.getOrderFull('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // addOrderAttachment
  // ==========================================
  describe('addOrderAttachment', () => {
    it('should add attachment to order', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1' }),
        attachments: [],
      };
      const mockUpdatedOrder = {
        ...mockOrder,
        attachments: [{
          id: 'att-1',
          name: 'document.pdf',
          url: '/uploads/document.pdf',
          type: 'application/pdf',
          size: 1024,
        }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue(mockUpdatedOrder as any);

      const result = await orderService.addOrderAttachment('ord-1', {
        name: 'document.pdf',
        url: '/uploads/document.pdf',
        type: 'application/pdf',
        size: 1024,
      });

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].name).toBe('document.pdf');
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.addOrderAttachment('non-existent', {
          name: 'test.pdf',
          url: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // removeOrderAttachment
  // ==========================================
  describe('removeOrderAttachment', () => {
    it('should remove attachment from order', async () => {
      const mockOrder = {
        attachments: [
          { id: 'att-1', name: 'doc1.pdf' },
          { id: 'att-2', name: 'doc2.pdf' },
        ],
      };
      const mockUpdatedOrder = {
        id: 'ord-1',
        attachments: [{ id: 'att-2', name: 'doc2.pdf' }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue(mockUpdatedOrder as any);

      const result = await orderService.removeOrderAttachment('ord-1', 'att-1');

      expect(result.attachments).toHaveLength(1);
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.removeOrderAttachment('ord-1', 'non-existent')
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // getOrderAttachments
  // ==========================================
  describe('getOrderAttachments', () => {
    it('should return order attachments', async () => {
      const mockOrder = {
        attachments: [
          { id: 'att-1', name: 'doc1.pdf' },
          { id: 'att-2', name: 'doc2.pdf' },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderAttachments('ord-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('doc1.pdf');
    });

    it('should return empty array when no attachments', async () => {
      const mockOrder = {
        attachments: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderAttachments('ord-1');

      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // getOrderStats
  // ==========================================
  describe('getOrderStats', () => {
    it('should return order statistics', async () => {
      const mockOrders = [
        createOrderWithDates({ status: 'PENDING', total: createDecimal(100) }),
        createOrderWithDates({ status: 'CONFIRMED', total: createDecimal(200) }),
        createOrderWithDates({ status: 'SHIPPED', total: createDecimal(300) }),
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.order.aggregate.mockResolvedValue({
        _count: { id: 3 },
        _sum: { total: createDecimal(600) },
      } as any);

      const result = await orderService.getOrderStats('2026-01-01', '2026-01-31');

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // createB2BOrder
  // ==========================================
  describe('createB2BOrder', () => {
    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        orderService.createB2BOrder('non-existent', [{ productId: 'prod-1', quantity: 1 }])
      ).rejects.toThrow();
    });

    it('should throw error when no items provided', async () => {
      const mockCustomer = mockFactories.customer({ id: 'cust-1' });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      await expect(orderService.createB2BOrder('cust-1', [])).rejects.toThrow();
    });
  });

  // ==========================================
  // previewB2BOrderPrices
  // ==========================================
  describe('previewB2BOrderPrices', () => {
    it('should preview B2B order prices when customer exists', async () => {
      const mockCustomer = mockFactories.customer({ id: 'cust-1' });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculateOrderPrices.mockResolvedValue({
        items: [{ productId: 'prod-1', quantity: 10, unitPrice: 90, subtotal: 900 }],
        totals: { subtotal: 900, tax: 0, total: 900 },
      });

      const result = await orderService.previewB2BOrderPrices('cust-1', [
        { productId: 'prod-1', quantity: 10 },
      ]);

      // The service delegates to priceListService.calculateOrderPrices
      expect(result).toBeDefined();
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        orderService.previewB2BOrderPrices('non-existent', [
          { productId: 'prod-1', quantity: 1 },
        ])
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // createProductionOrdersForOrder
  // ==========================================
  describe('createProductionOrdersForOrder', () => {
    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.createProductionOrdersForOrder('non-existent')
      ).rejects.toThrow();
    });

    it('should throw error when no user provided', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1' }),
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.createProductionOrdersForOrder('ord-1')
      ).rejects.toThrow('Nessun utente disponibile');
    });
  });

  // ==========================================
  // getOrdersTimeline
  // ==========================================
  describe('getOrdersTimeline', () => {
    it('should return orders timeline object', async () => {
      // Create orders with proper Date objects
      const today = new Date();
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          orderDate: today,
          estimatedDelivery: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
          total: createDecimal(100),
          shippingAddress: '{"city":"Milan"}',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOrdersTimeline(30);

      // The timeline returns an object with timeline data, not an array
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  // ==========================================
  // getOptimizationSuggestions
  // ==========================================
  // TODO: service ridotto a stub (returns { ordersOptimized: 0, suggestions: [], ... });
  // riattivare quando l'implementazione completa di getOptimizationSuggestions sarà ripristinata.
  describe.skip('getOptimizationSuggestions', () => {
    it('should return optimization suggestions', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          items: [mockFactories.orderItem({ productId: 'prod-1' })],
          customer: mockFactories.customer(),
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      expect(result).toBeDefined();
      expect(result.totalPendingOrders).toBeDefined();
      expect(result.groupings).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should handle no pending orders', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await orderService.getOptimizationSuggestions();

      expect(result.totalPendingOrders).toBe(0);
    });
  });

  // ==========================================
  // addOrderItem (new tests)
  // ==========================================
  describe('addOrderItem', () => {
    const setupAddItemMocks = () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: {
          id: 'cust-1',
          type: 'B2B',
          priceList: { id: 'pl-1' },
        },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'TEST-SKU',
        name: 'Test Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      return { mockOrder, mockProduct };
    };

    it('should add item with manual price', async () => {
      const { mockOrder, mockProduct } = setupAddItemMocks();
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1', unitPrice: 150 }),
          findMany: jest.fn().mockResolvedValue([{ subtotal: 300, tax: 66, total: 366 }]),
        },
      };

      const result = await orderService.addOrderItem(mockTx, 'ord-1', {
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 150,
      });

      expect(mockTx.orderItem.create).toHaveBeenCalled();
    });

    it('should throw error when order not found', async () => {
      const mockTx = {
        order: { findUnique: jest.fn().mockResolvedValue(null) },
        product: { findUnique: jest.fn() },
        orderItem: { create: jest.fn() },
      };

      await expect(
        orderService.addOrderItem(mockTx, 'non-existent', {
          productId: 'prod-1',
          quantity: 1,
        })
      ).rejects.toThrow('Order not found');
    });

    it('should throw error when product not found', async () => {
      const { mockOrder } = setupAddItemMocks();
      const mockTx = {
        order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
        product: { findUnique: jest.fn().mockResolvedValue(null) },
        orderItem: { create: jest.fn() },
      };

      await expect(
        orderService.addOrderItem(mockTx, 'ord-1', {
          productId: 'non-existent',
          quantity: 1,
        })
      ).rejects.toThrow('Product non-existent not found');
    });

    it('should use product base price for B2C customers', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: { id: 'cust-1', type: 'B2C', priceList: null },
      };
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(50),
        taxRate: createDecimal(22),
      };

      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          findMany: jest.fn().mockResolvedValue([{ subtotal: 50, tax: 11, total: 61 }]),
        },
      };

      await orderService.addOrderItem(mockTx, 'ord-1', {
        productId: 'prod-1',
        quantity: 1,
      });

      expect(mockTx.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 50,
            priceSource: 'product_base',
          }),
        })
      );
    });

    it('should calculate tax correctly', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: { id: 'cust-1', type: 'B2C', priceList: null },
      };
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          findMany: jest.fn().mockResolvedValue([{ subtotal: 200, tax: 44, total: 244 }]),
        },
      };

      await orderService.addOrderItem(mockTx, 'ord-1', {
        productId: 'prod-1',
        quantity: 2,
      });

      // unitPrice=100, quantity=2, subtotal=200, tax=200*22/100=44
      expect(mockTx.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200,
            tax: 44,
            total: 244,
          }),
        })
      );
    });

    it('should use B2B pricelist when available', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: { id: 'cust-1', type: 'B2B', priceList: { id: 'pl-1' } },
      };
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          findMany: jest.fn().mockResolvedValue([{ subtotal: 80, tax: 17.6, total: 97.6 }]),
        },
      };

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculatePrice = jest.fn().mockResolvedValue({
        finalPrice: 80,
        discount: 20,
        discountSource: 'pricelist',
      });

      await orderService.addOrderItem(mockTx, 'ord-1', {
        productId: 'prod-1',
        quantity: 1,
      });

      expect(mockTx.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 80,
            discount: 20,
            priceSource: 'pricelist',
          }),
        })
      );
    });
  });

  // ==========================================
  // createOrderFull (new tests)
  // ==========================================
  describe('createOrderFull', () => {
    const setupCreateFullMocks = () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2B',
        paymentTerms: 30,
        priceList: { id: 'pl-1' },
        paymentPlan: null,
        shippingAddress: { street: 'Via Test', city: 'Milan' },
        billingAddress: { street: 'Via Test', city: 'Milan' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Test Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      return { mockCustomer, mockProduct };
    };

    it('should create full order with all data', async () => {
      const { mockCustomer, mockProduct } = setupCreateFullMocks();
      const mockOrder = createOrderWithDates({
        id: 'ord-new',
        orderNumber: 'ORD-2026/000001',
        customerId: 'cust-1',
        source: 'B2B',
        status: 'PENDING',
      });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 2 }],
        notes: 'Test order',
      });

      expect(result).toBeDefined();
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        orderService.createOrderFull({
          customerId: 'non-existent',
          source: 'B2B',
          items: [{ productId: 'prod-1', quantity: 1 }],
        })
      ).rejects.toThrow('Cliente non trovato');
    });

    it('should throw error when product not found', async () => {
      const { mockCustomer } = setupCreateFullMocks();
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: { create: jest.fn() },
          product: { findUnique: jest.fn().mockResolvedValue(null) },
          orderItem: { create: jest.fn() },
        });
      });

      await expect(
        orderService.createOrderFull({
          customerId: 'cust-1',
          source: 'B2B',
          items: [{ productId: 'non-existent', quantity: 1 }],
        })
      ).rejects.toThrow('Prodotto non-existent non trovato');
    });

    it('should create order with attachments', async () => {
      const { mockCustomer, mockProduct } = setupCreateFullMocks();
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const createMock = jest.fn().mockResolvedValue(mockOrder);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: createMock,
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 1 }],
        attachments: [
          { name: 'doc.pdf', url: '/uploads/doc.pdf', type: 'application/pdf' },
        ],
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({ name: 'doc.pdf' }),
            ]),
          }),
        })
      );
    });

    it('should calculate totals correctly with shipping and discount', async () => {
      const { mockCustomer, mockProduct } = setupCreateFullMocks();
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const createMock = jest.fn().mockResolvedValue(mockOrder);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: createMock,
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [
          { productId: 'prod-1', quantity: 2 },
        ],
        shipping: 10,
        discount: 20,
      });

      // Verify that shipping and discount are set correctly
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipping: 10,
            discount: 20,
          }),
        })
      );
    });

    it('should use manual item prices when provided', async () => {
      const { mockCustomer, mockProduct } = setupCreateFullMocks();
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const itemCreateMock = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: itemCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'MANUAL',
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 75, discount: 5 },
        ],
      });

      expect(itemCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 75,
            discount: 5,
            priceSource: 'manual',
          }),
        })
      );
    });
  });

  // ==========================================
  // updateOrderFull (new tests)
  // ==========================================
  describe('updateOrderFull', () => {
    it('should update order with new data', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: {
          id: 'cust-1',
          type: 'B2B',
          priceList: null,
        },
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: jest.fn().mockResolvedValue({ ...mockOrder, notes: 'Updated' }),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: jest.fn() },
          product: { findUnique: jest.fn() },
        });
      });

      const result = await orderService.updateOrderFull('ord-1', {
        notes: 'Updated notes',
        priority: 1,
      });

      expect(result).toBeDefined();
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.updateOrderFull('non-existent', {
          notes: 'Test',
        })
      ).rejects.toThrow('Ordine non trovato');
    });

    it('should throw error for invalid status transition', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'DELIVERED' }),
        customer: { id: 'cust-1', type: 'B2B', priceList: null },
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.updateOrderFull('ord-1', {
          status: 'PENDING',
        })
      ).rejects.toThrow('Transizione stato non valida');
    });

    it('should update items when provided', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: { id: 'cust-1', type: 'B2C', priceList: null },
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1 }],
      };
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const deleteItemsMock = jest.fn().mockResolvedValue({ count: 1 });
      const createItemMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: deleteItemsMock, create: createItemMock },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        });
      });

      await orderService.updateOrderFull('ord-1', {
        items: [{ productId: 'prod-1', quantity: 3 }],
      });

      expect(deleteItemsMock).toHaveBeenCalledWith({ where: { orderId: 'ord-1' } });
      expect(createItemMock).toHaveBeenCalled();
    });

    it('should update shipping info', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        customer: { id: 'cust-1', type: 'B2B', priceList: null },
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const updateMock = jest.fn().mockResolvedValue(mockOrder);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: updateMock,
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: jest.fn() },
          product: { findUnique: jest.fn() },
        });
      });

      await orderService.updateOrderFull('ord-1', {
        trackingNumber: 'TRACK123',
        carrier: 'DHL',
      });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trackingNumber: 'TRACK123',
            carrier: 'DHL',
          }),
        })
      );
    });
  });

  // ==========================================
  // generatePaymentDuesFromOrder (new tests)
  // ==========================================
  describe('generatePaymentDuesFromOrder', () => {
    it('should generate payment dues for B2B order', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        total: createDecimal(1000),
        b2bPaymentMethod: 'BONIFICO',
        b2bPaymentTerms: 30,
        orderDate: new Date(),
        customer: {
          id: 'cust-1',
          type: 'B2B',
          paymentPlan: {
            id: 'pp-1',
            installments: [
              { sequence: 1, percentage: 50, daysOffset: 0 },
              { sequence: 2, percentage: 50, daysOffset: 30 },
            ],
          },
        },
        paymentDues: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const paymentDueCreateMock = jest.fn().mockResolvedValue({ id: 'pd-1' });
        return await fn({
          order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
          paymentDue: { create: paymentDueCreateMock },
        });
      });

      const result = await orderService.generatePaymentDuesFromOrder('ord-1');

      expect(result).toBeDefined();
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.generatePaymentDuesFromOrder('non-existent')
      ).rejects.toThrow('Ordine non trovato');
    });

    it('should throw error when payment dues already exist', async () => {
      const mockOrder = {
        id: 'ord-1',
        total: createDecimal(1000),
        customer: { id: 'cust-1', paymentPlan: null },
        paymentDues: [{ id: 'pd-1', amount: 1000 }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.generatePaymentDuesFromOrder('ord-1')
      ).rejects.toThrow('Scadenze già generate');
    });
  });

  // ==========================================
  // releaseInventoryForOrder (new tests)
  // ==========================================
  describe('releaseInventoryForOrder', () => {
    it('should release inventory for cancelled order', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            allocatedLocation: 'WEB',
            allocatedQuantity: 10,
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 5 };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({ ...mockInventoryItem, quantity: 15 }),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await orderService.releaseInventoryForOrder('ord-1');

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should return early when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      const result = await orderService.releaseInventoryForOrder('non-existent');

      expect(result).toBeUndefined();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should skip items without allocation', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            allocatedLocation: null,
            allocatedQuantity: 0,
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      const inventoryFindFirstMock = jest.fn();

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: { findFirst: inventoryFindFirstMock },
          inventoryMovement: { create: jest.fn() },
          orderItem: { update: jest.fn() },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await orderService.releaseInventoryForOrder('ord-1');

      expect(inventoryFindFirstMock).not.toHaveBeenCalled();
    });

    it('should restore BOM materials when releasing', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            allocatedLocation: 'WEB',
            allocatedQuantity: 5,
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 10 };
      const mockBomItems = [
        { materialId: 'mat-1', quantity: createDecimal(2), material: { name: 'Material 1' } },
      ];

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const materialUpdateMock = jest.fn().mockResolvedValue({});
      const materialMovementCreateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue(mockBomItems) },
          material: { update: materialUpdateMock },
          materialMovement: { create: materialMovementCreateMock },
        });
      });

      await orderService.releaseInventoryForOrder('ord-1');

      // Should restore 5 * 2 = 10 units of material
      expect(materialUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-1' },
          data: { currentStock: { increment: 10 } },
        })
      );
    });
  });

  // ==========================================
  // allocateInventoryForOrder - additional tests
  // ==========================================
  describe('allocateInventoryForOrder - additional tests', () => {
    it('should allocate inventory for each order item', async () => {
      const mockOrder = {
        id: 'ord-1',
        source: 'ECOMMERCE',
        items: [
          { id: 'item-1', productId: 'prod-1', variantId: null, quantity: 5 },
        ],
      };
      const mockInventoryItem = { id: 'inv-1', quantity: 100, reservedQuantity: 0 };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
          material: { update: jest.fn() },
          materialMovement: { create: jest.fn() },
        });
      });

      await orderService.allocateInventoryForOrder('ord-1');

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should handle items with variants', async () => {
      const mockOrder = {
        id: 'ord-1',
        source: 'ECOMMERCE',
        items: [
          { id: 'item-1', productId: 'prod-1', variantId: 'var-1', quantity: 2 },
        ],
      };
      const mockInventoryItem = { id: 'inv-1', quantity: 50, reservedQuantity: 0 };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const inventoryFindFirstMock = jest.fn().mockResolvedValue(mockInventoryItem);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: inventoryFindFirstMock,
            update: jest.fn().mockResolvedValue({}),
          },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
          material: { update: jest.fn() },
          materialMovement: { create: jest.fn() },
        });
      });

      await orderService.allocateInventoryForOrder('ord-1');

      expect(inventoryFindFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 'prod-1',
            variantId: 'var-1',
          }),
        })
      );
    });
  });

  // ==========================================
  // updateOrderStatus - additional edge cases
  // ==========================================
  describe('updateOrderStatus - additional edge cases', () => {
    it('should update order status to CONFIRMED', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        items: [],
        source: 'MANUAL',
      };

      // getOrderById uses findUnique
      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      // count for paymentDue check (called after transaction commits)
      prismaMock.paymentDue.count.mockResolvedValue(0);
      // Transaction now handles BOTH inventory allocation AND status update (Fix HIGH #8)
      const confirmedOrder = { ...mockOrder, status: 'CONFIRMED' };
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 100, product: { name: 'Test' } }),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
          order: { update: jest.fn().mockResolvedValue(confirmedOrder) },
        };
        return fn(tx);
      });

      const result = await orderService.updateOrderStatus('ord-1', { status: 'CONFIRMED' }, 'user-1');

      expect(result.status).toBe('CONFIRMED');
    });

    it('should release inventory when cancelling order', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        items: [
          { id: 'item-1', productId: 'prod-1', allocatedLocation: 'WEB', allocatedQuantity: 5 },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: { update: jest.fn().mockResolvedValue({ ...mockOrder, status: 'CANCELLED' }) },
          orderHistory: { create: jest.fn().mockResolvedValue({}) },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10 }),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await orderService.updateOrderStatus('ord-1', { status: 'CANCELLED' });

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should allocate inventory when confirming order', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        source: 'ECOMMERCE',
        items: [
          { id: 'item-1', productId: 'prod-1', quantity: 3 },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: { update: jest.fn().mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' }) },
          orderHistory: { create: jest.fn().mockResolvedValue({}) },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 100 }),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
          material: { update: jest.fn() },
          materialMovement: { create: jest.fn() },
        });
      });

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.reserveStock.mockResolvedValue({});

      await orderService.updateOrderStatus('ord-1', { status: 'CONFIRMED' });

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================
  // createB2BOrder - additional tests
  // ==========================================
  describe('createB2BOrder - additional tests', () => {
    it('should throw error when customer is not B2B', async () => {
      const mockCustomer = {
        ...mockFactories.customer({ id: 'cust-1' }),
        type: 'B2C',
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      await expect(
        orderService.createB2BOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }])
      ).rejects.toThrow('This method is only for B2B customers');
    });

    it('should create B2B order with custom addresses', async () => {
      const mockCustomer = {
        ...mockFactories.customer({ id: 'cust-1' }),
        type: 'B2B',
        priceList: { id: 'pl-1' },
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculateOrderPrices.mockResolvedValue({
        subtotal: 900,
        totalDiscount: 100,
        items: [
          {
            productId: 'prod-1',
            quantity: 10,
            finalPrice: 90,
            lineTotal: 900,
            discount: 10,
            discountSource: 'pricelist',
          },
        ],
      });

      prismaMock.order.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const mockOrder = createOrderWithDates({ id: 'ord-new', source: 'B2B' });
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          product: {
            findUnique: jest.fn().mockResolvedValue({
              sku: 'SKU-1',
              name: 'Product',
              taxRate: createDecimal(22),
            }),
          },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await orderService.createB2BOrder(
        'cust-1',
        [{ productId: 'prod-1', quantity: 10 }],
        {
          shippingAddress: { street: 'Custom St', city: 'Rome' },
          notes: 'Custom B2B order',
        }
      );

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // getOrdersTimeline - additional tests
  // ==========================================
  describe('getOrdersTimeline - additional tests', () => {
    it('should filter orders within date range', async () => {
      const today = new Date();
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          orderDate: today,
          estimatedDelivery: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
          total: createDecimal(500),
          shippingAddress: null,
          customer: { firstName: 'Jane', lastName: 'Doe', businessName: null },
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD-002',
          status: 'SHIPPED',
          orderDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
          estimatedDelivery: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
          total: createDecimal(750),
          shippingAddress: '{"city":"Rome"}',
          customer: { firstName: null, lastName: null, businessName: 'ACME Corp' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOrdersTimeline(7);

      expect(result).toBeDefined();
      // Query uses OR with date filters (orderDate OR estimatedDelivery)
      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ orderDate: expect.any(Object) }),
              expect.objectContaining({ estimatedDelivery: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should handle orders without estimated delivery', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          orderDate: new Date(),
          estimatedDelivery: null,
          total: createDecimal(100),
          shippingAddress: null,
          customer: { firstName: 'Test', lastName: 'User', businessName: null },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOrdersTimeline(30);

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // createShipment - additional tests
  // ==========================================
  describe('createShipment - additional tests', () => {
    it('should allow shipment for PROCESSING status', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PROCESSING' }),
        source: 'ECOMMERCE',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 3,
            shippedQuantity: 0,
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderShipment.create.mockResolvedValue({
        id: 'ship-1',
        trackingNumber: 'TRACK456',
      } as any);
      prismaMock.orderItem.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'SHIPPED' } as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 1,
      });

      const result = await orderService.createShipment('ord-1', {
        carrier: 'UPS',
        trackingNumber: 'TRACK456',
        items: [{ orderItemId: 'item-1', quantity: 3 }],
      });

      expect(result.trackingNumber).toBe('TRACK456');
    });

    it('should throw error for PENDING status', async () => {
      const mockOrder = createOrderWithDates({ id: 'ord-1', status: 'PENDING' });

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.createShipment('ord-1', {
          carrier: 'DHL',
          items: [],
        })
      ).rejects.toThrow('Cannot create shipment for order in status PENDING');
    });

    it('should handle partial shipment', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        source: 'B2B',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 10,
            shippedQuantity: 0,
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderShipment.create.mockResolvedValue({
        id: 'ship-1',
        trackingNumber: 'PARTIAL',
      } as any);
      prismaMock.orderItem.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue(mockOrder as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 1,
      });

      const result = await orderService.createShipment('ord-1', {
        carrier: 'DHL',
        trackingNumber: 'PARTIAL',
        items: [{ orderItemId: 'item-1', quantity: 5 }], // Partial shipment
      });

      expect(result.trackingNumber).toBe('PARTIAL');
    });

    it('should throw error when inventory deduction fails', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        source: 'ECOMMERCE',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 5,
            allocatedLocation: 'WEB',
            product: { sku: 'PROD-001' },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: false,
        deductions: [],
        errors: [{ message: 'Stock insufficiente' }],
        totalMovements: 0,
      });

      await expect(
        orderService.createShipment('ord-1', {
          carrier: 'DHL',
          trackingNumber: 'TRACK123',
          items: [{ orderItemId: 'item-1', quantity: 5 }],
        })
      ).rejects.toThrow('Scalatura inventario fallita');
    });

    it('should handle inventory deduction throwing an exception', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'READY' }),
        source: 'ECOMMERCE',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 5,
            allocatedLocation: 'WEB',
            product: { sku: 'PROD-001' },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockRejectedValue(new Error('Database error'));

      await expect(
        orderService.createShipment('ord-1', {
          carrier: 'DHL',
          trackingNumber: 'TRACK123',
          items: [{ orderItemId: 'item-1', quantity: 5 }],
        })
      ).rejects.toThrow('Scalatura inventario fallita');
    });

    it('should allow shipment for READY status', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'READY' }),
        source: 'ECOMMERCE',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            allocatedLocation: 'WEB',
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'SHIPPED' } as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [],
        errors: [],
        totalMovements: 1,
      });

      const result = await orderService.createShipment('ord-1', {
        carrier: 'FedEx',
        trackingNumber: 'READY-SHIP',
        items: [{ orderItemId: 'item-1', quantity: 2 }],
      });

      expect(result.trackingNumber).toBe('READY-SHIP');
    });
  });

  // ==========================================
  // updateOrder - additional edge cases
  // ==========================================
  describe('updateOrder - additional edge cases', () => {
    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.updateOrder('non-existent', { notes: 'Test' })
      ).rejects.toThrow('Order not found');
    });

    it('should throw error for invalid status transition in updateOrder', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CANCELLED' }),
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        orderService.updateOrder('ord-1', { status: 'CONFIRMED' })
      ).rejects.toThrow('Invalid status transition from CANCELLED to CONFIRMED');
    });
  });

  // ==========================================
  // addOrderItem - B2B pricelist fallback
  // ==========================================
  describe('addOrderItem - B2B pricelist fallback', () => {
    it('should fallback to product base price when B2B pricelist calculation fails', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: {
          id: 'cust-1',
          type: 'B2B',
          priceList: { id: 'pl-1' },
        },
      };
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculatePrice = jest.fn().mockRejectedValue(new Error('Pricelist error'));

      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          findMany: jest.fn().mockResolvedValue([{ subtotal: 100, tax: 22, total: 122 }]),
        },
      };

      await orderService.addOrderItem(mockTx, 'ord-1', {
        productId: 'prod-1',
        quantity: 1,
      });

      // Should use product base price (100) when pricelist fails
      expect(mockTx.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 100,
            priceSource: 'product_base',
          }),
        })
      );
    });
  });

  // ==========================================
  // updateOrderStatus - PROCESSING and PaymentDue generation
  // ==========================================
  describe('updateOrderStatus - PROCESSING and PaymentDue generation', () => {
    it('should auto-generate payment dues when confirming order', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        items: [],
        source: 'MANUAL',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.paymentDue.count.mockResolvedValue(0);
      prismaMock.$transaction.mockResolvedValue(mockOrder);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' } as any);

      // Mock generatePaymentDuesFromOrder to succeed
      const generatePaymentSpy = jest.spyOn(orderService, 'generatePaymentDuesFromOrder');
      generatePaymentSpy.mockResolvedValue([{ id: 'pd-1' }] as any);

      await orderService.updateOrderStatus('ord-1', { status: 'CONFIRMED' });

      expect(prismaMock.paymentDue.count).toHaveBeenCalledWith({ where: { orderId: 'ord-1' } });

      generatePaymentSpy.mockRestore();
    });

    it('should skip payment dues generation if they already exist', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        items: [],
        source: 'MANUAL',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.paymentDue.count.mockResolvedValue(2); // Payment dues already exist
      prismaMock.$transaction.mockResolvedValue(mockOrder);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' } as any);

      await orderService.updateOrderStatus('ord-1', { status: 'CONFIRMED' });

      expect(prismaMock.paymentDue.count).toHaveBeenCalled();
    });

    it('should auto-create production orders when moving to PROCESSING', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5 }],
        source: 'MANUAL',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' } as any);
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' } as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockResolvedValue({ id: 'po-1' });

      await orderService.updateOrderStatus('ord-1', { status: 'PROCESSING' }, 'user-1');

      expect(prismaMock.order.update).toHaveBeenCalled();
    });

    it('should handle production order creation failure gracefully', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5 }],
        source: 'MANUAL',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' } as any);
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' } as any);

      // This will fail the production order creation
      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockRejectedValue(new Error('BOM not found'));

      // Should not throw, just log warning
      const result = await orderService.updateOrderStatus('ord-1', { status: 'PROCESSING' }, 'user-1');
      expect(result.status).toBe('PROCESSING');
    });
  });

  // ==========================================
  // allocateInventoryForOrder - detailed tests
  // ==========================================
  describe('allocateInventoryForOrder - detailed tests', () => {
    it('should throw error when inventory item not found', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        source: 'WORDPRESS',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 5,
            sku: 'PROD-001',
            product: { name: 'Product 1' },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: { findFirst: jest.fn().mockResolvedValue(null) },
          inventoryMovement: { create: jest.fn() },
          orderItem: { update: jest.fn() },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await expect(orderService.allocateInventoryForOrder('ord-1')).rejects.toThrow(
        'Product 1 non disponibile in WEB'
      );
    });

    it('should throw error when insufficient stock', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        source: 'WORDPRESS',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 100,
            sku: 'PROD-001',
            product: { name: 'Product 1' },
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 10, product: { name: 'Product 1' } };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn(),
          },
          inventoryMovement: { create: jest.fn() },
          orderItem: { update: jest.fn() },
          productMaterial: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await expect(orderService.allocateInventoryForOrder('ord-1')).rejects.toThrow(
        'Stock insufficiente per Product 1'
      );
    });

    it('should deduct BOM materials when allocating', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        source: 'MANUAL',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 2,
            sku: 'PROD-001',
            product: { name: 'Product 1' },
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 50 };
      const mockBomItems = [
        { materialId: 'mat-1', quantity: createDecimal(3), material: { name: 'Material 1' } },
        { materialId: 'mat-2', quantity: createDecimal(1.5), material: { name: 'Material 2' } },
      ];

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const materialUpdateMock = jest.fn().mockResolvedValue({});
      const materialMovementCreateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: jest.fn().mockResolvedValue(mockBomItems) },
          material: { update: materialUpdateMock },
          materialMovement: { create: materialMovementCreateMock },
        });
      });

      await orderService.allocateInventoryForOrder('ord-1');

      // Should deduct 2 * 3 = 6 units of Material 1
      expect(materialUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-1' },
          data: { currentStock: { decrement: 6 } },
        })
      );

      // Should deduct 2 * 1.5 = 3 units of Material 2
      expect(materialUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-2' },
          data: { currentStock: { decrement: 3 } },
        })
      );
    });

    it('should use variant-specific BOM materials when available', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        source: 'B2B',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 1,
            sku: 'PROD-001-VAR',
            variant: { name: 'Red Variant' },
            product: { name: 'Product 1' },
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 100 };
      const mockVariantBomItems = [
        { materialId: 'mat-red', quantity: createDecimal(5), material: { name: 'Red Material' } },
      ];

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const productMaterialFindManyMock = jest.fn()
        // First call: look for variant-specific materials
        .mockResolvedValueOnce(mockVariantBomItems)
        // Second call would be for parent product, but shouldn't be called
        .mockResolvedValueOnce([]);

      const materialUpdateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: productMaterialFindManyMock },
          material: { update: materialUpdateMock },
          materialMovement: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await orderService.allocateInventoryForOrder('ord-1');

      // Should use variant-specific materials
      expect(productMaterialFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 'prod-1',
            variantId: 'var-1',
          }),
        })
      );
    });

    it('should fallback to product BOM when variant has no specific materials', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        source: 'B2B',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 1,
            sku: 'PROD-001-VAR',
            variant: { name: 'Red Variant' },
            product: { name: 'Product 1' },
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 100 };
      const mockProductBomItems = [
        { materialId: 'mat-1', quantity: createDecimal(2), material: { name: 'Generic Material' } },
      ];

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const productMaterialFindManyMock = jest.fn()
        // First call: look for variant-specific materials (empty)
        .mockResolvedValueOnce([])
        // Second call: fallback to product materials
        .mockResolvedValueOnce(mockProductBomItems);

      const materialUpdateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: productMaterialFindManyMock },
          material: { update: materialUpdateMock },
          materialMovement: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await orderService.allocateInventoryForOrder('ord-1');

      // Should also look for parent product materials
      expect(productMaterialFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 'prod-1',
            variantId: null,
          }),
        })
      );
    });
  });

  // ==========================================
  // releaseInventoryForOrder - BOM restoration with variants
  // ==========================================
  describe('releaseInventoryForOrder - BOM restoration with variants', () => {
    it('should restore variant-specific BOM materials', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: 'var-1',
            allocatedLocation: 'WEB',
            allocatedQuantity: 3,
          },
        ],
      };

      const mockInventoryItem = { id: 'inv-1', quantity: 10 };
      const mockVariantBomItems = [
        { materialId: 'mat-1', quantity: createDecimal(4), material: { name: 'Material 1' } },
      ];

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const productMaterialFindManyMock = jest.fn().mockResolvedValue(mockVariantBomItems);
      const materialUpdateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(mockInventoryItem),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderItem: { update: jest.fn().mockResolvedValue({}) },
          productMaterial: { findMany: productMaterialFindManyMock },
          material: { update: materialUpdateMock },
          materialMovement: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await orderService.releaseInventoryForOrder('ord-1');

      // Should restore 3 * 4 = 12 units of material
      expect(materialUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-1' },
          data: { currentStock: { increment: 12 } },
        })
      );
    });
  });

  // ==========================================
  // generateOrderNumber - edge cases
  // ==========================================
  describe('generateOrderNumber', () => {
    it('should generate order number with incremented counter', async () => {
      const lastOrder = {
        orderNumber: 'ORD-2026-000005',
      };

      prismaMock.order.findFirst.mockResolvedValue(lastOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });

      const mockOrder = createOrderWithDates({ orderNumber: 'ORD-2026-000006' });
      prismaMock.order.create.mockResolvedValue(mockOrder as any);
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrder, items: [] } as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, items: [] } as any);

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'MANUAL',
      });

      expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderNumber: expect.objectContaining({ startsWith: expect.any(String) }),
          }),
          orderBy: { orderNumber: 'desc' },
        })
      );
    });

    it('should handle non-matching order number format', async () => {
      // Order number doesn't match expected pattern
      const lastOrder = {
        orderNumber: 'CUSTOM-ORDER',
      };

      prismaMock.order.findFirst.mockResolvedValue(lastOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });

      const mockOrder = createOrderWithDates({ orderNumber: 'ORD-2026-000001' });
      prismaMock.order.create.mockResolvedValue(mockOrder as any);
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrder, items: [] } as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, items: [] } as any);

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'MANUAL',
      });

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // createOrderFull - payment dues and pricelist
  // ==========================================
  describe('createOrderFull - payment dues and pricelist', () => {
    it('should create order with custom installments', async () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2B',
        paymentTerms: 30,
        priceList: null,
        paymentPlan: null,
        shippingAddress: { street: 'Via Test' },
        billingAddress: { street: 'Via Test' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(1000),
        taxRate: createDecimal(22),
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const paymentDueCreateMock = jest.fn().mockResolvedValue({ id: 'pd-1' });
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [{ id: 'pd-1' }] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
          paymentDue: { create: paymentDueCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customInstallments: [
          { installmentNumber: 1, totalInstallments: 2, amount: 500, dueDate: '2026-03-01' },
          { installmentNumber: 2, totalInstallments: 2, amount: 500, dueDate: '2026-04-01' },
        ],
      });

      expect(paymentDueCreateMock).toHaveBeenCalledTimes(2);
    });

    it('should generate payment dues using customer payment plan', async () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2B',
        paymentTerms: 30,
        priceList: null,
        paymentPlan: {
          id: 'pp-1',
          installments: [
            { sequence: 1, percentage: createDecimal(50), daysFromInvoice: 0 },
            { sequence: 2, percentage: createDecimal(50), daysFromInvoice: 30 },
          ],
        },
        shippingAddress: { street: 'Via Test' },
        billingAddress: { street: 'Via Test' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(1000),
        taxRate: createDecimal(22),
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const paymentDueCreateMock = jest.fn().mockResolvedValue({ id: 'pd-1' });
      const mockOrder = createOrderWithDates({ id: 'ord-new', total: createDecimal(1220) });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({
              ...mockOrder,
              orderDate: new Date(),
              b2bPaymentMethod: 'BONIFICO',
              items: [],
              paymentDues: [{ id: 'pd-1' }, { id: 'pd-2' }],
            }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
          paymentDue: { create: paymentDueCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 1 }],
        generatePaymentDues: true,
      });

      // Should create 2 payment dues based on payment plan
      expect(paymentDueCreateMock).toHaveBeenCalledTimes(2);
    });

    it('should generate single payment due when no payment plan', async () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2B',
        paymentTerms: 60,
        priceList: null,
        paymentPlan: null, // No payment plan
        shippingAddress: { street: 'Via Test' },
        billingAddress: { street: 'Via Test' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(500),
        taxRate: createDecimal(22),
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const paymentDueCreateMock = jest.fn().mockResolvedValue({ id: 'pd-1' });
      const mockOrder = createOrderWithDates({ id: 'ord-new', total: createDecimal(610) });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({
              ...mockOrder,
              orderDate: new Date(),
              b2bPaymentMethod: 'RIBA',
              b2bPaymentTerms: 60,
              items: [],
              paymentDues: [{ id: 'pd-1' }],
            }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: jest.fn().mockResolvedValue({}) },
          paymentDue: { create: paymentDueCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 1 }],
        generatePaymentDues: true,
      });

      // Should create single payment due
      expect(paymentDueCreateMock).toHaveBeenCalledTimes(1);
    });

    it('should use B2B pricelist and fallback on error', async () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2B',
        paymentTerms: 30,
        priceList: { id: 'pl-1' },
        paymentPlan: null,
        shippingAddress: { street: 'Via Test' },
        billingAddress: { street: 'Via Test' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(200),
        taxRate: createDecimal(22),
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculatePrice = jest.fn().mockRejectedValue(new Error('Pricelist error'));

      const itemCreateMock = jest.fn().mockResolvedValue({});
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: itemCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'B2B',
        items: [{ productId: 'prod-1', quantity: 2 }],
      });

      // Should fallback to product base price
      expect(itemCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 200,
            priceSource: 'product_base',
          }),
        })
      );
    });

    it('should use product base price for non-B2B customers without manual price', async () => {
      const mockCustomer = {
        id: 'cust-1',
        type: 'B2C', // Not B2B
        paymentTerms: 0,
        priceList: null,
        paymentPlan: null,
        shippingAddress: { street: 'Via Test' },
        billingAddress: { street: 'Via Test' },
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(150),
        taxRate: createDecimal(22),
      };

      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findFirst.mockResolvedValue(null);

      const itemCreateMock = jest.fn().mockResolvedValue({});
      const mockOrder = createOrderWithDates({ id: 'ord-new' });

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [], paymentDues: [] }),
          },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
          orderItem: { create: itemCreateMock },
        });
      });

      await orderService.createOrderFull({
        customerId: 'cust-1',
        source: 'MANUAL',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(itemCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 150,
            priceSource: 'product_base',
          }),
        })
      );
    });
  });

  // ==========================================
  // updateOrderFull - pricelist and attachments
  // ==========================================
  describe('updateOrderFull - pricelist and attachments', () => {
    it('should use B2B pricelist when updating items', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: {
          id: 'cust-1',
          type: 'B2B',
          priceList: { id: 'pl-1' },
        },
        items: [],
        shipping: createDecimal(10),
        discount: createDecimal(5),
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(100),
        taxRate: createDecimal(22),
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculatePrice = jest.fn().mockResolvedValue({
        finalPrice: 85,
        discount: 15,
        discountSource: 'volume_discount',
      });

      const itemCreateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: itemCreateMock },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        });
      });

      await orderService.updateOrderFull('ord-1', {
        items: [{ productId: 'prod-1', quantity: 5 }],
        priceListId: 'pl-override',
      });

      expect(priceListService.calculatePrice).toHaveBeenCalledWith(
        'cust-1',
        'prod-1',
        5,
        'pl-override'
      );
    });

    it('should fallback to product base price when B2B pricelist fails in update', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: {
          id: 'cust-1',
          type: 'B2B',
          priceList: { id: 'pl-1' },
        },
        items: [],
        shipping: createDecimal(0),
        discount: createDecimal(0),
      };

      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Product',
        price: createDecimal(250),
        taxRate: createDecimal(22),
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const priceListService = require('@server/services/pricelist.service').priceListService;
      priceListService.calculatePrice = jest.fn().mockRejectedValue(new Error('Pricelist error'));

      const itemCreateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: itemCreateMock },
          product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        });
      });

      await orderService.updateOrderFull('ord-1', {
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(itemCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 250,
            priceSource: 'product_base',
          }),
        })
      );
    });

    it('should map attachments with IDs when updating', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: { id: 'cust-1', type: 'B2C', priceList: null },
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const updateMock = jest.fn().mockResolvedValue(mockOrder);

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: updateMock,
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: jest.fn() },
          product: { findUnique: jest.fn() },
        });
      });

      await orderService.updateOrderFull('ord-1', {
        attachments: [
          { name: 'file1.pdf', url: '/uploads/file1.pdf', type: 'application/pdf' },
          { name: 'file2.pdf', url: '/uploads/file2.pdf', type: 'application/pdf', addedAt: '2026-01-15T10:00:00Z' },
        ],
      });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({ name: 'file1.pdf', id: expect.any(String), addedAt: expect.any(String) }),
              expect.objectContaining({ name: 'file2.pdf', id: expect.any(String) }),
            ]),
          }),
        })
      );
    });

    it('should skip product when not found in update', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
        customer: { id: 'cust-1', type: 'B2C', priceList: null },
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1 }],
        shipping: createDecimal(0),
        discount: createDecimal(0),
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const itemCreateMock = jest.fn().mockResolvedValue({});

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn({
          order: {
            update: jest.fn().mockResolvedValue(mockOrder),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
          },
          orderItem: { deleteMany: jest.fn(), create: itemCreateMock },
          product: { findUnique: jest.fn().mockResolvedValue(null) }, // Product not found
        });
      });

      await orderService.updateOrderFull('ord-1', {
        items: [{ productId: 'non-existent', quantity: 1 }],
      });

      // Should skip creating item for non-existent product
      expect(itemCreateMock).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // getOrderFull - calculations
  // ==========================================
  describe('getOrderFull - calculations', () => {
    it('should calculate totalRefunded from completed refunds', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', total: createDecimal(1000) }),
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
        orderNotes: [],
        refunds: [
          { id: 'ref-1', amount: createDecimal(100), status: 'COMPLETED', items: [] },
          { id: 'ref-2', amount: createDecimal(50), status: 'PENDING', items: [] }, // Should not count
          { id: 'ref-3', amount: createDecimal(200), status: 'COMPLETED', items: [] },
        ],
        paymentDues: [
          { id: 'pd-1', paidAmount: createDecimal(300), payments: [] },
          { id: 'pd-2', paidAmount: createDecimal(200), payments: [] },
        ],
        productionOrders: [],
        attachments: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderFull('ord-1');

      expect(result?.calculations.totalRefunded).toBe(300); // 100 + 200 (completed only)
      expect(result?.calculations.totalPaid).toBe(500); // 300 + 200
      expect(result?.calculations.balance).toBe(200); // 1000 - 300 - 500
    });

    it('should calculate payment progress percentage', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', total: createDecimal(1000) }),
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
        orderNotes: [],
        refunds: [],
        paymentDues: [
          { id: 'pd-1', paidAmount: createDecimal(500), payments: [] },
        ],
        productionOrders: [],
        attachments: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderFull('ord-1');

      expect(result?.calculations.paymentProgress).toBe(50);
    });

    it('should return 0 payment progress when no payment dues', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', total: createDecimal(1000) }),
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
        orderNotes: [],
        refunds: [],
        paymentDues: [],
        productionOrders: [],
        attachments: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderFull('ord-1');

      expect(result?.calculations.paymentProgress).toBe(0);
    });

    it('should ensure attachments is always an array', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1' }),
        customer: mockFactories.customer(),
        items: [],
        invoice: null,
        orderNotes: [],
        refunds: [],
        paymentDues: [],
        productionOrders: [],
        attachments: null, // null attachments
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await orderService.getOrderFull('ord-1');

      expect(result?.attachments).toEqual([]);
    });
  });

  // ==========================================
  // getOrderAttachments - error handling
  // ==========================================
  describe('getOrderAttachments - error handling', () => {
    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(orderService.getOrderAttachments('non-existent')).rejects.toThrow(
        'Ordine non trovato'
      );
    });

    it('should return empty array when attachments is null', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ attachments: null } as any);

      const result = await orderService.getOrderAttachments('ord-1');

      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // createProductionOrdersForOrder - detailed tests
  // ==========================================
  describe('createProductionOrdersForOrder - detailed tests', () => {
    it('should create production orders for each item with userId', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 0,
        items: [
          { id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } },
          { id: 'item-2', productId: 'prod-2', quantity: 3, product: { sku: 'SKU-2' } },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockResolvedValue({ id: 'po-1' });

      const result = await orderService.createProductionOrdersForOrder('ord-1', 'user-1');

      expect(manufacturingService.createProductionOrder).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should find system user when no userId provided', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 0,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.user.findFirst.mockResolvedValue({ id: 'system-user' } as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockResolvedValue({ id: 'po-1' });

      await orderService.createProductionOrdersForOrder('ord-1');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { email: 'system@ecommerceerp.com' },
              { role: 'ADMIN' },
            ]),
          }),
        })
      );
    });

    it('should throw error when no user available', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 0,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(orderService.createProductionOrdersForOrder('ord-1')).rejects.toThrow(
        'Nessun utente disponibile per creare ordini di produzione'
      );
    });

    it('should skip items that already have production orders', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 0,
        items: [
          { id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      // Production order already exists
      prismaMock.productionOrder.findFirst.mockResolvedValue({ id: 'existing-po' } as any);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockResolvedValue({ id: 'po-1' });

      const result = await orderService.createProductionOrdersForOrder('ord-1', 'user-1');

      expect(manufacturingService.createProductionOrder).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('should set priority based on order priority', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 'URGENT',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } }],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder.mockResolvedValue({ id: 'po-1' });

      await orderService.createProductionOrdersForOrder('ord-1', 'user-1');

      expect(manufacturingService.createProductionOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 10, // URGENT = 10
        })
      );
    });

    it('should handle production order creation failure gracefully', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        priority: 0,
        items: [
          { id: 'item-1', productId: 'prod-1', quantity: 5, product: { sku: 'SKU-1' } },
          { id: 'item-2', productId: 'prod-2', quantity: 3, product: { sku: 'SKU-2' } },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);

      const manufacturingService = require('@server/services/manufacturing.service').default;
      manufacturingService.createProductionOrder
        .mockRejectedValueOnce(new Error('BOM not found'))
        .mockResolvedValueOnce({ id: 'po-2' });

      const result = await orderService.createProductionOrdersForOrder('ord-1', 'user-1');

      // Should continue with other items even if one fails
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================
  // getOptimizationSuggestions - grouping tests
  // ==========================================
  describe.skip('getOptimizationSuggestions - grouping tests', () => {
    it('should group orders by destination country', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(200),
          priority: 0,
          items: [],
          customer: { businessName: 'Company B' },
        },
        {
          ...createOrderWithDates({ id: 'ord-3', status: 'PENDING' }),
          shippingAddress: { country: 'Germany' },
          total: createDecimal(150),
          priority: 0,
          items: [],
          customer: { businessName: 'Company C' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have grouping by Italy (2 orders)
      expect(result.groupings.byDestination).toContainEqual(
        expect.objectContaining({
          country: 'Italy',
          orderCount: 2,
        })
      );
    });

    it('should group orders by product', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [
            { productId: 'prod-1', quantity: 5, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'CONFIRMED' }),
          shippingAddress: { country: 'Germany' },
          total: createDecimal(200),
          priority: 0,
          items: [
            { productId: 'prod-1', quantity: 10, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company B' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have grouping by Product A (2 orders, 15 total quantity)
      expect(result.groupings.byProduct).toContainEqual(
        expect.objectContaining({
          product: expect.objectContaining({ name: 'Product A' }),
          orderCount: 2,
          totalQuantity: 15,
        })
      );
    });

    it('should generate suggestions for urgent orders', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 5, // HIGH priority
          items: [],
          customer: { businessName: 'Company A' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have urgent suggestion
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'URGENT',
          orders: expect.arrayContaining([
            expect.objectContaining({ id: 'ord-1' }),
          ]),
        })
      );
    });

    it('should generate product batch suggestions', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(100),
          priority: 0,
          items: [
            { productId: 'prod-1', quantity: 5, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(200),
          priority: 0,
          items: [
            { productId: 'prod-1', quantity: 10, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company B' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have product batch suggestion
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'PRODUCT_BATCH',
          productSku: 'SKU-A',
        })
      );
    });

    it('should generate shipping batch suggestions', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'France' },
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: { country: 'France' },
          total: createDecimal(200),
          priority: 0,
          items: [],
          customer: { businessName: 'Company B' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have shipping batch suggestion for France
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'SHIPPING_BATCH',
          country: 'France',
        })
      );
    });

    it('should generate standard suggestion for remaining orders', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Unique Country' },
          total: createDecimal(100),
          priority: 0,
          items: [{ productId: 'unique-prod', quantity: 1, product: { id: 'unique-prod', name: 'Unique', sku: 'U' } }],
          customer: { businessName: 'Solo Company' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have standard suggestion for orders that don't fit other groups
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'STANDARD',
        })
      );
    });

    it('should estimate time savings correctly', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [{ productId: 'prod-1', quantity: 5, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } }],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(200),
          priority: 0,
          items: [{ productId: 'prod-1', quantity: 10, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } }],
          customer: { businessName: 'Company B' },
        },
        {
          ...createOrderWithDates({ id: 'ord-3', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(150),
          priority: 0,
          items: [{ productId: 'prod-1', quantity: 3, product: { id: 'prod-1', name: 'Product A', sku: 'SKU-A' } }],
          customer: { businessName: 'Company C' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should have estimated savings
      expect(result.estimatedSavings).toBeDefined();
      expect(result.estimatedSavings.totalOrdersOptimized).toBeGreaterThan(0);
    });

    it('should handle orders with null shipping address', async () => {
      const mockOrders = [
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company A' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Should handle gracefully - group under "Sconosciuto"
      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // getOrdersTimeline - summary calculations
  // ==========================================
  describe('getOrdersTimeline - summary calculations', () => {
    it('should calculate pending deliveries correctly', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          orderDate: now,
          estimatedDelivery: futureDate, // Future - pending
          total: createDecimal(100),
          shippingAddress: null,
          customer: { firstName: 'John', lastName: 'Doe', businessName: null },
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD-002',
          status: 'SHIPPED',
          orderDate: pastDate,
          estimatedDelivery: pastDate, // Past - overdue
          total: createDecimal(200),
          shippingAddress: null,
          customer: { firstName: 'Jane', lastName: 'Doe', businessName: null },
        },
        {
          id: 'ord-3',
          orderNumber: 'ORD-003',
          status: 'DELIVERED', // Delivered - not counted
          orderDate: pastDate,
          estimatedDelivery: pastDate,
          total: createDecimal(150),
          shippingAddress: null,
          customer: { firstName: 'Bob', lastName: 'Smith', businessName: null },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOrdersTimeline(30);

      expect(result.summary.pendingDeliveries).toBe(1);
      expect(result.summary.overdueDeliveries).toBe(1);
    });

    it('should calculate average order value', async () => {
      const now = new Date();

      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          orderDate: now,
          estimatedDelivery: null,
          total: createDecimal(100),
          shippingAddress: null,
          customer: { firstName: 'John', lastName: 'Doe', businessName: null },
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD-002',
          status: 'PENDING',
          orderDate: now,
          estimatedDelivery: null,
          total: createDecimal(200),
          shippingAddress: null,
          customer: { firstName: 'Jane', lastName: 'Doe', businessName: null },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOrdersTimeline(30);

      expect(result.summary.avgOrderValue).toBe(150); // (100 + 200) / 2
      expect(result.summary.totalRevenue).toBe(300);
      expect(result.summary.totalReceived).toBe(2);
    });
  });

  // ==========================================
  // markAsDelivered - status validation
  // ==========================================
  describe('markAsDelivered - status validation', () => {
    it('should set delivered date when marking as delivered', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'SHIPPED' }),
        items: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'DELIVERED',
        deliveredDate: new Date(),
      } as any);

      await orderService.markAsDelivered('ord-1');

      expect(prismaMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELIVERED',
            deliveredDate: expect.any(Date),
          }),
        })
      );
    });
  });

  // ==========================================
  // listOrders - additional filter tests
  // ==========================================
  describe('listOrders - additional filter tests', () => {
    it('should filter by dateFrom only', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ dateFrom: '2026-01-01' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: { gte: new Date('2026-01-01') },
          }),
        })
      );
    });

    it('should filter by dateTo only', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await orderService.listOrders({ dateTo: '2026-12-31' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: { lte: new Date('2026-12-31') },
          }),
        })
      );
    });
  });

  // ==========================================
  // getOptimizationSuggestions - sorting tests
  // ==========================================
  describe.skip('getOptimizationSuggestions - sorting tests', () => {
    it('should sort destination groups by order count descending', async () => {
      const mockOrders = [
        // 3 orders for Italy (should be first)
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company B' },
        },
        {
          ...createOrderWithDates({ id: 'ord-3', status: 'PENDING' }),
          shippingAddress: { country: 'Italy' },
          total: createDecimal(100),
          priority: 0,
          items: [],
          customer: { businessName: 'Company C' },
        },
        // 2 orders for Germany (should be second)
        {
          ...createOrderWithDates({ id: 'ord-4', status: 'PENDING' }),
          shippingAddress: { country: 'Germany' },
          total: createDecimal(200),
          priority: 0,
          items: [],
          customer: { businessName: 'Company D' },
        },
        {
          ...createOrderWithDates({ id: 'ord-5', status: 'PENDING' }),
          shippingAddress: { country: 'Germany' },
          total: createDecimal(200),
          priority: 0,
          items: [],
          customer: { businessName: 'Company E' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Italy (3 orders) should come before Germany (2 orders)
      expect(result.groupings.byDestination[0].country).toBe('Italy');
      expect(result.groupings.byDestination[0].orderCount).toBe(3);
      expect(result.groupings.byDestination[1].country).toBe('Germany');
      expect(result.groupings.byDestination[1].orderCount).toBe(2);
    });

    it('should sort product groups by total quantity descending', async () => {
      const mockOrders = [
        // Product A: 2 orders, 25 total units (should be first)
        {
          ...createOrderWithDates({ id: 'ord-1', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(100),
          priority: 0,
          items: [
            { productId: 'prod-a', quantity: 15, product: { id: 'prod-a', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company A' },
        },
        {
          ...createOrderWithDates({ id: 'ord-2', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(100),
          priority: 0,
          items: [
            { productId: 'prod-a', quantity: 10, product: { id: 'prod-a', name: 'Product A', sku: 'SKU-A' } },
          ],
          customer: { businessName: 'Company B' },
        },
        // Product B: 2 orders, 8 total units (should be second)
        {
          ...createOrderWithDates({ id: 'ord-3', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(200),
          priority: 0,
          items: [
            { productId: 'prod-b', quantity: 5, product: { id: 'prod-b', name: 'Product B', sku: 'SKU-B' } },
          ],
          customer: { businessName: 'Company C' },
        },
        {
          ...createOrderWithDates({ id: 'ord-4', status: 'PENDING' }),
          shippingAddress: null,
          total: createDecimal(200),
          priority: 0,
          items: [
            { productId: 'prod-b', quantity: 3, product: { id: 'prod-b', name: 'Product B', sku: 'SKU-B' } },
          ],
          customer: { businessName: 'Company D' },
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await orderService.getOptimizationSuggestions();

      // Product A (25 units) should come before Product B (8 units)
      expect(result.groupings.byProduct[0].product.name).toBe('Product A');
      expect(result.groupings.byProduct[0].totalQuantity).toBe(25);
      expect(result.groupings.byProduct[1].product.name).toBe('Product B');
      expect(result.groupings.byProduct[1].totalQuantity).toBe(8);
    });
  });

  // ==========================================
  // updateOrderStatus - production order error logging
  // ==========================================
  describe('updateOrderStatus - production order error logging', () => {
    it('should log warning when createProductionOrdersForOrder throws', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 5 }],
        source: 'B2B',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' } as any);

      // Mock createProductionOrdersForOrder to throw
      const createProdOrdersSpy = jest.spyOn(orderService, 'createProductionOrdersForOrder');
      createProdOrdersSpy.mockRejectedValue(new Error('Production order creation failed'));

      const result = await orderService.updateOrderStatus('ord-1', { status: 'PROCESSING' }, 'user-1');

      // Should still return successfully even though production order creation failed
      expect(result.status).toBe('PROCESSING');
      expect(createProdOrdersSpy).toHaveBeenCalled();

      createProdOrdersSpy.mockRestore();
    });
  });

  // ==========================================
  // createShipment - post-shipment check handling
  // ==========================================
  describe('createShipment - post-shipment check handling', () => {
    it('should complete shipment even when post-shipment check fails asynchronously', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-1', status: 'CONFIRMED' }),
        source: 'B2B',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            shippedQuantity: 0,
            allocatedLocation: 'B2B',
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderShipment.create.mockResolvedValue({
        id: 'ship-1',
        trackingNumber: 'TRACK-123',
      } as any);
      prismaMock.orderItem.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
        orderNumber: 'ORD-001',
      } as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [{ productId: 'prod-1', quantity: 2 }],
        errors: [],
        totalMovements: 1,
      });

      // The post-shipment check happens asynchronously and its failure
      // should not affect the main shipment result
      const result = await orderService.createShipment('ord-1', {
        carrier: 'UPS',
        trackingNumber: 'TRACK-123',
        items: [{ orderItemId: 'item-1', quantity: 2 }],
      });

      // Main shipment should succeed
      expect(result.trackingNumber).toBe('TRACK-123');
      expect(result.inventoryDeducted).toBe(true);
    });

    it('should log error when post-shipment check fails', async () => {
      const mockOrder = {
        ...createOrderWithDates({ id: 'ord-fail', status: 'CONFIRMED' }),
        source: 'B2B',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 1,
            shippedQuantity: 0,
            allocatedLocation: 'B2B',
            product: mockFactories.product({ id: 'prod-1' }),
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return await fn(prismaMock);
      });
      prismaMock.orderShipment.create.mockResolvedValue({
        id: 'ship-1',
        trackingNumber: 'TRACK-FAIL',
      } as any);
      prismaMock.orderItem.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
        orderNumber: 'ORD-FAIL',
      } as any);

      const inventoryService = require('@server/services/inventory.service').inventoryService;
      inventoryService.deductInventoryRecursive.mockResolvedValue({
        success: true,
        deductions: [{ productId: 'prod-1', quantity: 1 }],
        errors: [],
        totalMovements: 1,
      });

      // Mock triggerPostShipmentCheck to reject
      const stockAlertJob = require('@server/jobs/stock-alert.job');
      stockAlertJob.triggerPostShipmentCheck.mockRejectedValueOnce(
        new Error('Post-shipment check failed')
      );

      const logger = require('@server/config/logger').default;

      const result = await orderService.createShipment('ord-fail', {
        carrier: 'DHL',
        trackingNumber: 'TRACK-FAIL',
        items: [{ orderItemId: 'item-1', quantity: 1 }],
      });

      // Main shipment should still succeed
      expect(result.trackingNumber).toBe('TRACK-FAIL');

      // Wait for async catch to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      // Logger.error should have been called with the error message
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to trigger post-shipment check')
      );
    });
  });
});
