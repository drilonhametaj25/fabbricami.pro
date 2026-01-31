<template>
  <div class="production-orders-page">
    <PageHeader
      title="Ordini di Produzione"
      subtitle="Gestisci gli ordini di produzione e monitora l'avanzamento"
      icon="pi pi-cog"
    >
      <template #actions>
        <Button
          label="Nuovo Ordine"
          icon="pi pi-plus"
          @click="openCreateDialog"
          v-if="canCreate"
        />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Totale Ordini"
          :value="stats.total"
          icon="pi pi-list"
          variant="primary"
          format="number"
          subtitle="ordini registrati"
        />
        <StatsCard
          label="In Bozza"
          :value="stats.draft"
          icon="pi pi-file"
          variant="secondary"
          format="number"
          subtitle="da pianificare"
        />
        <StatsCard
          label="In Lavorazione"
          :value="stats.inProgress"
          icon="pi pi-spin pi-spinner"
          variant="warning"
          format="number"
          subtitle="in corso"
        />
        <StatsCard
          label="Completati"
          :value="stats.completed"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          subtitle="conclusi"
        />
      </div>
    </section>

    <!-- Filters & Table -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per numero ordine..."
              @input="debouncedLoad"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedStatus"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              @change="loadOrders"
              showClear
              class="filter-dropdown"
            />
            <Dropdown
              v-model="selectedProduct"
              :options="products"
              optionLabel="name"
              optionValue="id"
              placeholder="Tutti i prodotti"
              @change="loadOrders"
              showClear
              filter
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="orders"
          :loading="loading"
          paginator
          :rows="20"
          :totalRecords="totalRecords"
          :lazy="true"
          @page="onPage"
          @sort="onSort"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="orderNumber" header="N. Ordine" sortable style="min-width: 150px">
            <template #body="{ data }">
              <span class="order-number-badge">{{ data.orderNumber }}</span>
            </template>
          </Column>

          <Column field="product.name" header="Prodotto" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="product-info">
                <span class="product-name">{{ data.product?.name || '-' }}</span>
                <span class="product-sku">{{ data.product?.sku }}</span>
              </div>
            </template>
          </Column>

          <Column field="quantity" header="Quantità" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span class="quantity-badge">{{ data.quantity }}</span>
            </template>
          </Column>

          <Column field="status" header="Stato" sortable style="min-width: 130px">
            <template #body="{ data }">
              <Tag :severity="getStatusSeverity(data.status)" :value="getStatusLabel(data.status)" />
            </template>
          </Column>

          <Column field="progress" header="Progresso" style="min-width: 150px">
            <template #body="{ data }">
              <div class="progress-cell">
                <ProgressBar :value="calculateProgress(data)" :showValue="false" class="progress-bar" />
                <span class="progress-text">{{ calculateProgress(data) }}%</span>
              </div>
            </template>
          </Column>

          <Column field="priority" header="Priorità" sortable style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="getPrioritySeverity(data.priority)" :value="getPriorityLabel(data.priority)" />
            </template>
          </Column>

          <Column field="plannedStartDate" header="Data Inizio" sortable style="min-width: 120px">
            <template #body="{ data }">
              {{ formatDate(data.plannedStartDate) }}
            </template>
          </Column>

          <Column field="plannedEndDate" header="Data Fine" sortable style="min-width: 120px">
            <template #body="{ data }">
              {{ formatDate(data.plannedEndDate) }}
            </template>
          </Column>

          <Column header="Azioni" style="min-width: 200px" frozen alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-text p-button-sm"
                  @click="viewOrder(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-play"
                  class="p-button-text p-button-sm p-button-success"
                  @click="startOrder(data)"
                  v-if="data.status === 'DRAFT' || data.status === 'PLANNED'"
                  v-tooltip.top="'Avvia'"
                />
                <Button
                  icon="pi pi-check"
                  class="p-button-text p-button-sm p-button-success"
                  @click="completeOrder(data)"
                  v-if="data.status === 'IN_PROGRESS'"
                  v-tooltip.top="'Completa'"
                />
                <Button
                  icon="pi pi-times"
                  class="p-button-text p-button-sm p-button-danger"
                  @click="cancelOrder(data)"
                  v-if="data.status !== 'COMPLETED' && data.status !== 'CANCELLED'"
                  v-tooltip.top="'Annulla'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox"></i>
              <p>Nessun ordine di produzione trovato</p>
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Create Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      header="Nuovo Ordine di Produzione"
      :modal="true"
      :closable="true"
      :style="{ width: '500px' }"
    >
      <div class="dialog-form">
        <div class="form-field">
          <label for="product">Prodotto *</label>
          <Dropdown
            id="product"
            v-model="createForm.productId"
            :options="products"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona prodotto"
            filter
            class="w-full"
            :class="{ 'p-invalid': createErrors.productId }"
          >
            <template #option="{ option }">
              <div class="product-option">
                <span class="option-sku">{{ option.sku }}</span>
                <span class="option-name">{{ option.name }}</span>
              </div>
            </template>
          </Dropdown>
          <small v-if="createErrors.productId" class="p-error">{{ createErrors.productId }}</small>
        </div>

        <div class="form-field">
          <label for="quantity">Quantità *</label>
          <InputNumber
            id="quantity"
            v-model="createForm.quantity"
            :min="1"
            class="w-full"
            :class="{ 'p-invalid': createErrors.quantity }"
          />
          <small v-if="createErrors.quantity" class="p-error">{{ createErrors.quantity }}</small>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="plannedStartDate">Data Inizio Prevista</label>
            <Calendar
              id="plannedStartDate"
              v-model="createForm.plannedStartDate"
              dateFormat="dd/mm/yy"
              showIcon
              class="w-full"
            />
          </div>
          <div class="form-field">
            <label for="plannedEndDate">Data Fine Prevista</label>
            <Calendar
              id="plannedEndDate"
              v-model="createForm.plannedEndDate"
              dateFormat="dd/mm/yy"
              showIcon
              class="w-full"
            />
          </div>
        </div>

        <div class="form-field">
          <label for="priority">Priorità</label>
          <Dropdown
            id="priority"
            v-model="createForm.priority"
            :options="priorityOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona priorità"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="notes">Note</label>
          <Textarea
            id="notes"
            v-model="createForm.notes"
            rows="3"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showCreateDialog = false" />
        <Button label="Crea Ordine" icon="pi pi-check" @click="submitCreate" :loading="creating" />
      </template>
    </Dialog>

    <!-- Detail Dialog -->
    <Dialog
      v-model:visible="showDetailDialog"
      :header="`Ordine ${selectedOrder?.orderNumber || ''}`"
      :modal="true"
      :closable="true"
      :style="{ width: '900px' }"
    >
      <ProductionOrderDetail
        v-if="selectedOrder"
        :order="selectedOrder"
        @phase-started="onPhaseAction"
        @phase-completed="onPhaseAction"
        @refresh="refreshOrder"
      />
    </Dialog>

    <!-- Cancel Confirmation -->
    <Dialog
      v-model:visible="showCancelDialog"
      header="Annulla Ordine"
      :modal="true"
      :closable="true"
      :style="{ width: '400px' }"
    >
      <p>Sei sicuro di voler annullare l'ordine <strong>{{ orderToCancel?.orderNumber }}</strong>?</p>
      <div class="form-field mt-3">
        <label for="cancelReason">Motivo annullamento</label>
        <Textarea
          id="cancelReason"
          v-model="cancelReason"
          rows="3"
          class="w-full"
        />
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showCancelDialog = false" />
        <Button label="Conferma Annullamento" class="p-button-danger" @click="confirmCancel" :loading="cancelling" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { useToast } from 'primevue/usetoast';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import ProductionOrderDetail from '../components/ProductionOrderDetail.vue';
