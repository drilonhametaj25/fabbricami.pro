import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock repository
const mockOperationTypeRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isUsedInPhases: jest.fn(),
  reorder: jest.fn(),
  getNextSortOrder: jest.fn(),
  getQualifiedEmployees: jest.fn(),
  isEmployeeQualified: jest.fn(),
  addQualifiedEmployee: jest.fn(),
  removeQualifiedEmployee: jest.fn(),
  updateQualifiedEmployee: jest.fn(),
};

jest.mock('@server/repositories/operation-type.repository', () => ({
  __esModule: true,
  default: mockOperationTypeRepository,
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

import operationTypeService from '@server/services/operation-type.service';

describe('OperationTypeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================
  // getAll
  // ===================
  describe('getAll', () => {
    it('should return all active operation types by default', async () => {
      const mockTypes = [
        { id: 'type-1', code: 'PROD', name: 'Production' },
        { id: 'type-2', code: 'PACK', name: 'Packaging' },
      ];
      mockOperationTypeRepository.findAll.mockResolvedValue(mockTypes);

      const result = await operationTypeService.getAll();

      expect(result).toEqual(mockTypes);
      expect(mockOperationTypeRepository.findAll).toHaveBeenCalledWith(false);
    });

    it('should include inactive when requested', async () => {
      mockOperationTypeRepository.findAll.mockResolvedValue([]);

      await operationTypeService.getAll(true);

      expect(mockOperationTypeRepository.findAll).toHaveBeenCalledWith(true);
    });
  });

  // ===================
  // getById
  // ===================
  describe('getById', () => {
    it('should return operation type when found', async () => {
      const mockType = { id: 'type-1', code: 'PROD', name: 'Production' };
      mockOperationTypeRepository.findById.mockResolvedValue(mockType);

      const result = await operationTypeService.getById('type-1');

      expect(result).toEqual(mockType);
    });

    it('should throw error when not found', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue(null);

      await expect(
        operationTypeService.getById('type-unknown')
      ).rejects.toThrow('Tipo operazione non trovato');
    });
  });

  // ===================
  // getByCode
  // ===================
  describe('getByCode', () => {
    it('should return operation type by code', async () => {
      const mockType = { id: 'type-1', code: 'PROD', name: 'Production' };
      mockOperationTypeRepository.findByCode.mockResolvedValue(mockType);

      const result = await operationTypeService.getByCode('PROD');

      expect(result).toEqual(mockType);
    });

    it('should return null when not found', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);

      const result = await operationTypeService.getByCode('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  // ===================
  // create
  // ===================
  describe('create', () => {
    it('should throw error when code already exists', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue({
        id: 'existing',
        code: 'PROD',
      });

      await expect(
        operationTypeService.create({
          code: 'PROD',
          name: 'Production',
        })
      ).rejects.toThrow('Tipo operazione con codice "PROD" esiste già');
    });

    it('should create operation type with uppercase code', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.getNextSortOrder.mockResolvedValue(5);
      mockOperationTypeRepository.create.mockResolvedValue({
        id: 'type-new',
        code: 'PROD',
        name: 'Production',
        sortOrder: 5,
      });

      const result = await operationTypeService.create({
        code: 'prod', // lowercase
        name: 'Production',
      });

      expect(mockOperationTypeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PROD', // Should be uppercase
          name: 'Production',
          sortOrder: 5,
        })
      );
      expect(result.code).toBe('PROD');
    });

    it('should use provided sortOrder when specified', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.create.mockResolvedValue({});

      await operationTypeService.create({
        code: 'PROD',
        name: 'Production',
        sortOrder: 10,
      });

      expect(mockOperationTypeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 10,
        })
      );
      expect(mockOperationTypeRepository.getNextSortOrder).not.toHaveBeenCalled();
    });

    it('should set default values for optional fields', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.getNextSortOrder.mockResolvedValue(1);
      mockOperationTypeRepository.create.mockResolvedValue({});

      await operationTypeService.create({
        code: 'PROD',
        name: 'Production',
      });

      expect(mockOperationTypeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isExternal: false,
          requiresLiquidProduct: false,
        })
      );
    });

    it('should create with all optional fields', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.create.mockResolvedValue({});

      await operationTypeService.create({
        code: 'EXT',
        name: 'External Production',
        description: 'Third-party production',
        isExternal: true,
        defaultHourlyRate: 35,
        requiresLiquidProduct: true,
        sortOrder: 3,
      });

      expect(mockOperationTypeRepository.create).toHaveBeenCalledWith({
        code: 'EXT',
        name: 'External Production',
        description: 'Third-party production',
        isExternal: true,
        defaultHourlyRate: 35,
        requiresLiquidProduct: true,
        sortOrder: 3,
      });
    });
  });

  // ===================
  // update
  // ===================
  describe('update', () => {
    it('should throw error when operation type not found', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue(null);

      await expect(
        operationTypeService.update('type-unknown', { name: 'New Name' })
      ).rejects.toThrow('Tipo operazione non trovato');
    });

    it('should throw error when changing to existing code', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        code: 'OLD',
      });
      mockOperationTypeRepository.findByCode.mockResolvedValue({
        id: 'type-2',
        code: 'EXISTING',
      });

      await expect(
        operationTypeService.update('type-1', { code: 'EXISTING' })
      ).rejects.toThrow('Tipo operazione con codice "EXISTING" esiste già');
    });

    it('should allow keeping same code', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        code: 'PROD',
      });
      mockOperationTypeRepository.update.mockResolvedValue({
        id: 'type-1',
        code: 'PROD',
        name: 'Updated Name',
      });

      await operationTypeService.update('type-1', {
        code: 'PROD',
        name: 'Updated Name',
      });

      expect(mockOperationTypeRepository.findByCode).not.toHaveBeenCalled();
    });

    it('should convert code to uppercase', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        code: 'OLD',
      });
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.update.mockResolvedValue({
        id: 'type-1',
        code: 'NEW',
      });

      await operationTypeService.update('type-1', { code: 'new' });

      expect(mockOperationTypeRepository.update).toHaveBeenCalledWith(
        'type-1',
        expect.objectContaining({
          code: 'NEW',
        })
      );
    });

    it('should update without code change', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        code: 'PROD',
      });
      mockOperationTypeRepository.update.mockResolvedValue({});

      await operationTypeService.update('type-1', {
        name: 'New Name',
        defaultHourlyRate: 30,
      });

      expect(mockOperationTypeRepository.update).toHaveBeenCalledWith(
        'type-1',
        {
          name: 'New Name',
          defaultHourlyRate: 30,
        }
      );
    });
  });

  // ===================
  // delete
  // ===================
  describe('delete', () => {
    it('should throw error when operation type is used in phases', async () => {
      mockOperationTypeRepository.isUsedInPhases.mockResolvedValue(true);

      await expect(
        operationTypeService.delete('type-1')
      ).rejects.toThrow('Impossibile eliminare: tipo operazione utilizzato in fasi di produzione');
    });

    it('should delete when not used', async () => {
      mockOperationTypeRepository.isUsedInPhases.mockResolvedValue(false);
      mockOperationTypeRepository.delete.mockResolvedValue({});

      const result = await operationTypeService.delete('type-1');

      expect(result).toEqual({ success: true });
      expect(mockOperationTypeRepository.delete).toHaveBeenCalledWith('type-1');
    });
  });

  // ===================
  // reorder
  // ===================
  describe('reorder', () => {
    it('should reorder operation types', async () => {
      mockOperationTypeRepository.reorder.mockResolvedValue({});

      const result = await operationTypeService.reorder(['type-3', 'type-1', 'type-2']);

      expect(result).toEqual({ success: true });
      expect(mockOperationTypeRepository.reorder).toHaveBeenCalledWith(['type-3', 'type-1', 'type-2']);
    });
  });

  // ===================
  // getExternalTypes
  // ===================
  describe('getExternalTypes', () => {
    it('should return only external operation types', async () => {
      mockOperationTypeRepository.findAll.mockResolvedValue([
        { id: 'type-1', code: 'INT', isExternal: false },
        { id: 'type-2', code: 'EXT', isExternal: true },
        { id: 'type-3', code: 'EXT2', isExternal: true },
      ]);

      const result = await operationTypeService.getExternalTypes();

      expect(result).toHaveLength(2);
      expect(result.every(t => t.isExternal)).toBe(true);
    });
  });

  // ===================
  // getInternalTypes
  // ===================
  describe('getInternalTypes', () => {
    it('should return only internal operation types', async () => {
      mockOperationTypeRepository.findAll.mockResolvedValue([
        { id: 'type-1', code: 'INT', isExternal: false },
        { id: 'type-2', code: 'EXT', isExternal: true },
        { id: 'type-3', code: 'INT2', isExternal: false },
      ]);

      const result = await operationTypeService.getInternalTypes();

      expect(result).toHaveLength(2);
      expect(result.every(t => !t.isExternal)).toBe(true);
    });
  });

  // ===================
  // seedDefaults
  // ===================
  describe('seedDefaults', () => {
    it('should create default operation types that do not exist', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.create.mockImplementation(async (data) => ({
        id: `type-${data.code}`,
        ...data,
      }));

      const result = await operationTypeService.seedDefaults();

      expect(result.length).toBe(9); // 9 default types
      expect(mockOperationTypeRepository.create).toHaveBeenCalledTimes(9);
    });

    it('should skip existing operation types', async () => {
      mockOperationTypeRepository.findByCode.mockImplementation(async (code) => {
        if (code === 'PROD_INTERNA') {
          return { id: 'existing', code: 'PROD_INTERNA' };
        }
        return null;
      });
      mockOperationTypeRepository.create.mockImplementation(async (data) => ({
        id: `type-${data.code}`,
        ...data,
      }));

      const result = await operationTypeService.seedDefaults();

      // 9 defaults - 1 existing = 8 created
      expect(result.length).toBe(8);
      expect(mockOperationTypeRepository.create).toHaveBeenCalledTimes(8);
    });

    it('should assign sortOrder incrementally', async () => {
      mockOperationTypeRepository.findByCode.mockResolvedValue(null);
      mockOperationTypeRepository.create.mockImplementation(async (data) => data);

      await operationTypeService.seedDefaults();

      // Check sortOrder assignment
      const createCalls = mockOperationTypeRepository.create.mock.calls;
      expect(createCalls[0][0].sortOrder).toBe(1);
      expect(createCalls[1][0].sortOrder).toBe(2);
      expect(createCalls[8][0].sortOrder).toBe(9);
    });
  });

  // ===================
  // Qualified Employees
  // ===================
  describe('getQualifiedEmployees', () => {
    it('should throw error when operation type not found', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue(null);

      await expect(
        operationTypeService.getQualifiedEmployees('type-unknown')
      ).rejects.toThrow('Tipo operazione non trovato');
    });

    it('should return qualified employees', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      const mockEmployees = [
        { employee: { id: 'emp-1', firstName: 'John' }, isPrimary: true },
        { employee: { id: 'emp-2', firstName: 'Jane' }, isPrimary: false },
      ];
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue(mockEmployees);

      const result = await operationTypeService.getQualifiedEmployees('type-1');

      expect(result).toEqual(mockEmployees);
    });
  });

  describe('addQualifiedEmployee', () => {
    it('should throw error when operation type not found', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue(null);

      await expect(
        operationTypeService.addQualifiedEmployee('type-unknown', 'emp-1')
      ).rejects.toThrow('Tipo operazione non trovato');
    });

    it('should throw error when employee already qualified', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(true);

      await expect(
        operationTypeService.addQualifiedEmployee('type-1', 'emp-1')
      ).rejects.toThrow('Dipendente già qualificato per questa fase');
    });

    it('should add qualified employee and update hourly rate', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(false);
      mockOperationTypeRepository.addQualifiedEmployee.mockResolvedValue({});
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { employee: { hourlyRate: 25 } },
      ]);
      mockOperationTypeRepository.update.mockResolvedValue({});

      const result = await operationTypeService.addQualifiedEmployee('type-1', 'emp-1', true);

      expect(mockOperationTypeRepository.addQualifiedEmployee).toHaveBeenCalledWith(
        'type-1',
        'emp-1',
        true
      );
    });
  });

  describe('removeQualifiedEmployee', () => {
    it('should throw error when employee not qualified', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(false);

      await expect(
        operationTypeService.removeQualifiedEmployee('type-1', 'emp-1')
      ).rejects.toThrow('Dipendente non qualificato per questa fase');
    });

    it('should remove qualified employee', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(true);
      mockOperationTypeRepository.removeQualifiedEmployee.mockResolvedValue({});
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([]);

      const result = await operationTypeService.removeQualifiedEmployee('type-1', 'emp-1');

      expect(result).toEqual({ success: true });
    });
  });

  describe('updateQualifiedEmployee', () => {
    it('should throw error when employee not qualified', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(false);

      await expect(
        operationTypeService.updateQualifiedEmployee('type-1', 'emp-1', { isPrimary: true })
      ).rejects.toThrow('Dipendente non qualificato per questa fase');
    });

    it('should update qualified employee', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({ id: 'type-1' });
      mockOperationTypeRepository.isEmployeeQualified.mockResolvedValue(true);
      mockOperationTypeRepository.updateQualifiedEmployee.mockResolvedValue({
        isPrimary: true,
      });

      const result = await operationTypeService.updateQualifiedEmployee('type-1', 'emp-1', {
        isPrimary: true,
      });

      expect(result.isPrimary).toBe(true);
    });
  });

  // ===================
  // calculateAverageHourlyRate
  // ===================
  describe('calculateAverageHourlyRate', () => {
    it('should return default rate when no employees', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        defaultHourlyRate: 25,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([]);

      const result = await operationTypeService.calculateAverageHourlyRate('type-1');

      expect(result).toEqual({
        averageHourlyRate: 25,
        employeeCount: 0,
        source: 'default',
      });
    });

    it('should return none when no employees and no default', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        defaultHourlyRate: null,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([]);

      const result = await operationTypeService.calculateAverageHourlyRate('type-1');

      expect(result).toEqual({
        averageHourlyRate: null,
        employeeCount: 0,
        source: 'none',
      });
    });

    it('should calculate average from employees', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        defaultHourlyRate: 20,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { employee: { hourlyRate: 25 } },
        { employee: { hourlyRate: 30 } },
        { employee: { hourlyRate: 35 } },
      ]);

      const result = await operationTypeService.calculateAverageHourlyRate('type-1');

      expect(result).toEqual({
        averageHourlyRate: 30, // (25 + 30 + 35) / 3 = 30
        employeeCount: 3,
        source: 'employees',
      });
    });

    it('should filter out employees with zero rate', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        defaultHourlyRate: 20,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { employee: { hourlyRate: 30 } },
        { employee: { hourlyRate: 0 } }, // Should be filtered
        { employee: { hourlyRate: 40 } },
      ]);

      const result = await operationTypeService.calculateAverageHourlyRate('type-1');

      expect(result).toEqual({
        averageHourlyRate: 35, // (30 + 40) / 2 = 35
        employeeCount: 2,
        source: 'employees',
      });
    });

    it('should use default when all employees have zero rate', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        defaultHourlyRate: 25,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { employee: { hourlyRate: 0 } },
        { employee: { hourlyRate: 0 } },
      ]);

      const result = await operationTypeService.calculateAverageHourlyRate('type-1');

      expect(result).toEqual({
        averageHourlyRate: 25,
        employeeCount: 2,
        source: 'default',
      });
    });
  });

  // ===================
  // getByIdWithHourlyRate
  // ===================
  describe('getByIdWithHourlyRate', () => {
    it('should return operation type with calculated rate info', async () => {
      mockOperationTypeRepository.findById.mockResolvedValue({
        id: 'type-1',
        code: 'PROD',
        name: 'Production',
        defaultHourlyRate: 25,
      });
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { employee: { hourlyRate: 30 } },
      ]);

      const result = await operationTypeService.getByIdWithHourlyRate('type-1');

      expect(result).toMatchObject({
        id: 'type-1',
        code: 'PROD',
        calculatedHourlyRate: 30,
        hourlyRateSource: 'employees',
        qualifiedEmployeeCount: 1,
      });
    });
  });
});
