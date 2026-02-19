/**
 * Admin Service
 * Business logic for MegaAdmin panel - Platform administration
 */

import { prisma } from '../config/database';
import { SaasSubscriptionStatus, TenantStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    })
  : null;

// ============================================
// TYPES
// ============================================

export interface PlanInput {
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  features: {
    modules: string[];
    capabilities: string[];
  };
  limits: {
    maxUsers: number;
    maxWarehouses: number;
    maxProducts: number;
    maxOrders: number;
    maxSuppliers: number;
  };
  sortOrder?: number;
  isActive?: boolean;
}

export interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  paidTenants: number;
  expiredTenants: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  trialConversionRate: number;
  churnRate: number;
  recentSignups: Array<{
    id: string;
    name: string;
    createdAt: Date;
    status: string;
  }>;
  trialsEndingSoon: Array<{
    id: string;
    name: string;
    trialEndsAt: Date;
    ownerEmail: string;
  }>;
  revenueByPlan: Array<{
    planCode: string;
    planName: string;
    count: number;
    revenue: number;
  }>;
}

export interface TenantFilters {
  status?: TenantStatus;
  subscriptionStatus?: SaasSubscriptionStatus;
  planCode?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// SUPER ADMIN AUTHENTICATION
// ============================================

class AdminService {
  /**
   * Authenticate super admin
   */
  async authenticateSuperAdmin(
    email: string,
    password: string
  ): Promise<{ id: string; email: string; name: string } | null> {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!superAdmin || !superAdmin.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, superAdmin.password);
    if (!isValid) {
      return null;
    }

