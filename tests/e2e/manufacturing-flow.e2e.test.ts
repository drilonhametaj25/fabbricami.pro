/**
 * Manufacturing Flow E2E Tests
 * End-to-end tests for production workflow
 *
 * Tests:
 * 1. Production order creation
 * 2. Status transitions (start/complete phases)
 * 3. Phase management
 * 4. Material consumption
 * 5. Cost calculation
 * 6. Order completion with inventory update
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available at mock time
const { mockPrisma, mockMaterialService, mockNotificationService, mockOperationTypeRepository } = vi.hoisted(() => {
  const mockPrisma: any = {
    productionOrder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    productionPhase: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    manufacturingPhase: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    operationType: {
      findUnique: vi.fn(),
    },
    bom: {
      findUnique: vi.fn(),
    },
    bomItem: {
      findMany: vi.fn(),
    },
    material: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    materialConsumption: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    materialMovement: {
      create: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn(),
    },
    inventoryItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    phaseMaterial: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    phaseEmployee: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
  };

  const mockMaterialService = {
    checkLowStock: vi.fn(),
  };

  const mockNotificationService = {
    notifyRoles: vi.fn(),
  };

  const mockOperationTypeRepository = {
    calculateAverageHourlyRate: vi.fn(),
    getQualifiedEmployees: vi.fn(),
  };

  return { mockPrisma, mockMaterialService, mockNotificationService, mockOperationTypeRepository };
});

vi.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@server/services/material.service', () => ({
  default: mockMaterialService,
}));

vi.mock('@server/services/notification.service', () => ({
  default: mockNotificationService,
}));

vi.mock('@server/repositories/operation-type.repository', () => ({
  default: mockOperationTypeRepository,
}));

// Import after mocks
import manufacturingService from '@server/services/manufacturing.service';

// Mock data
const mockProduct = {
  id: 'prod-1',
  sku: 'SKU001',
  name: 'Finished Product',
  price: 200,
  cost: 80,
};

const mockMaterial = {
  id: 'mat-1',
  sku: 'MAT001',
  name: 'Raw Material',
  cost: 10,
  currentStock: 100,
  unit: 'pz',
};

const mockEmployee = {
  id: 'emp-1',
  code: 'EMP001',
  hourlyRate: 25,
  user: {
    firstName: 'John',
    lastName: 'Worker',
  },
};

const mockOperationType = {
  id: 'op-1',
  name: 'Assembly',
  isExternal: false,
  defaultHourlyRate: 25,
};

const mockWarehouse = {
  id: 'wh-1',
  name: 'Main Warehouse',
  isPrimary: true,
};

const mockManufacturingPhase = {
  id: 'mphase-1',
  productId: 'prod-1',
  operationTypeId: 'op-1',
  sequence: 1,
  name: 'Assembly Phase',
  standardTime: 60,
  setupTime: 10,
  isActive: true,
  operationType: mockOperationType,
  externalSupplier: null,
  externalCostPerUnit: null,
  materials: [
    {
      materialId: 'mat-1',
      quantity: 5,
      unit: 'pz',
      scrapPercentage: 0,
      material: mockMaterial,
    },
  ],
  qualifiedEmployees: [],
};

const mockProductionPhase = {
  id: 'phase-1',
  productionOrderId: 'mo-1',
  manufacturingPhaseId: 'mphase-1',
  sequence: 1,
  status: 'PENDING',
  startedAt: null,
  completedAt: null,
  actualTime: null,
  assignedEmployeeId: null,
  laborCost: 0,
  materialCost: 0,
  externalCost: 0,
  productionOrder: {
    id: 'mo-1',
    orderNumber: 'MO-2026-000001',
    status: 'DRAFT',
    quantity: 10,
  },
  manufacturingPhase: mockManufacturingPhase,
  assignedEmployee: null,
};

const mockProductionOrder = {
  id: 'mo-1',
  orderNumber: 'MO-2026-000001',
  productId: 'prod-1',
  quantity: 10,
  status: 'DRAFT',
  priority: 0,
  plannedStartDate: new Date('2026-02-20'),
  plannedEndDate: new Date('2026-02-25'),
  actualStartDate: null,
  actualEndDate: null,
  product: mockProduct,
  phases: [mockProductionPhase],
  salesOrderId: null,
  notes: null,
};

describe('Manufacturing Flow E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
    mockPrisma.bomItem.findMany.mockResolvedValue([]);
    mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(25);
    mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([]);
    // Reset $transaction to pass mockPrisma as tx
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Production Order Creation', () => {
    it('should create production order with phases', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([mockManufacturingPhase]);
      mockPrisma.productionOrder.findFirst.mockResolvedValue(null);
      mockPrisma.productionOrder.create.mockResolvedValue(mockProductionOrder);
      mockPrisma.productionPhase.create.mockResolvedValue(mockProductionPhase);
      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockProductionOrder);

      const result = await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        priority: 0,
        plannedStartDate: new Date('2026-02-20'),
        plannedEndDate: new Date('2026-02-25'),
        createdById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result!.status).toBe('DRAFT');
      expect(mockPrisma.productionOrder.create).toHaveBeenCalled();
    });

    it('should auto-generate order number', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([]);
      mockPrisma.productionOrder.findFirst.mockResolvedValue(null);

      let capturedOrderNumber = '';
      mockPrisma.productionOrder.create.mockImplementation((args: any) => {
        capturedOrderNumber = args.data.orderNumber;
        return Promise.resolve({ ...mockProductionOrder, orderNumber: capturedOrderNumber });
      });
      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockProductionOrder);

      await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        createdById: 'user-1',
      });

      // Check the captured order number matches the expected format
      expect(capturedOrderNumber).toMatch(/MO-\d{4}-\d{6}/);
    });

    it('should link to sales order when provided', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([]);
      mockPrisma.productionOrder.findFirst.mockResolvedValue(null);

      let capturedSalesOrderId = '';
      mockPrisma.productionOrder.create.mockImplementation((args: any) => {
        capturedSalesOrderId = args.data.salesOrderId;
        return Promise.resolve({
          ...mockProductionOrder,
          salesOrderId: capturedSalesOrderId,
        });
      });
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...mockProductionOrder,
        salesOrderId: 'ord-1',
      });

      const result = await manufacturingService.createProductionOrder({
        productId: 'prod-1',
        quantity: 10,
        salesOrderId: 'ord-1',
        createdById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(capturedSalesOrderId).toBe('ord-1');
    });
  });

  describe('Phase Management', () => {
    it('should start production phase', async () => {
      mockPrisma.productionPhase.findUnique.mockResolvedValue({
        ...mockProductionPhase,
        status: 'PENDING',
        productionOrder: { ...mockProductionOrder, status: 'DRAFT' },
      });
      mockPrisma.productionPhase.update.mockResolvedValue({
        ...mockProductionPhase,
        status: 'IN_PROGRESS',
        assignedEmployeeId: 'emp-1',
        startedAt: new Date(),
      });
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...mockProductionOrder,
        status: 'IN_PROGRESS',
      });

      const result = await manufacturingService.startProductionPhase('phase-1', 'emp-1');

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.assignedEmployeeId).toBe('emp-1');
    });

    it('should reject starting phase not in PENDING status', async () => {
      mockPrisma.productionPhase.findUnique.mockResolvedValue({
        ...mockProductionPhase,
        status: 'COMPLETED',
      });

      await expect(
        manufacturingService.startProductionPhase('phase-1', 'emp-1')
      ).rejects.toThrow('La fase non è in stato PENDING');
    });

    it('should complete production phase', async () => {
      const inProgressPhase = {
        ...mockProductionPhase,
        status: 'IN_PROGRESS',
        startedAt: new Date(Date.now() - 3600000),
        sequence: 1,
        productionOrder: { ...mockProductionOrder, quantity: 10, orderNumber: 'MO-2026-000001' },
        productionOrderId: 'mo-1',
        manufacturingPhase: {
          ...mockManufacturingPhase,
          operationType: mockOperationType,
          materials: [{
            materialId: 'mat-1',
            quantity: 5,
            unit: 'pz',
            scrapPercentage: 0,
            material: mockMaterial,
          }],
        },
        assignedEmployee: null,
      };

      mockPrisma.productionPhase.findUnique.mockResolvedValue(inProgressPhase);
      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.materialConsumption.create.mockResolvedValue({});
      mockPrisma.material.update.mockResolvedValue({ ...mockMaterial, currentStock: 50 });
      mockPrisma.materialMovement.create.mockResolvedValue({});

      const completedPhase = {
        ...inProgressPhase,
        status: 'COMPLETED',
        actualTime: 60,
        completedAt: new Date(),
      };
      mockPrisma.productionPhase.update.mockResolvedValue(completedPhase);

      const result = await manufacturingService.completeProductionPhase('phase-1', 60);

      expect(result.status).toBe('COMPLETED');
      expect(result.actualTime).toBe(60);
    });

    it('should handle material consumption on phase completion', async () => {
      const inProgressPhase = {
        ...mockProductionPhase,
        status: 'IN_PROGRESS',
        startedAt: new Date(Date.now() - 3600000),
        sequence: 1,
        productionOrder: { ...mockProductionOrder, quantity: 10, orderNumber: 'MO-2026-000001' },
        productionOrderId: 'mo-1',
        manufacturingPhase: {
          ...mockManufacturingPhase,
          operationType: mockOperationType,
          materials: [{
            materialId: 'mat-1',
            quantity: 5,
            unit: 'pz',
            scrapPercentage: 0,
            material: mockMaterial,
          }],
        },
        assignedEmployee: null,
      };

      mockPrisma.productionPhase.findUnique.mockResolvedValue(inProgressPhase);
      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.materialConsumption.create.mockResolvedValue({});
      mockPrisma.material.update.mockResolvedValue({ ...mockMaterial, currentStock: 50 });
      mockPrisma.materialMovement.create.mockResolvedValue({});
      mockPrisma.productionPhase.update.mockResolvedValue({
        ...inProgressPhase,
        status: 'COMPLETED',
      });

      await manufacturingService.completeProductionPhase('phase-1');

      // 5 qty * 10 units = 50, Math.ceil makes it 50
      expect(mockPrisma.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-1' },
          data: expect.objectContaining({
            currentStock: expect.objectContaining({
              decrement: 50,
            }),
          }),
        })
      );
    });

    it('should reject completing phase not in IN_PROGRESS status', async () => {
      mockPrisma.productionPhase.findUnique.mockResolvedValue({
        ...mockProductionPhase,
        status: 'PENDING',
      });

      await expect(
        manufacturingService.completeProductionPhase('phase-1')
      ).rejects.toThrow('La fase non è in stato IN_PROGRESS');
    });
  });

  describe('Production Order Completion', () => {
    it('should complete production order and update inventory', async () => {
      const orderWithCompletedPhases = {
        ...mockProductionOrder,
        status: 'IN_PROGRESS',
        orderNumber: 'MO-2026-000001',
        phases: [{
          ...mockProductionPhase,
          status: 'COMPLETED',
        }],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderWithCompletedPhases);
      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 10,
      });
      mockPrisma.inventoryItem.update.mockResolvedValue({
        id: 'inv-1',
        quantity: 20,
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      const completedOrder = {
        ...orderWithCompletedPhases,
        status: 'COMPLETED',
        actualEndDate: new Date(),
      };
      mockPrisma.productionOrder.update.mockResolvedValue(completedOrder);

      const result = await manufacturingService.completeProductionOrder('mo-1');

      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.inventoryItem.update).toHaveBeenCalled();
    });

    it('should update sales order status when linked and all production complete', async () => {
      const orderWithSalesOrder = {
        ...mockProductionOrder,
        status: 'IN_PROGRESS',
        orderNumber: 'MO-2026-000001',
        salesOrderId: 'ord-1',
        phases: [{
          ...mockProductionPhase,
          status: 'COMPLETED',
        }],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderWithSalesOrder);
      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({
        id: 'inv-1',
        quantity: 10,
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      const completedOrder = {
        ...orderWithSalesOrder,
        status: 'COMPLETED',
      };
      mockPrisma.productionOrder.update.mockResolvedValue(completedOrder);
      // Return 0 pending production orders
      mockPrisma.productionOrder.count.mockResolvedValue(0);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        orderNumber: 'ORD-2026-000001',
        status: 'PROCESSING',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'READY',
      });

      await manufacturingService.completeProductionOrder('mo-1');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            status: 'READY',
          }),
        })
      );
    });

    it('should reject completion if phases not complete', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...mockProductionOrder,
        status: 'IN_PROGRESS',
        phases: [{
          ...mockProductionPhase,
          status: 'IN_PROGRESS', // Not complete
        }],
      });

      await expect(
        manufacturingService.completeProductionOrder('mo-1')
      ).rejects.toThrow(/fasi non completate/);
    });
  });

  describe('Cancel Production Order', () => {
    it('should cancel production order from DRAFT status', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...mockProductionOrder,
        status: 'DRAFT',
      });
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...mockProductionOrder,
        status: 'CANCELLED',
      });

      const result = await manufacturingService.cancelProductionOrder('mo-1', 'Customer cancelled');

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancellation of completed order', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...mockProductionOrder,
        status: 'COMPLETED',
      });

      await expect(
        manufacturingService.cancelProductionOrder('mo-1')
      ).rejects.toThrow('Impossibile annullare un ordine completato');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate product cost with phases', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([{
        ...mockManufacturingPhase,
        materials: [{
          materialId: 'mat-1',
          quantity: 5,
          unit: 'pz',
          scrapPercentage: 0,
          material: mockMaterial,
        }],
      }]);
      mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(25);
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([mockEmployee]);

      const costs = await manufacturingService.calculateProductCost('prod-1');

      expect(costs).toBeDefined();
      expect(costs.productId).toBe('prod-1');
      expect(costs.materialCost).toBeGreaterThanOrEqual(0);
      expect(costs.laborCost).toBeGreaterThanOrEqual(0);
      expect(costs.totalCost).toBe(
        costs.laborCost + costs.materialCost + costs.externalCost + costs.bomCost
      );
    });

    it('should calculate labor cost from employee hourly rate', async () => {
      // 60 min standard + 10 min setup = 70 min = 1.167 hours
      // 1.167 hours * 25/hour = 29.17
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([{
        ...mockManufacturingPhase,
        standardTime: 60,
        setupTime: 0,
        materials: [],
      }]);
      mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(25);
      mockOperationTypeRepository.getQualifiedEmployees.mockResolvedValue([mockEmployee]);

      const costs = await manufacturingService.calculateProductCost('prod-1');

      // 60 min / 60 = 1 hour * 25 = 25
      expect(costs.laborCost).toBe(25);
    });

    it('should calculate material cost from phase materials', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([{
        ...mockManufacturingPhase,
        standardTime: 0,
        setupTime: 0,
        materials: [{
          materialId: 'mat-1',
          quantity: 5,
          unit: 'pz',
          scrapPercentage: 0,
          material: { ...mockMaterial, cost: 10 },
        }],
      }]);
      mockOperationTypeRepository.calculateAverageHourlyRate.mockResolvedValue(null);

      const costs = await manufacturingService.calculateProductCost('prod-1');

      // 5 qty * 10 cost = 50
      expect(costs.materialCost).toBe(50);
    });
  });

  describe('Get Production Order', () => {
    it('should return production order with details', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...mockProductionOrder,
        createdBy: { firstName: 'Admin', lastName: 'User' },
        salesOrder: null,
      });

      const result = await manufacturingService.getProductionOrder('mo-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('mo-1');
      expect(mockPrisma.productionOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mo-1' },
        })
      );
    });
  });

  describe('List Production Orders', () => {
    it('should list production orders with pagination', async () => {
      mockPrisma.productionOrder.findMany.mockResolvedValue([mockProductionOrder]);
      mockPrisma.productionOrder.count.mockResolvedValue(1);

      const result = await manufacturingService.listProductionOrders({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by status', async () => {
      mockPrisma.productionOrder.findMany.mockResolvedValue([]);
      mockPrisma.productionOrder.count.mockResolvedValue(0);

      await manufacturingService.listProductionOrders({
        status: 'IN_PROGRESS',
      });

      expect(mockPrisma.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        })
      );
    });
  });

  describe('Production Statistics', () => {
    it('should return production statistics', async () => {
      mockPrisma.productionOrder.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // draft
        .mockResolvedValueOnce(30)  // in_progress
        .mockResolvedValueOnce(45)  // completed
        .mockResolvedValueOnce(5);  // cancelled

      const stats = await manufacturingService.getProductionStats();

      expect(stats.total).toBe(100);
      expect(stats.draft).toBe(20);
      expect(stats.inProgress).toBe(30);
      expect(stats.completed).toBe(45);
      expect(stats.cancelled).toBe(5);
    });
  });

  describe('Product Pipeline', () => {
    it('should get product manufacturing pipeline', async () => {
      mockPrisma.manufacturingPhase.findMany.mockResolvedValue([mockManufacturingPhase]);

      const pipeline = await manufacturingService.getProductPipeline('prod-1');

      expect(pipeline).toHaveLength(1);
      expect(pipeline[0].name).toBe('Assembly Phase');
      expect(mockPrisma.manufacturingPhase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', isActive: true },
        })
      );
    });
  });
});
