<template>
  <div class="orders-page">
    <PageHeader
      title="Gestione Ordini"
      subtitle="Monitora gli ordini da web, B2B e fornitori con gestione workflow"
      icon="pi pi-shopping-cart"
    >
      <template #actions>
        <Button label="Nuovo Ordine" icon="pi pi-plus" @click="showCreateDialog = true" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Ordini Totali"
          :value="stats.totalOrders"
          icon="pi pi-shopping-cart"
          variant="primary"
          format="number"
          subtitle="nel sistema"
        />
        <StatsCard
          label="In Lavorazione"
          :value="stats.processing"
          icon="pi pi-clock"
          variant="warning"
          format="number"
          subtitle="da evadere"
        />
        <StatsCard
          label="Fatturato Mese"
          :value="stats.monthRevenue"
          icon="pi pi-euro"
          variant="success"
          format="currency"
          :trend="12"
        />
        <StatsCard
          label="Completati"
          :value="stats.completed"
          icon="pi pi-check-circle"
          variant="info"
          format="number"
          :subtitle="`${stats.totalOrders > 0 ? Math.round((stats.completed / stats.totalOrders) * 100) : 0}% evasi`"
        />
      </div>
    </section>

    <!-- Tab Views -->
    <TabView class="orders-tabs">
      <!-- Tab: Lista Ordini -->
      <TabPanel>
        <template #header>
          <i class="pi pi-list mr-2"></i>
          <span>Lista Ordini</span>
        </template>

        <div class="table-card">
          <div class="table-toolbar">
          <div class="toolbar-filters">
            <Dropdown
              v-model="selectedStatus"
              :options="statuses"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              @change="loadOrders"
              showClear
              class="filter-dropdown"
            />
            <Dropdown
              v-model="selectedSource"
              :options="sources"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutte le sorgenti"
              @change="loadOrders"
              showClear
              class="filter-dropdown"
            />
            <Dropdown
              v-model="selectedPaymentStatus"
              :options="paymentStatuses"
              optionLabel="label"
              optionValue="value"
              placeholder="Stato Pagamento"
              @change="loadOrders"
              showClear
              class="filter-dropdown"
            />
          </div>
          <div class="toolbar-info">
            <span class="results-count">{{ orders.length }} ordini</span>
          </div>
        </div>

        <DataTable
          :value="orders"
          :loading="loading"
          paginator
          :rows="20"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="orderNumber" header="N. Ordine" sortable style="min-width: 140px">
            <template #body="{ data }">
              <span class="order-number">{{ data.orderNumber }}</span>
            </template>
          </Column>
          <Column field="customer.businessName" header="Cliente" style="min-width: 200px">
            <template #body="{ data }">
              <div class="customer-cell">
                <span class="customer-name">
                  {{ data.customer.businessName || `${data.customer.firstName} ${data.customer.lastName}` }}
                </span>
              </div>
            </template>
          </Column>
          <Column field="source" header="Sorgente" style="min-width: 120px">
            <template #body="{ data }">
              <Tag :severity="getSourceSeverity(data.source)" class="source-tag">
                {{ data.source }}
              </Tag>
            </template>
          </Column>
          <Column field="orderDate" header="Data" sortable style="min-width: 110px">
            <template #body="{ data }">
              <span class="date-cell">{{ formatDate(data.orderDate) }}</span>
            </template>
          </Column>
          <Column field="total" header="Totale" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="total-cell">{{ formatCurrency(data.total) }}</span>
            </template>
          </Column>
          <Column field="status" header="Stato" style="min-width: 130px">
            <template #body="{ data }">
              <Tag :severity="getStatusSeverity(data.status)" class="status-tag">
                {{ getStatusLabel(data.status) }}
              </Tag>
            </template>
          </Column>
          <Column header="Pagamento" style="min-width: 150px">
            <template #body="{ data }">
              <div class="payment-cell">
                <ProgressBar
                  :value="getPaymentProgress(data)"
                  :showValue="false"
                  :class="getPaymentProgressClass(data)"
                  style="height: 8px; border-radius: 4px;"
                />
                <div class="payment-info">
                  <span class="paid-amount">{{ formatCurrency(data.paidAmount || 0) }}</span>
                  <span class="total-amount">/ {{ formatCurrency(data.total) }}</span>
                </div>
              </div>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 140px">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn"
                  @click="viewOrder(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn"
                  @click="editOrder(data)"
                  v-tooltip.top="'Modifica'"
                  :disabled="data.status === 'DELIVERED' || data.status === 'CANCELLED'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox empty-state__icon"></i>
              <p class="empty-state__text">Nessun ordine trovato</p>
            </div>
          </template>
        </DataTable>
        </div>
      </TabPanel>

      <!-- Tab: Timeline -->
      <TabPanel>
        <template #header>
          <i class="pi pi-chart-line mr-2"></i>
          <span>Timeline</span>
        </template>
        <OrdersTimelineChart />
      </TabPanel>

      <!-- Tab: Ottimizzazione -->
      <TabPanel>
        <template #header>
          <i class="pi pi-lightbulb mr-2"></i>
          <span>Ottimizzazione</span>
        </template>
        <OrderOptimizationPanel @action-executed="onOptimizationAction" />
      </TabPanel>
    </TabView>

    <!-- Order Detail Dialog -->
    <OrderDetailDialog
      v-model="showDetailDialog"
      :orderId="selectedOrderId"
      @refresh="loadOrders"
    />

    <!-- Order Create/Edit Dialog (Full) -->
    <OrderCreateDialog
      v-model="showCreateDialog"
      :editOrder="editingOrder"
      @saved="onOrderSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import OrderDetailDialog from '../components/OrderDetailDialog.vue';
