import { prisma } from '../config/database';
import { logger } from '../config/logger';
import * as crypto from 'crypto';

// Chiave per cifratura. In produzione setta SETTINGS_ENCRYPTION_KEY a una
// stringa random >= 32 byte. Il default è solo un fallback per development e
// stampa un warning all'avvio del servizio.
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'ecommerceerp-default-key-32byte';
if (!process.env.SETTINGS_ENCRYPTION_KEY) {
  logger.warn(
    'SETTINGS_ENCRYPTION_KEY non impostata: i secret WordPress sono cifrati con la chiave di default. ' +
      'NON adatto a produzione — sovrascrivi con `openssl rand -base64 32` nel .env.'
  );
}
const IV_LENGTH = 16;

export interface WordPressSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret: string;
  syncEnabled: boolean;
  syncInterval: number;
}

export interface WordPressSettingsForUI {
  url: string;
  consumerKey: string;
  hasConsumerSecret: boolean;
  hasWebhookSecret: boolean;
  syncEnabled: boolean;
  syncInterval: number;
  isConfigured: boolean;
}

/**
 * Cifra un valore sensibile con AES-256-CBC. Il risultato include l'IV
 * prefissato (hex), separato da `:`. Il caller deve usare `decrypt()` con la
 * stessa SETTINGS_ENCRYPTION_KEY.
 */
function encrypt(text: string): string {
  if (!text) return '';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decifra un valore prodotto da `encrypt()`. Se il formato è invalido o la
 * chiave è sbagliata logga l'errore e ritorna stringa vuota (per non rompere
 * caller che si aspettano sempre un valore).
 */
function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Errore decifratura settings WordPress:', error);
    return '';
  }
}

/**
 * Service per la configurazione WordPress per-tenant.
 *
 * Tutte le operazioni sono scoped a un tenantId: nessuna API "globale".
 * Le credenziali sono persistite in `wordpress_tenant_config`, con i secret
 * cifrati AES-256-CBC tramite SETTINGS_ENCRYPTION_KEY.
 *
 * Ritorna `null` quando il tenant non ha mai configurato WP; i caller decidono
 * come gestire il caso "non configurato" (es. skippare sync, restituire 404).
 */
class WordPressSettingsService {
  /**
   * Settings effettive (con secret in chiaro). Usare SOLO server-side per
   * costruire chiamate verso Woo. NON esporre mai questo payload via API REST.
   */
  async getSettings(tenantId: string): Promise<WordPressSettings | null> {
    if (!tenantId) {
      throw new Error('tenantId obbligatorio per WordPressSettingsService.getSettings');
    }
    try {
      const row = await prisma.wordPressTenantConfig.findUnique({
        where: { tenantId },
      });
      if (!row) return null;

      return {
        url: row.url,
        consumerKey: decrypt(row.consumerKey),
        consumerSecret: decrypt(row.consumerSecret),
        webhookSecret: decrypt(row.webhookSecret),
        syncEnabled: row.syncEnabled,
        syncInterval: row.syncInterval,
      };
    } catch (error) {
      logger.error(`Errore lettura settings WordPress (tenant=${tenantId}):`, error);
      return null;
    }
  }

  /**
   * Settings sanitizzate per la UI: mostra `consumerKey` mascherata e flag
   * "hasX" sui secret, mai i secret in chiaro.
   */
  async getSettingsForUI(tenantId: string): Promise<WordPressSettingsForUI> {
    const settings = await this.getSettings(tenantId);

    if (!settings) {
      return {
        url: '',
        consumerKey: '',
        hasConsumerSecret: false,
        hasWebhookSecret: false,
        syncEnabled: false,
        syncInterval: 300000,
        isConfigured: false,
      };
    }

    return {
      url: settings.url,
      consumerKey: settings.consumerKey ? settings.consumerKey.substring(0, 10) + '...' : '',
      hasConsumerSecret: !!settings.consumerSecret,
      hasWebhookSecret: !!settings.webhookSecret,
      syncEnabled: settings.syncEnabled,
      syncInterval: settings.syncInterval,
      isConfigured: !!(settings.url && settings.consumerKey && settings.consumerSecret),
    };
  }

