import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock repository
const mockWorkProcessRepository = {
  findByProduct: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  reorderSequences: jest.fn(),
  calculateProductOperationCost: jest.fn(),
  duplicateFromProduct: jest.fn(),
};

jest.mock('@server/repositories/work-process.repository', () => ({
  getWorkProcessRepository: jest.fn().mockReturnValue(mockWorkProcessRepository),
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

// Mock prisma
const mockPrisma = {
  product: {
    findUnique: jest.fn(),
  },
} as any;

import { WorkProcessService } from '@server/services/work-process.service';

describe('WorkProcessService', () => {
  let workProcessService: WorkProcessService;

  beforeEach(() => {
    jest.clearAllMocks();
    workProcessService = new WorkProcessService(mockPrisma);
  });

  // ===================
  // getProductWorkProcesses
  // ===================
  describe('getProductWorkProcesses', () => {
    it('should throw error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        workProcessService.getProductWorkProcesses('prod-unknown')
      ).rejects.toThrow('Prodotto non trovato');
    });

    it('should return work processes for product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      const mockProcesses = [
        { id: 'wp-1', sequence: 1, operationName: 'Cutting' },
        { id: 'wp-2', sequence: 2, operationName: 'Assembly' },
      ];
      mockWorkProcessRepository.findByProduct.mockResolvedValue(mockProcesses);

      const result = await workProcessService.getProductWorkProcesses('prod-1');

      expect(result).toEqual(mockProcesses);
      expect(mockWorkProcessRepository.findByProduct).toHaveBeenCalledWith('prod-1');
    });
  });

  // ===================
  // getWorkProcessById
  // ===================
  describe('getWorkProcessById', () => {
    it('should throw error when work process not found', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue(null);

      await expect(
        workProcessService.getWorkProcessById('wp-unknown')
      ).rejects.toThrow('Lavorazione non trovata');
    });

    it('should return work process when found', async () => {
      const mockProcess = { id: 'wp-1', operationName: 'Cutting' };
      mockWorkProcessRepository.findById.mockResolvedValue(mockProcess);

      const result = await workProcessService.getWorkProcessById('wp-1');

      expect(result).toEqual(mockProcess);
    });
  });

  // ===================
  // createWorkProcess
  // ===================
  describe('createWorkProcess', () => {
    it('should throw error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        workProcessService.createWorkProcess({
          productId: 'prod-unknown',
          operationName: 'Cutting',
          sequence: 1,
          standardTime: 30,
          hourlyRate: 25,
        })
      ).rejects.toThrow('Prodotto non trovato');
    });

    it('should throw error when standardTime is zero', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      await expect(
        workProcessService.createWorkProcess({
          productId: 'prod-1',
          operationName: 'Cutting',
          sequence: 1,
          standardTime: 0,
          hourlyRate: 25,
        })
      ).rejects.toThrow('Il tempo standard deve essere maggiore di zero');
    });

    it('should throw error when standardTime is negative', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      await expect(
        workProcessService.createWorkProcess({
          productId: 'prod-1',
          operationName: 'Cutting',
          sequence: 1,
          standardTime: -5,
          hourlyRate: 25,
        })
      ).rejects.toThrow('Il tempo standard deve essere maggiore di zero');
    });

    it('should throw error when hourlyRate is negative', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      await expect(
        workProcessService.createWorkProcess({
          productId: 'prod-1',
          operationName: 'Cutting',
          sequence: 1,
          standardTime: 30,
          hourlyRate: -10,
        })
      ).rejects.toThrow('Il costo orario non può essere negativo');
    });

    it('should create work process with valid data', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      const mockProcess = {
        id: 'wp-new',
        productId: 'prod-1',
        operationName: 'Cutting',
        sequence: 1,
        standardTime: 30,
        hourlyRate: 25,
      };
      mockWorkProcessRepository.create.mockResolvedValue(mockProcess);

      const result = await workProcessService.createWorkProcess({
        productId: 'prod-1',
        operationName: 'Cutting',
        sequence: 1,
        standardTime: 30,
        hourlyRate: 25,
      });

      expect(result).toEqual(mockProcess);
    });

    it('should allow zero hourlyRate', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockWorkProcessRepository.create.mockResolvedValue({});

      await workProcessService.createWorkProcess({
        productId: 'prod-1',
        operationName: 'Cutting',
        sequence: 1,
        standardTime: 30,
        hourlyRate: 0, // Should be allowed
      });

      expect(mockWorkProcessRepository.create).toHaveBeenCalled();
    });
  });

  // ===================
  // updateWorkProcess
  // ===================
  describe('updateWorkProcess', () => {
    it('should throw error when work process not found', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue(null);

      await expect(
        workProcessService.updateWorkProcess('wp-unknown', { operationName: 'New Name' })
      ).rejects.toThrow('Lavorazione non trovata');
    });

    it('should throw error when standardTime is invalid', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue({ id: 'wp-1' });

      await expect(
        workProcessService.updateWorkProcess('wp-1', { standardTime: 0 })
      ).rejects.toThrow('Il tempo standard deve essere maggiore di zero');
    });

    it('should throw error when hourlyRate is negative', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue({ id: 'wp-1' });

      await expect(
        workProcessService.updateWorkProcess('wp-1', { hourlyRate: -5 })
      ).rejects.toThrow('Il costo orario non può essere negativo');
    });

    it('should update work process with valid data', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue({ id: 'wp-1' });
      const mockUpdated = {
        id: 'wp-1',
        operationName: 'Updated Name',
        standardTime: 45,
      };
      mockWorkProcessRepository.update.mockResolvedValue(mockUpdated);

      const result = await workProcessService.updateWorkProcess('wp-1', {
        operationName: 'Updated Name',
        standardTime: 45,
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should allow partial update without validation for undefined fields', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue({ id: 'wp-1' });
      mockWorkProcessRepository.update.mockResolvedValue({});

      await workProcessService.updateWorkProcess('wp-1', {
        operationName: 'New Name',
        // standardTime and hourlyRate not provided
      });

      expect(mockWorkProcessRepository.update).toHaveBeenCalledWith('wp-1', {
        operationName: 'New Name',
      });
    });
  });

  // ===================
  // deleteWorkProcess
  // ===================
  describe('deleteWorkProcess', () => {
    it('should throw error when work process not found', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue(null);

      await expect(
        workProcessService.deleteWorkProcess('wp-unknown')
      ).rejects.toThrow('Lavorazione non trovata');
    });

    it('should delete work process when found', async () => {
      mockWorkProcessRepository.findById.mockResolvedValue({ id: 'wp-1' });
      mockWorkProcessRepository.delete.mockResolvedValue({ success: true });

      const result = await workProcessService.deleteWorkProcess('wp-1');

      expect(result).toEqual({ success: true });
      expect(mockWorkProcessRepository.delete).toHaveBeenCalledWith('wp-1');
    });
  });

  // ===================
  // reorderWorkProcesses
  // ===================
  describe('reorderWorkProcesses', () => {
    it('should throw error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        workProcessService.reorderWorkProcesses('prod-unknown', ['wp-1', 'wp-2'])
      ).rejects.toThrow('Prodotto non trovato');
    });

    it('should throw error when operation does not belong to product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockWorkProcessRepository.findByProduct.mockResolvedValue([
        { id: 'wp-1' },
        { id: 'wp-2' },
      ]);

      await expect(
        workProcessService.reorderWorkProcesses('prod-1', ['wp-1', 'wp-3']) // wp-3 doesn't belong
      ).rejects.toThrow('Lavorazione wp-3 non appartiene al prodotto');
    });

    it('should reorder work processes', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockWorkProcessRepository.findByProduct.mockResolvedValue([
        { id: 'wp-1' },
        { id: 'wp-2' },
        { id: 'wp-3' },
      ]);
      mockWorkProcessRepository.reorderSequences.mockResolvedValue({ success: true });

      const result = await workProcessService.reorderWorkProcesses('prod-1', ['wp-3', 'wp-1', 'wp-2']);

      expect(result).toEqual({ success: true });
      expect(mockWorkProcessRepository.reorderSequences).toHaveBeenCalledWith(
        'prod-1',
        ['wp-3', 'wp-1', 'wp-2']
      );
    });
  });

  // ===================
  // calculateProductOperationCost
  // ===================
  describe('calculateProductOperationCost', () => {
    it('should return calculated operation cost', async () => {
      mockWorkProcessRepository.calculateProductOperationCost.mockResolvedValue({
        totalCost: 150,
        totalTime: 120,
      });

      const result = await workProcessService.calculateProductOperationCost('prod-1');

      expect(result).toEqual({
        totalCost: 150,
        totalTime: 120,
      });
    });
  });

  // ===================
  // duplicateWorkProcesses
  // ===================
  describe('duplicateWorkProcesses', () => {
    it('should throw error when source product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);

      await expect(
        workProcessService.duplicateWorkProcesses('prod-source', 'prod-target')
      ).rejects.toThrow('Prodotto sorgente non trovato');
    });

    it('should throw error when target product not found', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'prod-source' })
        .mockResolvedValueOnce(null);

      await expect(
        workProcessService.duplicateWorkProcesses('prod-source', 'prod-target')
      ).rejects.toThrow('Prodotto destinazione non trovato');
    });

    it('should throw error when target already has operations', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'prod-source' })
        .mockResolvedValueOnce({ id: 'prod-target' });
      mockWorkProcessRepository.findByProduct.mockResolvedValue([
        { id: 'existing-wp' },
      ]);

      await expect(
        workProcessService.duplicateWorkProcesses('prod-source', 'prod-target')
      ).rejects.toThrow('Il prodotto destinazione ha già delle lavorazioni configurate');
    });

    it('should duplicate work processes', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'prod-source' })
        .mockResolvedValueOnce({ id: 'prod-target' });
      mockWorkProcessRepository.findByProduct.mockResolvedValue([]);
      const mockDuplicated = [
        { id: 'wp-new-1', productId: 'prod-target' },
        { id: 'wp-new-2', productId: 'prod-target' },
      ];
      mockWorkProcessRepository.duplicateFromProduct.mockResolvedValue(mockDuplicated);

      const result = await workProcessService.duplicateWorkProcesses('prod-source', 'prod-target');

      expect(result).toEqual(mockDuplicated);
    });
  });

  // ===================
  // calculateProductionTime
  // ===================
  describe('calculateProductionTime', () => {
    it('should calculate production time for single unit', async () => {
      mockWorkProcessRepository.findByProduct.mockResolvedValue([
        { id: 'wp-1', setupTime: 10, standardTime: 5 },
        { id: 'wp-2', setupTime: 5, standardTime: 3 },
        { id: 'wp-3', setupTime: null, standardTime: 2 }, // null setup time
      ]);

      const result = await workProcessService.calculateProductionTime('prod-1');

      // setupTime = 10 + 5 + 0 = 15
      // cycleTime = (5 + 3 + 2) * 1 = 10
      // totalTime = 25
      expect(result).toEqual({
        setupTime: 15,
        cycleTime: 10,
        totalTime: 25,
        totalHours: 0.42, // 25 / 60 = 0.4166...
      });
    });

    it('should calculate production time for multiple units', async () => {
      mockWorkProcessRepository.findByProduct.mockResolvedValue([
        { id: 'wp-1', setupTime: 10, standardTime: 5 },
        { id: 'wp-2', setupTime: 5, standardTime: 3 },
      ]);

      const result = await workProcessService.calculateProductionTime('prod-1', 10);

      // setupTime = 10 + 5 = 15 (fixed)
      // cycleTime = (5 + 3) * 10 = 80
      // totalTime = 95
      expect(result).toEqual({
        setupTime: 15,
        cycleTime: 80,
        totalTime: 95,
        totalHours: 1.58, // 95 / 60 = 1.5833...
      });
    });

    it('should return zero times when no operations', async () => {
      mockWorkProcessRepository.findByProduct.mockResolvedValue([]);

      const result = await workProcessService.calculateProductionTime('prod-1', 5);

      expect(result).toEqual({
        setupTime: 0,
        cycleTime: 0,
        totalTime: 0,
        totalHours: 0,
      });
    });
  });
});
