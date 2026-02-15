/**
 * Material Service Tests
 * Tests for material management including stock operations, movements, and production consumption
 */

import { prismaMock, createDecimal } from '../__mocks__/prisma';

// Mock repository
const mockMaterialRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isUsedInPhases: jest.fn(),
  updateStock: jest.fn(),
  createMovement: jest.fn(),
  getLowStockMaterials: jest.fn(),
  getMaterialsRequiringReorder: jest.fn(),
  search: jest.fn(),
  getCategories: jest.fn(),
  getMovements: jest.fn(),
  getMaterialUsage: jest.fn(),
};

jest.mock('@server/repositories/material.repository', () => ({
  __esModule: true,
  default: mockMaterialRepository,
}));

// Mock notification service
const mockNotificationService = {
  notifyRoles: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks
import materialService from '@server/services/material.service';

// Helper functions
const createMockMaterial = (overrides: any = {}) => ({
  id: 'mat-1',
  sku: 'MAT001',
  name: 'Steel Sheet',
  description: 'Stainless steel sheet 2mm',
  unit: 'pz',
  cost: createDecimal(50),
  minStock: 100,
  currentStock: 200,
  reorderPoint: 150,
  reorderQuantity: 500,
  leadTimeDays: 7,
  category: 'Metals',
  supplierId: 'sup-1',
  isConsumable: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  supplier: { id: 'sup-1', code: 'SUP001', businessName: 'Metal Supplier' },
  ...overrides,
});

const createMockMovement = (overrides: any = {}) => ({
  id: 'mov-1',
  materialId: 'mat-1',
  type: 'IN',
  quantity: 100,
  toLocation: 'WEB',
  fromLocation: null,
  reference: 'PO-2026-00001',
  notes: 'Stock received',
  performedBy: 'user-1',
  createdAt: new Date('2026-01-15'),
  ...overrides,
});

describe('MaterialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // getAllMaterials
  // ============================================

  describe('getAllMaterials', () => {
    it('should return paginated list of materials', async () => {
      const mockMaterials = [createMockMaterial()];
      mockMaterialRepository.findAll.mockResolvedValue({
        items: mockMaterials,
        total: 1,
      });

      const result = await materialService.getAllMaterials({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by category', async () => {
      mockMaterialRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await materialService.getAllMaterials({ category: 'Metals' });

      expect(mockMaterialRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Metals' }),
        })
      );
    });

    it('should filter by supplier', async () => {
      mockMaterialRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await materialService.getAllMaterials({ supplierId: 'sup-1' });

      expect(mockMaterialRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supplierId: 'sup-1' }),
        })
      );
    });

    it('should search by sku, name, or description', async () => {
      mockMaterialRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await materialService.getAllMaterials({ search: 'steel' });

      expect(mockMaterialRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ sku: expect.any(Object) }),
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ description: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should filter low stock materials', async () => {
      const mockMaterials = [
        createMockMaterial({ currentStock: 50, minStock: 100 }), // Low stock
        createMockMaterial({ id: 'mat-2', currentStock: 200, minStock: 100 }), // OK
      ];
      mockMaterialRepository.findAll.mockResolvedValue({
        items: mockMaterials,
        total: 2,
      });

      const result = await materialService.getAllMaterials({ lowStock: true });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].currentStock).toBeLessThanOrEqual(result.items[0].minStock);
    });

    it('should sort by specified field', async () => {
      mockMaterialRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await materialService.getAllMaterials({ sortBy: 'cost', sortOrder: 'desc' });

      expect(mockMaterialRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { cost: 'desc' },
        })
      );
    });
  });

  // ============================================
  // getMaterialById
  // ============================================

  describe('getMaterialById', () => {
    it('should return material when found', async () => {
      const mockMaterial = createMockMaterial();
      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);

      const result = await materialService.getMaterialById('mat-1');

      expect(result).toEqual(mockMaterial);
      expect(mockMaterialRepository.findById).toHaveBeenCalledWith('mat-1');
    });

    it('should throw error when material not found', async () => {
      mockMaterialRepository.findById.mockResolvedValue(null);

      await expect(materialService.getMaterialById('non-existent'))
        .rejects.toThrow('Materiale non trovato');
    });
  });

  // ============================================
  // getMaterialBySku
  // ============================================

  describe('getMaterialBySku', () => {
    it('should return material when found', async () => {
      const mockMaterial = createMockMaterial();
      mockMaterialRepository.findBySku.mockResolvedValue(mockMaterial);

      const result = await materialService.getMaterialBySku('MAT001');

      expect(result).toEqual(mockMaterial);
    });

    it('should return null when not found', async () => {
      mockMaterialRepository.findBySku.mockResolvedValue(null);

      const result = await materialService.getMaterialBySku('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // createMaterial
  // ============================================

  describe('createMaterial', () => {
    it('should create material successfully', async () => {
      const input = {
        sku: 'MAT002',
        name: 'Aluminum Sheet',
        cost: 30,
        unit: 'pz',
      };
      const mockMaterial = createMockMaterial({ ...input, id: 'mat-2' });

      mockMaterialRepository.findBySku.mockResolvedValue(null);
      mockMaterialRepository.create.mockResolvedValue(mockMaterial);

      const result = await materialService.createMaterial(input);

      expect(result.sku).toBe('MAT002');
      expect(mockMaterialRepository.create).toHaveBeenCalled();
    });

    it('should throw error when SKU already exists', async () => {
      const input = { sku: 'MAT001', name: 'Duplicate', cost: 10 };
      mockMaterialRepository.findBySku.mockResolvedValue(createMockMaterial());

      await expect(materialService.createMaterial(input))
        .rejects.toThrow('Materiale con SKU MAT001 esiste già');
    });

    it('should set default values when not provided', async () => {
      const input = { sku: 'MAT003', name: 'Basic Material', cost: 20 };

      mockMaterialRepository.findBySku.mockResolvedValue(null);
      mockMaterialRepository.create.mockResolvedValue(createMockMaterial(input));

      await materialService.createMaterial(input);

      expect(mockMaterialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: 'pz',
          minStock: 0,
          currentStock: 0,
          reorderPoint: 0,
          reorderQuantity: 0,
          leadTimeDays: 7,
          isConsumable: false,
        })
      );
    });

    it('should connect supplier when provided', async () => {
      const input = {
        sku: 'MAT004',
        name: 'Supplier Material',
        cost: 25,
        supplierId: 'sup-1',
      };

      mockMaterialRepository.findBySku.mockResolvedValue(null);
      mockMaterialRepository.create.mockResolvedValue(createMockMaterial(input));

      await materialService.createMaterial(input);

      expect(mockMaterialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier: { connect: { id: 'sup-1' } },
        })
      );
    });
  });

  // ============================================
  // updateMaterial
  // ============================================

  describe('updateMaterial', () => {
    it('should update material successfully', async () => {
      const mockMaterial = createMockMaterial();
      const updateData = { name: 'Updated Steel Sheet' };

      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);
      mockMaterialRepository.update.mockResolvedValue({
        ...mockMaterial,
        ...updateData,
        currentStock: 200, // Above minStock
      });

      const result = await materialService.updateMaterial('mat-1', updateData);

      expect(result.name).toBe('Updated Steel Sheet');
    });

    it('should throw error when material not found', async () => {
      mockMaterialRepository.findById.mockResolvedValue(null);

      await expect(materialService.updateMaterial('non-existent', { name: 'Test' }))
        .rejects.toThrow('Materiale non trovato');
    });

    it('should throw error when changing to existing SKU', async () => {
      const mockMaterial = createMockMaterial({ id: 'mat-1', sku: 'MAT001' });
      const existingMaterial = createMockMaterial({ id: 'mat-2', sku: 'MAT002' });

      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);
      mockMaterialRepository.findBySku.mockResolvedValue(existingMaterial);

      await expect(materialService.updateMaterial('mat-1', { sku: 'MAT002' }))
        .rejects.toThrow('Materiale con SKU MAT002 esiste già');
    });

    it('should connect supplier when supplierId provided', async () => {
      const mockMaterial = createMockMaterial({ supplierId: null });

      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);
      mockMaterialRepository.update.mockResolvedValue({
        ...mockMaterial,
        supplierId: 'sup-2',
        currentStock: 200,
      });

      await materialService.updateMaterial('mat-1', { supplierId: 'sup-2' });

      expect(mockMaterialRepository.update).toHaveBeenCalledWith(
        'mat-1',
        expect.objectContaining({
          supplier: { connect: { id: 'sup-2' } },
        })
      );
    });

    it('should disconnect supplier when supplierId is empty', async () => {
      const mockMaterial = createMockMaterial({ supplierId: 'sup-1' });

      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);
      mockMaterialRepository.update.mockResolvedValue({
        ...mockMaterial,
        supplierId: null,
        currentStock: 200,
      });

      await materialService.updateMaterial('mat-1', { supplierId: '' });

      expect(mockMaterialRepository.update).toHaveBeenCalledWith(
        'mat-1',
        expect.objectContaining({
          supplier: { disconnect: true },
        })
      );
    });

    it('should notify when stock drops below minimum', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 200, minStock: 100 });

      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);
      mockMaterialRepository.update.mockResolvedValue({
        ...mockMaterial,
        currentStock: 50, // Below minStock
        minStock: 100,
      });

      await materialService.updateMaterial('mat-1', { currentStock: 50 });

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        ['MAGAZZINIERE', 'ADMIN', 'MANAGER'],
        expect.objectContaining({
          type: 'LOW_STOCK',
          title: 'Materiale Sotto Soglia',
        })
      );
    });
  });

  // ============================================
  // deleteMaterial
  // ============================================

  describe('deleteMaterial', () => {
    it('should delete material successfully', async () => {
      mockMaterialRepository.isUsedInPhases.mockResolvedValue(false);
      mockMaterialRepository.delete.mockResolvedValue(undefined);

      const result = await materialService.deleteMaterial('mat-1');

      expect(result.success).toBe(true);
      expect(mockMaterialRepository.delete).toHaveBeenCalledWith('mat-1');
    });

    it('should throw error when material is used in production phases', async () => {
      mockMaterialRepository.isUsedInPhases.mockResolvedValue(true);

      await expect(materialService.deleteMaterial('mat-1'))
        .rejects.toThrow('Impossibile eliminare: materiale utilizzato in fasi di produzione');
    });
  });

  // ============================================
  // adjustStock
  // ============================================

  describe('adjustStock', () => {
    it('should increase stock with IN type', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 100 });
      const updatedMaterial = { ...mockMaterial, currentStock: 150 };

      mockMaterialRepository.findById
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(updatedMaterial);
      mockMaterialRepository.updateStock.mockResolvedValue(undefined);
      mockMaterialRepository.createMovement.mockResolvedValue(createMockMovement());

      const result = await materialService.adjustStock('mat-1', 50, 'IN', 'PO-001', 'Stock received');

      expect(mockMaterialRepository.updateStock).toHaveBeenCalledWith('mat-1', 50);
      expect(mockMaterialRepository.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          materialId: 'mat-1',
          type: 'IN',
          quantity: 50,
          toLocation: 'WEB',
        })
      );
      expect(result?.currentStock).toBe(150);
    });

    it('should decrease stock with OUT type', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 100 });
      const updatedMaterial = { ...mockMaterial, currentStock: 70 };

      mockMaterialRepository.findById
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(updatedMaterial);
      mockMaterialRepository.updateStock.mockResolvedValue(undefined);
      mockMaterialRepository.createMovement.mockResolvedValue(createMockMovement({ type: 'OUT' }));

      const result = await materialService.adjustStock('mat-1', 30, 'OUT', 'ADJ-001', 'Adjustment');

      expect(mockMaterialRepository.updateStock).toHaveBeenCalledWith('mat-1', -30);
      expect(mockMaterialRepository.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OUT',
          fromLocation: 'WEB',
        })
      );
    });

    it('should throw error when material not found', async () => {
      mockMaterialRepository.findById.mockResolvedValue(null);

      await expect(materialService.adjustStock('non-existent', 10, 'IN'))
        .rejects.toThrow('Materiale non trovato');
    });

    it('should throw error when OUT would result in negative stock', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 50 });
      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);

      await expect(materialService.adjustStock('mat-1', 100, 'OUT'))
        .rejects.toThrow('Stock insufficiente');
    });

    it('should notify when stock drops below minimum after adjustment', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 150, minStock: 100 });
      const updatedMaterial = { ...mockMaterial, currentStock: 80 };

      mockMaterialRepository.findById
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(updatedMaterial);
      mockMaterialRepository.updateStock.mockResolvedValue(undefined);
      mockMaterialRepository.createMovement.mockResolvedValue(createMockMovement());

      await materialService.adjustStock('mat-1', 70, 'OUT');

      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });
  });

  // ============================================
  // checkLowStock
  // ============================================

  describe('checkLowStock', () => {
    it('should return low stock materials and notify', async () => {
      const lowStockMaterials = [
        createMockMaterial({ currentStock: 50, minStock: 100 }),
        createMockMaterial({ id: 'mat-2', currentStock: 80, minStock: 100 }),
      ];
      mockMaterialRepository.getLowStockMaterials.mockResolvedValue(lowStockMaterials);

      const result = await materialService.checkLowStock();

      expect(result).toHaveLength(2);
      expect(mockNotificationService.notifyRoles).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no low stock', async () => {
      mockMaterialRepository.getLowStockMaterials.mockResolvedValue([]);

      const result = await materialService.checkLowStock();

      expect(result).toHaveLength(0);
      expect(mockNotificationService.notifyRoles).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getLowStockMaterials
  // ============================================

  describe('getLowStockMaterials', () => {
    it('should return materials below minimum stock', async () => {
      const materials = [createMockMaterial({ currentStock: 50, minStock: 100 })];
      mockMaterialRepository.getLowStockMaterials.mockResolvedValue(materials);

      const result = await materialService.getLowStockMaterials();

      expect(result).toHaveLength(1);
    });
  });

  // ============================================
  // getMaterialsRequiringReorder
  // ============================================

  describe('getMaterialsRequiringReorder', () => {
    it('should return materials at or below reorder point', async () => {
      const materials = [createMockMaterial({ currentStock: 100, reorderPoint: 150 })];
      mockMaterialRepository.getMaterialsRequiringReorder.mockResolvedValue(materials);

      const result = await materialService.getMaterialsRequiringReorder();

      expect(result).toHaveLength(1);
    });
  });

  // ============================================
  // searchMaterials
  // ============================================

  describe('searchMaterials', () => {
    it('should search materials by query', async () => {
      const materials = [createMockMaterial()];
      mockMaterialRepository.search.mockResolvedValue(materials);

      const result = await materialService.searchMaterials('steel', 10);

      expect(result).toHaveLength(1);
      expect(mockMaterialRepository.search).toHaveBeenCalledWith('steel', 10);
    });
  });

  // ============================================
  // getCategories
  // ============================================

  describe('getCategories', () => {
    it('should return unique categories', async () => {
      const categories = ['Metals', 'Plastics', 'Electronics'];
      mockMaterialRepository.getCategories.mockResolvedValue(categories);

      const result = await materialService.getCategories();

      expect(result).toEqual(['Metals', 'Plastics', 'Electronics']);
    });
  });

  // ============================================
  // getMovementHistory
  // ============================================

  describe('getMovementHistory', () => {
    it('should return movement history for material', async () => {
      const movements = [
        createMockMovement(),
        createMockMovement({ id: 'mov-2', type: 'OUT' }),
      ];
      mockMaterialRepository.getMovements.mockResolvedValue(movements);

      const result = await materialService.getMovementHistory('mat-1', 20);

      expect(result).toHaveLength(2);
      expect(mockMaterialRepository.getMovements).toHaveBeenCalledWith('mat-1', 20);
    });
  });

  // ============================================
  // getMaterialUsage
  // ============================================

  describe('getMaterialUsage', () => {
    it('should return material usage in production phases', async () => {
      const usage = [
        { phaseId: 'phase-1', productId: 'prod-1', quantity: 5 },
        { phaseId: 'phase-2', productId: 'prod-2', quantity: 10 },
      ];
      mockMaterialRepository.getMaterialUsage.mockResolvedValue(usage);

      const result = await materialService.getMaterialUsage('mat-1');

      expect(result).toHaveLength(2);
    });
  });

  // ============================================
  // consumeForProduction
  // ============================================

  describe('consumeForProduction', () => {
    it('should consume material for production', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 100 });
      const updatedMaterial = { ...mockMaterial, currentStock: 90 };
      const mockMovement = createMockMovement({ type: 'PRODUCTION', quantity: 10 });

      mockMaterialRepository.findById
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(updatedMaterial);
      mockMaterialRepository.updateStock.mockResolvedValue(undefined);
      mockMaterialRepository.createMovement.mockResolvedValue(mockMovement);

      const result = await materialService.consumeForProduction(
        'mat-1',
        10,
        'PO-2026-00001',
        1,
        'user-1'
      );

      expect(result.material?.currentStock).toBe(90);
      expect(mockMaterialRepository.updateStock).toHaveBeenCalledWith('mat-1', -10);
      expect(mockMaterialRepository.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRODUCTION',
          quantity: 10,
          reference: 'PO-2026-00001',
          notes: 'Consumo per produzione - Fase 1',
        })
      );
    });

    it('should throw error when material not found', async () => {
      mockMaterialRepository.findById.mockResolvedValue(null);

      await expect(
        materialService.consumeForProduction('non-existent', 10, 'PO-001', 1)
      ).rejects.toThrow('Materiale non trovato');
    });

    it('should throw error when insufficient stock', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 5 });
      mockMaterialRepository.findById.mockResolvedValue(mockMaterial);

      await expect(
        materialService.consumeForProduction('mat-1', 10, 'PO-001', 1)
      ).rejects.toThrow(/Stock insufficiente/);
    });

    it('should notify when stock drops below minimum after consumption', async () => {
      const mockMaterial = createMockMaterial({ currentStock: 150, minStock: 100 });
      const updatedMaterial = { ...mockMaterial, currentStock: 50 };

      mockMaterialRepository.findById
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(updatedMaterial);
      mockMaterialRepository.updateStock.mockResolvedValue(undefined);
      mockMaterialRepository.createMovement.mockResolvedValue(createMockMovement());

      await materialService.consumeForProduction('mat-1', 100, 'PO-001', 1);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });
  });

  // ============================================
  // getMaterialStats
  // ============================================

  describe('getMaterialStats', () => {
    it('should return material statistics for dashboard', async () => {
      const lowStockMaterials = [createMockMaterial({ currentStock: 50, minStock: 100 })];
      const reorderMaterials = [createMockMaterial({ currentStock: 100, reorderPoint: 150 })];
      const categories = ['Metals', 'Plastics'];
      const materials = [
        { cost: createDecimal(50), currentStock: 100 },
        { cost: createDecimal(30), currentStock: 200 },
      ];

      prismaMock.material.count.mockResolvedValue(10);
      mockMaterialRepository.getLowStockMaterials.mockResolvedValue(lowStockMaterials);
      mockMaterialRepository.getMaterialsRequiringReorder.mockResolvedValue(reorderMaterials);
      mockMaterialRepository.getCategories.mockResolvedValue(categories);
      prismaMock.material.findMany.mockResolvedValue(materials as any);

      const result = await materialService.getMaterialStats();

      expect(result.totalMaterials).toBe(10);
      expect(result.lowStockCount).toBe(1);
      expect(result.reorderRequiredCount).toBe(1);
      expect(result.categoriesCount).toBe(2);
      expect(result.totalInventoryValue).toBe(11000); // (50*100) + (30*200)
    });

    it('should handle empty inventory', async () => {
      prismaMock.material.count.mockResolvedValue(0);
      mockMaterialRepository.getLowStockMaterials.mockResolvedValue([]);
      mockMaterialRepository.getMaterialsRequiringReorder.mockResolvedValue([]);
      mockMaterialRepository.getCategories.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);

      const result = await materialService.getMaterialStats();

      expect(result.totalMaterials).toBe(0);
      expect(result.totalInventoryValue).toBe(0);
    });
  });
});
