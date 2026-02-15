/**
 * Warehouse Service Tests
 * Tests for warehouse management including CRUD, primary designation, and statistics
 */

import { prismaMock, createDecimal } from '../__mocks__/prisma';

// Mock the repository
const mockWarehouseRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  findPrimary: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  canDelete: jest.fn(),
};

jest.mock('@server/repositories/warehouse.repository', () => ({
  getWarehouseRepository: jest.fn(() => mockWarehouseRepository),
}));

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks
import { WarehouseService, getWarehouseService } from '@server/services/warehouse.service';

// Helper functions
const createMockWarehouse = (overrides: any = {}) => ({
  id: 'wh-1',
  code: 'WH001',
  name: 'Main Warehouse',
  description: 'Primary warehouse',
  address: { street: 'Via Roma 1', city: 'Milano', zip: '20100', country: 'IT' },
  isActive: true,
  isPrimary: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('WarehouseService', () => {
  let warehouseService: WarehouseService;

  beforeEach(() => {
    jest.clearAllMocks();
    warehouseService = new WarehouseService(prismaMock as any);
  });

  // ============================================
  // getAllWarehouses
  // ============================================

  describe('getAllWarehouses', () => {
    it('should return paginated list of warehouses', async () => {
      const mockWarehouses = [createMockWarehouse()];
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: mockWarehouses,
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await warehouseService.getAllWarehouses({}, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockWarehouseRepository.findAll).toHaveBeenCalledWith({}, 1, 20);
    });

    it('should filter by isActive', async () => {
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await warehouseService.getAllWarehouses({ isActive: true }, 1, 20);

      expect(mockWarehouseRepository.findAll).toHaveBeenCalledWith(
        { isActive: true },
        1,
        20
      );
    });

    it('should filter by search term', async () => {
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await warehouseService.getAllWarehouses({ search: 'main' }, 1, 20);

      expect(mockWarehouseRepository.findAll).toHaveBeenCalledWith(
        { search: 'main' },
        1,
        20
      );
    });

    it('should throw error when repository fails', async () => {
      mockWarehouseRepository.findAll.mockRejectedValue(new Error('DB Error'));

      await expect(warehouseService.getAllWarehouses({}, 1, 20))
        .rejects.toThrow('Impossibile recuperare i magazzini');
    });
  });

  // ============================================
  // getWarehouseById
  // ============================================

  describe('getWarehouseById', () => {
    it('should return warehouse when found', async () => {
      const mockWarehouse = createMockWarehouse();
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);

      const result = await warehouseService.getWarehouseById('wh-1');

      expect(result).toEqual(mockWarehouse);
      expect(mockWarehouseRepository.findById).toHaveBeenCalledWith('wh-1');
    });

    it('should throw error when warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(warehouseService.getWarehouseById('non-existent'))
        .rejects.toThrow('Magazzino non trovato');
    });
  });

  // ============================================
  // getPrimaryWarehouse
  // ============================================

  describe('getPrimaryWarehouse', () => {
    it('should return primary warehouse', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: true });
      mockWarehouseRepository.findPrimary.mockResolvedValue(mockWarehouse);

      const result = await warehouseService.getPrimaryWarehouse();

      expect(result.isPrimary).toBe(true);
      expect(mockWarehouseRepository.findPrimary).toHaveBeenCalled();
    });

    it('should throw error when no primary warehouse configured', async () => {
      mockWarehouseRepository.findPrimary.mockResolvedValue(null);

      await expect(warehouseService.getPrimaryWarehouse())
        .rejects.toThrow('Nessun magazzino principale configurato');
    });
  });

  // ============================================
  // createWarehouse
  // ============================================

  describe('createWarehouse', () => {
    it('should create warehouse successfully', async () => {
      const input = {
        code: 'WH002',
        name: 'Secondary Warehouse',
        description: 'Backup warehouse',
      };
      const mockWarehouse = createMockWarehouse({ ...input, id: 'wh-2' });

      mockWarehouseRepository.findByCode.mockResolvedValue(null);
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [createMockWarehouse()],
        pagination: { total: 1, page: 1, limit: 1, totalPages: 1 },
      });
      mockWarehouseRepository.create.mockResolvedValue(mockWarehouse);

      const result = await warehouseService.createWarehouse(input);

      expect(result.code).toBe('WH002');
      expect(mockWarehouseRepository.create).toHaveBeenCalled();
    });

    it('should throw error when code already exists', async () => {
      const input = { code: 'WH001', name: 'Duplicate' };
      mockWarehouseRepository.findByCode.mockResolvedValue(createMockWarehouse());

      await expect(warehouseService.createWarehouse(input))
        .rejects.toThrow('Un magazzino con questo codice esiste già');
    });

    it('should set isPrimary automatically if no warehouses exist', async () => {
      const input = { code: 'WH001', name: 'First Warehouse' };

      mockWarehouseRepository.findByCode.mockResolvedValue(null);
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 1, totalPages: 0 },
      });
      mockWarehouseRepository.create.mockResolvedValue(
        createMockWarehouse({ ...input, isPrimary: true })
      );

      await warehouseService.createWarehouse(input);

      expect(mockWarehouseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: true })
      );
    });

    it('should respect explicit isPrimary value', async () => {
      const input = { code: 'WH002', name: 'Secondary', isPrimary: false };

      mockWarehouseRepository.findByCode.mockResolvedValue(null);
      mockWarehouseRepository.create.mockResolvedValue(
        createMockWarehouse({ ...input, isPrimary: false })
      );

      await warehouseService.createWarehouse(input);

      expect(mockWarehouseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: false })
      );
    });

    it('should create warehouse with address', async () => {
      const input = {
        code: 'WH003',
        name: 'Remote Warehouse',
        address: { street: 'Via Verdi 10', city: 'Roma', zip: '00100', country: 'IT' },
      };

      mockWarehouseRepository.findByCode.mockResolvedValue(null);
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [createMockWarehouse()],
        pagination: { total: 1, page: 1, limit: 1, totalPages: 1 },
      });
      mockWarehouseRepository.create.mockResolvedValue(createMockWarehouse(input));

      const result = await warehouseService.createWarehouse(input);

      expect(result.address).toEqual(input.address);
    });
  });

  // ============================================
  // updateWarehouse
  // ============================================

  describe('updateWarehouse', () => {
    it('should update warehouse successfully', async () => {
      const mockWarehouse = createMockWarehouse();
      const updateData = { name: 'Updated Warehouse Name' };

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.update.mockResolvedValue({
        ...mockWarehouse,
        ...updateData,
      });

      const result = await warehouseService.updateWarehouse('wh-1', updateData);

      expect(result.name).toBe('Updated Warehouse Name');
      expect(mockWarehouseRepository.update).toHaveBeenCalledWith('wh-1', updateData);
    });

    it('should throw error when warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(warehouseService.updateWarehouse('non-existent', { name: 'Test' }))
        .rejects.toThrow('Magazzino non trovato');
    });

    it('should throw error when changing to existing code', async () => {
      const mockWarehouse = createMockWarehouse({ id: 'wh-1', code: 'WH001' });
      const existingWarehouse = createMockWarehouse({ id: 'wh-2', code: 'WH002' });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.findByCode.mockResolvedValue(existingWarehouse);

      await expect(warehouseService.updateWarehouse('wh-1', { code: 'WH002' }))
        .rejects.toThrow('Un magazzino con questo codice esiste già');
    });

    it('should allow keeping the same code', async () => {
      const mockWarehouse = createMockWarehouse({ id: 'wh-1', code: 'WH001' });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.findByCode.mockResolvedValue(mockWarehouse); // Same warehouse
      mockWarehouseRepository.update.mockResolvedValue(mockWarehouse);

      await warehouseService.updateWarehouse('wh-1', { code: 'WH001' });

      expect(mockWarehouseRepository.update).toHaveBeenCalled();
    });

    it('should update address', async () => {
      const mockWarehouse = createMockWarehouse();
      const newAddress = { street: 'Via Nuova 5', city: 'Firenze', zip: '50100', country: 'IT' };

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.update.mockResolvedValue({
        ...mockWarehouse,
        address: newAddress,
      });

      const result = await warehouseService.updateWarehouse('wh-1', { address: newAddress });

      expect(result.address).toEqual(newAddress);
    });
  });

  // ============================================
  // deleteWarehouse
  // ============================================

  describe('deleteWarehouse', () => {
    it('should delete non-primary warehouse successfully', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: false });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.canDelete.mockResolvedValue(true);
      mockWarehouseRepository.delete.mockResolvedValue({ ...mockWarehouse, isActive: false });

      const result = await warehouseService.deleteWarehouse('wh-1');

      expect(result.isActive).toBe(false);
      expect(mockWarehouseRepository.delete).toHaveBeenCalledWith('wh-1');
    });

    it('should throw error when warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(warehouseService.deleteWarehouse('non-existent'))
        .rejects.toThrow('Magazzino non trovato');
    });

    it('should throw error when deleting only primary warehouse', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: true });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [mockWarehouse],
        pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
      });

      await expect(warehouseService.deleteWarehouse('wh-1'))
        .rejects.toThrow("Non è possibile eliminare l'unico magazzino principale attivo");
    });

    it('should allow deleting primary warehouse if other active warehouses exist', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: true });
      const otherWarehouse = createMockWarehouse({ id: 'wh-2', isPrimary: false });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.findAll.mockResolvedValue({
        items: [mockWarehouse, otherWarehouse],
        pagination: { total: 2, page: 1, limit: 100, totalPages: 1 },
      });
      mockWarehouseRepository.canDelete.mockResolvedValue(true);
      mockWarehouseRepository.delete.mockResolvedValue({ ...mockWarehouse, isActive: false });

      await warehouseService.deleteWarehouse('wh-1');

      expect(mockWarehouseRepository.delete).toHaveBeenCalled();
    });

    it('should throw error when warehouse has inventory', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: false });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.canDelete.mockResolvedValue(false);

      await expect(warehouseService.deleteWarehouse('wh-1'))
        .rejects.toThrow('Impossibile eliminare il magazzino: sono presenti giacenze associate');
    });
  });

  // ============================================
  // setPrimaryWarehouse
  // ============================================

  describe('setPrimaryWarehouse', () => {
    it('should set warehouse as primary', async () => {
      const mockWarehouse = createMockWarehouse({ isPrimary: false });

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.update.mockResolvedValue({ ...mockWarehouse, isPrimary: true });

      const result = await warehouseService.setPrimaryWarehouse('wh-1');

      expect(result.isPrimary).toBe(true);
      expect(mockWarehouseRepository.update).toHaveBeenCalledWith('wh-1', { isPrimary: true });
    });

    it('should throw error when warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(warehouseService.setPrimaryWarehouse('non-existent'))
        .rejects.toThrow('Magazzino non trovato');
    });
  });

  // ============================================
  // getWarehouseStats
  // ============================================

  describe('getWarehouseStats', () => {
    it('should return warehouse statistics', async () => {
      const mockWarehouse = createMockWarehouse();
      const mockInventoryItems = [
        { quantity: 100, product: { cost: createDecimal(10), minStockLevel: 50 } },
        { quantity: 200, product: { cost: createDecimal(25), minStockLevel: 100 } },
      ];

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      prismaMock.inventoryItem.count.mockResolvedValue(2);
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce(mockInventoryItems as any)
        .mockResolvedValueOnce(mockInventoryItems as any);

      const result = await warehouseService.getWarehouseStats('wh-1');

      expect(result.warehouse).toEqual(mockWarehouse);
      expect(result.stats.totalProducts).toBe(2);
      expect(result.stats.totalValue).toBe(6000); // (100*10) + (200*25)
      expect(result.stats.lowStockCount).toBe(0);
    });

    it('should count low stock items correctly', async () => {
      const mockWarehouse = createMockWarehouse();
      const mockInventoryItems = [
        { quantity: 10, product: { id: 'p1', sku: 'SKU1', name: 'Product 1', cost: createDecimal(10), minStockLevel: 50 } }, // Low stock
        { quantity: 200, product: { id: 'p2', sku: 'SKU2', name: 'Product 2', cost: createDecimal(25), minStockLevel: 100 } }, // OK
        { quantity: 50, product: { id: 'p3', sku: 'SKU3', name: 'Product 3', cost: createDecimal(15), minStockLevel: 50 } }, // At minimum
      ];

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      prismaMock.inventoryItem.count.mockResolvedValue(3);
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce(mockInventoryItems as any)
        .mockResolvedValueOnce(mockInventoryItems as any);

      const result = await warehouseService.getWarehouseStats('wh-1');

      expect(result.stats.lowStockCount).toBe(2); // First and third items are at or below minStockLevel
    });

    it('should throw error when warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(warehouseService.getWarehouseStats('non-existent'))
        .rejects.toThrow('Magazzino non trovato');
    });

    it('should handle empty warehouse (no inventory)', async () => {
      const mockWarehouse = createMockWarehouse();

      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      prismaMock.inventoryItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await warehouseService.getWarehouseStats('wh-1');

      expect(result.stats.totalProducts).toBe(0);
      expect(result.stats.totalValue).toBe(0);
      expect(result.stats.lowStockCount).toBe(0);
    });
  });

  // ============================================
  // getWarehouseService (Factory)
  // ============================================

  describe('getWarehouseService', () => {
    it('should return service instance', () => {
      const service = getWarehouseService(prismaMock as any);

      expect(service).toBeInstanceOf(WarehouseService);
    });
  });
});
