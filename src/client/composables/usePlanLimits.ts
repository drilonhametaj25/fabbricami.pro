import { computed, ref } from 'vue';
import { useSubscriptionStore } from '../stores/subscription.store';
import type { UsageStats } from '../types';

export function usePlanLimits() {
  const subscriptionStore = useSubscriptionStore();
  const checkingLimit = ref(false);

  // Computed properties per verificare se si può creare una risorsa
  const canCreateUser = computed(() => {
    const stat = subscriptionStore.usage?.users;
    if (!stat) return true;
    if (stat.limit === -1) return true; // Illimitato
    return stat.current < stat.limit;
  });

  const canCreateWarehouse = computed(() => {
    const stat = subscriptionStore.usage?.warehouses;
    if (!stat) return true;
    if (stat.limit === -1) return true;
    return stat.current < stat.limit;
  });

  const canCreateProduct = computed(() => {
    const stat = subscriptionStore.usage?.products;
    if (!stat) return true;
    if (stat.limit === -1) return true;
    return stat.current < stat.limit;
  });

  const canCreateOrder = computed(() => {
    const stat = subscriptionStore.usage?.orders;
    if (!stat) return true;
    if (stat.limit === -1) return true;
    return stat.current < stat.limit;
  });

  const canCreateSupplier = computed(() => {
    const stat = subscriptionStore.usage?.suppliers;
    if (!stat) return true;
    if (stat.limit === -1) return true;
    return stat.current < stat.limit;
  });

  // Verifica se una feature è disponibile nel piano corrente
  function hasFeature(feature: string): boolean {
    const plan = subscriptionStore.currentPlan;
    if (!plan) return false;
    // L'API può restituire features sia come array di stringhe (legacy)
    // sia come { modules, capabilities } (nuovo seed)
    const f: any = (plan as any).features;
    const planFeatures: string[] = Array.isArray(f)
      ? f
      : Array.isArray(f?.modules)
      ? [...f.modules, ...(Array.isArray(f?.capabilities) ? f.capabilities : [])]
      : [];
    const limitFeatures: string[] = Array.isArray((plan as any).limits?.features)
      ? (plan as any).limits.features
      : [];
    return planFeatures.includes(feature) || limitFeatures.includes(feature);
  }

  // Verifica se un limite è stato raggiunto (con refresh dati)
  async function checkLimit(resource: keyof UsageStats): Promise<boolean> {
    checkingLimit.value = true;
    try {
      return await subscriptionStore.checkLimit(resource);
    } finally {
      checkingLimit.value = false;
    }
  }

  // Ottieni il limite per una risorsa
  function getLimit(resource: keyof UsageStats): number {
    const stat = subscriptionStore.usage?.[resource];
    return stat?.limit ?? -1;
  }

  // Ottieni l'utilizzo corrente per una risorsa
  function getCurrent(resource: keyof UsageStats): number {
    const stat = subscriptionStore.usage?.[resource];
    return stat?.current ?? 0;
  }

  // Ottieni la percentuale di utilizzo
  function getPercentage(resource: keyof UsageStats): number {
    const stat = subscriptionStore.usage?.[resource];
    return stat?.percentage ?? 0;
  }

  // Verifica se una risorsa è vicina al limite (>= 80%)
  function isNearLimit(resource: keyof UsageStats): boolean {
    return getPercentage(resource) >= 80;
  }

  // Verifica se una risorsa ha raggiunto il limite (>= 100%)
  function isAtLimit(resource: keyof UsageStats): boolean {
    return getPercentage(resource) >= 100;
  }

  // Ottieni il messaggio per il limite
  function getLimitMessage(resource: keyof UsageStats): string {
    const labels: Record<keyof UsageStats, string> = {
      users: 'utenti',
      warehouses: 'magazzini',
      products: 'prodotti',
      orders: 'ordini',
      suppliers: 'fornitori',
    };

    const current = getCurrent(resource);
    const limit = getLimit(resource);
    const label = labels[resource];

    if (limit === -1) {
      return `${current} ${label} (illimitati)`;
    }

    return `${current} / ${limit} ${label}`;
  }

  // Ottieni suggerimento per upgrade
  function getUpgradeSuggestion(): string | null {
    if (!subscriptionStore.isAtLimit) return null;

    const atLimit = subscriptionStore.resourcesAtLimit;
    if (atLimit.length === 0) return null;

    const labels: Record<string, string> = {
      users: 'utenti',
      warehouses: 'magazzini',
      products: 'prodotti',
      orders: 'ordini',
      suppliers: 'fornitori',
    };

    const resourceLabels = atLimit.map((r) => labels[r] || r).join(', ');
    return `Hai raggiunto il limite di ${resourceLabels}. Passa a un piano superiore per continuare.`;
  }

  return {
    // Computed
    canCreateUser,
    canCreateWarehouse,
    canCreateProduct,
    canCreateOrder,
    canCreateSupplier,
    checkingLimit,

    // Proxy to store
    usage: computed(() => subscriptionStore.usage),
    isNearLimitAny: computed(() => subscriptionStore.isNearLimit),
    isAtLimitAny: computed(() => subscriptionStore.isAtLimit),
    resourcesNearLimit: computed(() => subscriptionStore.resourcesNearLimit),
    resourcesAtLimit: computed(() => subscriptionStore.resourcesAtLimit),
    currentPlanCode: computed(() => subscriptionStore.currentPlanCode),
    upgradePlans: computed(() => subscriptionStore.upgradePlans),

    // Methods
    hasFeature,
    checkLimit,
    getLimit,
    getCurrent,
    getPercentage,
    isNearLimit,
    isAtLimit,
    getLimitMessage,
    getUpgradeSuggestion,

    // Store actions
    fetchUsage: subscriptionStore.fetchUsage,
  };
}
