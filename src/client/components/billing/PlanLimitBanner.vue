<template>
  <Transition name="slide-down">
    <div v-if="visible" :class="['limit-banner', `limit-banner--${severity}`]">
      <div class="banner-content">
        <i :class="iconClass"></i>
        <span class="banner-message">{{ message }}</span>
      </div>
      <div class="banner-actions">
        <Button
          v-if="showUpgrade"
          label="Upgrade"
          size="small"
          @click="$emit('upgrade')"
        />
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="dismiss"
          v-tooltip.left="'Chiudi'"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';

interface Props {
  severity?: 'warning' | 'danger' | 'info';
  message: string;
  resource?: string;
  showUpgrade?: boolean;
  dismissible?: boolean;
  dismissKey?: string;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'warning',
  showUpgrade: true,
  dismissible: true,
  dismissKey: '',
});

const emit = defineEmits<{
  upgrade: [];
  dismiss: [];
}>();

const dismissed = ref(false);

const visible = computed(() => !dismissed.value);

const iconClass = computed(() => {
  switch (props.severity) {
    case 'danger':
      return 'pi pi-exclamation-circle';
    case 'info':
      return 'pi pi-info-circle';
    default:
      return 'pi pi-exclamation-triangle';
  }
});

function dismiss() {
  if (props.dismissible) {
    dismissed.value = true;
    if (props.dismissKey) {
      // localStorage (non sessionStorage): la chiusura deve persistere anche
      // dopo reload/nuova scheda, altrimenti il banner si riapre ogni volta.
      localStorage.setItem(`banner-dismissed-${props.dismissKey}`, 'true');
    }
    emit('dismiss');
  }
}

onMounted(() => {
  if (props.dismissKey) {
    const wasDismissed = localStorage.getItem(`banner-dismissed-${props.dismissKey}`);
    if (wasDismissed === 'true') {
      dismissed.value = true;
    }
  }
});
</script>

<style scoped>
.limit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--space-4);
}

.limit-banner--warning {
  background: var(--color-warning-light);
  border: var(--border-width) solid var(--color-warning);
  color: var(--color-warning-dark);
}

.limit-banner--danger {
  background: var(--color-danger-light);
  border: var(--border-width) solid var(--color-danger);
  color: var(--color-danger-dark);
}

.limit-banner--info {
  background: var(--color-info-light);
  border: var(--border-width) solid var(--color-info);
  color: var(--color-info-dark);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.banner-content i {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.banner-message {
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.limit-banner--warning .banner-actions :deep(.p-button:not(.p-button-text)) {
  background: var(--color-warning);
  border-color: var(--color-warning);
  color: white;
}

.limit-banner--danger .banner-actions :deep(.p-button:not(.p-button-text)) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

/* Transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
