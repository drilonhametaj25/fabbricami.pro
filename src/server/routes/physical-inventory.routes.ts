/**
 * Physical Inventory Routes
 * API per gestione inventario fisico
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { physicalInventoryService } from '../services/physical-inventory.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Types
interface SessionParams {
  sessionId: string;
}

interface ItemParams {
  sessionId: string;
  itemId: string;
}

interface ListSessionsQuery {
  warehouseId?: string;
  status?: string;
  countType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface ItemsToCountQuery {
  page?: number;
  limit?: number;
}

interface CreateSessionBody {
  warehouseId: string;
  name: string;
  description?: string;
  countType?: 'FULL' | 'CYCLE' | 'SPOT';
  plannedDate?: string;
  requireDoubleCount?: boolean;
  freezeInventory?: boolean;
  allowBlindCount?: boolean;
  filters?: {
    categories?: string[];
    locations?: string[];
    skuPrefix?: string;
    materialOnly?: boolean;
    productOnly?: boolean;
  };
}

interface CountItemBody {
  countedQuantity: number;
  notes?: string;
}

interface VerifyItemBody {
  verifiedQuantity: number;
  notes?: string;
}

interface ReconcileItemBody {
  finalQuantity: number;
  reconcileReason?: string;
}

interface BatchCountBody {
  counts: Array<{ sku: string; quantity: number }>;
}

interface CompleteSessionBody {
  applyAdjustments?: boolean;
}

interface CancelSessionBody {
  reason?: string;
}

// Validation Schemas
const createSessionSchema = {
  body: z.object({
    warehouseId: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    countType: z.enum(['FULL', 'CYCLE', 'SPOT']).optional(),
    plannedDate: z.string().datetime().optional(),
    requireDoubleCount: z.boolean().optional(),
    freezeInventory: z.boolean().optional(),
    allowBlindCount: z.boolean().optional(),
    filters: z.object({
      categories: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      skuPrefix: z.string().optional(),
      materialOnly: z.boolean().optional(),
      productOnly: z.boolean().optional()
    }).optional()
  })
};

const countItemSchema = {
  body: z.object({
    countedQuantity: z.number().int().min(0),
    notes: z.string().optional()
  })
};

const verifyItemSchema = {
  body: z.object({
    verifiedQuantity: z.number().int().min(0),
    notes: z.string().optional()
  })
};

const reconcileItemSchema = {
  body: z.object({
    finalQuantity: z.number().int().min(0),
    reconcileReason: z.string().optional()
  })
};

const batchCountSchema = {
  body: z.object({
    counts: z.array(z.object({
      sku: z.string(),
      quantity: z.number().int().min(0)
    }))
  })
};

const completeSessionSchema = {
  body: z.object({
    applyAdjustments: z.boolean().optional()
  })
};

export async function physicalInventoryRoutes(fastify: FastifyInstance) {
  // Apply authentication to all routes
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/v1/physical-inventory/sessions
   * Lista sessioni di inventario fisico
   */
  fastify.get<{ Querystring: ListSessionsQuery }>(
    '/sessions',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE)]
    },
    async (request: FastifyRequest<{ Querystring: ListSessionsQuery }>, reply: FastifyReply) => {
      try {
        const { page, limit, warehouseId, status, countType, dateFrom, dateTo } = request.query;
        const result = await physicalInventoryService.listSessions(
          {
            warehouseId,
            status: status as any,
            countType,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
          },
          { page, limit }
        );

        return paginatedResponse(reply, result.items, result.total, { page: result.page, limit: result.limit });
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 500);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions
   * Crea nuova sessione di inventario fisico
   */
  fastify.post<{ Body: CreateSessionBody }>(
    '/sessions',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE), validate(createSessionSchema)]
    },
    async (request: FastifyRequest<{ Body: CreateSessionBody }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const session = await physicalInventoryService.createSession({
          ...request.body,
          plannedDate: request.body.plannedDate ? new Date(request.body.plannedDate) : undefined,
          createdById: userId
        });

        return successResponse(reply, session, 201);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * GET /api/v1/physical-inventory/sessions/:sessionId
   * Dettaglio sessione
   */
  fastify.get<{ Params: SessionParams }>(
    '/sessions/:sessionId',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const session = await physicalInventoryService.getSession(request.params.sessionId);
        return successResponse(reply, session);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 404);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/start
   * Avvia sessione di conteggio
   */
  fastify.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/start',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const session = await physicalInventoryService.startSession(request.params.sessionId, userId);
        return successResponse(reply, session);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * GET /api/v1/physical-inventory/sessions/:sessionId/items-to-count
   * Ottiene items da contare
   */
  fastify.get<{ Params: SessionParams; Querystring: ItemsToCountQuery }>(
    '/sessions/:sessionId/items-to-count',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE, UserRole.OPERATORE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams; Querystring: ItemsToCountQuery }>, reply: FastifyReply) => {
      try {
        const result = await physicalInventoryService.getItemsToCount(
          request.params.sessionId,
          { page: request.query.page, limit: request.query.limit }
        );
        return paginatedResponse(reply, result.items, result.total, { page: result.page, limit: result.limit });
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * GET /api/v1/physical-inventory/sessions/:sessionId/discrepancies
   * Ottiene items con discrepanze
   */
  fastify.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/discrepancies',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const items = await physicalInventoryService.getDiscrepancyItems(request.params.sessionId);
        return successResponse(reply, items);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/items/:itemId/count
   * Registra conteggio item
   */
  fastify.post<{ Params: ItemParams; Body: CountItemBody }>(
    '/sessions/:sessionId/items/:itemId/count',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE, UserRole.OPERATORE), validate(countItemSchema)]
    },
    async (request: FastifyRequest<{ Params: ItemParams; Body: CountItemBody }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const item = await physicalInventoryService.countItem({
          sessionId: request.params.sessionId,
          itemId: request.params.itemId,
          countedQuantity: request.body.countedQuantity,
          countedById: userId,
          notes: request.body.notes
        });
        return successResponse(reply, item);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/items/:itemId/verify
   * Verifica conteggio (secondo conteggio)
   */
  fastify.post<{ Params: ItemParams; Body: VerifyItemBody }>(
    '/sessions/:sessionId/items/:itemId/verify',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE), validate(verifyItemSchema)]
    },
    async (request: FastifyRequest<{ Params: ItemParams; Body: VerifyItemBody }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const item = await physicalInventoryService.verifyItem({
          sessionId: request.params.sessionId,
          itemId: request.params.itemId,
          verifiedQuantity: request.body.verifiedQuantity,
          verifiedBy: userId,
          notes: request.body.notes
        });
        return successResponse(reply, item);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/items/:itemId/reconcile
   * Riconcilia manualmente item
   */
  fastify.post<{ Params: ItemParams; Body: ReconcileItemBody }>(
    '/sessions/:sessionId/items/:itemId/reconcile',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER), validate(reconcileItemSchema)]
    },
    async (request: FastifyRequest<{ Params: ItemParams; Body: ReconcileItemBody }>, reply: FastifyReply) => {
      try {
        const item = await physicalInventoryService.reconcileItem({
          sessionId: request.params.sessionId,
          itemId: request.params.itemId,
          finalQuantity: request.body.finalQuantity,
          reconcileReason: request.body.reconcileReason
        });
        return successResponse(reply, item);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/batch-count
   * Conteggio batch (per scanner barcode)
   */
  fastify.post<{ Params: SessionParams; Body: BatchCountBody }>(
    '/sessions/:sessionId/batch-count',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE, UserRole.OPERATORE), validate(batchCountSchema)]
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: BatchCountBody }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const result = await physicalInventoryService.batchCount(
          request.params.sessionId,
          request.body.counts,
          userId
        );
        return successResponse(reply, result);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/submit-review
   * Invia sessione per revisione
   */
  fastify.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/submit-review',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAGAZZINIERE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const session = await physicalInventoryService.submitForReview(request.params.sessionId);
        return successResponse(reply, session);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/complete
   * Completa sessione e applica rettifiche
   */
  fastify.post<{ Params: SessionParams; Body: CompleteSessionBody }>(
    '/sessions/:sessionId/complete',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER), validate(completeSessionSchema)]
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: CompleteSessionBody }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const session = await physicalInventoryService.completeSession(
          request.params.sessionId,
          userId,
          request.body.applyAdjustments ?? true
        );
        return successResponse(reply, session);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * POST /api/v1/physical-inventory/sessions/:sessionId/cancel
   * Annulla sessione
   */
  fastify.post<{ Params: SessionParams; Body: CancelSessionBody }>(
    '/sessions/:sessionId/cancel',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER)]
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: CancelSessionBody }>, reply: FastifyReply) => {
      try {
        const session = await physicalInventoryService.cancelSession(
          request.params.sessionId,
          request.body.reason
        );
        return successResponse(reply, session);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );

  /**
   * GET /api/v1/physical-inventory/sessions/:sessionId/variance-report
   * Genera report varianze
   */
  fastify.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/variance-report',
    {
      preHandler: [authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CONTABILE)]
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const report = await physicalInventoryService.generateVarianceReport(request.params.sessionId);
        return successResponse(reply, report);
      } catch (error) {
        return errorResponse(reply, (error as Error).message, 400);
      }
    }
  );
}
