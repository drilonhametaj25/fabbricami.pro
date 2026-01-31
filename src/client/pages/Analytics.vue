<template>
  <div class="analytics-page">
    <PageHeader
      title="Analytics e Report"
      subtitle="Dashboard analitica vendite e performance"
      icon="pi pi-chart-bar"
    />

    <!-- Tab Navigation -->
    <TabView v-model:activeIndex="activeTab" class="analytics-tabs">
      <!-- Tab 1: Overview -->
      <TabPanel header="Overview">
        <!-- KPI Row -->
        <section class="stats-section">
          <div class="stats-grid">
            <StatsCard
              label="Fatturato Totale"
              :value="kpis.totalRevenue"
              icon="pi pi-chart-line"
              variant="success"
              format="currency"
            />
            <StatsCard
              label="Ordini Totali"
              :value="kpis.totalOrders"
              icon="pi pi-shopping-cart"
              variant="primary"
              format="number"
            />
            <StatsCard
              label="Scontrino Medio"
              :value="kpis.avgOrderValue"
              icon="pi pi-chart-bar"
              variant="info"
              format="currency"
            />
            <StatsCard
              label="Tasso Completamento"
              :value="kpis.completionRate"
              icon="pi pi-percentage"
              variant="warning"
              format="percent"
            />
          </div>
        </section>

        <!-- Charts Row 1 -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3 class="chart-card__title">Trend Vendite</h3>
            <div class="chart-card__content">
              <canvas ref="salesTrendChart"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <h3 class="chart-card__title">Performance per Canale</h3>
            <div class="chart-card__content">
              <canvas ref="channelPerformanceChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Charts Row 2 -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3 class="chart-card__title">Top 10 Prodotti per Vendite</h3>
            <div class="chart-card__content">
              <canvas ref="topProductsChart"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <h3 class="chart-card__title">Top 10 Clienti per Fatturato</h3>
            <div class="chart-card__content">
              <canvas ref="topCustomersChart"></canvas>
            </div>
          </div>
        </div>

        <!-- ABC Analysis -->
        <div class="table-card">
          <h3 class="table-card__title">Analisi ABC Prodotti</h3>
          <div class="table-card__content">
            <DataTable
              :value="abcAnalysis"
              :loading="loading"
              responsiveLayout="scroll"
              stripedRows
            >
              <Column field="sku" header="SKU"></Column>
              <Column field="productName" header="Prodotto"></Column>
              <Column field="category" header="Classe ABC">
                <template #body="{ data }">
                  <Tag :severity="getAbcSeverity(data.category)">
                    {{ data.category }}
                  </Tag>
                </template>
              </Column>
              <Column field="totalRevenue" header="Fatturato">
                <template #body="{ data }">
                  {{ formatCurrency(data.totalRevenue) }}
                </template>
              </Column>
              <Column field="totalQuantity" header="Quantita Venduta"></Column>
              <Column field="revenuePercentage" header="% Fatturato">
                <template #body="{ data }">
                  {{ formatPercent(data.revenuePercentage) }}
                </template>
              </Column>
              <Column field="cumulativePercentage" header="% Cumulativa">
                <template #body="{ data }">
                  {{ formatPercent(data.cumulativePercentage) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 2: Product Analytics -->
      <TabPanel header="Prodotti Avanzate">
        <div class="product-analytics-section">
          <!-- Highest Margins & Costs -->
          <div class="charts-grid">
            <Card class="analytics-card">
              <template #title>
                <div class="card-title-icon">
                  <i class="pi pi-arrow-up"></i>
                  Prodotti con Margine Maggiore
                </div>
              </template>
              <template #content>
                <DataTable
                  :value="highestMargins"
                  :loading="loadingProductAnalytics"
                  stripedRows
                  class="compact-table"
                >
                  <Column field="sku" header="SKU" :style="{ width: '100px' }"></Column>
                  <Column field="name" header="Prodotto">
                    <template #body="{ data }">
                      <span class="product-name-cell">{{ data.name }}</span>
                    </template>
                  </Column>
                  <Column field="margin" header="Margine">
                    <template #body="{ data }">
                      <Tag :severity="getMarginSeverity(data.marginPercent / 100)" class="margin-tag">
                        {{ data.marginPercent?.toFixed(1) || 0 }}%
                      </Tag>
                    </template>
                  </Column>
                  <Column field="price" header="Prezzo">
                    <template #body="{ data }">
                      {{ formatCurrency(data.price) }}
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>

            <Card class="analytics-card">
              <template #title>
                <div class="card-title-icon">
                  <i class="pi pi-arrow-down"></i>
                  Prodotti con Costo Maggiore
                </div>
              </template>
              <template #content>
                <DataTable
                  :value="highestCosts"
                  :loading="loadingProductAnalytics"
                  stripedRows
                  class="compact-table"
                >
                  <Column field="sku" header="SKU" :style="{ width: '100px' }"></Column>
                  <Column field="name" header="Prodotto">
                    <template #body="{ data }">
                      <span class="product-name-cell">{{ data.name }}</span>
                    </template>
                  </Column>
                  <Column field="cost" header="Costo">
                    <template #body="{ data }">
                      <span class="cost-value">{{ formatCurrency(data.cost) }}</span>
                    </template>
                  </Column>
                  <Column field="margin" header="Margine">
                    <template #body="{ data }">
                      <Tag :severity="getMarginSeverity(data.margin / 100)" class="margin-tag">
                        {{ data.margin?.toFixed(1) || 0 }}%
                      </Tag>
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>

          <!-- Product Recommendations -->
          <ProductRecommendations
            @analyze="openProductAnalytics"
            @view="openProductDialog"
          />
        </div>
      </TabPanel>

      <!-- Tab 3: Product Comparison -->
      <TabPanel header="Confronto Prodotti">
        <ProductComparison />
      </TabPanel>

      <!-- Tab 4: Seasonality -->
      <TabPanel header="Stagionalità">
        <SeasonalityChart />
      </TabPanel>
    </TabView>

    <!-- Product Dialog -->
    <ProductDialog
      v-model="showProductDialog"
      :product="selectedProduct"
      @save="onProductSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import ProductComparison from '../components/ProductComparison.vue';
import SeasonalityChart from '../components/SeasonalityChart.vue';
import ProductRecommendations from '../components/ProductRecommendations.vue';
import ProductDialog from '../components/ProductDialog.vue';
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const toast = useToast();
const loading = ref(false);
const loadingProductAnalytics = ref(false);
const activeTab = ref(0);

const kpis = ref({
  totalRevenue: 0,
  totalOrders: 0,
  avgOrderValue: 0,
  completionRate: 0,
});

const abcAnalysis = ref([]);
const highestMargins = ref<any[]>([]);
const highestCosts = ref<any[]>([]);

// Product Dialog
const showProductDialog = ref(false);
const selectedProduct = ref<any>(null);

const salesTrendChart = ref<HTMLCanvasElement | null>(null);
const channelPerformanceChart = ref<HTMLCanvasElement | null>(null);
const topProductsChart = ref<HTMLCanvasElement | null>(null);
const topCustomersChart = ref<HTMLCanvasElement | null>(null);

let salesChart: Chart | null = null;
let channelChart: Chart | null = null;
let productsChart: Chart | null = null;
let customersChart: Chart | null = null;

const formatNumber = (value: number | undefined | null) => {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const formatCurrency = (value: number | undefined | null) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatPercent = (value: number | undefined | null) => {
  if (value === undefined || value === null) return '0.00%';
  return `${value.toFixed(2)}%`;
};

const getAbcSeverity = (category: string) => {
  const map: Record<string, string> = {
    A: 'success',
    B: 'warning',
    C: 'danger',
  };
  return map[category] || 'info';
};

const getMarginSeverity = (margin: number): string => {
  if (margin > 0.4) return 'success';
  if (margin > 0.2) return 'info';
  if (margin > 0.1) return 'warn';
  return 'danger';
};

const loadAnalytics = async () => {
  try {
    loading.value = true;

    // Load KPIs
    const kpisResponse = await api.get('/analytics/kpis');
    if (kpisResponse.success && kpisResponse.data) {
      // Map API response to local kpis structure
      kpis.value = {
        totalRevenue: kpisResponse.data.revenue || 0,
        totalOrders: kpisResponse.data.ordersCount || 0,
        avgOrderValue: kpisResponse.data.averageOrderValue || 0,
        completionRate: kpisResponse.data.completionRate || 0,
      };
    }

    // Load ABC Analysis
    const abcResponse = await api.get('/analytics/abc-analysis');
    if (abcResponse.success && abcResponse.data) {
      // Flatten the categorized response into a single array
      const data = abcResponse.data;
      const flattenedData = [
        ...(data.A || []),
        ...(data.B || []),
        ...(data.C || []),
      ];

      // Calculate total revenue for percentage
      const totalRevenue = flattenedData.reduce((sum: number, item: any) => sum + item.revenue, 0);

      // Map fields to match DataTable columns
      abcAnalysis.value = flattenedData.map((item: any) => ({
        sku: item.productSku,
        productName: item.productName,
        category: item.classification, // A, B, or C
        totalRevenue: item.revenue,
        totalQuantity: item.quantitySold,
        revenuePercentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
        cumulativePercentage: item.cumulativePercent,
      }));
    }

    // Load chart data
    await nextTick();
    await loadCharts();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento analytics',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadProductAnalytics = async () => {
  try {
    loadingProductAnalytics.value = true;

    // Load highest margin products
    const marginsResponse = await api.get('/analytics/products/highest-margins?limit=10');
    if (marginsResponse.success) {
      highestMargins.value = marginsResponse.data || [];
    }

    // Load highest cost products
    const costsResponse = await api.get('/analytics/products/highest-costs?limit=10');
    if (costsResponse.success) {
      highestCosts.value = costsResponse.data || [];
    }
  } catch (error: any) {
    console.error('Error loading product analytics:', error);
  } finally {
    loadingProductAnalytics.value = false;
  }
};

const loadCharts = async () => {
  try {
    // Sales Trend
    const salesTrendResponse = await api.get('/analytics/sales-trend?period=30');
    if (salesTrendResponse.success && salesTrendChart.value) {
      const data = salesTrendResponse.data;

      if (salesChart) salesChart.destroy();

      salesChart = new Chart(salesTrendChart.value, {
        type: 'line',
        data: {
          labels: data.map((d: any) => new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })),
          datasets: [
            {
              label: 'Fatturato',
              data: data.map((d: any) => d.revenue),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `${formatCurrency(context.parsed.y)}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `${value}`,
              },
            },
          },
        },
      });
    }

    // Channel Performance
    const channelResponse = await api.get('/analytics/performance-by-source');
    if (channelResponse.success && channelPerformanceChart.value) {
      const data = channelResponse.data;

      if (channelChart) channelChart.destroy();

      channelChart = new Chart(channelPerformanceChart.value, {
        type: 'doughnut',
        data: {
          labels: data.map((d: any) => d.source),
          datasets: [
            {
              data: data.map((d: any) => d.revenue),
              backgroundColor: [
                'rgb(59, 130, 246)',
                'rgb(16, 185, 129)',
                'rgb(251, 191, 36)',
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${formatCurrency(context.parsed as number)}`,
              },
            },
          },
        },
      });
    }

    // Top Products
    const topProductsResponse = await api.get('/analytics/top-products?limit=9999');
    if (topProductsResponse.success && topProductsChart.value) {
      const data = topProductsResponse.data;

      if (productsChart) productsChart.destroy();

      productsChart = new Chart(topProductsChart.value, {
        type: 'bar',
        data: {
          labels: data.map((d: any) => d.productName.substring(0, 20) + '...'),
          datasets: [
            {
              label: 'Fatturato',
              data: data.map((d: any) => d.totalRevenue),
              backgroundColor: 'rgb(59, 130, 246)',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `${formatCurrency(context.parsed.x)}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `${value}`,
              },
            },
          },
        },
      });
    }

    // Top Customers
    const topCustomersResponse = await api.get('/analytics/top-customers?limit=9999');
    if (topCustomersResponse.success && topCustomersChart.value) {
      const data = topCustomersResponse.data;

      if (customersChart) customersChart.destroy();

      customersChart = new Chart(topCustomersChart.value, {
        type: 'bar',
        data: {
          labels: data.map((d: any) => d.customerName.substring(0, 20) + '...'),
          datasets: [
            {
              label: 'Fatturato',
              data: data.map((d: any) => d.totalRevenue),
              backgroundColor: 'rgb(16, 185, 129)',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `${formatCurrency(context.parsed.x)}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `${value}`,
              },
            },
          },
        },
      });
    }
  } catch (error: any) {
    console.error('Error loading charts:', error);
  }
};

