/**
 * RMA Routes
 * API per gestione Resi (Return Merchandise Authorization)
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { rmaService } from '../services/rma.service';
import { z } from 'zod';
import { RmaStatus, RmaReason, RmaResolution } from '@prisma/client';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const rmaQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(RmaStatus).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  reason: z.nativeEnum(RmaReason).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createRmaItemSchema = z.object({
  orderItemId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  sku: z.string().min(1),
  productName: z.string().min(1),
  quantityRequested: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

const createRmaSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  reason: z.nativeEnum(RmaReason),
  reasonDetail: z.string().optional(),
  customerEmail: z.string().email().optional(),
  items: z.array(createRmaItemSchema).min(1, 'Almeno un articolo richiesto'),
});

const approveRmaSchema = z.object({
  returnShippingMethod: z.string().optional(),
  returnLabelUrl: z.string().url().optional(),
  internalNotes: z.string().optional(),
});

const rejectRmaSchema = z.object({
  reason: z.string().optional(),
});

const updateShippingSchema = z.object({
  trackingNumber: z.string().min(1),
  carrier: z.string().optional(),
});

const receiveItemSchema = z.object({
  rmaItemId: z.string().uuid(),
  quantityReceived: z.number().int().min(0),
  condition: z.enum(['LIKE_NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE']),
  conditionNotes: z.string().optional(),
  canRestock: z.boolean(),
});

const receiveRmaSchema = z.object({
  items: z.array(receiveItemSchema).min(1),
  inspectionNotes: z.string().optional(),
});

const inspectionSchema = z.object({
  notes: z.string().min(1),
  itemCondition: z.enum(['LIKE_NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE', 'MIXED']),
  photos: z.array(z.object({
    url: z.string().url(),
    description: z.string().optional(),
  })).optional(),
});

const completeRmaSchema = z.object({
  resolution: z.nativeEnum(RmaResolution),
  resolutionNotes: z.string().optional(),
  refundAmount: z.number().min(0).optional(),
  exchangeOrderId: z.string().uuid().optional(),
  storeCreditCode: z.string().optional(),
});

const restockSchema = z.object({
  location: z.string().optional().default('WEB'),
});

const cancelRmaSchema = z.object({
  reason: z.string().optional(),
});

const addNoteSchema = z.object({
  note: z.string().min(1),
});

const statisticsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ============================================
// ROUTES
// ============================================

const rmaRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // RMA CRUD
  // ============================================

  /**
   * GET /api/v1/rma
   * Lista RMA con filtri e paginazione
   */
  server.get(
    '/',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = rmaQuerySchema.parse(request.query);
        const result = await rmaService.list(query);
        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore lista RMA',
        });
      }
    }
  );

  /**
   * GET /api/v1/rma/statistics
   * Statistiche RMA
   */
  server.get(
    '/statistics',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { dateFrom, dateTo } = statisticsQuerySchema.parse(request.query);
        const stats = await rmaService.getStatistics(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined
        );
        return reply.send({ success: true, data: stats });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore statistiche RMA',
        });
      }
    }
  );

  /**
   * GET /api/v1/rma/pending-actions
   * RMA in attesa di azione
   */
  server.get(
    '/pending-actions',
    { preHandler: authenticate },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const pending = await rmaService.getPendingActions();
        return reply.send({ success: true, data: pending });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero azioni pendenti',
        });
      }
    }
  );

  /**
   * GET /api/v1/rma/recent
   * RMA recenti
   */
  server.get(
    '/recent',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit } = request.query as { limit?: string };
        const rmas = await rmaService.getRecent(limit ? parseInt(limit, 10) : 10);
        return reply.send({ success: true, data: rmas });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore RMA recenti',
        });
      }
    }
  );

  /**
   * GET /api/v1/rma/:id
   * Recupera un RMA per ID
   */
  server.get(
    '/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const rma = await rmaService.getById(id);

        if (!rma) {
          return reply.status(404).send({
            success: false,
            error: 'RMA non trovato',
          });
        }

        return reply.send({ success: true, data: rma });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero RMA',
        });
      }
    }
  );

  /**
   * GET /api/v1/rma/number/:rmaNumber
   * Recupera un RMA per numero
   */
  server.get(
    '/number/:rmaNumber',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { rmaNumber } = request.params as { rmaNumber: string };
        const rma = await rmaService.getByNumber(rmaNumber);

        if (!rma) {
          return reply.status(404).send({
            success: false,
            error: 'RMA non trovato',
          });
        }

        return reply.send({ success: true, data: rma });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero RMA',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma
   * Crea una nuova richiesta RMA
   */
  server.post(
    '/',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createRmaSchema.parse(request.body);
        const rma = await rmaService.create(data);

        return reply.status(201).send({
          success: true,
          data: rma,
          message: `RMA ${rma.rmaNumber} creato con successo`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore creazione RMA',
        });
      }
    }
  );

  // ============================================
  // RMA WORKFLOW
  // ============================================

  /**
   * POST /api/v1/rma/:id/approve
   * Approva un RMA
   */
  server.post(
    '/:id/approve',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = approveRmaSchema.parse(request.body || {});
        const user = (request as any).user;

        const rma = await rmaService.approve(id, {
          ...data,
          approvedBy: user.id,
        });

        return reply.send({
          success: true,
          data: rma,
          message: 'RMA approvato con successo',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore approvazione RMA',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/reject
   * Rifiuta un RMA
   */
  server.post(
    '/:id/reject',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { reason } = rejectRmaSchema.parse(request.body || {});
        const user = (request as any).user;

        const rma = await rmaService.reject(id, user.id, reason);

        return reply.send({
          success: true,
          data: rma,
          message: 'RMA rifiutato',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore rifiuto RMA',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/shipping
   * Aggiorna tracking spedizione
   */
  server.post(
    '/:id/shipping',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { trackingNumber, carrier } = updateShippingSchema.parse(request.body);

        const rma = await rmaService.updateShipping(id, trackingNumber, carrier);

        return reply.send({
          success: true,
          data: rma,
          message: 'Tracking aggiornato',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiornamento tracking',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/receive
   * Ricevi il reso in magazzino
   */
  server.post(
    '/:id/receive',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = receiveRmaSchema.parse(request.body);
        const user = (request as any).user;

        const rma = await rmaService.receive(id, {
          ...data,
          receivedBy: user.id,
        });

        return reply.send({
          success: true,
          data: rma,
          message: 'Reso ricevuto',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore ricezione reso',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/inspection/start
   * Avvia ispezione
   */
  server.post(
    '/:id/inspection/start',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;

        const rma = await rmaService.startInspection(id, user.id);

        return reply.send({
          success: true,
          data: rma,
          message: 'Ispezione avviata',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore avvio ispezione',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/inspection/complete
   * Completa ispezione
   */
  server.post(
    '/:id/inspection/complete',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { notes, itemCondition, photos } = inspectionSchema.parse(request.body);
        const user = (request as any).user;

        const rma = await rmaService.completeInspection(id, user.id, notes, itemCondition, photos);

        return reply.send({
          success: true,
          data: rma,
          message: 'Ispezione completata',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore completamento ispezione',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/complete
   * Completa RMA con risoluzione
   */
  server.post(
    '/:id/complete',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = completeRmaSchema.parse(request.body);
        const user = (request as any).user;

        const rma = await rmaService.complete(id, {
          ...data,
          completedBy: user.id,
        });

        return reply.send({
          success: true,
          data: rma,
          message: `RMA completato - Risoluzione: ${data.resolution}`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore completamento RMA',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/restock
   * Effettua restock degli items
   */
  server.post(
    '/:id/restock',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { location } = restockSchema.parse(request.body || {});
        const user = (request as any).user;

        const result = await rmaService.restockItems(id, location, user.id);

        return reply.send({
          success: true,
          data: result,
          message: `Restock completato: ${result.restockedItems.length} items`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore restock',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/cancel
   * Annulla un RMA
   */
  server.post(
    '/:id/cancel',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'COMMERCIALE')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { reason } = cancelRmaSchema.parse(request.body || {});
        const user = (request as any).user;

        const rma = await rmaService.cancel(id, user.id, reason);

        return reply.send({
          success: true,
          data: rma,
          message: 'RMA annullato',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore annullamento RMA',
        });
      }
    }
  );

  /**
   * POST /api/v1/rma/:id/note
   * Aggiunge nota interna
   */
  server.post(
    '/:id/note',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { note } = addNoteSchema.parse(request.body);

        const rma = await rmaService.addInternalNote(id, note);

        return reply.send({
          success: true,
          data: rma,
          message: 'Nota aggiunta',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiunta nota',
        });
      }
    }
  );
};

export default rmaRoutes;
