import type { Metadata } from 'next';
import { PricingTable } from '@/components/marketing/PricingTable';
import { FAQ } from '@/components/marketing/FAQ';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Prezzi - Fabbricami ERP',
  description:
    'Scopri i piani Fabbricami ERP: Starter da €29/mese, Pro da €79/mese, Business da €149/mese. 14 giorni di prova gratuita su tutti i piani.',
  openGraph: {
    title: 'Prezzi - Fabbricami ERP',
    description: 'Piani flessibili per ogni esigenza. Prova gratis 14 giorni.',
  },
};

export default function PricingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/20 rounded-full mb-4 border border-emerald-500/30">
              Prezzi Semplici e Trasparenti
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Un piano per ogni fase della tua crescita
            </h1>
            <p className="text-lg text-white/70">
              Nessun costo nascosto. Nessun setup fee. Cambia piano quando vuoi.
              Inizia con 14 giorni di prova gratuita.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <PricingTable />

      {/* Feature Comparison */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Confronto completo funzionalita
          </h2>

          <div className="max-w-5xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-6 text-left text-gray-600 font-medium">
                    Funzionalita
                  </th>
                  <th className="py-4 px-6 text-center text-gray-900 font-semibold">
                    Starter
                  </th>
                  <th className="py-4 px-6 text-center text-emerald-600 font-semibold bg-emerald-50/50 rounded-t-lg">
                    Pro
                  </th>
                  <th className="py-4 px-6 text-center text-gray-900 font-semibold">
                    Business
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Utenti inclusi', starter: '2', pro: '5', business: '15' },
                  { name: 'Ordini/mese', starter: '500', pro: '2.500', business: '10.000' },
                  { name: 'Prodotti', starter: '1.000', pro: '10.000', business: 'Illimitati' },
                  { name: 'Magazzini', starter: '1', pro: '3', business: 'Illimitati' },
                  {
                    name: 'Integrazione WooCommerce',
                    starter: true,
                    pro: true,
                    business: 'Multi-shop',
                  },
                  { name: 'Gestione inventario', starter: 'Base', pro: 'Avanzata', business: 'Enterprise' },
                  { name: 'Gestione ordini', starter: true, pro: true, business: true },
                  { name: 'CRM clienti', starter: 'Base', pro: 'Completo', business: 'Enterprise' },
                  { name: 'Report', starter: 'Base', pro: 'Avanzati', business: 'Custom + BI' },
                  { name: 'Produzione & BOM', starter: false, pro: true, business: true },
                  { name: 'Fatturazione elettronica', starter: false, pro: true, business: true },
                  { name: 'API access', starter: false, pro: true, business: 'Illimitate' },
                  { name: 'White-label', starter: false, pro: false, business: true },
                  { name: 'Supporto', starter: 'Email', pro: 'Priority', business: 'Dedicato' },
                ].map((row, index) => (
                  <tr key={row.name} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="py-4 px-6 text-gray-700">{row.name}</td>
                    <td className="py-4 px-6 text-center">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-900">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center bg-emerald-50/30">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-900 font-medium">{row.pro}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {typeof row.business === 'boolean' ? (
                        row.business ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-900">{row.business}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <CTASection />
    </>
  );
}
