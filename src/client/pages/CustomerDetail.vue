<template>
  <div class="customer-detail-page">
    <!-- Header con navigazione -->
    <div class="page-nav">
      <Button
        icon="pi pi-arrow-left"
        label="Torna ai Clienti"
        class="p-button-text"
        @click="$router.push('/customers')"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Caricamento dati cliente...</p>
    </div>

    <!-- Customer Content -->
    <template v-else-if="customer">
      <!-- Header Cliente -->
      <section class="customer-header">
        <div class="header-content">
          <div class="customer-identity">
            <div class="customer-avatar" :class="customer.type.toLowerCase()">
              <i :class="customer.type === 'B2B' ? 'pi pi-building' : 'pi pi-user'"></i>
            </div>
            <div class="customer-info">
              <h1>{{ customerDisplayName }}</h1>
              <div class="customer-meta">
                <Tag :severity="customer.type === 'B2B' ? 'info' : 'success'">{{ customer.type }}</Tag>
                <span class="code">{{ customer.code }}</span>
                <Tag v-if="!customer.isActive" severity="danger">Inattivo</Tag>
                <Tag v-if="analytics?.rfmScore" :severity="getRfmSeverity(analytics.rfmScore.segment)">
                  {{ getRfmLabel(analytics.rfmScore.segment) }}
                </Tag>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <Button icon="pi pi-pencil" label="Modifica" @click="editCustomer" />
            <Button icon="pi pi-refresh" label="Aggiorna Stats" severity="secondary" @click="refreshStats" />
          </div>
        </div>
      </section>

      <!-- KPI Cards -->
      <section class="stats-section">
        <div class="stats-grid">
          <StatsCard
            label="Totale Ordini"
            :value="analytics?.purchaseMetrics?.totalOrders || 0"
            icon="pi pi-shopping-cart"
            variant="primary"
            format="number"
          />
          <StatsCard
            label="Totale Speso"
            :value="analytics?.purchaseMetrics?.totalSpent || 0"
            icon="pi pi-euro"
            variant="success"
            format="currency"
          />
          <StatsCard
            label="Valore Medio Ordine"
            :value="analytics?.purchaseMetrics?.averageOrderValue || 0"
            icon="pi pi-chart-bar"
            variant="info"
            format="currency"
          />
          <StatsCard
            label="Ordini/Mese"
            :value="analytics?.frequency?.ordersPerMonth || 0"
            icon="pi pi-calendar"
            variant="warning"
            format="decimal"
          />
        </div>
      </section>

      <!-- Main Content -->
      <section class="main-content">
        <div class="content-grid">
          <!-- Left Column: Charts & Analytics -->
          <div class="left-column">
            <!-- Spending Chart -->
            <div class="card">
              <div class="card-header">
                <h3>Spesa Mensile (Ultimi 12 mesi)</h3>
              </div>
              <div class="card-body">
                <Chart
                  v-if="spendingChartData.labels.length"
                  type="bar"
                  :data="spendingChartData"
                  :options="chartOptions"
                  class="spending-chart"
                />
                <div v-else class="no-data">
                  <i class="pi pi-chart-bar"></i>
                  <p>Nessun dato disponibile</p>
                </div>
              </div>
            </div>

            <!-- Top Products -->
            <div class="card">
              <div class="card-header">
                <h3>Prodotti Preferiti</h3>
              </div>
              <div class="card-body">
                <DataTable
                  v-if="analytics?.topProducts?.length"
                  :value="analytics.topProducts"
                  :rows="5"
                  class="products-table"
                >
                  <Column field="productName" header="Prodotto">
                    <template #body="{ data }">
                      <div class="product-cell">
                        <span class="product-name">{{ data.productName }}</span>
                        <span class="product-sku">{{ data.sku }}</span>
                      </div>
                    </template>
                  </Column>
                  <Column field="totalQuantity" header="Qtà" style="width: 80px">
                    <template #body="{ data }">
                      <span class="quantity-badge">{{ data.totalQuantity }}</span>
                    </template>
                  </Column>
                  <Column field="totalSpent" header="Speso" style="width: 120px">
                    <template #body="{ data }">
                      <span class="spent-value">{{ formatCurrency(data.totalSpent) }}</span>
                    </template>
                  </Column>
                </DataTable>
                <div v-else class="no-data">
                  <i class="pi pi-box"></i>
                  <p>Nessun prodotto acquistato</p>
                </div>
              </div>
            </div>

            <!-- RFM Score -->
            <div class="card" v-if="analytics?.rfmScore">
              <div class="card-header">
                <h3>Analisi RFM</h3>
              </div>
              <div class="card-body">
                <div class="rfm-grid">
                  <div class="rfm-item">
                    <div class="rfm-score">{{ analytics.rfmScore.recency }}/5</div>
                    <div class="rfm-label">Recency</div>
                    <div class="rfm-desc">Ultimo ordine</div>
                  </div>
                  <div class="rfm-item">
                    <div class="rfm-score">{{ analytics.rfmScore.frequency }}/5</div>
                    <div class="rfm-label">Frequency</div>
                    <div class="rfm-desc">N. ordini</div>
                  </div>
                  <div class="rfm-item">
                    <div class="rfm-score">{{ analytics.rfmScore.monetary }}/5</div>
                    <div class="rfm-label">Monetary</div>
                    <div class="rfm-desc">Spesa totale</div>
                  </div>
                  <div class="rfm-item rfm-total">
                    <div class="rfm-score">{{ analytics.rfmScore.total }}/15</div>
                    <div class="rfm-label">Score Totale</div>
                    <Tag :severity="getRfmSeverity(analytics.rfmScore.segment)" class="rfm-segment">
                      {{ getRfmLabel(analytics.rfmScore.segment) }}
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Info & Orders -->
          <div class="right-column">
            <!-- Customer Info -->
            <div class="card">
              <div class="card-header">
                <h3>Informazioni</h3>
              </div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-item" v-if="customer.email">
                    <i class="pi pi-envelope"></i>
                    <span>{{ customer.email }}</span>
                  </div>
                  <div class="info-item" v-if="customer.phone">
                    <i class="pi pi-phone"></i>
                    <span>{{ customer.phone }}</span>
                  </div>
                  <div class="info-item" v-if="customer.pecEmail">
                    <i class="pi pi-at"></i>
                    <span>{{ customer.pecEmail }} (PEC)</span>
                  </div>
                  <div v-if="customer.type === 'B2B'" class="info-divider"></div>
                  <div class="info-item" v-if="customer.taxId">
                    <span class="info-label">P.IVA:</span>
                    <span>{{ customer.taxId }}</span>
                  </div>
                  <div class="info-item" v-if="customer.fiscalCode">
                    <span class="info-label">C.F.:</span>
                    <span>{{ customer.fiscalCode }}</span>
                  </div>
                  <div class="info-item" v-if="customer.sdiCode">
                    <span class="info-label">SDI:</span>
                    <span>{{ customer.sdiCode }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Frequency Stats -->
            <div class="card">
              <div class="card-header">
                <h3>Statistiche Frequenza</h3>
              </div>
              <div class="card-body">
                <div class="freq-stats">
                  <div class="freq-item">
                    <span class="freq-label">Primo ordine:</span>
                    <span class="freq-value">
                      {{ analytics?.frequency?.firstOrderDate ? formatDate(analytics.frequency.firstOrderDate) : '-' }}
                    </span>
                  </div>
                  <div class="freq-item">
                    <span class="freq-label">Ultimo ordine:</span>
                    <span class="freq-value">
                      {{ analytics?.frequency?.lastOrderDate ? formatDate(analytics.frequency.lastOrderDate) : '-' }}
                    </span>
                  </div>
                  <div class="freq-item">
                    <span class="freq-label">Cliente da:</span>
                    <span class="freq-value">{{ analytics?.frequency?.customerLifetimeDays || 0 }} giorni</span>
                  </div>
                  <div class="freq-item">
                    <span class="freq-label">Giorni medi tra ordini:</span>
                    <span class="freq-value">{{ analytics?.frequency?.averageDaysBetweenOrders || '-' }}</span>
                  </div>
                  <div class="freq-item">
                    <span class="freq-label">Articoli per ordine:</span>
                    <span class="freq-value">{{ analytics?.purchaseMetrics?.averageItemsPerOrder || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Commercial Terms (B2B) -->
            <div class="card" v-if="customer.type === 'B2B'">
              <div class="card-header">
                <h3>Condizioni Commerciali</h3>
              </div>
              <div class="card-body">
                <div class="terms-list">
                  <div class="term-item">
                    <span class="term-label">Termini pagamento:</span>
                    <span class="term-value">{{ customer.paymentTerms }} giorni</span>
                  </div>
                  <div class="term-item" v-if="customer.discount">
                    <span class="term-label">Sconto:</span>
                    <span class="term-value">{{ customer.discount }}%</span>
                  </div>
                  <div class="term-item" v-if="customer.creditLimit">
                    <span class="term-label">Fido:</span>
                    <span class="term-value">{{ formatCurrency(customer.creditLimit) }}</span>
                  </div>
                  <div class="term-item" v-if="customer.priceList">
                    <span class="term-label">Listino:</span>
                    <span class="term-value">{{ customer.priceList.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Orders Section -->
      <section class="orders-section">
        <div class="card full-width">
          <div class="card-header">
            <h3>Storico Ordini</h3>
            <div class="orders-filters">
              <Dropdown
                v-model="ordersFilter.status"
                :options="orderStatuses"
                optionLabel="label"
                optionValue="value"
                placeholder="Stato"
                showClear
                @change="loadOrders"
              />
            </div>
          </div>
          <div class="card-body">
            <DataTable
              v-if="orders.items.length"
              :value="orders.items"
              :loading="ordersLoading"
              paginator
              :rows="10"
              :totalRecords="orders.pagination.total"
              :lazy="true"
              @page="onPageChange"
              class="orders-table"
            >
              <Column field="orderNumber" header="Ordine" style="width: 140px">
                <template #body="{ data }">
                  <span class="order-number">{{ data.orderNumber }}</span>
                </template>
              </Column>
              <Column field="orderDate" header="Data" style="width: 120px">
                <template #body="{ data }">
                  {{ formatDate(data.orderDate) }}
                </template>
              </Column>
              <Column field="source" header="Origine" style="width: 100px">
                <template #body="{ data }">
                  <Tag :severity="data.source === 'WORDPRESS' ? 'warning' : 'info'">
                    {{ data.source }}
                  </Tag>
                </template>
              </Column>
              <Column field="status" header="Stato" style="width: 120px">
                <template #body="{ data }">
                  <Tag :severity="getOrderStatusSeverity(data.status)">
                    {{ getOrderStatusLabel(data.status) }}
                  </Tag>
                </template>
              </Column>
              <Column header="Articoli" style="width: 80px">
                <template #body="{ data }">
                  {{ data.items?.length || 0 }}
                </template>
              </Column>
              <Column field="total" header="Totale" style="width: 120px">
                <template #body="{ data }">
                  <span class="order-total">{{ formatCurrency(data.total) }}</span>
                </template>
              </Column>
              <Column header="" style="width: 60px">
                <template #body="{ data }">
                  <Button
                    icon="pi pi-eye"
                    class="p-button-rounded p-button-text"
                    @click="viewOrder(data)"
                    v-tooltip.top="'Visualizza'"
                  />
                </template>
              </Column>
            </DataTable>
            <div v-else class="no-data">
              <i class="pi pi-inbox"></i>
              <p>Nessun ordine trovato</p>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Not Found -->
    <div v-else class="not-found">
      <i class="pi pi-exclamation-circle"></i>
      <h2>Cliente non trovato</h2>
      <Button label="Torna ai Clienti" @click="$router.push('/customers')" />
    </div>

    <!-- Customer Edit Dialog -->
    <CustomerDialog
      v-model:visible="showEditDialog"
      :customer="customer"
      @saved="onCustomerSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dropdown from 'primevue/dropdown';
import ProgressSpinner from 'primevue/progressspinner';
import Chart from 'primevue/chart';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import StatsCard from '../components/StatsCard.vue';
import CustomerDialog from '../components/CustomerDialog.vue';
import type { Customer } from '../types';

interface CustomerAnalytics {
  purchaseMetrics: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    averageItemsPerOrder: number;
    totalItemsPurchased: number;
  };
  frequency: {
    ordersPerMonth: number;
    averageDaysBetweenOrders: number | null;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    customerLifetimeDays: number;
  };
  trends: {
    monthlySpending: { month: string; spent: number; orders: number }[];
    ordersByStatus: Record<string, number>;
    ordersBySource: Record<string, number>;
  };
  topProducts: {
    productId: string;
    productName: string;
    sku: string;
    totalQuantity: number;
    totalSpent: number;
    orderCount: number;
  }[];
  rfmScore: {
    recency: number;
    frequency: number;
    monetary: number;
    total: number;
    segment: string;
  } | null;
}

const route = useRoute();
const router = useRouter();
const toast = useToast();

const loading = ref(true);
const ordersLoading = ref(false);
const customer = ref<Customer | null>(null);
const analytics = ref<CustomerAnalytics | null>(null);
const showEditDialog = ref(false);

const orders = ref<{
  items: any[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}>({
  items: [],
  pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
});

const ordersFilter = ref({
  status: null as string | null,
  page: 1,
});

const orderStatuses = [
  { label: 'In Attesa', value: 'PENDING' },
  { label: 'Confermato', value: 'CONFIRMED' },
  { label: 'In Lavorazione', value: 'PROCESSING' },
  { label: 'Pronto', value: 'READY' },
  { label: 'Spedito', value: 'SHIPPED' },
  { label: 'Consegnato', value: 'DELIVERED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

const customerDisplayName = computed(() => {
  if (!customer.value) return '';
  return customer.value.businessName || `${customer.value.firstName || ''} ${customer.value.lastName || ''}`.trim();
});

const spendingChartData = computed(() => {
  if (!analytics.value?.trends?.monthlySpending) {
    return { labels: [], datasets: [] };
  }

  return {
    labels: analytics.value.trends.monthlySpending.map(m => {
      const [year, month] = m.month.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Spesa',
        data: analytics.value.trends.monthlySpending.map(m => m.spent),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value: number) => formatCurrency(value),
      },
    },
  },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('it-IT');
};

const getRfmSeverity = (segment: string) => {
  const severities: Record<string, string> = {
    champions: 'success',
    loyal: 'info',
    potential: 'warning',
    atRisk: 'warning',
    hibernating: 'secondary',
    lost: 'danger',
  };
  return severities[segment] || 'secondary';
};

const getRfmLabel = (segment: string) => {
  const labels: Record<string, string> = {
    champions: 'Champion',
    loyal: 'Fedele',
    potential: 'Potenziale',
    atRisk: 'A Rischio',
    hibernating: 'Dormiente',
    lost: 'Perso',
  };
  return labels[segment] || segment;
};

const getOrderStatusSeverity = (status: string) => {
  const severities: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'info',
    PROCESSING: 'info',
    READY: 'success',
    SHIPPED: 'success',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    REFUNDED: 'danger',
  };
  return severities[status] || 'secondary';
};

const getOrderStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'In Attesa',
    CONFIRMED: 'Confermato',
    PROCESSING: 'In Lavorazione',
    READY: 'Pronto',
    SHIPPED: 'Spedito',
    DELIVERED: 'Consegnato',
    CANCELLED: 'Annullato',
    REFUNDED: 'Rimborsato',
  };
  return labels[status] || status;
};

const loadCustomer = async () => {
  try {
    loading.value = true;
    const id = route.params.id as string;
    const response = await api.get(`/customers/${id}`);
    if (response.success) {
      customer.value = response.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento cliente',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadAnalytics = async () => {
  try {
    const id = route.params.id as string;
    const response = await api.get(`/customers/${id}/analytics`);
    if (response.success) {
      analytics.value = response.data;
    }
  } catch (error: any) {
    console.error('Error loading analytics:', error);
  }
};

const loadOrders = async () => {
  try {
    ordersLoading.value = true;
    const id = route.params.id as string;
    const params = new URLSearchParams({
      page: ordersFilter.value.page.toString(),
      limit: '10',
      ...(ordersFilter.value.status && { status: ordersFilter.value.status }),
    });

    const response = await api.get(`/customers/${id}/orders?${params.toString()}`);
    if (response.success) {
      orders.value = response.data;
    }
  } catch (error: any) {
    console.error('Error loading orders:', error);
  } finally {
    ordersLoading.value = false;
  }
};

const onPageChange = (event: any) => {
  ordersFilter.value.page = event.page + 1;
  loadOrders();
};

const editCustomer = () => {
  showEditDialog.value = true;
};

const onCustomerSaved = () => {
  loadCustomer();
  loadAnalytics();
};

const refreshStats = async () => {
  try {
    const id = route.params.id as string;
    await api.post(`/customers/${id}/stats/refresh`);
    await loadCustomer();
    await loadAnalytics();
    toast.add({
      severity: 'success',
      summary: 'Aggiornato',
      detail: 'Statistiche cliente aggiornate',
      life: 3000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};

const viewOrder = (order: any) => {
  router.push(`/orders?id=${order.id}`);
};

onMounted(async () => {
  await loadCustomer();
  await Promise.all([loadAnalytics(), loadOrders()]);
});

watch(() => route.params.id, async () => {
  await loadCustomer();
  await Promise.all([loadAnalytics(), loadOrders()]);
});
</script>

<style scoped>
.customer-detail-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--space-6);
}

.page-nav {
  margin-bottom: var(--space-4);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--space-4);
  color: var(--color-gray-500);
}

/* Customer Header */
.customer-header {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.customer-identity {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.customer-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.customer-avatar.b2b {
  background: var(--color-info-100);
}

.customer-avatar.b2c {
  background: var(--color-success-100);
}

.customer-avatar i {
  font-size: 2rem;
  color: var(--color-primary-600);
}

.customer-info h1 {
  margin: 0 0 var(--space-2) 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-gray-900);
}

.customer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.customer-meta .code {
  font-family: var(--font-mono);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

/* Main Content */
.main-content {
  margin-bottom: var(--space-6);
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
}

/* Cards */
.card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  overflow: hidden;
}

.card.full-width {
  grid-column: 1 / -1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.card-header h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-800);
}

.card-body {
  padding: var(--space-5);
}

/* Columns */
.left-column, .right-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Spending Chart */
.spending-chart {
  height: 250px;
}

/* Products Table */
.products-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
}

.product-cell {
  display: flex;
  flex-direction: column;
}

.product-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.product-sku {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  font-family: var(--font-mono);
}

.quantity-badge {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.spent-value {
  font-weight: 600;
  color: var(--color-success-600);
}

/* RFM Grid */
.rfm-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.rfm-item {
  text-align: center;
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.rfm-score {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary-600);
  margin-bottom: var(--space-1);
}

.rfm-label {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.rfm-desc {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.rfm-total {
  background: var(--color-primary-50);
}

.rfm-segment {
  margin-top: var(--space-2);
}

/* Info List */
.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

.info-item i {
  color: var(--color-gray-400);
  width: 20px;
}

.info-label {
  font-weight: 500;
  color: var(--color-gray-600);
  min-width: 60px;
}

.info-divider {
  border-top: var(--border-width) solid var(--border-color-light);
  margin: var(--space-2) 0;
}

/* Frequency Stats */
.freq-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.freq-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  padding: var(--space-2) 0;
  border-bottom: var(--border-width) dashed var(--border-color-light);
}

.freq-item:last-child {
  border-bottom: none;
}

.freq-label {
  color: var(--color-gray-600);
}

.freq-value {
  font-weight: 600;
  color: var(--color-gray-900);
}

/* Terms List */
.terms-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.term-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.term-label {
  color: var(--color-gray-600);
}

.term-value {
  font-weight: 600;
  color: var(--color-gray-900);
}

/* Orders Section */
.orders-section {
  margin-bottom: var(--space-6);
}

.orders-filters {
  display: flex;
  gap: var(--space-2);
}

.orders-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
}

.order-number {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-primary-700);
}

.order-total {
  font-weight: 600;
  color: var(--color-gray-900);
}

/* No Data */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-gray-400);
}

.no-data i {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
}

/* Not Found */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--space-4);
  color: var(--color-gray-500);
}

.not-found i {
  font-size: 4rem;
  color: var(--color-gray-300);
}

.not-found h2 {
  margin: 0;
  color: var(--color-gray-600);
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .rfm-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .customer-detail-page {
    padding: var(--space-4);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .rfm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
