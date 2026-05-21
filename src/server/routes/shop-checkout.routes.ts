import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { shopCheckoutService, CheckoutData } from '../services/shop-checkout.service';
import { stripeService } from '../services/stripe.service';
import { paypalService } from '../services/paypal.service';
import { shopAuthService, CustomerTokenPayload } from '../services/shop-auth.service';
import { successResponse, errorResponse } from '../utils/response.util';
import { validate } from '../middleware/validation.middleware';
import {
  createCheckoutOrderSchema,
  stripeCreateSessionSchema,
  stripeCreateIntentSchema,
  stripeVerifySessionSchema,
  paypalCreateOrderSchema,
  paypalCaptureSchema,
  getOrderSchema,
  trackOrderSchema,
  shippingMethodsSchema,
  validateCouponSchema,
} from '../schemas/shop-checkout.schema';
import { ShopShippingMethod } from '@prisma/client';
import { prisma } from '../config/database';
import { shopTenantMiddleware } from '../middleware/shop-tenant.middleware';

// Extend FastifyRequest to include customer
declare module 'fastify' {
  interface FastifyRequest {
    customer?: CustomerTokenPayload;
  }
}

// Optional auth middleware - sets customer if token present but doesn't require it
async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = shopAuthService.verifyToken(token);
      if (payload.type === 'customer') {
        request.customer = payload;
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
}

