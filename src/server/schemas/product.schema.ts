import { z } from 'zod';

/**
 * Helper per numeri che possono arrivare come stringhe dal frontend
 * Accetta number | string | null | undefined e restituisce number | undefined
 */
const coerceNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  }
  return val;
}, z.number().optional());

const coerceNumberRequired = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return val;
}, z.number());

const coerceInt = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return typeof val === 'number' ? Math.floor(val) : val;
}, z.number().int().optional());

const coerceIntRequired = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return typeof val === 'number' ? Math.floor(val) : val;
}, z.number().int());

/**
 * Schema dimensioni prodotto - permette valori >= 0
 */
const dimensionsSchema = z.object({
  width: coerceNumberRequired.pipe(z.number().nonnegative()),
  height: coerceNumberRequired.pipe(z.number().nonnegative()),
  depth: coerceNumberRequired.pipe(z.number().nonnegative()),
}).nullable().optional();

/**
 * Schema validazione creazione prodotto - Allineato con Prisma schema
 */
export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU è obbligatorio').max(50),
  name: z.string().min(1, 'Nome è obbligatorio').max(255),
  description: z.string().nullable().optional(),
  type: z.enum(['SIMPLE', 'WITH_VARIANTS', 'RAW_MATERIAL', 'DIGITAL']).default('SIMPLE'),
  category: z.string().nullable().optional(),
  unit: z.string().max(20).default('pz'),
  barcode: z.string().max(50).nullable().optional(),
  cost: coerceNumberRequired.pipe(z.number().nonnegative()).default(0),
  price: coerceNumberRequired.pipe(z.number().nonnegative()).default(0),
  weight: coerceNumber.pipe(z.number().nonnegative().optional()),
  dimensions: dimensionsSchema,
  minStockLevel: coerceIntRequired.pipe(z.number().int().nonnegative()).default(0),
  reorderQuantity: coerceIntRequired.pipe(z.number().int().nonnegative()).default(0),
  leadTimeDays: coerceIntRequired.pipe(z.number().int().nonnegative()).default(0),
  isActive: z.boolean().default(true),
  isSellable: z.boolean().default(true),
  wordpressId: coerceInt.pipe(z.number().int().positive().optional()).nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),

  // Campi WooCommerce che il frontend può inviare
  woocommerceId: coerceInt.nullable().optional(),
  syncStatus: z.string().nullable().optional(),
  lastSyncAt: z.string().nullable().optional(),
  wcDateCreated: z.string().nullable().optional(),
  wcDateModified: z.string().nullable().optional(),
  wcPermalink: z.string().nullable().optional(),
  wcStatus: z.string().nullable().optional(),
  wcFeatured: z.boolean().nullable().optional(),
  wcCatalogVisibility: z.string().nullable().optional(),
  wcMenuOrder: coerceInt.nullable().optional(),
  wcSalePrice: coerceNumber.nullable().optional(),
  wcOnSale: z.boolean().nullable().optional(),
  wcDateOnSaleFrom: z.string().nullable().optional(),
  wcDateOnSaleTo: z.string().nullable().optional(),
  wcPriceHtml: z.string().nullable().optional(),
  wcStockStatus: z.string().nullable().optional(),
  wcBackorders: z.string().nullable().optional(),
  wcBackordersAllowed: z.boolean().nullable().optional(),
  wcSoldIndividually: z.boolean().nullable().optional(),
  shippingClassSlug: z.string().nullable().optional(),
  shippingClassId: z.string().uuid().nullable().optional(),
  taxStatus: z.string().nullable().optional(),
  taxClass: z.string().nullable().optional(),
  wcPurchasable: z.boolean().nullable().optional(),
  wcReviewsAllowed: z.boolean().nullable().optional(),
  wcAverageRating: coerceNumber.nullable().optional(),
  wcRatingCount: coerceInt.nullable().optional(),
  wcTotalSales: coerceInt.nullable().optional(),
  wcRelatedIds: z.any().nullable().optional(),
  wcUpsellIds: z.any().nullable().optional(),
  wcCrossSellIds: z.any().nullable().optional(),
  wcPurchaseNote: z.string().nullable().optional(),
  wcExternalUrl: z.string().nullable().optional(),
  wcButtonText: z.string().nullable().optional(),
  wcParentId: coerceInt.nullable().optional(),
  wcGroupedProducts: z.any().nullable().optional(),

  // Nuovi campi WooCommerce per prodotti virtuali/downloadable
  wcVirtual: z.boolean().nullable().optional(),
  wcDownloadable: z.boolean().nullable().optional(),
  wcDownloadLimit: coerceInt.nullable().optional(),
  wcDownloadExpiry: coerceInt.nullable().optional(),
  wcGlobalUniqueId: z.string().nullable().optional(),
  wcDefaultAttributes: z.any().nullable().optional(),

  wcTags: z.any().nullable().optional(),
  wcMetaData: z.any().nullable().optional(),
  mainImageUrl: z.string().nullable().optional(),
  mainImageId: coerceInt.nullable().optional(),
  webPrice: coerceNumber.nullable().optional(),
  webDescription: z.string().nullable().optional(),
  webShortDescription: z.string().nullable().optional(),
  webActive: z.boolean().nullable().optional(),
  webSlug: z.string().nullable().optional(),
  webMetaTitle: z.string().nullable().optional(),
  webMetaDescription: z.string().nullable().optional(),
  webAttributes: z.any().nullable().optional(),
  downloadFiles: z.any().nullable().optional(),
  images: z.any().nullable().optional(),

  // Campi ignorati (relazioni che il frontend invia ma non devono essere processati)
  id: z.string().uuid().optional(), // Ignorato nell'update, usato solo come riferimento
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  variants: z.any().optional(),
  inventory: z.any().optional(),
  supplier: z.any().optional(),
  productImages: z.any().optional(),
  categories: z.any().optional(),
  minStock: coerceInt.nullable().optional(),
  maxStock: coerceInt.nullable().optional(),
  reorderPoint: coerceInt.nullable().optional(),
});

