import { ref, computed, watch } from 'vue';

interface PaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  initialSortField?: string;
  initialSortOrder?: 'asc' | 'desc';
}

interface PaginationState {
  page: number;
  limit: number;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  total: number;
  totalPages: number;
}

export function usePagination(options: PaginationOptions = {}) {
  const {
    initialPage = 1,
    initialLimit = 20,
    initialSortField = 'createdAt',
    initialSortOrder = 'desc',
  } = options;

  const page = ref(initialPage);
  const limit = ref(initialLimit);
  const sortField = ref(initialSortField);
  const sortOrder = ref<'asc' | 'desc'>(initialSortOrder);
  const total = ref(0);

  const totalPages = computed(() => Math.ceil(total.value / limit.value));

  const offset = computed(() => (page.value - 1) * limit.value);

  const hasNextPage = computed(() => page.value < totalPages.value);
  const hasPrevPage = computed(() => page.value > 1);

  const queryParams = computed(() => ({
    page: page.value,
    limit: limit.value,
    sortBy: sortField.value,
    sortOrder: sortOrder.value,
  }));

  const queryString = computed(() => {
    const params = new URLSearchParams();
    params.set('page', String(page.value));
    params.set('limit', String(limit.value));
    if (sortField.value) {
      params.set('sortBy', sortField.value);
      params.set('sortOrder', sortOrder.value);
    }
    return params.toString();
  });

  function setPage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages.value) {
      page.value = newPage;
    }
  }

  function nextPage() {
    if (hasNextPage.value) {
      page.value++;
    }
  }

  function prevPage() {
    if (hasPrevPage.value) {
      page.value--;
    }
  }

  function setLimit(newLimit: number) {
    limit.value = newLimit;
    page.value = 1; // Reset alla prima pagina
  }

  function setSort(field: string, order?: 'asc' | 'desc') {
    if (sortField.value === field && !order) {
      // Toggle ordine se stesso campo
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortField.value = field;
      sortOrder.value = order || 'asc';
    }
    page.value = 1; // Reset alla prima pagina
  }

  function setTotal(newTotal: number) {
    total.value = newTotal;
  }

  function reset() {
    page.value = initialPage;
    limit.value = initialLimit;
    sortField.value = initialSortField;
    sortOrder.value = initialSortOrder;
    total.value = 0;
  }

  // Handler per PrimeVue DataTable
  function onPage(event: { page: number; rows: number }) {
    page.value = event.page + 1; // PrimeVue usa indice 0-based
    limit.value = event.rows;
  }

  function onSort(event: { sortField: string; sortOrder: number }) {
    sortField.value = event.sortField;
    sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
    page.value = 1;
  }

  // Stato per PrimeVue DataTable
  const dataTableState = computed(() => ({
    first: offset.value,
    rows: limit.value,
    sortField: sortField.value,
    sortOrder: sortOrder.value === 'asc' ? 1 : -1,
  }));

  return {
    // State
    page,
    limit,
    sortField,
    sortOrder,
    total,
    totalPages,
    offset,

    // Computed
    hasNextPage,
    hasPrevPage,
    queryParams,
    queryString,
    dataTableState,

    // Methods
    setPage,
    nextPage,
    prevPage,
    setLimit,
    setSort,
    setTotal,
    reset,

    // PrimeVue handlers
    onPage,
    onSort,
  };
}
