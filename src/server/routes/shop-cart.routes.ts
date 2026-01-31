import { FastifyPluginAsync } from 'fastify';
import cartService from '../services/cart.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Cart Routes
 * API pubbliche per gestione carrello e-commerce
 */
const shopCartRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================
  // CART OPERATIONS
  // ==================

  /**
   * GET /api/v1/shop/cart
   * Ottiene carrello corrente (da session o customer)
   */
  fastify.get('/', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.getOrCreateCart(sessionId, customerId);

      return successResponse(reply, cart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * POST /api/v1/shop/cart/items
   * Aggiunge prodotto al carrello
   */
  fastify.post<{
    Body: {
      productId: string;
      variantId?: string;
      quantity: number;
    };
  }>('/items', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      // Ottiene o crea carrello
      let cart = await cartService.getOrCreateCart(sessionId, customerId);

      // Aggiunge item
      cart = await cartService.addItem(cart.id, request.body);

      return successResponse(reply, cart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * PATCH /api/v1/shop/cart/items/:itemId
   * Aggiorna quantità item
   */
  fastify.patch<{
    Params: { itemId: string };
    Body: { quantity: number };
  }>('/items/:itemId', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.updateItemQuantity(
        cart.id,
        request.params.itemId,
        request.body
      );

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * DELETE /api/v1/shop/cart/items/:itemId
   * Rimuove item dal carrello
   */
  fastify.delete<{
    Params: { itemId: string };
  }>('/items/:itemId', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.removeItem(cart.id, request.params.itemId);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * DELETE /api/v1/shop/cart
   * Svuota carrello
   */
  fastify.delete('/', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.clearCart(cart.id);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // ==================
  // COUPON
  // ==================

  /**
   * POST /api/v1/shop/cart/coupon
   * Applica coupon al carrello
   */
  fastify.post<{
    Body: { code: string };
  }>('/coupon', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.applyCoupon(cart.id, request.body.code);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * DELETE /api/v1/shop/cart/coupon
   * Rimuove coupon dal carrello
   */
  fastify.delete('/coupon', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.removeCoupon(cart.id);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // ==================
  // SHIPPING
  // ==================

  /**
   * PUT /api/v1/shop/cart/shipping-address
   * Imposta indirizzo spedizione
   */
  fastify.put<{
    Body: {
      firstName: string;
      lastName: string;
      company?: string;
      address1: string;
      address2?: string;
      city: string;
      state?: string;
      postcode: string;
      country: string;
      phone?: string;
    };
  }>('/shipping-address', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.setShippingAddress(cart.id, request.body);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * PUT /api/v1/shop/cart/shipping-method
   * Seleziona metodo spedizione
   */
  fastify.put<{
    Body: { methodId: string };
  }>('/shipping-method', async (request, reply) => {
    try {
      const sessionId = request.headers['x-session-id'] as string;
      const customerId = (request as any).user?.customerId;

      const cart = await cartService.findCart(sessionId, customerId);
      if (!cart) {
        return errorResponse(reply, 'Carrello non trovato', 404);
      }

      const updatedCart = await cartService.setShippingMethod(cart.id, request.body.methodId);

      return successResponse(reply, updatedCart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // ==================
  // MERGE
  // ==================

  /**
   * POST /api/v1/shop/cart/merge
   * Unisce carrello guest con carrello cliente (dopo login)
   */
  fastify.post<{
    Body: { sessionId: string };
  }>('/merge', async (request, reply) => {
    try {
      const customerId = (request as any).user?.customerId;

      if (!customerId) {
        return errorResponse(reply, 'Autenticazione richiesta', 401);
      }

      const cart = await cartService.mergeGuestCart(request.body.sessionId, customerId);

      return successResponse(reply, cart);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });
};

export default shopCartRoutes;
