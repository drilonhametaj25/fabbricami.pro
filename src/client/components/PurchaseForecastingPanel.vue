<template>
  <div class="forecasting-panel">
    <!-- Alert Summary -->
    <div class="alert-summary" v-if="summary.criticalCount > 0 || summary.lowCount > 0">
      <div class="alert-card critical" v-if="summary.criticalCount > 0">
        <i class="pi pi-exclamation-triangle"></i>
        <span><strong>{{ summary.criticalCount }}</strong> materiali in stato critico</span>
      </div>
      <div class="alert-card warning" v-if="summary.lowCount > 0">
        <i class="pi pi-exclamation-circle"></i>
        <span><strong>{{ summary.lowCount }}</strong> materiali in esaurimento</span>
      </div>
      <div class="alert-card info">
        <i class="pi pi-info-circle"></i>
        <span><strong>{{ summary.totalMaterials }}</strong> materiali totali monitorati</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && materials.length === 0" class="empty-state">
      <i class="pi pi-check-circle empty-state__icon"></i>
      <h3 class="empty-state__title">Tutto in ordine!</h3>
      <p class="empty-state__text">Nessun materiale richiede riordino immediato</p>
    </div>

    <!-- Table -->
    <DataTable
      v-else
      :value="materials"
      :loading="loading"
      responsiveLayout="scroll"
      class="custom-table"
      :rowHover="true"
      sortField="status"
      :sortOrder="-1"
    >
      <Column field="code" header="Codice" sortable style="min-width: 100px">
        <template #body="{ data }">
          <span class="code-badge">{{ data.code }}</span>
        </template>
      </Column>
      <Column field="materialName" header="Materiale" sortable style="min-width: 200px">
        <template #body="{ data }">
          <span class="material-name">{{ data.materialName }}</span>
        </template>
      </Column>
      <Column field="status" header="Stato" sortable style="min-width: 100px">
        <template #body="{ data }">
          <Tag :severity="getStatusSeverity(data.status)" :icon="getStatusIcon(data.status)">
            {{ getStatusLabel(data.status) }}
          </Tag>
        </template>
      </Column>
      <Column field="currentStock" header="Giacenza" sortable style="min-width: 120px">
        <template #body="{ data }">
          <div class="stock-info">
            <span class="stock-value">{{ data.currentStock }}</span>
            <small class="stock-min">min: {{ data.minStock }}</small>
          </div>
        </template>
      </Column>
      <Column field="avgDailyConsumption" header="Consumo/Giorno" sortable style="min-width: 130px">
        <template #body="{ data }">
          <span v-if="data.avgDailyConsumption > 0">{{ data.avgDailyConsumption }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </Column>
      <Column field="daysUntilStockout" header="Giorni Rimasti" sortable style="min-width: 130px">
        <template #body="{ data }">
          <span :class="getDaysClass(data.daysUntilStockout)">
            {{ data.daysUntilStockout ?? '∞' }}
          </span>
        </template>
      </Column>
      <Column field="suggestedReorderDate" header="Data Riordino" sortable style="min-width: 130px">
        <template #body="{ data }">
          <span v-if="data.suggestedReorderDate" :class="getDateClass(data.suggestedReorderDate)">
            {{ formatDate(data.suggestedReorderDate) }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>
      </Column>
      <Column field="suggestedQuantity" header="Qtà Suggerita" sortable style="min-width: 120px">
        <template #body="{ data }">
          <span v-if="data.suggestedQuantity > 0" class="quantity-badge">{{ data.suggestedQuantity }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </Column>
      <Column field="preferredSupplierName" header="Fornitore" style="min-width: 180px">
        <template #body="{ data }">
          <div v-if="data.preferredSupplierName" class="supplier-info">
            <i class="pi pi-building"></i>
            <span>{{ data.preferredSupplierName }}</span>
          </div>
          <span v-else class="text-muted">Nessun preferito</span>
        </template>
      </Column>
      <Column field="lastPurchasePrice" header="Ultimo Prezzo" style="min-width: 120px">
        <template #body="{ data }">
          <span v-if="data.lastPurchasePrice">{{ formatCurrency(data.lastPurchasePrice) }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </Column>
      <Column header="Azioni" style="min-width: 150px" :frozen="true" alignFrozen="right">
        <template #body="{ data }">
          <Button
            icon="pi pi-plus"
            label="Ordina"
            class="p-button-sm p-button-success"
            @click="createOrder(data)"
            :disabled="!data.preferredSupplierId"
          />
        </template>
      </Column>

      <template #empty>
        <div class="empty-state">
          <i class="pi pi-check-circle empty-state__icon"></i>
          <p class="empty-state__text">Nessun materiale richiede riordino</p>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const emit = defineEmits(['create-order']);
const toast = useToast();

// State
const loading = ref(false);
const forecastData = ref<any>(null);

// Computed
const materials = computed(() => forecastData.value?.materials || []);
const summary = computed(() => forecastData.value?.summary || { criticalCount: 0, lowCount: 0, totalMaterials: 0 });

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('it-IT');
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    CRITICAL: 'danger',
    LOW: 'warning',
    OK: 'success',
  };
  return map[status] || 'info';
};

const getStatusIcon = (status: string) => {
  const map: Record<string, string> = {
    CRITICAL: 'pi pi-exclamation-triangle',
    LOW: 'pi pi-exclamation-circle',
    OK: 'pi pi-check-circle',
  };
  return map[status] || 'pi pi-info-circle';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    CRITICAL: 'Critico',
    LOW: 'Basso',
    OK: 'OK',
  };
  return map[status] || status;
};

const getDaysClass = (days: number | null) => {
  if (days === null) return 'days-ok';
  if (days <= 7) return 'days-critical';
  if (days <= 30) return 'days-warning';
  return 'days-ok';
};

const getDateClass = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'date-overdue';
  if (diffDays <= 7) return 'date-urgent';
  return 'date-normal';
};

