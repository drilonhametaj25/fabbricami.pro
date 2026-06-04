import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { subscriptionService } from '../services/subscription.service';
import { addonService } from '../services/addon.service';
import { prisma } from '../config/database';
import { isStripeConfigured } from '../config/stripe.config';
import { config } from '../config/environment';
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
        // Modalità dev/mock: Stripe non configurato. Non possiamo creare una
        // sessione di Checkout reale, quindi applichiamo il cambio piano
        // direttamente e rimandiamo il client alla pagina di fatturazione.
        if (!isStripeConfigured()) {
          await subscriptionService.updateSubscription(tenantRequest.tenant.tenantId, {
            planCode: body.planCode,
            billingPeriod: body.billingPeriod,
          });

          const fallbackUrl =
            body.successUrl ||
            `${config.frontend.appUrl}/settings/billing?upgraded=${body.planCode}`;

          return reply.send({
            success: true,
            data: {
              checkoutUrl: fallbackUrl,
              sessionId: null,
              mock: true,
            },
          });
        }

        const session = await subscriptionService.createCheckoutSession(
          tenantRequest.tenant.tenantId,
          body.planCode,
          body.billingPeriod,
          body.successUrl,
          body.cancelUrl
        );

        return reply.send({
          success: true,
          data: {
            checkoutUrl: session.url,
            sessionId: session.sessionId,
          },
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

  /**
   * GET /subscription/usage
   * Restituisce l'utilizzo corrente delle risorse vs limiti del piano
   */
  server.get(
    '/usage',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const tenantId = tenantRequest.tenant.tenantId;

      const subscription = await prisma.saasSubscription.findUnique({
        where: { tenantId },
        include: { plan: { select: { limits: true, code: true, name: true } } },
      });

      if (!subscription) {
        return reply.status(404).send({ success: false, error: 'Nessuna subscription attiva' });
      }

      const rawLimits = (subscription.plan.limits as Record<string, number>) || {};
      // Limiti effettivi = limiti del piano + add-on RESOURCE_LIMIT del tenant.
      const { maxUsers, maxProducts, maxOrders, maxWarehouses, maxSuppliers } =
        await addonService.getEffectiveLimits(tenantId, {
          maxUsers: rawLimits.maxUsers ?? -1,
          maxProducts: rawLimits.maxProducts ?? -1,
          maxOrders: rawLimits.maxOrders ?? -1,
          maxWarehouses: rawLimits.maxWarehouses ?? -1,
          maxSuppliers: rawLimits.maxSuppliers ?? -1,
        });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [usersCount, productsCount, ordersThisMonth, warehousesCount, suppliersCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.product.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
        prisma.warehouse.count({ where: { tenantId } }),
        prisma.supplier.count({ where: { tenantId } }),
      ]);

      const buildUsage = (current: number, limit: number) => ({
        current,
        limit,
        percentage: limit === -1 ? 0 : Math.min(100, Math.round((current / limit) * 100)),
        unlimited: limit === -1,
      });

      return reply.send({
        success: true,
        data: {
          users: buildUsage(usersCount, maxUsers),
          products: buildUsage(productsCount, maxProducts),
          orders: buildUsage(ordersThisMonth, maxOrders),
          warehouses: buildUsage(warehousesCount, maxWarehouses),
          suppliers: buildUsage(suppliersCount, maxSuppliers),
        },
      });
    }
  );

  // ============================================
  // ADD-ONS
  // ============================================

  /**
   * GET /subscription/addons
   * Catalogo add-on disponibili.
   */
  server.get(
    '/addons',
    { preHandler: [authenticate, tenantMiddleware] },
    async (_request, reply) => {
      const catalog = await addonService.getCatalog();
      return reply.send({
        success: true,
        data: catalog.map((a) => ({
          code: a.code,
          name: a.name,
          description: a.description,
          type: a.type,
          resource: a.resource,
          increment: a.increment,
          featureKey: a.featureKey,
          priceMonthly: Number(a.priceMonthly),
          priceYearly: Number(a.priceYearly),
        })),
      });
    }
  );

  /**
   * GET /subscription/addons/active
   * Add-on attualmente attivi per il tenant.
   */
  server.get(
    '/addons/active',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const active = await addonService.getTenantAddons(tenantRequest.tenant.tenantId);
      return reply.send({
        success: true,
        data: active.map((ta) => ({
          code: ta.addon.code,
          name: ta.addon.name,
          type: ta.addon.type,
          resource: ta.addon.resource,
          increment: ta.addon.increment,
          quantity: ta.quantity,
          priceMonthly: Number(ta.addon.priceMonthly),
        })),
      });
    }
  );

  /**
   * POST /subscription/addons
   * Aggiunge/aggiorna un add-on per il tenant. Body: { code, quantity? }
   */
  server.post(
    '/addons',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = (request.body || {}) as { code?: string; quantity?: number };
      if (!body.code) {
        return reply.status(400).send({ success: false, error: 'code richiesto' });
      }
      try {
        const result = await addonService.addAddon(
          tenantRequest.tenant.tenantId,
          body.code,
          body.quantity ?? 1
        );
        return reply.status(201).send({
          success: true,
          data: { code: result.addon.code, quantity: result.quantity },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore aggiunta add-on',
        });
      }
    }
  );

  /**
   * DELETE /subscription/addons/:code
   * Rimuove un add-on dal tenant.
   */
  server.delete(
    '/addons/:code',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { code } = request.params as { code: string };
      try {
        await addonService.removeAddon(tenantRequest.tenant.tenantId, code);
        return reply.send({ success: true });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore rimozione add-on',
        });
      }
    }
  );

  /**
   * POST /subscription/validate-coupon (public)
   */
  server.post('/validate-coupon', async (request, reply) => {
    const body = (request.body || {}) as { code?: string; planCode?: string };
    if (!body.code) return reply.status(400).send({ success: false, error: 'code required' });
    const code = body.code.toUpperCase().trim();
    const coupon = await prisma.signupCoupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) return reply.status(404).send({ success: false, error: 'Codice non valido' });
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) return reply.status(410).send({ success: false, error: 'Codice scaduto' });
    if (coupon.maxUses !== null && coupon.usageCount >= coupon.maxUses) return reply.status(410).send({ success: false, error: 'Codice esaurito' });
    return reply.send({
      success: true,
      data: { code: coupon.code, type: coupon.type, discountValue: Number(coupon.discountValue), durationMonths: coupon.durationMonths },
    });
  });

  /**
   * POST /subscription/backfill-tenant
   * Admin endpoint che riassegna il tenantId del chiamante a tutti i record
   * orfani (tenantId=NULL). Workaround per record creati prima dell'attivazione
   * del Prisma multi-tenant middleware.
   */
  server.post(
    '/backfill-tenant',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const tenantId = tenantRequest.tenant.tenantId;

      const tables = [
        'products', 'product_categories', 'product_variants',
        'inventory_items', 'inventory_movements',
        'orders', 'order_items',
        'customers', 'customer_addresses',
        'price_lists', 'price_list_items',
        'suppliers', 'supplier_items', 'supplier_volume_discounts',
        'warehouses',
        'materials', 'material_movements', 'material_inventories',
        'purchase_orders', 'purchase_order_items',
        'goods_receipts', 'goods_receipt_items',
        'invoices', 'invoice_items', 'ddt',
        'employees', 'tasks',
        'notifications', 'calendar_events',
      ];

      // Pre-fix: alcune tabelle hanno UNIQUE (tenant_id, <col>) con colonna
      // che è '' empty string sui record orfani; quando assegniamo lo stesso
      // tenant a tutti, le righe collidono. Bonifichiamo trasformando '' → NULL
      // sulle colonne note che causano collisioni.
      const cleanupBeforeBackfill = [
        { table: 'products', column: 'barcode' },
        { table: 'product_variants', column: 'barcode' },
        { table: 'product_variants', column: 'sku' },
        { table: 'customers', column: 'email' },
        { table: 'suppliers', column: 'tax_id' },
        { table: 'suppliers', column: 'email' },
      ];
      for (const { table, column } of cleanupBeforeBackfill) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" = '' AND tenant_id IS NULL`
          );
        } catch {}
      }

      const results: Record<string, number | string> = {};
      const errors: Record<string, string> = {};
      for (const table of tables) {
        try {
          let nullCountBefore = 0;
          try {
            const pre: any = await prisma.$queryRawUnsafe(
              `SELECT COUNT(*)::int AS cnt FROM "${table}" WHERE tenant_id IS NULL`
            );
            nullCountBefore = Number(pre?.[0]?.cnt ?? 0);
          } catch {}
          if (nullCountBefore === 0) continue;
          const count = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET tenant_id = $1::uuid WHERE tenant_id IS NULL`,
            tenantId
          );
          results[table] = `before=${nullCountBefore}, updated=${Number(count)}`;
        } catch (err: any) {
          errors[table] = err?.message?.slice(0, 200) || String(err);
        }
      }
      return reply.send({ success: true, data: { tenantId, updated: results, errors } });
    }
  );
};

export default subscriptionRoutes;