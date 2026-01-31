import { FastifyPluginAsync } from 'fastify';
import wishlistService from '../services/wishlist.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Wishlist Routes
 * API per gestione wishlist e-commerce (richiede autenticazione)
 */
const shopWishlistRoutes: FastifyPluginAsync = async (fastify) => {
  // Hook per verificare autenticazione
  fastify.addHook('preHandler', async (request, reply) => {
    const customerId = (request as any).user?.customerId;
    if (!customerId) {
      return errorResponse(reply, 'Autenticazione richiesta', 401);
    }
  });

  /**
   * GET /api/v1/shop/wishlist
   * Ottiene wishlist cliente
   */
  fastify.get('/', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      const items = await wishlistService.getCustomerWishlist(customerId);
      const count = items.length;

      return successResponse(reply, { items, count });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/wishlist/count
   * Ottiene conteggio items wishlist
   */
  fastify.get('/count', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      const count = await wishlistService.getCount(customerId);

      return successResponse(reply, { count });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /api/v1/shop/wishlist
   * Aggiunge prodotto alla wishlist
   */
  fastify.post<{
    Body: {
      productId: string;
      variantId?: string;
      notifyRestock?: boolean;
    };
  }>('/', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      const item = await wishlistService.addItem(customerId, request.body);

      return successResponse(reply, item, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * POST /api/v1/shop/wishlist/toggle
   * Toggle prodotto in/out dalla wishlist
   */
  fastify.post<{
    Body: {
      productId: string;
      variantId?: string;
    };
  }>('/toggle', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;
      const { productId, variantId } = request.body;

      const result = await wishlistService.toggleItem(customerId, productId, variantId);

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * GET /api/v1/shop/wishlist/check/:productId
   * Verifica se prodotto è nella wishlist
   */
  fastify.get<{
    Params: { productId: string };
    Querystring: { variantId?: string };
  }>('/check/:productId', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;
      const { productId } = request.params;
      const { variantId } = request.query;

      const inWishlist = await wishlistService.isInWishlist(customerId, productId, variantId);

      return successResponse(reply, { inWishlist });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * DELETE /api/v1/shop/wishlist/:itemId
   * Rimuove item dalla wishlist
   */
  fastify.delete<{
    Params: { itemId: string };
  }>('/:itemId', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      await wishlistService.removeItemById(customerId, request.params.itemId);

      return successResponse(reply, { removed: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * DELETE /api/v1/shop/wishlist
   * Svuota wishlist
   */
  fastify.delete('/', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      await wishlistService.clearWishlist(customerId);

      return successResponse(reply, { cleared: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * PATCH /api/v1/shop/wishlist/:itemId/notify
   * Imposta notifica restock
   */
  fastify.patch<{
    Params: { itemId: string };
    Body: { notify: boolean };
  }>('/:itemId/notify', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      const item = await wishlistService.setRestockNotification(
        customerId,
        request.params.itemId,
        request.body.notify
      );

      return successResponse(reply, item);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * POST /api/v1/shop/wishlist/move-to-cart
   * Sposta tutti gli items dalla wishlist al carrello
   */
  fastify.post<{
    Body: { cartId: string };
  }>('/move-to-cart', async (request, reply) => {
    try {
      const customerId = (request as any).user.customerId;

      const result = await wishlistService.moveAllToCart(customerId, request.body.cartId);

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });
};

export default shopWishlistRoutes;
