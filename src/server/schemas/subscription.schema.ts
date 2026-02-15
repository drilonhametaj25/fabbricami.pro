import { z } from 'zod';

// ============================================
// SUBSCRIPTION SCHEMAS
// ============================================

/**
 * Schema per creazione subscription con Stripe Checkout
 */
export const createSubscriptionCheckoutSchema = z.object({
  planCode: z.enum(['STARTER', 'PRO', 'BUSINESS']),
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * Schema per creazione subscription diretta (con payment method)
 */
export const createSubscriptionSchema = z.object({
  planCode: z.enum(['STARTER', 'PRO', 'BUSINESS']),
  billingPeriod: z.enum(['monthly', 'yearly']),
  paymentMethodId: z.string().optional(),
});

/**
 * Schema per aggiornamento subscription
 */
export const updateSubscriptionSchema = z.object({
  planCode: z.enum(['STARTER', 'PRO', 'BUSINESS']).optional(),
  billingPeriod: z.enum(['monthly', 'yearly']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

/**
 * Schema per creazione trial subscription
 */
export const createTrialSubscriptionSchema = z.object({
  planCode: z.enum(['STARTER', 'PRO', 'BUSINESS']).default('PRO'),
});

/**
 * Schema per creazione Customer Portal session
 */
export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

/**
 * Schema per query parametri calcolo proration
 */
export const calculateProrationSchema = z.object({
  newPlanCode: z.enum(['STARTER', 'PRO', 'BUSINESS']),
  billingPeriod: z.enum(['monthly', 'yearly']),
});

// ============================================
// BILLING SCHEMAS
// ============================================

/**
 * Schema per query billing history
 */
export const billingHistoryQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('20'),
});

/**
 * Schema per verifica limiti piano
 */
export const checkLimitSchema = z.object({
  resource: z.enum(['users', 'warehouses', 'products', 'orders', 'suppliers']),
});

/**
 * Schema per verifica feature
 */
export const checkFeatureSchema = z.object({
  feature: z.string().min(1),
});

// ============================================
// PLAN SCHEMAS
// ============================================

/**
 * Schema per creazione piano (admin)
 */
export const createPlanSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(100),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
  features: z.array(z.string()),
  limits: z.object({
    maxUsers: z.number().int().min(-1),
    maxWarehouses: z.number().int().min(-1),
    maxProducts: z.number().int().min(-1),
    maxOrders: z.number().int().min(-1),
    maxSuppliers: z.number().int().min(-1),
    features: z.array(z.string()),
  }),
  isActive: z.boolean().default(true),
});

/**
 * Schema per aggiornamento piano (admin)
 */
export const updatePlanSchema = createPlanSchema.partial();

// ============================================
// WEBHOOK SCHEMAS
// ============================================

/**
 * Schema per webhook Stripe
 */
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }),
  created: z.number(),
  livemode: z.boolean(),
});

// ============================================
// TYPES
// ============================================

export type CreateSubscriptionCheckoutInput = z.infer<typeof createSubscriptionCheckoutSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateTrialSubscriptionInput = z.infer<typeof createTrialSubscriptionSchema>;
export type CreatePortalSessionInput = z.infer<typeof createPortalSessionSchema>;
export type CalculateProrationInput = z.infer<typeof calculateProrationSchema>;
export type BillingHistoryQueryInput = z.infer<typeof billingHistoryQuerySchema>;
export type CheckLimitInput = z.infer<typeof checkLimitSchema>;
export type CheckFeatureInput = z.infer<typeof checkFeatureSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