  /**
   * Upsert delle settings. I campi assenti dal payload mantengono il valore
   * corrente; i secret (consumer key/secret, webhook secret) vengono cifrati
   * prima di essere scritti. Se non esiste alcuna riga per il tenant, viene
   * creata con i default per i campi mancanti.
   */
  async saveSettings(tenantId: string, settings: Partial<WordPressSettings>): Promise<void> {
    if (!tenantId) {
      throw new Error('tenantId obbligatorio per WordPressSettingsService.saveSettings');
    }
    try {
      const current = (await this.getSettings(tenantId)) ?? {
        url: '',
        consumerKey: '',
        consumerSecret: '',
        webhookSecret: '',
        syncEnabled: false,
        syncInterval: 300000,
      };

      const merged = {
        url: settings.url ?? current.url,
        consumerKey: encrypt(settings.consumerKey ?? current.consumerKey),
        consumerSecret: encrypt(settings.consumerSecret ?? current.consumerSecret),
        webhookSecret: encrypt(settings.webhookSecret ?? current.webhookSecret),
        syncEnabled: settings.syncEnabled ?? current.syncEnabled,
        syncInterval: settings.syncInterval ?? current.syncInterval,
      };

      await prisma.wordPressTenantConfig.upsert({
        where: { tenantId },
        create: { tenantId, ...merged },
        update: merged,
      });

      logger.info(`Settings WordPress salvate (tenant=${tenantId})`);
    } catch (error) {
      logger.error(`Errore salvataggio settings WordPress (tenant=${tenantId}):`, error);
      throw error;
    }
  }

  /**
   * Aggiorna `lastSyncAt` al timestamp corrente. Idempotente, non fallisce se
   * il tenant non ha una config (no-op).
   */
  async markSyncRun(tenantId: string): Promise<void> {
    try {
      await prisma.wordPressTenantConfig.update({
        where: { tenantId },
        data: { lastSyncAt: new Date() },
      });
    } catch (error) {
      // Tenant senza config = niente da aggiornare, non è un errore
      logger.debug(`markSyncRun no-op per tenant=${tenantId}: ${(error as Error).message}`);
    }
  }

  /**
   * Lista tutti i tenant con sync abilitata. Usato dallo scheduler per fanout
   * dei job sync verso ogni tenant attivo.
   */
  async listTenantsWithSyncEnabled(): Promise<string[]> {
    const rows = await prisma.wordPressTenantConfig.findMany({
      where: { syncEnabled: true },
      select: { tenantId: true },
    });
    return rows.map((r) => r.tenantId);
  }

  /**
   * Test connection contro l'endpoint WooCommerce. Se `overrideSettings` è
   * fornito (caso "Salva e testa" dalla UI prima del commit), usa quello,
   * altrimenti legge dal DB.
   */
  async testConnection(
    tenantId: string,
    overrideSettings?: Partial<WordPressSettings>
  ): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    let config: WordPressSettings | null;
    if (overrideSettings?.url && overrideSettings.consumerKey && overrideSettings.consumerSecret) {
      config = {
        url: overrideSettings.url,
        consumerKey: overrideSettings.consumerKey,
        consumerSecret: overrideSettings.consumerSecret,
        webhookSecret: overrideSettings.webhookSecret ?? '',
        syncEnabled: overrideSettings.syncEnabled ?? false,
        syncInterval: overrideSettings.syncInterval ?? 300000,
      };
    } else {
      config = await this.getSettings(tenantId);
    }

    if (!config || !config.url || !config.consumerKey || !config.consumerSecret) {
      return {
        success: false,
        message: 'Configurazione incompleta. Inserisci URL, Consumer Key e Consumer Secret.',
      };
    }

    try {
      const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
      const response = await fetch(`${config.url}/wp-json/wc/v3/system_status`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connessione riuscita!',
          details: {
            woocommerceVersion: data.environment?.version,
            wordpressVersion: data.environment?.wp_version,
            siteUrl: data.environment?.site_url,
            storeId: data.settings?.woocommerce_store_id,
          },
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'Autenticazione fallita. Verifica Consumer Key e Consumer Secret.',
        };
      } else {
        return {
          success: false,
          message: `Errore connessione: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error: any) {
      logger.error(`Test connessione WooCommerce fallito (tenant=${tenantId}):`, error);
      return {
        success: false,
        message: error.message || "Errore di connessione. Verifica l'URL.",
      };
    }
  }

  /**
   * Genera un webhook secret random (32 byte → 64 hex char). Esposto come
   * helper per la UI che vuole pre-popolare il campo.
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const wordpressSettingsService = new WordPressSettingsService();
export default wordpressSettingsService;
