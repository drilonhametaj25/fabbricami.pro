import { AsyncLocalStorage } from 'async_hooks';
import type { TenantStatus } from '@prisma/client';

/**
 * UNICA source-of-truth per il tenant context applicativo.
 *
 * Storia: pre-fix coesistevano due AsyncLocalStorage paralleli (questo file
 * e `middleware/tenant.middleware.ts`). I servizi WordPress/job usavano uno,
 * il middleware Prisma `$extends` leggeva dall'altro: il context settato in
 * uno NON era visibile nell'altro → query non filtrate. Adesso esiste solo
 * questo file; `middleware/tenant.middleware.ts` re-esporta gli helper qui.
 *
 * Uso ai bordi (entry point della request/job):
 *   await runWithTenant(tenantId, async () => { … })
 *   enterTenant(tenantId)                            // hook Fastify
 *   setTenantContext({ tenantId, tenantSlug, … })   // hook Fastify w/ slug
 *
 * Uso nei servizi:
 *   const tenantId = requireCurrentTenant();
 */

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
}

export interface TenantStore {
  tenantId: string;
  // Opzionali — popolati solo quando settati via setTenantContext()
  tenantSlug?: string;
  tenantStatus?: TenantStatus;
}

const tenantContextStore = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> | T {
  return tenantContextStore.run({ tenantId }, fn);
}

/**
 * Variante che accetta il context completo (tenantId + slug + status).
 * Equivalente a `runWithTenant` ma preserva slug/status per i caller che li leggono.
 */
export function runWithTenantContext<T>(
  ctx: TenantContext,
  fn: () => Promise<T> | T
): Promise<T> | T {
  return tenantContextStore.run(
    { tenantId: ctx.tenantId, tenantSlug: ctx.tenantSlug, tenantStatus: ctx.tenantStatus },
    fn
  );
}

export function getCurrentTenant(): string | null {
  return tenantContextStore.getStore()?.tenantId ?? null;
}

export function requireCurrentTenant(): string {
  const tenantId = getCurrentTenant();
  if (!tenantId) {
    throw new Error(
      'requireCurrentTenant: nessun tenant context attivo. ' +
        'Il caller deve wrappare la chiamata in runWithTenant(tenantId, fn).'
    );
  }
  return tenantId;
}

/** Alias semanticamente più chiaro per il caller "voglio l'id tenantId attuale". */
export function getCurrentTenantId(): string | undefined {
  return tenantContextStore.getStore()?.tenantId;
}

/**
 * Variante rigorosa di `getCurrentTenantId()`: lancia se non c'è context.
 * Usare SEMPRE prima di una raw query (`$queryRaw / $executeRaw`) che bypassa
 * il middleware Prisma `$extends`.
 */
export function requireCurrentTenantId(): string {
  return requireCurrentTenant();
}

/** Ritorna il context tenant completo (slug+status compresi se settati). */
export function getCurrentTenantContext(): TenantContext | undefined {
  const store = tenantContextStore.getStore();
  if (!store || !store.tenantSlug || !store.tenantStatus) return undefined;
  return {
    tenantId: store.tenantId,
    tenantSlug: store.tenantSlug,
    tenantStatus: store.tenantStatus,
  };
}

export function enterTenant(tenantId: string): void {
  if (!tenantId) throw new Error('enterTenant: tenantId vuoto');
  tenantContextStore.enterWith({ tenantId });
}

/** Variante che setta context completo (tenantId + slug + status). */
export function setTenantContext(ctx: TenantContext): void {
  if (!ctx?.tenantId) throw new Error('setTenantContext: tenantId vuoto');
  tenantContextStore.enterWith({
    tenantId: ctx.tenantId,
    tenantSlug: ctx.tenantSlug,
    tenantStatus: ctx.tenantStatus,
  });
}

/**
 * Ritorna l'oggetto AsyncLocalStorage sottostante. Solo per usi avanzati
 * (es. test che vogliono controllare il ciclo di vita). I caller normali
 * dovrebbero usare runWithTenant/setTenantContext/getCurrentTenant.
 */
export function _internalGetStorage() {
  return tenantContextStore;
}
