import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { SaasSubscriptionStatus } from '@prisma/client';
import { TenantRequest } from './tenant.middleware';

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export interface SubscriptionContext {
  subscriptionId: string;
  planCode: string;
  planName: string;
  status: SaasSubscriptionStatus;
  limits: PlanLimits;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PlanLimits {
  maxUsers: number;
  maxWarehouses: number;
  maxProducts: number;
  maxOrders: number; // per mese
  maxSuppliers: number;
  features: string[]; // moduli abilitati
}

// Limiti di default per piano
const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    maxUsers: 3,
    maxWarehouses: 1,
    maxProducts: 1000,
    maxOrders: 500,
    maxSuppliers: 20,
    features: ['inventory', 'orders', 'customers', 'basic_reports'],
  },
  PRO: {
    maxUsers: 10,
    maxWarehouses: 3,
    maxProducts: 10000,
    maxOrders: 2000,
    maxSuppliers: 100,
    features: [
      'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
      'manufacturing', 'hr', 'advanced_reports', 'wordpress_sync',
    ],
  },
  BUSINESS: {
    maxUsers: -1, // Illimitati
    maxWarehouses: -1,
    maxProducts: -1,
    maxOrders: -1,
    maxSuppliers: -1,
    features: [
      'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
      'manufacturing', 'hr', 'accounting', 'sdi', 'advanced_reports',
      'wordpress_sync', 'api_access', 'custom_integrations',
    ],
  },
};

export interface SubscriptionRequest extends TenantRequest {
  subscription: SubscriptionContext;
}

// ============================================
// SUBSCRIPTION MIDDLEWARE
// ============================================

/**
 * Middleware per verificare che il tenant abbia una subscription attiva
 */
export async function subscriptionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantRequest = request as TenantRequest;

  if (!tenantRequest.tenant?.tenantId) {
    return reply.status(400).send({
      success: false,
      error: 'Tenant context required',
    });
  }

  try {
    // Recupera subscription con piano
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId: tenantRequest.tenant.tenantId },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            limits: true,
            features: true,
          },
        },
      },
    });

    if (!subscription) {
      return reply.status(402).send({
        success: false,
        error: 'No subscription found',
        message: 'Please subscribe to a plan to continue.',
      });
    }

    // Verifica stato subscription
    const now = new Date();
    const validStatuses: SaasSubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

    if (!validStatuses.includes(subscription.status)) {
      // Stato non valido
      if (subscription.status === 'PAST_DUE') {
        return reply.status(402).send({
          success: false,
          error: 'Payment required',
          message: 'Your subscription payment is past due. Please update your payment method.',
        });
      }

      if (subscription.status === 'CANCELLED') {
        return reply.status(402).send({
          success: false,
          error: 'Subscription cancelled',
          message: 'Your subscription has been cancelled. Please resubscribe to continue.',
        });
      }

      if (subscription.status === 'PAUSED') {
        return reply.status(402).send({
          success: false,
          error: 'Subscription paused',
          message: 'Your subscription is paused. Please resume to continue.',
        });
      }
    }

    // Verifica trial scaduto
    if (subscription.status === 'TRIALING' && subscription.trialEndsAt) {
      if (now > subscription.trialEndsAt) {
        return reply.status(402).send({
          success: false,
          error: 'Trial expired',
          message: 'Your trial period has ended. Please subscribe to continue.',
        });
      }
    }

    // Verifica periodo scaduto
    if (now > subscription.currentPeriodEnd) {
      return reply.status(402).send({
        success: false,
        error: 'Subscription expired',
        message: 'Your subscription period has ended. Please renew to continue.',
      });
    }

    // Estrai limiti dal piano (con fallback ai default)
    const planLimits = subscription.plan.limits as PlanLimits | null;
    const defaultLimits = PLAN_LIMITS[subscription.plan.code] || PLAN_LIMITS.STARTER;
    const limits: PlanLimits = planLimits || defaultLimits;

    // Imposta contesto subscription
    const ctx: SubscriptionContext = {
      subscriptionId: subscription.id,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      status: subscription.status,
      limits,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt || undefined,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };

    (request as SubscriptionRequest).subscription = ctx;

  } catch (err) {
    request.log.error('Subscription middleware error: ' + String(err));
    return reply.status(500).send({
      success: false,
      error: 'Subscription validation failed',
    });
  }
}

