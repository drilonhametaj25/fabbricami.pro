/**
 * Order Lifecycle E2E Tests
 * End-to-end tests for order management workflow
 *
 * Tests:
 * 1. Order creation (B2B and B2C)
 * 2. Order listing and filtering
 * 3. Status transitions
 * 4. Item management
 * 5. Shipment creation
 * 6. Order cancellation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the mocked prisma from the setup file
import { prisma as mockPrisma } from '@server/config/database';

// Mock pricelist service
vi.mock('@server/services/pricelist.service', () => ({
  priceListService: {
    calculatePrice: vi.fn().mockResolvedValue({
      finalPrice: 100,
      discount: 10,
      discountSource: 'pricelist',
    }),
    calculateOrderPrices: vi.fn().mockImplementation(async (customerId: string, items: any[]) => ({
      items: items.map((item, index) => ({
        productId: item.productId,
        quantity: item.quantity,
        finalPrice: 90,
        discount: 10,
        lineTotal: 90 * item.quantity,
        discountSource: 'pricelist',
      })),
      subtotal: items.reduce((sum, item) => sum + 90 * item.quantity, 0),
      totalDiscount: items.length * 10,
    })),
  },
}));

// Mock inventory service
vi.mock('@server/services/inventory.service', () => ({
  inventoryService: {
    allocateStock: vi.fn().mockResolvedValue(true),
    releaseStock: vi.fn().mockResolvedValue(true),
    deductStock: vi.fn().mockResolvedValue(true),
    checkAvailability: vi.fn().mockResolvedValue({ available: true, quantity: 100 }),
  },
}));

// Mock stock-alert job
vi.mock('@server/jobs/stock-alert.job', () => ({
  triggerPostShipmentCheck: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import { default as orderService } from '@server/services/order.service';

// Mock data
const mockCustomer = {
  id: 'cust-1',
  code: 'CUST001',
  businessName: 'Test Company',
  firstName: 'John',
  lastName: 'Doe',
  type: 'B2B',
  email: 'customer@test.com',
  priceList: { id: 'pl-1', code: 'WHOLESALE', name: 'Wholesale' },
  discount: 0,
};

const mockProduct = {
  id: 'prod-1',
  sku: 'SKU001',
  name: 'Test Product',
  price: { toNumber: () => 100 },
  taxRate: { toNumber: () => 22 },
};

const mockOrder = {
  id: 'ord-1',
  orderNumber: 'ORD-2026-00001',
  customerId: 'cust-1',
  status: 'PENDING',
  source: 'B2B',
  subtotal: { toNumber: () => 200 },
  discount: { toNumber: () => 0 },
  tax: { toNumber: () => 44 },
  shipping: { toNumber: () => 10 },
  total: { toNumber: () => 254 },
  orderDate: new Date('2026-02-15'),
  customer: mockCustomer,
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Test Product',
      sku: 'SKU001',
      quantity: 2,
      unitPrice: { toNumber: () => 100 },
      discount: { toNumber: () => 0 },
      taxRate: { toNumber: () => 22 },
      subtotal: { toNumber: () => 200 },
      tax: { toNumber: () => 44 },
      total: { toNumber: () => 244 },
      product: mockProduct,
    },
  ],
};

describe('Order Lifecycle E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Don't use vi.resetAllMocks() as it resets the $transaction implementation
  // vi.clearAllMocks() is sufficient to clear call data between tests

  describe('List Orders', () => {
    it('should list orders with pagination', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await orderService.listOrders({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(mockPrisma.order.findMany).toHaveBeenCalled();
    });

    it('should filter orders by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      await orderService.listOrders({ status: ['PENDING', 'CONFIRMED'] });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
        })
      );
    });

    it('should filter orders by customer', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      await orderService.listOrders({ customerId: 'cust-1' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should filter orders by date range', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await orderService.listOrders({
        dateFrom: '2026-01-01',
        dateTo: '2026-02-28',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('Get Order', () => {
    it('should retrieve order by ID', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await orderService.getOrderById('ord-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ord-1');
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          include: expect.objectContaining({
            customer: true,
            items: expect.any(Object),
          }),
        })
      );
    });

    it('should return null for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await orderService.getOrderById('ord-not-found');

      expect(result).toBeNull();
    });
  });

  describe('Create Order', () => {
    it('should create order with PENDING status', async () => {
      // generateOrderNumber() calls order.findFirst to get last order number
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.order.create.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        items: [],
      });
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      mockPrisma.order.update.mockResolvedValue(mockOrder);

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'B2B',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            source: 'B2B',
            status: 'PENDING',
          }),
        })
      );
    });

    it('should auto-generate order number', async () => {
      // generateOrderNumber() calls order.findFirst to get last order number
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, items: [] });
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      mockPrisma.order.update.mockResolvedValue(mockOrder);

      await orderService.createOrder({
        customerId: 'cust-1',
        source: 'B2B',
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: expect.stringMatching(/ORD-\d{4}-\d{5}/),
          }),
        })
      );
    });
  });

  describe('Create B2B Order', () => {
    it('should create B2B order with automatic pricing', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.create.mockResolvedValue(mockOrder.items[0]);
      mockPrisma.order.update.mockResolvedValue(mockOrder);

      const result = await orderService.createB2BOrder(
        'cust-1',
        [{ productId: 'prod-1', quantity: 2 }]
      );

      expect(result.order).toBeDefined();
      expect(result.priceDetails).toBeDefined();
    });

    it('should throw error for non-B2B customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        type: 'B2C',
      });

      await expect(
        orderService.createB2BOrder('cust-1', [{ productId: 'prod-1', quantity: 2 }])
      ).rejects.toThrow('This method is only for B2B customers');
    });

    it('should throw error for non-existent customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        orderService.createB2BOrder('cust-not-found', [{ productId: 'prod-1', quantity: 2 }])
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('Update Order', () => {
    it('should update order fields', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        notes: 'Updated notes',
      });

      const result = await orderService.updateOrder('ord-1', {
        notes: 'Updated notes',
      });

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw error for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.updateOrder('ord-not-found', { notes: 'Test' })
      ).rejects.toThrow('Order not found');
    });
  });

  describe('Order Status Transitions', () => {
    it('should allow PENDING to CONFIRMED transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantity: 100,
        reservedQuantity: 0,
      });
      mockPrisma.inventoryItem.update.mockResolvedValue({});
      mockPrisma.inventoryMovement.create.mockResolvedValue({});
      mockPrisma.orderItem.update.mockResolvedValue({});
      // Mock BOM materials lookup (no materials for this product)
      mockPrisma.productMaterial.findMany.mockResolvedValue([]);

      const result = await orderService.updateOrderStatus('ord-1', {
        status: 'CONFIRMED',
      });

      expect(result.status).toBe('CONFIRMED');
    });

    it('should allow CONFIRMED to PROCESSING transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PROCESSING',
      });

      const result = await orderService.updateOrderStatus('ord-1', {
        status: 'PROCESSING',
      });

      expect(result.status).toBe('PROCESSING');
    });

    it('should reject invalid status transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });

      await expect(
        orderService.updateOrderStatus('ord-1', { status: 'DELIVERED' })
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow cancellation from PENDING', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const result = await orderService.updateOrderStatus('ord-1', {
        status: 'CANCELLED',
      });

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('Order Item Management', () => {
    it('should add item to order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.create.mockResolvedValue({
        id: 'item-new',
        productId: 'prod-1',
        quantity: 1,
        unitPrice: 100,
      });
      mockPrisma.orderItem.findMany.mockResolvedValue(mockOrder.items);
      mockPrisma.order.update.mockResolvedValue(mockOrder);

      const result = await orderService.addOrderItem(mockPrisma, 'ord-1', {
        productId: 'prod-1',
        quantity: 1,
      });

      expect(result).toBeDefined();
      expect(mockPrisma.orderItem.create).toHaveBeenCalled();
    });

    it('should remove item from order', async () => {
      const updatedOrder = {
        ...mockOrder,
        items: [],
      };
      // The removeOrderItem uses $transaction which calls our mock callback
      // Inside the transaction, it calls: orderItem.delete, recalculateTotals (findMany, findUnique, update), then order.findUnique
      mockPrisma.orderItem.delete.mockResolvedValue({});
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      mockPrisma.order.findUnique.mockResolvedValue(updatedOrder);
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await orderService.removeOrderItem('ord-1', 'item-1');

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(0);
      expect(mockPrisma.orderItem.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
        })
      );
    });

    it('should throw error when adding item to non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.addOrderItem(mockPrisma, 'ord-not-found', {
          productId: 'prod-1',
          quantity: 1,
        })
      ).rejects.toThrow('Order not found');
    });
  });

  describe('Price Preview', () => {
    it('should preview B2B order prices', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await orderService.previewB2BOrderPrices(
        'cust-1',
        [{ productId: 'prod-1', quantity: 2 }]
      );

      expect(result.customer).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBeDefined();
    });

    it('should throw error for non-existent customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        orderService.previewB2BOrderPrices('cust-not-found', [{ productId: 'prod-1', quantity: 2 }])
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('Full Order Lifecycle', () => {
    it('should complete full lifecycle: PENDING → CONFIRMED → PROCESSING → READY → SHIPPED → DELIVERED', async () => {
      // Correct workflow: PENDING → CONFIRMED → PROCESSING → READY → SHIPPED → DELIVERED
      // Note: PROCESSING cannot go directly to SHIPPED (must go through READY)
      const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED'];
      let currentStatus = 'PENDING';

      // Mock BOM materials lookup (no materials for this product) - needed for all transitions
      mockPrisma.productMaterial.findMany.mockResolvedValue([]);

      for (let i = 1; i < statuses.length; i++) {
        const nextStatus = statuses[i];

        mockPrisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: currentStatus,
        });
        mockPrisma.order.update.mockResolvedValue({
          ...mockOrder,
          status: nextStatus,
        });

        // Mock additional calls for specific transitions
        if (nextStatus === 'CONFIRMED') {
          mockPrisma.inventoryItem.findFirst.mockResolvedValue({
            id: 'inv-1',
            quantity: 100,
            reservedQuantity: 0,
          });
          mockPrisma.inventoryItem.update.mockResolvedValue({});
          mockPrisma.inventoryMovement.create.mockResolvedValue({});
          mockPrisma.orderItem.update.mockResolvedValue({});
        }

        if (nextStatus === 'SHIPPED') {
          mockPrisma.inventoryItem.findMany.mockResolvedValue([{
            id: 'inv-1',
            productId: 'prod-1',
            quantity: 100,
            reservedQuantity: 2,
          }]);
          mockPrisma.inventoryMovement.create.mockResolvedValue({});
        }

        const result = await orderService.updateOrderStatus('ord-1', {
          status: nextStatus as any,
        });

        expect(result.status).toBe(nextStatus);
        currentStatus = nextStatus;
      }
    });
  });

  describe('Order Source Handling', () => {
    it('should create order from WEB source', async () => {
      const webOrder = {
        ...mockOrder,
        source: 'WEB',
        items: [],
      };
      // generateOrderNumber() calls order.findFirst to get last order number
      mockPrisma.order.findFirst.mockResolvedValue(null);
      // createOrder uses $transaction which calls our mock callback
      // Inside: order.create, then recalculateTotals (orderItem.findMany, order.findUnique, order.update)
      mockPrisma.order.create.mockResolvedValue(webOrder);
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      mockPrisma.order.findUnique.mockResolvedValue(webOrder);
      mockPrisma.order.update.mockResolvedValue(webOrder);

      const result = await orderService.createOrder({
        customerId: 'cust-1',
        source: 'WEB',
      });

      expect(result).toBeDefined();
      expect(result.source).toBe('WEB');
    });

    it('should filter orders by source', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      await orderService.listOrders({ source: 'B2B' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'B2B',
          }),
        })
      );
    });
  });
});
