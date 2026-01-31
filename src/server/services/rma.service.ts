/**
 * RMA Service
 * Gestione Resi e Autorizzazioni al Reso (Return Merchandise Authorization)
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { Prisma, RmaStatus, RmaReason, RmaResolution } from '@prisma/client';
import { inventoryService } from './inventory.service';

/**
 * Input per creazione RMA
 */
interface CreateRmaInput {
  orderId: string;
  customerId: string;
  reason: RmaReason;
  reasonDetail?: string;
  customerEmail?: string;
  items: Array<{
    orderItemId: string;
    productId: string;
    variantId?: string;
    sku: string;
    productName: string;
    quantityRequested: number;
    unitPrice: number;
  }>;
}

/**
 * Query per lista RMA
 */
interface RmaQuery {
  page?: number;
  limit?: number;
  status?: RmaStatus;
  customerId?: string;
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
  reason?: RmaReason;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Input per approvazione RMA
 */
interface ApproveRmaInput {
  approvedBy: string;
  returnShippingMethod?: string;
  returnLabelUrl?: string;
  internalNotes?: string;
}

/**
 * Input per ricezione reso
 */
interface ReceiveRmaInput {
  receivedBy: string;
  items: Array<{
    rmaItemId: string;
    quantityReceived: number;
    condition: string; // LIKE_NEW, GOOD, FAIR, DAMAGED, UNUSABLE
    conditionNotes?: string;
    canRestock: boolean;
  }>;
  inspectionNotes?: string;
}

/**
 * Input per completamento RMA
 */
interface CompleteRmaInput {
  completedBy: string;
  resolution: RmaResolution;
  resolutionNotes?: string;
  refundAmount?: number;
  exchangeOrderId?: string;
  storeCreditCode?: string;
}

/**
 * Servizio per gestione RMA
 */
class RmaService {
  /**
   * Genera il prossimo numero RMA
   */
  private async generateRmaNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RMA-${year}`;

    // Trova l'ultimo RMA dell'anno
    const lastRma = await prisma.rMA.findFirst({
      where: {
        rmaNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { rmaNumber: 'desc' },
    });

    let nextNumber = 1;
    if (lastRma) {
      const lastNumber = parseInt(lastRma.rmaNumber.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(5, '0')}`;
  }

