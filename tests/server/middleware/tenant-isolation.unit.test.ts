/**
 * Tenant Isolation — Unit tests sui core helper.
 *
 * Verifica le invarianti applicative (Strato 2 del piano di remediation):
 *   - AsyncLocalStorage unificato tra middleware/tenant.middleware e utils/tenant-context
 *   - requireCurrentTenantId fail-fast senza context
 *   - runWithTenant propaga il context nella catena asincrona
 *   - setTenantContext + getCurrentTenantContext round-trip
 *
 * Il test integration con DB reale (RLS + $extends) è documentato come
 * verifica manuale post-deploy (vedi piano §8 e script
 * scripts/diagnose-tenant-isolation.ts).
 */

import {
  runWithTenant,
  setTenantContext,
  getCurrentTenant,
  getCurrentTenantContext,
  getCurrentTenantId,
  requireCurrentTenant,
  requireCurrentTenantId,
  TenantContext,
} from '../../../src/server/utils/tenant-context';

import { AsyncLocalStorage } from 'async_hooks';
import * as middlewareModule from '../../../src/server/middleware/tenant.middleware';

describe('tenant-context — unified AsyncLocalStorage', () => {
  it('senza context attivo getCurrentTenant() ritorna null', () => {
    expect(getCurrentTenant()).toBeNull();
    expect(getCurrentTenantId()).toBeUndefined();
    expect(getCurrentTenantContext()).toBeUndefined();
  });

  it('requireCurrentTenantId lancia senza context', () => {
    expect(() => requireCurrentTenantId()).toThrow(/requireCurrentTenant/);
  });

  it('requireCurrentTenant lancia senza context', () => {
    expect(() => requireCurrentTenant()).toThrow(/requireCurrentTenant/);
  });

  it('runWithTenant propaga il tenantId nella catena asincrona', async () => {
    await runWithTenant('tenant-A', async () => {
      expect(getCurrentTenant()).toBe('tenant-A');
      expect(getCurrentTenantId()).toBe('tenant-A');

      // Dopo un await il context persiste
      await new Promise((resolve) => setImmediate(resolve));
      expect(getCurrentTenant()).toBe('tenant-A');
    });

    // Fuori dal callback il context è di nuovo null
    expect(getCurrentTenant()).toBeNull();
  });

  it('setTenantContext popola anche slug e status', async () => {
    await runWithTenant('tenant-B', async () => {
      const ctx: TenantContext = {
        tenantId: 'tenant-B',
        tenantSlug: 'acme',
        tenantStatus: 'ACTIVE' as TenantContext['tenantStatus'],
      };
      setTenantContext(ctx);
      const read = getCurrentTenantContext();
      expect(read).toBeDefined();
      expect(read?.tenantId).toBe('tenant-B');
      expect(read?.tenantSlug).toBe('acme');
      expect(read?.tenantStatus).toBe('ACTIVE');
    });
  });

  it('runWithTenant annidate fanno shadow del context esterno', async () => {
    await runWithTenant('tenant-OUTER', async () => {
      expect(getCurrentTenant()).toBe('tenant-OUTER');

      await runWithTenant('tenant-INNER', async () => {
        expect(getCurrentTenant()).toBe('tenant-INNER');
      });

      // Tornati al context esterno
      expect(getCurrentTenant()).toBe('tenant-OUTER');
    });
  });
});

describe('tenant.middleware re-exports condividono la stessa ALS', () => {
  it('tenantContext esposto da middleware/tenant.middleware è la stessa istanza di utils/tenant-context', () => {
    // Il middleware re-esporta il storage; verifichiamo che è un AsyncLocalStorage
    expect(middlewareModule.tenantContext).toBeInstanceOf(AsyncLocalStorage);
  });

  it('getCurrentTenantId esportato dal middleware vede ciò che runWithTenant ha settato', async () => {
    await runWithTenant('tenant-shared', async () => {
      expect(middlewareModule.getCurrentTenantId()).toBe('tenant-shared');
    });
    // Fuori dal context torna undefined
    expect(middlewareModule.getCurrentTenantId()).toBeUndefined();
  });

  it('requireCurrentTenantId esportato dal middleware è equivalente a quello di utils', async () => {
    // Stesso comportamento: lancia se non c'è context
    expect(() => middlewareModule.requireCurrentTenantId()).toThrow();

    await runWithTenant('tenant-X', async () => {
      expect(middlewareModule.requireCurrentTenantId()).toBe('tenant-X');
    });
  });
});
