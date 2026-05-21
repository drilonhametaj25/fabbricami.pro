import '../helpers/tenant-mock';
/**
 * Suggestion Engine Service Tests
 * Comprehensive tests for intelligent suggestion generation and management
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';

// Mock dependencies before importing the service
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

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

import { suggestionEngineService } from '@server/services/suggestion-engine.service';

describe('SuggestionEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  const createMockSuggestion = (overrides: any = {}) => ({
    id: 'sug-1',
    type: 'REORDER',
    priority: 'MEDIUM',
    status: 'PENDING',
    title: 'Reorder Product',
    description: 'Product needs reordering',
    actionLabel: 'Create PO',
    actionUrl: '/purchase-orders/new',
    productId: 'prod-1',
    materialId: null,
    supplierId: null,
    customerId: null,
    orderId: null,
    data: {},
    potentialSaving: null,
    potentialRevenue: null,
    dismissedBy: null,
    dismissedAt: null,
    dismissReason: null,
    actedBy: null,
    actedAt: null,
    expiresAt: createMockDate(14),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==========================================
  // RUN ALL ALGORITHMS TESTS
  // ==========================================

  describe('runAllAlgorithms', () => {
    it('should run all algorithms and return created count', async () => {
      // Mock cleanup
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      // Mock all raw queries to return empty arrays
      prismaMock.$queryRaw.mockResolvedValue([]);

      // Mock invoice query for payment due
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Mock suggestion exists check
      prismaMock.suggestion.findFirst.mockResolvedValue(null);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      expect(prismaMock.suggestion.deleteMany).toHaveBeenCalled();
    });

    it('should capture errors from individual algorithms', async () => {
      // Mock cleanup
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      // Mock first algorithm to throw
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Database error'));
      // Subsequent calls succeed
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Errore algoritmo');
    });
  });

  // ==========================================
  // LIST SUGGESTIONS TESTS
  // ==========================================

  describe('list', () => {
    it('should return paginated suggestions', async () => {
      const suggestions = [
        createMockSuggestion({ id: 'sug-1' }),
        createMockSuggestion({ id: 'sug-2' }),
      ];

      prismaMock.suggestion.findMany.mockResolvedValue(suggestions as any);
      prismaMock.suggestion.count.mockResolvedValue(2);

      const result = await suggestionEngineService.list({
        page: 1,
        limit: 50,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      prismaMock.suggestion.findMany.mockResolvedValue([]);
      prismaMock.suggestion.count.mockResolvedValue(0);

      await suggestionEngineService.list({
        status: 'ACTED',
      });

      expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTED',
          }),
        })
      );
    });

    it('should filter by type', async () => {
      prismaMock.suggestion.findMany.mockResolvedValue([]);
      prismaMock.suggestion.count.mockResolvedValue(0);

      await suggestionEngineService.list({
        type: 'STOCKOUT_ALERT',
      });

      expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'STOCKOUT_ALERT',
          }),
        })
      );
    });

    it('should filter by priority', async () => {
      prismaMock.suggestion.findMany.mockResolvedValue([]);
      prismaMock.suggestion.count.mockResolvedValue(0);

      await suggestionEngineService.list({
        priority: 'HIGH',
      });

      expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: 'HIGH',
          }),
        })
      );
    });

    it('should include related entities', async () => {
      const suggestions = [
        {
          ...createMockSuggestion(),
          product: { id: 'prod-1', name: 'Test Product', sku: 'PROD001' },
          material: null,
          supplier: null,
        },
      ];

      prismaMock.suggestion.findMany.mockResolvedValue(suggestions as any);
      prismaMock.suggestion.count.mockResolvedValue(1);

      const result = await suggestionEngineService.list({});

      expect(result.items[0].product).toBeDefined();
    });
  });

  // ==========================================
  // DISMISS TESTS
  // ==========================================

  describe('dismiss', () => {
    it('should dismiss a suggestion', async () => {
      const dismissedSuggestion = {
        ...createMockSuggestion(),
        status: 'DISMISSED',
        dismissedBy: 'user-1',
        dismissedAt: new Date(),
        dismissReason: 'Not relevant',
      };

      prismaMock.suggestion.update.mockResolvedValue(dismissedSuggestion as any);

      await suggestionEngineService.dismiss('sug-1', 'user-1', 'Not relevant');

      expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: {
          status: 'DISMISSED',
          dismissedBy: 'user-1',
          dismissedAt: expect.any(Date),
          dismissReason: 'Not relevant',
        },
      });
    });

    it('should dismiss without reason', async () => {
      prismaMock.suggestion.update.mockResolvedValue(createMockSuggestion() as any);

      await suggestionEngineService.dismiss('sug-1', 'user-1');

      expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: expect.objectContaining({
          status: 'DISMISSED',
          dismissedBy: 'user-1',
          dismissReason: undefined,
        }),
      });
    });
  });

  // ==========================================
  // MARK ACTED TESTS
  // ==========================================

  describe('markActed', () => {
    it('should mark a suggestion as acted upon', async () => {
      const actedSuggestion = {
        ...createMockSuggestion(),
        status: 'ACTED',
        actedBy: 'user-1',
        actedAt: new Date(),
      };

      prismaMock.suggestion.update.mockResolvedValue(actedSuggestion as any);

      await suggestionEngineService.markActed('sug-1', 'user-1');

      expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: {
          status: 'ACTED',
          actedBy: 'user-1',
          actedAt: expect.any(Date),
        },
      });
    });
  });

  // ==========================================
  // GET STATS TESTS
  // ==========================================

  describe('getStats', () => {
    it('should return suggestion statistics', async () => {
      prismaMock.suggestion.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30); // pending

      prismaMock.suggestion.groupBy
        .mockResolvedValueOnce([
          { type: 'REORDER', _count: 10 },
          { type: 'STOCKOUT_ALERT', _count: 8 },
          { type: 'DEAD_STOCK', _count: 5 },
        ] as any)
        .mockResolvedValueOnce([
          { priority: 'HIGH', _count: 15 },
          { priority: 'MEDIUM', _count: 10 },
          { priority: 'LOW', _count: 5 },
        ] as any);

      const result = await suggestionEngineService.getStats();

      expect(result.total).toBe(100);
      expect(result.pending).toBe(30);
      expect(result.byType).toEqual({
        REORDER: 10,
        STOCKOUT_ALERT: 8,
        DEAD_STOCK: 5,
      });
      expect(result.byPriority).toEqual({
        HIGH: 15,
        MEDIUM: 10,
        LOW: 5,
      });
    });

    it('should return empty stats when no suggestions', async () => {
      prismaMock.suggestion.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.suggestion.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await suggestionEngineService.getStats();

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.byPriority).toEqual({});
    });
  });

  // ==========================================
  // ALGORITHM-SPECIFIC TESTS
  // ==========================================

  describe('Stockout Alert Generation', () => {
    it('should generate stockout alerts for critical products', async () => {
      // Mock cleanup
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      // Mock stockout query returns products with critical stock
      const criticalProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Test Product',
          sku: 'PROD001',
          total_stock: 0,
          min_stock: 10,
          reorder_point: 20,
          cost: 50,
        },
      ];

      // First call is stockout, rest return empty
      prismaMock.$queryRaw
        .mockResolvedValueOnce(criticalProducts) // stockout
        .mockResolvedValue([]); // other algorithms

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'STOCKOUT_ALERT',
          priority: 'CRITICAL',
          productId: 'prod-1',
        }),
      });
    });

    it('should not duplicate existing stockout alerts', async () => {
      // Mock cleanup
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const criticalProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Test Product',
          sku: 'PROD001',
          total_stock: 5,
          min_stock: 10,
          reorder_point: 20,
          cost: 50,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(criticalProducts)
        .mockResolvedValue([]);

      // Existing suggestion found
      prismaMock.suggestion.findFirst.mockResolvedValue(createMockSuggestion({ type: 'STOCKOUT_ALERT' }) as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      // Should not create new suggestion
      expect(prismaMock.suggestion.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'STOCKOUT_ALERT',
          productId: 'prod-1',
        }),
      });
    });
  });

  describe('Reorder Suggestion Generation', () => {
    it('should generate reorder suggestions based on sales velocity', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      // Empty for stockout
      const reorderProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Fast Seller',
          sku: 'FAST001',
          total_stock: 15,
          reorder_point: 20,
          min_stock: 5,
          total_sold: 90,
          avg_daily_sales: 3,
          days_until_stockout: 5,
          suggested_quantity: 90,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce(reorderProducts) // reorder
        .mockResolvedValue([]); // others

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'REORDER',
          priority: 'HIGH', // 5 days until stockout
          productId: 'prod-1',
        }),
      });
    });
  });

  describe('Margin Alert Generation', () => {
    it('should generate alerts for low margin products', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const lowMarginProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Low Margin Item',
          sku: 'LOW001',
          cost: 90,
          price: 100,
          margin: 10,
          margin_percent: 10,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce(lowMarginProducts) // margin
        .mockResolvedValue([]); // others

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'MARGIN_ALERT',
          productId: 'prod-1',
        }),
      });
    });
  });

  describe('Dead Stock Alert Generation', () => {
    it('should generate alerts for products without sales', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const deadStockProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Dead Stock Item',
          sku: 'DEAD001',
          total_stock: 100,
          stock_value: 5000,
          last_sale_date: null,
          days_since_last_sale: 999,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce([]) // trend
        .mockResolvedValueOnce(deadStockProducts) // dead stock
        .mockResolvedValue([]); // others

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DEAD_STOCK',
          priority: 'HIGH', // value > 1000
          productId: 'prod-1',
          potentialSaving: 5000,
        }),
      });
    });
  });

  describe('Trend Detection', () => {
    it('should detect upward trends', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const trendData = [
        {
          product_id: 'prod-1',
          product_name: 'Trending Up',
          sku: 'TREND001',
          current_period_sales: 100,
          previous_period_sales: 50,
          change_percent: 100, // +100%
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce(trendData) // trend
        .mockResolvedValue([]); // others

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TREND_UP',
          priority: 'HIGH', // >= 50%
          productId: 'prod-1',
        }),
      });
    });

    it('should detect downward trends', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const trendData = [
        {
          product_id: 'prod-1',
          product_name: 'Trending Down',
          sku: 'TREND001',
          current_period_sales: 50,
          previous_period_sales: 100,
          change_percent: -50, // -50%
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce(trendData) // trend
        .mockResolvedValue([]); // others

      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TREND_DOWN',
          priority: 'HIGH',
          productId: 'prod-1',
        }),
      });
    });
  });

  describe('Payment Due Suggestions', () => {
    it('should generate payment due reminders', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.$queryRaw.mockResolvedValue([]); // All raw queries empty

      const upcomingInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'FV-2026-001',
          customerId: 'cust-1',
          total: createDecimal(1000),
          paidAmount: createDecimal(0),
          dueDate: createMockDate(3),
          customer: {
            id: 'cust-1',
            businessName: 'Test Customer',
            firstName: null,
            lastName: null,
          },
        },
      ];

      prismaMock.invoice.findMany.mockResolvedValue(upcomingInvoices as any);
      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYMENT_DUE',
          customerId: 'cust-1',
          orderId: 'inv-1',
        }),
      });
    });
  });

  describe('Supplier Issue Suggestions', () => {
    it('should generate supplier delay alerts', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const supplierDelays = [
        {
          supplier_id: 'sup-1',
          supplier_name: 'Slow Supplier',
          late_orders: 5,
          avg_delay_days: 10,
          total_pending_value: 10000,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce([]) // trend
        .mockResolvedValueOnce([]) // dead stock
        .mockResolvedValueOnce([]) // batch production
        .mockResolvedValueOnce([]) // order grouping
        .mockResolvedValueOnce(supplierDelays); // supplier issue

      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SUPPLIER_ISSUE',
          priority: 'HIGH', // late_orders >= 3
          supplierId: 'sup-1',
        }),
      });
    });
  });

  describe('Batch Production Suggestions', () => {
    it('should suggest batch production for shared materials', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const batchOpportunities = [
        {
          material_id: 'mat-1',
          material_name: 'Shared Material',
          material_sku: 'MAT001',
          material_stock: 500,
          products_count: 3,
          product_names: 'Product A, Product B, Product C',
          total_needed: 300,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce([]) // trend
        .mockResolvedValueOnce([]) // dead stock
        .mockResolvedValueOnce(batchOpportunities) // batch production
        .mockResolvedValue([]); // others

      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BATCH_PRODUCTION',
          materialId: 'mat-1',
        }),
      });
    });
  });

  describe('Order Grouping Suggestions', () => {
    it('should suggest grouping orders from same supplier', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 0 });

      const groupingOpportunities = [
        {
          supplier_id: 'sup-1',
          supplier_name: 'Bulk Supplier',
          products_count: 4,
          product_names: 'Product A, Product B, Product C, Product D',
          total_value: 5000,
          min_order_value: 4000,
        },
      ];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // stockout
        .mockResolvedValueOnce([]) // reorder
        .mockResolvedValueOnce([]) // margin
        .mockResolvedValueOnce([]) // trend
        .mockResolvedValueOnce([]) // dead stock
        .mockResolvedValueOnce([]) // batch production
        .mockResolvedValueOnce(groupingOpportunities) // order grouping
        .mockResolvedValue([]); // others

      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.suggestion.findFirst.mockResolvedValue(null);
      prismaMock.suggestion.create.mockResolvedValue(createMockSuggestion() as any);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'ORDER_GROUPING',
          supplierId: 'sup-1',
          potentialSaving: 20, // Free shipping when above min
        }),
      });
    });
  });

  // ==========================================
  // CLEANUP TESTS
  // ==========================================

  describe('Suggestion Cleanup', () => {
    it('should cleanup expired suggestions on algorithm run', async () => {
      prismaMock.suggestion.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.suggestion.updateMany.mockResolvedValue({ count: 3 });
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      expect(prismaMock.suggestion.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      });

      expect(prismaMock.suggestion.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'PENDING',
          createdAt: expect.any(Object),
        }),
        data: {
          status: 'EXPIRED',
        },
      });
    });
  });
});
