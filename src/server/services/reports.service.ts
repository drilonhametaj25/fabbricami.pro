import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Reports Service
 * Servizio completo per reportistica avanzata:
 * - Vendite (RFM, retention, categorie)
 * - Magazzino (rotazione, dead stock, stockout)
 * - Produzione (efficienza, ritardi, costi)
 * - Finanziario (cashflow, DSO/DPO, P&L)
 */

// ============================================
// TYPES & INTERFACES
// ============================================

interface DateRange {
  from: Date;
  to: Date;
}

interface RFMSegment {
  customerId: string;
  customerName: string;
  customerType: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmScore: string;
  segment: string;
}

interface CustomerRetention {
  cohort: string;
  totalCustomers: number;
  retained: Record<string, number>;
  retentionRate: Record<string, number>;
}

interface StockRotation {
  productId: string;
  sku: string;
  name: string;
  category: string;
  avgStock: number;
  soldQuantity: number;
  turnoverRate: number;
  daysOfStock: number;
  classification: 'FAST' | 'MEDIUM' | 'SLOW' | 'DEAD';
}

interface DeadStockItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  lastSaleDate: Date | null;
  daysSinceLastSale: number;
  stockValue: number;
  recommendation: string;
}

interface ProductionEfficiency {
  orderId: string;
  orderNumber: string;
  productName: string;
  plannedQty: number;
  completedQty: number;
  defectQty: number;
  yieldRate: number;
  defectRate: number;
  plannedHours: number;
  actualHours: number;
  efficiency: number;
  status: string;
}

interface CashflowForecast {
  period: string;
  openingBalance: number;
  expectedInflows: number;
  expectedOutflows: number;
  netCashflow: number;
  closingBalance: number;
  inflowDetails: { source: string; amount: number }[];
  outflowDetails: { source: string; amount: number }[];
}

interface ProfitLossReport {
  period: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  operatingIncome: number;
  operatingMargin: number;
  breakdown: {
    byCategory: Record<string, { revenue: number; cost: number; profit: number }>;
    byChannel: Record<string, { revenue: number; cost: number; profit: number }>;
  };
}

// ============================================
// REPORTS SERVICE CLASS
// ============================================

class ReportsService {
  // ============================================
  // SALES REPORTS
  // ============================================

