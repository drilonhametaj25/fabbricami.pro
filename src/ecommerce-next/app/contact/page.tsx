'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Send, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { ApiResponse } from '@/types';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await api.post<ApiResponse<void>>('/shop/contact', formData);

      if (response.success) {
        setSuccess(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        throw new Error('Failed to send message');
      }
    } catch {
      setError('Impossibile inviare il messaggio. Riprova piu tardi.');
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      label: 'Email',
      value: 'info@ecommerceerp.com',
      href: 'mailto:info@ecommerceerp.com',
    },
    {
      icon: Phone,
      label: 'Telefono',
      value: '+39 02 1234567',
      href: 'tel:+3902123456',
    },
    {
      icon: MapPin,
      label: 'Indirizzo',
      value: 'Via del Modellismo 123, Milano, Italia',
      href: null,
    },
    {
      icon: Clock,
      label: 'Orari',
      value: 'Lun-Ven: 9:00-18:00',
      href: null,
    },
  ];

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-surface-card to-primary">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-6">
              Contattaci
            </h1>
            <p className="text-xl text-text-secondary">
              Hai domande o hai bisogno di assistenza? Siamo qui per aiutarti.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-1 space-y-6">
              <h2 className="font-display text-2xl font-semibold text-white mb-6">
                Informazioni di Contatto
              </h2>

              {contactInfo.map((item, index) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-text-muted mb-1">{item.label}</p>
                      <p className="text-white">{item.value}</p>
                    </div>
                  </div>
                );

                return item.href ? (
                  <a
                    key={index}
                    href={item.href}
                    className="block p-4 bg-surface-card rounded-xl hover:bg-surface-raised transition-colors"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={index} className="p-4 bg-surface-card rounded-xl">
                    {content}
                  </div>
                );
              })}
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-surface-card rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-2xl font-semibold text-white mb-6">
                  Inviaci un Messaggio
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Success Message */}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-4 bg-success/10 border border-success/20 rounded-lg"
                    >
                      <Check className="w-5 h-5 text-success flex-shrink-0" />
                      <p className="text-sm text-success">
                        Messaggio inviato con successo! Ti risponderemo al piu presto.
                      </p>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-4 bg-error/10 border border-error/20 rounded-lg"
                    >
                      <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                      <p className="text-sm text-error">{error}</p>
                    </motion.div>
                  )}

                  {/* Name & Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-text-secondary mb-2"
                      >
                        Nome *
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        placeholder="Il tuo nome"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-text-secondary mb-2"
                      >
                        Email *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        placeholder="email@esempio.com"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-text-secondary mb-2"
                    >
                      Oggetto *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white focus:outline-none focus:border-gold/50"
                    >
                      <option value="">Seleziona un argomento</option>
                      <option value="order">Informazioni su un ordine</option>
                      <option value="product">Informazioni su un prodotto</option>
                      <option value="shipping">Spedizioni e consegne</option>
                      <option value="return">Resi e rimborsi</option>
                      <option value="other">Altro</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-text-secondary mb-2"
                    >
                      Messaggio *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50 resize-none"
                      placeholder="Come possiamo aiutarti?"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary btn-large"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Invia Messaggio
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 bg-surface-card">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="font-display text-3xl font-semibold text-white mb-4">
              Domande Frequenti
            </h2>
            <p className="text-text-secondary">
              Trova rapidamente le risposte alle domande piu comuni
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {[
              {
                q: 'Quali sono i tempi di spedizione?',
                a: 'Le spedizioni in Italia richiedono 2-4 giorni lavorativi. Per spedizioni internazionali, i tempi variano da 5 a 10 giorni lavorativi.',
              },
              {
                q: 'Come posso tracciare il mio ordine?',
                a: 'Riceverai un email con il codice di tracciamento non appena il tuo ordine sara spedito. Potrai seguire lo stato della consegna direttamente dal tuo account.',
              },
              {
                q: 'Qual e la vostra politica di reso?',
                a: 'Accettiamo resi entro 30 giorni dalla consegna. I prodotti devono essere nella confezione originale e non utilizzati.',
              },
            ].map((faq, index) => (
              <div key={index} className="bg-surface-raised rounded-xl p-6">
                <h3 className="font-medium text-white mb-2">{faq.q}</h3>
                <p className="text-text-secondary text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
