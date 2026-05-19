<template>
  <div class="goods-receipts-page">
    <PageHeader
      title="Entrate Merce"
      subtitle="Registra e gestisci le ricezioni di merce dai fornitori"
      icon="pi pi-truck"
    >
      <template #actions>
        <Button
          label="Nuova Entrata"
          icon="pi pi-plus"
          @click="openCreateDialog"
        />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="In Sospeso"
          :value="stats.pending"
          icon="pi pi-clock"
          variant="warning"
          format="number"
          subtitle="da ricevere"
        />
        <StatsCard
          label="Parziali"
          :value="stats.partial"
          icon="pi pi-sync"
          variant="info"
          format="number"
          subtitle="ricezione parziale"
        />
        <StatsCard
          label="Completate"
          :value="stats.completed"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          subtitle="entrate finalizzate"
        />
        <StatsCard
          label="Annullate"
          :value="stats.cancelled"
          icon="pi pi-times-circle"
          variant="danger"
          format="number"
          subtitle="non valide"
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
              placeholder="Cerca per numero entrata..."
              @input="debounceSearch"
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
              @change="() => { page = 1; loadReceipts(); }"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="receipts"
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
          <Column field="receiptNumber" header="Numero Entrata" sortable style="min-width: 160px">
            <template #body="{ data }">
              <span class="receipt-number">{{ data.receiptNumber || '-' }}</span>
            </template>
          </Column>
          <Column field="purchaseOrder.orderNumber" header="Ordine Acquisto" style="min-width: 160px">
            <template #body="{ data }">
              <span class="po-badge">{{ data.purchaseOrder?.orderNumber || '-' }}</span>
            </template>
          </Column>
          <Column field="supplier.businessName" header="Fornitore" style="min-width: 200px">
            <template #body="{ data }">
              <div class="supplier-cell">
                <i class="pi pi-building"></i>
                <span>{{ data.purchaseOrder?.supplier?.businessName || data.supplier?.businessName || '-' }}</span>
              </div>
            </template>
          </Column>
          <Column field="warehouse.name" header="Magazzino" style="min-width: 150px">
            <template #body="{ data }">
              {{ data.warehouse?.name || '-' }}
            </template>
          </Column>
          <Column field="receiptDate" header="Data Ricezione" sortable style="min-width: 140px">
            <template #body="{ data }">
              {{ formatDate(data.receiptDate || data.createdAt) }}
            </template>
          </Column>
          <Column field="status" header="Stato" sortable style="min-width: 140px">
            <template #body="{ data }">
              <Tag :severity="getStatusSeverity(data.status)" :icon="getStatusIcon(data.status)">
                {{ getStatusLabel(data.status) }}
              </Tag>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 140px">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewReceipt(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  v-if="data.status === 'PENDING' || data.status === 'PARTIAL'"
                  icon="pi pi-check"
                  class="p-button-rounded p-button-text action-btn action-btn--complete"
                  @click="completeReceipt(data)"
                  v-tooltip.top="'Completa'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox empty-state__icon"></i>
              <p class="empty-state__text">Nessuna entrata merce registrata</p>
              <Button label="Registra prima entrata" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Detail Dialog -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Entrata Merce"
      :style="{ width: '900px' }"
      :modal="true"
      :appendTo="'body'"
    >
      <div v-if="selectedReceipt" class="receipt-details">
        <div class="detail-header">
          <div>
            <h2 class="detail-header__title">{{ selectedReceipt.receiptNumber || 'Senza numero' }}</h2>
            <p class="detail-header__sub">
              Ordine: {{ selectedReceipt.purchaseOrder?.orderNumber || '-' }}
              · Fornitore: {{ selectedReceipt.purchaseOrder?.supplier?.businessName || '-' }}
            </p>
          </div>
          <Tag :severity="getStatusSeverity(selectedReceipt.status)">
            {{ getStatusLabel(selectedReceipt.status) }}
          </Tag>
        </div>

        <Divider />

        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Magazzino</span>
            <span class="detail-value">{{ selectedReceipt.warehouse?.name || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Data Ricezione</span>
            <span class="detail-value">{{ formatDate(selectedReceipt.receiptDate || selectedReceipt.createdAt) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">DDT Fornitore</span>
            <span class="detail-value">{{ selectedReceipt.supplierDocNumber || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Vettore</span>
            <span class="detail-value">{{ selectedReceipt.carrier || '-' }}</span>
          </div>
        </div>

        <Divider />

        <h4 class="detail-section__title"><i class="pi pi-list"></i> Righe Entrata</h4>
        <DataTable :value="selectedReceipt.items || []" class="custom-table">
          <Column header="Articolo" style="min-width: 220px">
            <template #body="{ data }">
              {{ data.product?.name || data.material?.name || data.purchaseOrderItem?.product?.name || data.purchaseOrderItem?.material?.name || '-' }}
            </template>
          </Column>
          <Column header="Ricevuto" style="min-width: 100px">
            <template #body="{ data }">
              <span class="quantity-badge">{{ data.receivedQuantity || 0 }}</span>
            </template>
          </Column>
          <Column header="Accettato" style="min-width: 100px">
            <template #body="{ data }">
              <span class="quantity-badge quantity-badge--received">{{ data.acceptedQuantity || 0 }}</span>
            </template>
          </Column>
          <Column header="Rifiutato" style="min-width: 100px">
            <template #body="{ data }">
              <span class="quantity-badge quantity-badge--rejected">{{ data.rejectedQuantity || 0 }}</span>
            </template>
          </Column>
          <Column header="Note" style="min-width: 200px">
            <template #body="{ data }">
              <span class="text-muted">{{ data.qualityNotes || '-' }}</span>
            </template>
          </Column>
        </DataTable>

        <div v-if="selectedReceipt.notes" class="notes-block">
          <h4 class="detail-section__title"><i class="pi pi-file-edit"></i> Note</h4>
          <p>{{ selectedReceipt.notes }}</p>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" @click="showDetailDialog = false" class="p-button-text" />
        <Button
          v-if="selectedReceipt && (selectedReceipt.status === 'PENDING' || selectedReceipt.status === 'PARTIAL')"
          label="Completa Entrata"
          icon="pi pi-check"
          @click="completeReceipt(selectedReceipt)"
          class="p-button-primary"
        />
      </template>
    </Dialog>

    <!-- Create Dialog (standalone PO picker) -->
    <GoodsReceiptDialog
      v-model:visible="showCreateDialog"
      :warehouses="warehouses"
      @saved="onReceiptSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import GoodsReceiptDialog from '../components/GoodsReceiptDialog.vue';

const toast = useToast();
const loading = ref(false);
const receipts = ref<any[]>([]);
const warehouses = ref<any[]>([]);
const totalRecords = ref(0);
const search = ref('');
const selectedStatus = ref<string | null>(null);
const page = ref(1);
const sortBy = ref('createdAt');
const sortOrder = ref<'asc' | 'desc'>('desc');

const showCreateDialog = ref(false);
const showDetailDialog = ref(false);
const selectedReceipt = ref<any>(null);

const stats = ref({
  pending: 0,
  partial: 0,
  completed: 0,
  cancelled: 0,
});

const statusOptions = [
  { label: 'In Sospeso', value: 'PENDING' },
  { label: 'Parziale', value: 'PARTIAL' },
  { label: 'Completata', value: 'COMPLETED' },
  { label: 'Annullata', value: 'CANCELLED' },
];

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('it-IT');
};

const getStatusSeverity = (status: string) => {
  const map: any = {
    PENDING: 'warning',
    PARTIAL: 'info',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

const getStatusIcon = (status: string) => {
  const map: any = {
    PENDING: 'pi pi-clock',
    PARTIAL: 'pi pi-sync',
    COMPLETED: 'pi pi-check-circle',
    CANCELLED: 'pi pi-times-circle',
  };
  return map[status] || 'pi pi-info-circle';
};

const getStatusLabel = (status: string) => {
  const map: any = {
    PENDING: 'In Sospeso',
    PARTIAL: 'Parziale',
    COMPLETED: 'Completata',
    CANCELLED: 'Annullata',
  };
  return map[status] || status;
};

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadReceipts();
  }, 500);
};

const loadReceipts = async () => {
  try {
    loading.value = true;
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(selectedStatus.value && { status: selectedStatus.value }),
    });

    const response = await api.get(`/goods-receipts?${params.toString()}`);
    if (response.success) {
      const items = response.data?.items || response.data?.goodsReceipts || response.data || [];
      // Filtro client-side per ricerca testuale (il backend non espone search param)
      const filtered = search.value
        ? items.filter((r: any) =>
            (r.receiptNumber || '').toLowerCase().includes(search.value.toLowerCase()) ||
            (r.purchaseOrder?.orderNumber || '').toLowerCase().includes(search.value.toLowerCase())
          )
        : items;
      receipts.value = filtered;
      totalRecords.value = response.data?.pagination?.total || response.data?.total || filtered.length;
      computeStats(items);
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore caricamento entrate merce',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const computeStats = (items: any[]) => {
  stats.value = {
    pending: items.filter((r) => r.status === 'PENDING').length,
    partial: items.filter((r) => r.status === 'PARTIAL').length,
    completed: items.filter((r) => r.status === 'COMPLETED').length,
    cancelled: items.filter((r) => r.status === 'CANCELLED').length,
  };
};

const loadWarehouses = async () => {
  try {
    const response = await api.get('/warehouses?limit=100&isActive=true');
    if (response.success) {
      warehouses.value = response.data?.items || [];
    }
  } catch (error) {
    console.error('Error loading warehouses:', error);
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadReceipts();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadReceipts();
};

const openCreateDialog = () => {
  showCreateDialog.value = true;
};

const viewReceipt = async (receipt: any) => {
  try {
    const response = await api.get(`/goods-receipts/${receipt.id}`);
    if (response.success) {
      selectedReceipt.value = response.data;
      showDetailDialog.value = true;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Impossibile caricare l\'entrata',
      life: 3000,
    });
  }
};

const completeReceipt = async (receipt: any) => {
  try {
    await api.post(`/goods-receipts/${receipt.id}/complete`, {});
    toast.add({
      severity: 'success',
      summary: 'Completata',
      detail: 'Entrata merce completata e inventario aggiornato',
      life: 3000,
    });
    showDetailDialog.value = false;
    loadReceipts();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il completamento',
      life: 3000,
    });
  }
};

const onReceiptSaved = () => {
  showCreateDialog.value = false;
  loadReceipts();
};

onMounted(() => {
  loadReceipts();
  loadWarehouses();
});
</script>

<style scoped>
.goods-receipts-page {
  max-width: 1600px;
  margin: 0 auto;
}

.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

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

.receipt-number,
.po-badge {
  font-family: 'Courier New', Consolas, monospace;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
}

.supplier-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-gray-900);
}

.supplier-cell i {
  color: var(--color-primary-600);
}

.quantity-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--color-info-light);
  color: var(--color-info-dark);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.quantity-badge--received {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.quantity-badge--rejected {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.text-muted {
  color: var(--color-gray-400);
}

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

.action-btn--complete {
  color: var(--color-success) !important;
}

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

.receipt-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail-header__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0;
  color: var(--color-gray-900);
}

.detail-header__sub {
  color: var(--color-gray-500);
  margin: var(--space-1) 0 0 0;
}

.detail-section__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-section__title i {
  color: var(--color-primary-500);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
}

.notes-block {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.notes-block p {
  margin: 0;
  color: var(--color-gray-700);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