  /**
   * RFM Analysis - Segmentazione clienti
   * Recency: giorni dall'ultimo ordine
   * Frequency: numero ordini nel periodo
   * Monetary: valore totale acquisti
   */
  async getRFMAnalysis(dateRange: DateRange): Promise<{
    segments: RFMSegment[];
    summary: Record<string, { count: number; totalRevenue: number; avgOrderValue: number }>;
  }> {
    const { from, to } = dateRange;
    const today = new Date();

    // Ottieni tutti i clienti con ordini nel periodo
    const customerOrders = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        orderDate: { gte: from, lte: to },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _count: { id: true },
      _sum: { total: true },
      _max: { orderDate: true },
    });

    // Ottieni dettagli clienti
    const customerIds = customerOrders.map((c) => c.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, businessName: true, firstName: true, lastName: true, type: true },
    });

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // Calcola quintili per R, F, M
    const recencyValues = customerOrders.map((c) =>
      Math.floor((today.getTime() - (c._max.orderDate?.getTime() || 0)) / (1000 * 60 * 60 * 24))
    );
    const frequencyValues = customerOrders.map((c) => c._count.id);
    const monetaryValues = customerOrders.map((c) => Number(c._sum.total) || 0);

    const getQuintile = (value: number, values: number[], inverse = false): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.2)];
      const q2 = sorted[Math.floor(sorted.length * 0.4)];
      const q3 = sorted[Math.floor(sorted.length * 0.6)];
      const q4 = sorted[Math.floor(sorted.length * 0.8)];

      let score: number;
      if (value <= q1) score = 1;
      else if (value <= q2) score = 2;
      else if (value <= q3) score = 3;
      else if (value <= q4) score = 4;
      else score = 5;

      return inverse ? 6 - score : score; // Per recency, meno è meglio
    };

    const getSegmentName = (rfmScore: string): string => {
      const r = parseInt(rfmScore[0]);
      const f = parseInt(rfmScore[1]);
      const m = parseInt(rfmScore[2]);

      if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
      if (r >= 4 && f >= 3 && m >= 3) return 'Loyal Customers';
      if (r >= 4 && f <= 2) return 'Recent Customers';
      if (r >= 3 && f >= 3 && m >= 4) return 'Big Spenders';
      if (r >= 3 && f >= 3) return 'Potential Loyalists';
      if (r <= 2 && f >= 4) return 'At Risk';
      if (r <= 2 && f >= 3) return 'Need Attention';
      if (r <= 2 && f <= 2 && m >= 3) return 'Hibernating';
      if (r <= 2 && f <= 2) return 'Lost';
      return 'Others';
    };

    const segments: RFMSegment[] = customerOrders.map((co, index) => {
      const customer = customerMap.get(co.customerId);
      const recencyDays = recencyValues[index];
      const frequency = frequencyValues[index];
      const monetary = monetaryValues[index];

      const recencyScore = getQuintile(recencyDays, recencyValues, true);
      const frequencyScore = getQuintile(frequency, frequencyValues);
      const monetaryScore = getQuintile(monetary, monetaryValues);

      const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;

      return {
        customerId: co.customerId,
        customerName:
          customer?.businessName ||
          `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
          'Unknown',
        customerType: customer?.type || 'UNKNOWN',
        recencyDays,
        frequency,
        monetary,
        recencyScore,
        frequencyScore,
        monetaryScore,
        rfmScore,
        segment: getSegmentName(rfmScore),
      };
    });

    // Riepilogo per segmento
    const summary: Record<string, { count: number; totalRevenue: number; avgOrderValue: number }> =
      {};
    segments.forEach((s) => {
      if (!summary[s.segment]) {
        summary[s.segment] = { count: 0, totalRevenue: 0, avgOrderValue: 0 };
      }
      summary[s.segment].count++;
      summary[s.segment].totalRevenue += s.monetary;
    });

    Object.values(summary).forEach((seg) => {
      seg.avgOrderValue = seg.count > 0 ? seg.totalRevenue / seg.count : 0;
    });

    return { segments, summary };
  }

  /**
   * Analisi Retention Clienti (Cohort Analysis)
   * Raggruppa clienti per mese di primo acquisto e traccia retention
   */
  async getCustomerRetention(year: number): Promise<CustomerRetention[]> {
    // Trova il primo ordine di ogni cliente
    const firstOrders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31),
        },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: {
        customerId: true,
        orderDate: true,
      },
      orderBy: { orderDate: 'asc' },
      distinct: ['customerId'],
    });

    // Raggruppa per mese di acquisizione
    const cohorts: Record<string, Set<string>> = {};
    firstOrders.forEach((order) => {
      const cohortMonth = `${order.orderDate.getFullYear()}-${String(order.orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = new Set();
      }
      cohorts[cohortMonth].add(order.customerId);
    });

    // Per ogni coorte, calcola retention nei mesi successivi
    const results: CustomerRetention[] = [];

    for (const [cohortMonth, customerIds] of Object.entries(cohorts)) {
      const [cohortYear, cohortMonthNum] = cohortMonth.split('-').map(Number);
      const cohortDate = new Date(cohortYear, cohortMonthNum - 1, 1);

      const retention: CustomerRetention = {
        cohort: cohortMonth,
        totalCustomers: customerIds.size,
        retained: {},
        retentionRate: {},
      };

      // Calcola retention per i 12 mesi successivi
      for (let monthOffset = 0; monthOffset <= 11; monthOffset++) {
        const checkDate = new Date(cohortDate);
        checkDate.setMonth(checkDate.getMonth() + monthOffset);

        // Se il mese è oltre il periodo analizzato, skip
        if (checkDate > new Date()) break;

        const monthStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), 1);
        const monthEnd = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0);

        // Conta clienti della coorte che hanno ordinato in questo mese
        const ordersInMonth = await prisma.order.findMany({
          where: {
            customerId: { in: Array.from(customerIds) },
            orderDate: { gte: monthStart, lte: monthEnd },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
          select: { customerId: true },
          distinct: ['customerId'],
        });

        const retainedCount = ordersInMonth.length;
        retention.retained[`M${monthOffset}`] = retainedCount;
        retention.retentionRate[`M${monthOffset}`] =
          customerIds.size > 0 ? (retainedCount / customerIds.size) * 100 : 0;
      }

      results.push(retention);
    }

    return results.sort((a, b) => a.cohort.localeCompare(b.cohort));
  }

  /**
   * Performance per Categoria Prodotto
   */
  async getCategoryPerformance(
    dateRange: DateRange
  ): Promise<
    {
      category: string;
      totalRevenue: number;
      totalCost: number;
      grossProfit: number;
      grossMargin: number;
      unitsSold: number;
      ordersCount: number;
      avgOrderValue: number;
      topProducts: { sku: string; name: string; revenue: number }[];
    }[]
  > {
    const { from, to } = dateRange;

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          orderDate: { gte: from, lte: to },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true, category: true, cost: true },
        },
        order: { select: { id: true } },
      },
    });

    const categoryStats: Record<
      string,
      {
        revenue: number;
        cost: number;
        units: number;
        orders: Set<string>;
        products: Record<string, { sku: string; name: string; revenue: number }>;
      }
    > = {};

    orderItems.forEach((item) => {
      const category = item.product?.category || 'UNCATEGORIZED';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          revenue: 0,
          cost: 0,
          units: 0,
          orders: new Set(),
          products: {},
        };
      }

      const itemRevenue = Number(item.total);
      const itemCost = Number(item.product?.cost || 0) * item.quantity;

      categoryStats[category].revenue += itemRevenue;
      categoryStats[category].cost += itemCost;
      categoryStats[category].units += item.quantity;
      categoryStats[category].orders.add(item.order.id);

      const productId = item.productId;
      if (!categoryStats[category].products[productId]) {
        categoryStats[category].products[productId] = {
          sku: item.sku,
          name: item.productName || item.product?.name || '',
          revenue: 0,
        };
      }
      categoryStats[category].products[productId].revenue += itemRevenue;
    });

    return Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category,
        totalRevenue: stats.revenue,
        totalCost: stats.cost,
        grossProfit: stats.revenue - stats.cost,
        grossMargin: stats.revenue > 0 ? ((stats.revenue - stats.cost) / stats.revenue) * 100 : 0,
        unitsSold: stats.units,
        ordersCount: stats.orders.size,
        avgOrderValue: stats.orders.size > 0 ? stats.revenue / stats.orders.size : 0,
        topProducts: Object.values(stats.products)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Analisi Churn (Clienti persi)
   */
  async getChurnAnalysis(
    dateRange: DateRange,
    inactiveDays = 90
  ): Promise<{
    activeCustomers: number;
    atRiskCustomers: number;
    churnedCustomers: number;
    churnRate: number;
    churnedList: {
      customerId: string;
      name: string;
      lastOrderDate: Date;
      daysSinceLastOrder: number;
      lifetimeValue: number;
    }[];
  }> {
    const { to } = dateRange;
    const today = new Date(to);
    const atRiskThreshold = new Date(today);
    atRiskThreshold.setDate(atRiskThreshold.getDate() - inactiveDays / 2);
    const churnThreshold = new Date(today);
    churnThreshold.setDate(churnThreshold.getDate() - inactiveDays);

    // Trova l'ultimo ordine di ogni cliente
    const customerLastOrders = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _max: { orderDate: true },
      _sum: { total: true },
      _count: { id: true },
    });

    let activeCount = 0;
    let atRiskCount = 0;
    const churnedList: {
      customerId: string;
      name: string;
      lastOrderDate: Date;
      daysSinceLastOrder: number;
      lifetimeValue: number;
    }[] = [];

    const churnedCustomerIds: string[] = [];

    customerLastOrders.forEach((c) => {
      const lastOrder = c._max.orderDate;
      if (!lastOrder) return;

      if (lastOrder >= atRiskThreshold) {
        activeCount++;
      } else if (lastOrder >= churnThreshold) {
        atRiskCount++;
      } else {
        churnedCustomerIds.push(c.customerId);
        churnedList.push({
          customerId: c.customerId,
          name: '', // Will be filled below
          lastOrderDate: lastOrder,
          daysSinceLastOrder: Math.floor(
            (today.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)
          ),
          lifetimeValue: Number(c._sum.total) || 0,
        });
      }
    });

    // Ottieni nomi clienti churned
    if (churnedCustomerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: churnedCustomerIds } },
        select: { id: true, businessName: true, firstName: true, lastName: true },
      });

      const customerMap = new Map(customers.map((c) => [c.id, c]));
      churnedList.forEach((item) => {
        const customer = customerMap.get(item.customerId);
        item.name =
          customer?.businessName ||
          `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
          'Unknown';
      });
    }

    const totalCustomers = customerLastOrders.length;
    return {
      activeCustomers: activeCount,
      atRiskCustomers: atRiskCount,
      churnedCustomers: churnedList.length,
      churnRate: totalCustomers > 0 ? (churnedList.length / totalCustomers) * 100 : 0,
      churnedList: churnedList.sort((a, b) => b.lifetimeValue - a.lifetimeValue).slice(0, 100),
    };
  }

  // ============================================
  // WAREHOUSE REPORTS
  // ============================================

  /**
   * Analisi Rotazione Stock
   * Calcola turnover rate per ogni prodotto
   */
  async getStockRotationAnalysis(dateRange: DateRange): Promise<{
    items: StockRotation[];
    summary: {
      fastMoving: number;
      mediumMoving: number;
      slowMoving: number;
      deadStock: number;
      avgTurnoverRate: number;
    };
  }> {
    const { from, to } = dateRange;
    const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    // Ottieni vendite per prodotto nel periodo
    const salesByProduct = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          orderDate: { gte: from, lte: to },
          status: { in: ['SHIPPED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true },
    });

    const salesMap = new Map(salesByProduct.map((s) => [s.productId, s._sum.quantity || 0]));

    // Ottieni tutti i prodotti con inventario
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventory: {
          select: { quantity: true },
        },
      },
    });

    const items: StockRotation[] = products.map((product) => {
      const currentStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const soldQuantity = salesMap.get(product.id) || 0;

      // Stima stock medio (semplificata: current + sold/2)
      const avgStock = currentStock + soldQuantity / 2;

      // Turnover rate = venduto / stock medio
      const turnoverRate = avgStock > 0 ? soldQuantity / avgStock : 0;

      // Giorni di stock = stock corrente / (venduto / giorni)
      const dailySales = soldQuantity / periodDays;
      const daysOfStock = dailySales > 0 ? currentStock / dailySales : 999;

      // Classificazione
      let classification: 'FAST' | 'MEDIUM' | 'SLOW' | 'DEAD';
      if (soldQuantity === 0 && currentStock > 0) classification = 'DEAD';
      else if (turnoverRate >= 4) classification = 'FAST'; // Turnover > 4x/anno
      else if (turnoverRate >= 2) classification = 'MEDIUM';
      else if (turnoverRate >= 0.5) classification = 'SLOW';
      else classification = 'DEAD';

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category || 'UNCATEGORIZED',
        avgStock,
        soldQuantity,
        turnoverRate,
        daysOfStock: Math.min(daysOfStock, 999),
        classification,
      };
    });

    const summary = {
      fastMoving: items.filter((i) => i.classification === 'FAST').length,
      mediumMoving: items.filter((i) => i.classification === 'MEDIUM').length,
      slowMoving: items.filter((i) => i.classification === 'SLOW').length,
      deadStock: items.filter((i) => i.classification === 'DEAD').length,
      avgTurnoverRate:
        items.length > 0 ? items.reduce((sum, i) => sum + i.turnoverRate, 0) / items.length : 0,
    };

    return {
      items: items.sort((a, b) => b.turnoverRate - a.turnoverRate),
      summary,
    };
  }

  /**
   * Analisi Dead Stock dettagliata
   */
  async getDeadStockAnalysis(daysThreshold = 90): Promise<{
    items: DeadStockItem[];
    totalValue: number;
    totalItems: number;
    recommendations: { action: string; count: number; value: number }[];
  }> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Prodotti con stock ma senza vendite recenti
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventory: true,
        orderItems: {
          where: {
            order: {
              status: { in: ['SHIPPED', 'DELIVERED'] },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            order: { select: { orderDate: true } },
          },
        },
      },
    });

    const today = new Date();
    const items: DeadStockItem[] = [];

    products.forEach((product) => {
      const currentStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      if (currentStock <= 0) return;

      const lastSale = product.orderItems[0]?.order?.orderDate || null;
      const daysSinceLastSale = lastSale
        ? Math.floor((today.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastSale >= daysThreshold) {
        const stockValue = currentStock * Number(product.cost);

        let recommendation: string;
        if (daysSinceLastSale > 365) {
          recommendation = 'LIQUIDATE';
        } else if (daysSinceLastSale > 180) {
          recommendation = 'DISCOUNT_HEAVY';
        } else {
          recommendation = 'DISCOUNT_LIGHT';
        }

        items.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category || 'UNCATEGORIZED',
          currentStock,
          lastSaleDate: lastSale,
          daysSinceLastSale,
          stockValue,
          recommendation,
        });
      }
    });

    const recommendations = [
      {
        action: 'LIQUIDATE',
        count: items.filter((i) => i.recommendation === 'LIQUIDATE').length,
        value: items
          .filter((i) => i.recommendation === 'LIQUIDATE')
          .reduce((sum, i) => sum + i.stockValue, 0),
      },
      {
        action: 'DISCOUNT_HEAVY',
        count: items.filter((i) => i.recommendation === 'DISCOUNT_HEAVY').length,
        value: items
          .filter((i) => i.recommendation === 'DISCOUNT_HEAVY')
          .reduce((sum, i) => sum + i.stockValue, 0),
      },
      {
        action: 'DISCOUNT_LIGHT',
        count: items.filter((i) => i.recommendation === 'DISCOUNT_LIGHT').length,
        value: items
          .filter((i) => i.recommendation === 'DISCOUNT_LIGHT')
          .reduce((sum, i) => sum + i.stockValue, 0),
      },
    ];

    return {
      items: items.sort((a, b) => b.stockValue - a.stockValue),
      totalValue: items.reduce((sum, i) => sum + i.stockValue, 0),
      totalItems: items.length,
      recommendations,
    };
  }

  /**
   * Analisi Stockout
   */
  async getStockoutAnalysis(
    dateRange: DateRange
  ): Promise<{
    stockoutEvents: {
      productId: string;
      sku: string;
      name: string;
      stockoutDate: Date;
      restockDate: Date | null;
      durationDays: number;
      lostSalesEstimate: number;
    }[];
    summary: {
      totalStockouts: number;
      avgDuration: number;
      totalLostSales: number;
      mostAffectedProducts: { sku: string; name: string; count: number }[];
    };
  }> {
    const { from, to } = dateRange;

    // Trova movimenti negativi che hanno portato stock a 0
    const stockoutMovements = await prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        quantity: { lt: 0 },
      },
      include: {
        product: {
          include: {
            inventory: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Analizza per trovare eventi di stockout
    const stockoutEvents: {
      productId: string;
      sku: string;
      name: string;
      stockoutDate: Date;
      restockDate: Date | null;
      durationDays: number;
      lostSalesEstimate: number;
    }[] = [];

    const productStockoutMap: Map<
      string,
      { stockoutDate: Date; dailySales: number; sku: string; name: string }
    > = new Map();

    // Calcola vendite medie giornaliere per prodotto
    const salesByProduct = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          orderDate: { gte: from, lte: to },
          status: { in: ['SHIPPED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true },
    });

    const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const dailySalesMap = new Map(
      salesByProduct.map((s) => [s.productId, (s._sum.quantity || 0) / periodDays])
    );

    // Process movements
    for (const movement of stockoutMovements) {
      // Check total inventory for this product
      const totalStock = movement.product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);

      // Check if this caused stockout (total stock is 0 or less)
      if (totalStock <= 0 && !productStockoutMap.has(movement.productId)) {
        productStockoutMap.set(movement.productId, {
          stockoutDate: movement.createdAt,
          dailySales: dailySalesMap.get(movement.productId) || 0,
          sku: movement.product.sku,
          name: movement.product.name,
        });
      }
    }

    // Find restocks
    const restockMovements = await prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        quantity: { gt: 0 },
        productId: { in: Array.from(productStockoutMap.keys()) },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const restock of restockMovements) {
      const stockout = productStockoutMap.get(restock.productId);
      if (stockout && restock.createdAt > stockout.stockoutDate) {
        const durationDays = Math.ceil(
          (restock.createdAt.getTime() - stockout.stockoutDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        stockoutEvents.push({
          productId: restock.productId,
          sku: stockout.sku,
          name: stockout.name,
          stockoutDate: stockout.stockoutDate,
          restockDate: restock.createdAt,
          durationDays,
          lostSalesEstimate: durationDays * stockout.dailySales,
        });

        productStockoutMap.delete(restock.productId);
      }
    }

    // Add ongoing stockouts
    productStockoutMap.forEach((stockout, productId) => {
      const durationDays = Math.ceil(
        (to.getTime() - stockout.stockoutDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      stockoutEvents.push({
        productId,
        sku: stockout.sku,
        name: stockout.name,
        stockoutDate: stockout.stockoutDate,
        restockDate: null,
        durationDays,
        lostSalesEstimate: durationDays * stockout.dailySales,
      });
    });

    // Calculate summary
    const productCounts: Record<string, { sku: string; name: string; count: number }> = {};
    stockoutEvents.forEach((e) => {
      if (!productCounts[e.productId]) {
        productCounts[e.productId] = { sku: e.sku, name: e.name, count: 0 };
      }
      productCounts[e.productId].count++;
    });

    return {
      stockoutEvents: stockoutEvents.sort((a, b) => b.lostSalesEstimate - a.lostSalesEstimate),
      summary: {
        totalStockouts: stockoutEvents.length,
        avgDuration:
          stockoutEvents.length > 0
            ? stockoutEvents.reduce((sum, e) => sum + e.durationDays, 0) / stockoutEvents.length
            : 0,
        totalLostSales: stockoutEvents.reduce((sum, e) => sum + e.lostSalesEstimate, 0),
        mostAffectedProducts: Object.values(productCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    };
  }

  // ============================================
  // PRODUCTION REPORTS
  // ============================================

  /**
   * Report Efficienza Produzione
   */
  async getProductionEfficiencyReport(dateRange: DateRange): Promise<{
    orders: ProductionEfficiency[];
    summary: {
      totalOrders: number;
      completedOrders: number;
      avgYieldRate: number;
      avgDefectRate: number;
      avgEfficiency: number;
      totalPlannedHours: number;
      totalActualHours: number;
    };
  }> {
    const { from, to } = dateRange;

    const productionOrders = await prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      include: {
        product: { select: { name: true } },
        phases: {
          include: {
            manufacturingPhase: { select: { standardTime: true } },
          },
        },
      },
    });

    const orders: ProductionEfficiency[] = productionOrders.map((po) => {
      const plannedQty = po.quantity;
      // Usa quantity come completedQty per ordini COMPLETED, altrimenti stima da fasi completate
      const completedPhases = po.phases.filter((p) => p.status === 'COMPLETED').length;
      const totalPhases = po.phases.length;
      const completedQty = po.status === 'COMPLETED' ? plannedQty : Math.floor((completedPhases / Math.max(totalPhases, 1)) * plannedQty);
      const defectQty = 0; // Il campo non esiste nel modello, sarebbe da aggiungere se necessario

      const yieldRate = plannedQty > 0 ? (completedQty / plannedQty) * 100 : 0;
      const defectRate = completedQty > 0 ? (defectQty / (completedQty + defectQty)) * 100 : 0;

      // Calcola ore dalle fasi (standardTime da ManufacturingPhase, actualTime da ProductionPhase)
      const plannedHours = po.phases.reduce((sum, p) => sum + (p.manufacturingPhase?.standardTime || 0), 0) / 60;
      const actualHours = po.phases.reduce((sum, p) => sum + (p.actualTime || 0), 0) / 60;

      const efficiency = plannedHours > 0 ? (plannedHours / actualHours) * 100 : 100;

      return {
        orderId: po.id,
        orderNumber: po.orderNumber,
        productName: po.product.name,
        plannedQty,
        completedQty,
        defectQty,
        yieldRate,
        defectRate,
        plannedHours,
        actualHours,
        efficiency: Math.min(efficiency, 200), // Cap at 200%
        status: po.status,
      };
    });

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const summary = {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      avgYieldRate:
        completedOrders.length > 0
          ? completedOrders.reduce((sum, o) => sum + o.yieldRate, 0) / completedOrders.length
          : 0,
      avgDefectRate:
        completedOrders.length > 0
          ? completedOrders.reduce((sum, o) => sum + o.defectRate, 0) / completedOrders.length
          : 0,
      avgEfficiency:
        completedOrders.length > 0
          ? completedOrders.reduce((sum, o) => sum + o.efficiency, 0) / completedOrders.length
          : 0,
      totalPlannedHours: orders.reduce((sum, o) => sum + o.plannedHours, 0),
      totalActualHours: orders.reduce((sum, o) => sum + o.actualHours, 0),
    };

    return { orders, summary };
  }

  /**
   * Analisi Ritardi Produzione
   */
  async getProductionDelaysReport(dateRange: DateRange): Promise<{
    delayedOrders: {
      orderId: string;
      orderNumber: string;
      productName: string;
      scheduledEnd: Date;
      actualEnd: Date | null;
      delayDays: number;
      status: string;
      reason: string | null;
    }[];
    summary: {
      totalOrders: number;
      delayedCount: number;
      onTimeCount: number;
      onTimeRate: number;
      avgDelayDays: number;
    };
  }> {
    const { from, to } = dateRange;

    const productionOrders = await prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      },
      include: {
        product: { select: { name: true } },
      },
    });

    const today = new Date();
    const delayedOrders: {
      orderId: string;
      orderNumber: string;
      productName: string;
      scheduledEnd: Date;
      actualEnd: Date | null;
      delayDays: number;
      status: string;
      reason: string | null;
    }[] = [];

    let onTimeCount = 0;

    productionOrders.forEach((po) => {
      if (!po.plannedEndDate) return;

      const scheduledEnd = new Date(po.plannedEndDate);
      const actualEnd = po.actualEndDate ? new Date(po.actualEndDate) : null;
      const compareDate = actualEnd || today;

      if (compareDate > scheduledEnd) {
        const delayDays = Math.ceil(
          (compareDate.getTime() - scheduledEnd.getTime()) / (1000 * 60 * 60 * 24)
        );

        delayedOrders.push({
          orderId: po.id,
          orderNumber: po.orderNumber,
          productName: po.product.name,
          scheduledEnd,
          actualEnd,
          delayDays,
          status: po.status,
          reason: po.notes || null,
        });
      } else {
        onTimeCount++;
      }
    });

    return {
      delayedOrders: delayedOrders.sort((a, b) => b.delayDays - a.delayDays),
      summary: {
        totalOrders: productionOrders.length,
        delayedCount: delayedOrders.length,
        onTimeCount,
        onTimeRate:
          productionOrders.length > 0 ? (onTimeCount / productionOrders.length) * 100 : 0,
        avgDelayDays:
          delayedOrders.length > 0
            ? delayedOrders.reduce((sum, o) => sum + o.delayDays, 0) / delayedOrders.length
            : 0,
      },
    };
  }

  /**
   * Costi di Produzione per Unità
   */
  async getProductionCostsReport(
    dateRange: DateRange
  ): Promise<{
    products: {
      productId: string;
      sku: string;
      name: string;
      ordersCount: number;
      totalProduced: number;
      materialCost: number;
      laborCost: number;
      overheadCost: number;
      totalCost: number;
      costPerUnit: number;
      sellingPrice: number;
      marginPerUnit: number;
      marginPercent: number;
    }[];
    summary: {
      totalMaterialCost: number;
      totalLaborCost: number;
      totalOverheadCost: number;
      totalProductionCost: number;
      avgCostPerUnit: number;
      avgMarginPercent: number;
    };
  }> {
    const { from, to } = dateRange;

    const productionOrders = await prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'COMPLETED',
      },
      include: {
        product: { select: { id: true, sku: true, name: true, price: true, cost: true } },
        phases: {
          include: {
            materialConsumptions: {
              include: {
                material: { select: { cost: true } },
              },
            },
          },
        },
      },
    });

    const productStats: Record<
      string,
      {
        product: { id: string; sku: string; name: string; price: Decimal; cost: Decimal };
        ordersCount: number;
        totalProduced: number;
        materialCost: number;
        laborCost: number;
        overheadCost: number;
      }
    > = {};

    productionOrders.forEach((po) => {
      const productId = po.productId;

      if (!productStats[productId]) {
        productStats[productId] = {
          product: po.product,
          ordersCount: 0,
          totalProduced: 0,
          materialCost: 0,
          laborCost: 0,
          overheadCost: 0,
        };
      }

      productStats[productId].ordersCount++;
      // Per ordini COMPLETED, usa quantity come producedQuantity
      productStats[productId].totalProduced += po.status === 'COMPLETED' ? po.quantity : 0;

      // Calcola costi dalle fasi
      po.phases.forEach((phase) => {
        // Costo materiali (actualQuantity * material.cost)
        phase.materialConsumptions.forEach((mc) => {
          const materialCost = Number(mc.actualQuantity) * Number(mc.material?.cost || 0);
          productStats[productId].materialCost += materialCost;
        });

        // Costo manodopera (stima: costo orario * ore effettive)
        const laborHours = (phase.actualTime || 0) / 60;
        const laborRate = 25; // €/ora - configurabile
        productStats[productId].laborCost += laborHours * laborRate;
      });

      // Overhead (10% del totale materiali + manodopera)
      const directCosts = productStats[productId].materialCost + productStats[productId].laborCost;
      productStats[productId].overheadCost = directCosts * 0.1;
    });

    const products = Object.values(productStats).map((stat) => {
      const totalCost = stat.materialCost + stat.laborCost + stat.overheadCost;
      const costPerUnit = stat.totalProduced > 0 ? totalCost / stat.totalProduced : 0;
      const sellingPrice = Number(stat.product.price);
      const marginPerUnit = sellingPrice - costPerUnit;
      const marginPercent = sellingPrice > 0 ? (marginPerUnit / sellingPrice) * 100 : 0;

      return {
        productId: stat.product.id,
        sku: stat.product.sku,
        name: stat.product.name,
        ordersCount: stat.ordersCount,
        totalProduced: stat.totalProduced,
        materialCost: stat.materialCost,
        laborCost: stat.laborCost,
        overheadCost: stat.overheadCost,
        totalCost,
        costPerUnit,
        sellingPrice,
        marginPerUnit,
        marginPercent,
      };
    });

    const summary = {
      totalMaterialCost: products.reduce((sum, p) => sum + p.materialCost, 0),
      totalLaborCost: products.reduce((sum, p) => sum + p.laborCost, 0),
      totalOverheadCost: products.reduce((sum, p) => sum + p.overheadCost, 0),
      totalProductionCost: products.reduce((sum, p) => sum + p.totalCost, 0),
      avgCostPerUnit:
        products.length > 0
          ? products.reduce((sum, p) => sum + p.costPerUnit, 0) / products.length
          : 0,
      avgMarginPercent:
        products.length > 0
          ? products.reduce((sum, p) => sum + p.marginPercent, 0) / products.length
          : 0,
    };

    return {
      products: products.sort((a, b) => b.totalCost - a.totalCost),
      summary,
    };
  }

  // ============================================
  // FINANCIAL REPORTS
  // ============================================

  /**
   * Forecast Cashflow (30/60/90 giorni)
   */
  async getCashflowForecast(forecastDays = 90): Promise<CashflowForecast[]> {
    const today = new Date();
    const forecasts: CashflowForecast[] = [];

    // Suddividi in periodi di 30 giorni
    const periods = Math.ceil(forecastDays / 30);

    let runningBalance = 0; // In produzione, questo verrebbe dal saldo effettivo

    for (let i = 0; i < periods; i++) {
      const periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() + i * 30);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 29);

      const periodLabel = `${periodStart.toLocaleDateString('it-IT')} - ${periodEnd.toLocaleDateString('it-IT')}`;

      // Inflows attesi: fatture in scadenza
      const expectedReceivables = await prisma.invoice.findMany({
        where: {
          type: 'SALE',
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
          dueDate: { gte: periodStart, lte: periodEnd },
        },
        select: {
          total: true,
          paidAmount: true,
        },
      });

      const inflows = expectedReceivables.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)),
        0
      );

      // Ordini in arrivo (stime)
      const pendingOrders = await prisma.order.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
          estimatedDelivery: { gte: periodStart, lte: periodEnd },
        },
        select: { total: true },
      });

      const expectedOrderInflows = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);

      // Outflows attesi: fatture fornitori in scadenza (non pagate o parzialmente pagate)
      const expectedPayables = await prisma.supplierInvoice.findMany({
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { gte: periodStart, lte: periodEnd },
        },
        select: {
          total: true,
          paidAmount: true,
        },
      });

      const outflows = expectedPayables.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount || 0)),
        0
      );

      // PO pending
      const pendingPOs = await prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['SENT', 'CONFIRMED'] },
          expectedDate: { gte: periodStart, lte: periodEnd },
        },
        select: { total: true },
      });

      const expectedPOOutflows = pendingPOs.reduce((sum, po) => sum + Number(po.total), 0);

      const totalInflows = inflows + expectedOrderInflows;
      const totalOutflows = outflows + expectedPOOutflows;
      const netCashflow = totalInflows - totalOutflows;
      const closingBalance = runningBalance + netCashflow;

      forecasts.push({
        period: periodLabel,
        openingBalance: runningBalance,
        expectedInflows: totalInflows,
        expectedOutflows: totalOutflows,
        netCashflow,
        closingBalance,
        inflowDetails: [
          { source: 'Fatture clienti', amount: inflows },
          { source: 'Ordini in arrivo', amount: expectedOrderInflows },
        ],
        outflowDetails: [
          { source: 'Fatture fornitori', amount: outflows },
          { source: 'Ordini acquisto', amount: expectedPOOutflows },
        ],
      });

      runningBalance = closingBalance;
    }

    return forecasts;
  }

  /**
   * DSO (Days Sales Outstanding) e DPO (Days Payable Outstanding)
   */
  async getDSODPOReport(dateRange: DateRange): Promise<{
    dso: {
      current: number;
      trend: { period: string; value: number }[];
      byCustomerType: Record<string, number>;
    };
    dpo: {
      current: number;
      trend: { period: string; value: number }[];
      bySupplier: { supplierId: string; name: string; dpo: number }[];
    };
  }> {
    const { from, to } = dateRange;
    const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    // DSO = (Crediti medi / Vendite a credito) * Giorni
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        type: 'SALE',
        issueDate: { gte: from, lte: to },
      },
      include: {
        customer: { select: { type: true } },
      },
    });

    const totalSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const avgReceivables =
      salesInvoices.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)), 0) / 2;

    const currentDSO = totalSales > 0 ? (avgReceivables / totalSales) * periodDays : 0;

    // DSO per tipo cliente
    const dsoByType: Record<string, { receivables: number; sales: number }> = {};
    salesInvoices.forEach((inv) => {
      const type = inv.customer?.type || 'UNKNOWN';
      if (!dsoByType[type]) dsoByType[type] = { receivables: 0, sales: 0 };
      dsoByType[type].receivables += Number(inv.total) - Number(inv.paidAmount);
      dsoByType[type].sales += Number(inv.total);
    });

    const dsoByCustomerType: Record<string, number> = {};
    Object.entries(dsoByType).forEach(([type, data]) => {
      dsoByCustomerType[type] = data.sales > 0 ? (data.receivables / data.sales) * periodDays : 0;
    });

    // DPO = (Debiti medi / Acquisti a credito) * Giorni
    const purchaseInvoices = await prisma.supplierInvoice.findMany({
      where: {
        issueDate: { gte: from, lte: to },
      },
      include: {
        supplier: { select: { id: true, businessName: true } },
      },
    });

    const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const avgPayables =
      purchaseInvoices.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount || 0)),
        0
      ) / 2;

    const currentDPO = totalPurchases > 0 ? (avgPayables / totalPurchases) * periodDays : 0;

    // DPO per fornitore
    const dpoBySupplier: Record<string, { name: string; payables: number; purchases: number }> = {};
    purchaseInvoices.forEach((inv) => {
      const supplierId = inv.supplierId;
      if (!dpoBySupplier[supplierId]) {
        dpoBySupplier[supplierId] = {
          name: inv.supplier.businessName,
          payables: 0,
          purchases: 0,
        };
      }
      dpoBySupplier[supplierId].payables += Number(inv.total) - Number(inv.paidAmount || 0);
      dpoBySupplier[supplierId].purchases += Number(inv.total);
    });

    return {
      dso: {
        current: Math.round(currentDSO),
        trend: [], // TODO: calcolare trend mensile
        byCustomerType: Object.fromEntries(
          Object.entries(dsoByCustomerType).map(([k, v]) => [k, Math.round(v)])
        ),
      },
      dpo: {
        current: Math.round(currentDPO),
        trend: [],
        bySupplier: Object.entries(dpoBySupplier)
          .map(([id, data]) => ({
            supplierId: id,
            name: data.name,
            dpo: data.purchases > 0 ? Math.round((data.payables / data.purchases) * periodDays) : 0,
          }))
          .sort((a, b) => b.dpo - a.dpo),
      },
    };
  }

  /**
   * Profit & Loss Report
   */
  async getProfitLossReport(dateRange: DateRange): Promise<ProfitLossReport> {
    const { from, to } = dateRange;

    // Revenue da ordini completati
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: from, lte: to },
        status: { in: ['SHIPPED', 'DELIVERED'] },
      },
      include: {
        items: {
          include: {
            product: { select: { category: true, cost: true } },
          },
        },
      },
    });

    let revenue = 0;
    let costOfGoodsSold = 0;
    const byCategory: Record<string, { revenue: number; cost: number; profit: number }> = {};
    const byChannel: Record<string, { revenue: number; cost: number; profit: number }> = {};

    orders.forEach((order) => {
      const orderRevenue = Number(order.total);
      revenue += orderRevenue;

      // Per canale
      const channel = order.source;
      if (!byChannel[channel]) byChannel[channel] = { revenue: 0, cost: 0, profit: 0 };
      byChannel[channel].revenue += orderRevenue;

      order.items.forEach((item) => {
        const itemCost = Number(item.product?.cost || 0) * item.quantity;
        costOfGoodsSold += itemCost;
        byChannel[channel].cost += itemCost;

        // Per categoria
        const category = item.product?.category || 'UNCATEGORIZED';
        if (!byCategory[category]) byCategory[category] = { revenue: 0, cost: 0, profit: 0 };
        byCategory[category].revenue += Number(item.total);
        byCategory[category].cost += itemCost;
      });
    });

    // Calcola profit per categoria e canale
    Object.values(byCategory).forEach((c) => (c.profit = c.revenue - c.cost));
    Object.values(byChannel).forEach((c) => (c.profit = c.revenue - c.cost));

    const grossProfit = revenue - costOfGoodsSold;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Operating expenses (stime - in produzione verrebbero da contabilità)
    const operatingExpenses = grossProfit * 0.3; // 30% del gross profit come stima

    const operatingIncome = grossProfit - operatingExpenses;
    const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0;

    return {
      period: `${from.toLocaleDateString('it-IT')} - ${to.toLocaleDateString('it-IT')}`,
      revenue,
      costOfGoodsSold,
      grossProfit,
      grossMargin,
      operatingExpenses,
      operatingIncome,
      operatingMargin,
      breakdown: {
        byCategory,
        byChannel,
      },
    };
  }

  /**
   * Aging Report (Scadenzario crediti/debiti)
   */
  async getAgingReport(
    type: 'receivables' | 'payables'
  ): Promise<{
    summary: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    };
    details: {
      entityId: string;
      entityName: string;
      invoiceNumber: string;
      issueDate: Date;
      dueDate: Date;
      amount: number;
      paid: number;
      outstanding: number;
      daysOverdue: number;
      bucket: string;
    }[];
  }> {
    const today = new Date();

    if (type === 'receivables') {
      const invoices = await prisma.invoice.findMany({
        where: {
          type: 'SALE',
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        include: {
          customer: { select: { id: true, businessName: true, firstName: true, lastName: true } },
        },
      });

      return this.calculateAging(invoices, today, 'customer');
    } else {
      const invoices = await prisma.supplierInvoice.findMany({
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        include: {
          supplier: { select: { id: true, businessName: true } },
        },
      });

      return this.calculateAging(
        invoices.map((inv) => ({
          ...inv,
          paidAmount: inv.paidAmount || new Decimal(0),
        })),
        today,
        'supplier'
      );
    }
  }

  private calculateAging(
    invoices: any[],
    today: Date,
    entityType: 'customer' | 'supplier'
  ): {
    summary: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    };
    details: any[];
  } {
    const summary = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
    const details: any[] = [];

    invoices.forEach((inv) => {
      const outstanding = Number(inv.total) - Number(inv.paidAmount);
      if (outstanding <= 0) return;

      const daysOverdue = Math.floor(
        (today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let bucket: string;
      if (daysOverdue <= 0) {
        bucket = 'current';
        summary.current += outstanding;
      } else if (daysOverdue <= 30) {
        bucket = '1-30';
        summary.days30 += outstanding;
      } else if (daysOverdue <= 60) {
        bucket = '31-60';
        summary.days60 += outstanding;
      } else if (daysOverdue <= 90) {
        bucket = '61-90';
        summary.days90 += outstanding;
      } else {
        bucket = '>90';
        summary.over90 += outstanding;
      }

      summary.total += outstanding;

      const entity = entityType === 'customer' ? inv.customer : inv.supplier;
      details.push({
        entityId: entity?.id || 'unknown',
        entityName:
          entity?.businessName ||
          `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim() ||
          'Unknown',
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        amount: Number(inv.total),
        paid: Number(inv.paidAmount),
        outstanding,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      });
    });

    return {
      summary,
      details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }

  /**
   * Profittabilità per Cliente
   */
  async getCustomerProfitability(
    dateRange: DateRange
  ): Promise<{
    customers: {
      customerId: string;
      name: string;
      type: string;
      revenue: number;
      cost: number;
      profit: number;
      margin: number;
      ordersCount: number;
      avgOrderValue: number;
    }[];
    summary: {
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      avgMargin: number;
    };
  }> {
    const { from, to } = dateRange;

    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: from, lte: to },
        status: { in: ['SHIPPED', 'DELIVERED'] },
      },
      include: {
        customer: { select: { id: true, businessName: true, firstName: true, lastName: true, type: true } },
        items: {
          include: {
            product: { select: { cost: true } },
          },
        },
      },
    });

    const customerStats: Record<
      string,
      {
        name: string;
        type: string;
        revenue: number;
        cost: number;
        ordersCount: number;
      }
    > = {};

    orders.forEach((order) => {
      const customerId = order.customerId;
      if (!customerStats[customerId]) {
        const customer = order.customer;
        customerStats[customerId] = {
          name:
            customer.businessName ||
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
            'Unknown',
          type: customer.type,
          revenue: 0,
          cost: 0,
          ordersCount: 0,
        };
      }

      customerStats[customerId].revenue += Number(order.total);
      customerStats[customerId].ordersCount++;

      order.items.forEach((item) => {
        customerStats[customerId].cost += Number(item.product?.cost || 0) * item.quantity;
      });
    });

    const customers = Object.entries(customerStats).map(([customerId, stats]) => ({
      customerId,
      ...stats,
      profit: stats.revenue - stats.cost,
      margin: stats.revenue > 0 ? ((stats.revenue - stats.cost) / stats.revenue) * 100 : 0,
      avgOrderValue: stats.ordersCount > 0 ? stats.revenue / stats.ordersCount : 0,
    }));

    const totalRevenue = customers.reduce((sum, c) => sum + c.revenue, 0);
    const totalCost = customers.reduce((sum, c) => sum + c.cost, 0);

    return {
      customers: customers.sort((a, b) => b.profit - a.profit),
      summary: {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        avgMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      },
    };
  }
}

export const reportsService = new ReportsService();
export default reportsService;
