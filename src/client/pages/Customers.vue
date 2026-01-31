<template>
  <div class="customers-page">
    <PageHeader
      title="Gestione Clienti"
      subtitle="Anagrafica clienti B2C e B2B con storico ordini e statistiche"
      icon="pi pi-users"
    >
      <template #actions>
        <Button label="Nuovo Cliente" icon="pi pi-plus" @click="showCustomerDialog = true" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Clienti Totali"
          :value="stats.totalCustomers"
          icon="pi pi-users"
          variant="primary"
          format="number"
          subtitle="in anagrafica"
        />
        <StatsCard
          label="Clienti B2B"
          :value="stats.b2bCustomers"
          icon="pi pi-building"
          variant="info"
          format="number"
          :subtitle="`${stats.totalCustomers > 0 ? Math.round((stats.b2bCustomers / stats.totalCustomers) * 100) : 0}% business`"
        />
        <StatsCard
          label="Clienti B2C"
          :value="stats.b2cCustomers"
          icon="pi pi-user"
          variant="success"
          format="number"
          subtitle="da WordPress"
        />
        <StatsCard
          label="Nuovi Mese"
          :value="stats.newThisMonth"
          icon="pi pi-user-plus"
          variant="warning"
          format="number"
          :trend="8"
          subtitle="vs mese scorso"
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
              placeholder="Cerca cliente..."
              @input="debounceSearch"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedType"
              :options="types"
              placeholder="Tipo Cliente"
              @change="() => { page = 1; loadCustomers(); }"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="customers"
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
          <Column field="code" header="Codice" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="code-badge">{{ data.code }}</span>
            </template>
          </Column>
          <Column field="type" header="Tipo" sortable style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="data.type === 'B2B' ? 'info' : 'success'" class="type-tag">
                {{ data.type }}
              </Tag>
            </template>
          </Column>
          <Column field="businessName" header="Nome" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="customer-name">{{ data.businessName || `${data.firstName} ${data.lastName}` }}</div>
            </template>
          </Column>
          <Column field="email" header="Email" style="min-width: 200px">
            <template #body="{ data }">
              <span class="email">{{ data.email }}</span>
            </template>
          </Column>
          <Column field="phone" header="Telefono" style="min-width: 140px">
            <template #body="{ data }">
              <span class="phone">{{ data.phone || '-' }}</span>
            </template>
          </Column>
          <Column field="totalOrders" header="Ordini" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span class="orders-count">{{ data.totalOrders }}</span>
            </template>
          </Column>
          <Column field="totalSpent" header="Totale Speso" sortable style="min-width: 130px">
            <template #body="{ data }">
              <span class="total-spent">{{ formatCurrency(data.totalSpent) }}</span>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 120px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewCustomer(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editCustomer(data)"
                  v-tooltip.top="'Modifica'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-users empty-state__icon"></i>
              <p class="empty-state__text">Nessun cliente trovato</p>
              <Button label="Aggiungi il primo cliente" icon="pi pi-plus" @click="showCustomerDialog = true" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Customer Dialog -->
    <CustomerDialog
      v-model:visible="showCustomerDialog"
      :customer="selectedCustomer"
      @saved="onCustomerSaved"
    />

    <!-- Customer Detail Dialog -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Cliente"
      :modal="true"
      :style="{ width: '900px' }"
      class="customer-detail-dialog"
    >
      <div v-if="detailCustomer" class="detail-content">
        <div class="detail-header">
          <div class="customer-info">
            <div class="customer-avatar">
              <i :class="detailCustomer.type === 'B2B' ? 'pi pi-building' : 'pi pi-user'"></i>
            </div>
            <div class="customer-details">
              <h2>{{ detailCustomer.businessName || `${detailCustomer.firstName} ${detailCustomer.lastName}` }}</h2>
              <div class="customer-meta">
                <Tag :severity="detailCustomer.type === 'B2B' ? 'info' : 'success'">{{ detailCustomer.type }}</Tag>
                <span class="code">{{ detailCustomer.code }}</span>
                <Tag v-if="!detailCustomer.isActive" severity="danger">Inattivo</Tag>
              </div>
            </div>
          </div>
          <div class="customer-stats">
            <div class="stat">
              <span class="stat-value">{{ detailCustomer.totalOrders }}</span>
              <span class="stat-label">Ordini</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ formatCurrency(detailCustomer.totalSpent) }}</span>
              <span class="stat-label">Totale Speso</span>
            </div>
            <div class="stat" v-if="detailCustomer.priceList">
              <span class="stat-value">{{ detailCustomer.priceList.name }}</span>
              <span class="stat-label">Listino</span>
            </div>
          </div>
        </div>

        <TabView>
          <TabPanel header="Informazioni">
            <div class="info-grid">
              <div class="info-section">
                <h4>Contatti</h4>
                <div class="info-row" v-if="detailCustomer.email">
                  <i class="pi pi-envelope"></i>
                  <span>{{ detailCustomer.email }}</span>
                </div>
                <div class="info-row" v-if="detailCustomer.phone">
                  <i class="pi pi-phone"></i>
                  <span>{{ detailCustomer.phone }}</span>
                </div>
                <div class="info-row" v-if="detailCustomer.pecEmail">
                  <i class="pi pi-at"></i>
                  <span>{{ detailCustomer.pecEmail }} (PEC)</span>
                </div>
              </div>
              <div class="info-section" v-if="detailCustomer.type === 'B2B'">
                <h4>Dati Fiscali</h4>
                <div class="info-row" v-if="detailCustomer.taxId">
                  <span class="info-label">P.IVA:</span>
                  <span>{{ detailCustomer.taxId }}</span>
                </div>
                <div class="info-row" v-if="detailCustomer.fiscalCode">
                  <span class="info-label">C.F.:</span>
                  <span>{{ detailCustomer.fiscalCode }}</span>
                </div>
                <div class="info-row" v-if="detailCustomer.sdiCode">
                  <span class="info-label">SDI:</span>
                  <span>{{ detailCustomer.sdiCode }}</span>
                </div>
              </div>
              <div class="info-section" v-if="detailCustomer.type === 'B2B'">
                <h4>Condizioni Commerciali</h4>
                <div class="info-row">
                  <span class="info-label">Pagamento:</span>
                  <span>{{ detailCustomer.paymentTerms }} giorni</span>
                </div>
                <div class="info-row" v-if="detailCustomer.discount">
                  <span class="info-label">Sconto:</span>
                  <span>{{ detailCustomer.discount }}%</span>
                </div>
                <div class="info-row" v-if="detailCustomer.creditLimit">
                  <span class="info-label">Fido:</span>
                  <span>{{ formatCurrency(detailCustomer.creditLimit) }}</span>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Ordini Recenti" v-if="detailCustomer.orders?.length">
            <DataTable :value="detailCustomer.orders" :paginator="true" :rows="5" class="orders-table">
              <Column field="orderNumber" header="Ordine" style="width: 120px" />
              <Column field="orderDate" header="Data" style="width: 120px">
                <template #body="{ data }">
                  {{ new Date(data.orderDate).toLocaleDateString('it-IT') }}
                </template>
              </Column>
              <Column field="status" header="Stato" style="width: 120px">
                <template #body="{ data }">
                  <Tag :severity="getOrderStatusSeverity(data.status)">{{ data.status }}</Tag>
                </template>
              </Column>
              <Column field="total" header="Totale" style="width: 120px">
                <template #body="{ data }">
                  {{ formatCurrency(data.total) }}
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel header="Contatti" v-if="detailCustomer.contacts?.length">
            <DataTable :value="detailCustomer.contacts" class="contacts-table">
              <Column header="Nome">
                <template #body="{ data }">
                  {{ data.firstName }} {{ data.lastName }}
                  <Tag v-if="data.isPrimary" severity="info" class="ml-2">Principale</Tag>
                </template>
              </Column>
              <Column field="role" header="Ruolo" />
              <Column field="email" header="Email" />
              <Column field="phone" header="Telefono" />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <Button label="Modifica" icon="pi pi-pencil" @click="editFromDetail" />
        <Button label="Chiudi" class="p-button-text" @click="showDetailDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import CustomerDialog from '../components/CustomerDialog.vue';
