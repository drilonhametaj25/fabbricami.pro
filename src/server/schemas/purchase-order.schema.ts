// Imports
import { z } from 'zod';
import { PurchaseOrderStatus } from '@prisma/client';

// Types/Interfaces

// Constants

// Main logic

/**
 * Purchase Order Schemas
 * Validazione Zod per gestione ordini d'acquisto
 */

export const createPurchaseOrderSchema = {
  body: z.object({
    supplierId: z.string().uuid(),
    orderDate: z.coerce.date().optional(),
    expectedDeliveryDate: z.coerce.date().optional(),
    paymentTerms: z.number().int().min(0).default(30),
    notes: z.string().optional().or(z.literal('')),
    items: z.array(
      z.object({
        productId: z.string().uuid().nullable().optional(),
        materialId: z.string().uuid().nullable().optional(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        tax: z.number().min(0).max(100).default(22),
      })
    ).min(1),
    subtotalAmount: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).default(22),
    taxAmount: z.number().min(0).optional(),
    totalAmount: z.number().min(0).optional(),
  }),
};

export const updatePurchaseOrderSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    expectedDeliveryDate: z.coerce.date().optional(),
    paymentTerms: z.number().int().min(0).optional(),
    notes: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(PurchaseOrderStatus).optional(),
  }),
};

export const receiveItemsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    items: z.array(
      z.object({
        itemId: z.string().uuid(),
        receivedQuantity: z.number().int().min(1),
        lotNumber: z.string().optional(),
      })
    ).min(1),
    warehouseId: z.string().uuid().optional(), // Magazzino di destinazione
    warehouseLocation: z.string().optional().default('WEB'), // Ubicazione nel magazzino
  }),
};

export const listPurchaseOrdersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    supplierId: z.string().uuid().optional(),
    status: z.nativeEnum(PurchaseOrderStatus).optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

export const purchaseOrderIdSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const confirmPurchaseOrderSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const cancelPurchaseOrderSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
};

// Exports
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema.body>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema.body>;
export type ReceiveItemsInput = z.infer<typeof receiveItemsSchema.body>;
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersSchema.query>;
