'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Mail, Home, ArrowRight } from 'lucide-react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle className="w-12 h-12 text-success" />
        </motion.div>

        {/* Title */}
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4">
          Ordine Confermato!
        </h1>

        {/* Order Number */}
        {orderId && (
          <p className="text-text-secondary mb-8">
            Numero ordine:{' '}
            <span className="text-gold font-medium">#{orderId}</span>
          </p>
        )}

        {/* Description */}
        <p className="text-text-secondary mb-8 leading-relaxed">
          Grazie per il tuo acquisto! Riceverai a breve un&apos;email di conferma con
          i dettagli del tuo ordine e le informazioni di tracciamento.
        </p>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-card rounded-xl p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Email inviata</p>
                <p className="text-xs text-text-muted">
                  Controlla la tua casella
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-card rounded-xl p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">In preparazione</p>
                <p className="text-xs text-text-muted">
                  Spedizione in 1-2 giorni
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/account/orders" className="btn-primary btn-large justify-center">
            Visualizza Ordine
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link href="/" className="btn-secondary btn-large justify-center">
            <Home className="w-5 h-5" />
            Torna alla Home
          </Link>
        </div>

        {/* Support */}
        <p className="text-sm text-text-muted mt-8">
          Hai domande?{' '}
          <Link href="/contact" className="text-gold hover:underline">
            Contattaci
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
