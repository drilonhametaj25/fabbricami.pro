import { prisma } from '../config/database';
import { IdeationCostType } from '@prisma/client';

/**
 * Product Analytics Service
 * Business logic per analytics singolo prodotto, break-even, confronti, stagionalità, raccomandazioni
 */

interface SalesDataPoint {
  date: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  ordersCount: number;
}

interface BreakEvenAnalysis {
  totalIdeationCosts: number;
  unitPrice: number;
  unitCost: number;
  unitMargin: number;
  breakEvenUnits: number;
  currentUnitsSold: number;
  currentRevenue: number;
  currentProfit: number;
  isBreakEvenReached: boolean;
  unitsToBreakEven: number;
  breakEvenDate: string | null;
  projectedBreakEvenDate: string | null;
  dailySalesAverage: number;
}

interface ProductSeasonality {
  productId: string;
  productName: string;
  sku: string;
  monthlyPattern: Array<{
    month: number;
    monthName: string;
    avgQuantity: number;
    avgRevenue: number;
    percentageOfTotal: number;
  }>;
  peakMonths: number[];
  lowMonths: number[];
  seasonalityScore: number; // 0-100, higher = more seasonal
}

interface ProductRecommendation {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  recommendation: 'FOCUS' | 'MAINTAIN' | 'REVIEW' | 'REMOVE';
  score: number;
  reasons: string[];
  metrics: {
    margin: number;
    salesTrend: number;
    salesVolume: number;
    stockTurnover: number;
  };
}

