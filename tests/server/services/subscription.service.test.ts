/**
 * @file subscription.service.test.ts
 * @description Unit tests for SaaS subscription service
 * @coverage ~40 tests covering subscription lifecycle, Stripe integration, webhooks
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, SaasSubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Mock Stripe
const mockStripe = {
  customers: {
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
};

// Mock database
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock Stripe constructor
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

// Set environment variables before importing
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter_monthly';
process.env.STRIPE_PRICE_STARTER_YEARLY = 'price_starter_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
process.env.STRIPE_PRICE_BUSINESS_MONTHLY = 'price_business_monthly';
process.env.STRIPE_PRICE_BUSINESS_YEARLY = 'price_business_yearly';
process.env.APP_URL = 'http://localhost:5173';
process.env.DEFAULT_TRIAL_DAYS = '14';

// Import service after mocks
import { subscriptionService } from '@server/services/subscription.service';

describe('SubscriptionService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // Test data factories
  const createMockTenant = (overrides = {}) => ({
    id: 'tenant-123',
    name: 'Test Company',
    slug: 'test-company',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [
      {
        role: 'ADMIN',
        user: { email: 'admin@test.com' },
      },
    ],
    ...overrides,
  });

  const createMockPlan = (overrides = {}) => ({
    id: 'plan-1',
    code: 'PRO',
    name: 'Pro Plan',
    priceMonthly: 49,
    priceYearly: 490,
    isActive: true,
    maxUsers: 10,
    maxProducts: 1000,
    maxOrders: 5000,
    features: ['feature1', 'feature2'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockSubscription = (overrides = {}) => ({
    id: 'sub-1',
    tenantId: 'tenant-123',
    planId: 'plan-1',
    status: 'ACTIVE' as SaasSubscriptionStatus,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    stripeSubscriptionId: 'sub_stripe_123',
    stripeCustomerId: 'cus_stripe_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: createMockPlan(),
    ...overrides,
  });

  // ============================================================================
  // isStripeConfigured
  // ============================================================================
  describe('isStripeConfigured', () => {
    it('should return true when Stripe is configured', () => {
      const result = subscriptionService.isStripeConfigured();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // getSubscription
  // ============================================================================
  describe('getSubscription', () => {
    it('should return subscription info when found', async () => {
      const mockSub = createMockSubscription();
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);

      const result = await subscriptionService.getSubscription('tenant-123');

      expect(result).toEqual(expect.objectContaining({
        id: 'sub-1',
        tenantId: 'tenant-123',
        planCode: 'PRO',
        planName: 'Pro Plan',
        status: 'ACTIVE',
      }));
    });

    it('should return null when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      const result = await subscriptionService.getSubscription('nonexistent');

      expect(result).toBeNull();
    });

    it('should include all subscription info fields', async () => {
      const mockSub = createMockSubscription({
        cancelAtPeriodEnd: true,
        trialEndsAt: new Date('2025-02-01'),
      });
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);

      const result = await subscriptionService.getSubscription('tenant-123');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('tenantId');
      expect(result).toHaveProperty('planCode');
      expect(result).toHaveProperty('planName');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('currentPeriodStart');
      expect(result).toHaveProperty('currentPeriodEnd');
      expect(result).toHaveProperty('cancelAtPeriodEnd');
      expect(result).toHaveProperty('trialEndsAt');
      expect(result).toHaveProperty('stripeSubscriptionId');
      expect(result).toHaveProperty('stripeCustomerId');
    });
  });

  // ============================================================================
  // getPlans
  // ============================================================================
  describe('getPlans', () => {
    it('should return active plans sorted by price', async () => {
      const mockPlans = [
        createMockPlan({ code: 'STARTER', priceMonthly: 19 }),
        createMockPlan({ code: 'PRO', priceMonthly: 49 }),
        createMockPlan({ code: 'BUSINESS', priceMonthly: 99 }),
      ];
      prismaMock.subscriptionPlan.findMany.mockResolvedValue(mockPlans);

      const result = await subscriptionService.getPlans();

      expect(result).toHaveLength(3);
      expect(prismaMock.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });
    });

    it('should return empty array when no plans', async () => {
      prismaMock.subscriptionPlan.findMany.mockResolvedValue([]);

      const result = await subscriptionService.getPlans();

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // createSubscription
  // ============================================================================
  describe('createSubscription', () => {
    const mockStripeSubscription = {
      id: 'sub_new',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      latest_invoice: {
        payment_intent: { client_secret: 'pi_secret' },
      },
    };

    it('should create subscription successfully', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());

      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);

      const mockCreatedSub = createMockSubscription();
      prismaMock.saasSubscription.upsert.mockResolvedValue(mockCreatedSub);

      const result = await subscriptionService.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'monthly',
      });

      expect(result).toHaveProperty('planCode', 'PRO');
      expect(mockStripe.customers.create).toHaveBeenCalled();
      expect(mockStripe.subscriptions.create).toHaveBeenCalled();
    });

    it('should throw when tenant not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.createSubscription({
          tenantId: 'nonexistent',
          planCode: 'PRO',
          billingPeriod: 'monthly',
        })
      ).rejects.toThrow('Tenant non trovato');
    });

    it('should throw when subscription already active', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ status: 'ACTIVE' })
      );

      await expect(
        subscriptionService.createSubscription({
          tenantId: 'tenant-123',
          planCode: 'PRO',
          billingPeriod: 'monthly',
        })
      ).rejects.toThrow('Subscription già attiva');
    });

    it('should throw when plan not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.createSubscription({
          tenantId: 'tenant-123',
          planCode: 'INVALID',
          billingPeriod: 'monthly',
        })
      ).rejects.toThrow('Piano non trovato');
    });

    it('should reuse existing Stripe customer ID', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ status: 'CANCELLED' as SaasSubscriptionStatus, stripeCustomerId: 'cus_existing' })
      );
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

      await subscriptionService.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'monthly',
      });

      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should attach payment method when provided', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_pm' });
      mockStripe.paymentMethods.attach.mockResolvedValue({});
      mockStripe.customers.update.mockResolvedValue({});
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

      await subscriptionService.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'monthly',
        paymentMethodId: 'pm_123',
      });

      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
        customer: 'cus_pm',
      });
      expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_pm', {
        invoice_settings: {
          default_payment_method: 'pm_123',
        },
      });
    });

    it('should use yearly price when specified', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_yearly' });
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

      await subscriptionService.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'yearly',
      });

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ price: 'price_pro_yearly' }],
        })
      );
    });
  });

  // ============================================================================
  // createTrialSubscription
  // ============================================================================
  describe('createTrialSubscription', () => {
    it('should create trial subscription', async () => {
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      const mockTrialSub = createMockSubscription({
        status: 'TRIALING' as SaasSubscriptionStatus,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      prismaMock.saasSubscription.create.mockResolvedValue(mockTrialSub);

      const result = await subscriptionService.createTrialSubscription('tenant-123', 'PRO');

      expect(result.status).toBe('TRIALING');
      expect(result.trialEndsAt).toBeDefined();
      expect(prismaMock.saasSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          status: 'TRIALING',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw when plan not found', async () => {
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.createTrialSubscription('tenant-123', 'INVALID')
      ).rejects.toThrow('Piano non trovato');
    });

    it('should set trial end date based on DEFAULT_TRIAL_DAYS', async () => {
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      const mockTrialSub = createMockSubscription({ status: 'TRIALING' as SaasSubscriptionStatus });
      prismaMock.saasSubscription.create.mockResolvedValue(mockTrialSub);

      await subscriptionService.createTrialSubscription('tenant-123', 'PRO');

      const createCall = prismaMock.saasSubscription.create.mock.calls[0][0];
      const trialEndsAt = createCall.data.trialEndsAt as Date;
      const expectedTrialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance for test execution time
      expect(Math.abs(trialEndsAt.getTime() - expectedTrialEnd.getTime())).toBeLessThan(60000);
    });
  });

  // ============================================================================
  // updateSubscription
  // ============================================================================
  describe('updateSubscription', () => {
    const mockStripeSubRetrieve = {
      id: 'sub_stripe_123',
      items: {
        data: [{ id: 'si_123', plan: { interval: 'month' } }],
      },
    };

    it('should update cancel at period end', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(createMockSubscription());
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      await subscriptionService.updateSubscription('tenant-123', {
        cancelAtPeriodEnd: true,
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        { cancel_at_period_end: true }
      );
    });

    it('should throw when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.updateSubscription('nonexistent', {})
      ).rejects.toThrow('Subscription non trovata');
    });

    it('should throw when not connected to Stripe', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ stripeSubscriptionId: null })
      );

      await expect(
        subscriptionService.updateSubscription('tenant-123', {})
      ).rejects.toThrow('Subscription non collegata a Stripe');
    });

    it('should change plan', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(
        createMockPlan({ code: 'BUSINESS' })
      );
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubRetrieve);
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(createMockSubscription());
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      await subscriptionService.updateSubscription('tenant-123', {
        planCode: 'BUSINESS',
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        expect.objectContaining({
          items: [{ id: 'si_123', price: 'price_business_monthly' }],
          proration_behavior: 'create_prorations',
        })
      );
    });

    it('should throw when new plan not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.updateSubscription('tenant-123', {
          planCode: 'NONEXISTENT',
        })
      ).rejects.toThrow('Nuovo piano non trovato');
    });
  });

  // ============================================================================
  // cancelSubscription
  // ============================================================================
  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      mockStripe.subscriptions.cancel.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'CANCELLED' as SaasSubscriptionStatus })
      );

      await subscriptionService.cancelSubscription('tenant-123');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_123');
      expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription('nonexistent')
      ).rejects.toThrow('Subscription non trovata');
    });

    it('should handle subscription without Stripe ID', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ stripeSubscriptionId: null })
      );
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'CANCELLED' as SaasSubscriptionStatus })
      );

      await subscriptionService.cancelSubscription('tenant-123');

      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(prismaMock.saasSubscription.update).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // pauseSubscription
  // ============================================================================
  describe('pauseSubscription', () => {
    it('should pause subscription', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'PAUSED' as SaasSubscriptionStatus })
      );

      await subscriptionService.pauseSubscription('tenant-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        { pause_collection: { behavior: 'void' } }
      );
      expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'PAUSED' },
      });
    });

    it('should throw when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.pauseSubscription('nonexistent')
      ).rejects.toThrow('Subscription non trovata');
    });
  });

  // ============================================================================
  // resumeSubscription
  // ============================================================================
  describe('resumeSubscription', () => {
    it('should resume paused subscription', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ status: 'PAUSED' as SaasSubscriptionStatus })
      );
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'ACTIVE' as SaasSubscriptionStatus })
      );

      await subscriptionService.resumeSubscription('tenant-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        { pause_collection: '' }
      );
      expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'ACTIVE' },
      });
    });

    it('should throw when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.resumeSubscription('nonexistent')
      ).rejects.toThrow('Subscription non trovata');
    });
  });

  // ============================================================================
  // createPortalSession
  // ============================================================================
  describe('createPortalSession', () => {
    it('should create billing portal session', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/xyz',
      });

      const result = await subscriptionService.createPortalSession('tenant-123');

      expect(result.url).toBe('https://billing.stripe.com/session/xyz');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_stripe_123',
        return_url: 'http://localhost:5173/settings/billing',
      });
    });

    it('should use custom return URL when provided', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/abc',
      });

      await subscriptionService.createPortalSession(
        'tenant-123',
        'https://custom.url/billing'
      );

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_stripe_123',
        return_url: 'https://custom.url/billing',
      });
    });

    it('should throw when customer not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ stripeCustomerId: null })
      );

      await expect(
        subscriptionService.createPortalSession('tenant-123')
      ).rejects.toThrow('Customer Stripe non trovato');
    });
  });

  // ============================================================================
  // createCheckoutSession
  // ============================================================================
  describe('createCheckoutSession', () => {
    it('should create checkout session for subscription', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session',
      });

      const result = await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'monthly'
      );

      expect(result.sessionId).toBe('cs_123');
      expect(result.url).toBe('https://checkout.stripe.com/session');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
          locale: 'it',
        })
      );
    });

    it('should throw when tenant not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.createCheckoutSession('nonexistent', 'PRO', 'monthly')
      ).rejects.toThrow('Tenant non trovato');
    });

    it('should throw when plan not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.createCheckoutSession('tenant-123', 'INVALID', 'monthly')
      ).rejects.toThrow('Piano non trovato');
    });

    it('should use existing Stripe customer when available', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: { stripeCustomerId: 'cus_existing' },
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_456',
        url: 'https://checkout.stripe.com/session',
      });

      await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'monthly'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
        })
      );
    });
  });

  // ============================================================================
  // handleStripeWebhook
  // ============================================================================
  describe('handleStripeWebhook', () => {
    describe('customer.subscription.created', () => {
      it('should sync subscription from Stripe', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_new',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalled();
      });
    });

    describe('customer.subscription.deleted', () => {
      it('should mark subscription as cancelled', async () => {
        prismaMock.saasSubscription.update.mockResolvedValue(
          createMockSubscription({ status: 'CANCELLED' as SaasSubscriptionStatus })
        );

        const event = {
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_cancelled',
              metadata: { tenantId: 'tenant-123' },
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-123' },
          data: { status: 'CANCELLED' },
        });
      });
    });

    describe('invoice.paid', () => {
      it('should record billing history', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(createMockSubscription());
        prismaMock.billingHistory.findFirst.mockResolvedValue(null);
        prismaMock.billingHistory.create.mockResolvedValue({} as any);

        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_123',
              subscription: 'sub_stripe_123',
              amount_paid: 4900,
              hosted_invoice_url: 'https://invoice.stripe.com/123',
              period_start: Math.floor(Date.now() / 1000),
              period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            stripeInvoiceId: 'in_123',
            amount: 49.00,
            status: 'paid',
          }),
        });
      });
    });

    describe('invoice.payment_failed', () => {
      it('should update subscription to PAST_DUE', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(createMockSubscription());
        prismaMock.billingHistory.findFirst.mockResolvedValue(null);
        prismaMock.billingHistory.create.mockResolvedValue({} as any);
        prismaMock.saasSubscription.update.mockResolvedValue(
          createMockSubscription({ status: 'PAST_DUE' as SaasSubscriptionStatus })
        );

        const event = {
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_failed',
              subscription: 'sub_stripe_123',
              amount_paid: 0,
              period_start: Math.floor(Date.now() / 1000),
              period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-1' },
          data: { status: 'PAST_DUE' },
        });
      });
    });

    describe('checkout.session.completed', () => {
      it('should sync subscription from checkout session', async () => {
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_from_checkout',
          customer: 'cus_123',
          metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          trial_end: null,
          cancel_at_period_end: false,
        });
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());
        prismaMock.saasSubscription.update.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_from_checkout',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_from_checkout');
        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalled();
      });
    });

    it('should handle unknown event types', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const event = {
        type: 'unknown.event',
        data: { object: {} },
      };

      await subscriptionService.handleStripeWebhook(event as any);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled subscription event: unknown.event');
      consoleSpy.mockRestore();
    });
  });
});