import type { Customer } from '../types';

const router = useRouter();
const toast = useToast();
const loading = ref(false);
const customers = ref<Customer[]>([]);
const search = ref('');
const selectedType = ref(null);
const page = ref(1);
const totalRecords = ref(0);
const sortBy = ref('createdAt');
const sortOrder = ref<'asc' | 'desc'>('desc');

// Dialog states
const showCustomerDialog = ref(false);
const showDetailDialog = ref(false);
const selectedCustomer = ref<Customer | null>(null);
const detailCustomer = ref<Customer | null>(null);

const stats = ref({
  totalCustomers: 0,
  b2bCustomers: 0,
  b2cCustomers: 0,
  newThisMonth: 0,
});

const types = ref([
  { label: 'B2C (Privati)', value: 'B2C' },
  { label: 'B2B (Aziende)', value: 'B2B' },
]);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
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

// Debounce per la ricerca
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const debounceSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadCustomers();
  }, 500);
};

// Handler per paginazione
const onPage = (event: any) => {
  page.value = event.page + 1;
  loadCustomers();
};

// Handler per ordinamento
const onSort = (event: any) => {
  sortBy.value = event.sortField || 'createdAt';
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadCustomers();
};

const loadStats = async () => {
  try {
    const response = await api.get('/customers/analytics/global');
    if (response.success) {
      const analytics = response.data;
      stats.value = {
        totalCustomers: analytics.overview.totalCustomers,
        b2bCustomers: analytics.overview.b2bCustomers,
        b2cCustomers: analytics.overview.b2cCustomers,
        newThisMonth: analytics.acquisition.newLast30Days,
      };
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadCustomers = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedType.value && { type: selectedType.value }),
    });

    const response = await api.get(`/customers?${params.toString()}`);

    if (response.success) {
      customers.value = response.data.items;
      totalRecords.value = response.data.pagination?.total || 0;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento clienti',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const viewCustomer = (customer: Customer) => {
  router.push(`/customers/${customer.id}`);
};

