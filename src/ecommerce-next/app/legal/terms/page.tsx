import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termini e Condizioni | EcommerceERP',
  description: 'Termini e condizioni di utilizzo del nostro e-commerce.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-primary">
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-8">
            Termini e Condizioni
          </h1>

          <div className="prose prose-invert prose-gold max-w-none">
            <p className="text-text-secondary text-lg mb-8">
              Ultimo aggiornamento: Gennaio 2025
            </p>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                1. Accettazione dei Termini
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Utilizzando il nostro sito web (il &quot;Sito&quot;), accetti di essere
                vincolato da questi Termini e Condizioni. Se non accetti questi termini,
                ti preghiamo di non utilizzare il nostro Sito.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                2. Descrizione del Servizio
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Il nostro e-commerce offre prodotti di alta qualita
                selezionati con cura per i nostri clienti. Offriamo un servizio
                professionale e affidabile.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                3. Account Utente
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                Per effettuare acquisti, potrebbe essere necessario creare un account.
                Sei responsabile di:
              </p>
              <ul className="list-disc pl-6 text-text-secondary space-y-2">
                <li>Mantenere la riservatezza delle tue credenziali</li>
                <li>Tutte le attivita che avvengono sotto il tuo account</li>
                <li>Notificarci immediatamente di qualsiasi uso non autorizzato</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                4. Ordini e Pagamenti
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                I prezzi sono indicati in Euro e includono IVA dove applicabile.
                Ci riserviamo il diritto di:
              </p>
              <ul className="list-disc pl-6 text-text-secondary space-y-2">
                <li>Modificare i prezzi senza preavviso</li>
                <li>Rifiutare o annullare ordini a nostra discrezione</li>
                <li>Limitare le quantita acquistabili</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                5. Spedizioni
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Le spedizioni vengono effettuate tramite corrieri selezionati.
                I tempi di consegna sono indicativi e possono variare. Non siamo
                responsabili per ritardi causati dal corriere o da circostanze
                al di fuori del nostro controllo.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                6. Resi e Rimborsi
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Accettiamo resi entro 30 giorni dalla consegna per prodotti non
                aperti e nella confezione originale. I rimborsi verranno elaborati
                entro 14 giorni dalla ricezione del reso. Per maggiori dettagli,
                consulta la nostra pagina Resi e Rimborsi.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                7. Proprieta Intellettuale
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Tutti i contenuti del Sito, inclusi testi, immagini, loghi e grafiche,
                sono di proprieta dell azienda o dei rispettivi titolari e sono
                protetti dalle leggi sul copyright.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                8. Limitazione di Responsabilita
              </h2>
              <p className="text-text-secondary leading-relaxed">
                L azienda non sara responsabile per danni indiretti, incidentali
                o consequenziali derivanti dall uso o dall impossibilita di utilizzare
                i nostri servizi, nella misura massima consentita dalla legge.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                9. Legge Applicabile
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Questi Termini sono regolati dalla legge italiana. Qualsiasi
                controversia sara di competenza esclusiva del Foro di Milano.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                10. Contatti
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Per domande su questi Termini e Condizioni, contattaci
                all indirizzo: legal@ecommerceerp.com
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
