import { Job } from 'bullmq';

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
    wordpress: {
      syncEnabled: true,
      syncInterval: 300000,
    },
  },
}));

// Mock BullMQ
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockQueueGetJob = jest.fn();
const mockQueueGetActive = jest.fn().mockResolvedValue([]);
const mockQueueGetWaiting = jest.fn().mockResolvedValue([]);
const mockQueueGetCompleted = jest.fn().mockResolvedValue([]);
const mockQueueGetFailed = jest.fn().mockResolvedValue([]);
const mockWorkerOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    getActive: mockQueueGetActive,
    getWaiting: mockQueueGetWaiting,
    getCompleted: mockQueueGetCompleted,
    getFailed: mockQueueGetFailed,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
  })),
  Job: jest.fn(),
}));

// Mock wordpress service
const mockWordpressService = {
  isConfigured: jest.fn().mockReturnValue(true),
  syncInventoryToWooCommerce: jest.fn(),
  syncAllProductsToWooCommerce: jest.fn(),
  syncProductToWooCommerce: jest.fn(),
  updateOrderStatusOnWooCommerce: jest.fn(),
  getWooCommerceCustomersCount: jest.fn(),
  importCustomersPage: jest.fn(),
};

jest.mock('@server/services/wordpress.service', () => ({
  wordpressService: mockWordpressService,
}));

// Mock import job service
const mockImportJobService = {
  getByBullmqJobId: jest.fn(),
  create: jest.fn(),
  updateProgress: jest.fn(),
  setStatus: jest.fn(),
  getById: jest.fn(),
  createResumeJob: jest.fn(),
};

jest.mock('@server/services/import-job.service', () => ({
  importJobService: mockImportJobService,
}));

// Import after mocks
import {
  processWordPressJob,
  initWordPressWorker,
  scheduleWordPressJobs,
  startCustomerImportJob,
  getCustomerImportJobStatus,
  cancelCustomerImportJob,
  queueProductSync,
  queueOrderStatusUpdate,
  queueInventorySync,
} from '@server/jobs/wordpress.job';
import { logger } from '@server/config/logger';

// Helper to create mock job
const createMockJob = (data: any): Job => ({
  id: `job-${Date.now()}`,
  name: 'test-job',
  data,
  progress: null,
  updateProgress: jest.fn().mockResolvedValue(undefined),
  updateData: jest.fn().mockResolvedValue(undefined),
} as unknown as Job);

