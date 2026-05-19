/**
 * FIC (Fatture in Cloud) Billing Service
 *
 * Quando Stripe conferma il pagamento di una subscription SaaS (webhook
 * `invoice.paid`), questo service emette automaticamente la fattura
 * elettronica al tenant tramite Fatture in Cloud.
 *
 * Flow:
 *   1. Legge la config FIC dalla SystemSetting `integration_fatture_in_cloud`
 *   2. Se non abilitato o config mancante → no-op
 *   3. Trova o crea il cliente in FIC partendo dai dati anagrafici del tenant
 *   4. Emette il documento (fattura TD01 di default) via POST
 *      https://api-v2.fattureincloud.it/c/{companyId}/issued_documents
 *   5. Il chiamante (subscription.service.ts webhook handler) salva i
 *      riferimenti FIC sui campi dedicati di BillingHistory:
 *      ficInvoiceId, ficInvoiceNumber, ficStatus, ficIssuedAt, ficError.
 *
 * In caso di errore il flow Stripe non viene mai bloccato — log e go.
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import type Stripe from 'stripe';

const FIC_SETTING_KEY = 'integration_fatture_in_cloud';
const FIC_API_BASE = 'https://api-v2.fattureincloud.it';

interface FicConfig {
  companyId: string;
  apiToken: string;
  documentType: string;
  defaultVatRate: number;
  autoSendSdi: boolean;
  enabled: boolean;
}

async function loadConfig(): Promise<FicConfig | null> {
  const s = await prisma.systemSetting.findUnique({ where: { key: FIC_SETTING_KEY } });
  if (!s) return null;
  const v = (s.value as Partial<FicConfig>) || {};
  if (!v.enabled || !v.companyId || !v.apiToken) return null;
  return {
    companyId: v.companyId,
    apiToken: v.apiToken,
    documentType: v.documentType || 'TD01',
    defaultVatRate: typeof v.defaultVatRate === 'number' ? v.defaultVatRate : 22,
    autoSendSdi: v.autoSendSdi ?? true,
    enabled: !!v.enabled,
  };
}

async function ficFetch<T = any>(
  config: FicConfig,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const r = await fetch(`${FIC_API_BASE}/c/${config.companyId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    let data: any = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        data: null,
        error: data?.error?.message || data?.error || `HTTP ${r.status}`,
      };
    }
    return { ok: true, status: r.status, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, error: err?.message || String(err) };
  }
}

/**
 * Cerca un cliente esistente in FIC tramite codice fiscale o partita IVA.
 * Se non esiste lo crea ex-novo dai dati del tenant.
 */
async function findOrCreateFicCustomer(
  config: FicConfig,
  tenant: {
    id: string;
    name: string;
  } & Record<string, any>
): Promise<{ id: number } | null> {
  // 1. Cerca per cf/piva fra le anagrafiche esistenti
  //    Endpoint: GET /entities/clients?q=<query>
  // Per ora cerchiamo per nome come fallback se non abbiamo vat
  const vat = tenant.vatNumber || tenant.taxId || '';
  const queryParam = vat
    ? `q=vat_number = '${vat}'`
    : `q=name like '%${encodeURIComponent(tenant.name)}%'`;
  const search = await ficFetch<any>(config, `/entities/clients?${queryParam}`);
  if (search.ok && Array.isArray(search.data?.data) && search.data.data.length > 0) {
    return { id: search.data.data[0].id };
  }

  // 2. Crea cliente nuovo
  const createPayload = {
    data: {
      type: 'company',
      name: tenant.name,
      vat_number: tenant.vatNumber || tenant.taxId || undefined,
      tax_code: tenant.fiscalCode || tenant.taxCode || undefined,
      address_street: tenant.address || undefined,
      address_postal_code: tenant.postalCode || undefined,
      address_city: tenant.city || undefined,
      address_province: tenant.province || undefined,
      country: tenant.country || 'Italia',
      email: tenant.billingEmail || tenant.email || undefined,
      certified_email: tenant.pec || undefined,
      ei_code: tenant.sdiCode || undefined,
    },
  };
  const create = await ficFetch<any>(config, '/entities/clients', {
    method: 'POST',
    body: JSON.stringify(createPayload),
  });
  if (!create.ok || !create.data?.data?.id) {
    logger.warn('FIC: impossibile creare cliente per tenant ' + tenant.id + ': ' + (create.error || 'unknown'));
    return null;
  }
  return { id: create.data.data.id };
}

/**
 * Emette una fattura SaaS in FIC per il pagamento Stripe ricevuto.
 * Best-effort: in caso di errore logga ma non solleva (non bloccare Stripe).
 */
