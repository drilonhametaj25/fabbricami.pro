import { prisma } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import notificationService from './notification.service';
// inventoryService import removed - unused
import wordpressSettingsService from './wordpress-settings.service';
import crypto from 'crypto';
import {
  mapProductToWooCommerce,
  mapVariantToWooCommerce,
  mapAttributesForVariableProduct,
  mapWooCommerceToProduct,
  mapWooCommerceToVariant,
  logSync,
  findOrCreateShippingClass,
  // WCProductData - unused, imported for type reference only
  // WCVariationData - unused, imported for type reference only
} from './wordpress-sync.helpers';

/**
 * WordPress/WooCommerce Service
 * Gestisce sincronizzazione bidirezionale con WooCommerce
 */

interface WooCommerceProduct {
  id: number;
  sku: string;
  name: string;
  slug: string;
  permalink: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; name: string; alt: string }[];
  attributes: { id: number; name: string; slug: string; position: number; visible: boolean; variation: boolean; options: string[] }[];
  variations: number[];
  type: 'simple' | 'variable' | 'grouped' | 'external';
  status: 'publish' | 'draft' | 'pending' | 'private';
  tax_status: 'taxable' | 'shipping' | 'none';
  tax_class: string;
  shipping_class: string;
  shipping_class_id: number;
  menu_order: number;
  parent_id: number;
  meta_data: { id: number; key: string; value: any }[];
  // Campi aggiuntivi per prodotti virtuali/downloadable
  virtual: boolean;
  downloadable: boolean;
  downloads: { id: string; name: string; file: string }[];
}

interface WooCommerceVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  status: 'publish' | 'private';
  description: string;
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  manage_stock: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  image: { id: number; src: string; name: string; alt: string } | null;
  attributes: { id: number; name: string; slug: string; option: string }[];
  menu_order: number;
  meta_data: { id: number; key: string; value: any }[];
}

interface WooCommerceCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: { id: number; src: string; name: string; alt: string } | null;
  menu_order: number;
  count: number;
}

interface WooCommerceShippingClass {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

interface WooCommerceOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: string;
  currency: string;
  currency_symbol: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  date_completed: string | null;
  date_completed_gmt: string | null;
  date_paid: string | null;
  date_paid_gmt: string | null;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
  };
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  payment_url: string;
  needs_payment: boolean;
  needs_processing: boolean;
  line_items: WooCommerceLineItem[];
  tax_lines: WooCommerceTaxLine[];
  shipping_lines: WooCommerceShippingLine[];
  fee_lines: WooCommerceFeeLine[];
  coupon_lines: WooCommerceCouponLine[];
  refunds: WooCommerceRefundSummary[];
  meta_data: { id: number; key: string; value: any }[];
  cart_hash: string;
  // Campo calcolato
  subtotal?: string;
}

interface WooCommerceLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: { id: number; total: string; subtotal: string }[];
  meta_data: { id: number; key: string; value: any; display_key: string; display_value: string }[];
  sku: string;
  price: number;
  image: { id: number; src: string } | null;
  parent_name: string | null;
}

interface WooCommerceTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  rate_percent: number;
  meta_data: { id: number; key: string; value: any }[];
}

interface WooCommerceShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string;
  total: string;
  total_tax: string;
  taxes: { id: number; total: string }[];
  meta_data: { id: number; key: string; value: any }[];
}

interface WooCommerceFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: string;
  amount: string;
  total: string;
  total_tax: string;
  taxes: { id: number; total: string; subtotal: string }[];
  meta_data: { id: number; key: string; value: any }[];
}

interface WooCommerceCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: { id: number; key: string; value: any }[];
}

interface WooCommerceRefundSummary {
  id: number;
  reason: string;
  total: string;
}

interface WooCommerceRefund {
  id: number;
  date_created: string;
  date_created_gmt: string;
  amount: string;
  reason: string;
  refunded_by: number;
  refunded_payment: boolean;
  meta_data: { id: number; key: string; value: any }[];
  line_items: {
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    taxes: { id: number; total: string; subtotal: string }[];
    meta_data: { id: number; key: string; value: any }[];
    sku: string;
    price: number;
    refund_total: number;
  }[];
}

interface WooCommerceOrderNote {
  id: number;
  author: string;
  date_created: string;
  date_created_gmt: string;
  note: string;
  customer_note: boolean;
  added_by_user: boolean;
}

interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
}

// Configurazione batch per rispettare limiti WooCommerce
const BATCH_CONFIG = {
  // Numero di items per richiesta - RIDOTTO per evitare timeout
  ITEMS_PER_PAGE: 10,
  // Delay tra richieste in ms - AUMENTATO per evitare rate limiting
  REQUEST_DELAY: 2000,
  // Timeout per singola richiesta (2 minuti)
  REQUEST_TIMEOUT: 120000,
  // Max tentativi per richiesta
  MAX_RETRIES: 3,
  // Delay iniziale per retry (raddoppia ad ogni tentativo)
  RETRY_DELAY: 3000,
};

class WordPressService {
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private webhookSecret: string;
  private settingsLoaded: boolean = false;
  private settingsLoadPromise: Promise<void> | null = null;

  constructor() {
    // Carica settings iniziali da env (poi verranno sovrascritte da DB)
    this.baseUrl = config.wordpress.url;
    this.consumerKey = config.wordpress.apiKey;
    this.consumerSecret = process.env.WORDPRESS_CONSUMER_SECRET || '';
    this.webhookSecret = config.wordpress.webhookSecret;

    // Carica settings dal DB in modo asincrono
    this.settingsLoadPromise = this.loadSettingsFromDB();
  }

  /**
   * Carica le impostazioni dal database
   */
  private async loadSettingsFromDB(): Promise<void> {
    try {
      const settings = await wordpressSettingsService.getSettings();
      if (settings.url) this.baseUrl = settings.url;
      if (settings.consumerKey) this.consumerKey = settings.consumerKey;
      if (settings.consumerSecret) this.consumerSecret = settings.consumerSecret;
      if (settings.webhookSecret) this.webhookSecret = settings.webhookSecret;
      this.settingsLoaded = true;
      logger.info('WordPress settings caricati dal database');
    } catch (error) {
      logger.warn('Impossibile caricare WordPress settings dal DB, uso env:', error);
      this.settingsLoaded = true; // Segna come caricato anche se fallito (usa env)
    }
  }

  /**
   * Assicura che le impostazioni siano caricate prima di procedere
   */
  private async ensureSettingsLoaded(): Promise<void> {
    if (!this.settingsLoaded && this.settingsLoadPromise) {
      await this.settingsLoadPromise;
    }
    // Se ancora non caricate (caso edge), ricarica
    if (!this.settingsLoaded) {
      await this.loadSettingsFromDB();
    }
  }

  /**
   * Ricarica le impostazioni (chiamato dopo salvataggio)
   */
  async reloadSettings(): Promise<void> {
    this.settingsLoaded = false;
    this.settingsLoadPromise = this.loadSettingsFromDB();
    await this.settingsLoadPromise;
  }

