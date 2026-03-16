'use client';

import { useState } from 'react';
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
} from 'lucide-react';

const plans = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 29,
    description: 'Perfetto per iniziare',
    features: ['2 utenti', '500 ordini/mese', '1.000 prodotti'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 79,
    description: 'Per e-commerce in crescita',
    features: ['5 utenti', '2.500 ordini/mese', 'Fatturazione elettronica'],
    popular: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 149,
    description: 'Per aziende enterprise',
    features: ['15 utenti', '10.000 ordini/mese', 'Multi-shop'],
  },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    plan: 'PRO',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
    acceptTerms: false,
  });

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
      setError('Inserisci un\'email valida');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          plan: formData.plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante la registrazione');
      }

      // Redirect to ERP with onboarding
      window.location.href = `https://erp.fabbricami.pro/onboarding?token=${data.token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Inizia la tua prova gratuita
            </h1>
            <p className="text-gray-600">
              14 giorni gratis, nessuna carta di credito richiesta
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4">
              {/* Step 1 */}
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
                <span className={step >= 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                  Piano & Account
                </span>
              </div>

              <div className="w-12 h-px bg-gray-300" />

              {/* Step 2 */}
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
                <span className={step >= 2 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                  Dati Azienda
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {step === 1 ? (
              <div className="p-8">
                {/* Plan Selection */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Scegli il tuo piano
                  </h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    {plans.map((plan) => (
                      <button
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
                        <div className="font-semibold text-gray-900">{plan.name}</div>
                        <div className="text-2xl font-bold text-gray-900 my-1">
                          €{plan.price}
                          <span className="text-sm font-normal text-gray-500">/mese</span>
                        </div>
                        <div className="text-sm text-gray-500 mb-3">{plan.description}</div>
                        <ul className="space-y-1">
                          {plan.features.map((feature) => (
                            <li key={feature} className="text-xs text-gray-600 flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Fields */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Crea il tuo account
                  </h2>

                  {/* Email */}
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

                  {/* Password */}
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

                  {/* Confirm Password */}
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
                  className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
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
                    {/* First Name */}
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

                    {/* Last Name */}
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

                  {/* Company Name */}
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

                  {/* Terms */}
                  <div className="flex items-start gap-3 pt-4">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      id="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleInputChange}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                      Accetto i{' '}
                      <Link href="/legal/terms" className="text-blue-600 hover:underline">
                        Termini di Servizio
                      </Link>{' '}
                      e la{' '}
                      <Link href="/legal/privacy" className="text-blue-600 hover:underline">
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

            {/* Footer */}
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

          {/* Trust badges */}
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
