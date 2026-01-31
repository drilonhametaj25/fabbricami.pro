<template>
  <div class="step-placeholder">
    <i class="pi pi-lock"></i>
    <p class="step-placeholder__message">{{ message }}</p>
    <Button
      label="Vai allo Step 1"
      icon="pi pi-arrow-left"
      class="p-button-text"
      @click="$emit('goToFirst')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

defineProps<{
  message: string;
}>();

defineEmits<{
  (e: 'goToFirst'): void;
}>();
</script>

<style scoped>
.step-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--color-gray-500, #6b7280);
  background: var(--color-gray-50, #f9fafb);
  border-radius: 12px;
  border: 2px dashed var(--color-gray-300, #d1d5db);
  min-height: 300px;
}

.step-placeholder i {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--color-gray-400, #9ca3af);
}

.step-placeholder__message {
  margin: 0 0 1.5rem 0;
  font-size: 1.1rem;
  max-width: 300px;
}
</style>
