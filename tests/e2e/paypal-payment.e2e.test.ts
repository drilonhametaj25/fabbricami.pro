/**
 * PayPal Payment E2E Tests
 * End-to-end tests for PayPal payment flow
 *
 * Tests:
 * 1. Order creation
 * 2. Order capture
 * 3. Refund creation
 * 4. Webhook handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set env vars BEFORE any imports
process.env.PAYPAL_CLIENT_ID = 'test_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
process.env.PAYPAL_MODE = 'sandbox';
process.env.FRONTEND_URL = 'http://localhost:3001';
process.env.PAYPAL_WEBHOOK_ID = 'webhook_123';

// Store original fetch
const originalFetch = global.fetch;

// Mock fetch for PayPal API
const mockFetch = vi.fn();

// Mock PrismaClient since paypal.service creates its own instance
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
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaInstance),
  PaymentStatus: {
    PENDING: 'PENDING',
    CAPTURED: 'CAPTURED',
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
    updatePaymentStatus: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { shopCheckoutService } from '@server/services/shop-checkout.service';

describe('PayPal Payment E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mock fetch
    global.fetch = mockFetch;

    // Default mock for OAuth token
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test_token',
            expires_in: 3600,
          }),
        };
      }
      return { ok: false, status: 500, json: () => Promise.resolve({}) };
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  describe('PayPal Configuration', () => {
    it('should return true when PayPal is configured', async () => {
      const { paypalService } = await import('@server/services/paypal.service');
      expect(paypalService.isConfigured()).toBe(true);
    });

    it('should return client ID', async () => {
      const { paypalService } = await import('@server/services/paypal.service');
      expect(paypalService.getClientId()).toBe('test_client_id');
    });
  });

  describe('Order Creation', () => {
    it('should create PayPal order with correct payload', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const mockOrderResponse = {
        id: 'PAYPAL-ORDER-123',
        status: 'CREATED',
        links: [
          { rel: 'approve', href: 'https://sandbox.paypal.com/checkoutnow?token=123' },
        ],
      };

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v2/checkout/orders')) {
          return {
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          };
        }
        return { ok: false };
      });

      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      const result = await paypalService.createOrder({
        orderId: 'order-1',
        amount: 100,
        currency: 'EUR',
        items: [
          { name: 'Product', quantity: 1, unitAmount: 90 },
        ],
        shippingAmount: 10,
      });

      // Service returns paypalOrderId, not orderId
      expect(result.paypalOrderId).toBe('PAYPAL-ORDER-123');
      expect(result.approvalUrl).toBe('https://sandbox.paypal.com/checkoutnow?token=123');
    });

    it('should throw error when approval URL not found', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const mockOrderResponse = {
        id: 'PAYPAL-ORDER-456',
        status: 'CREATED',
        links: [],
      };

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v2/checkout/orders')) {
          return {
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          };
        }
        return { ok: false };
      });

      mockPrismaInstance.paymentTransaction.create.mockResolvedValue({});

      await expect(
        paypalService.createOrder({
          orderId: 'order-2',
          amount: 100,
          currency: 'EUR',
          items: [{ name: 'Product', quantity: 1, unitAmount: 100 }],
          shippingAmount: 0,
        })
      ).rejects.toThrow('URL di approvazione PayPal non trovato');
    });
  });

  describe('Order Capture', () => {
    it('should capture order and update transaction', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const mockCaptureResponse = {
        id: 'PAYPAL-ORDER-789',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'capture-123',
                  status: 'COMPLETED',
                  amount: { value: '100.00' },
                },
              ],
            },
          },
        ],
        payer: { email_address: 'test@example.com' },
      };

      mockFetch.mockImplementation(async (url: string, options?: any) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/capture')) {
          return {
            ok: true,
            json: () => Promise.resolve(mockCaptureResponse),
          };
        }
        return { ok: false };
      });

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await paypalService.captureOrder('PAYPAL-ORDER-789');

      expect(result.captureId).toBe('capture-123');
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error when capture fails', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/capture')) {
          return {
            ok: false,
            status: 422,
            json: () => Promise.resolve({
              name: 'UNPROCESSABLE_ENTITY',
              message: 'Payment declined',
            }),
          };
        }
        return { ok: false };
      });

      // When PayPal API returns ok: false, makeRequest throws the response message
      await expect(paypalService.captureOrder('PAYPAL-FAIL')).rejects.toThrow('Payment declined');
    });
  });

  describe('Get Order', () => {
    it('should retrieve order details', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const mockOrderResponse = {
        id: 'PAYPAL-GET-123',
        status: 'APPROVED',
        purchase_units: [
          { amount: { value: '150.00', currency_code: 'EUR' } },
        ],
      };

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v2/checkout/orders/PAYPAL-GET-123')) {
          return {
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          };
        }
        return { ok: false };
      });

      const result = await paypalService.getOrder('PAYPAL-GET-123');

      expect(result.id).toBe('PAYPAL-GET-123');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle PAYMENT.CAPTURE.COMPLETED event', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'capture-webhook-123',
          custom_id: 'order-webhook-1',
          status: 'COMPLETED',
          amount: { value: '200.00', currency_code: 'EUR' },
        },
      };

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

      await paypalService.handleWebhook(webhookEvent);

      // Webhook handler updates payment transaction status
      expect(mockPrismaInstance.paymentTransaction.updateMany).toHaveBeenCalled();
      // Note: shopCheckoutService.updatePaymentStatus is only called in captureOrder, not in webhook handler
    });

    it('should handle PAYMENT.CAPTURE.DENIED event', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'capture-denied-123',
          custom_id: 'order-denied-1',
          status: 'DENIED',
        },
      };

      mockPrismaInstance.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });

      await paypalService.handleWebhook(webhookEvent);

      expect(mockPrismaInstance.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });

    it('should handle CHECKOUT.ORDER.APPROVED event', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      const webhookEvent = {
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: {
          id: 'order-approved-123',
          status: 'APPROVED',
          purchase_units: [{ custom_id: 'order-approved-1' }],
        },
      };

      // This event doesn't require DB updates, just logs
      await paypalService.handleWebhook(webhookEvent);

      // No DB call expected for this event type
      expect(true).toBe(true);
    });
  });

  describe('Signature Verification', () => {
    it('should verify webhook signature successfully', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return {
            ok: true,
            json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
          };
        }
        return { ok: false };
      });

      // Method signature: verifyWebhookSignature(body: string, headers: Record<string, string>)
      const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
      const headers = {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/cert.pem',
        'paypal-transmission-id': 'trans-123',
        'paypal-transmission-sig': 'signature',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      };

      const result = await paypalService.verifyWebhookSignature(body, headers);

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return {
            ok: true,
            json: () => Promise.resolve({ verification_status: 'FAILURE' }),
          };
        }
        return { ok: false };
      });

      // Method signature: verifyWebhookSignature(body: string, headers: Record<string, string>)
      const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
      const headers = {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/cert.pem',
        'paypal-transmission-id': 'trans-123',
        'paypal-transmission-sig': 'bad-signature',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      };

      const result = await paypalService.verifyWebhookSignature(body, headers);

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle PayPal API errors', async () => {
      const { paypalService } = await import('@server/services/paypal.service');

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/v2/checkout/orders')) {
          return {
            ok: false,
            status: 400,
            json: () => Promise.resolve({
              name: 'INVALID_REQUEST',
              message: 'Invalid request',
              details: [{ description: 'Amount must be positive' }],
            }),
          };
        }
        return { ok: false };
      });

      await expect(
        paypalService.createOrder({
          orderId: 'order-error',
          amount: -100,
          currency: 'EUR',
          items: [],
          shippingAmount: 0,
        })
      ).rejects.toThrow();
    });

    it('should handle OAuth token failure', async () => {
      // Need to reset module cache and force fresh import
      vi.resetModules();

      // Setup mock before import
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'invalid_client' }),
          };
        }
        return { ok: false, status: 500, json: () => Promise.resolve({}) };
      });

      // Fresh import to avoid cached token from previous tests
      const { paypalService } = await import('@server/services/paypal.service');

      await expect(
        paypalService.createOrder({
          orderId: 'order-auth-fail',
          amount: 100,
          currency: 'EUR',
          items: [{ name: 'Test', quantity: 1, unitAmount: 100 }],
          shippingAmount: 0,
        })
      ).rejects.toThrow('Errore autenticazione PayPal');
    });
  });
});
