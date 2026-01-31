import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { mrpService } from '../services/mrp.service';
import { z } from 'zod';

const productionRequirementsSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  requiredDate: z.string(),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  requirementIds: z.array(z.string()).optional(),
});

const mrpRoutes: FastifyPluginAsync = async (server: any) => {
  // =============================================
  // MRP CALCULATIONS
  // =============================================

  /**
   * GET /mrp/requirements
   * Calcola fabbisogno materiali per tutti gli ordini confermati
   */
  server.get('/requirements', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result = await mrpService.calculateRequirementsForOrders();

      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /mrp/requirements/production
   * Calcola fabbisogno per produzione specifica
   */
  server.post('/requirements/production', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const body = productionRequirementsSchema.parse(request.body);

      const requirements = await mrpService.calculateRequirementsForProduction(
        body.productId,
        body.quantity,
        new Date(body.requiredDate)
      );

      return reply.send({
        success: true,
        data: {
          productId: body.productId,
          quantity: body.quantity,
          requiredDate: body.requiredDate,
          requirements,
          summary: {
            totalMaterials: requirements.length,
            criticalItems: requirements.filter(r => r.priority === 'CRITICAL').length,
            estimatedCost: requirements.reduce((sum, r) => sum + r.estimatedCost, 0),
          },
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /mrp/reorder-suggestions
   * Analizza scorte e suggerisce riordini
   */
  server.get('/reorder-suggestions', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const suggestions = await mrpService.analyzeInventoryAndSuggestReorders();

      return reply.send({
        success: true,
        data: {
          suggestions,
          summary: {
            total: suggestions.length,
            critical: suggestions.filter(s => s.priority === 'CRITICAL').length,
            high: suggestions.filter(s => s.priority === 'HIGH').length,
            medium: suggestions.filter(s => s.priority === 'MEDIUM').length,
            estimatedTotalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
          },
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /mrp/forecast/:productId
   * Previsione domanda per prodotto
   */
  server.get('/forecast/:productId', async (
    request: FastifyRequest<{ Params: { productId: string }; Querystring: { days?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId } = request.params;
      const days = parseInt(request.query.days || '30');

      const forecast = await mrpService.forecastDemand(productId, days);

      return reply.send({
        success: true,
        data: {
          ...forecast,
          forecastDays: days,
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // PURCHASE ORDER GENERATION
  // =============================================

  /**
   * POST /mrp/create-purchase-order
   * Crea ordine acquisto da requirements MRP
   */
  server.post('/create-purchase-order', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const body = createPurchaseOrderSchema.parse(request.body);

      // Ottieni requirements per il fornitore
      const allRequirements = await mrpService.analyzeInventoryAndSuggestReorders();
      const supplierRequirements = allRequirements.filter(r => r.supplierId === body.supplierId);

      if (supplierRequirements.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Nessun requisito trovato per questo fornitore',
        });
      }

      const purchaseOrderId = await mrpService.createPurchaseOrderFromRequirements(
        body.supplierId,
        supplierRequirements
      );

      return reply.send({
        success: true,
        data: {
          purchaseOrderId,
          itemsCount: supplierRequirements.length,
          totalCost: supplierRequirements.reduce((sum, r) => sum + r.estimatedCost, 0),
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /mrp/create-all-purchase-orders
   * Crea ordini acquisto per tutti i fornitori con requirements
   */
  server.post('/create-all-purchase-orders', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result = await mrpService.calculateRequirementsForOrders();
      const createdOrders: Array<{ supplierId: string; supplierName: string; purchaseOrderId: string }> = [];

      for (const suggestedOrder of result.suggestedPurchaseOrders) {
        try {
          const requirements = result.requirements.filter(r => r.supplierId === suggestedOrder.supplierId);
          const purchaseOrderId = await mrpService.createPurchaseOrderFromRequirements(
            suggestedOrder.supplierId,
            requirements
          );

          createdOrders.push({
            supplierId: suggestedOrder.supplierId,
            supplierName: suggestedOrder.supplierName,
            purchaseOrderId,
          });
        } catch (err) {
          // Log ma continua con altri fornitori
        }
      }

      return reply.send({
        success: true,
        data: {
          createdOrders,
          totalOrders: createdOrders.length,
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // NOTIFICATIONS
  // =============================================

  /**
   * POST /mrp/notify-critical
   * Notifica scorte critiche a utenti
   */
  server.post('/notify-critical', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const notifiedCount = await mrpService.notifyCriticalShortages();

      return reply.send({
        success: true,
        data: {
          criticalItemsCount: notifiedCount,
          notified: notifiedCount > 0,
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default mrpRoutes;
