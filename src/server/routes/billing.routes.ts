import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { billingService } from '../services/billing.service';
import { subscriptionService } from '../services/subscription.service';
import {
  billingHistoryQuerySchema,
  checkLimitSchema,
  checkFeatureSchema,
} from '../schemas/subscription.schema';

// ============================================
// BILLING ROUTES
// ============================================

const billingRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /billing
   * Get billing summary for authenticated tenant
   */
  server.get(
    '/',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const summary = await billingService.getBillingSummary(tenantRequest.tenant.tenantId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  /**
   * GET /billing/usage
   * Get usage statistics for authenticated tenant
   */
  server.get(
    '/usage',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const usage = await billingService.getUsageStats(tenantRequest.tenant.tenantId);

      return reply.send({
        success: true,
        data: usage,
      });
    }
  );

  /**
   * GET /billing/history
   * Get billing history for authenticated tenant
   */
  server.get(
    '/history',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const query = billingHistoryQuerySchema.parse(request.query);

      const history = await billingService.getBillingHistory(
        tenantRequest.tenant.tenantId,
        query.page,
        query.limit
      );

      return reply.send({
        success: true,
        data: history.items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: history.total,
          pages: history.pages,
        },
      });
    }
  );

  /**
   * GET /billing/limits/:resource
   * Check if a resource limit allows creating a new resource
   */
  server.get(
    '/limits/:resource',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const params = checkLimitSchema.parse(request.params);

      const result = await billingService.canCreateResource(
        tenantRequest.tenant.tenantId,
        params.resource
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * GET /billing/features
   * Get all available features for tenant's plan
   */
  server.get(
    '/features',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const features = await billingService.getAvailableFeatures(tenantRequest.tenant.tenantId);

      return reply.send({
        success: true,
        data: { features },
      });
    }
  );

  /**
   * GET /billing/features/:feature
   * Check if a specific feature is available
   */
  server.get(
    '/features/:feature',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const params = checkFeatureSchema.parse(request.params);

      const hasFeature = await billingService.hasFeature(
        tenantRequest.tenant.tenantId,
        params.feature
      );

      return reply.send({
        success: true,
        data: {
          feature: params.feature,
          available: hasFeature,
        },
      });
    }
  );

  /**
   * GET /billing/recommendations
   * Get upgrade recommendations based on usage
   */
  server.get(
    '/recommendations',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const recommendations = await billingService.getUpgradeRecommendations(
        tenantRequest.tenant.tenantId
      );

      return reply.send({
        success: true,
        data: recommendations,
      });
    }
  );

  /**
   * GET /billing/limits
   * Get all current limits and usage
   */
  server.get(
    '/limits',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const usage = await billingService.getUsageStats(tenantRequest.tenant.tenantId);

      // Transform to a more detailed format
      const limits = {
        users: {
          ...usage.users,
          warning: usage.users.percentage >= 80,
          critical: usage.users.percentage >= 100,
        },
        warehouses: {
          ...usage.warehouses,
          warning: usage.warehouses.percentage >= 80,
          critical: usage.warehouses.percentage >= 100,
        },
        products: {
          ...usage.products,
          warning: usage.products.percentage >= 80,
          critical: usage.products.percentage >= 100,
        },
        orders: {
          ...usage.orders,
          warning: usage.orders.percentage >= 80,
          critical: usage.orders.percentage >= 100,
          periodLabel: 'questo mese',
        },
        suppliers: {
          ...usage.suppliers,
          warning: usage.suppliers.percentage >= 80,
          critical: usage.suppliers.percentage >= 100,
        },
      };

      return reply.send({
        success: true,
        data: limits,
      });
    }
  );

  /**
   * POST /billing/portal
   * Crea una sessione del Customer Portal di Stripe per il tenant corrente.
   */
  server.post(
    '/portal',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      try {
        const session = await subscriptionService.createPortalSession(
          tenantRequest.tenant.tenantId
        );
        return reply.send({ success: true, data: { url: session.url } });
      } catch (e: any) {
        return reply.status(400).send({ success: false, error: e.message });
      }
    }
  );
};

export default billingRoutes;
