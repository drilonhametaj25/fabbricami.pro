import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { stripeService } from '../services/stripe.service';

/**
 * Endpoint dedicato per i webhook Stripe della parte SaaS (subscriptions).
 *
 * Espone POST /api/v1/webhooks/stripe come URL canonico da configurare nel
 * dashboard Stripe. Il handler è lo stesso di shop-checkout (`stripeService
 * .handleWebhook`), che gestisce sia eventi di shop checkout sia eventi di
 * subscription SaaS — l'evento `event.type` decide quale flow prendere.
 *
 * Mantenere anche l'endpoint legacy `/api/v1/shop/checkout/stripe/webhook`
 * per compatibilità con webhook già configurati su Stripe.
 */
const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      const rawBody = (request as { rawBody?: Buffer | string }).rawBody;

      if (!rawBody) {
        request.log.error('Stripe webhook: rawBody not available');
        return reply.code(500).send({ error: 'Server configuration error: rawBody not available' });
      }

      const event = stripeService.constructWebhookEvent(rawBody, signature);

      // Process async per restituire 200 velocemente — best practice Stripe.
      // L'idempotency è gestita da stripeService.handleWebhook via Redis.
      stripeService.handleWebhook(event).catch((err: unknown) => {
        request.log.error('Stripe webhook processing error: ' + String(err));
      });

      return reply.code(200).send({ received: true });
    } catch (error: unknown) {
      const err = error as { type?: string; message?: string };
      if (err.type === 'StripeSignatureVerificationError') {
        return reply.code(400).send({ error: 'Invalid signature' });
      }
      request.log.error('Stripe webhook error: ' + String(error));
      return reply.code(400).send({ error: err.message || 'Webhook error' });
    }
  });
};

export default stripeWebhookRoutes;
