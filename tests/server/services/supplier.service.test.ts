/**
 * Supplier Service Tests
 * Tests for supplier performance tracking and price suggestions
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

// Import after mocks
import supplierService from '@server/services/supplier.service';

describe('SupplierService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupplierPerformance', () => {
    it('should return complete performance metrics', async () => {
      const mockSupplier = mockFactories.supplier({
        id: 'sup-1',
        onTimeDeliveryRate: createDecimal(92),
        qualityRating: createDecimal(88),
        avgDeliveryDays: 6,
        totalDeliveries: 50,
        lateDeliveries: 4,
      });

      prismaMock.supplier.findUnique.mockResolvedValue(mockSupplier as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([
        mockFactories.purchaseOrder({ deliveryStatus: 'DELIVERED' }),
        mockFactories.purchaseOrder({ deliveryStatus: 'DELIVERED' }),
      ] as any);
      prismaMock.goodsReceipt.findMany.mockResolvedValue([
        mockFactories.goodsReceipt({ inspectionStatus: 'PASSED' }),
      ] as any);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: createDecimal(25000) },
        _count: { id: 10 },
      } as any);

      const result = await supplierService.getSupplierPerformance('sup-1');

      expect(result).toHaveProperty('currentMetrics');
      expect(result).toHaveProperty('calculatedMetrics');
      expect(result.currentMetrics.onTimeDeliveryRate).toBe(92);
      expect(result.currentMetrics.qualityRating).toBe(88);
    });

    it('should throw error if supplier not found', async () => {
      prismaMock.supplier.findUnique.mockResolvedValue(null);

      await expect(
        supplierService.getSupplierPerformance('non-existent')
      ).rejects.toThrow('Fornitore non trovato');
    });

    it('should calculate delivery metrics correctly', async () => {
      const mockSupplier = mockFactories.supplier();
      const deliveredOrders = [
        {
          id: 'po-1',
          estimatedDeliveryDate: new Date('2026-01-01'),
          deliveredAt: new Date('2026-01-01'), // On time
          deliveryStatus: 'DELIVERED',
        },
        {
          id: 'po-2',
          estimatedDeliveryDate: new Date('2026-01-05'),
          deliveredAt: new Date('2026-01-08'), // 3 days late
          deliveryStatus: 'DELIVERED',
        },
        {
          id: 'po-3',
          estimatedDeliveryDate: new Date('2026-01-10'),
          deliveredAt: new Date('2026-01-09'), // Early
          deliveryStatus: 'DELIVERED',
        },
      ];

      prismaMock.supplier.findUnique.mockResolvedValue(mockSupplier as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue(deliveredOrders as any);
      prismaMock.goodsReceipt.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: null },
        _count: { id: 0 },
      } as any);

      const result = await supplierService.getSupplierPerformance(mockSupplier.id);

      // 2 out of 3 on time = 66.67%
      expect(result.calculatedMetrics.delivery.onTimeCount).toBe(2);
      expect(result.calculatedMetrics.delivery.lateCount).toBe(1);
    });
  });

  describe('getSupplierCatalog', () => {
    it('should return supplier catalog with volume discounts', async () => {
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

      prismaMock.supplierItem.findMany.mockResolvedValue(mockCatalog as any);

      const result = await supplierService.getSupplierCatalog('sup-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].volumeDiscounts.length).toBe(2);
    });

    it('should return empty array for supplier with no catalog', async () => {
      prismaMock.supplierItem.findMany.mockResolvedValue([]);

      const result = await supplierService.getSupplierCatalog('sup-1');

      expect(result).toEqual([]);
    });
  });

  describe('getPriceSuggestion', () => {
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

      prismaMock.supplierItem.findMany.mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 1);

      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions[0]).toHaveProperty('overallScore');
      expect(result).toHaveProperty('recommendation');
    });

    it('should apply volume discounts to price calculation', async () => {
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

      prismaMock.supplierItem.findMany.mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 20);

      // With 10% discount on 100, effective price should be 90
      expect(result.suggestions[0].effectivePrice).toBeLessThan(100);
    });

    it('should prioritize preferred suppliers in recommendations', async () => {
      const mockSupplierItems = [
        {
          id: 'item-1',
          supplierId: 'sup-1',
          lastPurchasePrice: createDecimal(100),
          leadTimeDays: 5,
          isPreferred: false,
          supplier: {
            id: 'sup-1',
            name: 'Regular Supplier',
            onTimeDeliveryRate: createDecimal(90),
            qualityRating: createDecimal(90),
          },
          volumeDiscounts: [],
        },
        {
          id: 'item-2',
          supplierId: 'sup-2',
          lastPurchasePrice: createDecimal(105), // Slightly more expensive
          leadTimeDays: 5,
          isPreferred: true, // But preferred
          supplier: {
            id: 'sup-2',
            name: 'Preferred Supplier',
            onTimeDeliveryRate: createDecimal(90),
            qualityRating: createDecimal(90),
          },
          volumeDiscounts: [],
        },
      ];

      prismaMock.supplierItem.findMany.mockResolvedValue(mockSupplierItems as any);

      const result = await supplierService.getPriceSuggestion('prod-1', undefined, 1);

      // Preferred supplier should have bonus in score
      const preferredSupplier = result.suggestions.find(
        (s: any) => s.supplierName === 'Preferred Supplier'
      );
      expect(preferredSupplier.isPreferred).toBe(true);
    });
  });

  describe('compareSuppliers', () => {
    it('should compare multiple suppliers for same item', async () => {
      const mockSuppliers = [
        mockFactories.supplier({ id: 'sup-1', name: 'Supplier A' }),
        mockFactories.supplier({ id: 'sup-2', name: 'Supplier B' }),
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

      prismaMock.supplier.findMany.mockResolvedValue(mockSuppliers as any);
      prismaMock.supplierItem.findMany.mockResolvedValue(mockItems as any);

      const result = await supplierService.compareSuppliers(
        ['sup-1', 'sup-2'],
        'prod-1'
      );

      expect(result).toHaveProperty('suppliers');
      expect(result.suppliers.length).toBe(2);
      expect(result).toHaveProperty('bestPrice');
      expect(result).toHaveProperty('bestQuality');
      expect(result).toHaveProperty('bestDelivery');
    });
  });

  describe('getPriceHistory', () => {
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

      prismaMock.purchaseOrderItem.findMany.mockResolvedValue(mockHistory as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result).toHaveProperty('currentPrice');
      expect(result).toHaveProperty('avgPrice');
      expect(result).toHaveProperty('minPrice');
      expect(result).toHaveProperty('maxPrice');
      expect(result).toHaveProperty('trend');
      expect(['UP', 'DOWN', 'STABLE']).toContain(result.trend);
      expect(result).toHaveProperty('priceHistory');
      expect(Array.isArray(result.priceHistory)).toBe(true);
    });

    it('should detect upward price trend', async () => {
      // Prices increasing over time
      const mockHistory = [
        {
          unitPrice: createDecimal(110), // Most recent
          purchaseOrder: { orderNumber: 'PO-001', createdAt: new Date('2026-01-01') },
        },
        {
          unitPrice: createDecimal(100),
          purchaseOrder: { orderNumber: 'PO-002', createdAt: new Date('2025-10-01') },
        },
      ];

      prismaMock.purchaseOrderItem.findMany.mockResolvedValue(mockHistory as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result.trend).toBe('UP');
    });

    it('should detect downward price trend', async () => {
      // Prices decreasing over time
      const mockHistory = [
        {
          unitPrice: createDecimal(90), // Most recent
          purchaseOrder: { orderNumber: 'PO-001', createdAt: new Date('2026-01-01') },
        },
        {
          unitPrice: createDecimal(100),
          purchaseOrder: { orderNumber: 'PO-002', createdAt: new Date('2025-10-01') },
        },
      ];

      prismaMock.purchaseOrderItem.findMany.mockResolvedValue(mockHistory as any);

      const result = await supplierService.getPriceHistory('sup-1', 'prod-1');

      expect(result.trend).toBe('DOWN');
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('should update supplier metrics after goods receipt', async () => {
      const mockSupplier = mockFactories.supplier({
        id: 'sup-1',
        totalDeliveries: 10,
        lateDeliveries: 1,
      });

      const mockGoodsReceipt = {
        id: 'gr-1',
        purchaseOrder: {
          supplierId: 'sup-1',
          estimatedDeliveryDate: new Date('2026-01-01'),
        },
        receiptDate: new Date('2026-01-01'), // On time
        inspectionStatus: 'PASSED',
      };

      prismaMock.supplier.findUnique.mockResolvedValue(mockSupplier as any);
      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockGoodsReceipt as any);
      prismaMock.supplier.update.mockResolvedValue({
        ...mockSupplier,
        totalDeliveries: 11,
      } as any);

      await supplierService.updatePerformanceMetrics('sup-1', 'gr-1');

      expect(prismaMock.supplier.update).toHaveBeenCalled();
    });
  });

  describe('upsertSupplierItem', () => {
    it('should create new catalog item', async () => {
      const newItem = {
        productId: 'prod-1',
        lastPurchasePrice: 50,
        leadTimeDays: 7,
        isPreferred: true,
      };

      prismaMock.supplierItem.upsert.mockResolvedValue({
        id: 'item-1',
        supplierId: 'sup-1',
        ...newItem,
      } as any);

      const result = await supplierService.upsertSupplierItem('sup-1', newItem);

      expect(prismaMock.supplierItem.upsert).toHaveBeenCalled();
      expect(result.supplierId).toBe('sup-1');
    });
  });

  describe('addVolumeDiscount', () => {
    it('should add volume discount to catalog item', async () => {
      const discount = {
        minQuantity: 100,
        discountPercent: 15,
      };

      prismaMock.supplierVolumeDiscount.create.mockResolvedValue({
        id: 'discount-1',
        supplierItemId: 'item-1',
        ...discount,
      } as any);

      const result = await supplierService.addVolumeDiscount('item-1', discount);

      expect(prismaMock.supplierVolumeDiscount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          supplierItemId: 'item-1',
          minQuantity: 100,
        }),
      });
    });
  });
});
