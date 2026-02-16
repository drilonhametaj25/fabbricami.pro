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

// Mock SDI service
const mockSdiService = {
  updateInvoiceStatus: jest.fn(),
  retryFailedInvoice: jest.fn(),
  sendInvoiceToSdi: jest.fn(),
  generateInvoiceXml: jest.fn(),
};

jest.mock('@server/services/sdi', () => ({
  sdiService: mockSdiService,
}));

// Import after mocks
import {
  processSdiJob,
  initSdiWorker,
  scheduleSdiJobs,
  queueSendInvoice,
  queueGenerateXml,
  queuePollStatus,
} from '@server/jobs/sdi.job';
import { logger } from '@server/config/logger';

// Helper to create mock job
const createMockJob = (data: any): Job => ({
  id: `job-${Date.now()}`,
  name: 'test-job',
  data,
  progress: jest.fn(),
  updateProgress: jest.fn().mockResolvedValue(undefined),
} as unknown as Job);

describe('SDI Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('processSdiJob', () => {
    describe('poll-status', () => {
      it('should poll status for pending invoices', async () => {
        const pendingInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiId: 'sdi-1', sdiStatus: 'PENDING' },
          { id: 'inv-2', invoiceNumber: 'INV-002', sdiId: 'sdi-2', sdiStatus: 'DELIVERED' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(pendingInvoices as any);
        mockSdiService.updateInvoiceStatus
          .mockResolvedValueOnce({ status: 'ACCEPTED' })
          .mockResolvedValueOnce({ status: 'DELIVERED' });

        const job = createMockJob({ type: 'poll-status' });

        // Run immediately after setting up mocks
        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Avvio poll stato fatture SDI...');
        expect(logger.info).toHaveBeenCalledWith('Controllo stato per 2 fatture');
        expect(mockSdiService.updateInvoiceStatus).toHaveBeenCalledTimes(2);
      });

      it('should skip when no pending invoices', async () => {
        prismaMock.invoice.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'poll-status' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessuna fattura in attesa di stato SDI');
        expect(mockSdiService.updateInvoiceStatus).not.toHaveBeenCalled();
      });

      it('should notify when invoice is rejected', async () => {
        const pendingInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiId: 'sdi-1', sdiStatus: 'PENDING' },
        ];

        prismaMock.invoice.findMany
          .mockResolvedValueOnce(pendingInvoices as any)
          .mockResolvedValueOnce([{ id: 'user-1' }] as any); // For notify
        prismaMock.invoice.findUnique.mockResolvedValue({
          invoiceNumber: 'INV-001',
          sdiErrorCode: '00001',
          sdiErrorMessage: 'Invalid format',
          customer: { businessName: 'ACME Corp' },
        } as any);
        prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);
        prismaMock.notification.create.mockResolvedValue({} as any);

        mockSdiService.updateInvoiceStatus.mockResolvedValue({ status: 'REJECTED' });

        const job = createMockJob({ type: 'poll-status' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(prismaMock.notification.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('rifiutata'),
            }),
          })
        );
      });

      it('should handle errors gracefully', async () => {
        const pendingInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiId: 'sdi-1', sdiStatus: 'PENDING' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(pendingInvoices as any);
        mockSdiService.updateInvoiceStatus.mockRejectedValue(new Error('API error'));

        const job = createMockJob({ type: 'poll-status' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.error).toHaveBeenCalledWith(
          'Errore aggiornamento stato INV-001:',
          'API error'
        );
      });
    });

    describe('poll-notifications', () => {
      it('should poll notifications for recent invoices', async () => {
        const recentInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiId: 'sdi-1' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(recentInvoices as any);
        mockSdiService.updateInvoiceStatus.mockResolvedValue({ status: 'PENDING' });

        const job = createMockJob({ type: 'poll-notifications' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Avvio poll notifiche SDI...');
        expect(logger.info).toHaveBeenCalledWith('Verifica notifiche per 1 fatture');
        expect(mockSdiService.updateInvoiceStatus).toHaveBeenCalledWith('inv-1');
      });

      it('should skip when no recent invoices', async () => {
        prismaMock.invoice.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'poll-notifications' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessuna fattura recente da verificare');
      });

      it('should handle notification errors gracefully', async () => {
        const recentInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiId: 'sdi-1' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(recentInvoices as any);
        mockSdiService.updateInvoiceStatus.mockRejectedValue(new Error('Network error'));

        const job = createMockJob({ type: 'poll-notifications' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.warn).toHaveBeenCalledWith(
          'Errore notifiche INV-001:',
          'Network error'
        );
      });
    });

    describe('retry-failed', () => {
      it('should retry failed invoices with retryable errors', async () => {
        const failedInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiStatus: 'REJECTED', sdiErrorCode: '99999', sdiErrorMessage: 'Temporary error' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(failedInvoices as any);
        mockSdiService.retryFailedInvoice.mockResolvedValue({ success: true });

        const job = createMockJob({ type: 'retry-failed', maxRetries: 3 });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Avvio retry fatture fallite')
        );
        expect(mockSdiService.retryFailedInvoice).toHaveBeenCalledWith('inv-1');
        expect(logger.info).toHaveBeenCalledWith('Fattura INV-001 reinviata con successo');
      });

      it('should skip non-retryable errors', async () => {
        const failedInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiStatus: 'REJECTED', sdiErrorCode: '00001', sdiErrorMessage: 'Format error' },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(failedInvoices as any);

        const job = createMockJob({ type: 'retry-failed', maxRetries: 3 });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(mockSdiService.retryFailedInvoice).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('richiede intervento manuale')
        );
      });

      it('should handle no failed invoices', async () => {
        prismaMock.invoice.findMany.mockResolvedValue([]);

        const job = createMockJob({ type: 'retry-failed' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Nessuna fattura fallita da ritentare');
      });

      it('should handle retry failure', async () => {
        const failedInvoices = [
          { id: 'inv-1', invoiceNumber: 'INV-001', sdiStatus: 'REJECTED', sdiErrorCode: null },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(failedInvoices as any);
        mockSdiService.retryFailedInvoice.mockResolvedValue({
          success: false,
          error: 'Still failing',
        });

        const job = createMockJob({ type: 'retry-failed', maxRetries: 3 });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.warn).toHaveBeenCalledWith(
          'Fattura INV-001 retry fallito: Still failing'
        );
      });
    });

    describe('send-invoice', () => {
      it('should send invoice to SDI successfully', async () => {
        mockSdiService.sendInvoiceToSdi.mockResolvedValue({
          success: true,
          sdiId: 'sdi-123456',
        });

        const job = createMockJob({ type: 'send-invoice', invoiceId: 'inv-1' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(mockSdiService.sendInvoiceToSdi).toHaveBeenCalledWith('inv-1');
        expect(logger.info).toHaveBeenCalledWith('Fattura inv-1 inviata: SDI ID sdi-123456');
      });

      it('should throw error when send fails', async () => {
        mockSdiService.sendInvoiceToSdi.mockResolvedValue({
          success: false,
          error: 'Invalid invoice data',
        });

        const job = createMockJob({ type: 'send-invoice', invoiceId: 'inv-1' });

        jest.useRealTimers();
        await expect(processSdiJob(job)).rejects.toThrow('Invalid invoice data');
      });

      it('should throw error when invoiceId missing', async () => {
        const job = createMockJob({ type: 'send-invoice' });

        jest.useRealTimers();
        await expect(processSdiJob(job)).rejects.toThrow('invoiceId richiesto');
      });
    });

    describe('generate-xml', () => {
      it('should generate XML successfully', async () => {
        mockSdiService.generateInvoiceXml.mockResolvedValue({
          success: true,
          fileName: 'IT12345678901_00001.xml',
        });

        const job = createMockJob({ type: 'generate-xml', invoiceId: 'inv-1' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(mockSdiService.generateInvoiceXml).toHaveBeenCalledWith('inv-1');
        expect(logger.info).toHaveBeenCalledWith('XML generato: IT12345678901_00001.xml');
      });

      it('should throw error when generation fails', async () => {
        mockSdiService.generateInvoiceXml.mockResolvedValue({
          success: false,
          errors: ['Missing customer data', 'Invalid tax code'],
        });

        const job = createMockJob({ type: 'generate-xml', invoiceId: 'inv-1' });

        jest.useRealTimers();
        await expect(processSdiJob(job)).rejects.toThrow(
          'Missing customer data, Invalid tax code'
        );
      });

      it('should throw error when invoiceId missing', async () => {
        const job = createMockJob({ type: 'generate-xml' });

        jest.useRealTimers();
        await expect(processSdiJob(job)).rejects.toThrow('invoiceId richiesto');
      });
    });

    describe('daily-report', () => {
      it('should generate daily report', async () => {
        prismaMock.invoice.count
          .mockResolvedValueOnce(10) // sent
          .mockResolvedValueOnce(8)  // accepted
          .mockResolvedValueOnce(1)  // rejected
          .mockResolvedValueOnce(5); // pending

        prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);
        prismaMock.notification.create.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'daily-report' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith('Generazione report giornaliero SDI...');
        expect(logger.info).toHaveBeenCalledWith(
          'Report SDI giornaliero:',
          expect.objectContaining({
            sent: 10,
            accepted: 8,
            rejected: 1,
            pendingTotal: 5,
            successRate: 80,
          })
        );
      });

      it('should notify when there are rejections', async () => {
        prismaMock.invoice.count
          .mockResolvedValueOnce(10) // sent
          .mockResolvedValueOnce(8)  // accepted
          .mockResolvedValueOnce(2)  // rejected
          .mockResolvedValueOnce(5); // pending

        prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);
        prismaMock.notification.create.mockResolvedValue({} as any);

        const job = createMockJob({ type: 'daily-report' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(prismaMock.notification.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('2 fatture rifiutate'),
            }),
          })
        );
      });

      it('should handle zero sent invoices', async () => {
        prismaMock.invoice.count.mockResolvedValue(0);

        const job = createMockJob({ type: 'daily-report' });

        jest.useRealTimers();
        await processSdiJob(job);

        expect(logger.info).toHaveBeenCalledWith(
          'Report SDI giornaliero:',
          expect.objectContaining({
            successRate: 0,
          })
        );
      });
    });

    describe('unknown type', () => {
      it('should throw error for unknown job type', async () => {
        const job = createMockJob({ type: 'unknown-type' });

        jest.useRealTimers();
        await expect(processSdiJob(job)).rejects.toThrow(
          'Tipo job SDI sconosciuto: unknown-type'
        );
      });
    });
  });

  describe('initSdiWorker', () => {
    it('should create worker with correct config', () => {
      jest.useRealTimers();
      const worker = initSdiWorker();

      expect(worker).toBeDefined();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('scheduleSdiJobs', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });

    it('should schedule poll-status during business hours', async () => {
      await scheduleSdiJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-poll-status',
        { type: 'poll-status' },
        expect.objectContaining({
          repeat: { pattern: '*/5 8-20 * * 1-6' },
        })
      );
    });

    it('should schedule poll-notifications every 15 minutes', async () => {
      await scheduleSdiJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-poll-notifications',
        { type: 'poll-notifications' },
        expect.objectContaining({
          repeat: { pattern: '*/15 * * * *' },
        })
      );
    });

    it('should schedule retry-failed at 03:00', async () => {
      await scheduleSdiJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-retry-failed',
        { type: 'retry-failed', maxRetries: 3 },
        expect.objectContaining({
          repeat: { pattern: '0 3 * * *' },
        })
      );
    });

    it('should schedule daily-report at 08:00', async () => {
      await scheduleSdiJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-daily-report',
        { type: 'daily-report' },
        expect.objectContaining({
          repeat: { pattern: '0 8 * * *' },
        })
      );
    });

    it('should log configuration complete', async () => {
      await scheduleSdiJobs();

      expect(logger.info).toHaveBeenCalledWith('SDI scheduled jobs configurati');
    });
  });

  describe('queue helper functions', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });

    describe('queueSendInvoice', () => {
      it('should add send-invoice job with retry config', async () => {
        await queueSendInvoice('inv-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'send-invoice-inv-123',
          { type: 'send-invoice', invoiceId: 'inv-123' },
          expect.objectContaining({
            attempts: 3,
            backoff: { type: 'exponential', delay: 60000 },
          })
        );
      });
    });

    describe('queueGenerateXml', () => {
      it('should add generate-xml job with retry config', async () => {
        await queueGenerateXml('inv-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'generate-xml-inv-123',
          { type: 'generate-xml', invoiceId: 'inv-123' },
          expect.objectContaining({
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 },
          })
        );
      });
    });

    describe('queuePollStatus', () => {
      it('should add manual poll-status job', async () => {
        await queuePollStatus();

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'manual-poll-status',
          { type: 'poll-status' },
          expect.objectContaining({
            removeOnComplete: true,
          })
        );
      });
    });
  });
});
