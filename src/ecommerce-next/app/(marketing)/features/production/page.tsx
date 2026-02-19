import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Factory,
  Layers,
  ClipboardList,
  Timer,
  Package,
  BarChart3,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Produzione - Fabbricami ERP',
  description:
    'Gestisci la produzione con distinte base (BOM), ordini di produzione, tracciamento fasi lavorative e consumo materiali.',
  openGraph: {
    title: 'Produzione - Fabbricami ERP',
    description: 'Gestione completa della produzione per e-commerce.',
  },
};

const features = [
  {
    icon: Layers,
    title: 'Distinte Base (BOM)',
    description:
      'Crea distinte base multi-livello per i tuoi prodotti. Definisci materiali, quantita e costi per ogni componente.',
  },
  {
    icon: ClipboardList,
    title: 'Ordini di Produzione',
    description:
      'Genera ordini di produzione automatici basati su domanda o manualmente. Traccia stato e avanzamento.',
  },
  {
    icon: Timer,
    title: 'Fasi Lavorative',
    description:
      'Definisci le fasi di lavorazione, tempi stimati e risorse necessarie. Monitora il progresso in tempo reale.',
  },
  {
    icon: Package,
    title: 'Consumo Materiali',
    description:
      'Scarico automatico dei materiali al completamento della produzione. Tracciabilita completa dei consumi.',
  },
  {
    icon: BarChart3,
    title: 'Costi Produzione',
    description:
      'Calcola il costo di produzione in base a materiali, manodopera e overhead. Analizza margini reali.',
  },
  {
    icon: Factory,
    title: 'Pianificazione',
    description:
      'Pianifica la produzione in base a disponibilita materiali e capacita produttiva. Evita colli di bottiglia.',
  },
];

const benefits = [
  'Ottimizza i costi di produzione',
  'Riduci sprechi di materiali',
  'Tracciabilita completa',
  'Calcolo margini accurato',
];

export default function ProductionFeaturePage() {
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
              <Factory className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Produzione
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Gestisci distinte base, ordini di produzione, fasi lavorative e consumo
              materiali. Ideale per chi produce i propri prodotti.
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
              Funzionalita Produzione
            </h2>
            <p className="text-lg text-gray-600">
              Tutto quello che serve per gestire la produzione del tuo e-commerce.
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
