'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      'Da quando usiamo Fabbricami abbiamo ridotto del 70% il tempo di gestione ordini. La sincronizzazione con WooCommerce e perfetta.',
    author: 'Marco Rossi',
    role: 'CEO',
    company: 'TechStore Italia',
    avatar: '/images/testimonials/avatar-1.jpg',
    rating: 5,
  },
  {
    quote:
      'Finalmente un ERP pensato per gli e-commerce italiani! La fatturazione elettronica integrata ci ha semplificato enormemente il lavoro.',
    author: 'Laura Bianchi',
    role: 'Operations Manager',
    company: 'Fashion Milano',
    avatar: '/images/testimonials/avatar-2.jpg',
    rating: 5,
  },
  {
    quote:
      'Il modulo produzione e incredibile. Gestiamo distinte base complesse e ordini di produzione senza piu fogli Excel.',
    author: 'Giuseppe Verdi',
    role: 'Production Manager',
    company: 'Artigiano Digitale',
    avatar: '/images/testimonials/avatar-3.jpg',
    rating: 5,
  },
];

const stats = [
  { value: '500+', label: 'Clienti attivi' },
  { value: '2M+', label: 'Ordini processati' },
  { value: '99.9%', label: 'Uptime garantito' },
  { value: '4.9/5', label: 'Rating clienti' },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                {stat.value}
              </div>
              <div className="text-gray-600">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-full mb-4"
          >
            Testimonianze
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Cosa dicono i nostri clienti
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Oltre 500 e-commerce italiani hanno scelto Fabbricami per gestire il loro business.
          </motion.p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 rounded-2xl p-8 relative"
            >
              {/* Quote Icon */}
              <div className="absolute top-6 right-6 text-gray-200">
                <Quote className="w-10 h-10" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-gray-700 leading-relaxed mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Logos Section */}
        <div className="mt-20 pt-12 border-t border-gray-100">
          <p className="text-center text-gray-500 text-sm mb-8">
            Utilizzato da aziende leader nel settore e-commerce
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-50">
            {['TechStore', 'Fashion Milano', 'Artigiano Digitale', 'E-Shop Pro', 'Digital Commerce'].map(
              (company) => (
                <span key={company} className="text-xl font-bold text-gray-400">
                  {company}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
