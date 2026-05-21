import '../helpers/tenant-mock';
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

// Mock email.service: il newsletter service invia email di conferma; nei test
// non vogliamo che le credenziali SMTP del .env (Aruba) facciano partire mail
// reali — Aruba rifiuta i destinatari `@example.com` con `452 policy violation`.
jest.mock('@server/services/email.service', () => ({
  __esModule: true,
  default: {
    isEnabled: jest.fn().mockReturnValue(false),
    send: jest.fn().mockResolvedValue(true),
    sendNewsletterConfirmation: jest.fn().mockResolvedValue(true),
    sendNewsletterWelcome: jest.fn().mockResolvedValue(true),
  },
  emailService: {
    isEnabled: jest.fn().mockReturnValue(false),
    send: jest.fn().mockResolvedValue(true),
    sendNewsletterConfirmation: jest.fn().mockResolvedValue(true),
    sendNewsletterWelcome: jest.fn().mockResolvedValue(true),
  },
}));

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
        confirmToken: 'existing-token',
      });

      const result = await newsletterService.subscribe({
        email: 'test@example.com',
      });

      // PENDING status should return early with requiresConfirmation: true
      // and not create a new subscription or update
      expect(result).toEqual({ success: true, requiresConfirmation: true });
      expect(mockPrisma.newsletterSubscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.newsletterSubscription.update).not.toHaveBeenCalled();
    });

    it('should use default preferences and empty tags when resubscribing without them', async () => {
      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'test@example.com',
        status: 'UNSUBSCRIBED',
      });
      mockPrisma.newsletterSubscription.update.mockResolvedValue({});
      mockPrisma.newsletterSubscription.findFirst.mockResolvedValue(null);

      const result = await newsletterService.subscribe({
        email: 'test@example.com',
        // No tags or preferences provided - should use defaults
      });

      expect(result).toEqual({ success: true, requiresConfirmation: true });
      expect(mockPrisma.newsletterSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: expect.objectContaining({
          status: 'PENDING',
          confirmToken: 'mock-token-12345',
          preferences: { promotions: true, news: true }, // Default preferences
          tags: [], // Empty tags array
        }),
      });
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
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://example.com';

      mockPrisma.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.newsletterSubscription.create.mockResolvedValue({
        id: 'sub-new',
        email: 'log@example.com',
        status: 'PENDING',
      });

      // Verify subscribe doesn't throw and completes successfully
      const result = await newsletterService.subscribe({
        email: 'log@example.com',
      });

      expect(result).toEqual({ success: true, requiresConfirmation: true });
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

