/**
 * WordPress/WooCommerce Sync Helpers
 * Funzioni di mapping complete tra ERP e WooCommerce
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';

// =============================================
// INTERFACES - WooCommerce API v3
// =============================================

export interface WCProductData {
  // Base
  name: string;
  slug?: string;
  type?: 'simple' | 'grouped' | 'external' | 'variable';
  status?: 'draft' | 'pending' | 'private' | 'publish';
  featured?: boolean;
  catalog_visibility?: 'visible' | 'catalog' | 'search' | 'hidden';
  description?: string;
  short_description?: string;
  sku?: string;

  // Pricing
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;

  // Inventory
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  backorders?: 'no' | 'notify' | 'yes';
  sold_individually?: boolean;

  // Physical
  weight?: string;
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };

  // Shipping
  shipping_class?: string;

  // Taxes
  tax_status?: 'taxable' | 'shipping' | 'none';
  tax_class?: string;

  // Virtual/Downloadable
  virtual?: boolean;
  downloadable?: boolean;
  downloads?: Array<{ name: string; file: string }>;
  download_limit?: number;
  download_expiry?: number;

  // External Product
  external_url?: string;
  button_text?: string;

  // Relations
  upsell_ids?: number[];
  cross_sell_ids?: number[];
  parent_id?: number;
  grouped_products?: number[];

  // Categories & Tags
  categories?: Array<{ id: number }>;
  tags?: Array<{ id: number }>;

  // Images
  images?: Array<{ id?: number; src?: string; name?: string; alt?: string }>;

  // Attributes (for variable products)
  attributes?: Array<{
    id?: number;
    name: string;
    position?: number;
    visible?: boolean;
    variation?: boolean;
    options: string[];
  }>;
  default_attributes?: Array<{ name: string; option: string }>;

  // Other
  menu_order?: number;
  purchase_note?: string;
  reviews_allowed?: boolean;
  meta_data?: Array<{ key: string; value: any }>;
}

export interface WCVariationData {
  sku?: string;
  description?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  status?: 'publish' | 'private';
  virtual?: boolean;
  downloadable?: boolean;
  downloads?: Array<{ name: string; file: string }>;
  download_limit?: number;
  download_expiry?: number;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  backorders?: 'no' | 'notify' | 'yes';
  weight?: string;
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };
  shipping_class?: string;
  image?: { id?: number; src?: string; name?: string; alt?: string };
  attributes: Array<{ name: string; option: string }>;
  menu_order?: number;
  meta_data?: Array<{ key: string; value: any }>;
}

// =============================================
// MAPPING FUNCTIONS: ERP → WooCommerce
// =============================================

/**
 * Mappa un prodotto ERP al formato WooCommerce
 */