    // Update last login
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLogin: new Date() },
    });

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
    };
  }

  /**
   * Create first super admin (should be called once during setup)
   */
  async createSuperAdmin(
    email: string,
    password: string,
    name: string
  ): Promise<{ id: string; email: string; name: string }> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = await prisma.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
    };
  }

  /**
   * Update super admin refresh token
   */
  async updateSuperAdminRefreshToken(
    superAdminId: string,
    refreshToken: string | null
  ): Promise<void> {
    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: { refreshToken },
    });
  }

  // ============================================
  // DASHBOARD METRICS
  // ============================================

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Tenant counts
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      paidTenants,
      expiredTenants,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.saasSubscription.count({ where: { status: 'TRIALING' } }),
      prisma.saasSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.saasSubscription.count({ where: { status: 'EXPIRED' } }),
    ]);

    // Calculate MRR and ARR
    const activeSubscriptions = await prisma.saasSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    let mrr = 0;
    for (const sub of activeSubscriptions) {
      if (sub.billingInterval === 'yearly') {
        mrr += Number(sub.plan.priceYearly) / 12;
      } else {
        mrr += Number(sub.plan.priceMonthly);
      }
    }
    const arr = mrr * 12;

    // Trial conversion rate (last 30 days)
    const trialsStarted30Days = await prisma.saasSubscription.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const trialsConverted30Days = await prisma.saasSubscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const trialConversionRate =
      trialsStarted30Days > 0
        ? (trialsConverted30Days / trialsStarted30Days) * 100
        : 0;

    // Churn rate (subscriptions cancelled in last 30 days)
    const cancelledLast30Days = await prisma.saasSubscription.count({
      where: {
        status: 'CANCELLED',
        cancelledAt: { gte: thirtyDaysAgo },
      },
    });
    const activeAtStartOfPeriod = paidTenants + cancelledLast30Days;
    const churnRate =
      activeAtStartOfPeriod > 0
        ? (cancelledLast30Days / activeAtStartOfPeriod) * 100
        : 0;

    // Recent signups (last 7 days)
    const recentSignups = await prisma.tenant.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        createdAt: true,
        status: true,
      },
    });

    // Trials ending in next 7 days
    const trialsEndingSoon = await prisma.saasSubscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        tenant: {
          include: {
            members: {
              where: { role: 'ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { trialEndsAt: 'asc' },
      take: 10,
    });

    // Revenue by plan
    const revenueByPlan = await this.getRevenueByPlan();

    return {
      totalTenants,
      activeTenants,
      trialTenants,
      paidTenants,
      expiredTenants,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      trialConversionRate: Math.round(trialConversionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      recentSignups: recentSignups.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        status: t.status,
      })),
      trialsEndingSoon: trialsEndingSoon.map((s) => ({
        id: s.tenant?.id || '',
        name: s.tenant?.name || '',
        trialEndsAt: s.trialEndsAt!,
        ownerEmail: s.tenant?.members[0]?.user?.email || '',
      })),
      revenueByPlan,
    };
  }

  /**
   * Get revenue breakdown by plan
   */
  private async getRevenueByPlan(): Promise<
    Array<{ planCode: string; planName: string; count: number; revenue: number }>
  > {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    return plans.map((plan) => {
      let revenue = 0;
      for (const sub of plan.subscriptions) {
        if (sub.billingInterval === 'yearly') {
          revenue += Number(plan.priceYearly) / 12;
        } else {
          revenue += Number(plan.priceMonthly);
        }
      }
      return {
        planCode: plan.code,
        planName: plan.name,
        count: plan.subscriptions.length,
        revenue: Math.round(revenue * 100) / 100,
      };
    });
  }

  // ============================================
  // SUBSCRIPTION PLANS MANAGEMENT
  // ============================================

  /**
   * List all subscription plans
   */
  async listPlans() {
    return prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });
  }

  /**
   * Get a single plan by ID
   */
  async getPlan(planId: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });
  }

  /**
   * Create a new subscription plan
   */
  async createPlan(data: PlanInput) {
    return prisma.subscriptionPlan.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        priceMonthly: data.priceMonthly,
        priceYearly: data.priceYearly,
        features: data.features,
        limits: data.limits,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update an existing subscription plan
   */
  async updatePlan(planId: string, data: Partial<PlanInput>) {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priceMonthly !== undefined) updateData.priceMonthly = data.priceMonthly;
    if (data.priceYearly !== undefined) updateData.priceYearly = data.priceYearly;
    if (data.features !== undefined) updateData.features = data.features;
    if (data.limits !== undefined) updateData.limits = data.limits;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    });
  }

  /**
   * Delete a subscription plan (only if no active subscriptions)
   */
  async deletePlan(planId: string): Promise<{ success: boolean; error?: string }> {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    if (plan._count.subscriptions > 0) {
      return {
        success: false,
        error: `Cannot delete plan with ${plan._count.subscriptions} active subscriptions`,
      };
    }

    await prisma.subscriptionPlan.delete({ where: { id: planId } });
    return { success: true };
  }

  /**
   * Sync plan to Stripe (create/update product and prices)
   */
  async syncPlanToStripe(planId: string): Promise<{
    success: boolean;
    productId?: string;
    priceMonthlyId?: string;
    priceYearlyId?: string;
    error?: string;
  }> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    try {
      // Create or update Stripe product
      let product: Stripe.Product;
      if (plan.stripeProductId) {
        product = await stripe.products.update(plan.stripeProductId, {
          name: plan.name,
          description: plan.description || undefined,
          active: plan.isActive,
        });
      } else {
        product = await stripe.products.create({
          name: plan.name,
          description: plan.description || undefined,
          active: plan.isActive,
          metadata: {
            planCode: plan.code,
            planId: plan.id,
          },
        });
      }

      // Create prices (prices are immutable in Stripe, so we always create new ones)
      const priceMonthly = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(plan.priceMonthly) * 100),
        currency: 'eur',
        recurring: {
          interval: 'month',
        },
        metadata: {
          planCode: plan.code,
          billingInterval: 'monthly',
        },
      });

      const priceYearly = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(plan.priceYearly) * 100),
        currency: 'eur',
        recurring: {
          interval: 'year',
        },
        metadata: {
          planCode: plan.code,
          billingInterval: 'yearly',
        },
      });

      // Update plan with Stripe IDs
      await prisma.subscriptionPlan.update({
        where: { id: planId },
        data: {
          stripeProductId: product.id,
          stripePriceMonthlyId: priceMonthly.id,
          stripePriceYearlyId: priceYearly.id,
        },
      });

      return {
        success: true,
        productId: product.id,
        priceMonthlyId: priceMonthly.id,
        priceYearlyId: priceYearly.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to sync with Stripe',
      };
    }
  }

  // ============================================
  // TENANT MANAGEMENT
  // ============================================

  /**
   * List tenants with filters
   */
  async listTenants(filters: TenantFilters = {}) {
    const { status, subscriptionStatus, planCode, search, page = 1, limit = 20 } = filters;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (subscriptionStatus || planCode) {
      where.subscription = {};
      if (subscriptionStatus) {
        (where.subscription as Record<string, unknown>).status = subscriptionStatus;
      }
      if (planCode) {
        (where.subscription as Record<string, unknown>).plan = { code: planCode };
      }
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          subscription: {
            include: {
              plan: {
                select: { code: true, name: true },
              },
            },
          },
          members: {
            where: { role: 'ADMIN' },
            include: {
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
            take: 1,
          },
          _count: {
            select: { members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    return {
      items: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t.createdAt,
        subscription: t.subscription
          ? {
              status: t.subscription.status,
              planCode: t.subscription.plan.code,
              planName: t.subscription.plan.name,
              trialEndsAt: t.subscription.trialEndsAt,
              currentPeriodEnd: t.subscription.currentPeriodEnd,
            }
          : null,
        owner: t.members[0]?.user
          ? {
              email: t.members[0].user.email,
              name: `${t.members[0].user.firstName} ${t.members[0].user.lastName}`,
            }
          : null,
        membersCount: t._count.members,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get tenant details
   */
  async getTenantDetails(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: true,
            billing: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                lastLogin: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Extend trial for a tenant
   */
  async extendTrial(tenantId: string, days: number): Promise<{ success: boolean; newTrialEnd?: Date; error?: string }> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    if (subscription.status !== 'TRIALING' && subscription.status !== 'EXPIRED') {
      return { success: false, error: 'Tenant is not in trial or expired state' };
    }

    const currentEnd = subscription.trialEndsAt || new Date();
    const newTrialEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000);

    await prisma.saasSubscription.update({
      where: { id: subscription.id },
      data: {
        trialEndsAt: newTrialEnd,
        status: 'TRIALING',
        currentPeriodEnd: newTrialEnd,
      },
    });

    return { success: true, newTrialEnd };
  }

  /**
   * Change tenant subscription plan
   */
  async changeTenantPlan(
    tenantId: string,
    newPlanCode: string
  ): Promise<{ success: boolean; error?: string }> {
    const [subscription, newPlan] = await Promise.all([
      prisma.saasSubscription.findUnique({ where: { tenantId } }),
      prisma.subscriptionPlan.findUnique({ where: { code: newPlanCode } }),
    ]);

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    if (!newPlan) {
      return { success: false, error: 'Plan not found' };
    }

    await prisma.saasSubscription.update({
      where: { id: subscription.id },
      data: { planId: newPlan.id },
    });

    return { success: true };
  }

  /**
   * Suspend or reactivate tenant
   */
  async setTenantStatus(
    tenantId: string,
    status: TenantStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status },
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // STRIPE MANAGEMENT
  // ============================================

  /**
   * Get Stripe connection status
   */
  async getStripeStatus(): Promise<{
    isConfigured: boolean;
    mode: 'live' | 'test' | 'unknown';
    webhookConfigured: boolean;
  }> {
    const isConfigured = !!stripe;
    let mode: 'live' | 'test' | 'unknown' = 'unknown';

    if (STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      mode = 'live';
    } else if (STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      mode = 'test';
    }

    const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

    return { isConfigured, mode, webhookConfigured };
  }

  /**
   * List recent Stripe webhook events (from our logs)
   */
  async getRecentWebhookLogs(limit = 50) {
    // For now, return billing history as proxy for webhook activity
    return prisma.billingHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        subscription: {
          include: {
            tenant: {
              select: { name: true },
            },
          },
        },
      },
    });
  }
}

export const adminService = new AdminService();
export default adminService;
