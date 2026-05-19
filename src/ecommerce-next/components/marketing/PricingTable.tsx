'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';

// ============================================================================
// Types (mirror payload from GET /api/v1/subscription/plans)
// ============================================================================
interface PlanLimits {
  maxUsers: number;
  maxWarehouses: number;
  maxProducts: number;
  maxOrders: number;
  maxSuppliers: number;
}

interface PlanFeatures {
  modules: string[];
  capabilities: string[];
}

interface ApiPlan {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeatures;
  limits: PlanLimits;
}

// ============================================================================
// Display configuration (front-end only, content for marketing)
// ============================================================================
const PLAN_DESCRIPTIONS: Record<string, string> = {
  STARTER: 'Perfetto per piccoli e-commerce in crescita',
  PRO: 'Per e-commerce in forte espansione',
  BUSINESS: 'Per aziende con esigenze enterprise',
};

const POPULAR_PLAN_CODE = 'PRO';

const MODULE_LABELS: Record<string, string> = {
  inventory: 'Gestione inventario',
  orders: 'Gestione ordini',
  customers: 'Anagrafica clienti',
  basic_reports: 'Report base',
  suppliers: 'Gestione fornitori',
  purchasing: 'Ordini di acquisto',
  manufacturing: 'Produzione e BOM',
  hr: 'Gestione risorse umane',
  accounting: 'Contabilità',
  sdi: 'Fatturazione elettronica SDI',
  advanced_reports: 'Report avanzati',
  wordpress_sync: 'Sync WordPress completa',
  api_access: 'API access',
  custom_integrations: 'Integrazioni custom',
};

const CAPABILITY_LABELS: Record<string, string> = {
  wordpress_sync_basic: 'Integrazione WooCommerce base',
  wordpress_sync_full: 'Sync WooCommerce real-time',
  email_support: 'Supporto via email',
  priority_support: 'Supporto prioritario',
  dedicated_support: 'Supporto dedicato',
  api_readonly: 'API read-only',
  api_full: 'API illimitate',
  sdi_integration: 'Integrazione SDI/Aruba',
  custom_reports: 'Report personalizzati',
  white_label: 'White-label option',
};

// Modules to show in the comparison list (X where not included)
const COMPARISON_MODULES = [
  'inventory',
  'orders',
  'customers',
  'suppliers',
  'purchasing',
  'manufacturing',
  'accounting',
  'sdi',
  'advanced_reports',
  'wordpress_sync',
  'api_access',
];

// ============================================================================
// Helpers
// ============================================================================
function formatItalianNumber(n: number): string {
  return n.toLocaleString('it-IT');
}

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

interface DisplayFeature {
  label: string;
  included: boolean;
}

function buildFeatureList(plan: ApiPlan): DisplayFeature[] {
  const out: DisplayFeature[] = [];

  // Limits (always rendered, with "illimitati" if -1)
  out.push({
    label:
      plan.limits.maxUsers === -1
        ? 'Utenti illimitati'
        : `Fino a ${plan.limits.maxUsers} ${pluralize(plan.limits.maxUsers, 'utente', 'utenti')}`,
    included: true,
  });
  out.push({
    label:
      plan.limits.maxOrders === -1
        ? 'Ordini illimitati'
        : `${formatItalianNumber(plan.limits.maxOrders)} ordini/mese`,
    included: true,
  });
  out.push({
    label:
      plan.limits.maxProducts === -1
        ? 'Prodotti illimitati'
        : `${formatItalianNumber(plan.limits.maxProducts)} prodotti`,
    included: true,
  });
  out.push({
    label:
      plan.limits.maxWarehouses === -1
        ? 'Magazzini illimitati'
        : `${plan.limits.maxWarehouses} ${pluralize(plan.limits.maxWarehouses, 'magazzino', 'magazzini')}`,
    included: true,
  });
  out.push({
    label:
      plan.limits.maxSuppliers === -1
        ? 'Fornitori illimitati'
        : `${plan.limits.maxSuppliers} fornitori`,
    included: true,
  });

  // Modules comparison
  const includedModules = new Set(plan.features?.modules || []);
  for (const code of COMPARISON_MODULES) {
    out.push({
      label: MODULE_LABELS[code] || code,
      included: includedModules.has(code),
    });
  }

  // Premium capabilities (only the ones included)
  for (const code of plan.features?.capabilities || []) {
    if (CAPABILITY_LABELS[code]) {
      out.push({ label: CAPABILITY_LABELS[code], included: true });
    }
  }

  return out;
}

