import { test, expect, request as pwRequest } from '@playwright/test';
import { API_URL } from './playwright.config';

/**
 * API shop pubblica (multi-tenant). Regressione del bug per cui il tenant
 * context, impostato con enterWith() in un hook addHook('preHandler'), non
 * propagava all'handler → ogni endpoint shop restituiva 0 risultati (sentinel).
 * Ora il middleware avvolge la request con runWithTenantContext (als.run).
 *
 * Richiede il tenant demo 'default' seedato con prodotti web-attivi e categorie.
 */
const TENANT = { 'X-Tenant-Slug': 'default' };

test.describe('Shop public API', () => {
  test('prodotti, categorie e dettaglio risolti per tenant', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_URL, extraHTTPHeaders: TENANT });

    const prods = await ctx.get('/api/v1/shop/products?limit=5');
    expect(prods.ok()).toBeTruthy();
    const prodData = (await prods.json()).data;
    expect(prodData.items.length).toBeGreaterThan(0);

    const cats = await ctx.get('/api/v1/shop/categories');
    expect((await cats.json()).data.length).toBeGreaterThan(0);

    const slug = prodData.items[0].slug || prodData.items[0].webSlug || prodData.items[0].id;
    const detail = await ctx.get(`/api/v1/shop/products/${slug}`);
    expect(detail.ok()).toBeTruthy();

    await ctx.dispose();
  });

  test('senza tenant header → 400 TENANT_REQUIRED (no data leak)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_URL });
    const res = await ctx.get('/api/v1/shop/products');
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test('flusso cliente: registrazione → login → carrello', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_URL, extraHTTPHeaders: TENANT });
    const email = `cliente.${Date.now().toString(36)}@e2e.test`;
    const sessionId = `sess-${Date.now().toString(36)}`;

    const reg = await ctx.post('/api/v1/shop/auth/register', {
      data: { email, password: 'Password123!', firstName: 'Mario', lastName: 'Cliente' },
    });
    expect(reg.status()).toBe(201);

    const login = await ctx.post('/api/v1/shop/auth/login', {
      data: { email, password: 'Password123!' },
    });
    expect(login.ok()).toBeTruthy();
    const token = (await login.json()).data.token;
    expect(token).toBeTruthy();

    const productId = (await (await ctx.get('/api/v1/shop/products?limit=1')).json()).data.items[0].id;

    const add = await ctx.post('/api/v1/shop/cart/items', {
      headers: { 'X-Session-Id': sessionId },
      data: { productId, quantity: 2 },
    });
    expect(add.ok()).toBeTruthy();

    const cart = await ctx.get('/api/v1/shop/cart', { headers: { 'X-Session-Id': sessionId } });
    const cartData = (await cart.json()).data;
    const count = cartData.items?.length ?? cartData.itemCount ?? 0;
    expect(count).toBeGreaterThan(0);

    await ctx.dispose();
  });
});
