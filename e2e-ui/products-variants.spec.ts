import { test, expect, Page } from '@playwright/test';

/**
 * Test UI end-to-end per i fix prodotti/varianti + UX gestionale.
 * Richiede lo stack dev attivo (vedi playwright.config.ts).
 *
 * I selettori sono "resilienti": usano testi/etichette italiane introdotte dai
 * fix, così restano validi anche se cambiano classi CSS o ordine DOM.
 */

const EMAIL = process.env.E2E_EMAIL || 'admin@demo.local';
const PASSWORD = process.env.E2E_PASSWORD || 'Password123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
  // Il campo password può essere un input type=password senza label esplicita
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /accedi|login|entra/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|home|products|main)?/, { timeout: 15_000 });
}

test.describe('Prodotti & Varianti', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('la lista prodotti si popola al primo caricamento (no schermo vuoto)', async ({ page }) => {
    await page.goto('/products');
    // Niente "errore caricamento" e la tabella mostra righe o lo stato vuoto esplicito
    await expect(page.getByText(/errore nel caricamento/i)).toHaveCount(0);
    await expect(page.locator('.p-datatable, table')).toBeVisible({ timeout: 15_000 });
  });

  test('il wizard nuovo prodotto mostra i campi variante corretti', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /nuovo prodotto/i }).click();

    // Step 1: info base — il prezzo deve selezionarsi al focus (highlightOnFocus)
    await page.getByLabel(/SKU/i).first().fill(`E2E-${Date.now()}`);
    await page.getByLabel(/Nome Prodotto/i).first().fill('Prodotto E2E Variabile');
    // Imposta prezzo
    const priceInput = page.locator('#price input, #price');
    await priceInput.first().click();
    await priceInput.first().fill('29,90');

    await page.getByRole('button', { name: /crea prodotto/i }).click();

    // Step Varianti
    await page.getByRole('button', { name: /nuova variante|crea prima variante/i }).first().click();

    // I label rinominati e i nuovi campi devono essere presenti
    await expect(page.getByText('Costo aggiuntivo (+/-)')).toBeVisible();
    await expect(page.getByText('Prezzo aggiuntivo (+/-)')).toBeVisible();
    await expect(page.getByText(/Quantità disponibile \(Web\)/i)).toBeVisible();
    await expect(page.getByText('Caratteristiche Fisiche')).toBeVisible();
    await expect(page.getByText(/Trascina qui l'immagine/i)).toBeVisible();
    // Niente "Delta" nei label
    await expect(page.getByText('Delta Prezzo')).toHaveCount(0);
    await expect(page.getByText('Delta Costo')).toHaveCount(0);
  });

  test('una variante senza misure si salva senza errore "in codice"', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /nuovo prodotto/i }).click();
    await page.getByLabel(/SKU/i).first().fill(`E2E-NM-${Date.now()}`);
    await page.getByLabel(/Nome Prodotto/i).first().fill('Prodotto E2E senza misure');
    const priceInput = page.locator('#price input, #price').first();
    await priceInput.click();
    await priceInput.fill('10,00');
    await page.getByRole('button', { name: /crea prodotto/i }).click();

    await page.getByRole('button', { name: /nuova variante|crea prima variante/i }).first().click();
    await page.getByLabel('SKU *').fill(`E2E-NM-${Date.now()}-V`);
    await page.getByLabel('Nome *').fill('Variante Rossa');
    // NON compiliamo peso/dimensioni
    await page.getByRole('button', { name: /^crea$/i }).click();

    // Deve comparire il toast di successo, NON un JSON/errore grezzo
    await expect(page.getByText(/variante creata/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\{.*"/)).toHaveCount(0); // nessun JSON grezzo a video
  });

  test('la modifica prodotto consente categorie multiple (TreeSelect)', async ({ page }) => {
    await page.goto('/products');
    // Apri il primo prodotto in modifica
    await page.locator('.p-datatable tbody tr').first().click();
    // Il dialog di modifica mostra il selettore multi-categoria
    await expect(page.getByText('Categorie')).toBeVisible();
    await expect(
      page.getByText(/Puoi assegnare più categorie e sottocategorie/i)
    ).toBeVisible();
  });
});

test.describe('Notifiche, banner, impostazioni', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('le credenziali WooCommerce salvate mostrano lo stato configurato', async ({ page }) => {
    await page.goto('/settings/wordpress');
    // Quando già configurato: tag "Configurato" e placeholder a pallini
    const configuredTag = page.getByText('Configurato', { exact: true });
    if (await configuredTag.count()) {
      await expect(page.getByPlaceholder(/•+.*già salvata/i)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /testa connessione/i })).toBeVisible();
  });

  test('il banner limite magazzino NON è mostrato globalmente', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/limite di .*magazzini/i)).toHaveCount(0);
  });
});
