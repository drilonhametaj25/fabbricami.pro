// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util';

// Types/Interfaces

// Constants

// Main logic

/**
 * Notification Routes
 * Endpoints API per gestione notifiche utente
 */
const notificationRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/notifications
   * Lista notifiche dell'utente corrente
   */
  server.get(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const q = request.query as {
          page?: string;
          limit?: string;
          type?: string;
          isRead?: string;
        };
        const page = q.page ? Math.max(1, parseInt(q.page, 10)) : 1;
        const limit = q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10))) : 20;
        // isRead non specificato → tutte (lette + non lette); il frontend filtra
        // esplicitamente quando vuole solo le non lette.
        const isRead =
          q.isRead === 'true' ? true : q.isRead === 'false' ? false : undefined;

        const { items, total } = await notificationService.getUserNotificationsPaginated({
          userId,
          page,
          limit,
          type: q.type,
          isRead,
        });

        // Risposta paginata { items, pagination }: prima si restituiva un array
        // semplice e il frontend leggeva data.items (sempre undefined) → lista
        // vuota pur con contatore > 0 (bug "non le fa vedere").
        return paginatedResponse(reply, items, total, { page, limit });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/notifications/unread-count
   * Conta notifiche non lette
   */
  server.get(
    '/unread-count',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const count = await notificationService.getUnreadCount(userId);
        return successResponse(reply, { count });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * PATCH /api/v1/notifications/:id/read
   * Segna notifica come letta
   */
  server.patch(
    '/:id/read',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const notification = await notificationService.markAsRead(id);
        return successResponse(reply, notification);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/notifications/mark-all-read
   * Segna tutte le notifiche come lette
   */
  server.post(
    '/mark-all-read',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        await notificationService.markAllAsRead(userId);
        return successResponse(reply, { message: 'Tutte le notifiche sono state segnate come lette' });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * DELETE /api/v1/notifications/:id
   * Elimina notifica
   */
  server.delete(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await notificationService.deleteNotification(id);
        return successResponse(reply, { message: 'Notifica eliminata' });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/notifications/stats
   * Statistiche notifiche utente
   */
  server.get(
    '/stats',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const stats = await notificationService.getUserStats(userId);
        return successResponse(reply, stats);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );
};

// Exports
export default notificationRoutes;
