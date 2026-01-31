import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | EcommerceERP',
  description: 'Informativa sulla privacy del nostro e-commerce.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-primary">
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-8">
            Privacy Policy
          </h1>

          <div className="prose prose-invert prose-gold max-w-none">
            <p className="text-text-secondary text-lg mb-8">
              Ultimo aggiornamento: Gennaio 2025
            </p>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                1. Introduzione
              </h2>
              <p className="text-text-secondary leading-relaxed">
                La nostra azienda (di seguito &quot;noi&quot;, &quot;nostro&quot; o &quot;Azienda&quot;) rispetta la privacy
                dei propri utenti. Questa Privacy Policy spiega come raccogliamo, utilizziamo,
                divulghiamo e proteggiamo le tue informazioni personali quando visiti il
                nostro sito web e utilizzi i nostri servizi.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                2. Informazioni che Raccogliamo
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                Raccogliamo le seguenti categorie di informazioni:
              </p>
              <ul className="list-disc pl-6 text-text-secondary space-y-2">
                <li>Informazioni personali (nome, email, indirizzo, telefono)</li>
                <li>Informazioni di pagamento (processate in modo sicuro dai nostri partner)</li>
                <li>Informazioni sull utilizzo del sito (cookies, analytics)</li>
                <li>Informazioni sugli ordini e sulla cronologia degli acquisti</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                3. Come Utilizziamo le Informazioni
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                Utilizziamo le informazioni raccolte per:
              </p>
              <ul className="list-disc pl-6 text-text-secondary space-y-2">
                <li>Elaborare e gestire i tuoi ordini</li>
                <li>Comunicare con te riguardo agli ordini e al servizio clienti</li>
                <li>Migliorare il nostro sito web e i nostri servizi</li>
                <li>Inviarti comunicazioni di marketing (con il tuo consenso)</li>
                <li>Prevenire frodi e garantire la sicurezza</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                4. Condivisione delle Informazioni
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Non vendiamo le tue informazioni personali. Potremmo condividerle con
                fornitori di servizi terzi che ci aiutano a gestire il nostro business
                (corrieri, processori di pagamento, servizi di analisi), sempre nel
                rispetto di questa Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                5. I Tuoi Diritti
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                In conformita con il GDPR, hai il diritto di:
              </p>
              <ul className="list-disc pl-6 text-text-secondary space-y-2">
                <li>Accedere ai tuoi dati personali</li>
                <li>Rettificare dati inesatti</li>
                <li>Richiedere la cancellazione dei tuoi dati</li>
                <li>Opporsi al trattamento dei tuoi dati</li>
                <li>Richiedere la portabilita dei dati</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                6. Sicurezza
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Adottiamo misure di sicurezza tecniche e organizzative appropriate per
                proteggere le tue informazioni personali da accessi non autorizzati,
                alterazioni, divulgazioni o distruzioni.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold text-white mb-4">
                7. Contatti
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Per domande su questa Privacy Policy o per esercitare i tuoi diritti,
                contattaci all indirizzo: privacy@ecommerceerp.com
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
