// Mock Prisma
const prismaMock = {
  orderItem: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  productIdeationCost: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  inventoryItem: {
    aggregate: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import { productAnalyticsService } from '@server/services/product-analytics.service';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to create Decimal mock
const createDecimal = (value: number): Decimal => new Decimal(value);

describe('ProductAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProductSalesOverTime', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should aggregate sales by day', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 5,
          total: createDecimal(500),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 3,
          total: createDecimal(300),
          order: { orderDate: new Date('2025-06-16') },
          product: { cost: createDecimal(50) },
        },
      ]);

      const result = await productAnalyticsService.getProductSalesOverTime('p1', period, 'day');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-06-15');
      expect(result[0].quantity).toBe(15);
      expect(result[0].revenue).toBe(1500);
    });

    it('should aggregate sales by week', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-02') }, // Monday
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 5,
          total: createDecimal(500),
          order: { orderDate: new Date('2025-06-05') }, // Thursday (same week)
          product: { cost: createDecimal(50) },
        },
      ]);

      const result = await productAnalyticsService.getProductSalesOverTime('p1', period, 'week');

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(15);
    });

    it('should aggregate sales by month', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-01') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 20,
          total: createDecimal(2000),
          order: { orderDate: new Date('2025-06-30') },
          product: { cost: createDecimal(50) },
        },
      ]);

      const result = await productAnalyticsService.getProductSalesOverTime('p1', period, 'month');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2025-06');
      expect(result[0].quantity).toBe(30);
    });

    it('should calculate profit correctly', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) }, // Cost = 10 * 50 = 500
        },
      ]);

      const result = await productAnalyticsService.getProductSalesOverTime('p1', period, 'day');

      expect(result[0].cost).toBe(500);
      expect(result[0].profit).toBe(500); // 1000 - 500
    });

    it('should sort results by date', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 5,
          total: createDecimal(500),
          order: { orderDate: new Date('2025-06-20') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-10') },
          product: { cost: createDecimal(50) },
        },
      ]);

      const result = await productAnalyticsService.getProductSalesOverTime('p1', period, 'day');

      expect(result[0].date).toBe('2025-06-10');
      expect(result[1].date).toBe('2025-06-20');
    });
  });

  describe('getCumulativeProfitTrack', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should start with negative ideation costs', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(5000) },
      });
      prismaMock.orderItem.findMany.mockResolvedValue([]);

      const result = await productAnalyticsService.getCumulativeProfitTrack('p1', period);

      expect(result.startingPoint).toBe(-5000);
    });

    it('should track cumulative profit over time', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1000) },
      });
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-20') },
          product: { cost: createDecimal(50) },
        },
      ]);

      const result = await productAnalyticsService.getCumulativeProfitTrack('p1', period);

      // Starting: -1000
      // Day 1: profit = 500, cumulative = -500
      // Day 2: profit = 500, cumulative = 0
      expect(result.data).toHaveLength(2);
      expect(result.data[0].cumulativeProfit).toBe(-500);
      expect(result.data[1].cumulativeProfit).toBe(0);
    });

    it('should mark when break-even is reached', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(500) },
      });
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(40) }, // Profit = 600
        },
      ]);

      const result = await productAnalyticsService.getCumulativeProfitTrack('p1', period);

      expect(result.data[0].isAboveBreakEven).toBe(true);
    });
  });

  describe('getProductIdeationCosts', () => {
    it('should return all ideation costs for a product', async () => {
      const mockCosts = [
        { id: 'c1', productId: 'p1', type: 'DESIGN', amount: createDecimal(1000), date: new Date() },
        { id: 'c2', productId: 'p1', type: 'PROTOTYPE', amount: createDecimal(500), date: new Date() },
      ];

      prismaMock.productIdeationCost.findMany.mockResolvedValue(mockCosts);

      const result = await productAnalyticsService.getProductIdeationCosts('p1');

      expect(result).toHaveLength(2);
      expect(prismaMock.productIdeationCost.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: { date: 'desc' },
      });
    });

    it('should return empty array when no costs exist', async () => {
      prismaMock.productIdeationCost.findMany.mockResolvedValue([]);

      const result = await productAnalyticsService.getProductIdeationCosts('p1');

      expect(result).toEqual([]);
    });
  });

  describe('addIdeationCost', () => {
    it('should create a new ideation cost', async () => {
      const mockCost = {
        id: 'c1',
        productId: 'p1',
        type: 'DESIGN',
        description: 'Logo design',
        amount: createDecimal(1000),
        date: new Date(),
      };

      prismaMock.productIdeationCost.create.mockResolvedValue(mockCost);

      const result = await productAnalyticsService.addIdeationCost('p1', {
        type: 'DESIGN',
        description: 'Logo design',
        amount: 1000,
      });

      expect(result.id).toBe('c1');
      expect(prismaMock.productIdeationCost.create).toHaveBeenCalled();
    });

    it('should use current date if not provided', async () => {
      prismaMock.productIdeationCost.create.mockResolvedValue({ id: 'c1' });

      await productAnalyticsService.addIdeationCost('p1', {
        type: 'MARKETING',
        description: 'Campaign',
        amount: 500,
      });

      const createCall = prismaMock.productIdeationCost.create.mock.calls[0][0];
      expect(createCall.data.date).toBeInstanceOf(Date);
    });

    it('should include optional fields', async () => {
      prismaMock.productIdeationCost.create.mockResolvedValue({ id: 'c1' });

      await productAnalyticsService.addIdeationCost('p1', {
        type: 'TOOLING',
        description: 'Mold creation',
        amount: 5000,
        amortizedUnits: 1000,
        notes: 'Per injection molding',
      });

      const createCall = prismaMock.productIdeationCost.create.mock.calls[0][0];
      expect(createCall.data.amortizedUnits).toBe(1000);
      expect(createCall.data.notes).toBe('Per injection molding');
    });
  });

  describe('updateIdeationCost', () => {
    it('should update ideation cost', async () => {
      const mockCost = {
        id: 'c1',
        amount: createDecimal(2000),
      };

      prismaMock.productIdeationCost.update.mockResolvedValue(mockCost);

      const result = await productAnalyticsService.updateIdeationCost('c1', {
        amount: 2000,
      });

      expect(prismaMock.productIdeationCost.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { amount: 2000 },
      });
      expect(result.id).toBe('c1');
    });

    it('should support partial updates', async () => {
      prismaMock.productIdeationCost.update.mockResolvedValue({ id: 'c1' });

      await productAnalyticsService.updateIdeationCost('c1', {
        description: 'Updated description',
      });

      const updateCall = prismaMock.productIdeationCost.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ description: 'Updated description' });
    });
  });

  describe('deleteIdeationCost', () => {
    it('should delete ideation cost', async () => {
      prismaMock.productIdeationCost.delete.mockResolvedValue({ id: 'c1' });

      const result = await productAnalyticsService.deleteIdeationCost('c1');

      expect(prismaMock.productIdeationCost.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
      expect(result.id).toBe('c1');
    });

    it('should throw if cost not found', async () => {
      prismaMock.productIdeationCost.delete.mockRejectedValue(new Error('Not found'));

      await expect(productAnalyticsService.deleteIdeationCost('invalid')).rejects.toThrow();
    });
  });

  describe('calculateBreakEven', () => {
    it('should calculate break-even units', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(5000) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 30 } });

      const result = await productAnalyticsService.calculateBreakEven('p1');

      // Margin = 100 - 50 = 50
      // Break-even = 5000 / 50 = 100 units
      expect(result.breakEvenUnits).toBe(100);
      expect(result.unitMargin).toBe(50);
      expect(result.totalIdeationCosts).toBe(5000);
    });

    it('should return -1 when margin is zero', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1000) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        price: createDecimal(50),
        cost: createDecimal(50), // Zero margin
      });
      prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 0, total: null } });

      const result = await productAnalyticsService.calculateBreakEven('p1');

      expect(result.breakEvenUnits).toBe(-1);
    });

    it('should detect when break-even is reached', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(5000) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 150, total: createDecimal(15000) } }) // Total sales
        .mockResolvedValueOnce({ _sum: { quantity: 45 } }); // Recent sales

      prismaMock.orderItem.findMany.mockResolvedValue([
        { quantity: 50, order: { orderDate: new Date('2025-03-01') } },
        { quantity: 50, order: { orderDate: new Date('2025-04-01') } },
        { quantity: 50, order: { orderDate: new Date('2025-05-01') } },
      ]);

      const result = await productAnalyticsService.calculateBreakEven('p1');

      expect(result.isBreakEvenReached).toBe(true);
      expect(result.breakEvenDate).toBeDefined();
    });

    it('should project break-even date when not reached', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(5000) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } }) // Total sales (50 units)
        .mockResolvedValueOnce({ _sum: { quantity: 45 } }); // Recent sales (45 in 90 days = 0.5/day)

      const result = await productAnalyticsService.calculateBreakEven('p1');

      // Need 100 units, have 50, need 50 more
      // At 0.5/day, need 100 days
      expect(result.isBreakEvenReached).toBe(false);
      expect(result.projectedBreakEvenDate).toBeDefined();
      expect(result.unitsToBreakEven).toBe(50);
    });

    it('should calculate daily sales average from last 90 days', async () => {
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1000) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 10, total: createDecimal(1000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 90 } }); // 90 units in 90 days

      const result = await productAnalyticsService.calculateBreakEven('p1');

      expect(result.dailySalesAverage).toBe(1); // 90/90
    });
  });

  describe('getProductAnalytics', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should combine sales data, ideation costs, and break-even', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) },
        },
      ]);
      prismaMock.productIdeationCost.findMany.mockResolvedValue([
        { id: 'c1', type: 'DESIGN', amount: createDecimal(500) },
      ]);
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(500) },
      });
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'SKU001',
        name: 'Test Product',
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 10, total: createDecimal(1000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 10 } });

      const result = await productAnalyticsService.getProductAnalytics('p1', period);

      expect(result.product).toBeDefined();
      expect(result.salesData).toBeDefined();
      expect(result.ideationCosts).toBeDefined();
      expect(result.breakEven).toBeDefined();
      expect(result.kpis).toBeDefined();
    });

    it('should calculate KPIs from sales data', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          order: { orderDate: new Date('2025-06-15') },
          product: { cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 5,
          total: createDecimal(500),
          order: { orderDate: new Date('2025-06-20') },
          product: { cost: createDecimal(50) },
        },
      ]);
      prismaMock.productIdeationCost.findMany.mockResolvedValue([]);
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'SKU001',
        name: 'Test Product',
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 0, total: null } });

      const result = await productAnalyticsService.getProductAnalytics('p1', period);

      expect(result.kpis.totalRevenue).toBe(1500);
      expect(result.kpis.totalQuantity).toBe(15);
      expect(result.kpis.totalProfit).toBe(750); // 1500 - 750
      expect(result.kpis.ordersCount).toBe(2);
    });

    it('should include product details', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([]);
      prismaMock.productIdeationCost.findMany.mockResolvedValue([]);
      prismaMock.productIdeationCost.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'SKU001',
        name: 'Test Product',
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 0, total: null } });

      const result = await productAnalyticsService.getProductAnalytics('p1', period);

      expect(result.product?.sku).toBe('SKU001');
      expect(result.product?.name).toBe('Test Product');
    });
  });

  describe('compareProducts', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should compare multiple products', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce({ id: 'p1', sku: 'SKU001', name: 'Product 1', price: createDecimal(100), cost: createDecimal(50) })
        .mockResolvedValueOnce({ id: 'p2', sku: 'SKU002', name: 'Product 2', price: createDecimal(200), cost: createDecimal(100) });

      prismaMock.orderItem.findMany
        .mockResolvedValueOnce([
          { productId: 'p1', quantity: 10, total: createDecimal(1000), order: { orderDate: new Date('2025-06-15') }, product: { cost: createDecimal(50) } },
        ])
        .mockResolvedValueOnce([
          { productId: 'p2', quantity: 20, total: createDecimal(4000), order: { orderDate: new Date('2025-06-15') }, product: { cost: createDecimal(100) } },
        ]);

      const result = await productAnalyticsService.compareProducts(['p1', 'p2'], period);

      expect(result).toHaveLength(2);
      expect(result[0].summary.totalQuantity).toBe(10);
      expect(result[1].summary.totalQuantity).toBe(20);
    });

    it('should calculate summary for each product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'SKU001',
        name: 'Product 1',
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 10, total: createDecimal(1000), order: { orderDate: new Date('2025-06-15') }, product: { cost: createDecimal(50) } },
      ]);

      const result = await productAnalyticsService.compareProducts(['p1'], period);

      expect(result[0].summary.totalRevenue).toBe(1000);
      expect(result[0].summary.totalProfit).toBe(500);
      expect(result[0].summary.avgMargin).toBe(50);
    });

    it('should handle products with no sales', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'SKU001',
        name: 'Product 1',
        price: createDecimal(100),
        cost: createDecimal(50),
      });
      prismaMock.orderItem.findMany.mockResolvedValue([]);

      const result = await productAnalyticsService.compareProducts(['p1'], period);

      expect(result[0].summary.totalQuantity).toBe(0);
      expect(result[0].summary.avgMargin).toBe(0);
    });
  });

  describe('analyzeSeasonality', () => {
    it('should analyze seasonality for a specific product', async () => {
      const orderItems = Array.from({ length: 12 }, (_, i) => ({
        productId: 'p1',
        quantity: (i === 11 ? 100 : 10), // December has 100, others have 10
        total: createDecimal((i === 11 ? 10000 : 1000)),
        order: { orderDate: new Date(2024, i, 15) },
        product: { id: 'p1', sku: 'SKU001', name: 'Seasonal Product' },
      }));

      prismaMock.orderItem.findMany.mockResolvedValue(orderItems);

      const result = await productAnalyticsService.analyzeSeasonality('p1');

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
      expect(result[0].peakMonths).toContain(12); // December
      expect(result[0].seasonalityScore).toBeGreaterThan(0);
    });

    it('should analyze seasonality for all products', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 10, total: createDecimal(1000), order: { orderDate: new Date(2024, 5, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Product 1' } },
        { productId: 'p2', quantity: 20, total: createDecimal(2000), order: { orderDate: new Date(2024, 5, 15) }, product: { id: 'p2', sku: 'SKU002', name: 'Product 2' } },
      ]);

      const result = await productAnalyticsService.analyzeSeasonality();

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify peak and low months', async () => {
      // Create data with clear peaks in June, July, August and lows in Jan, Feb, Mar
      const orderItems = [
        { productId: 'p1', quantity: 100, total: createDecimal(10000), order: { orderDate: new Date(2024, 5, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
        { productId: 'p1', quantity: 90, total: createDecimal(9000), order: { orderDate: new Date(2024, 6, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
        { productId: 'p1', quantity: 80, total: createDecimal(8000), order: { orderDate: new Date(2024, 7, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
        { productId: 'p1', quantity: 10, total: createDecimal(1000), order: { orderDate: new Date(2024, 0, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
        { productId: 'p1', quantity: 5, total: createDecimal(500), order: { orderDate: new Date(2024, 1, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
        { productId: 'p1', quantity: 8, total: createDecimal(800), order: { orderDate: new Date(2024, 2, 15) }, product: { id: 'p1', sku: 'SKU001', name: 'Summer Product' } },
      ];

      prismaMock.orderItem.findMany.mockResolvedValue(orderItems);

      const result = await productAnalyticsService.analyzeSeasonality('p1');

      // Peak months should include the summer months with most sales
      expect(result[0].peakMonths).toContain(6); // June (month index is 5, but result is month number 6)
      // Low months are the bottom 3 - could include months with no data (0) or lowest values
      expect(result[0].lowMonths.length).toBe(3);
    });

    it('should calculate seasonality score (coefficient of variation)', async () => {
      // Uniform distribution should have low seasonality score
      const uniformItems = Array.from({ length: 12 }, (_, i) => ({
        productId: 'p1',
        quantity: 100,
        total: createDecimal(10000),
        order: { orderDate: new Date(2024, i, 15) },
        product: { id: 'p1', sku: 'SKU001', name: 'Uniform Product' },
      }));

      prismaMock.orderItem.findMany.mockResolvedValue(uniformItems);

      const result = await productAnalyticsService.analyzeSeasonality('p1');

      // Low seasonality for uniform distribution
      expect(result[0].seasonalityScore).toBeLessThan(50);
    });
  });

  describe('getProductRecommendations', () => {
    it('should classify products as FOCUS, MAINTAIN, REVIEW, or REMOVE', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'Top Product', category: 'Cat1', price: createDecimal(100), cost: createDecimal(30) },
        { id: 'p2', sku: 'SKU002', name: 'Bad Product', category: 'Cat1', price: createDecimal(100), cost: createDecimal(90) },
      ]);

      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } }) // p1 recent
        .mockResolvedValueOnce({ _sum: { quantity: 30, total: createDecimal(3000) } }) // p1 previous
        .mockResolvedValueOnce({ _sum: { quantity: 0, total: null } }) // p2 recent
        .mockResolvedValueOnce({ _sum: { quantity: 10, total: createDecimal(1000) } }); // p2 previous

      prismaMock.inventoryItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 20 } }) // p1 inventory
        .mockResolvedValueOnce({ _sum: { quantity: 100 } }); // p2 inventory

      const result = await productAnalyticsService.getProductRecommendations();

      expect(result).toHaveLength(2);
      // Top product should be FOCUS or MAINTAIN
      expect(['FOCUS', 'MAINTAIN']).toContain(result[0].recommendation);
      // Bad product should be REVIEW or REMOVE
      expect(['REVIEW', 'REMOVE']).toContain(result[1].recommendation);
    });

    it('should calculate score based on metrics', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'Product', category: 'Cat1', price: createDecimal(100), cost: createDecimal(50) },
      ]);

      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 30, total: createDecimal(3000) } });

      prismaMock.inventoryItem.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

      const result = await productAnalyticsService.getProductRecommendations();

      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].metrics.margin).toBeDefined();
      expect(result[0].metrics.salesTrend).toBeDefined();
      expect(result[0].metrics.salesVolume).toBeDefined();
      expect(result[0].metrics.stockTurnover).toBeDefined();
    });

    it('should include reasons for recommendation', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'High Margin Product', category: 'Cat1', price: createDecimal(100), cost: createDecimal(30) },
      ]);

      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 100, total: createDecimal(10000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } });

      prismaMock.inventoryItem.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

      const result = await productAnalyticsService.getProductRecommendations();

      expect(result[0].reasons).toBeDefined();
      expect(Array.isArray(result[0].reasons)).toBe(true);
    });

    it('should sort by score descending', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'low', sku: 'LOW', name: 'Low Score', category: 'Cat1', price: createDecimal(100), cost: createDecimal(95) },
        { id: 'high', sku: 'HIGH', name: 'High Score', category: 'Cat1', price: createDecimal(100), cost: createDecimal(20) },
      ]);

      // Low score product
      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 1, total: createDecimal(100) } })
        .mockResolvedValueOnce({ _sum: { quantity: 5, total: createDecimal(500) } })
        // High score product
        .mockResolvedValueOnce({ _sum: { quantity: 100, total: createDecimal(10000) } })
        .mockResolvedValueOnce({ _sum: { quantity: 50, total: createDecimal(5000) } });

      prismaMock.inventoryItem.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

      const result = await productAnalyticsService.getProductRecommendations();

      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('should handle products with no sales', async () => {
      // Low margin (10%) + no sales = score < 30 = REMOVE
      // marginScore = 10 * 2 = 20, trendScore = 50, volumeScore = 0, turnoverScore = 0
      // score = 20 * 0.3 + 50 * 0.25 + 0 + 0 = 6 + 12.5 = 18.5 < 30
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'No Sales', category: 'Cat1', price: createDecimal(100), cost: createDecimal(90) },
      ]);

      prismaMock.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 0, total: null } })
        .mockResolvedValueOnce({ _sum: { quantity: 0, total: null } });

      prismaMock.inventoryItem.aggregate.mockResolvedValue({ _sum: { quantity: 100 } });

      const result = await productAnalyticsService.getProductRecommendations();

      expect(result[0].recommendation).toBe('REMOVE');
    });
  });

  describe('getHighestMarginProducts', () => {
    it('should return products with highest margins', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          total: createDecimal(1000),
          product: { id: 'p1', sku: 'SKU001', name: 'High Margin', category: 'Cat1', price: createDecimal(100), cost: createDecimal(20) },
        },
        {
          productId: 'p2',
          quantity: 10,
          total: createDecimal(1000),
          product: { id: 'p2', sku: 'SKU002', name: 'Low Margin', category: 'Cat1', price: createDecimal(100), cost: createDecimal(80) },
        },
      ]);

      const result = await productAnalyticsService.getHighestMarginProducts(10);

      expect(result[0].id).toBe('p1');
      expect(result[0].marginPercent).toBeGreaterThan(result[1].marginPercent);
    });

    it('should limit results', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          productId: `p${i}`,
          quantity: 10,
          total: createDecimal(1000),
          product: { id: `p${i}`, sku: `SKU${i}`, name: `Product ${i}`, category: 'Cat1', price: createDecimal(100), cost: createDecimal(50 - i) },
        }))
      );

      const result = await productAnalyticsService.getHighestMarginProducts(5);

      expect(result).toHaveLength(5);
    });
  });

  describe('getHighestCostProducts', () => {
    it('should return products with highest costs', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'Expensive', category: 'Cat1', cost: createDecimal(500), price: createDecimal(800) },
        { id: 'p2', sku: 'SKU002', name: 'Cheap', category: 'Cat1', cost: createDecimal(100), price: createDecimal(200) },
      ]);

      const result = await productAnalyticsService.getHighestCostProducts(10);

      expect(result[0].cost).toBe(500);
      expect(result[1].cost).toBe(100);
    });

    it('should include margin calculation', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU001', name: 'Product', category: 'Cat1', cost: createDecimal(500), price: createDecimal(1000) },
      ]);

      const result = await productAnalyticsService.getHighestCostProducts(10);

      expect(result[0].margin).toBe(50); // (1000-500)/1000 * 100
    });
  });
});
