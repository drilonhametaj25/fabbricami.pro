<template>
  <Dialog
    v-model:visible="state.visible"
    :header="state.title"
    :modal="true"
    :closable="true"
    :style="{ width: '420px' }"
    @hide="onCancel"
  >
    <div class="confirm-dialog__content">
      <div :class="['confirm-dialog__icon', `confirm-dialog__icon--${getSeverity}`]">
        <i :class="state.icon"></i>
      </div>
      <p class="confirm-dialog__message">{{ state.message }}</p>
    </div>
    <template #footer>
      <div class="confirm-dialog__footer">
        <Button
          :label="state.cancelLabel"
          icon="pi pi-times"
          class="p-button-text"
          @click="onCancel"
        />
        <Button
          :label="state.confirmLabel"
          icon="pi pi-check"
          :class="state.confirmClass"
          @click="onConfirm"
          autofocus
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useConfirm } from '../composables/useConfirm';

const { state, onConfirm, onCancel } = useConfirm();

const getSeverity = computed(() => {
  if (state.value.confirmClass.includes('danger')) return 'danger';
  if (state.value.confirmClass.includes('warning')) return 'warning';
  return 'info';
});
</script>

<style scoped>
.confirm-dialog__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.confirm-dialog__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.confirm-dialog__icon i {
  font-size: 2rem;
}

.confirm-dialog__icon--info {
  background: #eff6ff;
  color: #2563eb;
}

.confirm-dialog__icon--warning {
  background: #fffbeb;
  color: #d97706;
}

.confirm-dialog__icon--danger {
  background: #fef2f2;
  color: #dc2626;
}

.confirm-dialog__message {
  color: #475569;
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
}

.confirm-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
