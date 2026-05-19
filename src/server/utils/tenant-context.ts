import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context tenant propagato lungo lo stack async tramite AsyncLocalStorage.
 *
 * Perché esiste: alcuni servizi (es. WordPressService) hanno ~50 metodi
 * pubblici che internamente fanno HTTP calls. Propagare `tenantId` come arg su
 * ogni metodo + tutti i callsite sarebbe un refactor invasivo per centinaia di
 * call site. AsyncLocalStorage permette di settare il tenant ai bordi
 * (middleware/route handler/job processor) e leggerlo internamente nei servizi
 * senza modificare le firme.
 *
 * Uso ai bordi:
 *   await runWithTenant(tenantId, async () => {
 *     await wordpressService.syncProductToWooCommerce(productId);
 *   });
 *
 * Uso nei servizi:
 *   const tenantId = requireCurrentTenant();
 *   const cfg = await wordpressSettingsService.getSettings(tenantId);
 */

interface TenantStore {
  tenantId: string;
}

const tenantContext = new AsyncLocalStorage<TenantStore>();

/**
 * Esegue `fn` con il tenantId disponibile via `getCurrentTenant()` /
 * `requireCurrentTenant()` in qualsiasi punto async raggiungibile.
 *
 * NB: tutto ciò che viene awaitato dentro `fn` mantiene il context; le Promise
 * detached (es. `setImmediate`, `setTimeout` senza await) NON lo ereditano —
 * usa `runWithTenant` di nuovo se serve.
 */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> | T {
  return tenantContext.run({ tenantId }, fn);
}

/**
 * Ritorna il tenantId corrente, o `null` se non siamo dentro a un
 * `runWithTenant`. Da preferire `requireCurrentTenant()` quando il tenantId è
 * obbligatorio per la business logic, perché fa fail-fast.
 */
export function getCurrentTenant(): string | null {
  return tenantContext.getStore()?.tenantId ?? null;
}

/**
 * Come `getCurrentTenant()` ma lancia se il context non è settato. Usalo nei
 * servizi multi-tenant per essere sicuro che un caller scoordinato non finisca
 * a leakare dati cross-tenant.
 */
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

/**
 * Imposta il tenant nel context corrente per tutto il resto della catena
 * asincrona, SENZA richiedere una callback `.run()`. Più conveniente di
 * `runWithTenant` quando il setup avviene in un hook (es. Fastify
 * `onRequest`/`preHandler`) e l'handler viene invocato dopo.
 *
 * Usa `AsyncLocalStorage.enterWith()`: il context dura fino alla fine
 * dell'execution asincrona corrente (per Fastify: fino al completamento
 * della richiesta). NB: NON nidificare con `runWithTenant` dentro lo stesso
 * stack, altrimenti il context interno fa shadow di quello esterno.
 */
export function enterTenant(tenantId: string): void {
  if (!tenantId) {
    throw new Error('enterTenant: tenantId vuoto');
  }
  tenantContext.enterWith({ tenantId });
}
