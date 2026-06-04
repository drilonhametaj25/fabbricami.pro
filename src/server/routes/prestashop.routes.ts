import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { prestashopService } from '../services/prestashop.service';
import { prestashopSettingsService } from '../services/prestashop-settings.service';

/**
 * Route integrazione PrestaShop (per-tenant, autenticate).
 * Prefix montato in index.ts: /api/v1/prestashop
 */
const prestashopRoutes: FastifyPluginAsync = async (server) => {
  const adminRoles = authorize('ADMIN', 'MANAGER');

  /** GET /prestashop/settings — config sanitizzata per la UI */
  server.get('/settings', { preHandler: [authenticate, tenantMiddleware] }, async (request, reply) => {
    const t = request as TenantRequest;
    const data = await prestashopSettingsService.getSettingsForUI(t.tenant.tenantId);
    return reply.send({ success: true, data });
  });

  /** POST /prestashop/settings — salva config (apiUrl, apiKey, flag) */
  server.post('/settings', { preHandler: [authenticate, tenantMiddleware, adminRoles] }, async (request, reply) => {
    const t = request as TenantRequest;
    const body = (request.body || {}) as Record<string, any>;
    try {
      await prestashopSettingsService.saveSettings(t.tenant.tenantId, {
        apiUrl: body.apiUrl,
        apiKey: body.apiKey, // se assente, mantiene la precedente
        syncEnabled: body.syncEnabled,
        syncInterval: body.syncInterval,
        pushProducts: body.pushProducts,
        pushInventory: body.pushInventory,
        importOrders: body.importOrders,
      });
      const data = await prestashopSettingsService.getSettingsForUI(t.tenant.tenantId);
      return reply.send({ success: true, data });
    } catch (e) {
      return reply.status(400).send({ success: false, error: e instanceof Error ? e.message : 'Errore salvataggio' });
    }
  });

  /** POST /prestashop/test-connection — test con creds salvate o fornite */
  server.post('/test-connection', { preHandler: [authenticate, tenantMiddleware] }, async (request, reply) => {
    const t = request as TenantRequest;
    const body = (request.body || {}) as { apiUrl?: string; apiKey?: string };
    const override = body.apiUrl && body.apiKey ? { apiUrl: body.apiUrl, apiKey: body.apiKey } : undefined;
    const result = await prestashopService.testConnection(t.tenant.tenantId, override);
    return reply.send({ success: result.ok, data: result, error: result.ok ? undefined : result.error });
  });

  const syncEndpoint = (
    path: string,
    fn: (tenantId: string) => Promise<unknown>
  ) =>
    server.post(path, { preHandler: [authenticate, tenantMiddleware, adminRoles] }, async (request, reply) => {
      const t = request as TenantRequest;
      try {
        const data = await fn(t.tenant.tenantId);
        return reply.send({ success: true, data });
      } catch (e) {
        return reply.status(400).send({ success: false, error: e instanceof Error ? e.message : 'Errore sync' });
      }
    });

  syncEndpoint('/sync-products', (id) => prestashopService.pushProducts(id));
  syncEndpoint('/sync-inventory', (id) => prestashopService.pushInventory(id));
  syncEndpoint('/import-orders', (id) => prestashopService.importOrders(id));
  syncEndpoint('/import-customers', (id) => prestashopService.importCustomers(id));
  syncEndpoint('/full-sync', async (id) => {
    await prestashopService.runFullSync(id);
    return { ok: true };
  });

  /** GET /prestashop/sync-logs — log recenti */
  server.get('/sync-logs', { preHandler: [authenticate, tenantMiddleware] }, async (request, reply) => {
    const t = request as TenantRequest;
    const data = await prestashopService.getRecentLogs(t.tenant.tenantId);
    return reply.send({ success: true, data });
  });
};

export default prestashopRoutes;
