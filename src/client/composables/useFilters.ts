import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface FilterDefinition {
  key: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean';
  default?: any;
  options?: { label: string; value: any }[];
}

export function useFilters<T extends Record<string, any>>(
  definitions: FilterDefinition[],
  options: {
    syncWithUrl?: boolean;
    debounceMs?: number;
  } = {}
) {
  const { syncWithUrl = false, debounceMs = 300 } = options;

  const route = useRoute();
  const router = useRouter();

  // Inizializza filtri con valori default
  const initialFilters = definitions.reduce((acc, def) => {
    acc[def.key] = def.default ?? null;
    return acc;
  }, {} as T);

  const filters = ref<T>({ ...initialFilters } as T);
  const activeFiltersCount = computed(() => {
    return Object.entries(filters.value).filter(([key, value]) => {
      const def = definitions.find((d) => d.key === key);
      if (!def) return false;

      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (value === def.default) return false;

      return true;
    }).length;
  });

  const hasActiveFilters = computed(() => activeFiltersCount.value > 0);

  // Sync da URL se abilitato
  if (syncWithUrl && route.query) {
    definitions.forEach((def) => {
      const urlValue = route.query[def.key];
      if (urlValue !== undefined) {
        switch (def.type) {
          case 'number':
            (filters.value as any)[def.key] = Number(urlValue);
            break;
          case 'boolean':
            (filters.value as any)[def.key] = urlValue === 'true';
            break;
          case 'multiselect':
            (filters.value as any)[def.key] = Array.isArray(urlValue)
              ? urlValue
              : [urlValue];
            break;
          default:
            (filters.value as any)[def.key] = urlValue;
        }
      }
    });
  }

  // Watch per sync URL
  let debounceTimer: ReturnType<typeof setTimeout>;

  if (syncWithUrl) {
    watch(
      filters,
      () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const query: Record<string, any> = {};

          definitions.forEach((def) => {
            const value = (filters.value as any)[def.key];
            if (
              value !== null &&
              value !== undefined &&
              value !== '' &&
              value !== def.default
            ) {
              query[def.key] = value;
            }
          });

          router.replace({ query });
        }, debounceMs);
      },
      { deep: true }
    );
  }

  function setFilter(key: keyof T, value: any) {
    (filters.value as any)[key] = value;
  }

  function clearFilter(key: keyof T) {
    const def = definitions.find((d) => d.key === key);
    (filters.value as any)[key] = def?.default ?? null;
  }

  function clearAll() {
    definitions.forEach((def) => {
      (filters.value as any)[def.key] = def.default ?? null;
    });
  }

  function getQueryParams(): Record<string, any> {
    const params: Record<string, any> = {};

    definitions.forEach((def) => {
      const value = (filters.value as any)[def.key];
      if (value !== null && value !== undefined && value !== '') {
        if (def.type === 'daterange' && Array.isArray(value)) {
          if (value[0]) params[`${def.key}From`] = value[0];
          if (value[1]) params[`${def.key}To`] = value[1];
        } else {
          params[def.key] = value;
        }
      }
    });

    return params;
  }

  function getQueryString(): string {
    const params = getQueryParams();
    return new URLSearchParams(params).toString();
  }

  return {
    filters,
    activeFiltersCount,
    hasActiveFilters,
    setFilter,
    clearFilter,
    clearAll,
    getQueryParams,
    getQueryString,
  };
}

// Preset filtri comuni
export const commonFilters = {
  status: (options: { label: string; value: string }[]) => ({
    key: 'status',
    type: 'select' as const,
    options,
    default: null,
  }),

  search: () => ({
    key: 'search',
    type: 'text' as const,
    default: '',
  }),

  dateRange: (key: string = 'date') => ({
    key,
    type: 'daterange' as const,
    default: null,
  }),

  isActive: () => ({
    key: 'isActive',
    type: 'boolean' as const,
    default: null,
  }),

  category: (options: { label: string; value: string }[]) => ({
    key: 'category',
    type: 'select' as const,
    options,
    default: null,
  }),
};
