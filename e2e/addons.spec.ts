import { test, expect } from '@playwright/test';
import { makeTestUser, registerVerifyAndOnboard } from './helpers';

/**
 * Add-on: attivazione di un componente RESOURCE_LIMIT (+1 magazzino) e verifica
 * che il limite effettivo della risorsa aumenti nella UI di fatturazione.
 */
test.describe('Add-ons', () => {
  test('attivare "+1 Magazzino" aumenta il limite magazzini da 1 a 2', async ({ page, request }) => {
    const user = makeTestUser('addon');
    await registerVerifyAndOnboard(page, request, user, 'STARTER');

    await page.goto('/settings/billing');

    // Stato iniziale: piano Starter → 1 magazzino.
    const addonCard = page.locator(".addon-card[data-addon='EXTRA_WAREHOUSE']");
    await expect(addonCard).toBeVisible();
    await expect(addonCard.locator('.addon-btn')).toHaveText(/Aggiungi/);

    // Attiva l'add-on.
    await addonCard.locator('.addon-btn').click();
    await expect(addonCard.locator('.addon-btn')).toHaveText(/Rimuovi/, { timeout: 15_000 });
    await expect(addonCard).toHaveClass(/active/);

    // Il limite magazzini effettivo è ora 2 (1 piano + 1 add-on).
    // La card "Utilizzo Risorse" dei magazzini mostra "/ 2".
    await page.reload();
    const usageBlock = page.locator('.usage-card', { hasText: 'Magazzini' });
    await expect(usageBlock).toContainText('2');

    // Rimozione: torna a 1.
    await addonCard.locator('.addon-btn').click();
    await expect(addonCard.locator('.addon-btn')).toHaveText(/Aggiungi/, { timeout: 15_000 });
  });
});
