import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { API_URL } from './playwright.config';

/**
 * CRUD reale dei moduli ERP via API (account demo). In particolare verifica il
 * nested-create di child models (purchase_order_items) che falliva perché il
 * middleware tenant-isolation non iniettava tenantId nei nested write
 * (`items: { create: [...] }`) → fix injectNestedTenant in config/database.ts.
 */
let ctx: APIRequestContext;
let auth: Record<string, string>;
let userId: string;
const S = Date.now().toString(36).toUpperCase();

test.beforeAll(async () => {
  ctx = await pwRequest.newContext({ baseURL: API_URL });
  const login = await ctx.post('/api/v1/auth/login', {
    data: { email: 'admin@ecommerceerp.com', password: 'admin123' },
  });
  const body = (await login.json()).data;
  auth = { Authorization: `Bearer ${body.token}` };
  userId = body.user.id;
});

test.afterAll(async () => {
  await ctx.dispose();
});

async function create(path: string, data: any) {
  const res = await ctx.post(`/api/v1/${path}`, { headers: auth, data });
  return { status: res.status(), body: await res.json() };
}

test('create base entities (product, customer, supplier, warehouse, material, task)', async () => {
  expect((await create('products', { sku: `P-${S}`, name: 'Prod', type: 'SIMPLE', price: 10, cost: 5 })).status).toBe(201);
  expect((await create('customers', { type: 'B2C', firstName: 'C', lastName: S, email: `c${S}@e2e.test` })).status).toBe(201);
  expect((await create('materials', { sku: `M-${S}`, name: 'Mat', unit: 'kg', cost: 3.5 })).status).toBe(201);
  expect((await create('tasks', { title: `T-${S}`, createdById: userId })).status).toBe(201);
  // Warehouse: 201 se sotto il limite del piano, 403 se il limite è raggiunto
  // (il gating del piano è atteso e corretto).
  expect([201, 403]).toContain((await create('warehouses', { code: `WH${S.slice(-5)}`, name: 'WH' })).status);
});

test('purchase order con items (nested-create child + tenantId)', async () => {
  const sup = await create('suppliers', { code: `SUP${S.slice(-5)}`, businessName: `Supplier ${S}` });
  expect(sup.status).toBe(201);
  const mat = await create('materials', { sku: `MX-${S}`, name: 'MatPO', unit: 'kg', cost: 2 });
  expect(mat.status).toBe(201);

  const po = await create('purchase-orders', {
    supplierId: sup.body.data.id,
    orderType: 'MATERIAL',
    items: [{ materialId: mat.body.data.id, description: 'riga', quantity: 5, unitPrice: 10 }],
  });
  expect(po.status).toBe(201);
  expect(po.body.data.id).toBeTruthy();
  expect(po.body.data.tenantId).toBeTruthy();
  // L'ordine ha almeno una riga creata.
  const detail = await ctx.get(`/api/v1/purchase-orders/${po.body.data.id}`, { headers: auth });
  const items = (await detail.json()).data.items;
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].tenantId).toBe(po.body.data.tenantId);
});
