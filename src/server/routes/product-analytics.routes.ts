import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import productAnalyticsService from '../services/product-analytics.service';
import { IdeationCostType } from '@prisma/client';

const productAnalyticsRoutes: FastifyPluginAsync = async (server: any) => {
  // ==========================================
  // SINGLE PRODUCT ANALYTICS
  // ==========================================

  /**
   * GET /products/:id/analytics - Complete analytics for a single product
   */
  server.get(
    '/products/:id/analytics',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const { start, end } = request.query as { start?: string; end?: string };

        // Default period: last 90 days
        const endDate = end ? new Date(end) : new Date();
        const startDate = start ? new Date(start) : new Date(endDate);
        if (!start) {
          startDate.setDate(startDate.getDate() - 90);
        }

        const analytics = await productAnalyticsService.getProductAnalytics(id, {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });

        return reply.send({
          success: true,
          data: analytics,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /products/:id/sales-trend - Sales over time for a product
   */
  server.get(
    '/products/:id/sales-trend',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const { start, end, granularity } = request.query as {
          start?: string;
          end?: string;
          granularity?: 'day' | 'week' | 'month';
        };

        const endDate = end ? new Date(end) : new Date();
        const startDate = start ? new Date(start) : new Date(endDate);
        if (!start) {
          startDate.setDate(startDate.getDate() - 90);
        }

        const salesData = await productAnalyticsService.getProductSalesOverTime(
          id,
          { start: startDate.toISOString(), end: endDate.toISOString() },
          granularity || 'day'
        );

        return reply.send({
          success: true,
          data: salesData,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /products/:id/break-even - Break-even analysis for a product
   */
  server.get(
    '/products/:id/break-even',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const breakEven = await productAnalyticsService.calculateBreakEven(id);

        return reply.send({
          success: true,
          data: breakEven,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /products/:id/profit-tracking - Cumulative profit tracking
   */
  server.get(
    '/products/:id/profit-tracking',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const { start, end } = request.query as { start?: string; end?: string };

        const endDate = end ? new Date(end) : new Date();
        const startDate = start ? new Date(start) : new Date(endDate);
        if (!start) {
          startDate.setFullYear(startDate.getFullYear() - 1); // Default: last year
        }

        const profitData = await productAnalyticsService.getCumulativeProfitTrack(id, {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });

        return reply.send({
          success: true,
          data: profitData,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ==========================================
  // IDEATION COSTS CRUD
  // ==========================================

  /**
   * GET /products/:id/ideation-costs - Get all ideation costs for a product
   */
  server.get(
    '/products/:id/ideation-costs',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const costs = await productAnalyticsService.getProductIdeationCosts(id);

        return reply.send({
          success: true,
          data: costs,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /products/:id/ideation-costs - Add an ideation cost
   */
  server.post(
    '/products/:id/ideation-costs',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply: any) => {
      try {
        const { id } = request.params;
        const { type, description, amount, date, amortizedUnits, notes } = request.body as {
          type: IdeationCostType;
          description: string;
          amount: number;
          date?: string;
          amortizedUnits?: number;
          notes?: string;
        };

        const cost = await productAnalyticsService.addIdeationCost(id, {
          type,
          description,
          amount,
          date: date ? new Date(date) : undefined,
          amortizedUnits,
          notes,
        });

        return reply.status(201).send({
          success: true,
          data: cost,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * PUT /products/:id/ideation-costs/:costId - Update an ideation cost
   */
  server.put(
    '/products/:id/ideation-costs/:costId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply: any) => {
      try {
        const { costId } = request.params;
        const { type, description, amount, date, amortizedUnits, notes } = request.body as {
          type?: IdeationCostType;
          description?: string;
          amount?: number;
          date?: string;
          amortizedUnits?: number;
          notes?: string;
        };

        const cost = await productAnalyticsService.updateIdeationCost(costId, {
          type,
          description,
          amount,
          date: date ? new Date(date) : undefined,
          amortizedUnits,
          notes,
        });

        return reply.send({
          success: true,
          data: cost,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * DELETE /products/:id/ideation-costs/:costId - Delete an ideation cost
   */
  server.delete(
    '/products/:id/ideation-costs/:costId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply: any) => {
      try {
        const { costId } = request.params;
        await productAnalyticsService.deleteIdeationCost(costId);

        return reply.send({
          success: true,
          message: 'Costo ideazione eliminato',
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ==========================================
  // PRODUCT COMPARISON & ADVANCED ANALYTICS
  // ==========================================

  /**
   * GET /analytics/products/compare - Compare multiple products
   */
  server.get(
    '/analytics/products/compare',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { ids, start, end } = request.query as {
          ids: string;
          start?: string;
          end?: string;
        };

        if (!ids) {
          return reply.status(400).send({
            success: false,
            error: 'Parametro ids richiesto (es: ?ids=id1,id2,id3)',
          });
        }

        const productIds = ids.split(',').filter((id: string) => id.trim());

        if (productIds.length < 2) {
          return reply.status(400).send({
            success: false,
            error: 'Almeno 2 prodotti richiesti per il confronto',
          });
        }

        if (productIds.length > 5) {
          return reply.status(400).send({
            success: false,
            error: 'Massimo 5 prodotti per il confronto',
          });
        }

        const endDate = end ? new Date(end) : new Date();
        const startDate = start ? new Date(start) : new Date(endDate);
        if (!start) {
          startDate.setDate(startDate.getDate() - 90);
        }

        const comparison = await productAnalyticsService.compareProducts(productIds, {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });

        // Transform data to match frontend expected structure
        const products = comparison.map((item: any) => ({
          productId: item.product?.id,
          productName: item.product?.name,
          productSku: item.product?.sku,
          salesData: item.salesData,
          metrics: {
            totalRevenue: item.summary?.totalRevenue || 0,
            totalQuantity: item.summary?.totalQuantity || 0,
            avgMargin: (item.summary?.avgMargin || 0) / 100, // Convert to decimal
            totalProfit: item.summary?.totalProfit || 0,
            trend: 0, // TODO: Calculate trend from salesData if needed
          },
        }));

        return reply.send({
          success: true,
          data: { products },
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /analytics/products/seasonality - Analyze product seasonality
   */
  server.get(
    '/analytics/products/seasonality',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { productId, limit } = request.query as { productId?: string; limit?: string };

        const seasonality = await productAnalyticsService.analyzeSeasonality(productId);
        const limitNum = limit ? parseInt(limit) : 20;

        return reply.send({
          success: true,
          data: seasonality.slice(0, limitNum),
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /analytics/products/recommendations - Get product recommendations
   */
  server.get(
    '/analytics/products/recommendations',
    { preHandler: authenticate },
    async (_request: any, reply: any) => {
      try {
        const recommendations = await productAnalyticsService.getProductRecommendations();

        // Group by recommendation type
        const grouped = {
          FOCUS: recommendations.filter((r) => r.recommendation === 'FOCUS'),
          MAINTAIN: recommendations.filter((r) => r.recommendation === 'MAINTAIN'),
          REVIEW: recommendations.filter((r) => r.recommendation === 'REVIEW'),
          REMOVE: recommendations.filter((r) => r.recommendation === 'REMOVE'),
        };

        return reply.send({
          success: true,
          data: {
            all: recommendations,
            grouped,
            summary: {
              total: recommendations.length,
              focus: grouped.FOCUS.length,
              maintain: grouped.MAINTAIN.length,
              review: grouped.REVIEW.length,
              remove: grouped.REMOVE.length,
            },
          },
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /analytics/products/highest-margins - Products with highest margins
   */
  server.get(
    '/analytics/products/highest-margins',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { limit } = request.query as { limit?: string };
        const limitNum = limit ? parseInt(limit) : 10;

        const products = await productAnalyticsService.getHighestMarginProducts(limitNum);

        return reply.send({
          success: true,
          data: products,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /analytics/products/highest-costs - Products with highest costs
   */
  server.get(
    '/analytics/products/highest-costs',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const { limit } = request.query as { limit?: string };
        const limitNum = limit ? parseInt(limit) : 10;

        const products = await productAnalyticsService.getHighestCostProducts(limitNum);

        return reply.send({
          success: true,
          data: products,
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
};

export default productAnalyticsRoutes;
