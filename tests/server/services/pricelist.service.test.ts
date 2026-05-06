/**
 * PriceList Service Tests
 * Tests for price list management including multi-tier pricing,
 * category discounts, and bulk import functionality
 */

import { prismaMock, createDecimal } from '../__mocks__/prisma';

// Mock the repository
const mockPriceListRepository = {
  findById: jest.fn(),
  findByCode: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsertPriceListItem: jest.fn(),
  deletePriceListItem: jest.fn(),
  upsertCategoryDiscount: jest.fn(),
  deleteCategoryDiscount: jest.fn(),
  assignToCustomer: jest.fn(),
  removeFromCustomer: jest.fn(),
  findCustomersByPriceList: jest.fn(),
  bulkUpsertItems: jest.fn(),
};

jest.mock('@server/repositories/pricelist.repository', () => ({
  priceListRepository: mockPriceListRepository,
}));

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import { priceListService } from '@server/services/pricelist.service';

// Helper functions
const createMockPriceList = (overrides: any = {}) => ({
  id: 'pl-1',
  code: 'RETAIL',
  name: 'Retail Price List',
  description: 'Standard retail prices',
  isActive: true,
  priority: 10,
  globalDiscount: createDecimal(0),
  validFrom: null,
  validTo: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  items: [],
  categoryDiscounts: [],
  _count: { customers: 0, items: 0 },
  ...overrides,
});

const createMockPriceListItem = (overrides: any = {}) => ({
  id: 'pli-1',
  priceListId: 'pl-1',
  productId: 'prod-1',
  discountPercent: createDecimal(10),
  fixedPrice: null,
  minQuantity: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  product: {
    id: 'prod-1',
    sku: 'PROD-001',
    name: 'Test Product',
    price: createDecimal(100),
  },
  ...overrides,
});

const createMockCustomer = (overrides: any = {}) => ({
  id: 'cust-1',
  code: 'CLI001',
  businessName: 'Test Company',
  firstName: 'John',
  lastName: 'Doe',
  type: 'B2B',
  email: 'test@example.com',
  discount: createDecimal(0),
  priceListId: null,
  priceList: null,
  ...overrides,
});

const createMockProduct = (overrides: any = {}) => ({
  id: 'prod-1',
  sku: 'PROD-001',
  name: 'Test Product',
  price: createDecimal(100),
  categories: [],
  ...overrides,
});

