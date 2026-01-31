import { Metadata } from 'next';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Image from 'next/image';
import Link from 'next/link';
import { Award, Users, Globe, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Chi Siamo | EcommerceERP',
  description: 'Scopri la storia del nostro e-commerce e i valori che ci guidano.',
};

export default function AboutPage() {
  const stats = [
    { value: '30+', label: 'Anni di esperienza' },
    { value: '50K+', label: 'Clienti soddisfatti' },
    { value: '5000+', label: 'Prodotti disponibili' },
    { value: '40+', label: 'Paesi serviti' },
  ];

  const values = [
    {
      icon: Award,
      title: 'Eccellenza',
      description: 'Selezioniamo solo prodotti di altissima qualita per garantire risultati eccezionali.',
    },
    {
      icon: Users,
      title: 'Comunita',
      description: 'Supportiamo e coltiviamo la passione dei modellisti di tutto il mondo.',
    },
    {
      icon: Globe,
      title: 'Innovazione',
      description: 'Siamo sempre alla ricerca di nuove tecniche e prodotti innovativi.',
    },
    {
      icon: Heart,
      title: 'Passione',
      description: 'Il nostro amore per il modellismo guida ogni nostra decisione.',
    },
  ];

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/10 to-transparent" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6">
              La Nostra <span className="text-gold">Storia</span>
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed">
              Da anni siamo il punto di riferimento per i clienti
              che cercano qualita e servizio eccellente.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-surface-card">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl md:text-5xl font-display font-bold text-gold mb-2">
                  {stat.value}
                </p>
                <p className="text-text-secondary">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-6">
                Dove Tutto e Iniziato
              </h2>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  Il nostro e-commerce nasce dalla passione per la qualita e
                  dalla volonta di offrire un servizio eccellente ai nostri clienti.
                  Quello che e iniziato come un piccolo progetto e
                  diventato oggi un riferimento nel settore.
                </p>
                <p>
                  Nel corso degli anni, abbiamo selezionato con cura i migliori
                  prodotti e collaborato con i fornitori piu affidabili per
                  garantire sempre la massima soddisfazione.
                </p>
                <p>
                  La nostra missione rimane la stessa: fornire ai clienti i
                  prodotti migliori al giusto prezzo,
                  supportandoli con competenza e professionalita.
                </p>
              </div>
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-surface-card">
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-text-muted">Immagine Storia</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-surface-card to-primary">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4">
              I Nostri Valori
            </h2>
            <p className="text-text-secondary">
              Principi che guidano ogni nostra azione e decisione
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="bg-surface-card rounded-2xl p-6 text-center hover:bg-surface-raised transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-gold" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-text-secondary text-sm">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-6">
              Unisciti alla Nostra Comunita
            </h2>
            <p className="text-text-secondary mb-8">
              Scopri il nostro catalogo e inizia a creare capolavori con i
              migliori prodotti per modellismo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/shop" className="btn-primary btn-large justify-center">
                Esplora lo Shop
              </Link>
              <Link href="/contact" className="btn-secondary btn-large justify-center">
                Contattaci
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
