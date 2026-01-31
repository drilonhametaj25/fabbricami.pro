<template>
  <div class="seasonality-chart">
    <!-- Header -->
    <div class="seasonality-header">
      <div class="header-title">
        <i class="pi pi-calendar"></i>
        <h3>Analisi Stagionalità</h3>
      </div>
      <div class="header-controls">
        <Dropdown
          v-model="selectedProductId"
          :options="productOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Tutti i prodotti"
          showClear
          filter
          filterPlaceholder="Cerca per nome o SKU..."
          class="product-filter"
          :loading="loadingProducts"
          :virtualScrollerOptions="{ itemSize: 38 }"
          scrollHeight="400px"
        />
        <Button
          icon="pi pi-refresh"
          class="p-button-outlined"
          :loading="loading"
          @click="loadSeasonality"
          v-tooltip.top="'Aggiorna'"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Analizzando stagionalità...</p>
    </div>

    <!-- Content -->
    <div v-else-if="seasonalityData.length > 0" class="seasonality-content">
      <!-- Heatmap -->
      <Card class="heatmap-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-th-large"></i>
            Heatmap Vendite per Mese
          </div>
        </template>
        <template #content>
          <div class="heatmap-container">
            <div class="heatmap-grid">
              <!-- Header mesi -->
              <div class="heatmap-header">
                <div class="product-cell header"></div>
                <div v-for="month in months" :key="month.value" class="month-cell header">
                  {{ month.short }}
                </div>
              </div>
              <!-- Righe prodotti -->
              <div
                v-for="product in displayedProducts"
                :key="product.productId"
                class="heatmap-row"
              >
                <div class="product-cell" :title="product.productName">
                  {{ truncate(product.productName, 25) }}
                </div>
                <div
                  v-for="(month, index) in months"
                  :key="month.value"
                  class="month-cell"
                  :style="{ backgroundColor: getHeatmapColor(product.monthlyPattern[index]?.percentageOfTotal / 100 || 0) }"
                  :title="`${month.label}: ${Math.round(product.monthlyPattern[index]?.avgQuantity || 0)} unità`"
                >
                  <span v-if="product.monthlyPattern[index]?.avgQuantity">
                    {{ Math.round(product.monthlyPattern[index].avgQuantity) }}
                  </span>
                </div>
              </div>
            </div>
            <!-- Legend -->
            <div class="heatmap-legend">
              <span class="legend-label">Basso</span>
              <div class="legend-gradient"></div>
              <span class="legend-label">Alto</span>
            </div>
          </div>
        </template>
      </Card>

      <!-- Top Seasonal Products -->
      <div class="seasonal-cards-grid">
        <!-- Prodotti più stagionali -->
        <Card class="seasonal-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-sun"></i>
              Prodotti più Stagionali
            </div>
          </template>
          <template #subtitle>
            Alta variabilità nelle vendite durante l'anno
          </template>
          <template #content>
            <div class="products-list">
              <div
                v-for="(product, index) in mostSeasonalProducts"
                :key="product.productId"
                class="product-item"
              >
                <div class="rank">{{ index + 1 }}</div>
                <div class="product-info">
                  <span class="name">{{ product.productName }}</span>
                  <div class="peak-months">
                    <Tag
                      v-for="month in product.peakMonths"
                      :key="month"
                      :value="getMonthName(month)"
                      severity="success"
                      class="month-tag"
                    />
                  </div>
                </div>
                <div class="seasonality-score">
                  <span class="score">{{ product.seasonalityScore }}</span>
                  <span class="label">variabilità</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Prodotti più stabili -->
        <Card class="seasonal-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-equals"></i>
              Prodotti più Stabili
            </div>
          </template>
          <template #subtitle>
            Vendite costanti durante tutto l'anno
          </template>
          <template #content>
            <div class="products-list">
              <div
                v-for="(product, index) in leastSeasonalProducts"
                :key="product.productId"
                class="product-item"
              >
                <div class="rank stable">{{ index + 1 }}</div>
                <div class="product-info">
                  <span class="name">{{ product.productName }}</span>
                  <div class="avg-sales">
                    <span class="value">~{{ Math.round(getAvgMonthlyQty(product)) }}</span>
                    <span class="unit">unità/mese</span>
                  </div>
                </div>
                <div class="seasonality-score stable">
                  <span class="score">{{ product.seasonalityScore }}</span>
                  <span class="label">variabilità</span>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Monthly Summary Chart -->
      <Card class="chart-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-chart-bar"></i>
            Vendite Aggregate per Mese
          </div>
        </template>
        <template #content>
          <div class="chart-container">
            <canvas ref="monthlyChartRef"></canvas>
          </div>
        </template>
      </Card>

      <!-- Peak Months Summary -->
      <Card class="peaks-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-flag"></i>
            Riepilogo Mesi
          </div>
        </template>
        <template #content>
          <div class="months-summary">
            <div
              v-for="month in monthsSummary"
              :key="month.value"
              class="month-summary-item"
              :class="{ peak: month.isPeak, low: month.isLow }"
            >
              <div class="month-name">{{ month.label }}</div>
              <div class="month-stats">
                <span class="products-count">{{ month.productsInPeak }} prodotti in picco</span>
                <span class="total-quantity">{{ formatNumber(month.totalQuantity) }} unità</span>
              </div>
              <ProgressBar
                :value="month.percentage"
                :showValue="false"
                :class="{ 'peak-bar': month.isPeak, 'low-bar': month.isLow }"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <i class="pi pi-calendar"></i>
      <p>Nessun dato di stagionalità disponibile</p>
      <small>Assicurati di avere ordini registrati per analizzare la stagionalità</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import Card from 'primevue/card';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import {
  Chart,
  BarController,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../services/api.service';

Chart.register(BarController, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const toast = useToast();

// State
const loading = ref(false);
const loadingProducts = ref(false);
const products = ref<any[]>([]);
const selectedProductId = ref<string | null>(null);
const seasonalityData = ref<any[]>([]);

// Chart refs
const monthlyChartRef = ref<HTMLCanvasElement | null>(null);
let monthlyChart: Chart | null = null;

// Months
const months = [
  { value: 1, label: 'Gennaio', short: 'Gen' },
  { value: 2, label: 'Febbraio', short: 'Feb' },
  { value: 3, label: 'Marzo', short: 'Mar' },
  { value: 4, label: 'Aprile', short: 'Apr' },
  { value: 5, label: 'Maggio', short: 'Mag' },
  { value: 6, label: 'Giugno', short: 'Giu' },
  { value: 7, label: 'Luglio', short: 'Lug' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Settembre', short: 'Set' },
  { value: 10, label: 'Ottobre', short: 'Ott' },
  { value: 11, label: 'Novembre', short: 'Nov' },
  { value: 12, label: 'Dicembre', short: 'Dic' },
];

// Computed
const productOptions = computed(() => {
  return [
    { label: 'Tutti i prodotti', value: null },
    ...products.value.map(p => ({ label: `${p.sku} - ${p.name}`, value: p.id })),
  ];
});

const displayedProducts = computed(() => {
  return seasonalityData.value.slice(0, 15); // Show top 15
});

const mostSeasonalProducts = computed(() => {
  return [...seasonalityData.value]
    .sort((a, b) => b.seasonalityScore - a.seasonalityScore)
    .slice(0, 5);
});

const leastSeasonalProducts = computed(() => {
  return [...seasonalityData.value]
    .filter(p => {
      const totalQty = p.monthlyPattern?.reduce((sum: number, m: any) => sum + (m.avgQuantity || 0), 0) || 0;
      return totalQty > 0;
    })
    .sort((a, b) => a.seasonalityScore - b.seasonalityScore)
    .slice(0, 5);
});

const monthsSummary = computed(() => {
  const summary = months.map(month => {
    let totalQuantity = 0;
    let productsInPeak = 0;

    for (const product of seasonalityData.value) {
      const monthData = product.monthlyPattern?.find((m: any) => m.month === month.value);
      if (monthData) {
        totalQuantity += monthData.avgQuantity || 0;
        if (product.peakMonths?.includes(month.value)) {
          productsInPeak++;
        }
      }
    }

    return {
      ...month,
      totalQuantity,
      productsInPeak,
      percentage: 0,
      isPeak: false,
      isLow: false,
    };
  });

  // Calculate percentages and identify peaks/lows
  const maxQuantity = Math.max(...summary.map(m => m.totalQuantity));
  const avgQuantity = summary.reduce((sum, m) => sum + m.totalQuantity, 0) / 12;

  for (const month of summary) {
    month.percentage = maxQuantity > 0 ? (month.totalQuantity / maxQuantity) * 100 : 0;
    month.isPeak = month.totalQuantity > avgQuantity * 1.2;
    month.isLow = month.totalQuantity < avgQuantity * 0.8;
  }

  return summary;
});

// Methods
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

const loadSeasonality = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedProductId.value) {
      params.set('productId', selectedProductId.value);
    }
    params.set('limit', '9999');

    const response = await api.get(`/analytics/products/seasonality?${params.toString()}`);

    if (response.success) {
      seasonalityData.value = response.data || [];
      await nextTick();
      renderChart();
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    console.error('Errore caricamento stagionalità:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Impossibile caricare analisi stagionalità',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

const renderChart = () => {
  if (!monthlyChartRef.value || seasonalityData.value.length === 0) return;

  // Aggregate monthly data
  const monthlyTotals = months.map(month => {
    let total = 0;
    for (const product of seasonalityData.value) {
      const monthData = product.monthlyPattern?.find((m: any) => m.month === month.value);
      if (monthData) {
        total += monthData.avgQuantity || 0;
      }
    }
    return Math.round(total);
  });

  if (monthlyChart) monthlyChart.destroy();

  const avgValue = monthlyTotals.reduce((sum, v) => sum + v, 0) / 12;

  monthlyChart = new Chart(monthlyChartRef.value, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Quantità Vendute',
        data: monthlyTotals,
        backgroundColor: monthlyTotals.map(value =>
          value > avgValue * 1.2
            ? 'rgba(16, 185, 129, 0.7)'
            : value < avgValue * 0.8
              ? 'rgba(239, 68, 68, 0.7)'
              : 'rgba(59, 130, 246, 0.7)'
        ),
        borderColor: monthlyTotals.map(value =>
          value > avgValue * 1.2
            ? 'rgb(16, 185, 129)'
            : value < avgValue * 0.8
              ? 'rgb(239, 68, 68)'
              : 'rgb(59, 130, 246)'
        ),
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} unità`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
};

// Helpers
const getHeatmapColor = (index: number): string => {
  // index is between 0 and 1
  const intensity = Math.min(1, Math.max(0, index));
  if (intensity === 0) return 'transparent';

  // Gradient from light blue to deep blue
  const r = Math.round(239 - intensity * 180);
  const g = Math.round(246 - intensity * 150);
  const b = Math.round(255 - intensity * 50);

  return `rgb(${r}, ${g}, ${b})`;
};

const getMonthName = (monthNum: number): string => {
  const month = months.find(m => m.value === monthNum);
  return month?.short || '';
};

const getAvgMonthlyQty = (product: any): number => {
  if (!product.monthlyPattern) return 0;
  const total = product.monthlyPattern.reduce((sum: number, m: any) => sum + (m.avgQuantity || 0), 0);
  return total / 12;
};

const truncate = (text: string, length: number): string => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('it-IT').format(value);
};

// Watch for product filter changes
watch(selectedProductId, () => {
  loadSeasonality();
});

onMounted(() => {
  loadProducts();
  loadSeasonality();
});
</script>

<style scoped>
.seasonality-chart {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.seasonality-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
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
  gap: 0.5rem;
  align-items: center;
}

.product-filter {
  min-width: 300px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-color-secondary);
  background: var(--surface-ground);
  border-radius: 8px;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.seasonality-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

/* Heatmap */
.heatmap-container {
  overflow-x: auto;
}

.heatmap-grid {
  display: flex;
  flex-direction: column;
  min-width: 800px;
}

.heatmap-header,
.heatmap-row {
  display: flex;
  align-items: center;
}

.product-cell {
  width: 200px;
  min-width: 200px;
  padding: 0.5rem;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-cell.header {
  font-weight: 600;
}

.month-cell {
  flex: 1;
  min-width: 50px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border: 1px solid var(--surface-border);
  color: var(--text-color);
}

.month-cell.header {
  background: var(--surface-100);
  font-weight: 600;
  font-size: 0.75rem;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.legend-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.legend-gradient {
  width: 150px;
  height: 12px;
  background: linear-gradient(to right, #f0f4ff, #3b82f6);
  border-radius: 4px;
}

/* Seasonal Cards */
.seasonal-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 1024px) {
  .seasonal-cards-grid {
    grid-template-columns: 1fr;
  }
}

.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.875rem;
}

.rank.stable {
  background: var(--blue-500);
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-info .name {
  display: block;
  font-weight: 500;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.peak-months {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.month-tag {
  font-size: 0.7rem;
}

.avg-sales {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.avg-sales .value {
  font-weight: 600;
  color: var(--text-color);
}

.seasonality-score {
  text-align: center;
  padding: 0.5rem;
  background: var(--orange-100);
  border-radius: 8px;
  min-width: 60px;
}

.seasonality-score.stable {
  background: var(--blue-100);
}

.seasonality-score .score {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--orange-700);
}

.seasonality-score.stable .score {
  color: var(--blue-700);
}

.seasonality-score .label {
  font-size: 0.65rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

/* Chart */
.chart-card {
  min-height: 350px;
}

.chart-container {
  height: 280px;
  position: relative;
}

/* Months Summary */
.months-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 1200px) {
  .months-summary {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .months-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}

.month-summary-item {
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 2px solid transparent;
}

.month-summary-item.peak {
  border-color: var(--green-300);
  background: var(--green-50);
}

.month-summary-item.low {
  border-color: var(--red-300);
  background: var(--red-50);
}

.month-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.month-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.month-stats .total-quantity {
  font-weight: 500;
  color: var(--text-color);
}

:deep(.peak-bar .p-progressbar-value) {
  background: var(--green-500);
}

:deep(.low-bar .p-progressbar-value) {
  background: var(--red-500);
}
</style>
