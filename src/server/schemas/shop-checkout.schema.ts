import { z } from 'zod';

/**
 * Schema indirizzo di spedizione/fatturazione
 */
const addressSchema = z.object({
  firstName: z.string().min(1, 'Nome richiesto'),
  lastName: z.string().min(1, 'Cognome richiesto'),
  address: z.string().min(1, 'Indirizzo richiesto'),
  city: z.string().min(1, 'Città richiesta'),
  postalCode: z.string().min(1, 'CAP richiesto'),
  country: z.string().min(1, 'Paese richiesto'),
  company: z.string().optional(),
  addressLine2: z.string().optional(),
  province: z.string().optional(),
});

/**
 * Schema validazione checkout - corpo della richiesta di creazione ordine
 */
export const createCheckoutOrderSchema = {
  body: z.object({
    contact: z.object({
      email: z.string().email('Email non valida'),
      phone: z.string().optional(),
    }),
    shippingAddress: addressSchema,
    billingAddress: addressSchema.nullable().optional(),
    shippingMethodId: z.string().min(1, 'Metodo di spedizione richiesto'),
    paymentMethod: z.enum(['stripe', 'paypal', 'bank_transfer'], {
      errorMap: () => ({ message: 'Metodo di pagamento non valido' }),
    }),
    notes: z.string().optional(),
  }),
};

/**
 * Schema validazione creazione sessione Stripe
 */
export const stripeCreateSessionSchema = {
  body: z.object({
    orderId: z.string().min(1, 'ID ordine richiesto'),
  }),
};

/**
 * Schema validazione creazione intent Stripe
 */
export const stripeCreateIntentSchema = {
  body: z.object({
    orderId: z.string().min(1, 'ID ordine richiesto'),
  }),
};

/**
 * Schema validazione verifica sessione Stripe
 */
export const stripeVerifySessionSchema = {
  params: z.object({
    sessionId: z.string().min(1, 'ID sessione richiesto'),
  }),
};

/**
 * Schema validazione creazione ordine PayPal
 */
export const paypalCreateOrderSchema = {
  body: z.object({
    orderId: z.string().min(1, 'ID ordine richiesto'),
  }),
};

/**
 * Schema validazione cattura ordine PayPal
 */
export const paypalCaptureSchema = {
  body: z.object({
    paypalOrderId: z.string().min(1, 'ID ordine PayPal richiesto'),
  }),
};

/**
 * Schema validazione recupero ordine per identificativo
 */
export const getOrderSchema = {
  params: z.object({
    identifier: z.string().min(1, 'Identificativo ordine richiesto'),
  }),
};

/**
 * Schema validazione tracciamento ordine
 */
export const trackOrderSchema = {
  body: z.object({
    orderNumber: z.string().min(1, 'Numero ordine richiesto'),
    email: z.string().email().optional(),
  }),
};

/**
 * Schema validazione metodi di spedizione
 */
export const shippingMethodsSchema = {
  body: z.object({
    country: z.string().min(1, 'Paese richiesto'),
    postalCode: z.string().optional(),
    cartTotal: z.number().optional(),
  }),
};

/**
 * Schema validazione coupon
 */
export const validateCouponSchema = {
  body: z.object({
    code: z.string().min(1, 'Codice coupon richiesto'),
    cartTotal: z.number().nonnegative(),
  }),
};
