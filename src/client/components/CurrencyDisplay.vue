<template>
  <span :class="['currency-display', colorClass]">{{ formattedValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  value: number;
  currency?: string;
  locale?: string;
  showSign?: boolean;
  colorize?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'EUR',
  locale: 'it-IT',
  showSign: false,
  colorize: false,
});

const formattedValue = computed(() => {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: props.currency,
  };

  if (props.showSign && props.value > 0) {
    return '+' + new Intl.NumberFormat(props.locale, options).format(props.value);
  }

  return new Intl.NumberFormat(props.locale, options).format(props.value);
});

const colorClass = computed(() => {
  if (!props.colorize) return '';
  if (props.value > 0) return 'currency-display--positive';
  if (props.value < 0) return 'currency-display--negative';
  return '';
});
</script>

<style scoped>
.currency-display {
  font-variant-numeric: tabular-nums;
}

.currency-display--positive {
  color: #16a34a;
}

.currency-display--negative {
  color: #dc2626;
}
</style>
