import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import bomService from './bom.service';
import logger from '../config/logger';

/**
 * Interfaccia per un item della picking list
 */
interface PickingListItem {
  sku: string;
  name: string;
  location: string;
  quantity: number;
  unit: string;
  notes?: string;
  isPicked?: boolean;
  isMaterial: boolean;
  // Informazioni aggiuntive per magazziniere
  binLocation?: string;
  lotNumber?: string;
  batchRequired?: boolean;
}

/**
 * Interfaccia per la picking list completa
 */
interface PickingListData {
  pickingListNumber: string;
  date: Date;
  reference: string;
  referenceType: 'PRODUCTION_ORDER' | 'SALES_ORDER';
  warehouseName: string;
  location: string;
  items: PickingListItem[];
  notes?: string;
  assignedTo?: string;
  priority: number;
  // Riassunto
  totalItems: number;
  totalQuantity: number;
}

/**
 * PickingList Service
 * Generazione picking list per ordini di produzione e vendita
 */
class PickingListService {
  private companyName: string;

  constructor() {
    this.companyName = process.env.COMPANY_NAME || 'FabbricaMi ERP';
  }

  // =============================================
  // GENERAZIONE PICKING LIST DATA
  // =============================================

  /**
   * Genera picking list per ordine di produzione
   * Include tutti i materiali necessari dalle fasi
   */
  async generateForProductionOrder(
    productionOrderId: string,
    options?: {
      location?: string;
      includeSubProducts?: boolean;
    }
  ): Promise<PickingListData> {
    const order = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        product: true,
        phases: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          orderBy: { sequence: 'asc' },
          include: {
            manufacturingPhase: {
              include: {
                materials: {
                  include: { material: true }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new Error('Ordine di produzione non trovato');
    }

    const location = options?.location || 'WEB';
    const primaryWarehouse = await prisma.warehouse.findFirst({
      where: { isPrimary: true }
    });

    // Raccogli tutti i materiali dalle fasi
    const materialMap = new Map<string, {
      material: any;
      totalQty: number;
      phases: string[];
    }>();

    for (const phase of order.phases) {
      for (const pm of phase.manufacturingPhase.materials) {
        // Calcola quantità necessaria con scarto
        const effectiveQty = Number(pm.quantity) * order.quantity * (1 + Number(pm.scrapPercentage) / 100);

        const existing = materialMap.get(pm.materialId);
        if (existing) {
          existing.totalQty += effectiveQty;
          existing.phases.push(phase.manufacturingPhase.name);
        } else {
          materialMap.set(pm.materialId, {
            material: pm.material,
            totalQty: effectiveQty,
            phases: [phase.manufacturingPhase.name]
          });
        }
      }
    }

    // Se richiesto, aggiungi anche componenti BOM
    let bomItems: PickingListItem[] = [];
    if (options?.includeSubProducts) {
      try {
        const leafComponents = await bomService.getLeafComponents(order.productId, order.quantity);

        // Aggrega per prodotto
        const bomAggregated = new Map<string, { item: any; totalQty: number }>();
        for (const comp of leafComponents) {
          const existing = bomAggregated.get(comp.productId);
          if (existing) {
            existing.totalQty += comp.quantity;
          } else {
            bomAggregated.set(comp.productId, { item: comp, totalQty: comp.quantity });
          }
        }

        for (const [, { item, totalQty }] of bomAggregated) {
          bomItems.push({
            sku: item.sku,
            name: item.name,
            location,
            quantity: Math.ceil(totalQty),
            unit: item.unit,
            isMaterial: false,
            notes: 'Componente BOM'
          });
        }
      } catch (error) {
        logger.warn(`Errore esplosione BOM per picking list: ${error}`);
      }
    }

    // Costruisci lista items
    const items: PickingListItem[] = [];

    for (const [, { material, totalQty, phases }] of materialMap) {
      items.push({
        sku: material.sku,
        name: material.name,
        location,
        quantity: Math.ceil(totalQty),
        unit: material.unit,
        isMaterial: true,
        notes: phases.length > 1 ? `Fasi: ${phases.join(', ')}` : `Fase: ${phases[0]}`
      });
    }

    // Aggiungi componenti BOM
    items.push(...bomItems);

    // Ordina per SKU
    items.sort((a, b) => a.sku.localeCompare(b.sku));

    // Genera numero picking list
    const pickingListNumber = await this.generatePickingListNumber('PL-MO');

    return {
      pickingListNumber,
      date: new Date(),
      reference: order.orderNumber,
      referenceType: 'PRODUCTION_ORDER',
      warehouseName: primaryWarehouse?.name || 'Magazzino Principale',
      location,
      items,
      notes: order.notes || undefined,
      priority: order.priority,
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0)
    };
  }

  /**
   * Genera picking list per ordine di vendita
   * Include tutti i prodotti dell'ordine
   */
  async generateForSalesOrder(
    salesOrderId: string,
    options?: {
      location?: string;
    }
  ): Promise<PickingListData> {
    const order = await prisma.order.findUnique({
      where: { id: salesOrderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        },
        customer: true
      }
    });

    if (!order) {
      throw new Error('Ordine di vendita non trovato');
    }

    const location = options?.location || 'WEB';
    const primaryWarehouse = await prisma.warehouse.findFirst({
      where: { isPrimary: true }
    });

    // Costruisci lista items
    const items: PickingListItem[] = [];

    for (const item of order.items) {
      // Verifica stock disponibile
      const inventory = await prisma.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          location: location as any,
          ...(item.variantId && { variantId: item.variantId })
        }
      });

