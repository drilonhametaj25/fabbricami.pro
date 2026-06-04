import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { prisma } from '../config/database';
import { TenantContext } from './tenant.middleware';
import { runWithTenantContext } from '../utils/tenant-context';
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

/** Risolve il tenant dello shop da dominio/subdomain/header (async). */
async function resolveShopTenant(
  request: FastifyRequest
): Promise<{ id: string; slug: string; status: string } | null> {
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

  return tenant;
}

/**
 * Middleware di risoluzione tenant per le route shop.
 *
 * IMPORTANTE — usa lo stile callback `(req, reply, done)` e avvolge il resto
 * della request con `runWithTenantContext(...)` (AsyncLocalStorage.run). Questo
 * garantisce che il tenant context sia visibile nell'handler e in TUTTE le sue
 * continuazioni async. Con `enterWith()` dentro un hook `addHook('preHandler')`
 * il context NON propagava all'handler (le query Prisma cadevano sul sentinel
 * `__NO_TENANT_CTX__` → zero risultati). `run()` è il pattern affidabile.
 */
export function shopTenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  resolveShopTenant(request)
    .then((tenant) => {
      if (!tenant) {
        reply.status(400).send({
          success: false,
          error: 'Tenant not specified',
          code: 'TENANT_REQUIRED',
          message:
            'Richiesta shop senza tenant risolvibile. ' +
            'In produzione il tenant è derivato dal dominio/subdomain; ' +
            'in dev passare header X-Tenant-Slug.',
        });
        return;
      }

      if (tenant.status !== 'ACTIVE') {
        reply.status(403).send({
          success: false,
          error: 'Tenant non attivo',
          code: 'TENANT_NOT_ACTIVE',
        });
        return;
      }

      const ctx: TenantContext = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantStatus: tenant.status as TenantContext['tenantStatus'],
      };

      (request as ShopTenantRequest).tenant = ctx;
      // Avvolge il proseguo della request (preHandler successivi + handler) nel
      // context tenant. done() viene invocato DENTRO runWithTenantContext.
      runWithTenantContext(ctx, () => {
        done();
      });
    })
    .catch((err) => {
      request.log.error('Shop tenant middleware error: ' + String(err));
      reply.status(500).send({
        success: false,
        error: 'Tenant resolution failed',
      });
    });
}
