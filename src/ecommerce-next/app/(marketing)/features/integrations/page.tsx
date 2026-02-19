import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Plug,
  ShoppingBag,
  Truck,
  CreditCard,
  Webhook,
  Database,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Integrazioni - Fabbricami ERP',
  description:
    'Connetti WooCommerce, corrieri, gateway di pagamento e altri strumenti. API REST completa per automazioni custom.',
  openGraph: {
    title: 'Integrazioni - Fabbricami ERP',
    description: 'Integra il tuo e-commerce con tutti gli strumenti che usi.',
  },
};

const features = [
  {
    icon: ShoppingBag,
    title: 'WooCommerce',
    description:
      'Integrazione nativa bidirezionale. Sincronizza prodotti, ordini, clienti e stock in tempo reale.',
  },
  {
    icon: Truck,
    title: 'Corrieri',
    description:
      'Integrazione con BRT, GLS, DHL, UPS, SDA. Genera etichette e tracking automatico.',
  },
  {
    icon: CreditCard,
    title: 'Pagamenti',
    description:
      'Riconciliazione automatica con Stripe, PayPal, bonifici. Traccia incassi e commissioni.',
  },
  {
    icon: Webhook,
    title: 'Webhook',
    description:
      'Ricevi notifiche in tempo reale su ordini, pagamenti, stock. Automatizza workflow esterni.',
  },
  {
    icon: Database,
    title: 'API REST',
    description:
      'API documentata per integrazioni custom. Autenticazione JWT, rate limiting, versioning.',
  },
  {
    icon: Plug,
    title: 'Zapier Ready',
    description:
      'Connetti Fabbricami con migliaia di app tramite Zapier. Automazioni senza codice.',
  },
];

const integrations = [
  { name: 'WooCommerce', status: 'Disponibile' },
  { name: 'BRT', status: 'Disponibile' },
  { name: 'GLS', status: 'Disponibile' },
  { name: 'DHL', status: 'Disponibile' },
  { name: 'Stripe', status: 'Disponibile' },
  { name: 'PayPal', status: 'Disponibile' },
  { name: 'Shopify', status: 'In arrivo' },
  { name: 'Amazon', status: 'In arrivo' },
];

const benefits = [
  'Sync WooCommerce nativo',
  'Etichette corriere automatiche',
  'API REST documentata',
  'Webhook in tempo reale',
];

export default function IntegrationsFeaturePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-6"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Tutte le funzionalita
            </Link>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
              <Plug className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Integrazioni
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Connetti WooCommerce, corrieri, gateway di pagamento e altri strumenti.
              API REST completa per automazioni personalizzate.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold"
              >
                Prova Gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="https://demo.fabbricami.pro"
                className="inline-flex items-center gap-2 px-6 py-3 text-white bg-white/10 rounded-xl hover:bg-white/20 transition-all font-semibold"
              >
                Guarda Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bar */}
      <section className="py-8 bg-emerald-600">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-white">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tipologie di Integrazione
            </h2>
            <p className="text-lg text-gray-600">
              Connetti Fabbricami con tutti gli strumenti che usi ogni giorno.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-lg border border-transparent hover:border-gray-100 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations List */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Servizi Supportati
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100"
              >
                <span className="font-medium text-gray-900">{integration.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    integration.status === 'Disponibile'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {integration.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
