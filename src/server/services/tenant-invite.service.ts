import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';
import { generateRandomToken } from '../utils/crypto.util';
import { emailService } from './email.service';

// ============================================
// TYPES
// ============================================

export interface TenantInviteInfo {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  createdAt: Date;
  isExpired: boolean;
}

export interface CreateInviteData {
  tenantId: string;
  email: string;
  role: UserRole;
  inviterName: string;
}

export interface AcceptInviteData {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AcceptInviteResult {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

// ============================================
// TENANT INVITE SERVICE
// ============================================

class TenantInviteService {
  private readonly INVITE_EXPIRY_DAYS = 7;

  /**
   * Create a new invitation and send email
   */
  async createInvite(data: CreateInviteData): Promise<TenantInviteInfo> {
    // Check if email is already a member of this tenant
    const existingMember = await prisma.tenantMember.findFirst({
      where: {
        tenantId: data.tenantId,
        user: { email: data.email },
      },
    });

    if (existingMember) {
      throw new Error('Questo utente è già membro del tenant');
    }

    // Check if there's already a pending invite for this email/tenant
    const existingInvite = await prisma.tenantInvite.findFirst({
      where: {
        tenantId: data.tenantId,
        email: data.email.toLowerCase(),
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      throw new Error('Esiste già un invito pendente per questa email');
    }

    // Get tenant name for email
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant non trovato');
    }

    // Generate token and expiry date
    const token = generateRandomToken(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.INVITE_EXPIRY_DAYS);

    // Create invite
    const invite = await prisma.tenantInvite.create({
      data: {
        tenantId: data.tenantId,
        email: data.email.toLowerCase(),
        role: data.role,
        token,
        expiresAt,
      },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    // Send invitation email
    await this.sendInviteEmail({
      email: data.email,
      inviterName: data.inviterName,
      tenantName: tenant.name,
      role: data.role,
      token,
      expiresAt,
    });

    return this.formatInviteInfo(invite);
  }

  /**
   * Get invite by token
   */
  async getInviteByToken(token: string): Promise<TenantInviteInfo | null> {
    const invite = await prisma.tenantInvite.findUnique({
      where: { token },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    if (!invite) {
      return null;
    }

    return this.formatInviteInfo(invite);
  }

  /**
   * Accept an invitation - creates user and adds to tenant
   */
  async acceptInvite(data: AcceptInviteData): Promise<AcceptInviteResult> {
    const invite = await prisma.tenantInvite.findUnique({
      where: { token: data.token },
      include: {
        tenant: true,
      },
    });

    if (!invite) {
      throw new Error('Invito non trovato');
    }

    if (invite.expiresAt < new Date()) {
      throw new Error('Invito scaduto');
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      // User exists - check if already a member
      const existingMember = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: invite.tenantId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        throw new Error('Utente già membro di questo tenant');
      }

      // Add existing user to tenant
      await prisma.$transaction([
        prisma.tenantMember.create({
          data: {
            tenantId: invite.tenantId,
            userId: existingUser.id,
            role: invite.role,
            invitedAt: invite.createdAt,
            acceptedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: existingUser.id },
          data: {
            tenantId: invite.tenantId,
            role: invite.role,
          },
        }),
        prisma.tenantInvite.delete({
          where: { id: invite.id },
        }),
      ]);

      // Send notification to inviter (admin)
      await this.notifyInviteAccepted(invite.tenantId, existingUser.email, `${data.firstName} ${data.lastName}`);

      return {
        userId: existingUser.id,
        tenantId: invite.tenantId,
        email: invite.email,
        role: invite.role,
      };
    }

    // Create new user
    const { hashPassword } = await import('../utils/crypto.util');
    const hashedPassword = await hashPassword(data.password);

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: invite.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: invite.role,
          tenantId: invite.tenantId,
          isActive: true,
          emailVerified: true, // Auto-verified via invite link
        },
      });

      // Create tenant membership
      await tx.tenantMember.create({
        data: {
          tenantId: invite.tenantId,
          userId: user.id,
          role: invite.role,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      });

      // Delete the invite
      await tx.tenantInvite.delete({
        where: { id: invite.id },
      });

      return user;
    });

    // Send notification to admin
    await this.notifyInviteAccepted(invite.tenantId, result.email, `${data.firstName} ${data.lastName}`);

    return {
      userId: result.id,
      tenantId: invite.tenantId,
      email: result.email,
      role: invite.role,
    };
  }

