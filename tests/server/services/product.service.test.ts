/**
 * Product Service Tests
 * Sprint 3A - Core Entity Services
 * ~50 test cases covering all ProductService methods
 */
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock product repository
const mockProductRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getLowStockProducts: jest.fn(),
  calculateProductCost: jest.fn(),
  explodeBom: jest.fn(),
  search: jest.fn(),
  findSellable: jest.fn(),
  getProductsRequiringReorder: jest.fn(),
};

jest.mock('@server/repositories/product.repository', () => ({
  __esModule: true,
  default: mockProductRepository,
  ProductRepository: jest.fn(() => mockProductRepository),
}));

// Import after mocks
import productService from '@server/services/product.service';

// Helper function to create Decimal values
function createDecimal(value: number): Decimal {
  return new Prisma.Decimal(value);
}

// Helper function to create mock product
function createMockProduct(overrides: Partial<any> = {}) {
  return {
    id: 'prod-1',
    sku: 'SKU001',
    name: 'Test Product',
    description: 'Test product description',
    price: createDecimal(100),
    cost: createDecimal(50),
    category: 'Electronics',
    isActive: true,
    isSellable: true,
    barcode: '1234567890123',
    minStockLevel: 10,
    reorderQuantity: 50,
    supplierId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    variants: [],
    bomItems: [],
    operations: [],
    inventory: [],
    productImages: [],
    categories: [],
    ...overrides,
  };
}

// Helper function to create mock BOM item
function createMockBomItem(parentId: string, componentId: string, quantity: number) {
  return {
    id: `bom-${parentId}-${componentId}`,
    parentProductId: parentId,
    componentProductId: componentId,
    quantity: createDecimal(quantity),
    scrapPercentage: createDecimal(0),
    componentProduct: createMockProduct({ id: componentId, sku: `COMP-${componentId}` }),
  };
}

