import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { newsletterService } from '../services/newsletter.service';
import { successResponse, errorResponse } from '../utils/response.util';

const newsletterRoutes: FastifyPluginAsync = async (fastify) => {
  // Subscribe to newsletter
  fastify.post('/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        email: string;
        firstName?: string;
        lastName?: string;
        tags?: string[];
        preferences?: {
          promotions?: boolean;
          news?: boolean;
          newProducts?: boolean;
        };
      };

      if (!body.email) {
        return errorResponse(reply, 'Email richiesta', 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return errorResponse(reply, 'Email non valida', 400);
      }

      const result = await newsletterService.subscribe({
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        tags: body.tags,
        preferences: body.preferences,
      });

      if (result.requiresConfirmation) {
        return successResponse(reply, { requiresConfirmation: true });
      }

      return successResponse(reply, { subscribed: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Confirm subscription
  fastify.get('/confirm', async (
    request: FastifyRequest<{ Querystring: { token: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { token } = request.query;

      if (!token) {
        return errorResponse(reply, 'Token mancante', 400);
      }

      const confirmed = await newsletterService.confirmSubscription(token);

      if (!confirmed) {
        return errorResponse(reply, 'Token non valido o scaduto', 400);
      }

      return successResponse(reply, { confirmed: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Unsubscribe from newsletter
  fastify.post('/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { email: string; token?: string };

      if (!body.email) {
        return errorResponse(reply, 'Email richiesta', 400);
      }

      const unsubscribed = await newsletterService.unsubscribe(body.email, body.token);

      if (!unsubscribed) {
        return errorResponse(reply, 'Email non trovata o token non valido', 404);
      }

      return successResponse(reply, { unsubscribed: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Unsubscribe via GET (for email links)
  fastify.get('/unsubscribe', async (
    request: FastifyRequest<{ Querystring: { email: string; token: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, token } = request.query;

      if (!email || !token) {
        return errorResponse(reply, 'Email e token richiesti', 400);
      }

      const unsubscribed = await newsletterService.unsubscribe(email, token);

      if (!unsubscribed) {
        return errorResponse(reply, 'Email non trovata o token non valido', 404);
      }

      return successResponse(reply, { unsubscribed: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Update subscription preferences
  fastify.patch('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        email: string;
        preferences: {
          promotions?: boolean;
          news?: boolean;
          newProducts?: boolean;
        };
      };

      if (!body.email) {
        return errorResponse(reply, 'Email richiesta', 400);
      }

      const updated = await newsletterService.updatePreferences(body.email, body.preferences);

      if (!updated) {
        return errorResponse(reply, 'Iscrizione non trovata o non confermata', 404);
      }

      return successResponse(reply, { updated: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get subscription status
  fastify.get('/status', async (
    request: FastifyRequest<{ Querystring: { email: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { email } = request.query;

      if (!email) {
        return errorResponse(reply, 'Email richiesta', 400);
      }

      const status = await newsletterService.getSubscriptionStatus(email);

      if (!status) {
        return successResponse(reply, { subscribed: false });
      }

      return successResponse(reply, status);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get newsletter stats (admin only)
  fastify.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Add admin auth check here
      const stats = await newsletterService.getStats();
      return successResponse(reply, stats);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Export subscribers (admin only)
  fastify.get('/export', async (
    request: FastifyRequest<{
      Querystring: {
        status?: 'CONFIRMED' | 'PENDING' | 'UNSUBSCRIBED';
        tags?: string;
        fromDate?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      // TODO: Add admin auth check here
      const { status, tags, fromDate } = request.query;

      const subscribers = await newsletterService.exportSubscribers({
        status,
        tags: tags ? tags.split(',') : undefined,
        fromDate: fromDate ? new Date(fromDate) : undefined,
      });

      return successResponse(reply, subscribers);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });
};

export default newsletterRoutes;
