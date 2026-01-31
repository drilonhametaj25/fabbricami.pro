import { FastifyPluginAsync } from 'fastify';
import reviewService from '../services/review.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Reviews Routes
 * API per recensioni prodotto e-commerce
 */
const shopReviewsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/shop/reviews/product/:productId
   * Ottiene recensioni pubbliche per prodotto
   */
  fastify.get<{
    Params: { productId: string };
    Querystring: { page?: number; limit?: number };
  }>('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params;
      const { page = 1, limit = 10 } = request.query;

      const result = await reviewService.getProductReviews(productId, page, limit);

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/reviews/product/:productId/stats
   * Ottiene statistiche recensioni prodotto
   */
  fastify.get<{
    Params: { productId: string };
  }>('/product/:productId/stats', async (request, reply) => {
    try {
      const stats = await reviewService.getProductStats(request.params.productId);

      return successResponse(reply, stats);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /api/v1/shop/reviews
   * Crea nuova recensione (richiede autenticazione)
   */
  fastify.post<{
    Body: {
      productId: string;
      orderId?: string;
      orderItemId?: string;
      rating: number;
      title?: string;
      comment?: string;
      pros?: string[];
      cons?: string[];
    };
  }>('/', async (request, reply) => {
    try {
      const customerId = (request as any).user?.customerId;

      if (!customerId) {
        return errorResponse(reply, 'Autenticazione richiesta', 401);
      }

      const review = await reviewService.create({
        ...request.body,
        customerId,
      });

      return successResponse(reply, review, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * PUT /api/v1/shop/reviews/:id
   * Aggiorna propria recensione
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      rating?: number;
      title?: string;
      comment?: string;
      pros?: string[];
      cons?: string[];
    };
  }>('/:id', async (request, reply) => {
    try {
      const customerId = (request as any).user?.customerId;

      if (!customerId) {
        return errorResponse(reply, 'Autenticazione richiesta', 401);
      }

      const review = await reviewService.update(
        request.params.id,
        customerId,
        request.body
      );

      return successResponse(reply, review);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * DELETE /api/v1/shop/reviews/:id
   * Elimina propria recensione
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      const customerId = (request as any).user?.customerId;

      if (!customerId) {
        return errorResponse(reply, 'Autenticazione richiesta', 401);
      }

      await reviewService.delete(request.params.id, customerId);

      return successResponse(reply, { deleted: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * POST /api/v1/shop/reviews/:id/helpful
   * Marca recensione come utile
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/helpful', async (request, reply) => {
    try {
      await reviewService.markHelpful(request.params.id);

      return successResponse(reply, { marked: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * POST /api/v1/shop/reviews/:id/report
   * Segnala recensione
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/report', async (request, reply) => {
    try {
      await reviewService.report(request.params.id);

      return successResponse(reply, { reported: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * GET /api/v1/shop/reviews/my
   * Ottiene proprie recensioni
   */
  fastify.get('/my', async (request, reply) => {
    try {
      const customerId = (request as any).user?.customerId;

      if (!customerId) {
        return errorResponse(reply, 'Autenticazione richiesta', 401);
      }

      const result = await reviewService.list({
        customerId,
        page: 1,
        limit: 50,
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });
};

export default shopReviewsRoutes;
