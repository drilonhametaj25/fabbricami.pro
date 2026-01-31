'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Review, ApiResponse } from '@/types';

interface ReviewsResponse {
  items: Review[];
  total: number;
  average: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface UseReviewsOptions {
  productId: string;
  page?: number;
  limit?: number;
}

export function useReviews({ productId, page = 1, limit = 10 }: UseReviewsOptions) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiResponse<ReviewsResponse>>(
        `/shop/products/${productId}/reviews`,
        { page, limit }
      );

      if (response.success && response.data) {
        setReviews(response.data.items || []);
        setTotal(response.data.total || 0);
        setAverage(response.data.average || 0);
        setDistribution(response.data.distribution || {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  }, [productId, page, limit]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return { reviews, total, average, distribution, loading, error, refetch: fetchReviews };
}

interface CreateReviewData {
  rating: number;
  title?: string;
  comment: string;
}

export function useCreateReview(productId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReview = async (data: CreateReviewData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Review>>(
        `/shop/products/${productId}/reviews`,
        data
      );

      if (response.success) {
        return response.data;
      }
      throw new Error('Failed to create review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create review';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createReview, loading, error };
}
