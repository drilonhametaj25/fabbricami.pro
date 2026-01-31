/**
 * DDT Service
 * Gestione Documenti Di Trasporto
 */

import { prisma } from '../config/database';
import { companySettingsService } from './company-settings.service';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';

/**
 * Input per creazione DDT
 */
interface CreateDdtInput {
  orderId?: string;
  customerId: string;
  issueDate?: Date;
  transportDate?: Date;
  shippingAddress: {
    street: string;
    city: string;
    province?: string;
    zip: string;
    country?: string;
  };
  carrier?: string;
  carrierNotes?: string;
  numberOfPackages?: number;
  totalWeight?: number;
  transportReason?: string;
  shipmentAppearance?: string;
  notes?: string;
  internalNotes?: string;
  items: Array<{
    productId?: string;
    variantId?: string;
    sku: string;
    description: string;
    quantity: number;
    unit?: string;
    lotNumber?: string;
    serialNumber?: string;
    unitPrice?: number;
  }>;
}

/**
 * Input per aggiornamento DDT
 */
interface UpdateDdtInput {
  transportDate?: Date;
  shippingAddress?: {
    street: string;
    city: string;
    province?: string;
    zip: string;
    country?: string;
  };
  carrier?: string;
  carrierNotes?: string;
  numberOfPackages?: number;
  totalWeight?: number;
  transportReason?: string;
  shipmentAppearance?: string;
  notes?: string;
  internalNotes?: string;
}

/**
 * Query per lista DDT
 */
interface DdtQuery {
  page?: number;
  limit?: number;
  customerId?: string;
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
  isInvoiced?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Servizio per gestione DDT
 */
class DdtService {
  /**
   * Lista DDT con filtri e paginazione
   */
  async list(params: DdtQuery) {
    const {
      page = 1,
      limit = 50,
      customerId,
      orderId,
      dateFrom,
      dateTo,
      isInvoiced,
      search,
      sortBy = 'issueDate',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.DDTWhereInput = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) {
        where.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.issueDate.lte = new Date(dateTo);
      }
    }

    if (isInvoiced !== undefined) {
      where.isInvoiced = isInvoiced;
    }

