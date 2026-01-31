import { prisma } from '../config/database';
import { LoyaltyAccount, LoyaltyTransaction, LoyaltyTier } from '@prisma/client';
import logger from '../config/logger';

/**
 * Loyalty account with recent transactions
 */
export interface LoyaltyAccountWithTransactions extends LoyaltyAccount {
  transactions: LoyaltyTransaction[];
}

/**
 * Tier thresholds and benefits
 */
export const TIER_CONFIG = {
  BRONZE: {
    minPoints: 0,
    discountPercent: 0,
    freeShipping: false,
    earlyAccess: false,
    birthdayBonus: 0,
    pointsMultiplier: 1,
  },
  SILVER: {
    minPoints: 500,
    discountPercent: 5,
    freeShipping: false,
    earlyAccess: false,
    birthdayBonus: 50,
    pointsMultiplier: 1.1,
  },
  GOLD: {
    minPoints: 2000,
    discountPercent: 10,
    freeShipping: true,
    earlyAccess: true,
    birthdayBonus: 100,
    pointsMultiplier: 1.25,
  },
  PLATINUM: {
    minPoints: 5000,
    discountPercent: 15,
    freeShipping: true,
    earlyAccess: true,
    birthdayBonus: 200,
    pointsMultiplier: 1.5,
  },
};

/**
 * Points per euro spent
 */
const POINTS_PER_EURO = 1;

/**
 * Points to euro conversion rate (100 points = 1 euro)
 */
const POINTS_TO_EURO_RATE = 100;

/**
 * Minimum points for redemption
 */
const MIN_REDEMPTION_POINTS = 500;

/**
 * Points expiry in months
 */
const POINTS_EXPIRY_MONTHS = 12;

/**
 * Loyalty Service
 * Gestisce punti fedeltà e tier per e-commerce
 */
class LoyaltyService {
  /**
   * Ottiene o crea account loyalty per cliente
   */
  async getOrCreateAccount(customerId: string): Promise<LoyaltyAccount> {
    let account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      account = await prisma.loyaltyAccount.create({
        data: {
          customerId,
          points: 0,
          tier: 'BRONZE',
          totalEarned: 0,
          totalSpent: 0,
          totalOrders: 0,
          totalAmount: 0,
        },
      });

      // Assegna bonus benvenuto
      await this.addBonus(account.id, 50, 'Bonus benvenuto', 'WELCOME');

      logger.info(`Account loyalty creato per cliente ${customerId}`);
    }

