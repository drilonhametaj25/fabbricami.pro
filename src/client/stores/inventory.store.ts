import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi';
import type { InventoryItem, InventoryMovement, Warehouse, PaginatedResponse, InventoryLocation } from '../types';

interface InventoryFilters {
  warehouseId?: string;
  location?: InventoryLocation;
  productId?: string;
  lowStock?: boolean;
}

export const useInventoryStore = defineStore('inventory', () => {
  // State
  const inventoryItems = ref<InventoryItem[]>([]);
  const movements = ref<InventoryMovement[]>([]);
  const warehouses = ref<Warehouse[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<InventoryFilters>({});

  // Getters
  const lowStockItems = computed(() =>
    inventoryItems.value.filter(item => {
      const product = item.product;
      if (!product) return false;
      const available = item.quantity - item.reservedQuantity;
      return available <= product.minStock;
    })
  );

  const outOfStockItems = computed(() =>
    inventoryItems.value.filter(item => {
      const available = item.quantity - item.reservedQuantity;
      return available <= 0;
    })
  );

  const totalInventoryValue = computed(() =>
    inventoryItems.value.reduce((sum, item) => {
      const cost = item.product?.cost || 0;
      return sum + (item.quantity * cost);
    }, 0)
  );

  const inventoryByLocation = computed(() => {
    const grouped: Record<InventoryLocation, InventoryItem[]> = {
      WEB: [],
      B2B: [],
      EVENTI: [],
      TRANSITO: [],
    };
    inventoryItems.value.forEach(item => {
      grouped[item.location].push(item);
    });
    return grouped;
  });

  const inventoryByWarehouse = computed(() => {
    const grouped: Record<string, InventoryItem[]> = {};
    inventoryItems.value.forEach(item => {
      const warehouseId = item.warehouseId;
      if (!grouped[warehouseId]) grouped[warehouseId] = [];
      grouped[warehouseId].push(item);
    });
    return grouped;
  });

  const activeWarehouses = computed(() =>
    warehouses.value.filter(w => w.isActive)
  );

  const primaryWarehouse = computed(() =>
    warehouses.value.find(w => w.isPrimary)
  );

  // Actions
  async function fetchInventory(options?: {
    page?: number;
    limit?: number;
    filters?: InventoryFilters;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || pagination.value.page));
      params.set('limit', String(options?.limit || pagination.value.limit));

      const f = options?.filters || filters.value;
      if (f.warehouseId) params.set('warehouseId', f.warehouseId);
      if (f.location) params.set('location', f.location);
      if (f.productId) params.set('productId', f.productId);
      if (f.lowStock) params.set('lowStock', 'true');

      const response = await api.get<PaginatedResponse<InventoryItem>>(
        `/inventory?${params.toString()}`
      );

      if (response.success) {
        inventoryItems.value = response.data.items;
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento inventario';
    } finally {
      loading.value = false;
    }
  }

  async function fetchMovements(options?: {
    page?: number;
    limit?: number;
    productId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('page', String(options?.page || 1));
      params.set('limit', String(options?.limit || 50));

      if (options?.productId) params.set('productId', options.productId);
      if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
      if (options?.dateTo) params.set('dateTo', options.dateTo);

      const response = await api.get<PaginatedResponse<InventoryMovement>>(
        `/inventory/movements?${params.toString()}`
      );

      if (response.success) {
        movements.value = response.data.items;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento movimenti';
    } finally {
      loading.value = false;
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await api.get<Warehouse[]>('/warehouses');
      if (response.success) {
        warehouses.value = response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento magazzini';
    }
  }

  async function adjustInventory(data: {
    productId: string;
    warehouseId: string;
    location: InventoryLocation;
    quantity: number;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    notes?: string;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<InventoryMovement>('/inventory/adjust', data);
      if (response.success) {
        movements.value.unshift(response.data);
        // Refresh inventory
        await fetchInventory();
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore movimento inventario';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function transferInventory(data: {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    fromLocation: InventoryLocation;
    toLocation: InventoryLocation;
    quantity: number;
    notes?: string;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<InventoryMovement>('/inventory/transfer', data);
      if (response.success) {
        movements.value.unshift(response.data);
        await fetchInventory();
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore trasferimento inventario';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getProductStock(productId: string) {
    try {
      const response = await api.get<{
        total: number;
        available: number;
        reserved: number;
        byLocation: Record<InventoryLocation, number>;
      }>(`/inventory/product/${productId}/stock`);

      if (response.success) {
        return response.data;
      }
    } catch {
      return null;
    }
  }

  function setFilters(newFilters: InventoryFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function setPage(page: number) {
    pagination.value.page = page;
    fetchInventory({ page });
  }

  return {
    // State
    inventoryItems,
    movements,
    warehouses,
    loading,
    error,
    pagination,
    filters,

    // Getters
    lowStockItems,
    outOfStockItems,
    totalInventoryValue,
    inventoryByLocation,
    inventoryByWarehouse,
    activeWarehouses,
    primaryWarehouse,

    // Actions
    fetchInventory,
    fetchMovements,
    fetchWarehouses,
    adjustInventory,
    transferInventory,
    getProductStock,
    setFilters,
    clearFilters,
    setPage,
  };
});
