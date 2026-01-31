<template>
  <div class="product-comparison">
    <!-- Header con selezione prodotti -->
    <div class="comparison-header">
      <div class="header-title">
        <i class="pi pi-chart-bar"></i>
        <h3>Confronto Prodotti</h3>
      </div>
      <div class="header-controls">
        <MultiSelect
          v-model="selectedProductIds"
          :options="products"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleziona prodotti da confrontare (max 5)"
          :maxSelectedLabels="3"
          filter
          filterPlaceholder="Cerca per nome o SKU..."
          :filterFields="['name', 'sku']"
          class="product-selector"
          :loading="loadingProducts"
          :virtualScrollerOptions="{ itemSize: 44 }"
          scrollHeight="400px"
        >
          <template #option="{ option }">
            <div class="product-option">
              <span class="sku">{{ option.sku }}</span>
              <span class="name">{{ option.name }}</span>
            </div>
          </template>
        </MultiSelect>
        <Calendar
          v-model="dateRange"
          selectionMode="range"
          :manualInput="false"
          dateFormat="dd/mm/yy"
          placeholder="Periodo"
          showIcon
          class="date-selector"
        />
        <Button
          label="Confronta"
          icon="pi pi-chart-line"
          :loading="loading"
          :disabled="selectedProductIds.length < 2"
          @click="loadComparison"
        />
      </div>
    </div>

    <!-- Messaggio se non ci sono prodotti selezionati -->
    <div v-if="selectedProductIds.length < 2 && !loading" class="no-selection">
      <i class="pi pi-info-circle"></i>
      <p>Seleziona almeno 2 prodotti per confrontarli</p>
    </div>

    <!-- Contenuto comparazione -->
    <div v-else-if="comparison" class="comparison-content">
      <!-- Tabella comparativa -->
      <Card class="comparison-table-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-table"></i>
            Tabella Comparativa
          </div>
        </template>
        <template #content>
          <DataTable :value="comparisonTableData" class="comparison-table" stripedRows>
            <Column field="metric" header="Metrica" :style="{ width: '200px' }">
              <template #body="{ data }">
                <span class="metric-name">{{ data.metric }}</span>
              </template>
            </Column>
            <Column v-for="product in comparison.products" :key="product.productId" :header="product.productName">
              <template #body="{ data }">
                <span :class="['metric-value', data.bestProductId === product.productId ? 'best' : '']">
                  {{ data.values[product.productId] }}
                  <i v-if="data.bestProductId === product.productId" class="pi pi-star-fill best-icon"></i>
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- Grafici -->
      <div class="charts-grid">
        <!-- Grafico Fatturato -->
        <Card class="chart-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-euro"></i>
              Fatturato nel tempo
            </div>
          </template>
          <template #content>
            <div class="chart-container">
              <canvas ref="revenueChartRef"></canvas>
            </div>
          </template>
        </Card>

        <!-- Grafico Quantità -->
        <Card class="chart-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-box"></i>
              Quantità vendute nel tempo
            </div>
          </template>
          <template #content>
            <div class="chart-container">
              <canvas ref="quantityChartRef"></canvas>
            </div>
          </template>
        </Card>

        <!-- Grafico Margini -->
        <Card class="chart-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-percentage"></i>
              Margini a confronto
            </div>
          </template>
          <template #content>
            <div class="chart-container">
              <canvas ref="marginChartRef"></canvas>
            </div>
          </template>
        </Card>

        <!-- Grafico Profitto -->
        <Card class="chart-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-chart-line"></i>
              Profitto nel tempo
            </div>
          </template>
          <template #content>
            <div class="chart-container">
              <canvas ref="profitChartRef"></canvas>
            </div>
          </template>
        </Card>
      </div>

      <!-- Riepilogo -->
      <Card class="summary-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-flag"></i>
            Riepilogo Confronto
          </div>
        </template>
        <template #content>
          <div class="summary-grid">
            <div v-for="product in comparison.products" :key="product.productId" class="summary-item">
              <div class="summary-header">
                <span class="product-name">{{ product.productName }}</span>
                <Tag :severity="getPerformanceSeverity(product)" :value="getPerformanceLabel(product)" />
              </div>
              <div class="summary-metrics">
                <div class="metric">
                  <span class="label">Fatturato:</span>
                  <span class="value">€ {{ formatNumber(product.metrics.totalRevenue) }}</span>
                </div>
                <div class="metric">
                  <span class="label">Unità vendute:</span>
                  <span class="value">{{ product.metrics.totalQuantity }}</span>
                </div>
                <div class="metric">
                  <span class="label">Margine medio:</span>
                  <span class="value">{{ (product.metrics.avgMargin * 100).toFixed(1) }}%</span>
                </div>
                <div class="metric">
                  <span class="label">Trend:</span>
                  <span :class="['value', product.metrics.trend >= 0 ? 'positive' : 'negative']">
                    <i :class="product.metrics.trend >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
                    {{ Math.abs(product.metrics.trend).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-overlay">
      <ProgressSpinner />
      <p>Caricamento confronto...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import MultiSelect from 'primevue/multiselect';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import {
  Chart,
  LineController,
  BarController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import api from '../services/api.service';

// Register Chart.js components
Chart.register(
  LineController,
  BarController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const toast = useToast();

// State
const products = ref<any[]>([]);
const loadingProducts = ref(false);
const selectedProductIds = ref<string[]>([]);
const dateRange = ref<Date[] | null>(null);
const loading = ref(false);
const comparison = ref<any>(null);

// Chart refs
const revenueChartRef = ref<HTMLCanvasElement | null>(null);
const quantityChartRef = ref<HTMLCanvasElement | null>(null);
const marginChartRef = ref<HTMLCanvasElement | null>(null);
const profitChartRef = ref<HTMLCanvasElement | null>(null);

// Chart instances
let revenueChart: Chart | null = null;
let quantityChart: Chart | null = null;
let marginChart: Chart | null = null;
let profitChart: Chart | null = null;

// Colors for different products
const chartColors = [
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' },
  { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgb(245, 158, 11)' },
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgb(239, 68, 68)' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgb(139, 92, 246)' },
];

// Computed: tabella comparativa
const comparisonTableData = computed(() => {
  if (!comparison.value?.products) return [];

  const products = comparison.value.products;
  const metrics = [
    { key: 'totalRevenue', label: 'Fatturato Totale', format: (v: number) => `€ ${formatNumber(v)}`, higherIsBetter: true },
    { key: 'totalQuantity', label: 'Unità Vendute', format: (v: number) => v.toString(), higherIsBetter: true },
    { key: 'avgMargin', label: 'Margine Medio', format: (v: number) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
    { key: 'totalProfit', label: 'Profitto Totale', format: (v: number) => `€ ${formatNumber(v)}`, higherIsBetter: true },
    { key: 'trend', label: 'Trend', format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, higherIsBetter: true },
  ];

  return metrics.map(metric => {
    const values: Record<string, string> = {};
    let bestProductId = '';
    let bestValue = metric.higherIsBetter ? -Infinity : Infinity;

    for (const product of products) {
      const value = product.metrics[metric.key] ?? 0;
      values[product.productId] = metric.format(value);

      if (metric.higherIsBetter ? value > bestValue : value < bestValue) {
        bestValue = value;
        bestProductId = product.productId;
      }
    }

    return {
      metric: metric.label,
      values,
      bestProductId,
    };
  });
});

// Load products list
const loadProducts = async () => {
  loadingProducts.value = true;
  try {
    const response = await api.get('/products?limit=9999');
    if (response.success) {
      products.value = response.data.items || [];
    }
  } catch (error) {
    console.error('Errore caricamento prodotti:', error);
  } finally {
    loadingProducts.value = false;
  }
};

// Load comparison data
const loadComparison = async () => {
  if (selectedProductIds.value.length < 2) {
    toast.add({
      severity: 'warn',
      summary: 'Selezione insufficiente',
      detail: 'Seleziona almeno 2 prodotti',
      life: 3000,
    });
    return;
  }

  if (selectedProductIds.value.length > 5) {
    toast.add({
      severity: 'warn',
      summary: 'Troppi prodotti',
      detail: 'Massimo 5 prodotti per il confronto',
      life: 3000,
    });
    return;
  }

  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('ids', selectedProductIds.value.join(','));

    if (dateRange.value && dateRange.value.length === 2) {
      params.set('start', dateRange.value[0].toISOString());
      params.set('end', dateRange.value[1].toISOString());
    }

    const response = await api.get(`/analytics/products/compare?${params.toString()}`);

    if (response.success) {
      comparison.value = response.data;
      await nextTick();
      renderCharts();
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    console.error('Errore caricamento confronto:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Impossibile caricare il confronto',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

// Render all charts
const renderCharts = () => {
  if (!comparison.value?.products) return;

  const products = comparison.value.products;

  // Collect all unique dates
  const allDates = new Set<string>();
  for (const product of products) {
    for (const point of product.salesData || []) {
      allDates.add(point.date);
    }
  }
  const labels = Array.from(allDates).sort();

  // Helper to get data for a product
  const getDataForProduct = (product: any, field: string) => {
    const dataMap = new Map<string, number>();
    for (const point of product.salesData || []) {
      dataMap.set(point.date, point[field] || 0);
    }
    return labels.map(date => dataMap.get(date) || 0);
  };

  // Destroy existing charts
  if (revenueChart) revenueChart.destroy();
  if (quantityChart) quantityChart.destroy();
  if (marginChart) marginChart.destroy();
  if (profitChart) profitChart.destroy();

  // Revenue Chart
  if (revenueChartRef.value) {
    revenueChart = new Chart(revenueChartRef.value, {
      type: 'line',
      data: {
        labels: labels.map(d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
        datasets: products.map((product: any, index: number) => ({
          label: product.productName,
          data: getDataForProduct(product, 'revenue'),
          borderColor: chartColors[index % chartColors.length].border,
          backgroundColor: chartColors[index % chartColors.length].bg,
          fill: false,
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `€ ${value}`,
            },
          },
        },
      },
    });
  }

  // Quantity Chart
  if (quantityChartRef.value) {
    quantityChart = new Chart(quantityChartRef.value, {
      type: 'line',
      data: {
        labels: labels.map(d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
        datasets: products.map((product: any, index: number) => ({
          label: product.productName,
          data: getDataForProduct(product, 'quantity'),
          borderColor: chartColors[index % chartColors.length].border,
          backgroundColor: chartColors[index % chartColors.length].bg,
          fill: false,
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  // Margin Chart (bar chart)
  if (marginChartRef.value) {
    marginChart = new Chart(marginChartRef.value, {
      type: 'bar',
      data: {
        labels: products.map((p: any) => p.productName),
        datasets: [{
          label: 'Margine %',
          data: products.map((p: any) => (p.metrics.avgMargin || 0) * 100),
          backgroundColor: products.map((_: any, i: number) => chartColors[i % chartColors.length].bg),
          borderColor: products.map((_: any, i: number) => chartColors[i % chartColors.length].border),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
        },
      },
    });
  }

  // Profit Chart
  if (profitChartRef.value) {
    profitChart = new Chart(profitChartRef.value, {
      type: 'line',
      data: {
        labels: labels.map(d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
        datasets: products.map((product: any, index: number) => ({
          label: product.productName,
          data: getDataForProduct(product, 'profit'),
          borderColor: chartColors[index % chartColors.length].border,
          backgroundColor: chartColors[index % chartColors.length].bg,
          fill: false,
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `€ ${value}`,
            },
          },
        },
      },
    });
  }
};

// Helpers
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const getPerformanceSeverity = (product: any): string => {
  const margin = product.metrics.avgMargin || 0;
  const trend = product.metrics.trend || 0;

  if (margin > 0.3 && trend > 0) return 'success';
  if (margin > 0.2 || trend > 0) return 'info';
  if (margin > 0.1) return 'warn';
  return 'danger';
};

const getPerformanceLabel = (product: any): string => {
  const margin = product.metrics.avgMargin || 0;
  const trend = product.metrics.trend || 0;

  if (margin > 0.3 && trend > 0) return 'Ottimo';
  if (margin > 0.2 || trend > 0) return 'Buono';
  if (margin > 0.1) return 'Discreto';
  return 'Da rivedere';
};

// Watch for product selection changes
watch(selectedProductIds, (newVal) => {
  if (newVal.length > 5) {
    selectedProductIds.value = newVal.slice(0, 5);
    toast.add({
      severity: 'warn',
      summary: 'Limite raggiunto',
      detail: 'Massimo 5 prodotti selezionabili',
      life: 3000,
    });
  }
});

onMounted(() => {
  loadProducts();

  // Default date range: last 90 days
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  dateRange.value = [start, end];
});
</script>

<style scoped>
.product-comparison {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comparison-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title i {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.header-title h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.header-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.product-selector {
  min-width: 350px;
  flex: 1;
}

.date-selector {
  width: 250px;
}

.product-option {
  display: flex;
  gap: 0.5rem;
}

.product-option .sku {
  font-weight: 600;
  color: var(--primary-color);
}

.product-option .name {
  color: var(--text-color-secondary);
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-color-secondary);
  background: var(--surface-ground);
  border-radius: 8px;
  border: 2px dashed var(--surface-border);
}

.no-selection i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.comparison-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comparison-table-card {
  overflow-x: auto;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.card-title i {
  color: var(--primary-color);
}

.metric-name {
  font-weight: 500;
}

.metric-value {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.metric-value.best {
  color: var(--green-600);
  font-weight: 600;
}

.best-icon {
  color: var(--yellow-500);
  font-size: 0.75rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  min-height: 350px;
}

.chart-container {
  height: 280px;
  position: relative;
}

.summary-card {
  background: var(--surface-card);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.summary-item {
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.product-name {
  font-weight: 600;
  font-size: 1rem;
}

.summary-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-metrics .metric {
  display: flex;
  justify-content: space-between;
}

.summary-metrics .label {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.summary-metrics .value {
  font-weight: 500;
}

.summary-metrics .value.positive {
  color: var(--green-600);
}

.summary-metrics .value.negative {
  color: var(--red-600);
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-color-secondary);
}

.loading-overlay p {
  margin-top: 1rem;
}
</style>