// Helper function to create mock operation
function createMockOperation(productId: string, sequence: number) {
  return {
    id: `op-${productId}-${sequence}`,
    productId,
    name: `Operation ${sequence}`,
    sequence,
    setupTime: 30,
    standardTime: 15,
    hourlyRate: createDecimal(25),
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
  });

  describe('getAllProducts', () => {
    it('should return paginated list of products', async () => {
      const mockProducts = [createMockProduct(), createMockProduct({ id: 'prod-2', sku: 'SKU002' })];
      mockProductRepository.findAll.mockResolvedValue({
        items: mockProducts,
        total: 2,
      });

      const result = await productService.getAllProducts({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by category', async () => {
      mockProductRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await productService.getAllProducts({ category: 'Electronics' });

      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Electronics' }),
        })
      );
    });

    it('should filter by isActive', async () => {
      mockProductRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await productService.getAllProducts({ isActive: true });

      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('should search by sku, name, or barcode', async () => {
      mockProductRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await productService.getAllProducts({ search: 'test' });

      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { sku: { contains: 'test', mode: 'insensitive' } },
              { name: { contains: 'test', mode: 'insensitive' } },
              { barcode: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should sort by specified field', async () => {
      mockProductRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await productService.getAllProducts({ sortBy: 'name', sortOrder: 'asc' });

      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should use default pagination values', async () => {
      mockProductRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await productService.getAllProducts({});

      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('getProductById', () => {
    it('should return product when found', async () => {
      const mockProduct = createMockProduct();
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await productService.getProductById('prod-1');

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findById).toHaveBeenCalledWith('prod-1');
    });

    it('should return null when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      const result = await productService.getProductById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getProductBySku', () => {
    it('should return product when found by SKU', async () => {
      const mockProduct = createMockProduct();
      mockProductRepository.findBySku.mockResolvedValue(mockProduct);

      const result = await productService.getProductBySku('SKU001');

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findBySku).toHaveBeenCalledWith('SKU001');
    });

    it('should return null when SKU not found', async () => {
      mockProductRepository.findBySku.mockResolvedValue(null);

      const result = await productService.getProductBySku('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const newProduct = createMockProduct();
      mockProductRepository.findBySku.mockResolvedValue(null);
      mockProductRepository.create.mockResolvedValue(newProduct);

      const input = {
        sku: 'SKU001',
        name: 'Test Product',
        price: 100,
        cost: 50,
      };

      const result = await productService.createProduct(input as any);

      expect(result).toEqual(newProduct);
      expect(mockProductRepository.findBySku).toHaveBeenCalledWith('SKU001');
      expect(mockProductRepository.create).toHaveBeenCalled();
    });

    it('should throw error when SKU already exists', async () => {
      mockProductRepository.findBySku.mockResolvedValue(createMockProduct());

      const input = {
        sku: 'SKU001',
        name: 'Test Product',
        price: 100,
      };

      await expect(productService.createProduct(input as any)).rejects.toThrow(
        'Product with SKU SKU001 already exists'
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const existing = createMockProduct();
      const updated = { ...existing, name: 'Updated Name' };
      mockProductRepository.findById.mockResolvedValue(existing);
      mockProductRepository.update.mockResolvedValue(updated);

      const result = await productService.updateProduct('prod-1', { name: 'Updated Name' } as any);

      expect(result.name).toBe('Updated Name');
      expect(mockProductRepository.update).toHaveBeenCalledWith('prod-1', { name: 'Updated Name' });
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        productService.updateProduct('non-existent', { name: 'New Name' } as any)
      ).rejects.toThrow('Product not found');
    });

    it('should throw error when changing to existing SKU', async () => {
      const existing = createMockProduct();
      const conflicting = createMockProduct({ id: 'prod-2', sku: 'SKU002' });
      mockProductRepository.findById.mockResolvedValue(existing);
      mockProductRepository.findBySku.mockResolvedValue(conflicting);

      await expect(
        productService.updateProduct('prod-1', { sku: 'SKU002' } as any)
      ).rejects.toThrow('Product with SKU SKU002 already exists');
    });

    it('should allow keeping same SKU', async () => {
      const existing = createMockProduct();
      mockProductRepository.findById.mockResolvedValue(existing);
      mockProductRepository.update.mockResolvedValue(existing);

      await productService.updateProduct('prod-1', { sku: 'SKU001', name: 'Same SKU' } as any);

      // Should not check for duplicate SKU when it's the same
      expect(mockProductRepository.findBySku).not.toHaveBeenCalled();
      expect(mockProductRepository.update).toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully when no pending orders', async () => {
      mockProductRepository.findById.mockResolvedValue(createMockProduct());
      prismaMock.orderItem.count.mockResolvedValue(0);
      mockProductRepository.delete.mockResolvedValue({ ...createMockProduct(), isActive: false });

      const result = await productService.deleteProduct('prod-1');

      expect(result.isActive).toBe(false);
      expect(mockProductRepository.delete).toHaveBeenCalledWith('prod-1');
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(productService.deleteProduct('non-existent')).rejects.toThrow('Product not found');
    });

    it('should throw error when product has pending orders', async () => {
      mockProductRepository.findById.mockResolvedValue(createMockProduct());
      prismaMock.orderItem.count.mockResolvedValue(5);

      await expect(productService.deleteProduct('prod-1')).rejects.toThrow(
        'Cannot delete product with pending orders'
      );
    });
  });

  describe('getLowStockProducts', () => {
    it('should return low stock products', async () => {
      const lowStockProducts = [
        createMockProduct({ inventory: [{ quantity: createDecimal(5) }], minStockLevel: 10 }),
      ];
      mockProductRepository.getLowStockProducts.mockResolvedValue(lowStockProducts);

      const result = await productService.getLowStockProducts();

      expect(result).toHaveLength(1);
      expect(mockProductRepository.getLowStockProducts).toHaveBeenCalled();
    });

    it('should return empty array when no low stock', async () => {
      mockProductRepository.getLowStockProducts.mockResolvedValue([]);

      const result = await productService.getLowStockProducts();

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateProductCost', () => {
    it('should calculate basic product cost without overhead', async () => {
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });

      const result = await productService.calculateProductCost('prod-1', false);

      expect(result.materialCost).toBe(30);
      expect(result.laborCost).toBe(20);
      expect(result.totalCost).toBe(50);
    });

    it('should include overhead when requested', async () => {
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(0) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 }, // 160 hours in minutes
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      prismaMock.product.findUnique.mockResolvedValue(
        createMockProduct({ operations: [] }) as any
      );

      const result = await productService.calculateProductCost('prod-1', true);

      expect(result).toHaveProperty('overheadCost');
      expect(result.totalCost).toBeGreaterThanOrEqual(50);
    });

    it('should calculate overhead based on labor hours', async () => {
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1600) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 }, // 160 hours in minutes
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      const operations = [
        createMockOperation('prod-1', 1),
        createMockOperation('prod-1', 2),
      ];
      prismaMock.product.findUnique.mockResolvedValue(
        createMockProduct({ operations }) as any
      );

      const result = await productService.calculateProductCost('prod-1', true);

      expect(result.overheadCost).toBeGreaterThan(0);
    });

    it('should return zero overhead when product not found', async () => {
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1600) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      prismaMock.product.findUnique.mockResolvedValue(null);

      const result = await productService.calculateProductCost('prod-1', true);

      // Returns 0 when product not found in labor_hours allocation method
      expect(result.overheadCost).toBe(0);
      expect(result.totalCost).toBe(50); // Base cost unchanged
    });
  });

  describe('explodeBom', () => {
    it('should explode BOM with default quantity', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 2, unit: 'pz', level: 1 },
        { componentId: 'comp-2', sku: 'COMP002', name: 'Component 2', totalQuantity: 3, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);

      const result = await productService.explodeBom('prod-1');

      expect(result).toHaveLength(2);
      expect(mockProductRepository.explodeBom).toHaveBeenCalledWith('prod-1', 1);
    });

    it('should explode BOM with specified quantity', async () => {
      mockProductRepository.explodeBom.mockResolvedValue([]);

      await productService.explodeBom('prod-1', 5);

      expect(mockProductRepository.explodeBom).toHaveBeenCalledWith('prod-1', 5);
    });

    it('should return empty array for product without BOM', async () => {
      mockProductRepository.explodeBom.mockResolvedValue([]);

      const result = await productService.explodeBom('prod-no-bom');

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateProductMargin', () => {
    it('should calculate margin correctly', async () => {
      const mockProduct = createMockProduct({ price: createDecimal(100) });
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(0) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      prismaMock.product.findUnique.mockResolvedValue(
        createMockProduct({ operations: [] }) as any
      );

      const result = await productService.calculateProductMargin('prod-1');

      expect(result.price).toBe(100);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.margin).toBeLessThan(100);
      expect(result.marginPercentage).toBeLessThan(100);
      expect(result.breakdown).toHaveProperty('materialCost');
      expect(result.breakdown).toHaveProperty('laborCost');
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(productService.calculateProductMargin('non-existent')).rejects.toThrow(
        'Product not found'
      );
    });

    it('should handle zero price', async () => {
      const mockProduct = createMockProduct({ price: createDecimal(0) });
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(0) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      prismaMock.product.findUnique.mockResolvedValue(
        createMockProduct({ operations: [] }) as any
      );

      const result = await productService.calculateProductMargin('prod-1');

      expect(result.price).toBe(0);
      expect(result.marginPercentage).toBe(0);
    });
  });

  describe('searchProducts', () => {
    it('should search products by query', async () => {
      const mockProducts = [createMockProduct()];
      mockProductRepository.search.mockResolvedValue(mockProducts);

      const result = await productService.searchProducts('test');

      expect(result).toHaveLength(1);
      expect(mockProductRepository.search).toHaveBeenCalledWith('test', undefined);
    });

    it('should search with limit', async () => {
      mockProductRepository.search.mockResolvedValue([]);

      await productService.searchProducts('test', 10);

      expect(mockProductRepository.search).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('getSellableProducts', () => {
    it('should return only sellable products', async () => {
      const sellableProducts = [
        createMockProduct({ isSellable: true }),
        createMockProduct({ id: 'prod-2', sku: 'SKU002', isSellable: true }),
      ];
      mockProductRepository.findSellable.mockResolvedValue(sellableProducts);

      const result = await productService.getSellableProducts();

      expect(result).toHaveLength(2);
      result.forEach((p: any) => expect(p.isSellable).toBe(true));
    });

    it('should return empty array when no sellable products', async () => {
      mockProductRepository.findSellable.mockResolvedValue([]);

      const result = await productService.getSellableProducts();

      expect(result).toHaveLength(0);
    });
  });

  describe('getProductsRequiringReorder', () => {
    it('should return products requiring reorder', async () => {
      const products = [
        createMockProduct({ inventory: [{ quantity: createDecimal(5) }], minStockLevel: 10 }),
      ];
      mockProductRepository.getProductsRequiringReorder.mockResolvedValue(products);

      const result = await productService.getProductsRequiringReorder();

      expect(result).toHaveLength(1);
    });
  });

  describe('calculateMaterialRequirements', () => {
    it('should calculate material requirements for production', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 10, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { id: 'inv-1', productId: 'comp-1', quantity: createDecimal(5), reservedQuantity: createDecimal(0) } as any,
      ]);

      const requiredDate = new Date();
      requiredDate.setDate(requiredDate.getDate() + 14);

      const result = await productService.calculateMaterialRequirements('prod-1', 1, requiredDate);

      expect(result).toHaveLength(1);
      expect(result[0].required).toBe(10);
      expect(result[0].available).toBe(5);
      expect(result[0].shortage).toBe(5);
      expect(result[0].shouldOrder).toBe(true);
    });

    it('should handle no shortage scenario', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 5, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { id: 'inv-1', productId: 'comp-1', quantity: createDecimal(20), reservedQuantity: createDecimal(0) } as any,
      ]);

      const result = await productService.calculateMaterialRequirements('prod-1', 1, new Date());

      expect(result[0].shortage).toBe(0);
      expect(result[0].shouldOrder).toBe(false);
      expect(result[0].orderDate).toBeNull();
    });

    it('should consider reserved quantity', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 10, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { id: 'inv-1', productId: 'comp-1', quantity: createDecimal(15), reservedQuantity: createDecimal(8) } as any,
      ]);

      const result = await productService.calculateMaterialRequirements('prod-1', 1, new Date());

      // Available = 15 - 8 = 7, Required = 10, Shortage = 3
      expect(result[0].available).toBe(7);
      expect(result[0].shortage).toBe(3);
    });

    it('should aggregate inventory from multiple warehouses', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 20, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { id: 'inv-1', productId: 'comp-1', quantity: createDecimal(10), reservedQuantity: createDecimal(0) } as any,
        { id: 'inv-2', productId: 'comp-1', quantity: createDecimal(8), reservedQuantity: createDecimal(2) } as any,
      ]);

      const result = await productService.calculateMaterialRequirements('prod-1', 1, new Date());

      // Available = (10 - 0) + (8 - 2) = 16
      expect(result[0].available).toBe(16);
      expect(result[0].shortage).toBe(4);
    });

    it('should calculate order date based on lead time', async () => {
      const bomComponents = [
        { componentId: 'comp-1', sku: 'COMP001', name: 'Component 1', totalQuantity: 10, unit: 'pz', level: 1 },
      ];
      mockProductRepository.explodeBom.mockResolvedValue(bomComponents);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      const requiredDate = new Date('2025-06-15');
      const result = await productService.calculateMaterialRequirements('prod-1', 1, requiredDate);

      // Lead time is 7 days, so order date should be 7 days before required date
      const expectedOrderDate = new Date('2025-06-08');
      expect(result[0].orderDate?.toISOString().substring(0, 10)).toBe(
        expectedOrderDate.toISOString().substring(0, 10)
      );
    });

    it('should handle empty BOM', async () => {
      mockProductRepository.explodeBom.mockResolvedValue([]);

      const result = await productService.calculateMaterialRequirements('prod-1', 1, new Date());

      expect(result).toHaveLength(0);
    });
  });

  describe('updateProductCostFromBom', () => {
    it('should update product cost based on BOM calculation', async () => {
      mockProductRepository.calculateProductCost.mockResolvedValue({
        materialCost: 30,
        laborCost: 20,
        totalCost: 50,
      });
      prismaMock.overheadCost.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(0) },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      // Mock TimeEntry aggregate for overhead calculation
      prismaMock.timeEntry.aggregate.mockResolvedValue({
        _sum: { duration: 9600 },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });
      prismaMock.product.findUnique.mockResolvedValue(
        createMockProduct({ operations: [] }) as any
      );
      prismaMock.product.update.mockResolvedValue(
        createMockProduct({ cost: createDecimal(56) }) as any
      );

      const result = await productService.updateProductCostFromBom('prod-1');

      expect(result).toHaveProperty('materialCost');
      expect(result).toHaveProperty('laborCost');
      expect(result).toHaveProperty('totalCost');
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { cost: expect.any(Number) },
      });
    });
  });
});
