import { PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import Stripe from 'stripe';
import { shopCheckoutService } from './shop-checkout.service';
import { subscriptionService } from './subscription.service';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import redisClient from '../config/redis';

// Webhook idempotency TTL (7 days in seconds)
const WEBHOOK_IDEMPOTENCY_TTL = 7 * 24 * 60 * 60;

// Stripe configuration from centralized config (BUG-003 fix)
const STRIPE_SECRET_KEY = config.stripe.secretKey;
const STRIPE_WEBHOOK_SECRET = config.stripe.webhookSecret;
const FRONTEND_URL = config.frontend.url;

// Initialize Stripe
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia' as any,
}) : null;

export interface CreateCheckoutSessionData {
  orderId: string;
  customerEmail: string;
  lineItems: {
    name: string;
    description?: string;
    amount: number; // in cents
    quantity: number;
    imageUrl?: string;
  }[];
  shippingAmount: number; // in cents
  metadata?: Record<string, string>;
}

export interface PaymentIntentData {
  orderId: string;
  amount: number; // in cents
  currency: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

class StripeService {
  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!stripe;
  }

  /**
   * Create a Stripe Checkout Session for an order
   */
  async createCheckoutSession(data: CreateCheckoutSessionData): Promise<{ sessionId: string; url: string }> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = data.lineItems.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.description,
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: item.amount,
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item if present
    if (data.shippingAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Spedizione',
          },
          unit_amount: data.shippingAmount,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: data.customerEmail,
      success_url: `${FRONTEND_URL}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}&order_id=${data.orderId}`,
      cancel_url: `${FRONTEND_URL}/checkout?cancelled=true&order_id=${data.orderId}`,
      metadata: {
        orderId: data.orderId,
        ...data.metadata,
      },
      payment_intent_data: {
        metadata: {
          orderId: data.orderId,
        },
      },
      locale: 'it',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    // Store session ID with order
    await prisma.paymentTransaction.create({
      data: {
        orderId: data.orderId,
        provider: 'STRIPE',
        transactionId: session.id,
        status: PaymentStatus.PENDING,
        amount: lineItems.reduce((sum, item) => sum + (item.price_data?.unit_amount || 0) * (item.quantity || 1), 0) / 100,
        currency: 'EUR',
        metadata: { sessionId: session.id },
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a Payment Intent for custom integration
   */
  async createPaymentIntent(data: PaymentIntentData): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency.toLowerCase(),
      receipt_email: data.customerEmail,
      metadata: {
        orderId: data.orderId,
        ...data.metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Store payment intent
    await prisma.paymentTransaction.create({
      data: {
        orderId: data.orderId,
        provider: 'STRIPE',
        transactionId: paymentIntent.id,
        status: PaymentStatus.PENDING,
        amount: data.amount / 100,
        currency: data.currency.toUpperCase(),
        metadata: { paymentIntentId: paymentIntent.id },
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Retrieve Checkout Session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    try {
      return await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'line_items'],
      });
    } catch {
      return null;
    }
  }

  /**
   * Verify webhook signature and construct event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  }

  /**
   * Check if webhook event was already processed (BUG-005 fix: idempotency)
   */
  private async isEventProcessed(eventId: string): Promise<boolean> {
    const key = `stripe:webhook:${eventId}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  }

  /**
   * Mark webhook event as processed (BUG-005 fix: idempotency)
   */
  private async markEventProcessed(eventId: string): Promise<void> {
    const key = `stripe:webhook:${eventId}`;
    await redisClient.setex(key, WEBHOOK_IDEMPOTENCY_TTL, 'processed');
  }

  /**
   * Handle Stripe webhook events
   * BUG-005 fix: Implements idempotency using Redis
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    // Check idempotency - skip if already processed
    if (await this.isEventProcessed(event.id)) {
      logger.info(`Stripe webhook event ${event.id} already processed, skipping`);
      return;
    }

    // Subscription events - delegate to subscription service
    const subscriptionEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      'invoice.paid',
      'invoice.payment_failed',
    ];

    if (subscriptionEvents.includes(event.type)) {
      await subscriptionService.handleStripeWebhook(event);
      return;
    }

    // Payment events - handle for order payments
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Check if this is a subscription checkout or order checkout
        if (session.mode === 'subscription') {
          await subscriptionService.handleStripeWebhook(event);
        } else {
          await this.handleCheckoutCompleted(session);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') {
          await this.handleCheckoutExpired(session);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await this.handleRefund(charge);
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    // Mark event as processed for idempotency
    await this.markEventProcessed(event.id);
  }

  /**
   * Handle successful checkout session
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      logger.error('No orderId in checkout session metadata');
      return;
    }

    // Update payment transaction
    await prisma.paymentTransaction.updateMany({
      where: { transactionId: session.id },
      data: {
        status: PaymentStatus.CAPTURED,
        webhookData: session as any,
      },
    });

    // Update order status
    await shopCheckoutService.updatePaymentStatus(
      orderId,
      PaymentStatus.CAPTURED,
      session.payment_intent as string
    );

    logger.info(`Checkout completed for order ${orderId}`);
  }

  /**
   * Handle expired checkout session
   */
  private async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    // Update payment transaction
    await prisma.paymentTransaction.updateMany({
      where: { transactionId: session.id },
      data: {
        status: PaymentStatus.FAILED,
        webhookData: session as any,
      },
    });

    // Cancel the order
    await shopCheckoutService.cancelOrder(orderId, 'Sessione di pagamento scaduta');

    logger.info(`Checkout expired for order ${orderId}`);
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await prisma.paymentTransaction.updateMany({
      where: { transactionId: paymentIntent.id },
      data: {
        status: PaymentStatus.CAPTURED,
        webhookData: paymentIntent as any,
      },
    });

    await shopCheckoutService.updatePaymentStatus(orderId, PaymentStatus.CAPTURED, paymentIntent.id);

    logger.info(`Payment succeeded for order ${orderId}`);
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await prisma.paymentTransaction.updateMany({
      where: { transactionId: paymentIntent.id },
      data: {
        status: PaymentStatus.FAILED,
        webhookData: paymentIntent as any,
      },
    });

    logger.warn(`Payment failed for order ${orderId}`);
  }

  /**
   * Handle refund
   * BUG-006 fix: Restore stock and reverse loyalty points when refund is processed
   */
  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = charge.payment_intent as string;

    // Find the transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { transactionId: paymentIntentId },
          { metadata: { path: ['paymentIntentId'], equals: paymentIntentId } },
        ],
      },
    });

    if (!transaction) {
      logger.warn(`No transaction found for refund payment intent: ${paymentIntentId}`);
      return;
    }

    // Update transaction status
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.REFUNDED,
        webhookData: charge as any,
      },
    });

    // Find the order for stock/loyalty restoration
    const order = await prisma.order.findUnique({
      where: { id: transaction.orderId },
      include: { items: true },
    });

    // If full refund and order exists, restore stock and reverse loyalty
    if (order && charge.refunded && !charge.amount_refunded) {
      // Full refund - restore all stock
      await prisma.$transaction(async (tx) => {
        // Restore stock for each item
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { wcStockQuantity: { increment: item.quantity } } as any,
            });
          } else if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { wcStockQuantity: { increment: item.quantity } } as any,
            });
          }
        }

        // Reverse loyalty points
        const loyaltyTx = await tx.loyaltyTransaction.findFirst({
          where: { orderId: order.id, type: 'EARN' },
          include: { account: true },
        });

        if (loyaltyTx && loyaltyTx.account) {
          await tx.loyaltyAccount.update({
            where: { id: loyaltyTx.account.id },
            data: { points: { decrement: loyaltyTx.points } },
          });

          await tx.loyaltyTransaction.create({
            data: {
              accountId: loyaltyTx.account.id,
              orderId: order.id,
              type: 'EXPIRE',
              points: -loyaltyTx.points,
              balanceAfter: loyaltyTx.account.points - loyaltyTx.points,
              description: `Punti annullati per rimborso ordine ${order.orderNumber}`,
            } as any,
          });
        }

        // Update order status
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });
      });

      logger.info(`Full refund processed for order ${order.orderNumber}, stock restored`);
    } else {
      logger.info(`Refund processed for transaction ${transaction.id}`);
    }
  }

  /**
   * Create a refund for an order
   */
  async createRefund(orderId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    // Find the payment transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        provider: 'STRIPE',
        status: PaymentStatus.CAPTURED,
      },
    });

    if (!transaction) {
      throw new Error('Transazione non trovata');
    }

    // Get the payment intent ID from metadata or transaction ID
    const paymentIntentId = (transaction.metadata as any)?.paymentIntentId ||
                           (transaction.webhookData as any)?.payment_intent ||
                           transaction.transactionId;

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundParams);

    // Create refund record
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        provider: 'STRIPE',
        transactionId: refund.id,
        status: PaymentStatus.REFUNDED,
        amount: (refund.amount / 100) * -1, // Negative for refunds
        currency: refund.currency.toUpperCase(),
        metadata: { refundId: refund.id, originalTransactionId: transaction.id },
      },
    });

    return refund;
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return config.stripe.publishableKey;
  }
}

export const stripeService = new StripeService();
