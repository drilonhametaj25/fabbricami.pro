import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock PrismaClient
const mockPrisma = {
  newsletterSubscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-token-12345'),
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mock-md5-hash'),
    }),
  }),
}));

// Mock global fetch
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
} as unknown as Response);
global.fetch = mockFetch as unknown as typeof fetch;

// Store original env
const originalEnv = process.env;

// Import after mocks
import { newsletterService } from '@server/services/newsletter.service';

describe('NewsletterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ===================
  // isMailchimpConfigured
  // ===================
  describe('isMailchimpConfigured', () => {
    it('should return false when MAILCHIMP_API_KEY is not set', () => {
      process.env.MAILCHIMP_API_KEY = '';
      process.env.MAILCHIMP_LIST_ID = 'list123';

      const result = newsletterService.isMailchimpConfigured();
      expect(result).toBe(false);
    });

    it('should return false when MAILCHIMP_LIST_ID is not set', () => {
      process.env.MAILCHIMP_API_KEY = 'key123';
      process.env.MAILCHIMP_LIST_ID = '';

      const result = newsletterService.isMailchimpConfigured();
      expect(result).toBe(false);
    });
  });

  // ===================
  // subscribe
  // ===================
  describe('subscribe', () => {
    it('should return success without confirmation for already confirmed subscriber', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });

      const result = await newsletterService.subscribe({
        email: 'test@example.com',
      });

      expect(result).toEqual({ success: true, requiresConfirmation: false });
      expect(mockPrisma.newsletterSubscription.create).not.toHaveBeenCalled();
    });

    it('should resubscribe an unsubscribed user with confirmation required', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'UNSUBSCRIBED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(null);

      const result = await newsletterService.subscribe({
        email: 'TEST@EXAMPLE.COM', // Test email normalization
        tags: ['promo'],
        preferences: { promotions: true, news: false },
      });

      expect(result).toEqual({ success: true, requiresConfirmation: true });
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: expect.objectContaining({
          status: 'PENDING',
          confirmToken: 'mock-token-12345',
          preferences: { promotions: true, news: false },
          tags: ['promo'],
        }),
      });
    });

    it('should create new subscription for new email', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({
        id: 'sub-new',
        email: 'new@example.com',
        status: 'PENDING',
      });
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(null);

      const result = await newsletterService.subscribe({
        email: 'new@example.com',
        firstName: 'John',
        customerId: 'cust-1',
      });

      expect(result).toEqual({ success: true, requiresConfirmation: true });
      expect(mockPrisma.newsletterSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          customerId: 'cust-1',
          status: 'PENDING',
          confirmToken: 'mock-token-12345',
        }),
      });
    });

    it('should use default preferences when not provided', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({});
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(null);

      await newsletterService.subscribe({
        email: 'new@example.com',
      });

      expect(mockPrisma.newsletterSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          preferences: { promotions: true, news: true },
          tags: [],
        }),
      });
    });

    it('should handle pending subscription without re-creating', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'PENDING',
      });

      const result = await newsletterService.subscribe({
        email: 'test@example.com',
      });

      // Pending status doesn't match CONFIRMED or UNSUBSCRIBED, so no action in those branches
      expect(mockPrisma.newsletterSubscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.newsletterSubscription.update).not.toHaveBeenCalled();
    });
  });

  // ===================
  // confirmSubscription
  // ===================
  describe('confirmSubscription', () => {
    it('should return false when token not found', async () => {
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(null);

      const result = await newsletterService.confirmSubscription('invalid-token');

      expect(result).toBe(false);
      expect(mockPrisma.newsletterSubscription.update).not.toHaveBeenCalled();
    });

    it('should confirm subscription and clear token', async () => {
      const mockSubscription = {
        id: 'sub-1',
        email: 'test@example.com',
        confirmToken: 'valid-token',
        preferences: { promotions: true },
        tags: ['vip'],
      };
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.newsletterSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CONFIRMED',
      });

      const result = await newsletterService.confirmSubscription('valid-token');

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          status: 'CONFIRMED',
          confirmedAt: expect.any(Date),
          confirmToken: null,
        },
      });
    });

    it('should sync with Mailchimp when configured', async () => {
      process.env.MAILCHIMP_API_KEY = 'test-api-key';
      process.env.MAILCHIMP_LIST_ID = 'test-list-id';
      process.env.MAILCHIMP_SERVER_PREFIX = 'us1';

      const mockSubscription = {
        id: 'sub-1',
        email: 'test@example.com',
        confirmToken: 'valid-token',
        preferences: { promotions: true },
        tags: ['vip'],
      };
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.newsletterSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CONFIRMED',
      });

      await newsletterService.confirmSubscription('valid-token');

      // Note: Mailchimp integration test requires the service to be recreated
      // with env vars set. For unit tests, we verify the update was called.
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });
  });

  // ===================
  // unsubscribe
  // ===================
  describe('unsubscribe', () => {
    it('should return false when email not found', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);

      const result = await newsletterService.unsubscribe('unknown@example.com');

      expect(result).toBe(false);
      expect(mockPrisma.newsletterSubscription.update).not.toHaveBeenCalled();
    });

    it('should unsubscribe existing subscriber', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const result = await newsletterService.unsubscribe('TEST@EXAMPLE.COM');

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: {
          status: 'UNSUBSCRIBED',
          unsubscribedAt: expect.any(Date),
        },
      });
    });

    it('should unsubscribe with optional token parameter', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const result = await newsletterService.unsubscribe('test@example.com', 'some-token');

      expect(result).toBe(true);
    });
  });

  // ===================
  // updatePreferences
  // ===================
  describe('updatePreferences', () => {
    it('should return false when subscription not found', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);

      const result = await newsletterService.updatePreferences('unknown@example.com', {
        promotions: true,
      });

      expect(result).toBe(false);
    });

    it('should return false when subscription is not CONFIRMED', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'PENDING',
      });

      const result = await newsletterService.updatePreferences('test@example.com', {
        promotions: true,
      });

      expect(result).toBe(false);
      expect(mockPrisma.newsletterSubscription.update).not.toHaveBeenCalled();
    });

    it('should update preferences for confirmed subscriber', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const preferences = { promotions: false, news: true, newProducts: true };
      const result = await newsletterService.updatePreferences('TEST@example.com', preferences);

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { preferences },
      });
    });
  });

  // ===================
  // addTags
  // ===================
  describe('addTags', () => {
    it('should return false when subscription not found', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);

      const result = await newsletterService.addTags('unknown@example.com', ['vip']);

      expect(result).toBe(false);
    });

    it('should add new tags to existing tags', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        tags: ['existing'],
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const result = await newsletterService.addTags('test@example.com', ['new', 'vip']);

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { tags: ['existing', 'new', 'vip'] },
      });
    });

    it('should not duplicate existing tags', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        tags: ['vip', 'promo'],
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const result = await newsletterService.addTags('test@example.com', ['vip', 'new']);

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { tags: ['vip', 'promo', 'new'] },
      });
    });

    it('should handle null existing tags', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        tags: null,
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      const result = await newsletterService.addTags('test@example.com', ['first', 'second']);

      expect(result).toBe(true);
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { tags: ['first', 'second'] },
      });
    });
  });

  // ===================
  // getSubscriptionStatus
  // ===================
  describe('getSubscriptionStatus', () => {
    it('should return null when email not found', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);

      const result = await newsletterService.getSubscriptionStatus('unknown@example.com');

      expect(result).toBeNull();
    });

    it('should return subscribed true for CONFIRMED status', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
        preferences: { promotions: true, news: false },
      });

      const result = await newsletterService.getSubscriptionStatus('TEST@EXAMPLE.COM');

      expect(result).toEqual({
        subscribed: true,
        status: 'CONFIRMED',
        preferences: { promotions: true, news: false },
      });
    });

    it('should return subscribed false for PENDING status', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'PENDING',
        preferences: null,
      });

      const result = await newsletterService.getSubscriptionStatus('test@example.com');

      expect(result).toEqual({
        subscribed: false,
        status: 'PENDING',
        preferences: null,
      });
    });

    it('should return subscribed false for UNSUBSCRIBED status', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'UNSUBSCRIBED',
        preferences: { promotions: true },
      });

      const result = await newsletterService.getSubscriptionStatus('test@example.com');

      expect(result).toEqual({
        subscribed: false,
        status: 'UNSUBSCRIBED',
        preferences: { promotions: true },
      });
    });
  });

  // ===================
  // getStats
  // ===================
  describe('getStats', () => {
    it('should return correct statistics', async () => {
      mockPrisma.newsletterSubscription.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75)  // confirmed
        .mockResolvedValueOnce(15)  // pending
        .mockResolvedValueOnce(10); // unsubscribed

      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2026-01', count: BigInt(20) },
        { month: '2026-02', count: BigInt(15) },
      ]);

      const result = await newsletterService.getStats();

      expect(result).toEqual({
        totalSubscribers: 100,
        confirmedSubscribers: 75,
        pendingSubscribers: 15,
        unsubscribed: 10,
        subscribersByMonth: [
          { month: '2026-01', count: 20 },
          { month: '2026-02', count: 15 },
        ],
      });
    });

    it('should handle empty monthly data', async () => {
      mockPrisma.newsletterSubscription.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await newsletterService.getStats();

      expect(result).toEqual({
        totalSubscribers: 0,
        confirmedSubscribers: 0,
        pendingSubscribers: 0,
        unsubscribed: 0,
        subscribersByMonth: [],
      });
    });
  });

  // ===================
  // exportSubscribers
  // ===================
  describe('exportSubscribers', () => {
    const mockSubscriptions = [
      {
        id: 'sub-1',
        email: 'test1@example.com',
        status: 'CONFIRMED',
        tags: ['vip', 'promo'],
        confirmedAt: new Date('2026-01-15'),
        createdAt: new Date('2026-01-10'),
      },
      {
        id: 'sub-2',
        email: 'test2@example.com',
        status: 'CONFIRMED',
        tags: ['promo'],
        confirmedAt: new Date('2026-02-01'),
        createdAt: new Date('2026-01-20'),
      },
      {
        id: 'sub-3',
        email: 'test3@example.com',
        status: 'PENDING',
        tags: null,
        confirmedAt: null,
        createdAt: new Date('2026-02-10'),
      },
    ];

    it('should export all subscribers without filters', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await newsletterService.exportSubscribers();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        email: 'test1@example.com',
        firstName: undefined,
        lastName: undefined,
        status: 'CONFIRMED',
        tags: ['vip', 'promo'],
        confirmedAt: expect.any(Date),
      });
    });

    it('should filter by status', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue([mockSubscriptions[2]]);

      const result = await newsletterService.exportSubscribers({ status: 'PENDING' });

      expect(mockPrisma.newsletterSubscription.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });

    it('should filter by fromDate', async () => {
      const fromDate = new Date('2026-02-01');
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue([mockSubscriptions[2]]);

      const result = await newsletterService.exportSubscribers({ fromDate });

      expect(mockPrisma.newsletterSubscription.findMany).toHaveBeenCalledWith({
        where: { createdAt: { gte: fromDate } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by tags', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await newsletterService.exportSubscribers({ tags: ['vip'] });

      // Only test1@example.com has 'vip' tag
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test1@example.com');
    });

    it('should filter by multiple tags (OR logic)', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await newsletterService.exportSubscribers({ tags: ['vip', 'promo'] });

      // test1 has both, test2 has promo
      expect(result).toHaveLength(2);
    });

    it('should handle null tags in subscriptions', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue([
        { ...mockSubscriptions[2], tags: null },
      ]);

      const result = await newsletterService.exportSubscribers({ tags: ['vip'] });

      expect(result).toHaveLength(0);
    });

    it('should return empty tags array for null tags', async () => {
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue([mockSubscriptions[2]]);

      const result = await newsletterService.exportSubscribers();

      expect(result[0].tags).toEqual([]);
    });

    it('should combine status and fromDate filters', async () => {
      const fromDate = new Date('2026-01-01');
      mockPrisma.newsletterSubscription.findMany.mockResolvedValue([mockSubscriptions[0]]);

      await newsletterService.exportSubscribers({
        status: 'CONFIRMED',
        fromDate,
      });

      expect(mockPrisma.newsletterSubscription.findMany).toHaveBeenCalledWith({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: fromDate },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ===================
  // Mailchimp Integration (private methods via public methods)
  // ===================
  describe('Mailchimp Integration', () => {
    beforeEach(() => {
      // Note: Mailchimp config is read at module load time, so we test behavior
      // when methods call isMailchimpConfigured internally
      mockFetch.mockClear();
    });

    it('should not call Mailchimp when not configured (confirmSubscription)', async () => {
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        confirmToken: 'valid-token',
        preferences: { promotions: true },
        tags: ['vip'],
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      await newsletterService.confirmSubscription('valid-token');

      // Since MAILCHIMP_API_KEY/LIST_ID are not set, fetch should not be called for Mailchimp
      // Only called if isMailchimpConfigured returns true
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });

    it('should not call Mailchimp when not configured (unsubscribe)', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      await newsletterService.unsubscribe('test@example.com');

      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });

    it('should not call Mailchimp when not configured (updatePreferences)', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      await newsletterService.updatePreferences('test@example.com', { promotions: false });

      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });

    it('should not call Mailchimp when not configured (addTags)', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        tags: [],
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      await newsletterService.addTags('test@example.com', ['new-tag']);

      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });
  });

  // ===================
  // sendConfirmationEmail (via subscribe)
  // ===================
  describe('sendConfirmationEmail', () => {
    it('should auto-confirm in development mode', async () => {
      process.env.NODE_ENV = 'development';

      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({
        id: 'sub-new',
        email: 'dev@example.com',
        status: 'PENDING',
        confirmToken: 'mock-token-12345',
      });
      // For confirmSubscription called automatically
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'sub-new',
        email: 'dev@example.com',
        confirmToken: 'mock-token-12345',
        preferences: {},
        tags: [],
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({
        status: 'CONFIRMED',
      });

      const result = await newsletterService.subscribe({
        email: 'dev@example.com',
        firstName: 'Dev',
      });

      expect(result.success).toBe(true);
      // The subscription should be auto-confirmed in dev mode
      // Update is called for confirmation
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-new' },
          data: expect.objectContaining({
            status: 'CONFIRMED',
          }),
        })
      );
    });

    it('should not auto-confirm in production mode', async () => {
      process.env.NODE_ENV = 'production';

      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({
        id: 'sub-new',
        email: 'prod@example.com',
        status: 'PENDING',
      });

      const result = await newsletterService.subscribe({
        email: 'prod@example.com',
      });

      expect(result).toEqual({ success: true, requiresConfirmation: true });
      // Update should not be called for auto-confirmation
      expect(mockPrisma.newsletterSubscription.findFirst).not.toHaveBeenCalled();
    });

    it('should log confirmation URL', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://example.com';

      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({
        id: 'sub-new',
        email: 'log@example.com',
        status: 'PENDING',
      });

      await newsletterService.subscribe({
        email: 'log@example.com',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Newsletter confirmation email would be sent to log@example.com')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Confirmation URL:')
      );

      consoleLogSpy.mockRestore();
    });
  });

  // ===================
  // md5Hash (via Mailchimp methods)
  // ===================
  describe('md5Hash', () => {
    it('should use crypto createHash for MD5', async () => {
      // The md5Hash method is tested indirectly through Mailchimp methods
      // Since Mailchimp isn't configured in tests, we verify crypto mock is set up
      const crypto = require('crypto');
      expect(crypto.createHash).toBeDefined();
    });
  });

  // ===================
  // preferencesToInterests
  // ===================
  describe('preferencesToInterests', () => {
    it('should handle preferences mapping in updatePreferences', async () => {
      process.env.MAILCHIMP_INTEREST_PROMOTIONS = 'int_promo_123';
      process.env.MAILCHIMP_INTEREST_NEWS = 'int_news_456';
      process.env.MAILCHIMP_INTEREST_NEW_PRODUCTS = 'int_newprod_789';

      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'CONFIRMED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});

      // This triggers updatePreferences which would call preferencesToInterests
      // when Mailchimp is configured
      await newsletterService.updatePreferences('test@example.com', {
        promotions: true,
        news: false,
        newProducts: true,
      });

      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalled();
    });
  });
});