import OrderCreateDialog from '../components/OrderCreateDialog.vue';
import OrdersTimelineChart from '../components/OrdersTimelineChart.vue';
import OrderOptimizationPanel from '../components/OrderOptimizationPanel.vue';

const toast = useToast();

const stats = ref({
  totalOrders: 0,
  processing: 0,
  monthRevenue: 0,
  completed: 0,
});
const loading = ref(false);
const orders = ref<any[]>([]);
const selectedStatus = ref(null);
const selectedSource = ref(null);
const selectedPaymentStatus = ref(null);

// Payment status filter options
const paymentStatuses = ref([
  { label: 'Da Incassare', value: 'UNPAID' },
  { label: 'Parziale', value: 'PARTIAL' },
  { label: 'Incassato', value: 'PAID' },
  { label: 'Scaduto', value: 'OVERDUE' },
]);

// Dialog states
const showDetailDialog = ref(false);
const showCreateDialog = ref(false);
const selectedOrderId = ref<string | undefined>(undefined);
const editingOrder = ref<any>(null);

const statuses = ref([
  { label: 'In Attesa', value: 'PENDING' },
  { label: 'Confermato', value: 'CONFIRMED' },
  { label: 'In Lavorazione', value: 'PROCESSING' },
  { label: 'Spedito', value: 'SHIPPED' },
  { label: 'Consegnato', value: 'DELIVERED' },
  { label: 'Annullato', value: 'CANCELLED' },
]);

const sources = ref([
  { label: 'WordPress', value: 'WORDPRESS' },
  { label: 'B2B', value: 'B2B' },
  { label: 'Manuale', value: 'MANUAL' },
]);

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'info',
    PROCESSING: 'info',
    SHIPPED: 'success',
    DELIVERED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