  /**
   * Lista RMA con filtri e paginazione
   */
  async list(params: RmaQuery) {
    const {
      page = 1,
      limit = 50,
      status,
      customerId,
      orderId,
      dateFrom,
      dateTo,
      reason,
      search,
      sortBy = 'requestedAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.RMAWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (reason) {
      where.reason = reason;
    }

    if (dateFrom || dateTo) {
      where.requestedAt = {};
      if (dateFrom) {
        where.requestedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.requestedAt.lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { rmaNumber: { contains: search, mode: 'insensitive' } },
        { reasonDetail: { contains: search, mode: 'insensitive' } },
        { customer: { businessName: { contains: search, mode: 'insensitive' } } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.RMAOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [rmas, total] = await Promise.all([
      prisma.rMA.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              businessName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderDate: true,
              total: true,
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
      prisma.rMA.count({ where }),
    ]);

    return {
      items: rmas,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Recupera un RMA per ID
   */
  async getById(id: string) {
    return prisma.rMA.findUnique({
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
        },
      },
    });
  }

  /**
   * Recupera un RMA per numero
   */
  async getByNumber(rmaNumber: string) {
    return prisma.rMA.findUnique({
      where: { rmaNumber },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });
  }

  /**
   * Crea una nuova richiesta RMA
   */
  async create(data: CreateRmaInput) {
    // Verifica che l'ordine esista
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, customer: { select: { email: true } } },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Verifica che il cliente corrisponda
    if (order.customerId !== data.customerId) {
      throw new Error('Il cliente non corrisponde all\'ordine');
    }

    // Verifica che gli items siano validi
    for (const item of data.items) {
      const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new Error(`Item ordine ${item.orderItemId} non trovato`);
      }
      if (item.quantityRequested > orderItem.quantity) {
        throw new Error(`Quantità richiesta per ${item.sku} superiore a quella ordinata`);
      }
    }

    // Genera numero RMA
    const rmaNumber = await this.generateRmaNumber();

    // Crea RMA con items
    const rma = await prisma.rMA.create({
      data: {
        rmaNumber,
        orderId: data.orderId,
        customerId: data.customerId,
        status: 'REQUESTED',
        reason: data.reason,
        reasonDetail: data.reasonDetail,
        customerEmail: data.customerEmail || order.customer?.email,
        items: {
          create: data.items.map((item) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            productName: item.productName,
            quantityRequested: item.quantityRequested,
            unitPrice: item.unitPrice,
            totalValue: item.unitPrice * item.quantityRequested,
            itemStatus: 'PENDING',
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
        },
      },
    });

    logger.info(`RMA creato: ${rmaNumber}`);

    return rma;
  }

  /**
   * Approva un RMA
   */
  async approve(id: string, data: ApproveRmaInput) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status !== 'REQUESTED' && rma.status !== 'PENDING') {
      throw new Error(`Impossibile approvare RMA con stato ${rma.status}`);
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: data.approvedBy,
        returnShippingMethod: data.returnShippingMethod,
        returnLabelUrl: data.returnLabelUrl,
        internalNotes: data.internalNotes,
      },
      include: {
        customer: true,
        order: true,
        items: true,
      },
    });

    // Aggiorna stato items
    await prisma.rMAItem.updateMany({
      where: { rmaId: id },
      data: { itemStatus: 'APPROVED' },
    });

    logger.info(`RMA approvato: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Rifiuta un RMA
   */
  async reject(id: string, rejectedBy: string, reason?: string) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status === 'COMPLETED' || rma.status === 'REJECTED') {
      throw new Error(`Impossibile rifiutare RMA con stato ${rma.status}`);
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy,
        resolutionNotes: reason,
      },
      include: {
        customer: true,
        order: true,
        items: true,
      },
    });

    // Aggiorna stato items
    await prisma.rMAItem.updateMany({
      where: { rmaId: id },
      data: { itemStatus: 'REJECTED' },
    });

    logger.info(`RMA rifiutato: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Aggiorna tracking spedizione cliente
   */
  async updateShipping(id: string, trackingNumber: string, carrier?: string) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status !== 'APPROVED') {
      throw new Error('RMA deve essere approvato per aggiungere tracking');
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        returnTrackingNumber: trackingNumber,
        returnCarrier: carrier,
        shippedByCustomerAt: new Date(),
      },
    });

    logger.info(`Tracking aggiornato per RMA: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Ricevi il reso in magazzino
   */
  async receive(id: string, data: ReceiveRmaInput) {
    const rma = await prisma.rMA.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status !== 'SHIPPED' && rma.status !== 'APPROVED') {
      throw new Error(`Impossibile ricevere RMA con stato ${rma.status}`);
    }

    // Aggiorna items ricevuti
    for (const itemData of data.items) {
      const rmaItem = rma.items.find((i) => i.id === itemData.rmaItemId);
      if (!rmaItem) {
        throw new Error(`Item RMA ${itemData.rmaItemId} non trovato`);
      }

      await prisma.rMAItem.update({
        where: { id: itemData.rmaItemId },
        data: {
          quantityReceived: itemData.quantityReceived,
          condition: itemData.condition,
          conditionNotes: itemData.conditionNotes,
          canRestock: itemData.canRestock,
          itemStatus: 'RECEIVED',
        },
      });
    }

    // Aggiorna RMA
    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
        receivedBy: data.receivedBy,
        inspectionNotes: data.inspectionNotes,
      },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    logger.info(`RMA ricevuto: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Avvia ispezione
   */
  async startInspection(id: string, inspectedBy: string) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status !== 'RECEIVED') {
      throw new Error('RMA deve essere ricevuto per iniziare l\'ispezione');
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'INSPECTING',
        inspectedBy,
      },
    });

    logger.info(`Ispezione iniziata per RMA: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Completa ispezione con risultato
   */
  async completeInspection(
    id: string,
    inspectedBy: string,
    notes: string,
    itemCondition: string,
    photos?: Array<{ url: string; description?: string }>
  ) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status !== 'INSPECTING' && rma.status !== 'RECEIVED') {
      throw new Error('RMA deve essere in ispezione');
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        inspectedAt: new Date(),
        inspectedBy,
        inspectionNotes: notes,
        itemCondition,
        inspectionPhotos: photos || undefined,
      },
      include: {
        items: true,
      },
    });

    logger.info(`Ispezione completata per RMA: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Completa RMA con risoluzione
   */
  async complete(id: string, data: CompleteRmaInput) {
    const rma = await prisma.rMA.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status === 'COMPLETED' || rma.status === 'REJECTED' || rma.status === 'CANCELLED') {
      throw new Error(`Impossibile completare RMA con stato ${rma.status}`);
    }

    // Se risoluzione è rimborso, verifica importo
    if ((data.resolution === 'REFUND' || data.resolution === 'PARTIAL_REFUND') && !data.refundAmount) {
      // Calcola importo rimborso automaticamente se non specificato
      const totalValue = rma.items.reduce((sum, item) => {
        const qty = item.quantityReceived || item.quantityRequested;
        return sum + Number(item.unitPrice) * qty;
      }, 0);
      data.refundAmount = data.resolution === 'REFUND' ? totalValue : totalValue * 0.8; // 80% per parziale di default
    }

    // Aggiorna RMA
    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: data.completedBy,
        resolution: data.resolution,
        resolutionNotes: data.resolutionNotes,
        refundAmount: data.refundAmount,
        exchangeOrderId: data.exchangeOrderId,
        storeCreditCode: data.storeCreditCode,
      },
      include: {
        customer: true,
        order: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    logger.info(`RMA completato: ${rma.rmaNumber} - Risoluzione: ${data.resolution}`);

    return updated;
  }

  /**
   * Effettua restock degli items
   */
  async restockItems(id: string, location: string = 'WEB', userId: string) {
    const rma = await prisma.rMA.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    const restockedItems: Array<{ itemId: string; quantity: number }> = [];

    for (const item of rma.items) {
      // Solo items che possono essere restockati
      if (!item.canRestock || item.quantityRestocked) {
        continue;
      }

      const quantityToRestock = item.quantityReceived || 0;
      if (quantityToRestock <= 0) {
        continue;
      }

      // Aggiorna inventario
      await inventoryService.createMovement({
        type: 'RETURN',
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: quantityToRestock,
        unit: 'pz',
        locationId: location,
        referenceType: 'RETURN',
        referenceId: rma.id,
        notes: `Reso RMA ${rma.rmaNumber}`,
        userId,
      });

      // Aggiorna item RMA
      await prisma.rMAItem.update({
        where: { id: item.id },
        data: {
          quantityRestocked: quantityToRestock,
          itemStatus: 'RESTOCKED',
        },
      });

      restockedItems.push({ itemId: item.id, quantity: quantityToRestock });
    }

    logger.info(`Restock completato per RMA: ${rma.rmaNumber} - ${restockedItems.length} items`);

    return {
      rmaId: id,
      restockedItems,
    };
  }

  /**
   * Annulla un RMA
   */
  async cancel(id: string, _cancelledBy: string, reason?: string) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    if (rma.status === 'COMPLETED' || rma.status === 'REJECTED') {
      throw new Error(`Impossibile annullare RMA con stato ${rma.status}`);
    }

    // Non permettere cancellazione se già ricevuto
    if (rma.status === 'RECEIVED' || rma.status === 'INSPECTING') {
      throw new Error('Impossibile annullare RMA già ricevuto');
    }

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        resolutionNotes: reason,
      },
    });

    logger.info(`RMA annullato: ${rma.rmaNumber}`);

    return updated;
  }

  /**
   * Statistiche RMA
   */
  async getStatistics(dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.RMAWhereInput = {};

    if (dateFrom || dateTo) {
      where.requestedAt = {};
      if (dateFrom) {
        where.requestedAt.gte = dateFrom;
      }
      if (dateTo) {
        where.requestedAt.lte = dateTo;
      }
    }

    const [
      totalRmas,
      byStatus,
      byReason,
      byResolution,
      // Note: avgProcessingTime is calculated manually below based on completedRmas
    ] = await Promise.all([
      prisma.rMA.count({ where }),
      prisma.rMA.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.rMA.groupBy({
        by: ['reason'],
        where,
        _count: { reason: true },
      }),
      prisma.rMA.groupBy({
        by: ['resolution'],
        where: { ...where, resolution: { not: null } },
        _count: { resolution: true },
      }),
    ]);

    // Calcola tempo medio di elaborazione
    const completedRmas = await prisma.rMA.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: {
        requestedAt: true,
        completedAt: true,
      },
    });

    let avgDays = 0;
    if (completedRmas.length > 0) {
      const totalDays = completedRmas.reduce((sum, rma) => {
        if (rma.completedAt) {
          const diff = rma.completedAt.getTime() - rma.requestedAt.getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgDays = totalDays / completedRmas.length;
    }

    // Calcola valore totale rimborsi
    const refundStats = await prisma.rMA.aggregate({
      where: {
        ...where,
        resolution: { in: ['REFUND', 'PARTIAL_REFUND'] },
        refundAmount: { not: null },
      },
      _sum: { refundAmount: true },
      _avg: { refundAmount: true },
    });

    return {
      totalRmas,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
      byReason: byReason.map((r) => ({ reason: r.reason, count: r._count.reason })),
      byResolution: byResolution.map((r) => ({ resolution: r.resolution, count: r._count.resolution })),
      avgProcessingDays: Math.round(avgDays * 10) / 10,
      totalRefunds: refundStats._sum.refundAmount ? Number(refundStats._sum.refundAmount) : 0,
      avgRefundAmount: refundStats._avg.refundAmount ? Number(refundStats._avg.refundAmount) : 0,
    };
  }

  /**
   * RMA recenti per dashboard
   */
  async getRecent(limit: number = 10) {
    return prisma.rMA.findMany({
      where: {
        status: { in: ['REQUESTED', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'INSPECTING'] },
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
        order: {
          select: {
            orderNumber: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * RMA in attesa di azione
   */
  async getPendingActions() {
    const [
      awaitingApproval,
      awaitingShipment,
      awaitingReceipt,
      awaitingInspection,
      awaitingResolution,
    ] = await Promise.all([
      prisma.rMA.count({ where: { status: 'REQUESTED' } }),
      prisma.rMA.count({ where: { status: 'APPROVED' } }),
      prisma.rMA.count({ where: { status: 'SHIPPED' } }),
      prisma.rMA.count({ where: { status: { in: ['RECEIVED', 'INSPECTING'] } } }),
      prisma.rMA.count({
        where: {
          status: 'INSPECTING',
          inspectedAt: { not: null },
          resolution: null,
        },
      }),
    ]);

    return {
      awaitingApproval,
      awaitingShipment,
      awaitingReceipt,
      awaitingInspection,
      awaitingResolution,
      total: awaitingApproval + awaitingShipment + awaitingReceipt + awaitingInspection + awaitingResolution,
    };
  }

  /**
   * Aggiunge nota interna
   */
  async addInternalNote(id: string, note: string) {
    const rma = await prisma.rMA.findUnique({ where: { id } });

    if (!rma) {
      throw new Error('RMA non trovato');
    }

    const currentNotes = rma.internalNotes || '';
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${note}`;
    const updatedNotes = currentNotes ? `${currentNotes}\n${newNote}` : newNote;

    const updated = await prisma.rMA.update({
      where: { id },
      data: { internalNotes: updatedNotes },
    });

    return updated;
  }
}

export const rmaService = new RmaService();
