<template>
  <div class="discount-opportunities-panel">
    <!-- Summary -->
    <div class="summary-section" v-if="opportunities.length > 0">
      <div class="summary-card">
        <div class="summary-icon">
          <i class="pi pi-percentage"></i>
        </div>
        <div class="summary-content">
          <span class="summary-value">{{ opportunities.length }}</span>
          <span class="summary-label">Opportunità di Sconto</span>
        </div>
      </div>
      <div class="summary-card highlight">
        <div class="summary-icon">
          <i class="pi pi-wallet"></i>
        </div>
        <div class="summary-content">
          <span class="summary-value">{{ formatCurrency(totalPotentialSavings) }}</span>
          <span class="summary-label">Risparmio Potenziale</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && opportunities.length === 0" class="empty-state">
      <i class="pi pi-info-circle empty-state__icon"></i>
      <h3 class="empty-state__title">Nessuna opportunità disponibile</h3>
      <p class="empty-state__text">Non ci sono opportunità di sconto basate sullo storico acquisti.</p>
      <p class="empty-state__hint">Configura sconti volume nei cataloghi fornitori per attivare questa funzionalità.</p>
    </div>

    <!-- Table -->
    <DataTable
      v-else
      :value="opportunities"
      :loading="loading"
      responsiveLayout="scroll"
      class="custom-table"
      :rowHover="true"
      sortField="potentialSavings"
      :sortOrder="-1"
    >
      <Column field="supplierName" header="Fornitore" sortable style="min-width: 180px">
        <template #body="{ data }">
          <div class="supplier-cell">
            <i class="pi pi-building"></i>
            <span>{{ data.supplierName }}</span>
          </div>
        </template>
      </Column>
      <Column field="itemName" header="Articolo" sortable style="min-width: 200px">
        <template #body="{ data }">
          <div class="item-info">
            <span class="item-name">{{ data.itemName }}</span>
            <span class="item-code">{{ data.itemCode }}</span>
          </div>
        </template>
      </Column>
      <Column field="itemType" header="Tipo" style="min-width: 100px">
        <template #body="{ data }">
          <Tag :severity="data.itemType === 'PRODUCT' ? 'info' : 'warning'">
            {{ data.itemType === 'PRODUCT' ? 'Prodotto' : 'Materiale' }}
          </Tag>
        </template>
      </Column>
      <Column field="last12MonthsQuantity" header="Qtà 12 Mesi" sortable style="min-width: 120px">
        <template #body="{ data }">
          <span class="quantity-value">{{ data.last12MonthsQuantity }}</span>
        </template>
      </Column>
      <Column field="last12MonthsSpent" header="Speso 12 Mesi" sortable style="min-width: 130px">
        <template #body="{ data }">
          <span class="amount">{{ formatCurrency(data.last12MonthsSpent) }}</span>
        </template>
      </Column>
      <Column field="currentDiscount" header="Sconto Attuale" style="min-width: 130px">
        <template #body="{ data }">
          <span v-if="data.currentDiscount" class="discount-badge current">
            -{{ data.currentDiscount.discountPercent }}%
          </span>
          <span v-else class="text-muted">Nessuno</span>
        </template>
      </Column>
      <Column field="nextDiscount" header="Prossimo Sconto" style="min-width: 150px">
        <template #body="{ data }">
          <div class="next-discount">
            <Tag severity="success" class="discount-tag">
              -{{ data.nextDiscount.discountPercent }}%
            </Tag>
            <small>da {{ data.nextDiscount.minQuantity }} unità</small>
          </div>
        </template>
      </Column>
      <Column field="quantityToNextDiscount" header="Mancano" sortable style="min-width: 100px">
        <template #body="{ data }">
          <span class="quantity-highlight">{{ data.quantityToNextDiscount }}</span>
        </template>
      </Column>
      <Column field="potentialSavings" header="Risparmio" sortable style="min-width: 130px">
        <template #body="{ data }">
          <span class="savings-value">{{ formatCurrency(data.potentialSavings) }}</span>
        </template>
      </Column>
      <Column field="recommendation" header="Raccomandazione" style="min-width: 300px">
        <template #body="{ data }">
          <div class="recommendation-cell">
            <i class="pi pi-lightbulb"></i>
            <span>{{ data.recommendation }}</span>
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="empty-state">
          <i class="pi pi-info-circle empty-state__icon"></i>
          <p class="empty-state__text">Nessuna opportunità di sconto disponibile</p>
        </div>
      </template>
    </DataTable>

    <!-- Tips -->
    <div class="tips-section" v-if="opportunities.length > 0">
      <h4><i class="pi pi-info-circle"></i> Come sfruttare queste opportunità</h4>
      <ul>
        <li>Raggruppa gli ordini per raggiungere le soglie di sconto volume</li>
        <li>Negozia con i fornitori basandoti sul tuo storico acquisti</li>
        <li>Pianifica acquisti più grandi per materiali ad alto consumo</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const toast = useToast();

// State
const loading = ref(false);
const opportunities = ref<any[]>([]);

// Computed
const totalPotentialSavings = computed(() => {
  return opportunities.value.reduce((sum, o) => sum + (o.potentialSavings || 0), 0);
});

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const loadOpportunities = async () => {
  loading.value = true;
  try {
    const response = await api.get('/purchase-orders/analytics/discount-opportunities');
    opportunities.value = response.data || [];
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento opportunità',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadOpportunities();
});
</script>

<style scoped>
.discount-opportunities-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Summary Section */
.summary-section {
  display: flex;
  gap: var(--space-4);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  flex: 1;
}

.summary-card.highlight {
  background: linear-gradient(135deg, var(--green-50), var(--green-100));
  border-color: var(--green-200);
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.summary-card.highlight .summary-icon {
  background: var(--green-200);
  color: var(--green-700);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-color);
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
}

.empty-state__icon {
  font-size: 4rem;
  color: var(--color-gray-300);
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
  margin: 0 0 var(--space-2) 0;
}

.empty-state__hint {
  color: var(--text-color-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
  font-style: italic;
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
.supplier-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
}

.supplier-cell i {
  color: var(--color-primary-600);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-weight: 500;
  color: var(--text-color);
}

.item-code {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}

.quantity-value {
  font-weight: 600;
}

.amount {
  font-weight: 600;
  color: var(--text-color);
}

.discount-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.discount-badge.current {
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}

.next-discount {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.next-discount small {
  color: var(--text-color-secondary);
  font-size: var(--font-size-xs);
}

.quantity-highlight {
  font-weight: 700;
  color: var(--orange-600);
  background: var(--orange-50);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
}

.savings-value {
  font-weight: 700;
  color: var(--green-600);
}

.recommendation-cell {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--text-color-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.recommendation-cell i {
  color: var(--yellow-500);
  flex-shrink: 0;
  margin-top: 2px;
}

.text-muted {
  color: var(--text-color-secondary);
}

/* Tips Section */
.tips-section {
  background: var(--blue-50);
  border: 1px solid var(--blue-200);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
}

.tips-section h4 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-3) 0;
  color: var(--blue-700);
  font-size: var(--font-size-base);
}

.tips-section h4 i {
  color: var(--blue-500);
}

.tips-section ul {
  margin: 0;
  padding-left: var(--space-6);
  color: var(--blue-700);
}

.tips-section li {
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
}

.tips-section li:last-child {
  margin-bottom: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .summary-section {
    flex-direction: column;
  }
}
</style>
