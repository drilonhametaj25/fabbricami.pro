<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <i :class="icon"></i>
    </div>
    <h3 class="empty-state__title">{{ title }}</h3>
    <p class="empty-state__message">{{ message }}</p>
    <div class="empty-state__actions" v-if="$slots.actions || actionLabel">
      <slot name="actions">
        <Button
          v-if="actionLabel"
          :label="actionLabel"
          :icon="actionIcon"
          @click="$emit('action')"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

interface Props {
  title?: string;
  message?: string;
  icon?: string;
  actionLabel?: string;
  actionIcon?: string;
}

withDefaults(defineProps<Props>(), {
  title: 'Nessun risultato',
  message: 'Non ci sono elementi da visualizzare',
  icon: 'pi pi-inbox',
});

defineEmits(['action']);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-state__icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.empty-state__icon i {
  font-size: 2.5rem;
  color: #94a3b8;
}

.empty-state__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem;
}

.empty-state__message {
  color: #64748b;
  margin: 0 0 1.5rem;
  max-width: 400px;
  line-height: 1.5;
}

.empty-state__actions {
  display: flex;
  gap: 0.75rem;
}
</style>
