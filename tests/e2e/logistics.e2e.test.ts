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
        findMany: vi.fn(),
        count: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      orderItem: {
        findMany: vi.fn(),
      },
      productionOrder: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      inventoryItem: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      materialInventory: {
        findMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      material: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      bom: {
        findMany: vi.fn(),
      },
      warehouse: {
        findFirst: vi.fn(),
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
  });

  describe('Incoming Materials', () => {
    it('should return incoming materials pipeline', async () => {
      const mockPOItems = [
        {
          id: 'poi-1',
          materialId: 'mat-1',
          productId: null,
          quantity: 100,
          receivedQuantity: 30,
          material: {
            id: 'mat-1',
            sku: 'MAT001',
            name: 'Material A',
          },
          purchaseOrder: {
            id: 'po-1',
            orderNumber: 'PO-001',
            expectedDate: new Date('2026-01-20'),
            status: 'CONFIRMED',
            supplier: { businessName: 'Supplier A' },
          },
        },
        {
          id: 'poi-2',
          materialId: 'mat-2',
          productId: null,
          quantity: 200,
          receivedQuantity: 0,
          material: {
            id: 'mat-2',
            sku: 'MAT002',
            name: 'Material B',
          },
          purchaseOrder: {
            id: 'po-2',
            orderNumber: 'PO-002',
            expectedDate: new Date('2026-01-25'),
            status: 'SENT',
            supplier: { businessName: 'Supplier B' },
          },
        },
      ];

      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue(mockPOItems as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('materialId');
      expect(result[0]).toHaveProperty('pendingQuantity');
      expect(result[0].pendingQuantity).toBe(70); // 100 - 30
    });

    it('should filter by material ID', async () => {
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);

      await logisticsPlanningService.getIncomingMaterials('mat-1');

      expect(vi.mocked(prisma.purchaseOrderItem.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            materialId: 'mat-1',
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
          dueDate: new Date('2026-01-20'),
          items: [
            {
              productId: 'prod-1',
              quantity: 10,
              product: { id: 'prod-1', sku: 'SKU001', name: 'Product 1' },
            },
          ],
          customer: { businessName: 'Customer A' },
        },
      ];

      const mockInventory = [
        {
          productId: 'prod-1',
          quantity: 15,
          warehouse: { code: 'MAIN' },
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue(mockInventory as any);
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('orderId');
      expect(result[0]).toHaveProperty('fulfillmentStatus');
      expect(['READY', 'PARTIAL', 'BLOCKED']).toContain(result[0].fulfillmentStatus);
    });

    it('should show BLOCKED for orders with insufficient stock', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          dueDate: new Date('2026-01-20'),
          items: [
            {
              productId: 'prod-1',
              quantity: 100, // Need 100
              product: { id: 'prod-1', sku: 'SKU001', name: 'Product 1' },
            },
          ],
          customer: { businessName: 'Customer A' },
        },
      ];

      const mockInventory = [
        {
          productId: 'prod-1',
          quantity: 10, // Only have 10
          warehouse: { code: 'MAIN' },
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue(mockInventory as any);
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result[0].fulfillmentStatus).toBe('BLOCKED');
    });
  });

  describe('Ready to Ship Orders', () => {
    it('should return orders ready to ship', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          items: [
            { productId: 'prod-1', quantity: 5 },
          ],
          customer: { businessName: 'Customer A' },
        },
      ];

      const mockInventory = [
        { productId: 'prod-1', quantity: 20 },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue(mockInventory as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(Array.isArray(result)).toBe(true);
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
          status: 'PENDING',
          dueDate: new Date('2026-01-25'),
          product: {
            id: 'prod-1',
            sku: 'SKU001',
            name: 'Product 1',
            bom: [
              {
                materialId: 'mat-1',
                quantity: 2,
                material: { id: 'mat-1', sku: 'MAT001', name: 'Material A' },
              },
            ],
          },
        },
      ];

      const mockMaterialInventory = [
        { materialId: 'mat-1', quantity: 50 },
      ];

      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);
      vi.mocked(prisma.materialInventory.findMany).mockResolvedValue(mockMaterialInventory as any);
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('productionOrderId');
      expect(result[0]).toHaveProperty('materialStatus');
      expect(result[0].materialStatus).toHaveProperty('canStart');
    });

    it('should indicate missing materials', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-ord-1',
          orderNumber: 'PROD-001',
          productId: 'prod-1',
          quantity: 10,
          status: 'PENDING',
          dueDate: new Date('2026-01-25'),
          product: {
            id: 'prod-1',
            sku: 'SKU001',
            name: 'Product 1',
            bom: [
              {
                materialId: 'mat-1',
                quantity: 10, // Need 10 per unit = 100 total
                material: { id: 'mat-1', sku: 'MAT001', name: 'Material A' },
              },
            ],
          },
        },
      ];

      const mockMaterialInventory = [
        { materialId: 'mat-1', quantity: 20 }, // Only have 20
      ];

      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);
      vi.mocked(prisma.materialInventory.findMany).mockResolvedValue(mockMaterialInventory as any);
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result[0].materialStatus.canStart).toBe(false);
      expect(result[0].materialStatus.missingMaterials).toHaveLength(1);
    });
  });

  describe('Material Timeline', () => {
    it('should project stock over time', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Material A',
        minStock: 10,
        reorderPoint: 20,
      };

      const mockInventory = [
        { materialId: 'mat-1', quantity: 100, warehouse: { code: 'MAIN' } },
      ];

      const mockIncoming = [
        {
          materialId: 'mat-1',
          quantity: 50,
          receivedQuantity: 0,
          purchaseOrder: {
            expectedDate: new Date('2026-01-20'),
            status: 'CONFIRMED',
          },
        },
      ];

      const mockProductionOrders = [
        {
          id: 'prod-1',
          dueDate: new Date('2026-01-25'),
          quantity: 10,
          product: {
            bom: [{ materialId: 'mat-1', quantity: 5 }],
          },
        },
      ];

      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial as any);
      vi.mocked(prisma.materialInventory.findMany).mockResolvedValue(mockInventory as any);
      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue(mockIncoming as any);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue(mockProductionOrders as any);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      expect(result).toHaveProperty('materialId');
      expect(result).toHaveProperty('currentStock');
      expect(result).toHaveProperty('timeline');
      expect(Array.isArray(result.timeline)).toBe(true);
    });
  });

  describe('Logistics Dashboard', () => {
    it('should return complete dashboard KPIs', async () => {
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(5);
      vi.mocked(prisma.order.count).mockResolvedValue(10);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(3);

      vi.mocked(prisma.purchaseOrderItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.materialInventory.findMany).mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result).toHaveProperty('kpis');
      expect(result.kpis).toHaveProperty('pendingPurchaseOrders');
      expect(result.kpis).toHaveProperty('ordersReadyToShip');
      expect(result.kpis).toHaveProperty('productionInProgress');
      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
    });
  });
});
