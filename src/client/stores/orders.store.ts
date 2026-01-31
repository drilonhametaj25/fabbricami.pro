import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi';
import type { Order, OrderStatus, PaginatedResponse } from '../types';

interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  source?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useOrdersStore = defineStore('orders', () => {
  // State
  const orders = ref<Order[]>([]);
  const currentOrder = ref<Order | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<OrderFilters>({});

  // Getters
  const pendingOrders = computed(() =>
    orders.value.filter(o => o.status === 'PENDING')
  );

  const processingOrders = computed(() =>
    orders.value.filter(o => ['CONFIRMED', 'PROCESSING', 'READY'].includes(o.status))
  );

  const todayOrders = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return orders.value.filter(o => o.orderDate.startsWith(today));
  });

  const ordersByStatus = computed(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      PENDING: [],
      CONFIRMED: [],
      PROCESSING: [],
      READY: [],
      SHIPPED: [],
      DELIVERED: [],
      CANCELLED: [],
      REFUNDED: [],
    };
    orders.value.forEach(o => {
      grouped[o.status].push(o);
    });
    return grouped;
  });

  const totalRevenue = computed(() =>
    orders.value
      .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0)
  );

  // Actions
  async function fetchOrders(options?: {
    page?: number;
    limit?: number;
    filters?: OrderFilters;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || pagination.value.page));
      params.set('limit', String(options?.limit || pagination.value.limit));

      const f = options?.filters || filters.value;
      if (f.search) params.set('search', f.search);
      if (f.status) params.set('status', f.status);
      if (f.source) params.set('source', f.source);
      if (f.customerId) params.set('customerId', f.customerId);
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo) params.set('dateTo', f.dateTo);

      const response = await api.get<PaginatedResponse<Order>>(
        `/orders?${params.toString()}`
      );

      if (response.success) {
        orders.value = response.data.items;
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento ordini';
    } finally {
      loading.value = false;
    }
  }

  async function fetchOrder(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<Order>(`/orders/${id}`);
      if (response.success) {
        currentOrder.value = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento ordine';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createOrder(data: Partial<Order>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<Order>('/orders', data);
      if (response.success) {
        orders.value.unshift(response.data);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione ordine';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateOrder(id: string, data: Partial<Order>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.put<Order>(`/orders/${id}`, data);
      if (response.success) {
        const index = orders.value.findIndex(o => o.id === id);
        if (index !== -1) {
          orders.value[index] = response.data;
        }
        if (currentOrder.value?.id === id) {
          currentOrder.value = response.data;
        }
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento ordine';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateOrderStatus(id: string, status: OrderStatus) {
    return updateOrder(id, { status });
  }

  async function deleteOrder(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/orders/${id}`);
      if (response.success) {
        orders.value = orders.value.filter(o => o.id !== id);
        if (currentOrder.value?.id === id) {
          currentOrder.value = null;
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore eliminazione ordine';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function setFilters(newFilters: OrderFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function setPage(page: number) {
    pagination.value.page = page;
    fetchOrders({ page });
  }

  return {
    // State
    orders,
    currentOrder,
    loading,
    error,
    pagination,
    filters,

    // Getters
    pendingOrders,
    processingOrders,
    todayOrders,
    ordersByStatus,
    totalRevenue,

    // Actions
    fetchOrders,
    fetchOrder,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    setFilters,
    clearFilters,
    setPage,
  };
});
