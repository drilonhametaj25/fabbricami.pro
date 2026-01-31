<template>
  <div :class="['stats-card', `stats-card--${variant}`]">
    <div class="stats-card__icon" v-if="icon">
      <i :class="icon"></i>
    </div>
    <div class="stats-card__content">
      <span class="stats-card__label">{{ label }}</span>
      <div class="stats-card__value-row">
        <span class="stats-card__value">
          <template v-if="loading">
            <i class="pi pi-spin pi-spinner"></i>
          </template>
          <template v-else>
            {{ formattedValue }}
          </template>
        </span>
        <span
          v-if="trend !== undefined && !loading"
          :class="['stats-card__trend', trendClass]"
        >
          <i :class="trendIcon"></i>
          {{ Math.abs(trend) }}%
        </span>
      </div>
      <span v-if="subtitle" class="stats-card__subtitle">{{ subtitle }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  label: string;
  value: number | string;
  icon?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  format?: 'number' | 'currency' | 'percent' | 'none';
  trend?: number;
  subtitle?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  format: 'number',
  loading: false,
});

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value;

  switch (props.format) {
    case 'currency':
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
      }).format(props.value);
    case 'percent':
      return `${props.value.toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('it-IT').format(props.value);
    default:
      return props.value;
  }
});

const trendClass = computed(() => {
  if (props.trend === undefined) return '';
  return props.trend >= 0 ? 'stats-card__trend--up' : 'stats-card__trend--down';
});

const trendIcon = computed(() => {
  if (props.trend === undefined) return '';
  return props.trend >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
});
</script>

<style scoped>
.stats-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  position: relative;
  overflow: hidden;
}

.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary-600);
  transition: height var(--transition-fast);
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stats-card:hover::before {
  height: 4px;
}

.stats-card__icon {
  width: 52px;
  height: 52px;
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.stats-card--default .stats-card__icon {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.stats-card--default::before {
  background: var(--color-gray-400);
}

.stats-card--primary .stats-card__icon {
  background: var(--color-primary-50);
  color: var(--color-primary-600);
}

.stats-card--primary::before {
  background: var(--color-primary-600);
}

.stats-card--success .stats-card__icon {
  background: var(--color-success-light);
  color: var(--color-success);
}

.stats-card--success::before {
  background: var(--color-success);
}

.stats-card--warning .stats-card__icon {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.stats-card--warning::before {
  background: var(--color-warning);
}

.stats-card--danger .stats-card__icon {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.stats-card--danger::before {
  background: var(--color-danger);
}

.stats-card--info .stats-card__icon {
  background: var(--color-info-light);
  color: var(--color-info);
}

.stats-card--info::before {
  background: var(--color-info);
}

.stats-card__content {
  flex: 1;
  min-width: 0;
}

.stats-card__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-500);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-card__value-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.stats-card__value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: var(--line-height-tight);
}

.stats-card__trend {
  font-size: var(--font-size-xs);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.stats-card__trend--up {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.stats-card__trend--down {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}

.stats-card__subtitle {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-gray-400);
  margin-top: var(--space-2);
}

/* Responsive */
@media (max-width: 768px) {
  .stats-card {
    padding: var(--space-5);
  }

  .stats-card__icon {
    width: 44px;
    height: 44px;
    font-size: 1.25rem;
  }

  .stats-card__value {
    font-size: var(--font-size-xl);
  }
}
</style>
