import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  Factory,
  Calculator,
  Plug,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Funzionalita - Fabbricami ERP',
  description:
    'Scopri tutte le funzionalita di Fabbricami ERP: gestione inventario, ordini, produzione, contabilita e integrazioni. Il gestionale completo per e-commerce.',
  openGraph: {
    title: 'Funzionalita - Fabbricami ERP',
    description: 'Il gestionale completo per e-commerce italiani.',
  },
};

const features = [
  {
    icon: Package,
    title: 'Gestione Inventario',
    description:
      'Traccia stock in tempo reale, gestisci multi-magazzino, ricevi alert automatici per riordino e prevedi esaurimento scorte.',
    href: '/features/inventory',
    highlights: ['Multi-magazzino', 'Alert automatici', 'Previsioni stock'],
  },
  {
    icon: ShoppingCart,
    title: 'Gestione Ordini',
    description:
      'Sincronizzazione automatica con WooCommerce, stati personalizzabili, gestione resi e tracking completo.',
    href: '/features/orders',
    highlights: ['Sync WooCommerce', 'Stati custom', 'Gestione resi'],
  },
  {
    icon: Factory,
    title: 'Produzione',
    description:
      'Gestisci distinte base (BOM), crea ordini di produzione, traccia fasi lavorative e consumi materiali.',
    href: '/features/production',
    highlights: ['Distinte base', 'Ordini produzione', 'Tracciamento fasi'],
  },
  {
    icon: Calculator,
    title: 'Contabilita',
    description:
      'Fatturazione elettronica con invio SDI, prima nota, scadenzario pagamenti e report finanziari completi.',
    href: '/features/accounting',
    highlights: ['Fattura elettronica', 'Invio SDI', 'Scadenzario'],
  },
  {
    icon: Plug,
    title: 'Integrazioni',
    description:
      'Connetti WooCommerce, corrieri, gateway pagamento e altri strumenti per automatizzare il tuo business.',
    href: '/features/integrations',
    highlights: ['WooCommerce', 'Corrieri', 'API REST'],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 rounded-full mb-4 border border-emerald-500/20">
              Funzionalita Complete
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Tutto quello che serve per il tuo{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                e-commerce
              </span>
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Un ERP progettato specificamente per le esigenze degli e-commerce italiani,
              con integrazione nativa WooCommerce e fatturazione elettronica.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group block p-8 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl border border-transparent hover:border-gray-100 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">{feature.description}</p>
                <ul className="space-y-2 mb-4">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-2 text-sm text-gray-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                  Scopri di piu
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Fabbricami */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Perche scegliere Fabbricami?
            </h2>
            <p className="text-lg text-gray-600">
              Un ERP costruito da chi conosce le sfide degli e-commerce italiani.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: 'Made in Italy',
                description:
                  'Progettato per il mercato italiano: fatturazione elettronica, SDI, normative fiscali italiane.',
              },
              {
                title: 'Integrazione Nativa',
                description:
                  'Sincronizzazione bidirezionale con WooCommerce. Ordini, prodotti e stock sempre allineati.',
              },
              {
                title: 'Supporto Dedicato',
                description:
                  'Team italiano disponibile per aiutarti. Onboarding guidato e formazione inclusa.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
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
