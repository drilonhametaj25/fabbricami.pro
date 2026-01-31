import { prisma } from '../config/database';
import { logger } from '../config/logger';
// inventoryService import removed - unused
import wordpressService from './wordpress.service';

// Input types
interface CreateRefundInput {
  orderId: string;
  reason?: string;
  restockItems: boolean;
  items: Array<{
    orderItemId: string;
    quantity: number;
    amount: number;
    reason?: string;
  }>;
  processedBy?: string;
}

interface ProcessRefundInput {
  refundId: string;
  processedBy: string;
  syncToWooCommerce?: boolean;
}

/**
 * Refund Service
 * Gestione completa dei rimborsi ordini con ripristino inventario e sync WooCommerce
 */
class RefundService {
  /**
   * Lista rimborsi per ordine
   */
  async listRefundsByOrder(orderId: string) {
    return await prisma.orderRefund.findMany({
      where: { orderId },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: {
                  select: { id: true, sku: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Dettaglio rimborso
   */
  async getRefundById(id: string) {
    const refund = await prisma.orderRefund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: {
              select: { id: true, code: true, businessName: true, firstName: true, lastName: true },
            },
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });

    if (!refund) {
      throw new Error('Rimborso non trovato');
    }

    return refund;
  }

  /**
   * Crea rimborso (stato PENDING)
   */
  async createRefund(data: CreateRefundInput) {
    // Verifica ordine
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        items: true,
        refunds: {
          include: { items: true },
        },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Verifica che l'ordine sia in uno stato che permette rimborsi
    const refundableStatuses = ['CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED'];
    if (!refundableStatuses.includes(order.status)) {
      throw new Error(`Impossibile rimborsare ordine in stato ${order.status}`);
    }

    // Verifica quantità rimborsabili
    for (const refundItem of data.items) {
      const orderItem = order.items.find((i) => i.id === refundItem.orderItemId);
      if (!orderItem) {
        throw new Error(`Articolo ordine ${refundItem.orderItemId} non trovato`);
      }

      // Calcola quantità già rimborsate per questo item
      const alreadyRefunded = order.refunds
        .flatMap((r) => r.items)
        .filter((ri) => ri.orderItemId === refundItem.orderItemId)
        .reduce((sum, ri) => sum + ri.quantity, 0);

      const maxRefundable = orderItem.quantity - alreadyRefunded;

      if (refundItem.quantity > maxRefundable) {
        throw new Error(
          `Quantità rimborso (${refundItem.quantity}) supera il massimo rimborsabile (${maxRefundable}) per ${orderItem.productName}`
        );
      }
    }

    // Calcola totale rimborso
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    // Calcola totale già rimborsato
    const alreadyRefundedTotal = order.refunds
      .filter((r) => r.status !== 'FAILED')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const maxRefundableAmount = Number(order.total) - alreadyRefundedTotal;

    if (totalAmount > maxRefundableAmount) {
      throw new Error(
        `Importo rimborso (€${totalAmount.toFixed(2)}) supera il massimo rimborsabile (€${maxRefundableAmount.toFixed(2)})`
      );
    }

    // Crea rimborso
    const refund = await prisma.orderRefund.create({
      data: {
        orderId: data.orderId,
        amount: totalAmount,
        reason: data.reason || 'Rimborso richiesto',
        status: 'PENDING',
        restockItems: data.restockItems,
        items: {
          create: data.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            amount: item.amount,
            reason: item.reason,
          })),
        },
      },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // Crea nota ordine
    await prisma.orderNote.create({
      data: {
        orderId: data.orderId,
        type: 'SYSTEM',
        content: `Rimborso creato: €${totalAmount.toFixed(2)} - ${data.reason || 'Nessun motivo specificato'}`,
        isVisibleToCustomer: false,
        createdBy: data.processedBy || 'Sistema',
      },
    });

    logger.info(`Rimborso creato per ordine ${order.orderNumber}: €${totalAmount.toFixed(2)}`);

    return refund;
  }

  /**
   * Processa rimborso (PENDING -> COMPLETED)
   * Ripristina inventario se richiesto
   */
  async processRefund(data: ProcessRefundInput) {
    const refund = await prisma.orderRefund.findUnique({
      where: { id: data.refundId },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });

    if (!refund) {
      throw new Error('Rimborso non trovato');
    }

    if (refund.status !== 'PENDING') {
      throw new Error(`Impossibile processare rimborso in stato ${refund.status}`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Se richiesto, ripristina inventario
      if (refund.restockItems) {
        for (const refundItem of refund.items) {
          const orderItem = refundItem.orderItem;
          if (!orderItem.productId) continue;

          // Trova magazzino primario
          const warehouse = await tx.warehouse.findFirst({
            where: { isPrimary: true },
          });

          if (warehouse) {
            // Ripristina quantità in inventario
            await (tx.inventoryItem as any).upsert({
              where: {
                productId_warehouseId: {
                  productId: orderItem.productId,
                  warehouseId: warehouse.id,
                },
              },
              update: {
                quantity: { increment: refundItem.quantity },
              },
              create: {
                productId: orderItem.productId,
                warehouseId: warehouse.id,
                quantity: refundItem.quantity,
                location: warehouse.code as any,
              },
            });

            // Crea movimento inventario
            await tx.inventoryMovement.create({
              data: {
                productId: orderItem.productId,
                type: 'IN',
                quantity: refundItem.quantity,
                reason: `Rimborso ordine ${refund.order.orderNumber}`,
                reference: `REFUND-${refund.id.slice(0, 8)}`,
              } as any,
            });

            logger.info(
              `Ripristinato inventario: ${refundItem.quantity}x ${orderItem.product?.sku || orderItem.productId}`
            );
          }
        }
      }

      // 2. Aggiorna stato rimborso
      const processedRefund = await tx.orderRefund.update({
        where: { id: data.refundId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          processedBy: data.processedBy,
        },
        include: {
          items: {
            include: {
              orderItem: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      // 3. Crea nota ordine
      await tx.orderNote.create({
        data: {
          orderId: refund.orderId,
          type: 'SYSTEM',
          content: `Rimborso processato: €${Number(refund.amount).toFixed(2)}${refund.restockItems ? ' (articoli ripristinati a magazzino)' : ''}`,
          isVisibleToCustomer: false,
          createdBy: data.processedBy,
        },
      });

      return processedRefund;
    });
  }

  /**
   * Sincronizza rimborso su WooCommerce
   */
  async syncRefundToWooCommerce(refundId: string): Promise<{ success: boolean; wcRefundId?: number; error?: string }> {
    const refund = await prisma.orderRefund.findUnique({
      where: { id: refundId },
      include: {
        order: true,
        items: {
          include: {
            orderItem: true,
          },
        },
      },
    });

    if (!refund) {
      return { success: false, error: 'Rimborso non trovato' };
    }

    if (!refund.order.wordpressId) {
      return { success: false, error: 'Ordine non sincronizzato con WooCommerce' };
    }

    if (refund.wcRefundId) {
      return { success: true, wcRefundId: refund.wcRefundId };
    }

    try {
      // Prepara line items per WooCommerce
      const lineItems = refund.items
        .filter((item) => item.orderItem.wcLineItemId)
        .map((item) => ({
          id: item.orderItem.wcLineItemId,
          refund_total: ((item as any).amount || 0).toString(),
          quantity: item.quantity,
        }));

      // Crea rimborso su WooCommerce usando il service
      const wcRefund = await wordpressService.createWooCommerceRefund(
        refund.order.wordpressId,
        Number(refund.amount),
        refund.reason || 'Rimborso da ERP',
        refund.restockItems,
        lineItems
      );

      // Aggiorna rimborso con ID WooCommerce
      await prisma.orderRefund.update({
        where: { id: refundId },
        data: { wcRefundId: wcRefund.id },
      });

      // Aggiorna wcRefunds nell'ordine
      const currentRefunds = (refund.order.wcRefunds as any[]) || [];
      currentRefunds.push({
        id: wcRefund.id,
        reason: refund.reason,
        total: `-${Number(refund.amount).toFixed(2)}`,
      });

      await prisma.order.update({
        where: { id: refund.orderId },
        data: { wcRefunds: currentRefunds },
      });

      logger.info(`Rimborso sincronizzato su WooCommerce: ${wcRefund.id}`);

      return { success: true, wcRefundId: wcRefund.id };
    } catch (error: any) {
      logger.error(`Errore sync rimborso su WooCommerce: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Annulla rimborso (solo se PENDING)
   */
  async cancelRefund(id: string, reason: string, cancelledBy: string) {
    const refund = await prisma.orderRefund.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!refund) {
      throw new Error('Rimborso non trovato');
    }

    if (refund.status !== 'PENDING') {
      throw new Error(`Impossibile annullare rimborso in stato ${refund.status}`);
    }

    const updatedRefund = await prisma.orderRefund.update({
      where: { id },
      data: {
        status: 'FAILED',
        processedBy: cancelledBy,
        processedAt: new Date(),
      },
    });

    // Crea nota ordine
    await prisma.orderNote.create({
      data: {
        orderId: refund.orderId,
        type: 'SYSTEM',
        content: `Rimborso annullato: ${reason}`,
        isVisibleToCustomer: false,
        createdBy: cancelledBy,
      },
    });

    return updatedRefund;
  }

  /**
   * Calcola totale rimborsabile per un ordine
   */
  async getRefundableAmount(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        refunds: {
          where: { status: { not: 'FAILED' } },
          include: { items: true },
        },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const totalRefunded = order.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const refundableAmount = Number(order.total) - totalRefunded;

    // Calcola quantità rimborsabili per item
    const itemsRefundable = order.items.map((item) => {
      const refundedQuantity = order.refunds
        .flatMap((r) => r.items)
        .filter((ri) => ri.orderItemId === item.id)
        .reduce((sum, ri) => sum + ri.quantity, 0);

      // Calcola il prezzo unitario con IVA (total include IVA)
      const unitPriceWithTax = Number(item.total) / item.quantity;

      return {
        orderItemId: item.id,
        productName: item.productName,
        sku: item.sku,
        originalQuantity: item.quantity,
        refundedQuantity,
        refundableQuantity: item.quantity - refundedQuantity,
        unitPrice: Number(item.unitPrice),
        unitPriceWithTax,
        maxRefundableAmount: (item.quantity - refundedQuantity) * unitPriceWithTax,
      };
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderTotal: Number(order.total),
      totalRefunded,
      refundableAmount,
      items: itemsRefundable.filter((i) => i.refundableQuantity > 0),
    };
  }
}

export const refundService = new RefundService();
export default refundService;
