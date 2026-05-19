'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Building2,
  User,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  Sparkles,
  Loader2,
  MailCheck,
} from 'lucide-react';

// ============================================================================
// API plan types
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

interface DisplayPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
}

// ============================================================================
// Helpers to derive display data from API payload
// ============================================================================
const PLAN_DESCRIPTIONS: Record<string, string> = {
  STARTER: 'Perfetto per iniziare',
  PRO: 'Per e-commerce in crescita',
  BUSINESS: 'Per aziende enterprise',
};

const POPULAR_PLAN_CODE = 'PRO';

function formatLimit(value: number, singular: string, plural: string): string {
  if (value === -1) return `${plural} illimitati`;
  return `${value.toLocaleString('it-IT')} ${value === 1 ? singular : plural}`;
}

function planToDisplay(plan: ApiPlan): DisplayPlan {
  const features: string[] = [];
  features.push(
    plan.limits.maxUsers === -1
      ? 'Utenti illimitati'
      : `${plan.limits.maxUsers} ${plan.limits.maxUsers === 1 ? 'utente' : 'utenti'}`
  );
  features.push(
    plan.limits.maxOrders === -1
      ? 'Ordini illimitati'
      : `${plan.limits.maxOrders.toLocaleString('it-IT')} ordini/mese`
  );
  // Mostra un terzo punto rilevante in base ai moduli del piano
  const modules = new Set(plan.features?.modules || []);
  if (modules.has('sdi')) features.push('Fatturazione elettronica SDI');
  else if (modules.has('manufacturing')) features.push('Produzione e BOM');
  else if (modules.has('wordpress_sync')) features.push('Sync WordPress completa');
  else
    features.push(
      formatLimit(plan.limits.maxProducts, 'prodotto', 'prodotti')
    );

  return {
    id: plan.code,
    name: plan.name,
    price: Math.round(Number(plan.priceMonthly)),
    description: PLAN_DESCRIPTIONS[plan.code] || plan.name,
    features,
    popular: plan.code === POPULAR_PLAN_CODE,
  };
}

