import { prisma } from '../config/database';
import { GoodsReceiptStatus, InspectionStatus, QualityStatus, Prisma } from '@prisma/client';

// Input types
interface CreateGoodsReceiptInput {
  purchaseOrderId: string;
  warehouseId: string;
  documentDate?: Date;
  supplierDocNumber?: string;
  carrier?: string;
  trackingNumber?: string;
  deliveryNote?: string;
  inspectionRequired?: boolean;
  receivedBy?: string;
  notes?: string;
  items: Array<{
    purchaseOrderItemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity?: number;
    lotNumber?: string;
    expiryDate?: Date;
    storageLocation?: string;
    qualityNotes?: string;
  }>;
}

interface UpdateGoodsReceiptInput {
  documentDate?: Date;
  supplierDocNumber?: string;
  carrier?: string;
  trackingNumber?: string;
  deliveryNote?: string;
  inspectionRequired?: boolean;
  notes?: string;
}

interface ReceiveItemsInput {
  items: Array<{
    itemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity?: number;
    lotNumber?: string;
    expiryDate?: Date;
    storageLocation?: string;
    qualityStatus?: QualityStatus;
    qualityNotes?: string;
  }>;
}

interface InspectionInput {
  inspectionStatus: InspectionStatus;
  inspectionNotes?: string;
  inspectedBy: string;
  itemResults?: Array<{
    itemId: string;
    qualityStatus: QualityStatus;
    acceptedQuantity: number;
    rejectedQuantity: number;
    qualityNotes?: string;
  }>;
}