    if (search) {
      where.OR = [
        { ddtNumber: { contains: search, mode: 'insensitive' } },
        { carrier: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.DDTOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [ddts, total] = await Promise.all([
      prisma.dDT.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              businessName: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dDT.count({ where }),
    ]);

    return {
      items: ddts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Recupera un DDT per ID
   */
  async getById(id: string) {
    return prisma.dDT.findUnique({
      where: { id },
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
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Recupera un DDT per numero
   */
  async getByNumber(ddtNumber: string) {
    return prisma.dDT.findUnique({
      where: { ddtNumber },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Crea un nuovo DDT
   */
  async create(data: CreateDdtInput) {
    // Genera numero DDT
    const ddtNumber = await companySettingsService.getNextDdtNumber();

    const now = new Date();
    const issueDate = data.issueDate || now;
    const transportDate = data.transportDate || now;

    // Crea DDT con items
    const ddt = await prisma.dDT.create({
      data: {
        ddtNumber,
        orderId: data.orderId,
        customerId: data.customerId,
        issueDate,
        transportDate,
        shippingAddress: data.shippingAddress,
        carrier: data.carrier,
        carrierNotes: data.carrierNotes,
        numberOfPackages: data.numberOfPackages || 1,
        totalWeight: data.totalWeight,
        transportReason: data.transportReason || 'VENDITA',
        shipmentAppearance: data.shipmentAppearance,
        notes: data.notes,
        internalNotes: data.internalNotes,
        items: {
          create: data.items.map((item, index) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'pz',
            lotNumber: item.lotNumber,
            serialNumber: item.serialNumber,
            unitPrice: item.unitPrice,
            lineNumber: index + 1,
          })),
        },
      },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    logger.info(`DDT creato: ${ddtNumber}`);

    return ddt;
  }

  /**
   * Crea DDT da un ordine esistente
   */
  async createFromOrder(orderId: string, options?: { carrier?: string; notes?: string }) {
    // Carica ordine con items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Estrai indirizzo di spedizione
    const shippingAddress = order.shippingAddress as Record<string, string> | null;

    if (!shippingAddress) {
      throw new Error('Ordine senza indirizzo di spedizione');
    }

    // Prepara items
    const items = order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || undefined,
      sku: item.sku,
      description: item.productName,
      quantity: item.quantity,
      unit: item.product?.unit || 'pz',
      unitPrice: Number(item.unitPrice),
    }));

    // Crea DDT
    return this.create({
      orderId: order.id,
      customerId: order.customerId,
      shippingAddress: {
        street: shippingAddress.address_1 || shippingAddress.street || '',
        city: shippingAddress.city || '',
        province: shippingAddress.state || shippingAddress.province || '',
        zip: shippingAddress.postcode || shippingAddress.zip || '',
        country: shippingAddress.country || 'IT',
      },
      carrier: options?.carrier || order.carrier || undefined,
      notes: options?.notes,
      transportReason: 'VENDITA',
      items,
    });
  }

  /**
   * Aggiorna un DDT
   */
  async update(id: string, data: UpdateDdtInput) {
    const ddt = await prisma.dDT.findUnique({ where: { id } });

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    if (ddt.isInvoiced) {
      throw new Error('Impossibile modificare un DDT già fatturato');
    }

    const updated = await prisma.dDT.update({
      where: { id },
      data: {
        transportDate: data.transportDate,
        shippingAddress: data.shippingAddress,
        carrier: data.carrier,
        carrierNotes: data.carrierNotes,
        numberOfPackages: data.numberOfPackages,
        totalWeight: data.totalWeight,
        transportReason: data.transportReason,
        shipmentAppearance: data.shipmentAppearance,
        notes: data.notes,
        internalNotes: data.internalNotes,
      },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    logger.info(`DDT aggiornato: ${ddt.ddtNumber}`);

    return updated;
  }

  /**
   * Elimina un DDT
   */
  async delete(id: string) {
    const ddt = await prisma.dDT.findUnique({ where: { id } });

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    if (ddt.isInvoiced) {
      throw new Error('Impossibile eliminare un DDT già fatturato');
    }

    await prisma.dDT.delete({ where: { id } });

    logger.info(`DDT eliminato: ${ddt.ddtNumber}`);

    return { success: true };
  }

  /**
   * Marca DDT come fatturati
   */
  async markAsInvoiced(ddtIds: string[], invoiceId: string) {
    await prisma.dDT.updateMany({
      where: {
        id: { in: ddtIds },
      },
      data: {
        isInvoiced: true,
        invoiceId,
      },
    });

    logger.info(`DDT marcati come fatturati: ${ddtIds.join(', ')}`);

    return { success: true };
  }

  /**
   * Recupera DDT non fatturati di un cliente
   */
  async getUninvoicedByCustomer(customerId: string) {
    return prisma.dDT.findMany({
      where: {
        customerId,
        isInvoiced: false,
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: { issueDate: 'asc' },
    });
  }

  /**
   * Calcola totale DDT (per riferimento, non fiscale)
   */
  async calculateTotal(id: string): Promise<number> {
    const ddt = await prisma.dDT.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!ddt) {
      return 0;
    }

    return ddt.items.reduce((sum, item) => {
      const price = item.unitPrice ? Number(item.unitPrice) : 0;
      return sum + price * item.quantity;
    }, 0);
  }

  /**
   * Aggiunge una riga al DDT
   */
  async addItem(
    ddtId: string,
    item: {
      productId?: string;
      variantId?: string;
      sku: string;
      description: string;
      quantity: number;
      unit?: string;
      lotNumber?: string;
      serialNumber?: string;
      unitPrice?: number;
    }
  ) {
    const ddt = await prisma.dDT.findUnique({
      where: { id: ddtId },
      include: { items: true },
    });

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    if (ddt.isInvoiced) {
      throw new Error('Impossibile modificare un DDT già fatturato');
    }

    const maxLineNumber = ddt.items.reduce((max, i) => Math.max(max, i.lineNumber), 0);

    const newItem = await prisma.dDTItem.create({
      data: {
        ddtId,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'pz',
        lotNumber: item.lotNumber,
        serialNumber: item.serialNumber,
        unitPrice: item.unitPrice,
        lineNumber: maxLineNumber + 1,
      },
      include: {
        product: true,
        variant: true,
      },
    });

    logger.info(`Riga aggiunta a DDT ${ddt.ddtNumber}`);

    return newItem;
  }

  /**
   * Rimuove una riga dal DDT
   */
  async removeItem(ddtId: string, itemId: string) {
    const ddt = await prisma.dDT.findUnique({ where: { id: ddtId } });

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    if (ddt.isInvoiced) {
      throw new Error('Impossibile modificare un DDT già fatturato');
    }

    await prisma.dDTItem.delete({ where: { id: itemId } });

    logger.info(`Riga rimossa da DDT ${ddt.ddtNumber}`);

    return { success: true };
  }

  /**
   * Aggiorna una riga del DDT
   */
  async updateItem(
    ddtId: string,
    itemId: string,
    data: {
      quantity?: number;
      unit?: string;
      lotNumber?: string;
      serialNumber?: string;
      unitPrice?: number;
    }
  ) {
    const ddt = await prisma.dDT.findUnique({ where: { id: ddtId } });

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    if (ddt.isInvoiced) {
      throw new Error('Impossibile modificare un DDT già fatturato');
    }

    const updated = await prisma.dDTItem.update({
      where: { id: itemId },
      data,
      include: {
        product: true,
        variant: true,
      },
    });

    return updated;
  }

  /**
   * Genera PDF del DDT
   */
  async generatePdf(id: string): Promise<{ path: string; buffer: Buffer }> {
    const ddt = await this.getById(id);

    if (!ddt) {
      throw new Error('DDT non trovato');
    }

    // Carica impostazioni aziendali
    const companySettings = await companySettingsService.get();

    // Crea documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `DDT ${ddt.ddtNumber}`,
        Author: companySettings?.companyName || 'Azienda',
        Subject: 'Documento di Trasporto',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Funzione per formattare data
    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Funzione per formattare numero
    const formatNumber = (num: number | null | undefined, decimals = 2): string => {
      if (num === null || num === undefined) return '-';
      return Number(num).toLocaleString('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    // ============================================
    // INTESTAZIONE AZIENDA
    // ============================================

    let y = 40;

    // Box azienda mittente
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('MITTENTE', 40, y);
    y += 18;

    doc.fontSize(10).font('Helvetica');
    if (companySettings) {
      doc.font('Helvetica-Bold').text(companySettings.companyName, 40, y);
      y += 14;
      doc.font('Helvetica');
      doc.text(companySettings.address, 40, y);
      y += 12;
      doc.text(`${companySettings.postalCode} ${companySettings.city} (${companySettings.province})`, 40, y);
      y += 12;
      doc.text(`P.IVA: ${companySettings.vatNumber}`, 40, y);
      y += 12;
      if (companySettings.fiscalCode) {
        doc.text(`C.F.: ${companySettings.fiscalCode}`, 40, y);
        y += 12;
      }
      if (companySettings.phone) {
        doc.text(`Tel: ${companySettings.phone}`, 40, y);
        y += 12;
      }
      if (companySettings.email) {
        doc.text(`Email: ${companySettings.email}`, 40, y);
        y += 12;
      }
    } else {
      doc.text('Azienda mittente non configurata', 40, y);
      y += 14;
    }

    // ============================================
    // NUMERO DDT E DATA
    // ============================================

    const headerRightX = 350;
    let headerY = 40;

    // Box DDT
    doc.rect(headerRightX, headerY, 205, 70).stroke();
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('DOCUMENTO DI TRASPORTO', headerRightX + 10, headerY + 10);
    headerY += 30;

    doc.fontSize(11);
    doc.text(`N° ${ddt.ddtNumber}`, headerRightX + 10, headerY);
    headerY += 16;
    doc.font('Helvetica').fontSize(10);
    doc.text(`Data emissione: ${formatDate(ddt.issueDate)}`, headerRightX + 10, headerY);

    // ============================================
    // DESTINATARIO
    // ============================================

    y = Math.max(y, 130);
    y += 15;

    doc.rect(40, y, 270, 100).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('DESTINATARIO', 50, y + 10);
    y += 25;

    doc.font('Helvetica');
    if (ddt.customer) {
      const customerName = ddt.customer.businessName ||
        `${ddt.customer.firstName || ''} ${ddt.customer.lastName || ''}`.trim();
      doc.font('Helvetica-Bold').text(customerName, 50, y);
      y += 14;
      doc.font('Helvetica');

      // Indirizzo spedizione
      const shippingAddr = ddt.shippingAddress as Record<string, string> | null;
      if (shippingAddr) {
        doc.text(shippingAddr.street || '', 50, y);
        y += 12;
        const cityLine = `${shippingAddr.zip || ''} ${shippingAddr.city || ''} ${shippingAddr.province ? `(${shippingAddr.province})` : ''}`.trim();
        doc.text(cityLine, 50, y);
        y += 12;
        if (shippingAddr.country && shippingAddr.country !== 'IT') {
          doc.text(shippingAddr.country, 50, y);
          y += 12;
        }
      }
    }

    // ============================================
    // DATI TRASPORTO
    // ============================================

    const transportBoxY = 145;
    const transportBoxX = 320;

    doc.rect(transportBoxX, transportBoxY, 235, 100).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('DATI TRASPORTO', transportBoxX + 10, transportBoxY + 10);

    let ty = transportBoxY + 28;
    doc.font('Helvetica').fontSize(9);

    doc.text(`Data trasporto: ${formatDate(ddt.transportDate)}`, transportBoxX + 10, ty);
    ty += 14;

    doc.text(`Causale trasporto: ${ddt.transportReason || 'VENDITA'}`, transportBoxX + 10, ty);
    ty += 14;

    if (ddt.carrier) {
      doc.text(`Vettore: ${ddt.carrier}`, transportBoxX + 10, ty);
      ty += 14;
    }

    if (ddt.numberOfPackages) {
      doc.text(`N° colli: ${ddt.numberOfPackages}`, transportBoxX + 10, ty);
      ty += 14;
    }

    if (ddt.totalWeight) {
      doc.text(`Peso totale: ${formatNumber(Number(ddt.totalWeight), 2)} kg`, transportBoxX + 10, ty);
      ty += 14;
    }

    if (ddt.shipmentAppearance) {
      doc.text(`Aspetto beni: ${ddt.shipmentAppearance}`, transportBoxX + 10, ty);
    }

    // ============================================
    // RIFERIMENTO ORDINE
    // ============================================

    y = 265;

    if (ddt.order) {
      doc.fontSize(9).font('Helvetica');
      doc.text(`Riferimento ordine: ${ddt.order.orderNumber}`, 40, y);
      y += 20;
    } else {
      y += 10;
    }

    // ============================================
    // TABELLA ARTICOLI
    // ============================================

    // Intestazione tabella
    const tableTop = y + 10;
    const tableHeaders = [
      { label: 'Riga', x: 40, width: 30 },
      { label: 'Codice', x: 70, width: 80 },
      { label: 'Descrizione', x: 150, width: 200 },
      { label: 'U.M.', x: 350, width: 40 },
      { label: 'Quantità', x: 390, width: 60 },
      { label: 'Note', x: 450, width: 105 },
    ];

    // Sfondo intestazione
    doc.fillColor('#f0f0f0').rect(40, tableTop, 515, 20).fill();
    doc.fillColor('#000000');

    // Testo intestazione
    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header) => {
      doc.text(header.label, header.x + 2, tableTop + 5, { width: header.width - 4 });
    });

    // Linea sotto intestazione
    doc.moveTo(40, tableTop + 20).lineTo(555, tableTop + 20).stroke();

    // Righe articoli
    let itemY = tableTop + 25;
    doc.font('Helvetica').fontSize(8);

    const ddtItems = ddt.items || [];

    for (const item of ddtItems) {
      // Controlla se serve nuova pagina
      if (itemY > 700) {
        doc.addPage();
        itemY = 60;

        // Ripeti intestazione tabella
        doc.fillColor('#f0f0f0').rect(40, 40, 515, 20).fill();
        doc.fillColor('#000000');
        doc.fontSize(9).font('Helvetica-Bold');
        tableHeaders.forEach((header) => {
          doc.text(header.label, header.x + 2, 45, { width: header.width - 4 });
        });
        doc.moveTo(40, 60).lineTo(555, 60).stroke();
        doc.font('Helvetica').fontSize(8);
      }

      // Dati riga
      doc.text(item.lineNumber.toString(), 42, itemY);
      doc.text(item.sku, 72, itemY, { width: 76 });
      doc.text(item.description, 152, itemY, { width: 196 });
      doc.text(item.unit || 'pz', 352, itemY);
      doc.text(formatNumber(item.quantity, 0), 392, itemY);

      // Note (lotto/seriale)
      const notes: string[] = [];
      if (item.lotNumber) notes.push(`Lotto: ${item.lotNumber}`);
      if (item.serialNumber) notes.push(`S/N: ${item.serialNumber}`);
      if (notes.length > 0) {
        doc.fontSize(7).text(notes.join(' - '), 452, itemY, { width: 100 });
        doc.fontSize(8);
      }

      itemY += 18;
    }

    // Linea fine tabella
    doc.moveTo(40, itemY + 5).lineTo(555, itemY + 5).stroke();

    // ============================================
    // NOTE E FIRME
    // ============================================

    itemY += 20;

    // Note
    if (ddt.notes) {
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Note:', 40, itemY);
      itemY += 14;
      doc.font('Helvetica');
      doc.text(ddt.notes, 40, itemY, { width: 515 });
      itemY += 30;
    }

    if (ddt.carrierNotes) {
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Note vettore:', 40, itemY);
      itemY += 14;
      doc.font('Helvetica');
      doc.text(ddt.carrierNotes, 40, itemY, { width: 515 });
      itemY += 30;
    }

    // ============================================
    // SEZIONE FIRME
    // ============================================

    // Posizione firme, cerca di metterle in fondo pagina
    const signatureY = Math.max(itemY + 30, 680);

    // Se non c'è spazio, nuova pagina
    if (signatureY > 750) {
      doc.addPage();
    }

    const signY = signatureY > 750 ? 60 : signatureY;

    // Box firma mittente
    doc.rect(40, signY, 160, 60).stroke();
    doc.fontSize(8).font('Helvetica');
    doc.text('Firma mittente', 50, signY + 5);

    // Box firma vettore
    doc.rect(210, signY, 160, 60).stroke();
    doc.text('Firma vettore', 220, signY + 5);

    // Box firma destinatario
    doc.rect(380, signY, 175, 60).stroke();
    doc.text('Firma destinatario', 390, signY + 5);

    // Data e ora ritiro
    doc.text('Data e ora ritiro: _______________', 40, signY + 70);

    // ============================================
    // FOOTER
    // ============================================

    // Numero pagina
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        `Pagina ${i + 1} di ${pages.count}`,
        40,
        doc.page.height - 30,
        { align: 'center', width: 515 }
      );
      doc.text(
        `DDT ${ddt.ddtNumber} - Documento emesso il ${formatDate(ddt.issueDate)}`,
        40,
        doc.page.height - 20,
        { align: 'center', width: 515 }
      );
    }

    // Finalizza documento
    doc.end();

    // Attendi completamento
    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Path per archiviazione
    const pdfPath = `./storage/ddt/DDT_${ddt.ddtNumber.replace(/\//g, '-')}.pdf`;

    // Aggiorna DDT con path PDF
    await prisma.dDT.update({
      where: { id },
      data: { pdfFilePath: pdfPath },
    });

    logger.info(`PDF DDT generato: ${ddt.ddtNumber}`);

    return { path: pdfPath, buffer };
  }

  /**
   * Genera report DDT per periodo
   */
  async generatePeriodReport(dateFrom: Date, dateTo: Date): Promise<{
    totalDdts: number;
    totalItems: number;
    byCustomer: Array<{ customerId: string; customerName: string; count: number }>;
    byCarrier: Array<{ carrier: string | null; count: number }>;
    invoiced: number;
    notInvoiced: number;
  }> {
    const ddts = await prisma.dDT.findMany({
      where: {
        issueDate: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
      },
    });

    // Raggruppa per cliente
    const customerMap = new Map<string, { name: string; count: number }>();
    const carrierMap = new Map<string | null, number>();
    let totalItems = 0;
    let invoiced = 0;
    let notInvoiced = 0;

    for (const ddt of ddts) {
      // Conta items
      totalItems += ddt.items.length;

      // Fatturato/non fatturato
      if (ddt.isInvoiced) {
        invoiced++;
      } else {
        notInvoiced++;
      }

      // Per cliente
      if (ddt.customer) {
        const customerName = ddt.customer.businessName ||
          `${ddt.customer.firstName || ''} ${ddt.customer.lastName || ''}`.trim();
        const current = customerMap.get(ddt.customerId) || { name: customerName, count: 0 };
        customerMap.set(ddt.customerId, { name: current.name, count: current.count + 1 });
      }

      // Per vettore
      const carrierCount = carrierMap.get(ddt.carrier) || 0;
      carrierMap.set(ddt.carrier, carrierCount + 1);
    }

    return {
      totalDdts: ddts.length,
      totalItems,
      byCustomer: Array.from(customerMap.entries()).map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        count: data.count,
      })).sort((a, b) => b.count - a.count),
      byCarrier: Array.from(carrierMap.entries()).map(([carrier, count]) => ({
        carrier,
        count,
      })).sort((a, b) => b.count - a.count),
      invoiced,
      notInvoiced,
    };
  }

  /**
   * Clona un DDT esistente
   */
  async clone(id: string, options?: { newCustomerId?: string }) {
    const original = await this.getById(id);

    if (!original) {
      throw new Error('DDT originale non trovato');
    }

    // Prepara items per il clone
    const items = original.items.map((item) => ({
      productId: item.productId || undefined,
      variantId: item.variantId || undefined,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'pz',
      lotNumber: item.lotNumber || undefined,
      serialNumber: item.serialNumber || undefined,
      unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
    }));

    const shippingAddress = original.shippingAddress as Record<string, string>;

    // Crea nuovo DDT
    const newDdt = await this.create({
      customerId: options?.newCustomerId || original.customerId,
      shippingAddress: {
        street: shippingAddress?.street || '',
        city: shippingAddress?.city || '',
        province: shippingAddress?.province,
        zip: shippingAddress?.zip || '',
        country: shippingAddress?.country,
      },
      carrier: original.carrier || undefined,
      carrierNotes: original.carrierNotes || undefined,
      numberOfPackages: original.numberOfPackages || undefined,
      totalWeight: original.totalWeight ? Number(original.totalWeight) : undefined,
      transportReason: original.transportReason || undefined,
      shipmentAppearance: original.shipmentAppearance || undefined,
      notes: original.notes || undefined,
      items,
    });

    logger.info(`DDT clonato: ${original.ddtNumber} → ${newDdt.ddtNumber}`);

    return newDdt;
  }
}

export const ddtService = new DdtService();