// ============================================================================
// API helpers
// ============================================================================
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchPlans(signal?: AbortSignal): Promise<DisplayPlan[]> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/plans`, {
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success || !Array.isArray(body.data)) {
    throw new Error(body?.error || 'Risposta API non valida');
  }
  const sorted = [...body.data].sort(
    (a: ApiPlan, b: ApiPlan) => Number(a.priceMonthly) - Number(b.priceMonthly)
  );
  return sorted.map(planToDisplay);
}

// ============================================================================
// Page
// ============================================================================
function RegisterPageInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<DisplayPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  // After successful registration, we show a "check your email" screen instead
  // of redirecting (the backend does NOT issue a JWT until the email is verified)
  const [registrationComplete, setRegistrationComplete] = useState<{
    email: string;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    plan: 'PRO',
    billingCycle: 'monthly' as 'monthly' | 'annual',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
    acceptTerms: false,
  });

  // Load plans from API on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchPlans(controller.signal)
      .then((p) => {
        setPlans(p);
        // If pre-selected plan from URL is not in API, fall back to popular
        setFormData((prev) => {
          const validIds = p.map((x) => x.id);
          if (!validIds.includes(prev.plan)) {
            const popular = p.find((x) => x.popular) || p[0];
            return { ...prev, plan: popular?.id || prev.plan };
          }
          return prev;
        });
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setPlansError(
          err instanceof Error ? err.message : 'Errore caricamento piani'
        );
      })
      .finally(() => setPlansLoading(false));
    return () => controller.abort();
  }, []);

  // Sync plan + billingCycle from query string (after plans loaded)
  useEffect(() => {
    const planParam = searchParams.get('plan');
    const cycleParam = searchParams.get('cycle');
    if (plans.length > 0) {
      const validIds = plans.map((p) => p.id);
      setFormData((prev) => ({
        ...prev,
        plan:
          planParam && validIds.includes(planParam) ? planParam : prev.plan,
        billingCycle: cycleParam === 'annual' ? 'annual' : 'monthly',
      }));
    }
  }, [searchParams, plans]);

  const handlePlanSelect = (planId: string) => {
    setFormData({ ...formData, plan: planId });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const validateStep1 = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Compila tutti i campi');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError("Inserisci un'email valida");
      return false;
    }
    if (formData.password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('La password deve contenere almeno una lettera maiuscola');
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('La password deve contenere almeno una lettera minuscola');
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('La password deve contenere almeno un numero');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Le password non corrispondono');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!formData.firstName || !formData.lastName || !formData.companyName) {
      setError('Compila tutti i campi');
      return false;
    }
    if (!formData.acceptTerms) {
      setError('Devi accettare i termini di servizio');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleResendVerification = async () => {
    if (!registrationComplete) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registrationComplete.email }),
      });
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        setError(body?.error || 'Errore invio email');
        return;
      }
      setError('');
      setRegistrationComplete({
        ...registrationComplete,
        message: 'Email di verifica reinviata. Controlla la tua casella.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          plan: formData.plan,
          billingCycle: formData.billingCycle,
        }),
      });

      const body = await response.json();

      // Envelope returned by backend: { success: bool, data?: {...}, error?: string }
      if (!response.ok || body?.success === false) {
        throw new Error(
          body?.error || body?.message || 'Errore durante la registrazione'
        );
      }

      // Backend deliberately does NOT issue a JWT until the email is verified.
      // We must NOT redirect to the ERP. Show a verification screen instead.
      const data = body?.data || {};
      setRegistrationComplete({
        email: formData.email,
        message:
          data.message ||
          "Registrazione completata. Controlla la tua email per verificare l'account prima di accedere.",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Errore durante la registrazione'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // SUCCESS STATE — "Check your email" screen
  // -------------------------------------------------------------------------
  if (registrationComplete) {
    return (
      <section className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
              <MailCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Controlla la tua email
            </h1>
            <p className="text-gray-600 mb-2">{registrationComplete.message}</p>
            <p className="text-gray-500 text-sm mb-8">
              Abbiamo inviato un link di verifica a{' '}
              <span className="font-medium text-gray-900">
                {registrationComplete.email}
              </span>
              . Clicca sul link per attivare l&apos;account e accedere alla
              piattaforma.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all"
              >
                Reinvia email di verifica
              </button>
              <Link
                href="https://erp.fabbricami.pro/login"
                className="block w-full py-3 text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Ho gia verificato, accedi
              </Link>
            </div>

            <p className="text-xs text-gray-400 mt-6">
              Non trovi l&apos;email? Controlla anche la cartella spam.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // FORM STATES
  // -------------------------------------------------------------------------
  return (
    <section className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Inizia la tua prova gratuita
            </h1>
            <p className="text-gray-600">
              14 giorni gratis, nessuna carta di credito richiesta
            </p>
          </div>

          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    step >= 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <span
                  className={
                    step >= 1
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500'
                  }
                >
                  Piano & Account
                </span>
              </div>

              <div className="w-12 h-px bg-gray-300" />

              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    step >= 2
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  2
                </div>
                <span
                  className={
                    step >= 2
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500'
                  }
                >
                  Dati Azienda
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {step === 1 ? (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Scegli il tuo piano
                  </h2>

                  {plansLoading && (
                    <div className="text-center py-8 text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      <p className="mt-2 text-sm">Caricamento piani...</p>
                    </div>
                  )}

                  {plansError && !plansLoading && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                      Errore caricamento piani: {plansError}
                    </div>
                  )}

                  {!plansLoading && !plansError && (
                    <div className="grid md:grid-cols-3 gap-4">
                      {plans.map((plan) => (
                        <button
                          type="button"
                          key={plan.id}
                          onClick={() => handlePlanSelect(plan.id)}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                            formData.plan === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {plan.popular && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Popolare
                            </span>
                          )}
                          <div className="font-semibold text-gray-900">
                            {plan.name}
                          </div>
                          <div className="text-2xl font-bold text-gray-900 my-1">
                            €{plan.price}
                            <span className="text-sm font-normal text-gray-500">
                              /mese
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mb-3">
                            {plan.description}
                          </div>
                          <ul className="space-y-1">
                            {plan.features.map((feature) => (
                              <li
                                key={feature}
                                className="text-xs text-gray-600 flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Crea il tuo account
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email aziendale
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="nome@azienda.it"
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Minimo 8 caratteri"
                        className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conferma Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Ripeti la password"
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleNextStep}
                  disabled={plansLoading}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continua
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-8">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Informazioni aziendali
                  </h2>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="Mario"
                          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cognome
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Rossi"
                          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Azienda
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        placeholder="La Mia Azienda Srl"
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-4">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      id="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleInputChange}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="acceptTerms"
                      className="text-sm text-gray-600"
                    >
                      Accetto i{' '}
                      <Link
                        href="/legal/terms"
                        className="text-blue-600 hover:underline"
                      >
                        Termini di Servizio
                      </Link>{' '}
                      e la{' '}
                      <Link
                        href="/legal/privacy"
                        className="text-blue-600 hover:underline"
                      >
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-4 text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Indietro
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creazione account...
                      </>
                    ) : (
                      <>
                        Inizia la Prova Gratuita
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600">
                Hai gia un account?{' '}
                <Link
                  href="https://erp.fabbricami.pro/login"
                  className="text-blue-600 font-medium hover:underline"
                >
                  Accedi
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              14 giorni gratis
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Nessuna carta richiesta
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Cancella quando vuoi
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-gray-50 to-white" />
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
