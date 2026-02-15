import { prisma } from '../config/database';
import { checkPlanLimit, getPlanLimits } from '../middleware/subscription.middleware';

// ============================================
// TYPES
// ============================================

export interface BillingHistoryItem {
  id: string;
  date: Date;
  amount: number;
  status: string;
  invoiceUrl: string | null;
}

export interface UsageStats {
  users: { current: number; limit: number; percentage: number };
  warehouses: { current: number; limit: number; percentage: number };
  products: { current: number; limit: number; percentage: number };
  orders: { current: number; limit: number; percentage: number };
  suppliers: { current: number; limit: number; percentage: number };
}

export interface BillingSummary {
  subscription: {
    planCode: string;
    planName: string;
    status: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: Date | null;
  } | null;
  usage: UsageStats;
  recentInvoices: BillingHistoryItem[];
}

// ============================================
// BILLING SERVICE
// ============================================

class BillingService {
  /**
   * Get billing summary for a tenant
   */
  async getBillingSummary(tenantId: string): Promise<BillingSummary> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
        billing: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    const usage = await this.getUsageStats(tenantId);

    const recentInvoices: BillingHistoryItem[] = subscription?.billing.map((b) => ({
      id: b.id,
      date: b.createdAt,
      amount: Number(b.amount),
      status: b.status,
      invoiceUrl: b.invoiceUrl,
    })) || [];

    return {
      subscription: subscription ? {
        planCode: subscription.plan.code,
        planName: subscription.plan.name,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
      } : null,
      usage,
      recentInvoices,
    };
  }

  /**
   * Get usage statistics for a tenant
   */
  async getUsageStats(tenantId: string): Promise<UsageStats> {
    // Recupera il piano per i limiti
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { code: true } } },
    });

    const planCode = subscription?.plan?.code || 'STARTER';
    const limits = getPlanLimits(planCode);

    // Conta risorse correnti
    const [usersCount, warehousesCount, productsCount, ordersThisMonth, suppliersCount] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.warehouse.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      this.getMonthlyOrdersCount(tenantId),
      prisma.supplier.count({ where: { tenantId } }),
    ]);

    return {
      users: this.calcUsage(usersCount, limits.maxUsers),
      warehouses: this.calcUsage(warehousesCount, limits.maxWarehouses),
      products: this.calcUsage(productsCount, limits.maxProducts),
      orders: this.calcUsage(ordersThisMonth, limits.maxOrders),
      suppliers: this.calcUsage(suppliersCount, limits.maxSuppliers),
    };
  }

  /**
   * Get billing history for a tenant
   */
  async getBillingHistory(tenantId: string, page = 1, limit = 20): Promise<{
    items: BillingHistoryItem[];
    total: number;
    pages: number;
  }> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return { items: [], total: 0, pages: 0 };
    }

    const [items, total] = await Promise.all([
      prisma.billingHistory.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.billingHistory.count({
        where: { subscriptionId: subscription.id },
      }),
    ]);

    return {
      items: items.map((b) => ({
        id: b.id,
        date: b.createdAt,
        amount: Number(b.amount),
        status: b.status,
        invoiceUrl: b.invoiceUrl,
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Check if a resource limit allows creating a new resource
   */
  async canCreateResource(
    tenantId: string,
    resource: 'users' | 'warehouses' | 'products' | 'orders' | 'suppliers'
  ): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
    return checkPlanLimit(tenantId, resource);
  }

  /**
   * Get features available for a tenant's plan
   */
  async getAvailableFeatures(tenantId: string): Promise<string[]> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { code: true } } },
    });

    const planCode = subscription?.plan?.code || 'STARTER';
    const limits = getPlanLimits(planCode);

    return limits.features;
  }

  /**
   * Check if a feature is available for a tenant
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const features = await this.getAvailableFeatures(tenantId);
    return features.includes(feature);
  }

  /**
   * Get count of orders this month
   */
  private async getMonthlyOrdersCount(tenantId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    });
  }

  /**
   * Calculate usage percentage
   */
  private calcUsage(current: number, limit: number): { current: number; limit: number; percentage: number } {
    if (limit === -1) {
      // Unlimited
      return { current, limit: -1, percentage: 0 };
    }

    const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
    return { current, limit, percentage };
  }

  /**
   * Get upgrade recommendations based on usage
   */
  async getUpgradeRecommendations(tenantId: string): Promise<{
    shouldUpgrade: boolean;
    reasons: string[];
    recommendedPlan: string | null;
  }> {
    const usage = await this.getUsageStats(tenantId);
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { code: true } } },
    });

    const currentPlan = subscription?.plan?.code || 'STARTER';
    const reasons: string[] = [];
    let recommendedPlan: string | null = null;

    // Check each resource usage
    if (usage.users.percentage >= 80) {
      reasons.push(`Hai utilizzato ${usage.users.percentage}% degli utenti disponibili`);
    }
    if (usage.warehouses.percentage >= 80) {
      reasons.push(`Hai utilizzato ${usage.warehouses.percentage}% dei magazzini disponibili`);
    }
    if (usage.products.percentage >= 80) {
      reasons.push(`Hai utilizzato ${usage.products.percentage}% dei prodotti disponibili`);
    }
    if (usage.orders.percentage >= 80) {
      reasons.push(`Hai utilizzato ${usage.orders.percentage}% degli ordini mensili`);
    }
    if (usage.suppliers.percentage >= 80) {
      reasons.push(`Hai utilizzato ${usage.suppliers.percentage}% dei fornitori disponibili`);
    }

    // Determine recommended plan
    if (reasons.length > 0) {
      if (currentPlan === 'STARTER') {
        recommendedPlan = 'PRO';
      } else if (currentPlan === 'PRO') {
        recommendedPlan = 'BUSINESS';
      }
    }

    return {
      shouldUpgrade: reasons.length > 0,
      reasons,
      recommendedPlan,
    };
  }

  /**
   * Calculate proration for plan change
   */
  async calculateProration(
    tenantId: string,
    newPlanCode: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<{
    currentPlanAmount: number;
    newPlanAmount: number;
    prorationCredit: number;
    amountDue: number;
    effectiveDate: Date;
  }> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription non trovata');
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: newPlanCode },
    });

    if (!newPlan) {
      throw new Error('Piano non trovato');
    }

    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const periodStart = subscription.currentPeriodStart;

    // Calcola i giorni rimanenti nel periodo corrente
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Calcola il credito pro-rata per il piano corrente
    const currentPlanAmount = billingPeriod === 'yearly'
      ? Number(subscription.plan.priceYearly)
      : Number(subscription.plan.priceMonthly);

    const dailyRate = currentPlanAmount / totalDays;
    const prorationCredit = Math.round(dailyRate * daysRemaining * 100) / 100;

    // Calcola il costo del nuovo piano
    const newPlanAmount = billingPeriod === 'yearly'
      ? Number(newPlan.priceYearly)
      : Number(newPlan.priceMonthly);

    // Calcola l'importo dovuto (nuovo piano - credito)
    const amountDue = Math.max(0, newPlanAmount - prorationCredit);

    return {
      currentPlanAmount,
      newPlanAmount,
      prorationCredit,
      amountDue,
      effectiveDate: now,
    };
  }
}

export const billingService = new BillingService();
