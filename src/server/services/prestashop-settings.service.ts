import { prisma } from '../config/database';
import { logger } from '../config/logger';
import * as crypto from 'crypto';

// Riusa la stessa chiave del modulo WordPress per coerenza di deployment.
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'ecommerceerp-default-key-32byte';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return '';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Errore decifratura settings PrestaShop:', error);
    return '';
  }
}

export interface PrestaShopSettings {
  apiUrl: string;
  apiKey: string;
  syncEnabled: boolean;
  syncInterval: number;
  pushProducts: boolean;
  pushInventory: boolean;
  importOrders: boolean;
  lastOrderImportId: number | null;
}

export interface PrestaShopSettingsForUI {
  apiUrl: string;
  hasApiKey: boolean;
  syncEnabled: boolean;
  syncInterval: number;
  pushProducts: boolean;
  pushInventory: boolean;
  importOrders: boolean;
  isConfigured: boolean;
}

/**
 * Configurazione PrestaShop per-tenant. La Webservice API key è cifrata
 * AES-256-CBC. Tutte le operazioni sono scoped a un tenantId.
 */
class PrestaShopSettingsService {
  /** Settings con secret in chiaro — SOLO server-side, mai esposte via API. */
  async getSettings(tenantId: string): Promise<PrestaShopSettings | null> {
    if (!tenantId) throw new Error('tenantId obbligatorio per getSettings');
    try {
      const row = await prisma.prestaShopTenantConfig.findUnique({ where: { tenantId } });
      if (!row) return null;
      return {
        apiUrl: row.apiUrl,
        apiKey: decrypt(row.apiKey),
        syncEnabled: row.syncEnabled,
        syncInterval: row.syncInterval,
        pushProducts: row.pushProducts,
        pushInventory: row.pushInventory,
        importOrders: row.importOrders,
        lastOrderImportId: row.lastOrderImportId,
      };
    } catch (error) {
      logger.error(`Errore lettura settings PrestaShop (tenant=${tenantId}):`, error);
      return null;
    }
  }

  /** Settings sanitizzate per la UI (nessun secret in chiaro). */
  async getSettingsForUI(tenantId: string): Promise<PrestaShopSettingsForUI> {
    const s = await this.getSettings(tenantId);
    if (!s) {
      return {
        apiUrl: '',
        hasApiKey: false,
        syncEnabled: false,
        syncInterval: 600000,
        pushProducts: true,
        pushInventory: true,
        importOrders: true,
        isConfigured: false,
      };
    }
    return {
      apiUrl: s.apiUrl,
      hasApiKey: !!s.apiKey,
      syncEnabled: s.syncEnabled,
      syncInterval: s.syncInterval,
      pushProducts: s.pushProducts,
      pushInventory: s.pushInventory,
      importOrders: s.importOrders,
      isConfigured: !!s.apiUrl && !!s.apiKey,
    };
  }

  /** Crea/aggiorna la configurazione. La apiKey viene cifrata (se fornita). */
  async saveSettings(tenantId: string, settings: Partial<PrestaShopSettings>): Promise<void> {
    if (!tenantId) throw new Error('tenantId obbligatorio per saveSettings');

    const current = (await this.getSettings(tenantId)) ?? {
      apiUrl: '',
      apiKey: '',
      syncEnabled: false,
      syncInterval: 600000,
      pushProducts: true,
      pushInventory: true,
      importOrders: true,
      lastOrderImportId: null as number | null,
    };

    const merged = {
      apiUrl: (settings.apiUrl ?? current.apiUrl).replace(/\/+$/, ''), // normalizza: niente trailing slash
      apiKey: encrypt(settings.apiKey ?? current.apiKey),
      syncEnabled: settings.syncEnabled ?? current.syncEnabled,
      syncInterval: settings.syncInterval ?? current.syncInterval,
      pushProducts: settings.pushProducts ?? current.pushProducts,
      pushInventory: settings.pushInventory ?? current.pushInventory,
      importOrders: settings.importOrders ?? current.importOrders,
    };

    await prisma.prestaShopTenantConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...merged },
      update: merged,
    });
  }

  async markSyncRun(tenantId: string, lastOrderImportId?: number): Promise<void> {
    await prisma.prestaShopTenantConfig.update({
      where: { tenantId },
      data: {
        lastSyncAt: new Date(),
        ...(lastOrderImportId !== undefined ? { lastOrderImportId } : {}),
      },
    });
  }

  /** Tenant con sync PrestaShop abilitato (per il job schedulato). */
  async listTenantsWithSyncEnabled(): Promise<string[]> {
    const rows = await prisma.prestaShopTenantConfig.findMany({
      where: { syncEnabled: true },
      select: { tenantId: true },
    });
    return rows.map((r) => r.tenantId);
  }
}

export const prestashopSettingsService = new PrestaShopSettingsService();
export default prestashopSettingsService;
