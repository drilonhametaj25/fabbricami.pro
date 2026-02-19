<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';

const router = useRouter();
const toast = useToast();

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: {
    status: string;
    planCode: string;
    planName: string;
    trialEndsAt?: string;
    currentPeriodEnd: string;
  } | null;
  owner: {
    email: string;
    name: string;
  } | null;
  membersCount: number;
}

const loading = ref(true);
const tenants = ref<TenantItem[]>([]);
const totalRecords = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// Filters
const search = ref('');
const statusFilter = ref('');
const subscriptionStatusFilter = ref('');
const planFilter = ref('');

const statusOptions = [
  { label: 'Tutti', value: '' },
  { label: 'Attivo', value: 'ACTIVE' },
  { label: 'Sospeso', value: 'SUSPENDED' },
  { label: 'Cancellato', value: 'CANCELLED' },
];

const subscriptionStatusOptions = [
  { label: 'Tutti', value: '' },
  { label: 'Trial', value: 'TRIALING' },
  { label: 'Attivo', value: 'ACTIVE' },
  { label: 'Scaduto', value: 'EXPIRED' },
  { label: 'Past Due', value: 'PAST_DUE' },
  { label: 'Cancellato', value: 'CANCELLED' },
];

const planOptions = [
  { label: 'Tutti', value: '' },
  { label: 'Starter', value: 'STARTER' },
  { label: 'Pro', value: 'PRO' },
  { label: 'Business', value: 'BUSINESS' },
];

onMounted(async () => {
  await loadTenants();
});

// Watch filters
let searchTimeout: ReturnType<typeof setTimeout>;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    loadTenants();
  }, 300);
});

watch([statusFilter, subscriptionStatusFilter, planFilter], () => {
  currentPage.value = 1;
  loadTenants();
});

async function loadTenants() {
  loading.value = true;
  try {
    const response = await adminApi.getTenants({
      search: search.value || undefined,
      status: statusFilter.value || undefined,
      subscriptionStatus: subscriptionStatusFilter.value || undefined,
      planCode: planFilter.value || undefined,
      page: currentPage.value,
      limit: pageSize.value,
    });

    if (response.success && response.data) {
      tenants.value = response.data.items;
      totalRecords.value = response.data.total;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare i tenant',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function onPage(event: { page: number; rows: number }) {
  currentPage.value = event.page + 1;
  pageSize.value = event.rows;
  loadTenants();
}

function viewTenant(tenant: TenantItem) {
  router.push(`/tenants/${tenant.id}`);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' | undefined {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIALING':
      return 'info';
    case 'SUSPENDED':
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return undefined;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Gestione Tenant</h1>
      <p class="page-subtitle">Visualizza e gestisci tutti i clienti della piattaforma</p>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <InputText
        v-model="search"
        placeholder="Cerca per nome o slug..."
        class="search-input"
      />
      <Dropdown
        v-model="statusFilter"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Status Tenant"
      />
      <Dropdown
        v-model="subscriptionStatusFilter"
        :options="subscriptionStatusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Status Abbonamento"
      />
      <Dropdown
        v-model="planFilter"
        :options="planOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Piano"
      />
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <div v-else class="card">
      <DataTable
        :value="tenants"
        :rows="pageSize"
        :totalRecords="totalRecords"
        :lazy="true"
        :paginator="true"
        :rowsPerPageOptions="[10, 20, 50]"
        responsiveLayout="scroll"
        @page="onPage"
        @row-click="(e: any) => viewTenant(e.data)"
        class="clickable-rows"
      >
        <Column field="name" header="Nome" sortable></Column>
        <Column field="slug" header="Slug" sortable style="width: 150px">
          <template #body="{ data }">
            <code class="slug-code">{{ data.slug }}</code>
          </template>
        </Column>
        <Column header="Owner" style="width: 200px">
          <template #body="{ data }">
            <div v-if="data.owner">
              <div>{{ data.owner.name }}</div>
              <div class="text-muted text-sm">{{ data.owner.email }}</div>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
        <Column header="Piano" style="width: 120px">
          <template #body="{ data }">
            <Tag
              v-if="data.subscription"
              :value="data.subscription.planCode"
              severity="info"
            />
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
        <Column header="Status" style="width: 120px">
          <template #body="{ data }">
            <Tag
              v-if="data.subscription"
              :value="data.subscription.status"
              :severity="getStatusSeverity(data.subscription.status)"
            />
            <Tag v-else value="NO SUB" severity="danger" />
          </template>
        </Column>
        <Column header="Membri" style="width: 80px">
          <template #body="{ data }">
            {{ data.membersCount }}
          </template>
        </Column>
        <Column header="Registrato" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>
        <Column header="" style="width: 60px">
          <template #body="{ data }">
            <Button
              icon="pi pi-eye"
              class="p-button-text p-button-sm"
              @click.stop="viewTenant(data)"
              v-tooltip="'Dettagli'"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.filters-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-input {
  min-width: 250px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.slug-code {
  background: #0f172a;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.text-sm {
  font-size: 0.75rem;
}

.clickable-rows :deep(tbody tr) {
  cursor: pointer;
}

:deep(.p-dropdown) {
  min-width: 160px;
}
</style>
