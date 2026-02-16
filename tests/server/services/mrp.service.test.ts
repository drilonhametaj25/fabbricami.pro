// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Mock notification service
const mockNotificationService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};
jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

// Mock Prisma
const prismaMock = {
  order: {
    findMany: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  bomItem: {
    findMany: jest.fn(),
  },
  orderItem: {
    aggregate: jest.fn(),
  },
  purchaseOrder: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  purchaseOrderItem: {
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(prismaMock)),
};

jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import { mrpService } from '@server/services/mrp.service';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to create Decimal mock
const createDecimal = (value: number): Decimal => new Decimal(value);

describe('MRPService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRequirementsForOrders', () => {
    it('should calculate requirements for pending orders', async () => {
      // Setup pending orders with BOM products
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [
            {
              productId: 'finished-1',
              quantity: 10,
              product: {
                id: 'finished-1',
                bomItems: [],
              },
            },
          ],
        },
      ]);

      // BOM explosion returns components
      prismaMock.bomItem.findMany.mockResolvedValue([
        {
          componentProductId: 'comp-1',
          quantity: createDecimal(2),
          scrapPercentage: createDecimal(5),
          componentProduct: { id: 'comp-1' },
        },
      ]);

      // Component product with low stock
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [
          { quantity: 5, reservedQuantity: 0 },
        ],
      });

      const result = await mrpService.calculateRequirementsForOrders();

      expect(result.calculationDate).toBeDefined();
      expect(result.planningHorizonDays).toBe(30);
      expect(result.requirements).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should identify CRITICAL priority for zero stock', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 10, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 20,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 0, reservedQuantity: 0 }], // Zero stock
      });

      const result = await mrpService.calculateRequirementsForOrders();

      const criticalReq = result.requirements.find(r => r.productId === 'comp-1');
      expect(criticalReq?.priority).toBe('CRITICAL');
    });

    it('should identify HIGH priority when stock below minStock', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 5, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 10,
        reorderPoint: 20,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 5, reservedQuantity: 0 }], // Below minStock of 10
      });

      const result = await mrpService.calculateRequirementsForOrders();

      const highReq = result.requirements.find(r => r.productId === 'comp-1');
      expect(highReq?.priority).toBe('HIGH');
    });

    it('should calculate shortage correctly with reserved quantities', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 10, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      // First call for finished-1 returns comp-1, second call (recursive) for comp-1 returns empty
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
        ])
        .mockResolvedValueOnce([]); // No sub-components

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 20,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [
          { quantity: 15, reservedQuantity: 10 }, // Available = 15 - 10 = 5
        ],
      });

      const result = await mrpService.calculateRequirementsForOrders();

      const req = result.requirements.find(r => r.productId === 'comp-1');
      expect(req?.availableQuantity).toBe(5);
      expect(req?.reservedQuantity).toBe(10);
      expect(req?.shortageQuantity).toBe(5); // Need 10, have 5 available
    });

    it('should include scrap percentage in requirement calculation', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 100, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      // First call for finished-1, second call (recursive) for comp-1 returns empty
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          {
            componentProductId: 'comp-1',
            quantity: createDecimal(1),
            scrapPercentage: createDecimal(10), // 10% scrap
            componentProduct: { id: 'comp-1' },
          },
        ])
        .mockResolvedValueOnce([]); // No sub-components

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 50,
        reorderQuantity: 100,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: null,
        supplier: null,
        inventory: [{ quantity: 0, reservedQuantity: 0 }],
      });

      const result = await mrpService.calculateRequirementsForOrders();

      // Required = 100 * 1 * (1 + 10/100) = 110
      const req = result.requirements.find(r => r.productId === 'comp-1');
      expect(req?.requiredQuantity).toBeCloseTo(110, 5);
    });

    it('should generate suggested purchase orders grouped by supplier', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 10, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
        { componentProductId: 'comp-2', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-2' } },
      ]);

      prismaMock.product.findUnique
        .mockResolvedValueOnce({
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(10),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        })
        .mockResolvedValueOnce({
          id: 'comp-2',
          sku: 'COMP-002',
          name: 'Component 2',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 5,
          cost: createDecimal(20),
          supplierId: 'sup-1', // Same supplier
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        });

      const result = await mrpService.calculateRequirementsForOrders();

      expect(result.suggestedPurchaseOrders.length).toBe(1);
      expect(result.suggestedPurchaseOrders[0].supplierId).toBe('sup-1');
      expect(result.suggestedPurchaseOrders[0].items.length).toBe(2);
    });

    it('should sort requirements by priority', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 10, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-low', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-low' } },
        { componentProductId: 'comp-critical', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-critical' } },
      ]);

      prismaMock.product.findUnique
        .mockResolvedValueOnce({
          id: 'comp-low',
          sku: 'LOW',
          name: 'Low Priority',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 15,
          reorderQuantity: 30,
          leadTimeDays: 7,
          cost: createDecimal(10),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 10, reservedQuantity: 0 }], // Above minStock
        })
        .mockResolvedValueOnce({
          id: 'comp-critical',
          sku: 'CRIT',
          name: 'Critical',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 15,
          reorderQuantity: 30,
          leadTimeDays: 7,
          cost: createDecimal(10),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }], // Zero stock
        });

      const result = await mrpService.calculateRequirementsForOrders();

      // Critical should come first
      expect(result.requirements[0].priority).toBe('CRITICAL');
    });

    it('should calculate summary statistics', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderDate: new Date('2025-02-20'),
          status: 'CONFIRMED',
          items: [{ productId: 'finished-1', quantity: 10, product: { id: 'finished-1', bomItems: [] } }],
        },
      ]);

      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 20,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 0, reservedQuantity: 0 }],
      });

      const result = await mrpService.calculateRequirementsForOrders();

      expect(result.summary.totalMaterials).toBeGreaterThanOrEqual(0);
      expect(result.summary.criticalShortages).toBeDefined();
      expect(result.summary.highPriorityItems).toBeDefined();
      expect(result.summary.estimatedTotalCost).toBeDefined();
      expect(result.summary.suppliersInvolved).toBeDefined();
    });

    it('should handle empty pending orders', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await mrpService.calculateRequirementsForOrders();

      expect(result.requirements).toEqual([]);
      expect(result.summary.totalMaterials).toBe(0);
    });
  });

  describe('calculateRequirementsForProduction', () => {
    const requiredDate = new Date('2025-03-01');

    it('should calculate requirements for specific production', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(2), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 20,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 5, reservedQuantity: 0 }],
      });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 10, requiredDate);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].requiredQuantity).toBe(20); // 10 * 2
    });

    it('should filter out requirements with no shortage and sufficient stock', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 100, reservedQuantity: 0 }], // Plenty of stock
      });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 5, requiredDate);

      // Should be filtered out since no shortage and above reorder point
      expect(result.length).toBe(0);
    });

    it('should assign CRITICAL priority when shortage and zero stock', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 0, reservedQuantity: 0 }],
      });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 10, requiredDate);

      expect(result[0].priority).toBe('CRITICAL');
    });

    it('should assign HIGH priority when shortage with some stock', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 5, reservedQuantity: 0 }], // Some stock but shortage
      });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 10, requiredDate);

      expect(result[0].priority).toBe('HIGH');
    });

    it('should calculate suggested order date based on lead time', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([
        { componentProductId: 'comp-1', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
      ]);

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 10,
        reorderQuantity: 50,
        leadTimeDays: 14, // 14 days lead time
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 0, reservedQuantity: 0 }],
      });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 10, requiredDate);

      // Suggested order date should be 14 days before required date
      const expectedOrderDate = new Date(requiredDate);
      expectedOrderDate.setDate(expectedOrderDate.getDate() - 14);

      expect(result[0].suggestedOrderDate.toDateString()).toBe(expectedOrderDate.toDateString());
    });
  });

  describe('analyzeInventoryAndSuggestReorders', () => {
    it('should find products below reorder point', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Low Stock Product',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 15, reservedQuantity: 0 }], // Below reorder point of 20
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result.length).toBe(1);
      expect(result[0].productId).toBe('prod-1');
    });

    it('should assign CRITICAL priority for zero stock', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Out of Stock',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result[0].priority).toBe('CRITICAL');
    });

    it('should assign HIGH priority when below minStock', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Low Stock',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 5, reservedQuantity: 0 }], // Below minStock of 10
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result[0].priority).toBe('HIGH');
    });

    it('should assign MEDIUM priority when between minStock and reorderPoint', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Medium Stock',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 30,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 15, reservedQuantity: 0 }], // Between minStock (10) and reorderPoint (30)
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result[0].priority).toBe('MEDIUM');
    });

    it('should sort results by priority', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-medium',
          sku: 'MED',
          name: 'Medium Priority',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 30,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 15, reservedQuantity: 0 }],
        },
        {
          id: 'prod-critical',
          sku: 'CRIT',
          name: 'Critical Priority',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result[0].priority).toBe('CRITICAL');
      expect(result[1].priority).toBe('MEDIUM');
    });

    it('should calculate reorder quantity using default when not set', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product',
          unit: 'pz',
          minStock: 20,
          reorderPoint: 30,
          reorderQuantity: null, // Not set
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 10, reservedQuantity: 0 }],
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      // Default should be max(minStock * 2, 10) = max(40, 10) = 40
      expect(result[0].reorderQuantity).toBe(40);
    });

    it('should not include products above reorder point', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Well Stocked',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 100, reservedQuantity: 0 }], // Above reorder point
        },
      ]);

      const result = await mrpService.analyzeInventoryAndSuggestReorders();

      expect(result.length).toBe(0);
    });
  });

  describe('forecastDemand', () => {
    it('should calculate forecast based on historical sales', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 900 }, // 900 units in 90 days = 10/day
        _count: 50,
      });

      const result = await mrpService.forecastDemand('prod-1', 30);

      // 10/day * 30 days = 300
      expect(result.forecastQuantity).toBe(300);
      expect(result.productId).toBe('prod-1');
    });

    it('should return high confidence for many orders', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 900 },
        _count: 25, // >= 20 orders
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.confidence).toBe(0.9);
    });

    it('should return medium confidence for moderate orders', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 450 },
        _count: 15, // >= 10 orders
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.confidence).toBe(0.7);
    });

    it('should return lower confidence for few orders', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 100 },
        _count: 7, // >= 5 orders
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.confidence).toBe(0.6);
    });

    it('should return base confidence for very few orders', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 10 },
        _count: 2, // < 5 orders
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.confidence).toBe(0.5);
    });

    it('should handle zero sales', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 0 },
        _count: 0,
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.forecastQuantity).toBe(0);
    });

    it('should use default forecast days of 30', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 90 }, // 1/day
        _count: 10,
      });

      const result = await mrpService.forecastDemand('prod-1');

      expect(result.forecastQuantity).toBe(30); // 1/day * 30 days
    });

    it('should accept custom forecast days', async () => {
      prismaMock.orderItem.aggregate.mockResolvedValue({
        _sum: { quantity: 90 }, // 1/day
        _count: 10,
      });

      const result = await mrpService.forecastDemand('prod-1', 60);

      expect(result.forecastQuantity).toBe(60); // 1/day * 60 days
    });
  });

  describe('createPurchaseOrderFromRequirements', () => {
    const mockRequirements = [
      {
        productId: 'comp-1',
        sku: 'COMP-001',
        name: 'Component 1',
        unit: 'pz',
        requiredQuantity: 100,
        availableQuantity: 10,
        reservedQuantity: 0,
        shortageQuantity: 90,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTimeDays: 7,
        supplierId: 'sup-1',
        supplierName: 'Supplier 1',
        suggestedOrderDate: new Date(),
        priority: 'HIGH' as const,
        estimatedCost: 1000,
      },
    ];

    it('should create purchase order from requirements', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1', orderNumber: 'PO-2025-000001' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      const result = await mrpService.createPurchaseOrderFromRequirements('sup-1', mockRequirements);

      expect(result).toBe('po-1');
      expect(prismaMock.purchaseOrder.create).toHaveBeenCalled();
    });

    it('should generate sequential order number', async () => {
      const currentYear = new Date().getFullYear();
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        orderNumber: `PO-${currentYear}-000005`,
      });
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1', orderNumber: `PO-${currentYear}-000006` });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await mrpService.createPurchaseOrderFromRequirements('sup-1', mockRequirements);

      expect(prismaMock.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: `PO-${currentYear}-000006`,
          }),
        })
      );
    });

    it('should throw error if no requirements for supplier', async () => {
      await expect(
        mrpService.createPurchaseOrderFromRequirements('sup-different', mockRequirements)
      ).rejects.toThrow('Nessun requisito per questo fornitore');
    });

    it('should calculate totals with 22% tax', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await mrpService.createPurchaseOrderFromRequirements('sup-1', mockRequirements);

      // reorderQuantity = 100, unitPrice = 10, subtotal = 1000, tax = 220
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
            tax: 220,
            total: 1220,
          }),
        })
      );
    });

    it('should create items with tax included', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await mrpService.createPurchaseOrderFromRequirements('sup-1', mockRequirements);

      expect(prismaMock.purchaseOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'comp-1',
            quantity: 100,
            unitPrice: 10,
            tax: 220, // 1000 * 0.22
            total: 1220, // 1000 * 1.22
          }),
        })
      );
    });

    it('should calculate expected date based on max lead time', async () => {
      const multipleRequirements = [
        { ...mockRequirements[0], leadTimeDays: 7 },
        { ...mockRequirements[0], productId: 'comp-2', sku: 'COMP-002', leadTimeDays: 14 },
      ];

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await mrpService.createPurchaseOrderFromRequirements('sup-1', multipleRequirements);

      expect(prismaMock.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expectedDate: expect.any(Date),
          }),
        })
      );
    });

    it('should log order creation', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: 'po-1', orderNumber: 'PO-2025-000001' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'comp-1', cost: createDecimal(10) });
      prismaMock.purchaseOrderItem.create.mockResolvedValue({ id: 'poi-1' });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await mrpService.createPurchaseOrderFromRequirements('sup-1', mockRequirements);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Ordine acquisto')
      );
    });
  });

  describe('notifyCriticalShortages', () => {
    it('should notify users about critical shortages', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Critical Product',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }], // Critical
        },
      ]);

      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);

      const result = await mrpService.notifyCriticalShortages();

      expect(result).toBe(1);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no critical shortages', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const result = await mrpService.notifyCriticalShortages();

      expect(result).toBe(0);
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should include HIGH priority items in notification', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'High Priority Product',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 5, reservedQuantity: 0 }], // Below minStock = HIGH
        },
      ]);

      prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const result = await mrpService.notifyCriticalShortages();

      expect(result).toBe(1);
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should notify correct roles (ADMIN, MANAGER, MAGAZZINIERE)', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Critical',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        },
      ]);

      prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      await mrpService.notifyCriticalShortages();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { in: ['ADMIN', 'MANAGER', 'MAGAZZINIERE'] },
          isActive: true,
        },
        select: { id: true },
      });
    });

    it('should create notification with correct content', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Critical',
          unit: 'pz',
          minStock: 10,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(15),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        },
      ]);

      prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      await mrpService.notifyCriticalShortages();

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'LOW_STOCK',
        title: '1 materiali con scorte critiche',
        message: expect.stringContaining('riordino urgente'),
        link: '/inventory?filter=low-stock',
      });
    });
  });

  describe('BOM explosion (via public methods)', () => {
    it('should handle multi-level BOM explosion', async () => {
      // Level 1: finished product has comp-1
      // Level 2: comp-1 has sub-comp-1
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          { componentProductId: 'comp-1', quantity: createDecimal(2), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-1' } },
        ])
        .mockResolvedValueOnce([
          { componentProductId: 'sub-comp-1', quantity: createDecimal(3), scrapPercentage: createDecimal(0), componentProduct: { id: 'sub-comp-1' } },
        ])
        .mockResolvedValueOnce([]); // No more sub-components

      prismaMock.product.findUnique
        .mockResolvedValueOnce({
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 7,
          cost: createDecimal(10),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        })
        .mockResolvedValueOnce({
          id: 'sub-comp-1',
          sku: 'SUB-001',
          name: 'Sub Component 1',
          unit: 'pz',
          minStock: 5,
          reorderPoint: 20,
          reorderQuantity: 50,
          leadTimeDays: 5,
          cost: createDecimal(5),
          supplierId: 'sup-1',
          supplier: { businessName: 'Supplier 1' },
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        });

      const result = await mrpService.calculateRequirementsForProduction('prod-1', 10, new Date('2025-03-01'));

      // Should have both components
      expect(result.length).toBe(2);
      expect(result.find(r => r.productId === 'comp-1')).toBeDefined();
      expect(result.find(r => r.productId === 'sub-comp-1')).toBeDefined();
    });

    it('should detect and handle BOM cycles', async () => {
      // Create a cycle: A -> B -> A
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          { componentProductId: 'comp-b', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'comp-b' } },
        ])
        .mockResolvedValueOnce([
          { componentProductId: 'prod-a', quantity: createDecimal(1), scrapPercentage: createDecimal(0), componentProduct: { id: 'prod-a' } }, // Cycle back
        ])
        .mockResolvedValue([]); // Stop recursion

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'comp-b',
        sku: 'COMP-B',
        name: 'Component B',
        unit: 'pz',
        minStock: 5,
        reorderPoint: 20,
        reorderQuantity: 50,
        leadTimeDays: 7,
        cost: createDecimal(10),
        supplierId: 'sup-1',
        supplier: { businessName: 'Supplier 1' },
        inventory: [{ quantity: 0, reservedQuantity: 0 }],
      });

      // Should not throw, just log warning and skip cycle
      const result = await mrpService.calculateRequirementsForProduction('prod-a', 10, new Date('2025-03-01'));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ciclo rilevato')
      );
    });
  });
});
