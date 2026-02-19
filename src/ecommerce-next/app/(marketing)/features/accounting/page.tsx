import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calculator,
  FileText,
  Send,
  Calendar,
  PieChart,
  CreditCard,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Contabilita - Fabbricami ERP',
  description:
    'Fatturazione elettronica con invio SDI, prima nota, scadenzario pagamenti e report finanziari per e-commerce.',
  openGraph: {
    title: 'Contabilita - Fabbricami ERP',
    description: 'Gestione contabile completa con fatturazione elettronica SDI.',
  },
};

const features = [
  {
    icon: FileText,
    title: 'Fatturazione Elettronica',
    description:
      'Genera fatture elettroniche conformi FatturaPA. Formato XML automatico con tutti i dati fiscali corretti.',
  },
  {
    icon: Send,
    title: 'Invio SDI',
    description:
      'Invio diretto al Sistema di Interscambio. Ricevi notifiche di esito e gestisci scarti automaticamente.',
  },
  {
    icon: Calendar,
    title: 'Scadenzario',
    description:
      'Monitora pagamenti in scadenza, crediti e debiti. Alert automatici per fatture non pagate.',
  },
  {
    icon: CreditCard,
    title: 'Prima Nota',
    description:
      'Registra movimenti contabili, incassi e pagamenti. Riconciliazione bancaria semplificata.',
  },
  {
    icon: PieChart,
    title: 'Report Finanziari',
    description:
      'Dashboard con fatturato, margini, costi. Export per il commercialista in formati standard.',
  },
  {
    icon: Calculator,
    title: 'Calcolo IVA',
    description:
      'Gestione automatica aliquote IVA, split payment, reverse charge. Liquidazione IVA periodica.',
  },
];

const benefits = [
  'Fatturazione elettronica SDI',
  'Scadenzario automatico',
  'Report per il commercialista',
  'Conforme normativa italiana',
];

export default function AccountingFeaturePage() {
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
              <Calculator className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Contabilita
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Fatturazione elettronica con invio SDI, prima nota, scadenzario e
              report finanziari. Tutto conforme alla normativa italiana.
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
              Funzionalita Contabilita
            </h2>
            <p className="text-lg text-gray-600">
              Gestione contabile semplificata per e-commerce italiani.
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

      {/* CTA */}
      <CTASection />
    </>
  );
}
