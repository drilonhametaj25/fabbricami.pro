import { prisma } from '../config/database';
import { Prisma, ProductReview, ReviewStatus } from '@prisma/client';
import logger from '../config/logger';

/**
 * Review with customer and product details
 */
export interface ReviewWithDetails extends ProductReview {
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    mainImageUrl: string | null;
  };
}

/**
 * Create review input
 */
export interface CreateReviewInput {
  productId: string;
  customerId: string;
  orderId?: string;
  orderItemId?: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string[];
  cons?: string[];
  images?: Array<{ url: string; thumbnail?: string }>;
}

/**
 * Update review input
 */
export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  comment?: string;
  pros?: string[];
  cons?: string[];
  images?: Array<{ url: string; thumbnail?: string }>;
}

/**
 * Review statistics
 */
export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  verifiedReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

/**
 * Review list parameters
 */
export interface ReviewListParams {
  page?: number;
  limit?: number;
  productId?: string;
  customerId?: string;
  status?: ReviewStatus;
  minRating?: number;
  verified?: boolean;
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product Review Service
 * Gestisce recensioni prodotti per e-commerce
 */
class ReviewService {
  /**
   * Crea nuova recensione
   */
  async create(input: CreateReviewInput): Promise<ProductReview> {
    const { rating, productId, customerId, orderId, orderItemId, ...rest } = input;

    // Valida rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating deve essere tra 1 e 5');
    }

    // Verifica che il cliente non abbia già recensito questo prodotto/ordine
    const existingReview = await prisma.productReview.findFirst({
      where: {
        productId,
        customerId,
        orderId: orderId || null,
      },
    });

    if (existingReview) {
      throw new Error('Hai già recensito questo prodotto');
    }

    // Verifica acquisto se orderId fornito
    let verified = false;
    if (orderId) {
      const orderItem = await prisma.orderItem.findFirst({
        where: {
          orderId,
          productId,
          order: {
            customerId,
            status: { in: ['SHIPPED', 'DELIVERED'] },
          },
        },
      });
      verified = !!orderItem;
    }

    const review = await prisma.productReview.create({
      data: {
        productId,
        customerId,
        orderId,
        orderItemId,
        rating,
        title: rest.title,
        comment: rest.comment,
        pros: rest.pros,
        cons: rest.cons,
        images: rest.images,
        verified,
        status: 'PENDING', // Richiede moderazione
      },
    });

    logger.info(`Nuova recensione creata per prodotto ${productId} da cliente ${customerId}`);

    // Aggiorna statistiche prodotto in background
    this.updateProductStats(productId).catch(err =>
      logger.error(`Errore aggiornamento stats prodotto: ${err}`)
    );

    return review;
  }

  /**
   * Aggiorna recensione (solo autore)
   */
  async update(
    id: string,
    customerId: string,
    input: UpdateReviewInput
  ): Promise<ProductReview> {
    const review = await prisma.productReview.findFirst({
      where: { id, customerId },
    });

    if (!review) {
      throw new Error('Recensione non trovata');
    }

    // Se era approvata, torna in pending dopo modifica
    const newStatus = review.status === 'APPROVED' ? 'PENDING' : review.status;

    const updated = await prisma.productReview.update({
      where: { id },
      data: {
        ...input,
        status: newStatus,
      },
    });

    return updated;
  }

  /**
   * Elimina recensione (solo autore o admin)
   */
  async delete(id: string, customerId?: string): Promise<void> {
    const where: Prisma.ProductReviewWhereInput = { id };
    if (customerId) {
      where.customerId = customerId;
    }

    const review = await prisma.productReview.findFirst({ where });
    if (!review) {
      throw new Error('Recensione non trovata');
    }

    await prisma.productReview.delete({ where: { id } });

    // Aggiorna statistiche prodotto
    await this.updateProductStats(review.productId);

    logger.info(`Recensione ${id} eliminata`);
  }

