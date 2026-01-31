import { prisma } from '../config/database';
import { logger } from '../config/logger';
import reportsService from '../services/reports.service';
import exportService from '../services/export.service';
import emailService from '../services/email.service';

/**
 * Scheduled Reports Job
 * Genera e invia report periodici via email
 */

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  format: 'pdf' | 'csv' | 'excel';
  recipients: string[];
  parameters?: Record<string, any>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

// Report disponibili
const AVAILABLE_REPORTS: Record<string, {
  name: string;
  generator: (params: any) => Promise<{ content: Buffer | string; filename: string; mimeType: string }>;
}> = {
  'sales-summary': {
    name: 'Riepilogo Vendite',
    generator: async (params) => {
      const from = params.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = params.to || new Date();
      const profitLoss = await reportsService.getProfitLossReport({ from, to });
      const pdf = await exportService.generateProfitLossReportPdf(profitLoss);
      return { content: pdf, filename: 'riepilogo-vendite.pdf', mimeType: 'application/pdf' };
    },
  },
  'dead-stock': {
    name: 'Dead Stock',
    generator: async (params) => {
      const result = await reportsService.getDeadStockAnalysis(params.daysThreshold || 90);
      const pdf = await exportService.generateDeadStockReportPdf(result);
      return { content: pdf, filename: 'dead-stock.pdf', mimeType: 'application/pdf' };
    },
  },
  'aging-receivables': {
    name: 'Scadenzario Crediti',
    generator: async () => {
      const result = await reportsService.getAgingReport('receivables');
      const pdf = await exportService.generateAgingReportPdf('receivables', result);
      return { content: pdf, filename: 'scadenzario-crediti.pdf', mimeType: 'application/pdf' };
    },
  },
  'aging-payables': {
    name: 'Scadenzario Debiti',
    generator: async () => {
      const result = await reportsService.getAgingReport('payables');
      const pdf = await exportService.generateAgingReportPdf('payables', result);
      return { content: pdf, filename: 'scadenzario-debiti.pdf', mimeType: 'application/pdf' };
    },
  },
  'cashflow-forecast': {
    name: 'Previsione Cashflow',
    generator: async (params) => {
      const result = await reportsService.getCashflowForecast(params.days || 90);
      const pdf = await exportService.generateCashflowForecastPdf(result);
      return { content: pdf, filename: 'previsione-cashflow.pdf', mimeType: 'application/pdf' };
    },
  },
  'rfm-analysis': {
    name: 'Analisi RFM Clienti',
    generator: async (params) => {
      const from = params.from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const to = params.to || new Date();
      const result = await reportsService.getRFMAnalysis({ from, to });
      const pdf = await exportService.generateRFMReportPdf({ ...result, dateRange: { from, to } });
      return { content: pdf, filename: 'analisi-rfm.pdf', mimeType: 'application/pdf' };
    },
  },
  'inventory-csv': {
    name: 'Export Inventario',
    generator: async () => {
      const csv = await exportService.generateInventoryCsv();
      return { content: Buffer.from(csv, 'utf-8'), filename: 'inventario.csv', mimeType: 'text/csv' };
    },
  },
  'orders-csv': {
    name: 'Export Ordini',
    generator: async (params) => {
      const from = params.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = params.to || new Date();
      const csv = await exportService.generateOrdersCsv(from, to);
      return { content: Buffer.from(csv, 'utf-8'), filename: 'ordini.csv', mimeType: 'text/csv' };
    },
  },
};

/**
 * Esegue un singolo report e lo invia via email
 */
