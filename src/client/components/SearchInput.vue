<template>
  <div class="search-input">
    <span class="p-input-icon-left">
      <i class="pi pi-search"></i>
      <InputText
        v-model="searchValue"
        :placeholder="placeholder"
        class="search-input__field"
        @input="onInput"
        @keyup.enter="onSearch"
      />
    </span>
    <Button
      v-if="searchValue && showClear"
      icon="pi pi-times"
      class="p-button-text p-button-rounded search-input__clear"
      @click="onClear"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

interface Props {
  modelValue?: string;
  placeholder?: string;
  debounce?: number;
  showClear?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Cerca...',
  debounce: 300,
  showClear: true,
});

const emit = defineEmits(['update:modelValue', 'search']);

const searchValue = ref(props.modelValue);
let debounceTimer: ReturnType<typeof setTimeout>;

watch(
  () => props.modelValue,
  (val) => {
    searchValue.value = val;
  }
);

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:modelValue', searchValue.value);
    emit('search', searchValue.value);
  }, props.debounce);
}

function onSearch() {
  clearTimeout(debounceTimer);
  emit('update:modelValue', searchValue.value);
  emit('search', searchValue.value);
}

function onClear() {
  searchValue.value = '';
  emit('update:modelValue', '');
  emit('search', '');
}
</script>

<style scoped>
.search-input {
  display: flex;
  align-items: center;
  position: relative;
}

.search-input__field {
  width: 280px;
  padding-left: 2.5rem;
}

.search-input__clear {
  position: absolute;
  right: 0.25rem;
}

.p-input-icon-left {
  display: flex;
  align-items: center;
}

.p-input-icon-left i {
  position: absolute;
  left: 0.75rem;
  color: #94a3b8;
}
</style>
