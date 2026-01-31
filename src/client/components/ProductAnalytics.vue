<template>
  <div class="product-analytics">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Caricamento analytics...</p>
    </div>

    <template v-else>
      <!-- Date Range Selector -->
      <div class="analytics-header">
        <div class="date-range">
          <label>Periodo:</label>
          <Calendar
            v-model="dateRange"
            selectionMode="range"
            dateFormat="dd/mm/yy"
            :maxDate="new Date()"
            showIcon
            class="date-picker"
          />
          <Button label="Aggiorna" icon="pi pi-refresh" @click="loadAnalytics" :loading="loading" />
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card success">
          <div class="kpi-icon"><i class="pi pi-euro"></i></div>
          <div class="kpi-content">
            <span class="kpi-value">{{ formatCurrency(kpis.totalRevenue) }}</span>
            <span class="kpi-label">Fatturato Totale</span>
          </div>
        </div>
        <div class="kpi-card primary">
          <div class="kpi-icon"><i class="pi pi-box"></i></div>
          <div class="kpi-content">
            <span class="kpi-value">{{ kpis.totalQuantity }}</span>
            <span class="kpi-label">Unita Vendute</span>
          </div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-icon"><i class="pi pi-percentage"></i></div>
          <div class="kpi-content">
            <span class="kpi-value">{{ formatPercent(kpis.avgMargin) }}</span>
            <span class="kpi-label">Margine Medio</span>
          </div>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-icon"><i class="pi pi-chart-line"></i></div>
          <div class="kpi-content">
            <span class="kpi-value">{{ formatCurrency(kpis.totalProfit) }}</span>
            <span class="kpi-label">Profitto Totale</span>
          </div>
        </div>
      </div>

      <!-- Sales Chart -->
      <div class="chart-section">
        <h4><i class="pi pi-chart-line"></i> Andamento Vendite</h4>
        <div class="chart-container">
          <canvas ref="salesChartRef"></canvas>
        </div>
      </div>

      <!-- Ideation Costs Section -->
      <div class="ideation-section">
        <div class="section-header">
          <h4><i class="pi pi-wallet"></i> Costi di Ideazione</h4>
          <Button
            label="Aggiungi Costo"
            icon="pi pi-plus"
            class="p-button-sm"
            @click="showAddCostDialog = true"
          />
        </div>

        <DataTable
          :value="ideationCosts"
          responsiveLayout="scroll"
          class="ideation-table"
          :emptyMessage="'Nessun costo di ideazione registrato'"
        >
          <Column field="type" header="Tipo">
            <template #body="{ data }">
              <Tag :severity="getCostTypeSeverity(data.type)">{{ getCostTypeLabel(data.type) }}</Tag>
            </template>
          </Column>
          <Column field="description" header="Descrizione"></Column>
          <Column field="amount" header="Importo">
            <template #body="{ data }">{{ formatCurrency(Number(data.amount)) }}</template>
          </Column>
          <Column field="date" header="Data">
            <template #body="{ data }">{{ formatDate(data.date) }}</template>
          </Column>
          <Column header="Azioni" style="width: 100px">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="deleteCost(data.id)"
              />
            </template>
          </Column>
        </DataTable>

        <div class="ideation-total">
          <strong>Totale Costi Ideazione: {{ formatCurrency(totalIdeationCosts) }}</strong>
        </div>
      </div>

      <!-- Break-Even Section -->
      <div class="break-even-section">
        <h4><i class="pi pi-chart-bar"></i> Analisi Break-Even</h4>

        <div class="break-even-grid">
          <div class="be-card">
            <div class="be-label">Margine Unitario</div>
            <div class="be-value">{{ formatCurrency(breakEven.unitMargin) }}</div>
            <div class="be-subtitle">Prezzo {{ formatCurrency(breakEven.unitPrice) }} - Costo {{ formatCurrency(breakEven.unitCost) }}</div>
          </div>
          <div class="be-card">
            <div class="be-label">Punto di Pareggio</div>
            <div class="be-value">{{ breakEven.breakEvenUnits >= 0 ? breakEven.breakEvenUnits : 'N/A' }} unita</div>
          </div>
          <div class="be-card">
            <div class="be-label">Unita Vendute</div>
            <div class="be-value">{{ breakEven.currentUnitsSold }}</div>
          </div>
          <div class="be-card" :class="breakEven.isBreakEvenReached ? 'success' : 'pending'">
            <div class="be-label">Stato Break-Even</div>
            <div class="be-value">
              <template v-if="breakEven.isBreakEvenReached">
                <i class="pi pi-check-circle"></i> Raggiunto
              </template>
              <template v-else-if="breakEven.breakEvenUnits >= 0">
                Mancano {{ breakEven.unitsToBreakEven }} unita
              </template>
              <template v-else>
                N/A
              </template>
            </div>
            <div class="be-subtitle" v-if="breakEven.breakEvenDate">
              Raggiunto il {{ formatDate(breakEven.breakEvenDate) }}
            </div>
            <div class="be-subtitle" v-else-if="breakEven.projectedBreakEvenDate">
              Previsto: {{ formatDate(breakEven.projectedBreakEvenDate) }}
            </div>
          </div>
        </div>

        <!-- Break-even Progress -->
        <div class="be-progress" v-if="breakEven.breakEvenUnits > 0">
          <div class="be-progress-label">
            <span>Progresso verso Break-Even</span>
            <span>{{ breakEvenProgress.toFixed(0) }}%</span>
          </div>
          <ProgressBar :value="breakEvenProgress" :showValue="false" />
        </div>

        <!-- Profit Status -->
        <div class="profit-status" :class="breakEven.currentProfit >= 0 ? 'positive' : 'negative'">
          <span class="profit-label">Profitto Attuale (inclusi costi ideazione):</span>
          <span class="profit-value">{{ formatCurrency(breakEven.currentProfit) }}</span>
        </div>
      </div>

      <!-- Cumulative Profit Chart -->
      <div class="chart-section">
        <h4><i class="pi pi-chart-line"></i> Profitto Cumulativo nel Tempo</h4>
        <p class="chart-description">Il grafico mostra l'andamento del profitto partendo dai costi di ideazione (valore negativo iniziale).</p>
        <div class="chart-container">
          <canvas ref="profitChartRef"></canvas>
        </div>
      </div>
    </template>

    <!-- Add Cost Dialog -->
    <Dialog
      v-model:visible="showAddCostDialog"
      header="Aggiungi Costo di Ideazione"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="dialog-form">
        <div class="field">
          <label for="costType">Tipo *</label>
          <Dropdown
            id="costType"
            v-model="newCost.type"
            :options="costTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona tipo"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="costDescription">Descrizione *</label>
          <InputText id="costDescription" v-model="newCost.description" class="w-full" />
        </div>
        <div class="field">
          <label for="costAmount">Importo *</label>
          <InputNumber
            id="costAmount"
            v-model="newCost.amount"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="costDate">Data</label>
          <Calendar
            id="costDate"
            v-model="newCost.date"
            dateFormat="dd/mm/yy"
            :maxDate="new Date()"
            showIcon
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="costNotes">Note</label>
          <Textarea id="costNotes" v-model="newCost.notes" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="showAddCostDialog = false" />
        <Button label="Salva" icon="pi pi-check" @click="saveCost" :loading="savingCost" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import {
  Chart,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  productId: string;
}

