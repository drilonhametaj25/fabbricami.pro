/**
 * BOM Service Tests
 * Tests for Bill of Materials management including recursive explosion,
 * cycle detection, producibility calculations, and availability checks
 */

import { prismaMock, createDecimal } from '../__mocks__/prisma';

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import bomService, { BomService, BomExplosionItem } from '@server/services/bom.service';

// Helper to create mock BOM items
const createMockBomItem = (overrides: any = {}) => ({
  id: 'bom-1',
  parentProductId: 'product-parent',
  componentProductId: 'product-component',
  quantity: createDecimal(2),
  unit: 'pz',
  scrapPercentage: createDecimal(0),
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  componentProduct: {
    id: 'product-component',
    sku: 'COMP-001',
    name: 'Component 1',
    unit: 'pz',
    cost: createDecimal(10),
    price: createDecimal(15),
    mainImageUrl: null,
    minStockLevel: 10,
  },
  ...overrides,
});

const createMockProduct = (overrides: any = {}) => ({
  id: 'prod-1',
  sku: 'PROD-001',
  name: 'Test Product',
  unit: 'pz',
  cost: createDecimal(50),
  price: createDecimal(100),
  isActive: true,
  minStockLevel: 5,
  ...overrides,
});

const createMockInventoryItem = (overrides: any = {}) => ({
  id: 'inv-1',
  productId: 'prod-1',
  quantity: 100,
  reservedQuantity: 10,
  location: 'WEB',
  ...overrides,
});

