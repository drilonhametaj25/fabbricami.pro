/**
 * @jest-environment node
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';

// Create prisma mock at module level
const prismaMock = mockDeep<PrismaClient>();

// Mock database config
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

// Helper to create Decimal mock
const createDecimalMock = (value: number | string): Prisma.Decimal => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => numVal.toString(),
  } as unknown as Prisma.Decimal;
};

// Import service after mocks
import couponService from '@server/services/coupon.service';

describe('CouponService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new coupon', async () => {
      const input = {
        code: 'SAVE10',
        name: 'Save 10%',
        type: 'PERCENTAGE' as const,
        discountValue: 10,
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-12-31'),
      };

      const createdCoupon = {
        id: 'coupon-1',
        code: 'SAVE10',
        name: 'Save 10%',
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(10),
        scope: 'ENTIRE_ORDER',
        isActive: true,
        usageCount: 0,
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-12-31'),
      };

      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.coupon.create as jest.Mock).mockResolvedValue(createdCoupon);

      const result = await couponService.create(input);

      expect(result.code).toBe('SAVE10');
      expect(prismaMock.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'SAVE10',
            type: 'PERCENTAGE',
          }),
        })
      );
    });

    it('should throw error for duplicate code', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        code: 'SAVE10',
      });

      await expect(
        couponService.create({
          code: 'save10', // Lowercase should also match
          type: 'FIXED' as const,
          discountValue: 10,
          validFrom: new Date(),
          validTo: new Date(),
        })
      ).rejects.toThrow('Codice coupon già esistente');
    });

    it('should convert code to uppercase', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.coupon.create as jest.Mock).mockResolvedValue({
        id: 'coupon-1',
        code: 'LOWERCASE',
      });

      await couponService.create({
        code: 'lowercase',
        type: 'FIXED' as const,
        discountValue: 5,
        validFrom: new Date(),
        validTo: new Date(),
      });

      expect(prismaMock.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'LOWERCASE',
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update coupon', async () => {
      const updatedCoupon = {
        id: 'coupon-1',
        code: 'SAVE20',
        discountValue: createDecimalMock(20),
      };

      (prismaMock.coupon.update as jest.Mock).mockResolvedValue(updatedCoupon);

      const result = await couponService.update('coupon-1', {
        discountValue: 20,
      });

      expect(result.discountValue.toNumber()).toBe(20);
    });

    it('should check for duplicate code when changing code', async () => {
      (prismaMock.coupon.findFirst as jest.Mock).mockResolvedValue({
        id: 'other-coupon',
        code: 'EXISTING',
      });

      await expect(
        couponService.update('coupon-1', { code: 'EXISTING' })
      ).rejects.toThrow('Codice coupon già esistente');
    });

    it('should allow same code update', async () => {
      (prismaMock.coupon.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.coupon.update as jest.Mock).mockResolvedValue({
        id: 'coupon-1',
        code: 'NEWCODE',
      });

      await couponService.update('coupon-1', { code: 'NEWCODE' });

      expect(prismaMock.coupon.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete coupon', async () => {
      (prismaMock.coupon.delete as jest.Mock).mockResolvedValue({});

      await couponService.delete('coupon-1');

      expect(prismaMock.coupon.delete).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
      });
    });
  });

  describe('getById', () => {
    it('should return coupon by ID', async () => {
      const coupon = { id: 'coupon-1', code: 'SAVE10' };
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(coupon);

      const result = await couponService.getById('coupon-1');

      expect(result!.code).toBe('SAVE10');
    });

    it('should return null when not found', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await couponService.getById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('getByCode', () => {
    it('should return coupon by code (case insensitive)', async () => {
      const coupon = { id: 'coupon-1', code: 'SAVE10' };
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(coupon);

      const result = await couponService.getByCode('save10');

      expect(result!.code).toBe('SAVE10');
      expect(prismaMock.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE10' },
      });
    });
  });

  describe('list', () => {
    it('should return paginated coupons', async () => {
      const coupons = [
        { id: 'coupon-1', code: 'SAVE10' },
        { id: 'coupon-2', code: 'SAVE20' },
      ];

      (prismaMock.coupon.findMany as jest.Mock).mockResolvedValue(coupons);
      (prismaMock.coupon.count as jest.Mock).mockResolvedValue(2);

      const result = await couponService.list({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by search term', async () => {
      (prismaMock.coupon.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.coupon.count as jest.Mock).mockResolvedValue(0);

      await couponService.list({ search: 'SAVE' });

      expect(prismaMock.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ code: { contains: 'SAVE', mode: 'insensitive' } }),
            ]),
          }),
        })
      );
    });

    it('should filter by type and scope', async () => {
      (prismaMock.coupon.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.coupon.count as jest.Mock).mockResolvedValue(0);

      await couponService.list({
        type: 'PERCENTAGE' as any,
        scope: 'PRODUCT' as any,
        isActive: true,
      });

      expect(prismaMock.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'PERCENTAGE',
            scope: 'PRODUCT',
            isActive: true,
          }),
        })
      );
    });
  });

  describe('validateCoupon', () => {
    const cartItems = [
      { productId: 'prod-1', categoryId: 'cat-1', quantity: 2, unitPrice: 50 },
    ];

    it('should return error for non-existent coupon', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await couponService.validateCoupon('INVALID', null, cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon non trovato');
    });

    it('should return error for inactive coupon', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'INACTIVE',
        isActive: false,
      });

      const result = await couponService.validateCoupon('INACTIVE', null, cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon non attivo');
    });

    it('should return error for not yet valid coupon', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'FUTURE',
        isActive: true,
        validFrom: new Date(Date.now() + 86400000), // Tomorrow
        validTo: new Date(Date.now() + 172800000),
      });

      const result = await couponService.validateCoupon('FUTURE', null, cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon non ancora valido');
    });

    it('should return error for expired coupon', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'EXPIRED',
        isActive: true,
        validFrom: new Date(Date.now() - 172800000),
        validTo: new Date(Date.now() - 86400000), // Yesterday
      });

      const result = await couponService.validateCoupon('EXPIRED', null, cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon scaduto');
    });

    it('should return error when max uses exhausted', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'EXHAUSTED',
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        maxUses: 10,
        usageCount: 10,
      });

      const result = await couponService.validateCoupon('EXHAUSTED', null, cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon esaurito');
    });

    it('should return error when per-customer limit reached', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'LIMITED',
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        maxUses: null,
        usageCount: 5,
        maxUsesPerCustomer: 1,
      });

      (prismaMock.couponUsage.count as jest.Mock).mockResolvedValue(1);

      const result = await couponService.validateCoupon('LIMITED', 'cust-1', cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('già utilizzato');
    });

    it('should return error when customer tier not allowed', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'GOLD_ONLY',
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        maxUses: null,
        usageCount: 0,
        customerTiers: ['GOLD', 'PLATINUM'],
      });

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue({
        tier: 'BRONZE',
      });

      const result = await couponService.validateCoupon('GOLD_ONLY', 'cust-1', cartItems, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('tier superiore');
    });

    it('should return error when below minimum order', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue({
        code: 'MIN50',
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        maxUses: null,
        usageCount: 0,
        minimumOrderAmount: createDecimalMock(50),
      });

      const result = await couponService.validateCoupon('MIN50', null, cartItems, 30);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Ordine minimo');
    });

    it('should validate successfully and calculate discount', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'SAVE10',
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        maxUses: null,
        usageCount: 0,
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(10),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: null,
      };

      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(coupon);

      const result = await couponService.validateCoupon('SAVE10', null, cartItems, 100);

      expect(result.valid).toBe(true);
      expect(result.coupon).toBeDefined();
      expect(result.discount).toBe(10); // 10% of 100
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate FIXED discount', () => {
      const coupon = {
        type: 'FIXED',
        discountValue: createDecimalMock(15),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: null,
      } as any;

      const cartItems = [{ productId: 'p1', quantity: 2, unitPrice: 50 }];

      const discount = couponService.calculateDiscount(coupon, cartItems, 100);

      expect(discount).toBe(15);
    });

    it('should calculate PERCENTAGE discount', () => {
      const coupon = {
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(20),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: null,
      } as any;

      const cartItems = [{ productId: 'p1', quantity: 2, unitPrice: 50 }];

      const discount = couponService.calculateDiscount(coupon, cartItems, 100);

      expect(discount).toBe(20); // 20% of 100
    });

    it('should apply maximum discount cap', () => {
      const coupon = {
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(50),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: createDecimalMock(25),
      } as any;

      const cartItems = [{ productId: 'p1', quantity: 1, unitPrice: 100 }];

      const discount = couponService.calculateDiscount(coupon, cartItems, 100);

      expect(discount).toBe(25); // Capped at 25
    });

    it('should calculate PRODUCT scope discount', () => {
      const coupon = {
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(10),
        scope: 'PRODUCT',
        applicableIds: ['prod-1'],
        excludedIds: [],
        maximumDiscount: null,
      } as any;

      const cartItems = [
        { productId: 'prod-1', quantity: 1, unitPrice: 50 },
        { productId: 'prod-2', quantity: 1, unitPrice: 50 },
      ];

      const discount = couponService.calculateDiscount(coupon, cartItems, 100);

      expect(discount).toBe(5); // 10% of 50 (only prod-1)
    });

    it('should calculate CATEGORY scope discount', () => {
      const coupon = {
        type: 'FIXED',
        discountValue: createDecimalMock(10),
        scope: 'CATEGORY',
        applicableIds: ['cat-1'],
        excludedIds: [],
        maximumDiscount: null,
      } as any;

      const cartItems = [
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 50 },
        { productId: 'prod-2', categoryId: 'cat-2', quantity: 1, unitPrice: 50 },
      ];

      const discount = couponService.calculateDiscount(coupon, cartItems, 100);

      expect(discount).toBe(10); // Fixed 10 for cat-1 items
    });

    it('should return 0 for FREE_SHIPPING type', () => {
      const coupon = {
        type: 'FREE_SHIPPING',
        discountValue: createDecimalMock(0),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: null,
      } as any;

      const discount = couponService.calculateDiscount(coupon, [], 100);

      expect(discount).toBe(0);
    });

    it('should not exceed applicable amount for FIXED', () => {
      const coupon = {
        type: 'FIXED',
        discountValue: createDecimalMock(100),
        scope: 'ENTIRE_ORDER',
        maximumDiscount: null,
      } as any;

      const discount = couponService.calculateDiscount(coupon, [], 50);

      expect(discount).toBe(50); // Cannot exceed subtotal
    });
  });

  describe('recordUsage', () => {
    it('should create usage record and increment counter', async () => {
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await couponService.recordUsage('coupon-1', 'cust-1', 'order-1', 15);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      // Verify the operations were called within transaction
      expect(prismaMock.couponUsage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            couponId: 'coupon-1',
            customerId: 'cust-1',
            orderId: 'order-1',
            discountAmount: 15,
          }),
        })
      );
      expect(prismaMock.coupon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'coupon-1' },
          data: { usageCount: { increment: 1 } },
        })
      );
    });
  });

  describe('generateCode', () => {
    it('should generate alphanumeric code of default length', () => {
      const code = couponService.generateCode();

      expect(code).toHaveLength(8);
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
    });

    it('should generate code of specified length', () => {
      const code = couponService.generateCode(12);

      expect(code).toHaveLength(12);
    });

    it('should generate unique codes', () => {
      const code1 = couponService.generateCode();
      const code2 = couponService.generateCode();

      // Very unlikely to be the same
      expect(code1).not.toBe(code2);
    });
  });

  describe('generateBulk', () => {
    it('should generate multiple coupons', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.coupon.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'c1', code: 'PREFIX12345678' })
        .mockResolvedValueOnce({ id: 'c2', code: 'PREFIX87654321' });

      const result = await couponService.generateBulk(
        {
          type: 'FIXED' as const,
          discountValue: 10,
          validFrom: new Date(),
          validTo: new Date(),
        },
        2,
        'PREFIX'
      );

      expect(result).toHaveLength(2);
    });

    it('should skip duplicate codes', async () => {
      (prismaMock.coupon.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing' }) // First code exists
        .mockResolvedValueOnce(null); // Second is unique

      (prismaMock.coupon.create as jest.Mock).mockResolvedValue({
        id: 'new-coupon',
        code: 'UNIQUE123',
      });

      const result = await couponService.generateBulk(
        {
          type: 'PERCENTAGE' as const,
          discountValue: 15,
          validFrom: new Date(),
          validTo: new Date(),
        },
        2
      );

      // One skipped due to duplicate, one created
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStats', () => {
    it('should return coupon statistics', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'SAVE10',
        name: 'Save 10%',
        type: 'PERCENTAGE',
        discountValue: createDecimalMock(10),
        isActive: true,
        usageCount: 5,
        maxUses: 100,
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-12-31'),
        usages: [
          { discountAmount: createDecimalMock(10), usedAt: new Date('2026-02-01') },
          { discountAmount: createDecimalMock(15), usedAt: new Date('2026-02-01') },
          { discountAmount: createDecimalMock(20), usedAt: new Date('2026-02-02') },
        ],
      };

      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(coupon);

      const result = await couponService.getStats('coupon-1');

      expect(result.coupon.code).toBe('SAVE10');
      expect(result.stats.totalUses).toBe(5);
      expect(result.stats.totalDiscount).toBe(45);
      expect(result.stats.averageDiscount).toBe(9); // 45 / 5
    });

    it('should throw error when coupon not found', async () => {
      (prismaMock.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(couponService.getStats('unknown')).rejects.toThrow('Coupon non trovato');
    });
  });

  describe('deactivateExpired', () => {
    it('should deactivate expired coupons', async () => {
      (prismaMock.coupon.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await couponService.deactivateExpired();

      expect(result).toBe(5);
      expect(prismaMock.coupon.updateMany).toHaveBeenCalledWith({
        where: {
          validTo: { lt: expect.any(Date) },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    });
  });
});