const loadForecasting = async () => {
  loading.value = true;
  try {
    const response = await api.get('/purchase-orders/analytics/forecasting');
    forecastData.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento previsioni',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const createOrder = (material: any) => {
  emit('create-order', {
    type: 'material',
    materialId: material.materialId,
    materialName: material.materialName,
    supplierId: material.preferredSupplierId,
    supplierName: material.preferredSupplierName,
    quantity: material.suggestedQuantity,
    unitPrice: material.lastPurchasePrice,
  });
};

// Lifecycle
onMounted(() => {
  loadForecasting();
});
</script>

<style scoped>
.forecasting-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Alert Summary */
.alert-summary {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.alert-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.alert-card.critical {
  background: var(--red-50);
  color: var(--red-700);
  border: 1px solid var(--red-200);
}

.alert-card.warning {
  background: var(--orange-50);
  color: var(--orange-700);
  border: 1px solid var(--orange-200);
}

.alert-card.info {
  background: var(--blue-50);
  color: var(--blue-700);
  border: 1px solid var(--blue-200);
}

.alert-card i {
  font-size: 1.25rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
}

.empty-state__icon {
  font-size: 4rem;
  color: var(--green-400);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 var(--space-2) 0;
}

.empty-state__text {
  color: var(--text-color-secondary);
  margin: 0;
}

/* Table Styles */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
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

.material-name {
  font-weight: 500;
  color: var(--text-color);
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-value {
  font-weight: 600;
  color: var(--text-color);
}

.stock-min {
  color: var(--text-color-secondary);
  font-size: var(--font-size-xs);
}

.quantity-badge {
  font-weight: 600;
  color: var(--blue-700);
  background: var(--blue-50);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
}

.supplier-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.supplier-info i {
  color: var(--color-primary-600);
}

.text-muted {
  color: var(--text-color-secondary);
}

/* Days Classes */
.days-critical {
  font-weight: 700;
  color: var(--red-600);
}

.days-warning {
  font-weight: 600;
  color: var(--orange-600);
}

.days-ok {
  color: var(--text-color);
}

/* Date Classes */
.date-overdue {
  color: var(--red-600);
  font-weight: 700;
}

.date-urgent {
  color: var(--orange-600);
  font-weight: 600;
}

.date-normal {
  color: var(--text-color);
}

/* Responsive */
@media (max-width: 768px) {
  .alert-summary {
    flex-direction: column;
  }
}
</style>
