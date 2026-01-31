import { z } from 'zod';

/**
 * Schema validazione movimentazione magazzino
 */
export const createInventoryMovementSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']),
  quantity: z.number().positive(),
  unit: z.string().max(20).default('pz'),
  referenceType: z.enum(['ORDER', 'PURCHASE', 'PRODUCTION', 'ADJUSTMENT', 'TRANSFER', 'RETURN']).optional(),
  referenceId: z.string().uuid().optional(),
  lotNumber: z.string().max(50).optional(),
  expiryDate: z.string().datetime().optional(),
  cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  userId: z.string().uuid(), // Chi ha fatto la movimentazione
});

/**
 * Schema validazione trasferimento tra location
 */
export const createTransferSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().positive(),
  lotNumber: z.string().max(50).optional(),
  notes: z.string().optional(),
  userId: z.string().uuid(),
}).refine(data => data.fromLocationId !== data.toLocationId, {
  message: "From and to locations must be different",
  path: ["toLocationId"],
});

/**
 * Schema validazione giacenza
 */
export const updateStockLevelSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  quantity: z.number().int().nonnegative(),
  reservedQuantity: z.number().int().nonnegative().default(0),
  availableQuantity: z.number().int().nonnegative().optional(),
  lastInventoryDate: z.string().datetime().optional(),
}).refine(data => (data.availableQuantity ?? data.quantity) >= 0, {
  message: "Available quantity cannot be negative",
});

/**
 * Schema validazione alert scorte
 */
export const createStockAlertSchema = z.object({
  productId: z.string().uuid(),
  locationId: z.string().uuid(),
  alertType: z.enum(['LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK', 'EXPIRING_SOON']),
  threshold: z.number().int().nonnegative(),
  notifyUserIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().default(true),
});

export const updateStockAlertSchema = createStockAlertSchema.partial().omit({ productId: true, locationId: true });

/**
 * Schema per query inventario
 */
export const inventoryQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  lowStock: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  outOfStock: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
  sortBy: z.enum(['productName', 'quantity', 'location', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per query movimentazioni
 */
export const movementQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'quantity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per calcolo MRP (Material Requirements Planning)
 */
export const mrpCalculationSchema = z.object({
  productId: z.string().uuid(),
  requiredQuantity: z.number().int().positive(),
  requiredDate: z.string().datetime(),
  locationId: z.string().uuid().optional(),
});

export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateStockLevelInput = z.infer<typeof updateStockLevelSchema>;
export type CreateStockAlertInput = z.infer<typeof createStockAlertSchema>;
export type UpdateStockAlertInput = z.infer<typeof updateStockAlertSchema>;
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type MovementQuery = z.infer<typeof movementQuerySchema>;
export type MrpCalculationInput = z.infer<typeof mrpCalculationSchema>;
