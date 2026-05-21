import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from './auth.middleware';
import { runSubscriptionGate, SubscriptionGateContext } from './subscription-gate';
import {
  TenantContext,
  setTenantContext,
  getCurrentTenantContext,
  getCurrentTenantId as _getCurrentTenantId,
  requireCurrentTenantId as _requireCurrentTenantId,
  _internalGetStorage,
} from '../utils/tenant-context';

// ============================================
// TENANT CONTEXT (re-export — single source of truth in utils/tenant-context.ts)
// ============================================

export type { TenantContext };

// Storage AsyncLocalStorage — esposto SOLO per retrocompatibilità con call site
// che facevano `tenantContext.enterWith(ctx)` o `tenantContext.run(...)`.
// Nuovi call site dovrebbero usare setTenantContext()/runWithTenantContext() da utils/tenant-context.
export const tenantContext = _internalGetStorage();

export function getCurrentTenant(): TenantContext | undefined {
  return getCurrentTenantContext();
}

export const getCurrentTenantId = _getCurrentTenantId;
export const requireCurrentTenantId = _requireCurrentTenantId;

// ============================================
// TENANT MIDDLEWARE
// ============================================

export interface TenantRequest extends FastifyRequest {
  tenant: TenantContext;
}

/**
 * Middleware per estrarre e validare il tenant dalla request.
 *
 * SOLO route ERP autenticate. Il tenantId è SEMPRE ricavato dal JWT —
 * mai dal client (header/query/body), perché senza prova di possesso
 * (firma + claim) sarebbe un IDOR cross-tenant garantito.
 *
 * Le route SHOP pubbliche usano `shopTenantMiddleware` che risolve da
 * dominio/subdomain.
 *
 * Le integrazioni API esterne (WordPress plugin) usano già un middleware
 * dedicato con `:tenantSlug` nel path + Basic Auth.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authRequest = request as AuthenticatedRequest;
    const tenantId = authRequest.user?.tenantId ?? null;

    // Senza JWT autenticato non c'è prova di possesso del tenant → reject.
    if (!tenantId) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant not specified',
        message: 'Request must be authenticated with a JWT carrying tenantId',
      });
    }

    // Verifica che il tenant esista e sia attivo
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: 'Tenant not found',
      });
    }

    if (tenant.status !== 'ACTIVE') {
      return reply.status(403).send({
        success: false,
        error: 'Tenant suspended',
        message: `Tenant is ${tenant.status.toLowerCase()}. Please contact support.`,
      });
    }

    // Imposta il contesto tenant
    const ctx: TenantContext = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantStatus: tenant.status,
    };

    // Attach tenant to request per uso nei handler
    (request as TenantRequest).tenant = ctx;

    // CRITICAL: Imposta l'AsyncLocalStorage context con enterWith.
    // Questo garantisce che il context tenant sia disponibile per il resto
    // del lifecycle della request (handler, prisma middleware, ecc.)
    // senza wrappare il control-flow in una callback.
    setTenantContext(ctx);

    // ============================================
    // SUBSCRIPTION GATE (shared helper)
    // ============================================
    // Block business routes when the tenant's subscription is not active.
    // Bypass paths (billing, onboarding, tickets, ...) stay accessible so the
    // user can take corrective action (pay, upgrade, contact support).
    const gate = await runSubscriptionGate(request, reply, tenant.id);
    if (gate.blocked) {
      // The gate already sent a 402 reply
      return;
    }
    if (gate.subscription) {
      (request as TenantRequest & {
        subscription: SubscriptionGateContext;
      }).subscription = gate.subscription;
    }

  } catch (err) {
    request.log.error('Tenant middleware error: ' + String(err));
    return reply.status(500).send({
      success: false,
      error: 'Tenant validation failed',
    });
  }
}

/**
 * Middleware per verificare che l'utente appartenga al tenant corrente
 */
export async function verifyTenantMembership(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authRequest = request as AuthenticatedRequest;
  const tenantRequest = request as TenantRequest;

  if (!authRequest.user?.userId || !tenantRequest.tenant?.tenantId) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
  }

  // Verifica membership
  const membership = await prisma.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenantRequest.tenant.tenantId,
        userId: authRequest.user.userId,
      },
    },
    select: { role: true, acceptedAt: true },
  });

  if (!membership) {
    return reply.status(403).send({
      success: false,
      error: 'Not a member of this tenant',
    });
  }

  if (!membership.acceptedAt) {
    return reply.status(403).send({
      success: false,
      error: 'Membership not yet accepted',
    });
  }
}

/**
 * Middleware opzionale per route pubbliche che possono opzionalmente avere un tenant.
 * Non fallisce se non c'è tenant, ma lo imposta se disponibile.
 * Risolve tenantId SOLO da JWT (mai da header non firmato — sarebbe un IDOR).
 *
 * ATTENZIONE: usare con cautela. Una route con questo middleware che fa query
 * Prisma su modelli tenant-scoped senza tenant attivo lascerà passare il
 * middleware Prisma unfiltered (mode warn-only) o crasherà (mode strict).
 * Per shop pubblico usare `shopTenantMiddleware` invece.
 */
export async function optionalTenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authRequest = request as AuthenticatedRequest;
    const tenantId = authRequest.user?.tenantId ?? null;

    if (!tenantId) {
      return; // Nessun JWT autenticato, continua senza contesto
    }

    // Verifica che il tenant esista e sia attivo
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true },
    });

    if (tenant && tenant.status === 'ACTIVE') {
      const ctx: TenantContext = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantStatus: tenant.status,
      };
      (request as TenantRequest).tenant = ctx;
      setTenantContext(ctx);
    }
  } catch (err) {
    // Silently fail for optional tenant
    request.log.warn('Optional tenant middleware error: ' + String(err));
  }
}
