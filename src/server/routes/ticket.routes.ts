import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { ticketService } from '../services/ticket.service';
import { logger } from '../config/logger';

const createTicketSchema = z.object({
  type: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'SUPPORT']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
});

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
});

const listFilterSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']).optional(),
  type: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'SUPPORT']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ticketRoutes: FastifyPluginAsync = async (server: any) => {
  // ============================================
  // TENANT-FACING ENDPOINTS
  // ============================================

  /**
   * POST /tickets — crea un ticket per il tenant corrente
   */
  server.post('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const body = createTicketSchema.parse(request.body);
      const tenantId = request.user?.tenantId;
      const userId = request.user?.userId || request.user?.id;
      if (!tenantId || !userId) {
        return reply.status(403).send({ success: false, error: 'Utente non autenticato' });
      }
      const ticket = await ticketService.create({
        tenantId,
        createdById: userId,
        type: body.type as any,
        priority: body.priority as any,
        title: body.title,
        description: body.description,
      });
      return reply.status(201).send({ success: true, data: ticket });
    } catch (error: any) {
      logger.error('Create ticket error:', error);
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /tickets — lista ticket del tenant corrente
   */
  server.get('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const filter = listFilterSchema.parse(request.query || {});
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(403).send({ success: false, error: 'Tenant non identificato' });
      }
      const result = await ticketService.list({ ...filter, tenantId });
      return reply.send({ success: true, data: result.items, total: result.total });
    } catch (error: any) {
      logger.error('List tickets error:', error);
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /tickets/:id — dettaglio ticket (tenant)
   */
  server.get('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = request.user?.tenantId;
      const ticket = await ticketService.getById(id, tenantId);
      if (!ticket) {
        return reply.status(404).send({ success: false, error: 'Ticket non trovato' });
      }
      return reply.send({ success: true, data: ticket });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

};

export { updateTicketSchema, listFilterSchema };
export default ticketRoutes;
