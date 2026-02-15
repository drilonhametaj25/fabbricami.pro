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
  describe('getOptimizationSuggestions', () => {
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
});
