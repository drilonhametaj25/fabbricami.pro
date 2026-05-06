/**
 * Manufacturing Service Tests
 * Comprehensive tests for production pipeline, cost calculation, and production orders
 */

import { prismaMock, mockFactories, createDecimal } from '../__mocks__/prisma';

// Mock dependencies before importing the service
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock material service
const mockMaterialService = {
  checkLowStock: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@server/services/material.service', () => ({
  __esModule: true,
  default: mockMaterialService,
}));

// Mock notification service
const mockNotificationService = {
  notifyRoles: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

// Mock operation type repository
const mockOperationTypeRepository = {
  calculateAverageHourlyRate: jest.fn().mockResolvedValue(25),
  getQualifiedEmployees: jest.fn().mockResolvedValue([]),
};
jest.mock('@server/repositories/operation-type.repository', () => ({
  __esModule: true,
  default: mockOperationTypeRepository,
}));

import manufacturingService from '@server/services/manufacturing.service';

describe('ManufacturingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default transaction mock
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn(prismaMock);
      }
      // For array of operations (reorderPhases)
      return Promise.all(fn);
    });
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  const createMockManufacturingPhase = (overrides: any = {}) => ({
    id: 'phase-1',
    productId: 'prod-1',
    operationTypeId: 'op-1',
    sequence: 1,
    name: 'Assembly Phase',
    description: 'Assembly description',
    standardTime: 60,
    setupTime: 10,
    externalCostPerUnit: null,
    supplierId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    operationType: {
      id: 'op-1',
      name: 'Assembly',
      code: 'ASS',
      description: null,
      defaultHourlyRate: createDecimal(25),
      isExternal: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    externalSupplier: null,
    materials: [],
    qualifiedEmployees: [],
    ...overrides,
  });

  const createMockProductionOrder = (overrides: any = {}) => ({
    id: 'prodord-1',
    orderNumber: 'MO-2026-000001',
    productId: 'prod-1',
    quantity: 10,
    status: 'DRAFT',
    salesOrderId: null,
    plannedStartDate: null,
    plannedEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    priority: 0,
    notes: null,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockProductionPhase = (overrides: any = {}) => ({
    id: 'prodphase-1',
    productionOrderId: 'prodord-1',
    manufacturingPhaseId: 'phase-1',
    sequence: 1,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    actualTime: null,
    laborCost: null,
    materialCost: null,
    externalCost: null,
    assignedEmployeeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==========================================
  // PIPELINE MANAGEMENT TESTS
  // ==========================================

  describe('getProductPipeline', () => {
    it('should return product pipeline phases ordered by sequence', async () => {
      const mockPhases = [
        createMockManufacturingPhase({ id: 'phase-1', sequence: 1 }),
        createMockManufacturingPhase({ id: 'phase-2', sequence: 2, name: 'Packaging' }),
      ];

      prismaMock.manufacturingPhase.findMany.mockResolvedValue(mockPhases as any);

      const result = await manufacturingService.getProductPipeline('prod-1');

      expect(result).toHaveLength(2);
      expect(result[0].sequence).toBe(1);
      expect(result[1].sequence).toBe(2);
      expect(prismaMock.manufacturingPhase.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1', isActive: true },
        orderBy: { sequence: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array for product with no phases', async () => {
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([]);

      const result = await manufacturingService.getProductPipeline('prod-no-phases');

      expect(result).toEqual([]);
    });
  });

  describe('addPhaseToProduct', () => {
    it('should add a new phase to product pipeline', async () => {
      const product = mockFactories.product({ id: 'prod-1' });
      const operationType = { id: 'op-1', name: 'Assembly' };
      const newPhase = createMockManufacturingPhase();

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.operationType.findUnique.mockResolvedValue(operationType as any);
      prismaMock.manufacturingPhase.create.mockResolvedValue({ id: 'phase-new' } as any);
      prismaMock.manufacturingPhase.findUnique.mockResolvedValue(newPhase as any);

      const result = await manufacturingService.addPhaseToProduct('prod-1', {
        operationTypeId: 'op-1',
        sequence: 1,
        name: 'Assembly Phase',
        standardTime: 60,
      });

      expect(result).toBeDefined();
      expect(prismaMock.manufacturingPhase.create).toHaveBeenCalled();
    });

    it('should add phase with materials', async () => {
      const product = mockFactories.product({ id: 'prod-1' });
      const operationType = { id: 'op-1', name: 'Assembly' };
      const newPhase = createMockManufacturingPhase();

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.operationType.findUnique.mockResolvedValue(operationType as any);
      prismaMock.manufacturingPhase.create.mockResolvedValue({ id: 'phase-new' } as any);
      prismaMock.phaseMaterial.createMany.mockResolvedValue({ count: 2 });
      prismaMock.manufacturingPhase.findUnique.mockResolvedValue(newPhase as any);

      const result = await manufacturingService.addPhaseToProduct('prod-1', {
        operationTypeId: 'op-1',
        sequence: 1,
        name: 'Assembly Phase',
        standardTime: 60,
        materials: [
          { materialId: 'mat-1', quantity: 2, unit: 'pz' },
          { materialId: 'mat-2', quantity: 5, unit: 'kg', scrapPercentage: 10 },
        ],
      });

      expect(result).toBeDefined();
      expect(prismaMock.phaseMaterial.createMany).toHaveBeenCalled();
    });

    it('should add phase with employees', async () => {
      const product = mockFactories.product({ id: 'prod-1' });
      const operationType = { id: 'op-1', name: 'Assembly' };
      const newPhase = createMockManufacturingPhase();

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.operationType.findUnique.mockResolvedValue(operationType as any);
      prismaMock.manufacturingPhase.create.mockResolvedValue({ id: 'phase-new' } as any);
      prismaMock.phaseEmployee.createMany.mockResolvedValue({ count: 1 });
      prismaMock.manufacturingPhase.findUnique.mockResolvedValue(newPhase as any);

      const result = await manufacturingService.addPhaseToProduct('prod-1', {
        operationTypeId: 'op-1',
        sequence: 1,
        name: 'Assembly Phase',
        standardTime: 60,
        employees: [
          { employeeId: 'emp-1', isPrimary: true },
        ],
      });

      expect(result).toBeDefined();
      expect(prismaMock.phaseEmployee.createMany).toHaveBeenCalled();
    });

    it('should throw error if product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.addPhaseToProduct('invalid-prod', {
          operationTypeId: 'op-1',
          sequence: 1,
          name: 'Test',
          standardTime: 60,
        })
      ).rejects.toThrow('Prodotto non trovato');
    });

    it('should throw error if operation type not found', async () => {
      const product = mockFactories.product({ id: 'prod-1' });
      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.operationType.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.addPhaseToProduct('prod-1', {
          operationTypeId: 'invalid-op',
          sequence: 1,
          name: 'Test',
          standardTime: 60,
        })
      ).rejects.toThrow('Tipo operazione non trovato');
    });
  });

  describe('updatePhase', () => {
    it('should update phase basic data', async () => {
      const existingPhase = createMockManufacturingPhase();
      const updatedPhase = { ...existingPhase, name: 'Updated Phase' };

      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(existingPhase as any);
      prismaMock.manufacturingPhase.update.mockResolvedValue(updatedPhase as any);
      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(updatedPhase as any);

      const result = await manufacturingService.updatePhase('phase-1', {
        name: 'Updated Phase',
        standardTime: 90,
      });

      expect(result).toBeDefined();
      expect(prismaMock.manufacturingPhase.update).toHaveBeenCalledWith({
        where: { id: 'phase-1' },
        data: expect.objectContaining({
          name: 'Updated Phase',
          standardTime: 90,
        }),
      });
    });

    it('should update phase materials when provided', async () => {
      const existingPhase = createMockManufacturingPhase();
      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(existingPhase as any);
      prismaMock.manufacturingPhase.update.mockResolvedValue(existingPhase as any);
      prismaMock.phaseMaterial.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.phaseMaterial.createMany.mockResolvedValue({ count: 2 });
      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(existingPhase as any);

      await manufacturingService.updatePhase('phase-1', {
        materials: [
          { materialId: 'mat-1', quantity: 3, unit: 'pz' },
          { materialId: 'mat-2', quantity: 1, unit: 'kg' },
        ],
      });

      expect(prismaMock.phaseMaterial.deleteMany).toHaveBeenCalledWith({
        where: { phaseId: 'phase-1' },
      });
      expect(prismaMock.phaseMaterial.createMany).toHaveBeenCalled();
    });

    it('should update phase employees when provided', async () => {
      const existingPhase = createMockManufacturingPhase();
      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(existingPhase as any);
      prismaMock.manufacturingPhase.update.mockResolvedValue(existingPhase as any);
      prismaMock.phaseEmployee.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.phaseEmployee.createMany.mockResolvedValue({ count: 1 });
      prismaMock.manufacturingPhase.findUnique.mockResolvedValueOnce(existingPhase as any);

      await manufacturingService.updatePhase('phase-1', {
        employees: [{ employeeId: 'emp-1', isPrimary: true }],
      });

      expect(prismaMock.phaseEmployee.deleteMany).toHaveBeenCalledWith({
        where: { phaseId: 'phase-1' },
      });
      expect(prismaMock.phaseEmployee.createMany).toHaveBeenCalled();
    });

    it('should throw error if phase not found', async () => {
      prismaMock.manufacturingPhase.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.updatePhase('invalid-phase', { name: 'Test' })
      ).rejects.toThrow('Fase non trovata');
    });
  });

  describe('deletePhase', () => {
    it('should soft delete a phase', async () => {
      prismaMock.manufacturingPhase.update.mockResolvedValue({ id: 'phase-1', isActive: false } as any);

      const result = await manufacturingService.deletePhase('phase-1');

      expect(result).toEqual({ success: true });
      expect(prismaMock.manufacturingPhase.update).toHaveBeenCalledWith({
        where: { id: 'phase-1' },
        data: { isActive: false },
      });
    });
  });

  describe('reorderPhases', () => {
    it('should reorder phases by updating sequences', async () => {
      const phaseIds = ['phase-3', 'phase-1', 'phase-2'];

      prismaMock.manufacturingPhase.update.mockResolvedValue({} as any);

      const result = await manufacturingService.reorderPhases('prod-1', phaseIds);

      expect(result).toEqual({ success: true });
    });
  });

  // ==========================================
  // COST CALCULATION TESTS
  // ==========================================

  describe('calculateProductCost', () => {
    it('should calculate total product cost', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        materials: [
          {
            materialId: 'mat-1',
            quantity: createDecimal(2),
            unit: 'pz',
            scrapPercentage: createDecimal(5),
            material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001', cost: createDecimal(10) },
          },
        ],
      });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCost('prod-1');

      expect(result).toHaveProperty('productId', 'prod-1');
      expect(result).toHaveProperty('materialCost');
      expect(result).toHaveProperty('laborCost');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('breakdown');
    });
  });

  describe('calculateProductCostDetailed', () => {
    it('should calculate detailed cost with material breakdown', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        materials: [
          {
            materialId: 'mat-1',
            quantity: createDecimal(2),
            unit: 'pz',
            scrapPercentage: createDecimal(5),
            material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001', cost: createDecimal(10) },
          },
        ],
      });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCostDetailed('prod-1');

      expect(result.productId).toBe('prod-1');
      expect(result.productName).toBe('Test Product');
      expect(result.materialCost).toBeGreaterThan(0);
      expect(result.breakdown.phases).toHaveLength(1);
      expect(result.breakdown.explodedMaterials).toHaveLength(1);
    });

    it('should calculate cost with quantity multiplier', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        materials: [
          {
            materialId: 'mat-1',
            quantity: createDecimal(2),
            unit: 'pz',
            scrapPercentage: createDecimal(0),
            material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001', cost: createDecimal(10) },
          },
        ],
      });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCostDetailed('prod-1', 5);

      // Material cost: 2 qty * 10 cost * 5 multiplier = 100
      expect(result.materialCost).toBe(100);
    });

    it('should calculate external cost for external phases', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        externalCostPerUnit: createDecimal(50),
        operationType: {
          id: 'op-1',
          name: 'External Op',
          isExternal: true,
          defaultHourlyRate: createDecimal(0),
        },
        materials: [],
      });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCostDetailed('prod-1', 2);

      expect(result.externalCost).toBe(100); // 50 * 2
    });

    it('should calculate labor cost using employee hourly rates', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        standardTime: 60, // 1 hour
        setupTime: 0,
        materials: [],
      });

      mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(30);
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([
        { id: 'emp-1', hourlyRate: 30 },
      ]);

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCostDetailed('prod-1');

      expect(result.laborCost).toBe(30); // 1 hour * 30/hour
      expect(result.breakdown.phases[0].hourlyRateSource).toBe('employees');
    });

    it('should use default hourly rate when no employees', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        standardTime: 60,
        setupTime: 0,
        materials: [],
        operationType: {
          id: 'op-1',
          name: 'Assembly',
          isExternal: false,
          defaultHourlyRate: createDecimal(25),
        },
      });

      mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(null);
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([]);

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.calculateProductCostDetailed('prod-1');

      expect(result.warnings.some((w: string) => w.includes('nessun operatore qualificato'))).toBe(true);
    });

    it('should calculate BOM cost recursively', async () => {
      const parentProduct = mockFactories.product({ id: 'parent', name: 'Parent Product' });
      const childProduct = mockFactories.product({ id: 'child', name: 'Child Product' });

      // Parent has no phases, just BOM
      prismaMock.product.findUnique
        .mockResolvedValueOnce(parentProduct as any) // First call for parent
        .mockResolvedValueOnce(childProduct as any); // Second call for child

      prismaMock.manufacturingPhase.findMany
        .mockResolvedValueOnce([]) // Parent has no phases
        .mockResolvedValueOnce([ // Child has phases with materials
          createMockManufacturingPhase({
            materials: [
              {
                materialId: 'mat-1',
                quantity: createDecimal(1),
                unit: 'pz',
                scrapPercentage: createDecimal(0),
                material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001', cost: createDecimal(10) },
              },
            ],
          }),
        ] as any);

      // Parent BOM contains child
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          {
            id: 'bom-1',
            parentProductId: 'parent',
            componentProductId: 'child',
            quantity: createDecimal(2),
            componentProduct: childProduct,
          },
        ] as any)
        .mockResolvedValueOnce([]); // Child has no further BOM

      const result = await manufacturingService.calculateProductCostDetailed('parent');

      expect(result.bomCost).toBeGreaterThan(0);
      expect(result.breakdown.bomProducts).toHaveLength(1);
    });

    it('should throw error if product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.calculateProductCostDetailed('invalid-prod')
      ).rejects.toThrow('Prodotto non trovato');
    });
  });

  describe('getProductCostSummary', () => {
    it('should return cost summary without detailed breakdown', async () => {
      const product = mockFactories.product({ id: 'prod-1', name: 'Test Product' });
      const phase = createMockManufacturingPhase({
        materials: [
          {
            materialId: 'mat-1',
            quantity: createDecimal(2),
            unit: 'pz',
            scrapPercentage: createDecimal(0),
            material: { id: 'mat-1', name: 'Material 1', sku: 'MAT001', cost: createDecimal(10) },
          },
        ],
      });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([phase] as any);
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await manufacturingService.getProductCostSummary('prod-1');

      expect(result).toHaveProperty('productId', 'prod-1');
      expect(result).toHaveProperty('productName', 'Test Product');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('phasesCount', 1);
      expect(result).toHaveProperty('materialsCount', 1);
      expect(result).not.toHaveProperty('breakdown');
    });
  });

  // ==========================================
  // PRODUCT CLONING TESTS
  // ==========================================

  describe('cloneProduct', () => {
    it('should clone product with pipeline', async () => {
      const sourceProduct = mockFactories.product({
        id: 'source',
        sku: 'ORIGINAL',
        name: 'Original Product',
        manufacturingPhases: [
          createMockManufacturingPhase({
            materials: [
              { materialId: 'mat-1', quantity: createDecimal(2), unit: 'pz', scrapPercentage: createDecimal(0), isConsumable: false, notes: null },
            ],
            qualifiedEmployees: [
              { employeeId: 'emp-1', isPrimary: true },
            ],
          }),
        ],
      });

      const newProduct = { ...sourceProduct, id: 'new', sku: 'CLONE', name: 'Cloned Product' };

      prismaMock.product.findFirst.mockResolvedValueOnce(null); // SKU check (findFirst) - not exists
      prismaMock.product.findUnique.mockResolvedValueOnce(sourceProduct as any); // Get source by id

      prismaMock.product.create.mockResolvedValue(newProduct as any);
      prismaMock.manufacturingPhase.create.mockResolvedValue({ id: 'new-phase' } as any);
      prismaMock.phaseMaterial.createMany.mockResolvedValue({ count: 1 });
      prismaMock.phaseEmployee.createMany.mockResolvedValue({ count: 1 });

      const result = await manufacturingService.cloneProduct('source', 'CLONE', 'Cloned Product');

      expect(result.sku).toBe('CLONE');
      expect(prismaMock.product.create).toHaveBeenCalled();
      expect(prismaMock.manufacturingPhase.create).toHaveBeenCalled();
    });

    it('should throw error if SKU already exists', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 'existing', sku: 'EXISTING' } as any);

      await expect(
        manufacturingService.cloneProduct('source', 'EXISTING', 'Test')
      ).rejects.toThrow('Prodotto con SKU "EXISTING" esiste già');
    });

    it('should throw error if source product not found', async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(null); // SKU check (findFirst) - not exists
      prismaMock.product.findUnique.mockResolvedValueOnce(null); // Source not found

      await expect(
        manufacturingService.cloneProduct('invalid-source', 'NEW', 'Test')
      ).rejects.toThrow('Prodotto non trovato');
    });
  });

  // ==========================================
  // PRODUCTION ORDER TESTS
  // ==========================================

  describe('createProductionOrder', () => {
    it('should create production order with phases', async () => {
      const product = mockFactories.product({ id: 'prod-1', sku: 'PROD001' });
      const pipeline = [createMockManufacturingPhase()];
      const newOrder = createMockProductionOrder();

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue(pipeline as any);
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);
      prismaMock.productionOrder.create.mockResolvedValue(newOrder as any);
      prismaMock.productionPhase.create.mockResolvedValue({} as any);
      prismaMock.productionOrder.findUnique.mockResolvedValue({
        ...newOrder,
        product,
        phases: [createMockProductionPhase()],
      } as any);

      const result = await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        createdById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(prismaMock.productionOrder.create).toHaveBeenCalled();
      expect(prismaMock.productionPhase.create).toHaveBeenCalled();
    });

    it('should generate sequential order number', async () => {
      const product = mockFactories.product({ id: 'prod-1' });
      const lastOrder = createMockProductionOrder({ orderNumber: 'MO-2026-000005' });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.findFirst.mockResolvedValue(lastOrder as any);
      prismaMock.productionOrder.create.mockResolvedValue(createMockProductionOrder({ orderNumber: 'MO-2026-000006' }) as any);
      prismaMock.productionOrder.findUnique.mockResolvedValue({} as any);

      await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        createdById: 'user-1',
      });

      expect(prismaMock.productionOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderNumber: 'MO-2026-000006',
        }),
      });
    });

    it('should create order without pipeline (allowed)', async () => {
      const product = mockFactories.product({ id: 'prod-1' });

      prismaMock.product.findUnique.mockResolvedValue(product as any);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([]); // No pipeline
      prismaMock.productionOrder.findFirst.mockResolvedValue(null);
      prismaMock.productionOrder.create.mockResolvedValue(createMockProductionOrder() as any);
      prismaMock.productionOrder.findUnique.mockResolvedValue({
        ...createMockProductionOrder(),
        product,
        phases: [],
      } as any);

      const result = await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        createdById: 'user-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw error if product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.createProductionOrder({
          productId: 'invalid',
          quantity: 10,
          createdById: 'user-1',
        })
      ).rejects.toThrow('Prodotto non trovato');
    });
  });

  describe('getProductionOrder', () => {
    it('should return production order with full details', async () => {
      const order = {
        ...createMockProductionOrder(),
        product: mockFactories.product(),
        salesOrder: null,
        createdBy: { firstName: 'John', lastName: 'Doe' },
        phases: [createMockProductionPhase()],
      };

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);

      const result = await manufacturingService.getProductionOrder('prodord-1');

      expect(result).toBeDefined();
      expect(result?.product).toBeDefined();
      expect(result?.phases).toHaveLength(1);
    });

    it('should return null for non-existent order', async () => {
      prismaMock.productionOrder.findUnique.mockResolvedValue(null);

      const result = await manufacturingService.getProductionOrder('invalid');

      expect(result).toBeNull();
    });
  });

  describe('listProductionOrders', () => {
    it('should return paginated production orders', async () => {
      const orders = [
        { ...createMockProductionOrder({ id: 'order-1' }), product: mockFactories.product(), phases: [] },
        { ...createMockProductionOrder({ id: 'order-2' }), product: mockFactories.product(), phases: [] },
      ];

      prismaMock.productionOrder.findMany.mockResolvedValue(orders as any);
      prismaMock.productionOrder.count.mockResolvedValue(10);

      const result = await manufacturingService.listProductionOrders({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.count.mockResolvedValue(0);

      await manufacturingService.listProductionOrders({
        status: 'IN_PROGRESS',
      });

      expect(prismaMock.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'IN_PROGRESS' },
        })
      );
    });

    it('should filter by productId', async () => {
      prismaMock.productionOrder.findMany.mockResolvedValue([]);
      prismaMock.productionOrder.count.mockResolvedValue(0);

      await manufacturingService.listProductionOrders({
        productId: 'prod-1',
      });

      expect(prismaMock.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1' },
        })
      );
    });
  });

  describe('startProductionPhase', () => {
    it('should start pending phase', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'PENDING' }),
        productionOrder: createMockProductionOrder({ status: 'DRAFT' }),
      };
      const updatedPhase = { ...phase, status: 'IN_PROGRESS', startedAt: new Date() };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.productionPhase.update.mockResolvedValue(updatedPhase as any);
      prismaMock.productionOrder.update.mockResolvedValue({} as any);

      const result = await manufacturingService.startProductionPhase('prodphase-1');

      expect(result.status).toBe('IN_PROGRESS');
      expect(prismaMock.productionPhase.update).toHaveBeenCalledWith({
        where: { id: 'prodphase-1' },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should assign employee when provided', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'PENDING' }),
        productionOrder: createMockProductionOrder({ status: 'IN_PROGRESS' }),
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.productionPhase.update.mockResolvedValue({ ...phase, status: 'IN_PROGRESS' } as any);

      await manufacturingService.startProductionPhase('prodphase-1', 'emp-1');

      expect(prismaMock.productionPhase.update).toHaveBeenCalledWith({
        where: { id: 'prodphase-1' },
        data: expect.objectContaining({
          assignedEmployeeId: 'emp-1',
        }),
      });
    });

    it('should update order status to IN_PROGRESS if DRAFT', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'PENDING' }),
        productionOrder: createMockProductionOrder({ status: 'DRAFT' }),
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.productionPhase.update.mockResolvedValue({ ...phase, status: 'IN_PROGRESS' } as any);
      prismaMock.productionOrder.update.mockResolvedValue({} as any);

      await manufacturingService.startProductionPhase('prodphase-1');

      expect(prismaMock.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 'prodord-1' },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          actualStartDate: expect.any(Date),
        }),
      });
    });

    it('should throw error if phase not found', async () => {
      prismaMock.productionPhase.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.startProductionPhase('invalid-phase')
      ).rejects.toThrow('Fase non trovata');
    });

    it('should throw error if phase is not PENDING', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'IN_PROGRESS' }),
        productionOrder: createMockProductionOrder(),
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);

      await expect(
        manufacturingService.startProductionPhase('prodphase-1')
      ).rejects.toThrow('La fase non è in stato PENDING');
    });
  });

  describe('completeProductionPhase', () => {
    it('should complete phase with material consumption', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'IN_PROGRESS' }),
        productionOrder: createMockProductionOrder({ orderNumber: 'MO-2026-000001', quantity: 5 }),
        manufacturingPhase: {
          ...createMockManufacturingPhase(),
          standardTime: 60,
          materials: [
            {
              materialId: 'mat-1',
              quantity: createDecimal(2),
              unit: 'pz',
              scrapPercentage: createDecimal(10),
              material: { id: 'mat-1', name: 'Material 1', cost: createDecimal(10) },
            },
          ],
        },
        assignedEmployee: null,
      };

      const warehouse = mockFactories.warehouse({ id: 'wh-1', isPrimary: true });

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(warehouse as any);
      prismaMock.materialConsumption.create.mockResolvedValue({} as any);
      prismaMock.material.update.mockResolvedValue({} as any);
      prismaMock.materialMovement.create.mockResolvedValue({} as any);
      prismaMock.productionPhase.update.mockResolvedValue({ ...phase, status: 'COMPLETED' } as any);

      const result = await manufacturingService.completeProductionPhase('prodphase-1');

      expect(result.status).toBe('COMPLETED');
      expect(prismaMock.materialConsumption.create).toHaveBeenCalled();
      expect(prismaMock.material.update).toHaveBeenCalled();
      expect(prismaMock.materialMovement.create).toHaveBeenCalled();
      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });

    it('should calculate external cost for external phases', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'IN_PROGRESS' }),
        productionOrder: createMockProductionOrder({ quantity: 5 }),
        manufacturingPhase: {
          ...createMockManufacturingPhase(),
          externalCostPerUnit: createDecimal(20),
          operationType: { id: 'op-1', name: 'External', isExternal: true, defaultHourlyRate: createDecimal(0) },
          materials: [],
        },
        assignedEmployee: null,
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(null);
      prismaMock.productionPhase.update.mockResolvedValue({ ...phase, status: 'COMPLETED' } as any);

      await manufacturingService.completeProductionPhase('prodphase-1');

      expect(prismaMock.productionPhase.update).toHaveBeenCalledWith({
        where: { id: 'prodphase-1' },
        data: expect.objectContaining({
          externalCost: 100, // 20 * 5
        }),
      });
    });

    it('should use actual time when provided', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'IN_PROGRESS' }),
        productionOrder: createMockProductionOrder({ quantity: 1 }),
        manufacturingPhase: {
          ...createMockManufacturingPhase(),
          standardTime: 60,
          materials: [],
          operationType: { id: 'op-1', name: 'Assembly', isExternal: false, defaultHourlyRate: createDecimal(30) },
        },
        assignedEmployee: null,
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(null);
      prismaMock.productionPhase.update.mockResolvedValue({ ...phase, status: 'COMPLETED' } as any);

      await manufacturingService.completeProductionPhase('prodphase-1', 90);

      expect(prismaMock.productionPhase.update).toHaveBeenCalledWith({
        where: { id: 'prodphase-1' },
        data: expect.objectContaining({
          actualTime: 90,
        }),
      });
    });

    it('should throw error if phase not found', async () => {
      prismaMock.productionPhase.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.completeProductionPhase('invalid-phase')
      ).rejects.toThrow('Fase non trovata');
    });

    it('should throw error if phase is not IN_PROGRESS', async () => {
      const phase = {
        ...createMockProductionPhase({ status: 'PENDING' }),
        productionOrder: createMockProductionOrder(),
        manufacturingPhase: createMockManufacturingPhase(),
        assignedEmployee: null,
      };

      prismaMock.productionPhase.findUnique.mockResolvedValue(phase as any);

      await expect(
        manufacturingService.completeProductionPhase('prodphase-1')
      ).rejects.toThrow('La fase non è in stato IN_PROGRESS');
    });
  });

  describe('completeProductionOrder', () => {
    it('should complete order when all phases are completed', async () => {
      const order = {
        ...createMockProductionOrder({ status: 'IN_PROGRESS' }),
        product: mockFactories.product({ id: 'prod-1', name: 'Test Product' }),
        phases: [
          { id: 'phase-1', status: 'COMPLETED' },
          { id: 'phase-2', status: 'COMPLETED' },
        ],
      };
      const warehouse = mockFactories.warehouse({ id: 'wh-1', isPrimary: true });
      const existingInventory = mockFactories.inventoryItem({ id: 'inv-1', productId: 'prod-1', quantity: 50 });

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);
      prismaMock.productionOrder.update.mockResolvedValue({ ...order, status: 'COMPLETED' } as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(warehouse as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(existingInventory as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);

      const result = await manufacturingService.completeProductionOrder('prodord-1');

      expect(result.status).toBe('COMPLETED');
      expect(prismaMock.inventoryItem.update).toHaveBeenCalled();
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalled();
      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
      expect(mockMaterialService.checkLowStock).toHaveBeenCalled();
    });

    it('should create new inventory item if not exists', async () => {
      const order = {
        ...createMockProductionOrder({ status: 'IN_PROGRESS', quantity: 10 }),
        product: mockFactories.product({ id: 'prod-1', name: 'Test Product' }),
        phases: [{ id: 'phase-1', status: 'COMPLETED' }],
      };
      const warehouse = mockFactories.warehouse({ id: 'wh-1', isPrimary: true });

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);
      prismaMock.productionOrder.update.mockResolvedValue({ ...order, status: 'COMPLETED' } as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(warehouse as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null); // No existing inventory
      prismaMock.inventoryItem.create.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);

      await manufacturingService.completeProductionOrder('prodord-1');

      expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          warehouseId: 'wh-1',
          location: 'WEB',
          quantity: 10,
        }),
      });
    });

    it('should update sales order to READY when all production orders complete', async () => {
      const order = {
        ...createMockProductionOrder({ status: 'IN_PROGRESS', salesOrderId: 'sales-1' }),
        product: mockFactories.product({ id: 'prod-1', name: 'Test Product' }),
        phases: [{ id: 'phase-1', status: 'COMPLETED' }],
      };
      const salesOrder = mockFactories.order({ id: 'sales-1', status: 'PROCESSING', orderNumber: 'ORD-001' });
      const warehouse = mockFactories.warehouse({ id: 'wh-1', isPrimary: true });

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);
      prismaMock.productionOrder.update.mockResolvedValue({ ...order, status: 'COMPLETED' } as any);
      prismaMock.warehouse.findFirst.mockResolvedValue(warehouse as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
      prismaMock.inventoryItem.create.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);
      prismaMock.productionOrder.count.mockResolvedValue(0); // No pending production orders
      prismaMock.order.findUnique.mockResolvedValue(salesOrder as any);
      prismaMock.order.update.mockResolvedValue({ ...salesOrder, status: 'READY' } as any);

      await manufacturingService.completeProductionOrder('prodord-1');

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'sales-1' },
        data: { status: 'READY' },
      });
    });

    it('should throw error if order not found', async () => {
      prismaMock.productionOrder.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.completeProductionOrder('invalid-order')
      ).rejects.toThrow('Ordine di produzione non trovato');
    });

    it('should throw error if phases are incomplete', async () => {
      const order = {
        ...createMockProductionOrder({ status: 'IN_PROGRESS' }),
        product: mockFactories.product(),
        phases: [
          { id: 'phase-1', status: 'COMPLETED' },
          { id: 'phase-2', status: 'IN_PROGRESS' },
        ],
      };

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);

      await expect(
        manufacturingService.completeProductionOrder('prodord-1')
      ).rejects.toThrow('Impossibile completare: 1 fasi non completate');
    });
  });

  describe('cancelProductionOrder', () => {
    it('should cancel production order', async () => {
      const order = createMockProductionOrder({ status: 'DRAFT' });
      const cancelledOrder = { ...order, status: 'CANCELLED' };

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);
      prismaMock.productionOrder.update.mockResolvedValue(cancelledOrder as any);

      const result = await manufacturingService.cancelProductionOrder('prodord-1', 'No longer needed');

      expect(result.status).toBe('CANCELLED');
      expect(prismaMock.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 'prodord-1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
        }),
      });
    });

    it('should throw error if order not found', async () => {
      prismaMock.productionOrder.findUnique.mockResolvedValue(null);

      await expect(
        manufacturingService.cancelProductionOrder('invalid-order')
      ).rejects.toThrow('Ordine di produzione non trovato');
    });

    it('should throw error if order is already completed', async () => {
      const order = createMockProductionOrder({ status: 'COMPLETED' });

      prismaMock.productionOrder.findUnique.mockResolvedValue(order as any);

      await expect(
        manufacturingService.cancelProductionOrder('prodord-1')
      ).rejects.toThrow('Impossibile annullare un ordine completato');
    });
  });

  // ==========================================
  // STATISTICS TESTS
  // ==========================================

  describe('getProductionStats', () => {
    it('should return production statistics', async () => {
      prismaMock.productionOrder.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10)  // draft
        .mockResolvedValueOnce(15)  // in_progress
        .mockResolvedValueOnce(70)  // completed
        .mockResolvedValueOnce(5);  // cancelled

      const result = await manufacturingService.getProductionStats();

      expect(result).toEqual({
        total: 100,
        draft: 10,
        inProgress: 15,
        completed: 70,
        cancelled: 5,
      });
    });
  });
});
