import { z } from 'zod';

// ============================================
// REGISTRATION SCHEMAS
// ============================================

/**
 * Schema for new tenant registration
 */
export const registerSchema = {
  body: z.object({
    email: z.string().email('Email non valida'),
    password: z
      .string()
      .min(8, 'La password deve essere di almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
      .regex(/[a-z]/, 'La password deve contenere almeno una lettera minuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
    firstName: z.string().min(1, 'Nome richiesto').max(100),
    lastName: z.string().min(1, 'Cognome richiesto').max(100),
    companyName: z.string().min(1, 'Nome azienda richiesto').max(200),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'Devi accettare i termini e condizioni',
    }),
  }),
};

/**
 * Schema for email verification
 */
export const verifyEmailSchema = {
  body: z.object({
    token: z.string().min(1, 'Token richiesto'),
  }),
};

/**
 * Schema for resend verification email
 */
export const resendVerificationSchema = {
  body: z.object({
    email: z.string().email('Email non valida'),
  }),
};

// ============================================
// PASSWORD RESET SCHEMAS
// ============================================

/**
 * Schema for password reset request
 */
export const passwordResetRequestSchema = {
  body: z.object({
    email: z.string().email('Email non valida'),
  }),
};

/**
 * Schema for password reset
 */
export const passwordResetSchema = {
  body: z.object({
    token: z.string().min(1, 'Token richiesto'),
    newPassword: z
      .string()
      .min(8, 'La password deve essere di almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
      .regex(/[a-z]/, 'La password deve contenere almeno una lettera minuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
  }),
};

// ============================================
// ONBOARDING WIZARD SCHEMAS
// ============================================

/**
 * Schema for company settings during onboarding
 */
export const companySettingsSchema = {
  body: z.object({
    companyName: z.string().min(1, 'Nome azienda richiesto').max(200),
    legalName: z.string().max(200).optional(),
    vatNumber: z.string().min(1, 'Partita IVA richiesta').max(20),
    fiscalCode: z.string().max(20).optional(),
    // Address
    street: z.string().min(1, 'Indirizzo richiesto').max(200),
    city: z.string().min(1, 'Città richiesta').max(100),
    province: z.string().min(2).max(2, 'Usa la sigla della provincia'),
    postalCode: z.string().min(5).max(10),
    country: z.string().default('IT'),
    // Contact
    phone: z.string().max(20).optional(),
    email: z.string().email('Email non valida').optional(),
    pec: z.string().email('PEC non valida').optional(),
    sdiCode: z.string().length(7).optional(), // Codice SDI
    // Bank info
    bankName: z.string().max(100).optional(),
    iban: z.string().max(34).optional(),
    swift: z.string().max(11).optional(),
    // Logo (base64 or URL)
    logo: z.string().optional(),
  }),
};

/**
 * Schema for creating first warehouse
 */
export const createWarehouseSchema = {
  body: z.object({
    name: z.string().min(1, 'Nome magazzino richiesto').max(100),
    code: z.string().min(1, 'Codice magazzino richiesto').max(20),
    type: z.enum(['MAIN', 'SECONDARY', 'TRANSIT', 'DROPSHIP']).default('MAIN'),
    // Address
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    province: z.string().max(2).optional(),
    postalCode: z.string().max(10).optional(),
    country: z.string().default('IT'),
  }),
};

// ============================================
// TEAM INVITATION SCHEMAS
// ============================================

/**
 * Schema for inviting a user to tenant
 */
export const inviteUserSchema = {
  body: z.object({
    email: z.string().email('Email non valida'),
    role: z.enum(['ADMIN', 'MANAGER', 'CONTABILE', 'MAGAZZINIERE', 'OPERATORE', 'COMMERCIALE', 'VIEWER']),
  }),
};

/**
 * Schema for accepting an invitation
 */
export const acceptInviteSchema = {
  body: z.object({
    token: z.string().min(1, 'Token richiesto'),
    firstName: z.string().min(1, 'Nome richiesto').max(100),
    lastName: z.string().min(1, 'Cognome richiesto').max(100),
    password: z
      .string()
      .min(8, 'La password deve essere di almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
      .regex(/[a-z]/, 'La password deve contenere almeno una lettera minuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
  }),
};

/**
 * Schema for getting invite info by token
 */
export const getInviteSchema = {
  params: z.object({
    token: z.string().min(1),
  }),
};

// ============================================
// TENANT MANAGEMENT SCHEMAS
// ============================================

/**
 * Schema for updating tenant info
 */
export const updateTenantSchema = {
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    domain: z.string().max(100).optional().nullable(),
    settings: z.record(z.unknown()).optional(),
  }),
};

/**
 * Schema for checking slug availability
 */
export const checkSlugSchema = {
  params: z.object({
    slug: z.string().min(3).max(50),
  }),
};

/**
 * Schema for updating member role
 */
export const updateMemberRoleSchema = {
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(['ADMIN', 'MANAGER', 'CONTABILE', 'MAGAZZINIERE', 'OPERATORE', 'COMMERCIALE', 'VIEWER']),
  }),
};

/**
 * Schema for removing member
 */
export const removeMemberSchema = {
  params: z.object({
    userId: z.string().uuid(),
  }),
};

/**
 * Schema for invite actions (resend, cancel)
 */
export const inviteActionSchema = {
  params: z.object({
    inviteId: z.string().uuid(),
  }),
};

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof registerSchema.body>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema.body>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema.body>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema.body>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema.body>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema.body>;
export type InviteUserInput = z.infer<typeof inviteUserSchema.body>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema.body>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema.body>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema.body>;
