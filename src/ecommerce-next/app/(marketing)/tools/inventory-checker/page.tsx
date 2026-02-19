'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  Upload,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  Download,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

interface InventoryItem {
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  salesPerMonth: number;
}

interface AnalysisResults {
  totalProducts: number;
  lowStock: InventoryItem[];
  deadStock: InventoryItem[];
  reorderSuggestions: { item: InventoryItem; suggestedQty: number; daysUntilStockout: number }[];
  healthScore: number;
}

export default function InventoryCheckerPage() {
  const [items, setItems] = useState<InventoryItem[]>([
    { sku: 'SKU-001', name: 'Prodotto Esempio 1', stock: 5, minStock: 10, salesPerMonth: 30 },
    { sku: 'SKU-002', name: 'Prodotto Esempio 2', stock: 100, minStock: 20, salesPerMonth: 0 },
    { sku: 'SKU-003', name: 'Prodotto Esempio 3', stock: 15, minStock: 10, salesPerMonth: 45 },
  ]);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      {
        sku: `SKU-${String(items.length + 1).padStart(3, '0')}`,
        name: '',
        stock: 0,
        minStock: 10,
        salesPerMonth: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InventoryItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      const parsedItems: InventoryItem[] = dataLines.map((line) => {
        const [sku, name, stock, minStock, salesPerMonth] = line.split(',').map((s) => s.trim());
        return {
          sku: sku || 'SKU-XXX',
          name: name || 'Prodotto',
          stock: parseInt(stock) || 0,
          minStock: parseInt(minStock) || 10,
          salesPerMonth: parseInt(salesPerMonth) || 0,
        };
      });

      setItems(parsedItems);
    };
    reader.readAsText(file);
  };

  const analyzeInventory = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      const lowStock = items.filter((item) => item.stock <= item.minStock && item.stock > 0);
      const deadStock = items.filter(
        (item) => item.stock > 0 && item.salesPerMonth === 0
      );

      const reorderSuggestions = items
        .filter((item) => item.salesPerMonth > 0)
        .map((item) => {
          const daysUntilStockout = item.salesPerMonth > 0
            ? (item.stock / (item.salesPerMonth / 30))
            : 999;
          const suggestedQty = Math.ceil(item.salesPerMonth * 2); // 2 mesi di scorta

          return {
            item,
            suggestedQty,
            daysUntilStockout: Math.round(daysUntilStockout),
          };
        })
        .filter((r) => r.daysUntilStockout <= 30)
        .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

      // Health score: 100 - (% prodotti problematici)
      const problemProducts = lowStock.length + deadStock.length;
      const healthScore = Math.max(0, Math.round(100 - (problemProducts / items.length) * 100));

      setResults({
        totalProducts: items.length,
        lowStock,
        deadStock,
        reorderSuggestions,
        healthScore,
      });

      setIsAnalyzing(false);
    }, 1000);
  };

  const downloadReport = () => {
    if (!results) return;

    let report = 'REPORT ANALISI INVENTARIO\n';
    report += '=========================\n\n';
    report += `Data: ${new Date().toLocaleDateString('it-IT')}\n`;
    report += `Prodotti analizzati: ${results.totalProducts}\n`;
    report += `Health Score: ${results.healthScore}%\n\n`;

    report += 'PRODOTTI SOTTO SCORTA:\n';
    results.lowStock.forEach((item) => {
      report += `- ${item.sku}: ${item.name} (Stock: ${item.stock}, Min: ${item.minStock})\n`;
    });

    report += '\nDEAD STOCK (90+ giorni senza vendite):\n';
    results.deadStock.forEach((item) => {
      report += `- ${item.sku}: ${item.name} (Stock: ${item.stock})\n`;
    });

    report += '\nSUGGERIMENTI RIORDINO:\n';
    results.reorderSuggestions.forEach((r) => {
      report += `- ${r.item.sku}: Riordina ${r.suggestedQty} unita (stockout in ${r.daysUntilStockout} giorni)\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-gradient-to-b from-green-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6">
              <Package className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Checker Inventario
            </h1>
            <p className="text-lg text-gray-600">
              Carica il tuo inventario e ottieni un'analisi completa: prodotti sotto scorta,
              dead stock e suggerimenti di riordino.
            </p>
          </div>
        </div>
      </section>

      {/* Checker */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900">I tuoi prodotti</h2>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Carica CSV</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={addItem}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Aggiungi</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">SKU</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Nome Prodotto</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Stock</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Min. Stock</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Vendite/mese</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => updateItem(index, 'sku', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                            placeholder="Nome prodotto"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={item.stock}
                            onChange={(e) => updateItem(index, 'stock', parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={item.minStock}
                            onChange={(e) => updateItem(index, 'minStock', parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={item.salesPerMonth}
                            onChange={(e) => updateItem(index, 'salesPerMonth', parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Formato CSV: SKU, Nome, Stock, Min Stock, Vendite/mese (con header)
              </p>

              {/* Analyze Button */}
              <button
                onClick={analyzeInventory}
                disabled={items.length === 0 || isAnalyzing}
                className="mt-6 w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? 'Analizzando...' : 'Analizza Inventario'}
              </button>
            </div>

            {/* Results */}
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Health Score */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Risultati Analisi</h2>
                    <button
                      onClick={downloadReport}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Scarica Report</span>
                    </button>
                  </div>

                  <div className="grid md:grid-cols-4 gap-6">
                    {/* Health Score */}
                    <div className="text-center">
                      <div
                        className={`text-5xl font-bold mb-2 ${
                          results.healthScore >= 80
                            ? 'text-green-600'
                            : results.healthScore >= 50
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {results.healthScore}%
                      </div>
                      <div className="text-gray-600">Health Score</div>
                    </div>

                    {/* Total Products */}
                    <div className="text-center">
                      <div className="text-5xl font-bold text-gray-900 mb-2">
                        {results.totalProducts}
                      </div>
                      <div className="text-gray-600">Prodotti</div>
                    </div>

                    {/* Low Stock */}
                    <div className="text-center">
                      <div className="text-5xl font-bold text-orange-600 mb-2">
                        {results.lowStock.length}
                      </div>
                      <div className="text-gray-600">Sotto Scorta</div>
                    </div>

                    {/* Dead Stock */}
                    <div className="text-center">
                      <div className="text-5xl font-bold text-red-600 mb-2">
                        {results.deadStock.length}
                      </div>
                      <div className="text-gray-600">Dead Stock</div>
                    </div>
                  </div>
                </div>

                {/* Low Stock Alert */}
                {results.lowStock.length > 0 && (
                  <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">
                        Prodotti Sotto Scorta ({results.lowStock.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {results.lowStock.map((item) => (
                        <div
                          key={item.sku}
                          className="flex items-center justify-between py-2 px-4 bg-white rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{item.sku}</span>
                            <span className="text-gray-500 mx-2">-</span>
                            <span className="text-gray-700">{item.name}</span>
                          </div>
                          <div className="text-orange-600 font-medium">
                            Stock: {item.stock} / Min: {item.minStock}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dead Stock Alert */}
                {results.deadStock.length > 0 && (
                  <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
                    <div className="flex items-center gap-3 mb-4">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                      <h3 className="text-lg font-semibold text-red-800">
                        Dead Stock ({results.deadStock.length})
                      </h3>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                      Prodotti con stock ma senza vendite. Considera promozioni o liquidazione.
                    </p>
                    <div className="space-y-2">
                      {results.deadStock.map((item) => (
                        <div
                          key={item.sku}
                          className="flex items-center justify-between py-2 px-4 bg-white rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{item.sku}</span>
                            <span className="text-gray-500 mx-2">-</span>
                            <span className="text-gray-700">{item.name}</span>
                          </div>
                          <div className="text-red-600 font-medium">
                            {item.stock} unita ferme
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reorder Suggestions */}
                {results.reorderSuggestions.length > 0 && (
                  <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-4">
                      <ShoppingCart className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-800">
                        Suggerimenti Riordino
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {results.reorderSuggestions.map((r) => (
                        <div
                          key={r.item.sku}
                          className="flex items-center justify-between py-2 px-4 bg-white rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{r.item.sku}</span>
                            <span className="text-gray-500 mx-2">-</span>
                            <span className="text-gray-700">{r.item.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-600 font-medium">
                              Riordina {r.suggestedQty} unita
                            </div>
                            <div className="text-xs text-gray-500">
                              Stockout in {r.daysUntilStockout} giorni
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-center">
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Automatizza tutto questo
                  </h3>
                  <p className="text-white/80 mb-6">
                    Con Fabbricami ERP ottieni alert automatici, previsioni di riordino
                    e sincronizzazione in tempo reale con il tuo e-commerce.
                  </p>
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-white text-green-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Prova Gratis 14 Giorni
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
