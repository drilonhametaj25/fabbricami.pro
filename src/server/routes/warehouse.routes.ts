// Imports
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { getWarehouseService } from '../services/warehouse.service';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  getWarehouseByIdSchema,
  deleteWarehouseSchema,
  getWarehousesSchema,
  setPrimaryWarehouseSchema,
} from '../schemas/warehouse.schema';
import { successResponse, errorResponse } from '../utils/response.util';
import { logger } from '../config/logger';

// Types
interface GetWarehousesQuerystring {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

interface WarehouseParams {
  id: string;
}

interface CreateWarehouseBody {
  code: string;
  name: string;
  description?: string;
  address?: any;
  isActive?: boolean;
  isPrimary?: boolean;
}

interface UpdateWarehouseBody {
  code?: string;
  name?: string;
  description?: string;
  address?: any;
  isActive?: boolean;
  isPrimary?: boolean;
}

// Routes
export default async function warehouseRoutes(fastify: FastifyInstance) {
  const warehouseService = getWarehouseService(prisma);

  /**
   * GET /api/v1/warehouses
   * Recupera tutti i magazzini con filtri
   */
  fastify.get<{
    Querystring: GetWarehousesQuerystring;
  }>(
    '/',
    {
      preHandler: [authenticate, validate(getWarehousesSchema)],
    },
    async (request: FastifyRequest<{ Querystring: GetWarehousesQuerystring }>, reply: FastifyReply) => {
      try {
        const { page = 1, limit = 20, isActive, search } = request.query;

        const result = await warehouseService.getAllWarehouses(
          { isActive, search },
          page,
          limit
        );

        return successResponse(reply, result);
      } catch (error: any) {
        logger.error('Error in GET /warehouses:', error);
        return errorResponse(reply, error.message || 'Errore nel recupero dei magazzini', 500);
      }
    }
  );

  /**
   * GET /api/v1/warehouses/primary
   * Recupera il magazzino principale
   */
  fastify.get(
    '/primary',
    {
      preHandler: [authenticate],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const warehouse = await warehouseService.getPrimaryWarehouse();
        return successResponse(reply, warehouse);
      } catch (error: any) {
        logger.error('Error in GET /warehouses/primary:', error);
        return errorResponse(reply, error.message || 'Errore nel recupero del magazzino principale', 404);
      }
    }
  );

  /**
   * GET /api/v1/warehouses/:id
   * Recupera magazzino per ID
   */
  fastify.get<{
    Params: WarehouseParams;
  }>(
    '/:id',
    {
      preHandler: [authenticate, validate(getWarehouseByIdSchema)],
    },
    async (request: FastifyRequest<{ Params: WarehouseParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const warehouse = await warehouseService.getWarehouseById(id);
        return successResponse(reply, warehouse);
      } catch (error: any) {
        logger.error('Error in GET /warehouses/:id:', error);
        return errorResponse(reply, error.message || 'Magazzino non trovato', 404);
      }
    }
  );

  /**
   * GET /api/v1/warehouses/:id/stats
   * Recupera statistiche magazzino
   */
  fastify.get<{
    Params: WarehouseParams;
  }>(
    '/:id/stats',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest<{ Params: WarehouseParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const stats = await warehouseService.getWarehouseStats(id);
        return successResponse(reply, stats);
      } catch (error: any) {
        logger.error('Error in GET /warehouses/:id/stats:', error);
        return errorResponse(reply, error.message || 'Errore nel recupero delle statistiche', 500);
      }
    }
  );

  /**
   * POST /api/v1/warehouses
   * Crea nuovo magazzino
   */
  fastify.post<{
    Body: CreateWarehouseBody;
  }>(
    '/',
    {
      preHandler: [authenticate, validate(createWarehouseSchema)],
    },
    async (request: FastifyRequest<{ Body: CreateWarehouseBody }>, reply: FastifyReply) => {
      try {
        const warehouse = await warehouseService.createWarehouse(request.body);
        return successResponse(reply, warehouse, 201);
      } catch (error: any) {
        logger.error('Error in POST /warehouses:', error);
        return errorResponse(reply, error.message || 'Errore nella creazione del magazzino', 400);
      }
    }
  );

  /**
   * PATCH /api/v1/warehouses/:id
   * Aggiorna magazzino
   */
  fastify.patch<{
    Params: WarehouseParams;
    Body: UpdateWarehouseBody;
  }>(
    '/:id',
    {
      preHandler: [authenticate, validate(updateWarehouseSchema)],
    },
    async (
      request: FastifyRequest<{ Params: WarehouseParams; Body: UpdateWarehouseBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const warehouse = await warehouseService.updateWarehouse(id, request.body);
        return successResponse(reply, warehouse);
      } catch (error: any) {
        logger.error('Error in PATCH /warehouses/:id:', error);
        return errorResponse(reply, error.message || 'Errore nell\'aggiornamento del magazzino', 400);
      }
    }
  );

  /**
   * PATCH /api/v1/warehouses/:id/set-primary
   * Imposta magazzino come principale
   */
  fastify.patch<{
    Params: WarehouseParams;
  }>(
    '/:id/set-primary',
    {
      preHandler: [authenticate, validate(setPrimaryWarehouseSchema)],
    },
    async (request: FastifyRequest<{ Params: WarehouseParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const warehouse = await warehouseService.setPrimaryWarehouse(id);
        return successResponse(reply, warehouse);
      } catch (error: any) {
        logger.error('Error in PATCH /warehouses/:id/set-primary:', error);
        return errorResponse(reply, error.message || 'Errore nell\'impostazione del magazzino principale', 400);
      }
    }
  );

  /**
   * DELETE /api/v1/warehouses/:id
   * Elimina magazzino (soft delete)
   */
  fastify.delete<{
    Params: WarehouseParams;
  }>(
    '/:id',
    {
      preHandler: [authenticate, validate(deleteWarehouseSchema)],
    },
    async (request: FastifyRequest<{ Params: WarehouseParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const warehouse = await warehouseService.deleteWarehouse(id);
        return successResponse(reply, warehouse);
      } catch (error: any) {
        logger.error('Error in DELETE /warehouses/:id:', error);
        return errorResponse(reply, error.message || 'Errore nell\'eliminazione del magazzino', 400);
      }
    }
  );
}