  /**
   * Cancel/delete an invitation
   */
  async cancelInvite(inviteId: string, tenantId: string): Promise<void> {
    const invite = await prisma.tenantInvite.findFirst({
      where: {
        id: inviteId,
        tenantId,
      },
    });

    if (!invite) {
      throw new Error('Invito non trovato');
    }

    await prisma.tenantInvite.delete({
      where: { id: inviteId },
    });
  }

  /**
   * List all pending invites for a tenant
   */
  async listPendingInvites(tenantId: string): Promise<TenantInviteInfo[]> {
    const invites = await prisma.tenantInvite.findMany({
      where: { tenantId },
      include: {
        tenant: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((inv) => this.formatInviteInfo(inv));
  }

  /**
   * Resend invitation email
   */
  async resendInvite(inviteId: string, tenantId: string, inviterName: string): Promise<TenantInviteInfo> {
    const invite = await prisma.tenantInvite.findFirst({
      where: {
        id: inviteId,
        tenantId,
      },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    if (!invite) {
      throw new Error('Invito non trovato');
    }

    // Generate new token and extend expiry
    const newToken = generateRandomToken(64);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + this.INVITE_EXPIRY_DAYS);

    const updatedInvite = await prisma.tenantInvite.update({
      where: { id: inviteId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
      },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    // Send email
    await this.sendInviteEmail({
      email: updatedInvite.email,
      inviterName,
      tenantName: invite.tenant.name,
      role: updatedInvite.role,
      token: newToken,
      expiresAt: newExpiresAt,
    });

    return this.formatInviteInfo(updatedInvite);
  }

  /**
   * Cleanup expired invites (can be called from a job)
   */
  async cleanupExpiredInvites(): Promise<number> {
    const result = await prisma.tenantInvite.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Send invitation email
   */
  private async sendInviteEmail(data: {
    email: string;
    inviterName: string;
    tenantName: string;
    role: UserRole;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/accept-invite?token=${data.token}`;
    const roleName = this.getRoleDisplayName(data.role);

    const content = `
      <h2>Sei stato invitato a unirti a ${data.tenantName}</h2>
      <p>${data.inviterName} ti ha invitato a unirti al team di <strong>${data.tenantName}</strong> come <strong>${roleName}</strong>.</p>

      <p>Clicca sul pulsante qui sotto per accettare l'invito e creare il tuo account:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Accetta Invito
        </a>
      </p>

      <p><small>Questo invito scadrà il ${data.expiresAt.toLocaleDateString('it-IT')}.</small></p>
      <p><small>Se non hai richiesto questo invito, puoi ignorare questa email.</small></p>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Se il pulsante non funziona, copia e incolla questo link nel tuo browser:<br/>
        <a href="${inviteUrl}">${inviteUrl}</a>
      </p>
    `;

    await emailService.send({
      to: data.email,
      subject: `Invito a unirti a ${data.tenantName}`,
      html: content,
    });
  }

  /**
   * Notify admin that invite was accepted
   */
  private async notifyInviteAccepted(tenantId: string, newUserEmail: string, newUserName: string): Promise<void> {
    // Get tenant admins
    const admins = await prisma.tenantMember.findMany({
      where: {
        tenantId,
        role: 'ADMIN',
        acceptedAt: { not: null },
      },
      include: {
        user: {
          select: { email: true },
        },
        tenant: {
          select: { name: true },
        },
      },
    });

    if (admins.length === 0) return;

    const tenantName = admins[0].tenant.name;
    const content = `
      <h2>Nuovo membro del team</h2>
      <p><strong>${newUserName}</strong> (${newUserEmail}) ha accettato l'invito e si è unito a <strong>${tenantName}</strong>.</p>

      <p>Puoi gestire i membri del team dalla sezione Impostazioni del tuo account.</p>
    `;

    for (const admin of admins) {
      await emailService.send({
        to: admin.user.email,
        subject: `${newUserName} si è unito a ${tenantName}`,
        html: content,
      });
    }
  }

  /**
   * Format invite info
   */
  private formatInviteInfo(invite: {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    expiresAt: Date;
    createdAt: Date;
    tenant: { name: string };
  }): TenantInviteInfo {
    return {
      id: invite.id,
      tenantId: invite.tenantId,
      tenantName: invite.tenant.name,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      isExpired: invite.expiresAt < new Date(),
    };
  }

  /**
   * Get display name for role
   */
  private getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      ADMIN: 'Amministratore',
      MANAGER: 'Manager',
      CONTABILE: 'Contabile',
      MAGAZZINIERE: 'Magazziniere',
      OPERATORE: 'Operatore',
      COMMERCIALE: 'Commerciale',
      VIEWER: 'Visualizzatore',
    };
    return roleNames[role] || role;
  }
}

export const tenantInviteService = new TenantInviteService();
