/**
 * @file billing.service.test.ts
 * @description Unit tests for billing service
 * @coverage ~30 tests covering usage stats, billing history, proration
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, SaasSubscriptionStatus } from '@prisma/client';

// Create mocks
const prismaMock = mockDeep<PrismaClient>();

// Mock database
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock subscription middleware
const mockCheckPlanLimit = jest.fn();
const mockGetPlanLimits = jest.fn();

jest.mock('@server/middleware/subscription.middleware', () => ({
  checkPlanLimit: mockCheckPlanLimit,
  getPlanLimits: mockGetPlanLimits,
}));

// Import service after mocks
import { billingService } from '@server/services/billing.service';

describe('BillingService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();

    // Default plan limits
    mockGetPlanLimits.mockReturnValue({
      maxUsers: 5,
      maxWarehouses: 2,
      maxProducts: 500,
      maxOrders: 1000,
      maxSuppliers: 50,
      features: ['basic_reports', 'inventory_tracking'],
    });
  });

  // Test data factories
  const createMockSubscription = (overrides = {}) => ({
    id: 'sub-1',
    tenantId: 'tenant-123',
    planId: 'plan-1',
    status: 'ACTIVE' as SaasSubscriptionStatus,
    currentPeriodStart: new Date('2025-01-01'),
    currentPeriodEnd: new Date('2025-02-01'),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    stripeSubscriptionId: 'sub_stripe_123',
    stripeCustomerId: 'cus_stripe_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: {
      code: 'PRO',
      name: 'Pro Plan',
      priceMonthly: 49,
      priceYearly: 490,
    },
    billing: [],
    ...overrides,
  });

  const createMockBillingHistory = (overrides = {}) => ({
    id: 'bh-1',
    subscriptionId: 'sub-1',
    stripeInvoiceId: 'in_123',
    amount: 49.00,
    status: 'paid',
    invoiceUrl: 'https://invoice.stripe.com/123',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-02-01'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date(),
    ...overrides,
  });

  // ============================================================================
  // getBillingSummary
  // ============================================================================
  describe('getBillingSummary', () => {
    it('should return complete billing summary', async () => {
      const mockSub = createMockSubscription({
        billing: [createMockBillingHistory()],
      });
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(mockSub);
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(mockSub);
      prismaMock.user.count.mockResolvedValue(3);
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(200);
      prismaMock.order.count.mockResolvedValue(150);
      prismaMock.supplier.count.mockResolvedValue(10);

      const result = await billingService.getBillingSummary('tenant-123');

      expect(result).toHaveProperty('subscription');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('recentInvoices');
      expect(result.subscription?.planCode).toBe('PRO');
      expect(result.subscription?.planName).toBe('Pro Plan');
    });

    it('should return null subscription when not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(null);
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.warehouse.count.mockResolvedValue(0);
      prismaMock.product.count.mockResolvedValue(0);
      prismaMock.order.count.mockResolvedValue(0);
      prismaMock.supplier.count.mockResolvedValue(0);

      const result = await billingService.getBillingSummary('tenant-123');

      expect(result.subscription).toBeNull();
      expect(result.recentInvoices).toEqual([]);
    });

    it('should format recent invoices correctly', async () => {
      const mockBillingItems = [
        createMockBillingHistory({ id: 'bh-1', amount: 49.00 }),
        createMockBillingHistory({ id: 'bh-2', amount: 49.00 }),
      ];
      const mockSub = createMockSubscription({ billing: mockBillingItems });
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(mockSub);
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(mockSub);
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(10);
      prismaMock.order.count.mockResolvedValue(5);
      prismaMock.supplier.count.mockResolvedValue(2);

      const result = await billingService.getBillingSummary('tenant-123');

      expect(result.recentInvoices).toHaveLength(2);
      expect(result.recentInvoices[0]).toHaveProperty('id');
      expect(result.recentInvoices[0]).toHaveProperty('date');
      expect(result.recentInvoices[0]).toHaveProperty('amount');
      expect(result.recentInvoices[0]).toHaveProperty('status');
      expect(result.recentInvoices[0]).toHaveProperty('invoiceUrl');
    });
  });

  // ============================================================================
  // getUsageStats
  // ============================================================================
  describe('getUsageStats', () => {
    it('should calculate usage percentages correctly', async () => {
      const mockSub = createMockSubscription();
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);
      prismaMock.user.count.mockResolvedValue(3);
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(250);
      prismaMock.order.count.mockResolvedValue(500);
      prismaMock.supplier.count.mockResolvedValue(25);

      const result = await billingService.getUsageStats('tenant-123');

      expect(result.users).toEqual({ current: 3, limit: 5, percentage: 60 });
      expect(result.warehouses).toEqual({ current: 1, limit: 2, percentage: 50 });
      expect(result.products).toEqual({ current: 250, limit: 500, percentage: 50 });
      expect(result.orders).toEqual({ current: 500, limit: 1000, percentage: 50 });
      expect(result.suppliers).toEqual({ current: 25, limit: 50, percentage: 50 });
    });

    it('should handle unlimited resources (-1 limit)', async () => {
      mockGetPlanLimits.mockReturnValue({
        maxUsers: -1,
        maxWarehouses: -1,
        maxProducts: -1,
        maxOrders: -1,
        maxSuppliers: -1,
        features: [],
      });

      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.user.count.mockResolvedValue(100);
      prismaMock.warehouse.count.mockResolvedValue(10);
      prismaMock.product.count.mockResolvedValue(5000);
      prismaMock.order.count.mockResolvedValue(10000);
      prismaMock.supplier.count.mockResolvedValue(500);

      const result = await billingService.getUsageStats('tenant-123');

      expect(result.users).toEqual({ current: 100, limit: -1, percentage: 0 });
      expect(result.warehouses).toEqual({ current: 10, limit: -1, percentage: 0 });
    });

    it('should use STARTER plan when no subscription', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(10);
      prismaMock.order.count.mockResolvedValue(5);
      prismaMock.supplier.count.mockResolvedValue(2);

      await billingService.getUsageStats('tenant-123');

      expect(mockGetPlanLimits).toHaveBeenCalledWith('STARTER');
    });

    it('should count only orders from current month', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(10);
      prismaMock.order.count.mockResolvedValue(50);
      prismaMock.supplier.count.mockResolvedValue(2);

      await billingService.getUsageStats('tenant-123');

      // Verify order count query includes date filter
      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          createdAt: { gte: expect.any(Date) },
        },
      });
    });
  });

  // ============================================================================
  // getBillingHistory
  // ============================================================================
  describe('getBillingHistory', () => {
    it('should return paginated billing history', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.billingHistory.findMany.mockResolvedValue([
        createMockBillingHistory({ id: 'bh-1' }),
        createMockBillingHistory({ id: 'bh-2' }),
      ]);
      prismaMock.billingHistory.count.mockResolvedValue(5);

      const result = await billingService.getBillingHistory('tenant-123', 1, 2);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.pages).toBe(3);
    });

    it('should return empty when no subscription', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      const result = await billingService.getBillingHistory('tenant-123');

      expect(result).toEqual({ items: [], total: 0, pages: 0 });
    });

    it('should handle pagination correctly', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.billingHistory.findMany.mockResolvedValue([]);
      prismaMock.billingHistory.count.mockResolvedValue(50);

      await billingService.getBillingHistory('tenant-123', 3, 10);

      expect(prismaMock.billingHistory.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: 'sub-1' },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });

    it('should format billing items correctly', async () => {
      const mockItem = createMockBillingHistory();
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.billingHistory.findMany.mockResolvedValue([mockItem]);
      prismaMock.billingHistory.count.mockResolvedValue(1);

      const result = await billingService.getBillingHistory('tenant-123');

      expect(result.items[0]).toEqual({
        id: 'bh-1',
        date: mockItem.createdAt,
        amount: 49.00,
        status: 'paid',
        invoiceUrl: 'https://invoice.stripe.com/123',
      });
    });
  });

  // ============================================================================
  // canCreateResource
  // ============================================================================
  describe('canCreateResource', () => {
    it('should delegate to checkPlanLimit', async () => {
      mockCheckPlanLimit.mockResolvedValue({
        allowed: true,
        current: 3,
        limit: 5,
      });

      const result = await billingService.canCreateResource('tenant-123', 'users');

      expect(mockCheckPlanLimit).toHaveBeenCalledWith('tenant-123', 'users');
      expect(result.allowed).toBe(true);
    });

    it('should return not allowed when limit reached', async () => {
      mockCheckPlanLimit.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        message: 'Limite raggiunto',
      });

      const result = await billingService.canCreateResource('tenant-123', 'users');

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Limite raggiunto');
    });
  });

  // ============================================================================
  // getAvailableFeatures
  // ============================================================================
  describe('getAvailableFeatures', () => {
    it('should return plan features', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      const result = await billingService.getAvailableFeatures('tenant-123');

      expect(result).toEqual(['basic_reports', 'inventory_tracking']);
    });

    it('should use STARTER plan when no subscription', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await billingService.getAvailableFeatures('tenant-123');

      expect(mockGetPlanLimits).toHaveBeenCalledWith('STARTER');
    });
  });

  // ============================================================================
  // hasFeature
  // ============================================================================
  describe('hasFeature', () => {
    it('should return true when feature is available', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      const result = await billingService.hasFeature('tenant-123', 'basic_reports');

      expect(result).toBe(true);
    });

    it('should return false when feature is not available', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());

      const result = await billingService.hasFeature('tenant-123', 'premium_feature');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getUpgradeRecommendations
  // ============================================================================
  describe('getUpgradeRecommendations', () => {
    it('should recommend upgrade when usage is high', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());

      // High usage scenario
      prismaMock.user.count.mockResolvedValue(4); // 80%
      prismaMock.warehouse.count.mockResolvedValue(2); // 100%
      prismaMock.product.count.mockResolvedValue(450); // 90%
      prismaMock.order.count.mockResolvedValue(100);
      prismaMock.supplier.count.mockResolvedValue(10);

      const result = await billingService.getUpgradeRecommendations('tenant-123');

      expect(result.shouldUpgrade).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.recommendedPlan).toBe('BUSINESS');
    });

    it('should not recommend upgrade when usage is low', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());

      // Low usage scenario
      prismaMock.user.count.mockResolvedValue(1); // 20%
      prismaMock.warehouse.count.mockResolvedValue(1); // 50%
      prismaMock.product.count.mockResolvedValue(50); // 10%
      prismaMock.order.count.mockResolvedValue(10);
      prismaMock.supplier.count.mockResolvedValue(5);

      const result = await billingService.getUpgradeRecommendations('tenant-123');

      expect(result.shouldUpgrade).toBe(false);
      expect(result.reasons).toHaveLength(0);
      expect(result.recommendedPlan).toBeNull();
    });

    it('should recommend PRO when on STARTER', async () => {
      const starterSub = createMockSubscription({ plan: { code: 'STARTER', name: 'Starter' } });
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(starterSub);
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(starterSub);

      prismaMock.user.count.mockResolvedValue(4); // 80%
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(100);
      prismaMock.order.count.mockResolvedValue(50);
      prismaMock.supplier.count.mockResolvedValue(5);

      const result = await billingService.getUpgradeRecommendations('tenant-123');

      expect(result.recommendedPlan).toBe('PRO');
    });

    it('should include specific resource warnings', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());
      prismaMock.saasSubscription.findUnique.mockResolvedValueOnce(createMockSubscription());

      prismaMock.user.count.mockResolvedValue(4); // 80%
      prismaMock.warehouse.count.mockResolvedValue(1);
      prismaMock.product.count.mockResolvedValue(450); // 90%
      prismaMock.order.count.mockResolvedValue(10);
      prismaMock.supplier.count.mockResolvedValue(5);

      const result = await billingService.getUpgradeRecommendations('tenant-123');

      expect(result.reasons).toContain('Hai utilizzato 80% degli utenti disponibili');
      expect(result.reasons).toContain('Hai utilizzato 90% dei prodotti disponibili');
    });
  });

  // ============================================================================
  // calculateProration
  // ============================================================================
  describe('calculateProration', () => {
    it('should calculate proration for plan change', async () => {
      const mockSub = {
        ...createMockSubscription(),
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        plan: {
          priceMonthly: 49,
          priceYearly: 490,
        },
      };
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-2',
        code: 'BUSINESS',
        name: 'Business',
        priceMonthly: 99,
        priceYearly: 990,
        isActive: true,
        maxUsers: 20,
        maxProducts: 5000,
        maxOrders: 20000,
        features: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await billingService.calculateProration(
        'tenant-123',
        'BUSINESS',
        'monthly'
      );

      expect(result).toHaveProperty('currentPlanAmount');
      expect(result).toHaveProperty('newPlanAmount');
      expect(result).toHaveProperty('prorationCredit');
      expect(result).toHaveProperty('amountDue');
      expect(result).toHaveProperty('effectiveDate');
      expect(result.newPlanAmount).toBe(99);
    });

    it('should throw when subscription not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(null);

      await expect(
        billingService.calculateProration('nonexistent', 'PRO', 'monthly')
      ).rejects.toThrow('Subscription non trovata');
    });

    it('should throw when new plan not found', async () => {
      prismaMock.saasSubscription.findUnique.mockResolvedValue(createMockSubscription());
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        billingService.calculateProration('tenant-123', 'INVALID', 'monthly')
      ).rejects.toThrow('Piano non trovato');
    });

    it('should use yearly prices when specified', async () => {
      const mockSub = {
        ...createMockSubscription(),
        plan: {
          priceMonthly: 49,
          priceYearly: 490,
        },
      };
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-2',
        code: 'BUSINESS',
        priceMonthly: 99,
        priceYearly: 990,
      } as any);

      const result = await billingService.calculateProration(
        'tenant-123',
        'BUSINESS',
        'yearly'
      );

      expect(result.currentPlanAmount).toBe(490);
      expect(result.newPlanAmount).toBe(990);
    });

    it('should calculate credit based on remaining days', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const mockSub = {
        ...createMockSubscription(),
        currentPeriodStart: startOfMonth,
        currentPeriodEnd: endOfMonth,
        plan: {
          priceMonthly: 30, // $30/month = $1/day
          priceYearly: 300,
        },
      };
      prismaMock.saasSubscription.findUnique.mockResolvedValue(mockSub);
      prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-2',
        code: 'BUSINESS',
        priceMonthly: 60,
        priceYearly: 600,
      } as any);

      const result = await billingService.calculateProration(
        'tenant-123',
        'BUSINESS',
        'monthly'
      );

      expect(result.prorationCredit).toBeGreaterThanOrEqual(0);
      expect(result.amountDue).toBeLessThanOrEqual(60);
    });
  });
});
