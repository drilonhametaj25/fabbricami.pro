<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';

const toast = useToast();

interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  superAdmin: {
    email: string;
    name: string;
  };
}

const loading = ref(true);
const logs = ref<AuditLog[]>([]);
const totalRecords = ref(0);
const currentPage = ref(1);
const pageSize = ref(50);

onMounted(async () => {
  await loadLogs();
});

async function loadLogs() {
  loading.value = true;
  try {
    const response = await adminApi.getAuditLogs(currentPage.value, pageSize.value);
    if (response.success && response.data) {
      logs.value = response.data.items;
      totalRecords.value = response.data.total;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare i log',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function onPage(event: { page: number; rows: number }) {
  currentPage.value = event.page + 1;
  pageSize.value = event.rows;
  loadLogs();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getActionSeverity(action: string): 'success' | 'info' | 'warning' | 'danger' | undefined {
  if (action.includes('DELETE') || action.includes('SUSPEND')) return 'danger';
  if (action.includes('CREATE')) return 'success';
  if (action.includes('UPDATE') || action.includes('CHANGE')) return 'warning';
  return 'info';
}

function formatDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return '-';
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return '-';
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Audit Log</h1>
      <p class="page-subtitle">Cronologia delle azioni amministrative sulla piattaforma</p>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <div v-else class="card">
      <DataTable
        :value="logs"
        :rows="pageSize"
        :totalRecords="totalRecords"
        :lazy="true"
        :paginator="true"
        :rowsPerPageOptions="[20, 50, 100]"
        responsiveLayout="scroll"
        @page="onPage"
      >
        <Column header="Data" style="width: 180px">
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>
        <Column header="Admin">
          <template #body="{ data }">
            <div>{{ data.superAdmin.name }}</div>
            <div class="text-muted text-sm">{{ data.superAdmin.email }}</div>
          </template>
        </Column>
        <Column header="Azione" style="width: 200px">
          <template #body="{ data }">
            <Tag :value="data.action" :severity="getActionSeverity(data.action)" />
          </template>
        </Column>
        <Column header="Entità" style="width: 150px">
          <template #body="{ data }">
            <div v-if="data.entityType">
              <Tag :value="data.entityType" severity="info" />
              <code v-if="data.entityId" class="entity-id">{{ data.entityId.slice(0, 8) }}...</code>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
        <Column header="IP" style="width: 130px">
          <template #body="{ data }">
            <code class="ip-code">{{ data.ipAddress || '-' }}</code>
          </template>
        </Column>
        <Column header="Dettagli" style="width: 200px">
          <template #body="{ data }">
            <div v-if="data.details" class="details-preview">
              {{ Object.keys(data.details).slice(0, 3).join(', ') }}
              <span v-if="Object.keys(data.details).length > 3">...</span>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.text-sm {
  font-size: 0.75rem;
}

.entity-id {
  display: block;
  margin-top: 0.25rem;
  background: #0f172a;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  color: #94a3b8;
}

.ip-code {
  background: #0f172a;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.details-preview {
  font-size: 0.75rem;
  color: #94a3b8;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