      items.push({
        sku: item.variant?.sku || item.product.sku,
        name: item.productName || item.product.name,
        location,
        quantity: item.quantity,
        unit: item.product.unit,
        isMaterial: false,
        notes: (inventory?.quantity || 0) < item.quantity
          ? `⚠️ Stock insufficiente (${inventory?.quantity || 0} disponibili)`
          : undefined
      });
    }

    // Ordina per SKU
    items.sort((a, b) => a.sku.localeCompare(b.sku));

    // Genera numero picking list
    const pickingListNumber = await this.generatePickingListNumber('PL-SO');

    return {
      pickingListNumber,
      date: new Date(),
      reference: order.orderNumber,
      referenceType: 'SALES_ORDER',
      warehouseName: primaryWarehouse?.name || 'Magazzino Principale',
      location,
      items,
      notes: `Cliente: ${order.customer?.businessName || `${order.customer?.firstName} ${order.customer?.lastName}`}`,
      priority: order.priority || 0,
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0)
    };
  }

  // =============================================
  // PDF GENERATION
  // =============================================

  /**
   * Genera PDF picking list per ordine di produzione
   */
  async generateProductionOrderPickingListPdf(
    productionOrderId: string,
    options?: { location?: string; includeSubProducts?: boolean }
  ): Promise<Buffer> {
    const data = await this.generateForProductionOrder(productionOrderId, options);
    return this.createPickingListPdf(data);
  }

  /**
   * Genera PDF picking list per ordine di vendita
   */
  async generateSalesOrderPickingListPdf(
    salesOrderId: string,
    options?: { location?: string }
  ): Promise<Buffer> {
    const data = await this.generateForSalesOrder(salesOrderId, options);
    return this.createPickingListPdf(data);
  }

  /**
   * Crea PDF da dati picking list
   */
  private createPickingListPdf(data: PickingListData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('PICKING LIST', { align: 'center' });
      doc.moveDown(0.5);

      // Info documento
      doc.fontSize(11).font('Helvetica');

      // Box info a sinistra
      const leftCol = 50;
      const rightCol = 300;
      let yPos = doc.y;

      doc.font('Helvetica-Bold').text('N. Picking List:', leftCol, yPos);
      doc.font('Helvetica').text(data.pickingListNumber, leftCol + 100, yPos);

      doc.font('Helvetica-Bold').text('Data:', rightCol, yPos);
      doc.font('Helvetica').text(data.date.toLocaleDateString('it-IT'), rightCol + 60, yPos);

      yPos += 18;
      doc.font('Helvetica-Bold').text('Riferimento:', leftCol, yPos);
      doc.font('Helvetica').text(data.reference, leftCol + 100, yPos);

      doc.font('Helvetica-Bold').text('Tipo:', rightCol, yPos);
      doc.font('Helvetica').text(
        data.referenceType === 'PRODUCTION_ORDER' ? 'Ordine Produzione' : 'Ordine Vendita',
        rightCol + 60,
        yPos
      );

      yPos += 18;
      doc.font('Helvetica-Bold').text('Magazzino:', leftCol, yPos);
      doc.font('Helvetica').text(data.warehouseName, leftCol + 100, yPos);

      doc.font('Helvetica-Bold').text('Location:', rightCol, yPos);
      doc.font('Helvetica').text(data.location, rightCol + 60, yPos);

      // Priorità con colore
      yPos += 18;
      doc.font('Helvetica-Bold').text('Priorità:', leftCol, yPos);
      const priorityText = data.priority >= 8 ? 'URGENTE' : data.priority >= 5 ? 'Alta' : data.priority >= 3 ? 'Media' : 'Normale';
      const priorityColor = data.priority >= 8 ? '#dc3545' : data.priority >= 5 ? '#fd7e14' : '#28a745';
      doc.font('Helvetica-Bold').fillColor(priorityColor).text(priorityText, leftCol + 100, yPos);
      doc.fillColor('#000000');

      // Linea separatore
      yPos += 30;
      doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
      yPos += 15;

      // Tabella items
      const tableHeaders = ['☐', 'SKU', 'Descrizione', 'Qtà', 'U.M.', 'Note'];
      const colWidths = [25, 80, 200, 50, 40, 120];

      // Header tabella
      doc.font('Helvetica-Bold').fontSize(10);
      let xPos = 40;
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos, yPos, {
          width: colWidths[i],
          align: i === 3 ? 'right' : 'left'
        });
        xPos += colWidths[i];
      });

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
      yPos += 10;

      // Righe items
      doc.font('Helvetica').fontSize(9);
      const pageHeight = 780;

      for (const item of data.items) {
        // Controlla se serve nuova pagina
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = 50;

          // Ripeti header tabella
          doc.font('Helvetica-Bold').fontSize(10);
          xPos = 40;
          tableHeaders.forEach((header, i) => {
            doc.text(header, xPos, yPos, {
              width: colWidths[i],
              align: i === 3 ? 'right' : 'left'
            });
            xPos += colWidths[i];
          });
          yPos += 15;
          doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
          yPos += 10;
          doc.font('Helvetica').fontSize(9);
        }

        xPos = 40;

        // Checkbox vuota
        doc.rect(xPos + 5, yPos - 2, 10, 10).stroke();
        xPos += colWidths[0];

        // SKU
        doc.text(item.sku, xPos, yPos, { width: colWidths[1] - 5 });
        xPos += colWidths[1];

        // Nome (con indicatore se materiale)
        const namePrefix = item.isMaterial ? '[M] ' : '';
        doc.text(namePrefix + item.name.substring(0, 35), xPos, yPos, { width: colWidths[2] - 5 });
        xPos += colWidths[2];

        // Quantità
        doc.text(item.quantity.toString(), xPos, yPos, { width: colWidths[3] - 5, align: 'right' });
        xPos += colWidths[3];

        // Unità misura
        doc.text(item.unit, xPos, yPos, { width: colWidths[4] - 5 });
        xPos += colWidths[4];

        // Note
        if (item.notes) {
          doc.fontSize(8).text(item.notes.substring(0, 25), xPos, yPos, { width: colWidths[5] - 5 });
          doc.fontSize(9);
        }

        yPos += 20;
      }

      // Linea fine tabella
      doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
      yPos += 15;

      // Riepilogo
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text(`Totale righe: ${data.totalItems}`, 350, yPos);
      yPos += 15;
      doc.text(`Totale quantità: ${data.totalQuantity}`, 350, yPos);

      // Note ordine
      if (data.notes) {
        yPos += 25;
        doc.font('Helvetica-Bold').text('Note:', 40, yPos);
        doc.font('Helvetica').fontSize(10);
        doc.text(data.notes, 40, yPos + 15, { width: 515 });
      }

      // Legenda
      yPos = pageHeight - 60;
      doc.fontSize(8).font('Helvetica');
      doc.text('[M] = Materiale', 40, yPos);
      doc.text('☐ = Spuntare quando prelevato', 40, yPos + 12);

      // Firma
      doc.text('Prelevato da: _______________________', 300, yPos);
      doc.text('Data/Ora: _______________________', 300, yPos + 12);

      // Footer
      doc.fontSize(8).text(
        `Generato da ${this.companyName} - ${new Date().toLocaleString('it-IT')}`,
        40,
        pageHeight - 20,
        { align: 'center' }
      );

      doc.end();
    });
  }

  // =============================================
  // UTILITY
  // =============================================

  /**
   * Genera numero univoco picking list
   */
  private async generatePickingListNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const time = Date.now().toString().slice(-6);

    return `${prefix}-${year}${month}${day}-${time}`;
  }

  /**
   * Verifica disponibilità materiali per picking list produzione
   */
  async checkMaterialsAvailability(productionOrderId: string): Promise<{
    available: boolean;
    shortages: Array<{
      sku: string;
      name: string;
      required: number;
      available: number;
      shortage: number;
    }>;
  }> {
    const pickingList = await this.generateForProductionOrder(productionOrderId);

    const shortages: Array<{
      sku: string;
      name: string;
      required: number;
      available: number;
      shortage: number;
    }> = [];

    for (const item of pickingList.items) {
      if (item.isMaterial) {
        // Controlla stock materiale
        const material = await prisma.material.findFirst({
          where: { sku: item.sku },
          select: { currentStock: true }
        });

        const available = material?.currentStock || 0;
        if (available < item.quantity) {
          shortages.push({
            sku: item.sku,
            name: item.name,
            required: item.quantity,
            available,
            shortage: item.quantity - available
          });
        }
      } else {
        // Controlla stock prodotto
        const inventory = await prisma.inventoryItem.findFirst({
          where: {
            product: { sku: item.sku },
            location: item.location as any
          },
          select: { quantity: true, reservedQuantity: true }
        });

        const available = Math.max(0, (inventory?.quantity || 0) - (inventory?.reservedQuantity || 0));
        if (available < item.quantity) {
          shortages.push({
            sku: item.sku,
            name: item.name,
            required: item.quantity,
            available,
            shortage: item.quantity - available
          });
        }
      }
    }

    return {
      available: shortages.length === 0,
      shortages
    };
  }
}

export const pickingListService = new PickingListService();
export default pickingListService;
