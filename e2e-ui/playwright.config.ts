import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright per i test UI del gestionale ERP (Vue 3 + PrimeVue).
 *
 * Prerequisiti per l'esecuzione (NON parte da sola: serve lo stack dev attivo):
 *   1. Postgres + Redis attivi (es. `npm run docker:up` o servizi locali)
 *   2. Backend:  `npm run dev:server`  (porta 3000)
 *   3. Frontend: `npm run dev:client`  (porta 5173)
 *   4. Un utente di test esistente (ADMIN/MANAGER) sul tenant di sviluppo.
 *
 * Variabili d'ambiente:
 *   E2E_BASE_URL  (default http://localhost:5173)
 *   E2E_EMAIL     email utente di test
 *   E2E_PASSWORD  password utente di test
 *
 * Esecuzione:
 *   npx playwright test --config e2e-ui/playwright.config.ts
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
