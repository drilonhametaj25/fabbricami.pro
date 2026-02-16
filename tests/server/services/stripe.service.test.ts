/**
 * @file stripe.service.test.ts
 * @description Unit tests for Stripe payment service
 * @coverage ~35 tests covering checkout sessions, payment intents, webhooks, refunds
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import type Stripe from 'stripe';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  paymentIntents: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
};

// Mock dependencies before importing service
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  PaymentStatus: {
    PENDING: 'PENDING',
    CAPTURED: 'CAPTURED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED',
  },
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockShopCheckoutService = {
  updatePaymentStatus: jest.fn(),
  cancelOrder: jest.fn(),
};

const mockSubscriptionService = {
  handleStripeWebhook: jest.fn(),
};

jest.mock('@server/services/shop-checkout.service', () => ({
  shopCheckoutService: mockShopCheckoutService,
}));

jest.mock('@server/services/subscription.service', () => ({
  subscriptionService: mockSubscriptionService,
}));

// Set environment variables before importing
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123456789';
process.env.FRONTEND_URL = 'http://localhost:3001';

// Import service after mocks
import { stripeService } from '@server/services/stripe.service';

describe('StripeService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // ============================================================================
  // isConfigured
  // ============================================================================
  describe('isConfigured', () => {
    it('should return true when Stripe is configured', () => {
      const result = stripeService.isConfigured();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // createCheckoutSession
  // ============================================================================
  describe('createCheckoutSession', () => {
    const mockSessionData = {
      orderId: 'order-123',
      customerEmail: 'customer@test.com',
      lineItems: [
        {
          name: 'Product 1',
          description: 'Description 1',
          amount: 2500, // 25.00 EUR in cents
          quantity: 2,
          imageUrl: 'https://example.com/image.jpg',
        },
        {
          name: 'Product 2',
          amount: 1500,
          quantity: 1,
        },
      ],
      shippingAmount: 500, // 5.00 EUR
      metadata: { source: 'web' },
    };

    it('should create checkout session successfully', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/session/cs_test_123',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({
        id: 'txn-1',
        orderId: 'order-123',
        provider: 'STRIPE',
        transactionId: 'cs_test_123',
        status: PaymentStatus.PENDING,
        amount: 70.00,
        currency: 'EUR',
        metadata: {},
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await stripeService.createCheckoutSession(mockSessionData);

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/session/cs_test_123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: 'customer@test.com',
          locale: 'it',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            source: 'web',
          }),
        })
      );

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-123',
          provider: 'STRIPE',
          transactionId: 'cs_test_123',
          status: PaymentStatus.PENDING,
        }),
      });
    });

    it('should add shipping as line item when present', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/session/cs_test_456',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createCheckoutSession(mockSessionData);

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
      const shippingItem = callArgs.line_items.find(
        (item: any) => item.price_data.product_data.name === 'Spedizione'
      );

      expect(shippingItem).toBeDefined();
      expect(shippingItem.price_data.unit_amount).toBe(500);
      expect(shippingItem.quantity).toBe(1);
    });

    it('should not add shipping line item when amount is 0', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_789',
        url: 'https://checkout.stripe.com/session/cs_test_789',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const dataWithNoShipping = { ...mockSessionData, shippingAmount: 0 };
      await stripeService.createCheckoutSession(dataWithNoShipping);

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
      const shippingItem = callArgs.line_items.find(
        (item: any) => item.price_data.product_data.name === 'Spedizione'
      );

      expect(shippingItem).toBeUndefined();
    });

    it('should include product images when provided', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_img',
        url: 'https://checkout.stripe.com/session/cs_test_img',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createCheckoutSession(mockSessionData);

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
      const productWithImage = callArgs.line_items[0];

      expect(productWithImage.price_data.product_data.images).toEqual([
        'https://example.com/image.jpg',
      ]);
    });

    it('should set correct success and cancel URLs', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_urls',
        url: 'https://checkout.stripe.com/session/cs_test_urls',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createCheckoutSession(mockSessionData);

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];

      expect(callArgs.success_url).toContain('/checkout/confirmation');
      expect(callArgs.success_url).toContain('order_id=order-123');
      expect(callArgs.cancel_url).toContain('/checkout?cancelled=true');
      expect(callArgs.cancel_url).toContain('order_id=order-123');
    });

    it('should set session expiration to 30 minutes', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_exp',
        url: 'https://checkout.stripe.com/session/cs_test_exp',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const beforeCall = Math.floor(Date.now() / 1000);
      await stripeService.createCheckoutSession(mockSessionData);
      const afterCall = Math.floor(Date.now() / 1000);

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
      const expiresAt = callArgs.expires_at;

      // Should be approximately 30 minutes (1800 seconds) from now
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + 30 * 60 - 1);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + 30 * 60 + 1);
    });
  });

  // ============================================================================
  // createPaymentIntent
  // ============================================================================
  describe('createPaymentIntent', () => {
    const mockIntentData = {
      orderId: 'order-456',
      amount: 5000, // 50.00 EUR in cents
      currency: 'EUR',
      customerEmail: 'customer@test.com',
      metadata: { cart_id: 'cart-123' },
    };

    it('should create payment intent successfully', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_xyz',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const result = await stripeService.createPaymentIntent(mockIntentData);

      expect(result).toEqual({
        clientSecret: 'pi_test_123_secret_xyz',
        paymentIntentId: 'pi_test_123',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'eur',
        receipt_email: 'customer@test.com',
        metadata: expect.objectContaining({
          orderId: 'order-456',
          cart_id: 'cart-123',
        }),
        automatic_payment_methods: { enabled: true },
      });
    });

    it('should store payment transaction with correct amount', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_456',
        client_secret: 'pi_test_456_secret_abc',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createPaymentIntent(mockIntentData);

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-456',
          provider: 'STRIPE',
          transactionId: 'pi_test_456',
          status: PaymentStatus.PENDING,
          amount: 50.00, // Converted from cents
          currency: 'EUR',
        }),
      });
    });

    it('should convert currency to lowercase for Stripe', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_789',
        client_secret: 'pi_test_789_secret',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createPaymentIntent({
        ...mockIntentData,
        currency: 'USD',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
        })
      );
    });
  });

  // ============================================================================
  // getCheckoutSession
  // ============================================================================
  describe('getCheckoutSession', () => {
    it('should retrieve checkout session with expanded fields', async () => {
      const mockSession = {
        id: 'cs_test_retrieve',
        status: 'complete',
        payment_intent: { id: 'pi_123' },
        line_items: { data: [] },
      };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await stripeService.getCheckoutSession('cs_test_retrieve');

      expect(result).toEqual(mockSession);
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith(
        'cs_test_retrieve',
        { expand: ['payment_intent', 'line_items'] }
      );
    });

    it('should return null when session not found', async () => {
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(
        new Error('No such session')
      );

      const result = await stripeService.getCheckoutSession('cs_nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // constructWebhookEvent
  // ============================================================================
  describe('constructWebhookEvent', () => {
    it('should construct webhook event with valid signature', () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const payload = JSON.stringify(mockEvent);
      const signature = 'stripe_sig_test';

      const result = stripeService.constructWebhookEvent(payload, signature);

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test_secret'
      );
    });

    it('should throw on invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Webhook signature verification failed');
      });

      expect(() =>
        stripeService.constructWebhookEvent('invalid_payload', 'bad_sig')
      ).toThrow('Webhook signature verification failed');
    });
  });

  // ============================================================================
  // handleWebhook
  // ============================================================================
  describe('handleWebhook', () => {
    describe('subscription events', () => {
      const subscriptionEventTypes = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'customer.subscription.trial_will_end',
        'invoice.paid',
        'invoice.payment_failed',
      ];

      it.each(subscriptionEventTypes)(
        'should delegate %s to subscription service',
        async (eventType) => {
          const event = { type: eventType, data: { object: {} } };

          await stripeService.handleWebhook(event as any);

          expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(event);
        }
      );
    });

    describe('checkout.session.completed', () => {
      it('should handle order checkout completion', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_completed',
              mode: 'payment',
              metadata: { orderId: 'order-123' },
              payment_intent: 'pi_123',
            },
          },
        };

        prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
        mockShopCheckoutService.updatePaymentStatus.mockResolvedValue({});

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
          where: { transactionId: 'cs_completed' },
          data: expect.objectContaining({
            status: PaymentStatus.CAPTURED,
          }),
        });

        expect(mockShopCheckoutService.updatePaymentStatus).toHaveBeenCalledWith(
          'order-123',
          PaymentStatus.CAPTURED,
          'pi_123'
        );
      });

      it('should delegate subscription checkout to subscription service', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_sub',
              mode: 'subscription',
              metadata: {},
            },
          },
        };

        await stripeService.handleWebhook(event as any);

        expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(event);
        expect(mockShopCheckoutService.updatePaymentStatus).not.toHaveBeenCalled();
      });

      it('should handle missing orderId gracefully', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_no_order',
              mode: 'payment',
              metadata: {},
            },
          },
        };

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.updateMany).not.toHaveBeenCalled();
      });
    });

    describe('checkout.session.expired', () => {
      it('should handle expired checkout session', async () => {
        const event = {
          type: 'checkout.session.expired',
          data: {
            object: {
              id: 'cs_expired',
              mode: 'payment',
              metadata: { orderId: 'order-expired' },
            },
          },
        };

        prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
        mockShopCheckoutService.cancelOrder.mockResolvedValue({});

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
          where: { transactionId: 'cs_expired' },
          data: expect.objectContaining({
            status: PaymentStatus.FAILED,
          }),
        });

        expect(mockShopCheckoutService.cancelOrder).toHaveBeenCalledWith(
          'order-expired',
          'Sessione di pagamento scaduta'
        );
      });

      it('should skip subscription expired sessions', async () => {
        const event = {
          type: 'checkout.session.expired',
          data: {
            object: {
              id: 'cs_sub_expired',
              mode: 'subscription',
              metadata: {},
            },
          },
        };

        await stripeService.handleWebhook(event as any);

        expect(mockShopCheckoutService.cancelOrder).not.toHaveBeenCalled();
      });
    });

    describe('payment_intent.succeeded', () => {
      it('should handle successful payment intent', async () => {
        const event = {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_succeeded',
              metadata: { orderId: 'order-pi-success' },
            },
          },
        };

        prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
        mockShopCheckoutService.updatePaymentStatus.mockResolvedValue({});

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
          where: { transactionId: 'pi_succeeded' },
          data: expect.objectContaining({
            status: PaymentStatus.CAPTURED,
          }),
        });

        expect(mockShopCheckoutService.updatePaymentStatus).toHaveBeenCalledWith(
          'order-pi-success',
          PaymentStatus.CAPTURED,
          'pi_succeeded'
        );
      });
    });

    describe('payment_intent.payment_failed', () => {
      it('should handle failed payment intent', async () => {
        const event = {
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_failed',
              metadata: { orderId: 'order-pi-fail' },
            },
          },
        };

        prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
          where: { transactionId: 'pi_failed' },
          data: expect.objectContaining({
            status: PaymentStatus.FAILED,
          }),
        });
      });
    });

    describe('charge.refunded', () => {
      it('should handle refund webhook', async () => {
        const event = {
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_refunded',
              payment_intent: 'pi_original',
            },
          },
        };

        prismaMock.paymentTransaction.findFirst.mockResolvedValue({
          id: 'txn-original',
          orderId: 'order-refund',
          provider: 'STRIPE',
          transactionId: 'pi_original',
          status: PaymentStatus.CAPTURED,
          amount: 50.00,
          currency: 'EUR',
          metadata: {},
          webhookData: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        prismaMock.paymentTransaction.update.mockResolvedValue({} as any);

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [
              { transactionId: 'pi_original' },
              { metadata: { path: ['paymentIntentId'], equals: 'pi_original' } },
            ],
          },
        });

        expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith({
          where: { id: 'txn-original' },
          data: expect.objectContaining({
            status: PaymentStatus.REFUNDED,
          }),
        });
      });

      it('should handle refund when transaction not found', async () => {
        const event = {
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_refunded_unknown',
              payment_intent: 'pi_unknown',
            },
          },
        };

        prismaMock.paymentTransaction.findFirst.mockResolvedValue(null);

        await stripeService.handleWebhook(event as any);

        expect(prismaMock.paymentTransaction.update).not.toHaveBeenCalled();
      });
    });

    it('should handle unknown event types gracefully', async () => {
      const event = {
        type: 'unknown.event.type',
        data: { object: {} },
      };

      // Should not throw
      await expect(stripeService.handleWebhook(event as any)).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // createRefund
  // ============================================================================
  describe('createRefund', () => {
    it('should create full refund successfully', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-to-refund',
        orderId: 'order-refund',
        provider: 'STRIPE',
        transactionId: 'cs_original',
        status: PaymentStatus.CAPTURED,
        amount: 100.00,
        currency: 'EUR',
        metadata: { paymentIntentId: 'pi_to_refund' },
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStripe.refunds.create.mockResolvedValue({
        id: 're_123',
        amount: 10000,
        currency: 'eur',
        status: 'succeeded',
      });

      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const result = await stripeService.createRefund('order-refund');

      expect(result.id).toBe('re_123');
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_to_refund',
        reason: 'requested_by_customer',
      });
    });

    it('should create partial refund with amount', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-partial',
        orderId: 'order-partial',
        provider: 'STRIPE',
        transactionId: 'pi_partial',
        status: PaymentStatus.CAPTURED,
        amount: 100.00,
        currency: 'EUR',
        metadata: {},
        webhookData: { payment_intent: 'pi_partial' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStripe.refunds.create.mockResolvedValue({
        id: 're_partial',
        amount: 5000,
        currency: 'eur',
        status: 'succeeded',
      });

      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createRefund('order-partial', 50.00, 'duplicate');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_partial',
        amount: 5000, // 50.00 EUR in cents
        reason: 'duplicate',
      });
    });

    it('should throw when transaction not found', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(null);

      await expect(stripeService.createRefund('order-missing')).rejects.toThrow(
        'Transazione non trovata'
      );
    });

    it('should create refund transaction record', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-record',
        orderId: 'order-record',
        provider: 'STRIPE',
        transactionId: 'pi_record',
        status: PaymentStatus.CAPTURED,
        amount: 75.00,
        currency: 'EUR',
        metadata: { paymentIntentId: 'pi_record' },
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStripe.refunds.create.mockResolvedValue({
        id: 're_record',
        amount: 7500,
        currency: 'eur',
        status: 'succeeded',
      });

      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createRefund('order-record');

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-record',
          provider: 'STRIPE',
          transactionId: 're_record',
          status: PaymentStatus.REFUNDED,
          amount: -75.00, // Negative for refunds
          currency: 'EUR',
          metadata: expect.objectContaining({
            refundId: 're_record',
            originalTransactionId: 'txn-record',
          }),
        }),
      });
    });

    it('should fall back to transactionId when no paymentIntentId in metadata', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-fallback',
        orderId: 'order-fallback',
        provider: 'STRIPE',
        transactionId: 'pi_direct',
        status: PaymentStatus.CAPTURED,
        amount: 30.00,
        currency: 'EUR',
        metadata: {},
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStripe.refunds.create.mockResolvedValue({
        id: 're_fallback',
        amount: 3000,
        currency: 'eur',
        status: 'succeeded',
      });

      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await stripeService.createRefund('order-fallback');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_direct',
        })
      );
    });
  });

  // ============================================================================
  // getPublishableKey
  // ============================================================================
  describe('getPublishableKey', () => {
    it('should return publishable key from environment', () => {
      const result = stripeService.getPublishableKey();
      expect(result).toBe('pk_test_123456789');
    });
  });
});
