<template>
  <div class="mrp-capacity">
    <PageHeader
      title="Capacity Planning"
      subtitle="Carico produttivo per fase su orizzonte temporale"
      icon="pi pi-chart-bar"
    />

    <div class="filters-bar">
      <div class="filter-group">
        <label>Orizzonte (giorni)</label>
        <InputNumber v-model="horizonDays" :min="7" :max="180" :step="1" />
      </div>
      <div class="filter-group">
        <label>Capacita giornaliera (minuti)</label>
        <InputNumber v-model="dailyCapacityMinutes" :min="60" :max="1440" :step="30" />
      </div>
      <Button label="Aggiorna" icon="pi pi-refresh" @click="loadPlan" :loading="loading" />
    </div>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="error-container">
      <Message severity="error" :closable="false">{{ error }}</Message>
    </div>

    <div v-else-if="plan" class="content">
      <!-- Global summary -->
      <div class="summary-cards">
        <div class="card">
          <span class="label">Carico totale</span>
          <span class="value">{{ formatHours(plan.globalSummary.totalLoadMinutes) }}</span>
        </div>
        <div class="card">
          <span class="label">Capacita disponibile</span>
          <span class="value">{{ formatHours(plan.globalSummary.totalCapacityMinutes) }}</span>
        </div>
        <div class="card" :class="utilizationClass(plan.globalSummary.avgUtilizationPct)">
          <span class="label">Saturazione media</span>
          <span class="value">{{ plan.globalSummary.avgUtilizationPct }}%</span>
        </div>
        <div class="card" :class="{ alert: plan.globalSummary.bottlenecks.length > 0 }">
          <span class="label">Bottleneck</span>
          <span class="value">{{ plan.globalSummary.bottlenecks.length }}</span>
        </div>
      </div>

      <!-- Bottleneck alert -->
      <Message
        v-if="plan.globalSummary.bottlenecks.length > 0"
        severity="warn"
        :closable="false"
        class="bottleneck-alert"
      >
        <strong>Colli di bottiglia rilevati:</strong>
        <ul>
          <li v-for="b in plan.globalSummary.bottlenecks" :key="b.operationTypeCode">
            {{ b.operationTypeName }} ({{ b.operationTypeCode }}) — picco
            <strong>{{ b.peakUtilizationPct }}%</strong>
          </li>
        </ul>
      </Message>

      <!-- Tabella per operationType -->
      <div class="table-container">
        <h3>Carico per operationType</h3>
        <DataTable
          :value="plan.operationTypes"
          stripedRows
          responsiveLayout="scroll"
          :pt="{ table: { class: 'capacity-table' } }"
        >
          <Column field="operationTypeCode" header="Codice" sortable style="width: 120px" />
          <Column field="operationTypeName" header="Tipo operazione" sortable />
          <Column header="Esterno" style="width: 90px">
            <template #body="{ data }">
              <Tag v-if="data.isExternal" value="Terzista" severity="info" />
              <Tag v-else value="Interno" severity="secondary" />
            </template>
          </Column>
          <Column header="Carico totale" style="width: 130px">
            <template #body="{ data }">
              {{ formatHours(data.totalLoadMinutes) }}
            </template>
          </Column>
          <Column header="Saturazione media" style="width: 150px">
            <template #body="{ data }">
              <div class="utilization-cell">
                <div class="utilization-bar" :class="utilizationClass(data.avgUtilizationPct)">
                  <div class="fill" :style="{ width: Math.min(data.avgUtilizationPct, 100) + '%' }"></div>
                </div>
                <span>{{ data.avgUtilizationPct }}%</span>
              </div>
            </template>
          </Column>
          <Column header="Picco" style="width: 100px">
            <template #body="{ data }">
              <Tag :value="data.peakUtilizationPct + '%'" :severity="utilizationSeverity(data.peakUtilizationPct)" />
            </template>
          </Column>
          <Column header="Giorni saturi" style="width: 120px">
            <template #body="{ data }">
              <Tag
                v-if="data.daysOverloaded > 0"
                :value="data.daysOverloaded + ' giorni'"
                severity="danger"
              />
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Nessun dato di capacity planning disponibile.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import PageHeader from '../components/PageHeader.vue';
import apiService from '../services/api.service';

interface DailyLoad {
  date: string;
  loadMinutes: number;
  capacityMinutes: number;
  utilizationPct: number;
  overloaded: boolean;
}

interface OperationTypeCapacity {
  operationTypeId: string;
  operationTypeCode: string;
  operationTypeName: string;
  isExternal: boolean;
  totalLoadMinutes: number;
  totalCapacityMinutes: number;
  avgUtilizationPct: number;
  peakUtilizationPct: number;
  daysOverloaded: number;
  daily: DailyLoad[];
}

interface CapacityPlanResult {
  window: { start: string; end: string };
  operationTypes: OperationTypeCapacity[];
  globalSummary: {
    totalLoadMinutes: number;
    totalCapacityMinutes: number;
    avgUtilizationPct: number;
    bottlenecks: Array<{
      operationTypeCode: string;
      operationTypeName: string;
      peakUtilizationPct: number;
    }>;
  };
}

const horizonDays = ref(30);
const dailyCapacityMinutes = ref(480);
const loading = ref(false);
const error = ref<string | null>(null);
const plan = ref<CapacityPlanResult | null>(null);

async function loadPlan() {
  loading.value = true;
  error.value = null;
  try {
    const response: any = await apiService.get(
      `/mrp/capacity?horizonDays=${horizonDays.value}&dailyCapacityMinutes=${dailyCapacityMinutes.value}`
    );
    plan.value = response?.data || response;
  } catch (err: any) {
    error.value = err.message || 'Errore caricamento capacity plan';
    plan.value = null;
  } finally {
    loading.value = false;
  }
}

function formatHours(minutes: number): string {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function utilizationClass(pct: number): string {
  if (pct >= 100) return 'danger';
  if (pct >= 85) return 'warning';
  if (pct >= 60) return 'normal';
  return 'low';
}

function utilizationSeverity(pct: number): 'danger' | 'warn' | 'success' | 'info' {
  if (pct >= 100) return 'danger';
  if (pct >= 85) return 'warn';
  if (pct >= 60) return 'success';
  return 'info';
}

onMounted(loadPlan);
</script>

<style scoped>
.mrp-capacity {
  padding: 1.5rem;
}

.filters-bar {
  display: flex;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.card {
  background: var(--surface-card);
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card .label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card .value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
}

.card.warning .value {
  color: var(--orange-500);
}

.card.danger .value,
.card.alert .value {
  color: var(--red-500);
}

.bottleneck-alert {
  margin-bottom: 1.5rem;
}

.bottleneck-alert ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.table-container {
  background: var(--surface-card);
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.table-container h3 {
  margin: 0 0 1rem;
}

.utilization-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.utilization-bar {
  flex: 1;
  height: 8px;
  background: var(--surface-200);
  border-radius: 4px;
  overflow: hidden;
}

.utilization-bar .fill {
  height: 100%;
  background: var(--green-500);
  transition: width 0.3s;
}

.utilization-bar.warning .fill {
  background: var(--orange-500);
}

.utilization-bar.danger .fill {
  background: var(--red-500);
}

.loading-container,
.error-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.text-muted {
  color: var(--text-color-secondary);
}
</style>
