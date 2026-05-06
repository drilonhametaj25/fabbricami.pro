// Mock Prisma
const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
  },
  tenantMember: {
    findUnique: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import {
  tenantContext,
  getCurrentTenant,
  getCurrentTenantId,
  tenantMiddleware,
  verifyTenantMembership,
  optionalTenantMiddleware,
  TenantContext,
} from '@server/middleware/tenant.middleware';
import { TenantStatus } from '@prisma/client';

// Helper functions
const createMockRequest = (options: {
  headers?: Record<string, string>;
  user?: { userId?: string; tenantId?: string };
  tenant?: TenantContext;
} = {}) => ({
  headers: options.headers || {},
  user: options.user,
  tenant: options.tenant,
  log: {
    error: jest.fn(),
    warn: jest.fn(),
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

describe('Tenant Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET CURRENT TENANT / TENANT ID
  // =============================================
  describe('getCurrentTenant', () => {
    it('should return undefined when no context is set', () => {
      const result = getCurrentTenant();
      expect(result).toBeUndefined();
    });

    it('should return context when set via AsyncLocalStorage', () => {
      const ctx: TenantContext = {
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        tenantStatus: 'ACTIVE' as TenantStatus,
      };

      tenantContext.run(ctx, () => {
        const result = getCurrentTenant();
        expect(result).toEqual(ctx);
      });
    });
  });

  describe('getCurrentTenantId', () => {
    it('should return undefined when no context is set', () => {
      const result = getCurrentTenantId();
      expect(result).toBeUndefined();
    });

    it('should return tenantId when context is set', () => {
      const ctx: TenantContext = {
        tenantId: 'tenant-123',
        tenantSlug: 'acme',
        tenantStatus: 'ACTIVE' as TenantStatus,
      };

      tenantContext.run(ctx, () => {
        const result = getCurrentTenantId();
        expect(result).toBe('tenant-123');
      });
    });
  });

  // =============================================
  // TENANT MIDDLEWARE
  // =============================================
  describe('tenantMiddleware', () => {
    it('should extract tenantId from JWT user', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        status: 'ACTIVE',
      });

      await tenantMiddleware(request, reply);

      expect(request.tenant).toEqual({
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        tenantStatus: 'ACTIVE',
      });
    });

    it('should extract tenantId from X-Tenant-Id header', async () => {
      const request = createMockRequest({
        headers: { 'x-tenant-id': 'tenant-2' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-2',
        slug: 'beta-corp',
        status: 'ACTIVE',
      });

      await tenantMiddleware(request, reply);

      expect(request.tenant.tenantId).toBe('tenant-2');
      expect(request.tenant.tenantSlug).toBe('beta-corp');
    });

    it('should extract tenant from subdomain', async () => {
      const request = createMockRequest({
        headers: { host: 'gamma.erpsaas.com' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({ id: 'tenant-3', slug: 'gamma', status: 'ACTIVE' }) // subdomain lookup
        .mockResolvedValueOnce({ id: 'tenant-3', slug: 'gamma', status: 'ACTIVE' }); // verification lookup

      await tenantMiddleware(request, reply);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'gamma' },
        select: { id: true, slug: true, status: true },
      });
    });

    it('should return 400 when no tenant is specified', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant not specified',
        message: 'Request must include tenant identification via JWT, X-Tenant-Id header, or subdomain',
      });
    });

    it('should return 404 when tenant is not found', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'nonexistent-tenant' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant not found',
      });
    });

    it('should return 403 when tenant is suspended', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'suspended-tenant',
        status: 'SUSPENDED',
      });

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant suspended',
        message: 'Tenant is suspended. Please contact support.',
      });
    });

    it('should return 403 when tenant is cancelled', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'cancelled-tenant',
        status: 'CANCELLED',
      });

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant suspended',
        message: 'Tenant is cancelled. Please contact support.',
      });
    });

    it('should prefer JWT tenantId over header', async () => {
      const request = createMockRequest({
        headers: { 'x-tenant-id': 'header-tenant' },
        user: { userId: 'user-1', tenantId: 'jwt-tenant' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'jwt-tenant',
        slug: 'jwt-corp',
        status: 'ACTIVE',
      });

      await tenantMiddleware(request, reply);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'jwt-tenant' },
        select: { id: true, slug: true, status: true },
      });
    });

    it('should return 500 on unexpected errors', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Database error'));

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant validation failed',
      });
    });

    it('should not extract tenant from single-part hostname', async () => {
      const request = createMockRequest({
        headers: { host: 'localhost' },
      }) as any;
      const reply = createMockReply();

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should not extract tenant from two-part hostname', async () => {
      const request = createMockRequest({
        headers: { host: 'erpsaas.com' },
      }) as any;
      const reply = createMockReply();

      await tenantMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    // CRITICAL: regression test per il bug Promise wrapper che chiudeva il context immediatamente.
    // Verifica che enterWith() sia stato chiamato con il context corretto (Jest ha quirks
    // con la propagazione ALS attraverso await — issue jestjs/jest#12793 — quindi spy
    // diretto invece di verifica del context post-chiamata).
    it('should call tenantContext.enterWith with correct context (regression for promise-wrapper bug)', async () => {
      const enterWithSpy = jest.spyOn(tenantContext, 'enterWith');
      try {
        const request = createMockRequest({
          user: { userId: 'user-1', tenantId: 'tenant-iso' },
        }) as any;
        const reply = createMockReply();

        mockPrisma.tenant.findUnique.mockResolvedValue({
          id: 'tenant-iso',
          slug: 'isolated',
          status: 'ACTIVE',
        });

        await tenantMiddleware(request, reply);

        expect(enterWithSpy).toHaveBeenCalledTimes(1);
        expect(enterWithSpy).toHaveBeenCalledWith({
          tenantId: 'tenant-iso',
          tenantSlug: 'isolated',
          tenantStatus: 'ACTIVE',
        });
        expect(reply.status).not.toHaveBeenCalled(); // No error response
      } finally {
        enterWithSpy.mockRestore();
      }
    });
  });

  // =============================================
  // VERIFY TENANT MEMBERSHIP
  // =============================================
  describe('verifyTenantMembership', () => {
    it('should return 401 when user is not authenticated', async () => {
      const request = createMockRequest({
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      await verifyTenantMembership(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 401 when tenant is not set', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1' },
      }) as any;
      const reply = createMockReply();

      await verifyTenantMembership(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 403 when user is not a member', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1' },
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenantMember.findUnique.mockResolvedValue(null);

      await verifyTenantMembership(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not a member of this tenant',
      });
    });

    it('should return 403 when membership is not accepted', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1' },
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenantMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
        acceptedAt: null, // Not yet accepted
      });

      await verifyTenantMembership(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Membership not yet accepted',
      });
    });

    it('should continue when user is a valid member', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1' },
        tenant: { tenantId: 'tenant-1', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenantMember.findUnique.mockResolvedValue({
        role: 'ADMIN',
        acceptedAt: new Date(),
      });

      await verifyTenantMembership(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should use compound key for membership lookup', async () => {
      const request = createMockRequest({
        user: { userId: 'user-123' },
        tenant: { tenantId: 'tenant-456', tenantSlug: 'acme', tenantStatus: 'ACTIVE' as TenantStatus },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenantMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
        acceptedAt: new Date(),
      });

      await verifyTenantMembership(request, reply);

      expect(mockPrisma.tenantMember.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_userId: {
            tenantId: 'tenant-456',
            userId: 'user-123',
          },
        },
        select: { role: true, acceptedAt: true },
      });
    });
  });

  // =============================================
  // OPTIONAL TENANT MIDDLEWARE
  // =============================================
  describe('optionalTenantMiddleware', () => {
    it('should continue silently when no tenant is provided', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await optionalTenantMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.tenant).toBeUndefined();
    });

    it('should set tenant context when JWT has tenantId', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        status: 'ACTIVE',
      });

      await optionalTenantMiddleware(request, reply);

      expect(request.tenant).toEqual({
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        tenantStatus: 'ACTIVE',
      });
    });

    it('should set tenant context from X-Tenant-Id header', async () => {
      const request = createMockRequest({
        headers: { 'x-tenant-id': 'tenant-2' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-2',
        slug: 'beta',
        status: 'ACTIVE',
      });

      await optionalTenantMiddleware(request, reply);

      expect(request.tenant.tenantId).toBe('tenant-2');
    });

    it('should not set tenant when tenant is not active', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'suspended',
        status: 'SUSPENDED',
      });

      await optionalTenantMiddleware(request, reply);

      expect(request.tenant).toBeUndefined();
    });

    it('should not set tenant when tenant not found', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'nonexistent' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await optionalTenantMiddleware(request, reply);

      expect(request.tenant).toBeUndefined();
    });

    it('should silently handle errors', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      }) as any;
      const reply = createMockReply();

      mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Database error'));

      await optionalTenantMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.log.warn).toHaveBeenCalled();
    });
  });
});