const props = defineProps<Props>();
const toast = useToast();

// State
const loading = ref(true);
const dateRange = ref<Date[]>([]);
const kpis = ref({
  totalRevenue: 0,
  totalQuantity: 0,
  avgMargin: 0,
  totalProfit: 0,
});
const salesData = ref<any[]>([]);
const ideationCosts = ref<any[]>([]);
const breakEven = ref({
  totalIdeationCosts: 0,
  unitPrice: 0,
  unitCost: 0,
  unitMargin: 0,
  breakEvenUnits: -1,
  currentUnitsSold: 0,
  currentRevenue: 0,
  currentProfit: 0,
  isBreakEvenReached: false,
  unitsToBreakEven: 0,
  breakEvenDate: null as string | null,
  projectedBreakEvenDate: null as string | null,
  dailySalesAverage: 0,
});

// Dialog state
const showAddCostDialog = ref(false);
const savingCost = ref(false);
const newCost = ref({
  type: 'DESIGN',
  description: '',
  amount: 0,
  date: new Date(),
  notes: '',
});

// Chart refs
const salesChartRef = ref<HTMLCanvasElement | null>(null);
const profitChartRef = ref<HTMLCanvasElement | null>(null);
let salesChart: Chart | null = null;
let profitChart: Chart | null = null;