const shopCheckoutRoutes: FastifyPluginAsync = async (fastify) => {
  // Tenant resolution MUST precede any DB access (Customer/Order lookup, ecc.).
  fastify.addHook('preHandler', shopTenantMiddleware);
  // Apply optional auth to all routes
  fastify.addHook('preHandler', optionalAuthMiddleware);

  // Get payment configuration (public keys for frontend)
  fastify.get('/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return successResponse(reply, {
        stripe: {
          enabled: stripeService.isConfigured(),
          publishableKey: stripeService.getPublishableKey(),
        },
        paypal: {
          enabled: paypalService.isConfigured(),
          clientId: paypalService.getClientId(),
        },
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  // Create order from checkout
  fastify.post('/create-order', { preHandler: [validate(createCheckoutOrderSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as CheckoutData;

      // Add customerId if logged in
      if (request.customer) {
        body.customerId = request.customer.id;
      }

      const result = await shopCheckoutService.createOrder(body);

      return successResponse(reply, result, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Create Stripe checkout session for an order
  fastify.post('/stripe/create-session', { preHandler: [validate(stripeCreateSessionSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { orderId: string };

      // Get order details
      const order = await shopCheckoutService.getOrder(body.orderId);
      if (!order) {
        return errorResponse(reply, 'Ordine non trovato', 404);
      }

      // Check if already paid
      if (order.paidAt) {
        return errorResponse(reply, 'Ordine già pagato', 400);
      }

      // Prepare line items for Stripe
      const lineItems = order.items.map((item: any) => ({
        name: item.productName,
        description: item.variantName || undefined,
        amount: Math.round(Number(item.unitPrice) * 100), // Convert to cents
        quantity: item.quantity,
        imageUrl: item.product?.images?.[0],
      }));

      // Create Stripe checkout session
      const session = await stripeService.createCheckoutSession({
        orderId: order.id,
        customerEmail: order.customer?.email || body.orderId,
        lineItems,
        shippingAmount: Math.round(Number(order.shippingAmount) * 100),
        metadata: {
          orderNumber: order.orderNumber,
        },
      });

      return successResponse(reply, {
        sessionId: session.sessionId,
        url: session.url,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Create Stripe payment intent for Elements integration
  fastify.post('/stripe/create-intent', { preHandler: [validate(stripeCreateIntentSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { orderId: string };

      const order = await shopCheckoutService.getOrder(body.orderId);
      if (!order) {
        return errorResponse(reply, 'Ordine non trovato', 404);
      }

      if (order.paidAt) {
        return errorResponse(reply, 'Ordine già pagato', 400);
      }

      const intent = await stripeService.createPaymentIntent({
        orderId: order.id,
        amount: Math.round(Number(order.total) * 100),
        currency: order.currency || 'EUR',
        customerEmail: order.customer?.email,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });

      return successResponse(reply, {
        clientSecret: intent.clientSecret,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Verify Stripe checkout session
  fastify.get('/stripe/verify-session/:sessionId', { preHandler: [validate(stripeVerifySessionSchema)] }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { sessionId } = request.params as { sessionId: string };

      const session = await stripeService.getCheckoutSession(sessionId);
      if (!session) {
        return errorResponse(reply, 'Sessione non trovata', 404);
      }

      return successResponse(reply, {
        status: session.payment_status,
        orderId: session.metadata?.orderId,
        customerEmail: session.customer_email,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Stripe webhook
  fastify.post('/stripe/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        console.warn('Stripe webhook: missing signature header');
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      // Get raw body (preserved by custom content type parser in index.ts)
      const rawBody = (request as any).rawBody;

      if (!rawBody) {
        console.error('Stripe webhook: rawBody not available - check server configuration');
        return reply.code(500).send({ error: 'Server configuration error: rawBody not available' });
      }

      const event = stripeService.constructWebhookEvent(rawBody, signature);

      // Process webhook async to return 200 quickly
      // This prevents Stripe from retrying due to timeout
      stripeService.handleWebhook(event).catch((err) => {
        console.error('Stripe webhook processing error:', err);
      });

      // Always return 200 for valid signature (Stripe best practice)
      return reply.code(200).send({ received: true });
    } catch (error: any) {
      // Check if it's a signature verification error
      if (error.type === 'StripeSignatureVerificationError') {
        console.warn('Stripe webhook: invalid signature');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      // For other errors, log and return 500 so Stripe retries
      console.error('Stripe webhook error:', error.message);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create PayPal order
  fastify.post('/paypal/create-order', { preHandler: [validate(paypalCreateOrderSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { orderId: string };

      const order = await shopCheckoutService.getOrder(body.orderId);
      if (!order) {
        return errorResponse(reply, 'Ordine non trovato', 404);
      }

      if (order.paidAt) {
        return errorResponse(reply, 'Ordine già pagato', 400);
      }

      // Prepare items for PayPal
      const items = order.items.map((item: any) => ({
        name: item.productName,
        quantity: item.quantity,
        unitAmount: Number(item.unitPrice),
        sku: item.sku,
      }));

      const paypalOrder = await paypalService.createOrder({
        orderId: order.id,
        amount: Number(order.total),
        currency: order.currency || 'EUR',
        description: `Ordine ${order.orderNumber}`,
        items,
        shippingAmount: Number(order.shippingAmount),
      });

      return successResponse(reply, {
        paypalOrderId: paypalOrder.paypalOrderId,
        approvalUrl: paypalOrder.approvalUrl,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Capture PayPal order
  fastify.post('/paypal/capture', { preHandler: [validate(paypalCaptureSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { paypalOrderId: string };

      const result = await paypalService.captureOrder(body.paypalOrderId);

      return successResponse(reply, {
        captureId: result.captureId,
        status: result.status,
        amount: result.amount,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // PayPal webhook
  fastify.post('/paypal/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = JSON.stringify(request.body);
      const headers = request.headers as Record<string, string>;

      // Verify webhook signature
      const isValid = await paypalService.verifyWebhookSignature(body, headers);
      if (!isValid) {
        return errorResponse(reply, 'Firma webhook non valida', 400);
      }

      await paypalService.handleWebhook(request.body);

      return reply.send({ received: true });
    } catch (error: any) {
      console.error('PayPal webhook error:', error.message);
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get order by ID or order number
  fastify.get('/orders/:identifier', { preHandler: [validate(getOrderSchema)] }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { identifier } = request.params as { identifier: string };
      const order = await shopCheckoutService.getOrder(identifier);

      if (!order) {
        return errorResponse(reply, 'Ordine non trovato', 404);
      }

      // Only allow access to own orders if logged in
      if (request.customer && order.customerId !== request.customer.id) {
        return errorResponse(reply, 'Accesso non autorizzato', 403);
      }

      return successResponse(reply, order);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Track order by order number and email
  fastify.post('/track', { preHandler: [validate(trackOrderSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { orderNumber: string; email?: string };

      const trackingInfo = await shopCheckoutService.trackOrder(body.orderNumber, body.email);

      if (!trackingInfo) {
        return errorResponse(reply, 'Ordine non trovato', 404);
      }

      return successResponse(reply, trackingInfo);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get available shipping methods for address
  fastify.post('/shipping/methods', { preHandler: [validate(shippingMethodsSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { country: string; postalCode?: string; cartTotal?: number };

      // Find shipping zone for country
      const zone = await prisma.shopShippingZone.findFirst({
        where: {
          countries: {
            array_contains: [body.country],
          },
        },
        include: {
          methods: {
            where: { isActive: true },
            orderBy: { baseCost: 'asc' },
          },
        },
      });

      if (!zone) {
        // Return default international shipping
        const defaultZone = await prisma.shopShippingZone.findFirst({
          where: { name: 'Resto del Mondo' },
          include: {
            methods: {
              where: { isActive: true },
            },
          },
        });

        if (!defaultZone) {
          return errorResponse(reply, 'Spedizione non disponibile per questa destinazione', 400);
        }

        return successResponse(reply, {
          zone: defaultZone.name,
          methods: defaultZone.methods.map((m: ShopShippingMethod) => ({
            id: m.id,
            name: m.name,
            carrier: m.carrier,
            cost: Number(m.baseCost),
            estimatedDays: m.estimatedDaysMin,
            isFree: body.cartTotal && m.freeAboveAmount && body.cartTotal >= Number(m.freeAboveAmount),
          })),
        });
      }

      return successResponse(reply, {
        zone: zone.name,
        methods: zone.methods.map((m: ShopShippingMethod) => ({
          id: m.id,
          name: m.name,
          carrier: m.carrier,
          cost: Number(m.baseCost),
          estimatedDays: m.estimatedDaysMin,
          isFree: body.cartTotal && m.freeAboveAmount && body.cartTotal >= Number(m.freeAboveAmount),
        })),
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Validate coupon
  fastify.post('/coupon/validate', { preHandler: [validate(validateCouponSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { code: string; cartTotal: number };

      const coupon = await prisma.coupon.findUnique({
        where: { code: body.code.toUpperCase() },
      });

      if (!coupon) {
        return errorResponse(reply, 'Coupon non trovato', 404);
      }

      // Check if active
      if (!coupon.isActive) {
        return errorResponse(reply, 'Coupon non attivo', 400);
      }

      // Check validity dates
      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validTo) {
        return errorResponse(reply, 'Coupon scaduto o non ancora valido', 400);
      }

      // Check usage limit
      if (coupon.maxUses && coupon.usageCount >= coupon.maxUses) {
        return errorResponse(reply, 'Coupon esaurito', 400);
      }

      // Check minimum order amount
      if (coupon.minimumOrderAmount && body.cartTotal < Number(coupon.minimumOrderAmount)) {
        return errorResponse(reply, `Ordine minimo €${Number(coupon.minimumOrderAmount).toFixed(2)} per questo coupon`, 400);
      }

      // Check per-customer limit if logged in
      if (request.customer && coupon.maxUsesPerCustomer) {
        const customerUsage = await prisma.couponUsage.count({
          where: {
            couponId: coupon.id,
            customerId: request.customer.id,
          },
        });

        if (customerUsage >= coupon.maxUsesPerCustomer) {
          return errorResponse(reply, 'Hai già utilizzato questo coupon il massimo numero di volte', 400);
        }
      }

      // Calculate discount
      let discount = 0;
      if (coupon.type === 'PERCENTAGE') {
        discount = body.cartTotal * (Number(coupon.discountValue) / 100);
      } else if (coupon.type === 'FIXED') {
        discount = Number(coupon.discountValue);
      }

      // Cap discount at cart total
      discount = Math.min(discount, body.cartTotal);

      return successResponse(reply, {
        valid: true,
        code: coupon.code,
        type: coupon.type,
        discountValue: Number(coupon.discountValue),
        calculatedDiscount: discount,
        minimumOrderAmount: coupon.minimumOrderAmount ? Number(coupon.minimumOrderAmount) : null,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });
};

export default shopCheckoutRoutes;
