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

export default async function adminRoutes(fastify: FastifyInstance) {
  // ==========================================
  // PUBLIC AUTH ROUTES (No auth required)
  // ==========================================
  await fastify.register(async function publicRoutes(publicFastify) {
    /**
     * POST /admin/auth/login
     * Login super admin
     */
    publicFastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
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
  }); // End of protectedRoutes register
}
