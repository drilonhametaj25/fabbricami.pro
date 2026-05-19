import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { comparePassword, hashPassword, generateRandomToken } from '../utils/crypto.util';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { z } from 'zod';
import { tenantService } from '../services/tenant.service';
import { tenantInviteService } from '../services/tenant-invite.service';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
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
   * Stricter rate limit (10 attempts / 5 minutes per IP) to slow down
   * credential-stuffing and brute-force attacks. The global rate-limit
   * (100/min) is too generous for an auth endpoint.
   */
  server.post(
    '/login',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '5 minutes' },
      },
    },
    async (request, reply) => {
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

    // Difesa in profondità: un utente verificato deve sempre avere un tenant
    // associato. Se manca, è uno stato corrotto: non emettiamo un JWT senza
    // tenantId (porterebbe il middleware a fallback potenzialmente insicuri).
    if (!user.tenantId || !user.tenant) {
      return reply.status(500).send({
        success: false,
        error: 'Account in stato inconsistente. Contatta il supporto.',
        code: 'TENANT_MISSING',
      });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      planCode: user.tenant.subscription?.plan?.code,
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
        include: {
          tenant: {
            select: {
              slug: true,
              subscription: {
                select: {
                  plan: {
                    select: { code: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      if (!user.tenantId || !user.tenant) {
        return reply.status(500).send({
          success: false,
          error: 'Account in stato inconsistente. Contatta il supporto.',
          code: 'TENANT_MISSING',
        });
      }

      const newPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        planCode: user.tenant.subscription?.plan?.code,
      };

      const token = generateToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      // Ruota il refresh token nel database
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return reply.send({
        success: true,
        data: { token, refreshToken: newRefreshToken },
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

    // Shape della response: { user, tenant } — il client (auth.store.ts)
    // si aspetta data.user e data.tenant separati, non i campi flat.
    return reply.send({
      success: true,
      data: {
        user: userData
          ? {
              id: userData.id,
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
              emailVerified: userData.emailVerified,
              tenantId: userData.tenantId,
              employee: userData.employee,
            }
          : null,
        tenant: userData?.tenant
          ? {
              id: userData.tenant.id,
              slug: userData.tenant.slug,
              name: userData.tenant.name,
              status: 'ACTIVE' as const,
              subscription: userData.tenant.subscription
                ? {
                    status: userData.tenant.subscription.status,
                    planCode: userData.tenant.subscription.plan?.code,
                    planName: userData.tenant.subscription.plan?.name,
                  }
                : null,
            }
          : null,
      },
    });
  });

  /**
   * PATCH /me — aggiorna profilo utente
   */
  server.patch('/me', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const user = request.user;
      const body = z
        .object({
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
        })
        .parse(request.body);

      const updated = await prisma.user.update({
        where: { id: user.userId },
        data: body,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      return reply.send({ success: true, data: updated });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /change-password — cambio password utente loggato
   */
  server.post('/change-password', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const user = request.user;
      const body = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z
            .string()
            .min(8)
            .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
            .regex(/[a-z]/, 'Almeno una lettera minuscola')
            .regex(/[0-9]/, 'Almeno un numero'),
        })
        .parse(request.body);

      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser) {
        return reply.status(404).send({ success: false, error: 'Utente non trovato' });
      }

      const valid = await comparePassword(body.currentPassword, dbUser.password);
      if (!valid) {
        return reply.status(400).send({ success: false, error: 'Password attuale non corretta' });
      }

      const newHash = await hashPassword(body.newPassword);
      await prisma.user.update({
        where: { id: user.userId },
        data: { password: newHash },
      });

      return reply.send({ success: true, message: 'Password aggiornata' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // REGISTRATION ENDPOINTS
  // ============================================

  /**
   * POST /register
   * Register a new tenant with admin user.
   * Tighter rate limit (5 attempts / 10 minutes per IP) to prevent spam signups
   * and email-verification abuse.
   */
  server.post(
    '/register',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '10 minutes' },
      },
    },
    async (request, reply) => {
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

      // Creiamo user + tenant + membership + trial in UN'UNICA transazione.
      // Se setupInitialTenant fallisce, anche l'user viene rollbackato, evitando
      // l'orphan state user.tenantId = null (causa diretta del data leak: senza
      // tenantId, l'authenticate middleware non setta il tenantContext e il
      // Prisma middleware non filtra le query).
      const { user, tenant } = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
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

        const newTenant = await tenantService.setupInitialTenant(
          newUser.id,
          body.companyName,
          body.plan || 'PRO',
          body.billingCycle || 'monthly',
          tx
        );

        return { user: newUser, tenant: newTenant };
      });

      // Send verification email (using SaaS template)
      await emailService.sendSaasVerificationEmail(
        user.email,
        emailVerifyToken,
        user.firstName
      );

      // SECURITY: NON emettiamo token JWT/refreshToken qui. L'utente DEVE verificare
      // l'email prima di poter accedere. Questo previene account spam e bypass della
      // verifica email tramite il token rilasciato a /register.
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
          requiresEmailVerification: true,
          message: 'Registrazione completata. Controlla la tua email per verificare l\'account prima di accedere.',
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante la registrazione',
      });
    }
  });

  /**
   * POST /verify-email
   * Verify email address with token, then issue JWT so user goes straight to onboarding
   */
  server.post('/verify-email', async (request, reply) => {
    try {
      const { token } = verifyEmailSchema.body.parse(request.body);

      const user = await prisma.user.findFirst({
        where: {
          emailVerifyToken: token,
          emailVerifyTokenExpires: { gt: new Date() },
        },
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
                  plan: { select: { code: true, name: true } },
                },
              },
            },
          },
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
      await emailService.sendSaasWelcomeEmail(
        user.email,
        user.firstName,
        user.tenant?.name || 'il tuo account'
      );

      // Issue JWT now that the email is verified — user can proceed straight
      // into onboarding without a separate login step.
      if (!user.tenantId || !user.tenant) {
        return reply.status(500).send({
          success: false,
          error: 'Account in stato inconsistente. Contatta il supporto.',
          code: 'TENANT_MISSING',
        });
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        planCode: user.tenant.subscription?.plan?.code,
      };
      const jwtToken = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

      return reply.send({
        success: true,
        data: {
          message: 'Email verificata con successo',
          token: jwtToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: true,
          },
          tenant: user.tenant
            ? {
                id: user.tenant.id,
                slug: user.tenant.slug,
                name: user.tenant.name,
                status: user.tenant.status,
                subscription: user.tenant.subscription,
              }
            : null,
        },
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
   * Resend email verification link.
   * Tight rate limit (3 / 10min) to prevent email-spam abuse via this endpoint.
   */
  server.post(
    '/resend-verification',
    {
      config: {
        rateLimit: { max: 3, timeWindow: '10 minutes' },
      },
    },
    async (request, reply) => {
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

      // Generate tokens — un utente invitato e accettato deve avere un tenant
      if (!user.tenantId || !user.tenant) {
        return reply.status(500).send({
          success: false,
          error: 'Account in stato inconsistente. Contatta il supporto.',
          code: 'TENANT_MISSING',
        });
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        planCode: user.tenant.subscription?.plan?.code,
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
          } : null,
          accessToken: token,
          refreshToken,
        },
      });
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : "Errore" });
    }
  });
};

export default authRoutes;