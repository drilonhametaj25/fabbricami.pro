import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock prisma
const mockPrisma = {
  wishlistItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  productVariant: {
    findUnique: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
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

// Mock cart service (for moveAllToCart)
const mockCartService = {
  addItem: jest.fn(),
};
jest.mock('@server/services/cart.service', () => ({
  __esModule: true,
  default: mockCartService,
}));

import wishlistService from '@server/services/wishlist.service';

describe('WishlistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================
  // getCustomerWishlist
  // ===================
  describe('getCustomerWishlist', () => {
    it('should return wishlist items ordered by addedAt desc', async () => {
      const mockItems = [
        { id: 'item-1', productId: 'prod-1', addedAt: new Date('2026-02-15') },
        { id: 'item-2', productId: 'prod-2', addedAt: new Date('2026-02-10') },
      ];
      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);

      const result = await wishlistService.getCustomerWishlist('cust-1');

      expect(result).toEqual(mockItems);
      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        include: expect.any(Object),
        orderBy: { addedAt: 'desc' },
      });
    });

    it('should return empty array when no items', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);

      const result = await wishlistService.getCustomerWishlist('cust-1');

      expect(result).toEqual([]);
    });
  });

  // ===================
  // addItem
  // ===================
  describe('addItem', () => {
    it('should throw error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        wishlistService.addItem('cust-1', { productId: 'prod-invalid' })
      ).rejects.toThrow('Prodotto non trovato o non disponibile');
    });

    it('should throw error when product is inactive', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isActive: false,
      });

      await expect(
        wishlistService.addItem('cust-1', { productId: 'prod-1' })
      ).rejects.toThrow('Prodotto non trovato o non disponibile');
    });

    it('should throw error when variant not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isActive: true,
      });
      mockPrisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        wishlistService.addItem('cust-1', {
          productId: 'prod-1',
          variantId: 'var-invalid',
        })
      ).rejects.toThrow('Variante non trovata o non disponibile');
    });

    it('should throw error when variant is inactive', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isActive: true,
      });
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        isActive: false,
      });

      await expect(
        wishlistService.addItem('cust-1', {
          productId: 'prod-1',
          variantId: 'var-1',
        })
      ).rejects.toThrow('Variante non trovata o non disponibile');
    });

    it('should create new wishlist item', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isActive: true,
      });
      const mockItem = {
        id: 'item-1',
        customerId: 'cust-1',
        productId: 'prod-1',
        variantId: null,
        notifyRestock: false,
      };
      mockPrisma.wishlistItem.upsert.mockResolvedValue(mockItem);

      const result = await wishlistService.addItem('cust-1', {
        productId: 'prod-1',
      });

      expect(result).toEqual(mockItem);
      expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalledWith({
        where: {
          customerId_productId_variantId: {
            customerId: 'cust-1',
            productId: 'prod-1',
            variantId: '',
          },
        },
        create: expect.objectContaining({
          customerId: 'cust-1',
          productId: 'prod-1',
          notifyRestock: false,
        }),
        update: expect.objectContaining({
          notifyRestock: false,
        }),
        include: expect.any(Object),
      });
    });

    it('should create item with variant and restock notification', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isActive: true,
      });
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        isActive: true,
      });
      mockPrisma.wishlistItem.upsert.mockResolvedValue({});

      await wishlistService.addItem('cust-1', {
        productId: 'prod-1',
        variantId: 'var-1',
        notifyRestock: true,
      });

      expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalledWith({
        where: {
          customerId_productId_variantId: {
            customerId: 'cust-1',
            productId: 'prod-1',
            variantId: 'var-1',
          },
        },
        create: expect.objectContaining({
          variantId: 'var-1',
          notifyRestock: true,
        }),
        update: expect.objectContaining({
          notifyRestock: true,
        }),
        include: expect.any(Object),
      });
    });
  });

  // ===================
  // removeItem
  // ===================
  describe('removeItem', () => {
    it('should remove item by productId', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      await wishlistService.removeItem('cust-1', 'prod-1');

      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          productId: 'prod-1',
          variantId: null,
        },
      });
    });

    it('should remove item by productId and variantId', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      await wishlistService.removeItem('cust-1', 'prod-1', 'var-1');

      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          productId: 'prod-1',
          variantId: 'var-1',
        },
      });
    });
  });

  // ===================
  // removeItemById
  // ===================
  describe('removeItemById', () => {
    it('should remove item by id and customerId', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      await wishlistService.removeItemById('cust-1', 'item-1');

      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'item-1',
          customerId: 'cust-1',
        },
      });
    });
  });

  // ===================
  // clearWishlist
  // ===================
  describe('clearWishlist', () => {
    it('should remove all items for customer', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 5 });

      await wishlistService.clearWishlist('cust-1');

      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
      });
    });
  });

  // ===================
  // isInWishlist
  // ===================
  describe('isInWishlist', () => {
    it('should return true when item exists', async () => {
      mockPrisma.wishlistItem.findFirst.mockResolvedValue({ id: 'item-1' });

      const result = await wishlistService.isInWishlist('cust-1', 'prod-1');

      expect(result).toBe(true);
    });

    it('should return false when item does not exist', async () => {
      mockPrisma.wishlistItem.findFirst.mockResolvedValue(null);

      const result = await wishlistService.isInWishlist('cust-1', 'prod-1');

      expect(result).toBe(false);
    });

    it('should check by variantId when provided', async () => {
      mockPrisma.wishlistItem.findFirst.mockResolvedValue(null);

      await wishlistService.isInWishlist('cust-1', 'prod-1', 'var-1');

      expect(mockPrisma.wishlistItem.findFirst).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          productId: 'prod-1',
          variantId: 'var-1',
        },
      });
    });
  });

  // ===================
  // toggleItem
  // ===================
  describe('toggleItem', () => {
    it('should remove item when it exists', async () => {
      mockPrisma.wishlistItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await wishlistService.toggleItem('cust-1', 'prod-1');

      expect(result).toEqual({ added: false });
      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalled();
    });

    it('should add item when it does not exist', async () => {
      mockPrisma.wishlistItem.findFirst.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true });
      mockPrisma.wishlistItem.upsert.mockResolvedValue({});

      const result = await wishlistService.toggleItem('cust-1', 'prod-1');

      expect(result).toEqual({ added: true });
      expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalled();
    });
  });

  // ===================
  // setRestockNotification
  // ===================
  describe('setRestockNotification', () => {
    it('should enable restock notification', async () => {
      mockPrisma.wishlistItem.update.mockResolvedValue({
        id: 'item-1',
        notifyRestock: true,
      });

      const result = await wishlistService.setRestockNotification(
        'cust-1',
        'item-1',
        true
      );

      expect(result.notifyRestock).toBe(true);
      expect(mockPrisma.wishlistItem.update).toHaveBeenCalledWith({
        where: {
          id: 'item-1',
          customerId: 'cust-1',
        },
        data: { notifyRestock: true },
        include: expect.any(Object),
      });
    });

    it('should disable restock notification', async () => {
      mockPrisma.wishlistItem.update.mockResolvedValue({
        id: 'item-1',
        notifyRestock: false,
      });

      const result = await wishlistService.setRestockNotification(
        'cust-1',
        'item-1',
        false
      );

      expect(result.notifyRestock).toBe(false);
    });
  });

  // ===================
  // getCount
  // ===================
  describe('getCount', () => {
    it('should return count of wishlist items', async () => {
      mockPrisma.wishlistItem.count.mockResolvedValue(10);

      const result = await wishlistService.getCount('cust-1');

      expect(result).toBe(10);
      expect(mockPrisma.wishlistItem.count).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
      });
    });
  });

  // ===================
  // moveAllToCart
  // ===================
  describe('moveAllToCart', () => {
    it('should move in-stock items to cart', async () => {
      const mockItems = [
        {
          id: 'item-1',
          productId: 'prod-1',
          variantId: null,
          product: { sku: 'SKU-1', wcStockStatus: 'instock', name: 'Product 1' },
        },
        {
          id: 'item-2',
          productId: 'prod-2',
          variantId: 'var-1',
          product: { sku: 'SKU-2', wcStockStatus: 'instock', name: 'Product 2' },
        },
      ];
      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);
      mockCartService.addItem.mockResolvedValue({});
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await wishlistService.moveAllToCart('cust-1', 'cart-1');

      expect(result.moved).toBe(2);
      expect(result.outOfStock).toEqual([]);
      expect(mockCartService.addItem).toHaveBeenCalledTimes(2);
    });

    it('should skip out-of-stock items', async () => {
      const mockItems = [
        {
          id: 'item-1',
          productId: 'prod-1',
          variantId: null,
          product: { sku: 'SKU-1', wcStockStatus: 'outofstock', name: 'Out of Stock Product' },
        },
      ];
      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);

      const result = await wishlistService.moveAllToCart('cust-1', 'cart-1');

      expect(result.moved).toBe(0);
      expect(result.outOfStock).toEqual(['Out of Stock Product']);
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });

    it('should handle cart add errors', async () => {
      const mockItems = [
        {
          id: 'item-1',
          productId: 'prod-1',
          variantId: null,
          product: { sku: 'SKU-1', wcStockStatus: 'instock', name: 'Product 1' },
        },
      ];
      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);
      mockCartService.addItem.mockRejectedValue(new Error('Cart error'));

      const result = await wishlistService.moveAllToCart('cust-1', 'cart-1');

      expect(result.moved).toBe(0);
      expect(result.outOfStock).toEqual(['Product 1']);
    });
  });

  // ===================
  // getCustomersToNotify
  // ===================
  describe('getCustomersToNotify', () => {
    it('should return customer IDs with restock notification enabled', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([
        { customerId: 'cust-1' },
        { customerId: 'cust-2' },
      ]);

      const result = await wishlistService.getCustomersToNotify('prod-1');

      expect(result).toEqual(['cust-1', 'cust-2']);
      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-1',
          variantId: null,
          notifyRestock: true,
        },
        select: { customerId: true },
      });
    });

    it('should filter by variantId when provided', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);

      await wishlistService.getCustomersToNotify('prod-1', 'var-1');

      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-1',
          variantId: 'var-1',
          notifyRestock: true,
        },
        select: { customerId: true },
      });
    });
  });

  // ===================
  // processRestockNotifications
  // ===================
  describe('processRestockNotifications', () => {
    it('should return 0 when no customers to notify', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);

      const result = await wishlistService.processRestockNotifications('prod-1');

      expect(result).toBe(0);
      expect(mockPrisma.wishlistItem.updateMany).not.toHaveBeenCalled();
    });

    it('should process notifications and clear flags', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([
        { customerId: 'cust-1' },
        { customerId: 'cust-2' },
      ]);
      mockPrisma.wishlistItem.updateMany.mockResolvedValue({ count: 2 });

      const result = await wishlistService.processRestockNotifications('prod-1');

      expect(result).toBe(2);
      expect(mockPrisma.wishlistItem.updateMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-1',
          variantId: null,
          notifyRestock: true,
        },
        data: { notifyRestock: false },
      });
    });
  });

  // ===================
  // getProductStats
  // ===================
  describe('getProductStats', () => {
    it('should return product wishlist statistics', async () => {
      mockPrisma.wishlistItem.count
        .mockResolvedValueOnce(50)  // totalWishlists
        .mockResolvedValueOnce(20); // withNotifications

      const result = await wishlistService.getProductStats('prod-1');

      expect(result).toEqual({
        totalWishlists: 50,
        withNotifications: 20,
      });
    });
  });

  // ===================
  // getMostWanted
  // ===================
  describe('getMostWanted', () => {
    it('should return most wanted products', async () => {
      mockPrisma.wishlistItem.groupBy.mockResolvedValue([
        { productId: 'prod-1', _count: { productId: 100 } },
        { productId: 'prod-2', _count: { productId: 50 } },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Popular Product' },
        { id: 'prod-2', name: 'Less Popular' },
      ]);

      const result = await wishlistService.getMostWanted(10);

      expect(result).toEqual([
        { productId: 'prod-1', productName: 'Popular Product', count: 100 },
        { productId: 'prod-2', productName: 'Less Popular', count: 50 },
      ]);
    });

    it('should use default limit of 10', async () => {
      mockPrisma.wishlistItem.groupBy.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await wishlistService.getMostWanted();

      expect(mockPrisma.wishlistItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should handle unknown product names', async () => {
      mockPrisma.wishlistItem.groupBy.mockResolvedValue([
        { productId: 'prod-deleted', _count: { productId: 10 } },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await wishlistService.getMostWanted(5);

      expect(result[0].productName).toBe('Unknown');
    });
  });
});