const editCustomer = (customer: Customer) => {
  selectedCustomer.value = customer;
  showCustomerDialog.value = true;
};

const editFromDetail = () => {
  if (detailCustomer.value) {
    selectedCustomer.value = detailCustomer.value;
    showDetailDialog.value = false;
    showCustomerDialog.value = true;
  }
};

const onCustomerSaved = () => {
  selectedCustomer.value = null;
  loadCustomers();
  loadStats();
};

onMounted(() => {
  loadCustomers();
  loadStats();
});
</script>

<style scoped>
.customers-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* Table Section */
.table-section {
  margin-top: var(--space-6);
}

.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-gray-400);
  font-size: 0.875rem;
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
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
.code-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.customer-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.type-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.email {
  color: var(--color-gray-600);
}

.phone {
  color: var(--color-gray-600);
}

.orders-count {
  font-weight: 600;
  color: var(--color-gray-900);
}

.total-spent {
  font-weight: 600;
  color: var(--color-primary-600);
}

.text-muted {
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
}

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-primary) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Detail Dialog */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--space-4);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.customer-info {
  display: flex;
  gap: var(--space-4);
}

.customer-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.customer-avatar i {
  font-size: 1.5rem;
  color: var(--color-primary-600);
}

.customer-details h2 {
  margin: 0 0 var(--space-2) 0;
  font-size: 1.25rem;
}

.customer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.customer-meta .code {
  font-family: var(--font-mono);
  color: var(--color-gray-500);
}

.customer-stats {
  display: flex;
  gap: var(--space-6);
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary-600);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.info-section {
  background: var(--color-gray-50);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
}

.info-section h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: var(--font-size-sm);
}

.info-row i {
  color: var(--color-gray-400);
  width: 20px;
}

.info-label {
  font-weight: 500;
  color: var(--color-gray-600);
  min-width: 80px;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .detail-header {
    flex-direction: column;
    gap: var(--space-4);
  }

  .customer-stats {
    width: 100%;
    justify-content: space-around;
  }
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
  margin-bottom: var(--space-4);
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

  .search-wrapper {
    min-width: 100%;
  }

  .filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }
}
</style>
