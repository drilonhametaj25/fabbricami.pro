import { z } from 'zod';

// Enums matching Prisma schema
export const goodsReceiptStatusEnum = z.enum(['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED']);
export const inspectionStatusEnum = z.enum(['NOT_REQUIRED', 'PENDING', 'PASSED', 'FAILED', 'CONDITIONAL']);
export const qualityStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CONDITIONAL']);

/**
 * Schema per query goods receipts
 */
export const goodsReceiptQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  status: goodsReceiptStatusEnum.optional(),
  supplierId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['receiptDate', 'receiptNumber', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per articolo entrata merce
 */
export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  receivedQuantity: z.number().nonnegative(),
  acceptedQuantity: z.number().nonnegative(),
  rejectedQuantity: z.number().nonnegative().optional(),
  lotNumber: z.string().max(50).optional(),
  expiryDate: z.string().datetime().optional(),
  storageLocation: z.string().max(100).optional(),
  qualityNotes: z.string().optional(),
});

/**
 * Schema per creazione entrata merce
 */
export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  documentDate: z.string().datetime().optional(),
  supplierDocNumber: z.string().max(50).optional(),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  deliveryNote: z.string().optional(),
  inspectionRequired: z.boolean().optional(),
  receivedBy: z.string().max(100).optional(),
  notes: z.string().optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

/**
 * Schema per aggiornamento entrata merce
 */
export const updateGoodsReceiptSchema = z.object({
  documentDate: z.string().datetime().optional(),
  supplierDocNumber: z.string().max(50).optional(),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  deliveryNote: z.string().optional(),
  inspectionRequired: z.boolean().optional(),
  notes: z.string().optional(),
});

/**
 * Schema per ricezione articoli
 */
export const receiveItemsSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    receivedQuantity: z.number().nonnegative(),
    acceptedQuantity: z.number().nonnegative(),
    rejectedQuantity: z.number().nonnegative().optional(),
    lotNumber: z.string().max(50).optional(),
    expiryDate: z.string().datetime().optional(),
    storageLocation: z.string().max(100).optional(),
    qualityStatus: qualityStatusEnum.optional(),
    qualityNotes: z.string().optional(),
  })).min(1),
});

/**
 * Schema per ispezione qualità
 */
export const inspectionSchema = z.object({
  inspectionStatus: inspectionStatusEnum,
  inspectionNotes: z.string().optional(),
  inspectedBy: z.string().min(1).max(100),
  itemResults: z.array(z.object({
    itemId: z.string().uuid(),
    qualityStatus: qualityStatusEnum,
    acceptedQuantity: z.number().nonnegative(),
    rejectedQuantity: z.number().nonnegative(),
    qualityNotes: z.string().optional(),
  })).optional(),
});

/**
 * Schema per allegato
 */
export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  type: z.string().min(1).max(50),
});

/**
 * Schema per annullamento
 */
export const cancelReceiptSchema = z.object({
  reason: z.string().min(1).max(500),
});

// Export types
export type GoodsReceiptQuery = z.infer<typeof goodsReceiptQuerySchema>;
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type UpdateGoodsReceiptInput = z.infer<typeof updateGoodsReceiptSchema>;
export type ReceiveItemsInput = z.infer<typeof receiveItemsSchema>;
export type InspectionInput = z.infer<typeof inspectionSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
export type CancelReceiptInput = z.infer<typeof cancelReceiptSchema>;
