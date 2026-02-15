import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { subscriptionService } from '../services/subscription.service';
import {
  createSubscriptionCheckoutSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createTrialSubscriptionSchema,
  createPortalSessionSchema,
  calculateProrationSchema,
} from '../schemas/subscription.schema';

// ============================================
// SUBSCRIPTION ROUTES
// ============================================

const subscriptionRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /subscription
   * Get current subscription for authenticated tenant
   */
  server.get(
    '/',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const subscription = await subscriptionService.getSubscription(tenantRequest.tenant.tenantId);

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: 'Nessuna subscription attiva',
        });
      }

      return reply.send({
        success: true,
        data: subscription,
      });
    }
  );

  /**
   * GET /subscription/plans
   * Get all available subscription plans (public)
   */
  server.get('/plans', async (_request, reply) => {
    const plans = await subscriptionService.getPlans();

    return reply.send({
      success: true,
      data: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        priceMonthly: Number(plan.priceMonthly),
        priceYearly: Number(plan.priceYearly),
        features: plan.features,
        limits: plan.limits,
      })),
    });
  });

  /**
   * POST /subscription/checkout
   * Create a Stripe Checkout session for subscription
   */
  server.post(
    '/checkout',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = createSubscriptionCheckoutSchema.parse(request.body);

      try {
        const session = await subscriptionService.createCheckoutSession(
          tenantRequest.tenant.tenantId,
          body.planCode,
          body.billingPeriod,
          body.successUrl,
          body.cancelUrl
        );

        return reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione checkout',
        });
      }
    }
  );

  /**
   * POST /subscription
   * Create a subscription directly (with payment method)
   */
  server.post(
    '/',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = createSubscriptionSchema.parse(request.body);

      try {
        const subscription = await subscriptionService.createSubscription({
          tenantId: tenantRequest.tenant.tenantId,
          planCode: body.planCode,
          billingPeriod: body.billingPeriod,
          paymentMethodId: body.paymentMethodId,
        });

        return reply.status(201).send({
          success: true,
          data: subscription,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione subscription',
        });
      }
    }
  );

  /**
   * POST /subscription/trial
   * Start a trial subscription (no payment required)
   */
  server.post(
    '/trial',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = createTrialSubscriptionSchema.parse(request.body);

      try {
        const subscription = await subscriptionService.createTrialSubscription(
          tenantRequest.tenant.tenantId,
          body.planCode
        );

        return reply.status(201).send({
          success: true,
          data: subscription,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione trial',
        });
      }
    }
  );

  /**
   * PATCH /subscription
   * Update subscription (change plan, cancel at period end)
   */
  server.patch(
    '/',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = updateSubscriptionSchema.parse(request.body);

      try {
        const subscription = await subscriptionService.updateSubscription(
          tenantRequest.tenant.tenantId,
          body
        );

        return reply.send({
          success: true,
          data: subscription,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore aggiornamento subscription',
        });
      }
    }
  );

  /**
   * DELETE /subscription
   * Cancel subscription immediately
   */
  server.delete(
    '/',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      try {
        await subscriptionService.cancelSubscription(tenantRequest.tenant.tenantId);

        return reply.send({
          success: true,
          data: { message: 'Subscription cancellata' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore cancellazione subscription',
        });
      }
    }
  );

  /**
   * POST /subscription/pause
   * Pause subscription
   */
  server.post(
    '/pause',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      try {
        await subscriptionService.pauseSubscription(tenantRequest.tenant.tenantId);

        return reply.send({
          success: true,
          data: { message: 'Subscription in pausa' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore pausa subscription',
        });
      }
    }
  );

  /**
   * POST /subscription/resume
   * Resume paused subscription
   */
  server.post(
    '/resume',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      try {
        await subscriptionService.resumeSubscription(tenantRequest.tenant.tenantId);

        return reply.send({
          success: true,
          data: { message: 'Subscription riattivata' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore riattivazione subscription',
        });
      }
    }
  );

  /**
   * POST /subscription/portal
   * Create Stripe Customer Portal session
   */
  server.post(
    '/portal',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = createPortalSessionSchema.parse(request.body || {});

      try {
        const session = await subscriptionService.createPortalSession(
          tenantRequest.tenant.tenantId,
          body.returnUrl
        );

        return reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione portal session',
        });
      }
    }
  );

  /**
   * GET /subscription/proration
   * Calculate proration for plan change
   */
  server.get(
    '/proration',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const query = calculateProrationSchema.parse(request.query);

      try {
        const { billingService } = await import('../services/billing.service');
        const proration = await billingService.calculateProration(
          tenantRequest.tenant.tenantId,
          query.newPlanCode,
          query.billingPeriod
        );

        return reply.send({
          success: true,
          data: proration,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore calcolo proration',
        });
      }
    }
  );

  /**
   * GET /subscription/status
   * Check if Stripe is configured
   */
  server.get('/status', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        stripeConfigured: subscriptionService.isStripeConfigured(),
      },
    });
  });
};

export default subscriptionRoutes;
