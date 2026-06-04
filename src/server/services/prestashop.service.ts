import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { requireCurrentTenantId } from '../utils/tenant-context';
import { prestashopSettingsService } from './prestashop-settings.service';
import { PrestaShopClient } from './prestashop-client';

/**
 * Service di sincronizzazione PrestaShop ↔ ERP (per-tenant).
 *
 * Direzioni:
 *  - PUSH  ERP → PS : prodotti, inventario (stock_availables)
 *  - PULL  PS  → ERP: ordini, clienti (polling incrementale)
 *
 * Ogni operazione viene loggata in PrestaShopSyncLog. Le operazioni leggono il
 * tenant dal context corrente (route) o ricevono il client iniettato (test/job).
 */

export interface SyncResult {
  success: boolean;
  count: number;
  errors: string[];
}

class PrestaShopService {
  /** Costruisce un client per il tenant dalle settings salvate. */
  async getClient(tenantId: string): Promise<PrestaShopClient> {
    const settings = await prestashopSettingsService.getSettings(tenantId);
    if (!settings || !settings.apiUrl || !settings.apiKey) {
      throw new Error('PrestaShop non configurato per questo tenant');
    }
    return new PrestaShopClient({ apiUrl: settings.apiUrl, apiKey: settings.apiKey });
  }

  private async log(
    tenantId: string,
    entityType: string,
    direction: 'push' | 'pull',
    status: 'success' | 'error' | 'partial',
    message: string,
    count: number
  ): Promise<void> {
    try {
      await prisma.prestaShopSyncLog.create({
        data: { tenantId, entityType, direction, status, message: message.slice(0, 1000), count },
      });
    } catch (e) {
      logger.error('Errore scrittura PrestaShopSyncLog:', e);
    }
  }

  /** Test connessione con credenziali salvate o fornite ad-hoc. */
  async testConnection(
    tenantId: string,
    override?: { apiUrl: string; apiKey: string }
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    const cfg = override || (await prestashopSettingsService.getSettings(tenantId));
    if (!cfg || !cfg.apiUrl || !cfg.apiKey) {
      return { ok: false, error: 'Configurazione mancante (apiUrl/apiKey)' };
    }
    const client = new PrestaShopClient({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
    return client.testConnection();
  }

  // ============================================================
  // PUSH: ERP → PrestaShop
  // ============================================================

  /** Pubblica/aggiorna i prodotti web-attivi del tenant su PrestaShop. */
  async pushProducts(tenantId: string, client?: PrestaShopClient): Promise<SyncResult> {
    const ps = client || (await this.getClient(tenantId));
    const errors: string[] = [];
    let count = 0;

    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true, isSellable: true },
      take: 500,
    });

