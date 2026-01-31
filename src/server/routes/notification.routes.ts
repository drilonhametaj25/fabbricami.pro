// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';
import { successResponse, errorResponse } from '../utils/response.util';

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
        const userId = (request.user as any).id;
        const { includeRead } = request.query as { includeRead?: string };
        
        const notifications = await notificationService.getUserNotifications(
          userId,
          includeRead === 'true'
        );
        
        return successResponse(reply, notifications);
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
        const userId = (request.user as any).id;
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
        const userId = (request.user as any).id;
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
        const userId = (request.user as any).id;
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
