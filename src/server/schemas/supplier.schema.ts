// Imports
import { z } from 'zod';

// Types/Interfaces

// Constants

// Main logic

/**
 * Supplier Schemas
 * Validazione Zod per gestione fornitori
 */

export const createSupplierSchema = {
  body: z.object({
    code: z.string().min(1).max(50),
    businessName: z.string().min(1).max(255),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(50).optional().or(z.literal('')),
    taxId: z.string().max(50).optional().or(z.literal('')),
    website: z.string().max(255).optional().or(z.literal('')),
    address: z.object({
      street: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      province: z.string().max(2).optional().or(z.literal('')),
      zip: z.string().optional().or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
    }).optional(),
    paymentTerms: z.number().int().min(0).default(30),
    defaultLeadTimeDays: z.number().int().min(1).max(365).default(7),
    bankName: z.string().max(100).optional().or(z.literal('')),
    iban: z.string().max(34).optional().or(z.literal('')),
    swift: z.string().max(11).optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    isActive: z.boolean().optional().default(true),
  }),
};

export const updateSupplierSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    businessName: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(50).optional().or(z.literal('')),
    taxId: z.string().max(50).optional().or(z.literal('')),
    website: z.string().max(255).optional().or(z.literal('')),
    address: z.object({
      street: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      province: z.string().max(2).optional().or(z.literal('')),
      zip: z.string().optional().or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
    }).optional(),
    paymentTerms: z.number().int().min(0).optional(),
    defaultLeadTimeDays: z.number().int().min(1).max(365).optional(),
    bankName: z.string().max(100).optional().or(z.literal('')),
    iban: z.string().max(34).optional().or(z.literal('')),
    swift: z.string().max(11).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    notes: z.string().optional().or(z.literal('')),
  }),
};

export const listSuppliersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

export const supplierIdSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

// Exports
export type CreateSupplierInput = z.infer<typeof createSupplierSchema.body>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema.body>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersSchema.query>;