// Product actions
const openProductAnalytics = async (productId: string) => {
  try {
    const response = await api.get(`/products/${productId}`);
    if (response.success) {
      selectedProduct.value = response.data;
      showProductDialog.value = true;
      // Switch to Analytics tab after dialog opens (tab index 8 is Analytics)
      await nextTick();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare il prodotto',
      life: 3000,
    });
  }
};

const openProductDialog = async (productId: string) => {
  try {
    const response = await api.get(`/products/${productId}`);
    if (response.success) {
      selectedProduct.value = response.data;
      showProductDialog.value = true;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare il prodotto',
      life: 3000,
    });
  }
};

const onProductSaved = async () => {
  // Refresh data
  await loadProductAnalytics();
};

// Watch tab changes to load data lazily
watch(activeTab, (newTab) => {
  if (newTab === 1 && highestMargins.value.length === 0) {
    loadProductAnalytics();
  }
});

onMounted(() => {
  loadAnalytics();
});
</script>

<style scoped>
.analytics-page {
  padding: var(--space-6);
}

/* Analytics Tabs */
.analytics-tabs {
  margin-top: var(--space-4);
}

:deep(.p-tabview-panels) {
  padding: var(--space-4) 0;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-5);
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

/* Chart Card */
.chart-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.chart-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-4) 0;
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.chart-card__content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Table Card */
.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
}

.table-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-4) 0;
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.table-card__content {
  overflow-x: auto;
}

/* Product Analytics Section */
.product-analytics-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.analytics-card {
  height: 100%;
}

.card-title-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.card-title-icon i {
  color: var(--primary-color);
}

.compact-table {
  font-size: 0.875rem;
}

.product-name-cell {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.cost-value {
  color: var(--red-600);
  font-weight: 500;
}

.margin-tag {
  font-size: 0.75rem;
}

/* Responsive */
@media (max-width: 768px) {
  .analytics-page {
    padding: var(--space-4);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .chart-card {
    min-height: 350px;
    padding: var(--space-4);
  }

  .table-card {
    padding: var(--space-4);
  }
}
</style>
