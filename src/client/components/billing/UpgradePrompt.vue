<template>
  <Dialog
    v-model:visible="modelValue"
    :header="title"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="upgrade-prompt-dialog"
    :style="{ width: '600px' }"
  >
    <div class="upgrade-content">
      <div class="upgrade-icon">
        <i class="pi pi-arrow-up-right"></i>
      </div>

      <h3 class="upgrade-title">{{ heading }}</h3>
      <p class="upgrade-description">{{ description }}</p>

      <div class="current-usage" v-if="currentUsage">
        <div class="usage-row">
          <span class="usage-label">Utilizzo attuale:</span>
          <span class="usage-value">{{ currentUsage.current }} / {{ currentUsage.limit }}</span>
        </div>
        <ProgressBar :value="currentUsage.percentage" :showValue="false" class="usage-bar" />
      </div>

      <div class="upgrade-options">
        <div
          v-for="plan in upgradePlans"
          :key="plan.code"
          :class="['upgrade-option', { 'upgrade-option--selected': selectedPlan === plan.code }]"
          @click="selectedPlan = plan.code"
        >
          <div class="option-header">
            <div class="option-radio">
              <i :class="selectedPlan === plan.code ? 'pi pi-circle-fill' : 'pi pi-circle'"></i>
            </div>
            <div class="option-info">
              <span class="option-name">{{ plan.name }}</span>
              <span class="option-price">{{ formatPrice(plan.priceMonthly) }}/mese</span>
            </div>
          </div>
          <div class="option-limit">
            <i class="pi pi-check"></i>
            <span>{{ getResourceLimit(plan) }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Annulla"
          severity="secondary"
          @click="modelValue = false"
        />
        <Button
          label="Effettua Upgrade"
          icon="pi pi-arrow-up-right"
          :disabled="!selectedPlan"
          @click="handleUpgrade"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import { useSubscriptionStore } from '../../stores/subscription.store';
import type { SubscriptionPlan, UsageStat } from '../../types';

interface Props {
  resource: 'users' | 'warehouses' | 'products' | 'orders' | 'suppliers';
  currentUsage?: UsageStat;
}

const props = defineProps<Props>();

const modelValue = defineModel<boolean>({ default: false });

const emit = defineEmits<{
  upgrade: [planCode: string];
}>();

const subscriptionStore = useSubscriptionStore();
const selectedPlan = ref<string>('');

const resourceLabels: Record<string, string> = {
  users: 'utenti',
  warehouses: 'magazzini',
  products: 'prodotti',
  orders: 'ordini',
  suppliers: 'fornitori',
};

const title = computed(() => 'Limite Raggiunto');

const heading = computed(() => {
  return `Hai raggiunto il limite di ${resourceLabels[props.resource]}`;
});

const description = computed(() => {
  return `Il tuo piano attuale non ti permette di aggiungere altri ${resourceLabels[props.resource]}. Effettua un upgrade per sbloccare limiti superiori.`;
});

const upgradePlans = computed(() => {
  const currentPlan = subscriptionStore.currentSubscription?.planCode || 'STARTER';
  const planOrder = ['STARTER', 'PRO', 'BUSINESS'];
  const currentIndex = planOrder.indexOf(currentPlan);

  return subscriptionStore.availablePlans.filter(plan => {
    const planIndex = planOrder.indexOf(plan.code);
    return planIndex > currentIndex;
  });
});

function formatPrice(price: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function getResourceLimit(plan: SubscriptionPlan): string {
  const limitKey = `max${props.resource.charAt(0).toUpperCase()}${props.resource.slice(1)}` as keyof typeof plan.limits;
  const limit = plan.limits[limitKey] as number;

  if (limit === -1) {
    return `${resourceLabels[props.resource]} illimitati`;
  }

  return `Fino a ${limit.toLocaleString('it-IT')} ${resourceLabels[props.resource]}`;
}

function handleUpgrade() {
  if (selectedPlan.value) {
    emit('upgrade', selectedPlan.value);
    modelValue.value = false;
  }
}

// Auto-select first upgrade option
watch(upgradePlans, (plans) => {
  if (plans.length > 0 && !selectedPlan.value) {
    selectedPlan.value = plans[0].code;
  }
}, { immediate: true });
</script>

<style scoped>
.upgrade-content {
  text-align: center;
  padding: var(--space-4) 0;
}

.upgrade-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-4);
}

.upgrade-icon i {
  font-size: 2rem;
  color: var(--color-primary-600);
}

.upgrade-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
}

.upgrade-description {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin: 0 0 var(--space-6) 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.current-usage {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.usage-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.usage-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.usage-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-danger);
}

.usage-bar {
  height: 6px;
  border-radius: var(--border-radius-full);
}

.usage-bar :deep(.p-progressbar-value) {
  background: var(--color-danger);
  border-radius: var(--border-radius-full);
}

.upgrade-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.upgrade-option {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.upgrade-option:hover {
  border-color: var(--color-primary-300);
}

.upgrade-option--selected {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.option-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.option-radio {
  color: var(--color-gray-400);
}

.upgrade-option--selected .option-radio {
  color: var(--color-primary-600);
}

.option-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex: 1;
}

.option-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
}

.option-price {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.option-limit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  margin-left: calc(var(--space-3) + 24px);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
