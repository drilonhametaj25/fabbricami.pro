import { APIRequestContext, expect, Page } from '@playwright/test';
import { API_URL, MAILHOG_URL } from './playwright.config';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}

/** Genera un utente di test univoco per il run. */
export function makeTestUser(prefix = 'e2e'): TestUser {
  const stamp = Date.now().toString(36);
  return {
    email: `${prefix}.${stamp}@e2e.test`,
    password: 'Password123!',
    firstName: 'E2E',
    lastName: 'Tester',
    companyName: `E2E Co ${stamp}`,
  };
}

/** Recupera il token di verifica email più recente per `toEmail` da MailHog. */
export async function fetchVerificationToken(
  request: APIRequestContext,
  toEmail: string,
  attempts = 10
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const res = await request.get(`${MAILHOG_URL}/api/v2/messages`);
    if (res.ok()) {
      const data = await res.json();
      const msg = (data.items || []).find((m: any) =>
        (m.Content?.Headers?.To || []).some((t: string) => t.includes(toEmail))
      );
      if (msg) {
        const body = String(msg.Content?.Body || '')
          .replace(/=\r?\n/g, '')
          .replace(/=3D/g, '=');
        const m = body.match(/verify-email\?token=([A-Za-z0-9]+)/);
        if (m) return m[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nessuna email di verifica trovata per ${toEmail} su MailHog`);
}

/**
 * Registra un tenant via UI, verifica l'email (token da MailHog) e completa
 * l'onboarding fino alla dashboard. Ritorna l'utente creato.
 */
export async function registerVerifyAndOnboard(
  page: Page,
  request: APIRequestContext,
  user: TestUser,
  plan: 'STARTER' | 'PRO' | 'BUSINESS' = 'STARTER'
): Promise<void> {
  // --- Registrazione ---
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Nome *', exact: true }).fill(user.firstName);
  await page.getByRole('textbox', { name: 'Cognome *' }).fill(user.lastName);
  await page.getByRole('textbox', { name: 'Email *' }).fill(user.email);
  await page.getByRole('textbox', { name: 'Nome Azienda *' }).fill(user.companyName);
  await page.locator('#password').getByRole('textbox').fill(user.password);
  await page.locator('#confirmPassword').getByRole('textbox').fill(user.password);
  await page.locator(`#plan-${plan}`).click();
  await page.getByRole('checkbox').first().setChecked(true);
  await page.getByRole('button', { name: 'Crea Account' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

  // --- Verifica email (token da MailHog) ---
  const token = await fetchVerificationToken(request, user.email);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page).toHaveURL(/\/onboarding\/company-settings/, { timeout: 20_000 });

  // --- Onboarding: dati azienda ---
  await page.getByRole('textbox', { name: 'Ragione Sociale *' }).fill(user.companyName);
  await page.getByRole('textbox', { name: 'Partita IVA *' }).fill('IT01234567890');
  await page.getByRole('textbox', { name: 'Indirizzo *' }).fill('Via Roma 1');
  await page.getByRole('textbox', { name: 'Comune *' }).fill('Milano');
  await page.getByRole('textbox', { name: 'Provincia *' }).fill('MI');
  await page.getByRole('textbox', { name: 'CAP *' }).fill('20100');
  await page.getByRole('button', { name: 'Salva e Continua' }).click();
  await expect(page).toHaveURL(/\/onboarding\/setup-billing/, { timeout: 20_000 });

  // --- Onboarding: trial ---
  await page.getByRole('button', { name: 'Inizia Prova Gratuita' }).click();
  await expect(page).toHaveURL(/\/onboarding\/wordpress-integration/, { timeout: 20_000 });

  // --- Onboarding: salta WordPress ---
  await page.getByRole('button', { name: /Salter/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/create-warehouse/, { timeout: 20_000 });

  // --- Onboarding: crea magazzino ---
  await page.getByRole('textbox', { name: 'Nome Magazzino *' }).fill('Magazzino Principale');
  await page.getByRole('textbox', { name: 'Codice *' }).fill('MAIN');
  await page.getByRole('button', { name: 'Crea Magazzino' }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 20_000 });
}