// ============================================
// PLAN LIMIT CHECKS
// ============================================

type ResourceType = 'users' | 'warehouses' | 'products' | 'orders' | 'suppliers';

/**
 * Verifica che il tenant non abbia superato un limite del piano
 */
export async function checkPlanLimit(
  tenantId: string,
  resource: ResourceType
): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
  // Recupera subscription
  const subscription = await prisma.saasSubscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { code: true, limits: true } } },
  });

  if (!subscription) {
    return { allowed: false, current: 0, limit: 0, message: 'No subscription found' };
  }

  const planLimits = subscription.plan.limits as PlanLimits | null;
  const defaultLimits = PLAN_LIMITS[subscription.plan.code] || PLAN_LIMITS.STARTER;
  const limits = planLimits || defaultLimits;

  let currentCount = 0;
  let limit = 0;

  switch (resource) {
    case 'users':
      currentCount = await prisma.user.count({ where: { tenantId } });
      limit = limits.maxUsers;
      break;
    case 'warehouses':
      currentCount = await prisma.warehouse.count({ where: { tenantId } });
      limit = limits.maxWarehouses;
      break;
    case 'products':
      currentCount = await prisma.product.count({ where: { tenantId } });
      limit = limits.maxProducts;
      break;
    case 'suppliers':
      currentCount = await prisma.supplier.count({ where: { tenantId } });
      limit = limits.maxSuppliers;
      break;
    case 'orders': {
      // Conta ordini del mese corrente
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      currentCount = await prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
        },
      });
      limit = limits.maxOrders;
      break;
    }
  }

  // -1 significa illimitato
  if (limit === -1) {
    return { allowed: true, current: currentCount, limit: -1 };
  }

  const allowed = currentCount < limit;
  const message = allowed
    ? undefined
    : `You have reached the ${resource} limit for your plan (${limit}). Please upgrade to add more.`;

  return { allowed, current: currentCount, limit, message };
}

/**
 * Middleware factory per verificare limiti prima di creare risorse
 */
export function requirePlanLimit(resource: ResourceType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const tenantRequest = request as TenantRequest;

    if (!tenantRequest.tenant?.tenantId) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant context required',
      });
    }

    const check = await checkPlanLimit(tenantRequest.tenant.tenantId, resource);

    if (!check.allowed) {
      return reply.status(403).send({
        success: false,
        error: 'Plan limit reached',
        message: check.message,
        details: {
          resource,
          current: check.current,
          limit: check.limit,
        },
      });
    }
  };
}

/**
 * Verifica che un modulo/feature sia abilitato nel piano
 */
export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const subRequest = request as SubscriptionRequest;

    if (!subRequest.subscription) {
      return reply.status(400).send({
        success: false,
        error: 'Subscription context required',
      });
    }

    const features = subRequest.subscription.limits.features || [];

    if (!features.includes(feature)) {
      return reply.status(403).send({
        success: false,
        error: 'Feature not available',
        message: `The "${feature}" feature is not included in your ${subRequest.subscription.planName} plan. Please upgrade to access this feature.`,
      });
    }
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ottieni i limiti per un piano specifico
 */
export function getPlanLimits(planCode: string): PlanLimits {
  return PLAN_LIMITS[planCode] || PLAN_LIMITS.STARTER;
}

/**
 * Verifica se un piano ha una feature specifica
 */
export function planHasFeature(planCode: string, feature: string): boolean {
  const limits = getPlanLimits(planCode);
  return limits.features.includes(feature);
}
