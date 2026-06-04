/**
 * Sweep diagnostico: logga come admin demo, visita ogni route dell'ERP e
 * raccoglie errori console + richieste di rete fallite (>=400). Stampa un report.
 *
 *   npx tsx e2e/sweep.ts
 */
import { chromium } from '@playwright/test';

const ERP = process.env.E2E_ERP_URL || 'http://localhost:5273';
const API = process.env.E2E_API_URL || 'http://localhost:4000';

const ROUTES = [
  '/', '/products', '/product-categories', '/warehouses', '/inventory',
  '/materials', '/orders', '/invoices', '/ddt', '/operation-types',
  '/production-orders', '/mrp/capacity', '/suppliers', '/purchase-orders',
  '/goods-receipts', '/logistics', '/customers', '/pricelists', '/employees',
  '/tasks', '/accounting', '/analytics', '/reports', '/calendar',
  '/notifications', '/wordpress', '/settings/team', '/settings/billing', '/settings',
];

// Endpoint noti che possono restituire errori "attesi" e non vanno segnalati.
const IGNORE_REQ = [/\/notifications\/unread-count/];

async function main() {
  // 1) login via API
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ecommerceerp.com', password: 'admin123' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('Login fallito: ' + JSON.stringify(json));
  const token = json.data.token;
  const refreshToken = json.data.refreshToken;

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Inietta il token prima di ogni navigazione.
  await page.addInitScript(
    ([t, r]) => {
      localStorage.setItem('token', t as string);
      if (r) localStorage.setItem('refreshToken', r as string);
    },
    [token, refreshToken]
  );

  const report: Record<string, { consoleErrors: string[]; failedRequests: string[]; finalUrl: string }> = {};

  for (const route of ROUTES) {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    };
    const onResponse = (resp: any) => {
      const url = resp.url();
      if (resp.status() >= 400 && url.includes('/api/') && !IGNORE_REQ.some((re) => re.test(url))) {
        failedRequests.push(`[${resp.status()}] ${resp.request().method()} ${url.replace(API, '')}`);
      }
    };
    page.on('console', onConsole);
    page.on('response', onResponse);

    try {
      await page.goto(ERP + route, { waitUntil: 'networkidle', timeout: 25_000 });
    } catch (e) {
      consoleErrors.push('NAV_ERROR: ' + (e as Error).message.slice(0, 120));
    }
    await page.waitForTimeout(800);

    page.off('console', onConsole);
    page.off('response', onResponse);

    report[route] = {
      consoleErrors: [...new Set(consoleErrors)],
      failedRequests: [...new Set(failedRequests)],
      finalUrl: page.url().replace(ERP, ''),
    };
  }

  await browser.close();

  // Report
  let clean = 0;
  console.log('\n================ SWEEP REPORT ================\n');
  for (const route of ROUTES) {
    const r = report[route];
    const issues = r.consoleErrors.length + r.failedRequests.length;
    const redirected = r.finalUrl !== route && !(route === '/' && r.finalUrl === '/');
    if (issues === 0 && !redirected) {
      clean++;
      console.log(`✅ ${route}`);
      continue;
    }
    console.log(`❌ ${route}${redirected ? `  →  redirect to ${r.finalUrl}` : ''}`);
    for (const f of r.failedRequests) console.log(`     REQ ${f}`);
    for (const c of r.consoleErrors) console.log(`     ERR ${c}`);
  }
  console.log(`\n${clean}/${ROUTES.length} route pulite\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
