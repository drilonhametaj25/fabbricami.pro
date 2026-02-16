/**
 * @file paypal.service.test.ts
 * @description Unit tests for PayPal payment service
 * @coverage ~25 tests covering order creation, capture, refunds, webhooks
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PaymentStatus } from '@prisma/client';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

const mockShopCheckoutService = {
  updatePaymentStatus: jest.fn(),
  cancelOrder: jest.fn(),
};

jest.mock('@server/services/shop-checkout.service', () => ({
  shopCheckoutService: mockShopCheckoutService,
}));

// Set environment variables before importing
process.env.PAYPAL_CLIENT_ID = 'test_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
process.env.PAYPAL_MODE = 'sandbox';
process.env.PAYPAL_WEBHOOK_ID = 'webhook_123';
process.env.FRONTEND_URL = 'http://localhost:3001';

// Import service after mocks
import { paypalService } from '@server/services/paypal.service';

describe('PayPalService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    mockFetch.mockReset();
    // Reset the token cache by setting it to expired
    (paypalService as any).accessToken = null;
    (paypalService as any).tokenExpiry = 0;
  });

  // Helper to mock OAuth token response
  const mockOAuthResponse = () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test_access_token',
        expires_in: 3600,
      }),
    });
  };

  // ============================================================================
  // isConfigured
  // ============================================================================
  describe('isConfigured', () => {
    it('should return true when PayPal is configured', () => {
      const result = paypalService.isConfigured();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // createOrder
  // ============================================================================
  describe('createOrder', () => {
    const mockOrderData = {
      orderId: 'order-123',
      amount: 100.50,
      currency: 'EUR',
      description: 'Test Order',
      items: [
        { name: 'Product 1', quantity: 2, unitAmount: 40.00, sku: 'PROD-1' },
        { name: 'Product 2', quantity: 1, unitAmount: 15.50 },
      ],
      shippingAmount: 5.00,
    };

    it('should create PayPal order successfully', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-ORDER-123',
          links: [
            { rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123' },
          ],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const result = await paypalService.createOrder(mockOrderData);

      expect(result).toEqual({
        paypalOrderId: 'PAYPAL-ORDER-123',
        approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123',
      });
    });

    it('should use sandbox API in sandbox mode', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-SANDBOX',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder(mockOrderData);

      // First call is OAuth, second is order creation
      const orderCall = mockFetch.mock.calls[1];
      expect(orderCall[0]).toContain('sandbox.paypal.com');
    });

    it('should format amounts to 2 decimal places', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-DECIMAL',
          links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder({
        ...mockOrderData,
        amount: 99.999,
        items: [{ name: 'Test', quantity: 1, unitAmount: 94.999 }],
        shippingAmount: 4.999,
      });

      const orderCall = mockFetch.mock.calls[1];
      const body = JSON.parse(orderCall[1].body);

      expect(body.purchase_units[0].amount.value).toBe('100.00');
      expect(body.purchase_units[0].amount.breakdown.shipping.value).toBe('5.00');
    });

    it('should truncate product names to 127 characters', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-LONG',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const longName = 'A'.repeat(200);
      await paypalService.createOrder({
        ...mockOrderData,
        items: [{ name: longName, quantity: 1, unitAmount: 50.00 }],
      });

      const orderCall = mockFetch.mock.calls[1];
      const body = JSON.parse(orderCall[1].body);

      expect(body.purchase_units[0].items[0].name.length).toBe(127);
    });

    it('should store payment transaction', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-TXN',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder(mockOrderData);

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-123',
          provider: 'PAYPAL',
          transactionId: 'PAYPAL-TXN',
          status: PaymentStatus.PENDING,
          amount: 100.50,
          currency: 'EUR',
        }),
      });
    });

    it('should throw when approval URL not found', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-NO-URL',
          links: [], // No approval link
        }),
      });

      await expect(paypalService.createOrder(mockOrderData)).rejects.toThrow(
        'URL di approvazione PayPal non trovato'
      );
    });

    it('should set correct return and cancel URLs', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-URLS',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder(mockOrderData);

      const orderCall = mockFetch.mock.calls[1];
      const body = JSON.parse(orderCall[1].body);
      const context = body.payment_source.paypal.experience_context;

      expect(context.return_url).toContain('/checkout/confirmation');
      expect(context.return_url).toContain('paypal=success');
      expect(context.return_url).toContain('order_id=order-123');
      expect(context.cancel_url).toContain('paypal=cancelled');
    });

    it('should set Italian locale and brand name', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-LOCALE',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder(mockOrderData);

      const orderCall = mockFetch.mock.calls[1];
      const body = JSON.parse(orderCall[1].body);
      const context = body.payment_source.paypal.experience_context;

      expect(context.locale).toBe('it-IT');
      expect(context.brand_name).toBe('EcommerceERP');
    });
  });

  // ============================================================================
  // captureOrder
  // ============================================================================
  describe('captureOrder', () => {
    it('should capture PayPal order successfully', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-CAPTURED',
          purchase_units: [{
            reference_id: 'order-capture-123',
            payments: {
              captures: [{
                id: 'CAPTURE-ID-123',
                status: 'COMPLETED',
                amount: { value: '100.00' },
              }],
            },
          }],
          payer: { email_address: 'buyer@test.com' },
        }),
      });
      prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
      mockShopCheckoutService.updatePaymentStatus.mockResolvedValue({});

      const result = await paypalService.captureOrder('PAYPAL-ORDER-ID');

      expect(result).toEqual({
        captureId: 'CAPTURE-ID-123',
        status: 'COMPLETED',
        amount: 100.00,
        payerEmail: 'buyer@test.com',
      });
    });

    it('should update payment transaction status', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-UPDATE',
          purchase_units: [{
            reference_id: 'order-update-123',
            payments: {
              captures: [{
                id: 'CAP-123',
                status: 'COMPLETED',
                amount: { value: '50.00' },
              }],
            },
          }],
        }),
      });
      prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
      mockShopCheckoutService.updatePaymentStatus.mockResolvedValue({});

      await paypalService.captureOrder('PAYPAL-TO-UPDATE');

      expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
        where: { transactionId: 'PAYPAL-TO-UPDATE' },
        data: expect.objectContaining({
          status: PaymentStatus.CAPTURED,
          metadata: expect.objectContaining({
            paypalOrderId: 'PAYPAL-TO-UPDATE',
            captureId: 'CAP-123',
          }),
        }),
      });
    });

    it('should call shopCheckoutService to update order status', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-SHOP',
          purchase_units: [{
            reference_id: 'order-shop-123',
            payments: {
              captures: [{
                id: 'CAP-SHOP',
                status: 'COMPLETED',
                amount: { value: '75.00' },
              }],
            },
          }],
        }),
      });
      prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
      mockShopCheckoutService.updatePaymentStatus.mockResolvedValue({});

      await paypalService.captureOrder('PAYPAL-SHOP-ORDER');

      expect(mockShopCheckoutService.updatePaymentStatus).toHaveBeenCalledWith(
        'order-shop-123',
        PaymentStatus.CAPTURED,
        'CAP-SHOP'
      );
    });

    it('should throw when capture fails', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-NO-CAPTURE',
          purchase_units: [{
            payments: { captures: [] },
          }],
        }),
      });

      await expect(paypalService.captureOrder('PAYPAL-FAIL')).rejects.toThrow(
        'Cattura pagamento non riuscita'
      );
    });

    it('should handle missing capture in response', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'PAYPAL-MISSING',
          purchase_units: [{}],
        }),
      });

      await expect(paypalService.captureOrder('PAYPAL-MISSING')).rejects.toThrow(
        'Cattura pagamento non riuscita'
      );
    });
  });

  // ============================================================================
  // getOrder
  // ============================================================================
  describe('getOrder', () => {
    it('should retrieve PayPal order details', async () => {
      mockOAuthResponse();
      const mockOrder = {
        id: 'PAYPAL-DETAILS',
        status: 'APPROVED',
        purchase_units: [{ reference_id: 'order-123' }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrder),
      });

      const result = await paypalService.getOrder('PAYPAL-DETAILS');

      expect(result).toEqual(mockOrder);
    });

    it('should make GET request to correct endpoint', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'PAYPAL-GET' }),
      });

      await paypalService.getOrder('PAYPAL-GET');

      const getCall = mockFetch.mock.calls[1];
      expect(getCall[0]).toContain('/v2/checkout/orders/PAYPAL-GET');
      expect(getCall[1].method).toBe('GET');
    });
  });

  // ============================================================================
  // createRefund
  // ============================================================================
  describe('createRefund', () => {
    it('should create full refund successfully', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        orderId: 'order-refund',
        provider: 'PAYPAL',
        transactionId: 'PAYPAL-ORIGINAL',
        status: PaymentStatus.CAPTURED,
        amount: 100.00,
        currency: 'EUR',
        metadata: { captureId: 'CAP-ORIGINAL' },
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'REFUND-123',
          status: 'COMPLETED',
          amount: { value: '100.00', currency_code: 'EUR' },
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      const result = await paypalService.createRefund('order-refund');

      expect(result).toEqual({
        refundId: 'REFUND-123',
        status: 'COMPLETED',
      });
    });

    it('should create partial refund with specified amount', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-partial',
        orderId: 'order-partial',
        provider: 'PAYPAL',
        transactionId: 'PAYPAL-PARTIAL',
        status: PaymentStatus.CAPTURED,
        amount: 100.00,
        currency: 'EUR',
        metadata: { captureId: 'CAP-PARTIAL' },
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'REFUND-PARTIAL',
          status: 'COMPLETED',
          amount: { value: '50.00', currency_code: 'EUR' },
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createRefund('order-partial', 50.00, 'Partial refund');

      const refundCall = mockFetch.mock.calls[1];
      const body = JSON.parse(refundCall[1].body);

      expect(body.amount.value).toBe('50.00');
      expect(body.amount.currency_code).toBe('EUR');
      expect(body.note_to_payer).toBe('Partial refund');
    });

    it('should throw when transaction not found', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(null);

      await expect(paypalService.createRefund('order-missing')).rejects.toThrow(
        'Transazione non trovata'
      );
    });

    it('should throw when capture ID not found', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-no-cap',
        orderId: 'order-no-cap',
        provider: 'PAYPAL',
        transactionId: 'PAYPAL-NO-CAP',
        status: PaymentStatus.CAPTURED,
        amount: 100.00,
        currency: 'EUR',
        metadata: {}, // No captureId
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(paypalService.createRefund('order-no-cap')).rejects.toThrow(
        'ID cattura non trovato'
      );
    });

    it('should create refund transaction record', async () => {
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        id: 'txn-record',
        orderId: 'order-record',
        provider: 'PAYPAL',
        transactionId: 'PAYPAL-RECORD',
        status: PaymentStatus.CAPTURED,
        amount: 75.00,
        currency: 'EUR',
        metadata: { captureId: 'CAP-RECORD' },
        webhookData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'REFUND-REC',
          status: 'COMPLETED',
          amount: { value: '75.00', currency_code: 'EUR' },
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createRefund('order-record');

      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-record',
          provider: 'PAYPAL',
          transactionId: 'REFUND-REC',
          status: PaymentStatus.REFUNDED,
          amount: -75.00, // Negative for refund
          currency: 'EUR',
          metadata: expect.objectContaining({
            refundId: 'REFUND-REC',
            originalCaptureId: 'CAP-RECORD',
          }),
        }),
      });
    });
  });

  // ============================================================================
  // handleWebhook
  // ============================================================================
  describe('handleWebhook', () => {
    describe('CHECKOUT.ORDER.APPROVED', () => {
      it('should log order approval', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await paypalService.handleWebhook({
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource: { id: 'ORDER-APPROVED' },
        });

        expect(consoleSpy).toHaveBeenCalledWith('PayPal order approved: ORDER-APPROVED');
        consoleSpy.mockRestore();
      });
    });

    describe('PAYMENT.CAPTURE.COMPLETED', () => {
      it('should update transaction status on capture completion', async () => {
        prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

        await paypalService.handleWebhook({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAP-COMPLETED',
            custom_id: 'order-completed',
          },
        });

        expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
          where: {
            OR: [
              { transactionId: 'CAP-COMPLETED' },
              { metadata: { path: ['captureId'], equals: 'CAP-COMPLETED' } },
            ],
          },
          data: expect.objectContaining({
            status: PaymentStatus.CAPTURED,
          }),
        });
      });
    });

    describe('PAYMENT.CAPTURE.DENIED / DECLINED', () => {
      it.each(['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'])(
        'should handle %s event',
        async (eventType) => {
          prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

          await paypalService.handleWebhook({
            event_type: eventType,
            resource: { id: 'CAP-FAILED' },
          });

          expect(prismaMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
            where: { transactionId: 'CAP-FAILED' },
            data: expect.objectContaining({
              status: PaymentStatus.FAILED,
            }),
          });
        }
      );
    });

    describe('PAYMENT.CAPTURE.REFUNDED', () => {
      it('should log refund completion', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await paypalService.handleWebhook({
          event_type: 'PAYMENT.CAPTURE.REFUNDED',
          resource: { id: 'REFUND-COMPLETED' },
        });

        expect(consoleSpy).toHaveBeenCalledWith('PayPal refund completed: REFUND-COMPLETED');
        consoleSpy.mockRestore();
      });
    });

    it('should handle unknown event types gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paypalService.handleWebhook({
        event_type: 'UNKNOWN.EVENT',
        resource: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled PayPal event: UNKNOWN.EVENT');
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // verifyWebhookSignature
  // ============================================================================
  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification_status: 'SUCCESS',
        }),
      });

      const result = await paypalService.verifyWebhookSignature(
        JSON.stringify({ event_type: 'TEST' }),
        {
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-transmission-id': 'trans-123',
          'paypal-transmission-sig': 'sig-123',
          'paypal-transmission-time': '2024-01-01T00:00:00Z',
        }
      );

      expect(result).toBe(true);
    });

    it('should return false when verification fails', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification_status: 'FAILURE',
        }),
      });

      const result = await paypalService.verifyWebhookSignature(
        JSON.stringify({ event_type: 'TEST' }),
        {
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-transmission-id': 'trans-123',
          'paypal-transmission-sig': 'bad-sig',
          'paypal-transmission-time': '2024-01-01T00:00:00Z',
        }
      );

      expect(result).toBe(false);
    });

    it('should return false on verification error', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Error' }),
      });

      const result = await paypalService.verifyWebhookSignature(
        'invalid-body',
        {}
      );

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getClientId
  // ============================================================================
  describe('getClientId', () => {
    it('should return client ID from environment', () => {
      const result = paypalService.getClientId();
      expect(result).toBe('test_client_id');
    });
  });

  // ============================================================================
  // OAuth Token Caching
  // ============================================================================
  describe('OAuth Token Caching', () => {
    it('should cache access token and reuse it', async () => {
      // Mock OAuth to return a token with long expiry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'cached_token',
          expires_in: 7200, // 2 hours
        }),
      });

      // First order creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'ORDER-1',
          links: [{ rel: 'payer-action', href: 'https://paypal.com/approve' }],
        }),
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({} as any);

      await paypalService.createOrder({
        orderId: 'order-1',
        amount: 50.00,
        currency: 'EUR',
        items: [{ name: 'Test', quantity: 1, unitAmount: 50.00 }],
        shippingAmount: 0,
      });

      // Second order should use cached token (no new OAuth call)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'ORDER-2',
          links: [{ rel: 'payer-action', href: 'https://paypal.com/approve' }],
        }),
      });

      await paypalService.createOrder({
        orderId: 'order-2',
        amount: 75.00,
        currency: 'EUR',
        items: [{ name: 'Test 2', quantity: 1, unitAmount: 75.00 }],
        shippingAmount: 0,
      });

      // OAuth should only be called once (first call), second order uses cached token
      const oauthCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/oauth2/token')
      );
      expect(oauthCalls.length).toBe(1);

      // Should have 3 total calls: OAuth + 2 order creations
      expect(mockFetch.mock.calls.length).toBe(3);
    });
  });

  // ============================================================================
  // API Error Handling
  // ============================================================================
  describe('API Error Handling', () => {
    it('should throw on API error with message', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid request format' }),
      });

      await expect(
        paypalService.createOrder({
          orderId: 'order-api-err',
          amount: 50.00,
          currency: 'EUR',
          items: [{ name: 'Test', quantity: 1, unitAmount: 50.00 }],
          shippingAmount: 0,
        })
      ).rejects.toThrow('Invalid request format');
    });

    it('should throw generic error when no message provided', async () => {
      mockOAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(
        paypalService.createOrder({
          orderId: 'order-generic-err',
          amount: 50.00,
          currency: 'EUR',
          items: [{ name: 'Test', quantity: 1, unitAmount: 50.00 }],
          shippingAmount: 0,
        })
      ).rejects.toThrow('Errore PayPal API');
    });
  });
});
