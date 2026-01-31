/**
 * Supplier E2E Tests
 * Tests for supplier API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
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
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
      },
      goodsReceipt: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

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
      const mockSupplier = {
        id: 'sup-1',
        code: 'SUP001',
        businessName: 'Test Supplier',
        onTimeDeliveryRate: createDecimal(92),
        qualityRating: createDecimal(88),
        avgDeliveryDays: 6,
        totalDeliveries: 50,
        lateDeliveries: 4,
      };

      vi.mocked(prisma.supplier.findUnique).mockResolvedValue(mockSupplier as any);
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([
        { deliveryStatus: 'DELIVERED', deliveredAt: new Date(), estimatedDeliveryDate: new Date() },
        { deliveryStatus: 'DELIVERED', deliveredAt: new Date(), estimatedDeliveryDate: new Date() },
      ] as any);
      vi.mocked(prisma.goodsReceipt.findMany).mockResolvedValue([
        { inspectionStatus: 'PASSED' },
      ] as any);
      vi.mocked(prisma.purchaseOrder.aggregate).mockResolvedValue({
        _sum: { total: createDecimal(25000) },
        _count: { id: 10 },
      } as any);

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
          supplier: {
            id: 'sup-1',
            name: 'Supplier A',
            onTimeDeliveryRate: createDecimal(95),
            qualityRating: createDecimal(90),
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
          supplier: {
            id: 'sup-2',
            name: 'Supplier B',
            onTimeDeliveryRate: createDecimal(80),
            qualityRating: createDecimal(85),
          },
          volumeDiscounts: [],
        },
      ];

      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 1);

      expect(result).toHaveProperty('suggestions');
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toHaveProperty('overallScore');
      expect(result).toHaveProperty('recommendation');
    });

    it('should apply volume discounts', async () => {
      const mockSupplierItems = [
        {
          id: 'item-1',
          supplierId: 'sup-1',
          lastPurchasePrice: createDecimal(100),
          avgPurchasePrice: createDecimal(100),
          leadTimeDays: 5,
          supplier: {
            id: 'sup-1',
            name: 'Supplier A',
            onTimeDeliveryRate: createDecimal(90),
            qualityRating: createDecimal(90),
          },
          volumeDiscounts: [
            { minQuantity: 10, discountPercent: createDecimal(10), fixedPrice: null },
          ],
        },
      ];

      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 20);

      // With 10% discount on 100, effective price should be 90
      expect(result.suggestions[0].effectivePrice).toBeLessThan(100);
    });
  });

  describe('Supplier Comparison', () => {
    it('should compare multiple suppliers', async () => {
      const mockSuppliers = [
        { id: 'sup-1', businessName: 'Supplier A', onTimeDeliveryRate: createDecimal(95), qualityRating: createDecimal(90) },
        { id: 'sup-2', businessName: 'Supplier B', onTimeDeliveryRate: createDecimal(85), qualityRating: createDecimal(92) },
      ];

      const mockItems = [
        {
          supplierId: 'sup-1',
          lastPurchasePrice: createDecimal(100),
          supplier: mockSuppliers[0],
        },
        {
          supplierId: 'sup-2',
          lastPurchasePrice: createDecimal(95),
          supplier: mockSuppliers[1],
        },
      ];

      vi.mocked(prisma.supplier.findMany).mockResolvedValue(mockSuppliers as any);
      vi.mocked(prisma.supplierItem.findMany).mockResolvedValue(mockItems as any);

      const result = await supplierService.compareSuppliers(['sup-1', 'sup-2'], 'prod-1');

      expect(result).toHaveProperty('suppliers');
      expect(result.suppliers).toHaveLength(2);
      expect(result).toHaveProperty('bestPrice');
      expect(result).toHaveProperty('bestQuality');
      expect(result).toHaveProperty('bestDelivery');
    });
  });

  describe('Price History', () => {
    it('should return price history with trend analysis', async () => {
      const mockHistory = [
        {
          id: 'poi-1',
          unitPrice: createDecimal(100),
          quantity: 10,
          purchaseOrder: {
            orderNumber: 'PO-001',
            createdAt: new Date('2026-01-01'),
          },
        },
        {
          id: 'poi-2',
          unitPrice: createDecimal(105),
          quantity: 15,
          purchaseOrder: {
            orderNumber: 'PO-002',
            createdAt: new Date('2025-12-01'),
          },
        },
        {
          id: 'poi-3',
          unitPrice: createDecimal(98),
          quantity: 20,
          purchaseOrder: {
            orderNumber: 'PO-003',
            createdAt: new Date('2025-11-01'),
          },
        },
      ];

      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue(mockHistory as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result).toHaveProperty('currentPrice');
      expect(result).toHaveProperty('avgPrice');
      expect(result).toHaveProperty('minPrice');
      expect(result).toHaveProperty('maxPrice');
      expect(result).toHaveProperty('trend');
      expect(['UP', 'DOWN', 'STABLE']).toContain(result.trend);
    });

    it('should detect upward price trend', async () => {
      const mockHistory = [
        {
          unitPrice: createDecimal(110),
          purchaseOrder: { orderNumber: 'PO-001', createdAt: new Date('2026-01-01') },
        },
        {
          unitPrice: createDecimal(100),
          purchaseOrder: { orderNumber: 'PO-002', createdAt: new Date('2025-10-01') },
        },
      ];

      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue(mockHistory as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result.trend).toBe('UP');
    });
  });

  describe('Supplier Item Management', () => {
    it('should create/update supplier catalog item', async () => {
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
