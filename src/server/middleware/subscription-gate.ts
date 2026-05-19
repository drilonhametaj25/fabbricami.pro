/**
 * Shared subscription access gate.
 *
 * This is the single source of truth that decides whether a tenant is allowed
 * to access a business route based on their subscription status.
 *
 * Called by `authenticate` (so it covers ALL authenticated routes) and by
 * `tenantMiddleware` (so it also covers routes that authenticate via header /
 * subdomain without a JWT).
 *
 * Bypassed for paths that MUST stay reachable even with a broken subscription
 * (billing, onboarding, tickets, etc.), so the user can take corrective action.
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { SaasSubscriptionStatus } from '@prisma/client';

const SUBSCRIPTION_BYPASS_PREFIXES = [
  '/api/v1/auth',          // logout, change-password, refresh-token
  '/api/v1/subscription',  // upgrade plan, create checkout, view plans
  '/api/v1/billing',       // see invoices, payment methods
  '/api/v1/onboarding',    // initial setup
  '/api/v1/tickets',       // bug reports / support — always accessible
  '/api/v1/tenant',        // tenant settings, members, profile
  '/api/v1/notifications', // notifications visibility
  '/api/v1/admin',         // SuperAdmin (uses its own auth)
  '/api/v1/wordpress/plugin/download',  // download plugin always allowed
  '/api/v1/wordpress/settings',         // configurazione WP sempre accessibile
];

export function isSubscriptionBypassed(url: string | undefined): boolean {
  if (!url) {
    // Defensive: if no URL is provided (e.g., in unit tests with mocked
    // request objects), bypass the gate. Real Fastify requests always have a
    // URL set.
    return true;
  }
  const path = url.split('?')[0];
  return SUBSCRIPTION_BYPASS_PREFIXES.some((p) => path.startsWith(p));
}

export interface SubscriptionGateContext {
  subscriptionId: string;
  planCode: string;
  planName: string;
  status: SaasSubscriptionStatus;
  limits: {
    maxUsers?: number;
    maxWarehouses?: number;
    maxProducts?: number;
    maxOrders?: number;
    maxSuppliers?: number;
    features: string[];
  };
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
}

interface GateResult {
  // If `true`, the caller should return immediately (the gate already replied)
  blocked: boolean;
  subscription?: SubscriptionGateContext;
}

/**
 * Runs the subscription access check for a tenant.
 *
 * - If the URL is in the bypass list, returns { blocked: false }.
 * - If there is no subscription, returns 402 + { blocked: true }.
 * - If subscription is PAST_DUE / CANCELLED / PAUSED, returns 402 + blocked.
 * - If trial expired or period ended, returns 402 + blocked.
 * - Otherwise, returns { blocked: false, subscription: ctx } and the caller
 *   may attach it to the request.
 */
export async function runSubscriptionGate(
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: string
): Promise<GateResult> {
  if (isSubscriptionBypassed(request.url)) {
    return { blocked: false };
  }

  const subscription = await prisma.saasSubscription.findUnique({
    where: { tenantId },
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          limits: true,
          features: true,
        },
      },
    },
  });

  if (!subscription) {
    reply.status(402).send({
      success: false,
      error: 'No subscription',
      code: 'NO_SUBSCRIPTION',
      message:
        'Nessuna subscription attiva trovata. Sottoscrivi un piano per continuare.',
    });
    return { blocked: true };
  }

  const validStatuses: SaasSubscriptionStatus[] = ['ACTIVE', 'TRIALING'];
  if (!validStatuses.includes(subscription.status)) {
    const statusMessages: Partial<Record<SaasSubscriptionStatus, string>> = {
      PAST_DUE:
        'Il pagamento della tua subscription è in ritardo. Aggiorna il metodo di pagamento per continuare.',
      CANCELLED:
        'La tua subscription è stata cancellata. Sottoscrivi di nuovo per continuare.',
      PAUSED:
        'La tua subscription è in pausa. Riattivala per continuare a usare la piattaforma.',
    };
    reply.status(402).send({
      success: false,
      error: 'Subscription inactive',
      code: `SUBSCRIPTION_${subscription.status}`,
      message:
        statusMessages[subscription.status] ||
        'La tua subscription non è in uno stato valido per continuare.',
    });
    return { blocked: true };
  }

  const now = new Date();
  if (
    subscription.status === 'TRIALING' &&
    subscription.trialEndsAt &&
    now > subscription.trialEndsAt
  ) {
    reply.status(402).send({
      success: false,
      error: 'Trial expired',
      code: 'TRIAL_EXPIRED',
      message:
        'Il tuo periodo di prova è terminato. Sottoscrivi un piano per continuare.',
    });
    return { blocked: true };
  }

  if (now > subscription.currentPeriodEnd) {
    reply.status(402).send({
      success: false,
      error: 'Subscription period ended',
      code: 'SUBSCRIPTION_EXPIRED',
      message:
        'Il periodo di subscription è terminato. Rinnova per continuare.',
    });
    return { blocked: true };
  }

  // Build the subscription context to attach to the request
  const rawLimits = (subscription.plan.limits as Record<string, unknown>) || {};
  const rawFeatures =
    (subscription.plan.features as { modules?: unknown; capabilities?: unknown }) ||
    {};
  const modules = Array.isArray(rawFeatures.modules)
    ? (rawFeatures.modules as string[])
    : [];

  const ctx: SubscriptionGateContext = {
    subscriptionId: subscription.id,
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    status: subscription.status,
    limits: {
      maxUsers: typeof rawLimits.maxUsers === 'number' ? rawLimits.maxUsers : undefined,
      maxWarehouses:
        typeof rawLimits.maxWarehouses === 'number' ? rawLimits.maxWarehouses : undefined,
      maxProducts:
        typeof rawLimits.maxProducts === 'number' ? rawLimits.maxProducts : undefined,
      maxOrders: typeof rawLimits.maxOrders === 'number' ? rawLimits.maxOrders : undefined,
      maxSuppliers:
        typeof rawLimits.maxSuppliers === 'number' ? rawLimits.maxSuppliers : undefined,
      features: modules,
    },
    trialEndsAt: subscription.trialEndsAt || undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };

  return { blocked: false, subscription: ctx };
}
