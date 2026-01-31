<template>
  <div class="import-progress-card" v-if="visible">
    <div class="progress-header">
      <div class="header-left">
        <i class="pi pi-cloud-download header-icon"></i>
        <div class="header-text">
          <h4>Importazione Clienti WordPress</h4>
          <span class="status-text" :class="statusClass">{{ statusLabel }}</span>
        </div>
      </div>
      <Tag :severity="statusSeverity" :value="statusLabel" />
    </div>

    <div class="progress-content" v-if="progress">
      <ProgressBar
        :value="progress.percent || 0"
        :showValue="true"
        :class="{ 'progress-active': status === 'active' }"
      />

      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ progress.currentPage || 0 }}</span>
          <span class="stat-label">Pagina</span>
        </div>
        <div class="stat-divider">/</div>
        <div class="stat">
          <span class="stat-value">{{ progress.totalPages || '?' }}</span>
          <span class="stat-label">Totali</span>
        </div>
        <div class="stat-separator"></div>
        <div class="stat success">
          <span class="stat-value">{{ progress.imported || 0 }}</span>
          <span class="stat-label">Importati</span>
        </div>
        <div class="stat info">
          <span class="stat-value">{{ progress.updated || 0 }}</span>
          <span class="stat-label">Aggiornati</span>
        </div>
        <div class="stat danger" v-if="progress.errors > 0">
          <span class="stat-value">{{ progress.errors }}</span>
          <span class="stat-label">Errori</span>
        </div>
      </div>

      <div class="time-info" v-if="progress.startedAt">
        <span><i class="pi pi-clock"></i> Avviato: {{ formatTime(progress.startedAt) }}</span>
        <span v-if="estimatedTime"><i class="pi pi-hourglass"></i> Stima: {{ estimatedTime }}</span>
      </div>
    </div>

    <div class="progress-actions">
      <Button
        v-if="status === 'active'"
        label="Pausa"
        icon="pi pi-pause"
        class="p-button-warning p-button-outlined"
        :loading="pausing"
        @click="pauseImport"
      />
      <Button
        v-if="status === 'paused' || savedState"
        label="Riprendi"
        icon="pi pi-play"
        class="p-button-success"
        :loading="resuming"
        @click="resumeImport"
      />
      <Button
        v-if="status === 'active' || status === 'waiting'"
        label="Annulla"
        icon="pi pi-times"
        class="p-button-danger p-button-outlined"
        :loading="cancelling"
        @click="cancelImport"
      />
      <Button
        v-if="status === 'completed' || status === 'failed'"
        label="Chiudi"
        icon="pi pi-check"
        class="p-button-secondary p-button-outlined"
        @click="close"
      />
    </div>

    <div class="result-message" v-if="status === 'completed' && result">
      <i class="pi pi-check-circle"></i>
      <span>
        Importazione completata: {{ result.imported }} nuovi, {{ result.updated }} aggiornati
        <template v-if="result.errors > 0">, {{ result.errors }} errori</template>
      </span>
    </div>

    <div class="error-message" v-if="status === 'failed' && failedReason">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ failedReason }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import api from '../services/api.service';

const props = defineProps<{
  jobId?: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'completed', result: any): void;
  (e: 'cancelled'): void;
}>();

const status = ref<'waiting' | 'active' | 'completed' | 'failed' | 'paused' | 'not_found'>('waiting');
const progress = ref<any>(null);
const result = ref<any>(null);
const failedReason = ref<string>('');
const savedState = ref<any>(null);
const currentJobId = ref<string | null>(null);

