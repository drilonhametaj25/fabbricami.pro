/**
 * Supplier E2E Tests
 * Tests for supplier API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mocks before module resolution
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      supplier: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      supplierItem: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      supplierVolumeDiscount: {
        create: vi.fn(),
      },
      purchaseOrder: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
      },
      goodsReceipt: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      material: {
        findUnique: vi.fn(),
      },
      supplierScorecard: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

// Mock modules before imports
vi.mock('@server/config/database', () => {
  return {
    prisma: mockPrisma,
  };
});

vi.mock('@server/config/logger', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return {
    logger,
    default: logger,
  };
});

// Import after mocks
import supplierService from '@server/services/supplier.service';
import { prisma } from '@server/config/database';

// Helper to create decimal-like objects
const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
  toFixed: (digits: number) => value.toFixed(digits),
});

describe('Supplier API E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supplier Performance', () => {
    it('should return complete performance metrics', async () => {
      // The service uses findUnique with include for purchaseOrders and goodsReceipts
      const mockSupplier = {
        id: 'sup-1',
        code: 'SUP001',
        businessName: 'Test Supplier',
        onTimeDeliveryRate: createDecimal(92),
        qualityRating: createDecimal(88),
        avgDeliveryDays: 6,
        totalDeliveries: 50,
        lateDeliveries: 4,
        defectiveDeliveries: 2,
        // Include relations that the service expects
        purchaseOrders: [
          {
            id: 'po-1',
            expectedDeliveryDate: new Date('2026-01-10'),
            receivedDate: new Date('2026-01-10'),
            orderDate: new Date('2026-01-01'),
          },
          {
            id: 'po-2',
            expectedDeliveryDate: new Date('2026-01-15'),
            receivedDate: new Date('2026-01-14'),
            orderDate: new Date('2026-01-05'),
          },
        ],
        goodsReceipts: [
          { inspectionStatus: 'PASSED', items: [] },
        ],
      };

      vi.mocked(prisma.supplier.findUnique).mockResolvedValue(mockSupplier as any);

      // Mock for calculateCostMetrics which uses aggregate and count
      vi.mocked(prisma.purchaseOrder.aggregate).mockResolvedValue({
        _sum: { total: createDecimal(25000) },
        _count: 10,
        _avg: { total: createDecimal(2500) },
      } as any);
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(10);

      // Mock for getPerformanceTrend
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);

      const result = await supplierService.getSupplierPerformance('sup-1');

      expect(result).toHaveProperty('currentMetrics');
      expect(result).toHaveProperty('calculatedMetrics');
      expect(result.currentMetrics.onTimeDeliveryRate).toBe(92);
      expect(result.currentMetrics.qualityRating).toBe(88);
    });

    it('should throw error for non-existent supplier', async () => {
      vi.mocked(prisma.supplier.findUnique).mockResolvedValue(null);

      await expect(
        supplierService.getSupplierPerformance('non-existent')
      ).rejects.toThrow('Fornitore non trovato');
    });
  });

  describe('Supplier Catalog', () => {
    it('should return catalog with volume discounts', async () => {
      const mockCatalog = [
        {
          id: 'item-1',
          supplierId: 'sup-1',
          productId: 'prod-1',
          lastPurchasePrice: createDecimal(50),
          avgPurchasePrice: createDecimal(48),
          leadTimeDays: 7,
          isPreferred: true,
          product: { id: 'prod-1', name: 'Product 1', sku: 'SKU001' },
          volumeDiscounts: [
            { minQuantity: 10, discountPercent: createDecimal(5) },
            { minQuantity: 50, discountPercent: createDecimal(10) },
          ],
        },
      ];

      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockCatalog as any);

      const result = await supplierService.getSupplierCatalog('sup-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].volumeDiscounts).toHaveLength(2);
    });
  });

  describe('Price Suggestions', () => {
    it('should return price suggestions with scoring', async () => {
      const mockSupplierItems = [
        {
          id: 'item-1',
          supplierId: 'sup-1',
          lastPurchasePrice: createDecimal(100),
          avgPurchasePrice: createDecimal(95),
          leadTimeDays: 5,
          isPreferred: true,
          minOrderQuantity: 1,
          packagingUnit: 1,
          supplier: {
            id: 'sup-1',
            code: 'SUP001',
            businessName: 'Supplier A',
            onTimeDeliveryRate: createDecimal(95),
            qualityRating: createDecimal(90),
            avgDeliveryDays: 5,
            defaultLeadTimeDays: 7,
          },
          volumeDiscounts: [],
        },
        {
          id: 'item-2',
          supplierId: 'sup-2',
          lastPurchasePrice: createDecimal(90),
          avgPurchasePrice: createDecimal(92),
          leadTimeDays: 10,
          isPreferred: false,
          minOrderQuantity: 1,
          packagingUnit: 1,
          supplier: {
            id: 'sup-2',
            code: 'SUP002',
            businessName: 'Supplier B',
            onTimeDeliveryRate: createDecimal(80),
            qualityRating: createDecimal(85),
            avgDeliveryDays: 10,
            defaultLeadTimeDays: 14,
          },
          volumeDiscounts: [],
        },
      ];

      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 1);

      expect(result).toHaveProperty('suggestions');
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toHaveProperty('overallScore');
      // Service returns 'recommended' not 'recommendation'
      expect(result).toHaveProperty('recommended');
    });

    it('should apply volume discounts', async () => {
      const mockSupplierItems = [
        {
          id: 'item-1',
          supplierId: 'sup-1',
          lastPurchasePrice: createDecimal(100),
          avgPurchasePrice: createDecimal(100),
          leadTimeDays: 5,
          isPreferred: true,
          minOrderQuantity: 1,
          packagingUnit: 1,
          supplier: {
            id: 'sup-1',
            code: 'SUP001',
            businessName: 'Supplier A',
            onTimeDeliveryRate: createDecimal(90),
            qualityRating: createDecimal(90),
            avgDeliveryDays: 5,
            defaultLeadTimeDays: 7,
          },
          volumeDiscounts: [
            { minQuantity: 10, discountPercent: createDecimal(10), fixedPrice: null },
          ],
        },
      ];

      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 20);

      // With 10% discount on 100, effective price should be 90
      // Service uses 'finalPrice' not 'effectivePrice'
      expect(result.suggestions[0].finalPrice).toBeLessThan(100);
    });
  });

  describe('Supplier Comparison', () => {
    it('should compare multiple suppliers', async () => {
      // compareSuppliers calls getSupplierPerformance for each supplier
      // which uses findUnique with include for purchaseOrders and goodsReceipts
      const createMockSupplierWithRelations = (id: string, code: string, businessName: string) => ({
        id,
        code,
        businessName,
        onTimeDeliveryRate: createDecimal(95),
        qualityRating: createDecimal(90),
        avgDeliveryDays: 5,
        totalDeliveries: 10,
        lateDeliveries: 1,
        defectiveDeliveries: 0,
        purchaseOrders: [],
        goodsReceipts: [],
        supplierItems: [
          {
            productId: 'prod-1',
            lastPurchasePrice: createDecimal(100),
            avgPurchasePrice: createDecimal(95),
            volumeDiscounts: [],
          },
        ],
      });

      // Mock findUnique to return supplier based on the where clause
      vi.mocked(prisma.supplier.findUnique).mockImplementation(async (args: any) => {
        if (args.where.id === 'sup-1') {
          return createMockSupplierWithRelations('sup-1', 'SUP001', 'Supplier A') as any;
        }
        if (args.where.id === 'sup-2') {
          return createMockSupplierWithRelations('sup-2', 'SUP002', 'Supplier B') as any;
        }
        return null;
      });

      // Mock for calculateCostMetrics
      vi.mocked(prisma.purchaseOrder.aggregate).mockResolvedValue({
        _sum: { total: createDecimal(10000) },
        _count: 5,
        _avg: { total: createDecimal(2000) },
      } as any);
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(5);

      // Mock for getPerformanceTrend
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);

      const result = await supplierService.compareSuppliers(['sup-1', 'sup-2'], 'prod-1');

      // compareSuppliers returns an array, not an object with suppliers property
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      // Each item has these properties
      expect(result[0]).toHaveProperty('supplierId');
      expect(result[0]).toHaveProperty('performance');
      expect(result[0]).toHaveProperty('currentMetrics');
    });
  });

  describe('Price History', () => {
    it('should return price history with trend analysis', async () => {
      // Service uses purchaseOrder.findMany with include: { items }
      const mockOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          createdAt: new Date('2026-01-01'),
          items: [
            { productId: 'prod-1', unitPrice: createDecimal(100), quantity: 10 },
          ],
        },
        {
          id: 'po-2',
          orderNumber: 'PO-002',
          createdAt: new Date('2025-12-01'),
          items: [
            { productId: 'prod-1', unitPrice: createDecimal(105), quantity: 15 },
          ],
        },
        {
          id: 'po-3',
          orderNumber: 'PO-003',
          createdAt: new Date('2025-11-01'),
          items: [
            { productId: 'prod-1', unitPrice: createDecimal(98), quantity: 20 },
          ],
        },
      ];

      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue(mockOrders as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result).toHaveProperty('currentPrice');
      expect(result).toHaveProperty('avgPrice');
      expect(result).toHaveProperty('minPrice');
      expect(result).toHaveProperty('maxPrice');
      expect(result).toHaveProperty('trend');
      expect(['UP', 'DOWN', 'STABLE']).toContain(result.trend);
    });

    it('should detect upward price trend', async () => {
      // Latest order has higher price than average
      const mockOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          createdAt: new Date('2026-01-01'),
          items: [
            { productId: 'prod-1', unitPrice: createDecimal(110), quantity: 10 },
          ],
        },
        {
          id: 'po-2',
          orderNumber: 'PO-002',
          createdAt: new Date('2025-10-01'),
          items: [
            { productId: 'prod-1', unitPrice: createDecimal(100), quantity: 10 },
          ],
        },
      ];

      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue(mockOrders as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result.trend).toBe('UP');
    });
  });

  describe('Supplier Item Management', () => {
    it('should create/update supplier catalog item', async () => {
      // Service checks that supplier exists first
      vi.mocked(prisma.supplier.findUnique).mockResolvedValue({
        id: 'sup-1',
        code: 'SUP001',
        businessName: 'Test Supplier',
      } as any);

      // Service also checks that product exists when productId is provided
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU001',
        name: 'Test Product',
      } as any);

      vi.mocked(prisma.supplierItem.upsert).mockResolvedValue({
        id: 'item-1',
        supplierId: 'sup-1',
        productId: 'prod-1',
        lastPurchasePrice: createDecimal(50),
        leadTimeDays: 7,
        isPreferred: true,
      } as any);

      const result = await supplierService.upsertSupplierItem('sup-1', {
        productId: 'prod-1',
        lastPurchasePrice: 50,
        leadTimeDays: 7,
        isPreferred: true,
      });

      expect(vi.mocked(prisma.supplierItem.upsert)).toHaveBeenCalled();
      expect(result.supplierId).toBe('sup-1');
    });

    it('should add volume discount', async () => {
      vi.mocked(prisma.supplierVolumeDiscount.create).mockResolvedValue({
        id: 'discount-1',
        supplierItemId: 'item-1',
        minQuantity: 100,
        discountPercent: createDecimal(15),
      } as any);

      const result = await supplierService.addVolumeDiscount('item-1', {
        minQuantity: 100,
        discountPercent: 15,
      });

      expect(vi.mocked(prisma.supplierVolumeDiscount.create)).toHaveBeenCalledWith({
        data: expect.objectContaining({
          supplierItemId: 'item-1',
          minQuantity: 100,
        }),
      });
    });
  });
});
