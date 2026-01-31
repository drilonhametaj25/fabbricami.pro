<template>
  <div class="suggestions-card">
    <div class="suggestions-card__header">
      <h3 class="suggestions-card__title">
        <i class="pi pi-lightbulb"></i>
        Suggerimenti Intelligenti
      </h3>
      <div class="suggestions-card__stats" v-if="stats">
        <span class="suggestions-card__stat suggestions-card__stat--critical" v-if="stats.byPriority?.CRITICAL">
          {{ stats.byPriority.CRITICAL }} critici
        </span>
        <span class="suggestions-card__stat suggestions-card__stat--pending">
          {{ stats.total || 0 }} totali
        </span>
      </div>
    </div>

    <div class="suggestions-card__list" v-if="!loading && suggestions.length">
      <div
        v-for="suggestion in suggestions.slice(0, 5)"
        :key="suggestion.id"
        :class="['suggestion-item', `suggestion-item--${suggestion.priority.toLowerCase()}`]"
      >
        <div class="suggestion-item__icon">
          <i :class="getTypeIcon(suggestion.type)"></i>
        </div>
        <div class="suggestion-item__content">
          <div class="suggestion-item__header">
            <span class="suggestion-item__title">{{ suggestion.title }}</span>
            <span :class="['suggestion-item__priority', `suggestion-item__priority--${suggestion.priority.toLowerCase()}`]">
              {{ getPriorityLabel(suggestion.priority) }}
            </span>
          </div>
          <p class="suggestion-item__description">{{ suggestion.description }}</p>
          <div class="suggestion-item__actions">
            <button
              class="suggestion-item__action suggestion-item__action--primary"
              @click="handleAct(suggestion)"
              v-if="suggestion.actionLink"
            >
              <i class="pi pi-check"></i>
              {{ suggestion.actionLabel || 'Agisci' }}
            </button>
            <button
              class="suggestion-item__action suggestion-item__action--secondary"
              @click="handleDismiss(suggestion)"
            >
              <i class="pi pi-times"></i>
              Ignora
            </button>
          </div>
        </div>
      </div>

      <div class="suggestions-card__view-all" v-if="suggestions.length > 5">
        <router-link to="/suggestions" class="suggestions-card__view-all-link">
          Vedi tutti i {{ suggestions.length }} suggerimenti
          <i class="pi pi-arrow-right"></i>
        </router-link>
      </div>
    </div>

    <div class="suggestions-card__loading" v-else-if="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Caricamento suggerimenti...</span>
    </div>

    <div class="suggestions-card__empty" v-else>
      <i class="pi pi-thumbs-up"></i>
      <span>Nessun suggerimento al momento. Tutto sotto controllo!</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { Suggestion, SuggestionStats, SuggestionType, SuggestionPriority } from '../../types';

interface Props {
  suggestions: Suggestion[];
  stats: SuggestionStats | null;
  loading?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'dismiss', suggestion: Suggestion): void;
  (e: 'act', suggestion: Suggestion): void;
}>();

const router = useRouter();

const getTypeIcon = (type: SuggestionType) => {
  const icons: Record<SuggestionType, string> = {
    REORDER: 'pi pi-shopping-cart',
    STOCKOUT_ALERT: 'pi pi-exclamation-triangle',
    MARGIN_ALERT: 'pi pi-percentage',
    TREND_UP: 'pi pi-arrow-up',
    TREND_DOWN: 'pi pi-arrow-down',
    SEASONAL_PEAK: 'pi pi-calendar',
    BATCH_PRODUCTION: 'pi pi-cog',
    ORDER_GROUPING: 'pi pi-th-large',
    DEAD_STOCK: 'pi pi-box',
    PAYMENT_DUE: 'pi pi-credit-card',
  };
  return icons[type] || 'pi pi-info-circle';
};

const getPriorityLabel = (priority: SuggestionPriority) => {
  const labels: Record<SuggestionPriority, string> = {
    CRITICAL: 'Critico',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Bassa',
  };
  return labels[priority] || priority;
};

const handleAct = (suggestion: Suggestion) => {
  emit('act', suggestion);
  if (suggestion.actionLink) {
    router.push(suggestion.actionLink);
  }
};

const handleDismiss = (suggestion: Suggestion) => {
  emit('dismiss', suggestion);
};
</script>

<style scoped>
.suggestions-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
}

.suggestions-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.suggestions-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.suggestions-card__title i {
  color: var(--color-warning);
}

.suggestions-card__stats {
  display: flex;
  gap: var(--space-2);
}

.suggestions-card__stat {
  font-size: var(--font-size-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
  font-weight: 500;
}

.suggestions-card__stat--critical {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}

.suggestions-card__stat--pending {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.suggestions-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.suggestion-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  border-left: 3px solid transparent;
}

.suggestion-item--critical {
  border-left-color: var(--color-danger);
  background: var(--color-danger-light);
}

.suggestion-item--high {
  border-left-color: var(--color-warning);
}

.suggestion-item--medium {
  border-left-color: var(--color-info);
}

.suggestion-item--low {
  border-left-color: var(--color-gray-400);
}

.suggestion-item__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: var(--color-gray-600);
  flex-shrink: 0;
  font-size: 1.1rem;
}

.suggestion-item--critical .suggestion-item__icon {
  color: var(--color-danger);
}

.suggestion-item--high .suggestion-item__icon {
  color: var(--color-warning-dark);
}

.suggestion-item__content {
  flex: 1;
  min-width: 0;
}

.suggestion-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.suggestion-item__title {
  font-weight: 600;
  color: var(--color-gray-800);
  font-size: var(--font-size-sm);
}

.suggestion-item__priority {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--border-radius-sm);
  text-transform: uppercase;
}

.suggestion-item__priority--critical {
  background: var(--color-danger);
  color: white;
}

.suggestion-item__priority--high {
  background: var(--color-warning);
  color: white;
}

.suggestion-item__priority--medium {
  background: var(--color-info);
  color: white;
}

.suggestion-item__priority--low {
  background: var(--color-gray-400);
  color: white;
}

.suggestion-item__description {
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
  margin: 0 0 var(--space-3) 0;
  line-height: 1.5;
}

.suggestion-item__actions {
  display: flex;
  gap: var(--space-2);
}

.suggestion-item__action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.suggestion-item__action--primary {
  background: var(--color-primary-600);
  color: white;
}

.suggestion-item__action--primary:hover {
  background: var(--color-primary-700);
}

.suggestion-item__action--secondary {
  background: transparent;
  color: var(--color-gray-500);
  border: 1px solid var(--color-gray-300);
}

.suggestion-item__action--secondary:hover {
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}

.suggestions-card__view-all {
  text-align: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-gray-200);
  margin-top: var(--space-2);
}

.suggestions-card__view-all-link {
  color: var(--color-primary-600);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.suggestions-card__view-all-link:hover {
  color: var(--color-primary-700);
}

.suggestions-card__loading,
.suggestions-card__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
  text-align: center;
}

.suggestions-card__empty i {
  font-size: 2rem;
  color: var(--color-success);
}

/* Responsive */
@media (max-width: 640px) {
  .suggestion-item__actions {
    flex-direction: column;
  }

  .suggestion-item__action {
    justify-content: center;
  }
}
</style>
