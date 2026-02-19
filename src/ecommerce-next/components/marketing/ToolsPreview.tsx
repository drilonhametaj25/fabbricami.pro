'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calculator, Package, FileText, ArrowRight } from 'lucide-react';

const tools = [
  {
    icon: Calculator,
    title: 'Calcolatore ROI',
    description:
      'Calcola quanto puoi risparmiare automatizzando la gestione del tuo e-commerce con Fabbricami.',
    href: '/tools/roi-calculator',
    color: 'blue',
  },
  {
    icon: Package,
    title: 'Checker Inventario',
    description:
      'Carica il tuo inventario e scopri prodotti sotto scorta, dead stock e suggerimenti di riordino.',
    href: '/tools/inventory-checker',
    color: 'green',
  },
  {
    icon: FileText,
    title: 'Generatore Fattura',
    description:
      'Crea fatture professionali in PDF gratuitamente. Perfetto per testare prima di automatizzare.',
    href: '/tools/invoice-generator',
    color: 'purple',
  },
];

const colorClasses = {
  blue: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    hover: 'group-hover:bg-emerald-600 group-hover:text-white',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    hover: 'group-hover:bg-green-600 group-hover:text-white',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    hover: 'group-hover:bg-purple-600 group-hover:text-white',
  },
};

export function ToolsPreview() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-full mb-4"
          >
            Strumenti Gratuiti
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Prova i nostri mini-tools gratuiti
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Strumenti utili per il tuo business, completamente gratuiti.
            Nessuna registrazione richiesta.
          </motion.p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tools.map((tool, index) => {
            const colors = colorClasses[tool.color as keyof typeof colorClasses];
            return (
              <motion.div
                key={tool.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={tool.href}
                  className="group block h-full p-8 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl border border-transparent hover:border-gray-100 transition-all duration-300"
                >
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${colors.bg} ${colors.text} ${colors.hover}`}
                  >
                    <tool.icon className="w-7 h-7" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {tool.description}
                  </p>

                  {/* Link */}
                  <span className="inline-flex items-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                    Usa gratis
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
