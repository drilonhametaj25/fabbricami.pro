'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Download, Eye } from 'lucide-react';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface InvoiceData {
  // Azienda
  companyName: string;
  companyVat: string;
  companyAddress: string;
  companyCity: string;
  companyEmail: string;
  // Cliente
  clientName: string;
  clientVat: string;
  clientAddress: string;
  clientCity: string;
  // Fattura
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  // Righe
  items: InvoiceItem[];
  // Note
  notes: string;
}

export default function InvoiceGeneratorPage() {
  const [invoice, setInvoice] = useState<InvoiceData>({
    companyName: '',
    companyVat: '',
    companyAddress: '',
    companyCity: '',
    companyEmail: '',
    clientName: '',
    clientVat: '',
    clientAddress: '',
    clientCity: '',
    invoiceNumber: `FT-${new Date().getFullYear()}-001`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unitPrice: 0, vatRate: 22 }],
    notes: '',
  });

  const [showPreview, setShowPreview] = useState(false);

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { description: '', quantity: 1, unitPrice: 0, vatRate: 22 }],
    });
  };

  const removeItem = (index: number) => {
    setInvoice({
      ...invoice,
      items: invoice.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoice({ ...invoice, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalVat = 0;

    invoice.items.forEach((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const lineVat = lineTotal * (item.vatRate / 100);
      subtotal += lineTotal;
      totalVat += lineVat;
    });

    return {
      subtotal,
      totalVat,
      total: subtotal + totalVat,
    };
  };

  const totals = calculateTotals();

  const downloadPDF = () => {
    // In a real implementation, this would generate a PDF
    // For now, we'll create a simple HTML-based print
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fattura ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .company { }
          .invoice-info { text-align: right; }
          .invoice-number { font-size: 24px; font-weight: bold; color: #1e40af; }
          .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .party { width: 45%; }
          .party-title { font-weight: bold; color: #6b7280; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .text-right { text-align: right; }
          .totals { margin-left: auto; width: 300px; }
          .totals tr td { padding: 8px 12px; }
          .totals .total { font-size: 18px; font-weight: bold; background: #1e40af; color: white; }
          .notes { margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            <strong style="font-size: 20px;">${invoice.companyName}</strong><br>
            P.IVA: ${invoice.companyVat}<br>
            ${invoice.companyAddress}<br>
            ${invoice.companyCity}<br>
            ${invoice.companyEmail}
          </div>
          <div class="invoice-info">
            <div class="invoice-number">FATTURA</div>
            <div>N. ${invoice.invoiceNumber}</div>
            <div>Data: ${new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}</div>
            <div>Scadenza: ${new Date(invoice.dueDate).toLocaleDateString('it-IT')}</div>
          </div>
        </div>

        <div class="parties">
          <div class="party">
            <div class="party-title">CLIENTE</div>
            <strong>${invoice.clientName}</strong><br>
            P.IVA: ${invoice.clientVat}<br>
            ${invoice.clientAddress}<br>
            ${invoice.clientCity}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descrizione</th>
              <th class="text-right">Qta</th>
              <th class="text-right">Prezzo Unit.</th>
              <th class="text-right">IVA %</th>
              <th class="text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.unitPrice.toFixed(2)} €</td>
                <td class="text-right">${item.vatRate}%</td>
                <td class="text-right">${(item.quantity * item.unitPrice).toFixed(2)} €</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <table class="totals">
          <tr>
            <td>Imponibile</td>
            <td class="text-right">${totals.subtotal.toFixed(2)} €</td>
          </tr>
          <tr>
            <td>IVA</td>
            <td class="text-right">${totals.totalVat.toFixed(2)} €</td>
          </tr>
          <tr class="total">
            <td>TOTALE</td>
            <td class="text-right">${totals.total.toFixed(2)} €</td>
          </tr>
        </table>

        ${
          invoice.notes
            ? `
        <div class="notes">
          <strong>Note:</strong><br>
          ${invoice.notes}
        </div>
        `
            : ''
        }

        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-gradient-to-b from-purple-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6">
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Generatore Fattura
            </h1>
            <p className="text-lg text-gray-600">
              Crea fatture professionali in PDF. Inserisci i dati e scarica la fattura
              pronta da inviare ai tuoi clienti.
            </p>
          </div>
        </div>
      </section>

      {/* Generator */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`flex-1 py-4 text-center font-medium transition-colors ${
                    !showPreview
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Compila Fattura
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                    showPreview
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Anteprima
                </button>
              </div>

              {!showPreview ? (
                <div className="p-8">
                  {/* Company & Client Info */}
                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Company Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Dati Azienda (Emittente)
                      </h3>
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Ragione Sociale"
                          value={invoice.companyName}
                          onChange={(e) =>
                            setInvoice({ ...invoice, companyName: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Partita IVA"
                          value={invoice.companyVat}
                          onChange={(e) =>
                            setInvoice({ ...invoice, companyVat: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Indirizzo"
                          value={invoice.companyAddress}
                          onChange={(e) =>
                            setInvoice({ ...invoice, companyAddress: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Citta, CAP"
                          value={invoice.companyCity}
                          onChange={(e) =>
                            setInvoice({ ...invoice, companyCity: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={invoice.companyEmail}
                          onChange={(e) =>
                            setInvoice({ ...invoice, companyEmail: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Client Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Dati Cliente
                      </h3>
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Ragione Sociale / Nome"
                          value={invoice.clientName}
                          onChange={(e) =>
                            setInvoice({ ...invoice, clientName: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Partita IVA / Codice Fiscale"
                          value={invoice.clientVat}
                          onChange={(e) =>
                            setInvoice({ ...invoice, clientVat: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Indirizzo"
                          value={invoice.clientAddress}
                          onChange={(e) =>
                            setInvoice({ ...invoice, clientAddress: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Citta, CAP"
                          value={invoice.clientCity}
                          onChange={(e) =>
                            setInvoice({ ...invoice, clientCity: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Invoice Details */}
                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numero Fattura
                      </label>
                      <input
                        type="text"
                        value={invoice.invoiceNumber}
                        onChange={(e) =>
                          setInvoice({ ...invoice, invoiceNumber: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data Emissione
                      </label>
                      <input
                        type="date"
                        value={invoice.invoiceDate}
                        onChange={(e) =>
                          setInvoice({ ...invoice, invoiceDate: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data Scadenza
                      </label>
                      <input
                        type="date"
                        value={invoice.dueDate}
                        onChange={(e) =>
                          setInvoice({ ...invoice, dueDate: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Righe Fattura</h3>
                      <button
                        onClick={addItem}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Aggiungi Riga
                      </button>
                    </div>

                    <div className="space-y-3">
                      {invoice.items.map((item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-3 items-center p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              placeholder="Descrizione"
                              value={item.description}
                              onChange={(e) =>
                                updateItem(index, 'description', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              placeholder="Qta"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, 'quantity', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              placeholder="Prezzo"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                              step="0.01"
                            />
                          </div>
                          <div className="col-span-2">
                            <select
                              value={item.vatRate}
                              onChange={(e) =>
                                updateItem(index, 'vatRate', parseInt(e.target.value))
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            >
                              <option value={22}>22%</option>
                              <option value={10}>10%</option>
                              <option value={4}>4%</option>
                              <option value={0}>0%</option>
                            </select>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {invoice.items.length > 1 && (
                              <button
                                onClick={() => removeItem(index)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end mb-8">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Imponibile</span>
                        <span className="font-medium">
                          {totals.subtotal.toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">IVA</span>
                        <span className="font-medium">
                          {totals.totalVat.toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between py-3 border-t-2 border-gray-200">
                        <span className="text-lg font-bold">TOTALE</span>
                        <span className="text-lg font-bold text-purple-600">
                          {totals.total.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note (opzionale)
                    </label>
                    <textarea
                      placeholder="Note aggiuntive, condizioni di pagamento, etc."
                      value={invoice.notes}
                      onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      Anteprima
                    </button>
                    <button
                      onClick={downloadPDF}
                      className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Scarica PDF
                    </button>
                  </div>
                </div>
              ) : (
                /* Preview */
                <div className="p-8">
                  <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-2xl mx-auto shadow-sm">
                    {/* Header */}
                    <div className="flex justify-between mb-8">
                      <div>
                        <div className="text-xl font-bold text-gray-900">
                          {invoice.companyName || 'Nome Azienda'}
                        </div>
                        <div className="text-sm text-gray-600">
                          P.IVA: {invoice.companyVat || 'XXXXXXXXXX'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {invoice.companyAddress || 'Indirizzo'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {invoice.companyCity || 'Citta'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">FATTURA</div>
                        <div className="text-sm text-gray-600">N. {invoice.invoiceNumber}</div>
                        <div className="text-sm text-gray-600">
                          Data: {new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}
                        </div>
                        <div className="text-sm text-gray-600">
                          Scadenza: {new Date(invoice.dueDate).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </div>

                    {/* Client */}
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 mb-2">CLIENTE</div>
                      <div className="font-semibold text-gray-900">
                        {invoice.clientName || 'Nome Cliente'}
                      </div>
                      <div className="text-sm text-gray-600">
                        P.IVA: {invoice.clientVat || 'XXXXXXXXXX'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {invoice.clientAddress || 'Indirizzo'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {invoice.clientCity || 'Citta'}
                      </div>
                    </div>

                    {/* Items */}
                    <table className="w-full mb-6">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="py-2 text-left text-sm font-medium text-gray-600">
                            Descrizione
                          </th>
                          <th className="py-2 text-right text-sm font-medium text-gray-600">Qta</th>
                          <th className="py-2 text-right text-sm font-medium text-gray-600">
                            Prezzo
                          </th>
                          <th className="py-2 text-right text-sm font-medium text-gray-600">IVA</th>
                          <th className="py-2 text-right text-sm font-medium text-gray-600">
                            Totale
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-3 text-gray-900">
                              {item.description || 'Descrizione'}
                            </td>
                            <td className="py-3 text-right text-gray-900">{item.quantity}</td>
                            <td className="py-3 text-right text-gray-900">
                              {item.unitPrice.toFixed(2)} €
                            </td>
                            <td className="py-3 text-right text-gray-900">{item.vatRate}%</td>
                            <td className="py-3 text-right text-gray-900 font-medium">
                              {(item.quantity * item.unitPrice).toFixed(2)} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-48">
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">Imponibile</span>
                          <span>{totals.subtotal.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">IVA</span>
                          <span>{totals.totalVat.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-2">
                          <span className="font-bold">TOTALE</span>
                          <span className="font-bold text-purple-600">
                            {totals.total.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>

                    {invoice.notes && (
                      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                        <div className="text-xs font-medium text-gray-500 mb-1">NOTE</div>
                        <div className="text-sm text-gray-700">{invoice.notes}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center mt-8">
                    <button
                      onClick={downloadPDF}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Scarica PDF
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                Automatizza la fatturazione
              </h3>
              <p className="text-white/80 mb-6">
                Con Fabbricami ERP generi fatture automaticamente dagli ordini,
                con invio diretto al Sistema di Interscambio (SDI).
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Prova Gratis 14 Giorni
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
