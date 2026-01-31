<template>
  <div class="greeting-card">
    <div class="greeting-card__content">
      <h1 class="greeting-card__message">{{ greeting?.message || 'Benvenuto!' }}</h1>
      <p class="greeting-card__submessage">{{ greeting?.subMessage }}</p>
    </div>
    <div class="greeting-card__meta">
      <span class="greeting-card__day">{{ greeting?.dayOfWeek }}</span>
      <span class="greeting-card__time">{{ formattedTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GreetingSection } from '../../types';

interface Props {
  greeting: GreetingSection | null;
}

const props = defineProps<Props>();

const formattedTime = computed(() => {
  if (!props.greeting?.currentTime) return '';
  const date = new Date(props.greeting.currentTime);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
});
</script>

<style scoped>
.greeting-card {
  background: linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%);
  color: white;
  border-radius: var(--border-radius-xl);
  padding: var(--space-8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
}

.greeting-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 60%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.greeting-card__content {
  flex: 1;
}

.greeting-card__message {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin: 0 0 var(--space-2) 0;
  line-height: var(--line-height-tight);
}

.greeting-card__submessage {
  font-size: var(--font-size-base);
  opacity: 0.9;
  margin: 0;
  font-weight: 400;
}

.greeting-card__meta {
  text-align: right;
  flex-shrink: 0;
}

.greeting-card__day {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  opacity: 0.9;
  text-transform: capitalize;
}

.greeting-card__time {
  display: block;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin-top: var(--space-1);
}

/* Responsive */
@media (max-width: 768px) {
  .greeting-card {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-6);
  }

  .greeting-card__message {
    font-size: var(--font-size-2xl);
  }

  .greeting-card__meta {
    text-align: left;
    display: flex;
    gap: var(--space-4);
    align-items: baseline;
  }
}
</style>
