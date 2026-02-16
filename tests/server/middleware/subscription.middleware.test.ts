// Mock Prisma
const mockPrisma = {
  saasSubscription: {
    findUnique: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  warehouse: {
    count: jest.fn(),
  },
  product: {
    count: jest.fn(),
  },
  supplier: {
    count: jest.fn(),
  },
  order: {
    count: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import {
  subscriptionMiddleware,
  checkPlanLimit,
  requirePlanLimit,
  requireFeature,
  getPlanLimits,
  planHasFeature,
  SubscriptionContext,
} from '@server/middleware/subscription.middleware';
import { TenantContext } from '@server/middleware/tenant.middleware';
import { SaasSubscriptionStatus, TenantStatus } from '@prisma/client';

// Helper functions
const createMockRequest = (options: {
  tenant?: TenantContext;
  subscription?: SubscriptionContext;
} = {}) => ({
  tenant: options.tenant,
  subscription: options.subscription,
  log: {
    error: jest.fn(),
  },
});

const createMockReply = () => {
  const reply: any = {
    statusCode: 200,
    status: jest.fn().mockImplementation((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
};

const createMockSubscription = (overrides: Partial<{
  id: string;
  status: SaasSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  plan: { code: string; name: string; limits: any; features: string[] };
}> = {}) => ({
  id: 'sub-1',
  status: 'ACTIVE' as SaasSubscriptionStatus,
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  cancelAtPeriodEnd: false,
  plan: {
    code: 'PRO',
    name: 'Pro Plan',
    limits: null,
    features: ['inventory', 'orders', 'wordpress_sync'],
  },
  ...overrides,
});

describe('Subscription Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // SUBSCRIPTION MIDDLEWARE
  // =============================================
  describe('subscriptionMiddleware', () => {
    it('should return 400 when tenant context is missing', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant context required',
      });
    });

    it('should return 402 when no subscription exists', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(null);

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'No subscription found',
        message: 'Please subscribe to a plan to continue.',
      });
    });

    it('should continue when subscription is ACTIVE', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      await subscriptionMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.subscription).toBeDefined();
      expect(request.subscription.planCode).toBe('PRO');
    });

    it('should continue when subscription is TRIALING and not expired', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        status: 'TRIALING' as SaasSubscriptionStatus,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.subscription.status).toBe('TRIALING');
    });

    it('should return 402 when subscription is PAST_DUE', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        status: 'PAST_DUE' as SaasSubscriptionStatus,
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Payment required',
        message: 'Your subscription payment is past due. Please update your payment method.',
      });
    });

    it('should return 402 when subscription is CANCELLED', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        status: 'CANCELLED' as SaasSubscriptionStatus,
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription cancelled',
        message: 'Your subscription has been cancelled. Please resubscribe to continue.',
      });
    });

    it('should return 402 when subscription is PAUSED', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        status: 'PAUSED' as SaasSubscriptionStatus,
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription paused',
        message: 'Your subscription is paused. Please resume to continue.',
      });
    });

    it('should return 402 when trial has expired', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        status: 'TRIALING' as SaasSubscriptionStatus,
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Trial expired',
        message: 'Your trial period has ended. Please subscribe to continue.',
      });
    });

    it('should return 402 when period has expired', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      }));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription expired',
        message: 'Your subscription period has ended. Please renew to continue.',
      });
    });

    it('should set subscription context with plan limits', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockResolvedValue(createMockSubscription({
        plan: {
          code: 'BUSINESS',
          name: 'Business Plan',
          limits: null,
          features: ['all'],
        },
      }));

      await subscriptionMiddleware(request, reply);

      expect(request.subscription.planCode).toBe('BUSINESS');
      expect(request.subscription.limits.maxUsers).toBe(-1); // Unlimited
    });

    it('should return 500 on unexpected errors', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.saasSubscription.findUnique.mockRejectedValue(new Error('Database error'));

      await subscriptionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription validation failed',
      });
    });
  });

  // =============================================
  // CHECK PLAN LIMIT
  // =============================================
  describe('checkPlanLimit', () => {
    it('should return not allowed when no subscription', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue(null);

      const result = await checkPlanLimit('tenant-1', 'users');

      expect(result).toEqual({
        allowed: false,
        current: 0,
        limit: 0,
        message: 'No subscription found',
      });
    });

    it('should check users limit', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'STARTER', limits: null },
      });
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await checkPlanLimit('tenant-1', 'users');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(3); // STARTER limit
    });

    it('should check warehouses limit', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'PRO', limits: null },
      });
      mockPrisma.warehouse.count.mockResolvedValue(3);

      const result = await checkPlanLimit('tenant-1', 'warehouses');

      expect(result.allowed).toBe(false); // 3 >= 3 (PRO limit)
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
    });

    it('should check products limit', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'STARTER', limits: null },
      });
      mockPrisma.product.count.mockResolvedValue(500);

      const result = await checkPlanLimit('tenant-1', 'products');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000); // STARTER limit
    });

    it('should check suppliers limit', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'STARTER', limits: null },
      });
      mockPrisma.supplier.count.mockResolvedValue(20);

      const result = await checkPlanLimit('tenant-1', 'suppliers');

      expect(result.allowed).toBe(false); // 20 >= 20
      expect(result.message).toContain('suppliers limit');
    });

    it('should check monthly orders limit', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'STARTER', limits: null },
      });
      mockPrisma.order.count.mockResolvedValue(499);

      const result = await checkPlanLimit('tenant-1', 'orders');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500); // STARTER monthly limit
    });

    it('should always allow when limit is -1 (unlimited)', async () => {
      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'BUSINESS', limits: null },
      });
      mockPrisma.user.count.mockResolvedValue(1000);

      const result = await checkPlanLimit('tenant-1', 'users');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  // =============================================
  // REQUIRE PLAN LIMIT
  // =============================================
  describe('requirePlanLimit', () => {
    it('should return 400 when tenant context is missing', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const middleware = requirePlanLimit('users');

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant context required',
      });
    });

    it('should continue when limit is not exceeded', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();
      const middleware = requirePlanLimit('users');

      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'PRO', limits: null },
      });
      mockPrisma.user.count.mockResolvedValue(5);

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should return 403 when limit is exceeded', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();
      const middleware = requirePlanLimit('users');

      mockPrisma.saasSubscription.findUnique.mockResolvedValue({
        plan: { code: 'PRO', limits: null },
      });
      mockPrisma.user.count.mockResolvedValue(10); // PRO limit is 10

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Plan limit reached',
        message: expect.stringContaining('users limit'),
        details: {
          resource: 'users',
          current: 10,
          limit: 10,
        },
      });
    });
  });

  // =============================================
  // REQUIRE FEATURE
  // =============================================
  describe('requireFeature', () => {
    it('should return 400 when subscription context is missing', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const middleware = requireFeature('wordpress_sync');

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription context required',
      });
    });

    it('should continue when feature is available', async () => {
      const request = createMockRequest({
        subscription: {
          subscriptionId: 'sub-1',
          planCode: 'PRO',
          planName: 'Pro Plan',
          status: 'ACTIVE' as SaasSubscriptionStatus,
          limits: {
            maxUsers: 10,
            maxWarehouses: 3,
            maxProducts: 10000,
            maxOrders: 2000,
            maxSuppliers: 100,
            features: ['inventory', 'orders', 'wordpress_sync'],
          },
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      }) as any;
      const reply = createMockReply();
      const middleware = requireFeature('wordpress_sync');

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should return 403 when feature is not available', async () => {
      const request = createMockRequest({
        subscription: {
          subscriptionId: 'sub-1',
          planCode: 'STARTER',
          planName: 'Starter Plan',
          status: 'ACTIVE' as SaasSubscriptionStatus,
          limits: {
            maxUsers: 3,
            maxWarehouses: 1,
            maxProducts: 1000,
            maxOrders: 500,
            maxSuppliers: 20,
            features: ['inventory', 'orders'],
          },
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      }) as any;
      const reply = createMockReply();
      const middleware = requireFeature('wordpress_sync');

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Feature not available',
        message: 'The "wordpress_sync" feature is not included in your Starter Plan plan. Please upgrade to access this feature.',
      });
    });
  });

  // =============================================
  // GET PLAN LIMITS
  // =============================================
  describe('getPlanLimits', () => {
    it('should return STARTER limits', () => {
      const limits = getPlanLimits('STARTER');

      expect(limits.maxUsers).toBe(3);
      expect(limits.maxWarehouses).toBe(1);
      expect(limits.maxProducts).toBe(1000);
      expect(limits.features).toContain('inventory');
    });

    it('should return PRO limits', () => {
      const limits = getPlanLimits('PRO');

      expect(limits.maxUsers).toBe(10);
      expect(limits.maxWarehouses).toBe(3);
      expect(limits.features).toContain('wordpress_sync');
    });

    it('should return BUSINESS limits (unlimited)', () => {
      const limits = getPlanLimits('BUSINESS');

      expect(limits.maxUsers).toBe(-1);
      expect(limits.maxWarehouses).toBe(-1);
      expect(limits.features).toContain('sdi');
      expect(limits.features).toContain('api_access');
    });

    it('should default to STARTER for unknown plans', () => {
      const limits = getPlanLimits('UNKNOWN_PLAN');

      expect(limits.maxUsers).toBe(3);
      expect(limits.maxWarehouses).toBe(1);
    });
  });

  // =============================================
  // PLAN HAS FEATURE
  // =============================================
  describe('planHasFeature', () => {
    it('should return true when plan includes feature', () => {
      expect(planHasFeature('PRO', 'wordpress_sync')).toBe(true);
      expect(planHasFeature('BUSINESS', 'sdi')).toBe(true);
      expect(planHasFeature('STARTER', 'inventory')).toBe(true);
    });

    it('should return false when plan does not include feature', () => {
      expect(planHasFeature('STARTER', 'wordpress_sync')).toBe(false);
      expect(planHasFeature('STARTER', 'sdi')).toBe(false);
      expect(planHasFeature('PRO', 'sdi')).toBe(false);
    });
  });
});
