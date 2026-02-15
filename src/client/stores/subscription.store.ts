import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api.service';
import type {
  Subscription,
  SubscriptionPlan,
  UsageStats,
  BillingHistoryItem,
} from '../types';

export const useSubscriptionStore = defineStore('subscription', () => {
  // State
  const currentSubscription = ref<Subscription | null>(null);
  const availablePlans = ref<SubscriptionPlan[]>([]);
  const usage = ref<UsageStats | null>(null);
  const billingHistory = ref<BillingHistoryItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isActive = computed(
    () => currentSubscription.value?.status === 'ACTIVE'
  );

  const isTrialing = computed(
    () => currentSubscription.value?.status === 'TRIALING'
  );

  const isPastDue = computed(
    () => currentSubscription.value?.status === 'PAST_DUE'
  );

  const isCancelled = computed(
    () => currentSubscription.value?.status === 'CANCELLED'
  );

  const isPaused = computed(
    () => currentSubscription.value?.status === 'PAUSED'
  );

  const currentPlanCode = computed(
    () => currentSubscription.value?.planCode || 'STARTER'
  );

  const currentPlanName = computed(
    () => currentSubscription.value?.planName || 'Starter'
  );

  const daysUntilRenewal = computed(() => {
    if (!currentSubscription.value?.currentPeriodEnd) return null;
    const endDate = new Date(currentSubscription.value.currentPeriodEnd);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  });

  const trialDaysRemaining = computed(() => {
    if (!currentSubscription.value?.trialEndsAt) return null;
    const endDate = new Date(currentSubscription.value.trialEndsAt);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  });

  const willCancelAtPeriodEnd = computed(
    () => currentSubscription.value?.cancelAtPeriodEnd || false
  );

  // Usage Getters
  const isNearLimit = computed(() => {
    if (!usage.value) return false;
    return Object.values(usage.value).some((u) => u.percentage >= 80);
  });

  const isAtLimit = computed(() => {
    if (!usage.value) return false;
    return Object.values(usage.value).some((u) => u.percentage >= 100);
  });

  const resourcesNearLimit = computed(() => {
    if (!usage.value) return [];
    return Object.entries(usage.value)
      .filter(([, stat]) => stat.percentage >= 80)
      .map(([key]) => key);
  });

  const resourcesAtLimit = computed(() => {
    if (!usage.value) return [];
    return Object.entries(usage.value)
      .filter(([, stat]) => stat.percentage >= 100)
      .map(([key]) => key);
  });

  const currentPlan = computed(() =>
    availablePlans.value.find((p) => p.code === currentPlanCode.value)
  );

  const upgradePlans = computed(() =>
    availablePlans.value.filter(
      (p) => p.priceMonthly > (currentPlan.value?.priceMonthly || 0)
    )
  );

  // Actions
  async function fetchSubscription() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<Subscription>('/subscription');
      if (response.success) {
        currentSubscription.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento abbonamento';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento abbonamento';
    } finally {
      loading.value = false;
    }
  }

  async function fetchPlans() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<SubscriptionPlan[]>('/subscription/plans');
      if (response.success) {
        availablePlans.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento piani';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento piani';
    } finally {
      loading.value = false;
    }
  }

  async function fetchUsage() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<UsageStats>('/subscription/usage');
      if (response.success) {
        usage.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento utilizzo';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento utilizzo';
    } finally {
      loading.value = false;
    }
  }

  async function fetchBillingHistory() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<BillingHistoryItem[]>('/billing/history');
      if (response.success) {
        billingHistory.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento storico';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento storico';
    } finally {
      loading.value = false;
    }
  }

  async function createCheckout(
    planCode: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<{ checkoutUrl: string }>('/subscription/checkout', {
        planCode,
        billingPeriod,
      });
      if (response.success) {
        return response.data.checkoutUrl;
      } else {
        error.value = response.error || 'Errore creazione checkout';
        return null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione checkout';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateSubscription(planCode: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.patch<Subscription>('/subscription', { planCode });
      if (response.success) {
        currentSubscription.value = response.data;
        return true;
      } else {
        error.value = response.error || 'Errore aggiornamento abbonamento';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento abbonamento';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function cancelSubscription(cancelAtPeriodEnd = true): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<Subscription>('/subscription/cancel', {
        cancelAtPeriodEnd,
      });
      if (response.success) {
        currentSubscription.value = response.data;
        return true;
      } else {
        error.value = response.error || 'Errore cancellazione abbonamento';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore cancellazione abbonamento';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function reactivateSubscription(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<Subscription>('/subscription/reactivate');
      if (response.success) {
        currentSubscription.value = response.data;
        return true;
      } else {
        error.value = response.error || 'Errore riattivazione abbonamento';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore riattivazione abbonamento';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function openCustomerPortal(): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<{ portalUrl: string }>('/billing/portal');
      if (response.success) {
        return response.data.portalUrl;
      } else {
        error.value = response.error || 'Errore apertura portale';
        return null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore apertura portale';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function checkLimit(resource: keyof UsageStats): Promise<boolean> {
    if (!usage.value) {
      await fetchUsage();
    }
    if (!usage.value) return true;

    const stat = usage.value[resource];
    // -1 significa illimitato
    if (stat.limit === -1) return true;
    return stat.current < stat.limit;
  }

  function setSubscription(subscription: Subscription | null) {
    currentSubscription.value = subscription;
  }

  function reset() {
    currentSubscription.value = null;
    availablePlans.value = [];
    usage.value = null;
    billingHistory.value = [];
    loading.value = false;
    error.value = null;
  }

  return {
    // State
    currentSubscription,
    availablePlans,
    usage,
    billingHistory,
    loading,
    error,

    // Getters
    isActive,
    isTrialing,
    isPastDue,
    isCancelled,
    isPaused,
    currentPlanCode,
    currentPlanName,
    daysUntilRenewal,
    trialDaysRemaining,
    willCancelAtPeriodEnd,
    isNearLimit,
    isAtLimit,
    resourcesNearLimit,
    resourcesAtLimit,
    currentPlan,
    upgradePlans,

    // Actions
    fetchSubscription,
    fetchPlans,
    fetchUsage,
    fetchBillingHistory,
    createCheckout,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    openCustomerPortal,
    checkLimit,
    setSubscription,
    reset,
  };
});
