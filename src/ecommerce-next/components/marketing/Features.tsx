'use client';

import { motion } from 'framer-motion';
import {
  Package,
  ShoppingCart,
  Factory,
  Calculator,
  Users,
  Truck,
  BarChart3,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'Gestione Inventario',
    description:
      'Traccia stock in tempo reale, multi-magazzino, alert automatici per riordino e previsioni di esaurimento scorte.',
    color: 'blue',
  },
  {
    icon: ShoppingCart,
    title: 'Gestione Ordini',
    description:
      'Sincronizzazione automatica con WooCommerce, stati ordine personalizzabili, gestione resi e cambi.',
    color: 'green',
  },
  {
    icon: Factory,
    title: 'Produzione',
    description:
      'Gestione distinte base (BOM), ordini di produzione, tracciamento fasi e consumo materiali.',
    color: 'purple',
  },
  {
    icon: Calculator,
    title: 'Contabilita',
    description:
      'Fatturazione elettronica, prima nota, scadenzario pagamenti, report finanziari e export SDI.',
    color: 'orange',
  },
  {
    icon: Users,
    title: 'CRM Clienti',
    description:
      'Anagrafica clienti completa, storico ordini, segmentazione, note e comunicazioni.',
    color: 'pink',
  },
  {
    icon: Truck,
    title: 'Logistica',
    description:
      'Picking list, DDT automatici, integrazione corrieri, tracking spedizioni.',
    color: 'teal',
  },
  {
    icon: BarChart3,
    title: 'Report & Analytics',
    description:
      'Dashboard personalizzabili, KPI in tempo reale, export Excel/PDF, analisi vendite.',
    color: 'indigo',
  },
  {
    icon: Zap,
    title: 'Automazioni',
    description:
      'Workflow automatici, notifiche email/WhatsApp, sincronizzazione schedulata.',
    color: 'yellow',
  },
];

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
  green: 'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white',
  purple: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
  orange: 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white',
  pink: 'bg-pink-100 text-pink-600 group-hover:bg-pink-600 group-hover:text-white',
  teal: 'bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white',
  indigo: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
  yellow: 'bg-yellow-100 text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white',
};

export function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-4"
          >
            Funzionalita Complete
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Tutto quello che serve per gestire il tuo e-commerce
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Un ERP progettato specificamente per le esigenze degli e-commerce italiani,
            con integrazione nativa WooCommerce e fatturazione elettronica.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${
                  colorClasses[feature.color as keyof typeof colorClasses]
                }`}
              >
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <a
            href="/features"
            className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            Scopri tutte le funzionalita
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
