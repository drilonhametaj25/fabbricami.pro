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
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Mock cache utilities
const mockGetCache = jest.fn();
const mockSetCache = jest.fn();
const mockDeleteCache = jest.fn();
jest.mock('@server/utils/cache.util', () => ({
  getCache: (...args: any[]) => mockGetCache(...args),
  setCache: (...args: any[]) => mockSetCache(...args),
  deleteCache: (...args: any[]) => mockDeleteCache(...args),
}));

// Import after mocks
import logisticsPlanningService from '@server/services/logistics-planning.service';

describe('LogisticsPlanningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    mockDeleteCache.mockResolvedValue(undefined);
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
          status: 'DRAFT',
          priority: 'HIGH',
          plannedStartDate: createMockDate(1),
          plannedEndDate: createMockDate(7),
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
          salesOrder: { id: 'ord-1', orderNumber: 'ORD-001' },
        },
      ];

      const mockProductMaterials = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(2),
          material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue(mockProductMaterials as any);
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
          material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue(mockBomItems as any);
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
          status: 'DRAFT', // Must be DRAFT for readyToStart count
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
      ];

      const mockProductMaterials = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(2),
          material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue(mockProductMaterials as any);
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
        plannedStartDate: createMockDate(5),
        quantity: 20,
        product: {
          name: 'Test Product',
          productMaterials: [
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
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
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

    it('should include alerts array in response', async () => {
      // Mock all required data
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: createDecimal(1000) },
      } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      // Alerts is always an array
      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should return cached data when available', async () => {
      const cachedData = {
        incoming: { totalOrders: 5, expectedThisWeek: 3, delayed: 1, totalValue: 10000 },
        fulfillment: { readyToShip: 10, readyValue: 5000, blocked: 2, avgFulfillmentRate: 85 },
        production: { activeOrders: 8, readyToStart: 3, waitingMaterials: 2 },
        alerts: [],
      };
      mockGetCache.mockResolvedValue(cachedData);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result._cached).toBe(true);
      expect(result.incoming.totalOrders).toBe(5);
      expect(mockLogger.debug).toHaveBeenCalledWith('Logistics dashboard served from cache');
      // Should not call database queries when cache hit
      expect(prismaMock.purchaseOrder.findMany).not.toHaveBeenCalled();
    });

    it('should save to cache after computing dashboard', async () => {
      mockGetCache.mockResolvedValue(null);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      await logisticsPlanningService.getLogisticsDashboard();

      expect(mockSetCache).toHaveBeenCalledWith(
        'logistics:dashboard',
        expect.any(Object),
        60
      );
    });

    it('should handle cache errors gracefully and continue with query', async () => {
      mockGetCache.mockRejectedValue(new Error('Redis error'));
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result).toHaveProperty('incoming');
      expect(result._cached).toBeUndefined();
    });

    it('should handle cache set errors gracefully', async () => {
      mockGetCache.mockResolvedValue(null);
      mockSetCache.mockRejectedValue(new Error('Redis write error'));
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      // Should not throw even if cache set fails
      const result = await logisticsPlanningService.getLogisticsDashboard();
      expect(result).toHaveProperty('incoming');
    });

    it('should generate alerts for delayed deliveries', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: pastDate,
          deliveryStatus: 'PENDING',
          items: [{ id: 'poi-1', quantity: 100, product: { name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'WARNING',
          message: expect.stringContaining('consegne in ritardo'),
          entityType: 'PurchaseOrder',
        })
      );
    });

    it('should generate alerts for blocked orders', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          customer: { businessName: 'Test' },
          items: [{ productId: 'p1', quantity: 100, product: { id: 'p1', name: 'P1', sku: 'S1' } }],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]); // No inventory = blocked
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'ERROR',
          message: expect.stringContaining('ordini bloccati'),
          entityType: 'Order',
        })
      );
    });

    it('should generate alerts for production orders waiting materials', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 100,
          status: 'DRAFT',
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
      ];

      const mockBomItems = [
        {
          productId: 'product-1',
          materialId: 'mat-1',
          quantity: createDecimal(5),
          material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001' },
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue(mockBomItems as any);
      prismaMock.materialMovement.groupBy.mockResolvedValue([
        { materialId: 'mat-1', _sum: { quantity: 10 } }, // Only 10, need 500
      ] as any);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'WARNING',
          message: expect.stringContaining('ordini produzione in attesa materiali'),
          entityType: 'ProductionOrder',
        })
      );
    });

    it('should generate info alert for many ready to ship orders', async () => {
      const mockOrders = Array.from({ length: 8 }, (_, i) => ({
        id: `ord-${i}`,
        orderNumber: `ORD-00${i}`,
        status: 'CONFIRMED',
        total: createDecimal(100),
        customer: { businessName: 'Test' },
        items: [{ productId: `p${i}`, quantity: 1, product: { id: `p${i}`, name: `P${i}`, sku: `S${i}` } }],
      }));

      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: createDecimal(1000) } } as any);
      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue(
        mockOrders.map((o, i) => ({ productId: `p${i}`, quantity: 100 })) as any
      );
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getLogisticsDashboard();

      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'INFO',
          message: expect.stringContaining('ordini pronti per la spedizione'),
          entityType: 'Order',
        })
      );
    });
  });

  describe('invalidateCache', () => {
    it('should delete all logistics cache keys', async () => {
      await logisticsPlanningService.invalidateCache();

      expect(mockDeleteCache).toHaveBeenCalledWith('logistics:dashboard');
      expect(mockDeleteCache).toHaveBeenCalledWith('logistics:incoming');
      expect(mockDeleteCache).toHaveBeenCalledWith('logistics:fulfillment');
      expect(mockDeleteCache).toHaveBeenCalledWith('logistics:ready-to-ship');
      expect(mockDeleteCache).toHaveBeenCalledWith('logistics:production');
      expect(mockLogger.debug).toHaveBeenCalledWith('Logistics cache invalidated');
    });

    it('should handle cache deletion errors gracefully', async () => {
      mockDeleteCache.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(logisticsPlanningService.invalidateCache()).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error invalidating logistics cache:',
        expect.any(Error)
      );
    });
  });

  describe('getOrderFulfillmentForecast - additional coverage', () => {
    it('should set PARTIAL status when some items are ready', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          priority: 'NORMAL',
          customer: { businessName: 'Customer A' },
          items: [
            { productId: 'p1', quantity: 10, product: { id: 'p1', name: 'P1', sku: 'S1' } },
            { productId: 'p2', quantity: 10, product: { id: 'p2', name: 'P2', sku: 'S2' } },
          ],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100 }, // Enough for first item
        { productId: 'p2', quantity: 5 },   // Not enough for second item
      ] as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].fulfillmentStatus).toBe('PARTIAL');
      expect(result.summary.partiallyReady).toBe(1);
    });

    it('should set WAITING_MATERIALS status with expected arrival date', async () => {
      const futureDate = createMockDate(14);
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          customer: { businessName: 'Customer A' },
          items: [
            { productId: 'p1', quantity: 50, product: { id: 'p1', name: 'P1', sku: 'S1' } },
          ],
        },
      ];

      const mockIncomingMaterials = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier', code: 'SUP' },
          estimatedDeliveryDate: futureDate,
          deliveryStatus: 'PENDING',
          items: [{ id: 'poi-1', productId: 'p1', quantity: 100, pendingQty: 100, product: { id: 'p1', name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 10 }, // Not enough
      ] as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockIncomingMaterials as any);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].fulfillmentStatus).toBe('WAITING_MATERIALS');
      expect(result.orders[0].estimatedFulfillmentDate).toBeDefined();
      expect(result.summary.waitingMaterials).toBe(1);
    });

    it('should calculate estimated fulfillment date from latest arrival', async () => {
      const earlierDate = createMockDate(7);
      const laterDate = createMockDate(14);

      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          customer: { businessName: 'Customer A' },
          items: [
            { productId: 'p1', quantity: 50, product: { id: 'p1', name: 'P1', sku: 'S1' } },
            { productId: 'p2', quantity: 50, product: { id: 'p2', name: 'P2', sku: 'S2' } },
          ],
        },
      ];

      const mockIncomingMaterials = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier', code: 'SUP' },
          estimatedDeliveryDate: earlierDate,
          deliveryStatus: 'PENDING',
          items: [{ id: 'poi-1', productId: 'p1', quantity: 100, pendingQty: 100, product: { id: 'p1', name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
        {
          id: 'po-2',
          orderNumber: 'PO-002',
          supplierId: 'sup-2',
          supplier: { id: 'sup-2', businessName: 'Supplier 2', code: 'SUP2' },
          estimatedDeliveryDate: laterDate,
          deliveryStatus: 'PENDING',
          items: [{ id: 'poi-2', productId: 'p2', quantity: 100, pendingQty: 100, product: { id: 'p2', name: 'P2', sku: 'S2' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockIncomingMaterials as any);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      // Should use the later date as estimated fulfillment date
      expect(result.orders[0].estimatedFulfillmentDate?.getTime()).toBe(laterDate.getTime());
    });

    it('should assign LOW priority for LOW priority orders', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          priority: 'LOW',
          customer: { businessName: 'Customer A' },
          items: [{ productId: 'p1', quantity: 10, product: { id: 'p1', name: 'P1', sku: 'S1' } }],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100 },
      ] as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].priority).toBe('LOW');
    });

    it('should include shipped orders when option is enabled', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      await logisticsPlanningService.getOrderFulfillmentForecast({ includeShipped: true });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED'] },
          }),
        })
      );
    });

    it('should filter by customerId when provided', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      await logisticsPlanningService.getOrderFulfillmentForecast({ customerId: 'cust-1' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should use billing name when customer name not available', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          total: createDecimal(1000),
          billingName: 'John Doe Billing',
          customer: null,
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getOrderFulfillmentForecast();

      expect(result.orders[0].customerName).toBe('John Doe Billing');
    });
  });

  describe('getProductionSchedule - additional coverage', () => {
    it('should assign LOW priority for low numeric priority', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 10,
          status: 'DRAFT',
          priority: 1, // Low numeric priority
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result.schedule[0].priority).toBe('LOW');
    });

    it('should filter by custom status when provided', async () => {
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      await logisticsPlanningService.getProductionSchedule({ status: ['IN_PROGRESS'] });

      expect(prismaMock.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['IN_PROGRESS'] },
          }),
        })
      );
    });

    it('should count in-progress orders in summary', async () => {
      const mockProductionOrders = [
        {
          id: 'prod-1',
          orderNumber: 'PROD-001',
          productId: 'product-1',
          quantity: 10,
          status: 'IN_PROGRESS',
          product: { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        },
        {
          id: 'prod-2',
          orderNumber: 'PROD-002',
          productId: 'product-2',
          quantity: 20,
          status: 'IN_PROGRESS',
          product: { id: 'product-2', name: 'Product 2', sku: 'SKU002' },
        },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(mockProductionOrders as any);
      prismaMock.productMaterial.findMany.mockResolvedValue([]);
      prismaMock.materialMovement.groupBy.mockResolvedValue([]);

      const result = await logisticsPlanningService.getProductionSchedule();

      expect(result.summary.inProgress).toBe(2);
    });
  });

  describe('getMaterialTimeline - additional coverage', () => {
    it('should calculate received quantity correctly when calculating pending in timeline', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [{ quantity: 50 }],
      };

      const futureDate = createMockDate(7);
      const mockIncomingPO = {
        id: 'po-1',
        orderNumber: 'PO-001',
        estimatedDeliveryDate: futureDate,
        items: [{ materialId: 'mat-1', quantity: 100 }],
        goodsReceipts: [
          {
            items: [
              { receivedQuantity: 30 },
              { receivedQuantity: 20 },
            ],
          },
        ],
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([mockIncomingPO] as any);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      // Should have incoming event with pending quantity (100 - 50 = 50)
      const incomingEvents = result.timeline.filter((e) => e.type === 'INCOMING');
      expect(incomingEvents.length).toBe(1);
      expect(incomingEvents[0].quantity).toBe(50);
    });

    it('should skip PO without estimated delivery date', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [{ quantity: 50 }],
      };

      const mockIncomingPO = {
        id: 'po-1',
        orderNumber: 'PO-001',
        estimatedDeliveryDate: null, // No delivery date
        items: [{ materialId: 'mat-1', quantity: 100 }],
        goodsReceipts: [],
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([mockIncomingPO] as any);
      prismaMock.productionOrder.findMany.mockResolvedValue([]);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      // Should not have incoming event since no delivery date
      const incomingEvents = result.timeline.filter((e) => e.type === 'INCOMING');
      expect(incomingEvents.length).toBe(0);
    });

    it('should use plannedEndDate when plannedStartDate not available', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        inventoryItems: [{ quantity: 100 }],
      };

      const plannedEndDate = createMockDate(10);
      const mockProductionOrder = {
        id: 'prod-1',
        orderNumber: 'PROD-001',
        plannedStartDate: null,
        plannedEndDate: plannedEndDate,
        quantity: 10,
        product: {
          name: 'Test Product',
          productMaterials: [
            { materialId: 'mat-1', quantity: createDecimal(5) },
          ],
        },
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([mockProductionOrder] as any);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      const consumptionEvents = result.timeline.filter((e) => e.type === 'CONSUMPTION');
      expect(consumptionEvents.length).toBe(1);
      expect(consumptionEvents[0].date.getTime()).toBe(plannedEndDate.getTime());
    });

    it('should calculate suggested reorder date when stock drops below reorder point', async () => {
      const mockMaterial = {
        id: 'mat-1',
        sku: 'MAT001',
        name: 'Test Material',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 50, // High reorder point
        inventoryItems: [{ quantity: 60 }], // Current stock just above reorder
      };

      const mockProductionOrder = {
        id: 'prod-1',
        orderNumber: 'PROD-001',
        plannedStartDate: createMockDate(5),
        quantity: 5,
        product: {
          name: 'Test Product',
          productMaterials: [
            { materialId: 'mat-1', quantity: createDecimal(5) }, // Will consume 25
          ],
        },
      };

      prismaMock.material.findUnique.mockResolvedValue(mockMaterial as any);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findMany.mockResolvedValue([mockProductionOrder] as any);

      const result = await logisticsPlanningService.getMaterialTimeline('mat-1', 30);

      // Stock will drop to 35 (60-25), which is below reorder point of 50
      expect(result.suggestedReorderDate).toBeDefined();
    });
  });

  describe('getReadyToShipOrders - additional coverage', () => {
    it('should use customer firstName/lastName when businessName not available', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'READY',
          total: createDecimal(500),
          customer: { firstName: 'John', lastName: 'Doe', businessName: null },
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(result.orders[0].customerName).toBe('John Doe');
    });

    it('should handle missing shipping details gracefully', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          status: 'READY',
          total: createDecimal(500),
          shippingAddress: null,
          shippingCity: null,
          shippingPostalCode: null,
          shippingCountry: null,
          shippingMethod: null,
          customer: { businessName: 'Test Co' },
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await logisticsPlanningService.getReadyToShipOrders();

      expect(result.orders[0].shippingAddress).toBe('');
      expect(result.orders[0].shippingMethod).toBeUndefined();
    });
  });

  describe('getIncomingMaterials - additional coverage', () => {
    it('should filter orders by custom status list', async () => {
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      await logisticsPlanningService.getIncomingMaterials({ status: ['SENT'] });

      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['SENT'] },
          }),
        })
      );
    });

    it('should filter out items with zero pending quantity', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(7),
          deliveryStatus: 'PENDING',
          items: [
            {
              id: 'poi-1',
              productId: 'prod-1',
              quantity: 100,
              product: { id: 'prod-1', name: 'Product 1', sku: 'SKU001' },
            },
          ],
          goodsReceipts: [
            { items: [{ purchaseOrderItemId: 'poi-1', receivedQuantity: 100 }] }, // Fully received
          ],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      // Should filter out order with no pending items
      expect(result.incoming.length).toBe(0);
    });

    it('should use material sku when product sku not available', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(7),
          deliveryStatus: 'PENDING',
          items: [
            {
              id: 'poi-1',
              productId: null,
              materialId: 'mat-1',
              quantity: 50,
              product: null,
              material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001' },
            },
          ],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(result.incoming[0].items[0].sku).toBe('MAT001');
      expect(result.incoming[0].items[0].itemName).toBe('Material 1');
    });

    it('should handle IN_TRANSIT delivery status', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(3),
          deliveryStatus: 'IN_TRANSIT',
          items: [{ id: 'poi-1', quantity: 50, product: { name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(result.summary.inTransit).toBe(1);
    });

    it('should identify DELAYED status deliveries', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A', code: 'SUPA' },
          estimatedDeliveryDate: createMockDate(5),
          deliveryStatus: 'DELAYED',
          items: [{ id: 'poi-1', quantity: 50, product: { name: 'P1', sku: 'S1' } }],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders as any);

      const result = await logisticsPlanningService.getIncomingMaterials();

      expect(result.summary.delayed).toBe(1);
    });
  });
});
