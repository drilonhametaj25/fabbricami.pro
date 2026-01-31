import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import manufacturingService from '../services/manufacturing.service';
import bomService from '../services/bom.service';
import pickingListService from '../services/picking-list.service';
import { z } from 'zod';

const phaseMaterialSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string(),
  scrapPercentage: z.number().min(0).max(100).optional(),
  isConsumable: z.boolean().optional(),
  notes: z.string().optional(),
});

const phaseEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
});

const createPhaseSchema = z.object({
  operationTypeId: z.string().uuid(),
  sequence: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  standardTime: z.number().positive('Tempo standard obbligatorio'),
  setupTime: z.number().nonnegative().optional(),
  externalCostPerUnit: z.number().nonnegative().optional(),
  supplierId: z.string().uuid().optional(),
  materials: z.array(phaseMaterialSchema).optional(),
  employees: z.array(phaseEmployeeSchema).optional(),
});

const updatePhaseSchema = createPhaseSchema.partial();

const reorderPhasesSchema = z.object({
  phaseIds: z.array(z.string().uuid()),
});

const cloneProductSchema = z.object({
  newSku: z.string().min(1),
  newName: z.string().min(1),
});

const createProductionOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  salesOrderId: z.string().uuid().optional(),
  plannedStartDate: z.string().datetime().optional(),
  plannedEndDate: z.string().datetime().optional(),
  priority: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

const startPhaseSchema = z.object({
  employeeId: z.string().uuid().optional(),
});

const completePhaseSchema = z.object({
  actualTime: z.number().int().positive().optional(),
});

const manufacturingRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================
  // PIPELINE PRODOTTO
  // ==========================================

  /**
   * GET /products/:productId/pipeline - Ottieni pipeline prodotto
   */
  server.get(
    '/products/:productId/pipeline',
    { preHandler: authenticate },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const pipeline = await manufacturingService.getProductPipeline(productId);
      return reply.send({ success: true, data: pipeline });
    }
  );

  /**
   * POST /products/:productId/phases - Aggiungi fase a pipeline
   */
  server.post(
    '/products/:productId/phases',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };

      try {
        const data = createPhaseSchema.parse(request.body);
        const phase = await manufacturingService.addPhaseToProduct(productId, data);
        return reply.status(201).send({ success: true, data: phase });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * PUT /products/:productId/phases/reorder - Riordina fasi pipeline
   */
  server.put(
    '/products/:productId/phases/reorder',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };

      try {
        const data = reorderPhasesSchema.parse(request.body);
        await manufacturingService.reorderPhases(productId, data.phaseIds);
        return reply.send({ success: true, data: { message: 'Ordine fasi aggiornato' } });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * GET /products/:productId/cost - Calcola costo prodotto
   */
  server.get(
    '/products/:productId/cost',
    { preHandler: authenticate },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const cost = await manufacturingService.calculateProductCost(productId);
      return reply.send({ success: true, data: cost });
    }
  );

  /**
   * GET /products/:productId/producible - Calcola quantità producibile
   * Restituisce quante unità del prodotto possono essere prodotte
   * con lo stock disponibile dei componenti
   */
  server.get(
    '/products/:productId/producible',
    { preHandler: authenticate },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const { location } = request.query as { location?: string };

      try {
        const result = await bomService.calculateProducibleQuantity(
          productId,
          location || 'WEB'
        );
        return reply.send({ success: true, data: result });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /products/producible-batch - Calcola quantità producibile per più prodotti
   * Utile per dashboard e pianificazione produzione
   */
  server.post(
    '/products/producible-batch',
    { preHandler: authenticate },
    async (request, reply) => {
      const { productIds, location } = request.body as {
        productIds: string[];
        location?: string;
      };

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'productIds deve essere un array non vuoto',
        });
      }

      try {
        const results = await bomService.calculateProducibleQuantityBatch(
          productIds,
          location || 'WEB'
        );

        // Converti Map in array per la risposta JSON
        const data = Array.from(results.values());
        return reply.send({ success: true, data });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /products/:productId/clone - Clona prodotto con pipeline
   */
  server.post(
    '/products/:productId/clone',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };

      try {
        const data = cloneProductSchema.parse(request.body);
        const newProduct = await manufacturingService.cloneProduct(
          productId,
          data.newSku,
          data.newName
        );
        return reply.status(201).send({ success: true, data: newProduct });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  // ==========================================
  // FASI
  // ==========================================

  /**
   * PATCH /phases/:phaseId - Aggiorna fase
   */
  server.patch(
    '/phases/:phaseId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string };

      try {
        const data = updatePhaseSchema.parse(request.body);
        const phase = await manufacturingService.updatePhase(phaseId, data);
        return reply.send({ success: true, data: phase });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * DELETE /phases/:phaseId - Elimina fase
   */
  server.delete(
    '/phases/:phaseId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string };

      try {
        await manufacturingService.deletePhase(phaseId);
        return reply.send({ success: true, data: { message: 'Fase eliminata' } });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  // ==========================================
  // ORDINI DI PRODUZIONE
  // ==========================================

  /**
   * GET /orders - Lista ordini di produzione
   */
  server.get('/orders', { preHandler: authenticate }, async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      status?: string;
      productId?: string;
    };

    const result = await manufacturingService.listProductionOrders({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      status: query.status,
      productId: query.productId,
    });

    return reply.send({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * GET /orders/stats - Statistiche ordini produzione
   */
  server.get('/orders/stats', { preHandler: authenticate }, async (_request, reply) => {
    const stats = await manufacturingService.getProductionStats();
    return reply.send({ success: true, data: stats });
  });

  /**
   * GET /orders/:orderId - Dettaglio ordine produzione
   */
  server.get('/orders/:orderId', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await manufacturingService.getProductionOrder(orderId);

    if (!order) {
      return reply.status(404).send({ success: false, error: 'Ordine non trovato' });
    }

    return reply.send({ success: true, data: order });
  });

  /**
   * POST /orders - Crea ordine produzione
   */
  server.post(
    '/orders',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const user = (request as any).user;

      try {
        const data = createProductionOrderSchema.parse(request.body);
        const order = await manufacturingService.createProductionOrder({
          ...data,
          plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : undefined,
          plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : undefined,
          createdById: user.id,
        });
        return reply.status(201).send({ success: true, data: order });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /orders/:orderId/complete - Completa ordine produzione
   */
  server.post(
    '/orders/:orderId/complete',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };

      try {
        const order = await manufacturingService.completeProductionOrder(orderId);
        return reply.send({ success: true, data: order });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /orders/:orderId/cancel - Annulla ordine produzione
   */
  server.post(
    '/orders/:orderId/cancel',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { reason } = request.body as { reason?: string };

      try {
        const order = await manufacturingService.cancelProductionOrder(orderId, reason);
        return reply.send({ success: true, data: order });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  // ==========================================
  // FASI DI PRODUZIONE (esecuzione)
  // ==========================================

  /**
   * POST /production-phases/:phaseId/start - Avvia fase produzione
   */
  server.post(
    '/production-phases/:phaseId/start',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE')] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string };

      try {
        const data = startPhaseSchema.parse(request.body || {});
        const phase = await manufacturingService.startProductionPhase(phaseId, data.employeeId);
        return reply.send({ success: true, data: phase });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /production-phases/:phaseId/complete - Completa fase produzione
   */
  server.post(
    '/production-phases/:phaseId/complete',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE')] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string };

      try {
        const data = completePhaseSchema.parse(request.body || {});
        const phase = await manufacturingService.completeProductionPhase(phaseId, data.actualTime);
        return reply.send({ success: true, data: phase });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  // ==========================================
  // PICKING LIST
  // ==========================================

  /**
   * GET /orders/:orderId/picking-list - Genera dati picking list per ordine produzione
   */
  server.get(
    '/orders/:orderId/picking-list',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'OPERATORE')] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { location, includeSubProducts } = request.query as {
        location?: string;
        includeSubProducts?: string;
      };

      try {
        const data = await pickingListService.generateForProductionOrder(orderId, {
          location,
          includeSubProducts: includeSubProducts === 'true',
        });
        return reply.send({ success: true, data });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * GET /orders/:orderId/picking-list/pdf - Genera PDF picking list per ordine produzione
   */
  server.get(
    '/orders/:orderId/picking-list/pdf',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'OPERATORE')] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { location, includeSubProducts } = request.query as {
        location?: string;
        includeSubProducts?: string;
      };

      try {
        const pdfBuffer = await pickingListService.generateProductionOrderPickingListPdf(orderId, {
          location,
          includeSubProducts: includeSubProducts === 'true',
        });

        const order = await manufacturingService.getProductionOrder(orderId);
        const filename = `picking-list-${order?.orderNumber || orderId}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(pdfBuffer);
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * GET /orders/:orderId/picking-list/availability - Verifica disponibilità materiali
   */
  server.get(
    '/orders/:orderId/picking-list/availability',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };

      try {
        const availability = await pickingListService.checkMaterialsAvailability(orderId);
        return reply.send({ success: true, data: availability });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );
};

export default manufacturingRoutes;
