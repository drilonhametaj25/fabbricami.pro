/**
 * Logistics E2E Tests
 * Tests for logistics planning API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
      purchaseOrder: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _sum: { total: null } }),
      },
      purchaseOrderItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      productionOrder: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      inventoryItem: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      materialInventory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      material: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      productMaterial: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      materialMovement: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bom: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      warehouse: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
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

vi.mock('@server/utils/cache.util', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import logisticsPlanningService from '@server/services/logistics-planning.service';
import { prisma } from '@server/config/database';

// Helper to create decimal-like objects
const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
  toFixed: (digits: number) => value.toFixed(digits),
});

describe('Logistics API E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);
    vi.mocked(prisma.purchaseOrder.aggregate).mockResolvedValue({ _sum: { total: null } } as any);
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
    vi.mocked(prisma.productMaterial.findMany).mockResolvedValue([]);
    vi.mocked(prisma.materialMovement.groupBy).mockResolvedValue([]);
  });

  describe('Incoming Materials', () => {
    it('should return incoming materials pipeline', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: new Date('2026-01-20'),
          deliveryStatus: 'SHIPPED',
          items: [
            {
              id: 'poi-1',
              materialId: 'mat-1',
              productId: null,
              quantity: 100,
              material: {
                id: 'mat-1',
                sku: 'MAT001',
                name: 'Material A',
              },
              product: null,
            },
          ],
          goodsReceipts: [
            {
              items: [
                { purchaseOrderItemId: 'poi-1', receivedQuantity: 30 },
              ],
            },
          ],
        },
        {
          id: 'po-2',
          orderNumber: 'PO-002',
          supplierId: 'sup-2',
          supplier: { id: 'sup-2', businessName: 'Supplier B', code: 'SUPB' },
          estimatedDeliveryDate: new Date('2026-01-25'),
          deliveryStatus: 'PENDING',
          items: [
            {
              id: 'poi-2',
              materialId: 'mat-2',
              productId: null,
              quantity: 200,
              material: {
                id: 'mat-2',
                sku: 'MAT002',
                name: 'Material B',
              },
              product: null,
            },
          ],
          goodsReceipts: [],
        },
      ];

      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(result).toHaveProperty('incoming');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.incoming)).toBe(true);
      expect(result.incoming).toHaveLength(2);
      expect(result.incoming[0]).toHaveProperty('purchaseOrderId');
      expect(result.incoming[0].items[0].pendingQty).toBe(70); // 100 - 30
    });

    it('should filter by supplier when provided', async () => {
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);

      await logisticsPlanningService.getIncomingMaterials({ supplierId: 'sup-1' });

      expect(vi.mocked(prisma.purchaseOrder.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierId: 'sup-1',
          }),
        })
      );
    });
  });

  describe('Order Fulfillment Forecast', () => {
    it('should return fulfillment status for orders', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1500),
          priority: 'HIGH',
          createdAt: new Date(),
          items: [
            {
              productId: 'prod-1',
              quantity: 10,
              productName: 'Product 1',
              product: { id: 'prod-1', sku: 'SKU001', name: 'Product 1' },
            },
          ],
          customer: { businessName: 'Customer A' },
        },
      ];

      const mockInventory = [
        {
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantity: 15,
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue(mockInventory as any);
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.orders)).toBe(true);
      expect(result.orders[0]).toHaveProperty('orderId');
      expect(result.orders[0]).toHaveProperty('fulfillmentStatus');
      expect(['READY', 'PARTIAL', 'BLOCKED', 'WAITING_MATERIALS']).toContain(result.orders[0].fulfillmentStatus);
    });

    it('should show BLOCKED for orders with insufficient stock', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1500),
          priority: 'NORMAL',
          createdAt: new Date(),
          items: [
            {
              productId: 'prod-1',
              quantity: 100, // Need 100
              productName: 'Product 1',
              product: { id: 'prod-1', sku: 'SKU001', name: 'Product 1' },
            },
          ],
          customer: { businessName: 'Customer A' },
        },
      ];

      const mockInventory = [
        {
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantity: 10, // Only have 10
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue(mockInventory as any);
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].fulfillmentStatus).toBe('BLOCKED');
    });
  });

  describe('Ready to Ship Orders', () => {
    it('should return orders ready to ship', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'READY',
          total: createDecimal(500),
          priority: 'URGENT',
          shippingAddress: '123 Main St',
          shippingCity: 'Milan',
          shippingPostalCode: '20100',
          shippingCountry: 'IT',
          shippingMethod: 'Express',
          createdAt: new Date(),
          customer: { businessName: 'Customer A' },
          items: [
            { quantity: 5 },
          ],
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('totalOrders');
      expect(Array.isArray(result.orders)).toBe(true);
    });
  });

  describe('Production Schedule', () => {
    it('should return production orders with material availability', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-ord-1',
          orderNumber: 'PROD-001',
          productId: 'prod-1',
          quantity: 10,
          status: 'DRAFT',
          priority: 'HIGH',
          plannedStartDate: new Date('2026-01-20'),
          plannedEndDate: new Date('2026-01-25'),
          product: {
            id: 'prod-1',
            sku: 'SKU001',
            name: 'Product 1',
          },
          salesOrder: { id: 'ord-1', orderNumber: 'ORD-001' },
        },
      ];

      const mockProductMaterials = [
        {
          productId: 'prod-1',
          materialId: 'mat-1',
          quantity: createDecimal(2),
          material: { id: 'mat-1', sku: 'MAT001', name: 'Material A' },
        },
      ];

      const mockMaterialStock = [
        { materialId: 'mat-1', _sum: { quantity: 50 } },
      ];

      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);
      vi.mocked(prisma.productMaterial.findMany).mockResolvedValue(mockProductMaterials as any);
      vi.mocked(prisma.materialMovement.groupBy).mockResolvedValue(mockMaterialStock as any);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result).toHaveProperty('schedule');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.schedule)).toBe(true);
      expect(result.schedule[0]).toHaveProperty('productionOrderId');
      expect(result.schedule[0]).toHaveProperty('materialsReady');
    });

    it('should indicate missing materials', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-ord-1',
          orderNumber: 'PROD-001',
          productId: 'prod-1',
          quantity: 10,
          status: 'PENDING',
          plannedEndDate: new Date('2026-01-25'),
          product: {
            id: 'prod-1',
            sku: 'SKU001',
            name: 'Product 1',
          },
        },
      ];

      const mockProductMaterials = [
        {
          productId: 'prod-1',
          materialId: 'mat-1',
          quantity: createDecimal(10), // Need 10 per unit = 100 total
          material: { id: 'mat-1', sku: 'MAT001', name: 'Material A' },
        },
      ];

      const mockMaterialStock = [
        { materialId: 'mat-1', _sum: { quantity: 20 } }, // Only have 20
      ];

      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);
      vi.mocked(prisma.productMaterial.findMany).mockResolvedValue(mockProductMaterials as any);
      vi.mocked(prisma.materialMovement.groupBy).mockResolvedValue(mockMaterialStock as any);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result.schedule[0].materialsReady).toBe(false);
      expect(result.schedule[0].missingMaterials).toHaveLength(1);
    });
  });

  describe('Material Timeline', () => {
    it('should project stock over time', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Material A',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [
          { quantity: 100 },
        ],
      };

      const mockIncomingPO = {
        id: 'po-1',
        orderNumber: 'PO-001',
        estimatedDeliveryDate: new Date('2026-01-20'),
        items: [
          { materialId: 'mat-1', quantity: 50 },
        ],
        goodsReceipts: [],
      };

      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          plannedStartDate: new Date('2026-01-25'),
          plannedEndDate: new Date('2026-01-30'),
          quantity: 10,
          product: {
            name: 'Test Product',
            productMaterials: [
              { materialId: 'mat-1', quantity: createDecimal(5) },
            ],
          },
        },
      ];

      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial as any);
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([mockIncomingPO] as any);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      expect(result).toHaveProperty('materialId');
      expect(result).toHaveProperty('currentStock');
      expect(result).toHaveProperty('timeline');
      expect(Array.isArray(result.timeline)).toBe(true);
      expect(result.currentStock).toBe(100);
    });
  });

  describe('Logistics Dashboard', () => {
    it('should return complete dashboard KPIs', async () => {
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.purchaseOrder.aggregate).mockResolvedValue({
        _sum: { total: createDecimal(50000) },
      } as any);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productMaterial.findMany).mockResolvedValue([]);
      vi.mocked(prisma.materialMovement.groupBy).mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result).toHaveProperty('incoming');
      expect(result).toHaveProperty('fulfillment');
      expect(result).toHaveProperty('production');
      expect(result).toHaveProperty('alerts');
      expect(result.incoming).toHaveProperty('totalOrders');
      expect(result.fulfillment).toHaveProperty('readyToShip');
      expect(result.production).toHaveProperty('activeOrders');
      expect(Array.isArray(result.alerts)).toBe(true);
    });
  });
});
