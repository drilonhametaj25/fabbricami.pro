'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, Clock, Euro, ArrowRight, RefreshCw } from 'lucide-react';

interface ROIResults {
  hoursPerMonth: number;
  hourlySavings: number;
  annualSavings: number;
  roi: number;
  paybackMonths: number;
}

export default function ROICalculatorPage() {
  const [formData, setFormData] = useState({
    ordersPerMonth: 500,
    minutesPerOrder: 10,
    hourlyRate: 25,
    inventoryErrorRate: 5,
    plan: 'pro', // starter, pro, business
  });

  const [results, setResults] = useState<ROIResults | null>(null);

  const planPrices = {
    starter: 29,
    pro: 79,
    business: 149,
  };

  const calculateROI = () => {
    // Tempo attuale speso per gestione ordini (ore/mese)
    const currentHoursOnOrders = (formData.ordersPerMonth * formData.minutesPerOrder) / 60;

    // Risparmio tempo con automazione (circa 70% riduzione)
    const hoursSavedPerMonth = currentHoursOnOrders * 0.7;

    // Risparmio economico da tempo
    const timeSavingsPerMonth = hoursSavedPerMonth * formData.hourlyRate;

    // Costo errori inventario (stima: ogni errore costa circa €50 in media)
    const errorCostPerMonth = (formData.ordersPerMonth * formData.inventoryErrorRate / 100) * 50;

    // Riduzione errori con ERP (circa 90%)
    const errorSavingsPerMonth = errorCostPerMonth * 0.9;

    // Risparmio totale mensile
    const totalMonthlySavings = timeSavingsPerMonth + errorSavingsPerMonth;

    // Costo mensile piano
    const monthlyPlanCost = planPrices[formData.plan as keyof typeof planPrices];

    // Risparmio netto annuale
    const annualSavings = (totalMonthlySavings - monthlyPlanCost) * 12;

    // ROI percentuale
    const annualCost = monthlyPlanCost * 12;
    const roi = ((annualSavings + annualCost) / annualCost) * 100;

    // Mesi per recupero investimento
    const paybackMonths = monthlyPlanCost / totalMonthlySavings;

    setResults({
      hoursPerMonth: hoursSavedPerMonth,
      hourlySavings: timeSavingsPerMonth,
      annualSavings: Math.max(0, annualSavings),
      roi: roi,
      paybackMonths: Math.max(0, paybackMonths),
    });
  };

  const resetCalculator = () => {
    setResults(null);
    setFormData({
      ordersPerMonth: 500,
      minutesPerOrder: 10,
      hourlyRate: 25,
      inventoryErrorRate: 5,
      plan: 'pro',
    });
  };

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
              <Calculator className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Calcolatore ROI
            </h1>
            <p className="text-lg text-gray-600">
              Scopri quanto puoi risparmiare automatizzando la gestione del tuo e-commerce
              con Fabbricami ERP.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Input Form */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  I tuoi dati attuali
                </h2>

                <div className="space-y-6">
                  {/* Orders per month */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ordini al mese
                    </label>
                    <input
                      type="number"
                      value={formData.ordersPerMonth}
                      onChange={(e) =>
                        setFormData({ ...formData, ordersPerMonth: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="500"
                    />
                  </div>

                  {/* Minutes per order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minuti medi per gestire un ordine
                    </label>
                    <input
                      type="number"
                      value={formData.minutesPerOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, minutesPerOrder: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include verifica, preparazione, aggiornamento stock, comunicazione cliente
                    </p>
                  </div>

                  {/* Hourly rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Costo orario operatore (€)
                    </label>
                    <input
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) =>
                        setFormData({ ...formData, hourlyRate: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="25"
                    />
                  </div>

                  {/* Error rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tasso errori inventario (%)
                    </label>
                    <input
                      type="number"
                      value={formData.inventoryErrorRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          inventoryErrorRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="5"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ordini con problemi di stock, spedizioni errate, etc.
                    </p>
                  </div>

                  {/* Plan selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Piano Fabbricami
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'starter', name: 'Starter', price: 29 },
                        { id: 'pro', name: 'Pro', price: 79 },
                        { id: 'business', name: 'Business', price: 149 },
                      ].map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setFormData({ ...formData, plan: plan.id })}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            formData.plan === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">{plan.name}</div>
                          <div className="text-sm text-gray-600">€{plan.price}/mese</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={calculateROI}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    Calcola ROI
                  </button>
                </div>
              </div>

              {/* Results */}
              <div>
                {results ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">I tuoi risultati</h2>
                      <button
                        onClick={resetCalculator}
                        className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Hours saved */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Clock className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-3xl font-bold">
                            {results.hoursPerMonth.toFixed(0)} ore/mese
                          </div>
                          <div className="text-white/70">Tempo risparmiato</div>
                        </div>
                      </div>

                      {/* Annual savings */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Euro className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-3xl font-bold">
                            €{results.annualSavings.toLocaleString('it-IT', { maximumFractionDigits: 0 })}/anno
                          </div>
                          <div className="text-white/70">Risparmio netto annuale</div>
                        </div>
                      </div>

                      {/* ROI */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-3xl font-bold">{results.roi.toFixed(0)}%</div>
                          <div className="text-white/70">Ritorno sull'investimento</div>
                        </div>
                      </div>

                      {/* Payback */}
                      <div className="pt-4 border-t border-white/20">
                        <div className="text-center">
                          <div className="text-lg text-white/70 mb-1">Recupero investimento in</div>
                          <div className="text-2xl font-bold">
                            {results.paybackMonths < 1
                              ? 'Meno di 1 mese'
                              : `${results.paybackMonths.toFixed(1)} mesi`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-8 pt-6 border-t border-white/20">
                      <Link
                        href="/auth/register"
                        className="flex items-center justify-center gap-2 w-full py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Ottieni questi risultati
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-8 h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
                      <Calculator className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Inserisci i tuoi dati
                    </h3>
                    <p className="text-gray-500">
                      Compila il form e clicca "Calcola ROI" per vedere quanto puoi risparmiare.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Come calcoliamo il ROI
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Tempo Risparmiato',
                  description:
                    'Stimiamo una riduzione del 70% del tempo di gestione ordini grazie all\'automazione.',
                },
                {
                  title: 'Errori Evitati',
                  description:
                    'Gli errori di inventario diminuiscono del 90% con la sincronizzazione in tempo reale.',
                },
                {
                  title: 'Costi Ridotti',
                  description:
                    'Meno tempo manuale + meno errori = risparmio economico concreto e misurabile.',
                },
              ].map((item, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold mb-4">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Pronto a risparmiare?
            </h2>
            <p className="text-gray-600 mb-8">
              Inizia la prova gratuita di 14 giorni e verifica di persona i risultati.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Inizia Gratis
              </Link>
              <Link
                href="/tools"
                className="px-8 py-3 text-gray-700 font-semibold hover:text-gray-900 transition-colors"
              >
                Altri strumenti
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
