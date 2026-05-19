/**
 * @file tenant.service.test.ts
 * @description Unit tests for multi-tenant service
 * @coverage ~25 tests covering tenant CRUD, member management, setup
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, TenantStatus, UserRole } from '@prisma/client';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Mock database
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock subscription service
const mockSubscriptionService = {
  createTrialSubscription: jest.fn(),
};

jest.mock('@server/services/subscription.service', () => ({
  subscriptionService: mockSubscriptionService,
}));

// Import service after mocks
import { tenantService } from '@server/services/tenant.service';

describe('TenantService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // Test data factories
  const createMockTenant = (overrides = {}) => ({
    id: 'tenant-123',
    slug: 'test-company',
    name: 'Test Company',
    domain: null,
    settings: {},
    status: 'ACTIVE' as TenantStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockMember = (overrides = {}) => ({
    id: 'member-1',
    tenantId: 'tenant-123',
    userId: 'user-1',
    role: 'ADMIN' as UserRole,
    invitedAt: new Date(),
    acceptedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'admin@test.com',
      firstName: 'Test',
      lastName: 'User',
    },
    ...overrides,
  });

  // ============================================================================
  // createTenant
  // ============================================================================
  describe('createTenant', () => {
    it('should create tenant successfully', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue(createMockTenant());

      const result = await tenantService.createTenant({
        name: 'Test Company',
        slug: 'test-company',
      });

      expect(result.name).toBe('Test Company');
      expect(result.slug).toBe('test-company');
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw when slug is already in use', async () => {
      prismaMock.tenant.findUnique.mockResolvedValueOnce(createMockTenant());

      await expect(
        tenantService.createTenant({
          name: 'Another Company',
          slug: 'test-company',
        })
      ).rejects.toThrow('Slug già in uso');
    });

    it('should throw when domain is already in use', async () => {
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // slug check
      prismaMock.tenant.findUnique.mockResolvedValueOnce(
        createMockTenant({ domain: 'existing.com' })
      ); // domain check

      await expect(
        tenantService.createTenant({
          name: 'New Company',
          slug: 'new-company',
          domain: 'existing.com',
        })
      ).rejects.toThrow('Dominio già in uso');
    });

    it('should sanitize slug', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockImplementation(async ({ data }) => ({
        ...createMockTenant(),
        slug: data.slug,
      }));

      const result = await tenantService.createTenant({
        name: 'Test',
        slug: 'Test Company!@#',
      });

      expect(result.slug).toBe('test-company');
    });
  });

  // ============================================================================
  // getTenant
  // ============================================================================
  describe('getTenant', () => {
    it('should return tenant when found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await tenantService.getTenant('tenant-123');

      expect(result?.id).toBe('tenant-123');
      expect(result?.name).toBe('Test Company');
    });

    it('should return null when not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      const result = await tenantService.getTenant('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getTenantWithDetails
  // ============================================================================
  describe('getTenantWithDetails', () => {
    it('should return tenant with subscription and member count', async () => {
      const mockTenant = {
        ...createMockTenant(),
        subscription: {
          plan: { code: 'PRO', name: 'Pro Plan' },
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
        members: [createMockMember(), createMockMember({ id: 'member-2' })],
      };
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const result = await tenantService.getTenantWithDetails('tenant-123');

      expect(result?.subscription?.planCode).toBe('PRO');
      expect(result?.memberCount).toBe(2);
    });

    it('should return null when tenant not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      const result = await tenantService.getTenantWithDetails('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle tenant without subscription', async () => {
      const mockTenant = {
        ...createMockTenant(),
        subscription: null,
        members: [],
      };
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const result = await tenantService.getTenantWithDetails('tenant-123');

      expect(result?.subscription).toBeNull();
      expect(result?.memberCount).toBe(0);
    });
  });

  // ============================================================================
  // getTenantBySlug
  // ============================================================================
  describe('getTenantBySlug', () => {
    it('should return tenant by slug', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await tenantService.getTenantBySlug('test-company');

      expect(result?.slug).toBe('test-company');
    });

    it('should return null when not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      const result = await tenantService.getTenantBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // updateTenant
  // ============================================================================
  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(null);
      prismaMock.tenant.update.mockResolvedValue(
        createMockTenant({ name: 'Updated Company' })
      );

      const result = await tenantService.updateTenant('tenant-123', {
        name: 'Updated Company',
      });

      expect(result.name).toBe('Updated Company');
    });

    it('should throw when domain is already in use by another tenant', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(
        createMockTenant({ id: 'other-tenant' })
      );

      await expect(
        tenantService.updateTenant('tenant-123', { domain: 'existing.com' })
      ).rejects.toThrow('Dominio già in uso');
    });

    it('should allow same domain for same tenant', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(null);
      prismaMock.tenant.update.mockResolvedValue(
        createMockTenant({ domain: 'same.com' })
      );

      const result = await tenantService.updateTenant('tenant-123', {
        domain: 'same.com',
      });

      expect(result.domain).toBe('same.com');
    });

    it('should update multiple fields', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(null);
      prismaMock.tenant.update.mockResolvedValue(
        createMockTenant({
          name: 'New Name',
          domain: 'new.com',
          status: 'SUSPENDED' as TenantStatus,
        })
      );

      const result = await tenantService.updateTenant('tenant-123', {
        name: 'New Name',
        domain: 'new.com',
        status: 'SUSPENDED',
      });

      expect(result.name).toBe('New Name');
      expect(result.domain).toBe('new.com');
      expect(result.status).toBe('SUSPENDED');
    });
  });

  // ============================================================================
  // isSlugAvailable
  // ============================================================================
  describe('isSlugAvailable', () => {
    it('should return true for available slug', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      const result = await tenantService.isSlugAvailable('new-company');

      expect(result).toBe(true);
    });

    it('should return false for taken slug', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await tenantService.isSlugAvailable('test-company');

      expect(result).toBe(false);
    });

    it('should return false for reserved slugs', async () => {
      const result = await tenantService.isSlugAvailable('api');

      expect(result).toBe(false);
      expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
    });

    it.each(['app', 'admin', 'www', 'mail', 'support', 'help', 'docs', 'blog'])(
      'should return false for reserved slug: %s',
      async (slug) => {
        const result = await tenantService.isSlugAvailable(slug);
        expect(result).toBe(false);
      }
    );
  });

  // ============================================================================
  // setupInitialTenant
  // ============================================================================
  describe('setupInitialTenant', () => {
    // setupInitialTenant esegue un `prisma.$transaction(async (tx) => ...)`:
    // dobbiamo mockare $transaction in modo che invochi la callback passandole
    // prismaMock come tx, altrimenti il body della transazione non viene mai
    // eseguito e le asserzioni su tenant.create/tenantMember.create falliscono.
    const setupTxMock = () => {
      (prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
      );
    };

    it('should setup complete tenant for new user', async () => {
      setupTxMock();
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue(createMockTenant());
      prismaMock.tenantMember.create.mockResolvedValue(createMockMember() as any);
      prismaMock.user.update.mockResolvedValue({} as any);
      mockSubscriptionService.createTrialSubscription.mockResolvedValue({});

      const mockTenantWithDetails = {
        ...createMockTenant(),
        subscription: {
          plan: { code: 'PRO', name: 'Pro Plan' },
          status: 'TRIALING',
          trialEndsAt: new Date(),
          currentPeriodEnd: new Date(),
        },
        members: [createMockMember()],
      };
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // isSlugAvailable check
      prismaMock.tenant.findUnique.mockResolvedValueOnce(mockTenantWithDetails as any); // getTenantWithDetails

      const result = await tenantService.setupInitialTenant('user-1', 'My Company');

      expect(prismaMock.tenant.create).toHaveBeenCalled();
      expect(prismaMock.tenantMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          role: 'ADMIN',
        }),
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tenantId: expect.any(String) },
      });
      expect(mockSubscriptionService.createTrialSubscription).toHaveBeenCalled();
    });

    it('should generate unique slug when base is taken', async () => {
      setupTxMock();
      prismaMock.tenant.findUnique.mockResolvedValueOnce(createMockTenant()); // first slug taken
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // second slug available
      prismaMock.tenant.create.mockResolvedValue(createMockTenant({ slug: 'my-company-1' }));
      prismaMock.tenantMember.create.mockResolvedValue(createMockMember() as any);
      prismaMock.user.update.mockResolvedValue({} as any);
      mockSubscriptionService.createTrialSubscription.mockResolvedValue({});
      prismaMock.tenant.findUnique.mockResolvedValueOnce({
        ...createMockTenant(),
        subscription: null,
        members: [],
      } as any);

      await tenantService.setupInitialTenant('user-1', 'my-company');

      expect(prismaMock.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'my-company-1',
        }),
      });
    });
  });

  // ============================================================================
  // getTenantMembers
  // ============================================================================
  describe('getTenantMembers', () => {
    it('should return all tenant members', async () => {
      prismaMock.tenantMember.findMany.mockResolvedValue([
        createMockMember(),
        createMockMember({ id: 'member-2', userId: 'user-2', role: 'MANAGER' }),
      ] as any);

      const result = await tenantService.getTenantMembers('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('role');
    });

    it('should format member info correctly', async () => {
      prismaMock.tenantMember.findMany.mockResolvedValue([createMockMember()] as any);

      const result = await tenantService.getTenantMembers('tenant-123');

      expect(result[0]).toEqual({
        id: 'member-1',
        userId: 'user-1',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
        invitedAt: expect.any(Date),
        acceptedAt: expect.any(Date),
      });
    });
  });

  // ============================================================================
  // updateMemberRole
  // ============================================================================
  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'MANAGER' }) as any
      );
      prismaMock.tenantMember.update.mockResolvedValue({} as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await tenantService.updateMemberRole('tenant-123', 'user-1', 'ADMIN');

      expect(prismaMock.tenantMember.update).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-123', userId: 'user-1' } },
        data: { role: 'ADMIN' },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'ADMIN' },
      });
    });

    it('should throw when member not found', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(null);

      await expect(
        tenantService.updateMemberRole('tenant-123', 'nonexistent', 'MANAGER')
      ).rejects.toThrow('Membro non trovato');
    });

    it('should throw when demoting last admin', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'ADMIN' }) as any
      );
      prismaMock.tenantMember.count.mockResolvedValue(1);

      await expect(
        tenantService.updateMemberRole('tenant-123', 'user-1', 'MANAGER')
      ).rejects.toThrow('Deve esserci almeno un amministratore');
    });

    it('should allow demoting admin when others exist', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'ADMIN' }) as any
      );
      prismaMock.tenantMember.count.mockResolvedValue(2);
      prismaMock.tenantMember.update.mockResolvedValue({} as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await tenantService.updateMemberRole('tenant-123', 'user-1', 'MANAGER');

      expect(prismaMock.tenantMember.update).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // removeMember
  // ============================================================================
  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'MANAGER' }) as any
      );
      prismaMock.tenantMember.delete.mockResolvedValue({} as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await tenantService.removeMember('tenant-123', 'user-1');

      expect(prismaMock.tenantMember.delete).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-123', userId: 'user-1' } },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tenantId: null },
      });
    });

    it('should throw when member not found', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(null);

      await expect(
        tenantService.removeMember('tenant-123', 'nonexistent')
      ).rejects.toThrow('Membro non trovato');
    });

    it('should throw when removing last admin', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'ADMIN' }) as any
      );
      prismaMock.tenantMember.count.mockResolvedValue(1);

      await expect(
        tenantService.removeMember('tenant-123', 'user-1')
      ).rejects.toThrow("Impossibile rimuovere l'ultimo amministratore");
    });

    it('should allow removing admin when others exist', async () => {
      prismaMock.tenantMember.findUnique.mockResolvedValue(
        createMockMember({ role: 'ADMIN' }) as any
      );
      prismaMock.tenantMember.count.mockResolvedValue(2);
      prismaMock.tenantMember.delete.mockResolvedValue({} as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await tenantService.removeMember('tenant-123', 'user-1');

      expect(prismaMock.tenantMember.delete).toHaveBeenCalled();
    });
  });
});
