import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';
import { tenantContext, TenantContext } from './tenant.middleware';
import { runSubscriptionGate, SubscriptionGateContext } from './subscription-gate';

// Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  // Multi-tenancy fields
  tenantId?: string;
  tenantSlug?: string;
  planCode?: string; // STARTER, PRO, BUSINESS
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

/**
 * Middleware autenticazione JWT
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      // Verifica utente ancora attivo e recupera info tenant
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          tenantId: true,
          tenant: {
            select: {
              slug: true,
              status: true,
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

      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: 'User not found or inactive',
        });
      }

      // Attach user to request (con info tenant se disponibile)
      (request as AuthenticatedRequest).user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId || undefined,
        tenantSlug: user.tenant?.slug,
        planCode: user.tenant?.subscription?.plan?.code,
      };

      // CRITICAL: imposta il tenant context tramite AsyncLocalStorage
      // così il Prisma middleware può auto-filtrare per tenantId
      // su TUTTE le route protette, anche senza tenantMiddleware esplicito.
      if (user.tenantId && user.tenant) {
        const ctx: TenantContext = {
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          tenantStatus: user.tenant.status,
        };
        tenantContext.enterWith(ctx);

        // SUBSCRIPTION GATE — applied to all authenticated routes.
        // Bypass paths (auth/billing/onboarding/tickets/...) keep working
        // even when the subscription is past_due/cancelled/expired.
        const gate = await runSubscriptionGate(request, reply, user.tenantId);
        if (gate.blocked) {
          // The gate already sent the 402 reply
          return;
        }
        if (gate.subscription) {
          (request as AuthenticatedRequest & {
            subscription: SubscriptionGateContext;
          }).subscription = gate.subscription;
        }
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return reply.status(401).send({
          success: false,
          error: 'Token expired',
        });
      }

      return reply.status(401).send({
        success: false,
        error: 'Invalid token',
      });
    }
  } catch (_error) {
    return reply.status(500).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Middleware autorizzazione basata su ruolo
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!allowedRoles.includes(authRequest.user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
      });
    }
  };
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
}
