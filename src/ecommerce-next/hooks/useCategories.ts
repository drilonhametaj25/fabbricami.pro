'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/types';

interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching categories
 */
export function useCategories(flat = false): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        // Only pass flat param when true (string "false" would be truthy on backend)
        const params = flat ? { flat: true } : undefined;
        const response = await api.get<Category[]>('/shop/categories', params);
        setCategories(response || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [flat]);

  return { categories, loading, error };
}

/**
 * Hook for fetching a single category with products
 */
export function useCategory(slug?: string) {
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function fetch() {
      try {
        const response = await api.get<Category>(`/shop/categories/${slug}`);
        setCategory(response);
      } catch (err) {
        setError((err as Error).message);
        setCategory(null);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [slug]);

  return { category, loading, error };
}
