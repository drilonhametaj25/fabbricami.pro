// Imports
import { z } from 'zod';

// Address Schema
const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
}).optional();

// Create Warehouse Schema
export const createWarehouseSchema = {
  body: z.object({
    code: z.string()
      .min(1, 'Il codice è obbligatorio')
      .max(50, 'Il codice non può superare 50 caratteri')
      .regex(/^[A-Z0-9_-]+$/, 'Il codice può contenere solo lettere maiuscole, numeri, underscore e trattini'),
    name: z.string()
      .min(1, 'Il nome è obbligatorio')
      .max(200, 'Il nome non può superare 200 caratteri'),
    description: z.string().max(1000).optional(),
    address: addressSchema,
    isActive: z.boolean().optional().default(true),
    isPrimary: z.boolean().optional().default(false),
  }),
};

// Update Warehouse Schema
export const updateWarehouseSchema = {
  params: z.object({
    id: z.string().uuid('ID magazzino non valido'),
  }),
  body: z.object({
    code: z.string()
      .min(1, 'Il codice è obbligatorio')
      .max(50, 'Il codice non può superare 50 caratteri')
      .regex(/^[A-Z0-9_-]+$/, 'Il codice può contenere solo lettere maiuscole, numeri, underscore e trattini')
      .optional(),
    name: z.string()
      .min(1, 'Il nome è obbligatorio')
      .max(200, 'Il nome non può superare 200 caratteri')
      .optional(),
    description: z.string().max(1000).optional(),
    address: addressSchema,
    isActive: z.boolean().optional(),
    isPrimary: z.boolean().optional(),
  }),
};

// Get Warehouse by ID Schema
export const getWarehouseByIdSchema = {
  params: z.object({
    id: z.string().uuid('ID magazzino non valido'),
  }),
};

// Delete Warehouse Schema
export const deleteWarehouseSchema = {
  params: z.object({
    id: z.string().uuid('ID magazzino non valido'),
  }),
};

// Get Warehouses Schema (with filters)
export const getWarehousesSchema = {
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
    isActive: z.string().transform(val => val === 'true').optional(),
    search: z.string().optional(),
  }),
};

// Set Primary Warehouse Schema
export const setPrimaryWarehouseSchema = {
  params: z.object({
    id: z.string().uuid('ID magazzino non valido'),
  }),
};

// Types (inferiti dagli schema)
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema.body>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema.body>;
export type GetWarehousesQuery = z.infer<typeof getWarehousesSchema.query>;
