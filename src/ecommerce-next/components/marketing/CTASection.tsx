'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const benefits = [
  'Prova gratuita 14 giorni',
  'Nessuna carta richiesta',
  'Setup guidato in 5 minuti',
  'Supporto italiano incluso',
];

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
          >
            Pronto a trasformare il tuo e-commerce?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/80 mb-10 max-w-2xl mx-auto"
          >
            Unisciti a oltre 500 e-commerce italiani che hanno scelto Fabbricami
            per gestire inventario, ordini e fatturazione in modo efficiente.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-10"
          >
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-blue-600 bg-white rounded-xl hover:bg-gray-50 transition-all shadow-lg"
            >
              Inizia Gratis Ora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="https://demo.fabbricami.pro"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all border border-white/20"
            >
              Guarda una Demo
            </Link>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-white/80">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
