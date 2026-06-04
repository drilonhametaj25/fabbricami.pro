import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config per l'ambiente dev2 (porte dedicate).
 * Presuppone che backend (4000), ERP (5273) e MailHog (8027) siano già avviati:
 *   docker compose -f docker-compose.dev2.yml up -d
 *   + i tre processi dev (vedi project_dev2_environment in memoria / README dev).
 *
 * Override possibili via env: E2E_ERP_URL, E2E_API_URL, E2E_MAILHOG_URL.
 */
export const ERP_URL = process.env.E2E_ERP_URL || 'http://localhost:5273';
export const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';
export const MAILHOG_URL = process.env.E2E_MAILHOG_URL || 'http://localhost:8027';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  // Stato condiviso sul backend (un tenant per run) → serializza.
  fullyParallel: false,
  workers: 1,
  // In dev il backend gira con tsx watch e può riavviarsi a metà run: 1 retry
  // assorbe i blip transitori senza mascherare bug reali (che falliscono 2 volte).
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: ERP_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