async function executeScheduledReport(report: ScheduledReport): Promise<void> {
  logger.info(`Executing scheduled report: ${report.name} (${report.reportType})`);

  const reportConfig = AVAILABLE_REPORTS[report.reportType];
  if (!reportConfig) {
    logger.error(`Report type not found: ${report.reportType}`);
    return;
  }

  try {
    // Genera il report
    const { content, filename, mimeType } = await reportConfig.generator(report.parameters || {});

    // Prepara le date per il periodo
    const periodLabel = report.frequency === 'DAILY'
      ? new Date().toLocaleDateString('it-IT')
      : report.frequency === 'WEEKLY'
        ? `Settimana ${getWeekNumber(new Date())}`
        : new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    // Invia email a tutti i destinatari
    for (const recipient of report.recipients) {
      try {
        await emailService.send({
          to: recipient,
          subject: `[FabbricaMi] ${reportConfig.name} - ${periodLabel}`,
          html: `
            <h2>${reportConfig.name}</h2>
            <p>In allegato il report <strong>${reportConfig.name}</strong> relativo al periodo: ${periodLabel}</p>
            <p>Report generato automaticamente da FabbricaMi ERP.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
              Questo è un report automatico. Per modificare le impostazioni di invio,
              accedi alla sezione Report Schedulati nel pannello di amministrazione.
            </p>
          `,
          attachments: [
            {
              filename,
              content: typeof content === 'string' ? Buffer.from(content) : content,
              contentType: mimeType,
            },
          ],
        });
        logger.info(`Report sent to ${recipient}`);
      } catch (emailError) {
        logger.error(`Failed to send report to ${recipient}:`, emailError);
      }
    }

    // Aggiorna lastRun
    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: {
        lastRun: new Date(),
        nextRun: calculateNextRun(report.frequency),
      },
    });

    logger.info(`Scheduled report ${report.name} completed successfully`);
  } catch (error) {
    logger.error(`Error executing scheduled report ${report.name}:`, error);
    throw error;
  }
}

/**
 * Calcola la prossima esecuzione
 */
function calculateNextRun(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Date {
  const next = new Date();

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0); // 08:00
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + (7 - next.getDay()) + 1); // Prossimo Lunedì
      next.setHours(9, 0, 0, 0); // 09:00
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(9, 0, 0, 0); // Primo del mese alle 09:00
      break;
  }

  return next;
}

/**
 * Ottiene il numero della settimana
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Job principale per processare i report schedulati
 * Da eseguire ogni ora tramite cron o BullMQ
 */
export async function processScheduledReports(): Promise<void> {
  logger.info('Processing scheduled reports...');

  try {
    // Trova report da eseguire
    const now = new Date();
    const dueReports = await prisma.scheduledReport.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRun: null },
          { nextRun: { lte: now } },
        ],
      },
    });

    logger.info(`Found ${dueReports.length} reports to execute`);

    for (const report of dueReports) {
      try {
        await executeScheduledReport(report as unknown as ScheduledReport);
      } catch (error) {
        logger.error(`Failed to execute report ${report.id}:`, error);
      }
    }

    logger.info('Scheduled reports processing completed');
  } catch (error) {
    logger.error('Error processing scheduled reports:', error);
    throw error;
  }
}

/**
 * Job per report giornaliero automatico (KPI)
 * Invia un digest giornaliero con KPI principali
 */
