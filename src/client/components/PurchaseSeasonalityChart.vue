<template>
  <div class="seasonality-chart">
    <!-- Insights -->
    <div class="insights-section" v-if="peakMonths.length > 0 || lowMonths.length > 0">
      <div class="insight-card peak" v-if="peakMonths.length > 0">
        <div class="insight-icon">
          <i class="pi pi-arrow-up"></i>
        </div>
        <div class="insight-content">
          <span class="insight-label">Mesi di Picco</span>
          <span class="insight-value">{{ peakMonths.map(m => monthNames[m - 1]).join(', ') }}</span>
        </div>
      </div>
      <div class="insight-card low" v-if="lowMonths.length > 0">
        <div class="insight-icon">
          <i class="pi pi-arrow-down"></i>
        </div>
        <div class="insight-content">
          <span class="insight-label">Mesi Bassi</span>
          <span class="insight-value">{{ lowMonths.map(m => monthNames[m - 1]).join(', ') }}</span>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-container">
      <Chart
        v-if="chartData.labels && chartData.labels.length > 0"
        type="bar"
        :data="chartData"
        :options="chartOptions"
        class="seasonality-chart-canvas"
      />
      <div v-else-if="!loading" class="chart-empty">
        <i class="pi pi-chart-bar"></i>
        <p>Nessun dato di stagionalità disponibile</p>
        <small>I dati vengono calcolati sugli ultimi 2 anni di ordini</small>
      </div>
      <div v-else class="chart-loading">
        <i class="pi pi-spin pi-spinner"></i>
        <p>Caricamento dati...</p>
      </div>
    </div>

    <!-- Monthly Details Table -->
    <div class="monthly-details" v-if="monthlyPattern.length > 0">
      <h4>Dettaglio Mensile</h4>
      <DataTable :value="monthlyPattern" responsiveLayout="scroll" class="custom-table" :rowHover="true">
        <Column field="monthName" header="Mese" style="min-width: 100px">
          <template #body="{ data }">
            <span class="month-name">{{ data.monthName }}</span>
          </template>
        </Column>
        <Column field="ordersCount" header="Ordini" sortable style="min-width: 100px">
          <template #body="{ data }">
            <span class="orders-count">{{ data.ordersCount }}</span>
          </template>
        </Column>
        <Column field="totalSpent" header="Totale Speso" sortable style="min-width: 130px">
          <template #body="{ data }">
            <span class="amount">{{ formatCurrency(data.totalSpent) }}</span>
          </template>
        </Column>
        <Column field="avgOrderValue" header="Valore Medio" sortable style="min-width: 130px">
          <template #body="{ data }">
            <span class="amount">{{ formatCurrency(data.avgOrderValue) }}</span>
          </template>
        </Column>
        <Column field="percentageOfTotal" header="% Totale" sortable style="min-width: 100px">
          <template #body="{ data }">
            <div class="percentage-cell">
              <ProgressBar :value="data.percentageOfTotal" :showValue="false" style="height: 8px" />
              <span class="percentage-value">{{ data.percentageOfTotal.toFixed(1) }}%</span>
            </div>
          </template>
        </Column>
        <Column header="Trend" style="min-width: 80px">
          <template #body="{ data }">
            <Tag v-if="peakMonths.includes(data.month)" severity="success" icon="pi pi-arrow-up">
              Alto
            </Tag>
            <Tag v-else-if="lowMonths.includes(data.month)" severity="warning" icon="pi pi-arrow-down">
              Basso
            </Tag>
            <Tag v-else severity="secondary">
              Normale
            </Tag>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Tips -->
    <div class="tips-section" v-if="peakMonths.length > 0 || lowMonths.length > 0">
      <h4><i class="pi pi-lightbulb"></i> Suggerimenti</h4>
      <ul>
        <li v-if="peakMonths.length > 0">
          <strong>Mesi di picco ({{ peakMonths.map(m => monthNames[m - 1]).join(', ') }}):</strong>
          Pianifica ordini anticipati per evitare ritardi di consegna
        </li>
        <li v-if="lowMonths.length > 0">
          <strong>Mesi bassi ({{ lowMonths.map(m => monthNames[m - 1]).join(', ') }}):</strong>
          Opportunità per negoziare condizioni migliori con i fornitori
        </li>
        <li>Considera di consolidare ordini per ottenere sconti volume</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Chart from 'primevue/chart';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const toast = useToast();

