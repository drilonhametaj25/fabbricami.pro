<template>
  <div class="orders-timeline-chart">
    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-icon received">
          <i class="pi pi-shopping-cart"></i>
        </div>
        <div class="card-content">
          <span class="card-value">{{ summary.totalReceived }}</span>
          <span class="card-label">Ordini Ricevuti</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon revenue">
          <i class="pi pi-euro"></i>
        </div>
        <div class="card-content">
          <span class="card-value">{{ formatCurrency(summary.totalRevenue) }}</span>
          <span class="card-label">Fatturato Periodo</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon pending">
          <i class="pi pi-truck"></i>
        </div>
        <div class="card-content">
          <span class="card-value">{{ summary.pendingDeliveries }}</span>
          <span class="card-label">Consegne Previste</span>
        </div>
      </div>
      <div class="summary-card" :class="{ alert: summary.overdueDeliveries > 0 }">
        <div class="card-icon overdue">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div class="card-content">
          <span class="card-value">{{ summary.overdueDeliveries }}</span>
          <span class="card-label">In Ritardo</span>
        </div>
      </div>
    </div>

    <!-- Range Selector -->
    <div class="chart-controls">
      <div class="range-selector">
        <Button
          v-for="option in rangeOptions"
          :key="option.value"
          :label="option.label"
          :class="{ 'p-button-outlined': selectedRange !== option.value }"
          size="small"
          @click="changeRange(option.value)"
        />
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-container">
      <Chart
        v-if="chartData.labels && chartData.labels.length > 0"
        type="line"
        :data="chartData"
        :options="chartOptions"
        class="timeline-chart"
      />
      <div v-else class="chart-empty">
        <i class="pi pi-chart-line"></i>
        <p>Nessun dato disponibile per il periodo selezionato</p>
      </div>
    </div>

    <!-- Legend -->
    <div class="chart-legend">
      <div class="legend-item">
        <span class="legend-dot received"></span>
        <span>Ordini Ricevuti</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot deliveries"></span>
        <span>Consegne Previste</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Chart from 'primevue/chart';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const toast = useToast();

// State
const loading = ref(false);
const selectedRange = ref(30);
const timelineData = ref<any>(null);

const rangeOptions = [
  { label: '7 giorni', value: 7 },
  { label: '14 giorni', value: 14 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
];

// Computed
const summary = computed(() => {
  return timelineData.value?.summary || {
    totalReceived: 0,
    totalRevenue: 0,
    pendingDeliveries: 0,
    overdueDeliveries: 0,
    avgOrderValue: 0,
  };
});

const chartData = computed(() => {
  if (!timelineData.value) {
    return { labels: [], datasets: [] };
  }

  const labels = timelineData.value.labels || [];
  const received = timelineData.value.received || [];
  const deliveries = timelineData.value.deliveries || [];

  // Format labels as readable dates
  const formattedLabels = labels.map((d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  });

  return {
    labels: formattedLabels,
    datasets: [
      {
        label: 'Ordini Ricevuti',
        data: received,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6',
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#3b82f6',
      },
      {
        label: 'Consegne Previste',
        data: deliveries,
        fill: true,
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderColor: '#f97316',
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f97316',
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
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 12,
      callbacks: {
        title: (context: any) => {
          const index = context[0].dataIndex;
          const labels = timelineData.value?.labels || [];
          if (labels[index]) {
            return new Date(labels[index]).toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
          }
          return '';
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        maxRotation: 45,
        minRotation: 0,
        autoSkip: true,
        maxTicksLimit: 15,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
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

const loadTimeline = async () => {
  loading.value = true;
  try {
    const response = await api.get(`/orders/timeline?days=${selectedRange.value}`);
    timelineData.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento timeline',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const changeRange = (days: number) => {
  selectedRange.value = days;
  loadTimeline();
};

// Lifecycle
onMounted(() => {
  loadTimeline();
});
</script>

<style scoped>
.orders-timeline-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1024px) {
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  transition: all 0.2s;
}

.summary-card:hover {
  box-shadow: var(--shadow-md);
}

.summary-card.alert {
  border-color: var(--red-300);
  background: var(--red-50);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.card-icon.received {
  background: var(--blue-100);
  color: var(--blue-600);
}

.card-icon.revenue {
  background: var(--green-100);
  color: var(--green-600);
}

.card-icon.pending {
  background: var(--orange-100);
  color: var(--orange-600);
}

.card-icon.overdue {
  background: var(--red-100);
  color: var(--red-600);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-color);
}

.card-label {
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

/* Chart Controls */
.chart-controls {
  display: flex;
  justify-content: flex-end;
}

.range-selector {
  display: flex;
  gap: var(--space-2);
}

.range-selector :deep(.p-button) {
  font-size: var(--font-size-sm);
}

/* Chart Container */
.chart-container {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  height: 400px;
}

.timeline-chart {
  height: 100%;
}

.chart-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);
}

.chart-empty i {
  font-size: 3rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

/* Legend */
.chart-legend {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.received {
  background: #3b82f6;
}

.legend-dot.deliveries {
  background: #f97316;
}
</style>