const pausing = ref(false);
const resuming = ref(false);
const cancelling = ref(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;

const statusLabel = computed(() => {
  switch (status.value) {
    case 'waiting': return 'In attesa';
    case 'active': return 'In corso';
    case 'completed': return 'Completato';
    case 'failed': return 'Fallito';
    case 'paused': return 'In pausa';
    default: return 'Sconosciuto';
  }
});

const statusSeverity = computed(() => {
  switch (status.value) {
    case 'waiting': return 'warning';
    case 'active': return 'info';
    case 'completed': return 'success';
    case 'failed': return 'danger';
    case 'paused': return 'warning';
    default: return 'secondary';
  }
});

const statusClass = computed(() => status.value);

const estimatedTime = computed(() => {
  if (!progress.value || status.value !== 'active') return null;

  const { currentPage, totalPages, startedAt } = progress.value;
  if (!currentPage || !totalPages || !startedAt) return null;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  const pagesRemaining = totalPages - currentPage;
  const msPerPage = elapsed / currentPage;
  const remainingMs = pagesRemaining * msPerPage;

  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `~${hours}h ${mins}min`;
});

const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const pollStatus = async () => {
  if (!currentJobId.value) return;

  try {
    const response = await api.get(`/wordpress/import-customers-status/${currentJobId.value}`);

    if (response.success) {
      status.value = response.data.status;
      progress.value = response.data.progress;
      result.value = response.data.result;
      failedReason.value = response.data.failedReason || '';

      // Stop polling se completato o fallito
      if (status.value === 'completed' || status.value === 'failed') {
        stopPolling();
        if (status.value === 'completed') {
          emit('completed', result.value);
        }
      }
    }
  } catch (error) {
    console.error('Errore polling status:', error);
  }
};

const startPolling = () => {
  if (pollInterval) return;
  pollStatus(); // Prima chiamata immediata
  pollInterval = setInterval(pollStatus, 2000);
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

const pauseImport = async () => {
  if (!currentJobId.value) return;

  pausing.value = true;
  try {
    const response = await api.post(`/wordpress/import-customers-pause/${currentJobId.value}`);
    if (response.success) {
      savedState.value = response.data.savedState;
      status.value = 'paused';
      stopPolling();
    }
  } catch (error) {
    console.error('Errore pausa:', error);
  } finally {
    pausing.value = false;
  }
};

const resumeImport = async () => {
  if (!savedState.value) return;

  resuming.value = true;
  try {
    const response = await api.post('/wordpress/import-customers-resume', {
      savedState: savedState.value,
    });

    if (response.success) {
      currentJobId.value = response.data.jobId;
      savedState.value = null;
      status.value = 'active';
      startPolling();
    }
  } catch (error) {
    console.error('Errore resume:', error);
  } finally {
    resuming.value = false;
  }
};

const cancelImport = async () => {
  if (!currentJobId.value) return;

  cancelling.value = true;
  try {
    await api.post(`/wordpress/import-customers-cancel/${currentJobId.value}`);
    stopPolling();
    emit('cancelled');
    close();
  } catch (error) {
    console.error('Errore cancellazione:', error);
  } finally {
    cancelling.value = false;
  }
};

const close = () => {
  stopPolling();
  emit('update:visible', false);
};

// Watch per jobId prop
watch(() => props.jobId, (newJobId) => {
  if (newJobId) {
    currentJobId.value = newJobId;
    status.value = 'waiting';
    progress.value = null;
    result.value = null;
    startPolling();
  }
}, { immediate: true });

// Watch per visibility
watch(() => props.visible, (visible) => {
  if (!visible) {
    stopPolling();
  }
});

onMounted(() => {
  if (props.jobId && props.visible) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.import-progress-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-4);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.header-text h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.status-text {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.status-text.active { color: var(--blue-500); }
.status-text.completed { color: var(--green-500); }
.status-text.failed { color: var(--red-500); }
.status-text.paused { color: var(--orange-500); }

.progress-content {
  margin-bottom: var(--space-4);
}

.progress-active :deep(.p-progressbar-value) {
  animation: progress-pulse 1.5s ease-in-out infinite;
}

@keyframes progress-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.stats-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.stat.success .stat-value { color: var(--green-500); }
.stat.info .stat-value { color: var(--blue-500); }
.stat.danger .stat-value { color: var(--red-500); }

.stat-divider {
  font-size: 1.25rem;
  color: var(--text-color-secondary);
}

.stat-separator {
  width: 1px;
  height: 30px;
  background: var(--surface-border);
  margin: 0 var(--space-2);
}

.time-info {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.time-info i {
  margin-right: var(--space-1);
}

.progress-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.result-message,
.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--border-radius-md);
  margin-top: var(--space-3);
}

.result-message {
  background: var(--green-50);
  color: var(--green-700);
}

.result-message i {
  color: var(--green-500);
}

.error-message {
  background: var(--red-50);
  color: var(--red-700);
}

.error-message i {
  color: var(--red-500);
}
</style>
