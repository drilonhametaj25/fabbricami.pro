import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { tenantService } from '../services/tenant.service';
import { tenantInviteService } from '../services/tenant-invite.service';
import {
  updateTenantSchema,
  checkSlugSchema,
  inviteUserSchema,
  inviteActionSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from '../schemas/onboarding.schema';

// ============================================
// TENANT MANAGEMENT ROUTES
// ============================================

const tenantRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // TENANT INFO ENDPOINTS
  // ============================================

  /**
   * GET /tenant
   * Get current tenant details with subscription
   */
  server.get(
    '/',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      const tenant = await tenantService.getTenantWithDetails(
        tenantRequest.tenant.tenantId
      );

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: 'Tenant non trovato',
        });
      }

      return reply.send({
        success: true,
        data: tenant,
      });
    }
  );

  /**
   * PATCH /tenant
   * Update tenant settings (admin only)
   */
  server.patch(
    '/',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const body = updateTenantSchema.body.parse(request.body);

        const tenant = await tenantService.updateTenant(
          tenantRequest.tenant.tenantId,
          body
        );

        return reply.send({
          success: true,
          data: tenant,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore aggiornamento tenant',
        });
      }
    }
  );

  /**
   * GET /tenant/check-slug/:slug
   * Check if slug is available (public)
   */
  server.get('/check-slug/:slug', async (request, reply) => {
    try {
      const { slug } = checkSlugSchema.params.parse(request.params);

      const available = await tenantService.isSlugAvailable(slug);

      return reply.send({
        success: true,
        data: { available },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore verifica slug',
      });
    }
  });

  // ============================================
  // TEAM MEMBER ENDPOINTS
  // ============================================

  /**
   * GET /tenant/members
   * List all members of current tenant
   */
  server.get(
    '/members',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      const members = await tenantService.getTenantMembers(
        tenantRequest.tenant.tenantId
      );

      return reply.send({
        success: true,
        data: members,
      });
    }
  );

  /**
   * PATCH /tenant/members/:userId
   * Update member role (admin only)
   */
  server.patch(
    '/members/:userId',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const { userId } = updateMemberRoleSchema.params.parse(request.params);
        const { role } = updateMemberRoleSchema.body.parse(request.body);

        // Prevent self-demotion
        if (userId === (request as any).user.userId && role !== 'ADMIN') {
          return reply.status(400).send({
            success: false,
            error: 'Non puoi declassare te stesso',
          });
        }

        await tenantService.updateMemberRole(
          tenantRequest.tenant.tenantId,
          userId,
          role
        );

        return reply.send({
          success: true,
          data: { message: 'Ruolo aggiornato' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore aggiornamento ruolo',
        });
      }
    }
  );

  /**
   * DELETE /tenant/members/:userId
   * Remove member from tenant (admin only)
   */
  server.delete(
    '/members/:userId',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const { userId } = removeMemberSchema.params.parse(request.params);

        // Prevent self-removal
        if (userId === (request as any).user.userId) {
          return reply.status(400).send({
            success: false,
            error: 'Non puoi rimuovere te stesso',
          });
        }

        await tenantService.removeMember(
          tenantRequest.tenant.tenantId,
          userId
        );

        return reply.send({
          success: true,
          data: { message: 'Membro rimosso' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore rimozione membro',
        });
      }
    }
  );

  // ============================================
  // INVITATION ENDPOINTS
  // ============================================

  /**
   * POST /tenant/invites
   * Create and send new invitation (admin only)
   */
  server.post(
    '/invites',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const body = inviteUserSchema.body.parse(request.body);
        const currentUser = (request as any).user;

        // Get inviter name
        const inviter = await import('../config/database').then(({ prisma }) =>
          prisma.user.findUnique({
            where: { id: currentUser.userId },
            select: { firstName: true, lastName: true },
          })
        );

        const inviterName = inviter
          ? `${inviter.firstName} ${inviter.lastName}`
          : 'Un amministratore';

        const invite = await tenantInviteService.createInvite({
          tenantId: tenantRequest.tenant.tenantId,
          email: body.email,
          role: body.role,
          inviterName,
        });

        return reply.status(201).send({
          success: true,
          data: invite,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione invito',
        });
      }
    }
  );

  /**
   * GET /tenant/invites
   * List pending invitations (admin only)
   */
  server.get(
    '/invites',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      const invites = await tenantInviteService.listPendingInvites(
        tenantRequest.tenant.tenantId
      );

      return reply.send({
        success: true,
        data: invites,
      });
    }
  );

  /**
   * DELETE /tenant/invites/:inviteId
   * Cancel invitation (admin only)
   */
  server.delete(
    '/invites/:inviteId',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const { inviteId } = inviteActionSchema.params.parse(request.params);

        await tenantInviteService.cancelInvite(
          inviteId,
          tenantRequest.tenant.tenantId
        );

        return reply.send({
          success: true,
          data: { message: 'Invito cancellato' },
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore cancellazione invito',
        });
      }
    }
  );

  /**
   * POST /tenant/invites/:inviteId/resend
   * Resend invitation email (admin only)
   */
  server.post(
    '/invites/:inviteId/resend',
    { preHandler: [authenticate, tenantMiddleware, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const { inviteId } = inviteActionSchema.params.parse(request.params);
        const currentUser = (request as any).user;

        // Get inviter name
        const inviter = await import('../config/database').then(({ prisma }) =>
          prisma.user.findUnique({
            where: { id: currentUser.userId },
            select: { firstName: true, lastName: true },
          })
        );

        const inviterName = inviter
          ? `${inviter.firstName} ${inviter.lastName}`
          : 'Un amministratore';

        const invite = await tenantInviteService.resendInvite(
          inviteId,
          tenantRequest.tenant.tenantId,
          inviterName
        );

        return reply.send({
          success: true,
          data: invite,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore reinvio invito',
        });
      }
    }
  );
};

export default tenantRoutes;
