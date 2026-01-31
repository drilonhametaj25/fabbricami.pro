<template>
  <div class="cost-breakdown">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner style="width: 40px; height: 40px" />
      <p>Calcolo costi in corso...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Riprova" icon="pi pi-refresh" @click="loadCostBreakdown" />
    </div>

    <!-- Cost Breakdown Content -->
    <div v-else-if="costData" class="breakdown-content">
      <!-- Header Summary -->
      <div class="summary-header">
        <h3>{{ costData.productName }}</h3>
        <div class="total-cost">
          <span class="total-label">Costo Totale Produzione</span>
          <span class="total-value">{{ formatCurrency(costData.totalCost) }}</span>
        </div>
      </div>

      <!-- Cost Distribution Chart -->
      <div class="cost-distribution">
        <div class="distribution-bar">
          <div
            class="bar-segment labor"
            :style="{ width: getPercentage(costData.laborCost) + '%' }"
            v-tooltip="'Fasi: ' + formatCurrency(costData.laborCost)"
          ></div>
          <div
            class="bar-segment material"
            :style="{ width: getPercentage(costData.materialCost) + '%' }"
            v-tooltip="'Materiali: ' + formatCurrency(costData.materialCost)"
          ></div>
          <div
            v-if="costData.externalCost > 0"
            class="bar-segment external"
            :style="{ width: getPercentage(costData.externalCost) + '%' }"
            v-tooltip="'Esterni: ' + formatCurrency(costData.externalCost)"
          ></div>
          <div
            v-if="costData.bomCost > 0"
            class="bar-segment bom"
            :style="{ width: getPercentage(costData.bomCost) + '%' }"
            v-tooltip="'BOM: ' + formatCurrency(costData.bomCost)"
          ></div>
        </div>
        <div class="distribution-legend">
          <div class="legend-item">
            <span class="legend-color labor"></span>
            <span>Fasi ({{ formatCurrency(costData.laborCost) }})</span>
          </div>
          <div class="legend-item">
            <span class="legend-color material"></span>
            <span>Materiali ({{ formatCurrency(costData.materialCost) }})</span>
          </div>
          <div class="legend-item" v-if="costData.externalCost > 0">
            <span class="legend-color external"></span>
            <span>Esterni ({{ formatCurrency(costData.externalCost) }})</span>
          </div>
          <div class="legend-item" v-if="costData.bomCost > 0">
            <span class="legend-color bom"></span>
            <span>BOM ({{ formatCurrency(costData.bomCost) }})</span>
          </div>
        </div>
      </div>

      <!-- Warnings -->
      <div v-if="costData.warnings && costData.warnings.length > 0" class="warnings-section">
        <Message v-for="(warning, idx) in costData.warnings" :key="idx" severity="warn" :closable="false">
          {{ warning }}
        </Message>
      </div>

      <!-- Tabs for different views -->
      <TabView>
        <!-- Phases Tab -->
        <TabPanel>
          <template #header>
            <div class="tab-header">
              <i class="pi pi-list"></i>
              <span>Fasi ({{ costData.breakdown.phases.length }})</span>
            </div>
          </template>
          <DataTable
            :value="costData.breakdown.phases"
            responsiveLayout="scroll"
            class="p-datatable-sm"
            stripedRows
          >
            <Column field="sequence" header="#" style="width: 50px">
              <template #body="{ data }">
                <Badge :value="data.sequence" severity="info" />
              </template>
            </Column>
            <Column field="phaseName" header="Fase" style="min-width: 150px">
              <template #body="{ data }">
                <div>
                  <strong>{{ data.phaseName }}</strong>
                  <small class="operation-type">{{ data.operationTypeName }}</small>
                </div>
              </template>
            </Column>
            <Column header="Tempo" style="width: 100px">
              <template #body="{ data }">
                {{ formatTime(data.timeMinutes) }}
              </template>
            </Column>
            <Column header="Tariffa" style="width: 120px">
              <template #body="{ data }">
                <div class="rate-cell">
                  <span>{{ formatCurrency(data.hourlyRate) }}/h</span>
                  <Tag
                    :value="data.hourlyRateSource === 'employees' ? `${data.employeeCount} op.` : 'Default'"
                    :severity="data.hourlyRateSource === 'employees' ? 'success' : 'secondary'"
                    class="rate-source"
                  />
                </div>
              </template>
            </Column>
            <Column header="Costo Lavoro" style="width: 110px">
              <template #body="{ data }">
                <span class="cost-cell labor">{{ formatCurrency(data.laborCost) }}</span>
              </template>
            </Column>
            <Column header="Costo Materiali" style="width: 110px">
              <template #body="{ data }">
                <span class="cost-cell material">{{ formatCurrency(data.materialCost) }}</span>
              </template>
            </Column>
            <Column header="Costo Esterno" style="width: 110px" v-if="hasExternalCosts">
              <template #body="{ data }">
                <span class="cost-cell external">{{ formatCurrency(data.externalCost) }}</span>
              </template>
            </Column>
            <Column header="Totale Fase" style="width: 120px">
              <template #body="{ data }">
                <strong class="cost-cell total">
                  {{ formatCurrency(data.laborCost + data.materialCost + data.externalCost) }}
                </strong>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- Materials Tab (Exploded with origin) -->
        <TabPanel>
          <template #header>
            <div class="tab-header">
              <i class="pi pi-box"></i>
              <span>Materiali ({{ costData.breakdown.explodedMaterials.length }})</span>
            </div>
          </template>
          <DataTable
            :value="costData.breakdown.explodedMaterials"
            responsiveLayout="scroll"
            class="p-datatable-sm"
            stripedRows
            sortField="origin"
            :sortOrder="1"
            :groupRowsBy="'originProductName'"
            rowGroupMode="subheader"
          >
            <template #groupheader="{ data }">
              <div class="group-header">
                <i class="pi pi-sitemap"></i>
                <span>{{ data.origin }}</span>
              </div>
            </template>
            <Column field="materialCode" header="Codice" style="width: 100px">
              <template #body="{ data }">
                <code>{{ data.materialCode }}</code>
              </template>
            </Column>
            <Column field="materialName" header="Materiale" style="min-width: 180px" />
            <Column field="quantity" header="Quantita" style="width: 100px">
              <template #body="{ data }">
                {{ formatNumber(data.quantity) }} {{ data.unit }}
              </template>
            </Column>
            <Column field="costPerUnit" header="Costo/Unita" style="width: 110px">
              <template #body="{ data }">
                {{ formatCurrency(data.costPerUnit) }}
              </template>
            </Column>
            <Column field="totalCost" header="Costo Totale" style="width: 120px">
              <template #body="{ data }">
                <strong>{{ formatCurrency(data.totalCost) }}</strong>
              </template>
            </Column>
            <Column field="phaseName" header="Fase" style="min-width: 120px">
              <template #body="{ data }">
                <Tag v-if="data.phaseName" :value="data.phaseName" severity="secondary" />
                <span v-else>-</span>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- BOM Products Tab -->
        <TabPanel v-if="costData.breakdown.bomProducts.length > 0">
          <template #header>
            <div class="tab-header">
              <i class="pi pi-sitemap"></i>
              <span>Sotto-Prodotti ({{ costData.breakdown.bomProducts.length }})</span>
            </div>
          </template>
          <div class="bom-tree">
            <div v-for="bomProduct in costData.breakdown.bomProducts" :key="bomProduct.productId" class="bom-item">
              <div class="bom-header">
                <div class="bom-info">
                  <Tag :value="bomProduct.productSku" severity="info" />
                  <strong>{{ bomProduct.productName }}</strong>
                </div>
                <div class="bom-cost">
                  <span class="quantity">x{{ bomProduct.quantity }}</span>
                  <span class="unit-cost">@ {{ formatCurrency(bomProduct.costPerUnit) }}</span>
                  <span class="total-cost">= {{ formatCurrency(bomProduct.totalCost) }}</span>
                </div>
              </div>
              <!-- Nested sub-products -->
              <div v-if="bomProduct.subProducts && bomProduct.subProducts.length > 0" class="bom-children">
                <div v-for="subProduct in bomProduct.subProducts" :key="subProduct.productId" class="bom-item nested">
                  <div class="bom-header">
                    <div class="bom-info">
                      <Tag :value="subProduct.productSku" severity="secondary" />
                      <span>{{ subProduct.productName }}</span>
                    </div>
                    <div class="bom-cost">
                      <span class="quantity">x{{ subProduct.quantity }}</span>
                      <span class="total-cost">{{ formatCurrency(subProduct.totalCost) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <!-- No Data -->
    <div v-else class="empty-state">
      <i class="pi pi-calculator"></i>
      <p>Nessun dato di costo disponibile</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import Message from 'primevue/message';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import api from '../services/api.service';

interface Props {
  productId?: string;
  quantity?: number;
}

const props = withDefaults(defineProps<Props>(), {
  quantity: 1
});

const loading = ref(false);
const error = ref<string | null>(null);
const costData = ref<any>(null);

const hasExternalCosts = computed(() => {
  if (!costData.value) return false;
  return costData.value.breakdown.phases.some((p: any) => p.externalCost > 0);
});

const getPercentage = (value: number) => {
  if (!costData.value || costData.value.totalCost === 0) return 0;
  return (value / costData.value.totalCost) * 100;
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatTime = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const loadCostBreakdown = async () => {
  if (!props.productId) return;

  loading.value = true;
  error.value = null;

  try {
    const response = await api.get(`/products/${props.productId}/cost-detailed`, {
      params: { quantity: props.quantity }
    });

    if (response.success) {
      costData.value = response.data;
    } else {
      throw new Error(response.error || 'Errore nel caricamento');
    }
  } catch (err: any) {
    error.value = err.message || 'Errore nel calcolo dei costi';
    costData.value = null;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.productId, props.quantity],
  () => {
    if (props.productId) {
      loadCostBreakdown();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.productId) {
    loadCostBreakdown();
  }
});
</script>

<style scoped>
.cost-breakdown {
  padding: 1rem 0;
}

/* Loading & Error States */
.loading-container,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--color-gray-500, #64748b);
}

.loading-container p,
.error-state p,
.empty-state p {
  margin-top: 1rem;
}

.error-state i,
.empty-state i {
  font-size: 2.5rem;
  opacity: 0.5;
}

/* Summary Header */
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--color-gray-50, #f8fafc);
  border-radius: var(--border-radius-lg, 0.75rem);
}

.summary-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-gray-900, #111827);
}