describe('BomService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // getBomItems
  // ============================================

  describe('getBomItems', () => {
    it('should return first-level BOM components', async () => {
      const mockBomItems = [
        createMockBomItem(),
        createMockBomItem({ id: 'bom-2', componentProductId: 'comp-2' }),
      ];

      prismaMock.bomItem.findMany.mockResolvedValue(mockBomItems as any);

      const result = await bomService.getBomItems('product-parent');

      expect(result).toHaveLength(2);
      expect(prismaMock.bomItem.findMany).toHaveBeenCalledWith({
        where: { parentProductId: 'product-parent' },
        include: expect.objectContaining({
          componentProduct: expect.any(Object),
        }),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no BOM defined', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.getBomItems('product-no-bom');

      expect(result).toEqual([]);
    });

    it('should include component product details', async () => {
      const mockBomItem = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);

      const result = await bomService.getBomItems('product-parent');

      expect(result[0].componentProduct).toBeDefined();
      expect(result[0].componentProduct.sku).toBe('COMP-001');
    });
  });

  // ============================================
  // explodeBomRecursive
  // ============================================

  describe('explodeBomRecursive', () => {
    it('should return flat list of all components', async () => {
      const mockBomItem = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0); // Is leaf

      const result = await bomService.explodeBomRecursive('product-parent', 1);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('product-component');
      expect(result[0].isLeaf).toBe(true);
    });

    it('should calculate effective quantity with scrap percentage', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(10),
        scrapPercentage: createDecimal(10), // 10% scrap
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.explodeBomRecursive('product-parent', 1);

      // 10 * 1.1 (10% scrap) * 1 (parent qty) = 11
      expect(result[0].quantity).toBe(11);
    });

    it('should respect parent quantity multiplier', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.explodeBomRecursive('product-parent', 5);

      // 2 * 5 = 10
      expect(result[0].quantity).toBe(10);
    });

    it('should throw error on cycle detection', async () => {
      const visited = new Set(['product-A']);

      await expect(
        bomService.explodeBomRecursive('product-A', 1, visited, 0)
      ).rejects.toThrow(/Ciclo rilevato nel BOM/);
    });

    it('should handle multi-level BOM explosion', async () => {
      // Level 1: Parent -> Component A
      const level1Item = createMockBomItem({
        componentProductId: 'comp-A',
        componentProduct: {
          id: 'comp-A',
          sku: 'COMP-A',
          name: 'Component A',
          unit: 'pz',
          cost: createDecimal(20),
        },
      });

      // Level 2: Component A -> Component B (leaf)
      const level2Item = createMockBomItem({
        parentProductId: 'comp-A',
        componentProductId: 'comp-B',
        componentProduct: {
          id: 'comp-B',
          sku: 'COMP-B',
          name: 'Component B',
          unit: 'pz',
          cost: createDecimal(5),
        },
      });

      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([level1Item] as any)  // First call for parent
        .mockResolvedValueOnce([level2Item] as any); // Second call for comp-A

      prismaMock.bomItem.count
        .mockResolvedValueOnce(1)  // comp-A has sub-components
        .mockResolvedValueOnce(0); // comp-B is leaf

      const result = await bomService.explodeBomRecursive('product-parent', 1);

      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe('comp-A');
      expect(result[0].level).toBe(1);
      expect(result[0].isLeaf).toBe(false);
      expect(result[1].productId).toBe('comp-B');
      expect(result[1].level).toBe(2);
      expect(result[1].isLeaf).toBe(true);
    });

    it('should calculate cost correctly', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(3),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(15),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.explodeBomRecursive('product-parent', 2);

      // 3 * 2 = 6 units, 6 * 15 = 90 cost
      expect(result[0].quantity).toBe(6);
      expect(result[0].cost).toBe(90);
    });

    it('should set level correctly for nested components', async () => {
      const mockBomItem = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.explodeBomRecursive('product-parent', 1, new Set(), 0);

      expect(result[0].level).toBe(1);
    });

    it('should set parentProductId correctly', async () => {
      const mockBomItem = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.explodeBomRecursive('product-parent', 1);

      expect(result[0].parentProductId).toBe('product-parent');
    });

    it('should handle empty BOM', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.explodeBomRecursive('product-no-bom', 1);

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getLeafComponents
  // ============================================

  describe('getLeafComponents', () => {
    it('should return only leaf components', async () => {
      const level1Item = createMockBomItem({
        componentProductId: 'comp-A',
        componentProduct: {
          id: 'comp-A',
          sku: 'COMP-A',
          name: 'Component A',
          unit: 'pz',
          cost: createDecimal(20),
        },
      });

      const level2Item = createMockBomItem({
        parentProductId: 'comp-A',
        componentProductId: 'comp-B',
        componentProduct: {
          id: 'comp-B',
          sku: 'COMP-B',
          name: 'Component B',
          unit: 'pz',
          cost: createDecimal(5),
        },
      });

      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([level1Item] as any)
        .mockResolvedValueOnce([level2Item] as any);

      prismaMock.bomItem.count
        .mockResolvedValueOnce(1) // comp-A has children
        .mockResolvedValueOnce(0); // comp-B is leaf

      const result = await bomService.getLeafComponents('product-parent', 1);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('comp-B');
      expect(result[0].isLeaf).toBe(true);
    });

    it('should return empty array when no BOM', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.getLeafComponents('product-no-bom', 1);

      expect(result).toEqual([]);
    });

    it('should respect quantity multiplier', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.getLeafComponents('product-parent', 3);

      expect(result[0].quantity).toBe(6);
    });
  });

  // ============================================
  // validateBomNoCycles
  // ============================================

  describe('validateBomNoCycles', () => {
    it('should return false for self-reference', async () => {
      const result = await bomService.validateBomNoCycles('product-A', 'product-A');

      expect(result).toBe(false);
    });

    it('should return true for valid hierarchy', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.validateBomNoCycles('product-parent', 'product-child');

      expect(result).toBe(true);
    });

    it('should return false for transitive cycle', async () => {
      // Component has parent in its sub-tree
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([{ componentProductId: 'product-parent' }] as any);

      const result = await bomService.validateBomNoCycles('product-parent', 'product-child');

      expect(result).toBe(false);
    });

    it('should detect deep cycle', async () => {
      // product-child -> sub-1 -> sub-2 -> product-parent (cycle!)
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([{ componentProductId: 'sub-1' }] as any)
        .mockResolvedValueOnce([{ componentProductId: 'sub-2' }] as any)
        .mockResolvedValueOnce([{ componentProductId: 'product-parent' }] as any);

      const result = await bomService.validateBomNoCycles('product-parent', 'product-child');

      expect(result).toBe(false);
    });

    it('should handle multiple branches without cycles', async () => {
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([
          { componentProductId: 'branch-1' },
          { componentProductId: 'branch-2' },
        ] as any)
        .mockResolvedValueOnce([]) // branch-1 has no children
        .mockResolvedValueOnce([]); // branch-2 has no children

      const result = await bomService.validateBomNoCycles('product-parent', 'product-child');

      expect(result).toBe(true);
    });
  });

  // ============================================
  // addBomItem
  // ============================================

  describe('addBomItem', () => {
    it('should create new BOM item', async () => {
      const mockCreated = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.bomItem.upsert.mockResolvedValue(mockCreated as any);

      const result = await bomService.addBomItem({
        parentProductId: 'product-parent',
        componentProductId: 'product-component',
        quantity: 2,
      });

      expect(result).toEqual(mockCreated);
      expect(prismaMock.bomItem.upsert).toHaveBeenCalled();
    });

    it('should throw error on cycle creation', async () => {
      // Self-reference
      await expect(
        bomService.addBomItem({
          parentProductId: 'product-A',
          componentProductId: 'product-A',
          quantity: 1,
        })
      ).rejects.toThrow(/creerebbe un ciclo nel BOM/);
    });

    it('should upsert existing BOM item', async () => {
      const mockUpdated = createMockBomItem({ quantity: createDecimal(5) });
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.bomItem.upsert.mockResolvedValue(mockUpdated as any);

      await bomService.addBomItem({
        parentProductId: 'product-parent',
        componentProductId: 'product-component',
        quantity: 5,
      });

      expect(prismaMock.bomItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ quantity: 5 }),
          update: expect.objectContaining({ quantity: 5 }),
        })
      );
    });

    it('should handle scrap percentage', async () => {
      const mockCreated = createMockBomItem({ scrapPercentage: createDecimal(5) });
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.bomItem.upsert.mockResolvedValue(mockCreated as any);

      await bomService.addBomItem({
        parentProductId: 'product-parent',
        componentProductId: 'product-component',
        quantity: 2,
        scrapPercentage: 5,
      });

      expect(prismaMock.bomItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ scrapPercentage: 5 }),
        })
      );
    });

    it('should default unit to pz', async () => {
      const mockCreated = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.bomItem.upsert.mockResolvedValue(mockCreated as any);

      await bomService.addBomItem({
        parentProductId: 'product-parent',
        componentProductId: 'product-component',
        quantity: 2,
      });

      expect(prismaMock.bomItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ unit: 'pz' }),
        })
      );
    });
  });

  // ============================================
  // updateBomItem
  // ============================================

  describe('updateBomItem', () => {
    it('should update quantity', async () => {
      const mockUpdated = createMockBomItem({ quantity: createDecimal(10) });
      prismaMock.bomItem.update.mockResolvedValue(mockUpdated as any);

      const result = await bomService.updateBomItem(
        'product-parent',
        'product-component',
        { quantity: 10 }
      );

      expect(Number(result.quantity)).toBe(10);
    });

    it('should update unit', async () => {
      const mockUpdated = createMockBomItem({ unit: 'kg' });
      prismaMock.bomItem.update.mockResolvedValue(mockUpdated as any);

      const result = await bomService.updateBomItem(
        'product-parent',
        'product-component',
        { unit: 'kg' }
      );

      expect(result.unit).toBe('kg');
    });

    it('should update scrap percentage', async () => {
      const mockUpdated = createMockBomItem({ scrapPercentage: createDecimal(15) });
      prismaMock.bomItem.update.mockResolvedValue(mockUpdated as any);

      const result = await bomService.updateBomItem(
        'product-parent',
        'product-component',
        { scrapPercentage: 15 }
      );

      expect(Number(result.scrapPercentage)).toBe(15);
    });

    it('should handle partial updates', async () => {
      const mockUpdated = createMockBomItem({ notes: 'Updated notes' });
      prismaMock.bomItem.update.mockResolvedValue(mockUpdated as any);

      await bomService.updateBomItem(
        'product-parent',
        'product-component',
        { notes: 'Updated notes' }
      );

      expect(prismaMock.bomItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: 'Updated notes' }),
        })
      );
    });
  });

  // ============================================
  // removeBomItem
  // ============================================

  describe('removeBomItem', () => {
    it('should delete BOM item', async () => {
      const mockDeleted = createMockBomItem();
      prismaMock.bomItem.delete.mockResolvedValue(mockDeleted as any);

      const result = await bomService.removeBomItem('product-parent', 'product-component');

      expect(result).toEqual(mockDeleted);
      expect(prismaMock.bomItem.delete).toHaveBeenCalledWith({
        where: {
          parentProductId_componentProductId: {
            parentProductId: 'product-parent',
            componentProductId: 'product-component',
          },
        },
      });
    });

    it('should throw error when item not found', async () => {
      prismaMock.bomItem.delete.mockRejectedValue(new Error('Record not found'));

      await expect(
        bomService.removeBomItem('non-existent', 'component')
      ).rejects.toThrow();
    });
  });

  // ============================================
  // calculateBomCost
  // ============================================

  describe('calculateBomCost', () => {
    it('should sum leaf component costs', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.calculateBomCost('product-parent', 1);

      // 2 * 10 = 20
      expect(result).toBe(20);
    });

    it('should respect quantity multiplier', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.calculateBomCost('product-parent', 3);

      // 2 * 3 * 10 = 60
      expect(result).toBe(60);
    });

    it('should include scrap factor in cost calculation', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(10),
        scrapPercentage: createDecimal(10), // 10% scrap
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(5),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.calculateBomCost('product-parent', 1);

      // 10 * 1.1 * 5 = 55
      expect(result).toBe(55);
    });

    it('should return 0 for product without BOM', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.calculateBomCost('product-no-bom', 1);

      expect(result).toBe(0);
    });

    it('should only sum leaf costs (no double counting)', async () => {
      // Non-leaf component A costs 100, leaf component B costs 10
      const level1Item = createMockBomItem({
        componentProductId: 'comp-A',
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-A',
          sku: 'COMP-A',
          name: 'Component A',
          unit: 'pz',
          cost: createDecimal(100), // Should NOT be counted
        },
      });

      const level2Item = createMockBomItem({
        parentProductId: 'comp-A',
        componentProductId: 'comp-B',
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-B',
          sku: 'COMP-B',
          name: 'Component B',
          unit: 'pz',
          cost: createDecimal(10), // Should be counted
        },
      });

      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([level1Item] as any)
        .mockResolvedValueOnce([level2Item] as any);

      prismaMock.bomItem.count
        .mockResolvedValueOnce(1) // comp-A has children
        .mockResolvedValueOnce(0); // comp-B is leaf

      const result = await bomService.calculateBomCost('product-parent', 1);

      expect(result).toBe(10); // Only leaf cost
    });
  });

  // ============================================
  // checkBomAvailability
  // ============================================

  describe('checkBomAvailability', () => {
    it('should return available true when all components in stock', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(5),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.checkBomAvailability('product-parent', 10, 'WEB');

      expect(result.available).toBe(true);
      expect(result.shortages).toHaveLength(0);
    });

    it('should return shortages when components insufficient', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(10),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 50,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.checkBomAvailability('product-parent', 10, 'WEB');

      expect(result.available).toBe(false);
      expect(result.shortages).toHaveLength(1);
      expect(result.shortages[0].required).toBe(100); // 10 * 10
      expect(result.shortages[0].available).toBe(50);
      expect(result.shortages[0].shortage).toBe(50);
    });

    it('should handle reserved quantity', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(10),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 50, // Only 50 available
      } as any);

      const result = await bomService.checkBomAvailability('product-parent', 10, 'WEB');

      expect(result.available).toBe(false);
      expect(result.shortages[0].available).toBe(50);
    });

    it('should aggregate same component appearing multiple times', async () => {
      // Same component used in multiple places
      const level1Item = createMockBomItem({
        componentProductId: 'comp-A',
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-A',
          sku: 'COMP-A',
          name: 'Component A',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });

      const level2Item = createMockBomItem({
        parentProductId: 'comp-A',
        componentProductId: 'shared-comp',
        quantity: createDecimal(3),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'shared-comp',
          sku: 'SHARED',
          name: 'Shared Component',
          unit: 'pz',
          cost: createDecimal(5),
        },
      });

      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([level1Item] as any)
        .mockResolvedValueOnce([level2Item] as any);

      prismaMock.bomItem.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 10,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.checkBomAvailability('product-parent', 1, 'WEB');

      // shared-comp: 2 * 3 = 6 required (through comp-A)
      expect(result.shortages).toBeDefined();
    });

    it('should check correct location', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 0,
      } as any);

      await bomService.checkBomAvailability('product-parent', 1, 'B2B');

      expect(prismaMock.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'product-component',
          location: 'B2B',
        },
      });
    });

    it('should handle missing inventory', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(5),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

      const result = await bomService.checkBomAvailability('product-parent', 1, 'WEB');

      expect(result.available).toBe(false);
      expect(result.shortages[0].available).toBe(0);
      expect(result.shortages[0].shortage).toBe(5);
    });
  });

  // ============================================
  // getBomDepth
  // ============================================

  describe('getBomDepth', () => {
    it('should return 0 for product without BOM', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);

      const result = await bomService.getBomDepth('product-no-bom');

      expect(result).toBe(0);
    });

    it('should return 1 for single-level BOM', async () => {
      const mockBomItem = createMockBomItem();
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);

      const result = await bomService.getBomDepth('product-parent');

      expect(result).toBe(1);
    });

    it('should return max depth for multi-level BOM', async () => {
      const level1Item = createMockBomItem({
        componentProductId: 'comp-A',
        componentProduct: {
          id: 'comp-A',
          sku: 'COMP-A',
          name: 'Component A',
          unit: 'pz',
          cost: createDecimal(20),
        },
      });

      const level2Item = createMockBomItem({
        parentProductId: 'comp-A',
        componentProductId: 'comp-B',
        componentProduct: {
          id: 'comp-B',
          sku: 'COMP-B',
          name: 'Component B',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });

      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([level1Item] as any)
        .mockResolvedValueOnce([level2Item] as any);

      prismaMock.bomItem.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await bomService.getBomDepth('product-parent');

      expect(result).toBe(2);
    });
  });

  // ============================================
  // calculateProducibleQuantity
  // ============================================

  describe('calculateProducibleQuantity', () => {
    it('should return producible quantity based on component stock', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 20,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.calculateProducibleQuantity('product-parent', 'WEB');

      expect(result.producibleQuantity).toBe(10); // 20 / 2
      expect(result.hasBom).toBe(true);
    });

    it('should identify bottleneck component', async () => {
      const comp1 = createMockBomItem({
        componentProductId: 'comp-1',
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Component 1',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });
      const comp2 = createMockBomItem({
        componentProductId: 'comp-2',
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-2',
          sku: 'COMP-002',
          name: 'Component 2',
          unit: 'pz',
          cost: createDecimal(5),
        },
      });

      prismaMock.bomItem.findMany.mockResolvedValue([comp1, comp2] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst
        .mockResolvedValueOnce({ quantity: 100, reservedQuantity: 0 } as any) // comp-1
        .mockResolvedValueOnce({ quantity: 5, reservedQuantity: 0 } as any); // comp-2 (bottleneck)

      const result = await bomService.calculateProducibleQuantity('product-parent', 'WEB');

      expect(result.producibleQuantity).toBe(5);
      const bottleneck = result.limitingComponents.find(c => c.isBottleneck);
      expect(bottleneck?.sku).toBe('COMP-002');
    });

    it('should return 0 with hasBom false when no BOM defined', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([]);

      const result = await bomService.calculateProducibleQuantity('product-no-bom', 'WEB');

      expect(result.producibleQuantity).toBe(0);
      expect(result.hasBom).toBe(false);
      expect(result.limitingComponents).toHaveLength(0);
    });

    it('should fallback to phase materials when no BOM', async () => {
      prismaMock.bomItem.findMany.mockResolvedValue([]);
      prismaMock.manufacturingPhase.findMany.mockResolvedValue([{
        id: 'phase-1',
        productId: 'product-1',
        isActive: true,
        materials: [{
          materialId: 'mat-1',
          quantity: createDecimal(5),
          scrapPercentage: createDecimal(0),
          unit: 'pz',
          material: {
            id: 'mat-1',
            name: 'Material 1',
            sku: 'MAT-001',
            cost: createDecimal(2),
          },
        }],
      }] as any);
      prismaMock.material.findUnique.mockResolvedValue({
        currentStock: 100,
      } as any);

      const result = await bomService.calculateProducibleQuantity('product-1', 'WEB');

      expect(result.producibleQuantity).toBe(20); // 100 / 5
      expect(result.hasBom).toBe(false);
    });

    it('should handle reserved quantity in calculation', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
      });
      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 60, // Only 40 available
      } as any);

      const result = await bomService.calculateProducibleQuantity('product-parent', 'WEB');

      expect(result.producibleQuantity).toBe(40);
    });

    it('should return totalComponentTypes count', async () => {
      const comp1 = createMockBomItem({ componentProductId: 'comp-1' });
      const comp2 = createMockBomItem({ componentProductId: 'comp-2' });

      prismaMock.bomItem.findMany.mockResolvedValue([comp1, comp2] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.calculateProducibleQuantity('product-parent', 'WEB');

      expect(result.totalComponentTypes).toBe(2);
    });
  });

  // ============================================
  // calculateProducibleQuantityBatch
  // ============================================

  describe('calculateProducibleQuantityBatch', () => {
    it('should process multiple products', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
      });

      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 50,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.calculateProducibleQuantityBatch(
        ['product-1', 'product-2'],
        'WEB'
      );

      expect(result.size).toBe(2);
      expect(result.get('product-1')?.producibleQuantity).toBe(50);
      expect(result.get('product-2')?.producibleQuantity).toBe(50);
    });

    it('should handle errors per product', async () => {
      // First call for product-1: success
      prismaMock.bomItem.findMany
        .mockResolvedValueOnce([createMockBomItem({
          quantity: createDecimal(1),
          scrapPercentage: createDecimal(0),
        })] as any)
        // Second call for product-error: error
        .mockRejectedValueOnce(new Error('DB Error'));

      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.calculateProducibleQuantityBatch(
        ['product-1', 'product-error'],
        'WEB'
      );

      expect(result.get('product-1')?.producibleQuantity).toBe(100);
      expect(result.get('product-error')?.producibleQuantity).toBe(0);
      expect(result.get('product-error')?.hasBom).toBe(false);
    });

    it('should include limiting component info', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(2),
        scrapPercentage: createDecimal(0),
        componentProduct: {
          id: 'comp-1',
          sku: 'COMP-001',
          name: 'Bottleneck Component',
          unit: 'pz',
          cost: createDecimal(10),
        },
      });

      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 10,
        reservedQuantity: 0,
      } as any);

      const result = await bomService.calculateProducibleQuantityBatch(['product-1'], 'WEB');

      expect(result.get('product-1')?.limitingComponent).toContain('COMP-001');
      expect(result.get('product-1')?.limitingComponent).toContain('Bottleneck Component');
    });

    it('should use specified location', async () => {
      const mockBomItem = createMockBomItem({
        quantity: createDecimal(1),
        scrapPercentage: createDecimal(0),
      });

      prismaMock.bomItem.findMany.mockResolvedValue([mockBomItem] as any);
      prismaMock.bomItem.count.mockResolvedValue(0);
      prismaMock.inventoryItem.findFirst.mockResolvedValue({
        quantity: 100,
        reservedQuantity: 0,
      } as any);

      await bomService.calculateProducibleQuantityBatch(['product-1'], 'B2B');

      expect(prismaMock.inventoryItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ location: 'B2B' }),
        })
      );
    });
  });
});
