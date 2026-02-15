<template>
  <div :class="['usage-card', statusClass]">
    <div class="usage-header">
      <div class="usage-icon" v-if="icon">
        <i :class="icon"></i>
      </div>
      <div class="usage-info">
        <span class="usage-label">{{ label }}</span>
        <span class="usage-values">
          {{ current }} / {{ limitDisplay }}
        </span>
      </div>
    </div>
    <ProgressBar
      :value="percentage"
      :showValue="false"
      :class="['usage-progress', progressClass]"
    />
    <div v-if="showWarning" class="usage-warning">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ warningMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProgressBar from 'primevue/progressbar';
import type { UsageStat } from '../../types';

interface Props {
  label: string;
  usage: UsageStat;
  icon?: string;
}

const props = defineProps<Props>();

const current = computed(() => props.usage.current);
const limit = computed(() => props.usage.limit);
const percentage = computed(() => Math.min(props.usage.percentage, 100));

const limitDisplay = computed(() => {
  return limit.value === -1 ? 'Illimitato' : limit.value.toString();
});

const isNearLimit = computed(() => percentage.value >= 80 && percentage.value < 100);
const isAtLimit = computed(() => percentage.value >= 100);
const isUnlimited = computed(() => limit.value === -1);

const statusClass = computed(() => {
  if (isUnlimited.value) return 'usage-card--unlimited';
  if (isAtLimit.value) return 'usage-card--danger';
  if (isNearLimit.value) return 'usage-card--warning';
  return 'usage-card--normal';
});

const progressClass = computed(() => {
  if (isUnlimited.value) return 'progress-unlimited';
  if (isAtLimit.value) return 'progress-danger';
  if (isNearLimit.value) return 'progress-warning';
  return 'progress-normal';
});

const showWarning = computed(() => {
  return !isUnlimited.value && (isNearLimit.value || isAtLimit.value);
});

const warningMessage = computed(() => {
  if (isAtLimit.value) {
    return 'Limite raggiunto! Effettua un upgrade per continuare.';
  }
  if (isNearLimit.value) {
    const remaining = limit.value - current.value;
    return `Solo ${remaining} ${remaining === 1 ? 'rimanente' : 'rimanenti'}`;
  }
  return '';
});
</script>

<style scoped>
.usage-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
  transition: all var(--transition-base);
}

.usage-card:hover {
  box-shadow: var(--shadow-sm);
}

.usage-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.usage-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.usage-card--warning .usage-icon {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.usage-card--danger .usage-icon {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.usage-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.usage-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-600);
}

.usage-values {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-gray-900);
}

.usage-card--warning .usage-values {
  color: var(--color-warning-dark);
}

.usage-card--danger .usage-values {
  color: var(--color-danger-dark);
}

.usage-progress {
  height: 8px;
  border-radius: var(--border-radius-full);
}

.usage-progress :deep(.p-progressbar-value) {
  border-radius: var(--border-radius-full);
}

.progress-normal :deep(.p-progressbar-value) {
  background: var(--color-primary-500);
}

.progress-warning :deep(.p-progressbar-value) {
  background: var(--color-warning);
}

.progress-danger :deep(.p-progressbar-value) {
  background: var(--color-danger);
}

.progress-unlimited :deep(.p-progressbar-value) {
  background: var(--color-success);
}

.usage-warning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-xs);
}

.usage-card--warning .usage-warning {
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.usage-card--danger .usage-warning {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}
</style>
