// Imports
import { z } from 'zod';

// Create Work Process Schema
export const createWorkProcessSchema = z.object({
  body: z.object({
    productId: z.string().uuid('ID prodotto non valido'),
    operationName: z.string()
      .min(1, 'Il nome operazione è obbligatorio')
      .max(200, 'Il nome operazione non può superare 200 caratteri'),
    sequence: z.number()
      .int('La sequenza deve essere un numero intero')
      .positive('La sequenza deve essere maggiore di zero'),
    standardTime: z.number()
      .positive('Il tempo standard deve essere maggiore di zero'),
    hourlyRate: z.number()
      .nonnegative('Il costo orario non può essere negativo'),
    setupTime: z.number()
      .int('Il tempo di setup deve essere un numero intero')
      .nonnegative('Il tempo di setup non può essere negativo')
      .optional()
      .default(0),
    description: z.string().max(1000).optional(),
  }),
});

// Update Work Process Schema
export const updateWorkProcessSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID lavorazione non valido'),
  }),
  body: z.object({
    operationName: z.string()
      .min(1, 'Il nome operazione è obbligatorio')
      .max(200, 'Il nome operazione non può superare 200 caratteri')
      .optional(),
    sequence: z.number()
      .int('La sequenza deve essere un numero intero')
      .positive('La sequenza deve essere maggiore di zero')
      .optional(),
    standardTime: z.number()
      .positive('Il tempo standard deve essere maggiore di zero')
      .optional(),
    hourlyRate: z.number()
      .nonnegative('Il costo orario non può essere negativo')
      .optional(),
    setupTime: z.number()
      .int('Il tempo di setup deve essere un numero intero')
      .nonnegative('Il tempo di setup non può essere negativo')
      .optional(),
    description: z.string().max(1000).optional(),
  }),
});

// Get Work Process by ID Schema
export const getWorkProcessByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID lavorazione non valido'),
  }),
});

// Delete Work Process Schema
export const deleteWorkProcessSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID lavorazione non valido'),
  }),
});

// Get Product Work Processes Schema
export const getProductWorkProcessesSchema = z.object({
  params: z.object({
    productId: z.string().uuid('ID prodotto non valido'),
  }),
});

// Reorder Work Processes Schema
export const reorderWorkProcessesSchema = z.object({
  params: z.object({
    productId: z.string().uuid('ID prodotto non valido'),
  }),
  body: z.object({
    operationIds: z.array(z.string().uuid('ID lavorazione non valido'))
      .min(1, 'Almeno una lavorazione richiesta'),
  }),
});

// Duplicate Work Processes Schema
export const duplicateWorkProcessesSchema = z.object({
  body: z.object({
    sourceProductId: z.string().uuid('ID prodotto sorgente non valido'),
    targetProductId: z.string().uuid('ID prodotto destinazione non valido'),
  }),
});

// Calculate Production Time Schema
export const calculateProductionTimeSchema = z.object({
  params: z.object({
    productId: z.string().uuid('ID prodotto non valido'),
  }),
  query: z.object({
    quantity: z.string()
      .transform(Number)
      .pipe(z.number().int().positive())
      .optional()
      .default('1'),
  }),
});

// Types (inferiti dagli schema)
export type CreateWorkProcessInput = z.infer<typeof createWorkProcessSchema>['body'];
export type UpdateWorkProcessInput = z.infer<typeof updateWorkProcessSchema>['body'];
export type ReorderWorkProcessesInput = z.infer<typeof reorderWorkProcessesSchema>['body'];
export type DuplicateWorkProcessesInput = z.infer<typeof duplicateWorkProcessesSchema>['body'];
