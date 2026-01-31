<template>
  <div class="quick-stats-bar">
    <div
      v-for="stat in quickStats?.items || []"
      :key="stat.id"
      :class="['quick-stat', `quick-stat--${stat.color || 'info'}`]"
    >
      <span class="quick-stat__value">
        {{ stat.value }}{{ stat.suffix || '' }}
      </span>
      <span class="quick-stat__label">{{ stat.label }}</span>
    </div>

    <div class="quick-stats-bar__empty" v-if="!quickStats?.items?.length && !loading">
      <span>Nessuna statistica disponibile</span>
    </div>

    <div class="quick-stats-bar__loading" v-if="loading">
      <i class="pi pi-spin pi-spinner"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuickStatsSection } from '../../types';

interface Props {
  quickStats: QuickStatsSection | null;
  loading?: boolean;
}

defineProps<Props>();
</script>

<style scoped>
.quick-stats-bar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  overflow-x: auto;
  scrollbar-width: thin;
}

.quick-stats-bar::-webkit-scrollbar {
  height: 4px;
}

.quick-stats-bar::-webkit-scrollbar-track {
  background: transparent;
}

.quick-stats-bar::-webkit-scrollbar-thumb {
  background: var(--color-gray-300);
  border-radius: var(--border-radius-full);
}

.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-card);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  min-width: 120px;
  flex-shrink: 0;
  border-left: 3px solid transparent;
  transition: transform var(--transition-fast);
}

.quick-stat:hover {
  transform: translateY(-2px);
}

.quick-stat--success {
  border-left-color: var(--color-success);
}

.quick-stat--warning {
  border-left-color: var(--color-warning);
}

.quick-stat--danger {
  border-left-color: var(--color-danger);
}

.quick-stat--info {
  border-left-color: var(--color-info);
}

.quick-stat__value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1;
}

.quick-stat--success .quick-stat__value { color: var(--color-success-dark); }
.quick-stat--warning .quick-stat__value { color: var(--color-warning-dark); }
.quick-stat--danger .quick-stat__value { color: var(--color-danger-dark); }
.quick-stat--info .quick-stat__value { color: var(--color-info-dark); }

.quick-stat__label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
  text-align: center;
  white-space: nowrap;
}

.quick-stats-bar__empty,
.quick-stats-bar__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--space-4);
  color: var(--color-gray-400);
  font-size: var(--font-size-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .quick-stats-bar {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-3);
  }

  .quick-stat {
    min-width: 100px;
    padding: var(--space-2) var(--space-3);
  }

  .quick-stat__value {
    font-size: var(--font-size-lg);
  }
}
</style>
