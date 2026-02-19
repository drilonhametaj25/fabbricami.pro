'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, ArrowRight, CheckCircle2 } from 'lucide-react';

const features = [
  'Prova gratuita 14 giorni',
  'Nessuna carta richiesta',
  'Setup in 5 minuti',
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900" />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white/90 mb-6 border border-white/10">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Nuovo: Integrazione WhatsApp Business
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Gestisci il tuo{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                E-commerce
              </span>{' '}
              con un ERP completo
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-xl">
              Inventario, ordini, produzione, contabilita e molto altro in un'unica piattaforma.
              Sincronizza con WooCommerce e automatizza il tuo business.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Link
                href="/auth/register"
                className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30"
              >
                Inizia Gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="https://demo.fabbricami.pro"
                className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                <Play className="w-5 h-5" />
                Guarda Demo
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-white/70 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Main Dashboard Image */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-30" />
              <div className="relative bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                {/* Browser Bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 px-4">
                    <div className="w-full max-w-sm mx-auto h-6 bg-gray-700/50 rounded-lg flex items-center justify-center text-xs text-gray-400">
                      erp.fabbricami.pro
                    </div>
                  </div>
                </div>
                {/* Dashboard Screenshot */}
                <div className="aspect-[16/10] relative bg-gradient-to-br from-gray-800 to-gray-900">
                  {/* Placeholder Dashboard UI */}
                  <div className="absolute inset-0 p-4">
                    {/* Sidebar */}
                    <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-800/50 flex flex-col items-center py-4 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-8 h-8 rounded-lg bg-gray-700/50" />
                      ))}
                    </div>
                    {/* Main Content */}
                    <div className="ml-20">
                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: 'Ordini Oggi', value: '24', color: 'blue' },
                          { label: 'Fatturato', value: '€4.850', color: 'green' },
                          { label: 'Prodotti', value: '1.234', color: 'purple' },
                          { label: 'Clienti', value: '892', color: 'orange' },
                        ].map((stat, i) => (
                          <div key={i} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                            <div className="text-lg font-bold text-white">{stat.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Charts Row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 h-32 rounded-lg bg-gray-800/50 border border-gray-700/50 flex items-end p-3 gap-1">
                          {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                        <div className="h-32 rounded-lg bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full border-4 border-gray-700/50 relative">
                            <div
                              className="absolute inset-0 rounded-full border-4 border-green-500"
                              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 0 75%)' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -left-8 top-1/4 bg-white rounded-xl shadow-xl p-4 border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Nuovo ordine!</div>
                  <div className="text-xs text-gray-500">#ORD-2024-1234</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="absolute -right-4 bottom-1/4 bg-white rounded-xl shadow-xl p-4 border border-gray-100"
            >
              <div className="text-sm font-semibold text-gray-900 mb-2">Sincronizzazione</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-xs">WC</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-gray-600">Connesso</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full">
          <path
            d="M0 120L48 105C96 90 192 60 288 45C384 30 480 30 576 37.5C672 45 768 60 864 67.5C960 75 1056 75 1152 67.5C1248 60 1344 45 1392 37.5L1440 30V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