const getSourceSeverity = (source: string) => {
  const map: Record<string, string> = {
    WORDPRESS: 'info',
    B2B: 'success',
    MANUAL: 'warning',
  };
  return map[source] || 'info';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'In Attesa',
    CONFIRMED: 'Confermato',
    PROCESSING: 'In Lavorazione',
    READY: 'Pronto',
    SHIPPED: 'Spedito',
    DELIVERED: 'Consegnato',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Payment progress helpers
const getPaymentProgress = (order: any) => {
  if (!order.total || order.total === 0) return 0;
  const paid = order.paidAmount || 0;
  return Math.round((paid / order.total) * 100);
};

const getPaymentProgressClass = (order: any) => {
  const progress = getPaymentProgress(order);
  if (progress >= 100) return 'progress-paid';
  if (progress > 0) return 'progress-partial';
  return 'progress-unpaid';
};

const getPaymentStatusForFilter = (order: any) => {
  const progress = getPaymentProgress(order);
  if (progress >= 100) return 'PAID';
  if (progress > 0) return 'PARTIAL';
  // Check if any payment due is overdue
  if (order.paymentDues?.some((pd: any) =>
    pd.status !== 'PAID' && new Date(pd.dueDate) < new Date()
  )) {
    return 'OVERDUE';
  }
  return 'UNPAID';
};

const loadStats = async () => {
  try {
    const response = await api.get('/orders?limit=500');
    const allOrders = response.data?.items || [];

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    stats.value = {
      totalOrders: allOrders.length,
      processing: allOrders.filter((o: any) => ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(o.status)).length,
      monthRevenue: allOrders
        .filter((o: any) => new Date(o.orderDate) >= firstDayOfMonth)
        .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
      completed: allOrders.filter((o: any) => ['DELIVERED', 'SHIPPED'].includes(o.status)).length,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadOrders = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: '1',
      limit: '200',
      ...(selectedStatus.value && { status: selectedStatus.value }),
      ...(selectedSource.value && { source: selectedSource.value }),
    });

    const response = await api.get(`/orders?${params.toString()}`);

    if (response.success) {
      let fetchedOrders = response.data?.items || [];

      // Client-side payment status filtering
      if (selectedPaymentStatus.value) {
        fetchedOrders = fetchedOrders.filter((order: any) => {
          const status = getPaymentStatusForFilter(order);
          return status === selectedPaymentStatus.value;
        });
      }

      orders.value = fetchedOrders;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento ordini',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// View order detail
const viewOrder = (order: any) => {
  selectedOrderId.value = order.id;
  showDetailDialog.value = true;
};

// Edit order
const editOrder = (order: any) => {
  editingOrder.value = order;
  showCreateDialog.value = true;
};

// Handle order saved
const onOrderSaved = () => {
  editingOrder.value = null;
  loadOrders();
  loadStats();
};

// Handle optimization action
const onOptimizationAction = (suggestion: any) => {
  // Se l'utente vuole vedere gli ordini suggeriti, potremmo filtrare
  console.log('Optimization action:', suggestion);

  // Per ora mostriamo un messaggio informativo
  // In futuro potremmo implementare azioni dirette come:
  // - Aprire dialog batch production
  // - Preparare spedizione consolidata
  // - Selezionare ordini nel DataTable
};

onMounted(() => {
  loadOrders();
  loadStats();
});
</script>

<style scoped>
.orders-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-6);
}

/* Tabs */
.orders-tabs {
  margin-top: var(--space-6);
}

.orders-tabs :deep(.p-tabview-nav) {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  padding: 0 var(--space-4);
}

.orders-tabs :deep(.p-tabview-nav li) {
  margin-right: var(--space-2);
}

.orders-tabs :deep(.p-tabview-nav li .p-tabview-nav-link) {
  padding: var(--space-4) var(--space-5);
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.orders-tabs :deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
  color: var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
}

.orders-tabs :deep(.p-tabview-panels) {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-top: none;
  border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
  padding: var(--space-6);
}

.mr-2 {
  margin-right: 0.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* Table Card (inside tab) */
.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
}

.toolbar-filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

.toolbar-info {
  display: flex;
  align-items: center;
}

.results-count {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-weight: 500;
}

/* Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

.custom-table :deep(.p-paginator) {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Cell Styles */
.order-number {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.customer-cell {
  display: flex;
  flex-direction: column;
}

.customer-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.source-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.date-cell {
  color: var(--color-gray-600);
}

.total-cell {
  font-weight: 700;
  color: var(--color-gray-900);
}

.status-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

/* Payment Cell */
.payment-cell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.payment-cell :deep(.p-progressbar) {
  background: var(--surface-200);
}

.payment-cell :deep(.p-progressbar-value) {
  background: var(--primary-color);
}

.payment-cell :deep(.progress-paid .p-progressbar-value) {
  background: var(--green-500);
}

.payment-cell :deep(.progress-partial .p-progressbar-value) {
  background: var(--yellow-500);
}

.payment-cell :deep(.progress-unpaid .p-progressbar-value) {
  background: var(--red-400);
}

.payment-info {
  font-size: var(--font-size-xs);
  display: flex;
  gap: 0.25rem;
}

.payment-info .paid-amount {
  font-weight: 600;
  color: var(--color-gray-700);
}

.payment-info .total-amount {
  color: var(--color-gray-400);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
  color: var(--color-primary-600) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__text {
  color: var(--color-gray-500);
  margin: 0;
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .toolbar-info {
    justify-content: center;
  }
}

/* Order Form Dialog */
.order-form {
  padding: var(--space-2);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field.full-width {
  grid-column: 1 / -1;
}

.field label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.items-section {
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

.items-section h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
}

.item-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  align-items: center;
}

.item-product {
  flex: 3;
}

.item-qty {
  flex: 1;
  min-width: 80px;
}

.item-price {
  flex: 1.5;
  min-width: 120px;
}

.w-full {
  width: 100%;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .item-row {
    flex-wrap: wrap;
  }

  .item-product {
    flex: 100%;
  }
}
</style>
