<template>
  <div class="dashboard-today">
    <!-- Greeting Section -->
    <GreetingCard :greeting="dashboardStore.greeting" />

    <!-- Quick Stats Bar -->
    <QuickStatsBar
      :quick-stats="dashboardStore.quickStats"
      :loading="dashboardStore.isLoading"
    />

    <!-- Main Content Grid -->
    <div class="dashboard-today__grid">
      <!-- Left Column -->
      <div class="dashboard-today__main">
        <!-- Daily KPIs -->
        <DailyKpisCard
          :kpis="dashboardStore.dailyKpis"
          :loading="dashboardStore.isLoading"
        />

        <!-- Urgent Tasks -->
        <UrgentTasksCard
          :urgent-tasks="dashboardStore.urgentTasks"
          :loading="dashboardStore.isLoading"
        />

        <!-- Suggestions -->
        <SuggestionsCard
          :suggestions="dashboardStore.pendingSuggestions"
          :stats="dashboardStore.suggestionStats"
          :loading="dashboardStore.isLoadingSuggestions"
          @dismiss="handleDismissSuggestion"
          @act="handleActSuggestion"
        />
      </div>

      <!-- Right Column (Sidebar) -->
      <div class="dashboard-today__sidebar">
        <!-- Day Plan -->
        <DayPlanCard
          :day-plan="dashboardStore.dayPlan"
          :loading="dashboardStore.isLoading"
        />

        <!-- Quick Actions -->
        <div class="quick-actions-card">
          <h3 class="quick-actions-card__title">
            <i class="pi pi-bolt"></i>
            Azioni Rapide
          </h3>
          <div class="quick-actions-card__grid">
            <router-link to="/orders/new" class="quick-action">
              <i class="pi pi-plus-circle"></i>
              <span>Nuovo Ordine</span>
            </router-link>
            <router-link to="/products/new" class="quick-action">
              <i class="pi pi-box"></i>
              <span>Nuovo Prodotto</span>
            </router-link>
            <router-link to="/inventory" class="quick-action">
              <i class="pi pi-warehouse"></i>
              <span>Inventario</span>
            </router-link>
            <router-link to="/tasks/new" class="quick-action">
              <i class="pi pi-check-square"></i>
              <span>Nuovo Task</span>
            </router-link>
          </div>
        </div>

        <!-- Refresh Button -->
        <button
          class="refresh-button"
          @click="refreshDashboard"
          :disabled="dashboardStore.isLoading"
        >
          <i :class="['pi', dashboardStore.isLoading ? 'pi-spin pi-spinner' : 'pi-refresh']"></i>
          {{ dashboardStore.isLoading ? 'Aggiornamento...' : 'Aggiorna Dashboard' }}
        </button>
      </div>
    </div>

    <!-- Error Toast -->
    <Toast position="top-right" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import { useDashboardStore } from '../stores/dashboard.store';
import type { Suggestion } from '../types';

// Dashboard components
import GreetingCard from '../components/dashboard/GreetingCard.vue';
import DailyKpisCard from '../components/dashboard/DailyKpisCard.vue';
import UrgentTasksCard from '../components/dashboard/UrgentTasksCard.vue';
import DayPlanCard from '../components/dashboard/DayPlanCard.vue';
import SuggestionsCard from '../components/dashboard/SuggestionsCard.vue';
import QuickStatsBar from '../components/dashboard/QuickStatsBar.vue';

const toast = useToast();
const dashboardStore = useDashboardStore();

// Auto-refresh interval (every 5 minutes)
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const refreshDashboard = async () => {
  await dashboardStore.loadTodayDashboard();
};

const handleDismissSuggestion = async (suggestion: Suggestion) => {
  const success = await dashboardStore.dismissSuggestion(suggestion.id);
  if (success) {
    toast.add({
      severity: 'info',
      summary: 'Suggerimento ignorato',
      detail: 'Il suggerimento e stato rimosso dalla lista',
      life: 3000,
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Non e stato possibile ignorare il suggerimento',
      life: 3000,
    });
  }
};

const handleActSuggestion = async (suggestion: Suggestion) => {
  const success = await dashboardStore.actOnSuggestion(suggestion.id);
  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Azione registrata',
      detail: 'Il suggerimento e stato segnato come completato',
      life: 3000,
    });
  }
};

onMounted(async () => {
  await refreshDashboard();

  // Setup auto-refresh every 5 minutes
  refreshInterval = setInterval(refreshDashboard, 5 * 60 * 1000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.dashboard-today {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.dashboard-today__grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--space-6);
}

.dashboard-today__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.dashboard-today__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Quick Actions Card */
.quick-actions-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
}

.quick-actions-card__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.quick-actions-card__title i {
  color: var(--color-primary-600);
}

.quick-actions-card__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.quick-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  text-decoration: none;
  color: var(--color-gray-700);
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-align: center;
  transition: all var(--transition-fast);
}

.quick-action i {
  font-size: 1.25rem;
  color: var(--color-primary-600);
}

.quick-action:hover {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  transform: translateY(-2px);
}

/* Refresh Button */
.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-gray-100);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--color-gray-700);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-button:hover:not(:disabled) {
  background: var(--color-gray-200);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1200px) {
  .dashboard-today__grid {
    grid-template-columns: 1fr 320px;
  }
}

@media (max-width: 1024px) {
  .dashboard-today__grid {
    grid-template-columns: 1fr;
  }

  .dashboard-today__sidebar {
    order: -1;
  }
}

@media (max-width: 768px) {
  .dashboard-today {
    gap: var(--space-4);
  }

  .dashboard-today__grid {
    gap: var(--space-4);
  }

  .quick-actions-card__grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .quick-action {
    padding: var(--space-3);
  }
}

@media (max-width: 480px) {
  .quick-actions-card__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