export function mapProductToWooCommerce(
  product: any,
  inventory: any[],
  categories: any[],
  images: any[],
  productType: 'simple' | 'variable' | 'external' | 'grouped' = 'simple'
): WCProductData {
  // Calcola stock totale dalla location WEB
  const webInventory = inventory.filter(i => i.location === 'WEB');
  const totalStock = webInventory.reduce(
    (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
    0
  );

  // Determina stock status
  let stockStatus: 'instock' | 'outofstock' | 'onbackorder' = 'outofstock';
  if (totalStock > 0) {
    stockStatus = 'instock';
  } else if (product.wcBackordersAllowed || product.wcBackorders === 'yes' || product.wcBackorders === 'notify') {
    stockStatus = 'onbackorder';
  }

  // Prepara categorie WooCommerce
  const wcCategories = categories
    .filter(c => c.category?.woocommerceId)
    .map(c => ({ id: c.category.woocommerceId }));

  // Prepara immagini
  const wcImages = images.map((img, index) => ({
    ...(img.woocommerceId ? { id: img.woocommerceId } : {}),
    src: img.src,
    name: img.name || undefined,
    alt: img.alt || product.name,
    position: index,
  }));

  // Costruisci oggetto WooCommerce
  const wcData: WCProductData = {
    // Base
    name: product.name,
    type: productType,
    status: product.webActive ? 'publish' : 'draft',
    featured: product.wcFeatured || false,
    catalog_visibility: product.wcCatalogVisibility as any || 'visible',
    description: product.webDescription || product.description || '',
    short_description: product.webShortDescription || '',
    sku: product.sku,

    // Pricing
    regular_price: (product.webPrice || product.price || 0).toString(),

    // Inventory
    manage_stock: true,
    stock_quantity: totalStock,
    stock_status: stockStatus,
    backorders: product.wcBackorders as any || 'no',
    sold_individually: product.wcSoldIndividually || false,

    // Physical
    weight: product.weight?.toString() || '',

    // Shipping
    shipping_class: product.shippingClassSlug || '',

    // Taxes
    tax_status: product.taxStatus as any || 'taxable',
    tax_class: product.taxClass || '',

    // Virtual/Downloadable
    virtual: product.wcVirtual || false,
    downloadable: product.wcDownloadable || false,
    download_limit: product.wcDownloadLimit ?? -1,
    download_expiry: product.wcDownloadExpiry ?? -1,

    // Categories & Images
    categories: wcCategories,
    images: wcImages,

    // Other
    menu_order: product.wcMenuOrder || 0,
    purchase_note: product.wcPurchaseNote || '',
    reviews_allowed: product.wcReviewsAllowed ?? true,
  };

  // Slug (se definito)
  if (product.webSlug) {
    wcData.slug = product.webSlug;
  }

  // Sale price
  if (product.wcSalePrice && Number(product.wcSalePrice) > 0) {
    wcData.sale_price = product.wcSalePrice.toString();

    if (product.wcDateOnSaleFrom) {
      wcData.date_on_sale_from = new Date(product.wcDateOnSaleFrom).toISOString();
    }
    if (product.wcDateOnSaleTo) {
      wcData.date_on_sale_to = new Date(product.wcDateOnSaleTo).toISOString();
    }
  }

  // Dimensions
  if (product.dimensions) {
    const dims = product.dimensions as { width?: number; height?: number; depth?: number };
    wcData.dimensions = {
      width: dims.width?.toString() || '',
      height: dims.height?.toString() || '',
      length: dims.depth?.toString() || '', // depth → length in WC
    };
  }

  // Downloads per prodotti digitali
  if (product.wcDownloadable && product.downloadFiles) {
    const files = Array.isArray(product.downloadFiles) ? product.downloadFiles : [];
    wcData.downloads = files.map((f: any) => ({
      name: f.name || 'Download',
      file: f.url || f.file,
    }));
  }

  // External product
  if (productType === 'external') {
    wcData.external_url = product.wcExternalUrl || '';
    wcData.button_text = product.wcButtonText || 'Acquista';
  }

  // Grouped products
  if (productType === 'grouped' && product.wcGroupedProducts) {
    wcData.grouped_products = product.wcGroupedProducts;
  }

  // Upsell/Cross-sell
  if (product.wcUpsellIds) {
    wcData.upsell_ids = product.wcUpsellIds;
  }
  if (product.wcCrossSellIds) {
    wcData.cross_sell_ids = product.wcCrossSellIds;
  }

  // Meta data SEO (Yoast)
  const metaData: Array<{ key: string; value: any }> = [];
  if (product.webMetaTitle) {
    metaData.push({ key: '_yoast_wpseo_title', value: product.webMetaTitle });
  }
  if (product.webMetaDescription) {
    metaData.push({ key: '_yoast_wpseo_metadesc', value: product.webMetaDescription });
  }
  if (metaData.length > 0) {
    wcData.meta_data = metaData;
  }

  return wcData;
}

/**
 * Mappa una variante ERP al formato WooCommerce
 */
export function mapVariantToWooCommerce(
  variant: any,
  parentProduct: any,
  inventory: any[]
): WCVariationData {
  // Calcola stock variante dalla location WEB
  const webInventory = inventory.filter(
    i => i.location === 'WEB' && i.variantId === variant.id
  );
  const totalStock = webInventory.reduce(
    (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
    0
  );

  // Determina stock status
  let stockStatus: 'instock' | 'outofstock' | 'onbackorder' = 'outofstock';
  if (totalStock > 0) {
    stockStatus = 'instock';
  } else if (variant.wcBackorders === 'yes' || variant.wcBackorders === 'notify') {
    stockStatus = 'onbackorder';
  }

  // Calcola prezzo variante
  const basePrice = Number(parentProduct.webPrice || parentProduct.price) || 0;
  const priceDelta = Number(variant.priceDelta) || 0;
  const variantPrice = variant.webPrice || (basePrice + priceDelta);

  // Costruisci attributi dalla mappa
  const attributes: Array<{ name: string; option: string }> = [];
  if (variant.attributes && typeof variant.attributes === 'object') {
    for (const [name, option] of Object.entries(variant.attributes)) {
      attributes.push({ name, option: String(option) });
    }
  }

  const wcData: WCVariationData = {
    sku: variant.sku,
    description: variant.webDescription || '',
    regular_price: variantPrice.toString(),
    status: variant.webActive ? 'publish' : 'private',

    // Inventory
    manage_stock: variant.wcManageStock ?? true,
    stock_quantity: totalStock,
    stock_status: stockStatus,
    backorders: variant.wcBackorders as any || 'no',

    // Physical
    weight: variant.weight?.toString() || '',

    // Virtual/Downloadable
    virtual: variant.wcVirtual || false,
    downloadable: variant.wcDownloadable || false,
    download_limit: variant.wcDownloadLimit ?? -1,
    download_expiry: variant.wcDownloadExpiry ?? -1,

    // Attributes
    attributes,

    // Other
    menu_order: variant.wcMenuOrder || 0,
  };

  // Dimensions
  if (variant.dimensions) {
    const dims = variant.dimensions as { width?: number; height?: number; depth?: number };
    wcData.dimensions = {
      width: dims.width?.toString() || '',
      height: dims.height?.toString() || '',
      length: dims.depth?.toString() || '',
    };
  }

  // Sale price
  if (variant.wcSalePrice && Number(variant.wcSalePrice) > 0) {
    wcData.sale_price = variant.wcSalePrice.toString();

    if (variant.wcDateOnSaleFrom) {
      wcData.date_on_sale_from = new Date(variant.wcDateOnSaleFrom).toISOString();
    }
    if (variant.wcDateOnSaleTo) {
      wcData.date_on_sale_to = new Date(variant.wcDateOnSaleTo).toISOString();
    }
  }

  // Downloads
  if (variant.wcDownloadable && variant.wcDownloads) {
    const files = Array.isArray(variant.wcDownloads) ? variant.wcDownloads : [];
    wcData.downloads = files.map((f: any) => ({
      name: f.name || 'Download',
      file: f.url || f.file,
    }));
  }

  // Image
  if (variant.mainImageUrl) {
    wcData.image = {
      ...(variant.mainImageId ? { id: variant.mainImageId } : {}),
      src: variant.mainImageUrl,
      alt: variant.name,
    };
  }

  return wcData;
}

/**
 * Mappa attributi prodotto per WooCommerce variable product
 */
export function mapAttributesForVariableProduct(
  _product: any, // Riservato per uso futuro (es: attributi da webAttributes)
  variants: any[]
): Array<{
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}> {
  // Raccogli tutti gli attributi unici dalle varianti
  const attributeMap = new Map<string, Set<string>>();

  for (const variant of variants) {
    if (variant.attributes && typeof variant.attributes === 'object') {
      for (const [name, value] of Object.entries(variant.attributes)) {
        if (!attributeMap.has(name)) {
          attributeMap.set(name, new Set());
        }
        attributeMap.get(name)!.add(String(value));
      }
    }
  }

  // Converti in formato WooCommerce
  const attributes: Array<{
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }> = [];

  let position = 0;
  for (const [name, values] of attributeMap) {
    attributes.push({
      name,
      position: position++,
      visible: true,
      variation: true,
      options: Array.from(values),
    });
  }

  return attributes;
}

// =============================================
// MAPPING FUNCTIONS: WooCommerce → ERP
// =============================================

/**
 * Mappa un prodotto WooCommerce al formato ERP
 */
export function mapWooCommerceToProduct(wcProduct: any): any {
  // Determina tipo prodotto
  let productType: 'SIMPLE' | 'WITH_VARIANTS' | 'DIGITAL' | 'RAW_MATERIAL' = 'SIMPLE';
  if (wcProduct.type === 'variable') {
    productType = 'WITH_VARIANTS';
  } else if (wcProduct.virtual && wcProduct.downloadable) {
    productType = 'DIGITAL';
  }

  // Estrai dati SEO da meta_data (Yoast SEO)
  const yoastTitle = wcProduct.meta_data?.find((m: any) => m.key === '_yoast_wpseo_title')?.value || null;
  const yoastDesc = wcProduct.meta_data?.find((m: any) => m.key === '_yoast_wpseo_metadesc')?.value || null;

  return {
    // Base
    sku: wcProduct.sku || `WOO-${wcProduct.id}`,
    name: wcProduct.name,
    description: wcProduct.description || null,
    type: productType,

    // Pricing
    price: parseFloat(wcProduct.regular_price) || 0,
    cost: 0, // Non disponibile da WC

    // Physical
    weight: wcProduct.weight ? parseFloat(wcProduct.weight) : null,
    dimensions: wcProduct.dimensions ? {
      width: parseFloat(wcProduct.dimensions.width) || 0,
      height: parseFloat(wcProduct.dimensions.height) || 0,
      depth: parseFloat(wcProduct.dimensions.length) || 0,
    } : null,

    // WooCommerce IDs
    woocommerceId: wcProduct.id,
    wordpressId: wcProduct.id,
    syncStatus: 'SYNCED',
    lastSyncAt: new Date(),

    // WooCommerce dates
    wcDateCreated: wcProduct.date_created ? new Date(wcProduct.date_created) : null,
    wcDateModified: wcProduct.date_modified ? new Date(wcProduct.date_modified) : null,
    wcPermalink: wcProduct.permalink || null,

    // WooCommerce status & visibility
    wcStatus: wcProduct.status || 'publish',
    wcFeatured: wcProduct.featured || false,
    wcCatalogVisibility: wcProduct.catalog_visibility || 'visible',
    wcMenuOrder: wcProduct.menu_order || 0,

    // WooCommerce pricing
    wcSalePrice: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : null,
    wcOnSale: wcProduct.on_sale || false,
    wcDateOnSaleFrom: wcProduct.date_on_sale_from ? new Date(wcProduct.date_on_sale_from) : null,
    wcDateOnSaleTo: wcProduct.date_on_sale_to ? new Date(wcProduct.date_on_sale_to) : null,
    wcPriceHtml: wcProduct.price_html || null,

    // WooCommerce stock
    wcStockStatus: wcProduct.stock_status || 'instock',
    wcBackorders: wcProduct.backorders || 'no',
    wcBackordersAllowed: wcProduct.backorders_allowed || false,
    wcSoldIndividually: wcProduct.sold_individually || false,

    // WooCommerce shipping & taxes
    shippingClassSlug: wcProduct.shipping_class || null,
    taxStatus: wcProduct.tax_status || 'taxable',
    taxClass: wcProduct.tax_class || 'standard',
    wcPurchasable: wcProduct.purchasable ?? true,

    // WooCommerce reviews
    wcReviewsAllowed: wcProduct.reviews_allowed ?? true,
    wcAverageRating: wcProduct.average_rating ? parseFloat(wcProduct.average_rating) : null,
    wcRatingCount: wcProduct.rating_count || 0,
    wcTotalSales: wcProduct.total_sales || 0,

    // WooCommerce relations
    wcRelatedIds: wcProduct.related_ids || null,
    wcUpsellIds: wcProduct.upsell_ids || null,
    wcCrossSellIds: wcProduct.cross_sell_ids || null,

    // WooCommerce notes & external
    wcPurchaseNote: wcProduct.purchase_note || null,
    wcExternalUrl: wcProduct.external_url || null,
    wcButtonText: wcProduct.button_text || null,

    // WooCommerce parent & grouped
    wcParentId: wcProduct.parent_id || null,
    wcGroupedProducts: wcProduct.grouped_products || null,

    // WooCommerce virtual/downloadable
    wcVirtual: wcProduct.virtual || false,
    wcDownloadable: wcProduct.downloadable || false,
    wcDownloadLimit: wcProduct.download_limit ?? -1,
    wcDownloadExpiry: wcProduct.download_expiry ?? -1,

    // WooCommerce tags & meta
    wcTags: wcProduct.tags || null,
    wcMetaData: wcProduct.meta_data || null,

    // Web fields
    webActive: wcProduct.status === 'publish',
    webPrice: parseFloat(wcProduct.regular_price) || null,
    webDescription: wcProduct.description || null,
    webShortDescription: wcProduct.short_description || null,
    webSlug: wcProduct.slug || null,
    webMetaTitle: yoastTitle,
    webMetaDescription: yoastDesc,
    webAttributes: wcProduct.attributes?.map((attr: any) => ({
      name: attr.name,
      options: attr.options,
    })) || null,

    // Default attributes (for variable products)
    wcDefaultAttributes: wcProduct.default_attributes || null,

    // Image
    mainImageUrl: wcProduct.images?.[0]?.src || null,
    mainImageId: wcProduct.images?.[0]?.id || null,
    images: wcProduct.images?.map((img: any) => img.src) || [],

    // Downloads
    downloadFiles: wcProduct.downloadable ? wcProduct.downloads?.map((d: any) => ({
      name: d.name,
      url: d.file,
    })) : null,

    // Status
    isActive: wcProduct.status === 'publish',
    isSellable: true,
    category: wcProduct.categories?.[0]?.name || null,
  };
}

/**
 * Mappa una variazione WooCommerce al formato ERP
 */
export function mapWooCommerceToVariant(
  wcVariation: any,
  parentProduct: any
): any {
  // Costruisci attributi come oggetto
  const attributes: Record<string, string> = {};
  for (const attr of wcVariation.attributes || []) {
    attributes[attr.name] = attr.option;
  }

  // Costruisci nome variante dagli attributi
  const variantName = wcVariation.attributes?.map((a: any) => a.option).join(' / ') || `Variante ${wcVariation.id}`;

  // Calcola delta prezzo
  const basePrice = Number(parentProduct.price) || 0;
  const variantPrice = parseFloat(wcVariation.regular_price) || 0;
  const priceDelta = variantPrice - basePrice;

  return {
    sku: wcVariation.sku || `${parentProduct.sku}-VAR-${wcVariation.id}`,
    name: variantName,
    attributes,
    priceDelta,
    costDelta: 0,
    isActive: wcVariation.status === 'publish',

    // Physical
    weight: wcVariation.weight ? parseFloat(wcVariation.weight) : null,
    dimensions: wcVariation.dimensions ? {
      width: parseFloat(wcVariation.dimensions.width) || 0,
      height: parseFloat(wcVariation.dimensions.height) || 0,
      depth: parseFloat(wcVariation.dimensions.length) || 0,
    } : null,

    // WooCommerce
    woocommerceVariationId: wcVariation.id,
    webPrice: variantPrice || null,
    webActive: wcVariation.status === 'publish',
    webDescription: wcVariation.description || null,

    // WooCommerce pricing
    wcSalePrice: wcVariation.sale_price ? parseFloat(wcVariation.sale_price) : null,
    wcOnSale: wcVariation.on_sale || false,
    wcDateOnSaleFrom: wcVariation.date_on_sale_from ? new Date(wcVariation.date_on_sale_from) : null,
    wcDateOnSaleTo: wcVariation.date_on_sale_to ? new Date(wcVariation.date_on_sale_to) : null,

    // WooCommerce stock
    wcStockStatus: wcVariation.stock_status || 'instock',
    wcBackorders: wcVariation.backorders || 'no',
    wcManageStock: wcVariation.manage_stock || false,

    // WooCommerce virtual/downloadable
    wcVirtual: wcVariation.virtual || false,
    wcDownloadable: wcVariation.downloadable || false,
    wcDownloads: wcVariation.downloadable ? wcVariation.downloads?.map((d: any) => ({
      name: d.name,
      url: d.file,
    })) : null,
    wcDownloadLimit: wcVariation.download_limit ?? -1,
    wcDownloadExpiry: wcVariation.download_expiry ?? -1,

    // WooCommerce menu order
    wcMenuOrder: wcVariation.menu_order || 0,

    // Image
    mainImageUrl: wcVariation.image?.src || null,
    mainImageId: wcVariation.image?.id || null,
  };
}

// =============================================
// SYNC LOGGING
// =============================================

export async function logSync(
  direction: 'TO_WP' | 'FROM_WP',
  entity: 'PRODUCT' | 'VARIANT' | 'ORDER' | 'CUSTOMER' | 'INVENTORY' | 'CATEGORY' | 'ATTRIBUTE',
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'IMPORT' | 'EXPORT',
  status: 'SUCCESS' | 'FAILED' | 'PENDING',
  request?: any,
  response?: any,
  error?: string,
  duration?: number
): Promise<void> {
  try {
    await prisma.wordPressSyncLog.create({
      data: {
        direction,
        entity,
        entityId,
        action,
        status,
        request: request ? JSON.parse(JSON.stringify(request)) : null,
        response: response ? JSON.parse(JSON.stringify(response)) : null,
        error,
        duration,
      },
    });
  } catch (err) {
    logger.error('Errore logging sync:', err);
  }
}

// =============================================
// UTILITIES
// =============================================

/**
 * Converte ID WooCommerce locale in ID globale (per relazioni)
 */
export async function resolveWooCommerceIds(
  localIds: string[],
  type: 'product' | 'category'
): Promise<number[]> {
  if (!localIds || localIds.length === 0) return [];

  if (type === 'product') {
    const products = await prisma.product.findMany({
      where: { id: { in: localIds }, woocommerceId: { not: null } },
      select: { woocommerceId: true },
    });
    return products.map(p => p.woocommerceId!);
  }

  if (type === 'category') {
    const categories = await prisma.productCategory.findMany({
      where: { id: { in: localIds }, woocommerceId: { not: null } },
      select: { woocommerceId: true },
    });
    return categories.map(c => c.woocommerceId!);
  }

  return [];
}

/**
 * Trova o crea shipping class
 */
export async function findOrCreateShippingClass(
  slug: string,
  woocommerceId?: number
): Promise<string | null> {
  if (!slug) return null;

  let shippingClass = await prisma.shippingClass.findFirst({
    where: {
      OR: [
        { slug },
        ...(woocommerceId ? [{ woocommerceId }] : []),
      ],
    },
  });

  if (!shippingClass && woocommerceId) {
    shippingClass = await prisma.shippingClass.create({
      data: {
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug,
        woocommerceId,
      },
    });
  }

  return shippingClass?.id || null;
}