    return account;
  }

  /**
   * Ottiene account con transazioni recenti
   */
  async getAccountWithTransactions(
    customerId: string,
    transactionLimit: number = 10
  ): Promise<LoyaltyAccountWithTransactions | null> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: transactionLimit,
        },
      },
    });

    return account as LoyaltyAccountWithTransactions | null;
  }

  /**
   * Guadagna punti da ordine
   */
  async earnFromOrder(
    customerId: string,
    orderId: string,
    orderTotal: number
  ): Promise<LoyaltyTransaction> {
    const account = await this.getOrCreateAccount(customerId);

    // Calcola punti con moltiplicatore tier
    const tierConfig = TIER_CONFIG[account.tier];
    const basePoints = Math.floor(orderTotal * POINTS_PER_EURO);
    const points = Math.floor(basePoints * tierConfig.pointsMultiplier);

    // Calcola data scadenza punti
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + POINTS_EXPIRY_MONTHS);

    const newBalance = account.points + points;

    const transaction = await prisma.$transaction(async (tx) => {
      // Crea transazione
      const txn = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          orderId,
          type: 'EARN',
          points,
          balanceAfter: newBalance,
          description: `Punti da ordine #${orderId}`,
          expiresAt,
        },
      });

      // Aggiorna account
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          totalEarned: { increment: points },
          totalOrders: { increment: 1 },
          totalAmount: { increment: orderTotal },
        },
      });

      return txn;
    });

    // Verifica upgrade tier
    await this.checkTierUpgrade(account.id);

    logger.info(`Cliente ${customerId} ha guadagnato ${points} punti da ordine ${orderId}`);
    return transaction;
  }

  /**
   * Riscatta punti per sconto
   */
  async redeemPoints(
    customerId: string,
    points: number,
    orderId?: string
  ): Promise<{
    transaction: LoyaltyTransaction;
    discountAmount: number;
  }> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      throw new Error('Account loyalty non trovato');
    }

    if (points < MIN_REDEMPTION_POINTS) {
      throw new Error(`Minimo ${MIN_REDEMPTION_POINTS} punti per il riscatto`);
    }

    if (account.points < points) {
      throw new Error(`Punti insufficienti. Disponibili: ${account.points}`);
    }

    const discountAmount = points / POINTS_TO_EURO_RATE;
    const newBalance = account.points - points;

    const transaction = await prisma.$transaction(async (tx) => {
      // Crea transazione
      const txn = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          orderId,
          type: 'REDEEM',
          points: -points,
          balanceAfter: newBalance,
          description: `Sconto €${discountAmount.toFixed(2)}`,
        },
      });

      // Aggiorna account
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          totalSpent: { increment: points },
        },
      });

      return txn;
    });

    logger.info(`Cliente ${customerId} ha riscattato ${points} punti per €${discountAmount}`);

    return { transaction, discountAmount };
  }

  /**
   * Aggiunge bonus punti
   */
  async addBonus(
    accountId: string,
    points: number,
    description: string,
    reference?: string
  ): Promise<LoyaltyTransaction> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account non trovato');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + POINTS_EXPIRY_MONTHS);

    const newBalance = account.points + points;

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.loyaltyTransaction.create({
        data: {
          accountId,
          type: 'BONUS',
          points,
          balanceAfter: newBalance,
          description,
          reference,
          expiresAt,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          points: newBalance,
          totalEarned: { increment: points },
        },
      });

      return txn;
    });

    return transaction;
  }

  /**
   * Aggiustamento manuale punti
   */
  async adjustPoints(
    customerId: string,
    points: number,
    reason: string
  ): Promise<LoyaltyTransaction> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      throw new Error('Account non trovato');
    }

    const newBalance = account.points + points;

    if (newBalance < 0) {
      throw new Error('Il bilancio non può essere negativo');
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: 'ADJUSTMENT',
          points,
          balanceAfter: newBalance,
          description: reason,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          ...(points > 0 && { totalEarned: { increment: points } }),
        },
      });

      return txn;
    });

    logger.info(`Aggiustamento ${points} punti per cliente ${customerId}: ${reason}`);
    return transaction;
  }

  /**
   * Restituisce punti per rimborso
   */
  async refundPoints(
    customerId: string,
    orderId: string,
    amount: number
  ): Promise<LoyaltyTransaction | null> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      return null;
    }

    // Trova transazione originale
    const originalTx = await prisma.loyaltyTransaction.findFirst({
      where: {
        accountId: account.id,
        orderId,
        type: 'EARN',
      },
    });

    if (!originalTx) {
      return null;
    }

    // Calcola punti proporzionali al rimborso
    const refundRatio = amount / Number(originalTx.points);
    const pointsToRefund = Math.floor(originalTx.points * refundRatio);

    if (pointsToRefund <= 0) {
      return null;
    }

    const newBalance = Math.max(0, account.points - pointsToRefund);

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          orderId,
          type: 'REFUND',
          points: -pointsToRefund,
          balanceAfter: newBalance,
          description: `Rimborso ordine #${orderId}`,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newBalance },
      });

      return txn;
    });

    logger.info(`Rimborso ${pointsToRefund} punti per ordine ${orderId}`);
    return transaction;
  }

  /**
   * Verifica e applica upgrade tier
   */
  async checkTierUpgrade(accountId: string): Promise<LoyaltyTier | null> {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return null;
    }

    // Determina tier in base ai punti totali guadagnati
    let newTier: LoyaltyTier = 'BRONZE';

    if (account.totalEarned >= TIER_CONFIG.PLATINUM.minPoints) {
      newTier = 'PLATINUM';
    } else if (account.totalEarned >= TIER_CONFIG.GOLD.minPoints) {
      newTier = 'GOLD';
    } else if (account.totalEarned >= TIER_CONFIG.SILVER.minPoints) {
      newTier = 'SILVER';
    }

    if (newTier !== account.tier) {
      // Imposta scadenza tier (1 anno)
      const tierExpiresAt = new Date();
      tierExpiresAt.setFullYear(tierExpiresAt.getFullYear() + 1);

      await prisma.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          tier: newTier,
          tierExpiresAt,
        },
      });

      logger.info(`Cliente ${account.customerId} promosso a tier ${newTier}`);
      return newTier;
    }

    return null;
  }

  /**
   * Processa punti in scadenza
   */
  async processExpiringPoints(): Promise<number> {
    const now = new Date();

    // Trova transazioni scadute non ancora processate
    const expiringTransactions = await prisma.loyaltyTransaction.findMany({
      where: {
        expiresAt: { lte: now },
        expired: false,
        type: { in: ['EARN', 'BONUS'] },
        points: { gt: 0 },
      },
      include: {
        account: true,
      },
    });

    let totalExpired = 0;

    for (const tx of expiringTransactions) {
      // Verifica che i punti siano ancora disponibili
      const pointsToExpire = Math.min(tx.points, tx.account.points);

      if (pointsToExpire > 0) {
        const newBalance = tx.account.points - pointsToExpire;

        await prisma.$transaction([
          // Crea transazione scadenza
          prisma.loyaltyTransaction.create({
            data: {
              accountId: tx.accountId,
              type: 'EXPIRE',
              points: -pointsToExpire,
              balanceAfter: newBalance,
              description: `Punti scaduti da ${tx.createdAt.toLocaleDateString()}`,
            },
          }),
          // Marca originale come scaduta
          prisma.loyaltyTransaction.update({
            where: { id: tx.id },
            data: { expired: true },
          }),
          // Aggiorna bilancio
          prisma.loyaltyAccount.update({
            where: { id: tx.accountId },
            data: { points: newBalance },
          }),
        ]);

        totalExpired += pointsToExpire;
      } else {
        // Marca come scaduta senza sottrazione
        await prisma.loyaltyTransaction.update({
          where: { id: tx.id },
          data: { expired: true },
        });
      }
    }

    if (totalExpired > 0) {
      logger.info(`Processati ${totalExpired} punti in scadenza`);
    }

    return totalExpired;
  }

  /**
   * Verifica e declassa tier scaduti
   */
  async processExpiredTiers(): Promise<number> {
    const now = new Date();

    const expiredAccounts = await prisma.loyaltyAccount.findMany({
      where: {
        tierExpiresAt: { lte: now },
        tier: { not: 'BRONZE' },
      },
    });

    for (const account of expiredAccounts) {
      // Ricalcola tier in base agli acquisti ultimi 12 mesi
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const yearlyStats = await prisma.loyaltyTransaction.aggregate({
        where: {
          accountId: account.id,
          type: 'EARN',
          createdAt: { gte: oneYearAgo },
        },
        _sum: { points: true },
      });

      const yearlyPoints = yearlyStats._sum.points || 0;

      let newTier: LoyaltyTier = 'BRONZE';
      if (yearlyPoints >= TIER_CONFIG.PLATINUM.minPoints) {
        newTier = 'PLATINUM';
      } else if (yearlyPoints >= TIER_CONFIG.GOLD.minPoints) {
        newTier = 'GOLD';
      } else if (yearlyPoints >= TIER_CONFIG.SILVER.minPoints) {
        newTier = 'SILVER';
      }

      if (newTier !== account.tier) {
        const tierExpiresAt = new Date();
        tierExpiresAt.setFullYear(tierExpiresAt.getFullYear() + 1);

        await prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: {
            tier: newTier,
            tierExpiresAt,
          },
        });

        logger.info(`Cliente ${account.customerId} declassato da ${account.tier} a ${newTier}`);
      }
    }

    return expiredAccounts.length;
  }

  /**
   * Calcola punti necessari per prossimo tier
   */
  getPointsToNextTier(account: LoyaltyAccount): {
    nextTier: LoyaltyTier | null;
    pointsNeeded: number;
  } {
    const tiers: LoyaltyTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const currentIndex = tiers.indexOf(account.tier);

    if (currentIndex === tiers.length - 1) {
      return { nextTier: null, pointsNeeded: 0 };
    }

    const nextTier = tiers[currentIndex + 1];
    const pointsNeeded = TIER_CONFIG[nextTier].minPoints - account.totalEarned;

    return {
      nextTier,
      pointsNeeded: Math.max(0, pointsNeeded),
    };
  }

  /**
   * Converte punti in valore euro
   */
  pointsToEuro(points: number): number {
    return points / POINTS_TO_EURO_RATE;
  }

  /**
   * Ottiene benefits tier
   */
  getTierBenefits(tier: LoyaltyTier) {
    return TIER_CONFIG[tier];
  }

  /**
   * Statistiche loyalty globali
   */
  async getStats(): Promise<{
    totalAccounts: number;
    totalPointsIssued: number;
    totalPointsRedeemed: number;
    accountsByTier: Record<LoyaltyTier, number>;
    averagePointsPerCustomer: number;
  }> {
    const [totalAccounts, aggregates, tierCounts] = await Promise.all([
      prisma.loyaltyAccount.count(),
      prisma.loyaltyAccount.aggregate({
        _sum: {
          totalEarned: true,
          totalSpent: true,
          points: true,
        },
      }),
      prisma.loyaltyAccount.groupBy({
        by: ['tier'],
        _count: { tier: true },
      }),
    ]);

    const accountsByTier: Record<LoyaltyTier, number> = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };

    for (const tc of tierCounts) {
      accountsByTier[tc.tier] = tc._count.tier;
    }

    return {
      totalAccounts,
      totalPointsIssued: aggregates._sum.totalEarned || 0,
      totalPointsRedeemed: aggregates._sum.totalSpent || 0,
      accountsByTier,
      averagePointsPerCustomer: totalAccounts > 0
        ? Math.round((aggregates._sum.points || 0) / totalAccounts)
        : 0,
    };
  }
}

export default new LoyaltyService();
