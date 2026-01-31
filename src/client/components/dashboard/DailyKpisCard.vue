<template>
  <div class="daily-kpis-card">
    <div class="daily-kpis-card__header">
      <h3 class="daily-kpis-card__title">
        <i class="pi pi-chart-bar"></i>
        KPI Giornalieri
      </h3>
      <span class="daily-kpis-card__updated" v-if="kpis?.lastUpdated">
        Aggiornato: {{ formatTime(kpis.lastUpdated) }}
      </span>
    </div>

    <div class="daily-kpis-card__grid" v-if="!loading && kpis?.items.length">
      <div
        v-for="kpi in kpis.items"
        :key="kpi.id"
        class="kpi-item"
        :class="{ 'kpi-item--clickable': kpi.link }"
        @click="navigateToLink(kpi.link)"
      >
        <div class="kpi-item__icon" :style="{ backgroundColor: getIconBgColor(kpi.color) }">
          <i :class="kpi.icon || 'pi pi-info-circle'" :style="{ color: kpi.color }"></i>
        </div>
        <div class="kpi-item__content">
          <span class="kpi-item__label">{{ kpi.label }}</span>
          <div class="kpi-item__value-row">
            <span class="kpi-item__value">{{ kpi.value }}</span>
            <span
              v-if="kpi.changePercent !== undefined && kpi.changePercent !== 0"
              :class="['kpi-item__trend', `kpi-item__trend--${kpi.trend || 'stable'}`]"
            >
              <i :class="getTrendIcon(kpi.trend)"></i>
              {{ formatPercent(kpi.changePercent) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="daily-kpis-card__loading" v-else-if="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Caricamento KPI...</span>
    </div>

    <div class="daily-kpis-card__empty" v-else>
      <i class="pi pi-info-circle"></i>
      <span>Nessun KPI disponibile</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { DailyKpiSection } from '../../types';

interface Props {
  kpis: DailyKpiSection | null;
  loading?: boolean;
}

defineProps<Props>();

const router = useRouter();

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPercent = (value: number) => {
  return `${Math.abs(value).toFixed(1)}%`;
};

const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return 'pi pi-arrow-up';
    case 'down': return 'pi pi-arrow-down';
    default: return 'pi pi-minus';
  }
};

const getIconBgColor = (color?: string) => {
  if (!color) return 'var(--color-gray-100)';
  // Converte il colore hex in una versione più chiara
  return `${color}20`;
};

const navigateToLink = (link?: string) => {
  if (link) {
    router.push(link);
  }
};
</script>

<style scoped>
.daily-kpis-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
}

.daily-kpis-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.daily-kpis-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.daily-kpis-card__title i {
  color: var(--color-primary-600);
}

.daily-kpis-card__updated {
  font-size: var(--font-size-xs);
  color: var(--color-gray-400);
}

.daily-kpis-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.kpi-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  transition: all var(--transition-fast);
}

.kpi-item--clickable {
  cursor: pointer;
}

.kpi-item--clickable:hover {
  background: var(--color-gray-100);
  transform: translateY(-1px);
}

.kpi-item__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.kpi-item__content {
  flex: 1;
  min-width: 0;
}

.kpi-item__label {
  display: block;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-1);
}

.kpi-item__value-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.kpi-item__value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.kpi-item__trend {
  font-size: var(--font-size-xs);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: var(--border-radius-sm);
}

.kpi-item__trend--up {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.kpi-item__trend--down {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}

.kpi-item__trend--stable {
  background: var(--color-gray-200);
  color: var(--color-gray-600);
}

.daily-kpis-card__loading,
.daily-kpis-card__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .daily-kpis-card__grid {
    grid-template-columns: 1fr;
  }

  .daily-kpis-card__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}
</style>
