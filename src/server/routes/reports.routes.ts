// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../utils/response.util';
import reportsService from '../services/reports.service';
import exportService from '../services/export.service';

// Types/Interfaces

// Constants

/**
 * Reports Routes
 * Endpoints API per reportistica avanzata
 */
const reportsRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // SALES REPORTS
  // ============================================

  /**
   * GET /api/v1/reports/sales/rfm
   * Analisi RFM clienti
   */
  server.get(
    '/sales/rfm',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi RFM (Recency-Frequency-Monetary) clienti',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv' | 'pdf';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getRFMAnalysis({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.segments, [
            { key: 'customerName', header: 'Cliente' },
            { key: 'customerType', header: 'Tipo' },
            { key: 'rfmScore', header: 'Score RFM' },
            { key: 'segment', header: 'Segmento' },
            { key: 'recencyDays', header: 'Recency (gg)' },
            { key: 'frequency', header: 'Frequenza' },
            { key: 'monetary', header: 'Valore', formatter: (v) => `€${v.toFixed(2)}` },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="rfm-analysis.csv"');
          return reply.send(csv);
        }

        if (format === 'pdf') {
          const pdf = await exportService.generateRFMReportPdf({
            ...result,
            dateRange: { from, to },
          });
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="rfm-analysis.pdf"');
          return reply.send(pdf);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/sales/retention
   * Analisi retention clienti (cohort)
   */
  server.get(
    '/sales/retention',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi retention clienti per coorte',
      },
    },
    async (request, reply) => {
      try {
        const { year } = request.query as { year?: string };
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

        const result = await reportsService.getCustomerRetention(targetYear);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/sales/categories
   * Performance per categoria prodotto
   */
  server.get(
    '/sales/categories',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports'],
        description: 'Performance vendite per categoria',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getCategoryPerformance({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result, [
            { key: 'category', header: 'Categoria' },
            { key: 'totalRevenue', header: 'Fatturato', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'grossProfit', header: 'Profitto', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'grossMargin', header: 'Margine %', formatter: (v) => `${v.toFixed(1)}%` },
            { key: 'unitsSold', header: 'Unità Vendute' },
            { key: 'ordersCount', header: 'N. Ordini' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="category-performance.csv"');
          return reply.send(csv);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/sales/churn
   * Analisi churn clienti
   */
  server.get(
    '/sales/churn',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi churn (clienti persi)',
      },
    },
    async (request, reply) => {
      try {
        const { dateTo, inactiveDays } = request.query as {
          dateTo?: string;
          inactiveDays?: string;
        };

        const to = dateTo ? new Date(dateTo) : new Date();
        const from = new Date(to);
        from.setFullYear(from.getFullYear() - 1);

        const result = await reportsService.getChurnAnalysis(
          { from, to },
          inactiveDays ? parseInt(inactiveDays, 10) : 90
        );

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ============================================
  // WAREHOUSE REPORTS
  // ============================================

  /**
   * GET /api/v1/reports/warehouse/rotation
   * Analisi rotazione stock
   */
  server.get(
    '/warehouse/rotation',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi rotazione stock (turnover)',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getStockRotationAnalysis({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.items, [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Prodotto' },
            { key: 'category', header: 'Categoria' },
            { key: 'avgStock', header: 'Stock Medio' },
            { key: 'soldQuantity', header: 'Venduto' },
            { key: 'turnoverRate', header: 'Rotazione', formatter: (v) => v.toFixed(2) },
            { key: 'daysOfStock', header: 'Gg di Stock' },
            { key: 'classification', header: 'Classificazione' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="stock-rotation.csv"');
          return reply.send(csv);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/warehouse/dead-stock
   * Analisi dead stock
   */
  server.get(
    '/warehouse/dead-stock',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi prodotti senza vendite (dead stock)',
      },
    },
    async (request, reply) => {
      try {
        const { daysThreshold, format } = request.query as {
          daysThreshold?: string;
          format?: 'json' | 'csv' | 'pdf';
        };

        const threshold = daysThreshold ? parseInt(daysThreshold, 10) : 90;
        const result = await reportsService.getDeadStockAnalysis(threshold);

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.items, [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Prodotto' },
            { key: 'category', header: 'Categoria' },
            { key: 'currentStock', header: 'Stock' },
            { key: 'daysSinceLastSale', header: 'Gg Ultima Vendita' },
            { key: 'stockValue', header: 'Valore', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'recommendation', header: 'Raccomandazione' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="dead-stock.csv"');
          return reply.send(csv);
        }

        if (format === 'pdf') {
          const pdf = await exportService.generateDeadStockReportPdf(result);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="dead-stock.pdf"');
          return reply.send(pdf);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/warehouse/stockouts
   * Analisi stockout
   */
  server.get(
    '/warehouse/stockouts',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Reports'],
        description: 'Analisi eventi di stockout',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo } = request.query as {
          dateFrom?: string;
          dateTo?: string;
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getStockoutAnalysis({ from, to });
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ============================================
  // PRODUCTION REPORTS
  // ============================================

  /**
   * GET /api/v1/reports/production/efficiency
   * Report efficienza produzione
   */
  server.get(
    '/production/efficiency',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Reports'],
        description: 'Report efficienza produzione',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getProductionEfficiencyReport({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.orders, [
            { key: 'orderNumber', header: 'N. Ordine' },
            { key: 'productName', header: 'Prodotto' },
            { key: 'plannedQty', header: 'Qtà Pianificata' },
            { key: 'completedQty', header: 'Qtà Completata' },
            { key: 'defectQty', header: 'Difetti' },
            { key: 'yieldRate', header: 'Resa %', formatter: (v) => `${v.toFixed(1)}%` },
            { key: 'efficiency', header: 'Efficienza %', formatter: (v) => `${v.toFixed(1)}%` },
            { key: 'status', header: 'Stato' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="production-efficiency.csv"');
          return reply.send(csv);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/production/delays
   * Report ritardi produzione
   */
  server.get(
    '/production/delays',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Reports'],
        description: 'Report ritardi produzione',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo } = request.query as {
          dateFrom?: string;
          dateTo?: string;
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getProductionDelaysReport({ from, to });
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/production/costs
   * Report costi produzione
   */
  server.get(
    '/production/costs',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports'],
        description: 'Report costi di produzione per unità',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getProductionCostsReport({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.products, [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Prodotto' },
            { key: 'totalProduced', header: 'Prodotto' },
            { key: 'materialCost', header: 'Costo Materiali', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'laborCost', header: 'Costo Manodopera', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'totalCost', header: 'Costo Totale', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'costPerUnit', header: 'Costo/Unità', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'marginPercent', header: 'Margine %', formatter: (v) => `${v.toFixed(1)}%` },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="production-costs.csv"');
          return reply.send(csv);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ============================================
  // FINANCIAL REPORTS
  // ============================================

  /**
   * GET /api/v1/reports/financial/cashflow
   * Previsione cashflow
   */
  server.get(
    '/financial/cashflow',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports'],
        description: 'Previsione cashflow (30/60/90 giorni)',
      },
    },
    async (request, reply) => {
      try {
        const { days, format } = request.query as {
          days?: string;
          format?: 'json' | 'pdf';
        };

        const forecastDays = days ? parseInt(days, 10) : 90;
        const result = await reportsService.getCashflowForecast(forecastDays);

        if (format === 'pdf') {
          const pdf = await exportService.generateCashflowForecastPdf(result);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="cashflow-forecast.pdf"');
          return reply.send(pdf);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/financial/dso-dpo
   * Report DSO/DPO
   */
  server.get(
    '/financial/dso-dpo',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports'],
        description: 'Days Sales Outstanding / Days Payable Outstanding',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo } = request.query as {
          dateFrom?: string;
          dateTo?: string;
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getDSODPOReport({ from, to });
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/financial/profit-loss
   * Conto economico
   */
  server.get(
    '/financial/profit-loss',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports'],
        description: 'Conto economico (P&L)',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'pdf';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getProfitLossReport({ from, to });

        if (format === 'pdf') {
          const pdf = await exportService.generateProfitLossReportPdf(result);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="profit-loss.pdf"');
          return reply.send(pdf);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/financial/aging
   * Scadenzario crediti/debiti
   */
  server.get(
    '/financial/aging/:type',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports'],
        description: 'Scadenzario (aging) crediti o debiti',
      },
    },
    async (request, reply) => {
      try {
        const { type } = request.params as { type: 'receivables' | 'payables' };
        const { format } = request.query as { format?: 'json' | 'csv' | 'pdf' };

        if (type !== 'receivables' && type !== 'payables') {
          return errorResponse(reply, 'Tipo non valido. Usa receivables o payables', 400);
        }

        const result = await reportsService.getAgingReport(type);

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.details, [
            { key: 'entityName', header: type === 'receivables' ? 'Cliente' : 'Fornitore' },
            { key: 'invoiceNumber', header: 'Fattura' },
            { key: 'dueDate', header: 'Scadenza', formatter: (v) => v.toLocaleDateString('it-IT') },
            { key: 'outstanding', header: 'Importo', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'daysOverdue', header: 'Gg Scaduti' },
            { key: 'bucket', header: 'Fascia' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', `attachment; filename="aging-${type}.csv"`);
          return reply.send(csv);
        }

        if (format === 'pdf') {
          const pdf = await exportService.generateAgingReportPdf(type, result);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `attachment; filename="aging-${type}.pdf"`);
          return reply.send(pdf);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/financial/customer-profitability
   * Profittabilità per cliente
   */
  server.get(
    '/financial/customer-profitability',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE', 'COMMERCIALE')],
      schema: {
        tags: ['Reports'],
        description: 'Profittabilità per cliente',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, format } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          format?: 'json' | 'csv';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
        const to = dateTo ? new Date(dateTo) : new Date();

        const result = await reportsService.getCustomerProfitability({ from, to });

        if (format === 'csv') {
          const csv = exportService.generateReportCsv(result.customers, [
            { key: 'name', header: 'Cliente' },
            { key: 'type', header: 'Tipo' },
            { key: 'revenue', header: 'Fatturato', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'cost', header: 'Costi', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'profit', header: 'Profitto', formatter: (v) => `€${v.toFixed(2)}` },
            { key: 'margin', header: 'Margine %', formatter: (v) => `${v.toFixed(1)}%` },
            { key: 'ordersCount', header: 'N. Ordini' },
          ]);
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', 'attachment; filename="customer-profitability.csv"');
          return reply.send(csv);
        }

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ============================================
  // CSV EXPORTS
  // ============================================

  /**
   * GET /api/v1/reports/export/products/csv
   * Export prodotti CSV
   */
  server.get(
    '/export/products/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export prodotti in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const { category, isActive } = request.query as {
          category?: string;
          isActive?: string;
        };

        const csv = await exportService.generateProductsCsv({
          category,
          isActive: isActive !== undefined ? isActive === 'true' : undefined,
        });

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="products.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/export/orders/csv
   * Export ordini CSV
   */
  server.get(
    '/export/orders/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export ordini in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo } = request.query as {
          dateFrom?: string;
          dateTo?: string;
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();

        const csv = await exportService.generateOrdersCsv(from, to);

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="orders.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/export/inventory/csv
   * Export inventario CSV
   */
  server.get(
    '/export/inventory/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export inventario in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const csv = await exportService.generateInventoryCsv();

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="inventory.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/export/customers/csv
   * Export clienti CSV
   */
  server.get(
    '/export/customers/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export clienti in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const csv = await exportService.generateCustomersCsv();

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="customers.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/export/suppliers/csv
   * Export fornitori CSV
   */
  server.get(
    '/export/suppliers/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export fornitori in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const csv = await exportService.generateSuppliersCsv();

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="suppliers.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/reports/export/invoices/csv
   * Export fatture CSV
   */
  server.get(
    '/export/invoices/csv',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Reports - Export'],
        description: 'Export fatture in formato CSV',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo, type } = request.query as {
          dateFrom?: string;
          dateTo?: string;
          type?: 'receivable' | 'payable';
        };

        const from = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
        const to = dateTo ? new Date(dateTo) : new Date();

        const csv = await exportService.generateInvoicesCsv(from, to, type);

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="invoices.csv"');
        return reply.send(csv);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );
};

// Exports
export default reportsRoutes;
