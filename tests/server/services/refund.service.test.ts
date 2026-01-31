/**
 * Refund Service Tests
 * Tests for order refund management with inventory restock
 */

import { prismaMock, mockFactories, createDecimal } from '../__mocks__/prisma';

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock inventory service
jest.mock('@server/services/inventory.service', () => ({
  inventoryService: {
    updateStock: jest.fn(),
  },
}));

// Mock wordpress service
jest.mock('@server/services/wordpress.service', () => ({
  default: {
    createWooCommerceRefund: jest.fn().mockResolvedValue({ id: 12345 }),
  },
}));

// Import after mocks
import refundService from '@server/services/refund.service';

describe('RefundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefund', () => {
    it('should create a refund for valid order', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        status: 'DELIVERED',
        total: createDecimal(1000),
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Product 1',
            quantity: 10,
            unitPrice: createDecimal(50),
          },
        ],
        refunds: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.orderRefund.create.mockResolvedValue({
        id: 'refund-1',
        orderId: 'ord-1',
        amount: createDecimal(100),
        status: 'PENDING',
        items: [],
      } as any);
      prismaMock.orderNote.create.mockResolvedValue({} as any);

      const result = await refundService.createRefund({
        orderId: 'ord-1',
        reason: 'Product damaged',
        restockItems: true,
        items: [
          {
            orderItemId: 'item-1',
            quantity: 2,
            amount: 100,
            reason: 'Damaged',
          },
        ],
      });

      expect(result.id).toBe('refund-1');
      expect(prismaMock.orderRefund.create).toHaveBeenCalled();
      expect(prismaMock.orderNote.create).toHaveBeenCalled();
    });

    it('should reject refund for non-refundable order status', async () => {
      const mockOrder = {
        id: 'ord-1',
        status: 'PENDING', // Not a refundable status
        items: [],
        refunds: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        refundService.createRefund({
          orderId: 'ord-1',
          restockItems: true,
          items: [],
        })
      ).rejects.toThrow('Impossibile rimborsare ordine in stato PENDING');
    });

    it('should reject refund if quantity exceeds refundable', async () => {
      const mockOrder = {
        id: 'ord-1',
        status: 'DELIVERED',
        total: createDecimal(500),
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Product 1',
            quantity: 5, // Original quantity
          },
        ],
        refunds: [
          {
            items: [
              { orderItemId: 'item-1', quantity: 3 }, // Already refunded 3
            ],
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        refundService.createRefund({
          orderId: 'ord-1',
          restockItems: true,
          items: [
            {
              orderItemId: 'item-1',
              quantity: 5, // Trying to refund 5, but only 2 available
              amount: 250,
            },
          ],
        })
      ).rejects.toThrow('supera il massimo rimborsabile');
    });

    it('should reject refund if amount exceeds refundable', async () => {
      const mockOrder = {
        id: 'ord-1',
        status: 'DELIVERED',
        total: createDecimal(1000),
        items: [
          {
            id: 'item-1',
            quantity: 10,
          },
        ],
        refunds: [
          {
            status: 'COMPLETED',
            amount: createDecimal(800), // Already refunded 800
            items: [],
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(
        refundService.createRefund({
          orderId: 'ord-1',
          restockItems: true,
          items: [
            {
              orderItemId: 'item-1',
              quantity: 1,
              amount: 300, // Trying to refund 300, but only 200 available
            },
          ],
        })
      ).rejects.toThrow('supera il massimo rimborsabile');
    });

    it('should throw error for non-existent order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        refundService.createRefund({
          orderId: 'non-existent',
          restockItems: true,
          items: [],
        })
      ).rejects.toThrow('Ordine non trovato');
    });
  });

  describe('processRefund', () => {
    it('should process pending refund and restock items', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'ord-1',
        status: 'PENDING',
        amount: createDecimal(100),
        restockItems: true,
        order: {
          orderNumber: 'ORD-001',
          customer: { id: 'cust-1' },
        },
        items: [
          {
            quantity: 2,
            orderItem: {
              productId: 'prod-1',
              product: { sku: 'SKU001' },
            },
          },
        ],
      };

      const mockWarehouse = { id: 'wh-1', code: 'MAIN', isPrimary: true };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          warehouse: { findFirst: jest.fn().mockResolvedValue(mockWarehouse) },
          inventoryItem: { upsert: jest.fn().mockResolvedValue({}) },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          orderRefund: { update: jest.fn().mockResolvedValue({ ...mockRefund, status: 'COMPLETED' }) },
          orderNote: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const result = await refundService.processRefund({
        refundId: 'refund-1',
        processedBy: 'admin',
      });

      expect(result.status).toBe('COMPLETED');
    });

    it('should reject processing non-pending refund', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: 'COMPLETED', // Already processed
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);

      await expect(
        refundService.processRefund({
          refundId: 'refund-1',
          processedBy: 'admin',
        })
      ).rejects.toThrow('Impossibile processare rimborso in stato COMPLETED');
    });

    it('should throw error for non-existent refund', async () => {
      prismaMock.orderRefund.findUnique.mockResolvedValue(null);

      await expect(
        refundService.processRefund({
          refundId: 'non-existent',
          processedBy: 'admin',
        })
      ).rejects.toThrow('Rimborso non trovato');
    });
  });

  describe('cancelRefund', () => {
    it('should cancel pending refund', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'ord-1',
        status: 'PENDING',
        order: { orderNumber: 'ORD-001' },
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);
      prismaMock.orderRefund.update.mockResolvedValue({
        ...mockRefund,
        status: 'FAILED',
      } as any);
      prismaMock.orderNote.create.mockResolvedValue({} as any);

      const result = await refundService.cancelRefund(
        'refund-1',
        'Customer changed mind',
        'admin'
      );

      expect(result.status).toBe('FAILED');
    });

    it('should reject cancellation of non-pending refund', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: 'COMPLETED',
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);

      await expect(
        refundService.cancelRefund('refund-1', 'Reason', 'admin')
      ).rejects.toThrow('Impossibile annullare rimborso in stato COMPLETED');
    });
  });

  describe('getRefundableAmount', () => {
    it('should calculate refundable amounts correctly', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        total: createDecimal(1000),
        items: [
          {
            id: 'item-1',
            productName: 'Product 1',
            sku: 'SKU001',
            quantity: 10,
            unitPrice: createDecimal(50),
          },
          {
            id: 'item-2',
            productName: 'Product 2',
            sku: 'SKU002',
            quantity: 5,
            unitPrice: createDecimal(100),
          },
        ],
        refunds: [
          {
            status: 'COMPLETED',
            amount: createDecimal(200),
            items: [
              { orderItemId: 'item-1', quantity: 4 },
            ],
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await refundService.getRefundableAmount('ord-1');

      expect(result.orderTotal).toBe(1000);
      expect(result.totalRefunded).toBe(200);
      expect(result.refundableAmount).toBe(800);
      expect(result.items.length).toBe(2);

      // Item 1: 10 original - 4 refunded = 6 refundable
      const item1 = result.items.find((i: any) => i.orderItemId === 'item-1');
      expect(item1?.refundableQuantity).toBe(6);

      // Item 2: 5 original - 0 refunded = 5 refundable
      const item2 = result.items.find((i: any) => i.orderItemId === 'item-2');
      expect(item2?.refundableQuantity).toBe(5);
    });

    it('should return empty items when fully refunded', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        total: createDecimal(500),
        items: [
          {
            id: 'item-1',
            productName: 'Product 1',
            quantity: 5,
            unitPrice: createDecimal(100),
          },
        ],
        refunds: [
          {
            status: 'COMPLETED',
            amount: createDecimal(500),
            items: [
              { orderItemId: 'item-1', quantity: 5 }, // All refunded
            ],
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await refundService.getRefundableAmount('ord-1');

      expect(result.refundableAmount).toBe(0);
      expect(result.items.length).toBe(0); // No refundable items
    });
  });

  describe('listRefundsByOrder', () => {
    it('should return list of refunds for order', async () => {
      const mockRefunds = [
        {
          id: 'refund-1',
          orderId: 'ord-1',
          amount: createDecimal(100),
          status: 'COMPLETED',
          createdAt: new Date('2026-01-01'),
          items: [],
        },
        {
          id: 'refund-2',
          orderId: 'ord-1',
          amount: createDecimal(50),
          status: 'PENDING',
          createdAt: new Date('2026-01-05'),
          items: [],
        },
      ];

      prismaMock.orderRefund.findMany.mockResolvedValue(mockRefunds as any);

      const result = await refundService.listRefundsByOrder('ord-1');

      expect(result.length).toBe(2);
      expect(prismaMock.orderRefund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'ord-1' },
        })
      );
    });
  });

  describe('getRefundById', () => {
    it('should return refund with full details', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'ord-1',
        amount: createDecimal(100),
        status: 'COMPLETED',
        order: {
          customer: {
            id: 'cust-1',
            businessName: 'Test Customer',
          },
        },
        items: [
          {
            quantity: 2,
            amount: createDecimal(100),
            orderItem: {
              product: { id: 'prod-1', name: 'Product 1' },
            },
          },
        ],
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);

      const result = await refundService.getRefundById('refund-1');

      expect(result.id).toBe('refund-1');
      expect(result.order.customer.businessName).toBe('Test Customer');
    });

    it('should throw error for non-existent refund', async () => {
      prismaMock.orderRefund.findUnique.mockResolvedValue(null);

      await expect(
        refundService.getRefundById('non-existent')
      ).rejects.toThrow('Rimborso non trovato');
    });
  });

  describe('syncRefundToWooCommerce', () => {
    it('should sync refund to WooCommerce', async () => {
      const mockRefund = {
        id: 'refund-1',
        amount: createDecimal(100),
        reason: 'Product damaged',
        restockItems: true,
        wcRefundId: null,
        order: {
          id: 'ord-1',
          wordpressId: 12345,
          wcRefunds: [],
        },
        items: [
          {
            amount: createDecimal(100),
            quantity: 1,
            orderItem: {
              wcLineItemId: 67890,
            },
          },
        ],
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);
      prismaMock.orderRefund.update.mockResolvedValue({} as any);
      prismaMock.order.update.mockResolvedValue({} as any);

      const result = await refundService.syncRefundToWooCommerce('refund-1');

      expect(result.success).toBe(true);
      expect(result.wcRefundId).toBeDefined();
    });

    it('should return existing wcRefundId if already synced', async () => {
      const mockRefund = {
        id: 'refund-1',
        wcRefundId: 99999, // Already synced
        order: { wordpressId: 12345 },
        items: [],
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);

      const result = await refundService.syncRefundToWooCommerce('refund-1');

      expect(result.success).toBe(true);
      expect(result.wcRefundId).toBe(99999);
    });

    it('should return error if order not synced with WooCommerce', async () => {
      const mockRefund = {
        id: 'refund-1',
        order: { wordpressId: null }, // Not synced
        items: [],
      };

      prismaMock.orderRefund.findUnique.mockResolvedValue(mockRefund as any);

      const result = await refundService.syncRefundToWooCommerce('refund-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non sincronizzato');
    });
  });
});
