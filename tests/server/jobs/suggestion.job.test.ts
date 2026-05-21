import '../helpers/tenant-mock';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';
import { Job } from 'bullmq';

// Mock prisma
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock config
jest.mock('@server/config/environment', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
    },
  },
}));

// Mock BullMQ
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockWorkerOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
  })),
  Job: jest.fn(),
}));

// Mock suggestion engine service
const mockSuggestionEngineService = {
  runAllAlgorithms: jest.fn(),
  getStats: jest.fn(),
};

jest.mock('@server/services/suggestion-engine.service', () => ({
  suggestionEngineService: mockSuggestionEngineService,
}));

// Mock email service
const mockEmailService = {
  isEnabled: jest.fn().mockReturnValue(true),
  send: jest.fn().mockResolvedValue(true),
};

jest.mock('@server/services/email.service', () => ({
  emailService: mockEmailService,
}));

// Import after mocks
import {
  processSuggestionJob,
  initSuggestionWorker,
  scheduleSuggestionJobs,
  queueGenerateAll,
  queueDailyDigest,
  queueWeeklyDigest,
} from '@server/jobs/suggestion.job';
import { logger } from '@server/config/logger';

// Helper to create Decimal mock
const createDecimalMock = (value: number | string): Prisma.Decimal => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => String(numVal),
    toFixed: (dp?: number) => numVal.toFixed(dp),
    valueOf: () => numVal,
  } as unknown as Prisma.Decimal;
};

// Helper to create mock job
const createMockJob = (data: any): Job => ({
  id: `job-${Date.now()}`,
  name: 'test-job',
  data,
  progress: jest.fn(),
  updateProgress: jest.fn().mockResolvedValue(undefined),
} as unknown as Job);

