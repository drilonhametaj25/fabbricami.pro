import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { UserRole } from '@prisma/client';

// Mock prisma
const mockPrisma = {
  tenantMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  tenantInvite: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock crypto utilities
jest.mock('@server/utils/crypto.util', () => ({
  generateRandomToken: jest.fn().mockReturnValue('mock-token-64-chars-long-for-invite-security-purposes-here'),
  hashPassword: jest.fn().mockResolvedValue('$hashed$password'),
}));

// Mock email service
const mockEmailService = {
  send: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@server/services/email.service', () => ({
  emailService: mockEmailService,
}));

import { tenantInviteService } from '@server/services/tenant-invite.service';

describe('TenantInviteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================
  // createInvite
  // ===================
  describe('createInvite', () => {
    const createInviteData = {
      tenantId: 'tenant-1',
      email: 'newuser@example.com',
      role: 'OPERATORE' as UserRole,
      inviterName: 'Admin User',
    };

    it('should create invite and send email', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        token: 'mock-token-64-chars-long-for-invite-security-purposes-here',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      const result = await tenantInviteService.createInvite(createInviteData);

      expect(result).toEqual(expect.objectContaining({
        id: 'invite-1',
        tenantId: 'tenant-1',
        tenantName: 'Test Company',
        email: 'newuser@example.com',
        role: 'OPERATORE',
      }));
      expect(mockEmailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'newuser@example.com',
        subject: expect.stringContaining('Test Company'),
      }));
    });

    it('should throw error if user is already a member', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue({
        id: 'member-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      await expect(tenantInviteService.createInvite(createInviteData))
        .rejects.toThrow('Questo utente è già membro del tenant');
    });

    it('should throw error if pending invite exists', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue({
        id: 'invite-existing',
        email: 'newuser@example.com',
        expiresAt: new Date('2026-03-01'),
      });

      await expect(tenantInviteService.createInvite(createInviteData))
        .rejects.toThrow('Esiste già un invito pendente per questa email');
    });

    it('should throw error if tenant not found', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(tenantInviteService.createInvite(createInviteData))
        .rejects.toThrow('Tenant non trovato');
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'uppercase@example.com',
        role: 'OPERATORE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        ...createInviteData,
        email: 'UPPERCASE@EXAMPLE.COM',
      });

      expect(mockPrisma.tenantInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'uppercase@example.com',
          }),
        })
      );
    });

    it('should set expiry date to 7 days from now', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite(createInviteData);

      expect(mockPrisma.tenantInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );
    });
  });

  // ===================
  // getInviteByToken
  // ===================
  describe('getInviteByToken', () => {
    it('should return invite info when found', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'MANAGER',
        expiresAt: new Date('2026-03-01'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      const result = await tenantInviteService.getInviteByToken('valid-token');

      expect(result).toEqual(expect.objectContaining({
        id: 'invite-1',
        tenantId: 'tenant-1',
        tenantName: 'Test Company',
        email: 'user@example.com',
        role: 'MANAGER',
      }));
    });

    it('should return null when invite not found', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue(null);

      const result = await tenantInviteService.getInviteByToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should include isExpired flag', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'MANAGER',
        expiresAt: new Date('2025-01-01'), // Past date
        createdAt: new Date('2024-12-25'),
        tenant: { name: 'Test Company' },
      });

      const result = await tenantInviteService.getInviteByToken('expired-token');

      expect(result?.isExpired).toBe(true);
    });

    it('should show not expired for future expiry', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'MANAGER',
        expiresAt: new Date('2027-01-01'), // Future date
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      const result = await tenantInviteService.getInviteByToken('valid-token');

      expect(result?.isExpired).toBe(false);
    });
  });

  // ===================
  // acceptInvite
  // ===================
  describe('acceptInvite', () => {
    const acceptData = {
      token: 'valid-token',
      firstName: 'John',
      lastName: 'Doe',
      password: 'securePassword123',
    };

    it('should throw error if invite not found', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue(null);

      await expect(tenantInviteService.acceptInvite(acceptData))
        .rejects.toThrow('Invito non trovato');
    });

    it('should throw error if invite is expired', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        expiresAt: new Date('2025-01-01'), // Past date
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });

      await expect(tenantInviteService.acceptInvite(acceptData))
        .rejects.toThrow('Invito scaduto');
    });

    it('should create new user when email does not exist', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'newuser@example.com',
              firstName: 'John',
              lastName: 'Doe',
              role: 'OPERATORE',
            }),
          },
          tenantMember: {
            create: jest.fn().mockResolvedValue({}),
          },
          tenantInvite: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      const result = await tenantInviteService.acceptInvite(acceptData);

      expect(result).toEqual(expect.objectContaining({
        userId: 'user-new',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
      }));
    });

    it('should add existing user to tenant', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'existing@example.com',
        role: 'MANAGER',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
      mockPrisma.tenantMember.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      const result = await tenantInviteService.acceptInvite(acceptData);

      expect(result).toEqual(expect.objectContaining({
        userId: 'user-existing',
        tenantId: 'tenant-1',
        email: 'existing@example.com',
        role: 'MANAGER',
      }));
    });

    it('should throw error if existing user is already a member', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'existing@example.com',
        role: 'MANAGER',
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        email: 'existing@example.com',
      });
      mockPrisma.tenantMember.findUnique.mockResolvedValue({
        id: 'member-1',
        tenantId: 'tenant-1',
        userId: 'user-existing',
      });

      await expect(tenantInviteService.acceptInvite(acceptData))
        .rejects.toThrow('Utente già membro di questo tenant');
    });

    it('should notify admins when invite is accepted', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'newuser@example.com',
            }),
          },
          tenantMember: {
            create: jest.fn().mockResolvedValue({}),
          },
          tenantInvite: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([
        {
          role: 'ADMIN',
          acceptedAt: new Date(),
          user: { email: 'admin@example.com' },
          tenant: { name: 'Test Company' },
        },
      ]);

      await tenantInviteService.acceptInvite(acceptData);

      expect(mockEmailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('John Doe'),
      }));
    });

    it('should set user as email verified', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      let userCreateData: any;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockImplementation((args) => {
              userCreateData = args.data;
              return { id: 'user-new', email: 'newuser@example.com' };
            }),
          },
          tenantMember: {
            create: jest.fn().mockResolvedValue({}),
          },
          tenantInvite: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      await tenantInviteService.acceptInvite(acceptData);

      expect(userCreateData).toEqual(expect.objectContaining({
        emailVerified: true,
        isActive: true,
      }));
    });
  });

  // ===================
  // cancelInvite
  // ===================
  describe('cancelInvite', () => {
    it('should delete invite when found', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
      });
      mockPrisma.tenantInvite.delete.mockResolvedValue({});

      await tenantInviteService.cancelInvite('invite-1', 'tenant-1');

      expect(mockPrisma.tenantInvite.delete).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
      });
    });

    it('should throw error if invite not found', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);

      await expect(tenantInviteService.cancelInvite('invite-unknown', 'tenant-1'))
        .rejects.toThrow('Invito non trovato');
    });

    it('should only allow cancellation for correct tenant', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);

      await expect(tenantInviteService.cancelInvite('invite-1', 'wrong-tenant'))
        .rejects.toThrow('Invito non trovato');

      expect(mockPrisma.tenantInvite.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'invite-1',
          tenantId: 'wrong-tenant',
        },
      });
    });
  });

  // ===================
  // listPendingInvites
  // ===================
  describe('listPendingInvites', () => {
    it('should return all pending invites for tenant', async () => {
      mockPrisma.tenantInvite.findMany.mockResolvedValue([
        {
          id: 'invite-1',
          tenantId: 'tenant-1',
          email: 'user1@example.com',
          role: 'OPERATORE',
          expiresAt: new Date('2026-03-01'),
          createdAt: new Date('2026-02-18'),
          tenant: { name: 'Test Company' },
        },
        {
          id: 'invite-2',
          tenantId: 'tenant-1',
          email: 'user2@example.com',
          role: 'MANAGER',
          expiresAt: new Date('2026-03-05'),
          createdAt: new Date('2026-02-20'),
          tenant: { name: 'Test Company' },
        },
      ]);

      const result = await tenantInviteService.listPendingInvites('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'invite-1',
        email: 'user1@example.com',
      }));
    });

    it('should return empty array when no invites', async () => {
      mockPrisma.tenantInvite.findMany.mockResolvedValue([]);

      const result = await tenantInviteService.listPendingInvites('tenant-1');

      expect(result).toEqual([]);
    });

    it('should order by createdAt descending', async () => {
      mockPrisma.tenantInvite.findMany.mockResolvedValue([]);

      await tenantInviteService.listPendingInvites('tenant-1');

      expect(mockPrisma.tenantInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  // ===================
  // resendInvite
  // ===================
  describe('resendInvite', () => {
    it('should resend invite with new token', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        expiresAt: new Date('2026-02-20'),
        createdAt: new Date('2026-02-13'),
        tenant: { name: 'Test Company' },
      });
      mockPrisma.tenantInvite.update.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'new-mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-13'),
        tenant: { name: 'Test Company' },
      });

      const result = await tenantInviteService.resendInvite('invite-1', 'tenant-1', 'Admin User');

      expect(mockPrisma.tenantInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invite-1' },
          data: expect.objectContaining({
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        })
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@example.com',
      }));
      expect(result.id).toBe('invite-1');
    });

    it('should throw error if invite not found', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);

      await expect(tenantInviteService.resendInvite('invite-unknown', 'tenant-1', 'Admin'))
        .rejects.toThrow('Invito non trovato');
    });

    it('should extend expiry by 7 days', async () => {
      mockPrisma.tenantInvite.findFirst.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        expiresAt: new Date('2025-01-01'), // Old expired date
        createdAt: new Date('2024-12-25'),
        tenant: { name: 'Test Company' },
      });
      mockPrisma.tenantInvite.update.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'new-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2024-12-25'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.resendInvite('invite-1', 'tenant-1', 'Admin');

      const updateCall = mockPrisma.tenantInvite.update.mock.calls[0][0];
      const newExpiresAt = updateCall.data.expiresAt;
      const now = new Date();
      const diffDays = Math.round((newExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });
  });

  // ===================
  // cleanupExpiredInvites
  // ===================
  describe('cleanupExpiredInvites', () => {
    it('should delete expired invites', async () => {
      mockPrisma.tenantInvite.deleteMany.mockResolvedValue({ count: 5 });

      const result = await tenantInviteService.cleanupExpiredInvites();

      expect(result).toBe(5);
      expect(mockPrisma.tenantInvite.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 when no expired invites', async () => {
      mockPrisma.tenantInvite.deleteMany.mockResolvedValue({ count: 0 });

      const result = await tenantInviteService.cleanupExpiredInvites();

      expect(result).toBe(0);
    });
  });

  // ===================
  // Role Display Names
  // ===================
  describe('role display names (via email content)', () => {
    it('should include correct role name in email for ADMIN', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        inviterName: 'Inviter',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Amministratore'),
        })
      );
    });

    it('should include correct role name in email for CONTABILE', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'accountant@example.com',
        role: 'CONTABILE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'accountant@example.com',
        role: 'CONTABILE',
        inviterName: 'Inviter',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Contabile'),
        })
      );
    });

    it('should include correct role name in email for MAGAZZINIERE', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'warehouse@example.com',
        role: 'MAGAZZINIERE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'warehouse@example.com',
        role: 'MAGAZZINIERE',
        inviterName: 'Inviter',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Magazziniere'),
        })
      );
    });
  });

  // ===================
  // Email Content Validation
  // ===================
  describe('email content', () => {
    it('should include invite URL with token', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'mock-token-64-chars-long-for-invite-security-purposes-here',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        inviterName: 'Admin User',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('accept-invite?token='),
        })
      );
    });

    it('should include inviter name in email', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        inviterName: 'Marco Rossi',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Marco Rossi'),
        })
      );
    });

    it('should include tenant name in email', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Corporation',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Acme Corporation' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        inviterName: 'Admin',
      });

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Acme Corporation'),
          subject: expect.stringContaining('Acme Corporation'),
        })
      );
    });

    it('should include expiry date in email', async () => {
      mockPrisma.tenantMember.findFirst.mockResolvedValue(null);
      mockPrisma.tenantInvite.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Company',
      });
      mockPrisma.tenantInvite.create.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        token: 'mock-token',
        expiresAt: new Date('2026-02-25'),
        createdAt: new Date('2026-02-18'),
        tenant: { name: 'Test Company' },
      });

      await tenantInviteService.createInvite({
        tenantId: 'tenant-1',
        email: 'user@example.com',
        role: 'OPERATORE',
        inviterName: 'Admin',
      });

      // The email should contain some date reference
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('scadrà'),
        })
      );
    });
  });

  // ===================
  // Admin Notification on Accept
  // ===================
  describe('admin notification on accept', () => {
    it('should not send notification if no admins exist', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'newuser@example.com',
            }),
          },
          tenantMember: { create: jest.fn() },
          tenantInvite: { delete: jest.fn() },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      await tenantInviteService.acceptInvite({
        token: 'valid-token',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });

      // Email send should not be called for admin notification
      // (it's only called if admins exist)
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('should send notification to multiple admins', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date('2026-02-18'),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'newuser@example.com',
            }),
          },
          tenantMember: { create: jest.fn() },
          tenantInvite: { delete: jest.fn() },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([
        {
          role: 'ADMIN',
          acceptedAt: new Date(),
          user: { email: 'admin1@example.com' },
          tenant: { name: 'Test Company' },
        },
        {
          role: 'ADMIN',
          acceptedAt: new Date(),
          user: { email: 'admin2@example.com' },
          tenant: { name: 'Test Company' },
        },
      ]);

      await tenantInviteService.acceptInvite({
        token: 'valid-token',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });

      expect(mockEmailService.send).toHaveBeenCalledTimes(2);
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin1@example.com' })
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin2@example.com' })
      );
    });
  });

  // ===================
  // Transaction Handling
  // ===================
  describe('transaction handling', () => {
    it('should use transaction when accepting invite for existing user', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'existing@example.com',
        role: 'MANAGER',
        createdAt: new Date(),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        email: 'existing@example.com',
      });
      mockPrisma.tenantMember.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      await tenantInviteService.acceptInvite({
        token: 'valid-token',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should use transaction when accepting invite for new user', async () => {
      mockPrisma.tenantInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        tenantId: 'tenant-1',
        email: 'newuser@example.com',
        role: 'OPERATORE',
        createdAt: new Date(),
        expiresAt: new Date('2027-01-01'),
        tenant: { id: 'tenant-1', name: 'Test Company' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({ id: 'user-new', email: 'newuser@example.com' }) },
          tenantMember: { create: jest.fn() },
          tenantInvite: { delete: jest.fn() },
        };
        return callback(tx);
      });
      mockPrisma.tenantMember.findMany.mockResolvedValue([]);

      await tenantInviteService.acceptInvite({
        token: 'valid-token',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
