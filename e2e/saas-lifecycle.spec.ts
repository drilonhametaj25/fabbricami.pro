import { test, expect } from '@playwright/test';
import { makeTestUser, registerVerifyAndOnboard, fetchVerificationToken } from './helpers';

/**
 * Ciclo di vita SaaS completo guidato da browser reale:
 * registrazione → verifica email → onboarding → dashboard.
 *
 * Copre i bug di fondazione risolti:
 *  - 43 child models senza tenantId (ogni create runtime falliva)
 *  - login/verify bloccati dal sentinel del tenant-middleware (enterUnscoped)
 *  - registrazione resiliente al fallimento SMTP
 *  - validazione company-settings tollerante a campi opzionali vuoti
 */
test.describe('SaaS lifecycle', () => {
  test('registrazione → verifica → onboarding → dashboard', async ({ page, request }) => {
    const user = makeTestUser('lifecycle');

    await registerVerifyAndOnboard(page, request, user, 'STARTER');

    // Siamo in dashboard col nuovo tenant isolato (nessun dato del tenant demo).
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(user.firstName) })
    ).toBeVisible();
    await expect(page.getByText(/Trial/i).first()).toBeVisible();
  });

  test('email di verifica recapitata con link valido', async ({ page, request }) => {
    const user = makeTestUser('verify');

    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Nome *', exact: true }).fill(user.firstName);
    await page.getByRole('textbox', { name: 'Cognome *' }).fill(user.lastName);
    await page.getByRole('textbox', { name: 'Email *' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Nome Azienda *' }).fill(user.companyName);
    await page.locator('#password').getByRole('textbox').fill(user.password);
    await page.locator('#confirmPassword').getByRole('textbox').fill(user.password);
    await page.getByRole('checkbox').first().setChecked(true);
    await page.getByRole('button', { name: 'Crea Account' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    const token = await fetchVerificationToken(request, user.email);
    expect(token.length).toBeGreaterThan(20);
  });

  test('login con credenziali errate viene rifiutato', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('nonexistent@e2e.test');
    await page.locator('input[type="password"]').fill('WrongPass123!');
    await page.getByRole('button', { name: /Accedi|Login/i }).click();
    // Resta sul login (nessun redirect a dashboard).
    await expect(page).toHaveURL(/\/login/);
  });
});