  /**
   * Verifica se WordPress è configurato
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.consumerKey && this.consumerSecret);
  }

  /**
   * Genera Authorization header per WooCommerce API
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Chiamata API a WooCommerce
   * Timeout configurabile (default 120 secondi per operazioni bulk)
   */
  private async wooCommerceRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    timeoutMs: number = BATCH_CONFIG.REQUEST_TIMEOUT
  ): Promise<T> {
    // Assicurati che le impostazioni siano caricate dal DB
    await this.ensureSettingsLoaded();

    if (!this.isConfigured()) {
      throw new Error('WordPress/WooCommerce non configurato');
    }

    const url = `${this.baseUrl}/wp-json/wc/v3/${endpoint}`;
    let lastError: Error | null = null;

    // Retry loop con exponential backoff
    for (let attempt = 1; attempt <= BATCH_CONFIG.MAX_RETRIES; attempt++) {
      // AbortController per timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      try {
        logger.debug(`WooCommerce request (attempt ${attempt}/${BATCH_CONFIG.MAX_RETRIES}): ${method} ${endpoint}`);
        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();

          // Se è un 504 o 502, ritenta
          if (response.status === 504 || response.status === 502 || response.status === 503) {
            lastError = new Error(`WooCommerce API error: ${response.status} (Gateway Timeout)`);
            logger.warn(`WooCommerce timeout (${response.status}), tentativo ${attempt}/${BATCH_CONFIG.MAX_RETRIES}`);

            if (attempt < BATCH_CONFIG.MAX_RETRIES) {
              const retryDelay = BATCH_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
              logger.info(`Attendo ${retryDelay}ms prima di riprovare...`);
              await this.delay(retryDelay);
              continue;
            }
          }

          logger.error(`WooCommerce API error: ${response.status} - ${errorText}`);
          throw new Error(`WooCommerce API error: ${response.status}`);
        }

        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error.name === 'AbortError') {
          logger.warn(`WooCommerce request timeout (attempt ${attempt}/${BATCH_CONFIG.MAX_RETRIES}): ${endpoint}`);

          if (attempt < BATCH_CONFIG.MAX_RETRIES) {
            const retryDelay = BATCH_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.info(`Attendo ${retryDelay}ms prima di riprovare...`);
            await this.delay(retryDelay);
            continue;
          }

          throw new Error(`WooCommerce API timeout dopo ${BATCH_CONFIG.MAX_RETRIES} tentativi`);
        }

        // Per altri errori di rete, ritenta
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          logger.warn(`WooCommerce network error (attempt ${attempt}/${BATCH_CONFIG.MAX_RETRIES}): ${error.code}`);

          if (attempt < BATCH_CONFIG.MAX_RETRIES) {
            const retryDelay = BATCH_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.info(`Attendo ${retryDelay}ms prima di riprovare...`);
            await this.delay(retryDelay);
            continue;
          }
        }

        logger.error('WooCommerce request failed:', error);
        throw error;
      }
    }

    throw lastError || new Error('WooCommerce request failed after all retries');
  }

  // =============================================
  // VALIDAZIONE WEBHOOK
  // =============================================

  /**
   * Valida firma webhook WooCommerce
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Webhook secret non configurato, skip validazione');
      return true; // In dev mode, accetta tutto
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // =============================================
  // SYNC PRODOTTI
  // =============================================

  /**
   * Sync singolo prodotto verso WooCommerce
   */
  async syncProductToWooCommerce(productId: string): Promise<{ success: boolean; woocommerceId?: number; error?: string }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          inventory: {
            where: { location: 'WEB' },
          },
        },
      });

      if (!product) {
        return { success: false, error: 'Prodotto non trovato' };
      }

      // Calcola stock totale per location WEB
      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity - inv.reservedQuantity, 0);

      // Prepara dati per WooCommerce
      const wooData: Partial<WooCommerceProduct> = {
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        regular_price: product.price.toString(),
        manage_stock: true,
        stock_quantity: totalStock,
        stock_status: totalStock > 0 ? 'instock' : 'outofstock',
        weight: product.weight?.toString() || '',
        tax_status: product.taxStatus as any,
        tax_class: product.taxClass,
        shipping_class: (product as any).shippingClass || '',
        images: product.images ? (product.images as any[]).map((url: string) => ({ src: url })) as any : [],
      };

      if (product.dimensions) {
        const dims = product.dimensions as { width?: number; height?: number; depth?: number };
        wooData.dimensions = {
          length: dims.depth?.toString() || '',
          width: dims.width?.toString() || '',
          height: dims.height?.toString() || '',
        };
      }

      let woocommerceId: number;

      if (product.woocommerceId) {
        // Aggiorna prodotto esistente
        const updated = await this.wooCommerceRequest<WooCommerceProduct>(
          `products/${product.woocommerceId}`,
          'PUT',
          wooData
        );
        woocommerceId = updated.id;
      } else {
        // Crea nuovo prodotto
        const created = await this.wooCommerceRequest<WooCommerceProduct>(
          'products',
          'POST',
          wooData
        );
        woocommerceId = created.id;
      }

      // Aggiorna stato sync nel DB
      await prisma.product.update({
        where: { id: productId },
        data: {
          woocommerceId,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        },
      });

      logger.info(`Prodotto ${product.sku} sincronizzato con WooCommerce (ID: ${woocommerceId})`);
      return { success: true, woocommerceId };

    } catch (error: any) {
      logger.error(`Errore sync prodotto ${productId}:`, error);

      await prisma.product.update({
        where: { id: productId },
        data: {
          syncStatus: 'ERROR',
          lastSyncAt: new Date(),
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Sync tutti i prodotti vendibili verso WooCommerce
   */
  async syncAllProductsToWooCommerce(): Promise<{ synced: number; errors: number; details: any[] }> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isSellable: true,
      },
      select: { id: true, sku: true },
    });

    const results = {
      synced: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const product of products) {
      const result = await this.syncProductToWooCommerce(product.id);

      if (result.success) {
        results.synced++;
      } else {
        results.errors++;
      }

      results.details.push({
        sku: product.sku,
        ...result,
      });

      // Rate limiting: pausa tra richieste
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info(`Sync completato: ${results.synced} prodotti sincronizzati, ${results.errors} errori`);
    return results;
  }

  /**
   * Import prodotti da WooCommerce
   */
  async importProductsFromWooCommerce(status?: 'publish' | 'draft' | 'any'): Promise<{ imported: number; updated: number; errors: number }> {
    await this.ensureSettingsLoaded();
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      // Ottieni o crea magazzino default per inventario
      let defaultWarehouse = await prisma.warehouse.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultWarehouse) {
        defaultWarehouse = await prisma.warehouse.create({
          data: {
            code: 'WH-001',
            name: 'Magazzino Principale',
            isActive: true,
          } as any,
        });
        logger.info('Creato magazzino default per import');
      }

      const warehouseId = defaultWarehouse.id;

      // Ottieni tutti i prodotti da WooCommerce (con paginazione e batching)
      let page = 1;
      const perPage = BATCH_CONFIG.ITEMS_PER_PAGE;
      let hasMore = true;

      // Costruisci il parametro status per la query
      const statusParam = status === 'any' ? '' : `&status=${status || 'publish'}`;

      while (hasMore) {
        logger.info(`Importing products page ${page}...`);
        const products = await this.wooCommerceRequest<WooCommerceProduct[]>(
          `products?page=${page}&per_page=${perPage}${statusParam}`,
          'GET',
          null,
          BATCH_CONFIG.REQUEST_TIMEOUT
        );

        if (products.length === 0) {
          hasMore = false;
          continue;
        }

        for (const wooProduct of products) {
          try {
            // Usa import completo con tutte le relazioni
            const result = await this.importProductComplete(wooProduct, warehouseId);
            if (result.success) {
              // Controlla se era un update o insert
              const wasUpdate = await prisma.product.findFirst({
                where: { woocommerceId: wooProduct.id },
              });
              if (wasUpdate) {
                results.updated++;
              } else {
                results.imported++;
              }
            } else {
              results.errors++;
            }
          } catch (error) {
            logger.error(`Errore import prodotto ${wooProduct.sku}:`, error);
            results.errors++;
          }
        }

        logger.info(`Products page ${page}: ${products.length} processed (${results.imported} imported, ${results.updated} updated)`);

        page++;
        if (products.length < perPage) {
          hasMore = false;
        } else {
          // Delay tra richieste per evitare rate limiting
          await this.delay(BATCH_CONFIG.REQUEST_DELAY);
        }
      }

    } catch (error) {
      logger.error('Errore import prodotti:', error);
      throw error;
    }

    return results;
  }

  /**
   * Import singolo prodotto da WooCommerce
   * @deprecated Use importProductComplete instead
   */
  // @ts-ignore - deprecated method kept for reference
  private async _importSingleProduct(wooProduct: WooCommerceProduct, results: { imported: number; updated: number; errors: number }) {
    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          { woocommerceId: wooProduct.id },
          { sku: wooProduct.sku },
        ],
      },
    });

    // Cerca la ShippingClass se presente
    let shippingClassId: string | null = null;
    if (wooProduct.shipping_class && wooProduct.shipping_class_id) {
      const shippingClass = await prisma.shippingClass.findFirst({
        where: {
          OR: [
            { woocommerceId: wooProduct.shipping_class_id },
            { slug: wooProduct.shipping_class },
          ],
        },
      });
      shippingClassId = shippingClass?.id || null;
    }

    // Dati base del prodotto
    const productData: any = {
      sku: wooProduct.sku || `WOO-${wooProduct.id}`,
      name: wooProduct.name,
      description: wooProduct.description || wooProduct.short_description,
      type: wooProduct.type === 'variable' ? 'WITH_VARIANTS' : 'SIMPLE',
      price: parseFloat(wooProduct.regular_price) || 0,
      cost: 0,
      weight: wooProduct.weight ? parseFloat(wooProduct.weight) : null,
      dimensions: wooProduct.dimensions ? {
        width: parseFloat(wooProduct.dimensions.width) || 0,
        height: parseFloat(wooProduct.dimensions.height) || 0,
        depth: parseFloat(wooProduct.dimensions.length) || 0,
      } : null,
      images: wooProduct.images?.map(img => img.src) || [],
      woocommerceId: wooProduct.id,
      wordpressId: wooProduct.id,
      syncStatus: 'SYNCED',
      lastSyncAt: new Date(),
      taxStatus: wooProduct.tax_status || 'taxable',
      taxClass: wooProduct.tax_class || 'standard',
      shippingClassSlug: wooProduct.shipping_class || null,
      category: wooProduct.categories?.[0]?.name || null,
      isActive: wooProduct.status === 'publish',
      isSellable: true,
    };

    // Gestione relazione ShippingClass
    if (shippingClassId) {
      productData.shippingClass = { connect: { id: shippingClassId } };
    }

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: productData,
      });
      results.updated++;
    } else {
      await prisma.product.create({
        data: productData,
      });
      results.imported++;
    }
  }

  // =============================================
  // SYNC GIACENZE
  // =============================================

  /**
   * Sync giacenze verso WooCommerce
   */
  async syncInventoryToWooCommerce(productId?: string): Promise<{ synced: number; errors: number }> {
    const results = { synced: 0, errors: 0 };

    const where: any = {
      woocommerceId: { not: null },
      isActive: true,
    };

    if (productId) {
      where.id = productId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        inventory: {
          where: { location: 'WEB' },
        },
      },
    });

    for (const product of products) {
      try {
        const totalStock = product.inventory.reduce(
          (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
          0
        );

        await this.wooCommerceRequest(
          `products/${product.woocommerceId}`,
          'PUT',
          {
            stock_quantity: totalStock,
            stock_status: totalStock > 0 ? 'instock' : 'outofstock',
          }
        );

        results.synced++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Errore sync giacenza ${product.sku}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  /**
   * Sync giacenza singolo prodotto (real-time dopo movimento)
   */
  async syncSingleProductInventory(productId: string): Promise<boolean> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: {
            where: { location: 'WEB' },
          },
        },
      });

      if (!product || !product.woocommerceId) {
        return false;
      }

      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );

      await this.wooCommerceRequest(
        `products/${product.woocommerceId}`,
        'PUT',
        {
          stock_quantity: totalStock,
          stock_status: totalStock > 0 ? 'instock' : 'outofstock',
        }
      );

      logger.info(`Giacenza ${product.sku} sincronizzata: ${totalStock} pz`);
      return true;

    } catch (error) {
      logger.error(`Errore sync giacenza prodotto ${productId}:`, error);
      return false;
    }
  }

  // =============================================
  // WEBHOOK ORDINI
  // =============================================

  /**
   * Processa webhook ordine da WooCommerce
   */
  async processOrderWebhook(wooOrder: WooCommerceOrder): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      logger.info(`Ricevuto ordine WooCommerce #${wooOrder.number}`);

      // Verifica se ordine già esiste
      const existingOrder = await prisma.order.findFirst({
        where: { wordpressId: wooOrder.id },
      });

      if (existingOrder) {
        // Aggiorna ordine esistente
        return await this.updateExistingOrder(existingOrder.id, wooOrder);
      }

      // Trova o crea cliente
      const customer = await this.findOrCreateCustomer(wooOrder);

      // Mappa stato ordine
      const status = this.mapWooCommerceStatus(wooOrder.status);

      // Crea ordine
      const order = await prisma.$transaction(async (tx) => {
        // 1. Crea ordine
        const newOrder = await tx.order.create({
          data: {
            orderNumber: `WP-${wooOrder.number}`,
            customerId: customer.id,
            source: 'WORDPRESS',
            status,
            subtotal: parseFloat(wooOrder.subtotal || '0') || 0,
            discount: parseFloat(wooOrder.discount_total || '0') || 0,
            tax: parseFloat(wooOrder.total_tax || '0') || 0,
            shipping: parseFloat(wooOrder.shipping_total || '0') || 0,
            total: parseFloat(wooOrder.total || '0') || 0,
            shippingAddress: {
              firstName: wooOrder.shipping.first_name,
              lastName: wooOrder.shipping.last_name,
              company: wooOrder.shipping.company,
              address1: wooOrder.shipping.address_1,
              address2: wooOrder.shipping.address_2,
              city: wooOrder.shipping.city,
              state: wooOrder.shipping.state,
              postcode: wooOrder.shipping.postcode,
              country: wooOrder.shipping.country,
            },
            billingAddress: {
              firstName: wooOrder.billing.first_name,
              lastName: wooOrder.billing.last_name,
              company: wooOrder.billing.company,
              address1: wooOrder.billing.address_1,
              address2: wooOrder.billing.address_2,
              city: wooOrder.billing.city,
              state: wooOrder.billing.state,
              postcode: wooOrder.billing.postcode,
              country: wooOrder.billing.country,
              email: wooOrder.billing.email,
              phone: wooOrder.billing.phone,
            },
            paymentMethod: wooOrder.payment_method_title,
            paymentStatus: wooOrder.status === 'completed' ? 'paid' : 'pending',
            wordpressId: wooOrder.id,
            notes: wooOrder.customer_note || null,
            orderDate: new Date(wooOrder.date_created),
          },
        });

        // 2. Crea righe ordine
        for (const item of wooOrder.line_items) {
          // Trova prodotto per WooCommerce ID o SKU
          const product = await tx.product.findFirst({
            where: {
              OR: [
                { woocommerceId: item.product_id },
                { sku: item.sku },
              ],
            },
          });

          if (!product) {
            logger.warn(`Prodotto non trovato per item ordine: ${item.sku}`);
            continue;
          }

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: product.id,
              productName: item.name,
              sku: item.sku || product.sku,
              quantity: item.quantity,
              unitPrice: item.price,
              tax: parseFloat(item.total_tax) || 0,
              total: parseFloat(item.total) || 0,
            },
          });

          // Se ordine è confermato, riserva stock
          if (status === 'CONFIRMED' || status === 'PROCESSING') {
            await this.reserveStock(tx, product.id, item.quantity);
          }
        }

        return newOrder;
      });

      // Notifica nuovo ordine
      await this.notifyNewOrder(order);

      logger.info(`Ordine WooCommerce #${wooOrder.number} importato con ID ${order.id}`);
      return { success: true, orderId: order.id };

    } catch (error: any) {
      logger.error(`Errore processamento ordine WooCommerce #${wooOrder.number}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Aggiorna ordine esistente da WooCommerce
   */
  private async updateExistingOrder(orderId: string, wooOrder: WooCommerceOrder): Promise<{ success: boolean; orderId: string }> {
    const newStatus = this.mapWooCommerceStatus(wooOrder.status);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        paymentStatus: wooOrder.status === 'completed' ? 'paid' : 'pending',
        notes: wooOrder.customer_note || undefined,
      },
    });

    logger.info(`Ordine ${orderId} aggiornato da WooCommerce (stato: ${newStatus})`);
    return { success: true, orderId };
  }

  /**
   * Mappa stato WooCommerce a stato interno
   */
  private mapWooCommerceStatus(wooStatus: string): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED' {
    const statusMap: Record<string, any> = {
      'pending': 'PENDING',
      'processing': 'CONFIRMED',
      'on-hold': 'PENDING',
      'completed': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED',
      'failed': 'CANCELLED',
    };
    return statusMap[wooStatus] || 'PENDING';
  }

  /**
   * Trova o crea cliente da dati WooCommerce
   */
  private async findOrCreateCustomer(wooOrder: WooCommerceOrder) {
    // Cerca per WordPress ID
    if (wooOrder.customer_id > 0) {
      const existing = await prisma.customer.findFirst({
        where: { wordpressId: wooOrder.customer_id },
      });
      if (existing) return existing;
    }

    // Cerca per email
    if (wooOrder.billing.email) {
      const existing = await prisma.customer.findFirst({
        where: { email: wooOrder.billing.email },
      });
      if (existing) return existing;
    }

    // Genera codice cliente
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'WEB-' } },
      orderBy: { code: 'desc' },
    });

    let nextNum = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/WEB-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    // Crea nuovo cliente
    return await prisma.customer.create({
      data: {
        code: `WEB-${nextNum.toString().padStart(6, '0')}`,
        type: 'B2C',
        firstName: wooOrder.billing.first_name,
        lastName: wooOrder.billing.last_name,
        businessName: wooOrder.billing.company || null,
        email: wooOrder.billing.email,
        phone: wooOrder.billing.phone,
        address: {
          street: `${wooOrder.billing.address_1} ${wooOrder.billing.address_2}`.trim(),
          city: wooOrder.billing.city,
          zip: wooOrder.billing.postcode,
          country: wooOrder.billing.country,
          state: wooOrder.billing.state,
        },
        wordpressId: wooOrder.customer_id > 0 ? wooOrder.customer_id : null,
      },
    });
  }

  /**
   * Riserva stock per item ordine
   */
  private async reserveStock(tx: any, productId: string, quantity: number) {
    const inventoryItem = await tx.inventoryItem.findFirst({
      where: {
        productId,
        location: 'WEB',
      },
    });

    if (inventoryItem) {
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          reservedQuantity: inventoryItem.reservedQuantity + quantity,
        },
      });
    }
  }

  /**
   * Notifica nuovo ordine
   */
  private async notifyNewOrder(order: any) {
    try {
      // Trova admin users
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'MANAGER', 'COMMERCIALE'] },
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await notificationService.createNotification({
          userId: admin.id,
          type: 'ORDER_RECEIVED',
          title: `Nuovo ordine #${order.orderNumber}`,
          message: `Ricevuto ordine da WordPress per €${order.total}`,
          link: `/orders/${order.id}`,
        });
      }
    } catch (error) {
      logger.error('Errore invio notifiche ordine:', error);
    }
  }

  // =============================================
  // SYNC CLIENTI
  // =============================================

  /**
   * Import clienti da WooCommerce
   */
  async importCustomersFromWooCommerce(): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = BATCH_CONFIG.ITEMS_PER_PAGE;
      let hasMore = true;
      let totalFetched = 0;

      while (hasMore) {
        logger.info(`Fetching clienti pagina ${page}...`);
        const customers = await this.wooCommerceRequest<WooCommerceCustomer[]>(
          `customers?page=${page}&per_page=${perPage}`,
          'GET',
          undefined,
          BATCH_CONFIG.REQUEST_TIMEOUT
        );

        if (customers.length === 0) {
          hasMore = false;
          continue;
        }

        totalFetched += customers.length;
        logger.info(`Ricevuti ${customers.length} clienti (totale: ${totalFetched})`);

        // Delay tra richieste
        if (page > 1) {
          await this.delay(BATCH_CONFIG.REQUEST_DELAY);
        }

        for (const wooCustomer of customers) {
          try {
            const existing = await prisma.customer.findFirst({
              where: {
                OR: [
                  { wordpressId: wooCustomer.id },
                  { email: wooCustomer.email },
                ],
              },
            });

            const customerData = {
              firstName: wooCustomer.first_name || wooCustomer.billing.first_name,
              lastName: wooCustomer.last_name || wooCustomer.billing.last_name,
              email: wooCustomer.email || wooCustomer.billing.email,
              phone: wooCustomer.billing.phone,
              businessName: wooCustomer.billing.company || null,
              address: {
                street: `${wooCustomer.billing.address_1} ${wooCustomer.billing.address_2}`.trim(),
                city: wooCustomer.billing.city,
                zip: wooCustomer.billing.postcode,
                country: wooCustomer.billing.country,
                state: wooCustomer.billing.state,
              },
              wordpressId: wooCustomer.id,
            };

            if (existing) {
              await prisma.customer.update({
                where: { id: existing.id },
                data: customerData,
              });
              results.updated++;
            } else {
              // Genera codice
              const lastCustomer = await prisma.customer.findFirst({
                where: { code: { startsWith: 'WEB-' } },
                orderBy: { code: 'desc' },
              });

              let nextNum = 1;
              if (lastCustomer) {
                const match = lastCustomer.code.match(/WEB-(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
              }

              await prisma.customer.create({
                data: {
                  ...customerData,
                  code: `WEB-${nextNum.toString().padStart(6, '0')}`,
                  type: 'B2C',
                },
              });
              results.imported++;
            }
          } catch (error) {
            logger.error(`Errore import cliente ${wooCustomer.email}:`, error);
            results.errors++;
          }
        }

        page++;
        if (customers.length < perPage) {
          hasMore = false;
        }
      }

    } catch (error) {
      logger.error('Errore import clienti:', error);
      throw error;
    }

    return results;
  }

  /**
   * Import singola pagina di clienti da WooCommerce (per job asincrono)
   * Ritorna risultati parziali + flag hasMore per continuare
   */
  async importCustomersPage(page: number, perPage: number = BATCH_CONFIG.ITEMS_PER_PAGE): Promise<{
    imported: number;
    updated: number;
    errors: number;
    hasMore: boolean;
    processedCount: number;
  }> {
    const results = { imported: 0, updated: 0, errors: 0, hasMore: true, processedCount: 0 };

    try {
      await this.ensureSettingsLoaded();

      logger.info(`[ImportCustomersPage] Fetching pagina ${page}...`);
      const customers = await this.wooCommerceRequest<WooCommerceCustomer[]>(
        `customers?page=${page}&per_page=${perPage}`,
        'GET',
        undefined,
        BATCH_CONFIG.REQUEST_TIMEOUT
      );

      if (customers.length === 0) {
        results.hasMore = false;
        return results;
      }

      results.processedCount = customers.length;
      logger.info(`[ImportCustomersPage] Ricevuti ${customers.length} clienti`);

      for (const wooCustomer of customers) {
        try {
          const existing = await prisma.customer.findFirst({
            where: {
              OR: [
                { wordpressId: wooCustomer.id },
                { email: wooCustomer.email },
              ],
            },
          });

          const customerData = {
            firstName: wooCustomer.first_name || wooCustomer.billing.first_name,
            lastName: wooCustomer.last_name || wooCustomer.billing.last_name,
            email: wooCustomer.email || wooCustomer.billing.email,
            phone: wooCustomer.billing.phone,
            businessName: wooCustomer.billing.company || null,
            address: {
              street: `${wooCustomer.billing.address_1} ${wooCustomer.billing.address_2}`.trim(),
              city: wooCustomer.billing.city,
              zip: wooCustomer.billing.postcode,
              country: wooCustomer.billing.country,
              state: wooCustomer.billing.state,
            },
            wordpressId: wooCustomer.id,
          };

          if (existing) {
            await prisma.customer.update({
              where: { id: existing.id },
              data: customerData,
            });
            results.updated++;
          } else {
            // Genera codice
            const lastCustomer = await prisma.customer.findFirst({
              where: { code: { startsWith: 'WEB-' } },
              orderBy: { code: 'desc' },
            });

            let nextNum = 1;
            if (lastCustomer) {
              const match = lastCustomer.code.match(/WEB-(\d+)/);
              if (match) nextNum = parseInt(match[1]) + 1;
            }

            await prisma.customer.create({
              data: {
                ...customerData,
                code: `WEB-${nextNum.toString().padStart(6, '0')}`,
                type: 'B2C',
              },
            });
            results.imported++;
          }
        } catch (error) {
          logger.error(`[ImportCustomersPage] Errore import cliente ${wooCustomer.email}:`, error);
          results.errors++;
        }
      }

      // Se abbiamo ricevuto meno clienti del limite, non ci sono più pagine
      if (customers.length < perPage) {
        results.hasMore = false;
      }

    } catch (error) {
      logger.error('[ImportCustomersPage] Errore:', error);
      throw error;
    }

    return results;
  }

  /**
   * Ottiene il conteggio totale clienti da WooCommerce (per stima progress)
   */
  async getWooCommerceCustomersCount(): Promise<number> {
    try {
      await this.ensureSettingsLoaded();

      // Usa HEAD request o una richiesta con per_page=1 per ottenere il totale dall'header
      const response = await fetch(
        `${this.baseUrl}/wp-json/wc/v3/customers?per_page=1`,
        {
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );

      const totalHeader = response.headers.get('X-WP-Total');
      return totalHeader ? parseInt(totalHeader, 10) : 0;
    } catch (error) {
      logger.error('[getWooCommerceCustomersCount] Errore:', error);
      return 0;
    }
  }

  /**
   * Import ordini da WooCommerce
   */
  async importOrdersFromWooCommerce(status?: string): Promise<{ imported: number; updated: number; errors: number }> {
    await this.ensureSettingsLoaded();
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = BATCH_CONFIG.ITEMS_PER_PAGE;
      let hasMore = true;

      // Costruisci parametro status per la query
      const statusParam = status ? `&status=${status}` : '';

      while (hasMore) {
        logger.info(`Fetching ordini pagina ${page}...`);
        const orders = await this.wooCommerceRequest<WooCommerceOrder[]>(
          `orders?page=${page}&per_page=${perPage}${statusParam}`,
          'GET',
          undefined,
          BATCH_CONFIG.REQUEST_TIMEOUT
        );

        if (orders.length === 0) {
          hasMore = false;
          continue;
        }

        logger.info(`Ricevuti ${orders.length} ordini`);

        for (const wooOrder of orders) {
          try {
            // Verifica se l'ordine esiste già
            const existing = await prisma.order.findFirst({
              where: {
                OR: [
                  { wordpressId: wooOrder.id },
                  { orderNumber: wooOrder.number?.toString() },
                ],
              },
            });

            // Cerca il cliente
            let customerId: string | undefined = undefined;
            if (wooOrder.customer_id && wooOrder.customer_id > 0) {
              const customer = await prisma.customer.findFirst({
                where: { wordpressId: wooOrder.customer_id },
              });
              customerId = customer?.id;
            }

            // Se non troviamo il cliente per wordpressId, proviamo con l'email
            if (!customerId && wooOrder.billing?.email) {
              const customer = await prisma.customer.findFirst({
                where: { email: wooOrder.billing.email },
              });
              customerId = customer?.id;
            }

            // Se non abbiamo un cliente, creiamolo al volo
            if (!customerId && wooOrder.billing?.email) {
              const lastCustomer = await prisma.customer.findFirst({
                where: { code: { startsWith: 'WEB-' } },
                orderBy: { code: 'desc' },
              });

              let nextNum = 1;
              if (lastCustomer) {
                const match = lastCustomer.code.match(/WEB-(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
              }

              const newCustomer = await prisma.customer.create({
                data: {
                  code: `WEB-${nextNum.toString().padStart(6, '0')}`,
                  type: 'B2C',
                  firstName: wooOrder.billing.first_name || 'Guest',
                  lastName: wooOrder.billing.last_name || '',
                  email: wooOrder.billing.email,
                  phone: wooOrder.billing.phone || null,
                  wordpressId: wooOrder.customer_id || null,
                },
              });
              customerId = newCustomer.id;
            }

            // Mappa lo stato dell'ordine
            const orderStatus = this.mapWooCommerceStatusToInternal(wooOrder.status) as any;

            const total = parseFloat(wooOrder.total) || 0;
            const tax = parseFloat(wooOrder.total_tax || '0');
            const shipping = parseFloat(wooOrder.shipping_total || '0');
            const subtotal = total - shipping - tax;

            const shippingAddress = wooOrder.shipping ? {
              firstName: wooOrder.shipping.first_name,
              lastName: wooOrder.shipping.last_name,
              company: wooOrder.shipping.company,
              address1: wooOrder.shipping.address_1,
              address2: wooOrder.shipping.address_2,
              city: wooOrder.shipping.city,
              state: wooOrder.shipping.state,
              postcode: wooOrder.shipping.postcode,
              country: wooOrder.shipping.country,
            } : undefined;

            const billingAddress = wooOrder.billing ? {
              firstName: wooOrder.billing.first_name,
              lastName: wooOrder.billing.last_name,
              company: wooOrder.billing.company,
              address1: wooOrder.billing.address_1,
              address2: wooOrder.billing.address_2,
              city: wooOrder.billing.city,
              state: wooOrder.billing.state,
              postcode: wooOrder.billing.postcode,
              country: wooOrder.billing.country,
              email: wooOrder.billing.email,
              phone: wooOrder.billing.phone,
            } : undefined;

            if (existing) {
              await prisma.order.update({
                where: { id: existing.id },
                data: {
                  status: orderStatus,
                  total,
                  subtotal,
                  tax,
                  shipping,
                  wordpressId: wooOrder.id,
                  customerNote: wooOrder.customer_note || null,
                  shippingAddress: shippingAddress || undefined,
                  billingAddress: billingAddress || undefined,
                  orderDate: new Date(wooOrder.date_created),
                },
              });
              results.updated++;
            } else if (customerId) {
              await prisma.order.create({
                data: {
                  orderNumber: wooOrder.number?.toString() || `WOO-${wooOrder.id}`,
                  customerId,
                  status: orderStatus,
                  source: 'WORDPRESS',
                  total,
                  subtotal,
                  tax,
                  shipping,
                  wordpressId: wooOrder.id,
                  customerNote: wooOrder.customer_note || null,
                  shippingAddress: shippingAddress || undefined,
                  billingAddress: billingAddress || undefined,
                  orderDate: new Date(wooOrder.date_created),
                },
              });
              results.imported++;
            } else {
              logger.warn(`Ordine ${wooOrder.id} skipped: nessun cliente trovato e email mancante`);
              results.errors++;
            }
          } catch (error) {
            logger.error(`Errore import ordine ${wooOrder.id}:`, error);
            results.errors++;
          }
        }

        logger.info(`Orders page ${page}: ${orders.length} processed (${results.imported} imported, ${results.updated} updated)`);

        page++;
        if (orders.length < perPage) {
          hasMore = false;
        } else {
          // Delay tra richieste per evitare rate limiting
          await this.delay(BATCH_CONFIG.REQUEST_DELAY);
        }
      }

    } catch (error) {
      logger.error('Errore import ordini:', error);
      throw error;
    }

    return results;
  }

  // =============================================
  // AGGIORNAMENTO STATO ORDINE
  // =============================================

  /**
   * Aggiorna stato ordine su WooCommerce
   */
  async updateOrderStatusOnWooCommerce(orderId: string, newStatus: string): Promise<boolean> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || !order.wordpressId) {
        return false;
      }

      // Mappa stato interno a WooCommerce
      const wooStatus = this.mapInternalStatusToWooCommerce(newStatus);

      await this.wooCommerceRequest(
        `orders/${order.wordpressId}`,
        'PUT',
        { status: wooStatus }
      );

      logger.info(`Stato ordine ${order.orderNumber} aggiornato su WooCommerce: ${wooStatus}`);
      return true;

    } catch (error) {
      logger.error(`Errore aggiornamento stato ordine ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Mappa stato interno a WooCommerce
   */
  private mapInternalStatusToWooCommerce(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'CONFIRMED': 'processing',
      'PROCESSING': 'processing',
      'READY': 'processing',
      'SHIPPED': 'completed',
      'DELIVERED': 'completed',
      'CANCELLED': 'cancelled',
      'REFUNDED': 'refunded',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Mappa stato WooCommerce a stato interno
   */
  private mapWooCommerceStatusToInternal(wooStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'on-hold': 'PENDING',
      'completed': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED',
      'failed': 'CANCELLED',
      'trash': 'CANCELLED',
    };
    return statusMap[wooStatus] || 'PENDING';
  }

  // =============================================
  // HEALTH CHECK
  // =============================================

  /**
   * Verifica connessione a WooCommerce
   */
  async healthCheck(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      // Assicurati che le impostazioni siano caricate dal DB
      await this.ensureSettingsLoaded();

      if (!this.isConfigured()) {
        return { connected: false, error: 'WordPress non configurato' };
      }

      const info = await this.wooCommerceRequest<any>('');

      return {
        connected: true,
        version: info.version || 'unknown',
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  // =============================================
  // PRODOTTI VARIABILI
  // =============================================

  /**
   * Sync prodotto variabile con tutte le variazioni verso WooCommerce
   */
  /**
   * Sync prodotto variabile verso WooCommerce - VERSIONE COMPLETA
   * Sincronizza prodotto parent e tutte le variazioni con tutti i campi
   */
  async syncVariableProductToWooCommerce(productId: string): Promise<{ success: boolean; woocommerceId?: number; variationsSynced?: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Carica dati completi del prodotto
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            where: { isActive: true },
            include: {
              inventory: { where: { location: 'WEB' } },
              images: { orderBy: { position: 'asc' }, take: 1 },
            },
          },
          inventory: { where: { location: 'WEB' } },
          categories: { include: { category: true } },
          productImages: { where: { variantId: null }, orderBy: { position: 'asc' } },
          shippingClass: true,
        },
      });

      if (!product) {
        return { success: false, error: 'Prodotto non trovato' };
      }

      if (product.type !== 'WITH_VARIANTS') {
        return { success: false, error: 'Il prodotto non è di tipo variabile' };
      }

      // Genera attributi automaticamente dalle varianti attive
      const autoAttributes = mapAttributesForVariableProduct(product, product.variants);

      // Usa il nuovo helper per mappare tutti i campi
      const wooData = mapProductToWooCommerce(
        product,
        product.inventory,
        product.categories,
        product.productImages,
        'variable'
      );

      // Sovrascrivi/aggiungi campi specifici per prodotti variabili
      wooData.manage_stock = false; // Lo stock è gestito per variazione
      wooData.attributes = autoAttributes;

      // Se ci sono default attributes salvati, aggiungili
      if (product.wcDefaultAttributes) {
        wooData.default_attributes = product.wcDefaultAttributes as any;
      }

      let woocommerceId: number;
      let wcResponse: any;

      if (product.woocommerceId) {
        wcResponse = await this.wooCommerceRequest<WooCommerceProduct>(
          `products/${product.woocommerceId}`,
          'PUT',
          wooData
        );
        woocommerceId = wcResponse.id;

        await logSync('TO_WP', 'PRODUCT', product.id, 'UPDATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      } else {
        wcResponse = await this.wooCommerceRequest<WooCommerceProduct>(
          'products',
          'POST',
          wooData
        );
        woocommerceId = wcResponse.id;

        await logSync('TO_WP', 'PRODUCT', product.id, 'CREATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      }

      // Aggiorna DB con dati da WooCommerce
      await prisma.product.update({
        where: { id: productId },
        data: {
          woocommerceId,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
          wcPermalink: wcResponse.permalink || null,
          wcDateModified: wcResponse.date_modified ? new Date(wcResponse.date_modified) : new Date(),
          wcPriceHtml: wcResponse.price_html || null,
        },
      });

      // Sync tutte le variazioni
      let variationsSynced = 0;
      let variationsErrors = 0;

      for (const variant of product.variants) {
        if (!variant.webActive) continue;

        try {
          const varResult = await this.syncVariationToWooCommerce(woocommerceId, variant.id, product);
          if (varResult.success) {
            variationsSynced++;
          } else {
            variationsErrors++;
          }
        } catch (err) {
          variationsErrors++;
          logger.error(`Errore sync variante ${variant.sku}:`, err);
        }

        // Rate limiting
        await this.delay(150);
      }

      logger.info(`Prodotto variabile ${product.sku} sincronizzato (WC ID: ${woocommerceId}) - ${variationsSynced} variazioni, ${variationsErrors} errori`);
      return { success: true, woocommerceId, variationsSynced };

    } catch (error: any) {
      await logSync('TO_WP', 'PRODUCT', productId, 'SYNC', 'FAILED', null, null, error.message, Date.now() - startTime);

      await prisma.product.update({
        where: { id: productId },
        data: { syncStatus: 'ERROR', lastSyncAt: new Date() },
      });

      logger.error(`Errore sync prodotto variabile ${productId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync singola variazione verso WooCommerce - VERSIONE COMPLETA
   * Sincronizza tutti i campi della variazione
   */
  async syncVariationToWooCommerce(
    parentWooId: number,
    variantId: string,
    parentProduct?: any
  ): Promise<{ success: boolean; variationId?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: true,
          inventory: { where: { location: 'WEB' } },
          images: { orderBy: { position: 'asc' }, take: 1 },
        },
      });

      if (!variant) {
        return { success: false, error: 'Variante non trovata' };
      }

      const product = parentProduct || variant.product;

      // Usa il nuovo helper per mappare tutti i campi
      const wooData = mapVariantToWooCommerce(variant, product, variant.inventory);

      // Aggiungi immagine se disponibile
      if (variant.images && variant.images.length > 0) {
        wooData.image = {
          ...(variant.images[0].woocommerceId ? { id: variant.images[0].woocommerceId } : {}),
          src: variant.images[0].src,
          alt: variant.name,
        };
      } else if (variant.mainImageUrl) {
        wooData.image = {
          ...(variant.mainImageId ? { id: variant.mainImageId } : {}),
          src: variant.mainImageUrl,
          alt: variant.name,
        };
      }

      // Aggiungi dimensioni/peso se presenti sulla variante
      if (variant.weight) {
        wooData.weight = variant.weight.toString();
      }
      if (variant.dimensions) {
        const dims = variant.dimensions as { width?: number; height?: number; depth?: number };
        wooData.dimensions = {
          width: dims.width?.toString() || '',
          height: dims.height?.toString() || '',
          length: dims.depth?.toString() || '',
        };
      }

      let variationId: number;
      let wcResponse: any;

      if (variant.woocommerceVariationId) {
        wcResponse = await this.wooCommerceRequest<any>(
          `products/${parentWooId}/variations/${variant.woocommerceVariationId}`,
          'PUT',
          wooData
        );
        variationId = wcResponse.id;

        await logSync('TO_WP', 'VARIANT', variant.id, 'UPDATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      } else {
        wcResponse = await this.wooCommerceRequest<any>(
          `products/${parentWooId}/variations`,
          'POST',
          wooData
        );
        variationId = wcResponse.id;

        await logSync('TO_WP', 'VARIANT', variant.id, 'CREATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      }

      // Aggiorna DB
      await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          woocommerceVariationId: variationId,
          mainImageId: wcResponse.image?.id || null,
        },
      });

      return { success: true, variationId };

    } catch (error: any) {
      await logSync('TO_WP', 'VARIANT', variantId, 'SYNC', 'FAILED', null, null, error.message, Date.now() - startTime);

      logger.error(`Errore sync variazione ${variantId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Costruisce array attributi per WooCommerce prodotto variabile
   * @deprecated Reserved for future use
   */
  // @ts-ignore - reserved method for future use
  private _buildWooAttributes(webAttributes: { name: string; options: string[] }[] | null): any[] {
    if (!webAttributes || !Array.isArray(webAttributes)) return [];

    return webAttributes.map((attr, index) => ({
      name: attr.name,
      position: index,
      visible: true,
      variation: true,
      options: attr.options || [],
    }));
  }

  /**
   * Costruisce attributi per variazione WooCommerce
   * @deprecated Reserved for future use
   */
  // @ts-ignore - reserved method for future use
  private _buildVariationAttributes(attributes: Record<string, string> | null): any[] {
    if (!attributes) return [];

    return Object.entries(attributes).map(([name, option]) => ({
      name,
      option,
    }));
  }

  // =============================================
  // PRODOTTI DIGITALI
  // =============================================

  /**
   * Sync prodotto digitale verso WooCommerce
   */
  async syncDigitalProductToWooCommerce(productId: string): Promise<{ success: boolean; woocommerceId?: number; error?: string }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return { success: false, error: 'Prodotto non trovato' };
      }

      if (product.type !== 'DIGITAL') {
        return { success: false, error: 'Il prodotto non è di tipo digitale' };
      }

      // Prepara file scaricabili
      const downloads = this.buildDownloadableFiles(product.downloadFiles as any[]);

      // Prepara dati prodotto digitale
      const wooData: any = {
        sku: product.sku,
        name: product.name,
        type: 'simple',
        virtual: true,
        downloadable: true,
        description: product.webDescription || product.description || '',
        short_description: product.webShortDescription || '',
        status: product.webActive ? 'publish' : 'draft',
        regular_price: (product.webPrice || product.price).toString(),
        manage_stock: false, // I prodotti digitali non hanno stock fisico
        tax_status: product.taxStatus as any,
        tax_class: product.taxClass,
        downloads,
        download_limit: -1, // Illimitato
        download_expiry: -1, // Mai scade
        images: product.images ? (product.images as any[]).map((url: string) => ({ src: url })) : [],
      };

      // SEO meta
      if (product.webMetaTitle || product.webMetaDescription) {
        wooData.meta_data = [];
        if (product.webMetaTitle) {
          wooData.meta_data.push({ key: '_yoast_wpseo_title', value: product.webMetaTitle });
        }
        if (product.webMetaDescription) {
          wooData.meta_data.push({ key: '_yoast_wpseo_metadesc', value: product.webMetaDescription });
        }
      }

      if (product.webSlug) {
        wooData.slug = product.webSlug;
      }

      let woocommerceId: number;

      if (product.woocommerceId) {
        const updated = await this.wooCommerceRequest<WooCommerceProduct>(
          `products/${product.woocommerceId}`,
          'PUT',
          wooData
        );
        woocommerceId = updated.id;
      } else {
        const created = await this.wooCommerceRequest<WooCommerceProduct>(
          'products',
          'POST',
          wooData
        );
        woocommerceId = created.id;
      }

      await prisma.product.update({
        where: { id: productId },
        data: {
          woocommerceId,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        },
      });

      logger.info(`Prodotto digitale ${product.sku} sincronizzato (ID: ${woocommerceId})`);
      return { success: true, woocommerceId };

    } catch (error: any) {
      logger.error(`Errore sync prodotto digitale ${productId}:`, error);

      await prisma.product.update({
        where: { id: productId },
        data: {
          syncStatus: 'ERROR',
          lastSyncAt: new Date(),
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Costruisce array file scaricabili per WooCommerce
   */
  private buildDownloadableFiles(downloadFiles: { name: string; url: string; expiry?: number }[] | null): any[] {
    if (!downloadFiles || !Array.isArray(downloadFiles)) return [];

    return downloadFiles.map(file => ({
      name: file.name,
      file: file.url,
    }));
  }

  // =============================================
  // SYNC PRODOTTI CON CAMPI WEB
  // =============================================

  /**
   * Sync prodotto usando i campi web-specifici
   * Usa webPrice, webDescription, webActive invece dei campi standard
   */
  async syncWebProductToWooCommerce(productId: string): Promise<{ success: boolean; woocommerceId?: number; error?: string }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          inventory: {
            where: { location: 'WEB' },
          },
        },
      });

      if (!product) {
        return { success: false, error: 'Prodotto non trovato' };
      }

      // Se non è attivo per il web, skip
      if (!product.webActive) {
        // Se esiste su WooCommerce, mettilo in draft
        if (product.woocommerceId) {
          await this.wooCommerceRequest(
            `products/${product.woocommerceId}`,
            'PUT',
            { status: 'draft' }
          );
        }
        return { success: true, woocommerceId: product.woocommerceId || undefined };
      }

      // Dispatch per tipo prodotto
      switch (product.type) {
        case 'WITH_VARIANTS':
          return await this.syncVariableProductToWooCommerce(productId);

        case 'DIGITAL':
          return await this.syncDigitalProductToWooCommerce(productId);

        default:
          return await this.syncSimpleWebProduct(product);
      }

    } catch (error: any) {
      logger.error(`Errore sync web product ${productId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync prodotto semplice con campi web - VERSIONE COMPLETA
   * Sincronizza tutti i campi WooCommerce supportati
   */
  private async syncSimpleWebProduct(product: any): Promise<{ success: boolean; woocommerceId?: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Carica dati completi del prodotto
      const fullProduct = await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          inventory: { where: { location: 'WEB' } },
          categories: { include: { category: true } },
          productImages: { where: { variantId: null }, orderBy: { position: 'asc' } },
          shippingClass: true,
        },
      });

      if (!fullProduct) {
        return { success: false, error: 'Prodotto non trovato' };
      }

      // Usa il nuovo helper per mappare tutti i campi
      const wooData = mapProductToWooCommerce(
        fullProduct,
        fullProduct.inventory,
        fullProduct.categories,
        fullProduct.productImages,
        'simple'
      );

      // Usa shipping class ID se disponibile
      if (fullProduct.shippingClass?.slug) {
        wooData.shipping_class = fullProduct.shippingClass.slug;
      }

      let woocommerceId: number;
      let wcResponse: any;

      if (fullProduct.woocommerceId) {
        // Aggiorna prodotto esistente
        wcResponse = await this.wooCommerceRequest<WooCommerceProduct>(
          `products/${fullProduct.woocommerceId}`,
          'PUT',
          wooData
        );
        woocommerceId = wcResponse.id;

        await logSync('TO_WP', 'PRODUCT', fullProduct.id, 'UPDATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      } else {
        // Crea nuovo prodotto
        wcResponse = await this.wooCommerceRequest<WooCommerceProduct>(
          'products',
          'POST',
          wooData
        );
        woocommerceId = wcResponse.id;

        await logSync('TO_WP', 'PRODUCT', fullProduct.id, 'CREATE', 'SUCCESS', wooData, wcResponse, undefined, Date.now() - startTime);
      }

      // Aggiorna DB con dati da WooCommerce
      await prisma.product.update({
        where: { id: fullProduct.id },
        data: {
          woocommerceId,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
          wcPermalink: wcResponse.permalink || null,
          wcDateModified: wcResponse.date_modified ? new Date(wcResponse.date_modified) : new Date(),
          wcPriceHtml: wcResponse.price_html || null,
          wcTotalSales: wcResponse.total_sales || 0,
        },
      });

      // Aggiorna WooCommerce ID delle immagini
      if (wcResponse.images && fullProduct.productImages.length > 0) {
        for (let i = 0; i < Math.min(wcResponse.images.length, fullProduct.productImages.length); i++) {
          await prisma.productImage.update({
            where: { id: fullProduct.productImages[i].id },
            data: { woocommerceId: wcResponse.images[i].id },
          });
        }
      }

      logger.info(`Prodotto semplice ${fullProduct.sku} sincronizzato (WC ID: ${woocommerceId})`);
      return { success: true, woocommerceId };

    } catch (error: any) {
      await logSync('TO_WP', 'PRODUCT', product.id, 'SYNC', 'FAILED', null, null, error.message, Date.now() - startTime);

      await prisma.product.update({
        where: { id: product.id },
        data: { syncStatus: 'ERROR', lastSyncAt: new Date() },
      });

      throw error;
    }
  }

  /**
   * Sync tutti i prodotti con webActive=true verso WooCommerce
   */
  async syncAllWebProductsToWooCommerce(): Promise<{ synced: number; errors: number; details: any[] }> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        webActive: true,
      },
      select: { id: true, sku: true, type: true },
    });

    const results = {
      synced: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const product of products) {
      const result = await this.syncWebProductToWooCommerce(product.id);

      if (result.success) {
        results.synced++;
      } else {
        results.errors++;
      }

      results.details.push({
        sku: product.sku,
        type: product.type,
        ...result,
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info(`Sync web products: ${results.synced} sincronizzati, ${results.errors} errori`);
    return results;
  }

  // =============================================
  // PLUGIN COMMUNICATION (ricezione dati dal plugin WP)
  // =============================================

  /**
   * Processa ordine ricevuto dal plugin WordPress
   */
  async processPluginOrder(orderData: any): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      logger.info(`Ricevuto ordine da plugin WP #${orderData.orderNumber}`);

      // Verifica se ordine già esiste
      const existingOrder = await prisma.order.findFirst({
        where: { wordpressId: orderData.wordpressOrderId },
      });

      if (existingOrder) {
        return { success: true, orderId: existingOrder.id };
      }

      // Trova o crea cliente
      const customer = await this.findOrCreateCustomerFromPlugin(orderData);

      // Mappa stato
      const status = this.mapWooCommerceStatus(orderData.status);

      // Crea ordine
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNumber: `WP-${orderData.orderNumber}`,
            customerId: customer.id,
            source: 'WORDPRESS',
            status,
            subtotal: orderData.subtotal || 0,
            discount: orderData.discount || 0,
            tax: orderData.tax || 0,
            shipping: orderData.shippingTotal || 0,
            total: orderData.total || 0,
            shippingAddress: orderData.shipping || null,
            billingAddress: orderData.billing || null,
            paymentMethod: orderData.paymentMethodTitle || orderData.paymentMethod,
            paymentStatus: orderData.isPaid ? 'paid' : 'pending',
            wordpressId: orderData.wordpressOrderId,
            notes: orderData.customerNote || null,
            orderDate: orderData.dateCreated ? new Date(orderData.dateCreated) : new Date(),
          },
        });

        // Crea righe ordine
        for (const item of (orderData.items || [])) {
          // Trova prodotto
          let product = null;

          if (item.productId) {
            product = await tx.product.findFirst({
              where: { woocommerceId: item.productId },
            });
          }

          if (!product && item.sku) {
            product = await tx.product.findFirst({
              where: { sku: item.sku },
            });
          }

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: product?.id || '',
              productName: item.name,
              sku: item.sku || product?.sku || '',
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              tax: item.tax || 0,
              total: item.total || 0,
            },
          });

          // Riserva stock se ordine confermato
          if (product && (status === 'CONFIRMED' || status === 'PROCESSING')) {
            await this.reserveStock(tx, product.id, item.quantity);
          }
        }

        return newOrder;
      });

      // Notifica
      await this.notifyNewOrder(order);

      return { success: true, orderId: order.id };

    } catch (error: any) {
      logger.error(`Errore processamento ordine plugin:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa cambio stato ordine dal plugin
   */
  async processPluginOrderStatus(data: any): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { wordpressId: data.wordpressOrderId },
            { id: data.erpOrderId },
          ],
        },
      });

      if (!order) {
        return { success: false, error: 'Ordine non trovato' };
      }

      const newStatus = this.mapWooCommerceStatus(data.newStatus);

      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus },
      });

      logger.info(`Stato ordine ${order.orderNumber} aggiornato: ${newStatus}`);
      return { success: true };

    } catch (error: any) {
      logger.error(`Errore aggiornamento stato ordine:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa nuovo cliente dal plugin
   */
  async processPluginCustomer(customerData: any): Promise<{ success: boolean; customerId?: string; error?: string }> {
    try {
      // Cerca cliente esistente
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            { wordpressId: customerData.wordpressCustomerId },
            { email: customerData.email },
          ],
        },
      });

      const data = {
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.email,
        phone: customerData.phone,
        businessName: customerData.company || null,
        address: customerData.billing ? {
          street: `${customerData.billing.address1 || ''} ${customerData.billing.address2 || ''}`.trim(),
          city: customerData.billing.city || '',
          zip: customerData.billing.postcode || '',
          country: customerData.billing.country || '',
          state: customerData.billing.state || '',
        } : null,
        wordpressId: customerData.wordpressCustomerId,
        taxId: customerData.vatNumber || null,
        fiscalCode: customerData.fiscalCode || null,
      };

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            ...data,
            address: data.address || undefined,
          } as any,
        });
        return { success: true, customerId: existing.id };
      }

      // Genera codice
      const lastCustomer = await prisma.customer.findFirst({
        where: { code: { startsWith: 'WEB-' } },
        orderBy: { code: 'desc' },
      });

      let nextNum = 1;
      if (lastCustomer) {
        const match = lastCustomer.code.match(/WEB-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }

      const customer = await prisma.customer.create({
        data: {
          ...data,
          address: data.address || undefined,
          code: `WEB-${nextNum.toString().padStart(6, '0')}`,
          type: 'B2C',
        } as any,
      });

      return { success: true, customerId: customer.id };

    } catch (error: any) {
      logger.error(`Errore processamento cliente plugin:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trova o crea cliente dai dati del plugin
   */
  private async findOrCreateCustomerFromPlugin(orderData: any) {
    // Cerca per WordPress customer ID
    if (orderData.customerId && orderData.customerId > 0) {
      const existing = await prisma.customer.findFirst({
        where: { wordpressId: orderData.customerId },
      });
      if (existing) return existing;
    }

    // Cerca per email
    if (orderData.billing?.email) {
      const existing = await prisma.customer.findFirst({
        where: { email: orderData.billing.email },
      });
      if (existing) return existing;
    }

    // Genera codice
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'WEB-' } },
      orderBy: { code: 'desc' },
    });

    let nextNum = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/WEB-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    // Crea cliente
    return await prisma.customer.create({
      data: {
        code: `WEB-${nextNum.toString().padStart(6, '0')}`,
        type: 'B2C',
        firstName: orderData.billing?.firstName || '',
        lastName: orderData.billing?.lastName || '',
        businessName: orderData.billing?.company || null,
        email: orderData.billing?.email || null,
        phone: orderData.billing?.phone || null,
        address: orderData.billing ? {
          street: `${orderData.billing.address1 || ''} ${orderData.billing.address2 || ''}`.trim(),
          city: orderData.billing.city || '',
          zip: orderData.billing.postcode || '',
          country: orderData.billing.country || '',
          state: orderData.billing.state || '',
        } : undefined,
        taxId: orderData.vatNumber || null,
        fiscalCode: orderData.fiscalCode || null,
        wordpressId: orderData.customerId > 0 ? orderData.customerId : null,
      } as any,
    });
  }

  // =============================================
  // IMPORT MASSIVO
  // =============================================

  /**
   * Import massivo da WooCommerce a ERP
   * Importa prodotti, clienti e ordini
   */
  async bulkImportFromWooCommerce(options: {
    importProducts?: boolean;
    importCustomers?: boolean;
    importOrders?: boolean;
    overwriteExisting?: boolean;
    productStatus?: 'publish' | 'draft' | 'any';
    orderStatus?: string;
    fromDate?: Date;
  }): Promise<{
    products: { imported: number; updated: number; errors: number };
    customers: { imported: number; updated: number; errors: number };
    orders: { imported: number; updated: number; errors: number };
  }> {
    const results = {
      products: { imported: 0, updated: 0, errors: 0 },
      customers: { imported: 0, updated: 0, errors: 0 },
      orders: { imported: 0, updated: 0, errors: 0 },
    };

    logger.info('Avvio import massivo da WooCommerce', options);

    // 1. Import Clienti (prima dei prodotti/ordini per le relazioni)
    if (options.importCustomers) {
      results.customers = await this.importCustomersFromWooCommerce();
      logger.info(`Clienti importati: ${results.customers.imported}, aggiornati: ${results.customers.updated}`);
    }

    // 2. Import Prodotti
    if (options.importProducts) {
      results.products = await this.bulkImportProducts({
        status: options.productStatus || 'publish',
        overwrite: options.overwriteExisting || false,
      });
      logger.info(`Prodotti importati: ${results.products.imported}, aggiornati: ${results.products.updated}`);
    }

    // 3. Import Ordini
    if (options.importOrders) {
      results.orders = await this.bulkImportOrders({
        status: options.orderStatus,
        fromDate: options.fromDate,
        overwrite: options.overwriteExisting || false,
      });
      logger.info(`Ordini importati: ${results.orders.imported}, aggiornati: ${results.orders.updated}`);
    }

    logger.info('Import massivo completato', results);
    return results;
  }

  /**
   * Import prodotti con opzioni avanzate
   */
  private async bulkImportProducts(options: {
    status: 'publish' | 'draft' | 'any';
    overwrite: boolean;
  }): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const statusParam = options.status === 'any' ? '' : `&status=${options.status}`;
        const products = await this.wooCommerceRequest<WooCommerceProduct[]>(
          `products?page=${page}&per_page=${perPage}${statusParam}`
        );

        if (products.length === 0) {
          hasMore = false;
          continue;
        }

        for (const wooProduct of products) {
          try {
            // Cerca prodotto esistente
            const existing = await prisma.product.findFirst({
              where: {
                OR: [
                  { woocommerceId: wooProduct.id },
                  { sku: wooProduct.sku },
                ],
              },
            });

            // Se esiste e non vogliamo sovrascrivere, skip
            if (existing && !options.overwrite) {
              continue;
            }

            const productData = this.mapWooProductToErp(wooProduct);

            if (existing) {
              await prisma.product.update({
                where: { id: existing.id },
                data: productData,
              });
              results.updated++;
            } else {
              await prisma.product.create({
                data: productData,
              });
              results.imported++;
            }

            // Import variazioni per prodotti variabili
            if (wooProduct.type === 'variable' && wooProduct.variations?.length > 0) {
              await this.importProductVariations(wooProduct);
            }

          } catch (error) {
            logger.error(`Errore import prodotto ${wooProduct.sku}:`, error);
            results.errors++;
          }
        }

        page++;
        if (products.length < perPage) {
          hasMore = false;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } catch (error) {
      logger.error('Errore bulk import prodotti:', error);
      throw error;
    }

    return results;
  }

  /**
   * Import variazioni prodotto da WooCommerce
   */
  private async importProductVariations(wooProduct: WooCommerceProduct): Promise<void> {
    try {
      const variations = await this.wooCommerceRequest<any[]>(
        `products/${wooProduct.id}/variations?per_page=100`
      );

      const erpProduct = await prisma.product.findFirst({
        where: { woocommerceId: wooProduct.id },
      });

      if (!erpProduct) return;

      for (const variation of variations) {
        const existing = await prisma.productVariant.findFirst({
          where: {
            OR: [
              { woocommerceVariationId: variation.id },
              { sku: variation.sku },
            ],
          },
        });

        const variantData = {
          productId: erpProduct.id,
          sku: variation.sku || `${wooProduct.sku}-VAR-${variation.id}`,
          name: variation.attributes?.map((a: any) => a.option).join(' / ') || `Variante ${variation.id}`,
          attributes: variation.attributes?.reduce((acc: any, attr: any) => {
            acc[attr.name] = attr.option;
            return acc;
          }, {}) || {},
          priceDelta: (parseFloat(variation.regular_price) || 0) - (parseFloat(wooProduct.regular_price) || 0),
          webPrice: parseFloat(variation.regular_price) || null,
          webActive: variation.status === 'publish',
          woocommerceVariationId: variation.id,
          isActive: variation.status === 'publish',
        };

        if (existing) {
          await prisma.productVariant.update({
            where: { id: existing.id },
            data: variantData,
          });
        } else {
          await prisma.productVariant.create({
            data: variantData,
          });
        }
      }
    } catch (error) {
      logger.error(`Errore import variazioni per ${wooProduct.sku}:`, error);
    }
  }

  /**
   * Mappa prodotto WooCommerce a ERP
   */
  private mapWooProductToErp(wooProduct: WooCommerceProduct): any {
    return {
      sku: wooProduct.sku || `WOO-${wooProduct.id}`,
      name: wooProduct.name,
      description: wooProduct.description || wooProduct.short_description,
      type: wooProduct.type === 'variable' ? 'WITH_VARIANTS' :
            (wooProduct.downloadable ? 'DIGITAL' : 'SIMPLE'),
      price: parseFloat(wooProduct.regular_price) || 0,
      cost: 0,
      weight: wooProduct.weight ? parseFloat(wooProduct.weight) : null,
      dimensions: wooProduct.dimensions ? {
        width: parseFloat(wooProduct.dimensions.width) || 0,
        height: parseFloat(wooProduct.dimensions.height) || 0,
        depth: parseFloat(wooProduct.dimensions.length) || 0,
      } : null,
      images: wooProduct.images?.map(img => img.src) || [],
      category: wooProduct.categories?.[0]?.name || null,
      woocommerceId: wooProduct.id,
      wordpressId: wooProduct.id,
      syncStatus: 'SYNCED',
      lastSyncAt: new Date(),
      taxStatus: wooProduct.tax_status,
      taxClass: wooProduct.tax_class || 'standard',
      shippingClass: wooProduct.shipping_class,
      isActive: wooProduct.status === 'publish',
      isSellable: true,
      // Campi web
      webActive: wooProduct.status === 'publish',
      webPrice: parseFloat(wooProduct.regular_price) || null,
      webDescription: wooProduct.description || null,
      webShortDescription: wooProduct.short_description || null,
      webAttributes: wooProduct.attributes?.map(attr => ({
        name: attr.name,
        options: attr.options,
      })) || null,
    };
  }

  /**
   * Import massivo ordini da WooCommerce
   */
  private async bulkImportOrders(options: {
    status?: string;
    fromDate?: Date;
    overwrite: boolean;
  }): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        let query = `orders?page=${page}&per_page=${perPage}`;
        if (options.status) {
          query += `&status=${options.status}`;
        }
        if (options.fromDate) {
          query += `&after=${options.fromDate.toISOString()}`;
        }

        const orders = await this.wooCommerceRequest<WooCommerceOrder[]>(query);

        if (orders.length === 0) {
          hasMore = false;
          continue;
        }

        for (const wooOrder of orders) {
          try {
            // Verifica se ordine esiste
            const existing = await prisma.order.findFirst({
              where: { wordpressId: wooOrder.id },
            });

            if (existing && !options.overwrite) {
              continue;
            }

            if (existing) {
              // Aggiorna ordine esistente
              await this.updateExistingOrder(existing.id, wooOrder);
              results.updated++;
            } else {
              // Importa nuovo ordine
              const result = await this.processOrderWebhook(wooOrder);
              if (result.success) {
                results.imported++;
              } else {
                results.errors++;
              }
            }

          } catch (error) {
            logger.error(`Errore import ordine #${wooOrder.number}:`, error);
            results.errors++;
          }
        }

        page++;
        if (orders.length < perPage) {
          hasMore = false;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } catch (error) {
      logger.error('Errore bulk import ordini:', error);
      throw error;
    }

    return results;
  }

  /**
   * Export massivo da ERP a WooCommerce
   * Sincronizza tutti i prodotti con webActive=true
   */
  async bulkExportToWooCommerce(options: {
    productIds?: string[];      // Se vuoto, esporta tutti i prodotti webActive
    includeVariants?: boolean;
    includeInventory?: boolean;
  }): Promise<{
    products: { synced: number; errors: number; details: any[] };
    inventory: { synced: number; errors: number } | null;
  }> {
    const results = {
      products: { synced: 0, errors: 0, details: [] as any[] },
      inventory: null as { synced: number; errors: number } | null,
    };

    logger.info('Avvio export massivo verso WooCommerce', options);

    // Query prodotti
    const where: any = {
      isActive: true,
    };

    if (options.productIds && options.productIds.length > 0) {
      where.id = { in: options.productIds };
    } else {
      where.webActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      select: { id: true, sku: true, type: true },
    });

    // Sync prodotti
    for (const product of products) {
      const result = await this.syncWebProductToWooCommerce(product.id);

      if (result.success) {
        results.products.synced++;
      } else {
        results.products.errors++;
      }

      results.products.details.push({
        sku: product.sku,
        type: product.type,
        ...result,
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Sync inventario se richiesto
    if (options.includeInventory) {
      results.inventory = await this.syncInventoryToWooCommerce();
    }

    logger.info('Export massivo completato', {
      productsSynced: results.products.synced,
      productsErrors: results.products.errors,
    });

    return results;
  }

  /**
   * Ottieni conteggi per preview import
   */
  async getImportPreview(): Promise<{
    woocommerce: {
      products: number;
      customers: number;
      orders: number;
    };
    erp: {
      products: number;
      webActiveProducts: number;
      customers: number;
      orders: number;
    };
  }> {
    // Assicurati che le impostazioni siano caricate dal DB
    await this.ensureSettingsLoaded();

    // Conta su WooCommerce
    let wooProducts = 0;
    let wooCustomers = 0;
    let wooOrders = 0;

    try {
      // WooCommerce usa header X-WP-Total per il conteggio totale
      const productsResponse = await fetch(
        `${this.baseUrl}/wp-json/wc/v3/products?per_page=1`,
        {
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );
      wooProducts = parseInt(productsResponse.headers.get('X-WP-Total') || '0');

      const customersResponse = await fetch(
        `${this.baseUrl}/wp-json/wc/v3/customers?per_page=1`,
        {
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );
      wooCustomers = parseInt(customersResponse.headers.get('X-WP-Total') || '0');

      const ordersResponse = await fetch(
        `${this.baseUrl}/wp-json/wc/v3/orders?per_page=1`,
        {
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );
      wooOrders = parseInt(ordersResponse.headers.get('X-WP-Total') || '0');
    } catch (error) {
      logger.error('Errore recupero conteggi WooCommerce:', error);
    }

    // Conta su ERP
    const [erpProducts, webActiveProducts, erpCustomers, erpOrders] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { webActive: true } }),
      prisma.customer.count(),
      prisma.order.count(),
    ]);

    return {
      woocommerce: {
        products: wooProducts,
        customers: wooCustomers,
        orders: wooOrders,
      },
      erp: {
        products: erpProducts,
        webActiveProducts,
        customers: erpCustomers,
        orders: erpOrders,
      },
    };
  }

  // =============================================
  // STATO SYNC
  // =============================================

  /**
   * Ottieni stato sincronizzazione WordPress
   */
  async getSyncStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    lastSync: Date | null;
    stats: {
      totalProducts: number;
      syncedProducts: number;
      webActiveProducts: number;
      pendingSync: number;
      syncErrors: number;
    };
  }> {
    // Assicurati che le impostazioni siano caricate dal DB
    await this.ensureSettingsLoaded();

    const health = await this.healthCheck();

    const [
      totalProducts,
      syncedProducts,
      webActiveProducts,
      pendingSync,
      syncErrors,
      lastSyncedProduct,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true, isSellable: true } }),
      prisma.product.count({ where: { syncStatus: 'SYNCED', woocommerceId: { not: null } } }),
      prisma.product.count({ where: { webActive: true } }),
      prisma.product.count({ where: { syncStatus: 'PENDING' } }),
      prisma.product.count({ where: { syncStatus: 'ERROR' } }),
      prisma.product.findFirst({
        where: { lastSyncAt: { not: null } },
        orderBy: { lastSyncAt: 'desc' },
        select: { lastSyncAt: true },
      }),
    ]);

    return {
      configured: this.isConfigured(),
      connected: health.connected,
      lastSync: lastSyncedProduct?.lastSyncAt || null,
      stats: {
        totalProducts,
        syncedProducts,
        webActiveProducts,
        pendingSync,
        syncErrors,
      },
    };
  }

  // =============================================
  // IMPORT COMPLETO CON RELAZIONI
  // =============================================

  /**
   * Import tutte le categorie da WooCommerce
   * Crea struttura gerarchica in ProductCategory
   */
  /**
   * Helper per delay tra richieste
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async importAllCategories(): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = BATCH_CONFIG.ITEMS_PER_PAGE;
      let allCategories: WooCommerceCategory[] = [];

      // Fetch tutte le categorie con batching e delay
      while (true) {
        logger.info(`Fetching categorie pagina ${page}...`);
        const categories = await this.wooCommerceRequest<WooCommerceCategory[]>(
          `products/categories?page=${page}&per_page=${perPage}`,
          'GET',
          undefined,
          BATCH_CONFIG.REQUEST_TIMEOUT
        );

        if (categories.length === 0) break;
        allCategories = allCategories.concat(categories);
        logger.info(`Ricevute ${categories.length} categorie (totale: ${allCategories.length})`);

        if (categories.length < perPage) break;
        page++;

        // Delay tra richieste per evitare rate limiting
        await this.delay(BATCH_CONFIG.REQUEST_DELAY);
      }

      logger.info(`Trovate ${allCategories.length} categorie da importare`);

      // Prima passa: crea tutte le categorie senza parent
      for (const wooCat of allCategories) {
        try {
          const existing = await prisma.productCategory.findFirst({
            where: {
              OR: [
                { woocommerceId: wooCat.id },
                { slug: wooCat.slug },
              ],
            },
          });

          const categoryData = {
            name: wooCat.name,
            slug: wooCat.slug,
            description: wooCat.description || null,
            woocommerceId: wooCat.id,
            image: wooCat.image?.src || null,
            position: wooCat.menu_order || 0,
            isActive: true,
          };

          if (existing) {
            await prisma.productCategory.update({
              where: { id: existing.id },
              data: categoryData,
            });
            results.updated++;
          } else {
            await prisma.productCategory.create({
              data: categoryData,
            });
            results.imported++;
          }
        } catch (error) {
          logger.error(`Errore import categoria ${wooCat.name}:`, error);
          results.errors++;
        }
      }

      // Seconda passa: aggiorna i parent
      for (const wooCat of allCategories) {
        if (wooCat.parent > 0) {
          try {
            const category = await prisma.productCategory.findFirst({
              where: { woocommerceId: wooCat.id },
            });

            const parentCategory = await prisma.productCategory.findFirst({
              where: { woocommerceId: wooCat.parent },
            });

            if (category && parentCategory) {
              await prisma.productCategory.update({
                where: { id: category.id },
                data: { parentId: parentCategory.id },
              });
            }
          } catch (error) {
            logger.error(`Errore aggiornamento parent categoria ${wooCat.name}:`, error);
          }
        }
      }

      logger.info(`Categorie importate: ${results.imported}, aggiornate: ${results.updated}`);
      return results;

    } catch (error) {
      logger.error('Errore import categorie:', error);
      throw error;
    }
  }

  // =============================================
  // SYNC ATTRIBUTI GLOBALI WOOCOMMERCE
  // =============================================

  /**
   * Importa tutti gli attributi globali da WooCommerce
   * Gli attributi globali sono usati per prodotti variabili (es: Colore, Taglia)
   */
  async importAllAttributes(): Promise<{ imported: number; updated: number; errors: number; terms: number }> {
    const results = { imported: 0, updated: 0, errors: 0, terms: 0 };

    try {
      // Fetch tutti gli attributi globali
      const attributes = await this.wooCommerceRequest<any[]>('products/attributes', 'GET');

      logger.info(`Trovati ${attributes.length} attributi globali da importare`);

      for (const wcAttr of attributes) {
        try {
          // Trova o crea attributo
          const existing = await prisma.wooCommerceAttribute.findFirst({
            where: { woocommerceId: wcAttr.id },
          });

          const attrData = {
            woocommerceId: wcAttr.id,
            name: wcAttr.name,
            slug: wcAttr.slug,
            type: wcAttr.type || 'select',
            orderBy: wcAttr.order_by || 'menu_order',
            hasArchives: wcAttr.has_archives || false,
          };

          let attributeId: string;

          if (existing) {
            await prisma.wooCommerceAttribute.update({
              where: { id: existing.id },
              data: attrData,
            });
            attributeId = existing.id;
            results.updated++;
          } else {
            const created = await prisma.wooCommerceAttribute.create({
              data: attrData,
            });
            attributeId = created.id;
            results.imported++;
          }

          // Importa i termini dell'attributo
          const termsImported = await this.importAttributeTerms(wcAttr.id, attributeId);
          results.terms += termsImported;

          await this.delay(100);

        } catch (error) {
          logger.error(`Errore import attributo ${wcAttr.name}:`, error);
          results.errors++;
        }
      }

      logger.info(`Attributi importati: ${results.imported}, aggiornati: ${results.updated}, termini: ${results.terms}`);
      return results;

    } catch (error) {
      logger.error('Errore import attributi:', error);
      throw error;
    }
  }

  /**
   * Importa i termini di un attributo specifico
   */
  private async importAttributeTerms(wcAttributeId: number, attributeId: string): Promise<number> {
    let imported = 0;

    try {
      const terms = await this.wooCommerceRequest<any[]>(
        `products/attributes/${wcAttributeId}/terms?per_page=100`,
        'GET'
      );

      for (const term of terms) {
        try {
          const existing = await prisma.wooCommerceAttributeTerm.findFirst({
            where: {
              attributeId,
              woocommerceId: term.id,
            },
          });

          const termData = {
            attributeId,
            woocommerceId: term.id,
            name: term.name,
            slug: term.slug,
            description: term.description || null,
            menuOrder: term.menu_order || 0,
            count: term.count || 0,
          };

          if (existing) {
            await prisma.wooCommerceAttributeTerm.update({
              where: { id: existing.id },
              data: termData,
            });
          } else {
            await prisma.wooCommerceAttributeTerm.create({
              data: termData,
            });
            imported++;
          }

        } catch (error) {
          logger.error(`Errore import termine ${term.name}:`, error);
        }
      }

    } catch (error) {
      logger.error(`Errore fetch termini attributo ${wcAttributeId}:`, error);
    }

    return imported;
  }

  // =============================================
  // SYNC TAG WOOCOMMERCE
  // =============================================

  /**
   * Importa tutti i tag da WooCommerce
   */
  async importAllTags(): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      let page = 1;
      const perPage = 100;

      while (true) {
        const tags = await this.wooCommerceRequest<any[]>(
          `products/tags?page=${page}&per_page=${perPage}`,
          'GET'
        );

        if (tags.length === 0) break;

        for (const tag of tags) {
          try {
            const existing = await prisma.wooCommerceTag.findFirst({
              where: { woocommerceId: tag.id },
            });

            const tagData = {
              woocommerceId: tag.id,
              name: tag.name,
              slug: tag.slug,
              description: tag.description || null,
              count: tag.count || 0,
            };

            if (existing) {
              await prisma.wooCommerceTag.update({
                where: { id: existing.id },
                data: tagData,
              });
              results.updated++;
            } else {
              await prisma.wooCommerceTag.create({
                data: tagData,
              });
              results.imported++;
            }

          } catch (error) {
            logger.error(`Errore import tag ${tag.name}:`, error);
            results.errors++;
          }
        }

        if (tags.length < perPage) break;
        page++;
        await this.delay(200);
      }

      logger.info(`Tag importati: ${results.imported}, aggiornati: ${results.updated}`);
      return results;

    } catch (error) {
      logger.error('Errore import tag:', error);
      throw error;
    }
  }

  /**
   * Export categorie verso WooCommerce
   */
  async exportCategoriesToWooCommerce(): Promise<{ exported: number; updated: number; errors: number; count: number }> {
    const results = { exported: 0, updated: 0, errors: 0, count: 0 };

    try {
      // Carica tutte le categorie locali con gerarchia
      const localCategories = await prisma.productCategory.findMany({
        where: { isActive: true },
        include: {
          parent: true,
        },
        orderBy: [
          { parentId: 'asc' }, // Prima le root, poi le figlie
          { position: 'asc' },
        ],
      });

      logger.info(`Trovate ${localCategories.length} categorie da esportare`);

      // Mappa per tenere traccia degli ID WooCommerce creati
      const wooIdMap = new Map<string, number>();

      // Prima passa: crea/aggiorna categorie root
      for (const cat of localCategories.filter(c => !c.parentId)) {
        try {
          const categoryData = {
            name: cat.name,
            slug: cat.slug,
            description: cat.description || '',
            image: cat.image ? { src: cat.image } : undefined,
            menu_order: cat.position,
          };

          if (cat.woocommerceId) {
            // Aggiorna esistente
            await this.wooCommerceRequest(
              `products/categories/${cat.woocommerceId}`,
              'PUT',
              categoryData
            );
            wooIdMap.set(cat.id, cat.woocommerceId);
            results.updated++;
          } else {
            // Crea nuova
            const created = await this.wooCommerceRequest<{ id: number }>(
              'products/categories',
              'POST',
              categoryData
            );

            // Aggiorna ID locale
            await prisma.productCategory.update({
              where: { id: cat.id },
              data: { woocommerceId: created.id },
            });

            wooIdMap.set(cat.id, created.id);
            results.exported++;
          }
        } catch (error) {
          logger.error(`Errore export categoria ${cat.name}:`, error);
          results.errors++;
        }
      }

      // Seconda passa: crea/aggiorna sottocategorie
      for (const cat of localCategories.filter(c => c.parentId)) {
        try {
          const parentWooId = wooIdMap.get(cat.parentId!) || cat.parent?.woocommerceId;

          const categoryData = {
            name: cat.name,
            slug: cat.slug,
            description: cat.description || '',
            parent: parentWooId || 0,
            image: cat.image ? { src: cat.image } : undefined,
            menu_order: cat.position,
          };

          if (cat.woocommerceId) {
            // Aggiorna esistente
            await this.wooCommerceRequest(
              `products/categories/${cat.woocommerceId}`,
              'PUT',
              categoryData
            );
            wooIdMap.set(cat.id, cat.woocommerceId);
            results.updated++;
          } else {
            // Crea nuova
            const created = await this.wooCommerceRequest<{ id: number }>(
              'products/categories',
              'POST',
              categoryData
            );

            // Aggiorna ID locale
            await prisma.productCategory.update({
              where: { id: cat.id },
              data: { woocommerceId: created.id },
            });

            wooIdMap.set(cat.id, created.id);
            results.exported++;
          }
        } catch (error) {
          logger.error(`Errore export sottocategoria ${cat.name}:`, error);
          results.errors++;
        }
      }

      results.count = results.exported + results.updated;
      logger.info(`Categorie esportate: ${results.exported}, aggiornate: ${results.updated}, errori: ${results.errors}`);
      return results;

    } catch (error) {
      logger.error('Errore export categorie:', error);
      throw error;
    }
  }

  /**
   * Import tutte le classi di spedizione da WooCommerce
   */
  async importAllShippingClasses(): Promise<{ imported: number; updated: number; errors: number }> {
    const results = { imported: 0, updated: 0, errors: 0 };

    try {
      logger.info('Fetching classi di spedizione...');
      const shippingClasses = await this.wooCommerceRequest<WooCommerceShippingClass[]>(
        `products/shipping_classes?per_page=${BATCH_CONFIG.ITEMS_PER_PAGE}`,
        'GET',
        undefined,
        BATCH_CONFIG.REQUEST_TIMEOUT
      );

      logger.info(`Trovate ${shippingClasses.length} classi di spedizione`);

      for (const wooClass of shippingClasses) {
        try {
          const existing = await prisma.shippingClass.findFirst({
            where: {
              OR: [
                { woocommerceId: wooClass.id },
                { slug: wooClass.slug },
              ],
            },
          });

          const classData = {
            name: wooClass.name,
            slug: wooClass.slug,
            description: wooClass.description || null,
            woocommerceId: wooClass.id,
          };

          if (existing) {
            await prisma.shippingClass.update({
              where: { id: existing.id },
              data: classData,
            });
            results.updated++;
          } else {
            await prisma.shippingClass.create({
              data: classData,
            });
            results.imported++;
          }
        } catch (error) {
          logger.error(`Errore import shipping class ${wooClass.name}:`, error);
          results.errors++;
        }
      }

      logger.info(`Classi spedizione importate: ${results.imported}, aggiornate: ${results.updated}`);
      return results;

    } catch (error) {
      logger.error('Errore import classi spedizione:', error);
      throw error;
    }
  }

  /**
   * Import completo prodotto con tutte le relazioni - VERSIONE COMPLETA
   * Importa tutti i campi WooCommerce disponibili
   */
  private async importProductComplete(
    wooProduct: WooCommerceProduct,
    warehouseId: string
  ): Promise<{ success: boolean; productId?: string; error?: string }> {
    void Date.now(); // startTime - reserved for future performance logging

    try {
      // Trova prodotto esistente
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { woocommerceId: wooProduct.id },
            { sku: wooProduct.sku },
          ],
        },
      });

      // Trova o crea shipping class se presente
      let shippingClassId: string | null = null;
      if (wooProduct.shipping_class_id > 0) {
        shippingClassId = await findOrCreateShippingClass(
          wooProduct.shipping_class,
          wooProduct.shipping_class_id
        );
      }

      // Usa il nuovo helper per mappare TUTTI i campi WooCommerce
      const mappedData = mapWooCommerceToProduct(wooProduct);

      // Prepara dati prodotto completi
      const productData: any = {
        ...mappedData,
        // Rimuovi campi che devono essere gestiti come relazioni
        images: mappedData.images, // Mantieni per retrocompatibilità
      };

      // Aggiungi relazione ShippingClass se presente
      if (shippingClassId) {
        productData.shippingClass = { connect: { id: shippingClassId } };
      }

      let productId: string;

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: productData,
        });
        productId = existing.id;
      } else {
        const created = await prisma.product.create({
          data: productData,
        });
        productId = created.id;
      }

      // ===== CATEGORIE =====
      // Rimuovi assegnazioni esistenti e ricrea
      await prisma.productCategoryAssignment.deleteMany({
        where: { productId },
      });

      for (let i = 0; i < (wooProduct.categories?.length || 0); i++) {
        const wooCat = wooProduct.categories[i];
        const category = await prisma.productCategory.findFirst({
          where: { woocommerceId: wooCat.id },
        });

        if (category) {
          await prisma.productCategoryAssignment.create({
            data: {
              productId,
              categoryId: category.id,
              isPrimary: i === 0, // Prima categoria è primaria
            },
          });
        }
      }

      // ===== IMMAGINI =====
      // Rimuovi immagini esistenti e ricrea
      await prisma.productImage.deleteMany({
        where: { productId, variantId: null },
      });

      for (let i = 0; i < (wooProduct.images?.length || 0); i++) {
        const img = wooProduct.images[i];
        await prisma.productImage.create({
          data: {
            productId,
            woocommerceId: img.id,
            src: img.src,
            alt: img.alt || null,
            name: img.name || null,
            position: i,
            isMain: i === 0,
          },
        });
      }

      // ===== INVENTARIO =====
      // Crea SEMPRE un InventoryItem nel magazzino default
      const stockQuantity = wooProduct.stock_quantity ?? 0;
      const existingInventory = await prisma.inventoryItem.findFirst({
        where: {
          productId,
          variantId: null,
          warehouseId,
        },
      });

      if (existingInventory) {
        // Aggiorna quantità se manage_stock è attivo, altrimenti mantieni esistente
        if (wooProduct.manage_stock) {
          await prisma.inventoryItem.update({
            where: { id: existingInventory.id },
            data: { quantity: stockQuantity },
          });
        }
      } else {
        // Crea sempre l'inventory item con location WEB (per prodotti WooCommerce)
        await prisma.inventoryItem.create({
          data: {
            productId,
            warehouseId,
            location: 'WEB',
            quantity: stockQuantity,
            reservedQuantity: 0,
          },
        });
      }

      // ===== VARIANTI =====
      if (wooProduct.type === 'variable' && wooProduct.variations?.length > 0) {
        await this.importVariationsComplete(wooProduct.id, productId, warehouseId);
      }

      return { success: true, productId };

    } catch (error: any) {
      logger.error(`Errore import prodotto ${wooProduct.sku}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import variazioni complete di un prodotto
   */
  private async importVariationsComplete(
    wooProductId: number,
    productId: string,
    warehouseId: string
  ): Promise<void> {
    try {
      const variations = await this.wooCommerceRequest<WooCommerceVariation[]>(
        `products/${wooProductId}/variations?per_page=100`
      );

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) return;

      for (const variation of variations) {
        try {
          const existing = await prisma.productVariant.findFirst({
            where: {
              OR: [
                { woocommerceVariationId: variation.id },
                { sku: variation.sku },
              ],
            },
          });

          // Usa il nuovo helper per mappare TUTTI i campi della variazione
          const mappedVariantData = mapWooCommerceToVariant(variation, product);

          const variantData = {
            productId,
            ...mappedVariantData,
          };

          let variantId: string;

          if (existing) {
            await prisma.productVariant.update({
              where: { id: existing.id },
              data: variantData,
            });
            variantId = existing.id;
          } else {
            const created = await prisma.productVariant.create({
              data: variantData,
            });
            variantId = created.id;
          }

          // Immagine variante
          if (variation.image) {
            await prisma.productImage.deleteMany({
              where: { productId, variantId },
            });

            await prisma.productImage.create({
              data: {
                productId,
                variantId,
                woocommerceId: variation.image.id,
                src: variation.image.src,
                alt: variation.image.alt || null,
                name: variation.image.name || null,
                position: 0,
                isMain: true,
              },
            });
          }

          // Inventario variante
          if (variation.manage_stock && variation.stock_quantity !== null) {
            const existingInventory = await prisma.inventoryItem.findFirst({
              where: {
                productId,
                variantId,
                warehouseId,
                location: 'WEB',
              },
            });

            if (existingInventory) {
              await prisma.inventoryItem.update({
                where: { id: existingInventory.id },
                data: { quantity: variation.stock_quantity || 0 },
              });
            } else {
              await prisma.inventoryItem.create({
                data: {
                  productId,
                  variantId,
                  warehouseId,
                  location: 'WEB',
                  quantity: variation.stock_quantity || 0,
                  reservedQuantity: 0,
                },
              });
            }
          }

        } catch (error) {
          logger.error(`Errore import variazione ${variation.sku}:`, error);
        }
      }

    } catch (error) {
      logger.error(`Errore fetch variazioni prodotto ${wooProductId}:`, error);
    }
  }

  /**
   * Import completo da WooCommerce con tutte le relazioni
   * Importa: categorie, classi spedizione, prodotti con immagini, varianti e inventario
   */
  async fullImportFromWooCommerce(options: {
    importCategories?: boolean;
    importShippingClasses?: boolean;
    importProducts?: boolean;
    productStatus?: 'publish' | 'draft' | 'any';
    overwriteExisting?: boolean;
  } = {}): Promise<{
    categories: { imported: number; updated: number; errors: number };
    shippingClasses: { imported: number; updated: number; errors: number };
    products: { imported: number; updated: number; errors: number; variations: number };
  }> {
    const results = {
      categories: { imported: 0, updated: 0, errors: 0 },
      shippingClasses: { imported: 0, updated: 0, errors: 0 },
      products: { imported: 0, updated: 0, errors: 0, variations: 0 },
    };

    const {
      importCategories = true,
      importShippingClasses = true,
      importProducts = true,
      productStatus = 'publish',
      overwriteExisting = true,
    } = options;

    logger.info('Avvio import completo da WooCommerce', options);

    // Trova o crea warehouse principale
    let warehouse = await prisma.warehouse.findFirst({
      where: { isPrimary: true },
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          code: 'MAIN',
          name: 'Magazzino Principale',
          isPrimary: true,
          isActive: true,
        },
      });
    }

    // 1. Import Categorie
    if (importCategories) {
      logger.info('Importazione categorie...');
      results.categories = await this.importAllCategories();
    }

    // 2. Import Classi Spedizione
    if (importShippingClasses) {
      logger.info('Importazione classi spedizione...');
      results.shippingClasses = await this.importAllShippingClasses();
    }

    // 3. Import Prodotti
    if (importProducts) {
      logger.info('Importazione prodotti...');

      let page = 1;
      const perPage = 50; // Ridotto per gestire meglio le variazioni

      while (true) {
        const statusParam = productStatus === 'any' ? '' : `&status=${productStatus}`;
        const products = await this.wooCommerceRequest<WooCommerceProduct[]>(
          `products?page=${page}&per_page=${perPage}${statusParam}`
        );

        if (products.length === 0) break;

        for (const wooProduct of products) {
          // Verifica se esiste e se dobbiamo sovrascrivere
          const existing = await prisma.product.findFirst({
            where: {
              OR: [
                { woocommerceId: wooProduct.id },
                { sku: wooProduct.sku },
              ],
            },
          });

          if (existing && !overwriteExisting) {
            continue;
          }

          const result = await this.importProductComplete(wooProduct, warehouse.id);

          if (result.success) {
            if (existing) {
              results.products.updated++;
            } else {
              results.products.imported++;
            }

            // Conta variazioni
            if (wooProduct.variations?.length > 0) {
              results.products.variations += wooProduct.variations.length;
            }
          } else {
            results.products.errors++;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        logger.info(`Processati ${page * perPage} prodotti...`);

        if (products.length < perPage) break;
        page++;
      }
    }

    logger.info('Import completo terminato', results);
    return results;
  }

  // =============================================
  // IMPORT CON DIPENDENZE AUTOMATICHE
  // =============================================

  /**
   * Import ordini con creazione automatica di clienti e prodotti mancanti
   * Ordine delle operazioni:
   * 1. Per ogni ordine, verifica che il cliente esista (se no, lo crea)
   * 2. Per ogni riga ordine, verifica che il prodotto esista (se no, lo importa da WC)
   * 3. Crea l'ordine con tutte le relazioni
   */
  async importOrdersWithDependencies(options: {
    status?: string;
    fromDate?: Date;
    overwrite?: boolean;
  } = {}): Promise<{
    orders: { imported: number; updated: number; errors: number };
    customersCreated: number;
    productsCreated: number;
    categoriesCreated: number;
  }> {
    const results = {
      orders: { imported: 0, updated: 0, errors: 0 },
      customersCreated: 0,
      productsCreated: 0,
      categoriesCreated: 0,
    };

    logger.info('Avvio import ordini con dipendenze automatiche', options);

    // Trova o crea warehouse principale
    let warehouse = await prisma.warehouse.findFirst({
      where: { isPrimary: true },
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          code: 'MAIN',
          name: 'Magazzino Principale',
          isPrimary: true,
          isActive: true,
        },
      });
    }

    try {
      let page = 1;
      const perPage = 50;

      while (true) {
        let query = `orders?page=${page}&per_page=${perPage}`;
        if (options.status) {
          query += `&status=${options.status}`;
        }
        if (options.fromDate) {
          query += `&after=${options.fromDate.toISOString()}`;
        }

        const orders = await this.wooCommerceRequest<WooCommerceOrder[]>(query);

        if (orders.length === 0) break;

        for (const wooOrder of orders) {
          try {
            // Verifica se ordine esiste già
            const existingOrder = await prisma.order.findFirst({
              where: { wordpressId: wooOrder.id },
            });

            if (existingOrder && !options.overwrite) {
              continue;
            }

            // 1. GARANTISCI CLIENTE
            const customerResult = await this.ensureCustomerExistsFromOrder(wooOrder);
            if (customerResult.created) {
              results.customersCreated++;
            }

            // 2. GARANTISCI PRODOTTI per ogni riga ordine
            for (const item of wooOrder.line_items) {
              const productResult = await this.ensureProductExistsFromOrderItem(item, warehouse.id);
              if (productResult.created) {
                results.productsCreated++;
              }
              if (productResult.categoriesCreated) {
                results.categoriesCreated += productResult.categoriesCreated;
              }
            }

            // 3. ORA CREA/AGGIORNA ORDINE
            if (existingOrder) {
              await this.updateExistingOrderComplete(existingOrder.id, wooOrder);
              results.orders.updated++;
            } else {
              const orderResult = await this.createOrderFromWooCommerce(wooOrder, customerResult.customerId);
              if (orderResult.success) {
                results.orders.imported++;
              } else {
                results.orders.errors++;
              }
            }

          } catch (error: any) {
            logger.error(`Errore import ordine #${wooOrder.number}:`, error);
            results.orders.errors++;
          }
        }

        logger.info(`Processati ${page * perPage} ordini...`);

        if (orders.length < perPage) break;
        page++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } catch (error) {
      logger.error('Errore import ordini con dipendenze:', error);
      throw error;
    }

    logger.info('Import ordini con dipendenze completato', results);
    return results;
  }

  /**
   * Garantisce che il cliente di un ordine esista nel DB
   * Se non esiste, lo crea (guest checkout o fetch da WC)
   */
  private async ensureCustomerExistsFromOrder(
    wooOrder: WooCommerceOrder
  ): Promise<{ customerId: string; created: boolean }> {
    // Cerca per WordPress customer ID
    if (wooOrder.customer_id > 0) {
      const existing = await prisma.customer.findFirst({
        where: { wordpressId: wooOrder.customer_id },
      });
      if (existing) {
        return { customerId: existing.id, created: false };
      }

      // Prova a fetch il cliente completo da WooCommerce
      try {
        const wooCustomer = await this.wooCommerceRequest<WooCommerceCustomer>(
          `customers/${wooOrder.customer_id}`
        );
        const created = await this.createCustomerFromWooCommerce(wooCustomer);
        return { customerId: created.id, created: true };
      } catch (error) {
        logger.warn(`Impossibile fetch cliente ${wooOrder.customer_id}, uso dati ordine`);
      }
    }

    // Cerca per email
    if (wooOrder.billing.email) {
      const existing = await prisma.customer.findFirst({
        where: { email: wooOrder.billing.email },
      });
      if (existing) {
        return { customerId: existing.id, created: false };
      }
    }

    // Crea cliente dai dati dell'ordine (guest checkout)
    const customer = await this.createCustomerFromOrderData(wooOrder);
    return { customerId: customer.id, created: true };
  }

  /**
   * Crea cliente completo da dati WooCommerce
   */
  private async createCustomerFromWooCommerce(wooCustomer: WooCommerceCustomer): Promise<any> {
    // Genera codice univoco
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'WEB-' } },
      orderBy: { code: 'desc' },
    });

    let nextNum = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/WEB-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    return await prisma.customer.create({
      data: {
        code: `WEB-${nextNum.toString().padStart(6, '0')}`,
        type: 'B2C',
        firstName: wooCustomer.first_name || wooCustomer.billing.first_name,
        lastName: wooCustomer.last_name || wooCustomer.billing.last_name,
        email: wooCustomer.email || wooCustomer.billing.email,
        phone: wooCustomer.billing.phone,
        businessName: wooCustomer.billing.company || null,
        billingAddress: {
          firstName: wooCustomer.billing.first_name,
          lastName: wooCustomer.billing.last_name,
          company: wooCustomer.billing.company,
          address1: wooCustomer.billing.address_1,
          address2: wooCustomer.billing.address_2,
          city: wooCustomer.billing.city,
          state: wooCustomer.billing.state,
          postcode: wooCustomer.billing.postcode,
          country: wooCustomer.billing.country,
          email: wooCustomer.billing.email,
          phone: wooCustomer.billing.phone,
        },
        shippingAddress: {
          firstName: wooCustomer.shipping.first_name,
          lastName: wooCustomer.shipping.last_name,
          company: wooCustomer.shipping.company,
          address1: wooCustomer.shipping.address_1,
          address2: wooCustomer.shipping.address_2,
          city: wooCustomer.shipping.city,
          state: wooCustomer.shipping.state,
          postcode: wooCustomer.shipping.postcode,
          country: wooCustomer.shipping.country,
        },
        wordpressId: wooCustomer.id,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Crea cliente minimo dai dati ordine (guest checkout)
   */
  private async createCustomerFromOrderData(wooOrder: WooCommerceOrder): Promise<any> {
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'WEB-' } },
      orderBy: { code: 'desc' },
    });

    let nextNum = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/WEB-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    return await prisma.customer.create({
      data: {
        code: `WEB-${nextNum.toString().padStart(6, '0')}`,
        type: 'B2C',
        firstName: wooOrder.billing.first_name,
        lastName: wooOrder.billing.last_name,
        email: wooOrder.billing.email || null,
        phone: wooOrder.billing.phone,
        businessName: wooOrder.billing.company || null,
        billingAddress: {
          firstName: wooOrder.billing.first_name,
          lastName: wooOrder.billing.last_name,
          company: wooOrder.billing.company,
          address1: wooOrder.billing.address_1,
          address2: wooOrder.billing.address_2,
          city: wooOrder.billing.city,
          state: wooOrder.billing.state,
          postcode: wooOrder.billing.postcode,
          country: wooOrder.billing.country,
          email: wooOrder.billing.email,
          phone: wooOrder.billing.phone,
        },
        shippingAddress: {
          firstName: wooOrder.shipping.first_name,
          lastName: wooOrder.shipping.last_name,
          company: wooOrder.shipping.company,
          address1: wooOrder.shipping.address_1,
          address2: wooOrder.shipping.address_2,
          city: wooOrder.shipping.city,
          state: wooOrder.shipping.state,
          postcode: wooOrder.shipping.postcode,
          country: wooOrder.shipping.country,
        },
        wordpressId: wooOrder.customer_id > 0 ? wooOrder.customer_id : null,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Garantisce che il prodotto di una riga ordine esista
   * Se non esiste, lo importa da WooCommerce (con le sue categorie)
   */
  private async ensureProductExistsFromOrderItem(
    item: WooCommerceOrder['line_items'][0],
    warehouseId: string
  ): Promise<{ productId: string; created: boolean; categoriesCreated?: number }> {
    // Cerca prodotto per WooCommerce ID
    if (item.product_id > 0) {
      const existing = await prisma.product.findFirst({
        where: { woocommerceId: item.product_id },
      });
      if (existing) {
        return { productId: existing.id, created: false };
      }
    }

    // Cerca per SKU
    if (item.sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: item.sku },
      });
      if (existing) {
        return { productId: existing.id, created: false };
      }
    }

    // Prodotto non trovato - importalo da WooCommerce
    let categoriesCreated = 0;

    if (item.product_id > 0) {
      try {
        const wooProduct = await this.wooCommerceRequest<WooCommerceProduct>(
          `products/${item.product_id}`
        );

        // Prima importa le categorie del prodotto
        for (const wooCat of wooProduct.categories || []) {
          const catResult = await this.ensureCategoryExists(wooCat);
          if (catResult.created) {
            categoriesCreated++;
          }
        }

        // Poi importa il prodotto
        const result = await this.importProductComplete(wooProduct, warehouseId);
        if (result.success && result.productId) {
          return { productId: result.productId, created: true, categoriesCreated };
        }
      } catch (error) {
        logger.warn(`Impossibile fetch prodotto ${item.product_id}, creo placeholder`);
      }
    }

    // Crea prodotto placeholder (dati minimi dalla riga ordine)
    const placeholder = await this.createProductPlaceholder(item);
    return { productId: placeholder.id, created: true, categoriesCreated };
  }

  /**
   * Crea prodotto placeholder quando non riesci a importarlo da WC
   */
  private async createProductPlaceholder(item: WooCommerceOrder['line_items'][0]): Promise<any> {
    const sku = item.sku || `WOO-${item.product_id || 'UNKNOWN'}-${Date.now()}`;

    // Verifica che lo SKU non esista già
    const existing = await prisma.product.findFirst({
      where: { sku },
    });

    if (existing) {
      return existing;
    }

    return await prisma.product.create({
      data: {
        sku,
        name: item.name,
        description: `Prodotto importato da ordine WooCommerce (ID: ${item.product_id})`,
        type: 'SIMPLE',
        price: item.price || 0,
        cost: 0,
        woocommerceId: item.product_id > 0 ? item.product_id : null,
        syncStatus: 'PENDING', // Marcato per risincronizzazione
        isActive: true,
        isSellable: true,
      },
    });
  }

  /**
   * Garantisce che una categoria esista
   * Se non esiste, la crea (compreso parent se necessario)
   */
  private async ensureCategoryExists(
    wooCat: { id: number; name: string; slug: string }
  ): Promise<{ categoryId: string; created: boolean }> {
    // Cerca per WooCommerce ID
    const existing = await prisma.productCategory.findFirst({
      where: { woocommerceId: wooCat.id },
    });

    if (existing) {
      return { categoryId: existing.id, created: false };
    }

    // Cerca per slug
    const existingBySlug = await prisma.productCategory.findFirst({
      where: { slug: wooCat.slug },
    });

    if (existingBySlug) {
      // Aggiorna con woocommerceId
      await prisma.productCategory.update({
        where: { id: existingBySlug.id },
        data: { woocommerceId: wooCat.id },
      });
      return { categoryId: existingBySlug.id, created: false };
    }

    // Fetch categoria completa da WooCommerce per avere parent, image, etc
    try {
      const fullCat = await this.wooCommerceRequest<WooCommerceCategory>(
        `products/categories/${wooCat.id}`
      );

      // Se ha parent, assicurati che esista
      let parentId: string | null = null;
      if (fullCat.parent > 0) {
        const parentCat = await this.wooCommerceRequest<WooCommerceCategory>(
          `products/categories/${fullCat.parent}`
        );
        const parentResult = await this.ensureCategoryExists({
          id: parentCat.id,
          name: parentCat.name,
          slug: parentCat.slug,
        });
        parentId = parentResult.categoryId;
      }

      // Crea categoria
      const created = await prisma.productCategory.create({
        data: {
          name: fullCat.name,
          slug: fullCat.slug,
          description: fullCat.description || null,
          woocommerceId: fullCat.id,
          parentId,
          image: fullCat.image?.src || null,
          wcImageId: fullCat.image?.id || null,
          position: fullCat.menu_order || 0,
          wcDisplay: fullCat.display || 'default',
          wcCount: fullCat.count || 0,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
          isActive: true,
        },
      });

      return { categoryId: created.id, created: true };

    } catch (error) {
      // Fallback: crea categoria minima
      logger.warn(`Impossibile fetch categoria ${wooCat.id}, creo versione minima`);

      const created = await prisma.productCategory.create({
        data: {
          name: wooCat.name,
          slug: wooCat.slug,
          woocommerceId: wooCat.id,
          syncStatus: 'PENDING',
          isActive: true,
        },
      });

      return { categoryId: created.id, created: true };
    }
  }

  /**
   * Crea ordine da dati WooCommerce (dopo che clienti/prodotti sono garantiti)
   * Import completo con fee lines, coupon lines, shipping lines, tax lines, meta data
   */
  private async createOrderFromWooCommerce(
    wooOrder: WooCommerceOrder,
    customerId: string
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const status = this.mapWooCommerceStatus(wooOrder.status);

      // Calcola subtotal se non fornito (somma dei line items)
      const subtotal = wooOrder.subtotal
        ? parseFloat(wooOrder.subtotal)
        : wooOrder.line_items.reduce((sum, item) => sum + parseFloat(item.subtotal || '0'), 0);

      const order = await prisma.$transaction(async (tx) => {
        // Crea ordine con tutti i campi WooCommerce
        const newOrder = await tx.order.create({
          data: {
            orderNumber: `WP-${wooOrder.number}`,
            customerId,
            source: 'WORDPRESS',
            status,
            subtotal,
            discount: parseFloat(wooOrder.discount_total) || 0,
            tax: parseFloat(wooOrder.total_tax) || 0,
            shipping: parseFloat(wooOrder.shipping_total) || 0,
            total: parseFloat(wooOrder.total) || 0,
            shippingAddress: {
              firstName: wooOrder.shipping.first_name,
              lastName: wooOrder.shipping.last_name,
              company: wooOrder.shipping.company,
              address1: wooOrder.shipping.address_1,
              address2: wooOrder.shipping.address_2,
              city: wooOrder.shipping.city,
              state: wooOrder.shipping.state,
              postcode: wooOrder.shipping.postcode,
              country: wooOrder.shipping.country,
              phone: wooOrder.shipping.phone,
            },
            billingAddress: {
              firstName: wooOrder.billing.first_name,
              lastName: wooOrder.billing.last_name,
              company: wooOrder.billing.company,
              address1: wooOrder.billing.address_1,
              address2: wooOrder.billing.address_2,
              city: wooOrder.billing.city,
              state: wooOrder.billing.state,
              postcode: wooOrder.billing.postcode,
              country: wooOrder.billing.country,
              email: wooOrder.billing.email,
              phone: wooOrder.billing.phone,
            },
            paymentMethod: wooOrder.payment_method,
            paymentMethodTitle: wooOrder.payment_method_title,
            paymentStatus: wooOrder.date_paid ? 'paid' : 'pending',
            customerNote: wooOrder.customer_note || null,

            // Identificatori WooCommerce
            wordpressId: wooOrder.id,
            wcNumber: wooOrder.number,
            wcStatus: wooOrder.status,
            wcOrderKey: wooOrder.order_key,
            wcCreatedVia: wooOrder.created_via,
            wcVersion: wooOrder.version,

            // Date WooCommerce
            wcDateCreated: new Date(wooOrder.date_created),
            wcDateModified: new Date(wooOrder.date_modified),
            wcDatePaid: wooOrder.date_paid ? new Date(wooOrder.date_paid) : null,
            wcDateCompleted: wooOrder.date_completed ? new Date(wooOrder.date_completed) : null,

            // Valuta
            wcCurrency: wooOrder.currency || 'EUR',
            wcCurrencySymbol: wooOrder.currency_symbol || '€',
            wcPricesIncludeTax: wooOrder.prices_include_tax ?? true,

            // Tracciamento cliente
            wcCustomerIpAddress: wooOrder.customer_ip_address || null,
            wcCustomerUserAgent: wooOrder.customer_user_agent || null,
            wcCartHash: wooOrder.cart_hash || null,

            // URL pagamento
            wcPaymentUrl: wooOrder.payment_url || null,

            // Fee Lines (commissioni, costi extra)
            wcFeeLines: wooOrder.fee_lines?.length > 0 ? (wooOrder.fee_lines as any) : undefined,

            // Coupon Lines (codici sconto applicati)
            wcCouponLines: wooOrder.coupon_lines?.length > 0 ? (wooOrder.coupon_lines as any) : undefined,

            // Shipping Lines (metodi spedizione)
            wcShippingLines: wooOrder.shipping_lines?.length > 0 ? (wooOrder.shipping_lines as any) : undefined,

            // Tax Lines (dettaglio imposte)
            wcTaxLines: wooOrder.tax_lines?.length > 0 ? (wooOrder.tax_lines as any) : undefined,

            // Meta Data ordine
            wcMetaData: wooOrder.meta_data?.length > 0 ? (wooOrder.meta_data as any) : undefined,

            // Rimborsi (sommario)
            wcRefunds: wooOrder.refunds?.length > 0 ? (wooOrder.refunds as any) : undefined,

            orderDate: new Date(wooOrder.date_created),
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
          },
        });

        // Crea righe ordine con tutti i dettagli
        for (const item of wooOrder.line_items) {
          // Trova prodotto (deve esistere perché l'abbiamo garantito)
          const product = await tx.product.findFirst({
            where: {
              OR: [
                { woocommerceId: item.product_id },
                { sku: item.sku },
              ],
            },
          });

          if (!product) {
            logger.error(`Prodotto non trovato per item ordine: ${item.sku} (product_id: ${item.product_id})`);
            continue;
          }

          // Trova variante se presente
          let variantId: string | null = null;
          if (item.variation_id > 0) {
            const variant = await tx.productVariant.findFirst({
              where: { woocommerceVariationId: item.variation_id },
            });
            variantId = variant?.id || null;
          }

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: product.id,
              variantId,
              productName: item.name,
              sku: item.sku || product.sku,
              quantity: item.quantity,
              unitPrice: item.price,
              subtotal: parseFloat(item.subtotal) || 0,
              tax: parseFloat(item.total_tax) || 0,
              total: parseFloat(item.total) || 0,
              wcLineItemId: item.id,
              wcProductId: item.product_id,
              wcVariationId: item.variation_id > 0 ? item.variation_id : null,
              // Meta data articolo (personalizzazioni, add-on)
              wcMetaData: item.meta_data?.length > 0 ? item.meta_data : undefined,
              // Nome prodotto padre per varianti
              wcParentName: item.parent_name || null,
            },
          });

          // Riserva stock se ordine confermato
          if (status === 'CONFIRMED' || status === 'PROCESSING') {
            await this.reserveStock(tx, product.id, item.quantity);
          }
        }

        return newOrder;
      });

      // Importa note ordine da WooCommerce
      await this.importOrderNotes(order.id, wooOrder.id);

      // Importa rimborsi dettagliati da WooCommerce
      if (wooOrder.refunds?.length > 0) {
        await this.importOrderRefunds(order.id, wooOrder.id);
      }

      // Notifica nuovo ordine
      await this.notifyNewOrder(order);

      return { success: true, orderId: order.id };

    } catch (error: any) {
      logger.error(`Errore creazione ordine da WooCommerce #${wooOrder.number}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Importa note ordine da WooCommerce
   */
  private async importOrderNotes(orderId: string, wcOrderId: number): Promise<void> {
    try {
      const notes = await this.wooCommerceRequest<WooCommerceOrderNote[]>(
        `orders/${wcOrderId}/notes`
      );

      if (!notes || notes.length === 0) return;

      for (const note of notes) {
        // Controlla se la nota esiste già
        const existing = await prisma.orderNote.findFirst({
          where: { wcNoteId: note.id },
        });

        if (existing) continue;

        await prisma.orderNote.create({
          data: {
            orderId,
            type: note.customer_note ? 'CUSTOMER' : 'INTERNAL',
            content: note.note,
            isVisibleToCustomer: note.customer_note,
            // createdBy è FK verso users, lasciamo null per note importate da WC
            createdBy: null,
            wcNoteId: note.id,
            createdAt: new Date(note.date_created),
          },
        });
      }

      logger.info(`Importate ${notes.length} note per ordine ${orderId}`);
    } catch (error: any) {
      logger.warn(`Errore import note ordine ${wcOrderId}: ${error.message}`);
    }
  }

  /**
   * Importa rimborsi dettagliati da WooCommerce
   */
  private async importOrderRefunds(orderId: string, wcOrderId: number): Promise<void> {
    try {
      const refunds = await this.wooCommerceRequest<WooCommerceRefund[]>(
        `orders/${wcOrderId}/refunds`
      );

      if (!refunds || refunds.length === 0) return;

      for (const refund of refunds) {
        // Controlla se il rimborso esiste già
        const existing = await prisma.orderRefund.findFirst({
          where: { wcRefundId: refund.id },
        });

        if (existing) continue;

        // Crea rimborso
        const orderRefund = await prisma.orderRefund.create({
          data: {
            orderId,
            wcRefundId: refund.id,
            amount: Math.abs(parseFloat(refund.amount)),
            reason: refund.reason || 'Rimborso da WooCommerce',
            status: 'COMPLETED',
            restockItems: false, // WooCommerce gestisce già il restock
            processedAt: new Date(refund.date_created),
            processedBy: 'WooCommerce',
          },
        });

        // Crea righe rimborso
        for (const item of refund.line_items) {
          // Trova l'OrderItem corrispondente
          const orderItem = await prisma.orderItem.findFirst({
            where: {
              orderId,
              wcLineItemId: item.id,
            },
          });

          if (orderItem) {
            await prisma.orderRefundItem.create({
              data: {
                refundId: orderRefund.id,
                orderItemId: orderItem.id,
                quantity: Math.abs(item.quantity),
                reason: refund.reason || null,
              } as any,
            });
          }
        }
      }

      logger.info(`Importati ${refunds.length} rimborsi per ordine ${orderId}`);
    } catch (error: any) {
      logger.warn(`Errore import rimborsi ordine ${wcOrderId}: ${error.message}`);
    }
  }

  /**
   * Aggiorna ordine esistente completamente, inclusi gli OrderItems
   */
  private async updateExistingOrderComplete(
    orderId: string,
    wooOrder: WooCommerceOrder
  ): Promise<void> {
    const newStatus = this.mapWooCommerceStatus(wooOrder.status);

    await prisma.$transaction(async (tx) => {
      // 1. Aggiorna Order
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          wcStatus: wooOrder.status,
          wcDateModified: new Date(wooOrder.date_modified),
          paymentStatus: wooOrder.status === 'completed' ? 'paid' : 'pending',
          customerNote: wooOrder.customer_note || undefined,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        },
      });

      // 2. Sync OrderItems - elimina quelli non più presenti e crea/aggiorna
      const existingItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { id: true, wcLineItemId: true },
      });

      const wcLineItemIds = wooOrder.line_items.map(i => i.id);

      // Elimina items rimossi da WC
      const itemsToDelete = existingItems.filter(
        ei => ei.wcLineItemId && !wcLineItemIds.includes(ei.wcLineItemId)
      );
      if (itemsToDelete.length > 0) {
        await tx.orderItem.deleteMany({
          where: { id: { in: itemsToDelete.map(i => i.id) } },
        });
      }

      // Upsert items da WC
      for (const item of wooOrder.line_items) {
        const product = await tx.product.findFirst({
          where: {
            OR: [
              { woocommerceId: item.product_id },
              { sku: item.sku },
            ],
          },
        });

        if (!product) {
          logger.warn(`Prodotto non trovato per sync item: ${item.sku} (product_id: ${item.product_id})`);
          continue;
        }

        let variantId: string | null = null;
        if (item.variation_id > 0) {
          const variant = await tx.productVariant.findFirst({
            where: { woocommerceVariationId: item.variation_id },
          });
          variantId = variant?.id || null;
        }

        const existingItem = existingItems.find(ei => ei.wcLineItemId === item.id);

        if (existingItem) {
          // Update existing item
          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: {
              productId: product.id,
              variantId,
              productName: item.name,
              sku: item.sku || product.sku,
              quantity: item.quantity,
              unitPrice: item.price,
              subtotal: parseFloat(item.subtotal) || 0,
              tax: parseFloat(item.total_tax) || 0,
              total: parseFloat(item.total) || 0,
              wcMetaData: item.meta_data?.length > 0 ? item.meta_data : undefined,
              wcParentName: item.parent_name || null,
            },
          });
        } else {
          // Create new item
          await tx.orderItem.create({
            data: {
              orderId,
              productId: product.id,
              variantId,
              productName: item.name,
              sku: item.sku || product.sku,
              quantity: item.quantity,
              unitPrice: item.price,
              subtotal: parseFloat(item.subtotal) || 0,
              tax: parseFloat(item.total_tax) || 0,
              total: parseFloat(item.total) || 0,
              wcLineItemId: item.id,
              wcProductId: item.product_id,
              wcVariationId: item.variation_id > 0 ? item.variation_id : null,
              wcMetaData: item.meta_data?.length > 0 ? item.meta_data : undefined,
              wcParentName: item.parent_name || null,
            },
          });
        }
      }
    });
  }

  /**
   * Import prodotti con creazione automatica delle categorie mancanti
   */
  async importProductsWithDependencies(options: {
    status?: 'publish' | 'draft' | 'any';
    overwrite?: boolean;
  } = {}): Promise<{
    products: { imported: number; updated: number; errors: number; variations: number };
    categoriesCreated: number;
    shippingClassesCreated: number;
  }> {
    const results = {
      products: { imported: 0, updated: 0, errors: 0, variations: 0 },
      categoriesCreated: 0,
      shippingClassesCreated: 0,
    };

    const { status = 'publish', overwrite = true } = options;

    logger.info('Avvio import prodotti con dipendenze automatiche', options);

    // Trova o crea warehouse principale
    let warehouse = await prisma.warehouse.findFirst({
      where: { isPrimary: true },
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          code: 'MAIN',
          name: 'Magazzino Principale',
          isPrimary: true,
          isActive: true,
        },
      });
    }

    try {
      let page = 1;
      const perPage = 50;

      while (true) {
        const statusParam = status === 'any' ? '' : `&status=${status}`;
        const products = await this.wooCommerceRequest<WooCommerceProduct[]>(
          `products?page=${page}&per_page=${perPage}${statusParam}`
        );

        if (products.length === 0) break;

        for (const wooProduct of products) {
          try {
            // Verifica se prodotto esiste
            const existing = await prisma.product.findFirst({
              where: {
                OR: [
                  { woocommerceId: wooProduct.id },
                  { sku: wooProduct.sku },
                ],
              },
            });

            if (existing && !overwrite) {
              continue;
            }

            // 1. GARANTISCI CATEGORIE
            for (const wooCat of wooProduct.categories || []) {
              const catResult = await this.ensureCategoryExists(wooCat);
              if (catResult.created) {
                results.categoriesCreated++;
              }
            }

            // 2. GARANTISCI SHIPPING CLASS
            if (wooProduct.shipping_class_id > 0) {
              const scResult = await this.ensureShippingClassExists(wooProduct.shipping_class_id);
              if (scResult.created) {
                results.shippingClassesCreated++;
              }
            }

            // 3. IMPORTA PRODOTTO
            const importResult = await this.importProductComplete(wooProduct, warehouse.id);

            if (importResult.success) {
              if (existing) {
                results.products.updated++;
              } else {
                results.products.imported++;
              }

              if (wooProduct.variations?.length > 0) {
                results.products.variations += wooProduct.variations.length;
              }
            } else {
              results.products.errors++;
            }

          } catch (error: any) {
            logger.error(`Errore import prodotto ${wooProduct.sku}:`, error);
            results.products.errors++;
          }
        }

        logger.info(`Processati ${page * perPage} prodotti...`);

        if (products.length < perPage) break;
        page++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      logger.error('Errore import prodotti con dipendenze:', error);
      throw error;
    }

    logger.info('Import prodotti con dipendenze completato', results);
    return results;
  }

  /**
   * Garantisce che una shipping class esista
   */
  private async ensureShippingClassExists(
    wooShippingClassId: number
  ): Promise<{ shippingClassId: string; created: boolean }> {
    // Cerca per WooCommerce ID
    const existing = await prisma.shippingClass.findFirst({
      where: { woocommerceId: wooShippingClassId },
    });

    if (existing) {
      return { shippingClassId: existing.id, created: false };
    }

    // Fetch da WooCommerce
    try {
      const wooClass = await this.wooCommerceRequest<WooCommerceShippingClass>(
        `products/shipping_classes/${wooShippingClassId}`
      );

      const created = await prisma.shippingClass.create({
        data: {
          name: wooClass.name,
          slug: wooClass.slug,
          description: wooClass.description || null,
          woocommerceId: wooClass.id,
        },
      });

      return { shippingClassId: created.id, created: true };

    } catch (error) {
      logger.warn(`Impossibile fetch shipping class ${wooShippingClassId}`);
      throw error;
    }
  }

  /**
   * Import completo intelligente - Ordine corretto delle dipendenze:
   * 1. Categorie
   * 2. Classi spedizione
   * 3. Clienti
   * 4. Prodotti (con categorie verificate)
   * 5. Ordini (con clienti e prodotti verificati)
   */
  async smartFullImport(options: {
    importCategories?: boolean;
    importShippingClasses?: boolean;
    importCustomers?: boolean;
    importProducts?: boolean;
    importOrders?: boolean;
    productStatus?: 'publish' | 'draft' | 'any';
    orderStatus?: string;
    overwrite?: boolean;
  } = {}): Promise<{
    categories: { imported: number; updated: number; errors: number };
    shippingClasses: { imported: number; updated: number; errors: number };
    customers: { imported: number; updated: number; errors: number };
    products: { imported: number; updated: number; errors: number; variations: number };
    orders: { imported: number; updated: number; errors: number };
    autoCreated: { categories: number; products: number; customers: number };
  }> {
    const results = {
      categories: { imported: 0, updated: 0, errors: 0 },
      shippingClasses: { imported: 0, updated: 0, errors: 0 },
      customers: { imported: 0, updated: 0, errors: 0 },
      products: { imported: 0, updated: 0, errors: 0, variations: 0 },
      orders: { imported: 0, updated: 0, errors: 0 },
      autoCreated: { categories: 0, products: 0, customers: 0 },
    };

    const {
      importCategories = true,
      importShippingClasses = true,
      importCustomers = true,
      importProducts = true,
      importOrders = true,
      productStatus = 'publish',
      orderStatus,
      overwrite = true,
    } = options;

    logger.info('===== AVVIO IMPORT COMPLETO INTELLIGENTE =====', options);

    // 1. CATEGORIE
    if (importCategories) {
      logger.info('>>> Step 1/5: Import categorie');
      results.categories = await this.importAllCategories();
    }

    // 2. CLASSI SPEDIZIONE
    if (importShippingClasses) {
      logger.info('>>> Step 2/5: Import classi spedizione');
      results.shippingClasses = await this.importAllShippingClasses();
    }

    // 3. CLIENTI
    if (importCustomers) {
      logger.info('>>> Step 3/5: Import clienti');
      results.customers = await this.importCustomersFromWooCommerce();
    }

    // 4. PRODOTTI (con creazione automatica categorie mancanti)
    if (importProducts) {
      logger.info('>>> Step 4/5: Import prodotti con dipendenze');
      const productResult = await this.importProductsWithDependencies({
        status: productStatus,
        overwrite,
      });
      results.products = productResult.products;
      results.autoCreated.categories += productResult.categoriesCreated;
    }

    // 5. ORDINI (con creazione automatica clienti/prodotti mancanti)
    if (importOrders) {
      logger.info('>>> Step 5/5: Import ordini con dipendenze');
      const orderResult = await this.importOrdersWithDependencies({
        status: orderStatus,
        overwrite,
      });
      results.orders = orderResult.orders;
      results.autoCreated.customers += orderResult.customersCreated;
      results.autoCreated.products += orderResult.productsCreated;
      results.autoCreated.categories += orderResult.categoriesCreated;
    }

    logger.info('===== IMPORT COMPLETO INTELLIGENTE TERMINATO =====');
    logger.info('Risultati:', results);

    return results;
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Crea rimborso su WooCommerce
   */
  async createWooCommerceRefund(
    wcOrderId: number,
    amount: number,
    reason: string,
    restockItems: boolean,
    lineItems?: Array<{ id: number | null; refund_total: string; quantity: number }>
  ): Promise<{ id: number; amount: string; reason: string }> {
    const data: any = {
      amount: amount.toFixed(2),
      reason,
      restock_items: restockItems,
    };

    // Aggiungi line items se specificati
    if (lineItems && lineItems.length > 0) {
      data.line_items = lineItems.filter((item) => item.id !== null);
    }

    const refund = await this.wooCommerceRequest<{
      id: number;
      amount: string;
      reason: string;
    }>(`orders/${wcOrderId}/refunds`, 'POST', data);

    logger.info(`Rimborso creato su WooCommerce: #${refund.id} - €${refund.amount}`);

    return refund;
  }

  /**
   * Aggiorna stato ordine su WooCommerce
   */
  async updateWooCommerceOrderStatus(
    wcOrderId: number,
    status: string,
    note?: string
  ): Promise<{ id: number; status: string }> {
    const data: any = { status };

    const order = await this.wooCommerceRequest<{
      id: number;
      status: string;
    }>(`orders/${wcOrderId}`, 'PUT', data);

    // Se c'è una nota, aggiungila
    if (note) {
      await this.addWooCommerceOrderNote(wcOrderId, note, false);
    }

    logger.info(`Stato ordine WooCommerce #${wcOrderId} aggiornato a: ${status}`);

    return order;
  }

  /**
   * Aggiungi nota a ordine WooCommerce
   */
  async addWooCommerceOrderNote(
    wcOrderId: number,
    note: string,
    customerNote: boolean = false
  ): Promise<{ id: number; note: string }> {
    const data = {
      note,
      customer_note: customerNote,
    };

    const result = await this.wooCommerceRequest<{
      id: number;
      note: string;
    }>(`orders/${wcOrderId}/notes`, 'POST', data);

    logger.info(`Nota aggiunta a ordine WooCommerce #${wcOrderId}`);

    return result;
  }

  /**
   * Sincronizza stato ordine locale verso WooCommerce
   */
  async syncOrderStatusToWooCommerce(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return { success: false, error: 'Ordine non trovato' };
      }

      if (!order.wordpressId) {
        return { success: false, error: 'Ordine non sincronizzato con WooCommerce' };
      }

      // Mappa stato interno a WooCommerce
      const wcStatusMap: Record<string, string> = {
        PENDING: 'pending',
        CONFIRMED: 'processing',
        PROCESSING: 'processing',
        READY: 'processing',
        SHIPPED: 'completed',
        DELIVERED: 'completed',
        CANCELLED: 'cancelled',
      };

      const wcStatus = wcStatusMap[order.status] || 'processing';

      await this.updateWooCommerceOrderStatus(
        order.wordpressId,
        wcStatus,
        `Stato aggiornato da ERP: ${order.status}`
      );

      // Aggiorna sync status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Errore sync stato ordine ${orderId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export const wordpressService = new WordPressService();
export default wordpressService;