import api from '../services/api.service';
import debounce from 'lodash/debounce';

// PrimeVue components
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  status: string;
  priority: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  phases?: Array<{
    id: string;
    status: string;
    sequence: number;
  }>;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

const authStore = useAuthStore();
const toast = useToast();

// State
const orders = ref<ProductionOrder[]>([]);
const products = ref<Product[]>([]);
const loading = ref(false);
const totalRecords = ref(0);
const currentPage = ref(1);
const search = ref('');
const selectedStatus = ref<string | null>(null);
const selectedProduct = ref<string | null>(null);

// Stats
const stats = ref({
  total: 0,
  draft: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
});

// Create Dialog
const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  productId: '',
  quantity: 1,
  plannedStartDate: null as Date | null,
  plannedEndDate: null as Date | null,
  priority: 0,
  notes: '',
});
const createErrors = ref<Record<string, string>>({});

// Detail Dialog
const showDetailDialog = ref(false);
const selectedOrder = ref<ProductionOrder | null>(null);

// Cancel Dialog
const showCancelDialog = ref(false);
const orderToCancel = ref<ProductionOrder | null>(null);
const cancelReason = ref('');
const cancelling = ref(false);

// Options
const statusOptions = [
  { label: 'Bozza', value: 'DRAFT' },
  { label: 'Pianificato', value: 'PLANNED' },
  { label: 'In Lavorazione', value: 'IN_PROGRESS' },
  { label: 'Completato', value: 'COMPLETED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

const priorityOptions = [
  { label: 'Bassa', value: 0 },
  { label: 'Normale', value: 1 },
  { label: 'Alta', value: 2 },
  { label: 'Urgente', value: 3 },
];

// Computed
const canCreate = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER'].includes(user.role);
});

