import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi';
import type { Product, PaginatedResponse } from '../types';

interface ProductFilters {
  search?: string;
  category?: string;
  type?: string;
  isActive?: boolean;
  lowStock?: boolean;
}

export const useProductsStore = defineStore('products', () => {
  // State
  const products = ref<Product[]>([]);
  const currentProduct = ref<Product | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<ProductFilters>({});

  // Getters
  const activeProducts = computed(() =>
    products.value.filter(p => p.isActive)
  );

  const lowStockProducts = computed(() =>
    products.value.filter(p => p.minStock > 0)
  );

  const productsByCategory = computed(() => {
    const grouped: Record<string, Product[]> = {};
    products.value.forEach(p => {
      const cat = p.category || 'Senza Categoria';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  });

  // Actions
  async function fetchProducts(options?: {
    page?: number;
    limit?: number;
    filters?: ProductFilters;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || pagination.value.page));
      params.set('limit', String(options?.limit || pagination.value.limit));

      const f = options?.filters || filters.value;
      if (f.search) params.set('search', f.search);
      if (f.category) params.set('category', f.category);
      if (f.type) params.set('type', f.type);
      if (f.isActive !== undefined) params.set('isActive', String(f.isActive));
      if (f.lowStock) params.set('lowStock', 'true');

      const response = await api.get<PaginatedResponse<Product>>(
        `/products?${params.toString()}`
      );

      if (response.success) {
        products.value = response.data.items;
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento prodotti';
    } finally {
      loading.value = false;
    }
  }

  async function fetchProduct(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<Product>(`/products/${id}`);
      if (response.success) {
        currentProduct.value = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento prodotto';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createProduct(data: Partial<Product>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<Product>('/products', data);
      if (response.success) {
        products.value.unshift(response.data);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione prodotto';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProduct(id: string, data: Partial<Product>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.put<Product>(`/products/${id}`, data);
      if (response.success) {
        const index = products.value.findIndex(p => p.id === id);
        if (index !== -1) {
          products.value[index] = response.data;
        }
        if (currentProduct.value?.id === id) {
          currentProduct.value = response.data;
        }
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento prodotto';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteProduct(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/products/${id}`);
      if (response.success) {
        products.value = products.value.filter(p => p.id !== id);
        if (currentProduct.value?.id === id) {
          currentProduct.value = null;
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore eliminazione prodotto';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function setFilters(newFilters: ProductFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function setPage(page: number) {
    pagination.value.page = page;
    fetchProducts({ page });
  }

  return {
    // State
    products,
    currentProduct,
    loading,
    error,
    pagination,
    filters,

    // Getters
    activeProducts,
    lowStockProducts,
    productsByCategory,

    // Actions
    fetchProducts,
    fetchProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    setFilters,
    clearFilters,
    setPage,
  };
});