// ============================================================================
// Component
// ============================================================================
export function PricingTable() {
  const [isYearly, setIsYearly] = useState(true);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    async function loadPlans() {
      try {
        const res = await fetch(`${apiBase}/api/v1/subscription/plans`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) {
          throw new Error(body?.error || 'Risposta API non valida');
        }
        // Sort by priceMonthly so STARTER < PRO < BUSINESS regardless of insertion order
        const sorted = [...body.data].sort(
          (a: ApiPlan, b: ApiPlan) => Number(a.priceMonthly) - Number(b.priceMonthly)
        );
        setPlans(sorted);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Errore caricamento piani');
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
    return () => controller.abort();
  }, []);

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-full mb-4"
          >
            Prezzi Trasparenti
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Scegli il piano perfetto per te
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 mb-8"
          >
            14 giorni di prova gratuita su tutti i piani. Nessuna carta di credito richiesta.
          </motion.p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 bg-white rounded-full shadow-sm border border-gray-200">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
                !isYearly
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensile
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                isYearly
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annuale
              <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                2 mesi gratis
              </span>
            </button>
          </div>
        </div>

        {/* States: loading / error / data */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
            <p className="text-gray-500 mt-4">Caricamento piani...</p>
          </div>
        )}

        {error && !loading && (
          <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-red-700 font-medium">Errore: {error}</p>
            <p className="text-red-600 text-sm mt-2">
              Riprova fra qualche istante o contattaci se il problema persiste.
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan, index) => {
                const isPopular = plan.code === POPULAR_PLAN_CODE;
                const description =
                  PLAN_DESCRIPTIONS[plan.code] || plan.name;
                const cta = plan.code === 'BUSINESS' ? 'Contattaci' : 'Inizia Gratis';
                const href =
                  plan.code === 'BUSINESS'
                    ? '/contact'
                    : `/auth/register?plan=${plan.code}&cycle=${isYearly ? 'annual' : 'monthly'}`;
                const features = buildFeatureList(plan);
                const monthly = Number(plan.priceMonthly);
                const yearly = Number(plan.priceYearly);
                const displayedPrice = isYearly ? Math.round(yearly / 12) : Math.round(monthly);

                return (
                  <motion.div
                    key={plan.code}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative bg-white rounded-2xl p-8 ${
                      isPopular
                        ? 'border-2 border-emerald-600 shadow-xl'
                        : 'border border-gray-200 shadow-lg'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-full shadow-lg">
                          <Sparkles className="w-4 h-4" />
                          Piu Popolare
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4">{description}</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-gray-900">
                          €{displayedPrice}
                        </span>
                        <span className="text-gray-500">/mese</span>
                      </div>
                      {isYearly && (
                        <p className="text-sm text-gray-500 mt-1">
                          Fatturato €{formatItalianNumber(yearly)}/anno
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8">
                      {features.map((feature, i) => (
                        <li key={`${feature.label}-${i}`} className="flex items-start gap-3">
                          {feature.included ? (
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={
                              feature.included ? 'text-gray-700' : 'text-gray-400'
                            }
                          >
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={href}
                      className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                        isPopular
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {cta}
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Enterprise CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <p className="text-gray-600">
                Hai bisogno di funzionalita custom o di un volume superiore?{' '}
                <Link
                  href="/contact"
                  className="text-emerald-600 font-medium hover:text-emerald-700"
                >
                  Contattaci per un piano Enterprise
                </Link>
              </p>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
