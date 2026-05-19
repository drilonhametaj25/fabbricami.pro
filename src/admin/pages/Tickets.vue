<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { adminApi } from '../services/api';

const toast = useToast();
const tickets = ref<any[]>([]);
const loading = ref(false);
const showDetail = ref(false);
const selected = ref<any>(null);
const saving = ref(false);

const filters = reactive<{ status: string | null; type: string | null; priority: string | null }>({
  status: null,
  type: null,
  priority: null,
});

const editForm = reactive({ status: '', adminNotes: '' });

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

const priorityOptions = [
  { label: 'Bassa', value: 'LOW' },
  { label: 'Normale', value: 'NORMAL' },
  { label: 'Alta', value: 'HIGH' },
];

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

async function load() {
  loading.value = true;
  const params: any = {};
  if (filters.status) params.status = filters.status;
  if (filters.type) params.type = filters.type;
  if (filters.priority) params.priority = filters.priority;
  const res = await adminApi.getTickets(params);
  if (res.success && res.data) {
    tickets.value = res.data.items;
  } else if (res.error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: res.error, life: 5000 });
  }
  loading.value = false;
}

function openDetail(ticket: any) {
  selected.value = ticket;
  editForm.status = ticket.status;
  editForm.adminNotes = ticket.adminNotes || '';
  showDetail.value = true;
}

async function save() {
  if (!selected.value) return;
  saving.value = true;
  const res = await adminApi.updateTicket(selected.value.id, {
    status: editForm.status,
    adminNotes: editForm.adminNotes,
  });
  if (res.success) {
    toast.add({ severity: 'success', summary: 'Aggiornato', detail: 'Email di notifica inviata al cliente', life: 4000 });
    showDetail.value = false;
    await load();
  } else {
    toast.add({ severity: 'error', summary: 'Errore', detail: res.error, life: 5000 });
  }
  saving.value = false;
}

onMounted(load);
watch(filters, load, { deep: true });
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Segnalazioni</h1>
      <p>Bug report, feature request e ticket di supporto inviati dai tenant</p>
    </div>

    <div class="filters">
      <Dropdown
        v-model="filters.status"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Stato"
        showClear
        style="min-width: 180px"
      />
      <Dropdown
        v-model="filters.type"
        :options="typeOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Tipo"
        showClear
        style="min-width: 180px"
      />
      <Dropdown
        v-model="filters.priority"
        :options="priorityOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Priorità"
        showClear
        style="min-width: 180px"
      />
      <Button label="Aggiorna" icon="pi pi-refresh" class="p-button-text" @click="load" />
    </div>

    <DataTable :value="tickets" :loading="loading" :paginator="true" :rows="20" stripedRows responsiveLayout="scroll">
      <Column field="createdAt" header="Data">
        <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
      </Column>
      <Column header="Tipo">
        <template #body="{ data }">
          <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
        </template>
      </Column>
      <Column field="title" header="Titolo" />
      <Column header="Priorità">
        <template #body="{ data }">
          <Tag :value="data.priority" :severity="prioritySeverity(data.priority)" />
        </template>
      </Column>
      <Column header="Stato">
        <template #body="{ data }">
          <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column header="Tenant ID">
        <template #body="{ data }">
          <span class="mono">{{ data.tenantId?.slice(0, 8) }}</span>
        </template>
      </Column>
      <Column header="Azioni">
        <template #body="{ data }">
          <Button icon="pi pi-pencil" class="p-button-text p-button-sm" @click="openDetail(data)" />
        </template>
      </Column>
      <template #empty>
        <div style="padding: 40px; text-align: center; color: #94a3b8;">Nessuna segnalazione trovata.</div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="showDetail"
      :header="selected?.title || 'Segnalazione'"
      :modal="true"
      :style="{ width: '640px' }"
      :draggable="false"
    >
      <div v-if="selected" class="detail">
        <div class="detail-meta">
          <Tag :value="typeLabel(selected.type)" :severity="typeSeverity(selected.type)" />
          <Tag :value="selected.priority" :severity="prioritySeverity(selected.priority)" />
          <span class="meta-date">Creato: {{ formatDate(selected.createdAt) }}</span>
        </div>

        <div class="detail-section">
          <strong>Descrizione</strong>
          <p>{{ selected.description }}</p>
        </div>

        <div class="detail-section">
          <strong>Tenant ID</strong>
          <p class="mono">{{ selected.tenantId }}</p>
        </div>

        <div class="form-section">
          <div class="field">
            <label>Stato</label>
            <Dropdown
              v-model="editForm.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div class="field">
            <label>Note del team (visibili al cliente)</label>
            <Textarea v-model="editForm.adminNotes" rows="4" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Chiudi" class="p-button-text" @click="showDetail = false" />
        <Button label="Salva e notifica" icon="pi pi-save" :loading="saving" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page { padding: 24px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0; }
.page-header p { color: #94a3b8; margin: 4px 0 0 0; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.mono { font-family: monospace; font-size: 12px; }
.detail-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
.meta-date { font-size: 12px; color: #94a3b8; margin-left: auto; }
.detail-section { margin-bottom: 16px; }
.detail-section p { white-space: pre-wrap; margin: 6px 0 0 0; }
.form-section { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; }
.form-section .field { margin-bottom: 16px; }
.form-section label { display: block; font-weight: 500; font-size: 13px; margin-bottom: 6px; }
</style>