// Cost type options
const costTypeOptions = [
  { label: 'Design e Prototipazione', value: 'DESIGN' },
  { label: 'Ricerca e Sviluppo', value: 'RESEARCH' },
  { label: 'Attrezzature e Stampi', value: 'TOOLING' },
  { label: 'Marketing Iniziale', value: 'MARKETING' },
  { label: 'Certificazioni e Test', value: 'CERTIFICATION' },
  { label: 'Altro', value: 'OTHER' },
];

// Computed
const totalIdeationCosts = computed(() => {
  return ideationCosts.value.reduce((sum, cost) => sum + Number(cost.amount), 0);
});

const breakEvenProgress = computed(() => {
  if (breakEven.value.breakEvenUnits <= 0) return 0;
  return Math.min(100, (breakEven.value.currentUnitsSold / breakEven.value.breakEvenUnits) * 100);
});

// Formatters
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatPercent = (value: number) => {
  return `${(value || 0).toFixed(1)}%`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('it-IT');
};

const getCostTypeLabel = (type: string) => {
  const option = costTypeOptions.find((o) => o.value === type);
  return option ? option.label : type;
};

const getCostTypeSeverity = (type: string) => {
  const map: Record<string, string> = {
    DESIGN: 'info',
    RESEARCH: 'primary',
    TOOLING: 'warning',
    MARKETING: 'success',
    CERTIFICATION: 'secondary',
    OTHER: 'secondary',
  };
  return map[type] || 'secondary';
};

