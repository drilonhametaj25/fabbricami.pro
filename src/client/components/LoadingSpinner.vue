<template>
  <div :class="['loading-spinner', `loading-spinner--${size}`]">
    <div class="loading-spinner__container">
      <i class="pi pi-spin pi-spinner"></i>
      <span v-if="message" class="loading-spinner__message">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
});
</script>

<style scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.loading-spinner__container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-spinner i {
  color: #2563eb;
}

.loading-spinner--small {
  padding: 1rem;
}

.loading-spinner--small i {
  font-size: 1.5rem;
}

.loading-spinner--medium {
  padding: 3rem;
}

.loading-spinner--medium i {
  font-size: 2.5rem;
}

.loading-spinner--large {
  padding: 5rem;
}

.loading-spinner--large i {
  font-size: 4rem;
}

.loading-spinner__message {
  color: #64748b;
  font-size: 0.9375rem;
}
</style>
