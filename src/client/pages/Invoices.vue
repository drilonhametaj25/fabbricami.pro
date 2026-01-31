<template>
  <div class="invoices-page">
    <PageHeader
      title="Fatture"
      subtitle="Gestione fatture attive e passive con stato SDI"
      icon="pi pi-file"
    />

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon--primary">
          <i class="pi pi-file-export"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalActive }}</span>
          <span class="stat-label">Fatture Attive</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--info">
          <i class="pi pi-file-import"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalPassive }}</span>
          <span class="stat-label">Fatture Passive</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--warning">
          <i class="pi pi-clock"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.pendingSdi }}</span>
          <span class="stat-label">In Attesa SDI</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--danger">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.rejectedSdi }}</span>
          <span class="stat-label">Rifiutate SDI</span>
        </div>
      </div>
    </div>

    <!-- Filters and Actions -->
    <div class="toolbar">
      <div class="filters">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="filters.search" placeholder="Cerca fattura..." @input="loadInvoices" />
        </span>
        <Dropdown
          v-model="filters.type"
          :options="invoiceTypes"
          optionLabel="label"
          optionValue="value"
          placeholder="Tipo"
          showClear
          @change="loadInvoices"
          class="filter-dropdown"
        />
        <Dropdown
          v-model="filters.status"
          :options="invoiceStatuses"
          optionLabel="label"
          optionValue="value"
          placeholder="Stato"
          showClear
          @change="loadInvoices"
          class="filter-dropdown"
        />
        <Dropdown
          v-model="filters.sdiStatus"
          :options="sdiStatuses"
          optionLabel="label"
          optionValue="value"
          placeholder="Stato SDI"
          showClear
          @change="loadInvoices"
          class="filter-dropdown"
        />
        <Calendar
          v-model="filters.dateRange"
          selectionMode="range"
          dateFormat="dd/mm/yy"
          placeholder="Periodo"
          showIcon
          @date-select="loadInvoices"
          class="date-filter"
        />
      </div>
      <div class="actions">
        <Button label="Nuova Fattura" icon="pi pi-plus" @click="showCreateDialog = true" />
      </div>
    </div>

    <!-- Invoices Table -->
    <DataTable
      :value="invoices"
      :loading="loading"
      :paginator="true"
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      dataKey="id"
      class="invoices-table"
      responsiveLayout="scroll"
      :globalFilterFields="['invoiceNumber', 'customerName']"
      sortField="issueDate"
      :sortOrder="-1"
    >
      <template #empty>
        <div class="empty-state">
          <i class="pi pi-file"></i>
          <span>Nessuna fattura trovata</span>
        </div>
      </template>

      <Column field="invoiceNumber" header="Numero" sortable style="min-width: 140px">
        <template #body="{ data }">
          <span class="invoice-number">{{ data.invoiceNumber }}</span>
        </template>
      </Column>

      <Column field="documentType" header="Tipo Doc" sortable style="min-width: 100px">
        <template #body="{ data }">
          <Tag :value="data.documentType" :severity="getDocTypeSeverity(data.documentType)" />
        </template>
      </Column>

      <Column field="issueDate" header="Data" sortable style="min-width: 110px">
        <template #body="{ data }">
          {{ formatDate(data.issueDate) }}
        </template>
      </Column>

      <Column field="type" header="Tipo" sortable style="min-width: 100px">
        <template #body="{ data }">
          <Tag :value="data.type === 'SALE' ? 'Attiva' : 'Passiva'" :severity="data.type === 'SALE' ? 'success' : 'info'" />
        </template>
      </Column>

      <Column header="Cliente/Fornitore" style="min-width: 200px">
        <template #body="{ data }">
          <div class="entity-info">
            <span class="entity-name">{{ data.customer?.businessName || data.customer?.firstName + ' ' + data.customer?.lastName || '-' }}</span>
            <span class="entity-vat" v-if="data.customer?.vatNumber">P.IVA: {{ data.customer.vatNumber }}</span>
          </div>
        </template>
      </Column>

      <Column field="total" header="Totale" sortable style="min-width: 120px">
        <template #body="{ data }">
          <span class="amount">{{ formatCurrency(data.total) }}</span>
        </template>
      </Column>

      <Column field="status" header="Stato" sortable style="min-width: 120px">
        <template #body="{ data }">
          <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column field="sdiStatus" header="Stato SDI" sortable style="min-width: 150px">
        <template #body="{ data }">
          <div class="sdi-status">
            <Tag :value="getSdiStatusLabel(data.sdiStatus)" :severity="getSdiStatusSeverity(data.sdiStatus)" />
            <i
              v-if="data.sdiErrorMessage"
              class="pi pi-info-circle sdi-error-icon"
              v-tooltip.top="data.sdiErrorMessage"
            />
          </div>
        </template>
      </Column>

      <Column header="Azioni" style="min-width: 180px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-eye" text rounded v-tooltip.top="'Visualizza'" @click="viewInvoice(data)" />
            <Button icon="pi pi-file-pdf" text rounded v-tooltip.top="'Scarica PDF'" @click="downloadPdf(data)" />
            <Button
              v-if="data.sdiStatus === 'NOT_SENT'"
              icon="pi pi-send"
              text
              rounded
              v-tooltip.top="'Invia a SDI'"
              @click="sendToSdi(data)"
              :loading="sendingSdi === data.id"
            />
            <Button
              v-if="data.sdiStatus === 'REJECTED'"
              icon="pi pi-refresh"
              text
              rounded
              severity="warning"
              v-tooltip.top="'Reinvia a SDI'"
              @click="sendToSdi(data)"
              :loading="sendingSdi === data.id"
            />
            <Button icon="pi pi-file-export" text rounded v-tooltip.top="'Scarica XML'" @click="downloadXml(data)" v-if="data.xmlFilePath" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Invoice Detail Dialog -->
    <Dialog v-model:visible="showDetailDialog" :header="'Fattura ' + selectedInvoice?.invoiceNumber" modal :style="{ width: '900px' }">
      <div class="invoice-detail" v-if="selectedInvoice">
        <!-- Header Info -->
        <div class="detail-grid">
          <div class="detail-section">
            <h4>Dati Documento</h4>
            <div class="detail-row">
              <span class="detail-label">Numero:</span>
              <span class="detail-value">{{ selectedInvoice.invoiceNumber }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data Emissione:</span>
              <span class="detail-value">{{ formatDate(selectedInvoice.issueDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data Scadenza:</span>
              <span class="detail-value">{{ formatDate(selectedInvoice.dueDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tipo Documento:</span>
              <span class="detail-value">{{ selectedInvoice.documentType }}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4>Stato SDI</h4>
            <div class="sdi-detail-status">
              <Tag :value="getSdiStatusLabel(selectedInvoice.sdiStatus)" :severity="getSdiStatusSeverity(selectedInvoice.sdiStatus)" class="large-tag" />
            </div>
            <div class="detail-row" v-if="selectedInvoice.sdiId">
              <span class="detail-label">ID SDI:</span>
              <span class="detail-value monospace">{{ selectedInvoice.sdiId }}</span>
            </div>
            <div class="detail-row" v-if="selectedInvoice.sdiSentAt">
              <span class="detail-label">Inviata:</span>
              <span class="detail-value">{{ formatDateTime(selectedInvoice.sdiSentAt) }}</span>
            </div>
            <div class="detail-row" v-if="selectedInvoice.sdiReceivedAt">
              <span class="detail-label">Ricevuta:</span>
              <span class="detail-value">{{ formatDateTime(selectedInvoice.sdiReceivedAt) }}</span>
            </div>
            <div class="sdi-error" v-if="selectedInvoice.sdiErrorMessage">
              <i class="pi pi-exclamation-triangle"></i>
              <div>
                <strong>Errore SDI ({{ selectedInvoice.sdiErrorCode }})</strong>
                <p>{{ selectedInvoice.sdiErrorMessage }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="detail-section" v-if="selectedInvoice.customer">
          <h4>{{ selectedInvoice.type === 'SALE' ? 'Cliente' : 'Fornitore' }}</h4>
          <div class="detail-row">
            <span class="detail-label">Ragione Sociale:</span>
            <span class="detail-value">{{ selectedInvoice.customer.businessName || `${selectedInvoice.customer.firstName} ${selectedInvoice.customer.lastName}` }}</span>
          </div>
          <div class="detail-row" v-if="selectedInvoice.customer.vatNumber">
            <span class="detail-label">P.IVA:</span>
            <span class="detail-value">{{ selectedInvoice.customer.vatNumber }}</span>
          </div>
          <div class="detail-row" v-if="selectedInvoice.customer.fiscalCode">
            <span class="detail-label">Codice Fiscale:</span>
            <span class="detail-value">{{ selectedInvoice.customer.fiscalCode }}</span>
          </div>
        </div>

        <!-- Totals -->
        <div class="detail-section">
          <h4>Importi</h4>
          <div class="totals-grid">
            <div class="total-row">
              <span>Imponibile</span>
              <span>{{ formatCurrency(selectedInvoice.subtotal) }}</span>
            </div>
            <div class="total-row">
              <span>IVA</span>
              <span>{{ formatCurrency(selectedInvoice.tax) }}</span>
            </div>
            <div class="total-row total-row--final">
              <span>Totale</span>
              <span>{{ formatCurrency(selectedInvoice.total) }}</span>
            </div>
            <div class="total-row" v-if="Number(selectedInvoice.paidAmount) > 0">
              <span>Pagato</span>
              <span class="text-success">{{ formatCurrency(selectedInvoice.paidAmount) }}</span>
            </div>
            <div class="total-row" v-if="Number(selectedInvoice.total) - Number(selectedInvoice.paidAmount) > 0">
              <span>Da Pagare</span>
              <span class="text-danger">{{ formatCurrency(Number(selectedInvoice.total) - Number(selectedInvoice.paidAmount)) }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" text @click="showDetailDialog = false" />
        <Button label="Scarica PDF" icon="pi pi-file-pdf" @click="downloadPdf(selectedInvoice)" />
        <Button
          v-if="selectedInvoice?.sdiStatus === 'NOT_SENT'"
          label="Invia a SDI"
          icon="pi pi-send"
          severity="success"
          @click="sendToSdi(selectedInvoice)"
        />
      </template>
    </Dialog>

    <!-- Create Invoice Dialog -->
    <Dialog v-model:visible="showCreateDialog" header="Nuova Fattura" modal :style="{ width: '600px' }">
      <div class="create-form">
        <div class="form-field">
          <label>Tipo Fattura</label>
          <Dropdown
            v-model="newInvoice.type"
            :options="[{ label: 'Attiva (Vendita)', value: 'SALE' }, { label: 'Passiva (Acquisto)', value: 'PURCHASE' }]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>Tipo Documento</label>
          <Dropdown
            v-model="newInvoice.documentType"
            :options="documentTypes"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label>{{ newInvoice.type === 'SALE' ? 'Cliente' : 'Fornitore' }}</label>
          <Dropdown
            v-model="newInvoice.customerId"
            :options="customers"
            optionLabel="displayName"
            optionValue="id"
            filter
            filterPlaceholder="Cerca..."
            class="w-full"
            placeholder="Seleziona..."
          />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Data Emissione</label>
            <Calendar v-model="newInvoice.issueDate" dateFormat="dd/mm/yy" showIcon class="w-full" />
          </div>
          <div class="form-field">
            <label>Data Scadenza</label>
            <Calendar v-model="newInvoice.dueDate" dateFormat="dd/mm/yy" showIcon class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label>Note</label>
          <Textarea v-model="newInvoice.notes" rows="2" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" text @click="showCreateDialog = false" />
        <Button label="Crea Fattura" icon="pi pi-check" @click="createInvoice" :loading="creating" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import apiService from '../services/api.service';

const toast = useToast();

// State
const loading = ref(false);
const creating = ref(false);
const sendingSdi = ref<string | null>(null);
const invoices = ref<any[]>([]);
const customers = ref<any[]>([]);
const selectedInvoice = ref<any>(null);
const showDetailDialog = ref(false);
const showCreateDialog = ref(false);

// Stats
const stats = ref({
  totalActive: 0,
  totalPassive: 0,
  pendingSdi: 0,
  rejectedSdi: 0,
});

// Filters
const filters = ref({
  search: '',
  type: null as string | null,
  status: null as string | null,
  sdiStatus: null as string | null,
  dateRange: null as Date[] | null,
});

// New invoice form
const newInvoice = ref({
  type: 'SALE',
  documentType: 'TD01',
  customerId: null as string | null,
  issueDate: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  notes: '',
});

// Options
const invoiceTypes = [
  { label: 'Attive (Vendita)', value: 'SALE' },
  { label: 'Passive (Acquisto)', value: 'PURCHASE' },
];

const invoiceStatuses = [
  { label: 'Bozza', value: 'DRAFT' },
  { label: 'Emessa', value: 'ISSUED' },
  { label: 'Pagata', value: 'PAID' },
  { label: 'Parz. Pagata', value: 'PARTIALLY_PAID' },
  { label: 'Scaduta', value: 'OVERDUE' },
  { label: 'Annullata', value: 'CANCELLED' },
];

const sdiStatuses = [
  { label: 'Non Inviata', value: 'NOT_SENT' },
  { label: 'In Attesa', value: 'PENDING' },
  { label: 'Consegnata', value: 'DELIVERED' },
  { label: 'Accettata', value: 'ACCEPTED' },
  { label: 'Rifiutata', value: 'REJECTED' },
  { label: 'Non Consegnabile', value: 'NOT_DELIVERABLE' },
];

const documentTypes = [
  { label: 'TD01 - Fattura', value: 'TD01' },
  { label: 'TD02 - Acconto Fattura', value: 'TD02' },
  { label: 'TD04 - Nota di Credito', value: 'TD04' },
  { label: 'TD05 - Nota di Debito', value: 'TD05' },
  { label: 'TD24 - Fattura Differita', value: 'TD24' },
  { label: 'TD25 - Fattura Accompagnatoria', value: 'TD25' },
];

// Methods
const loadInvoices = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filters.value.search) params.search = filters.value.search;
    if (filters.value.type) params.type = filters.value.type;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.sdiStatus) params.sdiStatus = filters.value.sdiStatus;
    if (filters.value.dateRange?.[0]) params.dateFrom = filters.value.dateRange[0].toISOString();
    if (filters.value.dateRange?.[1]) params.dateTo = filters.value.dateRange[1].toISOString();

    const response = await apiService.get('/accounting/invoices', params);
    invoices.value = response.data.items || response.data || [];

    // Calculate stats
    stats.value.totalActive = invoices.value.filter((i: any) => i.type === 'SALE').length;
    stats.value.totalPassive = invoices.value.filter((i: any) => i.type === 'PURCHASE').length;
    stats.value.pendingSdi = invoices.value.filter((i: any) => i.sdiStatus === 'PENDING').length;
    stats.value.rejectedSdi = invoices.value.filter((i: any) => i.sdiStatus === 'REJECTED').length;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare le fatture', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const loadCustomers = async () => {
  try {
    const response = await apiService.get('/customers', { params: { limit: 1000 } });
    customers.value = (response.data.items || response.data || []).map((c: any) => ({
      ...c,
      displayName: c.businessName || `${c.firstName} ${c.lastName}`,
    }));
  } catch (error) {
    console.error('Error loading customers:', error);
  }
};

const viewInvoice = (invoice: any) => {
  selectedInvoice.value = invoice;
  showDetailDialog.value = true;
};

const createInvoice = async () => {
  creating.value = true;
  try {
    await apiService.post('/accounting/invoices', {
      ...newInvoice.value,
      issueDate: newInvoice.value.issueDate.toISOString(),
      dueDate: newInvoice.value.dueDate.toISOString(),
    });
    toast.add({ severity: 'success', summary: 'Creata', detail: 'Fattura creata con successo', life: 3000 });
    showCreateDialog.value = false;
    loadInvoices();
    resetNewInvoice();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile creare la fattura', life: 3000 });
  } finally {
    creating.value = false;
  }
};

const resetNewInvoice = () => {
  newInvoice.value = {
    type: 'SALE',
    documentType: 'TD01',
    customerId: null,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    notes: '',
  };
};

const sendToSdi = async (invoice: any) => {
  sendingSdi.value = invoice.id;
  try {
    await apiService.post(`/sdi/invoices/${invoice.id}/send`);
    toast.add({ severity: 'success', summary: 'Inviata', detail: 'Fattura inviata a SDI', life: 3000 });
    loadInvoices();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore SDI', detail: error.message || 'Impossibile inviare la fattura', life: 5000 });
  } finally {
    sendingSdi.value = null;
  }
};

const downloadPdf = async (invoice: any) => {
  try {
    const response = await apiService.get(`/accounting/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(response as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${invoice.invoiceNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile scaricare il PDF', life: 3000 });
  }
};

const downloadXml = async (invoice: any) => {
  try {
    const response = await apiService.get(`/sdi/invoices/${invoice.id}/xml`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(response as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${invoice.invoiceNumber}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile scaricare l\'XML', life: 3000 });
  }
};

// Formatters
const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num || 0);
};

const formatDate = (date: string | Date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const formatDateTime = (date: string | Date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('it-IT');
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    ISSUED: 'Emessa',
    PAID: 'Pagata',
    PARTIALLY_PAID: 'Parz. Pagata',
    OVERDUE: 'Scaduta',
    CANCELLED: 'Annullata',
  };
  return map[status] || status;
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    ISSUED: 'info',
    PAID: 'success',
    PARTIALLY_PAID: 'warning',
    OVERDUE: 'danger',
    CANCELLED: 'secondary',
  };
  return map[status] || 'info';
};

const getSdiStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    NOT_SENT: 'Non Inviata',
    PENDING: 'In Attesa',
    DELIVERED: 'Consegnata',
    ACCEPTED: 'Accettata',
    REJECTED: 'Rifiutata',
    NOT_DELIVERABLE: 'Non Consegn.',
  };
  return map[status] || status;
};

const getSdiStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    NOT_SENT: 'secondary',
    PENDING: 'warning',
    DELIVERED: 'info',
    ACCEPTED: 'success',
    REJECTED: 'danger',
    NOT_DELIVERABLE: 'danger',
  };
  return map[status] || 'info';
};

const getDocTypeSeverity = (type: string) => {
  if (type === 'TD04') return 'danger'; // Nota di credito
  if (type === 'TD05') return 'warning'; // Nota di debito
  return 'info';
};

onMounted(() => {
  loadInvoices();
  loadCustomers();
});
</script>

<style scoped>
.invoices-page {
  max-width: 1600px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.stat-icon--primary {
  background: var(--color-primary-100);
  color: var(--color-primary-600);
}

.stat-icon--info {
  background: var(--color-blue-100);
  color: var(--color-blue-600);
}

.stat-icon--warning {
  background: var(--color-yellow-100);
  color: var(--color-yellow-600);
}

.stat-icon--danger {
  background: var(--color-red-100);
  color: var(--color-red-600);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 140px;
}

.date-filter {
  width: 220px;
}

.invoices-table {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.invoice-number {
  font-weight: 600;
  font-family: monospace;
  color: var(--color-primary-600);
}

.entity-info {
  display: flex;
  flex-direction: column;
}

.entity-name {
  font-weight: 500;
}

.entity-vat {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.amount {
  font-weight: 600;
  font-family: monospace;
}

.sdi-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sdi-error-icon {
  color: var(--color-red-500);
  cursor: help;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-gray-400);
}

.empty-state i {
  font-size: 2rem;
}

/* Detail Dialog */
.invoice-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

.detail-section {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
}

.detail-section h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-color-light);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

.detail-value {
  font-weight: 500;
  color: var(--color-gray-900);
}

.detail-value.monospace {
  font-family: monospace;
}

.sdi-detail-status {
  margin-bottom: var(--space-3);
}

.large-tag {
  font-size: var(--font-size-base);
  padding: var(--space-2) var(--space-3);
}

.sdi-error {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-red-50);
  border: 1px solid var(--color-red-200);
  border-radius: var(--border-radius-md);
}

.sdi-error i {
  color: var(--color-red-500);
  font-size: 1.25rem;
}

.sdi-error strong {
  display: block;
  color: var(--color-red-700);
  margin-bottom: var(--space-1);
}

.sdi-error p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-red-600);
}

.totals-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
}

.total-row--final {
  border-top: 2px solid var(--border-color);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
  font-weight: 700;
  font-size: var(--font-size-lg);
}

.text-success {
  color: var(--color-green-600);
}

.text-danger {
  color: var(--color-red-600);
}

/* Create Form */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
