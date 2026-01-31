import { Metadata } from 'next';
import Link from 'next/link';
import { RotateCcw, CheckCircle, XCircle, Clock, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Resi e Rimborsi | EcommerceERP',
  description: 'Politica di reso e rimborso del nostro e-commerce.',
};

export default function ReturnsPage() {
  const returnSteps = [
    {
      step: 1,
      title: 'Richiedi il Reso',
      description: 'Contattaci entro 30 giorni dalla consegna indicando il numero ordine e il motivo del reso.',
    },
    {
      step: 2,
      title: 'Ricevi le Istruzioni',
      description: 'Ti invieremo via email le istruzioni per la spedizione del reso e l etichetta prepagata (se applicabile).',
    },
    {
      step: 3,
      title: 'Spedisci il Pacco',
      description: 'Imballa i prodotti nella confezione originale e spedisci il pacco seguendo le istruzioni ricevute.',
    },
    {
      step: 4,
      title: 'Ricevi il Rimborso',
      description: 'Una volta ricevuto e verificato il reso, emetteremo il rimborso entro 14 giorni.',
    },
  ];

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-surface-card to-primary">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <RotateCcw className="w-16 h-16 text-gold mx-auto mb-6" />
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-6">
              Resi e Rimborsi
            </h1>
            <p className="text-xl text-text-secondary">
              La tua soddisfazione e la nostra priorita
            </p>
          </div>
        </div>
      </section>

      {/* Return Policy Summary */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-surface-card rounded-2xl p-6 text-center">
                <Clock className="w-10 h-10 text-gold mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">30 Giorni</h3>
                <p className="text-text-secondary text-sm">
                  Per richiedere il reso dalla data di consegna
                </p>
              </div>
              <div className="bg-surface-card rounded-2xl p-6 text-center">
                <CheckCircle className="w-10 h-10 text-success mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Reso Gratuito</h3>
                <p className="text-text-secondary text-sm">
                  Per prodotti difettosi o errori nostri
                </p>
              </div>
              <div className="bg-surface-card rounded-2xl p-6 text-center">
                <Mail className="w-10 h-10 text-gold mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Supporto Dedicato</h3>
                <p className="text-text-secondary text-sm">
                  Ti assistiamo in ogni fase del processo
                </p>
              </div>
            </div>

            {/* Return Steps */}
            <h2 className="font-display text-3xl font-semibold text-white mb-8 text-center">
              Come Effettuare un Reso
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {returnSteps.map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-surface-card rounded-2xl p-6 h-full">
                    <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-primary font-bold mb-4">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-text-secondary text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Conditions */}
      <section className="py-20 lg:py-28 bg-surface-card">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl font-semibold text-white mb-8 text-center">
              Condizioni per il Reso
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Accepted */}
              <div className="bg-success/10 rounded-2xl p-6 border border-success/20">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-success" />
                  <h3 className="font-semibold text-success">Accettiamo Resi Per</h3>
                </div>
                <ul className="space-y-3 text-text-secondary text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    Prodotti non aperti nella confezione originale
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    Prodotti difettosi o danneggiati
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    Prodotti diversi da quelli ordinati
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    Articoli consegnati in ritardo oltre i termini garantiti
                  </li>
                </ul>
              </div>

              {/* Not Accepted */}
              <div className="bg-error/10 rounded-2xl p-6 border border-error/20">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-6 h-6 text-error" />
                  <h3 className="font-semibold text-error">Non Accettiamo Resi Per</h3>
                </div>
                <ul className="space-y-3 text-text-secondary text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-error">✗</span>
                    Prodotti aperti o utilizzati
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-error">✗</span>
                    Colori e prodotti chimici aperti
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-error">✗</span>
                    Prodotti danneggiati per uso improprio
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-error">✗</span>
                    Articoli senza confezione originale
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Refund Info */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl font-semibold text-white mb-8 text-center">
              Informazioni sui Rimborsi
            </h2>

            <div className="space-y-6">
              <div className="bg-surface-card rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Tempistiche</h3>
                <p className="text-text-secondary text-sm">
                  I rimborsi vengono elaborati entro 14 giorni lavorativi dalla ricezione
                  del reso. Il tempo effettivo per visualizzare il rimborso dipende dal
                  tuo metodo di pagamento e dalla tua banca.
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Metodo di Rimborso</h3>
                <p className="text-text-secondary text-sm">
                  Il rimborso verra effettuato con lo stesso metodo di pagamento utilizzato
                  per l ordine originale. Per pagamenti con carta, potrebbero essere
                  necessari 5-10 giorni lavorativi per la visualizzazione sul conto.
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Spese di Spedizione</h3>
                <p className="text-text-secondary text-sm">
                  Le spese di spedizione originali non sono rimborsabili, tranne nei casi
                  di prodotti difettosi o errori da parte nostra. In questi casi, ti
                  forniremo un etichetta di reso prepagata.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-surface-card">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-3xl font-semibold text-white mb-4">
              Hai Bisogno di Assistenza?
            </h2>
            <p className="text-text-secondary mb-8">
              Il nostro team di supporto e a tua disposizione per aiutarti
              con qualsiasi domanda sui resi.
            </p>
            <Link href="/contact" className="btn-primary btn-large">
              Contattaci
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
