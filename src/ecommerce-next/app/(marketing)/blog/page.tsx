import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Bell, ArrowRight, Twitter, Linkedin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog - Fabbricami ERP',
  description:
    'Il blog di Fabbricami: guide, tutorial e best practice per gestire il tuo e-commerce. Presto online!',
  openGraph: {
    title: 'Blog - Fabbricami ERP',
    description: 'Guide e tutorial per e-commerce. Presto online!',
  },
};

export default function BlogPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="min-h-[80vh] flex items-center bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-10 h-10" />
            </div>

            <span className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 rounded-full mb-6 border border-emerald-500/20">
              Coming Soon
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Il Blog di{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                Fabbricami
              </span>
            </h1>

            <p className="text-lg text-white/70 mb-10">
              Stiamo preparando guide, tutorial e best practice per aiutarti a
              gestire il tuo e-commerce al meglio. Iscriviti per essere avvisato
              quando pubblicheremo i primi articoli.
            </p>

            {/* Newsletter Form */}
            <div className="max-w-md mx-auto mb-10">
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="La tua email"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Avvisami
                </button>
              </div>
              <p className="text-white/50 text-sm mt-3">
                Niente spam, solo aggiornamenti sul blog.
              </p>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-6">
              <span className="text-white/50 text-sm">Seguici:</span>
              <a
                href="https://twitter.com/fabbricami"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-emerald-400 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/company/fabbricami"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-emerald-400 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Cosa troverai sul blog
            </h2>
            <p className="text-lg text-gray-600">
              Contenuti pensati per aiutarti a far crescere il tuo business.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: 'Guide Pratiche',
                description:
                  'Tutorial step-by-step per configurare e utilizzare tutte le funzionalita di Fabbricami.',
              },
              {
                title: 'Best Practice',
                description:
                  'Consigli e strategie per ottimizzare la gestione del tuo e-commerce e aumentare i margini.',
              },
              {
                title: 'Case Study',
                description:
                  'Storie di successo di e-commerce italiani che usano Fabbricami per crescere.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Nel frattempo, esplora le nostre funzionalita</p>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Scopri le Funzionalita
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