// Methods
const loadOrders = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: '20',
    });

    if (selectedStatus.value) {
      params.append('status', selectedStatus.value);
    }
    if (selectedProduct.value) {
      params.append('productId', selectedProduct.value);
    }

    const response = await api.get(`/manufacturing/orders?${params}`);
    orders.value = response.data || [];
    totalRecords.value = response.pagination?.total || 0;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel caricamento ordini',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const response = await api.get('/manufacturing/orders/stats');
    stats.value = response.data || { total: 0, draft: 0, inProgress: 0, completed: 0, cancelled: 0 };
  } catch (error) {
    console.error('Error loading stats:', error);
    // Keep default values on error
  }
};

const loadProducts = async () => {
  try {
    const response = await api.get('/products?limit=1000');
    products.value = response.data?.items || response.data || [];
  } catch (error) {
    console.error('Error loading products:', error);
  }
};

const debouncedLoad = debounce(loadOrders, 300);

const onPage = (event: any) => {
  currentPage.value = event.page + 1;
  loadOrders();
};

const onSort = () => {
  loadOrders();
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    PLANNED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'secondary';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    PLANNED: 'Pianificato',
    IN_PROGRESS: 'In Lavorazione',
    COMPLETED: 'Completato',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const getPrioritySeverity = (priority: number) => {
  if (priority >= 3) return 'danger';
  if (priority >= 2) return 'warning';
  if (priority >= 1) return 'info';
  return 'secondary';
};

const getPriorityLabel = (priority: number) => {
  const map: Record<number, string> = {
    0: 'Bassa',
    1: 'Normale',
    2: 'Alta',
    3: 'Urgente',
  };
  return map[priority] || 'Normale';
};

const calculateProgress = (order: ProductionOrder) => {
  if (!order.phases || order.phases.length === 0) return 0;
  const completed = order.phases.filter((p) => p.status === 'COMPLETED' || p.status === 'SKIPPED').length;
  return Math.round((completed / order.phases.length) * 100);
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

// Create Order
const openCreateDialog = () => {
  createForm.value = {
    productId: '',
    quantity: 1,
    plannedStartDate: null,
    plannedEndDate: null,
    priority: 0,
    notes: '',
  };
  createErrors.value = {};
  showCreateDialog.value = true;
};

const validateCreateForm = () => {
  createErrors.value = {};
  if (!createForm.value.productId) {
    createErrors.value.productId = 'Seleziona un prodotto';
  }
  if (!createForm.value.quantity || createForm.value.quantity < 1) {
    createErrors.value.quantity = 'Inserisci una quantità valida';
  }
  return Object.keys(createErrors.value).length === 0;
};

const submitCreate = async () => {
  if (!validateCreateForm()) return;

  creating.value = true;
  try {
    const payload: any = {
      productId: createForm.value.productId,
      quantity: createForm.value.quantity,
      priority: createForm.value.priority,
      notes: createForm.value.notes || undefined,
    };

    if (createForm.value.plannedStartDate) {
      payload.plannedStartDate = createForm.value.plannedStartDate.toISOString();
    }
    if (createForm.value.plannedEndDate) {
      payload.plannedEndDate = createForm.value.plannedEndDate.toISOString();
    }

    await api.post('/manufacturing/orders', payload);

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Ordine di produzione creato',
      life: 3000,
    });

    showCreateDialog.value = false;
    loadOrders();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nella creazione',
      life: 3000,
    });
  } finally {
    creating.value = false;
  }
};

