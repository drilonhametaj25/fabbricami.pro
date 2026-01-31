import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi';
import type { Customer, CustomerType, PaginatedResponse } from '../types';

interface CustomerFilters {
  search?: string;
  type?: CustomerType;
  isActive?: boolean;
}

export const useCustomersStore = defineStore('customers', () => {
  // State
  const customers = ref<Customer[]>([]);
  const currentCustomer = ref<Customer | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<CustomerFilters>({});

  // Getters
  const b2bCustomers = computed(() =>
    customers.value.filter(c => c.type === 'B2B')
  );

  const b2cCustomers = computed(() =>
    customers.value.filter(c => c.type === 'B2C')
  );

  const activeCustomers = computed(() =>
    customers.value.filter(c => c.isActive)
  );

  const topCustomers = computed(() =>
    [...customers.value]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
  );

  const customersWithCredit = computed(() =>
    customers.value.filter(c => c.creditLimit && c.creditLimit > 0)
  );

  // Actions
  async function fetchCustomers(options?: {
    page?: number;
    limit?: number;
    filters?: CustomerFilters;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || pagination.value.page));
      params.set('limit', String(options?.limit || pagination.value.limit));

      const f = options?.filters || filters.value;
      if (f.search) params.set('search', f.search);
      if (f.type) params.set('type', f.type);
      if (f.isActive !== undefined) params.set('isActive', String(f.isActive));

      const response = await api.get<PaginatedResponse<Customer>>(
        `/customers?${params.toString()}`
      );

      if (response.success) {
        customers.value = response.data.items;
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento clienti';
    } finally {
      loading.value = false;
    }
  }

  async function fetchCustomer(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<Customer>(`/customers/${id}`);
      if (response.success) {
        currentCustomer.value = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createCustomer(data: Partial<Customer>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<Customer>('/customers', data);
      if (response.success) {
        customers.value.unshift(response.data);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateCustomer(id: string, data: Partial<Customer>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.put<Customer>(`/customers/${id}`, data);
      if (response.success) {
        const index = customers.value.findIndex(c => c.id === id);
        if (index !== -1) {
          customers.value[index] = response.data;
        }
        if (currentCustomer.value?.id === id) {
          currentCustomer.value = response.data;
        }
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteCustomer(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/customers/${id}`);
      if (response.success) {
        customers.value = customers.value.filter(c => c.id !== id);
        if (currentCustomer.value?.id === id) {
          currentCustomer.value = null;
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore eliminazione cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function searchCustomers(query: string) {
    try {
      const response = await api.get<Customer[]>(`/customers/search?q=${encodeURIComponent(query)}`);
      if (response.success) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }

  function setFilters(newFilters: CustomerFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function setPage(page: number) {
    pagination.value.page = page;
    fetchCustomers({ page });
  }

  return {
    // State
    customers,
    currentCustomer,
    loading,
    error,
    pagination,
    filters,

    // Getters
    b2bCustomers,
    b2cCustomers,
    activeCustomers,
    topCustomers,
    customersWithCredit,

    // Actions
    fetchCustomers,
    fetchCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers,
    setFilters,
    clearFilters,
    setPage,
  };
});
