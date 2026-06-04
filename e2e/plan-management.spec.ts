import { test, expect } from '@playwright/test';
import { makeTestUser, registerVerifyAndOnboard } from './helpers';

/**
 * Upgrade / downgrade di piano in modalità billing dev/mock (senza Stripe).
 * Verifica che il cambio piano sia applicato e riflesso nella UI di fatturazione.
 */
test.describe('Plan management (mock billing)', () => {
  test('upgrade Starter → Professional e downgrade → Starter', async ({ page, request }) => {
    const user = makeTestUser('plan');
    await registerVerifyAndOnboard(page, request, user, 'STARTER');

    await page.goto('/settings/billing');
    await expect(page.getByRole('heading', { name: 'Starter', level: 2 })).toBeVisible();

    // --- Upgrade a Professional ---
    await page.getByRole('button', { name: 'Passa a Professional' }).click();
    await page.getByRole('button', { name: 'Conferma Cambio' }).click();
    await expect(page).toHaveURL(/upgraded=PRO/, { timeout: 20_000 });

    await page.goto('/settings/billing');
    await expect(page.getByRole('heading', { name: 'Professional', level: 2 })).toBeVisible();

    // --- Downgrade a Starter ---
    await page.getByRole('button', { name: 'Downgrade a Starter' }).click();
    await page.getByRole('button', { name: 'Conferma Cambio' }).click();
    await expect(page).toHaveURL(/upgraded=STARTER/, { timeout: 20_000 });

    await page.goto('/settings/billing');
    await expect(page.getByRole('heading', { name: 'Starter', level: 2 })).toBeVisible();
  });
});
