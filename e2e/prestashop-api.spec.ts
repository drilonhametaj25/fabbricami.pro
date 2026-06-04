import { test, expect, request as pwRequest } from '@playwright/test';
import { API_URL } from './playwright.config';

/**
 * Endpoint integrazione PrestaShop (per-tenant). Verifica settings (salvataggio
 * con apiKey cifrata, mai esposta) e test-connection (fallimento graceful su URL
 * non raggiungibile, senza crash).
 */
test('PrestaShop settings + test-connection (account demo)', async () => {
  const ctx = await pwRequest.newContext({ baseURL: API_URL });
  const login = await ctx.post('/api/v1/auth/login', {
    data: { email: 'admin@ecommerceerp.com', password: 'admin123' },
  });
  const token = (await login.json()).data.token;
  const auth = { Authorization: `Bearer ${token}` };

  // Salva configurazione
  const save = await ctx.post('/api/v1/prestashop/settings', {
    headers: auth,
    data: { apiUrl: 'https://demo-presta.test', apiKey: 'WSKEY-TEST-123', syncEnabled: true },
  });
  expect(save.ok()).toBeTruthy();
  const saved = (await save.json()).data;
  expect(saved.isConfigured).toBe(true);
  expect(saved.hasApiKey).toBe(true);
  // La apiKey in chiaro non deve mai comparire nella risposta.
  expect(JSON.stringify(saved)).not.toContain('WSKEY-TEST-123');

  // Test connessione verso URL non raggiungibile → fallimento graceful.
  const testConn = await ctx.post('/api/v1/prestashop/test-connection', { headers: auth, data: {} });
  expect(testConn.status()).toBe(200);
  expect((await testConn.json()).data.ok).toBe(false);

  // Log endpoint risponde.
  const logs = await ctx.get('/api/v1/prestashop/sync-logs', { headers: auth });
  expect(logs.ok()).toBeTruthy();

  await ctx.dispose();
});