class ProductAnalyticsService {
  /**
   * Get single product sales over time
   */
  async getProductSalesOverTime(
    productId: string,
    period: { start: string; end: string },
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<SalesDataPoint[]> {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);

    // Get all order items for this product in the period
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          orderDate: { gte: startDate, lte: endDate },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      include: {
        order: {
          select: { orderDate: true },
        },
        product: {
          select: { cost: true },
        },
      },
    });

    // Group by date according to granularity
    const dataMap: Record<string, SalesDataPoint> = {};

    orderItems.forEach((item) => {
      const date = item.order.orderDate;
      let key: string;

      if (granularity === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (granularity === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!dataMap[key]) {
        dataMap[key] = {
          date: key,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          ordersCount: 0,
        };
      }

      const itemRevenue = Number(item.total);
      const itemCost = Number(item.product.cost) * item.quantity;

      dataMap[key].quantity += item.quantity;
      dataMap[key].revenue += itemRevenue;
      dataMap[key].cost += itemCost;
      dataMap[key].profit += itemRevenue - itemCost;
      dataMap[key].ordersCount += 1;
    });

    // Sort by date
    return Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get cumulative profit tracking (starts negative from ideation costs)
   */
  async getCumulativeProfitTrack(
    productId: string,
    period: { start: string; end: string }
  ) {
    // Get ideation costs total
    const ideationCosts = await prisma.productIdeationCost.aggregate({
      where: { productId },
      _sum: { amount: true },
    });
    const totalIdeationCosts = Number(ideationCosts._sum.amount) || 0;

    // Get sales data
    const salesData = await this.getProductSalesOverTime(productId, period, 'day');

    // Calculate cumulative profit
    let cumulativeProfit = -totalIdeationCosts;
    const cumulativeData = salesData.map((point) => {
      cumulativeProfit += point.profit;
      return {
        ...point,
        cumulativeProfit,
        isAboveBreakEven: cumulativeProfit >= 0,
      };
    });

    return {
      startingPoint: -totalIdeationCosts,
      data: cumulativeData,
      finalProfit: cumulativeProfit,
    };
  }

  /**
   * Get product ideation costs
   */
  async getProductIdeationCosts(productId: string) {
    return prisma.productIdeationCost.findMany({
      where: { productId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Add ideation cost to product
   */
  async addIdeationCost(
    productId: string,
    data: {
      type: IdeationCostType;
      description: string;
      amount: number;
      date?: Date;
      amortizedUnits?: number;
      notes?: string;
    }
  ) {
    return prisma.productIdeationCost.create({
      data: {
        productId,
        type: data.type,
        description: data.description,
        amount: data.amount,
        date: data.date || new Date(),
        amortizedUnits: data.amortizedUnits,
        notes: data.notes,
      },
    });
  }

  /**
   * Update ideation cost
   */
  async updateIdeationCost(
    costId: string,
    data: {
      type?: IdeationCostType;
      description?: string;
      amount?: number;
      date?: Date;
      amortizedUnits?: number;
      notes?: string;
    }
  ) {
    return prisma.productIdeationCost.update({
      where: { id: costId },
      data,
    });
  }

  /**
   * Delete ideation cost
   */
  async deleteIdeationCost(costId: string) {
    return prisma.productIdeationCost.delete({
      where: { id: costId },
    });
  }

  /**
   * Calculate break-even analysis for a product
   */
  async calculateBreakEven(productId: string): Promise<BreakEvenAnalysis> {
    // 1. Get total ideation costs
    const ideationCosts = await prisma.productIdeationCost.aggregate({
      where: { productId },
      _sum: { amount: true },
    });
    const totalIdeationCosts = Number(ideationCosts._sum.amount) || 0;

    // 2. Get product price and cost
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { price: true, cost: true },
    });

    const unitPrice = Number(product?.price) || 0;
    const unitCost = Number(product?.cost) || 0;
    const unitMargin = unitPrice - unitCost;

    // 3. Calculate break-even units
    const breakEvenUnits =
      unitMargin > 0 ? Math.ceil(totalIdeationCosts / unitMargin) : Infinity;

    // 4. Get sales data - all time
    const salesData = await prisma.orderItem.aggregate({
      where: {
        productId,
        order: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      },
      _sum: { quantity: true, total: true },
    });
    const currentUnitsSold = salesData._sum.quantity || 0;
    const currentRevenue = Number(salesData._sum.total) || 0;

    // 5. Calculate current profit
    const currentProfit = currentUnitsSold * unitMargin - totalIdeationCosts;

    // 6. Calculate daily sales average (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentSales = await prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          orderDate: { gte: ninetyDaysAgo },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      _sum: { quantity: true },
    });
    const dailySalesAverage = (recentSales._sum.quantity || 0) / 90;

    // 7. Find break-even date (when it was reached, if at all)
    let breakEvenDate: string | null = null;
    let projectedBreakEvenDate: string | null = null;

    if (currentUnitsSold >= breakEvenUnits && breakEvenUnits !== Infinity) {
      // Already reached - find when
      const orderItems = await prisma.orderItem.findMany({
        where: {
          productId,
          order: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        },
        include: {
          order: { select: { orderDate: true } },
        },
        orderBy: { order: { orderDate: 'asc' } },
      });

      let cumulativeUnits = 0;
      for (const item of orderItems) {
        cumulativeUnits += item.quantity;
        if (cumulativeUnits >= breakEvenUnits) {
          breakEvenDate = item.order.orderDate.toISOString().split('T')[0];
          break;
        }
      }
    } else if (dailySalesAverage > 0 && breakEvenUnits !== Infinity) {
      // Project when break-even will be reached
      const unitsRemaining = breakEvenUnits - currentUnitsSold;
      const daysToBreakEven = Math.ceil(unitsRemaining / dailySalesAverage);
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysToBreakEven);
      projectedBreakEvenDate = projectedDate.toISOString().split('T')[0];
    }

    return {
      totalIdeationCosts,
      unitPrice,
      unitCost,
      unitMargin,
      breakEvenUnits: breakEvenUnits === Infinity ? -1 : breakEvenUnits,
      currentUnitsSold,
      currentRevenue,
      currentProfit,
      isBreakEvenReached: currentUnitsSold >= breakEvenUnits,
      unitsToBreakEven: Math.max(0, breakEvenUnits - currentUnitsSold),
      breakEvenDate,
      projectedBreakEvenDate,
      dailySalesAverage,
    };
  }

  /**
   * Get complete analytics for a single product
   */
  async getProductAnalytics(
    productId: string,
    period: { start: string; end: string }
  ) {
    const [salesData, ideationCosts, breakEven, product] = await Promise.all([
      this.getProductSalesOverTime(productId, period, 'day'),
      this.getProductIdeationCosts(productId),
      this.calculateBreakEven(productId),
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sku: true, name: true, price: true, cost: true },
      }),
    ]);

    // Calculate KPIs from sales data
    const totalQuantity = salesData.reduce((sum, d) => sum + d.quantity, 0);
    const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
    const totalProfit = salesData.reduce((sum, d) => sum + d.profit, 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      product,
      salesData,
      ideationCosts,
      breakEven,
      kpis: {
        totalRevenue,
        totalQuantity,
        avgMargin,
        totalProfit,
        ordersCount: salesData.reduce((sum, d) => sum + d.ordersCount, 0),
      },
    };
  }

  /**
   * Compare multiple products
   */
  async compareProducts(
    productIds: string[],
    period: { start: string; end: string }
  ) {
    const comparisons = await Promise.all(
      productIds.map(async (productId) => {
        const [product, salesData] = await Promise.all([
          prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, sku: true, name: true, price: true, cost: true },
          }),
          this.getProductSalesOverTime(productId, period, 'day'),
        ]);

        const totalQuantity = salesData.reduce((sum, d) => sum + d.quantity, 0);
        const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
        const totalProfit = salesData.reduce((sum, d) => sum + d.profit, 0);

        return {
          product,
          salesData,
          summary: {
            totalQuantity,
            totalRevenue,
            totalProfit,
            avgMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
          },
        };
      })
    );

    return comparisons;
  }

  /**
   * Analyze product seasonality
   */
  async analyzeSeasonality(productId?: string): Promise<ProductSeasonality[]> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const whereClause: any = {
      order: {
        orderDate: { gte: twoYearsAgo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    };

    if (productId) {
      whereClause.productId = productId;
    }

    const orderItems = await prisma.orderItem.findMany({
      where: whereClause,
      include: {
        order: { select: { orderDate: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    // Group by product and month
    const productMonthlyData: Record<
      string,
      {
        product: { id: string; sku: string; name: string };
        months: Record<number, { quantity: number; revenue: number; count: number }>;
      }
    > = {};

    orderItems.forEach((item) => {
      const pid = item.productId;
      const month = item.order.orderDate.getMonth() + 1;

      if (!productMonthlyData[pid]) {
        productMonthlyData[pid] = {
          product: item.product,
          months: {},
        };
      }

      if (!productMonthlyData[pid].months[month]) {
        productMonthlyData[pid].months[month] = { quantity: 0, revenue: 0, count: 0 };
      }

      productMonthlyData[pid].months[month].quantity += item.quantity;
      productMonthlyData[pid].months[month].revenue += Number(item.total);
      productMonthlyData[pid].months[month].count += 1;
    });

    const monthNames = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
    ];

    const results: ProductSeasonality[] = [];

    for (const [pid, data] of Object.entries(productMonthlyData)) {
      const monthlyPattern = [];
      let totalQuantity = 0;
      let totalRevenue = 0;

      // Build monthly pattern
      for (let m = 1; m <= 12; m++) {
        const monthData = data.months[m] || { quantity: 0, revenue: 0, count: 0 };
        totalQuantity += monthData.quantity;
        totalRevenue += monthData.revenue;
        monthlyPattern.push({
          month: m,
          monthName: monthNames[m - 1],
          avgQuantity: monthData.quantity / 2, // Divide by 2 years
          avgRevenue: monthData.revenue / 2,
          percentageOfTotal: 0, // Will be calculated below
        });
      }

      // Calculate percentages
      monthlyPattern.forEach((mp) => {
        mp.percentageOfTotal = totalQuantity > 0 ? (mp.avgQuantity * 2 / totalQuantity) * 100 : 0;
      });

      // Find peak and low months (top/bottom 3)
      const sortedByQuantity = [...monthlyPattern].sort((a, b) => b.avgQuantity - a.avgQuantity);
      const peakMonths = sortedByQuantity.slice(0, 3).map((m) => m.month);
      const lowMonths = sortedByQuantity.slice(-3).map((m) => m.month);

      // Calculate seasonality score (coefficient of variation)
      const avgMonthly = totalQuantity / 12 / 2;
      const variance =
        monthlyPattern.reduce((sum, mp) => sum + Math.pow(mp.avgQuantity - avgMonthly, 2), 0) / 12;
      const stdDev = Math.sqrt(variance);
      const seasonalityScore = avgMonthly > 0 ? Math.min(100, (stdDev / avgMonthly) * 100) : 0;

      results.push({
        productId: pid,
        productName: data.product.name,
        sku: data.product.sku,
        monthlyPattern,
        peakMonths,
        lowMonths,
        seasonalityScore: Math.round(seasonalityScore),
      });
    }

    // Sort by seasonality score
    return results.sort((a, b) => b.seasonalityScore - a.seasonalityScore);
  }

  /**
   * Get product recommendations
   */
  async getProductRecommendations(): Promise<ProductRecommendation[]> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get all active products
    const products = await prisma.product.findMany({
      where: { isActive: true, isSellable: true },
      select: { id: true, sku: true, name: true, category: true, price: true, cost: true },
    });

    const recommendations: ProductRecommendation[] = [];

    for (const product of products) {
      // Get sales data for last 30 days
      const recentSales = await prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: {
            orderDate: { gte: thirtyDaysAgo },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        },
        _sum: { quantity: true, total: true },
      });

      // Get sales data for previous 30 days (30-60 days ago)
      const previousSales = await prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: {
            orderDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        },
        _sum: { quantity: true, total: true },
      });

      // Get inventory
      const inventory = await prisma.inventoryItem.aggregate({
        where: { productId: product.id },
        _sum: { quantity: true },
      });

      const recentQuantity = recentSales._sum.quantity || 0;
      void (Number(recentSales._sum.total) || 0); // recentRevenue - reserved for future use
      const previousQuantity = previousSales._sum.quantity || 0;
      const currentStock = inventory._sum.quantity || 0;

      // Calculate metrics
      const unitPrice = Number(product.price);
      const unitCost = Number(product.cost);
      const margin = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0;

      const salesTrend =
        previousQuantity > 0
          ? ((recentQuantity - previousQuantity) / previousQuantity) * 100
          : recentQuantity > 0
          ? 100
          : 0;

      const stockTurnover = currentStock > 0 ? (recentQuantity / currentStock) * 12 : 0; // Annualized

      // Score calculation (weighted)
      // Margin: 30%, Trend: 25%, Volume: 25%, Turnover: 20%
      const marginScore = Math.min(100, margin * 2); // Max 50% margin = 100 score
      const trendScore = Math.min(100, Math.max(0, 50 + salesTrend)); // -50% = 0, +50% = 100
      const volumeScore = Math.min(100, recentQuantity * 2); // 50 units = 100 score
      const turnoverScore = Math.min(100, stockTurnover * 10); // 10x turnover = 100 score

      const score =
        marginScore * 0.3 + trendScore * 0.25 + volumeScore * 0.25 + turnoverScore * 0.2;

      // Determine recommendation
      let recommendation: 'FOCUS' | 'MAINTAIN' | 'REVIEW' | 'REMOVE';
      const reasons: string[] = [];

      if (score >= 70) {
        recommendation = 'FOCUS';
        if (margin > 30) reasons.push(`Alto margine (${margin.toFixed(0)}%)`);
        if (salesTrend > 20) reasons.push(`Trend vendite positivo (+${salesTrend.toFixed(0)}%)`);
        if (stockTurnover > 6) reasons.push(`Elevata rotazione stock`);
      } else if (score >= 50) {
        recommendation = 'MAINTAIN';
        if (margin > 20) reasons.push(`Margine buono (${margin.toFixed(0)}%)`);
        if (recentQuantity > 10) reasons.push(`Vendite stabili`);
      } else if (score >= 30) {
        recommendation = 'REVIEW';
        if (margin < 15) reasons.push(`Margine basso (${margin.toFixed(0)}%)`);
        if (salesTrend < -10) reasons.push(`Trend in calo (${salesTrend.toFixed(0)}%)`);
        if (stockTurnover < 2) reasons.push(`Bassa rotazione stock`);
      } else {
        recommendation = 'REMOVE';
        if (margin < 10) reasons.push(`Margine insufficiente (${margin.toFixed(0)}%)`);
        if (recentQuantity === 0) reasons.push(`Nessuna vendita negli ultimi 30 giorni`);
        if (salesTrend < -30) reasons.push(`Forte calo vendite (${salesTrend.toFixed(0)}%)`);
      }

      recommendations.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        recommendation,
        score: Math.round(score),
        reasons,
        metrics: {
          margin: Math.round(margin * 10) / 10,
          salesTrend: Math.round(salesTrend * 10) / 10,
          salesVolume: recentQuantity,
          stockTurnover: Math.round(stockTurnover * 10) / 10,
        },
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Get products with highest margins
   */
  async getHighestMarginProducts(limit = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          orderDate: { gte: thirtyDaysAgo },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true, category: true, price: true, cost: true },
        },
      },
    });

    const productStats: Record<string, any> = {};

    orderItems.forEach((item) => {
      const pid = item.productId;
      if (!productStats[pid]) {
        productStats[pid] = {
          ...item.product,
          revenue: 0,
          cost: 0,
          quantity: 0,
        };
      }

      productStats[pid].revenue += Number(item.total);
      productStats[pid].cost += Number(item.product.cost) * item.quantity;
      productStats[pid].quantity += item.quantity;
    });

    const results = Object.values(productStats)
      .map((p: any) => ({
        ...p,
        profit: p.revenue - p.cost,
        marginPercent: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.marginPercent - a.marginPercent)
      .slice(0, limit);

    return results;
  }

  /**
   * Get products with highest costs
   */
  async getHighestCostProducts(limit = 10) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, category: true, cost: true, price: true },
      orderBy: { cost: 'desc' },
      take: limit,
    });

    return products.map((p) => ({
      ...p,
      cost: Number(p.cost),
      price: Number(p.price),
      margin: Number(p.price) > 0 ? ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 : 0,
    }));
  }
}

export const productAnalyticsService = new ProductAnalyticsService();
export default productAnalyticsService;
