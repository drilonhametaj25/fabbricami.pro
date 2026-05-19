import { prisma } from '../config/database';
import { TenantStatus, UserRole } from '@prisma/client';
import { subscriptionService } from './subscription.service';

// ============================================
// TYPES
// ============================================

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
  status: TenantStatus;
  createdAt: Date;
}

export interface TenantWithSubscription extends TenantInfo {
  subscription: {
    planCode: string;
    planName: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date;
  } | null;
  memberCount: number;
}

export interface CreateTenantData {
  name: string;
  slug: string;
  domain?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateTenantData {
  name?: string;
  domain?: string | null;
  settings?: Record<string, unknown>;
  status?: TenantStatus;
}

export interface TenantMemberInfo {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  invitedAt: Date;
  acceptedAt: Date | null;
}

// ============================================
// TENANT SERVICE
// ============================================

class TenantService {
  /**
   * Create a new tenant
   */
  async createTenant(data: CreateTenantData): Promise<TenantInfo> {
    // Verify slug is available
    const existing = await prisma.tenant.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new Error('Slug già in uso');
    }

    // Verify domain is available if provided
    if (data.domain) {
      const existingDomain = await prisma.tenant.findUnique({
        where: { domain: data.domain },
      });
      if (existingDomain) {
        throw new Error('Dominio già in uso');
      }
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug: this.sanitizeSlug(data.slug),
        domain: data.domain || null,
        settings: (data.settings || {}) as any,
        status: 'ACTIVE',
      },
    });

    return this.formatTenantInfo(tenant);
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<TenantInfo | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return tenant ? this.formatTenantInfo(tenant) : null;
  }

  /**
   * Get tenant with subscription and member count
   */
  async getTenantWithDetails(tenantId: string): Promise<TenantWithSubscription | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        members: {
          where: { acceptedAt: { not: null } },
        },
      },
    });

    if (!tenant) {
      return null;
    }

    return {
      ...this.formatTenantInfo(tenant),
      subscription: tenant.subscription ? {
        planCode: tenant.subscription.plan.code,
        planName: tenant.subscription.plan.name,
        status: tenant.subscription.status,
        trialEndsAt: tenant.subscription.trialEndsAt,
        currentPeriodEnd: tenant.subscription.currentPeriodEnd,
      } : null,
      memberCount: tenant.members.length,
    };
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<TenantInfo | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    return tenant ? this.formatTenantInfo(tenant) : null;
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: UpdateTenantData): Promise<TenantInfo> {
    // Verify domain is available if being changed
    if (data.domain) {
      const existingDomain = await prisma.tenant.findFirst({
        where: {
          domain: data.domain,
          id: { not: tenantId },
        },
      });
      if (existingDomain) {
        throw new Error('Dominio già in uso');
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.domain !== undefined && { domain: data.domain || null }),
        ...(data.settings && { settings: data.settings as any }),
        ...(data.status && { status: data.status }),
      },
    });

    return this.formatTenantInfo(tenant);
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string): Promise<boolean> {
    const sanitized = this.sanitizeSlug(slug);

    // Check reserved slugs
    const reserved = ['app', 'api', 'admin', 'www', 'mail', 'support', 'help', 'docs', 'blog'];
    if (reserved.includes(sanitized)) {
      return false;
    }

    const existing = await prisma.tenant.findUnique({
      where: { slug: sanitized },
    });

    return !existing;
  }

  /**
   * Setup initial tenant for a new user registration
   * Creates tenant, adds user as admin member, creates trial subscription
   */
  async setupInitialTenant(
    userId: string,
    tenantName: string,
    planCode: string = 'PRO',
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<TenantWithSubscription> {
    // Generate unique slug from tenant name
    const baseSlug = this.sanitizeSlug(tenantName);
    let slug = baseSlug;
    let attempt = 0;

    while (!(await this.isSlugAvailable(slug))) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        status: 'ACTIVE',
        settings: {},
      },
    });

    // Add user as admin member
    await prisma.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId,
        role: 'ADMIN',
        invitedAt: new Date(),
        acceptedAt: new Date(), // Auto-accepted for creator
      },
    });

    // Update user's tenantId
    await prisma.user.update({
      where: { id: userId },
      data: { tenantId: tenant.id },
    });

    // Create trial subscription
    await subscriptionService.createTrialSubscription(tenant.id, planCode, billingCycle);

    // Return full tenant details
    return this.getTenantWithDetails(tenant.id) as Promise<TenantWithSubscription>;
  }

  /**
   * Get all members of a tenant
   */
  async getTenantMembers(tenantId: string): Promise<TenantMemberInfo[]> {
    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
    }));
  }

  /**
   * Update member role
   */
  async updateMemberRole(tenantId: string, userId: string, newRole: UserRole): Promise<void> {
    // Check that there's at least one other admin if demoting an admin
    const member = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (!member) {
      throw new Error('Membro non trovato');
    }

    if (member.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.tenantMember.count({
        where: {
          tenantId,
          role: 'ADMIN',
          acceptedAt: { not: null },
        },
      });

      if (adminCount <= 1) {
        throw new Error('Deve esserci almeno un amministratore');
      }
    }

    await prisma.tenantMember.update({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      data: { role: newRole },
    });

    // Also update User role
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
  }

  /**
   * Remove member from tenant
   */
  async removeMember(tenantId: string, userId: string): Promise<void> {
    const member = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (!member) {
      throw new Error('Membro non trovato');
    }

    // Cannot remove last admin
    if (member.role === 'ADMIN') {
      const adminCount = await prisma.tenantMember.count({
        where: {
          tenantId,
          role: 'ADMIN',
          acceptedAt: { not: null },
        },
      });

      if (adminCount <= 1) {
        throw new Error('Impossibile rimuovere l\'ultimo amministratore');
      }
    }

    // Remove membership
    await prisma.tenantMember.delete({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    // Clear user's tenantId
    await prisma.user.update({
      where: { id: userId },
      data: { tenantId: null },
    });
  }

  /**
   * Sanitize slug for subdomain use
   */
  private sanitizeSlug(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Format tenant info
   */
  private formatTenantInfo(tenant: {
    id: string;
    slug: string;
    name: string;
    domain: string | null;
    settings: unknown;
    status: TenantStatus;
    createdAt: Date;
  }): TenantInfo {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain,
      settings: tenant.settings as Record<string, unknown> | null,
      status: tenant.status,
      createdAt: tenant.createdAt,
    };
  }
}

export const tenantService = new TenantService();
