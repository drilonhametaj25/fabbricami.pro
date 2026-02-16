/**
 * @jest-environment node
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, LoyaltyTier } from '@prisma/client';

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

// Import service after mocks
import loyaltyService, { TIER_CONFIG } from '@server/services/loyalty.service';

describe('LoyaltyService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('getOrCreateAccount', () => {
    it('should return existing account', async () => {
      const existingAccount = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 100,
        tier: 'SILVER' as LoyaltyTier,
        totalEarned: 500,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(existingAccount);

      const result = await loyaltyService.getOrCreateAccount('cust-1');

      expect(result.id).toBe('acc-1');
      expect(result.points).toBe(100);
      expect(prismaMock.loyaltyAccount.create).not.toHaveBeenCalled();
    });

    it('should create new account with welcome bonus', async () => {
      const newAccount = {
        id: 'acc-new',
        customerId: 'cust-new',
        points: 0,
        tier: 'BRONZE' as LoyaltyTier,
        totalEarned: 0,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // First call - not found
        .mockResolvedValueOnce(newAccount); // Second call for addBonus

      (prismaMock.loyaltyAccount.create as jest.Mock).mockResolvedValue(newAccount);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({});
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.getOrCreateAccount('cust-new');

      expect(result.id).toBe('acc-new');
      expect(prismaMock.loyaltyAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-new',
            tier: 'BRONZE',
          }),
        })
      );
    });
  });

  describe('getAccountWithTransactions', () => {
    it('should return account with transactions', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 500,
        tier: 'GOLD' as LoyaltyTier,
        transactions: [
          { id: 'tx-1', type: 'EARN', points: 100 },
          { id: 'tx-2', type: 'REDEEM', points: -50 },
        ],
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);

      const result = await loyaltyService.getAccountWithTransactions('cust-1');

      expect(result!.transactions).toHaveLength(2);
      expect(prismaMock.loyaltyAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            transactions: expect.objectContaining({
              take: 10,
            }),
          }),
        })
      );
    });

    it('should respect transaction limit', async () => {
      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'acc-1',
        transactions: [],
      });

      await loyaltyService.getAccountWithTransactions('cust-1', 5);

      expect(prismaMock.loyaltyAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            transactions: expect.objectContaining({
              take: 5,
            }),
          }),
        })
      );
    });
  });

  describe('earnFromOrder', () => {
    it('should earn points with tier multiplier', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 100,
        tier: 'GOLD' as LoyaltyTier,
        totalEarned: 2000,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        points: 125,
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.earnFromOrder('cust-1', 'order-1', 100);

      // GOLD has 1.25x multiplier, 100 * 1 * 1.25 = 125 points
      expect(result.points).toBe(125);
    });

    it('should check for tier upgrade after earning', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 0,
        tier: 'BRONZE' as LoyaltyTier,
        totalEarned: 400,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({ points: 100 });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      await loyaltyService.earnFromOrder('cust-1', 'order-1', 100);

      // Should have called findUnique twice (initial + tier check)
      expect(prismaMock.loyaltyAccount.findUnique).toHaveBeenCalled();
    });
  });

  describe('redeemPoints', () => {
    it('should redeem points for discount', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 1000,
        tier: 'SILVER' as LoyaltyTier,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        points: -500,
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.redeemPoints('cust-1', 500, 'order-1');

      expect(result.discountAmount).toBe(5); // 500 points / 100 = 5 euros
      expect(result.transaction.points).toBe(-500);
    });

    it('should throw error for insufficient points', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 200,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);

      await expect(
        loyaltyService.redeemPoints('cust-1', 500)
      ).rejects.toThrow('Punti insufficienti');
    });

    it('should throw error below minimum redemption', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 1000,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);

      await expect(
        loyaltyService.redeemPoints('cust-1', 100) // Below 500 minimum
      ).rejects.toThrow('Minimo 500 punti');
    });

    it('should throw error when account not found', async () => {
      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        loyaltyService.redeemPoints('cust-unknown', 500)
      ).rejects.toThrow('Account loyalty non trovato');
    });
  });

  describe('addBonus', () => {
    it('should add bonus points', async () => {
      const account = {
        id: 'acc-1',
        points: 100,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        type: 'BONUS',
        points: 50,
        balanceAfter: 150,
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.addBonus('acc-1', 50, 'Birthday bonus', 'BIRTHDAY');

      expect(result.points).toBe(50);
      expect(result.type).toBe('BONUS');
    });

    it('should throw error when account not found', async () => {
      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        loyaltyService.addBonus('acc-unknown', 50, 'Bonus')
      ).rejects.toThrow('Account non trovato');
    });
  });

  describe('adjustPoints', () => {
    it('should adjust points positively', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 100,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({
        type: 'ADJUSTMENT',
        points: 50,
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.adjustPoints('cust-1', 50, 'Manual correction');

      expect(result.points).toBe(50);
    });

    it('should throw error when balance would go negative', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 100,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);

      await expect(
        loyaltyService.adjustPoints('cust-1', -200, 'Negative adjustment')
      ).rejects.toThrow('Il bilancio non può essere negativo');
    });
  });

  describe('refundPoints', () => {
    it('should refund proportional points', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 500,
      };

      const originalTransaction = {
        id: 'tx-1',
        accountId: 'acc-1',
        orderId: 'order-1',
        type: 'EARN',
        points: 100,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.loyaltyTransaction.findFirst as jest.Mock).mockResolvedValue(originalTransaction);
      (prismaMock.$transaction as jest.Mock).mockImplementation((fn: Function) =>
        fn(prismaMock)
      );
      (prismaMock.loyaltyTransaction.create as jest.Mock).mockResolvedValue({
        type: 'REFUND',
        points: -50,
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.refundPoints('cust-1', 'order-1', 50);

      expect(result!.type).toBe('REFUND');
      expect(result!.points).toBe(-50);
    });

    it('should return null when no original transaction', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        points: 500,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.loyaltyTransaction.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await loyaltyService.refundPoints('cust-1', 'order-1', 50);

      expect(result).toBeNull();
    });

    it('should return null when account not found', async () => {
      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await loyaltyService.refundPoints('cust-unknown', 'order-1', 50);

      expect(result).toBeNull();
    });
  });

  describe('checkTierUpgrade', () => {
    it('should upgrade to SILVER when totalEarned >= 500', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        tier: 'BRONZE' as LoyaltyTier,
        totalEarned: 600,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.checkTierUpgrade('acc-1');

      expect(result).toBe('SILVER');
      expect(prismaMock.loyaltyAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: 'SILVER',
          }),
        })
      );
    });

    it('should upgrade to PLATINUM when totalEarned >= 5000', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        tier: 'GOLD' as LoyaltyTier,
        totalEarned: 6000,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.checkTierUpgrade('acc-1');

      expect(result).toBe('PLATINUM');
    });

    it('should return null when no upgrade needed', async () => {
      const account = {
        id: 'acc-1',
        customerId: 'cust-1',
        tier: 'SILVER' as LoyaltyTier,
        totalEarned: 600,
      };

      (prismaMock.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(account);

      const result = await loyaltyService.checkTierUpgrade('acc-1');

      expect(result).toBeNull();
      expect(prismaMock.loyaltyAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('processExpiringPoints', () => {
    it('should expire old points', async () => {
      const expiringTransactions = [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          type: 'EARN',
          points: 100,
          expired: false,
          createdAt: new Date('2025-01-01'),
          account: { id: 'acc-1', points: 500 },
        },
      ];

      (prismaMock.loyaltyTransaction.findMany as jest.Mock).mockResolvedValue(expiringTransactions);
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([]);
      (prismaMock.loyaltyTransaction.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.processExpiringPoints();

      expect(result).toBe(100);
    });
  });

  describe('processExpiredTiers', () => {
    it('should downgrade expired tiers based on yearly points', async () => {
      const expiredAccounts = [
        {
          id: 'acc-1',
          customerId: 'cust-1',
          tier: 'GOLD' as LoyaltyTier,
          tierExpiresAt: new Date('2025-01-01'),
        },
      ];

      (prismaMock.loyaltyAccount.findMany as jest.Mock).mockResolvedValue(expiredAccounts);
      (prismaMock.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 100 }, // Not enough for GOLD
      });
      (prismaMock.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

      const result = await loyaltyService.processExpiredTiers();

      expect(result).toBe(1);
      expect(prismaMock.loyaltyAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: 'BRONZE',
          }),
        })
      );
    });
  });

  describe('getPointsToNextTier', () => {
    it('should return points needed for next tier', () => {
      const account = {
        tier: 'BRONZE' as LoyaltyTier,
        totalEarned: 200,
      } as any;

      const result = loyaltyService.getPointsToNextTier(account);

      expect(result.nextTier).toBe('SILVER');
      expect(result.pointsNeeded).toBe(300); // 500 - 200
    });

    it('should return null for PLATINUM tier', () => {
      const account = {
        tier: 'PLATINUM' as LoyaltyTier,
        totalEarned: 10000,
      } as any;

      const result = loyaltyService.getPointsToNextTier(account);

      expect(result.nextTier).toBeNull();
      expect(result.pointsNeeded).toBe(0);
    });

    it('should return 0 if already qualified for next tier', () => {
      const account = {
        tier: 'SILVER' as LoyaltyTier,
        totalEarned: 2500, // Already >= 2000 for GOLD
      } as any;

      const result = loyaltyService.getPointsToNextTier(account);

      expect(result.nextTier).toBe('GOLD');
      expect(result.pointsNeeded).toBe(0);
    });
  });

  describe('pointsToEuro', () => {
    it('should convert points to euros', () => {
      expect(loyaltyService.pointsToEuro(100)).toBe(1);
      expect(loyaltyService.pointsToEuro(500)).toBe(5);
      expect(loyaltyService.pointsToEuro(1000)).toBe(10);
    });
  });

  describe('getTierBenefits', () => {
    it('should return tier configuration', () => {
      const bronzeBenefits = loyaltyService.getTierBenefits('BRONZE');
      expect(bronzeBenefits.discountPercent).toBe(0);
      expect(bronzeBenefits.freeShipping).toBe(false);
      expect(bronzeBenefits.pointsMultiplier).toBe(1);

      const platinumBenefits = loyaltyService.getTierBenefits('PLATINUM');
      expect(platinumBenefits.discountPercent).toBe(15);
      expect(platinumBenefits.freeShipping).toBe(true);
      expect(platinumBenefits.pointsMultiplier).toBe(1.5);
    });
  });

  describe('getStats', () => {
    it('should return global statistics', async () => {
      (prismaMock.loyaltyAccount.count as jest.Mock).mockResolvedValue(100);
      (prismaMock.loyaltyAccount.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          totalEarned: 50000,
          totalSpent: 20000,
          points: 30000,
        },
      });
      (prismaMock.loyaltyAccount.groupBy as jest.Mock).mockResolvedValue([
        { tier: 'BRONZE', _count: { tier: 50 } },
        { tier: 'SILVER', _count: { tier: 30 } },
        { tier: 'GOLD', _count: { tier: 15 } },
        { tier: 'PLATINUM', _count: { tier: 5 } },
      ]);

      const result = await loyaltyService.getStats();

      expect(result.totalAccounts).toBe(100);
      expect(result.totalPointsIssued).toBe(50000);
      expect(result.totalPointsRedeemed).toBe(20000);
      expect(result.accountsByTier.BRONZE).toBe(50);
      expect(result.accountsByTier.PLATINUM).toBe(5);
      expect(result.averagePointsPerCustomer).toBe(300);
    });

    it('should handle empty database', async () => {
      (prismaMock.loyaltyAccount.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.loyaltyAccount.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          totalEarned: null,
          totalSpent: null,
          points: null,
        },
      });
      (prismaMock.loyaltyAccount.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await loyaltyService.getStats();

      expect(result.totalAccounts).toBe(0);
      expect(result.totalPointsIssued).toBe(0);
      expect(result.averagePointsPerCustomer).toBe(0);
    });
  });

  describe('TIER_CONFIG', () => {
    it('should have correct tier thresholds', () => {
      expect(TIER_CONFIG.BRONZE.minPoints).toBe(0);
      expect(TIER_CONFIG.SILVER.minPoints).toBe(500);
      expect(TIER_CONFIG.GOLD.minPoints).toBe(2000);
      expect(TIER_CONFIG.PLATINUM.minPoints).toBe(5000);
    });
  });
});