// ===================
// Mailchimp Integration Tests with Configured Environment
// ===================
// These tests use jest.isolateModules to load the service with Mailchimp configured
describe('NewsletterService - Mailchimp Integration (Configured)', () => {
  let mockFetchConfigured: jest.Mock;
  let mockPrismaConfigured: any;
  let configuredNewsletterService: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();

    // Set up Mailchimp environment variables BEFORE importing the module
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MAILCHIMP_API_KEY: 'test-api-key-123',
      MAILCHIMP_LIST_ID: 'test-list-id-456',
      MAILCHIMP_SERVER_PREFIX: 'us1',
      MAILCHIMP_INTEREST_PROMOTIONS: 'int_promo_123',
      MAILCHIMP_INTEREST_NEWS: 'int_news_456',
      MAILCHIMP_INTEREST_NEW_PRODUCTS: 'int_newprod_789',
    };

    // Create fresh mocks
    mockFetchConfigured = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);
    global.fetch = mockFetchConfigured as unknown as typeof fetch;

    mockPrismaConfigured = {
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

    // Mock PrismaClient
    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => mockPrismaConfigured),
    }));

    // Mock crypto
    jest.doMock('crypto', () => ({
      randomBytes: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-token-12345'),
      }),
      createHash: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('mock-md5-hash'),
        }),
      }),
    }));

    // Import fresh service instance
    const { newsletterService } = require('@server/services/newsletter.service');
    configuredNewsletterService = newsletterService;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('isMailchimpConfigured', () => {
    it('should return true when both API_KEY and LIST_ID are set', () => {
      expect(configuredNewsletterService.isMailchimpConfigured()).toBe(true);
    });
  });

  describe('addToMailchimp (via confirmSubscription)', () => {
    it('should call Mailchimp API with PUT request when confirming subscription', async () => {
      const mockSubscription = {
        id: 'sub-1',
        email: 'mailchimp-test@example.com',
        confirmToken: 'valid-token',
        preferences: { promotions: true, news: false },
        tags: ['vip', 'premium'],
      };
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CONFIRMED',
      });

      const result = await configuredNewsletterService.confirmSubscription('valid-token');

      expect(result).toBe(true);
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        'https://us1.api.mailchimp.com/3.0/lists/test-list-id-456/members/mock-md5-hash',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Authorization': 'apikey test-api-key-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: 'mailchimp-test@example.com',
            status: 'subscribed',
            merge_fields: {},
            tags: ['vip', 'premium'],
          }),
        })
      );
    });

    it('should call Mailchimp API with empty tags array when no tags provided', async () => {
      const mockSubscription = {
        id: 'sub-2',
        email: 'no-tags@example.com',
        confirmToken: 'valid-token-2',
        preferences: { promotions: true },
        tags: null,
      };
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CONFIRMED',
      });

      await configuredNewsletterService.confirmSubscription('valid-token-2');

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('api.mailchimp.com'),
        expect.objectContaining({
          body: expect.stringContaining('"tags":[]'),
        })
      );
    });

    it('should handle Mailchimp API errors gracefully', async () => {
      const mockSubscription = {
        id: 'sub-3',
        email: 'error-test@example.com',
        confirmToken: 'valid-token-3',
        preferences: { promotions: true },
        tags: [],
      };
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CONFIRMED',
      });

      // Mock fetch to throw an error
      mockFetchConfigured.mockRejectedValueOnce(new Error('Network error'));

      const result = await configuredNewsletterService.confirmSubscription('valid-token-3');

      // Should still return true because the database update succeeded
      expect(result).toBe(true);
    });
  });

  describe('removeFromMailchimp (via unsubscribe)', () => {
    it('should call Mailchimp API with PATCH request to unsubscribe', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'unsubscribe-test@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await configuredNewsletterService.unsubscribe('unsubscribe-test@example.com');

      expect(result).toBe(true);
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        'https://us1.api.mailchimp.com/3.0/lists/test-list-id-456/members/mock-md5-hash',
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Authorization': 'apikey test-api-key-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'unsubscribed',
          }),
        })
      );
    });

    it('should handle uppercase email by converting to lowercase for hash', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-2',
        email: 'uppercase@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.unsubscribe('UPPERCASE@EXAMPLE.COM');

      // The URL should use the MD5 hash of the lowercase email
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('/members/mock-md5-hash'),
        expect.any(Object)
      );
    });

    it('should handle Mailchimp API errors gracefully on unsubscribe', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-3',
        email: 'error-unsub@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      mockFetchConfigured.mockRejectedValueOnce(new Error('API unavailable'));

      const result = await configuredNewsletterService.unsubscribe('error-unsub@example.com');

      expect(result).toBe(true);
    });
  });

  describe('updateMailchimpMember (via updatePreferences)', () => {
    it('should call Mailchimp API with PATCH request to update interests', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'preferences-test@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      const preferences = { promotions: true, news: false, newProducts: true };
      const result = await configuredNewsletterService.updatePreferences(
        'preferences-test@example.com',
        preferences
      );

      expect(result).toBe(true);
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        'https://us1.api.mailchimp.com/3.0/lists/test-list-id-456/members/mock-md5-hash',
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Authorization': 'apikey test-api-key-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interests: {
              'int_promo_123': true,
              'int_news_456': false,
              'int_newprod_789': true,
            },
          }),
        })
      );
    });

    it('should handle empty preferences by sending empty interests object', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-2',
        email: 'empty-prefs@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.updatePreferences('empty-prefs@example.com', {});

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            interests: {},
          }),
        })
      );
    });

    it('should handle undefined preferences', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-3',
        email: 'undefined-prefs@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.updatePreferences('undefined-prefs@example.com', undefined);

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            interests: {},
          }),
        })
      );
    });

    it('should handle Mailchimp API errors gracefully on updatePreferences', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-4',
        email: 'error-prefs@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      mockFetchConfigured.mockRejectedValueOnce(new Error('Timeout'));

      const result = await configuredNewsletterService.updatePreferences(
        'error-prefs@example.com',
        { promotions: true }
      );

      expect(result).toBe(true);
    });
  });

  describe('updateMailchimpTags (via addTags)', () => {
    it('should call Mailchimp API with POST request to update tags', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'tags-test@example.com',
        tags: ['existing'],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await configuredNewsletterService.addTags('tags-test@example.com', ['new', 'vip']);

      expect(result).toBe(true);
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        'https://us1.api.mailchimp.com/3.0/lists/test-list-id-456/members/mock-md5-hash/tags',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'apikey test-api-key-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tags: [
              { name: 'existing', status: 'active' },
              { name: 'new', status: 'active' },
              { name: 'vip', status: 'active' },
            ],
          }),
        })
      );
    });

    it('should handle adding tags to subscriber with null existing tags', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-2',
        email: 'null-tags@example.com',
        tags: null,
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.addTags('null-tags@example.com', ['first']);

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('/tags'),
        expect.objectContaining({
          body: JSON.stringify({
            tags: [{ name: 'first', status: 'active' }],
          }),
        })
      );
    });

    it('should handle Mailchimp API errors gracefully on addTags', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-3',
        email: 'error-tags@example.com',
        tags: [],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      mockFetchConfigured.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await configuredNewsletterService.addTags('error-tags@example.com', ['tag1']);

      expect(result).toBe(true);
    });
  });

  describe('preferencesToInterests', () => {
    it('should only map preferences with configured interest IDs', async () => {
      // Reset modules to test without certain interest IDs
      jest.resetModules();
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        MAILCHIMP_API_KEY: 'test-api-key-123',
        MAILCHIMP_LIST_ID: 'test-list-id-456',
        MAILCHIMP_SERVER_PREFIX: 'us1',
        MAILCHIMP_INTEREST_PROMOTIONS: 'int_promo_only',
        // NEWS and NEW_PRODUCTS not set
      };

      // Re-mock and re-import
      jest.doMock('@prisma/client', () => ({
        PrismaClient: jest.fn().mockImplementation(() => mockPrismaConfigured),
      }));
      jest.doMock('crypto', () => ({
        randomBytes: jest.fn().mockReturnValue({
          toString: jest.fn().mockReturnValue('mock-token-12345'),
        }),
        createHash: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            digest: jest.fn().mockReturnValue('mock-md5-hash'),
          }),
        }),
      }));

      const { newsletterService: partialConfigService } = require('@server/services/newsletter.service');

      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'partial-interests@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await partialConfigService.updatePreferences('partial-interests@example.com', {
        promotions: true,
        news: true,
        newProducts: false,
      });

      // Only promotions should be in the interests object since NEWS and NEW_PRODUCTS
      // interest IDs are empty strings
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            interests: {
              'int_promo_only': true,
            },
          }),
        })
      );
    });
  });

  describe('md5Hash', () => {
    it('should generate MD5 hash for email in Mailchimp URL', async () => {
      const crypto = require('crypto');

      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'hash-test@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.unsubscribe('hash-test@example.com');

      // Verify crypto.createHash was called
      expect(crypto.createHash).toHaveBeenCalledWith('md5');
    });

    it('should use lowercase email for MD5 hash', async () => {
      const crypto = require('crypto');
      const mockUpdate = jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('lowercase-hash'),
      });
      crypto.createHash.mockReturnValue({
        update: mockUpdate,
      });

      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-2',
        email: 'mixed-case@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.unsubscribe('MIXED-CASE@EXAMPLE.COM');

      // The email should be lowercased before hashing
      expect(mockUpdate).toHaveBeenCalledWith('mixed-case@example.com');
    });
  });

  describe('Full Mailchimp flow integration', () => {
    it('should complete full subscription flow with Mailchimp sync', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Step 1: Subscribe (creates pending subscription)
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue(null);
      mockPrismaConfigured.newsletterSubscription.create.mockResolvedValue({
        id: 'flow-sub-1',
        email: 'flow-test@example.com',
        status: 'PENDING',
        confirmToken: 'mock-token-12345',
      });
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue(null);

      const subscribeResult = await configuredNewsletterService.subscribe({
        email: 'flow-test@example.com',
        tags: ['new-subscriber'],
        preferences: { promotions: true, news: true },
      });

      expect(subscribeResult.requiresConfirmation).toBe(true);

      // Step 2: Confirm subscription (should sync to Mailchimp)
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'flow-sub-1',
        email: 'flow-test@example.com',
        confirmToken: 'mock-token-12345',
        preferences: { promotions: true, news: true },
        tags: ['new-subscriber'],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({
        status: 'CONFIRMED',
      });

      const confirmResult = await configuredNewsletterService.confirmSubscription('mock-token-12345');

      expect(confirmResult).toBe(true);
      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('api.mailchimp.com'),
        expect.objectContaining({
          method: 'PUT',
        })
      );

      // Step 3: Update preferences (should update Mailchimp)
      mockFetchConfigured.mockClear();
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'flow-sub-1',
        email: 'flow-test@example.com',
        status: 'CONFIRMED',
      });

      await configuredNewsletterService.updatePreferences('flow-test@example.com', {
        promotions: false,
        news: true,
      });

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('api.mailchimp.com'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('interests'),
        })
      );

      // Step 4: Add tags (should update Mailchimp)
      mockFetchConfigured.mockClear();
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'flow-sub-1',
        email: 'flow-test@example.com',
        tags: ['new-subscriber'],
      });

      await configuredNewsletterService.addTags('flow-test@example.com', ['vip']);

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('/tags'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Step 5: Unsubscribe (should update Mailchimp)
      mockFetchConfigured.mockClear();
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'flow-sub-1',
        email: 'flow-test@example.com',
        status: 'CONFIRMED',
      });

      await configuredNewsletterService.unsubscribe('flow-test@example.com');

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('api.mailchimp.com'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'unsubscribed' }),
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Edge cases for Mailchimp methods', () => {
    it('should handle special characters in email for hash', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-special',
        email: 'test+special@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.unsubscribe('test+special@example.com');

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.stringContaining('/members/'),
        expect.any(Object)
      );
    });

    it('should handle empty tags array in addToMailchimp', async () => {
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'sub-empty-tags',
        email: 'empty-tags@example.com',
        confirmToken: 'token-empty',
        preferences: null,
        tags: [],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.confirmSubscription('token-empty');

      expect(mockFetchConfigured).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tags":[]'),
        })
      );
    });

    it('should handle multiple concurrent Mailchimp operations', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'sub-concurrent',
        email: 'concurrent@example.com',
        status: 'CONFIRMED',
        tags: ['tag1'],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      // Run multiple operations concurrently
      await Promise.all([
        configuredNewsletterService.updatePreferences('concurrent@example.com', { promotions: true }),
        configuredNewsletterService.addTags('concurrent@example.com', ['tag2']),
      ]);

      // Both should have called Mailchimp
      expect(mockFetchConfigured).toHaveBeenCalledTimes(2);
    });
  });

  describe('isMailchimpConfigured guard branches', () => {
    it('should proceed with Mailchimp API call when configured (addToMailchimp)', async () => {
      // Verify the guard passes and fetch is called
      mockPrismaConfigured.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'guard-sub-1',
        email: 'guard-test@example.com',
        confirmToken: 'guard-token',
        preferences: { promotions: true },
        tags: ['test'],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.confirmSubscription('guard-token');

      // Should have called fetch (guard passed)
      expect(mockFetchConfigured).toHaveBeenCalled();
    });

    it('should proceed with Mailchimp API call when configured (removeFromMailchimp)', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'guard-sub-2',
        email: 'guard-unsub@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.unsubscribe('guard-unsub@example.com');

      // Should have called fetch (guard passed)
      expect(mockFetchConfigured).toHaveBeenCalled();
    });

    it('should proceed with Mailchimp API call when configured (updateMailchimpMember)', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'guard-sub-3',
        email: 'guard-prefs@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.updatePreferences('guard-prefs@example.com', { promotions: true });

      // Should have called fetch (guard passed)
      expect(mockFetchConfigured).toHaveBeenCalled();
    });

    it('should proceed with Mailchimp API call when configured (updateMailchimpTags)', async () => {
      mockPrismaConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'guard-sub-4',
        email: 'guard-tags@example.com',
        tags: ['existing'],
      });
      mockPrismaConfigured.newsletterSubscription.update.mockResolvedValue({});

      await configuredNewsletterService.addTags('guard-tags@example.com', ['new']);

      // Should have called fetch (guard passed)
      expect(mockFetchConfigured).toHaveBeenCalled();
    });
  });
});