// Constants
const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const monthNamesShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// State
const loading = ref(false);
const seasonalityData = ref<any>(null);

// Computed
const monthlyPattern = computed(() => seasonalityData.value?.monthlyPattern || []);
const peakMonths = computed(() => seasonalityData.value?.peakMonths || []);
const lowMonths = computed(() => seasonalityData.value?.lowMonths || []);

const chartData = computed(() => {
  if (!seasonalityData.value?.monthlyPattern) {
    return { labels: [], datasets: [] };
  }

  const pattern = seasonalityData.value.monthlyPattern;

  return {
    labels: pattern.map((m: any) => m.monthName),
    datasets: [
      {
        type: 'bar',
        label: 'Totale Speso',
        data: pattern.map((m: any) => m.totalSpent),
        backgroundColor: pattern.map((m: any) => {
          if (peakMonths.value.includes(m.month)) return 'rgba(34, 197, 94, 0.7)';
          if (lowMonths.value.includes(m.month)) return 'rgba(249, 115, 22, 0.7)';
          return 'rgba(59, 130, 246, 0.7)';
        }),
        borderColor: pattern.map((m: any) => {
          if (peakMonths.value.includes(m.month)) return '#22c55e';
          if (lowMonths.value.includes(m.month)) return '#f97316';
          return '#3b82f6';
        }),
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Numero Ordini',
        data: pattern.map((m: any) => m.ordersCount),
        fill: false,
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index',
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 12,
      callbacks: {
        label: (context: any) => {
          if (context.dataset.label === 'Totale Speso') {
            return `Spesa: ${formatCurrency(context.raw)}`;
          }
          return `Ordini: ${context.raw}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
      },
      ticks: {
        callback: (value: number) => formatCurrency(value),
      },
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      beginAtZero: true,
      grid: {
        drawOnChartArea: false,
      },
      ticks: {
        stepSize: 1,
        precision: 0,
      },
    },
  },
}));

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const loadSeasonality = async () => {
  loading.value = true;
  try {
    const response = await api.get('/purchase-orders/analytics/seasonality');
    seasonalityData.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento stagionalità',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadSeasonality();
});
</script>

<style scoped>
.seasonality-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Insights Section */
.insights-section {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.insight-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--border-radius-lg);
  flex: 1;
  min-width: 200px;
}

.insight-card.peak {
  background: linear-gradient(135deg, var(--green-50), var(--green-100));
  border: 1px solid var(--green-200);
}

.insight-card.low {
  background: linear-gradient(135deg, var(--orange-50), var(--orange-100));
  border: 1px solid var(--orange-200);
}

.insight-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.insight-card.peak .insight-icon {
  background: var(--green-200);
  color: var(--green-700);
}

.insight-card.low .insight-icon {
  background: var(--orange-200);
  color: var(--orange-700);
}

.insight-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.insight-label {
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

.insight-value {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-color);
}

/* Chart Container */
.chart-container {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  height: 400px;
}

.seasonality-chart-canvas {
  height: 100%;
}

.chart-empty,
.chart-loading {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);
}

.chart-empty i,
.chart-loading i {
  font-size: 3rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.chart-empty small {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
}

/* Monthly Details Table */
.monthly-details {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
}

.monthly-details h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-color);
}

.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
}

.month-name {
  font-weight: 500;
}

.orders-count {
  font-weight: 600;
  color: var(--color-primary-600);
}

.amount {
  font-weight: 600;
  color: var(--text-color);
}

.percentage-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.percentage-value {
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}

/* Tips Section */
.tips-section {
  background: var(--purple-50);
  border: 1px solid var(--purple-200);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
}

.tips-section h4 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-3) 0;
  color: var(--purple-700);
  font-size: var(--font-size-base);
}

.tips-section h4 i {
  color: var(--purple-500);
}

.tips-section ul {
  margin: 0;
  padding-left: var(--space-6);
  color: var(--purple-700);
}

.tips-section li {
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.tips-section li:last-child {
  margin-bottom: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .insights-section {
    flex-direction: column;
  }

  .insight-card {
    min-width: auto;
  }
}
</style>
