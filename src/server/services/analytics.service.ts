import { prisma } from '../config/database';

/**
 * Analytics Service
 * Business logic per KPI, forecasting, analisi ABC
 */
class AnalyticsService {
  /**
   * Dashboard KPI principali
   */
  async getDashboardKPIs(period: { start: string; end: string }) {
    const { start, end } = period;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const [orders, products, customers, employees] = await Promise.all([
      prisma.order.findMany({
        where: {
          orderDate: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
        select: { total: true, status: true, source: true },
      }),
      prisma.product.findMany({
        select: { isActive: true },
      }),
      prisma.customer.findMany({
        where: { isActive: true },
      }),
      prisma.employee.findMany({
        where: { isActive: true },
      }),
    ]);

    const revenue = orders.reduce((sum: number, order: any) => sum + Number(order.total), 0);
    const ordersCount = orders.length;
    const completedOrders = orders.filter((o: any) => o.status === 'DELIVERED').length;

    return {
      period: { start, end },
      revenue,
      ordersCount,
      averageOrderValue: ordersCount > 0 ? revenue / ordersCount : 0,
      completedOrdersCount: completedOrders,
      completionRate: ordersCount > 0 ? (completedOrders / ordersCount) * 100 : 0,
      activeProducts: products.filter((p: any) => p.isActive).length,
      activeCustomers: customers.length,
      activeEmployees: employees.length,
    };
  }

  /**
   * Analisi vendite per prodotto
   */
  async getSalesAnalysisByProduct(period: { start: string; end: string }) {
    const { start, end } = period;

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          orderDate: { gte: new Date(start), lte: new Date(end) },
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
            cost: true,
          },
        },
      },
    });

    const productStats: Record<string, any> = {};

    orderItems.forEach((item: any) => {
      const productId = item.productId;

      if (!productStats[productId]) {
        productStats[productId] = {
          productId,
          productSku: item.product.sku,
          productName: item.product.name,
          category: item.product.category,
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          ordersCount: 0,
        };
      }

      const itemRevenue = Number(item.lineTotal);
      const itemCost = Number(item.product.cost) * item.quantity;

      productStats[productId].quantitySold += item.quantity;
      productStats[productId].revenue += itemRevenue;
      productStats[productId].cost += itemCost;
      productStats[productId].profit += itemRevenue - itemCost;
      productStats[productId].ordersCount += 1;
    });

    const results = Object.values(productStats).map((stat: any) => ({
      ...stat,
      marginPercent: stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0,
    }));

    return results.sort((a: any, b: any) => b.revenue - a.revenue);
  }

  /**
   * Top prodotti per vendite
   */
  async getTopProducts(period: { start: string; end: string }, limit = 10) {
    const analysis = await this.getSalesAnalysisByProduct(period);
    return analysis.slice(0, limit);
  }

  /**
   * Top clienti per fatturato
   */
  async getTopCustomers(period: { start: string; end: string }, limit = 10) {
    const { start, end } = period;

    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: new Date(start), lte: new Date(end) },
        status: { not: 'CANCELLED' },
      },
      select: {
        customerId: true,
        total: true,
        customer: {
          select: {
            code: true,
            businessName: true,
            firstName: true,
            lastName: true,
            type: true,
          },
        },
      },
    });

    const customerStats: Record<string, any> = {};

    orders.forEach((order: any) => {
      const customerId = order.customerId;

      if (!customerStats[customerId]) {
        customerStats[customerId] = {
          customerId,
          customerCode: order.customer.code,
          customerName:
            order.customer.businessName || `${order.customer.firstName} ${order.customer.lastName}`,
          customerType: order.customer.type,
          ordersCount: 0,
          totalSpent: 0,
        };
      }

      customerStats[customerId].ordersCount += 1;
      customerStats[customerId].totalSpent += Number(order.total);
    });

    const results = Object.values(customerStats).sort(
      (a: any, b: any) => b.totalSpent - a.totalSpent
    );

    return results.slice(0, limit);
  }

  /**
   * Trend vendite mensile
   */
  async getSalesTrend(year: number) {
    const trends: any[] = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const orders = await prisma.order.findMany({
        where: {
          orderDate: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
        select: { total: true },
      });

      const revenue = orders.reduce((sum: number, order: any) => sum + Number(order.total), 0);

      trends.push({
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('it-IT', { month: 'long' }),
        ordersCount: orders.length,
        revenue,
        averageOrderValue: orders.length > 0 ? revenue / orders.length : 0,
      });
    }

    return trends;
  }

  /**
   * Forecast vendite (Moving Average)
   */
  async forecastSales(months = 3, method: 'MOVING_AVERAGE' | 'WEIGHTED_AVERAGE' | 'LINEAR_REGRESSION' = 'MOVING_AVERAGE') {
    const today = new Date();

    const monthlyData: number[] = [];

    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(today.getFullYear() - 1 + Math.floor(i / 12), (today.getMonth() + i) % 12, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      const orders = await prisma.order.findMany({
        where: {
          orderDate: { gte: monthStart, lte: monthEnd },
          status: { not: 'CANCELLED' },
        },
        select: { total: true },
      });

      const revenue = orders.reduce((sum: number, order: any) => sum + Number(order.total), 0);
      monthlyData.push(revenue);
    }

    const forecasts: any[] = [];

    if (method === 'MOVING_AVERAGE') {
      // Media mobile semplice degli ultimi 3 mesi
      const avgBase = monthlyData.slice(-3).reduce((sum: number, val: number) => sum + val, 0) / 3;

      for (let i = 0; i < months; i++) {
        const forecastDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
        forecasts.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          forecastedRevenue: avgBase,
          method: 'MOVING_AVERAGE',
        });
      }
    } else if (method === 'WEIGHTED_AVERAGE') {
      // Media ponderata (peso maggiore ai mesi recenti)
      const weights = [0.5, 0.3, 0.2];
      const recentData = monthlyData.slice(-3);
      const weightedAvg = recentData.reduce((sum: number, val: number, idx: number) => sum + val * weights[idx], 0);

      for (let i = 0; i < months; i++) {
        const forecastDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
        forecasts.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          forecastedRevenue: weightedAvg,
          method: 'WEIGHTED_AVERAGE',
        });
      }
    }

    return {
      historicalData: monthlyData,
      forecasts,
      method,
    };
  }

  /**
   * Analisi ABC (Pareto) prodotti
   */
  async getABCAnalysis(period: { start: string; end: string }) {
    const salesData = await this.getSalesAnalysisByProduct(period);

    if (salesData.length === 0) {
      return { A: [], B: [], C: [] };
    }

    // Ordina per revenue decrescente
    salesData.sort((a: any, b: any) => b.revenue - a.revenue);

    const totalRevenue = salesData.reduce((sum: number, item: any) => sum + item.revenue, 0);
    let cumulativeRevenue = 0;

    const classification: Record<string, any[]> = { A: [], B: [], C: [] };

    salesData.forEach((item: any) => {
      cumulativeRevenue += item.revenue;
      const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;

      item.cumulativeRevenue = cumulativeRevenue;
      item.cumulativePercent = cumulativePercent;

      if (cumulativePercent <= 80) {
        item.classification = 'A';
        classification.A.push(item);
      } else if (cumulativePercent <= 95) {
        item.classification = 'B';
        classification.B.push(item);
      } else {
        item.classification = 'C';
        classification.C.push(item);
      }
    });

    return {
      A: classification.A, // 80% revenue
      B: classification.B, // 15% revenue
      C: classification.C, // 5% revenue
      summary: {
        totalProducts: salesData.length,
        classA: { count: classification.A.length, revenuePercent: 80 },
        classB: { count: classification.B.length, revenuePercent: 15 },
        classC: { count: classification.C.length, revenuePercent: 5 },
      },
    };
  }

  /**
   * Analisi marginalità per categoria
   */
  async getMarginAnalysisByCategory(period: { start: string; end: string }) {
    const salesData = await this.getSalesAnalysisByProduct(period);

    const categoryStats: Record<string, any> = {};

    salesData.forEach((product: any) => {
      const category = product.category || 'UNCATEGORIZED';

      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          revenue: 0,
          cost: 0,
          profit: 0,
          productsCount: 0,
        };
      }

      categoryStats[category].revenue += product.revenue;
      categoryStats[category].cost += product.cost;
      categoryStats[category].profit += product.profit;
      categoryStats[category].productsCount += 1;
    });

    const results = Object.values(categoryStats).map((stat: any) => ({
      ...stat,
      marginPercent: stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0,
    }));

    return results.sort((a: any, b: any) => b.marginPercent - a.marginPercent);
  }

  /**
   * Performance ordini per source
   */
  async getOrderPerformanceBySource(period: { start: string; end: string }) {
    const { start, end } = period;

    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: new Date(start), lte: new Date(end) },
      },
      select: {
        source: true,
        status: true,
        total: true,
      },
    });

    const sourceStats: Record<string, any> = {};

    orders.forEach((order: any) => {
      const source = order.source;

      if (!sourceStats[source]) {
        sourceStats[source] = {
          source,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          revenue: 0,
        };
      }

      sourceStats[source].totalOrders += 1;
      if (order.status === 'DELIVERED') {
        sourceStats[source].completedOrders += 1;
        sourceStats[source].revenue += Number(order.total);
      }
      if (order.status === 'CANCELLED') {
        sourceStats[source].cancelledOrders += 1;
      }
    });

    const results = Object.values(sourceStats).map((stat: any) => ({
      ...stat,
      completionRate: stat.totalOrders > 0 ? (stat.completedOrders / stat.totalOrders) * 100 : 0,
      averageOrderValue: stat.completedOrders > 0 ? stat.revenue / stat.completedOrders : 0,
    }));

    return results;
  }

  /**
   * Report giacenze critiche
   */
  async getLowStockReport() {
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        quantity: { lte: 10 }, // Soglia configurabile
      },
      include: {
        product: {
          select: {
            sku: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: {
        quantity: 'asc',
      },
    });

    return inventoryItems.map((item: any) => ({
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.name,
      category: item.product.category,
      location: item.location,
      quantity: item.quantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.quantity - item.reservedQuantity,
    }));
  }

  /**
   * Report materiali a scorte basse
   */
  async getLowStockMaterials() {
    // Prima otteniamo tutti i materiali attivi
    const allMaterials = await prisma.material.findMany({
      where: {
        isActive: true,
      },
      include: {
        supplier: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
      orderBy: {
        currentStock: 'asc',
      },
    });

    // Filtriamo quelli sotto soglia
    const lowStockMaterials = allMaterials.filter(
      (mat: any) => mat.currentStock <= mat.minStock || mat.currentStock <= mat.reorderPoint
    );

    return lowStockMaterials.map((mat: any) => ({
      id: mat.id,
      sku: mat.sku,
      name: mat.name,
      category: mat.category,
      unit: mat.unit,
      currentStock: mat.currentStock,
      minStock: mat.minStock,
      reorderPoint: mat.reorderPoint,
      reorderQuantity: mat.reorderQuantity,
      deficit: Math.max(0, mat.minStock - mat.currentStock),
      supplier: mat.supplier,
      leadTimeDays: mat.leadTimeDays,
    }));
  }

  /**
   * Dashboard completo con KPIs e alert
   */
  async getDashboardData() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const period = {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };

    const [kpis, lowStockItems, lowStockMaterials, warehouseCount, supplierCount] = await Promise.all([
      this.getDashboardKPIs(period),
      this.getLowStockReport(),
      this.getLowStockMaterials(),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
    ]);

    return {
      kpis: {
        ...kpis,
        warehouseCount,
        supplierCount,
      },
      lowStockItems,
      lowStockMaterials,
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
