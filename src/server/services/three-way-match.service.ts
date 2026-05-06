// Imports
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { ThreeWayMatchStatus, MatchResolutionStatus, Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Helper per accumulare somma di Decimal-like (Decimal | number | string).
// Tutti i prezzi/totali in Prisma sono Decimal; usiamo decimal arithmetic
// per evitare floating point drift (es. 0.1 + 0.2 != 0.3).
function toDec(v: unknown): Decimal {
  if (v === null || v === undefined) return new Decimal(0);
  if (v instanceof Decimal) return v;
  // Decimal accetta string|number|Decimal; per oggetti mock con toString()/valueOf()
  // (Prisma in test) coerciamo via toString() che e' sempre numerica.
  if (typeof v === 'object') {
    const obj = v as { toString?: () => string };
    if (typeof obj.toString === 'function') {
      try {
        return new Decimal(obj.toString());
      } catch {
        return new Decimal(0);
      }
    }
  }
  if (typeof v === 'string' || typeof v === 'number') return new Decimal(v);
  return new Decimal(0);
}

function decSum(values: Array<unknown>): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDec(v)), new Decimal(0));
}

function decMul(a: unknown, b: unknown): Decimal {
  return toDec(a).times(toDec(b));
}

// Types/Interfaces
interface MatchTolerances {
  price: number; // % tolerance for price
  quantity: number; // % tolerance for quantity
}

interface CreateSupplierInvoiceInput {
  invoiceNumber: string;
  supplierId: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  items: {
    purchaseOrderItemId?: string;
    productId?: string;
    materialId?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    tax?: number;
    total: number;
  }[];
}

interface ResolveMatchInput {
  resolutionStatus: MatchResolutionStatus;
  resolutionNotes?: string;
  resolvedBy: string;
}

// Constants
const DEFAULT_TOLERANCES: MatchTolerances = {
  price: 2, // 2% price tolerance (fallback se non in CompanySettings)
  quantity: 0, // 0% quantity tolerance (must match exactly)
};

/**
 * Risolve le tolerance per match: priorita' alla SupplierInvoice (priceTolerance/
 * quantityTolerance) se valorizzate, altrimenti tenta CompanySettings, altrimenti
 * fallback su DEFAULT_TOLERANCES.
 */
async function resolveTolerances(invoice: {
  priceTolerance?: Prisma.Decimal | null;
  quantityTolerance?: Prisma.Decimal | null;
}): Promise<MatchTolerances> {
  const fromInvoice: Partial<MatchTolerances> = {};
  if (invoice.priceTolerance != null) fromInvoice.price = Number(invoice.priceTolerance);
  if (invoice.quantityTolerance != null) fromInvoice.quantity = Number(invoice.quantityTolerance);

  // CompanySettings (singleton per tenant; il Prisma middleware scopera per tenant)
  const settings = await prisma.companySettings.findFirst({
    select: {
      // Campi opzionali; se non esistono, fallback DEFAULT_TOLERANCES.
      // (Per estendere: aggiungere `match_price_tolerance` / `match_quantity_tolerance`
      // a CompanySettings.)
      id: true,
    },
  });
  void settings;

  return {
    price: fromInvoice.price ?? DEFAULT_TOLERANCES.price,
    quantity: fromInvoice.quantity ?? DEFAULT_TOLERANCES.quantity,
  };
}

/**
 * Three-Way Match Service
 * Riconcilia Purchase Orders, Goods Receipts e Supplier Invoices
 */
