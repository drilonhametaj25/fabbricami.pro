import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { TenantContext } from './tenant.middleware';
import { setTenantContext } from '../utils/tenant-context';
import { config } from '../config/environment';

/**
 * Shop Tenant Resolution Middleware
 *
 * Risolve il tenantId per le route SHOP pubbliche (non autenticate via JWT ERP).
 * Ogni tenant ha la propria vetrina e-commerce. Senza un tenant risolto, la
 * route deve fallire prima di toccare Prisma — altrimenti il middleware
 * tenant-scoped di database.ts lascia passare query non filtrate (data leak).
 *
 * Ordine di risoluzione:
 *   1) Custom domain → Tenant.domain == request.hostname
 *      (cliente con dominio proprio, es. "shop.acme.com")
 *   2) Subdomain → primo segmento di hostname == Tenant.slug
 *      (es. "acme.fabbricami.pro" → slug "acme")
 *   3) Header X-Tenant-Slug (SOLO non-production) — per dev locale dove
 *      Nuxt gira su localhost:3001 senza subdomain.
 *
 * In assenza di tenant risolto → 400 TENANT_REQUIRED.
 * Tenant non ACTIVE → 403.
 *
 * Imposta `tenantContext.enterWith(ctx)` per il resto della request.
 */

export interface ShopTenantRequest extends FastifyRequest {
  tenant: TenantContext;
}

function extractSubdomain(hostname: string, baseDomain: string | null): string | null {
  if (!baseDomain) return null;
  const host = hostname.split(':')[0].toLowerCase();
  const base = baseDomain.toLowerCase();
  if (host === base) return null;
  if (!host.endsWith('.' + base)) return null;
  const sub = host.slice(0, host.length - base.length - 1);
  // Scarta sottodomini "tecnici" comuni
  if (!sub || sub === 'www' || sub === 'api') return null;
  // Solo il primo segmento conta (es. "shop.acme.fabbricami.pro" → "shop")
  return sub.split('.').pop() || null;
}

export async function shopTenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const hostname = (request.hostname || request.headers.host || '').toString();
    let tenant: { id: string; slug: string; status: string } | null = null;

    // 1) Custom domain match (Tenant.domain)
    if (hostname) {
      const host = hostname.split(':')[0].toLowerCase();
      tenant = await prisma.tenant.findUnique({
        where: { domain: host },
        select: { id: true, slug: true, status: true },
      });
    }

    // 2) Subdomain match (Tenant.slug)
    if (!tenant && config.shop.baseDomain) {
      const sub = extractSubdomain(hostname, config.shop.baseDomain);
      if (sub) {
        tenant = await prisma.tenant.findUnique({
          where: { slug: sub },
          select: { id: true, slug: true, status: true },
        });
      }
    }

    // 3) Dev-only header
    if (!tenant && !config.isProduction) {
      const headerSlug = request.headers['x-tenant-slug'];
      if (typeof headerSlug === 'string' && headerSlug) {
        tenant = await prisma.tenant.findUnique({
          where: { slug: headerSlug.toLowerCase() },
          select: { id: true, slug: true, status: true },
        });
      }
    }

    if (!tenant) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant not specified',
        code: 'TENANT_REQUIRED',
        message:
          'Richiesta shop senza tenant risolvibile. ' +
          'In produzione il tenant è derivato dal dominio/subdomain; ' +
          'in dev passare header X-Tenant-Slug.',
      });
    }

    if (tenant.status !== 'ACTIVE') {
      return reply.status(403).send({
        success: false,
        error: 'Tenant non attivo',
        code: 'TENANT_NOT_ACTIVE',
      });
    }

    const ctx: TenantContext = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantStatus: tenant.status as TenantContext['tenantStatus'],
    };

    (request as ShopTenantRequest).tenant = ctx;
    setTenantContext(ctx);
  } catch (err) {
    request.log.error('Shop tenant middleware error: ' + String(err));
    return reply.status(500).send({
      success: false,
      error: 'Tenant resolution failed',
    });
  }
}
