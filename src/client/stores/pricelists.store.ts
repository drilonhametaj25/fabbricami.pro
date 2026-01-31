import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi';
import type { PriceList, PriceListItem, CategoryDiscount, PaginatedResponse, PriceCalculation } from '../types';

interface PriceListFilters {
  search?: string;
  isActive?: boolean;
}

export const usePriceListsStore = defineStore('pricelists', () => {
  // State
  const priceLists = ref<PriceList[]>([]);
  const currentPriceList = ref<PriceList | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<PriceListFilters>({});

  // Getters
  const activePriceLists = computed(() =>
    priceLists.value.filter(pl => pl.isActive)
  );

  const defaultPriceList = computed(() =>
    priceLists.value.find(pl => pl.isDefault)
  );

  const priceListsWithCustomers = computed(() =>
    priceLists.value.filter(pl => (pl._count?.customers ?? 0) > 0)
  );

  // Actions
  async function fetchPriceLists(options?: {
    page?: number;
    limit?: number;
    filters?: PriceListFilters;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || pagination.value.page));
      params.set('limit', String(options?.limit || pagination.value.limit));

      const f = options?.filters || filters.value;
      if (f.search) params.set('search', f.search);
      if (f.isActive !== undefined) params.set('isActive', String(f.isActive));

      const response = await api.get<PaginatedResponse<PriceList>>(
        `/pricelists?${params.toString()}`
      );

      if (response.success) {
        priceLists.value = response.data.items;
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento listini';
    } finally {
      loading.value = false;
    }
  }

  async function fetchPriceList(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<PriceList>(`/pricelists/${id}`);
      if (response.success) {
        currentPriceList.value = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento listino';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createPriceList(data: Partial<PriceList>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<PriceList>('/pricelists', data);
      if (response.success) {
        priceLists.value.unshift(response.data);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione listino';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updatePriceList(id: string, data: Partial<PriceList>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.put<PriceList>(`/pricelists/${id}`, data);
      if (response.success) {
        const index = priceLists.value.findIndex(pl => pl.id === id);
        if (index !== -1) {
          priceLists.value[index] = response.data;
        }
        if (currentPriceList.value?.id === id) {
          currentPriceList.value = response.data;
        }
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento listino';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deletePriceList(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/pricelists/${id}`);
      if (response.success) {
        priceLists.value = priceLists.value.filter(pl => pl.id !== id);
        if (currentPriceList.value?.id === id) {
          currentPriceList.value = null;
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore eliminazione listino';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Price List Items
  async function addPriceListItem(priceListId: string, item: Partial<PriceListItem>) {
    try {
      const response = await api.post<PriceListItem>(`/pricelists/${priceListId}/items`, item);
      if (response.success && currentPriceList.value?.id === priceListId) {
        if (!currentPriceList.value.items) {
          currentPriceList.value.items = [];
        }
        currentPriceList.value.items.push(response.data);
      }
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  async function removePriceListItem(priceListId: string, productId: string) {
    try {
      await api.delete(`/pricelists/${priceListId}/items/${productId}`);
      if (currentPriceList.value?.id === priceListId && currentPriceList.value.items) {
        currentPriceList.value.items = currentPriceList.value.items.filter(
          item => item.productId !== productId
        );
      }
    } catch (err) {
      throw err;
    }
  }

  // Category Discounts
  async function addCategoryDiscount(priceListId: string, data: Partial<CategoryDiscount>) {
    try {
      const response = await api.post<CategoryDiscount>(`/pricelists/${priceListId}/categories`, data);
      if (response.success && currentPriceList.value?.id === priceListId) {
        if (!currentPriceList.value.categoryDiscounts) {
          currentPriceList.value.categoryDiscounts = [];
        }
        currentPriceList.value.categoryDiscounts.push(response.data);
      }
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  async function removeCategoryDiscount(priceListId: string, categoryId: string) {
    try {
      await api.delete(`/pricelists/${priceListId}/categories/${categoryId}`);
      if (currentPriceList.value?.id === priceListId && currentPriceList.value.categoryDiscounts) {
        currentPriceList.value.categoryDiscounts = currentPriceList.value.categoryDiscounts.filter(
          cd => cd.categoryId !== categoryId
        );
      }
    } catch (err) {
      throw err;
    }
  }

  // Customer Assignment
  async function assignToCustomer(customerId: string, priceListId: string) {
    try {
      const response = await api.post('/pricelists/assign', { customerId, priceListId });
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  // Price Calculation
  async function calculatePrice(customerId: string, productId: string, quantity: number = 1): Promise<PriceCalculation> {
    try {
      const response = await api.post<PriceCalculation>('/pricelists/calculate', {
        customerId,
        productId,
        quantity,
      });
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  async function calculateOrderPrices(customerId: string, items: Array<{ productId: string; quantity: number }>) {
    try {
      const response = await api.post('/pricelists/calculate-order', { customerId, items });
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  // Bulk Import
  async function bulkImportPrices(priceListId: string, items: any[]) {
    try {
      const response = await api.post(`/pricelists/${priceListId}/bulk-import`, { items });
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  // Get customers by price list
  async function getCustomersByPriceList(priceListId: string) {
    try {
      const response = await api.get(`/pricelists/${priceListId}/customers`);
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  function setFilters(newFilters: PriceListFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function setPage(page: number) {
    pagination.value.page = page;
    fetchPriceLists({ page });
  }

  return {
    // State
    priceLists,
    currentPriceList,
    loading,
    error,
    pagination,
    filters,

    // Getters
    activePriceLists,
    defaultPriceList,
    priceListsWithCustomers,

    // Actions
    fetchPriceLists,
    fetchPriceList,
    createPriceList,
    updatePriceList,
    deletePriceList,
    addPriceListItem,
    removePriceListItem,
    addCategoryDiscount,
    removeCategoryDiscount,
    assignToCustomer,
    calculatePrice,
    calculateOrderPrices,
    bulkImportPrices,
    getCustomersByPriceList,
    setFilters,
    clearFilters,
    setPage,
  };
});
