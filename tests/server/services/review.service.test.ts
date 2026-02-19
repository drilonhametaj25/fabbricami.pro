import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ReviewStatus } from '@prisma/client';

// Mock prisma
const mockPrisma = {
  productReview: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  orderItem: {
    findFirst: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
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

import reviewService from '@server/services/review.service';

describe('ReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for updateProductStats (background call)
    mockPrisma.productReview.findMany.mockResolvedValue([]);
    mockPrisma.product.update.mockResolvedValue({});
  });

  // ===================
  // create
  // ===================
  describe('create', () => {
    it('should throw error when rating is below 1', async () => {
      await expect(
        reviewService.create({
          productId: 'prod-1',
          customerId: 'cust-1',
          rating: 0,
        })
      ).rejects.toThrow('Rating deve essere tra 1 e 5');
    });

    it('should throw error when rating is above 5', async () => {
      await expect(
        reviewService.create({
          productId: 'prod-1',
          customerId: 'cust-1',
          rating: 6,
        })
      ).rejects.toThrow('Rating deve essere tra 1 e 5');
    });

    it('should throw error when customer already reviewed product', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'existing-review',
        productId: 'prod-1',
        customerId: 'cust-1',
      });

      await expect(
        reviewService.create({
          productId: 'prod-1',
          customerId: 'cust-1',
          rating: 5,
        })
      ).rejects.toThrow('Hai già recensito questo prodotto');
    });

    it('should create review with PENDING status', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);
      mockPrisma.productReview.create.mockResolvedValue({
        id: 'review-1',
        productId: 'prod-1',
        customerId: 'cust-1',
        rating: 5,
        status: 'PENDING',
        verified: false,
      });

      const result = await reviewService.create({
        productId: 'prod-1',
        customerId: 'cust-1',
        rating: 5,
        title: 'Great product',
        comment: 'I love it!',
      });

      expect(result.status).toBe('PENDING');
      expect(mockPrisma.productReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          customerId: 'cust-1',
          rating: 5,
          status: 'PENDING',
          verified: false,
        }),
      });
    });

    it('should verify review when orderId is provided and order is valid', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);
      mockPrisma.orderItem.findFirst.mockResolvedValue({
        id: 'item-1',
        orderId: 'order-1',
        productId: 'prod-1',
      });
      mockPrisma.productReview.create.mockResolvedValue({
        id: 'review-1',
        verified: true,
      });

      await reviewService.create({
        productId: 'prod-1',
        customerId: 'cust-1',
        orderId: 'order-1',
        rating: 4,
      });

      expect(mockPrisma.productReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verified: true,
        }),
      });
    });

    it('should not verify review when order not found', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);
      mockPrisma.orderItem.findFirst.mockResolvedValue(null);
      mockPrisma.productReview.create.mockResolvedValue({
        id: 'review-1',
        verified: false,
      });

      await reviewService.create({
        productId: 'prod-1',
        customerId: 'cust-1',
        orderId: 'order-invalid',
        rating: 4,
      });

      expect(mockPrisma.productReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verified: false,
        }),
      });
    });

    it('should include pros, cons, and images', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);
      mockPrisma.productReview.create.mockResolvedValue({});

      await reviewService.create({
        productId: 'prod-1',
        customerId: 'cust-1',
        rating: 5,
        pros: ['Good quality', 'Fast shipping'],
        cons: ['Expensive'],
        images: [{ url: 'https://example.com/img.jpg' }],
      });

      expect(mockPrisma.productReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pros: ['Good quality', 'Fast shipping'],
          cons: ['Expensive'],
          images: [{ url: 'https://example.com/img.jpg' }],
        }),
      });
    });
  });

  // ===================
  // update
  // ===================
  describe('update', () => {
    it('should throw error when review not found', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);

      await expect(
        reviewService.update('review-unknown', 'cust-1', { rating: 4 })
      ).rejects.toThrow('Recensione non trovata');
    });

    it('should update review with new data', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'review-1',
        customerId: 'cust-1',
        status: 'PENDING',
      });
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        rating: 4,
        title: 'Updated title',
      });

      const result = await reviewService.update('review-1', 'cust-1', {
        rating: 4,
        title: 'Updated title',
      });

      expect(result.rating).toBe(4);
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          rating: 4,
          title: 'Updated title',
        }),
      });
    });

    it('should set status back to PENDING when modifying approved review', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'review-1',
        customerId: 'cust-1',
        status: 'APPROVED',
      });
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        status: 'PENDING',
      });

      await reviewService.update('review-1', 'cust-1', {
        comment: 'Updated comment',
      });

      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          status: 'PENDING',
        }),
      });
    });

    it('should keep original status when modifying non-approved review', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'review-1',
        customerId: 'cust-1',
        status: 'REJECTED',
      });
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        status: 'REJECTED',
      });

      await reviewService.update('review-1', 'cust-1', {
        comment: 'Updated comment',
      });

      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
        }),
      });
    });
  });

  // ===================
  // delete
  // ===================
  describe('delete', () => {
    it('should throw error when review not found', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue(null);

      await expect(
        reviewService.delete('review-unknown', 'cust-1')
      ).rejects.toThrow('Recensione non trovata');
    });

    it('should delete review by id and customerId', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'review-1',
        productId: 'prod-1',
        customerId: 'cust-1',
      });
      mockPrisma.productReview.delete.mockResolvedValue({});

      await reviewService.delete('review-1', 'cust-1');

      expect(mockPrisma.productReview.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
    });

    it('should allow admin to delete without customerId check', async () => {
      mockPrisma.productReview.findFirst.mockResolvedValue({
        id: 'review-1',
        productId: 'prod-1',
        customerId: 'cust-1',
      });
      mockPrisma.productReview.delete.mockResolvedValue({});

      await reviewService.delete('review-1'); // No customerId

      expect(mockPrisma.productReview.findFirst).toHaveBeenCalledWith({
        where: { id: 'review-1' }, // No customerId in where
      });
    });
  });

  // ===================
  // list
  // ===================
  describe('list', () => {
    it('should return paginated list with default params', async () => {
      const mockReviews = [
        { id: 'review-1', rating: 5, customer: {}, product: {} },
        { id: 'review-2', rating: 4, customer: {}, product: {} },
      ];
      mockPrisma.productReview.findMany.mockResolvedValue(mockReviews);
      mockPrisma.productReview.count.mockResolvedValue(10);

      const result = await reviewService.list({});

      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 10,
        totalPages: 1,
      });
      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by productId', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(0);

      await reviewService.list({ productId: 'prod-1' });

      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: 'prod-1' }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(0);

      await reviewService.list({ status: 'PENDING' as ReviewStatus });

      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('should filter by minRating', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(0);

      await reviewService.list({ minRating: 4 });

      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ rating: { gte: 4 } }),
        })
      );
    });

    it('should filter by verified status', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(0);

      await reviewService.list({ verified: true });

      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verified: true }),
        })
      );
    });

    it('should sort by rating ascending', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(0);

      await reviewService.list({ sortBy: 'rating', sortOrder: 'asc' });

      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'asc' },
        })
      );
    });

    it('should calculate correct pagination', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);
      mockPrisma.productReview.count.mockResolvedValue(50);

      const result = await reviewService.list({ page: 3, limit: 10 });

      expect(result.pagination.totalPages).toBe(5);
      expect(mockPrisma.productReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });
  });

  // ===================
  // getProductReviews
  // ===================
  describe('getProductReviews', () => {
    it('should return reviews with stats for public display', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([
        { id: 'review-1', rating: 5, verified: true },
      ]);
      mockPrisma.productReview.count.mockResolvedValue(1);

      const result = await reviewService.getProductReviews('prod-1');

      expect(result.items).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.pagination).toBeDefined();
    });
  });

  // ===================
  // getProductStats
  // ===================
  describe('getProductStats', () => {
    it('should return zero stats when no reviews', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([]);

      const result = await reviewService.getProductStats('prod-1');

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
        verifiedReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('should calculate correct statistics', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([
        { rating: 5, verified: true },
        { rating: 5, verified: true },
        { rating: 4, verified: false },
        { rating: 3, verified: true },
        { rating: 2, verified: false },
      ]);

      const result = await reviewService.getProductStats('prod-1');

      expect(result.totalReviews).toBe(5);
      expect(result.verifiedReviews).toBe(3);
      expect(result.averageRating).toBe(3.8); // (5+5+4+3+2)/5 = 3.8
      expect(result.ratingDistribution).toEqual({
        1: 0,
        2: 1,
        3: 1,
        4: 1,
        5: 2,
      });
    });

    it('should round average rating to 1 decimal', async () => {
      mockPrisma.productReview.findMany.mockResolvedValue([
        { rating: 5, verified: true },
        { rating: 4, verified: true },
        { rating: 4, verified: true },
      ]);

      const result = await reviewService.getProductStats('prod-1');

      // (5+4+4)/3 = 4.333... → 4.3
      expect(result.averageRating).toBe(4.3);
    });
  });

  // ===================
  // Moderation
  // ===================
  describe('approve', () => {
    it('should approve review and update product stats', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        productId: 'prod-1',
        status: 'APPROVED',
      });

      const result = await reviewService.approve('review-1', 'mod-1');

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: 'APPROVED',
          moderatedBy: 'mod-1',
          moderatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('reject', () => {
    it('should reject review with reason', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        status: 'REJECTED',
      });

      const result = await reviewService.reject('review-1', 'mod-1', 'Inappropriate content');

      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: 'REJECTED',
          moderatedBy: 'mod-1',
          moderatedAt: expect.any(Date),
          moderationNote: 'Inappropriate content',
        },
      });
    });

    it('should reject review without reason', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        status: 'REJECTED',
      });

      await reviewService.reject('review-1', 'mod-1');

      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          moderationNote: undefined,
        }),
      });
    });
  });

  describe('markAsSpam', () => {
    it('should mark review as spam', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        status: 'SPAM',
      });

      const result = await reviewService.markAsSpam('review-1', 'mod-1');

      expect(result.status).toBe('SPAM');
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: 'SPAM',
          moderatedBy: 'mod-1',
          moderatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending reviews', async () => {
      mockPrisma.productReview.count.mockResolvedValue(15);

      const result = await reviewService.getPendingCount();

      expect(result).toBe(15);
      expect(mockPrisma.productReview.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
    });
  });

  // ===================
  // Helpfulness
  // ===================
  describe('markHelpful', () => {
    it('should increment helpful count', async () => {
      mockPrisma.productReview.update.mockResolvedValue({});

      await reviewService.markHelpful('review-1');

      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          helpfulCount: { increment: 1 },
        },
      });
    });
  });

  describe('report', () => {
    it('should increment report count', async () => {
      mockPrisma.productReview.update.mockResolvedValue({});
      mockPrisma.productReview.findUnique.mockResolvedValue({
        reportCount: 1,
        status: 'APPROVED',
      });

      await reviewService.report('review-1');

      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          reportCount: { increment: 1 },
        },
      });
    });

    it('should set status to PENDING when report count reaches 3', async () => {
      mockPrisma.productReview.update.mockResolvedValue({});
      mockPrisma.productReview.findUnique.mockResolvedValue({
        reportCount: 3,
        status: 'APPROVED',
      });

      await reviewService.report('review-1');

      expect(mockPrisma.productReview.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.productReview.update).toHaveBeenLastCalledWith({
        where: { id: 'review-1' },
        data: { status: 'PENDING' },
      });
    });

    it('should not change status for already pending review', async () => {
      mockPrisma.productReview.update.mockResolvedValue({});
      mockPrisma.productReview.findUnique.mockResolvedValue({
        reportCount: 5,
        status: 'PENDING',
      });

      await reviewService.report('review-1');

      // Only the initial increment call
      expect(mockPrisma.productReview.update).toHaveBeenCalledTimes(1);
    });
  });

  // ===================
  // Business Response
  // ===================
  describe('respond', () => {
    it('should add response to review', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        response: 'Thank you for your feedback!',
      });

      const result = await reviewService.respond(
        'review-1',
        'Thank you for your feedback!',
        'user-admin'
      );

      expect(result.response).toBe('Thank you for your feedback!');
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          response: 'Thank you for your feedback!',
          respondedAt: expect.any(Date),
          respondedBy: 'user-admin',
        },
      });
    });
  });

  describe('removeResponse', () => {
    it('should remove response from review', async () => {
      mockPrisma.productReview.update.mockResolvedValue({
        id: 'review-1',
        response: null,
      });

      const result = await reviewService.removeResponse('review-1');

      expect(result.response).toBeNull();
      expect(mockPrisma.productReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          response: null,
          respondedAt: null,
          respondedBy: null,
        },
      });
    });
  });

  // ===================
  // Analytics
  // ===================
  describe('getMostReviewedProducts', () => {
    it('should return most reviewed products', async () => {
      mockPrisma.productReview.groupBy.mockResolvedValue([
        { productId: 'prod-1', _count: { productId: 50 }, _avg: { rating: 4.5 } },
        { productId: 'prod-2', _count: { productId: 30 }, _avg: { rating: 4.2 } },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Product A' },
        { id: 'prod-2', name: 'Product B' },
      ]);

      const result = await reviewService.getMostReviewedProducts(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 'prod-1',
        productName: 'Product A',
        reviewCount: 50,
        averageRating: 4.5,
      });
    });

    it('should handle unknown product names', async () => {
      mockPrisma.productReview.groupBy.mockResolvedValue([
        { productId: 'prod-deleted', _count: { productId: 10 }, _avg: { rating: 3.0 } },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await reviewService.getMostReviewedProducts(5);

      expect(result[0].productName).toBe('Unknown');
    });

    it('should round average rating', async () => {
      mockPrisma.productReview.groupBy.mockResolvedValue([
        { productId: 'prod-1', _count: { productId: 10 }, _avg: { rating: 4.567 } },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Product' },
      ]);

      const result = await reviewService.getMostReviewedProducts(1);

      expect(result[0].averageRating).toBe(4.6);
    });
  });

  describe('getOverview', () => {
    it('should return complete overview statistics', async () => {
      mockPrisma.productReview.count
        .mockResolvedValueOnce(100) // totalReviews
        .mockResolvedValueOnce(5)  // pendingReviews
        .mockResolvedValueOnce(20); // reviewsThisMonth
      mockPrisma.productReview.aggregate.mockResolvedValue({
        _avg: { rating: 4.3 },
      });

      const result = await reviewService.getOverview();

      expect(result).toEqual({
        totalReviews: 100,
        pendingReviews: 5,
        averageRating: 4.3,
        reviewsThisMonth: 20,
      });
    });

    it('should handle null average rating', async () => {
      mockPrisma.productReview.count.mockResolvedValue(0);
      mockPrisma.productReview.aggregate.mockResolvedValue({
        _avg: { rating: null },
      });

      const result = await reviewService.getOverview();

      expect(result.averageRating).toBe(0);
    });
  });
});