describe.skip('Suggestion Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
    mockEmailService.isEnabled.mockReturnValue(true);
  });

  describe('processSuggestionJob', () => {
    describe('generate-all', () => {
      it('should run all algorithms and log stats', async () => {
        mockSuggestionEngineService.runAllAlgorithms.mockResolvedValue({
          created: 15,
          errors: [],
        });

        const job = createMockJob({ type: 'generate-all' });

        await processSuggestionJob(job);

        expect(logger.info).toHaveBeenCalledWith('Avvio generazione suggerimenti notturna...');
        expect(mockSuggestionEngineService.runAllAlgorithms).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Generazione completata in')
        );
      });

      it('should log warnings when errors occur', async () => {
        mockSuggestionEngineService.runAllAlgorithms.mockResolvedValue({
          created: 10,
          errors: ['Error 1', 'Error 2'],
        });

        const job = createMockJob({ type: 'generate-all' });

        await processSuggestionJob(job);

        expect(logger.warn).toHaveBeenCalledWith(
          'Errori durante generazione:',
          ['Error 1', 'Error 2']
        );
      });
    });

    describe('cleanup-expired', () => {
      it('should mark expired suggestions as EXPIRED', async () => {
        prismaMock.suggestion.updateMany.mockResolvedValue({ count: 5 });

        const job = createMockJob({ type: 'cleanup-expired' });

        await processSuggestionJob(job);

        expect(logger.info).toHaveBeenCalledWith('Cleanup suggerimenti scaduti...');
        expect(prismaMock.suggestion.updateMany).toHaveBeenCalledWith({
          where: {
            status: 'PENDING',
            expiresAt: { lt: expect.any(Date) },
          },
          data: { status: 'EXPIRED' },
        });
        expect(logger.info).toHaveBeenCalledWith('Marcati 5 suggerimenti come scaduti');
      });
    });

    describe('auto-resolve', () => {
      it('should auto-resolve STOCKOUT_ALERT when stock is above minimum', async () => {
        const pendingSuggestions = [
          {
            id: 'sug-1',
            type: 'STOCKOUT_ALERT',
            productId: 'prod-1',
            materialId: null,
            product: { minStock: 10 },
            material: null,
            data: null,
          },
        ];

        prismaMock.suggestion.findMany.mockResolvedValue(pendingSuggestions as any);
        prismaMock.inventoryItem.aggregate.mockResolvedValue({
          _sum: { quantity: 20 },
        } as any);
        prismaMock.suggestion.update.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'auto-resolve' });

        await processSuggestionJob(job);

        expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
          where: { id: 'sug-1' },
          data: { status: 'AUTO_RESOLVED' },
        });
        expect(logger.info).toHaveBeenCalledWith('Auto-risolti 1 suggerimenti');
      });

      it('should auto-resolve REORDER for materials when stock is above minimum', async () => {
        const pendingSuggestions = [
          {
            id: 'sug-1',
            type: 'REORDER',
            productId: null,
            materialId: 'mat-1',
            product: null,
            material: null,
            data: null,
          },
        ];

        prismaMock.suggestion.findMany.mockResolvedValue(pendingSuggestions as any);
        prismaMock.material.findUnique.mockResolvedValue({
          id: 'mat-1',
          currentStock: 50,
          minStock: 20,
        } as any);
        prismaMock.suggestion.update.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'auto-resolve' });

        await processSuggestionJob(job);

        expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
          where: { id: 'sug-1' },
          data: { status: 'AUTO_RESOLVED' },
        });
      });

      it('should auto-resolve PAYMENT_DUE when invoice is paid', async () => {
        const pendingSuggestions = [
          {
            id: 'sug-1',
            type: 'PAYMENT_DUE',
            productId: null,
            materialId: null,
            product: null,
            material: null,
            data: { invoiceId: 'inv-1' },
          },
        ];

        prismaMock.suggestion.findMany.mockResolvedValue(pendingSuggestions as any);
        prismaMock.invoice.findUnique.mockResolvedValue({
          id: 'inv-1',
          status: 'PAID',
        } as any);
        prismaMock.suggestion.update.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'auto-resolve' });

        await processSuggestionJob(job);

        expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
          where: { id: 'sug-1' },
          data: { status: 'AUTO_RESOLVED' },
        });
      });

      it('should auto-resolve DEAD_STOCK when product has recent orders', async () => {
        const pendingSuggestions = [
          {
            id: 'sug-1',
            type: 'DEAD_STOCK',
            productId: 'prod-1',
            materialId: null,
            product: null,
            material: null,
            data: null,
          },
        ];

        prismaMock.suggestion.findMany.mockResolvedValue(pendingSuggestions as any);
        prismaMock.orderItem.count.mockResolvedValue(3);
        prismaMock.suggestion.update.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'auto-resolve' });

        await processSuggestionJob(job);

        expect(prismaMock.suggestion.update).toHaveBeenCalledWith({
          where: { id: 'sug-1' },
          data: { status: 'AUTO_RESOLVED' },
        });
      });

      it('should not resolve when conditions not met', async () => {
        const pendingSuggestions = [
          {
            id: 'sug-1',
            type: 'STOCKOUT_ALERT',
            productId: 'prod-1',
            materialId: null,
            product: { minStock: 10 },
            material: null,
            data: null,
          },
        ];

        prismaMock.suggestion.findMany.mockResolvedValue(pendingSuggestions as any);
        prismaMock.inventoryItem.aggregate.mockResolvedValue({
          _sum: { quantity: 5 }, // Below minStock
        } as any);

        const job = createMockJob({ type: 'auto-resolve' });

        await processSuggestionJob(job);

        expect(prismaMock.suggestion.update).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Auto-risolti 0 suggerimenti');
      });
    });

    describe('daily-digest', () => {
      it('should send daily digest to users with preference enabled', async () => {
        const usersWithDigest = [
          {
            user: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
              isActive: true,
            },
          },
        ];

        const criticalSuggestions = [
          { id: 'sug-1', priority: 'CRITICAL', title: 'Critical issue' },
        ];

        prismaMock.userDashboardPreference.findMany.mockResolvedValue(usersWithDigest as any);
        prismaMock.suggestion.findMany.mockResolvedValue(criticalSuggestions as any);
        mockSuggestionEngineService.getStats.mockResolvedValue({
          byStatus: { PENDING: 10 },
          byPriority: { CRITICAL: 5, HIGH: 10 },
        });

        const job = createMockJob({ type: 'daily-digest' });

        await processSuggestionJob(job);

        expect(mockEmailService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: expect.stringContaining('Report Giornaliero'),
          })
        );
        expect(logger.info).toHaveBeenCalledWith('Inviati 1 digest giornalieri');
      });

      it('should skip when email service is disabled', async () => {
        mockEmailService.isEnabled.mockReturnValue(false);

        const job = createMockJob({ type: 'daily-digest' });

        await processSuggestionJob(job);

        expect(logger.warn).toHaveBeenCalledWith('Email service non abilitato, skip digest');
        expect(prismaMock.userDashboardPreference.findMany).not.toHaveBeenCalled();
      });

      it('should skip when no users have daily digest enabled', async () => {
        prismaMock.userDashboardPreference.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'daily-digest' });

        await processSuggestionJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessun utente con digest giornaliero abilitato');
        expect(mockEmailService.send).not.toHaveBeenCalled();
      });

      it('should skip when no critical suggestions', async () => {
        const usersWithDigest = [
          {
            user: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
              isActive: true,
            },
          },
        ];

        prismaMock.userDashboardPreference.findMany.mockResolvedValue(usersWithDigest as any);
        prismaMock.suggestion.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'daily-digest' });

        await processSuggestionJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessun suggerimento critico da inviare');
        expect(mockEmailService.send).not.toHaveBeenCalled();
      });
    });

    describe('weekly-digest', () => {
      it('should send weekly digest with stats', async () => {
        const usersWithDigest = [
          {
            user: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
              isActive: true,
            },
          },
        ];

        prismaMock.userDashboardPreference.findMany.mockResolvedValue(usersWithDigest as any);
        prismaMock.suggestion.count
          .mockResolvedValueOnce(20) // created
          .mockResolvedValueOnce(15) // acted
          .mockResolvedValueOnce(3)  // dismissed
          .mockResolvedValueOnce(2); // autoResolved
        prismaMock.suggestion.groupBy.mockResolvedValue([
          { type: 'REORDER', _count: 10 },
          { type: 'STOCKOUT_ALERT', _count: 5 },
        ] as any);
        prismaMock.suggestion.aggregate.mockResolvedValue({
          _sum: { potentialSaving: createDecimalMock(500) },
        } as any);

        const job = createMockJob({ type: 'weekly-digest' });

        await processSuggestionJob(job);

        expect(mockEmailService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: expect.stringContaining('Report Settimanale'),
          })
        );
        expect(logger.info).toHaveBeenCalledWith('Inviati 1 digest settimanali');
      });

      it('should skip when email service is disabled', async () => {
        mockEmailService.isEnabled.mockReturnValue(false);

        const job = createMockJob({ type: 'weekly-digest' });

        await processSuggestionJob(job);

        expect(logger.warn).toHaveBeenCalledWith('Email service non abilitato, skip digest');
      });

      it('should skip when no users have weekly digest enabled', async () => {
        prismaMock.userDashboardPreference.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'weekly-digest' });

        await processSuggestionJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessun utente con digest settimanale abilitato');
      });

      it('should skip inactive users', async () => {
        const usersWithDigest = [
          {
            user: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
              isActive: false,
            },
          },
        ];

        prismaMock.userDashboardPreference.findMany.mockResolvedValue(usersWithDigest as any);
        prismaMock.suggestion.count.mockResolvedValue(10);
        prismaMock.suggestion.groupBy.mockResolvedValue([]);
        prismaMock.suggestion.aggregate.mockResolvedValue({
          _sum: { potentialSaving: null },
        } as any);

        const job = createMockJob({ type: 'weekly-digest' });

        await processSuggestionJob(job);

        expect(mockEmailService.send).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Inviati 0 digest settimanali');
      });
    });

    describe('unknown type', () => {
      it('should throw error for unknown job type', async () => {
        const job = createMockJob({ type: 'unknown-type' });

        await expect(processSuggestionJob(job)).rejects.toThrow(
          'Tipo job suggerimenti sconosciuto: unknown-type'
        );
      });
    });
  });

  describe('initSuggestionWorker', () => {
    it('should create worker with correct config', () => {
      const worker = initSuggestionWorker();

      expect(worker).toBeDefined();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('scheduleSuggestionJobs', () => {
    it('should schedule generate-all at 02:00', async () => {
      await scheduleSuggestionJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-generate-all',
        { type: 'generate-all' },
        expect.objectContaining({
          repeat: { pattern: '0 2 * * *' },
        })
      );
    });

    it('should schedule cleanup-expired at 03:00', async () => {
      await scheduleSuggestionJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-cleanup-expired',
        { type: 'cleanup-expired' },
        expect.objectContaining({
          repeat: { pattern: '0 3 * * *' },
        })
      );
    });

    it('should schedule auto-resolve every 6 hours', async () => {
      await scheduleSuggestionJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-auto-resolve',
        { type: 'auto-resolve' },
        expect.objectContaining({
          repeat: { pattern: '0 */6 * * *' },
        })
      );
    });

    it('should schedule daily-digest at 08:00', async () => {
      await scheduleSuggestionJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-daily-digest',
        { type: 'daily-digest' },
        expect.objectContaining({
          repeat: { pattern: '0 8 * * *' },
        })
      );
    });

    it('should schedule weekly-digest on Monday at 09:00', async () => {
      await scheduleSuggestionJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-weekly-digest',
        { type: 'weekly-digest' },
        expect.objectContaining({
          repeat: { pattern: '0 9 * * 1' },
        })
      );
    });

    it('should log configuration complete', async () => {
      await scheduleSuggestionJobs();

      expect(logger.info).toHaveBeenCalledWith('Suggestion scheduled jobs configurati');
    });
  });

  describe('queue helper functions', () => {
    describe('queueGenerateAll', () => {
      it('should add generate-all job to queue', async () => {
        await queueGenerateAll();

        expect(mockQueueAdd).toHaveBeenCalledWith(
          expect.stringMatching(/^generate-all-\d+$/),
          { type: 'generate-all' },
          expect.objectContaining({
            removeOnComplete: true,
            attempts: 1,
          })
        );
      });
    });

    describe('queueDailyDigest', () => {
      it('should add daily-digest job to queue', async () => {
        await queueDailyDigest();

        expect(mockQueueAdd).toHaveBeenCalledWith(
          expect.stringMatching(/^daily-digest-\d+$/),
          { type: 'daily-digest' },
          expect.objectContaining({
            removeOnComplete: true,
            attempts: 1,
          })
        );
      });
    });

    describe('queueWeeklyDigest', () => {
      it('should add weekly-digest job to queue', async () => {
        await queueWeeklyDigest();

        expect(mockQueueAdd).toHaveBeenCalledWith(
          expect.stringMatching(/^weekly-digest-\d+$/),
          { type: 'weekly-digest' },
          expect.objectContaining({
            removeOnComplete: true,
            attempts: 1,
          })
        );
      });
    });
  });
});