.total-cost {
  text-align: right;
}

.total-label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
}

.total-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary-600, #4f46e5);
}

/* Cost Distribution */
.cost-distribution {
  margin-bottom: 1.5rem;
}

.distribution-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-gray-200, #e2e8f0);
}

.bar-segment {
  transition: width 0.3s ease;
}

.bar-segment.labor {
  background: #667eea;
}

.bar-segment.material {
  background: #10b981;
}

.bar-segment.external {
  background: #f59e0b;
}

.bar-segment.bom {
  background: #8b5cf6;
}

.distribution-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-color.labor {
  background: #667eea;
}

.legend-color.material {
  background: #10b981;
}

.legend-color.external {
  background: #f59e0b;
}

.legend-color.bom {
  background: #8b5cf6;
}

/* Warnings */
.warnings-section {
  margin-bottom: 1rem;
}

.warnings-section :deep(.p-message) {
  margin-bottom: 0.5rem;
}

/* Tab Header */
.tab-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Table Styles */
.operation-type {
  display: block;
  font-size: 0.75rem;
  color: var(--color-gray-500, #64748b);
}

.rate-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rate-source {
  font-size: 0.65rem;
}

.cost-cell {
  font-weight: 600;
}

.cost-cell.labor {
  color: #667eea;
}

.cost-cell.material {
  color: #10b981;
}

.cost-cell.external {
  color: #f59e0b;
}

.cost-cell.total {
  color: var(--color-gray-900, #111827);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-gray-100, #f1f5f9);
  font-weight: 600;
}

.group-header i {
  color: var(--color-primary-600, #4f46e5);
}

/* BOM Tree Styles */
.bom-tree {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bom-item {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--border-radius-md, 0.5rem);
  overflow: hidden;
}

.bom-item.nested {
  border: none;
  border-left: 2px solid var(--color-gray-300, #d1d5db);
  border-radius: 0;
  margin-left: 1rem;
}

.bom-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--color-gray-50, #f8fafc);
}

.bom-item.nested .bom-header {
  background: transparent;
  padding: 0.5rem 0.75rem;
}

.bom-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bom-cost {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.bom-cost .quantity {
  color: var(--color-gray-500, #64748b);
}

.bom-cost .unit-cost {
  color: var(--color-gray-600, #475569);
}

.bom-cost .total-cost {
  font-weight: 700;
  color: var(--color-primary-600, #4f46e5);
}

.bom-children {
  padding: 0.5rem 1rem 0.5rem 2rem;
  border-top: 1px dashed var(--border-color-light, #e2e8f0);
}
</style>