// Load data
const loadAnalytics = async () => {
  if (!props.productId) return;

  try {
    loading.value = true;

    const startDate = dateRange.value[0] || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.value[1] || new Date();

    const response = await api.get(`/products/${props.productId}/analytics`, {
      params: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
    });

    if (response.success && response.data) {
      const data = response.data;
      salesData.value = data.salesData || [];
      ideationCosts.value = data.ideationCosts || [];
      breakEven.value = data.breakEven || breakEven.value;
      kpis.value = data.kpis || kpis.value;

      await nextTick();
      renderCharts();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore caricamento analytics',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// Render charts
const renderCharts = () => {
  renderSalesChart();
  loadProfitChart();
};

const renderSalesChart = () => {
  if (!salesChartRef.value) return;

  if (salesChart) {
    salesChart.destroy();
  }

  const ctx = salesChartRef.value.getContext('2d');
  if (!ctx) return;

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: salesData.value.map((d) => formatDate(d.date)),
      datasets: [
        {
          label: 'Fatturato',
          data: salesData.value.map((d) => d.revenue),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Profitto',
          data: salesData.value.map((d) => d.profit),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`,
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => formatCurrency(value as number),
          },
        },
      },
    },
  });
};

const loadProfitChart = async () => {
  if (!profitChartRef.value) return;

  try {
    const startDate = dateRange.value[0] || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.value[1] || new Date();

    const response = await api.get(`/products/${props.productId}/profit-tracking`, {
      params: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
    });

    if (response.success && response.data) {
      renderProfitChart(response.data);
    }
  } catch (error: any) {
    console.error('Error loading profit chart:', error);
  }
};

const renderProfitChart = (data: any) => {
  if (!profitChartRef.value) return;

  if (profitChart) {
    profitChart.destroy();
  }

  const ctx = profitChartRef.value.getContext('2d');
  if (!ctx) return;

  const chartData = data.data || [];

  profitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map((d: any) => formatDate(d.date)),
      datasets: [
        {
          label: 'Profitto Cumulativo',
          data: chartData.map((d: any) => d.cumulativeProfit),
          borderColor: '#8b5cf6',
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(139, 92, 246, 0.1)';

            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)'); // Red for negative
            gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.1)'); // Yellow for near zero
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.2)'); // Green for positive
            return gradient;
          },
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Break-Even (0)',
          data: chartData.map(() => 0),
          borderColor: '#ef4444',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 1) return 'Break-Even: € 0';
              return `${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`;
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => formatCurrency(value as number),
          },
        },
      },
    },
  });
};

// Cost management
const saveCost = async () => {
  if (!newCost.value.type || !newCost.value.description || !newCost.value.amount) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Compila tutti i campi obbligatori',
      life: 3000,
    });
    return;
  }

  try {
    savingCost.value = true;

    const response = await api.post(`/products/${props.productId}/ideation-costs`, {
      type: newCost.value.type,
      description: newCost.value.description,
      amount: newCost.value.amount,
      date: newCost.value.date?.toISOString(),
      notes: newCost.value.notes,
    });

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Salvato',
        detail: 'Costo di ideazione aggiunto',
        life: 3000,
      });
      showAddCostDialog.value = false;
      newCost.value = { type: 'DESIGN', description: '', amount: 0, date: new Date(), notes: '' };
      await loadAnalytics();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore salvataggio costo',
      life: 3000,
    });
  } finally {
    savingCost.value = false;
  }
};

const deleteCost = async (costId: string) => {
  try {
    const response = await api.delete(`/products/${props.productId}/ideation-costs/${costId}`);

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Eliminato',
        detail: 'Costo di ideazione eliminato',
        life: 3000,
      });
      await loadAnalytics();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore eliminazione costo',
      life: 3000,
    });
  }
};

// Initialize
onMounted(() => {
  // Set default date range (last 90 days)
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  dateRange.value = [start, end];

  loadAnalytics();
});

onUnmounted(() => {
  if (salesChart) salesChart.destroy();
  if (profitChart) profitChart.destroy();
});

// Watch for product changes
watch(() => props.productId, () => {
  if (props.productId) {
    loadAnalytics();
  }
});
</script>

<style scoped>
.product-analytics {
  padding: 1rem 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #64748b;
}

.analytics-header {
  margin-bottom: 1.5rem;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.date-range label {
  font-weight: 600;
  color: #475569;
}

.date-picker {
  width: 280px;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-left: 4px solid;
}

.kpi-card.success { border-left-color: #22c55e; }
.kpi-card.primary { border-left-color: #3b82f6; }
.kpi-card.info { border-left-color: #06b6d4; }
.kpi-card.warning { border-left-color: #f59e0b; }

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.kpi-card.success .kpi-icon { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.kpi-card.primary .kpi-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.kpi-card.info .kpi-icon { background: rgba(6, 182, 212, 0.1); color: #06b6d4; }
.kpi-card.warning .kpi-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
}

.kpi-label {
  font-size: 0.85rem;
  color: #64748b;
}

/* Chart Section */
.chart-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.chart-section h4 {
  margin: 0 0 1rem 0;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-description {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1rem;
}

.chart-container {
  height: 300px;
  position: relative;
}

/* Ideation Section */
.ideation-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ideation-total {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  text-align: right;
  font-size: 1.1rem;
  color: #1e293b;
}

/* Break-Even Section */
.break-even-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.break-even-section h4 {
  margin: 0 0 1rem 0;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.break-even-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 900px) {
  .break-even-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.be-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.be-card.success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid #22c55e;
}

.be-card.pending {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
}

.be-label {
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.be-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.be-card.success .be-value { color: #22c55e; }

.be-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.be-progress {
  margin-bottom: 1rem;
}

.be-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.profit-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
}

.profit-status.positive {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.profit-status.negative {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.profit-value {
  font-size: 1.25rem;
}

/* Dialog Form */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  color: #475569;
  font-size: 0.875rem;
}

.w-full {
  width: 100%;
}
</style>