/**
 * Schema validazione aggiornamento prodotto - Tutti i campi opzionali
 * Rimuove i campi che non devono essere aggiornati direttamente
 */
export const updateProductSchema = createProductSchema
  .partial()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    variants: true,
    inventory: true,
    supplier: true,
    productImages: true,
    categories: true,
  });

/**
 * Schema validazione variante prodotto - Allineato con Prisma schema e WooCommerce
 */
export const createProductVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  attributes: z.record(z.string()).optional(),
  barcode: z.string().max(50).optional(),
  costDelta: coerceNumberRequired.default(0),
  priceDelta: coerceNumberRequired.default(0),
  isActive: z.boolean().default(true),

  // Campi fisici (per varianti che differiscono in peso/dimensioni)
  weight: coerceNumber.pipe(z.number().nonnegative().optional()),
  dimensions: dimensionsSchema,

  // WooCommerce fields
  woocommerceVariationId: coerceInt.nullable().optional(),
  webPrice: coerceNumber.nullable().optional(),
  webActive: z.boolean().nullable().optional(),
  mainImageUrl: z.string().nullable().optional(),
  mainImageId: coerceInt.nullable().optional(),
  webDescription: z.string().nullable().optional(),

  // WooCommerce - Prezzi e saldi variante
  wcSalePrice: coerceNumber.nullable().optional(),
  wcOnSale: z.boolean().nullable().optional(),
  wcDateOnSaleFrom: z.string().nullable().optional(),
  wcDateOnSaleTo: z.string().nullable().optional(),

  // WooCommerce - Stock variante
  wcStockStatus: z.string().nullable().optional(), // instock, outofstock, onbackorder
  wcBackorders: z.string().nullable().optional(), // no, notify, yes
  wcManageStock: z.boolean().nullable().optional(),

  // WooCommerce - Tipo variante
  wcVirtual: z.boolean().nullable().optional(),
  wcDownloadable: z.boolean().nullable().optional(),
  wcDownloads: z.any().nullable().optional(), // [{name, file}]
  wcDownloadLimit: coerceInt.nullable().optional(),
  wcDownloadExpiry: coerceInt.nullable().optional(),

  // WooCommerce - Menu order
  wcMenuOrder: coerceInt.nullable().optional(),

  // Campi ignorati (relazioni che il frontend invia ma non devono essere processati)
  id: z.string().uuid().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  product: z.any().optional(),
  inventory: z.any().optional(),
  images: z.any().optional(),
});

export const updateProductVariantSchema = createProductVariantSchema
  .partial()
  .omit({
    productId: true,
    id: true,
    createdAt: true,
    updatedAt: true,
    product: true,
    inventory: true,
    images: true,
  });

/**
 * Schema validazione BOM (Bill of Materials) - Allineato con Prisma
 */
export const createBomItemSchema = z.object({
  parentProductId: z.string().uuid(),
  componentProductId: z.string().uuid(),
  quantity: coerceNumberRequired.pipe(z.number().positive()),
  unit: z.string().max(20).default('pz'),
  scrapPercentage: coerceNumberRequired.pipe(z.number().min(0).max(100)).default(0),
  notes: z.string().nullable().optional(),
});

export const updateBomItemSchema = createBomItemSchema.partial().omit({ parentProductId: true, componentProductId: true });

/**
 * Schema validazione lavorazioni prodotto - Allineato con Prisma ProductOperation
 */
export const createProductOperationSchema = z.object({
  productId: z.string().uuid(),
  operationName: z.string().min(1, 'Nome operazione è obbligatorio').max(200),
  sequence: coerceIntRequired.pipe(z.number().int().positive()),
  standardTime: coerceNumberRequired.pipe(z.number().positive()),
  hourlyRate: coerceNumberRequired.pipe(z.number().nonnegative()).default(0),
  setupTime: coerceIntRequired.pipe(z.number().int().nonnegative()).default(0),
  description: z.string().nullable().optional(),
});

export const updateProductOperationSchema = createProductOperationSchema.partial().omit({ productId: true });

/**
 * Schema per query list prodotti
 */
export const productQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['sku', 'name', 'price', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
export type CreateBomItemInput = z.infer<typeof createBomItemSchema>;
export type UpdateBomItemInput = z.infer<typeof updateBomItemSchema>;
export type CreateProductOperationInput = z.infer<typeof createProductOperationSchema>;
export type UpdateProductOperationInput = z.infer<typeof updateProductOperationSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
