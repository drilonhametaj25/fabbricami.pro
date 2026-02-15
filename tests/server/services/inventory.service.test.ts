/**
 * Inventory Service Tests
 * Comprehensive unit tests for inventory management functionality
 *
 * Priority: Functionality first - fix code to pass tests, not the other way around
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';
import { inventoryService } from '@server/services/inventory.service';

// Mock the prisma client
jest.mock('@server/config/database', () => ({
  prisma: require('../__mocks__/prisma').prismaMock,
}));

// Mock BOM service - using inline functions to avoid hoisting issues
jest.mock('@server/services/bom.service', () => {
  const mockGetLeafComponents = jest.fn().mockResolvedValue([]);
  return {
    __esModule: true,
    default: {
      getLeafComponents: mockGetLeafComponents,
    },
    bomService: {
      getLeafComponents: mockGetLeafComponents,
    },
  };
});

// Mock alert service
jest.mock('@server/services/alert.service', () => {
  const mockCheckProductStock = jest.fn().mockResolvedValue(null);
  const mockSendAlertNotifications = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    default: {
      checkProductStock: mockCheckProductStock,
      sendAlertNotifications: mockSendAlertNotifications,
    },
    alertService: {
      checkProductStock: mockCheckProductStock,
      sendAlertNotifications: mockSendAlertNotifications,
    },
  };
});

jest.mock('@server/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // listInventory
  // ==========================================
  describe('listInventory', () => {
    it('should return paginated inventory items', async () => {
      const mockItems = [
        mockFactories.inventoryItem({ id: 'inv-1', quantity: 100 }),
        mockFactories.inventoryItem({ id: 'inv-2', quantity: 50 }),
      ];

      prismaMock.inventoryItem.findMany.mockResolvedValue(mockItems as any);
      prismaMock.inventoryItem.count.mockResolvedValue(2);

      const result = await inventoryService.listInventory({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by productId', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(0);

      await inventoryService.listInventory({ productId: 'prod-123' });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: 'prod-123' }),
        })
      );
    });

    it('should filter by location', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(0);

      await inventoryService.listInventory({ locationId: 'WEB' });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ location: 'WEB' }),
        })
      );
    });

    it('should filter by outOfStock', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(0);

      await inventoryService.listInventory({ outOfStock: true });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ quantity: 0 }),
        })
      );
    });

    it('should filter by search term', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(0);

      await inventoryService.listInventory({ search: 'test' });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: {
              OR: [
                { sku: { contains: 'test', mode: 'insensitive' } },
                { name: { contains: 'test', mode: 'insensitive' } },
              ],
            },
          }),
        })
      );
    });

    it('should handle empty results', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(0);

      const result = await inventoryService.listInventory({});

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should calculate correct pagination for multiple pages', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.count.mockResolvedValue(55);

      const result = await inventoryService.listInventory({ page: 2, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });
  });

  // ==========================================
  // getInventoryItem
  // ==========================================
  describe('getInventoryItem', () => {
    it('should return inventory item for product and location', async () => {
      const mockItem = mockFactories.inventoryItem({
        productId: 'prod-1',
        location: 'WEB',
        quantity: 100,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);

      const result = await inventoryService.getInventoryItem('prod-1', 'WEB');

      expect(result).toBeDefined();
      expect(result?.productId).toBe('prod-1');
      expect(prismaMock.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { productId: 'prod-1', location: 'WEB' },
        include: { product: true, variant: true },
      });
    });

    it('should include variantId in query when provided', async () => {
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      await inventoryService.getInventoryItem('prod-1', 'WEB', 'var-1');

      expect(prismaMock.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { productId: 'prod-1', location: 'WEB', variantId: 'var-1' },
        include: { product: true, variant: true },
      });
    });

    it('should return null when item not found', async () => {
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      const result = await inventoryService.getInventoryItem('nonexistent', 'WEB');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // createMovement
  // ==========================================
  describe('createMovement', () => {
    const baseMovementData = {
      productId: 'prod-1',
      type: 'IN' as const,
      quantity: 50,
      locationId: 'WEB',
      userId: 'user-1',
    };

    it('should create IN movement and increase stock', async () => {
      const mockMovement = mockFactories.inventoryMovement({
        ...baseMovementData,
        toLocation: 'WEB',
      });
      const mockInventoryItem = mockFactories.inventoryItem({
        productId: 'prod-1',
        quantity: 100,
      });

      prismaMock.inventoryMovement.create.mockResolvedValue(mockMovement as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
      prismaMock.inventoryItem.update.mockResolvedValue({
        ...mockInventoryItem,
        quantity: 150,
      } as any);

      const result = await inventoryService.createMovement(baseMovementData);

      expect(result).toBeDefined();
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalled();
      expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 150, // 100 + 50
          }),
        })
      );
    });

    it('should create OUT movement and decrease stock', async () => {
      const outMovementData = { ...baseMovementData, type: 'OUT' as const };
      const mockMovement = mockFactories.inventoryMovement({
        ...outMovementData,
        fromLocation: 'WEB',
      });
      const mockInventoryItem = mockFactories.inventoryItem({
        productId: 'prod-1',
        quantity: 100,
      });

      prismaMock.inventoryMovement.create.mockResolvedValue(mockMovement as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
      prismaMock.inventoryItem.update.mockResolvedValue({
        ...mockInventoryItem,
        quantity: 50,
      } as any);

      await inventoryService.createMovement(outMovementData);

      expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 50, // 100 - 50
          }),
        })
      );
    });

    it('should create new inventory item when none exists and type is IN', async () => {
      const mockWarehouse = mockFactories.warehouse({ isPrimary: true });

      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
      prismaMock.warehouse.findFirst.mockResolvedValue(mockWarehouse as any);
      prismaMock.inventoryItem.create.mockResolvedValue({} as any);

      await inventoryService.createMovement(baseMovementData);

      expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          quantity: 50,
          location: 'WEB',
        }),
      });
    });

    it('should throw error when no primary warehouse exists for new item', async () => {
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
      prismaMock.warehouse.findFirst.mockResolvedValue(null);

      await expect(inventoryService.createMovement(baseMovementData)).rejects.toThrow(
        'Nessun magazzino primario configurato'
      );
    });

    it('should include notes and lotNumber when provided', async () => {
      const movementWithExtras = {
        ...baseMovementData,
        notes: 'Test notes',
        lotNumber: 'LOT-001',
      };

      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(
        mockFactories.inventoryItem() as any
      );
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);

      await inventoryService.createMovement(movementWithExtras);

      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'Test notes',
            lotNumber: 'LOT-001',
          }),
        })
      );
    });
  });

  // ==========================================
  // listMovements
  // ==========================================
  describe('listMovements', () => {
    it('should return paginated movements', async () => {
      const mockMovements = [
        mockFactories.inventoryMovement({ id: 'mov-1' }),
        mockFactories.inventoryMovement({ id: 'mov-2' }),
      ];

      prismaMock.inventoryMovement.findMany.mockResolvedValue(mockMovements as any);
      prismaMock.inventoryMovement.count.mockResolvedValue(2);

      const result = await inventoryService.listMovements({});

      expect(result.movements).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by movement type', async () => {
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.inventoryMovement.count.mockResolvedValue(0);

      await inventoryService.listMovements({ type: 'OUT' });

      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'OUT' }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.inventoryMovement.count.mockResolvedValue(0);

      const dateFrom = '2026-01-01';
      const dateTo = '2026-01-31';

      await inventoryService.listMovements({ dateFrom, dateTo });

      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by location with OR condition', async () => {
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.inventoryMovement.count.mockResolvedValue(0);

      await inventoryService.listMovements({ locationId: 'WEB' });

      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ fromLocation: 'WEB' }, { toLocation: 'WEB' }],
          }),
        })
      );
    });
  });

  // ==========================================
  // transferStock
  // ==========================================
  describe('transferStock', () => {
    it('should transfer stock between locations', async () => {
      const fromInventory = mockFactories.inventoryItem({
        id: 'inv-from',
        location: 'WEB',
        quantity: 100,
      });
      const toInventory = mockFactories.inventoryItem({
        id: 'inv-to',
        location: 'B2B',
        quantity: 50,
      });

      prismaMock.inventoryItem.findFirst
        .mockResolvedValueOnce(fromInventory as any)
        .mockResolvedValueOnce(toInventory as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);

      const result = await inventoryService.transferStock(
        'prod-1',
        'WEB',
        'B2B',
        20,
        'user-1',
        'Transfer notes'
      );

      expect(result).toBeDefined();
      expect(prismaMock.inventoryItem.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'TRANSFER',
            quantity: 20,
            fromLocation: 'WEB',
            toLocation: 'B2B',
          }),
        })
      );
    });
  });

  // ==========================================
  // reserveStock
  // ==========================================
  describe('reserveStock', () => {
    it('should reserve available stock', async () => {
      const mockItem = mockFactories.inventoryItem({
        id: 'inv-1',
        quantity: 100,
        reservedQuantity: 0,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);

      const result = await inventoryService.reserveStock('prod-1', 'WEB', 30, 'ord-1');

      expect(result.reserved).toBe(true);
      expect(result.quantity).toBe(30);
      expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reservedQuantity: 30 },
        })
      );
    });

    it('should throw error when inventory item not found', async () => {
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        inventoryService.reserveStock('prod-1', 'WEB', 30, 'ord-1')
      ).rejects.toThrow('Inventory item not found');
    });

    it('should throw error when insufficient stock available', async () => {
      const mockItem = mockFactories.inventoryItem({
        quantity: 50,
        reservedQuantity: 40,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);

      await expect(
        inventoryService.reserveStock('prod-1', 'WEB', 20, 'ord-1')
      ).rejects.toThrow('Insufficient stock available for reservation');
    });
  });

  // ==========================================
  // releaseReservation
  // ==========================================
  describe('releaseReservation', () => {
    it('should release reserved stock', async () => {
      const mockItem = mockFactories.inventoryItem({
        id: 'inv-1',
        reservedQuantity: 30,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);

      const result = await inventoryService.releaseReservation('prod-1', 'WEB', 20, 'ord-1');

      expect(result.released).toBe(true);
      expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reservedQuantity: 10 }, // 30 - 20
        })
      );
    });

    it('should not allow negative reserved quantity', async () => {
      const mockItem = mockFactories.inventoryItem({
        id: 'inv-1',
        reservedQuantity: 10,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);

      await inventoryService.releaseReservation('prod-1', 'WEB', 20, 'ord-1');

      expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reservedQuantity: 0 }, // Max(0, 10-20)
        })
      );
    });

    it('should throw error when inventory item not found', async () => {
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        inventoryService.releaseReservation('prod-1', 'WEB', 20, 'ord-1')
      ).rejects.toThrow('Inventory item not found');
    });
  });

  // ==========================================
  // checkAvailability
  // ==========================================
  describe('checkAvailability', () => {
    it('should return available when sufficient stock', async () => {
      const mockItem = mockFactories.inventoryItem({
        quantity: 100,
        reservedQuantity: 20,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);

      const result = await inventoryService.checkAvailability('prod-1', 'WEB', 50);

      expect(result.available).toBe(true);
      expect(result.currentStock).toBe(100);
      expect(result.availableStock).toBe(80); // 100 - 20
      expect(result.reservedStock).toBe(20);
      expect(result.requested).toBe(50);
    });

    it('should return unavailable when insufficient stock', async () => {
      const mockItem = mockFactories.inventoryItem({
        quantity: 50,
        reservedQuantity: 30,
      });

      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockItem as any);

      const result = await inventoryService.checkAvailability('prod-1', 'WEB', 30);

      expect(result.available).toBe(false);
      expect(result.availableStock).toBe(20); // 50 - 30
    });

    it('should return unavailable when item not found', async () => {
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      const result = await inventoryService.checkAvailability('prod-1', 'WEB', 10);

      expect(result.available).toBe(false);
      expect(result.currentStock).toBe(0);
      expect(result.availableStock).toBe(0);
    });
  });

  // ==========================================
  // getTotalStock
  // ==========================================
  describe('getTotalStock', () => {
    it('should aggregate stock across all locations', async () => {
      const mockItems = [
        mockFactories.inventoryItem({ location: 'WEB', quantity: 100, reservedQuantity: 10 }),
        mockFactories.inventoryItem({ location: 'B2B', quantity: 50, reservedQuantity: 5 }),
      ];

      prismaMock.inventoryItem.findMany.mockResolvedValue(mockItems as any);

      const result = await inventoryService.getTotalStock('prod-1');

      expect(result.totalQuantity).toBe(150);
      expect(result.totalReserved).toBe(15);
      expect(result.totalAvailable).toBe(135);
      expect(result.byLocation).toHaveLength(2);
    });

    it('should return zeros when no inventory exists', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      const result = await inventoryService.getTotalStock('prod-1');

      expect(result.totalQuantity).toBe(0);
      expect(result.totalReserved).toBe(0);
      expect(result.totalAvailable).toBe(0);
      expect(result.byLocation).toHaveLength(0);
    });
  });

  // ==========================================
  // getLowStockProducts
  // ==========================================
  describe('getLowStockProducts', () => {
    it('should return products below minimum stock level', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product 1',
          isActive: true,
          minStockLevel: 50,
          reorderPoint: 30,
          inventory: [
            { quantity: 20, reservedQuantity: 5 }, // Available: 15
          ],
        },
        {
          id: 'prod-2',
          sku: 'SKU002',
          name: 'Product 2',
          isActive: true,
          minStockLevel: 30,
          reorderPoint: 20,
          inventory: [
            { quantity: 100, reservedQuantity: 10 }, // Available: 90
          ],
        },
      ];

      prismaMock.product.findMany.mockResolvedValue(mockProducts as any);

      const result = await inventoryService.getLowStockProducts();

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe('SKU001');
      expect(result[0].totalStock).toBe(15);
    });

    it('should use custom threshold when provided', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product 1',
          isActive: true,
          minStockLevel: 10,
          reorderPoint: 5,
          inventory: [{ quantity: 50, reservedQuantity: 0 }],
        },
      ];

      prismaMock.product.findMany.mockResolvedValue(mockProducts as any);

      const result = await inventoryService.getLowStockProducts(60);

      expect(result).toHaveLength(1); // 50 < 60
    });

    it('should sort by stock level ascending', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product 1',
          isActive: true,
          minStockLevel: 100,
          reorderPoint: 50,
          inventory: [{ quantity: 50, reservedQuantity: 0 }],
        },
        {
          id: 'prod-2',
          sku: 'SKU002',
          name: 'Product 2',
          isActive: true,
          minStockLevel: 100,
          reorderPoint: 50,
          inventory: [{ quantity: 20, reservedQuantity: 0 }],
        },
      ];

      prismaMock.product.findMany.mockResolvedValue(mockProducts as any);

      const result = await inventoryService.getLowStockProducts();

      expect(result[0].totalStock).toBe(20); // Lower stock first
      expect(result[1].totalStock).toBe(50);
    });
  });

  // ==========================================
  // getStockPrediction
  // ==========================================
  describe('getStockPrediction', () => {
    it('should calculate prediction based on movement history', async () => {
      const mockItems = [
        mockFactories.inventoryItem({ quantity: 100, reservedQuantity: 0 }),
      ];
      const mockMovements = [
        mockFactories.inventoryMovement({ type: 'OUT', quantity: 10 }),
        mockFactories.inventoryMovement({ type: 'OUT', quantity: 20 }),
      ];
      const mockProduct = mockFactories.product({ minStockLevel: 10, reorderPoint: 20 });

      prismaMock.inventoryItem.findMany.mockResolvedValue(mockItems as any);
      prismaMock.inventoryMovement.findMany.mockResolvedValue(mockMovements as any);
      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);

      const result = await inventoryService.getStockPrediction('prod-1', 90);

      expect(result.avgDailySales).toBeDefined();
      expect(result.avgWeeklySales).toBeDefined();
      expect(result.avgMonthlySales).toBeDefined();
      expect(result.status).toBeDefined();
      expect(['CRITICAL', 'LOW', 'OK', 'OVERSTOCKED']).toContain(result.status);
    });

    it('should return CRITICAL status when stock is zero', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 0, reservedQuantity: 0 },
      ] as any);
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.product.findUnique.mockResolvedValue(
        mockFactories.product() as any
      );

      const result = await inventoryService.getStockPrediction('prod-1');

      expect(result.status).toBe('CRITICAL');
      expect(result.statusMessage).toContain('Esaurito');
    });

    it('should return CRITICAL status when below minimum stock', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 5, reservedQuantity: 0 },
      ] as any);
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.product.findUnique.mockResolvedValue({
        ...mockFactories.product(),
        minStockLevel: 10,
      } as any);

      const result = await inventoryService.getStockPrediction('prod-1');

      expect(result.status).toBe('CRITICAL');
    });

    it('should calculate days until out of stock', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 90, reservedQuantity: 0 },
      ] as any);
      // 90 units OUT over 90 days = 1/day average
      const movements = Array(90).fill(null).map(() =>
        mockFactories.inventoryMovement({ type: 'OUT', quantity: 1 })
      );
      prismaMock.inventoryMovement.findMany.mockResolvedValue(movements as any);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product() as any);

      const result = await inventoryService.getStockPrediction('prod-1', 90);

      expect(result.avgDailySales).toBe(1);
      expect(result.daysUntilOutOfStock).toBe(90);
      expect(result.estimatedOutOfStockDate).not.toBeNull();
    });

    it('should return null dates when no sales history', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 100, reservedQuantity: 0 },
      ] as any);
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product() as any);

      const result = await inventoryService.getStockPrediction('prod-1');

      expect(result.avgDailySales).toBe(0);
      expect(result.daysUntilOutOfStock).toBeNull();
      expect(result.estimatedOutOfStockDate).toBeNull();
    });
  });

  // ==========================================
  // deductInventoryRecursive
  // ==========================================
  describe('deductInventoryRecursive', () => {
    it('should return error when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const result = await inventoryService.deductInventoryRecursive(
        'nonexistent',
        10,
        'WEB',
        'ord-1',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('non trovato');
    });

    it('should deduct inventory for simple product', async () => {
      const mockProduct = mockFactories.product({ id: 'prod-1', sku: 'SKU001' });
      const mockInventory = mockFactories.inventoryItem({
        productId: 'prod-1',
        quantity: 100,
        reservedQuantity: 10,
      });

      const bomService = require('@server/services/bom.service').default;
      bomService.getLeafComponents.mockResolvedValue([]);

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockInventory as any);
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);

      const result = await inventoryService.deductInventoryRecursive(
        'prod-1',
        5,
        'WEB',
        'ord-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.deductions).toHaveLength(1);
      expect(result.totalMovements).toBe(1);
    });

    it('should return error when insufficient stock', async () => {
      const mockProduct = mockFactories.product({ id: 'prod-1', sku: 'SKU001' });
      const mockInventory = mockFactories.inventoryItem({
        productId: 'prod-1',
        quantity: 10,
        reservedQuantity: 5,
      });

      const bomService = require('@server/services/bom.service').default;
      bomService.getLeafComponents.mockResolvedValue([]);

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        try {
          return await fn(prismaMock);
        } catch (e) {
          return undefined;
        }
      });
      prismaMock.inventoryItem.findFirst.mockResolvedValue(mockInventory as any);

      const result = await inventoryService.deductInventoryRecursive(
        'prod-1',
        20, // More than available (10 - 5 = 5)
        'WEB',
        'ord-1',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should deduct BOM components recursively', async () => {
      const mockProduct = mockFactories.product({ id: 'prod-1', sku: 'SKU001' });
      const bomService = require('@server/services/bom.service').default;
      bomService.getLeafComponents.mockResolvedValue([
        { productId: 'comp-1', sku: 'COMP001', name: 'Component 1', quantity: 2 },
        { productId: 'comp-2', sku: 'COMP002', name: 'Component 2', quantity: 3 },
      ]);

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
      prismaMock.inventoryItem.findFirst.mockResolvedValue(
        mockFactories.inventoryItem({ quantity: 100, reservedQuantity: 0 }) as any
      );
      prismaMock.inventoryItem.update.mockResolvedValue({} as any);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);

      const result = await inventoryService.deductInventoryRecursive(
        'prod-1',
        1,
        'WEB',
        'ord-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.deductions.length).toBeGreaterThan(1); // Main + components
    });
  });

  // ==========================================
  // getStockHistory
  // ==========================================
  describe('getStockHistory', () => {
    it('should return history with actual and projected data', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 100, reservedQuantity: 0 },
      ] as any);
      prismaMock.inventoryMovement.findMany.mockResolvedValue([
        { ...mockFactories.inventoryMovement({ type: 'OUT', quantity: 5 }), createdAt: new Date() },
      ] as any);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product() as any);

      const result = await inventoryService.getStockHistory('prod-1', 30, 30);

      expect(result.history).toBeDefined();
      expect(result.events).toBeDefined();
      expect(result.currentStock).toBe(100);
      expect(result.prediction).toBeDefined();
      expect(result.history.some((h) => h.type === 'actual')).toBe(true);
    });

    it('should include projected data when there are sales', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { quantity: 100, reservedQuantity: 0 },
      ] as any);

      // Create movements with proper dates
      const movements = Array(30).fill(null).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          ...mockFactories.inventoryMovement({ type: 'OUT', quantity: 2 }),
          createdAt: date,
        };
      });

      prismaMock.inventoryMovement.findMany.mockResolvedValue(movements as any);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product() as any);

      const result = await inventoryService.getStockHistory('prod-1', 30, 30);

      expect(result.history.some((h) => h.type === 'projected')).toBe(true);
    });
  });

  // ==========================================
  // listInventoryWithPredictions
  // ==========================================
  describe('listInventoryWithPredictions', () => {
    beforeEach(() => {
      // Setup common mocks for prediction calculations
      prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product() as any);
    });

    it('should return inventory items with predictions and stats', async () => {
      const mockItems = [
        {
          ...mockFactories.inventoryItem({ id: 'inv-1', quantity: 100 }),
          product: mockFactories.product({ sku: 'SKU001' }),
        },
        {
          ...mockFactories.inventoryItem({ id: 'inv-2', quantity: 50 }),
          product: mockFactories.product({ sku: 'SKU002' }),
        },
      ];

      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce(mockItems as any) // First call for all items
        .mockResolvedValue([{ quantity: 100, reservedQuantity: 0 }] as any); // Subsequent calls for predictions

      const result = await inventoryService.listInventoryWithPredictions({});

      expect(result.items).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.stats.totalItems).toBe(2);
    });

    it('should filter by status', async () => {
      const mockItems = [
        {
          ...mockFactories.inventoryItem({ id: 'inv-1', quantity: 0 }), // CRITICAL
          product: mockFactories.product(),
        },
        {
          ...mockFactories.inventoryItem({ id: 'inv-2', quantity: 1000 }), // OK
          product: mockFactories.product(),
        },
      ];

      prismaMock.inventoryItem.findMany.mockResolvedValue(mockItems as any);

      const result = await inventoryService.listInventoryWithPredictions({
        statusFilter: 'CRITICAL',
      });

      // All items returned have CRITICAL status
      result.items.forEach((item: any) => {
        expect(item.prediction.status).toBe('CRITICAL');
      });
    });
  });

  // ==========================================
  // listMaterialInventory
  // ==========================================
  describe('listMaterialInventory', () => {
    beforeEach(() => {
      // Setup mocks for material prediction calculations
      prismaMock.materialConsumption.findMany.mockResolvedValue([]);
    });

    it('should return material inventory with predictions', async () => {
      const mockMaterials = [
        {
          ...mockFactories.material({ id: 'mat-1', currentStock: 100 }),
          supplier: { id: 'sup-1', businessName: 'Supplier 1' },
        },
        {
          ...mockFactories.material({ id: 'mat-2', currentStock: 50 }),
          supplier: null,
        },
      ];

      prismaMock.material.findMany.mockResolvedValue(mockMaterials as any);

      const result = await inventoryService.listMaterialInventory({});

      expect(result.items).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.stats.totalItems).toBe(2);
    });

    it('should filter by search term', async () => {
      prismaMock.material.findMany.mockResolvedValue([]);

      await inventoryService.listMaterialInventory({ search: 'test' });

      expect(prismaMock.material.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { sku: { contains: 'test', mode: 'insensitive' } },
              { name: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter by category', async () => {
      prismaMock.material.findMany.mockResolvedValue([]);

      await inventoryService.listMaterialInventory({ category: 'Raw Material' });

      expect(prismaMock.material.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Raw Material',
          }),
        })
      );
    });
  });
});
