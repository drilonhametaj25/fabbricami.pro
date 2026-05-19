/**
 * Admin Routes
 * API endpoints for MegaAdmin panel - Platform administration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminService } from '../services/admin.service';
import {
  authenticateSuperAdmin,
  generateSuperAdminToken,
  logSuperAdminAction,
  getClientIp,
  getUserAgent,
  SuperAdminRequest,
} from '../middleware/super-admin.middleware';
import { successResponse, errorResponse } from '../utils/response.util';
import { prisma } from '../config/database';

// ============================================
// SCHEMAS
// ============================================

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
};

const createPlanSchema = {
  body: z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    priceMonthly: z.number().min(0),
    priceYearly: z.number().min(0),
    features: z.object({
      modules: z.array(z.string()),
      capabilities: z.array(z.string()),
    }),
    limits: z.object({
      maxUsers: z.number(),
      maxWarehouses: z.number(),
      maxProducts: z.number(),
      maxOrders: z.number(),
      maxSuppliers: z.number(),
    }),
    sortOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
};

const updatePlanSchema = {
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    priceMonthly: z.number().min(0).optional(),
    priceYearly: z.number().min(0).optional(),
    features: z
      .object({
        modules: z.array(z.string()),
        capabilities: z.array(z.string()),
      })
      .optional(),
    limits: z
      .object({
        maxUsers: z.number(),
        maxWarehouses: z.number(),
        maxProducts: z.number(),
        maxOrders: z.number(),
        maxSuppliers: z.number(),
      })
      .optional(),
    sortOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
};

const extendTrialSchema = {
  body: z.object({
    days: z.number().min(1).max(365),
  }),
};

const changePlanSchema = {
  body: z.object({
    planCode: z.string(),
  }),
};

const setTenantStatusSchema = {
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
  }),
};

// ============================================
// ROUTES
// ============================================

async function adminRoutes(fastify: FastifyInstance) {
  // ==========================================
  // PUBLIC AUTH ROUTES (No auth required)
  // ==========================================
  await fastify.register(async function publicRoutes(publicFastify) {
    /**
     * POST /admin/auth/login
     * Login super admin
     */
    publicFastify.post(
      '/auth/login',
      {
        // Very tight rate limit on SuperAdmin login — there should only ever
        // be a handful of legitimate logins per day. 5 attempts / 15 minutes
        // per IP makes brute-forcing impractical.
        config: {
          rateLimit: { max: 5, timeWindow: '15 minutes' },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = loginSchema.body.safeParse(request.body);
        if (!parsed.success) {
          return errorResponse(reply, 'Invalid input', 400);
        }

        const { email, password } = parsed.data;
        const superAdmin = await adminService.authenticateSuperAdmin(email, password);

        if (!superAdmin) {
          return errorResponse(reply, 'Invalid credentials', 401);
        }

        const tokens = generateSuperAdminToken(superAdmin);
        await adminService.updateSuperAdminRefreshToken(superAdmin.id, tokens.refreshToken);

        await logSuperAdminAction(superAdmin.id, 'LOGIN', {
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });

        return successResponse(reply, {
          superAdmin: {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
          },
          tokens,
        });
      } catch (error: any) {
        return errorResponse(reply, error.message, 500);
      }
    });

    /**
     * POST /admin/auth/setup
     * Create first super admin (only works if none exist)
     */
    publicFastify.post('/auth/setup', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if any super admin exists
        const existingCount = await prisma.superAdmin.count();
        if (existingCount > 0) {
          return errorResponse(reply, 'Super admin already exists. Use login instead.', 400);
        }

        const body = request.body as { email: string; password: string; name: string };
        if (!body.email || !body.password || !body.name) {
          return errorResponse(reply, 'Email, password, and name are required', 400);
        }

        if (body.password.length < 8) {
          return errorResponse(reply, 'Password must be at least 8 characters', 400);
        }

        const superAdmin = await adminService.createSuperAdmin(
          body.email,
          body.password,
          body.name
        );

        const tokens = generateSuperAdminToken(superAdmin);
        await adminService.updateSuperAdminRefreshToken(superAdmin.id, tokens.refreshToken);

        return successResponse(reply, {
          message: 'Super admin created successfully',
          superAdmin: {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
          },
          tokens,
        }, 201);
      } catch (error: any) {
        return errorResponse(reply, error.message, 500);
      }
    });
  });

  // ==========================================
  // PROTECTED ROUTES (Require super admin auth)
  // ==========================================
  await fastify.register(async function protectedRoutes(protectedFastify) {
    // Apply authentication to all routes in this plugin
    protectedFastify.addHook('preHandler', authenticateSuperAdmin);

    /**
     * GET /admin/dashboard
     * Get dashboard metrics
     */
    protectedFastify.get('/dashboard', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await adminService.getDashboardMetrics();
      return successResponse(reply, metrics);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================

  /**
   * GET /admin/plans
   * List all subscription plans
   */
    protectedFastify.get('/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await adminService.listPlans();
      return successResponse(reply, { items: plans });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /admin/plans/:id
   * Get a single plan
   */
    protectedFastify.get('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const plan = await adminService.getPlan(id);

      if (!plan) {
        return errorResponse(reply, 'Plan not found', 404);
      }

      return successResponse(reply, plan);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/plans
   * Create a new plan
   */
    protectedFastify.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = createPlanSchema.body.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 'Invalid input: ' + parsed.error.message, 400);
      }

      const plan = await adminService.createPlan(parsed.data);

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'CREATE_PLAN', {
        entityType: 'PLAN',
        entityId: plan.id,
        details: { planCode: plan.code },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, plan, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * PUT /admin/plans/:id
   * Update a plan
   */
    protectedFastify.put('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = updatePlanSchema.body.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 'Invalid input: ' + parsed.error.message, 400);
      }

      const plan = await adminService.updatePlan(id, parsed.data);

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'UPDATE_PLAN', {
        entityType: 'PLAN',
        entityId: id,
        details: parsed.data,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, plan);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * DELETE /admin/plans/:id
   * Delete a plan
   */
    protectedFastify.delete('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await adminService.deletePlan(id);

      if (!result.success) {
        return errorResponse(reply, result.error || 'Failed to delete plan', 400);
      }

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'DELETE_PLAN', {
        entityType: 'PLAN',
        entityId: id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, { message: 'Plan deleted successfully' });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/plans/:id/sync-stripe
   * Sync plan to Stripe
   */
    protectedFastify.post('/plans/:id/sync-stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await adminService.syncPlanToStripe(id);

      if (!result.success) {
        return errorResponse(reply, result.error || 'Failed to sync with Stripe', 400);
      }

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'SYNC_PLAN_STRIPE', {
        entityType: 'PLAN',
        entityId: id,
        details: result,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // TENANT MANAGEMENT
  // ==========================================

  /**
   * GET /admin/tenants
   * List tenants with filters
   */
    protectedFastify.get('/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const filters = {
        status: query.status as any,
        subscriptionStatus: query.subscriptionStatus as any,
        planCode: query.planCode,
        search: query.search,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      };

      const result = await adminService.listTenants(filters);
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /admin/tenants/:id
   * Get tenant details
   */
    protectedFastify.get('/tenants/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenant = await adminService.getTenantDetails(id);

      if (!tenant) {
        return errorResponse(reply, 'Tenant not found', 404);
      }

      return successResponse(reply, tenant);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/tenants/:id/extend-trial
   * Extend trial for a tenant
   */
    protectedFastify.post('/tenants/:id/extend-trial', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = extendTrialSchema.body.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 'Invalid input', 400);
      }

      const result = await adminService.extendTrial(id, parsed.data.days);

      if (!result.success) {
        return errorResponse(reply, result.error || 'Failed to extend trial', 400);
      }

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'EXTEND_TRIAL', {
        entityType: 'TENANT',
        entityId: id,
        details: { days: parsed.data.days, newTrialEnd: result.newTrialEnd },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/tenants/:id/change-plan
   * Change tenant's subscription plan
   */
    protectedFastify.post('/tenants/:id/change-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = changePlanSchema.body.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 'Invalid input', 400);
      }

      const result = await adminService.changeTenantPlan(id, parsed.data.planCode);

      if (!result.success) {
        return errorResponse(reply, result.error || 'Failed to change plan', 400);
      }

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'CHANGE_TENANT_PLAN', {
        entityType: 'TENANT',
        entityId: id,
        details: { newPlanCode: parsed.data.planCode },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, { message: 'Plan changed successfully' });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/tenants/:id/status
   * Suspend or reactivate tenant
   */
    protectedFastify.post('/tenants/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = setTenantStatusSchema.body.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 'Invalid input', 400);
      }

      const result = await adminService.setTenantStatus(id, parsed.data.status);

      if (!result.success) {
        return errorResponse(reply, result.error || 'Failed to update status', 400);
      }

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'SET_TENANT_STATUS', {
        entityType: 'TENANT',
        entityId: id,
        details: { status: parsed.data.status },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, { message: 'Status updated successfully' });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // STRIPE MANAGEMENT
  // ==========================================

  /**
   * GET /admin/stripe/status
   * Get Stripe connection status
   */
    protectedFastify.get('/stripe/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await adminService.getStripeStatus();
      return successResponse(reply, status);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /admin/stripe/webhooks
   * Get recent webhook activity
   */
    protectedFastify.get('/stripe/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const logs = await adminService.getRecentWebhookLogs(limit);
      return successResponse(reply, { items: logs });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /admin/stripe/test-connection
   * Test Stripe API connection
   */
    protectedFastify.get('/stripe/test-connection', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await adminService.testStripeConnection();
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /admin/stripe/plans-status
   * Get sync status for all plans
   */
    protectedFastify.get('/stripe/plans-status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await adminService.getPlansStripeStatus();
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/stripe/sync-all
   * Sync all plans to Stripe
   */
    protectedFastify.post('/stripe/sync-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await adminService.syncAllPlansToStripe();

      const superAdmin = (request as SuperAdminRequest).superAdmin;
      await logSuperAdminAction(superAdmin.superAdminId, 'SYNC_ALL_PLANS_STRIPE', {
        details: result,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  /**
   * GET /admin/audit-logs
   * Get admin audit logs
   */
    protectedFastify.get('/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string; page?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const page = query.page ? parseInt(query.page, 10) : 1;

      const [logs, total] = await Promise.all([
        prisma.superAdminAuditLog.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            superAdmin: {
              select: { email: true, name: true },
            },
          },
        }),
        prisma.superAdminAuditLog.count(),
      ]);

      return successResponse(reply, {
        items: logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // COUPONS MANAGEMENT
  // ==========================================

  /**
   * GET /admin/coupons — lista coupon
   */
  protectedFastify.get('/coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, parseInt(query.limit) || 50);

      const [items, total] = await Promise.all([
        prisma.coupon.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.coupon.count(),
      ]);

      return successResponse(reply, { items, total, page, limit });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/coupons — crea coupon
   */
  protectedFastify.post('/coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const coupon = await prisma.coupon.create({
        data: {
          code: body.code,
          name: body.name || null,
          type: body.type,
          discountValue: body.value,
          scope: body.scope || 'ENTIRE_ORDER',
          validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
          validTo: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          maxUses: body.maxUses ?? null,
          isActive: body.isActive ?? true,
        },
      });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'CREATE_COUPON', {
          entityType: 'COUPON',
          entityId: coupon.id,
          details: { code: coupon.code },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, coupon, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * PUT /admin/coupons/:id — aggiorna coupon
   */
  protectedFastify.put('/coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.type !== undefined) data.type = body.type;
      if (body.value !== undefined) data.discountValue = body.value;
      if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : undefined;
      if (body.validUntil !== undefined) data.validTo = body.validUntil ? new Date(body.validUntil) : undefined;
      if (body.maxUses !== undefined) data.maxUses = body.maxUses;
      if (body.isActive !== undefined) data.isActive = body.isActive;

      const coupon = await prisma.coupon.update({ where: { id }, data });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'UPDATE_COUPON', {
          entityType: 'COUPON',
          entityId: id,
          details: body,
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, coupon);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * DELETE /admin/coupons/:id — elimina coupon (solo se mai usato)
   */
  protectedFastify.delete('/coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.coupon.findUnique({
        where: { id },
        include: { _count: { select: { usages: true } } },
      });

      if (!existing) {
        return errorResponse(reply, 'Coupon non trovato', 404);
      }

      if (existing._count.usages > 0) {
        return errorResponse(
          reply,
          `Impossibile eliminare: il coupon è stato usato ${existing._count.usages} volte. Disattivalo invece.`,
          400
        );
      }

      await prisma.coupon.delete({ where: { id } });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'DELETE_COUPON', {
          entityType: 'COUPON',
          entityId: id,
          details: { code: existing.code },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, { id, deleted: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // SIGNUP COUPONS (SaaS signup-time discounts)
  // ==========================================
  // These are separate from order-level Coupons (which belong to tenants and
  // apply to their customers' e-commerce orders). SignupCoupons are
  // platform-owned and apply to the subscription billing at signup.

  /**
   * GET /admin/signup-coupons — lista coupon signup
   */
  protectedFastify.get('/signup-coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Number(query.limit) || 50);

      const [items, total] = await Promise.all([
        prisma.signupCoupon.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: { select: { usages: true } },
          },
        }),
        prisma.signupCoupon.count(),
      ]);

      return successResponse(reply, { items, total, page, limit });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /admin/signup-coupons — crea coupon signup
   */
  protectedFastify.post('/signup-coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;

      if (!body.code || !body.type || body.discountValue === undefined) {
        return errorResponse(reply, 'code, type e discountValue sono obbligatori', 400);
      }

      const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
      const validTo = body.validTo
        ? new Date(body.validTo)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      if (validFrom >= validTo) {
        return errorResponse(reply, 'validFrom deve essere prima di validTo', 400);
      }

      const allowedTypes = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TRIAL_DAYS'];
      if (!allowedTypes.includes(body.type)) {
        return errorResponse(reply, `type deve essere uno di: ${allowedTypes.join(', ')}`, 400);
      }

      if (body.type === 'PERCENTAGE' && (body.discountValue < 0 || body.discountValue > 100)) {
        return errorResponse(reply, 'PERCENTAGE deve essere tra 0 e 100', 400);
      }

      const coupon = await prisma.signupCoupon.create({
        data: {
          code: String(body.code).toUpperCase().trim(),
          name: body.name || null,
          description: body.description || null,
          type: body.type,
          discountValue: body.discountValue,
          applicablePlans: body.applicablePlans || undefined,
          applicableBillingCycles: body.applicableBillingCycles || undefined,
          durationMonths: body.durationMonths ?? null,
          validFrom,
          validTo,
          maxUses: body.maxUses ?? null,
          maxUsesPerTenant: body.maxUsesPerTenant ?? 1,
          stripeCouponId: body.stripeCouponId || null,
          isActive: body.isActive ?? true,
        },
      });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'CREATE_SIGNUP_COUPON', {
          entityType: 'SIGNUP_COUPON',
          entityId: coupon.id,
          details: { code: coupon.code, type: coupon.type, discountValue: Number(coupon.discountValue) },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, coupon, 201);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return errorResponse(reply, 'Esiste gia un coupon con questo codice', 409);
      }
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * PUT /admin/signup-coupons/:id — aggiorna coupon signup
   */
  protectedFastify.put('/signup-coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.type !== undefined) data.type = body.type;
      if (body.discountValue !== undefined) data.discountValue = body.discountValue;
      if (body.applicablePlans !== undefined) data.applicablePlans = body.applicablePlans;
      if (body.applicableBillingCycles !== undefined)
        data.applicableBillingCycles = body.applicableBillingCycles;
      if (body.durationMonths !== undefined) data.durationMonths = body.durationMonths;
      if (body.validFrom !== undefined)
        data.validFrom = body.validFrom ? new Date(body.validFrom) : undefined;
      if (body.validTo !== undefined)
        data.validTo = body.validTo ? new Date(body.validTo) : undefined;
      if (body.maxUses !== undefined) data.maxUses = body.maxUses;
      if (body.maxUsesPerTenant !== undefined) data.maxUsesPerTenant = body.maxUsesPerTenant;
      if (body.stripeCouponId !== undefined) data.stripeCouponId = body.stripeCouponId;
      if (body.isActive !== undefined) data.isActive = body.isActive;

      if (data.validFrom && data.validTo && data.validFrom >= data.validTo) {
        return errorResponse(reply, 'validFrom deve essere prima di validTo', 400);
      }

      const coupon = await prisma.signupCoupon.update({ where: { id }, data });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'UPDATE_SIGNUP_COUPON', {
          entityType: 'SIGNUP_COUPON',
          entityId: id,
          details: body,
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, coupon);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * DELETE /admin/signup-coupons/:id — elimina coupon signup (solo se mai usato)
   */
  protectedFastify.delete('/signup-coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.signupCoupon.findUnique({
        where: { id },
        include: { _count: { select: { usages: true } } },
      });

      if (!existing) {
        return errorResponse(reply, 'Signup coupon non trovato', 404);
      }

      if (existing._count.usages > 0) {
        return errorResponse(
          reply,
          `Impossibile eliminare: il coupon è stato usato ${existing._count.usages} volte. Disattivalo invece.`,
          400
        );
      }

      await prisma.signupCoupon.delete({ where: { id } });

      const superAdminId = (request as any).superAdmin?.superAdminId;
      if (superAdminId) {
        await logSuperAdminAction(superAdminId, 'DELETE_SIGNUP_COUPON', {
          entityType: 'SIGNUP_COUPON',
          entityId: id,
          details: { code: existing.code },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
      }

      return successResponse(reply, { id, deleted: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // ==========================================
  // INTEGRATIONS — FATTURE IN CLOUD (SaaS billing)
  // ==========================================

  const FIC_SETTING_KEY = 'integration_fatture_in_cloud';

  protectedFastify.get('/integrations/fic', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: FIC_SETTING_KEY } });
      const value = (setting?.value as any) || {};
      return successResponse(reply, {
        companyId: value.companyId || '',
        hasApiToken: !!value.apiToken,
        documentType: value.documentType || 'TD01',
        defaultVatRate: value.defaultVatRate ?? 22,
        autoSendSdi: value.autoSendSdi ?? true,
        enabled: value.enabled ?? false,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  protectedFastify.put('/integrations/fic', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const existing = await prisma.systemSetting.findUnique({ where: { key: FIC_SETTING_KEY } });
      const oldValue = (existing?.value as any) || {};
      const newValue: any = {
        companyId: body.companyId ?? oldValue.companyId ?? '',
        apiToken: body.apiToken ?? oldValue.apiToken ?? null,
        documentType: body.documentType ?? oldValue.documentType ?? 'TD01',
        defaultVatRate: body.defaultVatRate ?? oldValue.defaultVatRate ?? 22,
        autoSendSdi: body.autoSendSdi ?? oldValue.autoSendSdi ?? true,
        enabled: body.enabled ?? oldValue.enabled ?? false,
      };
      await prisma.systemSetting.upsert({
        where: { key: FIC_SETTING_KEY },
        update: { value: newValue },
        create: { key: FIC_SETTING_KEY, value: newValue, description: 'FIC SaaS billing' },
      });
      return successResponse(reply, { saved: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  protectedFastify.post('/integrations/fic/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: FIC_SETTING_KEY } });
      const value = (setting?.value as any) || {};
      if (!value.companyId || !value.apiToken) {
        return errorResponse(reply, 'Configurazione FIC incompleta', 400);
      }
      const r = await fetch(`https://api-v2.fattureincloud.it/c/${value.companyId}/info`, {
        headers: { Authorization: `Bearer ${value.apiToken}`, Accept: 'application/json' },
      });
      if (!r.ok) {
        return errorResponse(reply, `FIC ha risposto ${r.status}`, 400);
      }
      const data: any = await r.json();
      return successResponse(reply, { message: `Connesso a ${data?.data?.name || 'FIC'}` });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  protectedFastify.get('/integrations/fic/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string; status?: string };
      const limit = Math.min(parseInt(query.limit || '100', 10), 500);
      const where: any = {
        OR: [
          { ficInvoiceId: { not: null } },
          { ficStatus: { not: null } },
        ],
      };
      if (query.status) where.ficStatus = query.status;

      const items = await prisma.billingHistory.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          subscription: {
            include: {
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      return successResponse(reply, items);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });
  }); // End of protectedRoutes register
}

export default adminRoutes;
