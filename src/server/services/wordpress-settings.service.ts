import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Chiave per cifratura (in produzione usare una chiave sicura da env)
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'ecommerceerp-default-key-32byte';
const IV_LENGTH = 16;

interface WordPressSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret: string;
  syncEnabled: boolean;
  syncInterval: number;
}

const SETTINGS_KEY = 'wordpress_config';

/**
 * Cifra un valore sensibile
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
 * Decifra un valore sensibile
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
    logger.error('Errore decifratura:', error);
    return '';
  }
}

class WordPressSettingsService {
  /**
   * Ottieni le impostazioni WordPress
   * Prima cerca nel DB, poi fallback su variabili d'ambiente
   */
  async getSettings(): Promise<WordPressSettings> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (setting?.value) {
        const stored = setting.value as any;
        return {
          url: stored.url || process.env.WORDPRESS_URL || '',
          consumerKey: decrypt(stored.consumerKey) || process.env.WORDPRESS_API_KEY || '',
          consumerSecret: decrypt(stored.consumerSecret) || process.env.WORDPRESS_CONSUMER_SECRET || '',
          webhookSecret: decrypt(stored.webhookSecret) || process.env.WORDPRESS_WEBHOOK_SECRET || '',
          syncEnabled: stored.syncEnabled ?? (process.env.WORDPRESS_SYNC_ENABLED === 'true'),
          syncInterval: stored.syncInterval ?? parseInt(process.env.WORDPRESS_SYNC_INTERVAL || '300000'),
        };
      }
    } catch (error) {
      logger.error('Errore lettura settings WordPress:', error);
    }

    // Fallback su variabili d'ambiente
    return {
      url: process.env.WORDPRESS_URL || '',
      consumerKey: process.env.WORDPRESS_API_KEY || '',
      consumerSecret: process.env.WORDPRESS_CONSUMER_SECRET || '',
      webhookSecret: process.env.WORDPRESS_WEBHOOK_SECRET || '',
      syncEnabled: process.env.WORDPRESS_SYNC_ENABLED === 'true',
      syncInterval: parseInt(process.env.WORDPRESS_SYNC_INTERVAL || '300000'),
    };
  }

  /**
   * Ottieni settings per UI (senza secrets in chiaro)
   */
  async getSettingsForUI(): Promise<{
    url: string;
    consumerKey: string;
    hasConsumerSecret: boolean;
    hasWebhookSecret: boolean;
    syncEnabled: boolean;
    syncInterval: number;
    isConfigured: boolean;
  }> {
    const settings = await this.getSettings();

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
   * Salva le impostazioni WordPress
   */
  async saveSettings(settings: Partial<WordPressSettings>): Promise<void> {
    try {
      const current = await this.getSettings();

      // Prepara dati per salvataggio (cifra secrets)
      const dataToSave = {
        url: settings.url ?? current.url,
        consumerKey: settings.consumerKey ? encrypt(settings.consumerKey) : encrypt(current.consumerKey),
        consumerSecret: settings.consumerSecret ? encrypt(settings.consumerSecret) : encrypt(current.consumerSecret),
        webhookSecret: settings.webhookSecret ? encrypt(settings.webhookSecret) : encrypt(current.webhookSecret),
        syncEnabled: settings.syncEnabled ?? current.syncEnabled,
        syncInterval: settings.syncInterval ?? current.syncInterval,
      };

      await prisma.systemSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: {
          key: SETTINGS_KEY,
          value: dataToSave,
          description: 'Configurazione integrazione WordPress/WooCommerce',
        },
        update: {
          value: dataToSave,
        },
      });

      logger.info('Impostazioni WordPress salvate');
    } catch (error) {
      logger.error('Errore salvataggio settings WordPress:', error);
      throw error;
    }
  }

  /**
   * Testa la connessione WooCommerce
   */
  async testConnection(settings?: Partial<WordPressSettings>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const config = settings?.url && settings?.consumerKey && settings?.consumerSecret
      ? settings as WordPressSettings
      : await this.getSettings();

    if (!config.url || !config.consumerKey || !config.consumerSecret) {
      return {
        success: false,
        message: 'Configurazione incompleta. Inserisci URL, Consumer Key e Consumer Secret.',
      };
    }

    try {
      // Costruisci header Basic Auth
      const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

      const response = await fetch(`${config.url}/wp-json/wc/v3/system_status`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
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
      logger.error('Test connessione WooCommerce fallito:', error);
      return {
        success: false,
        message: error.message || 'Errore di connessione. Verifica l\'URL.',
      };
    }
  }

  /**
   * Genera un nuovo webhook secret
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const wordpressSettingsService = new WordPressSettingsService();
export default wordpressSettingsService;
