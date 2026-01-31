'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { Product, ProductDetail, ProductFilters, PaginatedResponse } from '@/types';

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  fetchProducts: (filters?: ProductFilters) => Promise<void>;
}

interface UseProductReturn {
  product: ProductDetail | null;
  loading: boolean;
  error: string | null;
  fetchProduct: (slug: string) => Promise<void>;
}

/**
 * Hook for fetching products with filters
 * Uses stable key comparison to prevent duplicate API calls
 */
export function useProducts(initialFilters?: ProductFilters): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<UseProductsReturn['pagination']>(null);

  // Track the last fetched filters to prevent duplicate calls
  const lastFetchKey = useRef<string>('');

  const fetchProducts = useCallback(async (filters?: ProductFilters) => {
    // Create a stable key from filters
    const fetchKey = JSON.stringify({
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 12,
      category: filters?.category,
      search: filters?.search,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      inStock: filters?.inStock,
      onSale: filters?.onSale,
      featured: filters?.featured,
      sortBy: filters?.sortBy,
      sortOrder: filters?.sortOrder,
    });

    // Skip if we already fetched with these exact filters
    if (fetchKey === lastFetchKey.current && products.length > 0) {
      return;
    }

    lastFetchKey.current = fetchKey;
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<PaginatedResponse<Product>>('/shop/products', {
        page: filters?.page ?? 1,
        limit: filters?.limit ?? 12,
        category: filters?.category,
        search: filters?.search,
        minPrice: filters?.minPrice,
        maxPrice: filters?.maxPrice,
        inStock: filters?.inStock,
        onSale: filters?.onSale,
        featured: filters?.featured,
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder,
      });

      setProducts(response.items || []);
      setPagination(response.pagination);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [products.length]);

  // Create stable filter key for dependency
  const filterKey = JSON.stringify(initialFilters);

  useEffect(() => {
    fetchProducts(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  return { products, loading, error, pagination, fetchProducts };
}

/**
 * Hook for fetching a single product by slug
 */
export function useProduct(slug?: string): UseProductReturn {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async (productSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ProductDetail>(`/shop/products/${productSlug}`);
      setProduct(data);
    } catch (err) {
      setError((err as Error).message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) {
      fetchProduct(slug);
    }
  }, [slug, fetchProduct]);

  return { product, loading, error, fetchProduct };
}

/**
 * Hook for fetching featured products
 */
export function useFeaturedProducts(limit = 8) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const response = await api.get<PaginatedResponse<Product>>('/shop/products', {
          featured: true,
          limit,
        });
        setProducts(response.items || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [limit]);

  return { products, loading, error };
}

/**
 * Hook for fetching new arrivals
 */
export function useNewArrivals(limit = 8) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const response = await api.get<PaginatedResponse<Product>>('/shop/products', {
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit,
        });
        setProducts(response.items || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [limit]);

  return { products, loading, error };
}

/**
 * Hook for fetching products on sale
 */
export function useOnSaleProducts(limit = 8) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const response = await api.get<PaginatedResponse<Product>>('/shop/products', {
          onSale: true,
          limit,
        });
        setProducts(response.items || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [limit]);

  return { products, loading, error };
}
