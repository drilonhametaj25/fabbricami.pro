/**
 * Stripe Checkout E2E Tests
 * End-to-end tests for Stripe payment flow
 *
 * Tests:
 * 1. Checkout session creation
 * 2. Payment intent creation
 * 3. Webhook handling (payment succeeded, failed, refund)
 * 4. Session verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set env vars BEFORE any imports that might use them
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.FRONTEND_URL = 'http://localhost:3001';

// Mock Stripe SDK - must be before service import
const mockStripeInstance = {
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripeInstance),
}));

// Mock PrismaClient since stripe.service creates its own instance
const mockPrismaInstance = {
  paymentTransaction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  orderRefund: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaInstance),
  PaymentStatus: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
}));

vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock shop checkout service
vi.mock('@server/services/shop-checkout.service', () => ({
  shopCheckoutService: {
    confirmOrderPayment: vi.fn().mockResolvedValue({ success: true }),
    handlePaymentFailed: vi.fn().mockResolvedValue({ success: true }),
    updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock subscription service
vi.mock('@server/services/subscription.service', () => ({
  subscriptionService: {
    handleStripeWebhook: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import mocked services
import { shopCheckoutService } from '@server/services/shop-checkout.service';

describe('Stripe Checkout E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Checkout Session Creation', () => {
    it('should create checkout session with correct line items', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/session/cs_test_123',
        payment_status: 'unpaid',
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({
        id: 'txn-1',
        orderId: 'order-1',
        provider: 'STRIPE',
        transactionId: 'cs_test_123',
        status: 'PENDING',
      });

      const result = await stripeService.createCheckoutSession({
        orderId: 'order-1',
        customerEmail: 'test@example.com',
        lineItems: [
          {
            name: 'Test Product',
            description: 'Test description',
            amount: 2500, // 25.00 EUR in cents
            quantity: 2,
          },
        ],
        shippingAmount: 500, // 5.00 EUR
      });

      expect(result.sessionId).toBe('cs_test_123');
      expect(result.url).toBe('https://checkout.stripe.com/session/cs_test_123');
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          customer_email: 'test@example.com',
        })
      );
      expect(mockPrismaInstance.paymentTransaction.create).toHaveBeenCalled();
    });

    it('should add shipping as line item when present', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/session/cs_test_456',
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      await stripeService.createCheckoutSession({
        orderId: 'order-2',
        customerEmail: 'test@example.com',
        lineItems: [
          { name: 'Product', amount: 1000, quantity: 1 },
        ],
        shippingAmount: 750,
      });

      const createCall = mockStripeInstance.checkout.sessions.create.mock.calls[0][0];
      // Should have 2 line items: product + shipping
      expect(createCall.line_items.length).toBe(2);
      expect(createCall.line_items[1].price_data.product_data.name).toBe('Spedizione');
    });

    it('should not add shipping line item when shipping is zero', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_test_789',
        url: 'https://checkout.stripe.com/session/cs_test_789',
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      await stripeService.createCheckoutSession({
        orderId: 'order-3',
        customerEmail: 'test@example.com',
        lineItems: [
          { name: 'Product', amount: 1000, quantity: 1 },
        ],
        shippingAmount: 0,
      });

      const createCall = mockStripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(createCall.line_items.length).toBe(1);
    });

    it('should include metadata with orderId', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_test_meta',
        url: 'https://checkout.stripe.com/session/cs_test_meta',
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      await stripeService.createCheckoutSession({
        orderId: 'order-metadata',
        customerEmail: 'test@example.com',
        lineItems: [{ name: 'Product', amount: 1000, quantity: 1 }],
        shippingAmount: 0,
        metadata: { source: 'web' },
      });

      const createCall = mockStripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual(
        expect.objectContaining({
          orderId: 'order-metadata',
          source: 'web',
        })
      );
    });
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent with correct amount', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockPaymentIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
        status: 'requires_payment_method',
      };

      mockStripeInstance.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      const result = await stripeService.createPaymentIntent({
        orderId: 'order-pi-1',
        amount: 5000, // 50.00 EUR in cents
        currency: 'EUR',
        customerEmail: 'test@example.com',
      });

      expect(result.clientSecret).toBe('pi_test_123_secret_abc');
      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'eur',
          receipt_email: 'test@example.com',
        })
      );
    });

    it('should include order metadata in payment intent', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockPaymentIntent = {
        id: 'pi_test_meta',
        client_secret: 'pi_test_meta_secret',
      };

      mockStripeInstance.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      await stripeService.createPaymentIntent({
        orderId: 'order-pi-meta',
        amount: 2500,
        currency: 'EUR',
        customerEmail: 'test@example.com',
        metadata: { customField: 'value' },
      });

      const createCall = mockStripeInstance.paymentIntents.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual(
        expect.objectContaining({
          orderId: 'order-pi-meta',
          customField: 'value',
        })
      );
    });
  });

  describe('Checkout Session Verification', () => {
    it('should retrieve session successfully', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_test_verify',
        payment_status: 'paid',
        metadata: { orderId: 'order-verify' },
        customer_email: 'test@example.com',
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await stripeService.getCheckoutSession('cs_test_verify');

      expect(result).toBeDefined();
      expect(result?.payment_status).toBe('paid');
      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith(
        'cs_test_verify',
        expect.objectContaining({ expand: ['payment_intent', 'line_items'] })
      );
    });

    it('should return null for non-existent session', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      mockStripeInstance.checkout.sessions.retrieve.mockRejectedValue(
        new Error('No such checkout session')
      );

      const result = await stripeService.getCheckoutSession('cs_invalid');

      expect(result).toBeNull();
    });
  });

  describe('Webhook Handling', () => {
    it('should construct webhook event from signature', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const payload = JSON.stringify({ id: 'pi_test' });
      const signature = 'test_signature';

      const event = stripeService.constructWebhookEvent(payload, signature);

      expect(event.type).toBe('payment_intent.succeeded');
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test_mock'
      );
    });

    it('should handle checkout.session.completed for order payment', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockSession = {
        id: 'cs_complete',
        mode: 'payment',
        metadata: { orderId: 'order-complete' },
        payment_intent: 'pi_complete',
        amount_total: 5000,
        customer_email: 'test@example.com',
      };

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

      await stripeService.handleWebhook({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as any);

      // handleCheckoutCompleted calls updatePaymentStatus
      expect(vi.mocked(shopCheckoutService.updatePaymentStatus)).toHaveBeenCalled();
      const call = vi.mocked(shopCheckoutService.updatePaymentStatus).mock.calls[0];
      expect(call[0]).toBe('order-complete'); // orderId
      expect(call[2]).toBe('pi_complete'); // paymentIntentId
    });

    it('should handle payment_intent.succeeded', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockPaymentIntent = {
        id: 'pi_succeeded',
        metadata: { orderId: 'order-succeeded' },
        amount: 5000,
        status: 'succeeded',
      };

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaInstance.order.update.mockResolvedValue({});

      await stripeService.handleWebhook({
        id: 'evt_succeeded',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      } as any);

      expect(mockPrismaInstance.paymentTransaction.updateMany).toHaveBeenCalled();
    });

    it('should handle payment_intent.payment_failed', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockPaymentIntent = {
        id: 'pi_failed',
        metadata: { orderId: 'order-failed' },
        last_payment_error: { message: 'Card declined' },
      };

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

      await stripeService.handleWebhook({
        id: 'evt_failed',
        type: 'payment_intent.payment_failed',
        data: { object: mockPaymentIntent },
      } as any);

      expect(mockPrismaInstance.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });

    it('should handle charge.refunded', async () => {
      const { stripeService } = await import('@server/services/stripe.service');

      const mockCharge = {
        id: 'ch_refund',
        payment_intent: 'pi_refund',
        amount_refunded: 2500,
        metadata: { orderId: 'order-refund' },
      };

      mockPrismaInstance.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-refund',
        orderId: 'order-refund',
      });
      mockPrismaInstance.paymentTransaction.update.mockResolvedValue({});

      await stripeService.handleWebhook({
        id: 'evt_refund',
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as any);

      // handleRefund updates the transaction status to REFUNDED
      expect(mockPrismaInstance.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUNDED' }),
        })
      );
    });

    it('should delegate subscription events to subscription service', async () => {
      const { stripeService } = await import('@server/services/stripe.service');
      const { subscriptionService } = await import('@server/services/subscription.service');

      await stripeService.handleWebhook({
        id: 'evt_sub',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_test' } },
      } as any);

      expect(vi.mocked(subscriptionService.handleStripeWebhook)).toHaveBeenCalled();
    });
  });

  describe('Service Configuration', () => {
    it('should report as configured when Stripe key is set', async () => {
      const { stripeService } = await import('@server/services/stripe.service');
      expect(stripeService.isConfigured()).toBe(true);
    });
  });
});
