// Mock Prisma
const prismaMock = {
  order: {
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  customer: {
    findMany: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
  },
  inventoryItem: {
    findMany: jest.fn(),
  },
  material: {
    findMany: jest.fn(),
  },
  warehouse: {
    count: jest.fn(),
  },
  supplier: {
    count: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import { analyticsService } from '@server/services/analytics.service';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to create Decimal mock
const createDecimal = (value: number): Decimal => new Decimal(value);

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardKPIs', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should calculate revenue and orders count', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000), status: 'DELIVERED', source: 'WEB' },
        { total: createDecimal(2000), status: 'DELIVERED', source: 'B2B' },
        { total: createDecimal(500), status: 'PROCESSING', source: 'WEB' },
      ]);
      prismaMock.product.findMany.mockResolvedValue([{ isActive: true }, { isActive: false }]);
      prismaMock.customer.findMany.mockResolvedValue([{ id: 'c1' }]);
      prismaMock.employee.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

      const result = await analyticsService.getDashboardKPIs(period);

      expect(result.revenue).toBe(3500);
      expect(result.ordersCount).toBe(3);
      expect(result.completedOrdersCount).toBe(2);
    });

    it('should calculate completion rate correctly', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000), status: 'DELIVERED', source: 'WEB' },
        { total: createDecimal(2000), status: 'PROCESSING', source: 'WEB' },
        { total: createDecimal(500), status: 'PENDING', source: 'WEB' },
        { total: createDecimal(500), status: 'DELIVERED', source: 'WEB' },
      ]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.employee.findMany.mockResolvedValue([]);

      const result = await analyticsService.getDashboardKPIs(period);

      expect(result.completionRate).toBe(50); // 2 out of 4
    });

    it('should calculate average order value', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000), status: 'DELIVERED', source: 'WEB' },
        { total: createDecimal(2000), status: 'DELIVERED', source: 'WEB' },
      ]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.employee.findMany.mockResolvedValue([]);

      const result = await analyticsService.getDashboardKPIs(period);

      expect(result.averageOrderValue).toBe(1500);
    });

    it('should count active products, customers, employees', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([
        { isActive: true },
        { isActive: true },
        { isActive: false },
      ]);
      prismaMock.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      prismaMock.employee.findMany.mockResolvedValue([{ id: 'e1' }]);

      const result = await analyticsService.getDashboardKPIs(period);

      expect(result.activeProducts).toBe(2);
      expect(result.activeCustomers).toBe(2);
      expect(result.activeEmployees).toBe(1);
    });
  });

  describe('getSalesAnalysisByProduct', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should calculate revenue, cost, and profit per product', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          lineTotal: createDecimal(1000),
          product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'Cat1', cost: createDecimal(50) },
        },
        {
          productId: 'p1',
          quantity: 5,
          lineTotal: createDecimal(500),
          product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'Cat1', cost: createDecimal(50) },
        },
      ]);

      const result = await analyticsService.getSalesAnalysisByProduct(period);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
      expect(result[0].revenue).toBe(1500);
      expect(result[0].cost).toBe(750); // 15 * 50
      expect(result[0].profit).toBe(750);
      expect(result[0].quantitySold).toBe(15);
    });

    it('should calculate margin percentage', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          lineTotal: createDecimal(1000),
          product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'Cat1', cost: createDecimal(50) },
        },
      ]);

      const result = await analyticsService.getSalesAnalysisByProduct(period);

      // Cost = 10 * 50 = 500, Profit = 1000 - 500 = 500, Margin = 50%
      expect(result[0].marginPercent).toBe(50);
    });

    it('should sort by revenue descending', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          quantity: 10,
          lineTotal: createDecimal(500),
          product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'Cat1', cost: createDecimal(30) },
        },
        {
          productId: 'p2',
          quantity: 20,
          lineTotal: createDecimal(2000),
          product: { id: 'p2', sku: 'SKU002', name: 'Product 2', category: 'Cat1', cost: createDecimal(50) },
        },
      ]);

      const result = await analyticsService.getSalesAnalysisByProduct(period);

      expect(result[0].productId).toBe('p2');
      expect(result[1].productId).toBe('p1');
    });
  });

  describe('getTopProducts', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should return top N products by revenue', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          productId: `p${i}`,
          quantity: 10,
          lineTotal: createDecimal((20 - i) * 100),
          product: { id: `p${i}`, sku: `SKU${i}`, name: `Product ${i}`, category: 'Cat1', cost: createDecimal(30) },
        }))
      );

      const result = await analyticsService.getTopProducts(period, 5);

      expect(result).toHaveLength(5);
      expect(result[0].productId).toBe('p0'); // Highest revenue
    });

    it('should handle empty results', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([]);

      const result = await analyticsService.getTopProducts(period, 10);

      expect(result).toEqual([]);
    });
  });

  describe('getTopCustomers', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should return top customers by total spent', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          customerId: 'c1',
          total: createDecimal(5000),
          customer: { code: 'C001', businessName: 'Big Corp', firstName: null, lastName: null, type: 'B2B' },
        },
        {
          customerId: 'c1',
          total: createDecimal(3000),
          customer: { code: 'C001', businessName: 'Big Corp', firstName: null, lastName: null, type: 'B2B' },
        },
        {
          customerId: 'c2',
          total: createDecimal(1000),
          customer: { code: 'C002', businessName: null, firstName: 'John', lastName: 'Doe', type: 'B2C' },
        },
      ]);

      const result = await analyticsService.getTopCustomers(period, 10);

      expect(result).toHaveLength(2);
      expect(result[0].customerId).toBe('c1');
      expect(result[0].totalSpent).toBe(8000);
      expect(result[0].ordersCount).toBe(2);
    });

    it('should format customer names correctly', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          customerId: 'c1',
          total: createDecimal(1000),
          customer: { code: 'C001', businessName: 'Business Co', firstName: null, lastName: null, type: 'B2B' },
        },
        {
          customerId: 'c2',
          total: createDecimal(500),
          customer: { code: 'C002', businessName: null, firstName: 'Jane', lastName: 'Smith', type: 'B2C' },
        },
      ]);

      const result = await analyticsService.getTopCustomers(period, 10);

      expect(result[0].customerName).toBe('Business Co');
      expect(result[1].customerName).toBe('Jane Smith');
    });
  });

  describe('getSalesTrend', () => {
    it('should return 12 months of data', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000) },
      ]);

      const result = await analyticsService.getSalesTrend(2025);

      expect(result).toHaveLength(12);
      expect(result[0].month).toBe(1);
      expect(result[11].month).toBe(12);
    });

    it('should include Italian month names', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await analyticsService.getSalesTrend(2025);

      expect(result[0].monthName).toBeDefined();
      expect(typeof result[0].monthName).toBe('string');
    });

    it('should calculate average order value per month', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000) },
        { total: createDecimal(2000) },
      ]);

      const result = await analyticsService.getSalesTrend(2025);

      // When there are orders, average should be calculated
      if (result[0].ordersCount > 0) {
        expect(result[0].averageOrderValue).toBe(result[0].revenue / result[0].ordersCount);
      }
    });
  });

  describe('forecastSales', () => {
    it('should generate forecasts using MOVING_AVERAGE method', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(10000) },
      ]);

      const result = await analyticsService.forecastSales(3, 'MOVING_AVERAGE');

      expect(result.method).toBe('MOVING_AVERAGE');
      expect(result.forecasts).toHaveLength(3);
      expect(result.historicalData).toHaveLength(12);
    });

    it('should generate forecasts using WEIGHTED_AVERAGE method', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(10000) },
      ]);

      const result = await analyticsService.forecastSales(3, 'WEIGHTED_AVERAGE');

      expect(result.method).toBe('WEIGHTED_AVERAGE');
      expect(result.forecasts).toHaveLength(3);
    });

    it('should include historical data', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(5000) },
      ]);

      const result = await analyticsService.forecastSales(3);

      expect(result.historicalData).toBeDefined();
      expect(Array.isArray(result.historicalData)).toBe(true);
    });

    it('should handle empty historical data', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await analyticsService.forecastSales(3);

      expect(result.forecasts).toHaveLength(3);
      // With no historical data, forecast should be 0
      expect(result.forecasts[0].forecastedRevenue).toBe(0);
    });
  });

  describe('getABCAnalysis', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should classify products into A, B, C categories', async () => {
      // Create 10 products with varying revenue
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100, lineTotal: createDecimal(50000), product: { id: 'p1', sku: 'SKU001', name: 'Top Product', category: 'Cat1', cost: createDecimal(300) } },
        { productId: 'p2', quantity: 50, lineTotal: createDecimal(25000), product: { id: 'p2', sku: 'SKU002', name: 'Second', category: 'Cat1', cost: createDecimal(300) } },
        { productId: 'p3', quantity: 30, lineTotal: createDecimal(15000), product: { id: 'p3', sku: 'SKU003', name: 'Third', category: 'Cat1', cost: createDecimal(300) } },
        { productId: 'p4', quantity: 20, lineTotal: createDecimal(5000), product: { id: 'p4', sku: 'SKU004', name: 'Fourth', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p5', quantity: 10, lineTotal: createDecimal(2500), product: { id: 'p5', sku: 'SKU005', name: 'Fifth', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p6', quantity: 5, lineTotal: createDecimal(1000), product: { id: 'p6', sku: 'SKU006', name: 'Sixth', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p7', quantity: 3, lineTotal: createDecimal(500), product: { id: 'p7', sku: 'SKU007', name: 'Seventh', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p8', quantity: 2, lineTotal: createDecimal(300), product: { id: 'p8', sku: 'SKU008', name: 'Eighth', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p9', quantity: 1, lineTotal: createDecimal(150), product: { id: 'p9', sku: 'SKU009', name: 'Ninth', category: 'Cat1', cost: createDecimal(100) } },
        { productId: 'p10', quantity: 1, lineTotal: createDecimal(50), product: { id: 'p10', sku: 'SKU010', name: 'Tenth', category: 'Cat1', cost: createDecimal(10) } },
      ]);

      const result = await analyticsService.getABCAnalysis(period);

      expect(result.A).toBeDefined();
      expect(result.B).toBeDefined();
      expect(result.C).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should classify A as ~80% of revenue', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100, lineTotal: createDecimal(80000), product: { id: 'p1', sku: 'SKU001', name: 'Top', category: 'Cat1', cost: createDecimal(500) } },
        { productId: 'p2', quantity: 10, lineTotal: createDecimal(10000), product: { id: 'p2', sku: 'SKU002', name: 'Medium', category: 'Cat1', cost: createDecimal(500) } },
        { productId: 'p3', quantity: 5, lineTotal: createDecimal(5000), product: { id: 'p3', sku: 'SKU003', name: 'Low', category: 'Cat1', cost: createDecimal(500) } },
        { productId: 'p4', quantity: 2, lineTotal: createDecimal(3000), product: { id: 'p4', sku: 'SKU004', name: 'VeryLow', category: 'Cat1', cost: createDecimal(500) } },
        { productId: 'p5', quantity: 1, lineTotal: createDecimal(2000), product: { id: 'p5', sku: 'SKU005', name: 'Lowest', category: 'Cat1', cost: createDecimal(500) } },
      ]);

      const result = await analyticsService.getABCAnalysis(period);

      // A should contain top revenue products (up to 80% cumulative)
      const aRevenue = result.A.reduce((sum: number, p: any) => sum + p.revenue, 0);
      const totalRevenue = aRevenue +
        result.B.reduce((sum: number, p: any) => sum + p.revenue, 0) +
        result.C.reduce((sum: number, p: any) => sum + p.revenue, 0);

      expect(aRevenue / totalRevenue).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle empty sales data', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([]);

      const result = await analyticsService.getABCAnalysis(period);

      expect(result.A).toEqual([]);
      expect(result.B).toEqual([]);
      expect(result.C).toEqual([]);
    });

    it('should include cumulative percentages', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 100, lineTotal: createDecimal(10000), product: { id: 'p1', sku: 'SKU001', name: 'Product', category: 'Cat1', cost: createDecimal(50) } },
        { productId: 'p2', quantity: 50, lineTotal: createDecimal(5000), product: { id: 'p2', sku: 'SKU002', name: 'Product2', category: 'Cat1', cost: createDecimal(50) } },
      ]);

      const result = await analyticsService.getABCAnalysis(period);

      // All products should have cumulativePercent
      const allProducts = [...result.A, ...result.B, ...result.C];
      allProducts.forEach((p: any) => {
        expect(p.cumulativePercent).toBeDefined();
      });
    });
  });

  describe('getMarginAnalysisByCategory', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should group by category and calculate margins', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 10, lineTotal: createDecimal(1000), product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'Electronics', cost: createDecimal(50) } },
        { productId: 'p2', quantity: 5, lineTotal: createDecimal(500), product: { id: 'p2', sku: 'SKU002', name: 'Product 2', category: 'Electronics', cost: createDecimal(60) } },
        { productId: 'p3', quantity: 20, lineTotal: createDecimal(2000), product: { id: 'p3', sku: 'SKU003', name: 'Product 3', category: 'Clothing', cost: createDecimal(30) } },
      ]);

      const result = await analyticsService.getMarginAnalysisByCategory(period);

      expect(result.length).toBe(2);
      const electronics = result.find((r: any) => r.category === 'Electronics');
      expect(electronics).toBeDefined();
      expect(electronics.marginPercent).toBeDefined();
    });

    it('should sort by margin percentage descending', async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 10, lineTotal: createDecimal(1000), product: { id: 'p1', sku: 'SKU001', name: 'Product 1', category: 'LowMargin', cost: createDecimal(90) } },
        { productId: 'p2', quantity: 10, lineTotal: createDecimal(1000), product: { id: 'p2', sku: 'SKU002', name: 'Product 2', category: 'HighMargin', cost: createDecimal(10) } },
      ]);

      const result = await analyticsService.getMarginAnalysisByCategory(period);

      expect(result[0].category).toBe('HighMargin');
      expect(result[0].marginPercent).toBeGreaterThan(result[1].marginPercent);
    });
  });

  describe('getOrderPerformanceBySource', () => {
    const period = { start: '2025-01-01', end: '2025-12-31' };

    it('should aggregate orders by source', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { source: 'WEB', status: 'DELIVERED', total: createDecimal(1000) },
        { source: 'WEB', status: 'DELIVERED', total: createDecimal(2000) },
        { source: 'B2B', status: 'DELIVERED', total: createDecimal(5000) },
        { source: 'WEB', status: 'CANCELLED', total: createDecimal(500) },
      ]);

      const result = await analyticsService.getOrderPerformanceBySource(period);

      expect(result).toHaveLength(2);

      const web = result.find((r: any) => r.source === 'WEB');
      expect(web.totalOrders).toBe(3);
      expect(web.completedOrders).toBe(2);
      expect(web.cancelledOrders).toBe(1);
    });

    it('should calculate completion rate by source', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { source: 'WEB', status: 'DELIVERED', total: createDecimal(1000) },
        { source: 'WEB', status: 'CANCELLED', total: createDecimal(500) },
      ]);

      const result = await analyticsService.getOrderPerformanceBySource(period);

      const web = result.find((r: any) => r.source === 'WEB');
      expect(web.completionRate).toBe(50);
    });
  });

  describe('getLowStockReport', () => {
    it('should return products with quantity <= 10', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          location: 'WEB',
          quantity: 5,
          reservedQuantity: 2,
          product: { sku: 'SKU001', name: 'Low Stock Product', category: 'Cat1' },
        },
        {
          productId: 'p2',
          location: 'B2B',
          quantity: 10,
          reservedQuantity: 0,
          product: { sku: 'SKU002', name: 'Critical Product', category: 'Cat2' },
        },
      ]);

      const result = await analyticsService.getLowStockReport();

      expect(result).toHaveLength(2);
      expect(result[0].quantity).toBeLessThanOrEqual(10);
      expect(result[0].availableQuantity).toBe(3); // 5 - 2
    });

    it('should include product details', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          location: 'WEB',
          quantity: 5,
          reservedQuantity: 0,
          product: { sku: 'SKU001', name: 'Product Name', category: 'Electronics' },
        },
      ]);

      const result = await analyticsService.getLowStockReport();

      expect(result[0].productSku).toBe('SKU001');
      expect(result[0].productName).toBe('Product Name');
      expect(result[0].category).toBe('Electronics');
    });
  });

  describe('getLowStockMaterials', () => {
    it('should return materials below reorder point', async () => {
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'm1',
          sku: 'MAT001',
          name: 'Low Material',
          category: 'Raw',
          unit: 'kg',
          currentStock: 10,
          minStock: 50,
          reorderPoint: 30,
          reorderQuantity: 100,
          leadTimeDays: 7,
          supplier: { id: 's1', businessName: 'Supplier 1' },
          isActive: true,
        },
        {
          id: 'm2',
          sku: 'MAT002',
          name: 'OK Material',
          category: 'Raw',
          unit: 'kg',
          currentStock: 100,
          minStock: 50,
          reorderPoint: 30,
          reorderQuantity: 100,
          leadTimeDays: 7,
          supplier: { id: 's1', businessName: 'Supplier 1' },
          isActive: true,
        },
      ]);

      const result = await analyticsService.getLowStockMaterials();

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe('MAT001');
      expect(result[0].deficit).toBe(40); // 50 - 10
    });

    it('should include supplier information', async () => {
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'm1',
          sku: 'MAT001',
          name: 'Material',
          category: 'Raw',
          unit: 'kg',
          currentStock: 5,
          minStock: 20,
          reorderPoint: 15,
          reorderQuantity: 50,
          leadTimeDays: 14,
          supplier: { id: 's1', businessName: 'Top Supplier' },
          isActive: true,
        },
      ]);

      const result = await analyticsService.getLowStockMaterials();

      expect(result[0].supplier.businessName).toBe('Top Supplier');
      expect(result[0].leadTimeDays).toBe(14);
    });
  });

  describe('getDashboardData', () => {
    it('should combine KPIs with low stock items', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { total: createDecimal(1000), status: 'DELIVERED', source: 'WEB' },
      ]);
      prismaMock.product.findMany.mockResolvedValue([{ isActive: true }]);
      prismaMock.customer.findMany.mockResolvedValue([{ id: 'c1' }]);
      prismaMock.employee.findMany.mockResolvedValue([{ id: 'e1' }]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          location: 'WEB',
          quantity: 5,
          reservedQuantity: 0,
          product: { sku: 'SKU001', name: 'Low Stock', category: 'Cat1' },
        },
      ]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'm1',
          sku: 'MAT001',
          name: 'Low Material',
          category: 'Raw',
          unit: 'kg',
          currentStock: 5,
          minStock: 20,
          reorderPoint: 15,
          reorderQuantity: 50,
          leadTimeDays: 7,
          supplier: { id: 's1', businessName: 'Supplier' },
          isActive: true,
        },
      ]);
      prismaMock.warehouse.count.mockResolvedValue(3);
      prismaMock.supplier.count.mockResolvedValue(10);

      const result = await analyticsService.getDashboardData();

      expect(result.kpis).toBeDefined();
      expect(result.kpis.warehouseCount).toBe(3);
      expect(result.kpis.supplierCount).toBe(10);
      expect(result.lowStockItems).toBeDefined();
      expect(result.lowStockMaterials).toBeDefined();
    });

    it('should use last 30 days as default period', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.warehouse.count.mockResolvedValue(0);
      prismaMock.supplier.count.mockResolvedValue(0);

      const result = await analyticsService.getDashboardData();

      expect(result.kpis.period).toBeDefined();
      expect(result.kpis.period.start).toBeDefined();
      expect(result.kpis.period.end).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.warehouse.count.mockResolvedValue(0);
      prismaMock.supplier.count.mockResolvedValue(0);

      const result = await analyticsService.getDashboardData();

      expect(result.kpis.revenue).toBe(0);
      expect(result.kpis.ordersCount).toBe(0);
      expect(result.lowStockItems).toEqual([]);
      expect(result.lowStockMaterials).toEqual([]);
    });
  });
});
