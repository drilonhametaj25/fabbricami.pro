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
}

export const exportService = new ExportService();
export default exportService;
