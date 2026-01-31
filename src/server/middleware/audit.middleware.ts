import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

/**
 * Middleware per audit logging
 */
export async function auditLog(action: string, entity: string) {
  return async (request: FastifyRequest, _reply: FastifyReply, done: () => void): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    // Solo se l'utente è autenticato
    if (authRequest.user) {
      // Get entity ID from params or body
      const entityId =
        (request.params as Record<string, string>)?.id ||
        (request.body as Record<string, unknown>)?.id?.toString() ||
        'unknown';

      // Log dopo la risposta per catturare eventuali modifiche
      void (async () => {
        try {
          await prisma.auditLog.create({
            data: {
              userId: authRequest.user.userId,
              action,
              entity,
              entityId,
              changes: request.body || {},
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'] || null,
            },
          });
        } catch (error) {
          // Non bloccare la request se l'audit log fallisce
          console.error('Audit log failed:', error);
        }
      })();
    }

    done();
  };
}
