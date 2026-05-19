<template>
  <div class="my-feedback-page">
    <PageHeader
      title="Le mie segnalazioni"
      subtitle="Storico bug, richieste di funzionalità e ticket di supporto"
      icon="pi pi-comments"
    />

    <div class="filters">
      <Dropdown
        v-model="filters.status"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Stato"
        showClear
        class="filter-input"
      />
      <Dropdown
        v-model="filters.type"
        :options="typeOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Tipo"
        showClear
        class="filter-input"
      />
      <Button label="Aggiorna" icon="pi pi-refresh" class="p-button-text" @click="load" />
    </div>

    <DataTable
      :value="tickets"
      :loading="loading"
      :paginator="true"
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      stripedRows
      responsiveLayout="scroll"
    >
      <Column field="createdAt" header="Data" :sortable="true">
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>
      <Column field="type" header="Tipo">
        <template #body="{ data }">
          <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
        </template>
      </Column>
      <Column field="title" header="Titolo" />
      <Column field="priority" header="Priorità">
        <template #body="{ data }">
          <Tag :value="data.priority" :severity="prioritySeverity(data.priority)" />
        </template>
      </Column>
      <Column field="status" header="Stato">
        <template #body="{ data }">
          <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column header="Azioni">
        <template #body="{ data }">
          <Button icon="pi pi-eye" class="p-button-text p-button-sm" @click="viewDetail(data)" />
        </template>
      </Column>
      <template #empty>
        <div class="empty-state">Nessuna segnalazione trovata.</div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="showDetail"
      :header="selected?.title || 'Dettaglio segnalazione'"
      :modal="true"
      :style="{ width: '600px' }"
      :draggable="false"
    >
      <div v-if="selected" class="detail">
        <div class="detail-row">
          <strong>Tipo:</strong>
          <Tag :value="typeLabel(selected.type)" :severity="typeSeverity(selected.type)" />
        </div>
        <div class="detail-row">
          <strong>Stato:</strong>
          <Tag :value="statusLabel(selected.status)" :severity="statusSeverity(selected.status)" />
        </div>
        <div class="detail-row">
          <strong>Priorità:</strong> {{ selected.priority }}
        </div>
        <div class="detail-row">
          <strong>Creato:</strong> {{ formatDate(selected.createdAt) }}
        </div>
        <div v-if="selected.resolvedAt" class="detail-row">
          <strong>Risolto:</strong> {{ formatDate(selected.resolvedAt) }}
        </div>
        <hr />
        <div class="detail-section">
          <strong>Descrizione</strong>
          <p>{{ selected.description }}</p>
        </div>
        <div v-if="selected.adminNotes" class="detail-section admin-notes">
          <strong>Risposta del team</strong>
          <p>{{ selected.adminNotes }}</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.service';

const tickets = ref<any[]>([]);
const loading = ref(false);
const showDetail = ref(false);
const selected = ref<any>(null);

const filters = reactive<{ status: string | null; type: string | null }>({
  status: null,
  type: null,
});

const statusOptions = [
  { label: 'In attesa', value: 'OPEN' },
  { label: 'In revisione', value: 'IN_REVIEW' },
  { label: 'In lavorazione', value: 'IN_PROGRESS' },
  { label: 'Risolto', value: 'RESOLVED' },
  { label: 'Chiuso', value: 'CLOSED' },
  { label: 'Rifiutato', value: 'REJECTED' },
];

const typeOptions = [
  { label: 'Bug', value: 'BUG' },
  { label: 'Feature', value: 'FEATURE_REQUEST' },
  { label: 'Miglioramento', value: 'IMPROVEMENT' },
  { label: 'Supporto', value: 'SUPPORT' },
];

const load = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    const res = await api.get('/tickets', { params });
    tickets.value = (res as any).data || [];
  } finally {
    loading.value = false;
  }
};

const viewDetail = (ticket: any) => {
  selected.value = ticket;
  showDetail.value = true;
};

const typeLabel = (t: string) =>
  ({ BUG: 'Bug', FEATURE_REQUEST: 'Feature', IMPROVEMENT: 'Miglioramento', SUPPORT: 'Supporto' } as any)[t] || t;

const typeSeverity = (t: string) =>
  ({ BUG: 'danger', FEATURE_REQUEST: 'info', IMPROVEMENT: 'success', SUPPORT: 'warning' } as any)[t] || 'info';

const statusLabel = (s: string) =>
  ({
    OPEN: 'In attesa',
    IN_REVIEW: 'In revisione',
    IN_PROGRESS: 'In lavorazione',
    RESOLVED: 'Risolto',
    CLOSED: 'Chiuso',
    REJECTED: 'Rifiutato',
  } as any)[s] || s;

const statusSeverity = (s: string) =>
  ({
    OPEN: 'info',
    IN_REVIEW: 'warning',
    IN_PROGRESS: 'warning',
    RESOLVED: 'success',
    CLOSED: 'success',
    REJECTED: 'danger',
  } as any)[s] || 'info';

const prioritySeverity = (p: string) =>
  ({ LOW: 'info', NORMAL: 'success', HIGH: 'danger' } as any)[p] || 'info';

const formatDate = (d: string) => new Date(d).toLocaleString('it-IT');

onMounted(load);
watch(filters, load, { deep: true });
</script>

<style scoped>
.my-feedback-page {
  padding: 24px;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.filter-input {
  min-width: 180px;
}

.detail-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.detail-section {
  margin-top: 12px;
}

.detail-section p {
  white-space: pre-wrap;
  color: #374151;
  margin-top: 6px;
}

.admin-notes {
  background: #f0f9ff;
  border-left: 4px solid #0ea5e9;
  padding: 12px;
  border-radius: 6px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}
</style>
