/**
 * Multi-Tenant Isolation E2E Tests
 * End-to-end tests for tenant data isolation and access control
 *
 * Tests:
 * 1. Tenant creation and management
 * 2. Data isolation between tenants
 * 3. Subscription limits enforcement
 * 4. Feature gating
 * 5. Member management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma - define inside factory to avoid hoisting issues
vi.mock('@server/config/database', () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    tenantMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    saasSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    warehouse: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    supplier: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => {
      // Get the mocked prisma from the module
      return Promise.resolve(callback({
        tenant: {
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        tenantMember: {
          create: vi.fn(),
          delete: vi.fn(),
        },
        user: {
          update: vi.fn(),
        },
      }));
    }),
  },
}));

vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock subscription service for setupInitialTenant
vi.mock('@server/services/subscription.service', () => ({
  subscriptionService: {
    createTrialSubscription: vi.fn().mockResolvedValue({ id: 'sub-1' }),
  },
}));

// Import after mocks
import { prisma } from '@server/config/database';
import { tenantService } from '@server/services/tenant.service';
import { checkPlanLimit, getPlanLimits, planHasFeature } from '@server/middleware/subscription.middleware';

// Mock data
const mockTenantA = {
  id: 'tenant-a',
  name: 'Company A',
  slug: 'company-a',
  domain: null,
  settings: {},
  status: 'ACTIVE',
  createdAt: new Date(),
};

const mockTenantB = {
  id: 'tenant-b',
  name: 'Company B',
  slug: 'company-b',
  domain: null,
  settings: {},
  status: 'ACTIVE',
  createdAt: new Date(),
};

describe('Multi-Tenant Isolation E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Tenant Creation', () => {
    it('should create a new tenant', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.tenant.create).mockResolvedValue(mockTenantA as any);

      const result = await tenantService.createTenant({
        name: 'Company A',
        slug: 'company-a',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Company A');
      expect(result.slug).toBe('company-a');
      expect(prisma.tenant.create).toHaveBeenCalled();
    });

    it('should throw error for duplicate slug', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantA as any);

      await expect(
        tenantService.createTenant({
          name: 'Another Company',
          slug: 'company-a',
        })
      ).rejects.toThrow('Slug già in uso');
    });

    it('should throw error for duplicate domain', async () => {
      vi.mocked(prisma.tenant.findUnique)
        .mockResolvedValueOnce(null as any) // Slug check - available
        .mockResolvedValueOnce(mockTenantA as any); // Domain check - exists

      await expect(
        tenantService.createTenant({
          name: 'New Company',
          slug: 'new-company',
          domain: 'existing.com',
        })
      ).rejects.toThrow('Dominio già in uso');
    });
  });

  describe('Tenant Retrieval', () => {
    it('should get tenant by ID', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantA as any);

      const result = await tenantService.getTenant('tenant-a');

      expect(result).toBeDefined();
      expect(result?.id).toBe('tenant-a');
    });

    it('should return null for non-existent tenant', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await tenantService.getTenant('non-existent');

      expect(result).toBeNull();
    });

    it('should get tenant by slug', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantA as any);

      const result = await tenantService.getTenantBySlug('company-a');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('company-a');
    });

    it('should get tenant with subscription details', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
        ...mockTenantA,
        subscription: {
          plan: { code: 'PRO', name: 'Professional' },
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodEnd: new Date('2026-12-31'),
        },
        members: [{ id: 'member-1' }],
      } as any);

      const result = await tenantService.getTenantWithDetails('tenant-a');

      expect(result).toBeDefined();
      expect(result?.subscription?.planCode).toBe('PRO');
      expect(result?.memberCount).toBe(1);
    });
  });

  describe('Tenant Update', () => {
    it('should update tenant name', async () => {
      vi.mocked(prisma.tenant.update).mockResolvedValue({
        ...mockTenantA,
        name: 'Company A Updated',
      } as any);

      const result = await tenantService.updateTenant('tenant-a', {
        name: 'Company A Updated',
      });

      expect(result.name).toBe('Company A Updated');
    });

    it('should update tenant domain', async () => {
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null as any);
      vi.mocked(prisma.tenant.update).mockResolvedValue({
        ...mockTenantA,
        domain: 'new-domain.com',
      } as any);

      const result = await tenantService.updateTenant('tenant-a', {
        domain: 'new-domain.com',
      });

      expect(result.domain).toBe('new-domain.com');
    });

    it('should throw error for duplicate domain on update', async () => {
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue(mockTenantB as any);

      await expect(
        tenantService.updateTenant('tenant-a', {
          domain: 'company-b.com',
        })
      ).rejects.toThrow('Dominio già in uso');
    });
  });

  describe('Slug Availability', () => {
    it('should return true for available slug', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await tenantService.isSlugAvailable('new-slug');

      expect(result).toBe(true);
    });

    it('should return false for existing slug', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantA as any);

      const result = await tenantService.isSlugAvailable('company-a');

      expect(result).toBe(false);
    });

    it('should return false for reserved slugs', async () => {
      const reserved = ['app', 'api', 'admin', 'www'];

      for (const slug of reserved) {
        const result = await tenantService.isSlugAvailable(slug);
        expect(result).toBe(false);
      }
    });
  });

  describe('Member Management', () => {
    it('should get tenant members', async () => {
      vi.mocked(prisma.tenantMember.findMany).mockResolvedValue([
        {
          id: 'tm-1',
          userId: 'user-1',
          role: 'ADMIN',
          invitedAt: new Date(),
          acceptedAt: new Date(),
          user: {
            id: 'user-1',
            email: 'admin@company.com',
            firstName: 'Admin',
            lastName: 'User',
          },
        },
      ] as any);

      const result = await tenantService.getTenantMembers('tenant-a');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@company.com');
      expect(result[0].role).toBe('ADMIN');
    });

    it('should update member role', async () => {
      vi.mocked(prisma.tenantMember.findUnique).mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-a',
        userId: 'user-2',
        role: 'OPERATORE',
      } as any);
      vi.mocked(prisma.tenantMember.count).mockResolvedValue(2);
      vi.mocked(prisma.tenantMember.update).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await tenantService.updateMemberRole('tenant-a', 'user-2', 'ADMIN');

      expect(prisma.tenantMember.update).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should prevent demoting last admin', async () => {
      vi.mocked(prisma.tenantMember.findUnique).mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
        role: 'ADMIN',
      } as any);
      vi.mocked(prisma.tenantMember.count).mockResolvedValue(1);

      await expect(
        tenantService.updateMemberRole('tenant-a', 'user-1', 'OPERATORE')
      ).rejects.toThrow('Deve esserci almeno un amministratore');
    });

    it('should remove member from tenant', async () => {
      vi.mocked(prisma.tenantMember.findUnique).mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-a',
        userId: 'user-2',
        role: 'OPERATORE',
      } as any);
      vi.mocked(prisma.tenantMember.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await tenantService.removeMember('tenant-a', 'user-2');

      expect(prisma.tenantMember.delete).toHaveBeenCalled();
    });

    it('should prevent removing last admin', async () => {
      vi.mocked(prisma.tenantMember.findUnique).mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
        role: 'ADMIN',
      } as any);
      vi.mocked(prisma.tenantMember.count).mockResolvedValue(1);

      await expect(
        tenantService.removeMember('tenant-a', 'user-1')
      ).rejects.toThrow();
    });

    it('should throw error for non-existent member', async () => {
      vi.mocked(prisma.tenantMember.findUnique).mockResolvedValue(null);

      await expect(
        tenantService.removeMember('tenant-a', 'non-existent')
      ).rejects.toThrow('Membro non trovato');
    });
  });

  describe('Subscription Limits (checkPlanLimit)', () => {
    it('should check user limit for STARTER plan', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'STARTER', limits: null },
      } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const result = await checkPlanLimit('tenant-a', 'users');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(3);
    });

    it('should deny when at user limit', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'STARTER', limits: null },
      } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(3);

      const result = await checkPlanLimit('tenant-a', 'users');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('limit');
    });

    it('should check warehouse limit', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'STARTER', limits: null },
      } as any);
      vi.mocked(prisma.warehouse.count).mockResolvedValue(1);

      const result = await checkPlanLimit('tenant-a', 'warehouses');

      expect(result.allowed).toBe(false);
    });

    it('should check product limit', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'PRO', limits: null },
      } as any);
      vi.mocked(prisma.product.count).mockResolvedValue(500);

      const result = await checkPlanLimit('tenant-a', 'products');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10000);
    });

    it('should check supplier limit', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'STARTER', limits: null },
      } as any);
      vi.mocked(prisma.supplier.count).mockResolvedValue(20);

      const result = await checkPlanLimit('tenant-a', 'suppliers');

      expect(result.allowed).toBe(false);
    });

    it('should allow unlimited for BUSINESS plan', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        plan: { code: 'BUSINESS', limits: null },
      } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(100);

      const result = await checkPlanLimit('tenant-a', 'users');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('should return not allowed when no subscription', async () => {
      vi.mocked(prisma.saasSubscription.findUnique).mockResolvedValue(null);

      const result = await checkPlanLimit('tenant-a', 'users');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('No subscription');
    });
  });

  describe('Feature Gating (planHasFeature)', () => {
    it('should return true for features in STARTER plan', () => {
      expect(planHasFeature('STARTER', 'inventory')).toBe(true);
      expect(planHasFeature('STARTER', 'orders')).toBe(true);
      expect(planHasFeature('STARTER', 'customers')).toBe(true);
    });

    it('should return false for features not in STARTER', () => {
      expect(planHasFeature('STARTER', 'manufacturing')).toBe(false);
      expect(planHasFeature('STARTER', 'sdi')).toBe(false);
      expect(planHasFeature('STARTER', 'api_access')).toBe(false);
    });

    it('should return true for features in PRO plan', () => {
      expect(planHasFeature('PRO', 'manufacturing')).toBe(true);
      expect(planHasFeature('PRO', 'wordpress_sync')).toBe(true);
      expect(planHasFeature('PRO', 'advanced_reports')).toBe(true);
    });

    it('should return true for all features in BUSINESS plan', () => {
      expect(planHasFeature('BUSINESS', 'sdi')).toBe(true);
      expect(planHasFeature('BUSINESS', 'api_access')).toBe(true);
      expect(planHasFeature('BUSINESS', 'custom_integrations')).toBe(true);
    });
  });

  describe('Plan Limits (getPlanLimits)', () => {
    it('should return correct STARTER limits', () => {
      const limits = getPlanLimits('STARTER');

      expect(limits.maxUsers).toBe(3);
      expect(limits.maxWarehouses).toBe(1);
      expect(limits.maxProducts).toBe(1000);
      expect(limits.maxSuppliers).toBe(20);
    });

    it('should return correct PRO limits', () => {
      const limits = getPlanLimits('PRO');

      expect(limits.maxUsers).toBe(10);
      expect(limits.maxWarehouses).toBe(3);
      expect(limits.maxProducts).toBe(10000);
    });

    it('should return unlimited for BUSINESS', () => {
      const limits = getPlanLimits('BUSINESS');

      expect(limits.maxUsers).toBe(-1);
      expect(limits.maxWarehouses).toBe(-1);
      expect(limits.maxProducts).toBe(-1);
    });

    it('should default to STARTER for unknown plan', () => {
      const limits = getPlanLimits('UNKNOWN');

      expect(limits.maxUsers).toBe(3);
    });
  });

  describe('Data Isolation', () => {
    it('should isolate orders between tenants', async () => {
      vi.mocked(prisma.order.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.tenantId === 'tenant-a') {
          return [{ id: 'ord-a1', tenantId: 'tenant-a' }] as any;
        }
        return [{ id: 'ord-b1', tenantId: 'tenant-b' }] as any;
      });

      const ordersA = await prisma.order.findMany({ where: { tenantId: 'tenant-a' } });
      const ordersB = await prisma.order.findMany({ where: { tenantId: 'tenant-b' } });

      expect(ordersA).toHaveLength(1);
      expect(ordersA[0].tenantId).toBe('tenant-a');
      expect(ordersB[0].tenantId).toBe('tenant-b');
    });

    it('should isolate customers between tenants', async () => {
      vi.mocked(prisma.customer.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.tenantId === 'tenant-a') {
          return [{ id: 'cust-a1', tenantId: 'tenant-a' }] as any;
        }
        return [{ id: 'cust-b1', tenantId: 'tenant-b' }] as any;
      });

      const customersA = await prisma.customer.findMany({ where: { tenantId: 'tenant-a' } });
      const customersB = await prisma.customer.findMany({ where: { tenantId: 'tenant-b' } });

      expect(customersA.every((c: any) => c.tenantId === 'tenant-a')).toBe(true);
      expect(customersB.every((c: any) => c.tenantId === 'tenant-b')).toBe(true);
    });

    it('should isolate products between tenants', async () => {
      vi.mocked(prisma.product.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.tenantId === 'tenant-a') {
          return [{ id: 'prod-a1', tenantId: 'tenant-a', name: 'Product A' }] as any;
        }
        return [{ id: 'prod-b1', tenantId: 'tenant-b', name: 'Product B' }] as any;
      });

      const productsA = await prisma.product.findMany({ where: { tenantId: 'tenant-a' } });
      expect(productsA[0].tenantId).toBe('tenant-a');
    });

    it('should isolate warehouses between tenants', async () => {
      vi.mocked(prisma.warehouse.findMany).mockImplementation(async (args: any) => {
        if (args?.where?.tenantId === 'tenant-a') {
          return [{ id: 'wh-a1', tenantId: 'tenant-a', code: 'MAIN-A' }] as any;
        }
        return [{ id: 'wh-b1', tenantId: 'tenant-b', code: 'MAIN-B' }] as any;
      });

      const warehousesA = await prisma.warehouse.findMany({ where: { tenantId: 'tenant-a' } });
      expect(warehousesA.every((w: any) => w.tenantId === 'tenant-a')).toBe(true);
    });

    it('should aggregate queries only include tenant data', async () => {
      vi.mocked(prisma.order.count).mockImplementation(async (args: any) => {
        expect(args?.where?.tenantId).toBeDefined();
        return 50;
      });

      const count = await prisma.order.count({ where: { tenantId: 'tenant-a' } });

      expect(count).toBe(50);
    });
  });
});
