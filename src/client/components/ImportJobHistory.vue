<template>
  <div class="import-job-history">
    <div class="history-header">
      <h3>Storico Importazioni</h3>
      <div class="header-actions">
        <Dropdown
          v-model="selectedType"
          :options="typeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Tutti i tipi"
          class="type-filter"
          showClear
        />
        <Dropdown
          v-model="selectedStatus"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Tutti gli stati"
          class="status-filter"
          showClear
        />
        <Button
          icon="pi pi-refresh"
          class="p-button-text"
          @click="loadJobs"
          :loading="loading"
          v-tooltip="'Aggiorna'"
        />
      </div>
    </div>

    <!-- Alert per job riprendibili -->
    <Message v-if="resumableJobs.length > 0" severity="warn" :closable="false" class="resumable-alert">
      <template #messageicon>
        <i class="pi pi-exclamation-triangle"></i>
      </template>
      <span>
        Ci sono <strong>{{ resumableJobs.length }}</strong> importazioni interrotte che puoi riprendere.
      </span>
    </Message>

    <DataTable
      :value="jobs"
      :loading="loading"
      responsiveLayout="scroll"
      class="jobs-table"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[10, 20, 50]"
      :totalRecords="totalRecords"
      :lazy="true"
      @page="onPage"
    >
      <template #empty>
        <div class="empty-state">
          <i class="pi pi-inbox"></i>
          <p>Nessuna importazione trovata</p>
        </div>
      </template>

      <Column field="type" header="Tipo" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="getTypeLabel(data.type)" :severity="getTypeSeverity(data.type)" />
        </template>
      </Column>

      <Column field="status" header="Stato" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column header="Progresso" style="min-width: 200px">
        <template #body="{ data }">
          <div class="progress-cell">
            <ProgressBar
              :value="getProgressPercent(data)"
              :showValue="true"
              style="height: 8px"
            />
            <span class="progress-text">
              Pagina {{ data.currentPage || 0 }} / {{ data.totalPages || '?' }}
            </span>
          </div>
        </template>
      </Column>

      <Column header="Risultati" style="min-width: 150px">
        <template #body="{ data }">
          <div class="results-cell">
            <span class="result-item success">
              <i class="pi pi-plus-circle"></i> {{ data.imported || 0 }}
            </span>
            <span class="result-item info">
              <i class="pi pi-sync"></i> {{ data.updated || 0 }}
            </span>
            <span class="result-item danger" v-if="data.errors > 0">
              <i class="pi pi-times-circle"></i> {{ data.errors }}
            </span>
          </div>
        </template>
      </Column>

      <Column field="startedAt" header="Avviato" style="width: 150px">
        <template #body="{ data }">
          {{ formatDateTime(data.startedAt) }}
        </template>
      </Column>

      <Column field="completedAt" header="Completato" style="width: 150px">
        <template #body="{ data }">
          <span v-if="data.completedAt">{{ formatDateTime(data.completedAt) }}</span>
          <span v-else-if="data.pausedAt" class="paused-text">
            <i class="pi pi-pause"></i> {{ formatDateTime(data.pausedAt) }}
          </span>
          <span v-else class="running-text">
            <i class="pi pi-spin pi-spinner"></i> In corso
          </span>
        </template>
      </Column>

      <Column header="Azioni" style="width: 120px">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              v-if="canResume(data)"
              icon="pi pi-play"
              class="p-button-success p-button-sm p-button-text"
              v-tooltip="'Riprendi'"
              @click="resumeJob(data)"
              :loading="resumingJobId === data.id"
            />
            <Button
              icon="pi pi-eye"
              class="p-button-info p-button-sm p-button-text"
              v-tooltip="'Dettagli'"
              @click="showDetails(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Dialog dettagli -->
    <Dialog
      v-model:visible="detailsDialogVisible"
      header="Dettagli Importazione"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div v-if="selectedJob" class="job-details">
        <div class="detail-row">
          <span class="label">ID:</span>
          <span class="value code">{{ selectedJob.id }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Tipo:</span>
          <Tag :value="getTypeLabel(selectedJob.type)" :severity="getTypeSeverity(selectedJob.type)" />
        </div>
        <div class="detail-row">
          <span class="label">Stato:</span>
          <Tag :value="getStatusLabel(selectedJob.status)" :severity="getStatusSeverity(selectedJob.status)" />
        </div>
        <div class="detail-row">
          <span class="label">Progresso:</span>
          <span class="value">
            Pagina {{ selectedJob.currentPage }} / {{ selectedJob.totalPages || '?' }}
            ({{ selectedJob.totalItems || '?' }} elementi totali)
          </span>
        </div>
        <div class="detail-row">
          <span class="label">Importati:</span>
          <span class="value success">{{ selectedJob.imported || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Aggiornati:</span>
          <span class="value info">{{ selectedJob.updated || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Errori:</span>
          <span class="value danger">{{ selectedJob.errors || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Avviato:</span>
          <span class="value">{{ formatDateTime(selectedJob.startedAt) }}</span>
        </div>
        <div class="detail-row" v-if="selectedJob.pausedAt">
          <span class="label">In pausa dal:</span>
          <span class="value">{{ formatDateTime(selectedJob.pausedAt) }}</span>
        </div>
        <div class="detail-row" v-if="selectedJob.completedAt">
          <span class="label">Completato:</span>
          <span class="value">{{ formatDateTime(selectedJob.completedAt) }}</span>
        </div>
        <div class="detail-row" v-if="selectedJob.resumedFrom">
          <span class="label">Ripreso da:</span>
          <span class="value code">{{ selectedJob.resumedFrom }}</span>
        </div>

        <!-- Error log -->
        <div v-if="selectedJob.errorLog && selectedJob.errorLog.length > 0" class="error-log">
          <h4>Log Errori</h4>
          <div class="error-list">
            <div v-for="(err, idx) in selectedJob.errorLog.slice(0, 10)" :key="idx" class="error-item">
              <span class="error-page">Pagina {{ err.page }}</span>
              <span class="error-message">{{ err.error }}</span>
              <span class="error-time">{{ formatDateTime(err.timestamp) }}</span>
            </div>
            <div v-if="selectedJob.errorLog.length > 10" class="more-errors">
              ... e altri {{ selectedJob.errorLog.length - 10 }} errori
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          v-if="selectedJob && canResume(selectedJob)"
          label="Riprendi"
          icon="pi pi-play"
          class="p-button-success"
          @click="resumeJob(selectedJob); detailsDialogVisible = false;"
        />
        <Button
          label="Chiudi"
          class="p-button-text"
          @click="detailsDialogVisible = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dropdown from 'primevue/dropdown';
import ProgressBar from 'primevue/progressbar';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import api from '../services/api.service';

interface ImportJob {
  id: string;
  type: 'CUSTOMERS' | 'PRODUCTS' | 'ORDERS';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentPage: number;
  totalPages: number | null;
  totalItems: number | null;
  imported: number;
  updated: number;
  errors: number;
  errorLog: any[] | null;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  resumedFrom: string | null;
  createdBy: string | null;
  bullmqJobId: string | null;
}

const emit = defineEmits<{
  (e: 'resume', job: ImportJob, result: { jobId: string; dbJobId: string }): void;
}>();

const jobs = ref<ImportJob[]>([]);
const resumableJobs = ref<ImportJob[]>([]);
const loading = ref(false);
const totalRecords = ref(0);
const page = ref(1);
const limit = ref(10);

const selectedType = ref<string | null>(null);
const selectedStatus = ref<string | null>(null);

const detailsDialogVisible = ref(false);
const selectedJob = ref<ImportJob | null>(null);
const resumingJobId = ref<string | null>(null);

const typeOptions = [
  { label: 'Clienti', value: 'CUSTOMERS' },
  { label: 'Prodotti', value: 'PRODUCTS' },
  { label: 'Ordini', value: 'ORDERS' },
];

const statusOptions = [
  { label: 'In corso', value: 'RUNNING' },
  { label: 'In pausa', value: 'PAUSED' },
  { label: 'Completato', value: 'COMPLETED' },
  { label: 'Fallito', value: 'FAILED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    CUSTOMERS: 'Clienti',
    PRODUCTS: 'Prodotti',
    ORDERS: 'Ordini',
  };
  return labels[type] || type;
};

const getTypeSeverity = (type: string) => {
  const severities: Record<string, string> = {
    CUSTOMERS: 'info',
    PRODUCTS: 'success',
    ORDERS: 'warning',
  };
  return severities[type] || 'secondary';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    RUNNING: 'In corso',
    PAUSED: 'In pausa',
    COMPLETED: 'Completato',
    FAILED: 'Fallito',
    CANCELLED: 'Annullato',
  };
  return labels[status] || status;
};

const getStatusSeverity = (status: string) => {
  const severities: Record<string, string> = {
    RUNNING: 'info',
    PAUSED: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
    CANCELLED: 'secondary',
  };
  return severities[status] || 'secondary';
};

const getProgressPercent = (job: ImportJob) => {
  if (!job.totalPages || job.totalPages === 0) return 0;
  return Math.round((job.currentPage / job.totalPages) * 100);
};

const formatDateTime = (isoString: string | null) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const canResume = (job: ImportJob) => {
  return job.status === 'PAUSED' || job.status === 'FAILED';
};

const loadJobs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedType.value) params.append('type', selectedType.value);
    if (selectedStatus.value) params.append('status', selectedStatus.value);
    params.append('limit', limit.value.toString());
    params.append('offset', ((page.value - 1) * limit.value).toString());

    const response = await api.get(`/wordpress/import-jobs?${params.toString()}`);

    if (response.success) {
      jobs.value = response.data;
      totalRecords.value = response.pagination?.total || response.data.length;
    }
  } catch (error) {
    console.error('Errore caricamento jobs:', error);
  } finally {
    loading.value = false;
  }
};

const loadResumableJobs = async () => {
  try {
    const response = await api.get('/wordpress/import-jobs/resumable');
    if (response.success) {
      resumableJobs.value = response.data;
    }
  } catch (error) {
    console.error('Errore caricamento resumable jobs:', error);
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  limit.value = event.rows;
  loadJobs();
};

const resumeJob = async (job: ImportJob) => {
  resumingJobId.value = job.id;
  try {
    const response = await api.post(`/wordpress/import-jobs/${job.id}/resume`);

    if (response.success) {
      emit('resume', job, response.data);
      loadJobs();
      loadResumableJobs();
    }
  } catch (error) {
    console.error('Errore resume job:', error);
  } finally {
    resumingJobId.value = null;
  }
};

const showDetails = (job: ImportJob) => {
  selectedJob.value = job;
  detailsDialogVisible.value = true;
};

// Watch filtri
watch([selectedType, selectedStatus], () => {
  page.value = 1;
  loadJobs();
});

onMounted(() => {
  loadJobs();
  loadResumableJobs();
});

// Esponi metodo per refresh dall'esterno
defineExpose({
  refresh: () => {
    loadJobs();
    loadResumableJobs();
  },
});
</script>

<style scoped>
.import-job-history {
  background: var(--surface-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.history-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.type-filter,
.status-filter {
  width: 160px;
}

.resumable-alert {
  margin-bottom: var(--space-4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  color: var(--text-color-secondary);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: var(--space-3);
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.progress-text {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.results-cell {
  display: flex;
  gap: var(--space-3);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.875rem;
}

.result-item.success { color: var(--green-500); }
.result-item.info { color: var(--blue-500); }
.result-item.danger { color: var(--red-500); }

.paused-text {
  color: var(--orange-500);
  font-size: 0.875rem;
}

.running-text {
  color: var(--blue-500);
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
}

/* Details dialog */
.job-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.detail-row .label {
  font-weight: 600;
  min-width: 120px;
  color: var(--text-color-secondary);
}

.detail-row .value {
  color: var(--text-color);
}

.detail-row .value.code {
  font-family: monospace;
  font-size: 0.875rem;
  background: var(--surface-ground);
  padding: 2px 6px;
  border-radius: 4px;
}

.detail-row .value.success { color: var(--green-500); }
.detail-row .value.info { color: var(--blue-500); }
.detail-row .value.danger { color: var(--red-500); }

.error-log {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--surface-border);
}

.error-log h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--red-500);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--red-50);
  border-radius: var(--border-radius-md);
  font-size: 0.75rem;
}

.error-page {
  font-weight: 600;
  color: var(--red-700);
}

.error-message {
  color: var(--red-600);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-time {
  color: var(--red-400);
}

.more-errors {
  text-align: center;
  color: var(--text-color-secondary);
  font-style: italic;
  padding: var(--space-2);
}
</style>