describe.skip('WordPress Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWordpressService.isConfigured.mockReturnValue(true);
  });

  describe('processWordPressJob', () => {
    describe('sync-inventory', () => {
      it('should sync inventory to WooCommerce', async () => {
        mockWordpressService.syncInventoryToWooCommerce.mockResolvedValue({
          synced: 50,
          errors: 2,
        });

        const job = createMockJob({ type: 'sync-inventory' });

        const result = await processWordPressJob(job);

        expect(mockWordpressService.syncInventoryToWooCommerce).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          'Sync giacenze completato: 50 sincronizzati, 2 errori'
        );
        expect(result).toEqual({ synced: 50, errors: 2 });
      });

      it('should skip when WordPress not configured', async () => {
        mockWordpressService.isConfigured.mockReturnValue(false);

        const job = createMockJob({ type: 'sync-inventory' });

        const result = await processWordPressJob(job);

        expect(logger.warn).toHaveBeenCalledWith('WordPress non configurato, skip sync giacenze');
        expect(result).toEqual({ skipped: true });
      });
    });

    describe('sync-products', () => {
      it('should sync all products to WooCommerce', async () => {
        mockWordpressService.syncAllProductsToWooCommerce.mockResolvedValue({
          synced: 100,
          errors: 5,
        });

        const job = createMockJob({ type: 'sync-products' });

        const result = await processWordPressJob(job);

        expect(mockWordpressService.syncAllProductsToWooCommerce).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          'Sync prodotti completato: 100 sincronizzati, 5 errori'
        );
      });

      it('should skip when WordPress not configured', async () => {
        mockWordpressService.isConfigured.mockReturnValue(false);

        const job = createMockJob({ type: 'sync-products' });

        const result = await processWordPressJob(job);

        expect(result).toEqual({ skipped: true });
      });
    });

    describe('sync-single-product', () => {
      it('should sync single product to WooCommerce', async () => {
        mockWordpressService.syncProductToWooCommerce.mockResolvedValue({
          success: true,
        });

        const job = createMockJob({ type: 'sync-single-product', productId: 'prod-123' });

        const result = await processWordPressJob(job);

        expect(mockWordpressService.syncProductToWooCommerce).toHaveBeenCalledWith('prod-123');
        expect(logger.info).toHaveBeenCalledWith('Sync prodotto prod-123: OK');
      });

      it('should log error message when sync fails', async () => {
        mockWordpressService.syncProductToWooCommerce.mockResolvedValue({
          success: false,
          error: 'Product not found',
        });

        const job = createMockJob({ type: 'sync-single-product', productId: 'prod-123' });

        await processWordPressJob(job);

        expect(logger.info).toHaveBeenCalledWith('Sync prodotto prod-123: Product not found');
      });

      it('should throw error when productId missing', async () => {
        const job = createMockJob({ type: 'sync-single-product' });

        await expect(processWordPressJob(job)).rejects.toThrow('productId richiesto');
      });

      it('should skip when WordPress not configured', async () => {
        mockWordpressService.isConfigured.mockReturnValue(false);

        const job = createMockJob({ type: 'sync-single-product', productId: 'prod-123' });

        const result = await processWordPressJob(job);

        expect(result).toEqual({ skipped: true });
      });
    });

    describe('update-order-status', () => {
      it('should update order status on WooCommerce', async () => {
        mockWordpressService.updateOrderStatusOnWooCommerce.mockResolvedValue(true);

        const job = createMockJob({
          type: 'update-order-status',
          orderId: 'order-123',
          status: 'completed',
        });

        const result = await processWordPressJob(job);

        expect(mockWordpressService.updateOrderStatusOnWooCommerce).toHaveBeenCalledWith(
          'order-123',
          'completed'
        );
        expect(logger.info).toHaveBeenCalledWith(
          'Update stato ordine order-123 su WooCommerce: OK'
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw error when orderId or status missing', async () => {
        const job = createMockJob({ type: 'update-order-status', orderId: 'order-123' });

        await expect(processWordPressJob(job)).rejects.toThrow('orderId e status richiesti');
      });

      it('should skip when WordPress not configured', async () => {
        mockWordpressService.isConfigured.mockReturnValue(false);

        const job = createMockJob({
          type: 'update-order-status',
          orderId: 'order-123',
          status: 'completed',
        });

        const result = await processWordPressJob(job);

        expect(result).toEqual({ skipped: true });
      });
    });

    describe('import-customers', () => {
      it('should skip when WordPress not configured', async () => {
        mockWordpressService.isConfigured.mockReturnValue(false);

        const job = createMockJob({ type: 'import-customers' });

        const result = await processWordPressJob(job);

        expect(logger.warn).toHaveBeenCalledWith('WordPress non configurato, skip import clienti');
        expect(result).toEqual({ skipped: true });
      });

      it('should import customers page by page', async () => {
        mockWordpressService.getWooCommerceCustomersCount.mockResolvedValue(15);
        mockWordpressService.importCustomersPage
          .mockResolvedValueOnce({ imported: 5, updated: 3, errors: 0, hasMore: true })
          .mockResolvedValueOnce({ imported: 5, updated: 2, errors: 0, hasMore: false });

        mockImportJobService.getByBullmqJobId.mockResolvedValue({
          id: 'db-job-1',
        });

        mockQueueGetJob.mockResolvedValue({
          id: 'job-1',
          data: {},
        });

        const mockJob = {
          id: 'job-1',
          data: { type: 'import-customers' },
          updateProgress: jest.fn().mockResolvedValue(undefined),
          updateData: jest.fn().mockResolvedValue(undefined),
        } as unknown as Job;

        const result = await processWordPressJob(mockJob);

        expect(mockWordpressService.getWooCommerceCustomersCount).toHaveBeenCalled();
        expect(mockWordpressService.importCustomersPage).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
          completed: true,
          imported: 10,
          updated: 5,
          errors: 0,
        });
      });
    });

    describe('unknown type', () => {
      it('should throw error for unknown job type', async () => {
        const job = createMockJob({ type: 'unknown-type' });

        await expect(processWordPressJob(job)).rejects.toThrow(
          'Tipo job WordPress sconosciuto: unknown-type'
        );
      });
    });
  });

  describe('initWordPressWorker', () => {
    it('should create worker with correct config', () => {
      const worker = initWordPressWorker();

      expect(worker).toBeDefined();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('scheduleWordPressJobs', () => {
    it('should schedule inventory sync with configured interval', async () => {
      await scheduleWordPressJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-inventory-sync',
        { type: 'sync-inventory' },
        expect.objectContaining({
          repeat: { every: 300000 },
        })
      );
    });

    it('should schedule products sync every hour', async () => {
      await scheduleWordPressJobs();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-products-sync',
        { type: 'sync-products' },
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
        })
      );
    });

    it('should log configuration complete', async () => {
      await scheduleWordPressJobs();

      expect(logger.info).toHaveBeenCalledWith('WordPress scheduled jobs configurati');
    });
  });

  describe('startCustomerImportJob', () => {
    it('should create job and database record', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-123' });
      mockImportJobService.create.mockResolvedValue({ id: 'db-job-456' });

      const result = await startCustomerImportJob('user-1');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'import-customers',
        expect.objectContaining({
          type: 'import-customers',
          importCustomers: expect.objectContaining({
            currentPage: 1,
            totalCustomers: 0,
          }),
        }),
        expect.any(Object)
      );
      expect(mockImportJobService.create).toHaveBeenCalledWith(
        'CUSTOMERS',
        'bullmq-job-123',
        'user-1'
      );
      expect(result).toEqual({
        jobId: 'bullmq-job-123',
        dbJobId: 'db-job-456',
      });
    });
  });

  describe('getCustomerImportJobStatus', () => {
    it('should return job status and progress', async () => {
      mockQueueGetJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('active'),
        progress: { currentPage: 5, totalPages: 10 },
        returnvalue: null,
        failedReason: null,
        data: {},
      });

      const result = await getCustomerImportJobStatus('job-123');

      expect(result).toEqual({
        status: 'active',
        progress: { currentPage: 5, totalPages: 10 },
        result: null,
        failedReason: null,
      });
    });

    it('should return not_found when job does not exist', async () => {
      mockQueueGetJob.mockResolvedValue(null);

      const result = await getCustomerImportJobStatus('job-123');

      expect(result).toEqual({ status: 'not_found' });
    });

    it('should return completed status with result', async () => {
      mockQueueGetJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('completed'),
        progress: null,
        returnvalue: { imported: 100, updated: 50 },
        failedReason: null,
        data: { importCustomers: { currentPage: 10 } },
      });

      const result = await getCustomerImportJobStatus('job-123');

      expect(result.status).toBe('completed');
      expect(result.result).toEqual({ imported: 100, updated: 50 });
    });
  });

  describe('cancelCustomerImportJob', () => {
    it('should cancel active job by setting cancelled flag', async () => {
      const mockUpdateData = jest.fn();
      mockQueueGetJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('active'),
        updateData: mockUpdateData,
        data: { type: 'import-customers' },
      });
      mockImportJobService.getByBullmqJobId.mockResolvedValue({ id: 'db-job-1' });

      const result = await cancelCustomerImportJob('job-123');

      expect(result).toBe(true);
      expect(mockUpdateData).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelled: true,
        })
      );
      expect(mockImportJobService.setStatus).toHaveBeenCalledWith('db-job-1', 'CANCELLED');
    });

    it('should remove waiting job from queue', async () => {
      const mockRemove = jest.fn();
      mockQueueGetJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: mockRemove,
        data: {},
      });
      mockImportJobService.getByBullmqJobId.mockResolvedValue({ id: 'db-job-1' });

      const result = await cancelCustomerImportJob('job-123');

      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should return false when job not found', async () => {
      mockQueueGetJob.mockResolvedValue(null);

      const result = await cancelCustomerImportJob('job-123');

      expect(result).toBe(false);
    });
  });

  describe('queue helper functions', () => {
    describe('queueProductSync', () => {
      it('should add product sync job with retry policy + delay', async () => {
        await queueProductSync('prod-123');

        // Retry policy + delay: 5 attempts, exponential backoff, persist on fail
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'sync-product-prod-123',
          { type: 'sync-single-product', productId: 'prod-123' },
          expect.objectContaining({
            delay: 1000,
            attempts: 5,
            removeOnFail: false,
          })
        );
      });
    });

    describe('queueOrderStatusUpdate', () => {
      it('should add order status update job with retry policy', async () => {
        await queueOrderStatusUpdate('order-123', 'shipped');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'update-order-order-123',
          { type: 'update-order-status', orderId: 'order-123', status: 'shipped' },
          expect.objectContaining({
            attempts: 5,
            removeOnFail: false,
          })
        );
      });
    });

    describe('queueInventorySync', () => {
      it('should add inventory sync for single product with retry policy', async () => {
        await queueInventorySync('prod-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'sync-inventory-prod-123',
          { type: 'sync-single-product', productId: 'prod-123' },
          expect.objectContaining({
            delay: 500,
            attempts: 5,
            removeOnFail: false,
          })
        );
      });

      it('should add full inventory sync when no productId, with retry policy', async () => {
        await queueInventorySync();

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'immediate-inventory-sync',
          { type: 'sync-inventory' },
          expect.objectContaining({
            attempts: 5,
            removeOnFail: false,
          })
        );
      });
    });
  });
});