export async function issueSaasInvoiceFromStripe(stripeInvoice: Stripe.Invoice): Promise<{
  attempted: boolean;
  success: boolean;
  ficInvoiceId?: number;
  ficNumber?: string;
  error?: string;
}> {
  const config = await loadConfig();
  if (!config) {
    return { attempted: false, success: false, error: 'FIC non configurato o non abilitato' };
  }

  // Risolvi il tenant tramite Stripe customer id o subscription metadata
  let tenantId: string | null = null;
  if (stripeInvoice.customer && typeof stripeInvoice.customer === 'string') {
    const sub = await prisma.saasSubscription.findFirst({
      where: { stripeCustomerId: stripeInvoice.customer },
      select: { tenantId: true },
    });
    if (sub) tenantId = sub.tenantId;
  }
  if (!tenantId && (stripeInvoice as any).subscription_details?.metadata?.tenantId) {
    tenantId = (stripeInvoice as any).subscription_details.metadata.tenantId;
  }
  if (!tenantId && (stripeInvoice.metadata as any)?.tenantId) {
    tenantId = (stripeInvoice.metadata as any).tenantId;
  }
  if (!tenantId) {
    return { attempted: true, success: false, error: 'tenantId non risolvibile dalla Stripe invoice' };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        where: { role: 'ADMIN' },
        include: { user: { select: { email: true } } },
        take: 1,
      },
    },
  }).catch(() => null);
  if (!tenant) {
    return { attempted: true, success: false, error: `Tenant ${tenantId} non trovato` };
  }

  // CompanySettings non è una relazione diretta su Tenant: si recupera via tenantId
  const cs =
    (await prisma.companySettings
      .findFirst({ where: { tenantId } })
      .catch(() => null)) || ({} as Record<string, any>);
  const billingData = {
    id: tenant.id,
    name: cs.companyName || tenant.name,
    vatNumber: cs.vatNumber || undefined,
    taxCode: cs.fiscalCode || undefined,
    address: cs.address || undefined,
    city: cs.city || undefined,
    province: cs.province || undefined,
    postalCode: cs.postalCode || undefined,
    country: cs.country || 'Italia',
    pec: cs.pec || cs.sdiPec || undefined,
    sdiCode: cs.sdiCode || undefined,
    email: cs.email || tenant.members?.[0]?.user?.email || undefined,
  };

  // 1. Trova/crea cliente FIC
  const customer = await findOrCreateFicCustomer(config, billingData);
  if (!customer) {
    return { attempted: true, success: false, error: 'Impossibile risolvere cliente FIC' };
  }

  // 2. Costruisci il documento
  const totalCents = stripeInvoice.amount_paid || stripeInvoice.total || 0;
  const totalEuro = totalCents / 100;
  // Calcolo netto/iva con default vat rate
  const vatRate = config.defaultVatRate;
  const net = totalEuro / (1 + vatRate / 100);
  const description = (stripeInvoice.lines?.data?.[0]?.description as string) ||
    `Sottoscrizione ERP — ${new Date(stripeInvoice.created * 1000).toLocaleDateString('it-IT')}`;

  const docPayload = {
    data: {
      type: 'invoice',
      entity: { id: customer.id },
      date: new Date(stripeInvoice.created * 1000).toISOString().slice(0, 10),
      currency: { id: (stripeInvoice.currency || 'EUR').toUpperCase() },
      e_invoice: config.autoSendSdi,
      ei_data: {
        document_type: config.documentType,
      },
      items_list: [
        {
          name: description,
          qty: 1,
          net_price: Number(net.toFixed(2)),
          vat: { value: vatRate },
        },
      ],
      payments_list: [
        {
          amount: Number(totalEuro.toFixed(2)),
          due_date: new Date(stripeInvoice.created * 1000).toISOString().slice(0, 10),
          status: 'paid',
        },
      ],
    },
  };

  const create = await ficFetch<any>(config, '/issued_documents', {
    method: 'POST',
    body: JSON.stringify(docPayload),
  });

  if (!create.ok || !create.data?.data?.id) {
    return {
      attempted: true,
      success: false,
      error: create.error || 'POST /issued_documents fallito',
    };
  }

  const ficId = create.data.data.id as number;
  const ficNumber = create.data.data.number ? String(create.data.data.number) : '';

  logger.info(
    `FIC: fattura emessa per tenant ${tenant.id} — FIC id=${ficId}, number=${ficNumber}, importo=${totalEuro}€`
  );

  return { attempted: true, success: true, ficInvoiceId: ficId, ficNumber };
}

export const ficBillingService = {
  loadConfig,
  issueSaasInvoiceFromStripe,
};
