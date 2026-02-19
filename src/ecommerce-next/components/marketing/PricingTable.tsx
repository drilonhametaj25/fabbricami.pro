'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, X, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    description: 'Perfetto per piccoli e-commerce in crescita',
    monthlyPrice: 29,
    yearlyPrice: 279,
    features: [
      { name: 'Fino a 2 utenti', included: true },
      { name: '500 ordini/mese', included: true },
      { name: '1.000 prodotti', included: true },
      { name: '1 magazzino', included: true },
      { name: 'Integrazione WooCommerce', included: true },
      { name: 'Gestione inventario', included: true },
      { name: 'Gestione ordini', included: true },
      { name: 'Anagrafica clienti', included: true },
      { name: 'Report base', included: true },
      { name: 'Email support', included: true },
      { name: 'Produzione', included: false },
      { name: 'Fatturazione elettronica', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Inizia Gratis',
    popular: false,
  },
  {
    name: 'Pro',
    description: 'Per e-commerce in forte espansione',
    monthlyPrice: 79,
    yearlyPrice: 759,
    features: [
      { name: 'Fino a 5 utenti', included: true },
      { name: '2.500 ordini/mese', included: true },
      { name: '10.000 prodotti', included: true },
      { name: '3 magazzini', included: true },
      { name: 'Integrazione WooCommerce', included: true },
      { name: 'Gestione inventario avanzata', included: true },
      { name: 'Gestione ordini', included: true },
      { name: 'CRM completo', included: true },
      { name: 'Report avanzati', included: true },
      { name: 'Produzione e BOM', included: true },
      { name: 'Fatturazione elettronica', included: true },
      { name: 'API access', included: true },
      { name: 'Priority support', included: true },
    ],
    cta: 'Inizia Gratis',
    popular: true,
  },
  {
    name: 'Business',
    description: 'Per aziende con esigenze enterprise',
    monthlyPrice: 149,
    yearlyPrice: 1429,
    features: [
      { name: 'Fino a 15 utenti', included: true },
      { name: '10.000 ordini/mese', included: true },
      { name: 'Prodotti illimitati', included: true },
      { name: 'Magazzini illimitati', included: true },
      { name: 'Multi-shop WooCommerce', included: true },
      { name: 'Gestione inventario enterprise', included: true },
      { name: 'Workflow personalizzati', included: true },
      { name: 'CRM enterprise', included: true },
      { name: 'Report custom & BI', included: true },
      { name: 'Produzione avanzata', included: true },
      { name: 'Fatturazione + SDI', included: true },
      { name: 'API illimitate', included: true },
      { name: 'White-label option', included: true },
      { name: 'Account manager dedicato', included: true },
    ],
    cta: 'Contattaci',
    popular: false,
  },
];

export function PricingTable() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-4"
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensile
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                isYearly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annuale
              <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-blue-600 shadow-xl'
                  : 'border border-gray-200 shadow-lg'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-full shadow-lg">
                    <Sparkles className="w-4 h-4" />
                    Piu Popolare
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    €{isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500">/mese</span>
                </div>
                {isYearly && (
                  <p className="text-sm text-gray-500 mt-1">
                    Fatturato €{plan.yearlyPrice}/anno
                  </p>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
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
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link
                href={plan.name === 'Business' ? '/contact' : '/auth/register'}
                className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-600">
            Hai bisogno di piu di 15 utenti o funzionalita custom?{' '}
            <Link href="/contact" className="text-blue-600 font-medium hover:text-blue-700">
              Contattaci per un piano Enterprise
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
