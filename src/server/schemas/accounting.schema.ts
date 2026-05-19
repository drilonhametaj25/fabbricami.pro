import { z } from 'zod';

// B2B Payment Methods enum matching Prisma schema
export const b2bPaymentMethodEnum = z.enum([
  'BONIFICO',
  'RIBA',
  'CONTANTI',
  'FIDO',
  'ASSEGNO',
  'CARTA',
  'OTHER',
]);

// Payment Due Type enum
export const paymentDueTypeEnum = z.enum(['RECEIVABLE', 'PAYABLE']);

// Payment Due Status enum
export const paymentDueStatusEnum = z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']);

/**
 * Schema riga fattura (lato API).
 * Le righe vengono usate per calcolare/validare subtotale e IVA;
 * il backend attualmente non persiste righe distinte (Invoice non ha
 * relazione items), ma le accetta in input per compatibilità con il
 * dialog "Nuova Fattura" del client.
 */
export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100),
  total: z.number().nonnegative().optional(),
});

/**
 * Schema validazione creazione fattura
 */
export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().max(50).optional(), // Auto-generated
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  type: z.enum(['SALE', 'PURCHASE']), // Prisma InvoiceType
  documentType: z
    .enum([
      'TD01',
      'TD02',
      'TD03',
      'TD04',
      'TD05',
      'TD06',
      'TD16',
      'TD17',
      'TD18',
      'TD19',
      'TD20',
      'TD24',
      'TD25',
      'TD26',
      'TD27',
    ])
    .optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().default(0),
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']).default('DRAFT'),
  notes: z.string().optional(),
  // Righe opzionali (vedi invoiceItemSchema). Se presenti, vengono usate
  // dal service per generare l'XML FatturaPA o per esporre il dettaglio.
  items: z.array(invoiceItemSchema).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().omit({ invoiceNumber: true, customerId: true });

/**
 * Schema validazione pagamento
 */
export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paidAt: z.string().datetime(),
  method: z.enum(['CARD', 'BANK_TRANSFER', 'CASH', 'PAYPAL', 'CHECK', 'OTHER']),
  transactionId: z.string().max(100).optional(),
  notes: z.string().optional(),
});

/**
 * Schema validazione scadenza (incasso/pagamento)
 */
export const createPaymentDueSchema = z.object({
  type: z.enum(['RECEIVABLE', 'PAYABLE']), // Attivo/Passivo
  referenceType: z.enum(['INVOICE', 'BILL', 'OTHER']),
  referenceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']).default('PENDING'),
  paidAmount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const updatePaymentDueSchema = createPaymentDueSchema.partial();

/**
 * Schema validazione costo generale
 */
export const createOverheadCostSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['RENT', 'UTILITIES', 'INSURANCE', 'SALARIES', 'MARKETING', 'MAINTENANCE', 'OTHER']),
  amount: z.number().positive(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  allocationMethod: z.enum(['LABOR_HOURS', 'PRODUCTION_VOLUME', 'MANUAL']).default('LABOR_HOURS'),
  notes: z.string().optional(),
});

export const updateOverheadCostSchema = createOverheadCostSchema.partial();

/**
 * Schema per query fatture
 */
export const invoiceQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']).optional(),
  type: z.enum(['SALE', 'PURCHASE']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['invoiceNumber', 'invoiceDate', 'dueDate', 'total', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema per scadenzario
 */
export const paymentDueQuerySchema = z.object({
  type: z.enum(['RECEIVABLE', 'PAYABLE']).optional(),
  status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  overdue: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

/**
 * Schema per break-even analysis
 */
export const breakEvenAnalysisSchema = z.object({
  productId: z.string().uuid().optional(),
  period: z.enum(['MONTH', 'QUARTER', 'YEAR']),
  year: z.number().int().positive(),
  month: z.number().int().min(1).max(12).optional(),
});

/**
 * Schema validazione piano di pagamento
 */
export const createPaymentPlanSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  installments: z.array(z.object({
    sequence: z.number().int().positive(),
    percentage: z.number().positive().max(100),
    daysFromInvoice: z.number().int().nonnegative(),
  })).min(1),
});

export const updatePaymentPlanSchema = createPaymentPlanSchema.partial();

/**
 * Schema validazione scadenza (nuova versione completa)
 */
export const createPaymentDueSchemaV2 = z.object({
  type: paymentDueTypeEnum,
  invoiceId: z.string().uuid().optional(),
  supplierInvoiceId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  paymentMethod: b2bPaymentMethodEnum.optional(),
  bankReference: z.string().max(100).optional(),
  ribaReference: z.string().max(100).optional(),
  installmentNumber: z.number().int().positive().optional(),
  totalInstallments: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const updatePaymentDueSchemaV2 = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  status: paymentDueStatusEnum.optional(),
  paymentMethod: b2bPaymentMethodEnum.optional(),
  bankReference: z.string().max(100).optional(),
  ribaReference: z.string().max(100).optional(),
  notes: z.string().optional(),
});

/**
 * Schema per registrare pagamento su scadenza
 */
export const recordPaymentDuePaymentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().datetime(),
  method: b2bPaymentMethodEnum,
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});

/**
 * Schema per generare scadenze da fattura
 */
export const generateDuesFromInvoiceSchema = z.object({
  paymentPlanId: z.string().uuid().optional(),
});

/**
 * Query schema esteso per scadenze
 */
export const paymentDueQuerySchemaV2 = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  type: paymentDueTypeEnum.optional(),
  status: paymentDueStatusEnum.optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  overdue: z.string().transform(val => val === 'true').optional(),
  sortBy: z.enum(['dueDate', 'amount', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
