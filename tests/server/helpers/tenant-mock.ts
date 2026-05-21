/**
 * Helper di mock per il tenant context nei test unit.
 *
 * Dopo il fix isolamento tenant (cfr. piano remediation §2), le raw query e i
 * job background richiedono `requireCurrentTenantId()` settato. I test unit
 * non hanno un AsyncLocalStorage attivo: questo helper mocka i moduli di
 * context per ritornare un tenantId fake.
 *
 * Uso (TOP del file di test, prima di altri imports che toccano il modulo):
 *   import './path/to/helpers/tenant-mock'; // side-effect: jest.mock
 */

const FAKE_TENANT_ID = '00000000-0000-0000-0000-000000000001';

jest.mock('@/server/utils/tenant-context', () => ({
  __esModule: true,
  runWithTenant: (_id: string, fn: any) => fn(),
  runWithTenantContext: (_ctx: any, fn: any) => fn(),
  getCurrentTenant: () => FAKE_TENANT_ID,
  getCurrentTenantContext: () => ({
    tenantId: FAKE_TENANT_ID,
    tenantSlug: 'test',
    tenantStatus: 'ACTIVE',
  }),
  getCurrentTenantId: () => FAKE_TENANT_ID,
  requireCurrentTenant: () => FAKE_TENANT_ID,
  requireCurrentTenantId: () => FAKE_TENANT_ID,
  setTenantContext: jest.fn(),
  enterTenant: jest.fn(),
  _internalGetStorage: () => ({
    getStore: () => ({ tenantId: FAKE_TENANT_ID, tenantSlug: 'test', tenantStatus: 'ACTIVE' }),
    run: (_ctx: any, fn: any) => fn(),
    enterWith: jest.fn(),
  }),
}));

jest.mock('@/server/middleware/tenant.middleware', () => {
  const actual = jest.requireActual('@/server/middleware/tenant.middleware');
  return {
    ...actual,
    getCurrentTenantId: () => FAKE_TENANT_ID,
    requireCurrentTenantId: () => FAKE_TENANT_ID,
    getCurrentTenant: () => ({
      tenantId: FAKE_TENANT_ID,
      tenantSlug: 'test',
      tenantStatus: 'ACTIVE',
    }),
  };
});

// Mock anche del fanout: nei test eseguiamo la callback UNA VOLTA con un tenant fake
jest.mock('@/server/utils/tenant-fanout', () => ({
  __esModule: true,
  forEachActiveTenant: async (fn: (tenantId: string, tenantSlug: string) => Promise<void>) => {
    await fn(FAKE_TENANT_ID, 'test');
  },
}));

export const TEST_TENANT_ID = FAKE_TENANT_ID;
