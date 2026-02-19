'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: 'Come funziona la prova gratuita?',
    answer:
      'La prova gratuita dura 14 giorni e include tutte le funzionalita del piano Pro. Non e richiesta alcuna carta di credito. Al termine della prova, potrai scegliere il piano piu adatto alle tue esigenze o continuare con il piano gratuito limitato.',
  },
  {
    question: 'Posso importare i miei dati esistenti?',
    answer:
      'Si, Fabbricami supporta l\'importazione di dati da file CSV/Excel per prodotti, clienti, ordini e inventario. Offriamo anche assistenza gratuita per la migrazione durante il periodo di onboarding.',
  },
  {
    question: 'Come funziona l\'integrazione con WooCommerce?',
    answer:
      'L\'integrazione con WooCommerce e nativa e bidirezionale. Sincronizza automaticamente prodotti, stock, ordini e clienti. Basta inserire le credenziali API del tuo negozio WooCommerce durante il setup iniziale.',
  },
  {
    question: 'La fatturazione elettronica e inclusa?',
    answer:
      'Si, la fatturazione elettronica e inclusa nei piani Pro e Business. Supportiamo l\'invio diretto al Sistema di Interscambio (SDI), la generazione di XML FatturaPA e la conservazione digitale a norma.',
  },
  {
    question: 'Posso cambiare piano in qualsiasi momento?',
    answer:
      'Certamente! Puoi effettuare upgrade o downgrade del tuo piano in qualsiasi momento. L\'upgrade e immediato, mentre il downgrade avverra alla fine del periodo di fatturazione corrente.',
  },
  {
    question: 'I miei dati sono al sicuro?',
    answer:
      'Assolutamente si. Utilizziamo crittografia SSL/TLS, backup giornalieri automatici, server in data center europei conformi GDPR. I tuoi dati restano sempre di tua proprieta e puoi esportarli in qualsiasi momento.',
  },
  {
    question: 'Che tipo di supporto offrite?',
    answer:
      'Offriamo supporto via email per tutti i piani, con tempi di risposta garantiti entro 24 ore. I piani Pro e Business includono anche supporto prioritario con chat live e chiamate programmate. Il piano Business include un account manager dedicato.',
  },
  {
    question: 'Posso usare Fabbricami per piu negozi?',
    answer:
      'Si, il piano Business supporta la gestione di piu negozi WooCommerce da un\'unica dashboard. Puoi centralizzare inventario, ordini e report per tutti i tuoi e-commerce.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-4"
          >
            FAQ
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Domande frequenti
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Tutto quello che devi sapere su Fabbricami ERP.
            Non trovi la risposta? Contattaci!
          </motion.p>
        </div>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="mb-4"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className={`w-full flex items-center justify-between p-6 text-left rounded-xl transition-all ${
                  openIndex === index
                    ? 'bg-white shadow-lg'
                    : 'bg-white hover:shadow-md'
                }`}
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    openIndex === index
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {openIndex === index ? (
                    <Minus className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </span>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-2 text-gray-600 leading-relaxed bg-white rounded-b-xl -mt-2">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-600 mb-4">
            Hai altre domande?
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Contatta il supporto
          </a>
        </motion.div>
      </div>
    </section>
  );
}
