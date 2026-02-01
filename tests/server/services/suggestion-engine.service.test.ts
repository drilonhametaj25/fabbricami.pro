/**
 * Suggestion Engine Service Tests
 * Tests for intelligent suggestion algorithms
 */

// Mock logger before imports
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Prisma
jest.mock('@server/config/database', () => ({
  prisma: {
    suggestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import { suggestionEngineService } from '@server/services/suggestion-engine.service';
import { prisma } from '@server/config/database';
import { SuggestionStatus, SuggestionType, SuggestionPriority } from '@prisma/client';

describe('SuggestionEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runAllAlgorithms', () => {
    it('should run all algorithms and return results', async () => {
      // Mock cleanup
      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Mock all $queryRaw calls for each algorithm
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      // Mock invoice findMany for payment due algorithm
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      expect(result.created).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.errors)).toBe(true);

      // Verify cleanup was called
      expect(prisma.suggestion.deleteMany).toHaveBeenCalled();
      expect(prisma.suggestion.updateMany).toHaveBeenCalled();
    });

    it('should handle algorithm errors gracefully', async () => {
      // Mock cleanup
      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Mock $queryRaw to throw on first call (stockout) then return empty
      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('stockout');
    });
  });

  describe('generateStockoutAlerts', () => {
    it('should create STOCKOUT_ALERT suggestions for critical products', async () => {
      const criticalProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Test Product',
          sku: 'SKU001',
          total_stock: 0,
          min_stock: 10,
          reorder_point: 20,
          cost: 10.00,
        },
      ];

      // Mock cleanup
      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Return critical products on first $queryRaw call, empty on others
      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(criticalProducts);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-1' });

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'STOCKOUT_ALERT',
            priority: 'CRITICAL',
            productId: 'prod-1',
          }),
        })
      );
      expect(result.created).toBeGreaterThanOrEqual(1);
    });

    it('should not create duplicate suggestions', async () => {
      const criticalProducts = [
        {
          product_id: 'prod-1',
          product_name: 'Test Product',
          sku: 'SKU001',
          total_stock: 5,
          min_stock: 10,
          reorder_point: 20,
          cost: 10.00,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(criticalProducts);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      // Existing suggestion found - should skip
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-sug',
        type: 'STOCKOUT_ALERT',
        productId: 'prod-1',
        status: 'PENDING',
      });

      await suggestionEngineService.runAllAlgorithms();

      // create should not be called for this product since duplicate exists
      const createCalls = (prisma.suggestion.create as jest.Mock).mock.calls;
      const stockoutCalls = createCalls.filter(
        (call: any) => call[0]?.data?.type === 'STOCKOUT_ALERT' && call[0]?.data?.productId === 'prod-1'
      );
      expect(stockoutCalls.length).toBe(0);
    });
  });

  describe('generateReorderSuggestions', () => {
    it('should create REORDER suggestions based on sales velocity', async () => {
      const productsWithVelocity = [
        {
          product_id: 'prod-2',
          product_name: 'Fast Seller',
          sku: 'SKU002',
          total_stock: 15,
          reorder_point: 20,
          min_stock: 5,
          total_sold: 60,
          avg_daily_sales: 2.0,
          days_until_stockout: 7,
          suggested_quantity: 60,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Second call is for reorder
        if (callCount === 2) {
          return Promise.resolve(productsWithVelocity);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-2' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REORDER',
            priority: 'HIGH', // days_until_stockout <= 7
            productId: 'prod-2',
          }),
        })
      );
    });
  });

  describe('generateMarginAlerts', () => {
    it('should create MARGIN_ALERT for low margin products', async () => {
      const lowMarginProducts = [
        {
          product_id: 'prod-3',
          product_name: 'Low Margin Product',
          sku: 'SKU003',
          cost: 85,
          price: 100,
          margin: 15,
          margin_percent: 15, // Just at threshold
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Third call is for margin
        if (callCount === 3) {
          return Promise.resolve(lowMarginProducts);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-3' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'MARGIN_ALERT',
            productId: 'prod-3',
          }),
        })
      );
    });
  });

  describe('generateTrendSuggestions', () => {
    it('should create TREND_UP suggestion for products with increasing sales', async () => {
      const trendData = [
        {
          product_id: 'prod-4',
          product_name: 'Trending Product',
          sku: 'SKU004',
          current_period_sales: 100,
          previous_period_sales: 50,
          change_percent: 100, // +100%
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Fourth call is for trends
        if (callCount === 4) {
          return Promise.resolve(trendData);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-4' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'TREND_UP',
            productId: 'prod-4',
          }),
        })
      );
    });

    it('should create TREND_DOWN suggestion for products with decreasing sales', async () => {
      const trendData = [
        {
          product_id: 'prod-5',
          product_name: 'Declining Product',
          sku: 'SKU005',
          current_period_sales: 30,
          previous_period_sales: 100,
          change_percent: -70, // -70%
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 4) {
          return Promise.resolve(trendData);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-5' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'TREND_DOWN',
            productId: 'prod-5',
          }),
        })
      );
    });
  });

  describe('generateDeadStockAlerts', () => {
    it('should create DEAD_STOCK alerts for products without sales in 90+ days', async () => {
      const deadStockProducts = [
        {
          product_id: 'prod-6',
          product_name: 'Dead Stock Product',
          sku: 'SKU006',
          total_stock: 50,
          stock_value: 1500,
          last_sale_date: new Date('2024-01-01'),
          days_since_last_sale: 120,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Fifth call is for dead stock
        if (callCount === 5) {
          return Promise.resolve(deadStockProducts);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-6' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEAD_STOCK',
            priority: 'HIGH', // stock_value > 1000
            productId: 'prod-6',
            potentialSaving: 1500,
          }),
        })
      );
    });
  });

  describe('generateBatchProductionSuggestions', () => {
    it('should create BATCH_PRODUCTION suggestions for material efficiency', async () => {
      const batchOpportunities = [
        {
          material_id: 'mat-1',
          material_name: 'Common Material',
          material_sku: 'MAT001',
          material_stock: 100,
          products_count: 3,
          product_names: 'Product A, Product B, Product C',
          total_needed: 50,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Sixth call is for batch production
        if (callCount === 6) {
          return Promise.resolve(batchOpportunities);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-7' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'BATCH_PRODUCTION',
            materialId: 'mat-1',
          }),
        })
      );
    });
  });

  describe('generateOrderGroupingSuggestions', () => {
    it('should create ORDER_GROUPING suggestions for supplier efficiency', async () => {
      const groupingOpportunities = [
        {
          supplier_id: 'sup-1',
          supplier_name: 'Best Supplier',
          products_count: 4,
          product_names: 'Product A, Product B, Product C, Product D',
          total_value: 500,
          min_order_value: 400,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        // Seventh call is for order grouping
        if (callCount === 7) {
          return Promise.resolve(groupingOpportunities);
        }
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-8' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ORDER_GROUPING',
            supplierId: 'sup-1',
            potentialSaving: 20, // Free shipping achieved
          }),
        })
      );
    });
  });

  describe('generatePaymentDueSuggestions', () => {
    it('should create PAYMENT_DUE suggestions for upcoming invoice deadlines', async () => {
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 3); // Due in 3 days

      const upcomingPayments = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-2024-001',
          total: 1000,
          paidAmount: 0,
          dueDate: dueDate,
          customerId: 'cust-1',
          customer: {
            id: 'cust-1',
            businessName: 'Test Customer',
            firstName: null,
            lastName: null,
          },
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue(upcomingPayments);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-9' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PAYMENT_DUE',
            priority: 'MEDIUM', // 3 days until due
            customerId: 'cust-1',
            potentialRevenue: 1000,
          }),
        })
      );
    });
  });

  describe('generateSupplierIssueSuggestions', () => {
    it('should create SUPPLIER_ISSUE suggestions for suppliers with delays', async () => {
      const suppliersWithDelays = [
        {
          supplier_id: 'sup-2',
          supplier_name: 'Slow Supplier',
          late_orders: 5,
          avg_delay_days: 10,
          total_pending_value: 5000,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      // The supplier issue query is the last $queryRaw in the algorithm sequence
      // Return supplier data for all calls (only the supplier query will use it)
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(suppliersWithDelays);

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-10' });

      await suggestionEngineService.runAllAlgorithms();

      // Find all create calls and check if any are for SUPPLIER_ISSUE
      const createCalls = (prisma.suggestion.create as jest.Mock).mock.calls;
      const supplierIssueCall = createCalls.find(
        (call: any) => call[0]?.data?.type === 'SUPPLIER_ISSUE'
      );

      expect(supplierIssueCall).toBeDefined();
      expect(supplierIssueCall[0].data.supplierId).toBe('sup-2');
      expect(supplierIssueCall[0].data.priority).toBe('HIGH');
    });
  });

  describe('list', () => {
    it('should list suggestions with filters', async () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          type: 'STOCKOUT_ALERT' as SuggestionType,
          priority: 'HIGH' as SuggestionPriority,
          status: 'PENDING' as SuggestionStatus,
          title: 'Test Suggestion',
          description: 'Test description',
          product: { id: 'prod-1', name: 'Product', sku: 'SKU001' },
          material: null,
          supplier: null,
        },
      ];

      (prisma.suggestion.findMany as jest.Mock).mockResolvedValue(mockSuggestions);
      (prisma.suggestion.count as jest.Mock).mockResolvedValue(1);

      const result = await suggestionEngineService.list({
        status: 'PENDING',
        type: 'STOCKOUT_ALERT',
        priority: 'HIGH',
        page: 1,
        limit: 10,
      });

      expect(result.items).toEqual(mockSuggestions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should use default values for pagination', async () => {
      (prisma.suggestion.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.count as jest.Mock).mockResolvedValue(0);

      const result = await suggestionEngineService.list({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });

  describe('dismiss', () => {
    it('should mark suggestion as dismissed', async () => {
      (prisma.suggestion.update as jest.Mock).mockResolvedValue({ id: 'sug-1' });

      await suggestionEngineService.dismiss('sug-1', 'user-1', 'Not relevant');

      expect(prisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: expect.objectContaining({
          status: 'DISMISSED',
          dismissedBy: 'user-1',
          dismissReason: 'Not relevant',
        }),
      });
    });
  });

  describe('markActed', () => {
    it('should mark suggestion as acted upon', async () => {
      (prisma.suggestion.update as jest.Mock).mockResolvedValue({ id: 'sug-1' });

      await suggestionEngineService.markActed('sug-1', 'user-1');

      expect(prisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: expect.objectContaining({
          status: 'ACTED',
          actedBy: 'user-1',
        }),
      });
    });
  });

  describe('getStats', () => {
    it('should return suggestion statistics', async () => {
      (prisma.suggestion.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      (prisma.suggestion.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { type: 'STOCKOUT_ALERT', _count: 20 },
          { type: 'REORDER', _count: 15 },
        ])
        .mockResolvedValueOnce([
          { priority: 'HIGH', _count: 25 },
          { priority: 'MEDIUM', _count: 20 },
        ]);

      const stats = await suggestionEngineService.getStats();

      expect(stats.total).toBe(100);
      expect(stats.pending).toBe(50);
      expect(stats.byType).toEqual({
        STOCKOUT_ALERT: 20,
        REORDER: 15,
      });
      expect(stats.byPriority).toEqual({
        HIGH: 25,
        MEDIUM: 20,
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up expired and old suggestions', async () => {
      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await suggestionEngineService.runAllAlgorithms();

      // Verify deleteMany was called with expiration/old conditions
      expect(prisma.suggestion.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({ expiresAt: expect.any(Object) }),
            expect.objectContaining({
              status: expect.any(Object),
              updatedAt: expect.any(Object),
            }),
          ]),
        },
      });

      // Verify updateMany was called to expire old pending suggestions
      expect(prisma.suggestion.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          createdAt: expect.any(Object),
        },
        data: {
          status: 'EXPIRED',
        },
      });
    });
  });

  describe('priority assignment', () => {
    it('should assign CRITICAL priority for zero stock', async () => {
      const criticalProducts = [
        {
          product_id: 'prod-critical',
          product_name: 'Zero Stock Product',
          sku: 'SKU-ZERO',
          total_stock: 0,
          min_stock: 10,
          reorder_point: 20,
          cost: 50,
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(criticalProducts);
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-critical' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'STOCKOUT_ALERT',
            priority: 'CRITICAL',
          }),
        })
      );
    });

    it('should assign HIGH priority for margin under 5%', async () => {
      const lowMarginProducts = [
        {
          product_id: 'prod-low-margin',
          product_name: 'Very Low Margin',
          sku: 'SKU-LM',
          cost: 98,
          price: 100,
          margin: 2,
          margin_percent: 2, // Under 5%
        },
      ];

      (prisma.suggestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.suggestion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      let callCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 3) return Promise.resolve(lowMarginProducts);
        return Promise.resolve([]);
      });

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.suggestion.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.suggestion.create as jest.Mock).mockResolvedValue({ id: 'sug-lm' });

      await suggestionEngineService.runAllAlgorithms();

      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'MARGIN_ALERT',
            priority: 'HIGH',
          }),
        })
      );
    });
  });
});
