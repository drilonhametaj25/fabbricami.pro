<template>
  <div class="page-header">
    <div class="page-header__left">
      <div class="page-header__breadcrumb" v-if="breadcrumbs.length > 0">
        <template v-for="(crumb, index) in breadcrumbs" :key="index">
          <router-link v-if="crumb.to" :to="crumb.to" class="page-header__crumb-link">
            {{ crumb.label }}
          </router-link>
          <span v-else class="page-header__crumb-current">{{ crumb.label }}</span>
          <i v-if="index < breadcrumbs.length - 1" class="pi pi-angle-right page-header__crumb-separator"></i>
        </template>
      </div>
      <h1 class="page-header__title">
        <i v-if="icon" :class="[icon, 'page-header__icon']"></i>
        {{ title }}
      </h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header__actions" v-if="$slots.actions">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Breadcrumb {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  breadcrumbs?: Breadcrumb[];
}

withDefaults(defineProps<Props>(), {
  breadcrumbs: () => [],
});
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--border-color);
}

.page-header__left {
  flex: 1;
  min-width: 0;
}

.page-header__breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
}

.page-header__crumb-link {
  color: var(--color-gray-500);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.page-header__crumb-link:hover {
  color: var(--color-primary-600);
}

.page-header__crumb-separator {
  color: var(--color-gray-300);
  font-size: var(--font-size-xs);
}

.page-header__crumb-current {
  color: var(--color-gray-900);
  font-weight: 500;
}

.page-header__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  line-height: var(--line-height-tight);
}

.page-header__icon {
  color: var(--color-primary-600);
  font-size: 1.5rem;
}

.page-header__subtitle {
  color: var(--color-gray-500);
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
}

.page-header__actions {
  display: flex;
  gap: var(--space-3);
  flex-shrink: 0;
  align-items: center;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: var(--space-4);
    padding-bottom: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .page-header__title {
    font-size: var(--font-size-xl);
  }

  .page-header__actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
