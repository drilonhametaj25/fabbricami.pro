import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ImportJobStatus, ImportJobType } from '@prisma/client';

// Mock prisma
const mockPrisma = {
  importJob: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { importJobService } from '@server/services/import-job.service';

describe('ImportJobService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================
  // create
  // ===================
  describe('create', () => {
    it('should create import job with RUNNING status', async () => {
      const mockJob = {
        id: 'job-1',
        type: 'CUSTOMERS' as ImportJobType,
        status: 'RUNNING' as ImportJobStatus,
        bullmqJobId: 'bull-123',
        createdBy: 'user-1',
        startedAt: new Date(),
      };
      mockPrisma.importJob.create.mockResolvedValue(mockJob);

      const result = await importJobService.create('CUSTOMERS', 'bull-123', 'user-1');

      expect(result).toEqual(mockJob);
      expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CUSTOMERS',
          status: 'RUNNING',
          bullmqJobId: 'bull-123',
          createdBy: 'user-1',
        }),
      });
    });

    it('should create import job without userId', async () => {
      mockPrisma.importJob.create.mockResolvedValue({});

      await importJobService.create('PRODUCTS', 'bull-456');

      expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PRODUCTS',
          createdBy: undefined,
        }),
      });
    });
  });

  // ===================
  // updateProgress
  // ===================
  describe('updateProgress', () => {
    it('should update progress with all fields', async () => {
      const progress = {
        currentPage: 5,
        totalPages: 10,
        totalItems: 100,
        imported: 40,
        updated: 10,
        errors: 2,
        errorLog: [{ error: 'Invalid email' }],
      };
      mockPrisma.importJob.update.mockResolvedValue({ id: 'job-1', ...progress });

      const result = await importJobService.updateProgress('job-1', progress);

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: progress,
      });
    });

    it('should update progress with partial fields', async () => {
      mockPrisma.importJob.update.mockResolvedValue({});

      await importJobService.updateProgress('job-1', {
        currentPage: 3,
        imported: 20,
      });

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          currentPage: 3,
          totalPages: undefined,
          totalItems: undefined,
          imported: 20,
          updated: undefined,
          errors: undefined,
          errorLog: undefined,
        },
      });
    });
  });

  // ===================
  // setStatus
  // ===================
  describe('setStatus', () => {
    it('should set status to COMPLETED with completedAt', async () => {
      mockPrisma.importJob.update.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
      });

      const result = await importJobService.setStatus('job-1', 'COMPLETED');

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set status to FAILED with completedAt', async () => {
      mockPrisma.importJob.update.mockResolvedValue({});

      await importJobService.setStatus('job-1', 'FAILED');

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'FAILED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set status to CANCELLED with completedAt', async () => {
      mockPrisma.importJob.update.mockResolvedValue({});

      await importJobService.setStatus('job-1', 'CANCELLED');

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set status to PAUSED with pausedAt', async () => {
      mockPrisma.importJob.update.mockResolvedValue({});

      await importJobService.setStatus('job-1', 'PAUSED');

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'PAUSED',
          pausedAt: expect.any(Date),
        },
      });
    });

    it('should set status to RUNNING without timestamps', async () => {
      mockPrisma.importJob.update.mockResolvedValue({});

      await importJobService.setStatus('job-1', 'RUNNING');

      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'RUNNING' },
      });
    });
  });

  // ===================
  // getActiveByType
  // ===================
  describe('getActiveByType', () => {
    it('should return active job for type', async () => {
      const mockJob = { id: 'job-1', type: 'CUSTOMERS', status: 'RUNNING' };
      mockPrisma.importJob.findFirst.mockResolvedValue(mockJob);

      const result = await importJobService.getActiveByType('CUSTOMERS');

      expect(result).toEqual(mockJob);
      expect(mockPrisma.importJob.findFirst).toHaveBeenCalledWith({
        where: {
          type: 'CUSTOMERS',
          status: { in: ['RUNNING', 'PAUSED'] },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should return null when no active job', async () => {
      mockPrisma.importJob.findFirst.mockResolvedValue(null);

      const result = await importJobService.getActiveByType('PRODUCTS');

      expect(result).toBeNull();
    });
  });

  // ===================
  // getById
  // ===================
  describe('getById', () => {
    it('should return job by id', async () => {
      const mockJob = { id: 'job-1', type: 'CUSTOMERS' };
      mockPrisma.importJob.findUnique.mockResolvedValue(mockJob);

      const result = await importJobService.getById('job-1');

      expect(result).toEqual(mockJob);
    });

    it('should return null when not found', async () => {
      mockPrisma.importJob.findUnique.mockResolvedValue(null);

      const result = await importJobService.getById('job-unknown');

      expect(result).toBeNull();
    });
  });

  // ===================
  // getByBullmqJobId
  // ===================
  describe('getByBullmqJobId', () => {
    it('should return job by bullmq job id', async () => {
      const mockJob = { id: 'job-1', bullmqJobId: 'bull-123' };
      mockPrisma.importJob.findFirst.mockResolvedValue(mockJob);

      const result = await importJobService.getByBullmqJobId('bull-123');

      expect(result).toEqual(mockJob);
      expect(mockPrisma.importJob.findFirst).toHaveBeenCalledWith({
        where: { bullmqJobId: 'bull-123' },
      });
    });
  });

  // ===================
  // list
  // ===================
  describe('list', () => {
    it('should list jobs with default pagination', async () => {
      const mockJobs = [{ id: 'job-1' }, { id: 'job-2' }];
      mockPrisma.importJob.findMany.mockResolvedValue(mockJobs);
      mockPrisma.importJob.count.mockResolvedValue(50);

      const result = await importJobService.list();

      expect(result).toEqual({
        items: mockJobs,
        total: 50,
      });
      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startedAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by type', async () => {
      mockPrisma.importJob.findMany.mockResolvedValue([]);
      mockPrisma.importJob.count.mockResolvedValue(0);

      await importJobService.list({ type: 'ORDERS' });

      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'ORDERS' },
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.importJob.findMany.mockResolvedValue([]);
      mockPrisma.importJob.count.mockResolvedValue(0);

      await importJobService.list({ status: 'COMPLETED' });

      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      );
    });

    it('should use custom pagination', async () => {
      mockPrisma.importJob.findMany.mockResolvedValue([]);
      mockPrisma.importJob.count.mockResolvedValue(100);

      await importJobService.list({ limit: 10, offset: 30 });

      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 30,
        })
      );
    });
  });

  // ===================
  // getResumableJobs
  // ===================
  describe('getResumableJobs', () => {
    it('should return paused and failed jobs', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'PAUSED' },
        { id: 'job-2', status: 'FAILED' },
      ];
      mockPrisma.importJob.findMany.mockResolvedValue(mockJobs);

      const result = await importJobService.getResumableJobs();

      expect(result).toEqual(mockJobs);
      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith({
        where: {
          type: undefined,
          status: { in: ['PAUSED', 'FAILED'] },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should filter by type', async () => {
      mockPrisma.importJob.findMany.mockResolvedValue([]);

      await importJobService.getResumableJobs('CUSTOMERS');

      expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith({
        where: {
          type: 'CUSTOMERS',
          status: { in: ['PAUSED', 'FAILED'] },
        },
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  // ===================
  // createResumeJob
  // ===================
  describe('createResumeJob', () => {
    it('should throw error when original job not found', async () => {
      mockPrisma.importJob.findUnique.mockResolvedValue(null);

      await expect(
        importJobService.createResumeJob('job-unknown', 'bull-new', 'user-1')
      ).rejects.toThrow('Job job-unknown not found');
    });

    it('should create resume job from original', async () => {
      const originalJob = {
        id: 'job-original',
        type: 'CUSTOMERS' as ImportJobType,
        currentPage: 5,
        totalPages: 10,
        totalItems: 100,
        imported: 40,
        updated: 10,
        errors: 2,
        errorLog: [{ error: 'Some error' }],
      };
      mockPrisma.importJob.findUnique.mockResolvedValue(originalJob);
      mockPrisma.importJob.update.mockResolvedValue({});
      mockPrisma.importJob.create.mockResolvedValue({
        id: 'job-new',
        ...originalJob,
        resumedFrom: 'job-original',
      });

      const result = await importJobService.createResumeJob(
        'job-original',
        'bull-new',
        'user-1'
      );

      // Original job should be marked completed
      expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-original' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });

      // New job should be created with original progress
      expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CUSTOMERS',
          status: 'RUNNING',
          currentPage: 5,
          totalPages: 10,
          imported: 40,
          resumedFrom: 'job-original',
          bullmqJobId: 'bull-new',
          createdBy: 'user-1',
        }),
      });
    });
  });

  // ===================
  // cleanOldJobs
  // ===================
  describe('cleanOldJobs', () => {
    it('should delete old completed and cancelled jobs', async () => {
      mockPrisma.importJob.deleteMany.mockResolvedValue({ count: 15 });

      const result = await importJobService.cleanOldJobs(30);

      expect(result).toBe(15);
      expect(mockPrisma.importJob.deleteMany).toHaveBeenCalledWith({
        where: {
          startedAt: { lt: expect.any(Date) },
          status: { in: ['COMPLETED', 'CANCELLED'] },
        },
      });
    });

    it('should use default 30 days', async () => {
      mockPrisma.importJob.deleteMany.mockResolvedValue({ count: 0 });

      await importJobService.cleanOldJobs();

      expect(mockPrisma.importJob.deleteMany).toHaveBeenCalled();
    });
  });

  // ===================
  // getStats
  // ===================
  describe('getStats', () => {
    it('should return complete statistics', async () => {
      mockPrisma.importJob.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5)  // running
        .mockResolvedValueOnce(2)  // paused
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(3); // cancelled
      mockPrisma.importJob.groupBy.mockResolvedValue([
        { type: 'CUSTOMERS', _count: 50 },
        { type: 'PRODUCTS', _count: 30 },
        { type: 'ORDERS', _count: 20 },
      ]);

      const result = await importJobService.getStats();

      expect(result).toEqual({
        total: 100,
        running: 5,
        paused: 2,
        completed: 80,
        failed: 10,
        cancelled: 3,
        byType: {
          CUSTOMERS: 50,
          PRODUCTS: 30,
          ORDERS: 20,
        },
      });
    });

    it('should handle missing types in groupBy', async () => {
      mockPrisma.importJob.count.mockResolvedValue(10);
      mockPrisma.importJob.groupBy.mockResolvedValue([
        { type: 'CUSTOMERS', _count: 10 },
      ]);

      const result = await importJobService.getStats();

      expect(result.byType).toEqual({
        CUSTOMERS: 10,
        PRODUCTS: 0,
        ORDERS: 0,
      });
    });
  });
});