    for (const p of products) {
      try {
        const payload = {
          reference: p.sku,
          price: Number(p.webPrice ?? p.price) || 0,
          state: 1,
          active: 1,
          name: p.name,
          description: p.webDescription || p.description || '',
        };
        if (p.prestashopId) {
          await ps.update('products', p.prestashopId, payload);
        } else {
          const created = await ps.create('products', payload);
          const newId = this.extractId(created);
          if (newId) {
            await prisma.product.update({ where: { id: p.id }, data: { prestashopId: newId } });
          }
        }
        count++;
      } catch (e) {
        errors.push(`${p.sku}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await this.log(tenantId, 'product', 'push', errors.length ? 'partial' : 'success',
      `Push ${count} prodotti, ${errors.length} errori`, count);
    return { success: errors.length === 0, count, errors };
  }

  /** Aggiorna le giacenze su PrestaShop (stock_availables) per i prodotti mappati. */
  async pushInventory(tenantId: string, client?: PrestaShopClient): Promise<SyncResult> {
    const ps = client || (await this.getClient(tenantId));
    const errors: string[] = [];
    let count = 0;

    const products = await prisma.product.findMany({
      where: { tenantId, prestashopId: { not: null } },
      select: { id: true, sku: true, prestashopId: true },
      take: 500,
    });

    for (const p of products) {
      try {
        // Quantità totale in giacenza dall'ERP
        const agg = await prisma.inventoryItem.aggregate({
          where: { tenantId, productId: p.id },
          _sum: { quantity: true },
        });
        const qty = agg._sum.quantity ?? 0;
        // stock_availables indicizzati per id_product
        const stocks = await ps.list('stock_availables', { filters: { id_product: p.prestashopId! }, display: 'full' });
        for (const s of stocks) {
          await ps.update('stock_availables', Number(s.id), { quantity: qty });
        }
        count++;
      } catch (e) {
        errors.push(`${p.sku}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await this.log(tenantId, 'inventory', 'push', errors.length ? 'partial' : 'success',
      `Push stock ${count} prodotti, ${errors.length} errori`, count);
    return { success: errors.length === 0, count, errors };
  }

  // ============================================================
  // PULL: PrestaShop → ERP
  // ============================================================

  /** Importa gli ordini PrestaShop nuovi (id > lastOrderImportId) nell'ERP. */
  async importOrders(tenantId: string, client?: PrestaShopClient): Promise<SyncResult> {
    const ps = client || (await this.getClient(tenantId));
    const settings = await prestashopSettingsService.getSettings(tenantId);
    const sinceId = settings?.lastOrderImportId ?? 0;
    const errors: string[] = [];
    let count = 0;
    let maxId = sinceId;

    const orders = await ps.list('orders', {
      display: 'full',
      filters: sinceId > 0 ? { id: `>[${sinceId}]` } : {},
      sort: 'id_ASC',
      limit: 100,
    });

    for (const o of orders) {
      const psId = Number(o.id);
      if (psId <= sinceId) continue;
      try {
        await this.importSingleOrder(tenantId, ps, o);
        count++;
        if (psId > maxId) maxId = psId;
      } catch (e) {
        errors.push(`order ${psId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (maxId > sinceId) {
      await prestashopSettingsService.markSyncRun(tenantId, maxId);
    }
    await this.log(tenantId, 'order', 'pull', errors.length ? 'partial' : 'success',
      `Import ${count} ordini (fino a PS #${maxId}), ${errors.length} errori`, count);
    return { success: errors.length === 0, count, errors };
  }

  /** Mappa e crea un singolo ordine PrestaShop nell'ERP (idempotente). */
  private async importSingleOrder(tenantId: string, ps: PrestaShopClient, o: any): Promise<void> {
    const psId = Number(o.id);

    // Idempotenza: se già importato, skip.
    const existing = await prisma.order.findFirst({ where: { tenantId, prestashopId: psId } });
    if (existing) return;

    const customer = await this.findOrCreateCustomer(tenantId, ps, Number(o.id_customer));

    // Righe ordine da associations.order_rows
    const rows: any[] = o?.associations?.order_rows || [];
    const items = rows.map((r) => {
      const qty = parseInt(r.product_quantity, 10) || 1;
      const unitPrice = parseFloat(r.unit_price_tax_incl ?? r.unit_price_tax_excl ?? '0') || 0;
      return {
        productName: r.product_name || `Prodotto ${r.product_id}`,
        sku: r.product_reference || `PS-${r.product_id}`,
        quantity: qty,
        unitPrice,
        total: unitPrice * qty,
      };
    });

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const total = parseFloat(o.total_paid_tax_incl ?? o.total_paid ?? '0') || subtotal;

    await prisma.order.create({
      data: {
        orderNumber: `PS-${psId}`,
        customerId: customer.id,
        source: 'PRESTASHOP',
        status: this.mapOrderState(o.current_state),
        prestashopId: psId,
        subtotal,
        tax: 0,
        shipping: parseFloat(o.total_shipping_tax_incl ?? o.total_shipping ?? '0') || 0,
        discount: parseFloat(o.total_discounts_tax_incl ?? o.total_discounts ?? '0') || 0,
        total,
        paymentMethod: o.payment || 'PrestaShop',
        paymentStatus: 'pending',
        // I nested items ricevono tenantId dal middleware (injectNestedTenant)
        items: { create: items },
      },
    });
  }

  /** Importa i clienti PrestaShop nell'ERP. */
  async importCustomers(tenantId: string, client?: PrestaShopClient): Promise<SyncResult> {
    const ps = client || (await this.getClient(tenantId));
    const errors: string[] = [];
    let count = 0;

    const customers = await ps.list('customers', { display: 'full', limit: 200 });
    for (const c of customers) {
      try {
        await this.upsertCustomer(tenantId, c);
        count++;
      } catch (e) {
        errors.push(`customer ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await this.log(tenantId, 'customer', 'pull', errors.length ? 'partial' : 'success',
      `Import ${count} clienti, ${errors.length} errori`, count);
    return { success: errors.length === 0, count, errors };
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async findOrCreateCustomer(tenantId: string, ps: PrestaShopClient, psCustomerId: number) {
    const existing = await prisma.customer.findFirst({ where: { tenantId, prestashopId: psCustomerId } });
    if (existing) return existing;

    let psCustomer: any = null;
    try {
      psCustomer = await ps.getOne('customers', psCustomerId);
    } catch {
      /* customer non recuperabile: creiamo un placeholder */
    }
    return this.upsertCustomer(tenantId, psCustomer || { id: psCustomerId });
  }

  private async upsertCustomer(tenantId: string, c: any) {
    const psId = Number(c.id);
    const existing = await prisma.customer.findFirst({ where: { tenantId, prestashopId: psId } });
    const email = c.email || `ps-${psId}@import.local`;
    const data = {
      type: 'B2C' as const,
      firstName: c.firstname || 'Cliente',
      lastName: c.lastname || `PS-${psId}`,
      email,
      prestashopId: psId,
      isActive: true,
    };
    if (existing) {
      return prisma.customer.update({ where: { id: existing.id }, data });
    }
    return prisma.customer.create({
      data: { ...data, code: `PS-C${psId}` },
    });
  }

  /** Mappa lo stato ordine PrestaShop (id_state) a OrderStatus ERP. */
  private mapOrderState(state: unknown): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
    const s = parseInt(String(state), 10);
    // Stati PrestaShop di default: 2=pagamento accettato, 3=in preparazione,
    // 4=spedito, 5=consegnato, 6=annullato, 1=in attesa assegno.
    switch (s) {
      case 2: return 'CONFIRMED';
      case 3: return 'PROCESSING';
      case 4: return 'SHIPPED';
      case 5: return 'DELIVERED';
      case 6: return 'CANCELLED';
      default: return 'PENDING';
    }
  }

  private extractId(created: any): number | null {
    // La create PrestaShop ritorna XML; proviamo a estrarre <id>N</id>.
    if (!created) return null;
    if (typeof created === 'object') {
      const key = Object.keys(created)[0];
      const id = created[key]?.id ?? created.id;
      return id ? Number(id) : null;
    }
    const m = String(created).match(/<id>\s*<!\[CDATA\[(\d+)\]\]>\s*<\/id>|<id>(\d+)<\/id>/);
    return m ? Number(m[1] || m[2]) : null;
  }

  /** Esegue un ciclo di sync completo per un tenant (usato dal job). */
  async runFullSync(tenantId: string): Promise<void> {
    const settings = await prestashopSettingsService.getSettings(tenantId);
    if (!settings || !settings.syncEnabled) return;
    const client = await this.getClient(tenantId);
    if (settings.pushProducts) await this.pushProducts(tenantId, client).catch((e) => logger.error('PS pushProducts:', e));
    if (settings.pushInventory) await this.pushInventory(tenantId, client).catch((e) => logger.error('PS pushInventory:', e));
    if (settings.importOrders) await this.importOrders(tenantId, client).catch((e) => logger.error('PS importOrders:', e));
  }

  /** Log recenti per la UI. */
  async getRecentLogs(tenantId: string, limit = 50) {
    return prisma.prestaShopSyncLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** tenantId dal context (per le route che non lo passano esplicitamente). */
  currentTenant(): string {
    return requireCurrentTenantId();
  }
}

export const prestashopService = new PrestaShopService();
export default prestashopService;
