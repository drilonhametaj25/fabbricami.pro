import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import companySettingsService from '../services/company-settings.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Company Settings Routes (ERP /settings page)
 *
 * Espone GET/PUT che la pagina ERP `/settings` (src/client/pages/CompanySettings.vue)
 * si aspetta. Il modello DB `CompanySettings` è flat — qui mappiamo a/da una
 * struttura nidificata `{ company, sdi, bank, branding }` per matchare la UI.
 *
 * Il flow di /onboarding usa invece `POST /api/v1/onboarding/company-settings`
 * (logica analoga ma payload diverso — vedi onboarding.routes.ts). Entrambi
 * passano dal companySettingsService unico, quindi il dato persiste.
 */

interface CompanyFormPayload {
  businessName?: string;
  tradeName?: string;
  vatNumber?: string;
  fiscalCode?: string;
  reaNumber?: string;
  shareCapital?: number | null;
  legalForm?: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  pec?: string;
  website?: string;
}

interface BankFormPayload {
  bankName?: string;
  iban?: string;
  swift?: string;
}

interface BrandingFormPayload {
  logoUrl?: string;
  invoiceNotes?: string;
  ddtNotes?: string;
  footerText?: string;
}

function mapCompanyFormToDb(c: CompanyFormPayload): Record<string, unknown> {
  return {
    companyName: c.businessName,
    legalName: c.tradeName,
    vatNumber: c.vatNumber,
    fiscalCode: c.fiscalCode,
    reaNumber: c.reaNumber,
    capitalAmount: c.shareCapital ?? undefined,
    legalForm: c.legalForm,
    address: c.address?.street,
    city: c.address?.city,
    province: c.address?.province,
    postalCode: c.address?.zip,
    country: c.address?.country,
    phone: c.phone,
    email: c.email,
    pec: c.pec,
    website: c.website,
  };
}

function mapBankFormToDb(b: BankFormPayload): Record<string, unknown> {
  return {
    bankName: b.bankName,
    iban: b.iban,
    bic: b.swift,
  };
}

function mapBrandingFormToDb(b: BrandingFormPayload): Record<string, unknown> {
  // Il modello DB CompanySettings ha solo logoUrl/invoiceFooterNotes/paymentInstructions.
  // ddtNotes/footerText sono opzionali UI-only finché non li aggiungiamo allo schema.
  return {
    logoUrl: b.logoUrl,
    invoiceFooterNotes: b.invoiceNotes,
    paymentInstructions: b.footerText,
  };
}

function mapDbToNested(settings: any): {
  company: Record<string, unknown>;
  sdi: Record<string, unknown>;
  bank: Record<string, unknown>;
  branding: Record<string, unknown>;
} | null {
  if (!settings) return null;
  return {
    company: {
      businessName: settings.companyName ?? '',
      tradeName: settings.legalName ?? '',
      vatNumber: settings.vatNumber ?? '',
      fiscalCode: settings.fiscalCode ?? '',
      reaNumber: settings.reaNumber ?? '',
      shareCapital: settings.capitalAmount ?? null,
      legalForm: settings.legalForm ?? '',
      address: {
        street: settings.address ?? '',
        city: settings.city ?? '',
        province: settings.province ?? '',
        zip: settings.postalCode ?? '',
        country: settings.country ?? 'IT',
      },
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      pec: settings.pec ?? '',
      website: settings.website ?? '',
    },
    sdi: {
      recipientCode: settings.sdiCode ?? '0000000',
      provider: settings.sdiProvider ?? '',
      taxRegime: settings.taxRegime ?? 'RF01',
      invoicePrefix: settings.invoicePrefix ?? 'FT',
      invoiceNextNumber: settings.invoiceNextNumber ?? 1,
    },
    bank: {
      bankName: settings.bankName ?? '',
      iban: settings.iban ?? '',
      swift: settings.bic ?? '',
    },
    branding: {
      logoUrl: settings.logoUrl ?? '',
      invoiceNotes: settings.invoiceFooterNotes ?? '',
      footerText: settings.paymentInstructions ?? '',
      ddtNotes: '',
    },
  };
}

/**
 * Strip undefined values so companySettingsService.upsert ignora i campi assenti
 * (partial update semantics).
 */
function pruneUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const companySettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantMiddleware);

  // GET /api/v1/company-settings — ritorna struttura nidificata per la UI
  fastify.get('/', async (_request, reply) => {
    try {
      const settings = await companySettingsService.get();
      return successResponse(reply, mapDbToNested(settings) || {
        company: {}, sdi: {}, bank: {}, branding: {},
      });
    } catch (err: any) {
      return errorResponse(reply, err.message || 'Impossibile leggere le impostazioni', 500);
    }
  });

  // PUT /api/v1/company-settings/company — upsert sezione anagrafica
  fastify.put<{ Body: CompanyFormPayload }>('/company', async (request, reply) => {
    try {
      const data = pruneUndefined(mapCompanyFormToDb(request.body)) as any;
      const updated = await companySettingsService.upsert(data);
      return successResponse(reply, updated);
    } catch (err: any) {
      return errorResponse(reply, err.message || 'Impossibile salvare i dati aziendali', 400);
    }
  });

  // PUT /api/v1/company-settings/bank — upsert sezione bancaria
  fastify.put<{ Body: BankFormPayload }>('/bank', async (request, reply) => {
    try {
      const data = pruneUndefined(mapBankFormToDb(request.body)) as any;
      const updated = await companySettingsService.upsert(data);
      return successResponse(reply, updated);
    } catch (err: any) {
      return errorResponse(reply, err.message || 'Impossibile salvare i dati bancari', 400);
    }
  });

  // PUT /api/v1/company-settings/branding — upsert sezione branding/note documenti
  fastify.put<{ Body: BrandingFormPayload }>('/branding', async (request, reply) => {
    try {
      const data = pruneUndefined(mapBrandingFormToDb(request.body)) as any;
      const updated = await companySettingsService.upsert(data);
      return successResponse(reply, updated);
    } catch (err: any) {
      return errorResponse(reply, err.message || 'Impossibile salvare il branding', 400);
    }
  });
};

export default companySettingsRoutes;
