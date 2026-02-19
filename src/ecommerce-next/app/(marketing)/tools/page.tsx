import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator, Package, FileText, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Strumenti Gratuiti - Fabbricami ERP',
  description:
    'Strumenti gratuiti per il tuo e-commerce: Calcolatore ROI, Checker Inventario, Generatore Fatture. Nessuna registrazione richiesta.',
  openGraph: {
    title: 'Strumenti Gratuiti - Fabbricami ERP',
    description: 'Mini-tools gratuiti per ottimizzare il tuo e-commerce.',
  },
};

const tools = [
  {
    icon: Calculator,
    title: 'Calcolatore ROI',
    description:
      'Scopri quanto puoi risparmiare automatizzando la gestione del tuo e-commerce. Inserisci i tuoi dati e calcola il ritorno sull\'investimento in pochi secondi.',
    features: [
      'Calcolo ore risparmiate',
      'Stima risparmio annuale',
      'ROI su 12 mesi',
      'Confronto prima/dopo',
    ],
    href: '/tools/roi-calculator',
    color: 'blue',
  },
  {
    icon: Package,
    title: 'Checker Inventario',
    description:
      'Carica il tuo inventario in formato CSV e ottieni un\'analisi completa: prodotti sotto scorta, dead stock, e suggerimenti di riordino ottimali.',
    features: [
      'Upload CSV/Excel',
      'Analisi dead stock',
      'Alert sotto scorta',
      'Suggerimenti riordino',
    ],
    href: '/tools/inventory-checker',
    color: 'green',
  },
  {
    icon: FileText,
    title: 'Generatore Fattura',
    description:
      'Crea fatture professionali in formato PDF. Inserisci i dati aziendali, aggiungi le righe e scarica la fattura pronta da inviare.',
    features: [
      'Template professionale',
      'Calcolo IVA automatico',
      'Download PDF',
      'Formato italiano',
    ],
    href: '/tools/invoice-generator',
    color: 'purple',
  },
];

const colorClasses = {
  blue: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    hover: 'hover:border-emerald-400',
  },
  green: {
    bg: 'bg-teal-100',
    text: 'text-teal-600',
    border: 'border-teal-200',
    hover: 'hover:border-teal-400',
  },
  purple: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    hover: 'hover:border-emerald-400',
  },
};

export default function ToolsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/20 rounded-full mb-4 border border-emerald-500/30">
              100% Gratuiti
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Strumenti gratuiti per il tuo e-commerce
            </h1>
            <p className="text-lg text-white/70">
              Mini-tools utili per ottimizzare il tuo business. Nessuna registrazione richiesta,
              nessun limite di utilizzo.
            </p>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {tools.map((tool) => {
              const colors = colorClasses[tool.color as keyof typeof colorClasses];
              return (
                <div
                  key={tool.title}
                  className={`bg-white rounded-2xl p-8 border-2 ${colors.border} ${colors.hover} transition-all shadow-sm hover:shadow-xl`}
                >
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${colors.bg}`}
                  >
                    <tool.icon className={`w-8 h-8 ${colors.text}`} />
                  </div>

                  {/* Content */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">{tool.title}</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">{tool.description}</p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8">
                    {tool.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-gray-700">
                        <svg
                          className={`w-5 h-5 ${colors.text}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={tool.href}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${colors.bg} ${colors.text} hover:gap-3`}
                  >
                    Usa Ora
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Vuoi automatizzare tutto questo?
            </h2>
            <p className="text-gray-600 mb-8">
              Questi strumenti sono solo un assaggio. Con Fabbricami ERP puoi automatizzare
              inventario, ordini, fatturazione e molto altro in un'unica piattaforma.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-colors"
              >
                Prova Gratis 14 Giorni
              </Link>
              <Link
                href="/features"
                className="px-8 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Scopri le Funzionalita
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
