<template>
  <div class="product-recommendations">
    <!-- Header -->
    <div class="recommendations-header">
      <div class="header-title">
        <i class="pi pi-lightbulb"></i>
        <h3>Raccomandazioni Prodotti</h3>
      </div>
      <div class="header-actions">
        <Button
          icon="pi pi-refresh"
          class="p-button-outlined"
          :loading="loading"
          @click="loadRecommendations"
          v-tooltip.top="'Aggiorna'"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Analizzando prodotti...</p>
    </div>

    <!-- Content -->
    <div v-else-if="recommendations" class="recommendations-content">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div
          class="summary-card focus"
          @click="filterCategory = filterCategory === 'FOCUS' ? null : 'FOCUS'"
          :class="{ active: filterCategory === 'FOCUS' }"
        >
          <div class="card-icon">
            <i class="pi pi-star"></i>
          </div>
          <div class="card-info">
            <span class="count">{{ recommendations.summary.focus }}</span>
            <span class="label">Da Potenziare</span>
          </div>
        </div>
        <div
          class="summary-card maintain"
          @click="filterCategory = filterCategory === 'MAINTAIN' ? null : 'MAINTAIN'"
          :class="{ active: filterCategory === 'MAINTAIN' }"
        >
          <div class="card-icon">
            <i class="pi pi-check-circle"></i>
          </div>
          <div class="card-info">
            <span class="count">{{ recommendations.summary.maintain }}</span>
            <span class="label">Da Mantenere</span>
          </div>
        </div>
        <div
          class="summary-card review"
          @click="filterCategory = filterCategory === 'REVIEW' ? null : 'REVIEW'"
          :class="{ active: filterCategory === 'REVIEW' }"
        >
          <div class="card-icon">
            <i class="pi pi-exclamation-circle"></i>
          </div>
          <div class="card-info">
            <span class="count">{{ recommendations.summary.review }}</span>
            <span class="label">Da Rivedere</span>
          </div>
        </div>
        <div
          class="summary-card remove"
          @click="filterCategory = filterCategory === 'REMOVE' ? null : 'REMOVE'"
          :class="{ active: filterCategory === 'REMOVE' }"
        >
          <div class="card-icon">
            <i class="pi pi-times-circle"></i>
          </div>
          <div class="card-info">
            <span class="count">{{ recommendations.summary.remove }}</span>
            <span class="label">Da Eliminare</span>
          </div>
        </div>
      </div>

      <!-- Filter info -->
      <div v-if="filterCategory" class="filter-info">
        <span>Filtro attivo: <Tag :value="getCategoryLabel(filterCategory)" :severity="getCategorySeverity(filterCategory)" /></span>
        <Button label="Rimuovi filtro" icon="pi pi-times" class="p-button-text p-button-sm" @click="filterCategory = null" />
      </div>

      <!-- Products Grid -->
      <div class="products-grid">
        <Card
          v-for="product in filteredProducts"
          :key="product.productId"
          class="product-card"
          :class="product.recommendation.toLowerCase()"
        >
          <template #header>
            <div class="card-header" :class="product.recommendation.toLowerCase()">
              <Tag :value="getCategoryLabel(product.recommendation)" :severity="getCategorySeverity(product.recommendation)" />
              <div class="score-badge">
                <span class="score">{{ product.score }}</span>
                <span class="label">/ 100</span>
              </div>
            </div>
          </template>
          <template #title>
            <div class="product-title">
              {{ product.productName }}
            </div>
          </template>
          <template #subtitle>
            <div class="product-sku">{{ product.sku }}</div>
          </template>
          <template #content>
            <!-- Metrics -->
            <div class="metrics-grid">
              <div class="metric">
                <span class="metric-label">Margine</span>
                <span class="metric-value" :class="getMetricClass(product.metrics.margin / 100, 'margin')">
                  {{ product.metrics.margin.toFixed(1) }}%
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">Trend</span>
                <span class="metric-value" :class="getMetricClass(product.metrics.salesTrend, 'trend')">
                  <i :class="product.metrics.salesTrend >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
                  {{ Math.abs(product.metrics.salesTrend).toFixed(1) }}%
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">Volume</span>
                <span class="metric-value">{{ product.metrics.salesVolume }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Rotazione</span>
                <span class="metric-value" :class="getMetricClass(product.metrics.stockTurnover, 'turnover')">
                  {{ product.metrics.stockTurnover.toFixed(1) }}x
                </span>
              </div>
            </div>

            <!-- Reasons -->
            <div class="reasons">
              <div class="reasons-header">
                <i class="pi pi-info-circle"></i>
                <span>Motivazioni</span>
              </div>
              <ul class="reasons-list">
                <li v-for="(reason, index) in product.reasons" :key="index">
                  {{ reason }}
                </li>
              </ul>
            </div>
          </template>
          <template #footer>
            <div class="card-footer">
              <Button
                v-if="product.recommendation === 'FOCUS'"
                label="Analizza"
                icon="pi pi-chart-line"
                class="p-button-sm p-button-outlined"
                @click="$emit('analyze', product.productId)"
              />
              <Button
                v-else-if="product.recommendation === 'REVIEW' || product.recommendation === 'REMOVE'"
                label="Dettagli"
                icon="pi pi-eye"
                class="p-button-sm p-button-outlined p-button-secondary"
                @click="$emit('view', product.productId)"
              />
            </div>
          </template>
        </Card>
      </div>

      <!-- Empty filtered state -->
      <div v-if="filteredProducts.length === 0 && filterCategory" class="empty-filtered">
        <i class="pi pi-filter-slash"></i>
        <p>Nessun prodotto in questa categoria</p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <i class="pi pi-lightbulb"></i>
      <p>Nessuna raccomandazione disponibile</p>
      <small>Assicurati di avere prodotti con vendite registrate</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

// Emits
const emit = defineEmits<{
  (e: 'analyze', productId: string): void;
  (e: 'view', productId: string): void;
}>();

const toast = useToast();

// State
const loading = ref(false);
const recommendations = ref<any>(null);
const filterCategory = ref<string | null>(null);

// Computed
const filteredProducts = computed(() => {
  if (!recommendations.value?.all) return [];

  if (!filterCategory.value) {
    return recommendations.value.all;
  }

  return recommendations.value.all.filter(
    (p: any) => p.recommendation === filterCategory.value
  );
});

// Methods
const loadRecommendations = async () => {
  loading.value = true;
  try {
    const response = await api.get('/analytics/products/recommendations');

    if (response.success) {
      recommendations.value = response.data;
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    console.error('Errore caricamento raccomandazioni:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Impossibile caricare le raccomandazioni',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    FOCUS: 'Da Potenziare',
    MAINTAIN: 'Da Mantenere',
    REVIEW: 'Da Rivedere',
    REMOVE: 'Da Eliminare',
  };
  return labels[category] || category;
};

const getCategorySeverity = (category: string): string => {
  const severities: Record<string, string> = {
    FOCUS: 'success',
    MAINTAIN: 'info',
    REVIEW: 'warn',
    REMOVE: 'danger',
  };
  return severities[category] || 'secondary';
};

const getMetricClass = (value: number, type: string): string => {
  switch (type) {
    case 'margin':
      if (value > 0.3) return 'positive';
      if (value < 0.1) return 'negative';
      return '';
    case 'trend':
      if (value > 10) return 'positive';
      if (value < -10) return 'negative';
      return '';
    case 'turnover':
      if (value > 2) return 'positive';
      if (value < 0.5) return 'negative';
      return '';
    default:
      return '';
  }
};

onMounted(() => {
  loadRecommendations();
});
</script>

<style scoped>
.product-recommendations {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  color: var(--yellow-500);
}

.header-title h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.loading-state,
.empty-state,
.empty-filtered {
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

.empty-state i,
.empty-filtered i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.recommendations-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 1024px) {
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.summary-card.active {
  border-color: currentColor;
}

.summary-card.focus {
  background: linear-gradient(135deg, var(--green-50), var(--green-100));
  color: var(--green-700);
}

.summary-card.maintain {
  background: linear-gradient(135deg, var(--blue-50), var(--blue-100));
  color: var(--blue-700);
}

.summary-card.review {
  background: linear-gradient(135deg, var(--orange-50), var(--orange-100));
  color: var(--orange-700);
}

.summary-card.remove {
  background: linear-gradient(135deg, var(--red-50), var(--red-100));
  color: var(--red-700);
}

.card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.card-icon i {
  font-size: 1.5rem;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-info .count {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.card-info .label {
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Filter info */
.filter-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface-100);
  border-radius: 8px;
}

/* Products Grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.product-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
}

.card-header.focus {
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
}

.card-header.maintain {
  background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
}

.card-header.review {
  background: linear-gradient(135deg, var(--orange-500), var(--orange-600));
}

.card-header.remove {
  background: linear-gradient(135deg, var(--red-500), var(--red-600));
}

.score-badge {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
}

.score-badge .score {
  font-size: 1.5rem;
  font-weight: 700;
}

.score-badge .label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.product-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  min-height: 2.6rem;
}

.product-sku {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.metric-value {
  font-size: 1rem;
  font-weight: 600;
}

.metric-value.positive {
  color: var(--green-600);
}

.metric-value.negative {
  color: var(--red-600);
}

/* Reasons */
.reasons {
  padding: 0.75rem;
  background: var(--surface-50);
  border-radius: 8px;
  border-left: 3px solid var(--primary-color);
}

.reasons-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--text-color-secondary);
}

.reasons-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--text-color);
}

.reasons-list li {
  margin-bottom: 0.25rem;
}

.reasons-list li:last-child {
  margin-bottom: 0;
}

/* Card Footer */
.card-footer {
  display: flex;
  justify-content: flex-end;
}

/* Override Card styles */
:deep(.p-card-header) {
  padding: 0;
}

:deep(.p-card-body) {
  padding: 1rem;
}

:deep(.p-card-title) {
  margin-bottom: 0.25rem;
}

:deep(.p-card-subtitle) {
  margin-bottom: 1rem;
}

:deep(.p-card-content) {
  padding: 0;
}

:deep(.p-card-footer) {
  padding: 0.75rem 0 0 0;
  border-top: 1px solid var(--surface-border);
  margin-top: 1rem;
}
</style>
