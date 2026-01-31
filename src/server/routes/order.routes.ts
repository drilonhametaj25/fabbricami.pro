import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { orderService } from '../services/order.service';
import {
  createOrderSchema,
  updateOrderSchema,
  addOrderItemSchema,
  updateOrderStatusSchema,
  createShipmentSchema,
  orderQuerySchema,
  b2bPricePreviewSchema,
  createB2BOrderSchema,
} from '../schemas/order.schema';
import { prisma } from '../config/database';
import pickingListService from '../services/picking-list.service';
import exportService from '../services/export.service';

const orderRoutes: FastifyPluginAsync = async (server: any) => {
  /**
   * GET /api/v1/orders
   * Lista ordini con filtri e paginazione
   */
  server.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = orderQuerySchema.parse(request.query);
      const result = await orderService.listOrders(query);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list orders',
      });
    }
  });

  /**
   * GET /api/v1/orders/stats
   * Statistiche ordini per periodo
   */
  server.get('/stats', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { dateFrom, dateTo } = request.query as { dateFrom?: string; dateTo?: string };

      // Default: ultimo mese
      const now = new Date();
      const from = dateFrom || new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const to = dateTo || now.toISOString();

      const stats = await orderService.getOrderStats(from, to);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get order stats',
      });
    }
  });

  /**
   * GET /api/v1/orders/timeline
   * Dati timeline ordini per grafico (ordini ricevuti vs consegne previste)
   */
  server.get('/timeline', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { days } = request.query as { days?: string };
      const daysNum = days ? parseInt(days, 10) : 30;

      const data = await orderService.getOrdersTimeline(daysNum);
      return reply.send({ success: true, data });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get orders timeline',
      });
    }
  });

  /**
   * GET /api/v1/orders/optimization-suggestions
   * Suggerimenti di ottimizzazione per processamento ordini
   */
  server.get('/optimization-suggestions', { preHandler: authenticate }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await orderService.getOptimizationSuggestions();
      return reply.send({ success: true, data });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get optimization suggestions',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id
   * Dettaglio ordine
   */
  server.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const order = await orderService.getOrderById(id);

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found',
        });
      }

      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get order',
      });
    }
  });

  /**
   * POST /api/v1/orders
   * Crea nuovo ordine
   */
  server.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createOrderSchema.parse(request.body);
      const order = await orderService.createOrder(data);
      return reply.status(201).send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create order',
      });
    }
  });

  /**
   * PUT /api/v1/orders/:id
   * Aggiorna ordine
   */
  server.put('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateOrderSchema.parse(request.body);
      const order = await orderService.updateOrder(id, data);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update order',
      });
    }
  });

  /**
   * PATCH /api/v1/orders/:id/status
   * Cambia stato ordine
   */
  server.patch('/:id/status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      const data = updateOrderStatusSchema.parse(request.body);
      const order = await orderService.updateOrderStatus(id, data, user?.id);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update order status',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/items
   * Aggiungi item a ordine
   */
  server.post('/:id/items', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = addOrderItemSchema.parse(request.body);

      const item = await prisma.$transaction(async (tx: any) => {
        return await orderService.addOrderItem(tx, id, data);
      });

      return reply.status(201).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to add order item',
      });
    }
  });

  /**
   * DELETE /api/v1/orders/:id/items/:itemId
   * Rimuovi item da ordine
   */
  server.delete('/:id/items/:itemId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, itemId } = request.params as { id: string; itemId: string };
      const order = await orderService.removeOrderItem(id, itemId);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to remove order item',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/allocate
   * Alloca inventario per ordine (riserva stock)
   */
  server.post('/:id/allocate', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const order = await orderService.allocateInventoryForOrder(id);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to allocate inventory',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/ship
   * Crea spedizione per ordine
   */
  server.post('/:id/ship', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = createShipmentSchema.parse({ ...request.body as object, orderId: id });
      const shipment = await orderService.createShipment(id, data);
      return reply.send({ success: true, data: shipment });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create shipment',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/deliver
   * Marca ordine come consegnato
   */
  server.post('/:id/deliver', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const order = await orderService.markAsDelivered(id);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to mark order as delivered',
      });
    }
  });

  // ==========================================
  // ENDPOINTS B2B - Gestione prezzi listini
  // ==========================================

  /**
   * POST /api/v1/orders/b2b/preview
   * Preview prezzi per ordine B2B (senza creare ordine)
   * Mostra calcolo prezzi basato su listino cliente
   */
  server.post('/b2b/preview', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = b2bPricePreviewSchema.parse(request.body);
      const preview = await orderService.previewB2BOrderPrices(data.customerId, data.items);
      return reply.send({ success: true, data: preview });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to preview B2B prices',
      });
    }
  });

  /**
   * POST /api/v1/orders/b2b
   * Crea ordine B2B con calcolo automatico prezzi
   * I prezzi vengono calcolati in base al listino assegnato al cliente
   */
  server.post('/b2b', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createB2BOrderSchema.parse(request.body);
      const result = await orderService.createB2BOrder(
        data.customerId,
        data.items,
        {
          notes: data.notes,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
        }
      );
      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create B2B order',
      });
    }
  });

  /**
   * GET /api/v1/orders/customer/:customerId
   * Lista ordini per cliente
   */
  server.get('/customer/:customerId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const query = orderQuerySchema.parse(request.query);

      const result = await orderService.listOrders({
        ...query,
        customerId,
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list customer orders',
      });
    }
  });

  /**
   * DELETE /api/v1/orders/:id
   * Elimina ordine (solo se DRAFT o CANCELLED)
   */
  server.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verifica stato ordine
      const order = await orderService.getOrderById(id);
      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found',
        });
      }

      if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
        return reply.status(400).send({
          success: false,
          error: `Cannot delete order in status ${order.status}. Only PENDING or CANCELLED orders can be deleted.`,
        });
      }

      // Elimina items e ordine
      await prisma.$transaction(async (tx: any) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.order.delete({ where: { id } });
      });

      return reply.send({ success: true, message: 'Order deleted successfully' });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to delete order',
      });
    }
  });

  // ==========================================
  // ORDER NOTES
  // ==========================================

  /**
   * GET /api/v1/orders/:id/notes
   * Lista note ordine
   */
  server.get('/:id/notes', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const notes = await prisma.orderNote.findMany({
        where: { orderId: id },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ success: true, data: notes });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get order notes',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/notes
   * Aggiungi nota ordine
   */
  server.post('/:id/notes', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { type, content, isVisibleToCustomer } = request.body as {
        type: string;
        content: string;
        isVisibleToCustomer?: boolean;
      };
      const user = request.user as { id: string; username: string };

      const note = await prisma.orderNote.create({
        data: {
          orderId: id,
          type: type || 'INTERNAL',
          content,
          isVisibleToCustomer: isVisibleToCustomer || false,
          createdBy: user?.username || 'Sistema',
        },
      });

      return reply.status(201).send({ success: true, data: note });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to add order note',
      });
    }
  });

  // ==========================================
  // REFUNDS
  // ==========================================

  /**
   * GET /api/v1/orders/:id/refunds
   * Lista rimborsi ordine
   */
  server.get('/:id/refunds', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { refundService } = await import('../services/refund.service');
      const refunds = await refundService.listRefundsByOrder(id);
      return reply.send({ success: true, data: refunds });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get order refunds',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id/refundable
   * Ottieni importo e articoli rimborsabili
   */
  server.get('/:id/refundable', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { refundService } = await import('../services/refund.service');
      const refundable = await refundService.getRefundableAmount(id);
      return reply.send({ success: true, data: refundable });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get refundable amount',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/refunds
   * Crea rimborso
   */
  server.post('/:id/refunds', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason, restockItems, items } = request.body as {
        reason?: string;
        restockItems: boolean;
        items: Array<{
          orderItemId: string;
          quantity: number;
          amount: number;
          reason?: string;
        }>;
      };
      const user = request.user as { id: string; username: string };

      const { refundService } = await import('../services/refund.service');
      const refund = await refundService.createRefund({
        orderId: id,
        reason,
        restockItems,
        items,
        processedBy: user?.username,
      });

      return reply.status(201).send({ success: true, data: refund });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create refund',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/refunds/:refundId/process
   * Processa rimborso (PENDING -> COMPLETED)
   */
  server.post('/:id/refunds/:refundId/process', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refundId } = request.params as { id: string; refundId: string };
      const { syncToWooCommerce } = request.body as { syncToWooCommerce?: boolean };
      const user = request.user as { id: string; username: string };

      const { refundService } = await import('../services/refund.service');
      const refund = await refundService.processRefund({
        refundId,
        processedBy: user?.username || 'Sistema',
        syncToWooCommerce,
      });

      // Sync a WooCommerce se richiesto
      if (syncToWooCommerce) {
        const syncResult = await refundService.syncRefundToWooCommerce(refundId);
        return reply.send({
          success: true,
          data: refund,
          wcSync: syncResult,
        });
      }

      return reply.send({ success: true, data: refund });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to process refund',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/refunds/:refundId/cancel
   * Annulla rimborso
   */
  server.post('/:id/refunds/:refundId/cancel', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refundId } = request.params as { id: string; refundId: string };
      const { reason } = request.body as { reason: string };
      const user = request.user as { id: string; username: string };

      const { refundService } = await import('../services/refund.service');
      const refund = await refundService.cancelRefund(refundId, reason, user?.username || 'Sistema');

      return reply.send({ success: true, data: refund });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to cancel refund',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/refunds/:refundId/sync
   * Sincronizza rimborso su WooCommerce
   */
  server.post('/:id/refunds/:refundId/sync', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refundId } = request.params as { id: string; refundId: string };

      const { refundService } = await import('../services/refund.service');
      const result = await refundService.syncRefundToWooCommerce(refundId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({ success: true, data: { wcRefundId: result.wcRefundId } });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to sync refund to WooCommerce',
      });
    }
  });

  // ==========================================
  // WOOCOMMERCE SYNC
  // ==========================================

  /**
   * POST /api/v1/orders/:id/sync-status
   * Sincronizza stato ordine verso WooCommerce
   */
  server.post('/:id/sync-status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const { wordpressService } = await import('../services/wordpress.service');
      const result = await wordpressService.syncOrderStatusToWooCommerce(id);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({ success: true, message: 'Order status synced to WooCommerce' });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to sync order status',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id/full
   * Ordine completo con tutte le relazioni (per OrderDetailDialog)
   */
  server.get('/:id/full', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      console.log('[DEBUG] getOrderFull called with id:', id);
      const order = await orderService.getOrderFull(id);
      console.log('[DEBUG] getOrderFull returned:', order ? 'order found' : 'null');
      if (order) {
        console.log('[DEBUG] getOrderFull order.attachments:', JSON.stringify(order.attachments));
      }

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found',
        });
      }

      return reply.send({
        success: true,
        data: order,
      });
    } catch (error: any) {
      console.error('[DEBUG] getOrderFull error:', error);
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get full order details',
      });
    }
  });

  // ==========================================
  // FULL ORDER MANAGEMENT (Sprint 7)
  // ==========================================

  /**
   * POST /api/v1/orders/full
   * Crea ordine completo con tutti i dati
   */
  server.post('/full', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as any;

      // Validazione minima
      if (!data.customerId) {
        return reply.status(400).send({
          success: false,
          error: 'customerId is required',
        });
      }
      if (!data.items || data.items.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'items array is required and must not be empty',
        });
      }

      const order = await orderService.createOrderFull({
        customerId: data.customerId,
        source: data.source || 'MANUAL',
        items: data.items,
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress,
        paymentMethod: data.paymentMethod,
        paymentMethodTitle: data.paymentMethodTitle,
        b2bPaymentMethod: data.b2bPaymentMethod,
        b2bPaymentTerms: data.b2bPaymentTerms,
        shipping: data.shipping,
        discount: data.discount,
        notes: data.notes,
        customerNote: data.customerNote,
        internalNotes: data.internalNotes,
        priority: data.priority,
        estimatedDelivery: data.estimatedDelivery,
        generatePaymentDues: data.generatePaymentDues,
        // Parametri aggiunti per rate manuali, listino prezzi e allegati
        customInstallments: data.customInstallments,
        priceListId: data.priceListId,
        attachments: data.attachments,
      });

      return reply.status(201).send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create order',
      });
    }
  });

  /**
   * PUT /api/v1/orders/:id/full
   * Aggiorna ordine completo
   */
  server.put('/:id/full', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;

      const order = await orderService.updateOrderFull(id, data);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update order',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/generate-dues
   * Genera scadenze (PaymentDues) per ordine
   */
  server.post('/:id/generate-dues', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const paymentDues = await orderService.generatePaymentDuesFromOrder(id);
      return reply.status(201).send({ success: true, data: paymentDues });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to generate payment dues',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id/payment-dues
   * Lista scadenze ordine
   */
  server.get('/:id/payment-dues', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const paymentDues = await prisma.paymentDue.findMany({
        where: { orderId: id },
        include: {
          payments: true,
        },
        orderBy: { dueDate: 'asc' },
      });
      return reply.send({ success: true, data: paymentDues });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get payment dues',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id/attachments
   * Lista allegati ordine
   */
  server.get('/:id/attachments', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const attachments = await orderService.getOrderAttachments(id);
      return reply.send({ success: true, data: attachments });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get attachments',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/attachments
   * Aggiungi allegato a ordine
   */
  server.post('/:id/attachments', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { name, url, type, size } = request.body as any;
      const user = request.user as { id: string; username: string };

      if (!name || !url || !type) {
        return reply.status(400).send({
          success: false,
          error: 'name, url and type are required',
        });
      }

      const result = await orderService.addOrderAttachment(id, {
        name,
        url,
        type,
        size,
        addedBy: user?.username,
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to add attachment',
      });
    }
  });

  /**
   * DELETE /api/v1/orders/:id/attachments/:attachmentId
   * Rimuovi allegato da ordine
   */
  server.delete('/:id/attachments/:attachmentId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, attachmentId } = request.params as { id: string; attachmentId: string };
      const result = await orderService.removeOrderAttachment(id, attachmentId);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to remove attachment',
      });
    }
  });

  /**
   * POST /api/v1/orders/attachments/upload
   * Upload file allegato (senza orderId - per creazione ordine)
   * Ritorna URL del file per poi salvarlo nell'ordine
   */
  server.post('/attachments/upload', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Ottieni il file multipart
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'Nessun file caricato',
        });
      }

      // Verifica tipo file
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];

      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'Tipo file non supportato. Tipi permessi: PDF, immagini, Word, Excel, CSV, TXT.',
        });
      }

      // Genera nome file unico
      const path = await import('path');
      const fs = await import('fs/promises');
      const crypto = await import('crypto');

      const ext = path.extname(data.filename) || '';
      const baseName = path.basename(data.filename, ext).replace(/[^a-zA-Z0-9-_]/g, '-');
      const uniqueName = `${baseName}-${crypto.randomBytes(8).toString('hex')}${ext}`;

      // Crea directory uploads/orders se non esiste
      const uploadDir = path.join(process.cwd(), 'uploads', 'orders');
      await fs.mkdir(uploadDir, { recursive: true });

      // Salva file
      const filePath = path.join(uploadDir, uniqueName);
      const buffer = await data.toBuffer();
      await fs.writeFile(filePath, buffer);

      // URL relativo per accesso
      const fileUrl = `/uploads/orders/${uniqueName}`;

      // Determina tipo per icona
      let fileType = 'document';
      if (data.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (data.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (data.mimetype.includes('spreadsheet') || data.mimetype.includes('excel') || data.mimetype === 'text/csv') {
        fileType = 'spreadsheet';
      }

      return reply.status(201).send({
        success: true,
        data: {
          name: data.filename,
          url: fileUrl,
          type: fileType,
          size: buffer.length,
          mimeType: data.mimetype,
        },
      });

    } catch (error: any) {
      console.error('Errore upload allegato:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Errore durante upload',
      });
    }
  });

  /**
   * POST /api/v1/orders/:id/attachments/upload
   * Upload file allegato per ordine specifico
   */
  server.post('/:id/attachments/upload', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string; username: string };

      // Verifica che l'ordine esista
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Ordine non trovato',
        });
      }

      // Ottieni il file multipart
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'Nessun file caricato',
        });
      }

      // Verifica tipo file
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];

      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'Tipo file non supportato. Tipi permessi: PDF, immagini, Word, Excel, CSV, TXT.',
        });
      }

      // Genera nome file unico
      const path = await import('path');
      const fs = await import('fs/promises');
      const crypto = await import('crypto');

      const ext = path.extname(data.filename) || '';
      const uniqueName = `order-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${crypto.randomBytes(8).toString('hex')}${ext}`;

      // Crea directory uploads/orders se non esiste
      const uploadDir = path.join(process.cwd(), 'uploads', 'orders');
      await fs.mkdir(uploadDir, { recursive: true });

      // Salva file
      const filePath = path.join(uploadDir, uniqueName);
      const buffer = await data.toBuffer();
      await fs.writeFile(filePath, buffer);

      // URL relativo per accesso
      const fileUrl = `/uploads/orders/${uniqueName}`;

      // Determina tipo per icona
      let fileType = 'document';
      if (data.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (data.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (data.mimetype.includes('spreadsheet') || data.mimetype.includes('excel') || data.mimetype === 'text/csv') {
        fileType = 'spreadsheet';
      }

      // Aggiungi allegato all'ordine
      const result = await orderService.addOrderAttachment(id, {
        name: data.filename,
        url: fileUrl,
        type: fileType,
        size: buffer.length,
        addedBy: user?.username,
      });

      return reply.status(201).send({
        success: true,
        data: {
          attachment: {
            name: data.filename,
            url: fileUrl,
            type: fileType,
            size: buffer.length,
          },
          order: result,
        },
      });

    } catch (error: any) {
      console.error('Errore upload allegato:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Errore durante upload',
      });
    }
  });

  // ==========================================
  // DOCUMENTS (PDF)
  // ==========================================

  /**
   * GET /api/v1/orders/:id/confirmation/pdf
   * Genera PDF conferma ordine
   */
  server.get('/:id/confirmation/pdf', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const pdfBuffer = await exportService.generateOrderConfirmationPdf(id);

      const order = await orderService.getOrderById(id);
      const filename = `conferma-ordine-${order?.orderNumber || id}.pdf`;

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer);
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to generate order confirmation PDF',
      });
    }
  });

  // ==========================================
  // PICKING LIST
  // ==========================================

  /**
   * GET /api/v1/orders/:id/picking-list
   * Genera dati picking list per ordine vendita
   */
  server.get('/:id/picking-list', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'OPERATORE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { location } = request.query as { location?: string };

      const data = await pickingListService.generateForSalesOrder(id, { location });
      return reply.send({ success: true, data });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to generate picking list',
      });
    }
  });

  /**
   * GET /api/v1/orders/:id/picking-list/pdf
   * Genera PDF picking list per ordine vendita
   */
  server.get('/:id/picking-list/pdf', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'OPERATORE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { location } = request.query as { location?: string };

      const pdfBuffer = await pickingListService.generateSalesOrderPickingListPdf(id, { location });

      const order = await orderService.getOrderById(id);
      const filename = `picking-list-${order?.orderNumber || id}.pdf`;

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer);
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to generate picking list PDF',
      });
    }
  });
};

export default orderRoutes;
