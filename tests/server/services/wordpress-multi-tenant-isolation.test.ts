// Mock environment FIRST (before any service import that touches dotenv/logger)
jest.mock('@server/config/environment', () => ({
  config: {
    wordpress: { url: '', apiKey: '', webhookSecret: '' },
    isDevelopment: false,
    isProduction: false,
    logging: { level: 'info', elasticsearchNode: '' },
    redis: { host: 'localhost', port: 6379, password: '' },
  },
}));

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger (named export `logger`)
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import wordpressSettingsService from '@server/services/wordpress-settings.service';
import { runWithTenant, getCurrentTenant } from '@server/utils/tenant-context';

/**
 * Regression test per il bug "WordPress settings globali in multi-tenant".
 *
 * Prima del refactor a per-tenant config:
 *   - tutte le installazioni WP condividevano la stessa riga in
 *     `system_settings.wordpress_config` (un solo record);
 *   - se un tenant configurava le sue credenziali Woo sovrascriveva quelle di
 *     tutti gli altri tenant;
 *   - tutti gli ID esterni Woo (Product.wordpressId, Customer.wordpressId,
 *     Order.wordpressId) erano @unique globalmente, quindi due tenant non
 *     potevano avere lo stesso product ID dal loro Woo separato.
 *
 * Ora le credenziali vivono in `wordpress_tenant_config` con `tenantId @unique`,
 * e gli ID esterni hanno composite `@@unique([tenantId, X])`.
 *
 * Questo test verifica le invarianti chiave del nuovo design:
 *   1. `getSettings(tenantA)` e `getSettings(tenantB)` ritornano record
 *      separati.
 *   2. `saveSettings(tenantA, ...)` non sporca il record di tenantB.
 *   3. `getSettings(...)` ritorna `null` se il tenant non ha configurato WP
 *      (NON falsamente "configurato" tramite fallback env globali).
 *   4. AsyncLocalStorage tenant context isola correttamente i tenant tra
 *      chiamate concorrenti (no leak attraverso Promise.all).
 */
describe('WordPress multi-tenant isolation (regression)', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe('settings service', () => {
    it('returns separate configs for two different tenants', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      (prismaMock.wordPressTenantConfig.findUnique as jest.Mock).mockImplementation(
        async ({ where }: any) => {
          if (where.tenantId === tenantA) {
            return {
              id: 'cfg-a',
              tenantId: tenantA,
              url: 'https://acme.example.com',
              consumerKey: '',
              consumerSecret: '',
              webhookSecret: '',
              syncEnabled: true,
              syncInterval: 300000,
              lastSyncAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          if (where.tenantId === tenantB) {
            return {
              id: 'cfg-b',
              tenantId: tenantB,
              url: 'https://other.example.com',
              consumerKey: '',
              consumerSecret: '',
              webhookSecret: '',
              syncEnabled: false,
              syncInterval: 600000,
              lastSyncAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return null;
        }
      );

      const cfgA = await wordpressSettingsService.getSettings(tenantA);
      const cfgB = await wordpressSettingsService.getSettings(tenantB);

      expect(cfgA?.url).toBe('https://acme.example.com');
      expect(cfgA?.syncEnabled).toBe(true);

      expect(cfgB?.url).toBe('https://other.example.com');
      expect(cfgB?.syncEnabled).toBe(false);

      // Le due chiamate hanno usato `where: { tenantId: ... }` diversi:
      // nessuna chiave globale `wordpress_config` viene letta.
      const calls = (prismaMock.wordPressTenantConfig.findUnique as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toEqual({ where: { tenantId: tenantA } });
      expect(calls[1][0]).toEqual({ where: { tenantId: tenantB } });
    });

    it('returns null (NOT a falsy-but-defined config) when tenant has no WP setup', async () => {
      (prismaMock.wordPressTenantConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const cfg = await wordpressSettingsService.getSettings('tenant-fresh');

      // Critico: PRIMA del refactor, un tenant senza setup riceveva un oggetto
      // con campi vuoti ma "valido" (perché c'era fallback su env vars
      // globali). Ora deve essere esplicitamente null, così il caller sa di
      // dover skippare la sync.
      expect(cfg).toBeNull();
    });

    it('saveSettings(tenantA) non tocca le righe degli altri tenant', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      (prismaMock.wordPressTenantConfig.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.wordPressTenantConfig.upsert as jest.Mock).mockResolvedValue({} as any);

      await wordpressSettingsService.saveSettings(tenantA, {
        url: 'https://acme.example.com',
        consumerKey: 'ck_a',
        consumerSecret: 'cs_a',
        webhookSecret: 'whs_a',
        syncEnabled: true,
      });

      const upsertCalls = (prismaMock.wordPressTenantConfig.upsert as jest.Mock).mock.calls;
      expect(upsertCalls).toHaveLength(1);
      const where = upsertCalls[0][0].where;
      const create = upsertCalls[0][0].create;

      // L'upsert è scoped per tenantId, NON c'è alcuna chiave globale.
      expect(where).toEqual({ tenantId: tenantA });
      expect(create.tenantId).toBe(tenantA);
      expect(create.tenantId).not.toBe(tenantB);
    });

    it('saveSettings rifiuta tenantId vuoto invece di accettarlo come fallback globale', async () => {
      await expect(
        wordpressSettingsService.saveSettings('', { url: 'https://x' } as any)
      ).rejects.toThrow(/tenantId obbligatorio/);

      // Verifica che NON sia stata fatta alcuna scrittura.
      expect(prismaMock.wordPressTenantConfig.upsert).not.toHaveBeenCalled();
    });

    it('listTenantsWithSyncEnabled ritorna solo i tenant attivi', async () => {
      (prismaMock.wordPressTenantConfig.findMany as jest.Mock).mockResolvedValue([
        { tenantId: 'tenant-a' },
        { tenantId: 'tenant-c' },
      ] as any);

      const ids = await wordpressSettingsService.listTenantsWithSyncEnabled();

      expect(ids).toEqual(['tenant-a', 'tenant-c']);
      const callArgs = (prismaMock.wordPressTenantConfig.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where).toEqual({ syncEnabled: true });
    });
  });

  describe('tenant context (AsyncLocalStorage)', () => {
    it('isola due tenant in chiamate concorrenti tramite Promise.all', async () => {
      // Stub asincrono che ritorna il tenant corrente dopo un tick: simula un
      // metodo di service che fa una query DB e poi legge il context.
      const observeCurrentTenant = () =>
        new Promise<string | null>((resolve) => {
          // Distribuiamo le risoluzioni con setTimeout per forzare un context
          // switch del runtime tra i due tenant. Se l'isolamento ALS non
          // funziona, vedremo lo stesso valore per entrambi.
          setTimeout(() => resolve(getCurrentTenant()), 5);
        });

      const [a, b] = await Promise.all([
        runWithTenant('tenant-a', observeCurrentTenant),
        runWithTenant('tenant-b', observeCurrentTenant),
      ]);

      expect(a).toBe('tenant-a');
      expect(b).toBe('tenant-b');
    });

    it('getCurrentTenant() è null fuori da runWithTenant', () => {
      expect(getCurrentTenant()).toBeNull();
    });

    it('runWithTenant nidificato fa shadow del context esterno', async () => {
      const inner = await runWithTenant('outer', async () => {
        return runWithTenant('inner', () => getCurrentTenant());
      });
      expect(inner).toBe('inner');

      // Fuori da entrambi runWithTenant il context torna null.
      expect(getCurrentTenant()).toBeNull();
    });
  });
});