export async function sendDailyDigest(recipients: string[]): Promise<void> {
  logger.info('Sending daily digest...');

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Raccogli KPI
    const [profitLoss, churn, deadStock, agingReceivables] = await Promise.all([
      reportsService.getProfitLossReport({ from: yesterday, to: today }),
      reportsService.getChurnAnalysis({ from: yesterday, to: today }, 90),
      reportsService.getDeadStockAnalysis(90),
      reportsService.getAgingReport('receivables'),
    ]);

    const overdueAmount = agingReceivables.summary.days30 +
      agingReceivables.summary.days60 +
      agingReceivables.summary.days90 +
      agingReceivables.summary.over90;

    // Componi email digest
    const html = `
      <h2>📊 Report Giornaliero - ${today.toLocaleDateString('it-IT')}</h2>

      <h3>💰 Vendite Ieri</h3>
      <ul>
        <li><strong>Fatturato:</strong> €${profitLoss.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
        <li><strong>Margine:</strong> ${profitLoss.grossMargin.toFixed(1)}%</li>
        <li><strong>Profitto lordo:</strong> €${profitLoss.grossProfit.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
      </ul>

      <h3>👥 Clienti</h3>
      <ul>
        <li><strong>Attivi:</strong> ${churn.activeCustomers}</li>
        <li><strong>A rischio:</strong> ${churn.atRiskCustomers}</li>
        <li><strong>Tasso churn:</strong> ${churn.churnRate.toFixed(1)}%</li>
      </ul>

      <h3>📦 Magazzino</h3>
      <ul>
        <li><strong>Dead stock:</strong> ${deadStock.totalItems} prodotti</li>
        <li><strong>Valore bloccato:</strong> €${deadStock.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
      </ul>

      <h3>💳 Crediti</h3>
      <ul>
        <li><strong>Totale scaduto:</strong> €${overdueAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
        <li><strong>Oltre 90 giorni:</strong> €${agingReceivables.summary.over90.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</li>
      </ul>

      <hr>
      <p style="font-size: 12px; color: #666;">
        Report generato automaticamente da FabbricaMi ERP alle ${today.toLocaleTimeString('it-IT')}
      </p>
    `;

    for (const recipient of recipients) {
      try {
        await emailService.send({
          to: recipient,
          subject: `[FabbricaMi] 📊 Daily Digest - ${today.toLocaleDateString('it-IT')}`,
          html,
        });
        logger.info(`Daily digest sent to ${recipient}`);
      } catch (error) {
        logger.error(`Failed to send daily digest to ${recipient}:`, error);
      }
    }

    logger.info('Daily digest completed');
  } catch (error) {
    logger.error('Error sending daily digest:', error);
    throw error;
  }
}

/**
 * Job per report settimanale automatico
 */
export async function sendWeeklyDigest(recipients: string[]): Promise<void> {
  logger.info('Sending weekly digest...');

  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Raccogli dati settimanali
    const [profitLoss, categories] = await Promise.all([
      reportsService.getProfitLossReport({ from: weekAgo, to: today }),
      reportsService.getCategoryPerformance({ from: weekAgo, to: today }),
    ]);

    // Top 5 categorie
    const topCategories = categories.slice(0, 5);

    const html = `
      <h2>📊 Report Settimanale - Settimana ${getWeekNumber(today)}</h2>
      <p>Periodo: ${weekAgo.toLocaleDateString('it-IT')} - ${today.toLocaleDateString('it-IT')}</p>

      <h3>💰 Riepilogo Vendite</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr><td><strong>Fatturato</strong></td><td>€${profitLoss.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td><strong>Costo venduto</strong></td><td>€${profitLoss.costOfGoodsSold.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td><strong>Margine lordo</strong></td><td>€${profitLoss.grossProfit.toLocaleString('it-IT', { minimumFractionDigits: 2 })} (${profitLoss.grossMargin.toFixed(1)}%)</td></tr>
        <tr><td><strong>Risultato operativo</strong></td><td>€${profitLoss.operatingIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })} (${profitLoss.operatingMargin.toFixed(1)}%)</td></tr>
      </table>

      <h3>📂 Top 5 Categorie</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr><th>Categoria</th><th>Fatturato</th><th>Margine</th><th>Unità</th></tr>
        ${topCategories.map(c => `
          <tr>
            <td>${c.category}</td>
            <td>€${c.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
            <td>${c.grossMargin.toFixed(1)}%</td>
            <td>${c.unitsSold}</td>
          </tr>
        `).join('')}
      </table>

      <hr>
      <p style="font-size: 12px; color: #666;">
        Report generato automaticamente da FabbricaMi ERP
      </p>
    `;

    for (const recipient of recipients) {
      try {
        await emailService.send({
          to: recipient,
          subject: `[FabbricaMi] 📊 Weekly Digest - Settimana ${getWeekNumber(today)}`,
          html,
        });
        logger.info(`Weekly digest sent to ${recipient}`);
      } catch (error) {
        logger.error(`Failed to send weekly digest to ${recipient}:`, error);
      }
    }

    logger.info('Weekly digest completed');
  } catch (error) {
    logger.error('Error sending weekly digest:', error);
    throw error;
  }
}

// Export per uso con BullMQ
export default {
  processScheduledReports,
  sendDailyDigest,
  sendWeeklyDigest,
  executeScheduledReport,
  AVAILABLE_REPORTS,
};
