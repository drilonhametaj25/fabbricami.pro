import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';
import { TenantContext } from './tenant.middleware';
import { setTenantContext } from '../utils/tenant-context';
import { runSubscriptionGate, SubscriptionGateContext } from './subscription-gate';

// Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  // Multi-tenancy fields — tenantId obbligatorio per impedire token "orfani"
  // che bypassano lo scoping (vedi fix S577/S583).
  tenantId: string;
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

      // CRITICAL: il JWT è firmato e contiene già tenantId — è la
      // source-of-truth del tenant per questa request. Settiamo l'ALS
      // tenant context PRIMA di toccare Prisma, così la query
      // `user.findUnique` viene auto-filtrata per tenant_id e il middleware
      // $extends NON applica il sentinel `__NO_TENANT_CTX__` (che farebbe
      // tornare 0 e fallire l'auth). Se il JWT è stato firmato senza
      // tenantId (caso impossibile post-fix S577+generateToken throw), il
      // payload è invalid e rifiutiamo.
      if (!decoded.tenantId) {
        return reply.status(401).send({
          success: false,
          error: 'Token senza tenantId — re-login richiesto',
          code: 'TENANT_MISSING',
        });
      }

      // Pre-set: tenantStatus reale lo riassegniamo dopo il lookup DB,
      // ma intanto serve un context valido per la query di lookup.
      setTenantContext({
        tenantId: decoded.tenantId,
        tenantSlug: decoded.tenantSlug ?? '',
        tenantStatus: 'ACTIVE' as TenantContext['tenantStatus'],
      });

      // Verifica utente ancora attivo e recupera info tenant.
      // Il middleware $extends aggiungerà automaticamente tenantId=decoded.tenantId
      // al WHERE: l'user appartiene a quel tenant se e solo se trova match.
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

      // Defense in depth: il middleware $extends ha già garantito che user.tenantId
      // === decoded.tenantId, ma teniamo il check per gestire il caso edge in cui
      // user.tenantId potrebbe essere null (legacy data, schema dice `String?`).
      if (!user.tenantId || !user.tenant) {
        return reply.status(401).send({
          success: false,
          error: 'Account in stato inconsistente. Effettua il logout e contatta il supporto.',
          code: 'TENANT_MISSING',
        });
      }

      // Attach user to request
      (request as AuthenticatedRequest).user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        planCode: user.tenant.subscription?.plan?.code,
      };

      // Aggiorna il context con i valori reali dal DB (tenantStatus può cambiare,
      // es. SUSPENDED). Idempotente sul tenantId.
      const ctx: TenantContext = {
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        tenantStatus: user.tenant.status,
      };
      setTenantContext(ctx);

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
 * Generate JWT token. Throws se tenantId mancante: nessun token può essere
 * emesso senza tenant scope (defense-in-depth contro flow rotti che
 * accidentalmente generano token orfani).
 */
export function generateToken(payload: JWTPayload): string {
  if (!payload.tenantId) {
    throw new Error('[auth] generateToken: payload.tenantId obbligatorio');
  }
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Generate refresh token (stessi requisiti del token principale).
 */
export function generateRefreshToken(payload: JWTPayload): string {
  if (!payload.tenantId) {
    throw new Error('[auth] generateRefreshToken: payload.tenantId obbligatorio');
  }
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
