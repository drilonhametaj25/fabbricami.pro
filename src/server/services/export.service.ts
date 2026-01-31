import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../config/database';

/**
 * Export Service
 * Generazione PDF e Excel per fatture, report e analisi
 */

interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  customer: {
    name: string;
    address?: string;
    taxId?: string;
    fiscalCode?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
}

interface ReportData {
  title: string;
  subtitle?: string;
  dateRange?: { from: Date; to: Date };
  columns: string[];
  rows: any[][];
  totals?: any[];
  summary?: Record<string, any>;
}

class ExportService {
  private companyName: string;
  private companyAddress: string;
  private companyTaxId: string;
  private companyPhone: string;
  private companyEmail: string;

  constructor() {
    this.companyName = process.env.COMPANY_NAME || 'EcommerceERP';
    this.companyAddress = process.env.COMPANY_ADDRESS || 'Via Example 123, 00100 Roma';
    this.companyTaxId = process.env.COMPANY_TAX_ID || 'IT12345678901';
    this.companyPhone = process.env.COMPANY_PHONE || '+39 06 1234567';
    this.companyEmail = process.env.COMPANY_EMAIL || 'info@ecommerceerp.com';
  }

  // =============================================
  // PDF GENERATION
  // =============================================

  /**
   * Genera PDF fattura
   */
  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Fattura non trovata');
    }

    const data: InvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      customer: {
        name: invoice.customer?.businessName || `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim(),
        address: this.formatAddress(invoice.customer?.address as any),
        taxId: invoice.customer?.taxId || undefined,
        fiscalCode: invoice.customer?.fiscalCode || undefined,
      },
      items: invoice.order?.items.map(item => ({
        description: item.productName || item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxRate: 22, // IVA standard
        total: Number(item.total),
      })) || [],
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      notes: invoice.notes || undefined,
    };

    return this.createInvoicePdf(data);
  }

  /**
   * Crea PDF fattura da dati
   */
  private createInvoicePdf(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(this.companyName, 50, 50, { align: 'left' });
      doc.fontSize(10).text(this.companyAddress, 50, 75);
      doc.text(`P.IVA: ${this.companyTaxId}`, 50, 90);
      doc.text(`Tel: ${this.companyPhone} | Email: ${this.companyEmail}`, 50, 105);

      // Fattura info
      doc.fontSize(18).text('FATTURA', 400, 50, { align: 'right' });
      doc.fontSize(11).text(`N. ${data.invoiceNumber}`, 400, 75, { align: 'right' });
      doc.text(`Data: ${data.issueDate.toLocaleDateString('it-IT')}`, 400, 90, { align: 'right' });
      doc.text(`Scadenza: ${data.dueDate.toLocaleDateString('it-IT')}`, 400, 105, { align: 'right' });

      // Linea separatore
      doc.moveTo(50, 130).lineTo(545, 130).stroke();

      // Cliente
      doc.fontSize(11).font('Helvetica-Bold').text('DESTINATARIO:', 50, 150);
      doc.font('Helvetica').text(data.customer.name, 50, 165);
      if (data.customer.address) {
        doc.text(data.customer.address, 50, 180);
      }
      if (data.customer.taxId) {
        doc.text(`P.IVA: ${data.customer.taxId}`, 50, 195);
      }
      if (data.customer.fiscalCode) {
        doc.text(`C.F.: ${data.customer.fiscalCode}`, 50, 210);
      }

      // Tabella articoli
      const tableTop = 250;
      const tableHeaders = ['Descrizione', 'Qtà', 'Prezzo', 'IVA %', 'Totale'];
      const colWidths = [220, 50, 80, 60, 85];

      // Header tabella
      doc.font('Helvetica-Bold').fontSize(10);
      let xPos = 50;
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        xPos += colWidths[i];
      });

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // Righe articoli
      doc.font('Helvetica').fontSize(10);
      let yPos = tableTop + 25;
      data.items.forEach((item) => {
        xPos = 50;
        doc.text(item.description.substring(0, 40), xPos, yPos, { width: colWidths[0] });
        xPos += colWidths[0];
        doc.text(item.quantity.toString(), xPos, yPos, { width: colWidths[1], align: 'right' });
        xPos += colWidths[1];
        doc.text(`€${item.unitPrice.toFixed(2)}`, xPos, yPos, { width: colWidths[2], align: 'right' });
        xPos += colWidths[2];
        doc.text(`${item.taxRate}%`, xPos, yPos, { width: colWidths[3], align: 'right' });
        xPos += colWidths[3];
        doc.text(`€${item.total.toFixed(2)}`, xPos, yPos, { width: colWidths[4], align: 'right' });
        yPos += 20;
      });

      // Linea fine tabella
      doc.moveTo(50, yPos + 5).lineTo(545, yPos + 5).stroke();

      // Totali
      yPos += 20;
      doc.font('Helvetica').fontSize(11);
      doc.text('Imponibile:', 380, yPos);
      doc.text(`€${data.subtotal.toFixed(2)}`, 480, yPos, { align: 'right' });
      yPos += 18;
      doc.text('IVA:', 380, yPos);
      doc.text(`€${data.tax.toFixed(2)}`, 480, yPos, { align: 'right' });
      yPos += 18;
      doc.font('Helvetica-Bold').fontSize(13);
      doc.text('TOTALE:', 380, yPos);
      doc.text(`€${data.total.toFixed(2)}`, 480, yPos, { align: 'right' });

      // Note
      if (data.notes) {
        yPos += 40;
        doc.font('Helvetica').fontSize(10);
        doc.text('Note:', 50, yPos);
        doc.text(data.notes, 50, yPos + 15, { width: 495 });
      }

      // Footer
      doc.fontSize(8).text(
        'Documento generato automaticamente da EcommerceERP',
        50,
        780,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Genera PDF report generico
   */
  async generateReportPdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).text(data.title, { align: 'center' });
      if (data.subtitle) {
        doc.fontSize(12).text(data.subtitle, { align: 'center' });
      }
      if (data.dateRange) {
        doc.fontSize(10).text(
          `Periodo: ${data.dateRange.from.toLocaleDateString('it-IT')} - ${data.dateRange.to.toLocaleDateString('it-IT')}`,
          { align: 'center' }
        );
      }

      doc.moveDown(2);

      // Tabella
      const pageWidth = 760;
      const colWidth = pageWidth / data.columns.length;
      let yPos = doc.y;

      // Header tabella
      doc.font('Helvetica-Bold').fontSize(9);
      data.columns.forEach((col, i) => {
        doc.text(col, 40 + i * colWidth, yPos, { width: colWidth - 5, align: 'left' });
      });
      yPos += 20;
      doc.moveTo(40, yPos).lineTo(800, yPos).stroke();
      yPos += 10;

      // Righe
      doc.font('Helvetica').fontSize(8);
      data.rows.forEach((row) => {
        if (yPos > 520) {
          doc.addPage();
          yPos = 40;
        }
        row.forEach((cell, i) => {
          const text = cell?.toString() || '';
          doc.text(text.substring(0, 30), 40 + i * colWidth, yPos, { width: colWidth - 5, align: 'left' });
        });
        yPos += 15;
      });

      // Totali
      if (data.totals) {
        yPos += 10;
        doc.moveTo(40, yPos).lineTo(800, yPos).stroke();
        yPos += 10;
        doc.font('Helvetica-Bold');
        data.totals.forEach((cell, i) => {
          const text = cell?.toString() || '';
          doc.text(text, 40 + i * colWidth, yPos, { width: colWidth - 5, align: 'left' });
        });
      }

      // Summary
      if (data.summary) {
        doc.addPage();
        doc.fontSize(14).text('Riepilogo', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica');
        Object.entries(data.summary).forEach(([key, value]) => {
          doc.text(`${key}: ${value}`);
        });
      }

      doc.end();
    });
  }

  /**
   * Genera PDF per report tabellare generico
   * Usato per tutti i report avanzati (RFM, rotazione stock, P&L, etc.)
   */
  async generateTableReportPdf(options: {
    title: string;
    subtitle?: string;
    dateRange?: { from: Date; to: Date };
    columns: { header: string; width: number; align?: 'left' | 'right' | 'center' }[];
    rows: (string | number)[][];
    summary?: { label: string; value: string | number }[];
    footer?: string;
    landscape?: boolean;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: options.landscape ? 'landscape' : 'portrait',
        margin: 40,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = options.landscape ? 800 : 515;
      let yPos = 40;

      // Header aziendale
      doc.fontSize(10).text(this.companyName, 40, yPos);
      doc.fontSize(8).text(this.companyAddress, 40, yPos + 12);

      // Titolo
      doc.fontSize(16).font('Helvetica-Bold').text(options.title, 40, yPos + 35, { align: 'center', width: pageWidth });
      yPos += 55;

      if (options.subtitle) {
        doc.fontSize(11).font('Helvetica').text(options.subtitle, 40, yPos, { align: 'center', width: pageWidth });
        yPos += 18;
      }

      if (options.dateRange) {
        doc.fontSize(9).text(
          `Periodo: ${options.dateRange.from.toLocaleDateString('it-IT')} - ${options.dateRange.to.toLocaleDateString('it-IT')}`,
          40, yPos, { align: 'center', width: pageWidth }
        );
        yPos += 15;
      }

      yPos += 20;

      // Tabella header
      doc.font('Helvetica-Bold').fontSize(8);
      let xPos = 40;
      const totalWidth = options.columns.reduce((sum, col) => sum + col.width, 0);
      const scale = Math.min(1, pageWidth / totalWidth);

      options.columns.forEach((col) => {
        const scaledWidth = col.width * scale;
        doc.text(col.header, xPos, yPos, {
          width: scaledWidth,
          align: col.align || 'left',
        });
        xPos += scaledWidth;
      });

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(40 + pageWidth, yPos).stroke();
      yPos += 8;

      // Tabella righe
      doc.font('Helvetica').fontSize(7);
      const maxY = options.landscape ? 520 : 750;

      for (const row of options.rows) {
        if (yPos > maxY) {
          doc.addPage();
          yPos = 40;
        }

        xPos = 40;
        row.forEach((cell, i) => {
          const col = options.columns[i];
          const scaledWidth = col.width * scale;
          const text = cell?.toString() || '';
          doc.text(text.substring(0, 50), xPos, yPos, {
            width: scaledWidth,
            align: col.align || 'left',
          });
          xPos += scaledWidth;
        });
        yPos += 12;
      }

      // Summary
      if (options.summary && options.summary.length > 0) {
        yPos += 15;
        doc.moveTo(40, yPos).lineTo(40 + pageWidth, yPos).stroke();
        yPos += 15;

        doc.font('Helvetica-Bold').fontSize(9);
        options.summary.forEach((item) => {
          doc.text(`${item.label}: ${item.value}`, 40, yPos);
          yPos += 14;
        });
      }

      // Footer
      if (options.footer) {
        doc.fontSize(7).font('Helvetica').text(options.footer, 40, maxY + 20, { align: 'center', width: pageWidth });
      }

      doc.fontSize(7).text(
        `Generato il ${new Date().toLocaleString('it-IT')} - ${this.companyName}`,
        40, maxY + 35, { align: 'center', width: pageWidth }
      );

      doc.end();
    });
  }

  /**
   * Genera PDF report RFM
   */
  async generateRFMReportPdf(data: {
    segments: any[];
    summary: Record<string, { count: number; totalRevenue: number; avgOrderValue: number }>;
    dateRange: { from: Date; to: Date };
  }): Promise<Buffer> {
    const rows = data.segments.slice(0, 100).map(s => [
      s.customerName.substring(0, 25),
      s.customerType,
      s.rfmScore,
      s.segment,
      s.recencyDays.toString(),
      s.frequency.toString(),
      `€${s.monetary.toFixed(2)}`,
    ]);

    const summary = Object.entries(data.summary).map(([segment, stats]) => ({
      label: `${segment} (${stats.count} clienti)`,
      value: `€${stats.totalRevenue.toFixed(2)} totale, €${stats.avgOrderValue.toFixed(2)} medio`,
    }));

    return this.generateTableReportPdf({
      title: 'Analisi RFM Clienti',
      subtitle: 'Segmentazione Recency-Frequency-Monetary',
      dateRange: data.dateRange,
      columns: [
        { header: 'Cliente', width: 120, align: 'left' },
        { header: 'Tipo', width: 50, align: 'center' },
        { header: 'RFM', width: 40, align: 'center' },
        { header: 'Segmento', width: 80, align: 'left' },
        { header: 'Recency', width: 50, align: 'right' },
        { header: 'Freq.', width: 40, align: 'right' },
        { header: 'Valore', width: 70, align: 'right' },
      ],
      rows,
      summary,
      landscape: true,
    });
  }

  /**
   * Genera PDF report P&L
   */
  async generateProfitLossReportPdf(data: {
    period: string;
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMargin: number;
    operatingExpenses: number;
    operatingIncome: number;
    operatingMargin: number;
    breakdown: {
      byCategory: Record<string, { revenue: number; cost: number; profit: number }>;
      byChannel: Record<string, { revenue: number; cost: number; profit: number }>;
    };
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Conto Economico', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(data.period, { align: 'center' });
      doc.moveDown(2);

      // Main P&L
      const addLine = (label: string, value: number, indent = 0, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
        doc.text(label, 50 + indent * 20, doc.y, { continued: true, width: 300 });
        doc.text(`€${value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, { align: 'right' });
      };

      addLine('Ricavi', data.revenue, 0, true);
      doc.moveDown(0.5);
      addLine('Costo del venduto', -data.costOfGoodsSold, 1);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      addLine('Margine Lordo', data.grossProfit, 0, true);
      doc.fontSize(9).text(`(${data.grossMargin.toFixed(1)}%)`, 400, doc.y - 12);
      doc.moveDown(1);

      addLine('Spese operative', -data.operatingExpenses, 1);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      addLine('Risultato Operativo', data.operatingIncome, 0, true);
      doc.fontSize(9).text(`(${data.operatingMargin.toFixed(1)}%)`, 400, doc.y - 12);

      doc.moveDown(2);

      // Breakdown per categoria
      doc.fontSize(14).font('Helvetica-Bold').text('Per Categoria');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');

      Object.entries(data.breakdown.byCategory).forEach(([cat, stats]) => {
        const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : '0';
        doc.text(`${cat}: €${stats.revenue.toFixed(2)} ricavi, €${stats.profit.toFixed(2)} profitto (${margin}%)`);
      });

      doc.moveDown(1);

      // Breakdown per canale
      doc.fontSize(14).font('Helvetica-Bold').text('Per Canale');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');

      Object.entries(data.breakdown.byChannel).forEach(([channel, stats]) => {
        const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : '0';
        doc.text(`${channel}: €${stats.revenue.toFixed(2)} ricavi, €${stats.profit.toFixed(2)} profitto (${margin}%)`);
      });

      // Footer
      doc.fontSize(8).text(
        `Generato il ${new Date().toLocaleString('it-IT')} - ${this.companyName}`,
        50, 780, { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Genera PDF report Aging (Scadenzario)
   */
  async generateAgingReportPdf(
    type: 'receivables' | 'payables',
    data: {
      summary: { current: number; days30: number; days60: number; days90: number; over90: number; total: number };
      details: any[];
    }
  ): Promise<Buffer> {
    const title = type === 'receivables' ? 'Scadenzario Crediti' : 'Scadenzario Debiti';

    const rows = data.details.slice(0, 100).map(d => [
      d.entityName.substring(0, 25),
      d.invoiceNumber,
      d.dueDate.toLocaleDateString('it-IT'),
      `€${d.outstanding.toFixed(2)}`,
      d.daysOverdue.toString(),
      d.bucket,
    ]);

    const summary = [
      { label: 'Corrente (non scaduto)', value: `€${data.summary.current.toFixed(2)}` },
      { label: '1-30 giorni', value: `€${data.summary.days30.toFixed(2)}` },
      { label: '31-60 giorni', value: `€${data.summary.days60.toFixed(2)}` },
      { label: '61-90 giorni', value: `€${data.summary.days90.toFixed(2)}` },
      { label: 'Oltre 90 giorni', value: `€${data.summary.over90.toFixed(2)}` },
      { label: 'TOTALE', value: `€${data.summary.total.toFixed(2)}` },
    ];

    return this.generateTableReportPdf({
      title,
      subtitle: `Situazione al ${new Date().toLocaleDateString('it-IT')}`,
      columns: [
        { header: type === 'receivables' ? 'Cliente' : 'Fornitore', width: 130, align: 'left' },
        { header: 'Fattura', width: 80, align: 'left' },
        { header: 'Scadenza', width: 70, align: 'center' },
        { header: 'Importo', width: 80, align: 'right' },
        { header: 'Gg Scaduti', width: 60, align: 'right' },
        { header: 'Fascia', width: 50, align: 'center' },
      ],
      rows,
      summary,
    });
  }

  /**
   * Genera PDF report Dead Stock
   */
  async generateDeadStockReportPdf(data: {
    items: any[];
    totalValue: number;
    totalItems: number;
    recommendations: { action: string; count: number; value: number }[];
  }): Promise<Buffer> {
    const rows = data.items.slice(0, 100).map(i => [
      i.sku,
      i.name.substring(0, 30),
      i.category,
      i.currentStock.toString(),
      i.daysSinceLastSale === 999 ? 'Mai venduto' : `${i.daysSinceLastSale} gg`,
      `€${i.stockValue.toFixed(2)}`,
      i.recommendation,
    ]);

    const summary = [
      { label: 'Prodotti totali', value: data.totalItems },
      { label: 'Valore totale bloccato', value: `€${data.totalValue.toFixed(2)}` },
      ...data.recommendations.map(r => ({
        label: `${r.action} (${r.count} prodotti)`,
        value: `€${r.value.toFixed(2)}`,
      })),
    ];

    return this.generateTableReportPdf({
      title: 'Report Dead Stock',
      subtitle: 'Prodotti senza vendite negli ultimi 90 giorni',
      columns: [
        { header: 'SKU', width: 70, align: 'left' },
        { header: 'Prodotto', width: 130, align: 'left' },
        { header: 'Categoria', width: 70, align: 'left' },
        { header: 'Stock', width: 45, align: 'right' },
        { header: 'Ultima Vendita', width: 75, align: 'center' },
        { header: 'Valore', width: 65, align: 'right' },
        { header: 'Azione', width: 75, align: 'center' },
      ],
      rows,
      summary,
      landscape: true,
    });
  }

  /**
   * Genera PDF report Cashflow Forecast
   */
  async generateCashflowForecastPdf(data: {
    period: string;
    openingBalance: number;
    expectedInflows: number;
    expectedOutflows: number;
    netCashflow: number;
    closingBalance: number;
    inflowDetails: { source: string; amount: number }[];
    outflowDetails: { source: string; amount: number }[];
  }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).font('Helvetica-Bold').text('Previsione Cashflow', { align: 'center' });
      doc.moveDown(2);

      data.forEach((period, index) => {
        if (index > 0) doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').text(period.period);
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Saldo iniziale: €${period.openingBalance.toFixed(2)}`);
        doc.moveDown(0.3);

        doc.text('Entrate previste:', { continued: false });
        period.inflowDetails.forEach(d => {
          doc.text(`  • ${d.source}: €${d.amount.toFixed(2)}`);
        });
        doc.text(`  Totale: €${period.expectedInflows.toFixed(2)}`, { indent: 20 });
        doc.moveDown(0.3);

        doc.text('Uscite previste:', { continued: false });
        period.outflowDetails.forEach(d => {
          doc.text(`  • ${d.source}: €${d.amount.toFixed(2)}`);
        });
        doc.text(`  Totale: €${period.expectedOutflows.toFixed(2)}`, { indent: 20 });
        doc.moveDown(0.3);

        doc.font('Helvetica-Bold');
        doc.text(`Flusso netto: €${period.netCashflow.toFixed(2)}`);
        doc.text(`Saldo finale: €${period.closingBalance.toFixed(2)}`);
      });

      doc.fontSize(8).font('Helvetica').text(
        `Generato il ${new Date().toLocaleString('it-IT')} - ${this.companyName}`,
        50, 780, { align: 'center' }
      );

      doc.end();
    });
  }

  // =============================================
  // EXCEL GENERATION
  // =============================================

  /**
   * Genera Excel report prodotti
   */
  async generateProductsExcel(filters?: { category?: string; isActive?: boolean }): Promise<Buffer> {
    const products = await prisma.product.findMany({
      where: {
        ...(filters?.category && { category: filters.category }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      include: {
        inventory: true,
        supplier: true,
      },
      orderBy: { sku: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = this.companyName;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Prodotti');

    // Header
    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Nome', key: 'name', width: 40 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Tipo', key: 'type', width: 15 },
      { header: 'Costo', key: 'cost', width: 12 },
      { header: 'Prezzo', key: 'price', width: 12 },
      { header: 'Margine %', key: 'margin', width: 12 },
      { header: 'Stock Totale', key: 'stock', width: 12 },
      { header: 'Stock Min', key: 'minStock', width: 12 },
      { header: 'Fornitore', key: 'supplier', width: 25 },
      { header: 'Attivo', key: 'isActive', width: 10 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2563EB' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Dati
    products.forEach((product) => {
      const cost = Number(product.cost);
      const price = Number(product.price);
      const margin = price > 0 ? ((price - cost) / price * 100).toFixed(1) : 0;
      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity - inv.reservedQuantity, 0);

      sheet.addRow({
        sku: product.sku,
        name: product.name,
        category: product.category || '-',
        type: product.type,
        cost: cost,
        price: price,
        margin: `${margin}%`,
        stock: totalStock,
        minStock: product.minStock,
        supplier: product.supplier?.businessName || '-',
        isActive: product.isActive ? 'Si' : 'No',
      });
    });

    // Formattazione colonne numeriche
    sheet.getColumn('cost').numFmt = '€#,##0.00';
    sheet.getColumn('price').numFmt = '€#,##0.00';

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Genera Excel report ordini
   */
  async generateOrdersExcel(dateFrom: Date, dateTo: Date): Promise<Buffer> {
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = this.companyName;

    // Sheet Ordini
    const ordersSheet = workbook.addWorksheet('Ordini');
    ordersSheet.columns = [
      { header: 'N. Ordine', key: 'orderNumber', width: 18 },
      { header: 'Data', key: 'date', width: 12 },
      { header: 'Cliente', key: 'customer', width: 30 },
      { header: 'Tipo Cliente', key: 'customerType', width: 12 },
      { header: 'Origine', key: 'source', width: 12 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Subtotale', key: 'subtotal', width: 12 },
      { header: 'IVA', key: 'tax', width: 10 },
      { header: 'Spedizione', key: 'shipping', width: 12 },
      { header: 'Totale', key: 'total', width: 12 },
      { header: 'N. Articoli', key: 'itemCount', width: 12 },
    ];

    this.styleHeader(ordersSheet);

    orders.forEach((order) => {
      ordersSheet.addRow({
        orderNumber: order.orderNumber,
        date: order.orderDate.toLocaleDateString('it-IT'),
        customer: order.customer.businessName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim(),
        customerType: order.customer.type,
        source: order.source,
        status: order.status,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        itemCount: order.items.length,
      });
    });

    // Formattazione
    ['subtotal', 'tax', 'shipping', 'total'].forEach(col => {
      ordersSheet.getColumn(col).numFmt = '€#,##0.00';
    });

    // Sheet Dettaglio Righe
    const itemsSheet = workbook.addWorksheet('Dettaglio Articoli');
    itemsSheet.columns = [
      { header: 'N. Ordine', key: 'orderNumber', width: 18 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Prodotto', key: 'product', width: 40 },
      { header: 'Quantità', key: 'quantity', width: 10 },
      { header: 'Prezzo Unit.', key: 'unitPrice', width: 12 },
      { header: 'Totale', key: 'total', width: 12 },
    ];

    this.styleHeader(itemsSheet);

    orders.forEach((order) => {
      order.items.forEach((item) => {
        itemsSheet.addRow({
          orderNumber: order.orderNumber,
          sku: item.sku,
          product: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        });
      });
    });

    itemsSheet.getColumn('unitPrice').numFmt = '€#,##0.00';
    itemsSheet.getColumn('total').numFmt = '€#,##0.00';

    // Sheet Riepilogo
    const summarySheet = workbook.addWorksheet('Riepilogo');
    summarySheet.addRow(['Riepilogo Ordini']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Periodo', `${dateFrom.toLocaleDateString('it-IT')} - ${dateTo.toLocaleDateString('it-IT')}`]);
    summarySheet.addRow(['Totale Ordini', orders.length]);
    summarySheet.addRow(['Fatturato Totale', orders.reduce((sum, o) => sum + Number(o.total), 0)]);
    summarySheet.addRow(['Media per Ordine', orders.length > 0 ? orders.reduce((sum, o) => sum + Number(o.total), 0) / orders.length : 0]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Per Stato']);

    const byStatus: Record<string, number> = {};
    orders.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });
    Object.entries(byStatus).forEach(([status, count]) => {
      summarySheet.addRow([status, count]);
    });

    summarySheet.getCell('B5').numFmt = '€#,##0.00';
    summarySheet.getCell('B6').numFmt = '€#,##0.00';

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Genera Excel report inventario
   */
  async generateInventoryExcel(): Promise<Buffer> {
    const inventory = await prisma.inventoryItem.findMany({
      include: {
        product: true,
        warehouse: true,
        variant: true,
      },
      orderBy: [
        { product: { sku: 'asc' } },
        { location: 'asc' },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = this.companyName;

    const sheet = workbook.addWorksheet('Inventario');
    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Prodotto', key: 'name', width: 35 },
      { header: 'Variante', key: 'variant', width: 20 },
      { header: 'Magazzino', key: 'warehouse', width: 20 },
      { header: 'Location', key: 'location', width: 12 },
      { header: 'Giacenza', key: 'quantity', width: 10 },
      { header: 'Riservati', key: 'reserved', width: 10 },
      { header: 'Disponibili', key: 'available', width: 12 },
      { header: 'Stock Min', key: 'minStock', width: 10 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Valore', key: 'value', width: 12 },
    ];

    this.styleHeader(sheet);

    inventory.forEach((item) => {
      const available = item.quantity - item.reservedQuantity;
      const minStock = item.product.minStock;
      let status = 'OK';
      if (available <= 0) status = 'ESAURITO';
      else if (available <= minStock) status = 'SCORTA BASSA';

      sheet.addRow({
        sku: item.product.sku,
        name: item.product.name,
        variant: item.variant?.name || '-',
        warehouse: item.warehouse.name,
        location: item.location,
        quantity: item.quantity,
        reserved: item.reservedQuantity,
        available: available,
        minStock: minStock,
        status: status,
        value: available * Number(item.product.cost),
      });
    });

    sheet.getColumn('value').numFmt = '€#,##0.00';

    // Formattazione condizionale per status
    inventory.forEach((_, i) => {
      const row = sheet.getRow(i + 2);
      const statusCell = row.getCell('status');
      if (statusCell.value === 'ESAURITO') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FEE2E2' },
        };
        statusCell.font = { color: { argb: '991B1B' } };
      } else if (statusCell.value === 'SCORTA BASSA') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FEF3C7' },
        };
        statusCell.font = { color: { argb: '92400E' } };
      }
    });

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Genera Excel report fatture/scadenzario
   */
  async generateInvoicesExcel(dateFrom: Date, dateTo: Date, type?: 'receivable' | 'payable'): Promise<Buffer> {
    const invoices = await prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        ...(type === 'receivable' && { type: 'SALE' }),
        ...(type === 'payable' && { type: 'PURCHASE' }),
      },
      include: {
        customer: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fatture');

    sheet.columns = [
      { header: 'N. Fattura', key: 'number', width: 18 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Cliente/Fornitore', key: 'entity', width: 30 },
      { header: 'Data Emissione', key: 'issueDate', width: 15 },
      { header: 'Scadenza', key: 'dueDate', width: 15 },
      { header: 'Importo', key: 'total', width: 12 },
      { header: 'Pagato', key: 'paid', width: 12 },
      { header: 'Residuo', key: 'remaining', width: 12 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Giorni', key: 'days', width: 10 },
    ];

    this.styleHeader(sheet);

    const today = new Date();
    invoices.forEach((inv) => {
      const paid = Number(inv.paidAmount);
      const total = Number(inv.total);
      const remaining = total - paid;
      const daysUntilDue = Math.floor((inv.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      sheet.addRow({
        number: inv.invoiceNumber,
        type: inv.type === 'SALE' ? 'Vendita' : 'Acquisto',
        entity: inv.customer?.businessName || `${inv.customer?.firstName || ''} ${inv.customer?.lastName || ''}`.trim() || '-',
        issueDate: inv.issueDate.toLocaleDateString('it-IT'),
        dueDate: inv.dueDate.toLocaleDateString('it-IT'),
        total: total,
        paid: paid,
        remaining: remaining,
        status: inv.status,
        days: daysUntilDue,
      });
    });

    ['total', 'paid', 'remaining'].forEach(col => {
      sheet.getColumn(col).numFmt = '€#,##0.00';
    });

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Genera Excel report analytics vendite
   */
  async generateSalesAnalyticsExcel(dateFrom: Date, dateTo: Date): Promise<Buffer> {
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: dateFrom, lte: dateTo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Vendite per Prodotto
    const productSheet = workbook.addWorksheet('Per Prodotto');
    const productSales: Record<string, { sku: string; name: string; qty: number; revenue: number }> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.productId;
        if (!productSales[key]) {
          productSales[key] = {
            sku: item.sku,
            name: item.productName,
            qty: 0,
            revenue: 0,
          };
        }
        productSales[key].qty += item.quantity;
        productSales[key].revenue += Number(item.total);
      });
    });

    productSheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Prodotto', key: 'name', width: 40 },
      { header: 'Quantità Venduta', key: 'qty', width: 18 },
      { header: 'Fatturato', key: 'revenue', width: 15 },
    ];
    this.styleHeader(productSheet);

    Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .forEach(p => productSheet.addRow(p));

    productSheet.getColumn('revenue').numFmt = '€#,##0.00';

    // Sheet 2: Vendite per Cliente
    const customerSheet = workbook.addWorksheet('Per Cliente');
    const customerSales: Record<string, { name: string; orders: number; revenue: number }> = {};

    orders.forEach(order => {
      const key = order.customerId;
      const name = order.customer.businessName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim();
      if (!customerSales[key]) {
        customerSales[key] = { name, orders: 0, revenue: 0 };
      }
      customerSales[key].orders++;
      customerSales[key].revenue += Number(order.total);
    });

    customerSheet.columns = [
      { header: 'Cliente', key: 'name', width: 40 },
      { header: 'N. Ordini', key: 'orders', width: 12 },
      { header: 'Fatturato', key: 'revenue', width: 15 },
      { header: 'Media Ordine', key: 'avg', width: 15 },
    ];
    this.styleHeader(customerSheet);

    Object.values(customerSales)
      .sort((a, b) => b.revenue - a.revenue)
      .forEach(c => {
        customerSheet.addRow({
          ...c,
          avg: c.orders > 0 ? c.revenue / c.orders : 0,
        });
      });

    customerSheet.getColumn('revenue').numFmt = '€#,##0.00';
    customerSheet.getColumn('avg').numFmt = '€#,##0.00';

    // Sheet 3: Trend Mensile
    const trendSheet = workbook.addWorksheet('Trend Mensile');
    const monthlyData: Record<string, { orders: number; revenue: number }> = {};

    orders.forEach(order => {
      const month = `${order.orderDate.getFullYear()}-${String(order.orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) {
        monthlyData[month] = { orders: 0, revenue: 0 };
      }
      monthlyData[month].orders++;
      monthlyData[month].revenue += Number(order.total);
    });

    trendSheet.columns = [
      { header: 'Mese', key: 'month', width: 12 },
      { header: 'N. Ordini', key: 'orders', width: 12 },
      { header: 'Fatturato', key: 'revenue', width: 15 },
    ];
    this.styleHeader(trendSheet);

    Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, data]) => {
        trendSheet.addRow({ month, ...data });
      });

    trendSheet.getColumn('revenue').numFmt = '€#,##0.00';

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  // =============================================
  // ORDER CONFIRMATION PDF
  // =============================================

  /**
   * Genera PDF conferma ordine
   */
  async generateOrderConfirmationPdf(orderId: string): Promise<Buffer> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Type assertion for included relations
    const orderWithRelations = order as typeof order & {
      customer: { businessName?: string; firstName?: string; lastName?: string };
      items: Array<{
        productName: string | null;
        sku: string;
        quantity: number;
        unitPrice: any;
        total: any;
        product: { name: string };
        variant?: { name: string } | null;
      }>;
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header con logo e dati azienda
      doc.fontSize(20).font('Helvetica-Bold').text(this.companyName, 50, 50, { align: 'left' });
      doc.fontSize(10).font('Helvetica').text(this.companyAddress, 50, 75);
      doc.text(`P.IVA: ${this.companyTaxId}`, 50, 90);
      doc.text(`Tel: ${this.companyPhone} | Email: ${this.companyEmail}`, 50, 105);

      // Titolo documento
      doc.fontSize(18).font('Helvetica-Bold').text('CONFERMA ORDINE', 400, 50, { align: 'right' });
      doc.fontSize(11).font('Helvetica').text(`N. ${order.orderNumber}`, 400, 75, { align: 'right' });
      doc.text(`Data: ${order.orderDate.toLocaleDateString('it-IT')}`, 400, 90, { align: 'right' });

      // Linea separatore
      doc.moveTo(50, 130).lineTo(545, 130).stroke();

      // Dati Cliente
      let yPos = 150;
      doc.fontSize(11).font('Helvetica-Bold').text('CLIENTE:', 50, yPos);
      doc.font('Helvetica');
      yPos += 15;
      const customerName = orderWithRelations.customer.businessName ||
        `${orderWithRelations.customer.firstName || ''} ${orderWithRelations.customer.lastName || ''}`.trim();
      doc.text(customerName, 50, yPos);
      yPos += 15;

      // Indirizzo di spedizione
      if (order.shippingAddress) {
        const shipping = typeof order.shippingAddress === 'string'
          ? JSON.parse(order.shippingAddress)
          : order.shippingAddress;

        if (shipping.street) doc.text(shipping.street, 50, yPos);
        yPos += 15;
        if (shipping.city || shipping.zip) {
          doc.text(`${shipping.zip || ''} ${shipping.city || ''}`.trim(), 50, yPos);
          yPos += 15;
        }
        if (shipping.country) doc.text(shipping.country, 50, yPos);
      }

      // Info ordine a destra
      doc.font('Helvetica-Bold').text('DETTAGLI ORDINE:', 350, 150);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Stato: ${this.translateOrderStatus(order.status)}`, 350, 165);
      if (order.estimatedDelivery) {
        doc.text(`Consegna prevista: ${new Date(order.estimatedDelivery).toLocaleDateString('it-IT')}`, 350, 180);
      }
      if (order.paymentMethod) {
        doc.text(`Metodo pagamento: ${order.paymentMethodTitle || order.paymentMethod}`, 350, 195);
      }

      // Tabella articoli
      const tableTop = Math.max(yPos + 30, 230);
      const tableHeaders = ['Articolo', 'SKU', 'Qtà', 'Prezzo Unit.', 'Totale'];
      const colWidths = [200, 80, 50, 80, 85];

      // Header tabella
      doc.font('Helvetica-Bold').fontSize(10);
      let xPos = 50;
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // Righe articoli
      doc.font('Helvetica').fontSize(10);
      yPos = tableTop + 25;
      orderWithRelations.items.forEach((item) => {
        xPos = 50;
        const name = item.productName || item.product.name;
        const variantName = item.variant?.name ? ` - ${item.variant.name}` : '';

        doc.text((name + variantName).substring(0, 35), xPos, yPos, { width: colWidths[0] });
        xPos += colWidths[0];
        doc.text(item.sku, xPos, yPos, { width: colWidths[1] });
        xPos += colWidths[1];
        doc.text(item.quantity.toString(), xPos, yPos, { width: colWidths[2], align: 'right' });
        xPos += colWidths[2];
        doc.text(`€${Number(item.unitPrice).toFixed(2)}`, xPos, yPos, { width: colWidths[3], align: 'right' });
        xPos += colWidths[3];
        doc.text(`€${Number(item.total).toFixed(2)}`, xPos, yPos, { width: colWidths[4], align: 'right' });
        yPos += 20;
      });

      // Linea fine tabella
      doc.moveTo(50, yPos + 5).lineTo(545, yPos + 5).stroke();

      // Totali
      yPos += 20;
      doc.font('Helvetica').fontSize(11);

      // Subtotale
      doc.text('Subtotale:', 380, yPos);
      doc.text(`€${Number(order.subtotal).toFixed(2)}`, 480, yPos, { align: 'right' });
      yPos += 18;

      // Sconto
      if (order.discount && Number(order.discount) > 0) {
        doc.text('Sconto:', 380, yPos);
        doc.text(`-€${Number(order.discount).toFixed(2)}`, 480, yPos, { align: 'right' });
        yPos += 18;
      }

      // Spedizione
      if (order.shipping && Number(order.shipping) > 0) {
        doc.text('Spedizione:', 380, yPos);
        doc.text(`€${Number(order.shipping).toFixed(2)}`, 480, yPos, { align: 'right' });
        yPos += 18;
      }

      // IVA
      doc.text('IVA:', 380, yPos);
      doc.text(`€${Number(order.tax).toFixed(2)}`, 480, yPos, { align: 'right' });
      yPos += 18;

      // Totale
      doc.font('Helvetica-Bold').fontSize(13);
      doc.text('TOTALE:', 380, yPos);
      doc.text(`€${Number(order.total).toFixed(2)}`, 480, yPos, { align: 'right' });

      // Note cliente
      if (order.customerNote) {
        yPos += 40;
        doc.font('Helvetica-Bold').fontSize(10).text('Note cliente:', 50, yPos);
        doc.font('Helvetica').text(order.customerNote, 50, yPos + 15, { width: 495 });
      }

      // Informazioni pagamento
      yPos = Math.min(yPos + 60, 700);
      doc.font('Helvetica').fontSize(9);
      doc.text('Grazie per il vostro ordine!', 50, yPos, { align: 'center' });
      doc.text('Per qualsiasi domanda, contattateci.', 50, yPos + 12, { align: 'center' });

      // Footer
      doc.fontSize(8).text(
        `Documento generato da ${this.companyName} - ${new Date().toLocaleString('it-IT')}`,
        50,
        780,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Traduce status ordine in italiano
   */
  private translateOrderStatus(status: string): string {
    const translations: Record<string, string> = {
      PENDING: 'In Attesa',
      CONFIRMED: 'Confermato',
      PROCESSING: 'In Lavorazione',
      READY: 'Pronto',
      SHIPPED: 'Spedito',
      DELIVERED: 'Consegnato',
      CANCELLED: 'Annullato',
      REFUNDED: 'Rimborsato',
    };
    return translations[status] || status;
  }

  // =============================================
  // UTILITY
  // =============================================

  private styleHeader(sheet: ExcelJS.Worksheet) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2563EB' },
    };
  }

  private formatAddress(address: any): string {
    if (!address) return '';
    const parts = [
      address.street,
      `${address.zip || ''} ${address.city || ''}`.trim(),
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  // =============================================
  // CSV GENERATION
  // =============================================

  /**
   * Genera CSV generico da array di oggetti
   */
  generateCsv(data: Record<string, any>[], columns?: { key: string; header: string }[]): string {
    if (data.length === 0) return '';

    // Se non specificati, usa le chiavi del primo oggetto
    const cols = columns || Object.keys(data[0]).map(key => ({ key, header: key }));

    // Header
    const headerRow = cols.map(c => this.escapeCsvField(c.header)).join(';');

    // Data rows
    const dataRows = data.map(row =>
      cols.map(c => this.escapeCsvField(this.formatCsvValue(row[c.key]))).join(';')
    );

    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Genera CSV prodotti
   */
  async generateProductsCsv(filters?: { category?: string; isActive?: boolean }): Promise<string> {
    const products = await prisma.product.findMany({
      where: {
        ...(filters?.category && { category: filters.category }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      include: {
        inventory: true,
        supplier: true,
      },
      orderBy: { sku: 'asc' },
    });

    const data = products.map((product) => {
      const cost = Number(product.cost);
      const price = Number(product.price);
      const margin = price > 0 ? ((price - cost) / price * 100).toFixed(1) : '0';
      const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity - inv.reservedQuantity, 0);

      return {
        sku: product.sku,
        nome: product.name,
        categoria: product.category || '',
        tipo: product.type,
        costo: cost.toFixed(2),
        prezzo: price.toFixed(2),
        margine: `${margin}%`,
        stock: totalStock,
        stockMinimo: product.minStock,
        fornitore: product.supplier?.businessName || '',
        attivo: product.isActive ? 'Si' : 'No',
      };
    });

    return this.generateCsv(data, [
      { key: 'sku', header: 'SKU' },
      { key: 'nome', header: 'Nome' },
      { key: 'categoria', header: 'Categoria' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'costo', header: 'Costo' },
      { key: 'prezzo', header: 'Prezzo' },
      { key: 'margine', header: 'Margine' },
      { key: 'stock', header: 'Stock' },
      { key: 'stockMinimo', header: 'Stock Min' },
      { key: 'fornitore', header: 'Fornitore' },
      { key: 'attivo', header: 'Attivo' },
    ]);
  }

  /**
   * Genera CSV ordini
   */
  async generateOrdersCsv(dateFrom: Date, dateTo: Date): Promise<string> {
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: dateFrom, lte: dateTo },
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { orderDate: 'desc' },
    });

    const data = orders.map((order) => ({
      numeroOrdine: order.orderNumber,
      data: order.orderDate.toLocaleDateString('it-IT'),
      cliente: order.customer.businessName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim(),
      tipoCliente: order.customer.type,
      origine: order.source,
      stato: order.status,
      subtotale: Number(order.subtotal).toFixed(2),
      iva: Number(order.tax).toFixed(2),
      spedizione: Number(order.shipping).toFixed(2),
      totale: Number(order.total).toFixed(2),
      numeroArticoli: order.items.length,
    }));

    return this.generateCsv(data, [
      { key: 'numeroOrdine', header: 'N. Ordine' },
      { key: 'data', header: 'Data' },
      { key: 'cliente', header: 'Cliente' },
      { key: 'tipoCliente', header: 'Tipo Cliente' },
      { key: 'origine', header: 'Origine' },
      { key: 'stato', header: 'Stato' },
      { key: 'subtotale', header: 'Subtotale' },
      { key: 'iva', header: 'IVA' },
      { key: 'spedizione', header: 'Spedizione' },
      { key: 'totale', header: 'Totale' },
      { key: 'numeroArticoli', header: 'N. Articoli' },
    ]);
  }

  /**
   * Genera CSV inventario
   */
  async generateInventoryCsv(): Promise<string> {
    const inventory = await prisma.inventoryItem.findMany({
      include: {
        product: true,
        warehouse: true,
        variant: true,
      },
      orderBy: [
        { product: { sku: 'asc' } },
        { location: 'asc' },
      ],
    });

    const data = inventory.map((item) => {
      const available = item.quantity - item.reservedQuantity;
      const minStock = item.product.minStock;
      let status = 'OK';
      if (available <= 0) status = 'ESAURITO';
      else if (available <= minStock) status = 'SCORTA BASSA';

      return {
        sku: item.product.sku,
        nome: item.product.name,
        variante: item.variant?.name || '',
        magazzino: item.warehouse.name,
        ubicazione: item.location,
        giacenza: item.quantity,
        riservati: item.reservedQuantity,
        disponibili: available,
        stockMinimo: minStock,
        stato: status,
        valore: (available * Number(item.product.cost)).toFixed(2),
      };
    });

    return this.generateCsv(data, [
      { key: 'sku', header: 'SKU' },
      { key: 'nome', header: 'Prodotto' },
      { key: 'variante', header: 'Variante' },
      { key: 'magazzino', header: 'Magazzino' },
      { key: 'ubicazione', header: 'Ubicazione' },
      { key: 'giacenza', header: 'Giacenza' },
      { key: 'riservati', header: 'Riservati' },
      { key: 'disponibili', header: 'Disponibili' },
      { key: 'stockMinimo', header: 'Stock Min' },
      { key: 'stato', header: 'Stato' },
      { key: 'valore', header: 'Valore' },
    ]);
  }

  /**
   * Genera CSV clienti
   */
  async generateCustomersCsv(): Promise<string> {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: { total: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = customers.map((customer) => {
      const totalSpent = customer.orders.reduce((sum, o) => sum + Number(o.total), 0);
      const address = typeof customer.address === 'string'
        ? JSON.parse(customer.address)
        : customer.address;

      return {
        codice: customer.code,
        ragioneSociale: customer.businessName || '',
        nome: customer.firstName || '',
        cognome: customer.lastName || '',
        tipo: customer.type,
        email: customer.email,
        telefono: customer.phone || '',
        partitaIva: customer.taxId || '',
        codiceFiscale: customer.fiscalCode || '',
        indirizzo: address?.street || '',
        citta: address?.city || '',
        cap: address?.zip || '',
        paese: address?.country || '',
        totaleOrdini: customer.orders.length,
        totaleSpeso: totalSpent.toFixed(2),
      };
    });

    return this.generateCsv(data, [
      { key: 'codice', header: 'Codice' },
      { key: 'ragioneSociale', header: 'Ragione Sociale' },
      { key: 'nome', header: 'Nome' },
      { key: 'cognome', header: 'Cognome' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'email', header: 'Email' },
      { key: 'telefono', header: 'Telefono' },
      { key: 'partitaIva', header: 'P.IVA' },
      { key: 'codiceFiscale', header: 'C.F.' },
      { key: 'indirizzo', header: 'Indirizzo' },
      { key: 'citta', header: 'Città' },
      { key: 'cap', header: 'CAP' },
      { key: 'paese', header: 'Paese' },
      { key: 'totaleOrdini', header: 'N. Ordini' },
      { key: 'totaleSpeso', header: 'Totale Speso' },
    ]);
  }

  /**
   * Genera CSV fornitori
   */
  async generateSuppliersCsv(): Promise<string> {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        purchaseOrders: {
          where: { status: { not: 'CANCELLED' } },
          select: { total: true },
        },
      },
      orderBy: { businessName: 'asc' },
    });

    const data = suppliers.map((supplier) => {
      const totalPurchases = supplier.purchaseOrders.reduce((sum, po) => sum + Number(po.total), 0);
      const address = typeof supplier.address === 'string'
        ? JSON.parse(supplier.address)
        : supplier.address;

      return {
        codice: supplier.code,
        ragioneSociale: supplier.businessName,
        email: supplier.email,
        telefono: supplier.phone || '',
        partitaIva: supplier.taxId || '',
        indirizzo: address?.street || '',
        citta: address?.city || '',
        cap: address?.zip || '',
        paese: address?.country || '',
        terminiPagamento: supplier.paymentTerms || 0,
        banca: supplier.bankName || '',
        iban: supplier.iban || '',
        totaleOrdini: supplier.purchaseOrders.length,
        totaleAcquisti: totalPurchases.toFixed(2),
      };
    });

    return this.generateCsv(data, [
      { key: 'codice', header: 'Codice' },
      { key: 'ragioneSociale', header: 'Ragione Sociale' },
      { key: 'email', header: 'Email' },
      { key: 'telefono', header: 'Telefono' },
      { key: 'partitaIva', header: 'P.IVA' },
      { key: 'indirizzo', header: 'Indirizzo' },
      { key: 'citta', header: 'Città' },
      { key: 'cap', header: 'CAP' },
      { key: 'paese', header: 'Paese' },
      { key: 'terminiPagamento', header: 'Termini Pagamento' },
      { key: 'banca', header: 'Banca' },
      { key: 'iban', header: 'IBAN' },
      { key: 'totaleOrdini', header: 'N. Ordini' },
      { key: 'totaleAcquisti', header: 'Totale Acquisti' },
    ]);
  }

  /**
   * Genera CSV fatture
   */
  async generateInvoicesCsv(dateFrom: Date, dateTo: Date, type?: 'receivable' | 'payable'): Promise<string> {
    const invoices = await prisma.invoice.findMany({
      where: {
        issueDate: { gte: dateFrom, lte: dateTo },
        ...(type === 'receivable' && { type: 'SALE' }),
        ...(type === 'payable' && { type: 'PURCHASE' }),
      },
      include: {
        customer: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    const data = invoices.map((inv) => {
      const paid = Number(inv.paidAmount);
      const total = Number(inv.total);
      const remaining = total - paid;
      const daysUntilDue = Math.floor((inv.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        numero: inv.invoiceNumber,
        tipo: inv.type === 'SALE' ? 'Vendita' : 'Acquisto',
        cliente: inv.customer?.businessName || `${inv.customer?.firstName || ''} ${inv.customer?.lastName || ''}`.trim() || '',
        dataEmissione: inv.issueDate.toLocaleDateString('it-IT'),
        scadenza: inv.dueDate.toLocaleDateString('it-IT'),
        importo: total.toFixed(2),
        pagato: paid.toFixed(2),
        residuo: remaining.toFixed(2),
        stato: inv.status,
        giorni: daysUntilDue,
      };
    });

    return this.generateCsv(data, [
      { key: 'numero', header: 'N. Fattura' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'cliente', header: 'Cliente/Fornitore' },
      { key: 'dataEmissione', header: 'Data Emissione' },
      { key: 'scadenza', header: 'Scadenza' },
      { key: 'importo', header: 'Importo' },
      { key: 'pagato', header: 'Pagato' },
      { key: 'residuo', header: 'Residuo' },
      { key: 'stato', header: 'Stato' },
      { key: 'giorni', header: 'Giorni' },
    ]);
  }

  /**
   * Genera CSV report generico (per reportistica avanzata)
   */
  generateReportCsv<T extends Record<string, any>>(
    data: T[],
    columnConfig: { key: keyof T; header: string; formatter?: (value: any) => string }[]
  ): string {
    if (data.length === 0) return '';

    // Header
    const headerRow = columnConfig.map(c => this.escapeCsvField(c.header)).join(';');

    // Data rows
    const dataRows = data.map(row =>
      columnConfig.map(c => {
        const value = row[c.key];
        const formatted = c.formatter ? c.formatter(value) : this.formatCsvValue(value);
        return this.escapeCsvField(formatted);
      }).join(';')
    );

    return [headerRow, ...dataRows].join('\n');
  }

  // CSV Utilities
  private escapeCsvField(value: string): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Se contiene separatore, virgolette o newline, wrappa in virgolette
    if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private formatCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('it-IT');
    if (typeof value === 'number') {
      // Formatta numeri con virgola decimale (italiano)
      return value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    return String(value);
  }
}

export const exportService = new ExportService();
export default exportService;
