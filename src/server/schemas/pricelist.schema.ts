import { z } from 'zod';

/**
 * Schema validazione creazione listino
 */
export const createPriceListSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  globalDiscount: z.number().min(0).max(100).default(0),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  priority: z.number().int().min(0).default(0),
});

export const updatePriceListSchema = createPriceListSchema.partial();

/**
 * Schema per item listino (prezzo specifico prodotto)
 */
export const createPriceListItemSchema = z.object({
  priceListId: z.string().uuid(),
  productId: z.string().uuid(),
  discountPercent: z.number().min(0).max(100).optional(),
  fixedPrice: z.number().nonnegative().optional(),
  minQuantity: z.number().int().positive().default(1),
});

export const updatePriceListItemSchema = createPriceListItemSchema.partial().omit({ priceListId: true, productId: true });

/**
 * Schema per sconto categoria
 */
export const createCategoryDiscountSchema = z.object({
  priceListId: z.string().uuid(),
  categoryId: z.string().uuid(),
  discountPercent: z.number().min(0).max(100),
});

export const updateCategoryDiscountSchema = createCategoryDiscountSchema.partial().omit({ priceListId: true, categoryId: true });

/**
 * Schema per query listini
 */
export const priceListQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per calcolo prezzo
 */
export const calculatePriceSchema = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

/**
 * Schema per assegnazione listino a cliente
 */
export const assignPriceListSchema = z.object({
  customerId: z.string().uuid(),
  priceListId: z.string().uuid(),
});

/**
 * Schema per bulk import prezzi
 */
export const bulkPriceImportSchema = z.object({
  priceListId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    productSku: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    fixedPrice: z.number().nonnegative().optional(),
    minQuantity: z.number().int().positive().default(1),
  })),
});

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type CreatePriceListItemInput = z.infer<typeof createPriceListItemSchema>;
export type UpdatePriceListItemInput = z.infer<typeof updatePriceListItemSchema>;
export type CreateCategoryDiscountInput = z.infer<typeof createCategoryDiscountSchema>;
export type PriceListQuery = z.infer<typeof priceListQuerySchema>;
export type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
export type AssignPriceListInput = z.infer<typeof assignPriceListSchema>;
export type BulkPriceImportInput = z.infer<typeof bulkPriceImportSchema>;
