// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import purchaseOrderService from '../services/purchase-order.service';
import { successResponse, errorResponse } from '../utils/response.util';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receiveItemsSchema,
  listPurchaseOrdersSchema,
  purchaseOrderIdSchema,
  confirmPurchaseOrderSchema,
  cancelPurchaseOrderSchema,
} from '../schemas/purchase-order.schema';

// Types/Interfaces

// Constants

// Main logic

/**
 * Purchase Order Routes
 * Endpoints API per gestione ordini d'acquisto
 */
const purchaseOrderRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/purchase-orders
   * Lista ordini d'acquisto con filtri
   */
  server.get(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'CONTABILE'), validate(listPurchaseOrdersSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Lista ordini d\'acquisto',
      },
    },
    async (request, reply) => {
      try {
        const result = await purchaseOrderService.listPurchaseOrders(request.query as any);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/purchase-orders/:id
   * Dettaglio ordine d'acquisto
   */
  server.get(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'CONTABILE'), validate(purchaseOrderIdSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Dettaglio ordine d\'acquisto',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const order = await purchaseOrderService.getPurchaseOrderById(id);
        return successResponse(reply, order);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/purchase-orders
   * Crea nuovo ordine d'acquisto
   */
  server.post(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(createPurchaseOrderSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Crea ordine d\'acquisto',
      },
    },
    async (request, reply) => {
      try {
        const order = await purchaseOrderService.createPurchaseOrder(request.body as any);
        return successResponse(reply, order, 201);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * PATCH /api/v1/purchase-orders/:id
   * Aggiorna ordine d'acquisto
   */
  server.patch(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(updatePurchaseOrderSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Aggiorna ordine d\'acquisto',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const order = await purchaseOrderService.updatePurchaseOrder(id, request.body as any);
        return successResponse(reply, order);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/purchase-orders/:id/receive
   * Registra ricezione merce
   */
  server.post(
    '/:id/receive',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE'), validate(receiveItemsSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Registra ricezione merce',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const order = await purchaseOrderService.receiveItems({
          orderId: id,
          items: body.items,
          warehouseId: body.warehouseId,
          warehouseLocation: body.warehouseLocation,
        });
        return successResponse(reply, order);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/purchase-orders/:id/confirm
   * Conferma ordine (invia a fornitore)
   */
  server.post(
    '/:id/confirm',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(confirmPurchaseOrderSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Conferma ordine',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const order = await purchaseOrderService.confirmPurchaseOrder(id);
        return successResponse(reply, order);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/purchase-orders/:id/cancel
   * Cancella ordine
   */
  server.post(
    '/:id/cancel',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(cancelPurchaseOrderSchema)],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Cancella ordine',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { reason } = request.body as any;
        const order = await purchaseOrderService.cancelPurchaseOrder(id, reason);
        return successResponse(reply, order);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // =====================
  // ANALYTICS ENDPOINTS
  // =====================

  /**
   * GET /api/v1/purchase-orders/analytics/timeline
   * Timeline acquisti per grafico
   */
  server.get(
    '/analytics/timeline',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Purchase Orders', 'Analytics'],
        description: 'Timeline acquisti',
      },
    },
    async (request, reply) => {
      try {
        const { days } = request.query as { days?: string };
        const daysNum = days ? parseInt(days, 10) : 90;
        const data = await purchaseOrderService.getPurchaseTimeline(daysNum);
        return reply.send({ success: true, data });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/purchase-orders/analytics/seasonality
   * Analisi stagionalità acquisti
   */
  server.get(
    '/analytics/seasonality',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Purchase Orders', 'Analytics'],
        description: 'Stagionalità acquisti',
      },
    },
    async (request, reply) => {
      try {
        const data = await purchaseOrderService.getPurchaseSeasonality();
        return reply.send({ success: true, data });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/purchase-orders/analytics/forecasting
   * Previsioni riordino materiali
   */
  server.get(
    '/analytics/forecasting',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Purchase Orders', 'Analytics'],
        description: 'Previsioni riordino materiali',
      },
    },
    async (request, reply) => {
      try {
        const data = await purchaseOrderService.getPurchaseForecasting();
        return reply.send({ success: true, data });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/purchase-orders/analytics/discount-opportunities
   * Opportunità sconti basate su storico acquisti
   */
  server.get(
    '/analytics/discount-opportunities',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Purchase Orders', 'Analytics'],
        description: 'Opportunità sconti',
      },
    },
    async (request, reply) => {
      try {
        const data = await purchaseOrderService.getDiscountOpportunities();
        return reply.send({ success: true, data });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/purchase-orders/item-history
   * Storico ordini per un articolo specifico
   * Utile per verificare se un prodotto/materiale è già stato ordinato
   */
  server.get(
    '/item-history',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'CONTABILE')],
      schema: {
        tags: ['Purchase Orders'],
        description: 'Storico ordini per articolo - verifica se già ordinato',
        querystring: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID prodotto da cercare' },
            materialId: { type: 'string', description: 'ID materiale da cercare' },
            daysBack: { type: 'integer', default: 180, description: 'Giorni indietro da cercare' },
            includeReceived: { type: 'boolean', default: true, description: 'Includere ordini completati' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { productId, materialId, daysBack, includeReceived } = request.query as {
          productId?: string;
          materialId?: string;
          daysBack?: string;
          includeReceived?: string;
        };

        const data = await purchaseOrderService.getItemOrderHistory({
          productId,
          materialId,
          daysBack: daysBack ? parseInt(daysBack, 10) : 180,
          includeReceived: includeReceived !== 'false',
        });

        return successResponse(reply, data);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('Specificare') ? 400 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );
};

// Exports
export default purchaseOrderRoutes;
