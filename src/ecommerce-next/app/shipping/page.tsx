import { Metadata } from 'next';
import { Truck, Clock, Globe, Package, MapPin, CreditCard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Spedizioni | EcommerceERP',
  description: 'Informazioni sulle spedizioni e tempi di consegna.',
};

export default function ShippingPage() {
  const shippingMethods = [
    {
      name: 'Spedizione Standard',
      time: '3-5 giorni lavorativi',
      price: '4.90',
      freeFrom: '50.00',
    },
    {
      name: 'Spedizione Express',
      time: '1-2 giorni lavorativi',
      price: '9.90',
      freeFrom: '100.00',
    },
    {
      name: 'Spedizione Europa',
      time: '5-10 giorni lavorativi',
      price: '14.90',
      freeFrom: '150.00',
    },
    {
      name: 'Spedizione Internazionale',
      time: '10-15 giorni lavorativi',
      price: '24.90',
      freeFrom: '200.00',
    },
  ];

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-surface-card to-primary">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Truck className="w-16 h-16 text-gold mx-auto mb-6" />
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-6">
              Spedizioni
            </h1>
            <p className="text-xl text-text-secondary">
              Consegne rapide e sicure in tutto il mondo
            </p>
          </div>
        </div>
      </section>

      {/* Shipping Methods */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-3xl font-semibold text-white mb-8 text-center">
              Metodi di Spedizione
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {shippingMethods.map((method, index) => (
                <div
                  key={index}
                  className="bg-surface-card rounded-2xl p-6 border border-white/10"
                >
                  <h3 className="font-display text-xl font-semibold text-white mb-4">
                    {method.name}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-text-secondary">
                      <Clock className="w-5 h-5 text-gold" />
                      <span>{method.time}</span>
                    </div>
                    <div className="flex items-center gap-3 text-text-secondary">
                      <CreditCard className="w-5 h-5 text-gold" />
                      <span>{method.price}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <span className="text-success text-sm">
                        Gratuita per ordini sopra {method.freeFrom}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Info Sections */}
      <section className="py-20 lg:py-28 bg-surface-card">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto space-y-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-gold" />
                <h3 className="font-display text-2xl font-semibold text-white">
                  Elaborazione Ordini
                </h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Gli ordini vengono elaborati entro 24-48 ore lavorative dalla conferma
                del pagamento. Riceverai una email di conferma con il numero di tracking
                non appena il pacco sara affidato al corriere.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-6 h-6 text-gold" />
                <h3 className="font-display text-2xl font-semibold text-white">
                  Tracciamento
                </h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Tutti gli ordini sono tracciabili. Una volta spedito il pacco, riceverai
                via email il codice di tracciamento per seguire la consegna in tempo reale.
                Puoi anche controllare lo stato dal tuo account nella sezione Ordini.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-gold" />
                <h3 className="font-display text-2xl font-semibold text-white">
                  Spedizioni Internazionali
                </h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Spediamo in oltre 40 paesi. Per spedizioni al di fuori dell UE, eventuali
                dazi doganali e tasse di importazione sono a carico del destinatario.
                Ti consigliamo di verificare le normative doganali del tuo paese prima
                di effettuare l ordine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl font-semibold text-white mb-8 text-center">
              Domande Frequenti
            </h2>

            <div className="space-y-4">
              {[
                {
                  q: 'Posso modificare l indirizzo di spedizione dopo aver effettuato l ordine?',
                  a: 'Se l ordine non e ancora stato spedito, contattaci immediatamente e faremo il possibile per modificare l indirizzo. Una volta spedito, non sara possibile modificarlo.',
                },
                {
                  q: 'Cosa succede se non sono in casa al momento della consegna?',
                  a: 'Il corriere lascera un avviso e tentera una seconda consegna. Se non vai a ritirare il pacco in deposito entro i termini previsti, ci verra restituito.',
                },
                {
                  q: 'Effettuate spedizioni il sabato e la domenica?',
                  a: 'Gli ordini vengono elaborati dal lunedi al venerdi. Le consegne possono avvenire anche il sabato in alcune aree, a seconda del corriere.',
                },
              ].map((faq, index) => (
                <div key={index} className="bg-surface-card rounded-xl p-6">
                  <h3 className="font-medium text-white mb-2">{faq.q}</h3>
                  <p className="text-text-secondary text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
