'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ThumbsUp, User } from 'lucide-react';
import { useReviews, useCreateReview } from '@/hooks/useReviews';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { reviews, total, average, distribution, loading, refetch } = useReviews({
    productId,
    page,
    limit: 5,
  });

  const { isAuthenticated } = useAuthStore();

  const totalPages = Math.ceil(total / 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-white">
          Reviews ({total})
        </h2>

        {isAuthenticated() && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary btn-medium"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Summary */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-surface-card rounded-2xl">
          {/* Average Rating */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-5xl font-bold text-gold">{average.toFixed(1)}</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.round(average) ? 'text-gold fill-current' : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {total} reviews
              </p>
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = distribution[rating] || 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-3">{rating}</span>
                  <Star className="w-4 h-4 text-gold fill-current" />
                  <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-text-muted w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ReviewForm
              productId={productId}
              onSuccess={() => {
                setShowForm(false);
                refetch();
              }}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse p-6 bg-surface-card rounded-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-surface-raised" />
                <div className="flex-1">
                  <div className="h-4 bg-surface-raised rounded w-24 mb-2" />
                  <div className="h-3 bg-surface-raised rounded w-32" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-surface-raised rounded w-full" />
                <div className="h-4 bg-surface-raised rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text-secondary">
            No reviews yet. Be the first to review this product!
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-10 h-10 rounded-lg transition-colors ${
                page === i + 1
                  ? 'bg-gold text-primary'
                  : 'bg-surface-card text-white hover:bg-surface-raised'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Review Card Component
interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    customerName?: string;
    createdAt: string;
    helpful?: number;
    helpfulCount?: number;
    verified?: boolean;
    customer?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

function ReviewCard({ review }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const comment = review.comment || '';
  const isLong = comment.length > 300;
  const customerName = review.customerName ||
    (review.customer?.firstName && review.customer?.lastName
      ? `${review.customer.firstName} ${review.customer.lastName}`
      : 'Verified Customer');

  return (
    <div className="p-6 bg-surface-card rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
            <User className="w-5 h-5 text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {customerName}
              </span>
              {review.verified && (
                <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded">
                  Verified
                </span>
              )}
            </div>
            <span className="text-sm text-text-muted">
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < review.rating ? 'text-gold fill-current' : 'text-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <h4 className="font-medium text-white mb-2">{review.title}</h4>
      )}

      {/* Comment */}
      {comment && (
        <p className="text-text-secondary leading-relaxed">
          {isLong && !expanded ? (
            <>
              {comment.slice(0, 300)}...
              <button
                onClick={() => setExpanded(true)}
                className="ml-2 text-gold hover:underline"
              >
                Read more
              </button>
            </>
          ) : (
            comment
          )}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
        <button className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold transition-colors">
          <ThumbsUp className="w-4 h-4" />
          Helpful ({review.helpfulCount ?? review.helpful ?? 0})
        </button>
      </div>
    </div>
  );
}

// Review Form Component
interface ReviewFormProps {
  productId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function ReviewForm({ productId, onSuccess, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const { createReview, loading, error } = useCreateReview(productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!comment.trim()) return;

    try {
      await createReview({ rating, title, comment });
      onSuccess();
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-surface-card rounded-2xl space-y-6">
      <h3 className="font-display text-xl font-semibold text-white">
        Write a Review
      </h3>

      {/* Rating */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Your Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  value <= (hoverRating || rating)
                    ? 'text-gold fill-current'
                    : 'text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="review-title" className="text-sm font-medium text-white">
          Title (optional)
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
        />
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <label htmlFor="review-comment" className="text-sm font-medium text-white">
          Your Review
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this product..."
          rows={4}
          required
          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50 resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading || !comment.trim()}
          className="btn-primary btn-medium flex-1 justify-center"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit Review'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary btn-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
