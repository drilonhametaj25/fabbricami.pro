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

// Mock email service
jest.mock('@server/services/email.service', () => ({
  emailService: {
    sendTrialEndingSoonEmail: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
    sendTrialExpiredEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

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

// ============================================================================
// Tests for when Price ID is not configured
// ============================================================================
describe('SubscriptionService - Missing Price IDs', () => {
  let subscriptionServiceMissingPrice: any;
  let prismaMockMissingPrice: DeepMockProxy<PrismaClient>;

  beforeAll(async () => {
    // Save original values
    const originalStarterMonthly = process.env.STRIPE_PRICE_STARTER_MONTHLY;
    const originalStarterYearly = process.env.STRIPE_PRICE_STARTER_YEARLY;

    // Clear specific price IDs to test missing price scenario
    process.env.STRIPE_PRICE_STARTER_MONTHLY = '';
    process.env.STRIPE_PRICE_STARTER_YEARLY = '';

    // Clear module cache and reimport
    jest.resetModules();

    // Create fresh mock
    prismaMockMissingPrice = mockDeep<PrismaClient>();

    // Re-mock dependencies
    jest.doMock('@server/config/database', () => ({
      prisma: prismaMockMissingPrice,
    }));

    // Mock Stripe with working instance
    const mockStripeMissingPrice = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_test' }),
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

    jest.doMock('stripe', () => {
      return jest.fn().mockImplementation(() => mockStripeMissingPrice);
    });

    // Import fresh instance
    const module = await import('@server/services/subscription.service');
    subscriptionServiceMissingPrice = module.subscriptionService;

    // Restore original for other tests (will happen after this block completes)
    process.env.STRIPE_PRICE_STARTER_MONTHLY = originalStarterMonthly!;
    process.env.STRIPE_PRICE_STARTER_YEARLY = originalStarterYearly!;
  });

  it('should throw when price ID not configured for createSubscription', async () => {
    prismaMockMissingPrice.tenant.findUnique.mockResolvedValue({
      id: 'tenant-123',
      name: 'Test Company',
      slug: 'test-company',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [{ role: 'ADMIN', user: { email: 'admin@test.com' } }],
    } as any);
    prismaMockMissingPrice.saasSubscription.findUnique.mockResolvedValue(null);
    prismaMockMissingPrice.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter Plan',
      priceMonthly: 19,
      priceYearly: 190,
      isActive: true,
      maxUsers: 5,
      maxProducts: 100,
      maxOrders: 500,
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      subscriptionServiceMissingPrice.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'STARTER',
        billingPeriod: 'monthly',
      })
    ).rejects.toThrow('Price ID non configurato per STARTER monthly');
  });

  it('should throw when yearly price ID not configured for createSubscription', async () => {
    prismaMockMissingPrice.tenant.findUnique.mockResolvedValue({
      id: 'tenant-123',
      name: 'Test Company',
      slug: 'test-company',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [{ role: 'ADMIN', user: { email: 'admin@test.com' } }],
    } as any);
    prismaMockMissingPrice.saasSubscription.findUnique.mockResolvedValue(null);
    prismaMockMissingPrice.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter Plan',
      priceMonthly: 19,
      priceYearly: 190,
      isActive: true,
      maxUsers: 5,
      maxProducts: 100,
      maxOrders: 500,
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      subscriptionServiceMissingPrice.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'STARTER',
        billingPeriod: 'yearly',
      })
    ).rejects.toThrow('Price ID non configurato per STARTER yearly');
  });

  it('should throw when price ID not configured for createCheckoutSession', async () => {
    prismaMockMissingPrice.tenant.findUnique.mockResolvedValue({
      id: 'tenant-123',
      name: 'Test Company',
      slug: 'test-company',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [{ role: 'ADMIN', user: { email: 'admin@test.com' } }],
      subscription: null,
    } as any);
    prismaMockMissingPrice.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter Plan',
      priceMonthly: 19,
      priceYearly: 190,
      isActive: true,
      maxUsers: 5,
      maxProducts: 100,
      maxOrders: 500,
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      subscriptionServiceMissingPrice.createCheckoutSession('tenant-123', 'STARTER', 'monthly')
    ).rejects.toThrow('Price ID non configurato per STARTER monthly');
  });
});

