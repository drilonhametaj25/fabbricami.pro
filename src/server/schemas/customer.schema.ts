import { z } from 'zod';

// Schema indirizzo (compatibile WooCommerce)
const addressSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default('IT'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).optional();

/**
 * Schema base cliente
 */
const baseCustomerFields = {
  type: z.enum(['B2C', 'B2B']),
  // Dati anagrafici
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  businessName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  // Dati fiscali (B2B)
  taxId: z.string().max(20).optional(), // Partita IVA
  fiscalCode: z.string().max(20).optional(), // Codice fiscale
  sdiCode: z.string().max(7).optional(), // Codice SDI
  pecEmail: z.string().email().optional(), // PEC
  // Indirizzi
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  // Termini commerciali
  paymentTerms: z.number().int().nonnegative().default(30),
  creditLimit: z.number().nonnegative().optional(),
  discount: z.number().min(0).max(100).default(0),
  priceListId: z.string().uuid().optional(),
  // Classificazione
  customerGroup: z.string().optional(),
  acquisitionSource: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Stato
  isActive: z.boolean().default(true),
  // Note
  notes: z.string().optional(),
  // WordPress
  wordpressId: z.number().int().positive().optional(),
};

/**
 * Schema validazione creazione cliente
 */
export const createCustomerSchema = z.object(baseCustomerFields).refine(
  data => {
    if (data.type === 'B2C') {
      return data.firstName && data.lastName;
    }
    if (data.type === 'B2B') {
      return data.businessName;
    }
    return true;
  },
  {
    message: "B2C customers require firstName and lastName, B2B customers require businessName",
    path: ["type"],
  }
);

/**
 * Schema per update (tutti i campi opzionali tranne type)
 */
export const updateCustomerSchema = z.object({
  ...baseCustomerFields,
  type: z.enum(['B2C', 'B2B']).optional(),
}).partial();

/**
 * Schema contatto cliente (B2B)
 */
export const createContactSchema = z.object({
  customerId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  mobile: z.string().max(20).optional(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial().omit({ customerId: true });

/**
 * Schema info bancarie cliente (B2B)
 */
export const createBankInfoSchema = z.object({
  customerId: z.string().uuid(),
  bankName: z.string().max(100).optional(),
  iban: z.string().max(34).optional(),
  swift: z.string().max(11).optional(),
  notes: z.string().optional(),
});

export const updateBankInfoSchema = createBankInfoSchema.partial().omit({ customerId: true });

/**
 * Schema per query clienti
 */
export const customerQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(500)).optional(),
  type: z.enum(['B2C', 'B2B']).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
  customerGroup: z.string().optional(),
  priceListId: z.string().uuid().optional(),
  hasOrders: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['code', 'businessName', 'firstName', 'email', 'createdAt', 'totalOrders', 'totalSpent']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per analisi cliente
 */
export const customerAnalysisSchema = z.object({
  customerId: z.string().uuid(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * Schema per segmentazione clienti (RFM - Recency, Frequency, Monetary)
 */
export const customerSegmentationSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minOrders: z.number().int().nonnegative().optional(),
  minRevenue: z.number().nonnegative().optional(),
});

/**
 * Schema import da WordPress
 */
export const wpCustomerImportSchema = z.object({
  wordpressId: z.number().int().positive(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  role: z.string().optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  isPayingCustomer: z.boolean().optional(),
  ordersCount: z.number().int().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
  dateCreated: z.string().datetime().optional(),
  dateModified: z.string().datetime().optional(),
  metaData: z.any().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateBankInfoInput = z.infer<typeof createBankInfoSchema>;
export type UpdateBankInfoInput = z.infer<typeof updateBankInfoSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type CustomerAnalysisInput = z.infer<typeof customerAnalysisSchema>;
export type CustomerSegmentationInput = z.infer<typeof customerSegmentationSchema>;
export type WpCustomerImportInput = z.infer<typeof wpCustomerImportSchema>;
