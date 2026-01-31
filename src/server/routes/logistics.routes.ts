// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import logisticsPlanningService from '../services/logistics-planning.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Logistics Routes
 * Endpoints API per pianificazione logistica
 */
const logisticsRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/logistics/dashboard
   * Dashboard KPI logistica
   */
  server.get(
    '/dashboard',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Logistics'],
        description: 'Dashboard KPI logistica',
      },
    },
    async (request, reply) => {
      try {
        const dashboard = await logisticsPlanningService.getLogisticsDashboard();
        return successResponse(reply, dashboard);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/logistics/incoming
   * Materiali in arrivo (pipeline arrivi)
   */
  server.get(
    '/incoming',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Logistics'],
        description: 'Materiali in arrivo',
      },
    },
    async (request, reply) => {
      try {
        const { supplierId, daysAhead, status } = request.query as {
          supplierId?: string;
          daysAhead?: string;
          status?: string;
        };

        const options: any = {};
        if (supplierId) options.supplierId = supplierId;
        if (daysAhead) options.daysAhead = parseInt(daysAhead, 10);
        if (status) options.status = status.split(',');

        const result = await logisticsPlanningService.getIncomingMaterials(options);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/logistics/fulfillment-forecast
   * Previsione evasione ordini
   */
  server.get(
    '/fulfillment-forecast',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE', 'COMMERCIALE')],
      schema: {
        tags: ['Logistics'],
        description: 'Previsione evasione ordini',
      },
    },
    async (request, reply) => {
      try {
        const { customerId, limit, includeShipped } = request.query as {
          customerId?: string;
          limit?: string;
          includeShipped?: string;
        };

        const options: any = {};
        if (customerId) options.customerId = customerId;
        if (limit) options.limit = parseInt(limit, 10);
        if (includeShipped) options.includeShipped = includeShipped === 'true';

        const result = await logisticsPlanningService.getOrderFulfillmentForecast(options);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/logistics/ready-to-ship
   * Ordini pronti per spedizione
   */
  server.get(
    '/ready-to-ship',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Logistics'],
        description: 'Ordini pronti per spedizione',
      },
    },
    async (request, reply) => {
      try {
        const result = await logisticsPlanningService.getReadyToShipOrders();
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/logistics/production-schedule
   * Programmazione produzione
   */
  server.get(
    '/production-schedule',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE')],
      schema: {
        tags: ['Logistics'],
        description: 'Programmazione produzione',
      },
    },
    async (request, reply) => {
      try {
        const { status, daysAhead } = request.query as {
          status?: string;
          daysAhead?: string;
        };

        const options: any = {};
        if (status) options.status = status.split(',');
        if (daysAhead) options.daysAhead = parseInt(daysAhead, 10);

        const result = await logisticsPlanningService.getProductionSchedule(options);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/logistics/material-timeline/:id
   * Timeline materiale con proiezione stock
   */
  server.get(
    '/material-timeline/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')],
      schema: {
        tags: ['Logistics'],
        description: 'Timeline materiale',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { daysAhead } = request.query as { daysAhead?: string };

        const result = await logisticsPlanningService.getMaterialTimeline(
          id,
          daysAhead ? parseInt(daysAhead, 10) : 30
        );
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const statusCode = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, statusCode);
      }
    }
  );
};

// Exports
export default logisticsRoutes;
