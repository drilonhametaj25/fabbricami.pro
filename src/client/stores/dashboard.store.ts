/**
 * Dashboard Store
 * Gestisce lo stato della dashboard intelligente "Cosa fare oggi"
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api.service';
import type {
  TodayDashboard,
  DashboardPreferences,
  DashboardKpisResponse,
  Suggestion,
  SuggestionStats,
  SuggestionPriority,
  SuggestionStatus,
} from '../types';

export const useDashboardStore = defineStore('dashboard', () => {
  // ============================================
  // STATE
  // ============================================

  const dashboard = ref<TodayDashboard | null>(null);
  const preferences = ref<DashboardPreferences | null>(null);
  const kpis = ref<DashboardKpisResponse | null>(null);
  const suggestions = ref<Suggestion[]>([]);
  const suggestionStats = ref<SuggestionStats | null>(null);

  const isLoading = ref(false);
  const isLoadingKpis = ref(false);
  const isLoadingSuggestions = ref(false);
  const error = ref<string | null>(null);

  // ============================================
  // GETTERS (computed)
  // ============================================

  const greeting = computed(() => dashboard.value?.greeting || null);
  const dailyKpis = computed(() => dashboard.value?.dailyKpis || null);
  const urgentTasks = computed(() => dashboard.value?.urgentTasks || null);
  const dayPlan = computed(() => dashboard.value?.dayPlan || null);
  const quickStats = computed(() => dashboard.value?.quickStats || null);

  const pendingSuggestions = computed(() =>
    suggestions.value.filter(s => s.status === 'PENDING')
  );

  const criticalSuggestions = computed(() =>
    pendingSuggestions.value.filter(s => s.priority === 'CRITICAL')
  );

  const highPrioritySuggestions = computed(() =>
    pendingSuggestions.value.filter(s => s.priority === 'HIGH')
  );

  const dayPlanProgress = computed(() => {
    const plan = dashboard.value?.dayPlan;
    if (!plan || plan.totalCount === 0) return 0;
    return Math.round((plan.completedCount / plan.totalCount) * 100);
  });

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Carica la dashboard completa "Cosa fare oggi"
   */
  const loadTodayDashboard = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.get('/dashboard/today');
      if (response.success) {
        dashboard.value = response.data;
        // Aggiorna anche i suggerimenti separatamente
        if (response.data.suggestions) {
          suggestions.value = response.data.suggestions.items;
          suggestionStats.value = response.data.suggestions.stats;
        }
      }
    } catch (err: unknown) {
      console.error('Error loading dashboard:', err);
      error.value = err instanceof Error ? err.message : 'Errore caricamento dashboard';
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Carica KPI aggregati per periodo
   */
  const loadKpis = async (dateRange: '1d' | '7d' | '30d' | '90d' = '7d') => {
    isLoadingKpis.value = true;

    try {
      const response = await api.get(`/dashboard/kpis?dateRange=${dateRange}`);
      if (response.success) {
        kpis.value = response.data;
      }
    } catch (err: unknown) {
      console.error('Error loading KPIs:', err);
    } finally {
      isLoadingKpis.value = false;
    }
  };

  /**
   * Carica suggerimenti con filtri
   */
  const loadSuggestions = async (params: {
    page?: number;
    limit?: number;
    type?: string;
    priority?: SuggestionPriority;
    status?: SuggestionStatus;
  } = {}) => {
    isLoadingSuggestions.value = true;

    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.type) queryParams.set('type', params.type);
      if (params.priority) queryParams.set('priority', params.priority);
      if (params.status) queryParams.set('status', params.status);

      const response = await api.get(`/dashboard/suggestions?${queryParams}`);
      if (response.success) {
        suggestions.value = response.data.items;
      }
    } catch (err: unknown) {
      console.error('Error loading suggestions:', err);
    } finally {
      isLoadingSuggestions.value = false;
    }
  };

  /**
   * Carica statistiche suggerimenti
   */
  const loadSuggestionStats = async () => {
    try {
      const response = await api.get('/dashboard/suggestions/stats');
      if (response.success) {
        suggestionStats.value = response.data;
      }
    } catch (err: unknown) {
      console.error('Error loading suggestion stats:', err);
    }
  };

  /**
   * Scarta un suggerimento
   */
  const dismissSuggestion = async (id: string, reason?: string) => {
    try {
      const response = await api.post(`/dashboard/suggestions/${id}/dismiss`, { reason });
      if (response.success) {
        // Aggiorna stato locale
        const suggestion = suggestions.value.find(s => s.id === id);
        if (suggestion) {
          suggestion.status = 'DISMISSED';
          suggestion.dismissedAt = new Date().toISOString();
          suggestion.dismissReason = reason;
        }
        // Rimuovi dalla lista pending
        suggestions.value = suggestions.value.filter(s => s.id !== id);
      }
      return response.success;
    } catch (err: unknown) {
      console.error('Error dismissing suggestion:', err);
      return false;
    }
  };

  /**
   * Marca un suggerimento come completato
   */
  const actOnSuggestion = async (id: string) => {
    try {
      const response = await api.post(`/dashboard/suggestions/${id}/act`, {});
      if (response.success) {
        // Aggiorna stato locale
        const suggestion = suggestions.value.find(s => s.id === id);
        if (suggestion) {
          suggestion.status = 'ACTED';
          suggestion.actedAt = new Date().toISOString();
        }
        // Rimuovi dalla lista
        suggestions.value = suggestions.value.filter(s => s.id !== id);
      }
      return response.success;
    } catch (err: unknown) {
      console.error('Error acting on suggestion:', err);
      return false;
    }
  };

  /**
   * Genera nuovi suggerimenti (admin only)
   */
  const generateSuggestions = async () => {
    try {
      const response = await api.post('/dashboard/suggestions/generate', {});
      if (response.success) {
        // Ricarica suggerimenti
        await loadSuggestions();
        await loadSuggestionStats();
      }
      return response;
    } catch (err: unknown) {
      console.error('Error generating suggestions:', err);
      return null;
    }
  };

  /**
   * Carica preferenze dashboard
   */
  const loadPreferences = async () => {
    try {
      const response = await api.get('/dashboard/preferences');
      if (response.success) {
        preferences.value = response.data;
      }
    } catch (err: unknown) {
      console.error('Error loading preferences:', err);
    }
  };

  /**
   * Aggiorna preferenze dashboard
   */
  const updatePreferences = async (data: Partial<DashboardPreferences>) => {
    try {
      const response = await api.put('/dashboard/preferences', data);
      if (response.success) {
        preferences.value = response.data;
      }
      return response.success;
    } catch (err: unknown) {
      console.error('Error updating preferences:', err);
      return false;
    }
  };

  /**
   * Refresh solo task urgenti
   */
  const refreshUrgentTasks = async () => {
    try {
      const response = await api.get('/dashboard/urgent-tasks');
      if (response.success && dashboard.value) {
        dashboard.value.urgentTasks = response.data;
      }
    } catch (err: unknown) {
      console.error('Error refreshing urgent tasks:', err);
    }
  };

  /**
   * Reset stato
   */
  const reset = () => {
    dashboard.value = null;
    preferences.value = null;
    kpis.value = null;
    suggestions.value = [];
    suggestionStats.value = null;
    isLoading.value = false;
    error.value = null;
  };

  return {
    // State
    dashboard,
    preferences,
    kpis,
    suggestions,
    suggestionStats,
    isLoading,
    isLoadingKpis,
    isLoadingSuggestions,
    error,

    // Getters
    greeting,
    dailyKpis,
    urgentTasks,
    dayPlan,
    quickStats,
    pendingSuggestions,
    criticalSuggestions,
    highPrioritySuggestions,
    dayPlanProgress,

    // Actions
    loadTodayDashboard,
    loadKpis,
    loadSuggestions,
    loadSuggestionStats,
    dismissSuggestion,
    actOnSuggestion,
    generateSuggestions,
    loadPreferences,
    updatePreferences,
    refreshUrgentTasks,
    reset,
  };
});