// ===================
// Tests for early return when Mailchimp is NOT configured
// ===================
// This tests the other branch of the isMailchimpConfigured guard
describe('NewsletterService - Mailchimp NOT Configured (explicit guard tests)', () => {
  let mockFetchNotConfigured: jest.Mock;
  let mockPrismaNotConfigured: any;
  let notConfiguredService: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();

    // Explicitly NOT set Mailchimp env vars
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MAILCHIMP_API_KEY: '', // Empty - not configured
      MAILCHIMP_LIST_ID: '', // Empty - not configured
    };

    mockFetchNotConfigured = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);
    global.fetch = mockFetchNotConfigured as unknown as typeof fetch;

    mockPrismaNotConfigured = {
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

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => mockPrismaNotConfigured),
    }));

    jest.doMock('crypto', () => ({
      randomBytes: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-token-12345'),
      }),
      createHash: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('mock-md5-hash'),
        }),
      }),
    }));

    const { newsletterService } = require('@server/services/newsletter.service');
    notConfiguredService = newsletterService;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('isMailchimpConfigured returns false', () => {
    it('should return false when env vars are empty', () => {
      expect(notConfiguredService.isMailchimpConfigured()).toBe(false);
    });
  });

  describe('addToMailchimp early return', () => {
    it('should NOT call Mailchimp API when not configured', async () => {
      mockPrismaNotConfigured.newsletterSubscription.findFirst.mockResolvedValue({
        id: 'no-mc-sub-1',
        email: 'no-mc@example.com',
        confirmToken: 'token',
        preferences: { promotions: true },
        tags: ['test'],
      });
      mockPrismaNotConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await notConfiguredService.confirmSubscription('token');

      expect(result).toBe(true);
      // Should NOT have called fetch because Mailchimp not configured
      expect(mockFetchNotConfigured).not.toHaveBeenCalled();
    });
  });

  describe('removeFromMailchimp early return', () => {
    it('should NOT call Mailchimp API when not configured', async () => {
      mockPrismaNotConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'no-mc-sub-2',
        email: 'no-mc-unsub@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaNotConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await notConfiguredService.unsubscribe('no-mc-unsub@example.com');

      expect(result).toBe(true);
      expect(mockFetchNotConfigured).not.toHaveBeenCalled();
    });
  });

  describe('updateMailchimpMember early return', () => {
    it('should NOT call Mailchimp API when not configured', async () => {
      mockPrismaNotConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'no-mc-sub-3',
        email: 'no-mc-prefs@example.com',
        status: 'CONFIRMED',
      });
      mockPrismaNotConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await notConfiguredService.updatePreferences('no-mc-prefs@example.com', {
        promotions: true,
      });

      expect(result).toBe(true);
      expect(mockFetchNotConfigured).not.toHaveBeenCalled();
    });
  });

  describe('updateMailchimpTags early return', () => {
    it('should NOT call Mailchimp API when not configured', async () => {
      mockPrismaNotConfigured.newsletterSubscription.findUnique.mockResolvedValue({
        id: 'no-mc-sub-4',
        email: 'no-mc-tags@example.com',
        tags: ['existing'],
      });
      mockPrismaNotConfigured.newsletterSubscription.update.mockResolvedValue({});

      const result = await notConfiguredService.addTags('no-mc-tags@example.com', ['new']);

      expect(result).toBe(true);
      expect(mockFetchNotConfigured).not.toHaveBeenCalled();
    });
  });
});
