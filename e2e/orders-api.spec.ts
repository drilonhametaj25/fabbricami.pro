import { test, expect, request as pwRequest } from '@playwright/test';
import { API_URL } from './playwright.config';

/**
 * Regressione write-path: la creazione ordine senza `status` esplicito deve
 * riuscire (lo schema defaultava a 'DRAFT', valore assente nell'enum Prisma
 * OrderStatus → ogni create falliva). Esercita anche l'iniezione di tenantId
 * sul child model order_items via middleware.
 *
 * Usa l'account demo (admin@ecommerceerp.com) che ha clienti e prodotti seedati.
 */
test('creazione ordine + item via API (regressione DRAFT / tenantId child)', async () => {
  const ctx = await pwRequest.newContext({ baseURL: API_URL });

  const login = await ctx.post('/api/v1/auth/login', {
    data: { email: 'admin@ecommerceerp.com', password: 'admin123' },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.token;
  const auth = { Authorization: `Bearer ${token}` };

  const custRes = await ctx.get('/api/v1/customers?limit=1', { headers: auth });
  const customers = (await custRes.json()).data.items;
  expect(customers.length).toBeGreaterThan(0);
  const customerId = customers[0].id;

  const prodRes = await ctx.get('/api/v1/products?limit=1', { headers: auth });
  const productId = (await prodRes.json()).data.items[0].id;

  // Crea ordine SENZA status → deve defaultare a PENDING e riuscire.
  const orderRes = await ctx.post('/api/v1/orders', {
    headers: auth,
    data: { customerId, source: 'MANUAL' },
  });
  expect(orderRes.status()).toBe(201);
  const order = (await orderRes.json()).data;
  expect(order.status).toBe('PENDING');
  expect(order.tenantId).toBeTruthy();

  // Aggiunge un item: tenantId iniettato dal middleware sul child order_items.
  const itemRes = await ctx.post(`/api/v1/orders/${order.id}/items`, {
    headers: auth,
    data: { productId, quantity: 2, unitPrice: 50 },
  });
  expect(itemRes.ok()).toBeTruthy();
  const item = (await itemRes.json()).data;
  expect(item.tenantId).toBe(order.tenantId);

  await ctx.dispose();
});