interface GoodsReceiptQuery {
  page?: number;
  limit?: number;
  status?: GoodsReceiptStatus;
  supplierId?: string;
  purchaseOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Goods Receipt Service
 * Gestione entrata merce (ricevimento merci da ordini d'acquisto)
 */
class GoodsReceiptService {
  /**
   * Lista entrate merce con filtri
   */
  async listGoodsReceipts(params: GoodsReceiptQuery) {
    const {
      page = 1,
      limit = 50,
      status,
      supplierId,
      purchaseOrderId,
      dateFrom,
      dateTo,
      sortBy = 'receiptDate',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.GoodsReceiptWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(purchaseOrderId && { purchaseOrderId }),
      ...(dateFrom || dateTo
        ? {
            receiptDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          supplier: {
            select: { id: true, code: true, businessName: true },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true } },
              material: { select: { id: true, sku: true, name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    // Calcola statistiche per ogni ricevimento
    const enrichedItems = items.map((item) => {
      const totalExpected = item.items.reduce((sum, i) => sum + i.expectedQuantity, 0);
      const totalReceived = item.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
      const totalAccepted = item.items.reduce((sum, i) => sum + i.acceptedQuantity, 0);
      const totalRejected = item.items.reduce((sum, i) => sum + i.rejectedQuantity, 0);

      return {
        ...item,
        stats: {
          totalExpected,
          totalReceived,
          totalAccepted,
          totalRejected,
          completionRate: totalExpected > 0 ? (totalReceived / totalExpected) * 100 : 0,
          qualityRate: totalReceived > 0 ? (totalAccepted / totalReceived) * 100 : 0,
        },
      };
    });

    return {
      items: enrichedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio entrata merce
   */
  async getGoodsReceiptById(id: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
                material: true,
              },
            },
          },
        },
        supplier: true,
        warehouse: true,
        items: {
          include: {
            product: true,
            material: true,
            purchaseOrderItem: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    return receipt;
  }

  /**
   * Crea entrata merce da ordine d'acquisto
   */
  async createGoodsReceipt(data: CreateGoodsReceiptInput) {
    // Verifica ordine d'acquisto
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: {
          include: {
            product: true,
            material: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new Error('Ordine d\'acquisto non trovato');
    }

    if (purchaseOrder.status === 'RECEIVED' || purchaseOrder.status === 'CANCELLED') {
      throw new Error(`Impossibile creare entrata merce per ordine in stato ${purchaseOrder.status}`);
    }

    // Genera numero ricevimento
    const receiptNumber = await this.generateReceiptNumber();

    return await prisma.$transaction(async (tx) => {
      // 1. Crea entrata merce
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: data.purchaseOrderId,
          supplierId: purchaseOrder.supplierId,
          warehouseId: data.warehouseId,
          documentDate: data.documentDate,
          supplierDocNumber: data.supplierDocNumber,
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
          deliveryNote: data.deliveryNote,
          inspectionRequired: data.inspectionRequired || false,
          inspectionStatus: data.inspectionRequired ? 'PENDING' : 'NOT_REQUIRED',
          receivedBy: data.receivedBy,
          notes: data.notes,
          items: {
            create: data.items.map((item) => {
              const poItem = purchaseOrder.items.find((poi) => poi.id === item.purchaseOrderItemId);
              const expectedQty = poItem ? poItem.quantity - poItem.receivedQuantity : 0;

              return {
                purchaseOrderItemId: item.purchaseOrderItemId,
                productId: poItem?.productId,
                materialId: poItem?.materialId,
                expectedQuantity: expectedQty,
                receivedQuantity: item.receivedQuantity,
                acceptedQuantity: item.acceptedQuantity,
                rejectedQuantity: item.rejectedQuantity || 0,
                lotNumber: item.lotNumber,
                expiryDate: item.expiryDate,
                storageLocation: item.storageLocation,
                qualityNotes: item.qualityNotes,
              };
            }),
          },
        },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
        },
      });

      // 2. Aggiorna quantità ricevute su ordine d'acquisto
      for (const item of data.items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            receivedQuantity: {
              increment: item.receivedQuantity,
            },
          },
        });
      }

      // 3. Aggiorna stato ordine d'acquisto
      const updatedPOItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
      });

      const allReceived = updatedPOItems.every((item) => item.receivedQuantity >= item.quantity);
      const anyReceived = updatedPOItems.some((item) => item.receivedQuantity > 0);

      let newPOStatus = purchaseOrder.status;
      if (allReceived) {
        newPOStatus = 'RECEIVED';
      } else if (anyReceived) {
        newPOStatus = 'PARTIALLY_RECEIVED';
      }

      if (newPOStatus !== purchaseOrder.status) {
        await tx.purchaseOrder.update({
          where: { id: data.purchaseOrderId },
          data: {
            status: newPOStatus,
            receivedDate: allReceived ? new Date() : undefined,
            deliveryStatus: allReceived ? 'DELIVERED' : 'PARTIAL_DELIVERY',
            actualDeliveryDate: allReceived ? new Date() : undefined,
          },
        });
      }

      return goodsReceipt;
    });
  }

  /**
   * Aggiorna entrata merce
   */
  async updateGoodsReceipt(id: string, data: UpdateGoodsReceiptInput) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    if (receipt.status === 'COMPLETED' || receipt.status === 'CANCELLED') {
      throw new Error(`Impossibile modificare entrata merce in stato ${receipt.status}`);
    }

    return await prisma.goodsReceipt.update({
      where: { id },
      data,
      include: {
        items: true,
        supplier: true,
        warehouse: true,
      },
    });
  }

  /**
   * Ricevi articoli (parziale)
   */
  async receiveItems(receiptId: string, data: ReceiveItemsInput) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { items: true },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    if (receipt.status === 'COMPLETED' || receipt.status === 'CANCELLED') {
      throw new Error('Impossibile modificare entrata merce completata o annullata');
    }

    return await prisma.$transaction(async (tx) => {
      // Aggiorna ogni articolo
      for (const item of data.items) {
        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: {
            receivedQuantity: item.receivedQuantity,
            acceptedQuantity: item.acceptedQuantity,
            rejectedQuantity: item.rejectedQuantity || 0,
            lotNumber: item.lotNumber,
            expiryDate: item.expiryDate,
            storageLocation: item.storageLocation,
            qualityStatus: item.qualityStatus || 'PENDING',
            qualityNotes: item.qualityNotes,
          },
        });
      }

      // Verifica se tutto è stato ricevuto
      const updatedItems = await tx.goodsReceiptItem.findMany({
        where: { goodsReceiptId: receiptId },
      });

      const allReceived = updatedItems.every((item) => item.receivedQuantity >= item.expectedQuantity);
      const anyReceived = updatedItems.some((item) => item.receivedQuantity > 0);

      let newStatus: GoodsReceiptStatus = receipt.status;
      if (allReceived) {
        newStatus = receipt.inspectionRequired && receipt.inspectionStatus === 'PENDING'
          ? 'PARTIAL'
          : 'COMPLETED';
      } else if (anyReceived) {
        newStatus = 'PARTIAL';
      }

      const updatedReceipt = await tx.goodsReceipt.update({
        where: { id: receiptId },
        data: { status: newStatus },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
        },
      });

      return updatedReceipt;
    });
  }

  /**
   * Completa entrata merce e aggiorna inventario
   */
  async completeReceipt(id: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            material: true,
          },
        },
        warehouse: true,
        purchaseOrder: true,
      },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    if (receipt.status === 'COMPLETED') {
      throw new Error('Entrata merce già completata');
    }

    if (receipt.inspectionRequired && receipt.inspectionStatus === 'PENDING') {
      throw new Error('Ispezione qualità richiesta prima del completamento');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Aggiorna inventario per ogni articolo accettato
      for (const item of receipt.items) {
        if (item.acceptedQuantity <= 0) continue;

        if (item.productId) {
          // Trova o crea inventario prodotto
          const existingInv = await tx.inventoryItem.findFirst({
            where: {
              productId: item.productId,
              warehouseId: receipt.warehouseId,
              variantId: null,
              location: 'WEB',
            },
          });

          if (existingInv) {
            await tx.inventoryItem.update({
              where: { id: existingInv.id },
              data: { quantity: { increment: item.acceptedQuantity } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                productId: item.productId,
                warehouseId: receipt.warehouseId,
                quantity: item.acceptedQuantity,
                location: 'WEB',
              },
            });
          }

          // Crea movimento inventario
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: 'IN',
              quantity: item.acceptedQuantity,
              toLocation: 'WEB',
              notes: `Entrata merce ${receipt.receiptNumber}`,
              reference: receipt.receiptNumber,
            },
          });
        }

        if (item.materialId) {
          // Trova o crea inventario materiale
          const existingMatInv = await tx.materialInventory.findFirst({
            where: {
              materialId: item.materialId,
              warehouseId: receipt.warehouseId,
              location: 'WEB',
            },
          });

          if (existingMatInv) {
            await tx.materialInventory.update({
              where: { id: existingMatInv.id },
              data: { quantity: { increment: item.acceptedQuantity } },
            });
          } else {
            await tx.materialInventory.create({
              data: {
                materialId: item.materialId,
                warehouseId: receipt.warehouseId,
                quantity: item.acceptedQuantity,
                location: 'WEB',
              },
            });
          }

          // Crea movimento materiale
          await tx.materialMovement.create({
            data: {
              materialId: item.materialId,
              type: 'IN',
              quantity: item.acceptedQuantity,
              toLocation: 'WEB',
              notes: `Entrata merce ${receipt.receiptNumber}`,
              reference: receipt.receiptNumber,
            },
          });
        }
      }

      // 2. Aggiorna stato entrata merce
      const completedReceipt = await tx.goodsReceipt.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
          purchaseOrder: true,
        },
      });

      // 3. Aggiorna metriche fornitore
      const wasOnTime = receipt.purchaseOrder?.expectedDate
        ? new Date() <= receipt.purchaseOrder.expectedDate
        : true;

      await tx.supplier.update({
        where: { id: receipt.supplierId },
        data: {
          totalDeliveries: { increment: 1 },
          lateDeliveries: wasOnTime ? undefined : { increment: 1 },
        },
      });

      return completedReceipt;
    });
  }

  /**
   * Registra ispezione qualità
   */
  async recordInspection(id: string, data: InspectionInput) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    if (!receipt.inspectionRequired) {
      throw new Error('Ispezione non richiesta per questa entrata merce');
    }

    return await prisma.$transaction(async (tx) => {
      // Aggiorna risultati ispezione per articoli
      if (data.itemResults) {
        for (const result of data.itemResults) {
          await tx.goodsReceiptItem.update({
            where: { id: result.itemId },
            data: {
              qualityStatus: result.qualityStatus,
              acceptedQuantity: result.acceptedQuantity,
              rejectedQuantity: result.rejectedQuantity,
              qualityNotes: result.qualityNotes,
            },
          });
        }
      }

      // Aggiorna entrata merce
      const updatedReceipt = await tx.goodsReceipt.update({
        where: { id },
        data: {
          inspectionStatus: data.inspectionStatus,
          inspectionDate: new Date(),
          inspectionNotes: data.inspectionNotes,
          inspectedBy: data.inspectedBy,
        },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
        },
      });

      // Se ispezione fallita, aggiorna metriche fornitore
      if (data.inspectionStatus === 'FAILED') {
        await tx.supplier.update({
          where: { id: receipt.supplierId },
          data: {
            defectiveDeliveries: { increment: 1 },
          },
        });
      }

      return updatedReceipt;
    });
  }

  /**
   * Aggiungi allegato
   */
  async addAttachment(id: string, attachment: { name: string; url: string; type: string }) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    const currentAttachments = (receipt.attachments as any[]) || [];
    currentAttachments.push({
      ...attachment,
      addedAt: new Date().toISOString(),
    });

    return await prisma.goodsReceipt.update({
      where: { id },
      data: { attachments: currentAttachments },
    });
  }

  /**
   * Annulla entrata merce
   */
  async cancelReceipt(id: string, reason: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    if (receipt.status === 'COMPLETED') {
      throw new Error('Impossibile annullare entrata merce già completata');
    }

    return await prisma.$transaction(async (tx) => {
      // Ripristina quantità ricevute su ordine d'acquisto
      for (const item of receipt.items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            receivedQuantity: {
              decrement: item.receivedQuantity,
            },
          },
        });
      }

      // Aggiorna stato entrata merce
      return await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: `${receipt.notes || ''}\n\nAnnullato: ${reason}`.trim(),
        },
      });
    });
  }

  /**
   * Helper: genera numero ricevimento
   */
  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EM-${year}-`;

    const lastReceipt = await prisma.goodsReceipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastReceipt) {
      const match = lastReceipt.receiptNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }
}

export const goodsReceiptService = new GoodsReceiptService();
export default goodsReceiptService;