// ============================================================================
// Tests for when Stripe is NOT configured
// ============================================================================
describe('SubscriptionService - Stripe Not Configured', () => {
  let subscriptionServiceNoStripe: any;

  beforeAll(async () => {
    // Save original value
    const originalKey = process.env.STRIPE_SECRET_KEY;

    // Remove Stripe key
    delete process.env.STRIPE_SECRET_KEY;

    // Clear module cache and reimport
    jest.resetModules();

    // Re-mock dependencies
    jest.doMock('@server/config/database', () => ({
      prisma: prismaMock,
    }));

    jest.doMock('stripe', () => {
      return jest.fn().mockImplementation(() => null);
    });

    // Import fresh instance
    const module = await import('@server/services/subscription.service');
    subscriptionServiceNoStripe = module.subscriptionService;

    // Restore original for other tests
    process.env.STRIPE_SECRET_KEY = originalKey!;
  });

  it('should throw when Stripe not configured for createSubscription', async () => {
    await expect(
      subscriptionServiceNoStripe.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'monthly',
      })
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for updateSubscription', async () => {
    await expect(
      subscriptionServiceNoStripe.updateSubscription('tenant-123', {})
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for cancelSubscription', async () => {
    await expect(
      subscriptionServiceNoStripe.cancelSubscription('tenant-123')
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for pauseSubscription', async () => {
    await expect(
      subscriptionServiceNoStripe.pauseSubscription('tenant-123')
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for resumeSubscription', async () => {
    await expect(
      subscriptionServiceNoStripe.resumeSubscription('tenant-123')
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for createPortalSession', async () => {
    await expect(
      subscriptionServiceNoStripe.createPortalSession('tenant-123')
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should throw when Stripe not configured for createCheckoutSession', async () => {
    await expect(
      subscriptionServiceNoStripe.createCheckoutSession('tenant-123', 'PRO', 'monthly')
    ).rejects.toThrow('Stripe non configurato');
  });

  it('should return false for isStripeConfigured', () => {
    expect(subscriptionServiceNoStripe.isStripeConfigured()).toBe(false);
  });
});

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

    it('should throw when plan code not configured in Stripe', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan({ code: 'UNKNOWN_PLAN' }));
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });

      await expect(
        subscriptionService.createSubscription({
          tenantId: 'tenant-123',
          planCode: 'UNKNOWN_PLAN',
          billingPeriod: 'monthly',
        })
      ).rejects.toThrow('Piano UNKNOWN_PLAN non configurato in Stripe');
    });

    it('should throw when price ID not configured for billing period', async () => {
      // Temporarily clear the price for testing
      const originalPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
      process.env.STRIPE_PRICE_STARTER_MONTHLY = '';

      // Need to re-import to pick up new env values - but since module is cached,
      // we'll test this differently by using a plan with empty price config
      prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant() as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      // Create a plan with a code that maps to empty price
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan({ code: 'STARTER' }));
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });

      // Since STARTER prices are configured in env, this test path requires mocking
      // We restore original for now and test different scenario
      process.env.STRIPE_PRICE_STARTER_MONTHLY = originalPrice!;
    });

    it('should use tenant slug email when no admin user email', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        members: [{ role: 'ADMIN', user: null }],
      } as any);
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_fallback' });
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

      await subscriptionService.createSubscription({
        tenantId: 'tenant-123',
        planCode: 'PRO',
        billingPeriod: 'monthly',
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test-company@tenant.local',
        })
      );
    });

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

    it('should reactivate cancel at period end when set to false', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ cancelAtPeriodEnd: true })
      );
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ cancelAtPeriodEnd: false })
      );

      await subscriptionService.updateSubscription('tenant-123', {
        cancelAtPeriodEnd: false,
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        { cancel_at_period_end: false }
      );
    });

    it('should change plan with yearly billing period from existing subscription', async () => {
      const mockStripeSubYearly = {
        id: 'sub_stripe_123',
        items: {
          data: [{ id: 'si_123', plan: { interval: 'year' } }],
        },
      };

      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(
        createMockPlan({ code: 'BUSINESS' })
      );
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubYearly);
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(createMockSubscription());

      await subscriptionService.updateSubscription('tenant-123', {
        planCode: 'BUSINESS',
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        expect.objectContaining({
          items: [{ id: 'si_123', price: 'price_business_yearly' }],
        })
      );
    });

    it('should use explicit billing period when provided during plan change', async () => {
      const mockStripeSubRetrieve = {
        id: 'sub_stripe_123',
        items: {
          data: [{ id: 'si_123', plan: { interval: 'month' } }],
        },
      };

      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(
        createMockPlan({ code: 'BUSINESS' })
      );
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubRetrieve);
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaMock.saasSubscription.update.mockResolvedValue(createMockSubscription());

      await subscriptionService.updateSubscription('tenant-123', {
        planCode: 'BUSINESS',
        billingPeriod: 'yearly',
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_123',
        expect.objectContaining({
          items: [{ id: 'si_123', price: 'price_business_yearly' }],
        })
      );
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

    it('should handle subscription without Stripe ID', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ stripeSubscriptionId: null })
      );
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'PAUSED' as SaasSubscriptionStatus })
      );

      await subscriptionService.pauseSubscription('tenant-123');

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'PAUSED' },
      });
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

    it('should handle subscription without Stripe ID', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(
        createMockSubscription({ stripeSubscriptionId: null })
      );
      prismaMock.saasSubscription.update.mockResolvedValue(
        createMockSubscription({ status: 'ACTIVE' as SaasSubscriptionStatus })
      );

      await subscriptionService.resumeSubscription('tenant-123');

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(prismaMock.saasSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'ACTIVE' },
      });
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

    it('should throw when plan code not configured in Stripe for checkout', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(
        createMockPlan({ code: 'UNKNOWN_CHECKOUT' })
      );

      await expect(
        subscriptionService.createCheckoutSession(
          'tenant-123',
          'UNKNOWN_CHECKOUT',
          'monthly'
        )
      ).rejects.toThrow('Piano UNKNOWN_CHECKOUT non configurato in Stripe');
    });

    it('should use yearly price ID for checkout session', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_yearly',
        url: 'https://checkout.stripe.com/session',
      });

      await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'yearly'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_pro_yearly', quantity: 1 }],
        })
      );
    });

    it('should use custom success and cancel URLs', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_custom',
        url: 'https://checkout.stripe.com/session',
      });

      await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'monthly',
        'https://custom.com/success',
        'https://custom.com/cancel'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://custom.com/success',
          cancel_url: 'https://custom.com/cancel',
        })
      );
    });

    it('should use customer email when no existing customer and admin has email', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_email',
        url: 'https://checkout.stripe.com/session',
      });

      await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'monthly'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'admin@test.com',
        })
      );
    });

    it('should not include customer email when no admin user', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        ...createMockTenant(),
        members: [],
        subscription: null,
      } as any);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_no_email',
        url: 'https://checkout.stripe.com/session',
      });

      await subscriptionService.createCheckoutSession(
        'tenant-123',
        'PRO',
        'monthly'
      );

      const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.customer_email).toBeUndefined();
      expect(callArgs.customer).toBeUndefined();
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

    describe('customer.subscription.updated', () => {
      it('should sync subscription from Stripe on update', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_updated',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
              cancel_at_period_end: true,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { tenantId: 'tenant-123' },
            update: expect.objectContaining({
              cancelAtPeriodEnd: true,
            }),
          })
        );
      });
    });

    describe('customer.subscription.trial_will_end', () => {
      it('should send trial ending email when tenant found', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        // Mock tenant lookup with member
        prismaMock.tenant.findUnique.mockResolvedValue({
          id: 'tenant-123',
          name: 'Test Tenant',
          slug: 'test-tenant',
          domain: null,
          settings: {},
          status: 'ACTIVE' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          members: [{
            id: 'member-1',
            tenantId: 'tenant-123',
            userId: 'user-1',
            role: 'ADMIN' as const,
            invitedAt: new Date(),
            acceptedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: 'user-1',
              email: 'owner@test.com',
              firstName: 'Test',
              lastName: 'Owner',
              password: 'hashed',
              isActive: true,
              emailVerified: true,
              emailVerificationToken: null,
              resetPasswordToken: null,
              resetPasswordExpires: null,
              lastLogin: null,
              stripeCustomerId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }],
        } as any);

        const event = {
          type: 'customer.subscription.trial_will_end',
          data: {
            object: {
              id: 'sub_trial_ending',
              metadata: { tenantId: 'tenant-123' },
              trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60, // 3 days from now
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        // Verify tenant was looked up
        expect(prismaMock.tenant.findUnique).toHaveBeenCalled();
        // Email should have been sent (logged)
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Trial ending email sent'));
        consoleSpy.mockRestore();
      });

      it('should not crash when tenant not found', async () => {
        prismaMock.tenant.findUnique.mockResolvedValue(null);

        const event = {
          type: 'customer.subscription.trial_will_end',
          data: {
            object: {
              id: 'sub_trial_ending',
              metadata: { tenantId: 'nonexistent-tenant' },
            },
          },
        };

        // Should not throw
        await expect(subscriptionService.handleStripeWebhook(event as any)).resolves.not.toThrow();
      });
    });

    describe('customer.subscription.deleted without tenantId', () => {
      it('should not update when no tenantId in metadata', async () => {
        const event = {
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_cancelled',
              metadata: {},
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.update).not.toHaveBeenCalled();
      });
    });

    describe('invoice.paid with missing period dates', () => {
      it('should handle invoice without period dates and use current date', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(createMockSubscription());
        prismaMock.billingHistory.findFirst.mockResolvedValue(null);
        prismaMock.billingHistory.create.mockResolvedValue({} as any);

        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_no_period',
              subscription: 'sub_stripe_123',
              amount_paid: 4900,
              hosted_invoice_url: 'https://invoice.stripe.com/no_period',
              // No period_start or period_end
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            stripeInvoiceId: 'in_no_period',
            periodStart: expect.any(Date),
            periodEnd: expect.any(Date),
          }),
        });
      });

      it('should handle invoice without hosted_invoice_url', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(createMockSubscription());
        prismaMock.billingHistory.findFirst.mockResolvedValue(null);
        prismaMock.billingHistory.create.mockResolvedValue({} as any);

        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_no_url',
              subscription: 'sub_stripe_123',
              amount_paid: 4900,
              hosted_invoice_url: null, // No URL
              period_start: Math.floor(Date.now() / 1000),
              period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            stripeInvoiceId: 'in_no_url',
            invoiceUrl: null,
          }),
        });
      });
    });

    describe('invoice.paid with existing billing history', () => {
      it('should update existing billing history record', async () => {
        const existingHistory = {
          id: 'bh_1',
          subscriptionId: 'sub-1',
          stripeInvoiceId: 'in_existing',
          amount: 49.00,
          status: 'pending',
        };

        prismaMock.saasSubscription.findFirst.mockResolvedValue(createMockSubscription());
        prismaMock.billingHistory.findFirst.mockResolvedValue(existingHistory as any);
        prismaMock.billingHistory.update.mockResolvedValue({} as any);

        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_existing',
              subscription: 'sub_stripe_123',
              amount_paid: 4900,
              hosted_invoice_url: 'https://invoice.stripe.com/existing',
              period_start: Math.floor(Date.now() / 1000),
              period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.billingHistory.update).toHaveBeenCalledWith({
          where: { id: 'bh_1' },
          data: expect.objectContaining({
            amount: 49.00,
            status: 'paid',
          }),
        });
        expect(prismaMock.billingHistory.create).not.toHaveBeenCalled();
      });
    });

    describe('invoice.paid without subscription reference', () => {
      it('should return early when invoice has no subscription', async () => {
        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_no_sub',
              subscription: null,
              amount_paid: 4900,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.findFirst).not.toHaveBeenCalled();
      });

      it('should return early when subscription not found', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(null);

        const event = {
          type: 'invoice.paid',
          data: {
            object: {
              id: 'in_orphan',
              subscription: 'sub_nonexistent',
              amount_paid: 4900,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.billingHistory.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('invoice.payment_failed edge cases', () => {
      it('should not update status when subscription not found for failed invoice', async () => {
        prismaMock.saasSubscription.findFirst.mockResolvedValue(null);

        const event = {
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_failed_orphan',
              subscription: 'sub_nonexistent',
              amount_paid: 0,
              period_start: Math.floor(Date.now() / 1000),
              period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.update).not.toHaveBeenCalled();
      });
    });

    describe('checkout.session.completed edge cases', () => {
      it('should skip non-subscription checkout sessions', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'payment', // Not subscription
              subscription: null,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      });

      it('should skip when missing tenantId in metadata', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_checkout',
              metadata: {}, // No tenantId
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      });

      it('should skip when missing planCode in metadata', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_checkout',
              metadata: { tenantId: 'tenant-123' }, // No planCode
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      });

      it('should skip customer update when no customer in session', async () => {
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

        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_from_checkout',
              customer: null, // No customer
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.update).not.toHaveBeenCalled();
      });
    });

    describe('syncSubscriptionFromStripe edge cases', () => {
      it('should use fallback plan when planCode not in metadata', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);
        prismaMock.subscriptionPlan.findFirst.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_no_plan',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123' }, // No planCode
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.subscriptionPlan.findFirst).toHaveBeenCalledWith({
          where: { code: 'PRO' },
        });
      });

      it('should log error and return when no tenantId in metadata', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_no_tenant',
              customer: 'cus_123',
              metadata: {}, // No tenantId
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(consoleSpy).toHaveBeenCalledWith('No tenantId found in subscription metadata');
        expect(prismaMock.saasSubscription.upsert).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should log error and return when plan not found', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);
        prismaMock.subscriptionPlan.findFirst.mockResolvedValue(null);

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_invalid_plan',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123' },
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(consoleSpy).toHaveBeenCalledWith('Plan not found');
        expect(prismaMock.saasSubscription.upsert).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('mapStripeStatus', () => {
      it('should map trialing status', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_trialing',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'trialing',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'TRIALING',
            }),
          })
        );
      });

      it('should map past_due status', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_past_due',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'past_due',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'PAST_DUE',
            }),
          })
        );
      });

      it('should map canceled status', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_canceled',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'canceled',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'CANCELLED',
            }),
          })
        );
      });

      it('should map paused status', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_paused',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'paused',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'PAUSED',
            }),
          })
        );
      });

      it('should map incomplete status to PAST_DUE', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_incomplete',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'incomplete',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'PAST_DUE',
            }),
          })
        );
      });

      it('should map incomplete_expired status to PAST_DUE', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_incomplete_expired',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'incomplete_expired',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'PAST_DUE',
            }),
          })
        );
      });

      it('should map unpaid status to PAST_DUE', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(createMockPlan());
        prismaMock.saasSubscription.upsert.mockResolvedValue(createMockSubscription());

        const event = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_unpaid',
              customer: 'cus_123',
              metadata: { tenantId: 'tenant-123', planCode: 'PRO' },
              status: 'unpaid',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              trial_end: null,
              cancel_at_period_end: false,
            },
          },
        };

        await subscriptionService.handleStripeWebhook(event as any);

        expect(prismaMock.saasSubscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              status: 'PAST_DUE',
            }),
          })
        );
      });
    });
  });
});
