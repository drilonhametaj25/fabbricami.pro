// Imports
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { getWorkProcessService } from '../services/work-process.service';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../utils/response.util';
import { logger } from '../config/logger';

// Types
interface WorkProcessParams {
  id: string;
}

interface ProductParams {
  productId: string;
}

interface CreateWorkProcessBody {
  productId: string;
  operationName: string;
  sequence: number;
  standardTime: number;
  hourlyRate: number;
  setupTime?: number;
  description?: string;
}

interface UpdateWorkProcessBody {
  operationName?: string;
  sequence?: number;
  standardTime?: number;
  hourlyRate?: number;
  setupTime?: number;
  description?: string;
}

interface ReorderBody {
  operationIds: string[];
}

interface DuplicateBody {
  sourceProductId: string;
  targetProductId: string;
}

interface ProductionTimeQuery {
  quantity?: number;
}

// Routes
export default async function workProcessRoutes(fastify: FastifyInstance) {
  const workProcessService = getWorkProcessService(prisma);

  /**
   * GET /api/v1/work-processes/product/:productId
   * Recupera tutte le lavorazioni di un prodotto
   */
  fastify.get<{
    Params: ProductParams;
  }>(
    '/product/:productId',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) => {
      try {
        const { productId } = request.params;
        const workProcesses = await workProcessService.getProductWorkProcesses(productId);
        return successResponse(reply, workProcesses);
      } catch (error: any) {
        logger.error('Error in GET /work-processes/product/:productId:', error);
        return errorResponse(reply, error.message || 'Errore nel recupero delle lavorazioni');
      }
    }
  );

  /**
   * GET /api/v1/work-processes/:id
   * Recupera lavorazione per ID
   */
  fastify.get<{
    Params: WorkProcessParams;
  }>(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Params: WorkProcessParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const workProcess = await workProcessService.getWorkProcessById(id);
        return successResponse(reply, workProcess);
      } catch (error: any) {
        logger.error('Error in GET /work-processes/:id:', error);
        return errorResponse(reply, error.message || 'Lavorazione non trovata');
      }
    }
  );

  /**
   * POST /api/v1/work-processes
   * Crea nuova lavorazione
   */
  fastify.post<{
    Body: CreateWorkProcessBody;
  }>(
    '/',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Body: CreateWorkProcessBody }>, reply: FastifyReply) => {
      try {
        const workProcess = await workProcessService.createWorkProcess(request.body);
        return successResponse(reply, workProcess);
      } catch (error: any) {
        logger.error('Error in POST /work-processes:', error);
        return errorResponse(reply, error.message || 'Errore nella creazione della lavorazione');
      }
    }
  );

  /**
   * PATCH /api/v1/work-processes/:id
   * Aggiorna lavorazione
   */
  fastify.patch<{
    Params: WorkProcessParams;
    Body: UpdateWorkProcessBody;
  }>(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (
      request: FastifyRequest<{ Params: WorkProcessParams; Body: UpdateWorkProcessBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const workProcess = await workProcessService.updateWorkProcess(id, request.body);
        return successResponse(reply, workProcess);
      } catch (error: any) {
        logger.error('Error in PATCH /work-processes/:id:', error);
        return errorResponse(reply, error.message || 'Errore nell\'aggiornamento della lavorazione');
      }
    }
  );

  /**
   * DELETE /api/v1/work-processes/:id
   * Elimina lavorazione
   */
  fastify.delete<{
    Params: WorkProcessParams;
  }>(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Params: WorkProcessParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        await workProcessService.deleteWorkProcess(id);
        return successResponse(reply, { message: 'Lavorazione eliminata con successo' });
      } catch (error: any) {
        logger.error('Error in DELETE /work-processes/:id:', error);
        return errorResponse(reply, error.message || 'Errore nell\'eliminazione della lavorazione');
      }
    }
  );

  /**
   * POST /api/v1/work-processes/product/:productId/reorder
   * Riordina le lavorazioni di un prodotto
   */
  fastify.post<{
    Params: ProductParams;
    Body: ReorderBody;
  }>(
    '/product/:productId/reorder',
    {
      preHandler: [authenticate],
    },
    async (
      request: FastifyRequest<{ Params: ProductParams; Body: ReorderBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { productId } = request.params;
        const { operationIds } = request.body;
        const workProcesses = await workProcessService.reorderWorkProcesses(productId, operationIds);
        return successResponse(reply, workProcesses);
      } catch (error: any) {
        logger.error('Error in POST /work-processes/product/:productId/reorder:', error);
        return errorResponse(reply, error.message || 'Errore nel riordino delle lavorazioni');
      }
    }
  );

  /**
   * POST /api/v1/work-processes/duplicate
   * Duplica le lavorazioni da un prodotto a un altro
   */
  fastify.post<{
    Body: DuplicateBody;
  }>(
    '/duplicate',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Body: DuplicateBody }>, reply: FastifyReply) => {
      try {
        const { sourceProductId, targetProductId } = request.body;
        const workProcesses = await workProcessService.duplicateWorkProcesses(
          sourceProductId,
          targetProductId
        );
        return successResponse(reply, workProcesses);
      } catch (error: any) {
        logger.error('Error in POST /work-processes/duplicate:', error);
        return errorResponse(reply, error.message || 'Errore nella duplicazione delle lavorazioni');
      }
    }
  );

  /**
   * GET /api/v1/work-processes/product/:productId/cost
   * Calcola il costo di lavorazione per un prodotto
   */
  fastify.get<{
    Params: ProductParams;
  }>(
    '/product/:productId/cost',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) => {
      try {
        const { productId } = request.params;
        const cost = await workProcessService.calculateProductOperationCost(productId);
        return successResponse(reply, cost);
      } catch (error: any) {
        logger.error('Error in GET /work-processes/product/:productId/cost:', error);
        return errorResponse(reply, error.message || 'Errore nel calcolo del costo');
      }
    }
  );

  /**
   * GET /api/v1/work-processes/product/:productId/production-time
   * Calcola il tempo di produzione per un prodotto
   */
  fastify.get<{
    Params: ProductParams;
    Querystring: ProductionTimeQuery;
  }>(
    '/product/:productId/production-time',
    {
      preHandler: [authenticate],
    },
    async (
      request: FastifyRequest<{ Params: ProductParams; Querystring: ProductionTimeQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { productId } = request.params;
        const { quantity = 1 } = request.query;
        const time = await workProcessService.calculateProductionTime(productId, quantity);
        return successResponse(reply, time);
      } catch (error: any) {
        logger.error('Error in GET /work-processes/product/:productId/production-time:', error);
        return errorResponse(reply, error.message || 'Errore nel calcolo del tempo di produzione');
      }
    }
  );
}
