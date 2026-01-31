// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import calendarService from '../services/calendar.service';
import { successResponse, errorResponse } from '../utils/response.util';

// Types/Interfaces

// Constants

// Main logic

/**
 * Calendar Routes
 * Endpoints API per gestione eventi calendario
 */
const calendarRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/calendar/events
   * Lista eventi con filtri
   */
  server.get(
    '/events',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const query = request.query as any;
        const result = await calendarService.listEvents(query);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/calendar/events/:id
   * Dettaglio evento
   */
  server.get(
    '/events/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const event = await calendarService.getEventById(id);
        return successResponse(reply, event);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/calendar/events
   * Crea nuovo evento
   */
  server.post(
    '/events',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const event = await calendarService.createEvent(request.body as any);
        return successResponse(reply.status(201), event);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * PATCH /api/v1/calendar/events/:id
   * Aggiorna evento
   */
  server.patch(
    '/events/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const event = await calendarService.updateEvent(id, request.body as any);
        return successResponse(reply, event);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * DELETE /api/v1/calendar/events/:id
   * Elimina evento
   */
  server.delete(
    '/events/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await calendarService.deleteEvent(id);
        return successResponse(reply, { message: 'Evento eliminato' });
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/calendar/today
   * Eventi del giorno corrente
   */
  server.get(
    '/today',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const events = await calendarService.getTodayEvents();
        return successResponse(reply, events);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/calendar/month
   * Eventi del mese
   */
  server.get(
    '/month',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { year, month } = request.query as { year: string; month: string };
        const events = await calendarService.getMonthEvents(
          parseInt(year),
          parseInt(month)
        );
        return successResponse(reply, events);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/calendar/statistics
   * Statistiche eventi
   */
  server.get(
    '/statistics',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const stats = await calendarService.getEventStatistics();
        return successResponse(reply, stats);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );
};

// Exports
export default calendarRoutes;
