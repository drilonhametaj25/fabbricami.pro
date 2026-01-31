import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import analyticsService from '../services/analytics.service';

const analyticsRoutes: FastifyPluginAsync = async (server: any) => {
  /**
   * GET /kpis - KPI principali (alias per dashboard)
   */
  server.get('/kpis', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      // Default periodo: ultimi 30 giorni
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const kpis = await analyticsService.getDashboardKPIs({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const lowStockItems = await analyticsService.getLowStockReport();

      return reply.send({
        success: true,
        data: {
          ...kpis,
          lowStockItems: lowStockItems.slice(0, 5),
          period: {
            start: startDate,
            end: endDate,
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /dashboard - Dashboard KPI
   */
  server.get('/dashboard', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      const dashboardData = await analyticsService.getDashboardData();

      return reply.send({
        success: true,
        data: dashboardData,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /sales/trend - Trend vendite mensile
   */
  server.get('/sales/trend', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { year } = request.query as { year?: number };
      const targetYear = year || new Date().getFullYear();

      const trend = await analyticsService.getSalesTrend(targetYear);

      return reply.send({
        success: true,
        data: trend,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /sales-trend - Alias per trend vendite (compatibilità frontend)
   */
  server.get('/sales-trend', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { year, period: _period } = request.query as { year?: number; period?: number };
      const targetYear = year || new Date().getFullYear();

      const trend = await analyticsService.getSalesTrend(targetYear);

      return reply.send({
        success: true,
        data: trend,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /products/top - Top prodotti
   */
  server.get('/products/top', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { limit } = request.query as { limit?: number };
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const topProducts = await analyticsService.getTopProducts(
        {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        limit || 10
      );

      return reply.send({
        success: true,
        data: topProducts,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /customers/top - Top clienti
   */
  server.get('/customers/top', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { limit } = request.query as { limit?: number };
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const topCustomers = await analyticsService.getTopCustomers(
        {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        limit || 10
      );

      return reply.send({
        success: true,
        data: topCustomers,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /top-products - Alias per top prodotti (compatibilità frontend)
   */
  server.get('/top-products', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { limit } = request.query as { limit?: number };

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const topProducts = await analyticsService.getTopProducts(
        {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        limit || 10
      );

      return reply.send({
        success: true,
        data: topProducts,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /top-customers - Alias per top clienti (compatibilità frontend)
   */
  server.get('/top-customers', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { limit } = request.query as { limit?: number };

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const topCustomers = await analyticsService.getTopCustomers(
        {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        limit || 10
      );

      return reply.send({
        success: true,
        data: topCustomers,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /performance-by-source - Performance per canale/sorgente
   */
  server.get('/performance-by-source', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {

      // Ritorna dati placeholder per il grafico a ciambella
      // TODO: Implementare quando sarà disponibile il campo source negli ordini
      const performanceData = [
        { source: 'Online', revenue: 0, ordersCount: 0 },
        { source: 'Negozio', revenue: 0, ordersCount: 0 },
        { source: 'Telefono', revenue: 0, ordersCount: 0 },
      ];

      return reply.send({
        success: true,
        data: performanceData,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /abc-analysis - Analisi ABC prodotti
   */
  server.get('/abc-analysis', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Ultimi 3 mesi

      const analysis = await analyticsService.getABCAnalysis({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      return reply.send({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default analyticsRoutes;