describe('PriceListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // listPriceLists
  // ============================================

  describe('listPriceLists', () => {
    it('should return paginated list of price lists', async () => {
      const mockLists = [createMockPriceList()];
      mockPriceListRepository.findMany.mockResolvedValue(mockLists);
      mockPriceListRepository.count.mockResolvedValue(1);

      const result = await priceListService.listPriceLists({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockPriceListRepository.findMany.mockResolvedValue([]);
      mockPriceListRepository.count.mockResolvedValue(0);

      await priceListService.listPriceLists({ isActive: true });

      expect(mockPriceListRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      );
    });

    it('should filter by search term', async () => {
      mockPriceListRepository.findMany.mockResolvedValue([]);
      mockPriceListRepository.count.mockResolvedValue(0);

      await priceListService.listPriceLists({ search: 'retail' });

      expect(mockPriceListRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'retail' })
      );
    });

    it('should handle sorting', async () => {
      mockPriceListRepository.findMany.mockResolvedValue([]);
      mockPriceListRepository.count.mockResolvedValue(0);

      await priceListService.listPriceLists({ sortBy: 'name', sortOrder: 'asc' });

      expect(mockPriceListRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } })
      );
    });
  });

  // ============================================
  // getPriceListById
  // ============================================

  describe('getPriceListById', () => {
    it('should return price list when found', async () => {
      const mockList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockList);

      const result = await priceListService.getPriceListById('pl-1');

      expect(result).toEqual(mockList);
      expect(mockPriceListRepository.findById).toHaveBeenCalledWith('pl-1');
    });

    it('should return null when not found', async () => {
      mockPriceListRepository.findById.mockResolvedValue(null);

      const result = await priceListService.getPriceListById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // createPriceList
  // ============================================

  describe('createPriceList', () => {
    it('should create price list successfully', async () => {
      const mockCreated = createMockPriceList();
      mockPriceListRepository.findByCode.mockResolvedValue(null);
      mockPriceListRepository.create.mockResolvedValue(mockCreated);

      const result = await priceListService.createPriceList({
        code: 'RETAIL',
        name: 'Retail Price List',
      });

      expect(result).toEqual(mockCreated);
      expect(mockPriceListRepository.create).toHaveBeenCalled();
    });

    it('should throw error when code already exists', async () => {
      mockPriceListRepository.findByCode.mockResolvedValue(createMockPriceList());

      await expect(
        priceListService.createPriceList({
          code: 'RETAIL',
          name: 'Duplicate',
        })
      ).rejects.toThrow('Price list code already exists');
    });

    it('should parse dates correctly', async () => {
      mockPriceListRepository.findByCode.mockResolvedValue(null);
      mockPriceListRepository.create.mockResolvedValue(createMockPriceList());

      await priceListService.createPriceList({
        code: 'SEASONAL',
        name: 'Seasonal',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      expect(mockPriceListRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          validFrom: expect.any(Date),
          validTo: expect.any(Date),
        })
      );
    });
  });

  // ============================================
  // updatePriceList
  // ============================================

  describe('updatePriceList', () => {
    it('should update price list successfully', async () => {
      const mockList = createMockPriceList();
      const mockUpdated = createMockPriceList({ name: 'Updated Name' });
      mockPriceListRepository.findById.mockResolvedValue(mockList);
      mockPriceListRepository.update.mockResolvedValue(mockUpdated);

      const result = await priceListService.updatePriceList('pl-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw error when price list not found', async () => {
      mockPriceListRepository.findById.mockResolvedValue(null);

      await expect(
        priceListService.updatePriceList('non-existent', { name: 'Test' })
      ).rejects.toThrow('Price list not found');
    });

    it('should throw error when changing to existing code', async () => {
      const mockList = createMockPriceList({ id: 'pl-1', code: 'RETAIL' });
      const existingList = createMockPriceList({ id: 'pl-2', code: 'WHOLESALE' });
      mockPriceListRepository.findById.mockResolvedValue(mockList);
      mockPriceListRepository.findByCode.mockResolvedValue(existingList);

      await expect(
        priceListService.updatePriceList('pl-1', { code: 'WHOLESALE' })
      ).rejects.toThrow('Price list code already exists');
    });

    it('should allow keeping same code', async () => {
      const mockList = createMockPriceList({ code: 'RETAIL' });
      mockPriceListRepository.findById.mockResolvedValue(mockList);
      mockPriceListRepository.findByCode.mockResolvedValue(mockList); // Same list
      mockPriceListRepository.update.mockResolvedValue(mockList);

      await priceListService.updatePriceList('pl-1', { code: 'RETAIL' });

      expect(mockPriceListRepository.update).toHaveBeenCalled();
    });
  });

  // ============================================
  // deletePriceList
  // ============================================

  describe('deletePriceList', () => {
    it('should soft delete price list', async () => {
      const mockList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockList);
      mockPriceListRepository.delete.mockResolvedValue({ ...mockList, isActive: false });

      const result = await priceListService.deletePriceList('pl-1');

      expect(mockPriceListRepository.delete).toHaveBeenCalledWith('pl-1');
    });

    it('should throw error when not found', async () => {
      mockPriceListRepository.findById.mockResolvedValue(null);

      await expect(
        priceListService.deletePriceList('non-existent')
      ).rejects.toThrow('Price list not found');
    });
  });

  // ============================================
  // setPriceListItem
  // ============================================

  describe('setPriceListItem', () => {
    it('should create/upsert price list item', async () => {
      const mockItem = createMockPriceListItem();
      mockPriceListRepository.upsertPriceListItem.mockResolvedValue(mockItem);

      const result = await priceListService.setPriceListItem({
        priceListId: 'pl-1',
        productId: 'prod-1',
        discountPercent: 10,
      });

      expect(result).toEqual(mockItem);
      expect(mockPriceListRepository.upsertPriceListItem).toHaveBeenCalled();
    });

    it('should handle fixed price', async () => {
      const mockItem = createMockPriceListItem({ fixedPrice: createDecimal(80) });
      mockPriceListRepository.upsertPriceListItem.mockResolvedValue(mockItem);

      await priceListService.setPriceListItem({
        priceListId: 'pl-1',
        productId: 'prod-1',
        fixedPrice: 80,
      });

      expect(mockPriceListRepository.upsertPriceListItem).toHaveBeenCalledWith(
        expect.objectContaining({ fixedPrice: 80 })
      );
    });

    it('should handle discount percent', async () => {
      const mockItem = createMockPriceListItem({ discountPercent: createDecimal(15) });
      mockPriceListRepository.upsertPriceListItem.mockResolvedValue(mockItem);

      await priceListService.setPriceListItem({
        priceListId: 'pl-1',
        productId: 'prod-1',
        discountPercent: 15,
      });

      expect(mockPriceListRepository.upsertPriceListItem).toHaveBeenCalledWith(
        expect.objectContaining({ discountPercent: 15 })
      );
    });
  });

  // ============================================
  // removePriceListItem
  // ============================================

  describe('removePriceListItem', () => {
    it('should remove price list item', async () => {
      const mockItem = createMockPriceListItem();
      mockPriceListRepository.deletePriceListItem.mockResolvedValue(mockItem);

      await priceListService.removePriceListItem('pl-1', 'prod-1', 1);

      expect(mockPriceListRepository.deletePriceListItem).toHaveBeenCalledWith('pl-1', 'prod-1', 1);
    });

    it('should use default minQuantity', async () => {
      mockPriceListRepository.deletePriceListItem.mockResolvedValue({});

      await priceListService.removePriceListItem('pl-1', 'prod-1');

      expect(mockPriceListRepository.deletePriceListItem).toHaveBeenCalledWith('pl-1', 'prod-1', 1);
    });
  });

  // ============================================
  // setCategoryDiscount
  // ============================================

  describe('setCategoryDiscount', () => {
    it('should create/upsert category discount', async () => {
      const mockDiscount = { priceListId: 'pl-1', categoryId: 'cat-1', discountPercent: createDecimal(15) };
      mockPriceListRepository.upsertCategoryDiscount.mockResolvedValue(mockDiscount);

      const result = await priceListService.setCategoryDiscount({
        priceListId: 'pl-1',
        categoryId: 'cat-1',
        discountPercent: 15,
      });

      expect(result).toEqual(mockDiscount);
    });

    it('should update existing category discount', async () => {
      const mockDiscount = { priceListId: 'pl-1', categoryId: 'cat-1', discountPercent: createDecimal(20) };
      mockPriceListRepository.upsertCategoryDiscount.mockResolvedValue(mockDiscount);

      await priceListService.setCategoryDiscount({
        priceListId: 'pl-1',
        categoryId: 'cat-1',
        discountPercent: 20,
      });

      expect(mockPriceListRepository.upsertCategoryDiscount).toHaveBeenCalled();
    });
  });

  // ============================================
  // removeCategoryDiscount
  // ============================================

  describe('removeCategoryDiscount', () => {
    it('should remove category discount', async () => {
      mockPriceListRepository.deleteCategoryDiscount.mockResolvedValue({});

      await priceListService.removeCategoryDiscount('pl-1', 'cat-1');

      expect(mockPriceListRepository.deleteCategoryDiscount).toHaveBeenCalledWith('pl-1', 'cat-1');
    });
  });

  // ============================================
  // assignToCustomer
  // ============================================

  describe('assignToCustomer', () => {
    it('should assign price list to B2B customer', async () => {
      const mockCustomer = createMockCustomer({ type: 'B2B' });
      const mockPriceList = createMockPriceList();
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      mockPriceListRepository.findById.mockResolvedValue(mockPriceList);
      mockPriceListRepository.assignToCustomer.mockResolvedValue({ ...mockCustomer, priceListId: 'pl-1' });

      await priceListService.assignToCustomer('cust-1', 'pl-1');

      expect(mockPriceListRepository.assignToCustomer).toHaveBeenCalledWith('cust-1', 'pl-1');
    });

    it('should throw error for non-B2B customer', async () => {
      const mockCustomer = createMockCustomer({ type: 'B2C' });
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      await expect(
        priceListService.assignToCustomer('cust-1', 'pl-1')
      ).rejects.toThrow('Price lists can only be assigned to B2B customers');
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        priceListService.assignToCustomer('non-existent', 'pl-1')
      ).rejects.toThrow('Customer not found');
    });

    it('should throw error when price list not found', async () => {
      const mockCustomer = createMockCustomer({ type: 'B2B' });
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      mockPriceListRepository.findById.mockResolvedValue(null);

      await expect(
        priceListService.assignToCustomer('cust-1', 'non-existent')
      ).rejects.toThrow('Price list not found');
    });
  });

  // ============================================
  // removeFromCustomer
  // ============================================

  describe('removeFromCustomer', () => {
    it('should remove price list from customer', async () => {
      mockPriceListRepository.removeFromCustomer.mockResolvedValue({});

      await priceListService.removeFromCustomer('cust-1');

      expect(mockPriceListRepository.removeFromCustomer).toHaveBeenCalledWith('cust-1');
    });
  });

  // ============================================
  // calculatePrice
  // ============================================

  describe('calculatePrice', () => {
    it('should apply fixed price from price list', async () => {
      const mockProduct = createMockProduct({
        categories: [{ isPrimary: true, category: { id: 'cat-1', name: 'Category' } }],
      });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        priceList: {
          id: 'pl-1',
          name: 'Wholesale',
          isActive: true,
          validFrom: null,
          validTo: null,
          globalDiscount: createDecimal(0),
          items: [{
            productId: 'prod-1',
            minQuantity: 1,
            fixedPrice: createDecimal(80),
            discountPercent: null,
          }],
          categoryDiscounts: [],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      expect(result.finalPrice).toBe(80);
      expect(result.discountType).toBe('FIXED');
      expect(result.discountSource).toBe('product');
    });

    it('should apply product discount percent', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        priceList: {
          id: 'pl-1',
          name: 'Wholesale',
          isActive: true,
          validFrom: null,
          validTo: null,
          globalDiscount: createDecimal(0),
          items: [{
            productId: 'prod-1',
            minQuantity: 1,
            fixedPrice: null,
            discountPercent: createDecimal(20),
          }],
          categoryDiscounts: [],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      expect(result.finalPrice).toBe(80); // 100 - 20%
      expect(result.discount).toBe(20);
      expect(result.discountType).toBe('PERCENTAGE');
      expect(result.discountSource).toBe('product');
    });

    it('should apply category discount', async () => {
      const mockProduct = createMockProduct({
        categories: [{ isPrimary: true, category: { id: 'cat-1', name: 'Electronics' } }],
      });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        priceList: {
          id: 'pl-1',
          name: 'Wholesale',
          isActive: true,
          validFrom: null,
          validTo: null,
          globalDiscount: createDecimal(0),
          items: [],
          categoryDiscounts: [{ categoryId: 'cat-1', discountPercent: createDecimal(15) }],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      expect(result.finalPrice).toBe(85); // 100 - 15%
      expect(result.discountSource).toBe('category');
    });

    it('should apply global discount', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        priceList: {
          id: 'pl-1',
          name: 'Wholesale',
          isActive: true,
          validFrom: null,
          validTo: null,
          globalDiscount: createDecimal(10),
          items: [],
          categoryDiscounts: [],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      expect(result.finalPrice).toBe(90); // 100 - 10%
      expect(result.discountSource).toBe('pricelist_global');
    });

    it('should apply customer discount when no price list', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        discount: createDecimal(5),
        priceList: null,
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      expect(result.finalPrice).toBe(95); // 100 - 5%
      expect(result.discountSource).toBe('customer');
    });

    it('should apply quantity-based pricing tiers', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        priceList: {
          id: 'pl-1',
          name: 'Wholesale',
          isActive: true,
          validFrom: null,
          validTo: null,
          globalDiscount: createDecimal(0),
          items: [
            { productId: 'prod-1', minQuantity: 100, fixedPrice: createDecimal(70), discountPercent: null },
            { productId: 'prod-1', minQuantity: 10, fixedPrice: createDecimal(80), discountPercent: null },
            { productId: 'prod-1', minQuantity: 1, fixedPrice: createDecimal(90), discountPercent: null },
          ],
          categoryDiscounts: [],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      // Buying 50 units should get the 10+ tier price (80)
      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 50);

      expect(result.finalPrice).toBe(80);
    });

    it('should respect price list validity dates', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockCustomer = createMockCustomer({
        type: 'B2B',
        discount: createDecimal(5),
        priceList: {
          id: 'pl-1',
          name: 'Future List',
          isActive: true,
          validFrom: futureDate, // Not yet valid
          validTo: null,
          globalDiscount: createDecimal(50),
          items: [],
          categoryDiscounts: [],
        },
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculatePrice('cust-1', 'prod-1', 1);

      // Should fallback to customer discount since price list not yet valid
      expect(result.discountSource).toBe('customer');
    });

    it('should throw error when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        priceListService.calculatePrice('cust-1', 'non-existent', 1)
      ).rejects.toThrow('Product not found');
    });
  });

  // ============================================
  // calculateOrderPrices
  // ============================================

  describe('calculateOrderPrices', () => {
    it('should calculate prices for multiple items', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        discount: createDecimal(0),
        priceList: null,
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculateOrderPrices('cust-1', [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 3 },
      ]);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].lineTotal).toBe(200); // 100 * 2
      expect(result.items[1].lineTotal).toBe(300); // 100 * 3
    });

    it('should calculate subtotal correctly', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        discount: createDecimal(10),
        priceList: null,
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculateOrderPrices('cust-1', [
        { productId: 'prod-1', quantity: 5 },
      ]);

      // 5 * 90 (100 - 10%) = 450
      expect(result.subtotal).toBe(450);
    });

    it('should calculate total discount', async () => {
      const mockProduct = createMockProduct({ categories: [] });
      const mockCustomer = createMockCustomer({
        type: 'B2B',
        discount: createDecimal(20),
        priceList: null,
      });

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);

      const result = await priceListService.calculateOrderPrices('cust-1', [
        { productId: 'prod-1', quantity: 10 },
      ]);

      // Discount: (100 - 80) * 10 = 200
      expect(result.totalDiscount).toBe(200);
    });
  });

  // ============================================
  // bulkImportPrices
  // ============================================

  describe('bulkImportPrices', () => {
    it('should import items with productId', async () => {
      const mockPriceList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockPriceList);
      mockPriceListRepository.bulkUpsertItems.mockResolvedValue([{}, {}]);

      const result = await priceListService.bulkImportPrices({
        priceListId: 'pl-1',
        items: [
          { productId: 'prod-1', discountPercent: 10 },
          { productId: 'prod-2', fixedPrice: 50 },
        ],
      });

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should resolve items by SKU', async () => {
      const mockPriceList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockPriceList);
      prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1' } as any);
      mockPriceListRepository.bulkUpsertItems.mockResolvedValue([{}]);

      const result = await priceListService.bulkImportPrices({
        priceListId: 'pl-1',
        items: [
          { productSku: 'PROD-001', discountPercent: 15 },
        ],
      });

      expect(result.imported).toBe(1);
    });

    it('should skip invalid items', async () => {
      const mockPriceList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockPriceList);
      // Only the item with productSku will call findFirst (first item has productId already)
      prismaMock.product.findFirst.mockResolvedValueOnce(null); // SKU not found
      mockPriceListRepository.bulkUpsertItems.mockResolvedValue([{}]);

      const result = await priceListService.bulkImportPrices({
        priceListId: 'pl-1',
        items: [
          { productId: 'prod-1', discountPercent: 10 }, // Valid - has productId
          { productSku: 'INVALID-SKU', discountPercent: 15 }, // Invalid - SKU not found
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should throw error when no valid items', async () => {
      const mockPriceList = createMockPriceList();
      mockPriceListRepository.findById.mockResolvedValue(mockPriceList);
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(
        priceListService.bulkImportPrices({
          priceListId: 'pl-1',
          items: [{ productSku: 'INVALID', discountPercent: 10 }],
        })
      ).rejects.toThrow('No valid items to import');
    });
  });

  // ============================================
  // getCustomersByPriceList
  // ============================================

  describe('getCustomersByPriceList', () => {
    it('should return customers assigned to price list', async () => {
      const mockCustomers = [
        createMockCustomer({ id: 'cust-1' }),
        createMockCustomer({ id: 'cust-2' }),
      ];
      mockPriceListRepository.findCustomersByPriceList.mockResolvedValue(mockCustomers);

      const result = await priceListService.getCustomersByPriceList('pl-1');

      expect(result).toHaveLength(2);
      expect(mockPriceListRepository.findCustomersByPriceList).toHaveBeenCalledWith('pl-1');
    });

    it('should return empty array when no customers', async () => {
      mockPriceListRepository.findCustomersByPriceList.mockResolvedValue([]);

      const result = await priceListService.getCustomersByPriceList('pl-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getStats
  // ============================================

  describe('getStats', () => {
    it('should return price list statistics', async () => {
      prismaMock.priceList.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // active
      prismaMock.customer.count.mockResolvedValue(25);
      prismaMock.priceListItem.count.mockResolvedValue(150);

      const result = await priceListService.getStats();

      expect(result.totalLists).toBe(10);
      expect(result.activeLists).toBe(8);
      expect(result.assignedCustomers).toBe(25);
      expect(result.pricedProducts).toBe(150);
    });

    it('should handle zero values', async () => {
      prismaMock.priceList.count.mockResolvedValue(0);
      prismaMock.customer.count.mockResolvedValue(0);
      prismaMock.priceListItem.count.mockResolvedValue(0);

      const result = await priceListService.getStats();

      expect(result.totalLists).toBe(0);
      expect(result.activeLists).toBe(0);
      expect(result.assignedCustomers).toBe(0);
      expect(result.pricedProducts).toBe(0);
    });
  });
});
