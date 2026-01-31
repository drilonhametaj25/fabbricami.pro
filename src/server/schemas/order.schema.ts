import { z } from 'zod';

/**
 * Schema validazione creazione ordine
 */
export const createOrderSchema = z.object({
  orderNumber: z.string().max(50).optional(), // Auto-generato se non fornito
  customerId: z.string().uuid(),
  source: z.enum(['WEB', 'B2B', 'MANUAL', 'WORDPRESS']),
  status: z.enum(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']).default('DRAFT'),
  orderDate: z.string().datetime().optional(),
  shippingAddress: z.any().optional(), // JSON field in Prisma
  billingAddress: z.any().optional(), // JSON field in Prisma
  paymentMethod: z.string().max(100).optional(),
  paymentStatus: z.string().max(50).default('pending'),
  shipping: z.number().nonnegative().default(0), // Prisma field name
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  wordpressId: z.number().int().optional(),
  // Items saranno gestiti separatamente
});

/**
 * Schema validazione item ordine
 */
export const createOrderItemSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(22),
  notes: z.string().optional(),
});

export const updateOrderItemSchema = createOrderItemSchema.partial().omit({ orderId: true });

/**
 * Schema validazione aggiornamento ordine
 */
export const updateOrderSchema = createOrderSchema.partial().omit({ customerId: true, source: true });

/**
 * Schema validazione cambio stato ordine
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  notes: z.string().optional(),
  notifyCustomer: z.boolean().default(true),
});

/**
 * Schema validazione ordine completo (con items)
 */
export const createOrderWithItemsSchema = z.object({
  order: createOrderSchema,
  items: z.array(createOrderItemSchema.omit({ orderId: true })).min(1),
});

/**
 * Schema per aggiungere item a ordine
 */
export const addOrderItemSchema = createOrderItemSchema.omit({ orderId: true });

/**
 * Schema per query ordini
 */
export const orderQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(500)).optional(),
  customerId: z.string().uuid().optional(),
  status: z.string().transform((val) => val.split(',')).pipe(
    z.array(z.enum(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']))
  ).optional(),
  source: z.enum(['WEB', 'B2B', 'MANUAL', 'WORDPRESS']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(), // Cerca in orderNumber, customer name
  sortBy: z.enum(['orderNumber', 'orderDate', 'total', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema validazione allocazione magazzino per ordine
 */
export const allocateInventorySchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid().optional(), // Se non specificato, alloca dalla location con più giacenza
  createBackorders: z.boolean().default(false), // Creare ordini arretrati se giacenza insufficiente
});

/**
 * Schema validazione spedizione
 */
export const createShipmentSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  shippedDate: z.string().datetime().optional(),
  estimatedDeliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateShipmentSchema = createShipmentSchema.partial().omit({ orderId: true });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreateOrderWithItemsInput = z.infer<typeof createOrderWithItemsSchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type AllocateInventoryInput = z.infer<typeof allocateInventorySchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

/**
 * Schema per preview prezzi B2B
 */
export const b2bPricePreviewSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

/**
 * Schema per creazione ordine B2B con calcolo automatico prezzi
 */
export const createB2BOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
  shippingAddress: z.any().optional(),
  billingAddress: z.any().optional(),
  paymentMethod: z.string().max(100).optional(),
  shipping: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export type B2BPricePreviewInput = z.infer<typeof b2bPricePreviewSchema>;
export type CreateB2BOrderInput = z.infer<typeof createB2BOrderSchema>;
