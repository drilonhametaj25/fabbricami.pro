<template>
  <div :class="['plan-card', { 'plan-card--current': isCurrent, 'plan-card--recommended': isRecommended }]">
    <div v-if="isRecommended" class="plan-badge">
      <span>Consigliato</span>
    </div>
    <div v-if="isCurrent" class="plan-badge plan-badge--current">
      <span>Piano Attuale</span>
    </div>

    <div class="plan-header">
      <h3 class="plan-name">{{ plan.name }}</h3>
      <div class="plan-price">
        <span class="price-amount">{{ formattedPrice }}</span>
        <span class="price-period">/{{ billingPeriod === 'monthly' ? 'mese' : 'anno' }}</span>
      </div>
      <div v-if="billingPeriod === 'yearly' && savings > 0" class="plan-savings">
        Risparmi {{ formattedSavings }} all'anno
      </div>
    </div>

    <div class="plan-limits">
      <div class="limit-item">
        <i class="pi pi-users"></i>
        <span>{{ formatLimit(plan.limits.maxUsers) }} utenti</span>
      </div>
      <div class="limit-item">
        <i class="pi pi-building"></i>
        <span>{{ formatLimit(plan.limits.maxWarehouses) }} magazzini</span>
      </div>
      <div class="limit-item">
        <i class="pi pi-box"></i>
        <span>{{ formatLimit(plan.limits.maxProducts) }} prodotti</span>
      </div>
      <div class="limit-item">
        <i class="pi pi-shopping-cart"></i>
        <span>{{ formatLimit(plan.limits.maxOrders) }} ordini/mese</span>
      </div>
    </div>

    <div class="plan-features">
      <div v-for="(feature, index) in plan.features" :key="`${plan.id}-feature-${index}`" class="feature-item">
        <i class="pi pi-check"></i>
        <span>{{ feature }}</span>
      </div>
    </div>

    <div class="plan-actions">
      <Button
        v-if="!isCurrent"
        :label="actionLabel"
        :severity="isRecommended ? undefined : 'secondary'"
        class="w-full"
        @click="$emit('select', plan)"
      />
      <span v-else class="current-label">Il tuo piano attuale</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import type { SubscriptionPlan } from '../../types';

interface Props {
  plan: SubscriptionPlan;
  billingPeriod: 'monthly' | 'yearly';
  currentPlanCode?: string;
  recommendedPlanCode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  currentPlanCode: '',
  recommendedPlanCode: 'PRO',
});

defineEmits<{
  select: [plan: SubscriptionPlan];
}>();

const isCurrent = computed(() => props.plan.code === props.currentPlanCode);
const isRecommended = computed(() => props.plan.code === props.recommendedPlanCode && !isCurrent.value);

const price = computed(() => {
  return props.billingPeriod === 'monthly'
    ? props.plan.priceMonthly
    : props.plan.priceYearly;
});

const formattedPrice = computed(() => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price.value);
});

const savings = computed(() => {
  if (props.billingPeriod === 'yearly') {
    const monthlyTotal = props.plan.priceMonthly * 12;
    return monthlyTotal - props.plan.priceYearly;
  }
  return 0;
});

const formattedSavings = computed(() => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(savings.value);
});

const actionLabel = computed(() => {
  if (!props.currentPlanCode) {
    return 'Inizia Prova Gratuita';
  }
  const planOrder = ['STARTER', 'PRO', 'BUSINESS'];
  const currentIndex = planOrder.indexOf(props.currentPlanCode);
  const targetIndex = planOrder.indexOf(props.plan.code);

  if (targetIndex > currentIndex) {
    return 'Effettua Upgrade';
  } else {
    return 'Effettua Downgrade';
  }
});

function formatLimit(value: number): string {
  if (value === -1) return 'Illimitati';
  return value.toLocaleString('it-IT');
}
</script>

<style scoped>
.plan-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-xl);
  padding: var(--space-6);
  border: 2px solid var(--border-color-light);
  transition: all var(--transition-base);
  position: relative;
  display: flex;
  flex-direction: column;
}

.plan-card:hover {
  border-color: var(--color-primary-300);
  box-shadow: var(--shadow-md);
}

.plan-card--current {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.plan-card--recommended {
  border-color: var(--color-primary-500);
}

.plan-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary-500);
  color: white;
  padding: var(--space-1) var(--space-4);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.plan-badge--current {
  background: var(--color-success);
}

.plan-header {
  text-align: center;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.plan-name {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-3) 0;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-1);
}

.price-amount {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: var(--color-gray-900);
}

.price-period {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.plan-savings {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  font-weight: 500;
}

.plan-limits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.limit-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.limit-item i {
  color: var(--color-primary-500);
  width: 20px;
}

.plan-features {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.feature-item i {
  color: var(--color-success);
  margin-top: 2px;
  flex-shrink: 0;
}

.plan-actions {
  margin-top: auto;
}

.current-label {
  display: block;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  padding: var(--space-3);
}
</style>