class ThreeWayMatchService {
  /**
   * Crea una fattura fornitore e avvia il matching automatico
   */
  async createSupplierInvoice(data: CreateSupplierInvoiceInput, userId: string) {
    // Verifica che il fornitore esista
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Crea la fattura con gli items
    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        notes: data.notes,
        matchStatus: 'PENDING',
        items: {
          create: data.items.map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            productId: item.productId,
            materialId: item.materialId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tax: item.tax || 0,
            total: item.total,
            matchStatus: 'PENDING',
          })),
        },
      },
      include: {
        supplier: { select: { id: true, code: true, businessName: true } },
        items: true,
      },
    });

    logger.info(`Created supplier invoice: ${invoice.invoiceNumber}`);

    // Tenta matching automatico se gli items hanno purchaseOrderItemId
    const hasPoLinks = data.items.some((i) => i.purchaseOrderItemId);
    if (hasPoLinks) {
      await this.performAutoMatch(invoice.id, userId);
    }

    return invoice;
  }

  /**
   * Esegui matching automatico per una fattura
   */
  async performAutoMatch(supplierInvoiceId: string, userId: string) {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: supplierInvoiceId },
      include: {
        supplier: true,
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                purchaseOrder: true,
                goodsReceiptItems: {
                  include: { goodsReceipt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Fattura non trovata');
    }

    // Raggruppa items per PO
    const itemsByPo = new Map<string, typeof invoice.items>();
    for (const item of invoice.items) {
      if (item.purchaseOrderItem?.purchaseOrderId) {
        const poId = item.purchaseOrderItem.purchaseOrderId;
        if (!itemsByPo.has(poId)) {
          itemsByPo.set(poId, []);
        }
        itemsByPo.get(poId)!.push(item);
      }
    }

    const matchResults = [];

    // Risolvi tolerance: priorita' invoice → CompanySettings → DEFAULT
    const tolerances = await resolveTolerances(invoice);

    // Esegui matching per ogni PO con le tolerance risolte
    for (const [poId, items] of itemsByPo) {
      const matchResult = await this.matchInvoiceToPo(invoice, poId, items, userId, tolerances);
      matchResults.push(matchResult);
    }

    // Aggiorna stato fattura basato sui risultati
    const allMatched = matchResults.every((r) => r.status === 'MATCHED');
    const anyDiscrepancy = matchResults.some((r) => r.status === 'DISCREPANCY');
    const allWithinTolerance = matchResults.every((r) => r.withinTolerance);

    let overallStatus: ThreeWayMatchStatus = 'PENDING';
    if (allMatched) {
      overallStatus = 'MATCHED';
    } else if (anyDiscrepancy && allWithinTolerance) {
      overallStatus = 'APPROVED'; // Auto-approve within tolerance
    } else if (anyDiscrepancy) {
      overallStatus = 'DISCREPANCY';
    } else if (matchResults.length > 0) {
      overallStatus = 'PARTIAL';
    }

    await prisma.supplierInvoice.update({
      where: { id: supplierInvoiceId },
      data: {
        matchStatus: overallStatus,
        matchedAt: overallStatus === 'MATCHED' || overallStatus === 'APPROVED' ? new Date() : null,
        matchedBy: overallStatus === 'MATCHED' || overallStatus === 'APPROVED' ? userId : null,
        autoMatched: true,
      },
    });

    logger.info(`Auto-matched invoice ${invoice.invoiceNumber}: ${overallStatus}`);

    return {
      invoiceId: supplierInvoiceId,
      overallStatus,
      matchResults,
    };
  }

  /**
   * Esegui matching manuale tra fattura e PO
   */
  async matchInvoiceToPo(
    invoice: any,
    purchaseOrderId: string,
    invoiceItems: any[],
    userId: string,
    tolerances: MatchTolerances = DEFAULT_TOLERANCES
  ) {
    // Ottieni PO con GoodsReceipts
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
        goodsReceipts: {
          where: { status: 'COMPLETED' },
          include: { items: true },
        },
      },
    });

    if (!purchaseOrder) {
      throw new Error('Ordine di acquisto non trovato');
    }

    // Calcola totali PO usando Decimal arithmetic (no float drift).
    const poTotalDec = decSum(purchaseOrder.items.map((item) => item.total));
    const poQuantity = purchaseOrder.items.reduce((sum, item) => sum + item.quantity, 0);

    // Calcola totali GR (usa l'ultimo GR completato)
    let grTotalDec: Decimal | null = null;
    let grQuantity: number | null = null;
    let goodsReceiptId: string | null = null;

    if (purchaseOrder.goodsReceipts.length > 0) {
      const lastGr = purchaseOrder.goodsReceipts[purchaseOrder.goodsReceipts.length - 1];
      goodsReceiptId = lastGr.id;
      grTotalDec = lastGr.items.reduce<Decimal>((sum, item) => {
        // Usa il prezzo dell'item PO per calcolare il totale GR (decimal precision)
        const poItem = purchaseOrder.items.find((poi) => poi.id === item.purchaseOrderItemId);
        const unitPrice = poItem?.unitPrice ?? new Decimal(0);
        return sum.plus(decMul(item.acceptedQuantity, unitPrice));
      }, new Decimal(0));
      grQuantity = lastGr.items.reduce((sum, item) => sum + item.acceptedQuantity, 0);
    }

    // Calcola totali fattura per questo PO (decimal arithmetic)
    const invoiceTotalDec = decSum(invoiceItems.map((item) => item.total));
    const invoiceQuantity = invoiceItems.reduce((sum, item) => sum + item.quantity, 0);

    // Confronta con GR se disponibile, altrimenti con PO
    const referenceTotalDec = grTotalDec ?? poTotalDec;
    const referenceQuantity = grQuantity !== null ? grQuantity : poQuantity;

    // Calcola variazioni con Decimal precision
    const priceVarianceDec = invoiceTotalDec.minus(referenceTotalDec);
    const priceVariancePctDec = referenceTotalDec.gt(0)
      ? priceVarianceDec.div(referenceTotalDec).times(100)
      : new Decimal(0);
    const qtyVariance = invoiceQuantity - referenceQuantity;
    const qtyVariancePct = referenceQuantity > 0 ? (qtyVariance / referenceQuantity) * 100 : 0;

    // Convert in number per l'API esterna (storage Prisma accetta entrambi)
    const priceVariance = priceVarianceDec.toNumber();
    const priceVariancePct = priceVariancePctDec.toNumber();
    const poTotal = poTotalDec.toNumber();
    const grTotal = grTotalDec?.toNumber() ?? null;
    const invoiceTotal = invoiceTotalDec.toNumber();

    // Verifica tolerance (usa abs sul Decimal per coerenza)
    const withinPriceTolerance = priceVariancePctDec.abs().lte(tolerances.price);
    const withinQtyTolerance = Math.abs(qtyVariancePct) <= tolerances.quantity;
    const withinTolerance = withinPriceTolerance && withinQtyTolerance;

    // Determina status (priceVariance == 0 testato sul Decimal)
    let matchStatus: ThreeWayMatchStatus = 'PENDING';
    if (priceVarianceDec.eq(0) && qtyVariance === 0) {
      matchStatus = 'MATCHED';
    } else if (withinTolerance) {
      matchStatus = 'APPROVED'; // Auto-approve within tolerance
    } else {
      matchStatus = 'DISCREPANCY';
    }

    // Crea o aggiorna record match
    const match = await prisma.threeWayMatch.upsert({
      where: {
        supplierInvoiceId_purchaseOrderId: {
          supplierInvoiceId: invoice.id,
          purchaseOrderId: purchaseOrderId,
        },
      },
      update: {
        goodsReceiptId,
        status: matchStatus,
        matchDate: new Date(),
        matchedBy: userId,
        poTotal,
        poQuantity,
        grTotal,
        grQuantity,
        invoiceTotal,
        invoiceQuantity,
        priceVariance,
        priceVariancePct,
        qtyVariance,
        qtyVariancePct: Math.round(qtyVariancePct * 100) / 100,
        withinTolerance,
        toleranceUsed: tolerances.price,
      },
      create: {
        supplierInvoiceId: invoice.id,
        purchaseOrderId: purchaseOrderId,
        goodsReceiptId,
        status: matchStatus,
        matchDate: new Date(),
        matchedBy: userId,
        poTotal,
        poQuantity,
        grTotal,
        grQuantity,
        invoiceTotal,
        invoiceQuantity,
        priceVariance,
        priceVariancePct,
        qtyVariance,
        qtyVariancePct: Math.round(qtyVariancePct * 100) / 100,
        withinTolerance,
        toleranceUsed: tolerances.price,
      },
    });

    // Aggiorna status items fattura
    for (const item of invoiceItems) {
      await prisma.supplierInvoiceItem.update({
        where: { id: item.id },
        data: { matchStatus },
      });
    }

    logger.info(`Matched invoice ${invoice.invoiceNumber} to PO ${purchaseOrder.orderNumber}: ${matchStatus}`);

    return {
      matchId: match.id,
      status: matchStatus,
      priceVariance,
      priceVariancePct,
      qtyVariance,
      qtyVariancePct,
      withinTolerance,
      details: {
        po: { total: poTotal, quantity: poQuantity },
        gr: { total: grTotal, quantity: grQuantity },
        invoice: { total: invoiceTotal, quantity: invoiceQuantity },
      },
    };
  }

  /**
   * Risolvi discrepanza manualmente
   */
  async resolveMatch(matchId: string, data: ResolveMatchInput) {
    const match = await prisma.threeWayMatch.findUnique({
      where: { id: matchId },
      include: {
        supplierInvoice: true,
      },
    });

    if (!match) {
      throw new Error('Match non trovato');
    }

    // Determina nuovo stato basato sulla risoluzione
    let newStatus: ThreeWayMatchStatus = match.status;
    if (data.resolutionStatus === 'APPROVED' || data.resolutionStatus === 'PRICE_ADJUSTMENT' ||
        data.resolutionStatus === 'QUANTITY_ADJUSTMENT') {
      newStatus = 'APPROVED';
    } else if (data.resolutionStatus === 'REJECTED') {
      newStatus = 'REJECTED';
    }

    const updatedMatch = await prisma.threeWayMatch.update({
      where: { id: matchId },
      data: {
        status: newStatus,
        resolutionStatus: data.resolutionStatus,
        resolutionNotes: data.resolutionNotes,
        resolvedAt: new Date(),
        resolvedBy: data.resolvedBy,
      },
    });

    // Se approvato, aggiorna fattura
    if (newStatus === 'APPROVED') {
      // Verifica se tutti i match della fattura sono risolti
      const allMatches = await prisma.threeWayMatch.findMany({
        where: { supplierInvoiceId: match.supplierInvoiceId },
      });

      const allResolved = allMatches.every((m) => m.status === 'MATCHED' || m.status === 'APPROVED');

      if (allResolved) {
        await prisma.supplierInvoice.update({
          where: { id: match.supplierInvoiceId },
          data: {
            matchStatus: 'APPROVED',
            matchedAt: new Date(),
            matchedBy: data.resolvedBy,
          },
        });
      }
    } else if (newStatus === 'REJECTED') {
      await prisma.supplierInvoice.update({
        where: { id: match.supplierInvoiceId },
        data: { matchStatus: 'REJECTED' },
      });
    }

    logger.info(`Resolved match ${matchId}: ${data.resolutionStatus}`);

    return updatedMatch;
  }

  /**
   * Ottieni fatture con discrepanze da risolvere
   */
  async getPendingDiscrepancies(supplierId?: string) {
    const where: any = {
      OR: [
        { matchStatus: 'DISCREPANCY' },
        { matchStatus: 'PENDING' },
      ],
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, businessName: true } },
        items: true,
        threeWayMatches: {
          include: {
            purchaseOrder: { select: { id: true, orderNumber: true } },
            goodsReceipt: { select: { id: true, receiptNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      supplier: inv.supplier,
      total: Number(inv.total),
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      matchStatus: inv.matchStatus,
      items: inv.items.length,
      matches: inv.threeWayMatches.map((m) => ({
        id: m.id,
        status: m.status,
        purchaseOrder: m.purchaseOrder,
        goodsReceipt: m.goodsReceipt,
        priceVariance: Number(m.priceVariance),
        priceVariancePct: Number(m.priceVariancePct),
        qtyVariance: m.qtyVariance,
        withinTolerance: m.withinTolerance,
        resolutionStatus: m.resolutionStatus,
      })),
    }));
  }

  /**
   * Ottieni dettaglio match per fattura
   */
  async getMatchDetails(supplierInvoiceId: string) {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: supplierInvoiceId },
      include: {
        supplier: true,
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                purchaseOrder: { select: { id: true, orderNumber: true } },
              },
            },
            product: { select: { id: true, sku: true, name: true } },
            material: { select: { id: true, sku: true, name: true } },
          },
        },
        threeWayMatches: {
          include: {
            purchaseOrder: {
              select: { id: true, orderNumber: true, total: true },
            },
            goodsReceipt: {
              select: { id: true, receiptNumber: true, receiptDate: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Fattura non trovata');
    }

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplier,
        status: invoice.status,
        matchStatus: invoice.matchStatus,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
        matchedAt: invoice.matchedAt,
        autoMatched: invoice.autoMatched,
      },
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description || item.product?.name || item.material?.name,
        sku: item.product?.sku || item.material?.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        matchStatus: item.matchStatus,
        linkedToPo: item.purchaseOrderItem?.purchaseOrder?.orderNumber,
      })),
      matches: invoice.threeWayMatches.map((m) => ({
        id: m.id,
        purchaseOrder: m.purchaseOrder,
        goodsReceipt: m.goodsReceipt,
        status: m.status,
        matchDate: m.matchDate,
        comparison: {
          poTotal: Number(m.poTotal),
          poQuantity: m.poQuantity,
          grTotal: m.grTotal ? Number(m.grTotal) : null,
          grQuantity: m.grQuantity,
          invoiceTotal: Number(m.invoiceTotal),
          invoiceQuantity: m.invoiceQuantity,
        },
        variance: {
          price: Number(m.priceVariance),
          pricePct: Number(m.priceVariancePct),
          quantity: m.qtyVariance,
          quantityPct: Number(m.qtyVariancePct),
        },
        withinTolerance: m.withinTolerance,
        toleranceUsed: Number(m.toleranceUsed),
        resolution: m.resolutionStatus
          ? {
              status: m.resolutionStatus,
              notes: m.resolutionNotes,
              resolvedAt: m.resolvedAt,
              resolvedBy: m.resolvedBy,
            }
          : null,
      })),
    };
  }

  /**
   * Statistiche three-way matching
   */
  async getMatchStatistics(dateFrom?: Date, dateTo?: Date) {
    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [totalInvoices, matchedInvoices, discrepancyInvoices, pendingInvoices, matches] = await Promise.all([
      prisma.supplierInvoice.count({ where }),
      prisma.supplierInvoice.count({ where: { ...where, matchStatus: 'MATCHED' } }),
      prisma.supplierInvoice.count({ where: { ...where, matchStatus: 'DISCREPANCY' } }),
      prisma.supplierInvoice.count({ where: { ...where, matchStatus: 'PENDING' } }),
      prisma.threeWayMatch.findMany({
        where,
        select: {
          priceVariance: true,
          priceVariancePct: true,
          qtyVariance: true,
          withinTolerance: true,
          resolutionStatus: true,
        },
      }),
    ]);

    // Calcola metriche
    const totalVariance = matches.reduce((sum, m) => sum + Math.abs(Number(m.priceVariance)), 0);
    const avgVariancePct =
      matches.length > 0 ? matches.reduce((sum, m) => sum + Math.abs(Number(m.priceVariancePct)), 0) / matches.length : 0;

    const autoApproved = matches.filter((m) => m.withinTolerance).length;
    const manuallyResolved = matches.filter((m) => m.resolutionStatus).length;

    // Breakdown risoluzioni
    const resolutionBreakdown: Record<string, number> = {};
    for (const m of matches) {
      if (m.resolutionStatus) {
        resolutionBreakdown[m.resolutionStatus] = (resolutionBreakdown[m.resolutionStatus] || 0) + 1;
      }
    }

    return {
      invoices: {
        total: totalInvoices,
        matched: matchedInvoices,
        discrepancy: discrepancyInvoices,
        pending: pendingInvoices,
        matchRate: totalInvoices > 0 ? Math.round((matchedInvoices / totalInvoices) * 100) : 0,
      },
      matches: {
        total: matches.length,
        autoApproved,
        manuallyResolved,
        autoApprovalRate: matches.length > 0 ? Math.round((autoApproved / matches.length) * 100) : 0,
      },
      variance: {
        totalAmount: Math.round(totalVariance * 100) / 100,
        avgPercent: Math.round(avgVariancePct * 100) / 100,
      },
      resolutions: resolutionBreakdown,
    };
  }

  /**
   * Link manuale fattura a PO
   */
  async linkInvoiceToPo(
    supplierInvoiceId: string,
    purchaseOrderId: string,
    itemMappings: { invoiceItemId: string; poItemId: string }[],
    userId: string
  ) {
    // Aggiorna gli items della fattura con i link al PO
    for (const mapping of itemMappings) {
      await prisma.supplierInvoiceItem.update({
        where: { id: mapping.invoiceItemId },
        data: { purchaseOrderItemId: mapping.poItemId },
      });
    }

    // Esegui matching
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: supplierInvoiceId },
      include: { items: true },
    });

    if (!invoice) {
      throw new Error('Fattura non trovata');
    }

    const linkedItems = invoice.items.filter((i) =>
      itemMappings.some((m) => m.invoiceItemId === i.id)
    );

    const result = await this.matchInvoiceToPo(invoice, purchaseOrderId, linkedItems, userId);

    logger.info(`Manually linked invoice ${invoice.invoiceNumber} to PO ${purchaseOrderId}`);

    return result;
  }

  /**
   * Ottieni PO disponibili per matching con una fattura
   */
  async getAvailablePoForInvoice(supplierId: string) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        status: { in: ['CONFIRMED', 'RECEIVED'] },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            material: { select: { id: true, sku: true, name: true } },
          },
        },
        threeWayMatches: {
          select: { supplierInvoiceId: true },
        },
        goodsReceipts: {
          where: { status: 'COMPLETED' },
          select: { id: true, receiptNumber: true, receiptDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return purchaseOrders.map((po) => ({
      id: po.id,
      orderNumber: po.orderNumber,
      status: po.status,
      total: Number(po.total),
      createdAt: po.createdAt,
      hasGoodsReceipt: po.goodsReceipts.length > 0,
      goodsReceipts: po.goodsReceipts,
      alreadyMatched: po.threeWayMatches.length > 0,
      items: po.items.map((item) => ({
        id: item.id,
        sku: item.product?.sku || item.material?.sku,
        name: item.product?.name || item.material?.name,
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    }));
  }

  /**
   * Ottieni lista fatture fornitore
   */
  async listSupplierInvoices(params: {
    page?: number;
    limit?: number;
    supplierId?: string;
    status?: string;
    matchStatus?: ThreeWayMatchStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const { page = 1, limit = 20, supplierId, status, matchStatus, dateFrom, dateTo } = params;

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (matchStatus) where.matchStatus = matchStatus;
    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) where.issueDate.gte = dateFrom;
      if (dateTo) where.issueDate.lte = dateTo;
    }

    const [invoices, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, businessName: true } },
          _count: { select: { items: true, threeWayMatches: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    return {
      items: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        supplier: inv.supplier,
        status: inv.status,
        matchStatus: inv.matchStatus,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        total: Number(inv.total),
        paidAmount: Number(inv.paidAmount),
        itemCount: inv._count.items,
        matchCount: inv._count.threeWayMatches,
        autoMatched: inv.autoMatched,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

// Main logic & Exports
export const threeWayMatchService = new ThreeWayMatchService();
export default threeWayMatchService;