  /**
   * Lista recensioni con filtri
   */
  async list(params: ReviewListParams): Promise<{
    items: ReviewWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 20,
      productId,
      customerId,
      status,
      minRating,
      verified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ProductReviewWhereInput = {};

    if (productId) where.productId = productId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (minRating) where.rating = { gte: minRating };
    if (verified !== undefined) where.verified = verified;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              mainImageUrl: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.productReview.count({ where }),
    ]);

    return {
      items: items as ReviewWithDetails[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Ottiene recensioni pubbliche per prodotto
   */
  async getProductReviews(
    productId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    items: ReviewWithDetails[];
    stats: ReviewStats;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [result, stats] = await Promise.all([
      this.list({
        productId,
        status: 'APPROVED',
        page,
        limit,
        sortBy: 'helpfulCount',
        sortOrder: 'desc',
      }),
      this.getProductStats(productId),
    ]);

    return {
      ...result,
      stats,
    };
  }

  /**
   * Ottiene statistiche recensioni prodotto
   */
  async getProductStats(productId: string): Promise<ReviewStats> {
    const reviews = await prisma.productReview.findMany({
      where: {
        productId,
        status: 'APPROVED',
      },
      select: {
        rating: true,
        verified: true,
      },
    });

    const totalReviews = reviews.length;
    const verifiedReviews = reviews.filter(r => r.verified).length;

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRating = 0;
    for (const review of reviews) {
      totalRating += review.rating;
      ratingDistribution[review.rating as 1 | 2 | 3 | 4 | 5]++;
    }

    const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      verifiedReviews,
      ratingDistribution,
    };
  }

  /**
   * Aggiorna statistiche WC del prodotto
   */
  private async updateProductStats(productId: string): Promise<void> {
    const stats = await this.getProductStats(productId);

    await prisma.product.update({
      where: { id: productId },
      data: {
        wcAverageRating: stats.averageRating,
        wcRatingCount: stats.totalReviews,
      },
    });
  }

  // ==================
  // MODERATION
  // ==================

  /**
   * Approva recensione
   */
  async approve(id: string, moderatorId: string): Promise<ProductReview> {
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        status: 'APPROVED',
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      },
    });

    await this.updateProductStats(review.productId);

    logger.info(`Recensione ${id} approvata da ${moderatorId}`);
    return review;
  }

  /**
   * Rifiuta recensione
   */
  async reject(
    id: string,
    moderatorId: string,
    reason?: string
  ): Promise<ProductReview> {
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        status: 'REJECTED',
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationNote: reason,
      },
    });

    logger.info(`Recensione ${id} rifiutata da ${moderatorId}`);
    return review;
  }

  /**
   * Marca come spam
   */
  async markAsSpam(id: string, moderatorId: string): Promise<ProductReview> {
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        status: 'SPAM',
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      },
    });

    logger.info(`Recensione ${id} marcata come spam da ${moderatorId}`);
    return review;
  }

  /**
   * Conta recensioni in attesa
   */
  async getPendingCount(): Promise<number> {
    return prisma.productReview.count({
      where: { status: 'PENDING' },
    });
  }

  // ==================
  // HELPFULNESS
  // ==================

  /**
   * Segna recensione come utile
   */
  async markHelpful(id: string): Promise<void> {
    await prisma.productReview.update({
      where: { id },
      data: {
        helpfulCount: { increment: 1 },
      },
    });
  }

  /**
   * Segnala recensione
   */
  async report(id: string): Promise<void> {
    await prisma.productReview.update({
      where: { id },
      data: {
        reportCount: { increment: 1 },
      },
    });

    // Se troppe segnalazioni, metti in pending per moderazione
    const review = await prisma.productReview.findUnique({
      where: { id },
      select: { reportCount: true, status: true },
    });

    if (review && review.reportCount >= 3 && review.status === 'APPROVED') {
      await prisma.productReview.update({
        where: { id },
        data: { status: 'PENDING' },
      });

      logger.info(`Recensione ${id} rimessa in moderazione per segnalazioni`);
    }
  }

  // ==================
  // BUSINESS RESPONSE
  // ==================

  /**
   * Risponde alla recensione
   */
  async respond(
    id: string,
    response: string,
    responderId: string
  ): Promise<ProductReview> {
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        response,
        respondedAt: new Date(),
        respondedBy: responderId,
      },
    });

    logger.info(`Risposta aggiunta a recensione ${id}`);
    return review;
  }

  /**
   * Rimuove risposta
   */
  async removeResponse(id: string): Promise<ProductReview> {
    return prisma.productReview.update({
      where: { id },
      data: {
        response: null,
        respondedAt: null,
        respondedBy: null,
      },
    });
  }

  // ==================
  // ANALYTICS
  // ==================

  /**
   * Prodotti più recensiti
   */
  async getMostReviewedProducts(limit: number = 10): Promise<Array<{
    productId: string;
    productName: string;
    reviewCount: number;
    averageRating: number;
  }>> {
    const results = await prisma.productReview.groupBy({
      by: ['productId'],
      where: { status: 'APPROVED' },
      _count: { productId: true },
      _avg: { rating: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });

    const productIds = results.map(r => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map(p => [p.id, p.name]));

    return results.map(r => ({
      productId: r.productId,
      productName: productMap.get(r.productId) || 'Unknown',
      reviewCount: r._count.productId,
      averageRating: Math.round((r._avg.rating || 0) * 10) / 10,
    }));
  }

  /**
   * Overview recensioni globale
   */
  async getOverview(): Promise<{
    totalReviews: number;
    pendingReviews: number;
    averageRating: number;
    reviewsThisMonth: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalReviews, pendingReviews, avgRating, reviewsThisMonth] = await Promise.all([
      prisma.productReview.count({ where: { status: 'APPROVED' } }),
      prisma.productReview.count({ where: { status: 'PENDING' } }),
      prisma.productReview.aggregate({
        where: { status: 'APPROVED' },
        _avg: { rating: true },
      }),
      prisma.productReview.count({
        where: {
          createdAt: { gte: startOfMonth },
          status: 'APPROVED',
        },
      }),
    ]);

    return {
      totalReviews,
      pendingReviews,
      averageRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
      reviewsThisMonth,
    };
  }
}

export default new ReviewService();
