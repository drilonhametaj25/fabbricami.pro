/**
 * Logistics Planning Service Tests
 * Tests for incoming materials, fulfillment forecast, and production scheduling
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';

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
import logisticsPlanningService from '@server/services/logistics-planning.service';

describe('LogisticsPlanningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getIncomingMaterials', () => {
    it('should return incoming materials with summary', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-2026-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', name: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(7),
          deliveryStatus: 'SHIPPED',
          items: [
            {
              id: 'poi-1',
              productId: 'prod-1',
              materialId: null,
              quantity: 100,
              product: { id: 'prod-1', name: 'Product 1', sku: 'SKU001' },
              material: null,
            },
          ],
          goodsReceipts: [
            {
              items: [
                { purchaseOrderItemId: 'poi-1', receivedQuantity: 50 },
              ],
            },
          ],
        },
        {
          id: 'po-2',
          orderNumber: 'PO-2026-002',
          supplierId: 'sup-2',
          supplier: { id: 'sup-2', name: 'Supplier B', code: 'SUPB' },
          estimatedDeliveryDate: createMockDate(14),
          deliveryStatus: 'PENDING',
          items: [
            {
              id: 'poi-2',
              productId: null,
              materialId: 'mat-1',
              quantity: 200,
              product: null,
              material: { id: 'mat-1', name: 'Material 1', code: 'MAT001' },
            },
          ],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials({ daysAhead: 30 });

      expect(result).toHaveProperty('incoming');
      expect(result).toHaveProperty('summary');
      expect(result.incoming.length).toBe(2);
      expect(result.summary.totalOrders).toBe(2);
      expect(result.summary.inTransit).toBe(1); // SHIPPED status
    });

    it('should calculate pending quantities correctly', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', name: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(7),
          deliveryStatus: 'PARTIAL',
          items: [
            {
              id: 'poi-1',
              quantity: 100,
              product: { name: 'Product 1', sku: 'SKU001' },
            },
          ],
          goodsReceipts: [
            { items: [{ purchaseOrderItemId: 'poi-1', receivedQuantity: 30 }] },
            { items: [{ purchaseOrderItemId: 'poi-1', receivedQuantity: 20 }] },
          ],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      // Ordered 100, received 30+20=50, pending should be 50
      expect(result.incoming[0].items[0].pendingQty).toBe(50);
      expect(result.incoming[0].items[0].receivedQty).toBe(50);
    });

    it('should filter by supplier when provided', async () => {
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      await logisticsPlanningService.getIncomingMaterials({ supplierId: 'sup-1' });

      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierId: 'sup-1',
          }),
        })
      );
    });

    it('should identify delayed deliveries', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', name: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: pastDate, // Overdue
          deliveryStatus: 'PENDING',
          items: [{ id: 'poi-1', quantity: 100, product: { name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(result.summary.delayed).toBe(1);
    });
  });

  describe('getOrderFulfillmentForecast', () => {
    it('should return fulfillment forecast with status', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1500),
          priority: 'HIGH',
          createdAt: new Date(),
          customer: { businessName: 'Customer A' },
          items: [
            {
              productId: 'prod-1',
              quantity: 10,
              productName: 'Product 1',
              product: { id: 'prod-1', name: 'Product 1', sku: 'SKU001' },
            },
          ],
        },
      ];

      const mockInventory = [
        { productId: 'prod-1', warehouseId: 'wh-1', quantity: 15 },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue(mockInventory as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('summary');
      expect(result.orders[0].fulfillmentStatus).toBe('READY');
      expect(result.orders[0].readyPercentage).toBe(100);
    });

    it('should identify orders with missing items', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1500),
          priority: 'NORMAL',
          createdAt: new Date(),
          customer: { businessName: 'Customer A' },
          items: [
            {
              productId: 'prod-1',
              quantity: 20, // Need 20
              productName: 'Product 1',
              product: { id: 'prod-1', name: 'Product 1', sku: 'SKU001' },
            },
          ],
        },
      ];

      const mockInventory = [
        { productId: 'prod-1', warehouseId: 'wh-1', quantity: 10 }, // Only have 10
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue(mockInventory as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].fulfillmentStatus).not.toBe('READY');
      expect(result.orders[0].missingItems.length).toBeGreaterThan(0);
      expect(result.orders[0].missingItems[0].shortageQty).toBe(10);
    });

    it('should calculate correct summary counts', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          customer: { businessName: 'A' },
          items: [{ productId: 'p1', quantity: 10, product: { id: 'p1', name: 'P1', sku: 'S1' } }],
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD-002',
          status: 'CONFIRMED',
          total: createDecimal(2000),
          customer: { businessName: 'B' },
          items: [{ productId: 'p2', quantity: 50, product: { id: 'p2', name: 'P2', sku: 'S2' } }],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100 }, // Enough for order 1
        { productId: 'p2', quantity: 10 },  // Not enough for order 2
      ] as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.summary.totalOrders).toBe(2);
      expect(result.summary.readyToShip).toBe(1);
      expect(result.summary.blocked + result.summary.partiallyReady + result.summary.waitingMaterials).toBe(1);
    });
  });

  describe('getReadyToShipOrders', () => {
    it('should return only orders with READY status', async () => {
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
          items: [{ quantity: 5 }, { quantity: 3 }],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('totalOrders');
      expect(result.orders[0].itemCount).toBe(8);
      expect(result.orders[0].shippingAddress).toContain('123 Main St');
    });

    it('should calculate total value correctly', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          total: createDecimal(1000),
          customer: {},
          items: [],
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD-002',
          total: createDecimal(2500),
          customer: {},
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(result.totalValue).toBe(3500);
      expect(result.totalOrders).toBe(2);
    });
  });

  describe('getProductionSchedule', () => {
    it('should return production schedule with material status', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 10,
          status: 'PENDING',
          priority: 'HIGH',
          dueDate: createMockDate(7),
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
          linkedOrder: { id: 'ord-1', orderNumber: 'ORD-001' },
        },
      ];

      const mockBomItems = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(2),
          material: { id: 'mat-1', name: 'Material 1', code: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.bOMItem.findMany.mockResolvedValue(mockBomItems as any);
      prismaMock.materialMovement.groupBy.mockResolvedValue([
        { materialId: 'mat-1', _sum: { quantity: 50 } },
      ] as any);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result).toHaveProperty('schedule');
      expect(result).toHaveProperty('summary');
      expect(result.schedule[0].productName).toBe('Product 1');
      expect(result.schedule[0].linkedOrderNumber).toBe('ORD-001');
    });

    it('should identify production orders waiting for materials', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 100, // Need 100 products
          status: 'PENDING',
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
      ];

      const mockBomItems = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(5), // 5 units per product = need 500 total
          material: { id: 'mat-1', name: 'Material 1', code: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.bOMItem.findMany.mockResolvedValue(mockBomItems as any);
      prismaMock.materialMovement.groupBy.mockResolvedValue([
        { materialId: 'mat-1', _sum: { quantity: 100 } }, // Only have 100, need 500
      ] as any);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result.schedule[0].materialsReady).toBe(false);
      expect(result.schedule[0].missingMaterials.length).toBeGreaterThan(0);
      expect(result.schedule[0].missingMaterials[0].shortageQty).toBe(400);
    });

    it('should mark orders as ready when all materials available', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 10,
          status: 'PENDING',
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
      ];

      const mockBomItems = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(2),
          material: { id: 'mat-1', name: 'Material 1', code: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.bOMItem.findMany.mockResolvedValue(mockBomItems as any);
      prismaMock.materialMovement.groupBy.mockResolvedValue([
        { materialId: 'mat-1', _sum: { quantity: 1000 } }, // Plenty available
      ] as any);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result.schedule[0].materialsReady).toBe(true);
      expect(result.schedule[0].missingMaterials.length).toBe(0);
      expect(result.summary.readyToStart).toBe(1);
    });
  });

  describe('getMaterialTimeline', () => {
    it('should return material timeline with projections', async () => {
      const mockMaterial = {
        id: 'mat-1',
        code: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [
          { quantity: 100 },
        ],
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      expect(result).toHaveProperty('materialId');
      expect(result).toHaveProperty('currentStock');
      expect(result).toHaveProperty('timeline');
      expect(result.currentStock).toBe(100);
    });

    it('should throw error for non-existent material', async () => {
      prismaMock.material.findUnique.mockResolvedValue(null);

      await expect(
        logisticsPlanningService.getMaterialTimeline('non-existent')
      ).rejects.toThrow('Materiale non trovato');
    });

    it('should include incoming deliveries in timeline', async () => {
      const mockMaterial = {
        id: 'mat-1',
        code: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [{ quantity: 50 }],
      };

      const mockIncomingPO = {
        id: 'po-1',
        orderNumber: 'PO-001',
        estimatedDeliveryDate: createMockDate(7),
        items: [{ materialId: 'mat-1', quantity: 100 }],
        goodsReceipts: [],
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([mockIncomingPO] as any);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      const incomingEvents = result.timeline.filter((e: any) => e.type === 'INCOMING');
      expect(incomingEvents.length).toBeGreaterThan(0);
    });

    it('should project stockout date when consumption exceeds supply', async () => {
      const mockMaterial = {
        id: 'mat-1',
        code: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [{ quantity: 50 }], // Only 50 in stock
      };

      const mockProductionOrder = {
        id: 'prod-1',
        orderNumber: 'PROD-001',
        startDate: createMockDate(5),
        quantity: 20,
        product: {
          bomItems: [
            { materialId: 'mat-1', quantity: createDecimal(5) }, // Need 100 total
          ],
        },
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([mockProductionOrder] as any);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      // Should detect that 100 will be consumed but only 50 available
      expect(result.projectedStockout).toBeDefined();
    });
  });

  describe('getLogisticsDashboard', () => {
    it('should return comprehensive dashboard KPIs', async () => {
      // Mock incoming materials data
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: createDecimal(50000) },
      } as any);

      // Mock fulfillment data
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      // Mock production data
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.bOMItem.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result).toHaveProperty('incoming');
      expect(result).toHaveProperty('fulfillment');
      expect(result).toHaveProperty('production');
      expect(result).toHaveProperty('alerts');
      expect(result.incoming).toHaveProperty('totalOrders');
      expect(result.fulfillment).toHaveProperty('readyToShip');
      expect(result.production).toHaveProperty('activeOrders');
    });

    it('should generate alerts for issues', async () => {
      // Setup delayed deliveries
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      prismaMock.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', name: 'Supplier', code: 'SUP' },
          estimatedDeliveryDate: pastDate,
          deliveryStatus: 'PENDING',
          items: [{ id: 'i1', quantity: 10, product: { name: 'P', sku: 'S' } }],
          goodsReceipts: [],
        },
      ] as any);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: createDecimal(1000) },
      } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.bOMItem.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some((a: any) => a.type === 'WARNING')).toBe(true);
    });
  });
});
