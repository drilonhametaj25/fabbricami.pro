import { FastifyRequest, FastifyReply } from 'fastify';
import { AsyncLocalStorage } from 'async_hooks';
import { prisma } from '../config/database';
import { TenantStatus } from '@prisma/client';
import { AuthenticatedRequest } from './auth.middleware';

// ============================================
// TENANT CONTEXT
// ============================================

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
}

// AsyncLocalStorage per propagare il contesto tenant attraverso la request
export const tenantContext = new AsyncLocalStorage<TenantContext>();

// Helper per ottenere il contesto tenant corrente
export function getCurrentTenant(): TenantContext | undefined {
  return tenantContext.getStore();
}

// Helper per ottenere tenantId corrente (usato dal Prisma middleware)
export function getCurrentTenantId(): string | undefined {
  return tenantContext.getStore()?.tenantId;
}

// ============================================
// TENANT MIDDLEWARE
// ============================================

export interface TenantRequest extends FastifyRequest {
  tenant: TenantContext;
}

/**
 * Middleware per estrarre e validare il tenant dalla request
 *
 * Il tenant può essere identificato tramite:
 * 1. JWT token (userId con tenantId associato)
 * 2. Header X-Tenant-Id (per client API)
 * 3. Subdomain (es. acme.erpsaas.com)
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authRequest = request as AuthenticatedRequest;
    let tenantId: string | null = null;

    // 1. Prima prova a ottenere il tenantId dal JWT (se autenticato)
    if (authRequest.user?.tenantId) {
      tenantId = authRequest.user.tenantId;
    }

    // 2. Fallback: header X-Tenant-Id (per API esterne)
    if (!tenantId) {
      const headerTenantId = request.headers['x-tenant-id'];
      if (typeof headerTenantId === 'string') {
        tenantId = headerTenantId;
      }
    }

    // 3. Fallback: subdomain
    if (!tenantId) {
      const host = request.headers.host;
      if (host) {
        // Estrai subdomain (es. "acme" da "acme.erpsaas.com")
        const parts = host.split('.');
        if (parts.length >= 3) {
          const subdomain = parts[0];
          // Cerca tenant per slug
          const tenant = await prisma.tenant.findUnique({
            where: { slug: subdomain },
            select: { id: true, slug: true, status: true },
          });
          if (tenant) {
            tenantId = tenant.id;
          }
        }
      }
    }

    // Se non abbiamo un tenantId, errore
    if (!tenantId) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant not specified',
        message: 'Request must include tenant identification via JWT, X-Tenant-Id header, or subdomain',
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

    // Esegui il resto della request nel contesto del tenant
    // Questo permette al Prisma middleware di auto-filtrare per tenantId
    await new Promise<void>((resolve, reject) => {
      tenantContext.run(ctx, async () => {
        try {
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

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
 * Middleware opzionale per route pubbliche che possono opzionalmente avere un tenant
 * Non fallisce se non c'è tenant, ma lo imposta se disponibile
 */
export async function optionalTenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authRequest = request as AuthenticatedRequest;
    let tenantId: string | null = null;

    // Prova a ottenere il tenantId dal JWT
    if (authRequest.user?.tenantId) {
      tenantId = authRequest.user.tenantId;
    }

    // Fallback: header X-Tenant-Id
    if (!tenantId) {
      const headerTenantId = request.headers['x-tenant-id'];
      if (typeof headerTenantId === 'string') {
        tenantId = headerTenantId;
      }
    }

    if (!tenantId) {
      return; // Nessun tenant, continua senza contesto
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
    }
  } catch (err) {
    // Silently fail for optional tenant
    request.log.warn('Optional tenant middleware error: ' + String(err));
  }
}