// View Order
const viewOrder = async (order: ProductionOrder) => {
  try {
    const response = await api.get(`/manufacturing/orders/${order.id}`);
    selectedOrder.value = response.data;
    showDetailDialog.value = true;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dettagli',
      life: 3000,
    });
  }
};

const refreshOrder = async () => {
  if (!selectedOrder.value) return;
  try {
    const response = await api.get(`/manufacturing/orders/${selectedOrder.value.id}`);
    selectedOrder.value = response.data;
  } catch (error) {
    console.error('Error refreshing order:', error);
  }
};

const onPhaseAction = () => {
  refreshOrder();
  loadStats();
};

// Start Order (start first phase)
const startOrder = async (order: ProductionOrder) => {
  try {
    const response = await api.get(`/manufacturing/orders/${order.id}`);
    const fullOrder = response.data;

    if (fullOrder?.phases && fullOrder.phases.length > 0) {
      const firstPendingPhase = fullOrder.phases.find((p: any) => p.status === 'PENDING');
      if (firstPendingPhase) {
        await api.post(`/manufacturing/production-phases/${firstPendingPhase.id}/start`);
        toast.add({
          severity: 'success',
          summary: 'Successo',
          detail: 'Ordine avviato',
          life: 3000,
        });
        loadOrders();
        loadStats();
      }
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || "Errore nell'avvio ordine",
      life: 3000,
    });
  }
};

// Complete Order
const completeOrder = async (order: ProductionOrder) => {
  try {
    await api.post(`/manufacturing/orders/${order.id}/complete`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Ordine completato',
      life: 3000,
    });
    loadOrders();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel completamento',
      life: 3000,
    });
  }
};

// Cancel Order
const cancelOrder = (order: ProductionOrder) => {
  orderToCancel.value = order;
  cancelReason.value = '';
  showCancelDialog.value = true;
};

const confirmCancel = async () => {
  if (!orderToCancel.value) return;

  cancelling.value = true;
  try {
    await api.post(`/manufacturing/orders/${orderToCancel.value.id}/cancel`, {
      reason: cancelReason.value || undefined,
    });

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Ordine annullato',
      life: 3000,
    });

    showCancelDialog.value = false;
    loadOrders();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || "Errore nell'annullamento",
      life: 3000,
    });
  } finally {
    cancelling.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadOrders();
  loadStats();
  loadProducts();
});
</script>

<style scoped>
.production-orders-page {
  padding: 1.5rem;
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.table-card {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.search-wrapper {
  position: relative;
}

.search-wrapper .search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-color-secondary);
}

.search-wrapper .search-input {
  padding-left: 36px;
  width: 300px;
}

.filters {
  display: flex;
  gap: 0.75rem;
}

.filter-dropdown {
  min-width: 180px;
}

.order-number-badge {
  font-family: monospace;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-info .product-name {
  font-weight: 500;
}

.product-info .product-sku {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  font-family: monospace;
}

.quantity-badge {
  font-weight: 600;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-cell .progress-bar {
  flex: 1;
  height: 8px;
}

.progress-cell .progress-text {
  font-size: 0.75rem;
  min-width: 35px;
  text-align: right;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-color-secondary);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.product-option {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.product-option .option-sku {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  background: var(--surface-100);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.product-option .option-name {
  font-weight: 500;
}

.w-full {
  width: 100%;
}

.mt-3 {
  margin-top: 0.75rem;
}
</style>
