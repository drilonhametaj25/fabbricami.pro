import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Add-on service — componenti acquistabili oltre al piano.
 *
 * Due tipi di add-on:
 *  - RESOURCE_LIMIT: aumenta un limite del piano (es. +1 magazzino). Ogni unità
 *    di `quantity` aggiunge `increment` al limite della `resource` indicata.
 *  - FEATURE: sblocca una capability (es. api_access) tramite `featureKey`.
 *
 * I limiti effettivi del tenant = limiti del piano + somma degli add-on
 * RESOURCE_LIMIT. Le feature effettive = feature del piano + featureKey degli
 * add-on FEATURE attivi.
 *
 * Billing: in modalità dev/mock gli add-on sono semplicemente registrati. Con
 * Stripe configurato andrebbero aggiunti come subscription items separati (TODO
 * lato Stripe); l'effetto sui limiti è identico nei due casi.
 */

export type LimitResource = 'users' | 'warehouses' | 'products' | 'orders' | 'suppliers';

export interface EffectiveLimits {
  maxUsers: number;
  maxWarehouses: number;
  maxProducts: number;
  maxOrders: number;
  maxSuppliers: number;
}

const RESOURCE_TO_LIMIT_KEY: Record<LimitResource, keyof EffectiveLimits> = {
  users: 'maxUsers',
  warehouses: 'maxWarehouses',
  products: 'maxProducts',
  orders: 'maxOrders',
  suppliers: 'maxSuppliers',
};

class AddonService {
  /** Catalogo add-on attivi (globale, non tenant-scoped). */
  async getCatalog() {
    return prisma.addonCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Add-on attualmente attivi per il tenant (con dati del catalogo). */
  async getTenantAddons(tenantId: string) {
    // Difensivo: se il modello non è disponibile (es. client non rigenerato in
    // alcuni contesti di test) ritorna lista vuota invece di propagare l'errore.
    if (!prisma.tenantAddon?.findMany) return [];
    return (
      (await prisma.tenantAddon.findMany({
        where: { tenantId },
        include: { addon: true },
        orderBy: { createdAt: 'asc' },
      })) ?? []
    );
  }

  /** Aggiunge (o aggiorna la quantità di) un add-on per il tenant. */
  async addAddon(tenantId: string, code: string, quantity = 1) {
    if (quantity < 1) throw new Error('La quantità deve essere almeno 1');

    const addon = await prisma.addonCatalog.findUnique({ where: { code } });
    if (!addon || !addon.isActive) {
      throw new Error('Add-on non trovato o non disponibile');
    }

    const existing = await prisma.tenantAddon.findUnique({
      where: { tenantId_addonId: { tenantId, addonId: addon.id } },
    });

    const result = existing
      ? await prisma.tenantAddon.update({
          where: { id: existing.id },
          data: { quantity },
          include: { addon: true },
        })
      : await prisma.tenantAddon.create({
          data: { tenantId, addonId: addon.id, quantity },
          include: { addon: true },
        });

    logger.info(`[addons] tenant ${tenantId} → ${code} x${quantity}`);
    return result;
  }

  /** Rimuove un add-on dal tenant. */
  async removeAddon(tenantId: string, code: string) {
    const addon = await prisma.addonCatalog.findUnique({ where: { code } });
    if (!addon) throw new Error('Add-on non trovato');

    await prisma.tenantAddon.deleteMany({
      where: { tenantId, addonId: addon.id },
    });
    logger.info(`[addons] tenant ${tenantId} ← rimosso ${code}`);
  }

  /**
   * Limiti effettivi del tenant = limiti del piano + add-on RESOURCE_LIMIT.
   * Un limite -1 (illimitato) resta -1.
   */
  async getEffectiveLimits(tenantId: string, baseLimits: EffectiveLimits): Promise<EffectiveLimits> {
    let addons: Awaited<ReturnType<AddonService['getTenantAddons']>> = [];
    try {
      addons = await this.getTenantAddons(tenantId);
    } catch {
      // Gli add-on sono additivi: un errore nel caricarli non deve bloccare i
      // controlli sui limiti — si ricade sui limiti del piano.
      return { ...baseLimits };
    }
    const limits: EffectiveLimits = { ...baseLimits };

    for (const ta of addons) {
      if (ta.addon.type !== 'RESOURCE_LIMIT' || !ta.addon.resource) continue;
      const key = RESOURCE_TO_LIMIT_KEY[ta.addon.resource as LimitResource];
      if (!key) continue;
      if (limits[key] === -1) continue; // già illimitato
      limits[key] = limits[key] + ta.addon.increment * ta.quantity;
    }

    return limits;
  }

  /** Feature effettive = feature del piano + featureKey degli add-on FEATURE. */
  async getEffectiveFeatures(tenantId: string, baseFeatures: string[]): Promise<string[]> {
    const addons = await this.getTenantAddons(tenantId);
    const set = new Set(baseFeatures);
    for (const ta of addons) {
      if (ta.addon.type === 'FEATURE' && ta.addon.featureKey) {
        set.add(ta.addon.featureKey);
      }
    }
    return [...set];
  }
}

export const addonService = new AddonService();
export default addonService;
