import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { comparePassword, hashPassword, generateRandomToken } from '../utils/crypto.util';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { z } from 'zod';
import { tenantService } from '../services/tenant.service';
import { tenantInviteService } from '../services/tenant-invite.service';
import { emailService } from '../services/email.service';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  acceptInviteSchema,
} from '../schemas/onboarding.schema';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const authRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /login
   */
  server.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            subscription: {
              select: {
                status: true,
                plan: {
                  select: { code: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: 'Credenziali non valide',
      });
    }

    // Check if email is verified (optional, can be enforced)
    if (!user.emailVerified) {
      return reply.status(403).send({
        success: false,
        error: 'Email non verificata',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      return reply.status(401).send({
        success: false,
        error: 'Credenziali non valide',
      });
    }

    // Check tenant status
    if (user.tenant && user.tenant.status !== 'ACTIVE') {
      return reply.status(403).send({
        success: false,
        error: 'Account sospeso. Contatta il supporto.',
        code: 'TENANT_SUSPENDED',
      });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || undefined,
      tenantSlug: user.tenant?.slug,
      planCode: user.tenant?.subscription?.plan?.code,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Update last login and refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        refreshToken,
      },
    });

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        tenant: user.tenant ? {
          id: user.tenant.id,
          slug: user.tenant.slug,
          name: user.tenant.name,
          subscription: user.tenant.subscription ? {
            status: user.tenant.subscription.status,
            planCode: user.tenant.subscription.plan.code,
            planName: user.tenant.subscription.plan.name,
          } : null,
        } : null,
        token,
        refreshToken,
      },
    });
  });

  /**
   * POST /refresh
   */
  server.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      const newPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = generateToken(newPayload);

      return reply.send({
        success: true,
        data: { token },
      });
    } catch (_error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid refresh token',
      });
    }
  });

  /**
   * POST /logout
   */
  server.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    await prisma.user.update({
      where: { id: user.userId },
      data: { refreshToken: null },
    });

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  /**
   * GET /me
   */
  server.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            subscription: {
              select: {
                status: true,
                plan: {
                  select: { code: true, name: true },
                },
              },
            },
          },
        },
        employee: {
          select: {
            position: true,
            hourlyRate: true,
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: userData,
    });
  });

  // ============================================
  // REGISTRATION ENDPOINTS
  // ============================================

  /**
   * POST /register
   * Register a new tenant with admin user
   */
  server.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.body.parse(request.body);

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: 'Email già registrata',
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(body.password);

      // Generate email verification token
      const emailVerifyToken = generateRandomToken(64);
      const emailVerifyTokenExpires = new Date();
      emailVerifyTokenExpires.setHours(emailVerifyTokenExpires.getHours() + 24); // 24 hours

      // Create user
      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          password: hashedPassword,
          firstName: body.firstName,
          lastName: body.lastName,
          role: 'ADMIN',
          isActive: true,
          emailVerified: false,
          emailVerifyToken,
          emailVerifyTokenExpires,
        },
      });

      // Setup tenant and subscription (use plan from registration or default to PRO)
      const tenant = await tenantService.setupInitialTenant(
        user.id,
        body.companyName,
        body.plan || 'PRO'
      );

      // Send verification email (using SaaS template)
      await emailService.sendSaasVerificationEmail(
        user.email,
        emailVerifyToken,
        user.firstName
      );

      // Generate tokens (user can use the app while verifying email)
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        planCode: tenant.subscription?.planCode,
      };

      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Save refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: false,
          },
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            subscription: tenant.subscription,
          },
          token,
          refreshToken,
          message: 'Registrazione completata. Controlla la tua email per verificare l\'account.',
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante la registrazione',
      });
    }
  });

  /**
   * POST /verify-email
   * Verify email address with token
   */
  server.post('/verify-email', async (request, reply) => {
    try {
      const { token } = verifyEmailSchema.body.parse(request.body);

      const user = await prisma.user.findFirst({
        where: {
          emailVerifyToken: token,
          emailVerifyTokenExpires: { gt: new Date() },
        },
      });

      if (!user) {
        return reply.status(400).send({
          success: false,
          error: 'Token non valido o scaduto',
        });
      }

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyTokenExpires: null,
        },
      });

      // Send welcome email (using SaaS template with tenant name)
      const tenant = await prisma.tenant.findFirst({
        where: { members: { some: { userId: user.id } } },
        select: { name: true },
      });
      await emailService.sendSaasWelcomeEmail(user.email, user.firstName, tenant?.name || 'il tuo account');

      return reply.send({
        success: true,
        data: { message: 'Email verificata con successo' },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore verifica email',
      });
    }
  });

  /**
   * POST /resend-verification
   * Resend email verification link
   */
  server.post('/resend-verification', async (request, reply) => {
    try {
      const { email } = resendVerificationSchema.body.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if email exists
        return reply.send({
          success: true,
          data: { message: 'Se l\'email esiste, riceverai un link di verifica' },
        });
      }

      if (user.emailVerified) {
        return reply.status(400).send({
          success: false,
          error: 'Email già verificata',
        });
      }

      // Generate new token
      const emailVerifyToken = generateRandomToken(64);
      const emailVerifyTokenExpires = new Date();
      emailVerifyTokenExpires.setHours(emailVerifyTokenExpires.getHours() + 24);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken,
          emailVerifyTokenExpires,
        },
      });

      await emailService.sendSaasVerificationEmail(
        user.email,
        emailVerifyToken,
        user.firstName
      );

      return reply.send({
        success: true,
        data: { message: 'Email di verifica inviata' },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore invio email',
      });
    }
  });

  /**
   * POST /change-email
   * Change user email (during onboarding)
   */
  server.post('/change-email', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const currentUser = (request as any).user;
      const { newEmail } = z.object({ newEmail: z.string().email() }).parse(request.body);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Utente non trovato',
        });
      }

      // Check if email is already verified
      if (user.emailVerified) {
        return reply.status(400).send({
          success: false,
          error: 'Non puoi cambiare l\'email dopo averla verificata. Contatta il supporto.',
        });
      }

      // Check if new email is already in use
      const existingUser = await prisma.user.findUnique({
        where: { email: newEmail.toLowerCase() },
      });

      if (existingUser && existingUser.id !== user.id) {
        return reply.status(400).send({
          success: false,
          error: 'Questo indirizzo email e già in uso',
        });
      }

      // Generate new verification token
      const emailVerifyToken = generateRandomToken(64);
      const emailVerifyTokenExpires = new Date();
      emailVerifyTokenExpires.setHours(emailVerifyTokenExpires.getHours() + 24);

      // Update user with new email and verification token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: newEmail.toLowerCase(),
          emailVerifyToken,
          emailVerifyTokenExpires,
          emailVerified: false, // Reset verification status
        },
      });

      // Send verification email to new address
      await emailService.sendSaasVerificationEmail(
        newEmail,
        emailVerifyToken,
        user.firstName
      );

      return reply.send({
        success: true,
        data: { message: 'Email aggiornata. Controlla la nuova casella per verificare il tuo account.' },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore cambio email',
      });
    }
  });

  // ============================================
  // PASSWORD RESET ENDPOINTS
  // ============================================

  /**
   * POST /forgot-password
   * Request password reset
   */
  server.post('/forgot-password', async (request, reply) => {
    try {
      const { email } = passwordResetRequestSchema.body.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        return reply.send({
          success: true,
          data: { message: 'Se l\'email esiste, riceverai un link per reimpostare la password' },
        });
      }

      // Generate reset token
      const resetToken = generateRandomToken(64);
      const resetTokenExpires = new Date();
      resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });

      await emailService.sendSaasPasswordResetEmail(
        user.email,
        resetToken,
        user.firstName
      );

      return reply.send({
        success: true,
        data: { message: 'Email per reimpostare la password inviata' },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore richiesta reset password',
      });
    }
  });

  /**
   * POST /reset-password
   * Reset password with token
   */
  server.post('/reset-password', async (request, reply) => {
    try {
      const { token, newPassword } = passwordResetSchema.body.parse(request.body);

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: { gt: new Date() },
        },
      });

      if (!user) {
        return reply.status(400).send({
          success: false,
          error: 'Token non valido o scaduto',
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          refreshToken: null, // Invalidate all sessions
        },
      });

      return reply.send({
        success: true,
        data: { message: 'Password reimpostata con successo' },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore reset password',
      });
    }
  });

  // ============================================
  // TEAM INVITATION ENDPOINTS
  // ============================================

  /**
   * GET /invite/:token
   * Get invite info by token (public)
   */
  server.get('/invite/:token', async (request, reply) => {
    try {
      const { token } = request.params as { token: string };

      const invite = await tenantInviteService.getInviteByToken(token);

      if (!invite) {
        return reply.status(404).send({
          success: false,
          error: 'Invito non trovato',
        });
      }

      if (invite.isExpired) {
        return reply.status(400).send({
          success: false,
          error: 'Invito scaduto',
        });
      }

      return reply.send({
        success: true,
        data: {
          email: invite.email,
          tenantName: invite.tenantName,
          role: invite.role,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore recupero invito',
      });
    }
  });

  /**
   * POST /accept-invite
   * Accept invitation and create account
   */
  server.post('/accept-invite', async (request, reply) => {
    try {
      const body = acceptInviteSchema.body.parse(request.body);

      const result = await tenantInviteService.acceptInvite({
        token: body.token,
        firstName: body.firstName,
        lastName: body.lastName,
        password: body.password,
      });

      // Get user with tenant info
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              subscription: {
                select: {
                  status: true,
                  plan: {
                    select: { code: true, name: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new Error('Utente non trovato');
      }

      // Generate tokens
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId || undefined,
        tenantSlug: user.tenant?.slug,
        planCode: user.tenant?.subscription?.plan?.code,
      };

      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: user.emailVerified,
          },
          tenant: user.tenant ? {
            id: user.tenant.id,
            slug: user.tenant.slug,
            name: user.tenant.name,
            subscription: user.tenant.subscription ? {
              status: user.tenant.subscription.status,
              planCode: user.tenant.subscription.plan.code,
              planName: user.tenant.subscription.plan.name,
            } : null,
          } : null,
          token,
          refreshToken,
        },
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore accettazione invito',
      });
    }
  });
};

export default authRoutes;
