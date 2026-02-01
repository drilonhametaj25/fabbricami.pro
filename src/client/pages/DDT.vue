<template>
  <div class="ddt-page">
    <PageHeader
      title="Documenti di Trasporto"
      subtitle="Gestione DDT per spedizioni e consegne"
      icon="pi pi-truck"
    />

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon--primary">
          <i class="pi pi-file"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">DDT Totali</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--warning">
          <i class="pi pi-clock"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">In Preparazione</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--info">
          <i class="pi pi-send"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.shipped }}</span>
          <span class="stat-label">Spediti</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--success">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.delivered }}</span>
          <span class="stat-label">Consegnati</span>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="filters">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="filters.search" placeholder="Cerca DDT..." @input="debouncedLoad" />
        </span>
        <Dropdown
          v-model="filters.status"
          :options="ddtStatuses"
          optionLabel="label"
          optionValue="value"
          placeholder="Stato"
          showClear
          @change="loadDDTs"
          class="filter-dropdown"
        />
        <Calendar
          v-model="filters.dateRange"
          selectionMode="range"
          dateFormat="dd/mm/yy"
          placeholder="Periodo"
          showIcon
          @date-select="loadDDTs"
          class="date-filter"
        />
      </div>
      <div class="actions">
        <Button label="Nuovo DDT" icon="pi pi-plus" @click="showCreateDialog = true" />
        <Button label="Da Ordine" icon="pi pi-shopping-cart" severity="secondary" @click="showFromOrderDialog = true" />
      </div>
    </div>

    <!-- DDT Table -->
    <DataTable
      :value="ddts"
      :loading="loading"
      :paginator="true"
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      dataKey="id"
      class="ddt-table"
      responsiveLayout="scroll"
      sortField="ddtDate"
      :sortOrder="-1"
    >
      <template #empty>
        <div class="empty-state">
          <i class="pi pi-truck"></i>
          <span>Nessun DDT trovato</span>
        </div>
      </template>

      <Column field="ddtNumber" header="Numero DDT" sortable style="min-width: 140px">
        <template #body="{ data }">
          <span class="ddt-number">{{ data.ddtNumber }}</span>
        </template>
      </Column>

      <Column field="ddtDate" header="Data" sortable style="min-width: 110px">
        <template #body="{ data }">
          {{ formatDate(data.ddtDate) }}
        </template>
      </Column>

      <Column header="Destinatario" style="min-width: 200px">
        <template #body="{ data }">
          <div class="recipient-info">
            <span class="recipient-name">{{ data.recipientName }}</span>
            <span class="recipient-address" v-if="data.shippingAddress">
              {{ data.shippingAddress.city }}, {{ data.shippingAddress.province }}
            </span>
          </div>
        </template>
      </Column>

      <Column header="Ordine Rif." style="min-width: 130px">
        <template #body="{ data }">
          <router-link v-if="data.orderId" :to="`/orders?id=${data.orderId}`" class="order-link">
            {{ data.orderNumber || 'Vedi ordine' }}
          </router-link>
          <span v-else class="text-muted">-</span>
        </template>
      </Column>

      <Column field="itemsCount" header="Articoli" sortable style="min-width: 100px">
        <template #body="{ data }">
          <span class="items-count">{{ data.items?.length || 0 }} articoli</span>
        </template>
      </Column>

      <Column field="carrier" header="Vettore" style="min-width: 140px">
        <template #body="{ data }">
          {{ data.carrier || '-' }}
        </template>
      </Column>

      <Column field="status" header="Stato" sortable style="min-width: 130px">
        <template #body="{ data }">
          <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column header="Azioni" style="min-width: 150px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-eye" text rounded v-tooltip.top="'Dettagli'" @click="viewDDT(data)" />
            <Button icon="pi pi-file-pdf" text rounded v-tooltip.top="'Scarica PDF'" @click="downloadPdf(data)" />
            <Button icon="pi pi-pencil" text rounded v-tooltip.top="'Modifica'" @click="editDDT(data)" v-if="data.status === 'DRAFT'" />
            <SplitButton
              v-if="data.status !== 'DELIVERED'"
              :model="getStatusActions(data)"
              icon="pi pi-ellipsis-v"
              text
              rounded
              class="status-menu"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- View DDT Dialog -->
    <Dialog v-model:visible="showDetailDialog" :header="'DDT ' + selectedDDT?.ddtNumber" modal :style="{ width: '900px' }">
      <div class="ddt-detail" v-if="selectedDDT">
        <div class="detail-header">
          <div class="detail-section">
            <h4>Dati Documento</h4>
            <div class="detail-row">
              <span class="detail-label">Numero DDT:</span>
              <span class="detail-value">{{ selectedDDT.ddtNumber }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data:</span>
              <span class="detail-value">{{ formatDate(selectedDDT.ddtDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stato:</span>
              <Tag :value="getStatusLabel(selectedDDT.status)" :severity="getStatusSeverity(selectedDDT.status)" />
            </div>
            <div class="detail-row" v-if="selectedDDT.orderNumber">
              <span class="detail-label">Ordine:</span>
              <span class="detail-value">{{ selectedDDT.orderNumber }}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4>Destinatario</h4>
            <div class="detail-row">
              <span class="detail-label">Nome:</span>
              <span class="detail-value">{{ selectedDDT.recipientName }}</span>
            </div>
            <div class="detail-row" v-if="selectedDDT.shippingAddress">
              <span class="detail-label">Indirizzo:</span>
              <span class="detail-value">
                {{ selectedDDT.shippingAddress.street }}<br />
                {{ selectedDDT.shippingAddress.zip }} {{ selectedDDT.shippingAddress.city }} ({{ selectedDDT.shippingAddress.province }})
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Trasporto</h4>
          <div class="transport-grid">
            <div class="detail-row">
              <span class="detail-label">Vettore:</span>
              <span class="detail-value">{{ selectedDDT.carrier || 'Mittente' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Causale Trasporto:</span>
              <span class="detail-value">{{ selectedDDT.transportReason || 'Vendita' }}</span>
            </div>
            <div class="detail-row" v-if="selectedDDT.packagesCount">
              <span class="detail-label">Colli:</span>
              <span class="detail-value">{{ selectedDDT.packagesCount }}</span>
            </div>
            <div class="detail-row" v-if="selectedDDT.weight">
              <span class="detail-label">Peso:</span>
              <span class="detail-value">{{ selectedDDT.weight }} kg</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Articoli ({{ selectedDDT.items?.length || 0 }})</h4>
          <DataTable :value="selectedDDT.items" class="items-table" responsiveLayout="scroll">
            <Column field="sku" header="SKU" style="width: 120px" />
            <Column field="productName" header="Descrizione" />
            <Column field="quantity" header="Quantità" style="width: 100px">
              <template #body="{ data }">
                {{ data.quantity }} {{ data.unit || 'pz' }}
              </template>
            </Column>
            <Column field="lotNumber" header="Lotto" style="width: 120px">
              <template #body="{ data }">
                {{ data.lotNumber || '-' }}
              </template>
            </Column>
          </DataTable>
        </div>

        <div class="detail-section" v-if="selectedDDT.notes">
          <h4>Note</h4>
          <p class="notes-text">{{ selectedDDT.notes }}</p>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" text @click="showDetailDialog = false" />
        <Button label="Scarica PDF" icon="pi pi-file-pdf" @click="downloadPdf(selectedDDT)" />
      </template>
    </Dialog>

    <!-- Create DDT Dialog -->
    <Dialog v-model:visible="showCreateDialog" header="Nuovo DDT" modal :style="{ width: '800px' }">
      <div class="create-form">
        <div class="form-section">
          <h4>Destinatario</h4>
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label>Cliente *</label>
              <Dropdown
                v-model="newDDT.customerId"
                :options="customers"
                optionLabel="displayName"
                optionValue="id"
                filter
                filterPlaceholder="Cerca cliente..."
                class="w-full"
                placeholder="Seleziona cliente"
                @change="onCustomerChange"
              />
            </div>
            <div class="form-field form-field--full">
              <label>Nome Destinatario *</label>
              <InputText v-model="newDDT.recipientName" class="w-full" />
            </div>
            <div class="form-field form-field--full">
              <label>Indirizzo *</label>
              <InputText v-model="newDDT.shippingAddress.street" class="w-full" />
            </div>
            <div class="form-field">
              <label>Città *</label>
              <InputText v-model="newDDT.shippingAddress.city" class="w-full" />
            </div>
            <div class="form-field">
              <label>Provincia *</label>
              <InputText v-model="newDDT.shippingAddress.province" class="w-full" maxlength="2" />
            </div>
            <div class="form-field">
              <label>CAP *</label>
              <InputText v-model="newDDT.shippingAddress.zip" class="w-full" maxlength="5" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Trasporto</h4>
          <div class="form-grid">
            <div class="form-field">
              <label>Data DDT *</label>
              <Calendar v-model="newDDT.ddtDate" dateFormat="dd/mm/yy" showIcon class="w-full" />
            </div>
            <div class="form-field">
              <label>Causale Trasporto</label>
              <Dropdown
                v-model="newDDT.transportReason"
                :options="transportReasons"
                class="w-full"
              />
            </div>
            <div class="form-field">
              <label>Vettore</label>
              <InputText v-model="newDDT.carrier" class="w-full" placeholder="Lasciare vuoto per mittente" />
            </div>
            <div class="form-field">
              <label>Numero Colli</label>
              <InputNumber v-model="newDDT.packagesCount" class="w-full" :min="1" />
            </div>
            <div class="form-field">
              <label>Peso (kg)</label>
              <InputNumber v-model="newDDT.weight" class="w-full" :minFractionDigits="2" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Articoli</h4>
          <div class="items-editor">
            <DataTable :value="newDDT.items" editMode="cell" class="editable-table">
              <Column field="productId" header="Prodotto" style="width: 40%">
                <template #body="{ data }">
                  {{ data.productName || 'Seleziona prodotto' }}
                </template>
                <template #editor="{ data }">
                  <Dropdown
                    v-model="data.productId"
                    :options="products"
                    optionLabel="name"
                    optionValue="id"
                    filter
                    class="w-full"
                    @change="(e) => onProductSelect(data, e.value)"
                  />
                </template>
              </Column>
              <Column field="sku" header="SKU" style="width: 15%">
                <template #body="{ data }">{{ data.sku }}</template>
              </Column>
              <Column field="quantity" header="Quantità" style="width: 15%">
                <template #editor="{ data }">
                  <InputNumber v-model="data.quantity" class="w-full" :min="1" />
                </template>
              </Column>
              <Column field="lotNumber" header="Lotto" style="width: 20%">
                <template #editor="{ data }">
                  <InputText v-model="data.lotNumber" class="w-full" />
                </template>
              </Column>
              <Column style="width: 10%">
                <template #body="{ index }">
                  <Button icon="pi pi-trash" text rounded severity="danger" @click="removeItem(index)" />
                </template>
              </Column>
            </DataTable>
            <Button label="Aggiungi Articolo" icon="pi pi-plus" text @click="addItem" class="add-item-btn" />
          </div>
        </div>

        <div class="form-field">
          <label>Note</label>
          <Textarea v-model="newDDT.notes" rows="2" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" text @click="showCreateDialog = false" />
        <Button label="Crea DDT" icon="pi pi-check" @click="createDDT" :loading="creating" />
      </template>
    </Dialog>

    <!-- Create from Order Dialog -->
    <Dialog v-model:visible="showFromOrderDialog" header="Crea DDT da Ordine" modal :style="{ width: '600px' }">
      <div class="from-order-form">
        <div class="form-field">
          <label>Seleziona Ordine *</label>
          <Dropdown
            v-model="selectedOrderId"
            :options="pendingOrders"
            optionLabel="displayLabel"
            optionValue="id"
            filter
            filterPlaceholder="Cerca ordine..."
            class="w-full"
            placeholder="Seleziona un ordine da spedire"
          />
        </div>
        <div class="order-preview" v-if="selectedOrderPreview">
          <h4>Anteprima Ordine</h4>
          <div class="preview-row">
            <span>Cliente:</span>
            <strong>{{ selectedOrderPreview.customerName }}</strong>
          </div>
          <div class="preview-row">
            <span>Articoli:</span>
            <strong>{{ selectedOrderPreview.itemsCount }} prodotti</strong>
          </div>
          <div class="preview-row">
            <span>Totale:</span>
            <strong>{{ formatCurrency(selectedOrderPreview.total) }}</strong>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" text @click="showFromOrderDialog = false" />
        <Button label="Crea DDT" icon="pi pi-check" @click="createFromOrder" :loading="creating" :disabled="!selectedOrderId" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import SplitButton from 'primevue/splitbutton';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
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
const ddts = ref<any[]>([]);
const customers = ref<any[]>([]);
const products = ref<any[]>([]);
const pendingOrders = ref<any[]>([]);
const selectedDDT = ref<any>(null);
const selectedOrderId = ref<string | null>(null);
const showDetailDialog = ref(false);
const showCreateDialog = ref(false);
const showFromOrderDialog = ref(false);

// Stats
const stats = ref({
  total: 0,
  pending: 0,
  shipped: 0,
  delivered: 0,
});

// Filters
const filters = ref({
  search: '',
  status: null as string | null,
  dateRange: null as Date[] | null,
});

// New DDT form
const newDDT = ref({
  customerId: null as string | null,
  recipientName: '',
  shippingAddress: {
    street: '',
    city: '',
    province: '',
    zip: '',
    country: 'IT',
  },
  ddtDate: new Date(),
  transportReason: 'Vendita',
  carrier: '',
  packagesCount: 1,
  weight: null as number | null,
  items: [] as any[],
  notes: '',
});

// Options
const ddtStatuses = [
  { label: 'Bozza', value: 'DRAFT' },
  { label: 'In Preparazione', value: 'PREPARING' },
  { label: 'Spedito', value: 'SHIPPED' },
  { label: 'Consegnato', value: 'DELIVERED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

const transportReasons = [
  'Vendita',
  'Conto Visione',
  'Conto Lavorazione',
  'Reso',
  'Riparazione',
  'Omaggio',
  'Altro',
];

// Computed
const selectedOrderPreview = computed(() => {
  if (!selectedOrderId.value) return null;
  return pendingOrders.value.find(o => o.id === selectedOrderId.value);
});

// Debounce helper
let searchTimeout: any;
const debouncedLoad = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadDDTs(), 300);
};

// Methods
const loadDDTs = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filters.value.search) params.search = filters.value.search;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.dateRange?.[0]) params.dateFrom = filters.value.dateRange[0].toISOString();
    if (filters.value.dateRange?.[1]) params.dateTo = filters.value.dateRange[1].toISOString();

    const response = await apiService.get('/ddt', params);
    ddts.value = response.data.items || response.data || [];

    // Calculate stats
    stats.value.total = ddts.value.length;
    stats.value.pending = ddts.value.filter((d: any) => ['DRAFT', 'PREPARING'].includes(d.status)).length;
    stats.value.shipped = ddts.value.filter((d: any) => d.status === 'SHIPPED').length;
    stats.value.delivered = ddts.value.filter((d: any) => d.status === 'DELIVERED').length;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i DDT', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const loadCustomers = async () => {
  try {
    const response = await apiService.get('/customers', { params: { limit: 500 } });
    customers.value = (response.data.items || response.data || []).map((c: any) => ({
      ...c,
      displayName: c.businessName || `${c.firstName} ${c.lastName}`,
    }));
  } catch (error) {
    console.error('Error loading customers:', error);
  }
};

const loadProducts = async () => {
  try {
    const response = await apiService.get('/products', { params: { limit: 500, isActive: true } });
    products.value = response.data.items || response.data || [];
  } catch (error) {
    console.error('Error loading products:', error);
  }
};

const loadPendingOrders = async () => {
  try {
    const response = await apiService.get('/orders', { params: { status: 'CONFIRMED,PROCESSING', limit: 100 } });
    pendingOrders.value = (response.data.items || response.data || []).map((o: any) => ({
      ...o,
      displayLabel: `${o.orderNumber} - ${o.customer?.businessName || o.customer?.firstName} (${formatCurrency(o.total)})`,
      customerName: o.customer?.businessName || `${o.customer?.firstName} ${o.customer?.lastName}`,
      itemsCount: o.items?.length || 0,
    }));
  } catch (error) {
    console.error('Error loading orders:', error);
  }
};

const viewDDT = (ddt: any) => {
  selectedDDT.value = ddt;
  showDetailDialog.value = true;
};

const editDDT = (ddt: any) => {
  // Populate form with DDT data
  Object.assign(newDDT.value, ddt);
  showCreateDialog.value = true;
};

const createDDT = async () => {
  if (!newDDT.value.recipientName || newDDT.value.items.length === 0) {
    toast.add({ severity: 'warn', summary: 'Attenzione', detail: 'Compila tutti i campi obbligatori', life: 3000 });
    return;
  }

  creating.value = true;
  try {
    await apiService.post('/ddt', {
      ...newDDT.value,
      ddtDate: newDDT.value.ddtDate.toISOString(),
    });
    toast.add({ severity: 'success', summary: 'Creato', detail: 'DDT creato con successo', life: 3000 });
    showCreateDialog.value = false;
    loadDDTs();
    resetNewDDT();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile creare il DDT', life: 3000 });
  } finally {
    creating.value = false;
  }
};

const createFromOrder = async () => {
  if (!selectedOrderId.value) return;

  creating.value = true;
  try {
    await apiService.post(`/ddt/from-order/${selectedOrderId.value}`);
    toast.add({ severity: 'success', summary: 'Creato', detail: 'DDT creato da ordine', life: 3000 });
    showFromOrderDialog.value = false;
    selectedOrderId.value = null;
    loadDDTs();
    loadPendingOrders();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile creare il DDT', life: 3000 });
  } finally {
    creating.value = false;
  }
};

const resetNewDDT = () => {
  newDDT.value = {
    customerId: null,
    recipientName: '',
    shippingAddress: { street: '', city: '', province: '', zip: '', country: 'IT' },
    ddtDate: new Date(),
    transportReason: 'Vendita',
    carrier: '',
    packagesCount: 1,
    weight: null,
    items: [],
    notes: '',
  };
};

const onCustomerChange = (event: any) => {
  const customer = customers.value.find(c => c.id === event.value);
  if (customer) {
    newDDT.value.recipientName = customer.displayName;
    if (customer.shippingAddress) {
      Object.assign(newDDT.value.shippingAddress, customer.shippingAddress);
    }
  }
};

const onProductSelect = (item: any, productId: string) => {
  const product = products.value.find(p => p.id === productId);
  if (product) {
    item.sku = product.sku;
    item.productName = product.name;
    item.unit = product.unit || 'pz';
  }
};

const addItem = () => {
  newDDT.value.items.push({
    productId: null,
    sku: '',
    productName: '',
    quantity: 1,
    unit: 'pz',
    lotNumber: '',
  });
};

const removeItem = (index: number) => {
  newDDT.value.items.splice(index, 1);
};

const updateStatus = async (ddt: any, newStatus: string) => {
  try {
    await apiService.patch(`/ddt/${ddt.id}/status`, { status: newStatus });
    toast.add({ severity: 'success', summary: 'Aggiornato', detail: 'Stato DDT aggiornato', life: 3000 });
    loadDDTs();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile aggiornare lo stato', life: 3000 });
  }
};

const downloadPdf = async (ddt: any) => {
  try {
    const response = await apiService.get(`/ddt/${ddt.id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(response as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DDT-${ddt.ddtNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile scaricare il PDF', life: 3000 });
  }
};

const getStatusActions = (ddt: any) => {
  const actions = [];
  if (ddt.status === 'DRAFT') {
    actions.push({ label: 'Prepara', icon: 'pi pi-box', command: () => updateStatus(ddt, 'PREPARING') });
  }
  if (ddt.status === 'PREPARING') {
    actions.push({ label: 'Spedisci', icon: 'pi pi-send', command: () => updateStatus(ddt, 'SHIPPED') });
  }
  if (ddt.status === 'SHIPPED') {
    actions.push({ label: 'Consegnato', icon: 'pi pi-check', command: () => updateStatus(ddt, 'DELIVERED') });
  }
  if (ddt.status !== 'CANCELLED' && ddt.status !== 'DELIVERED') {
    actions.push({ label: 'Annulla', icon: 'pi pi-times', command: () => updateStatus(ddt, 'CANCELLED') });
  }
  return actions;
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

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    PREPARING: 'In Preparazione',
    SHIPPED: 'Spedito',
    DELIVERED: 'Consegnato',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    PREPARING: 'warning',
    SHIPPED: 'info',
    DELIVERED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

onMounted(() => {
  loadDDTs();
  loadCustomers();
  loadProducts();
  loadPendingOrders();
});
</script>

<style scoped>
.ddt-page {
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

.stat-icon--primary { background: var(--color-primary-100); color: var(--color-primary-600); }
.stat-icon--info { background: var(--color-blue-100); color: var(--color-blue-600); }
.stat-icon--warning { background: var(--color-yellow-100); color: var(--color-yellow-600); }
.stat-icon--success { background: var(--color-green-100); color: var(--color-green-600); }

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

.actions {
  display: flex;
  gap: var(--space-2);
}

.ddt-table {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.ddt-number {
  font-weight: 600;
  font-family: monospace;
  color: var(--color-primary-600);
}

.recipient-info {
  display: flex;
  flex-direction: column;
}

.recipient-name {
  font-weight: 500;
}

.recipient-address {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.order-link {
  color: var(--color-primary-600);
  text-decoration: none;
}

.order-link:hover {
  text-decoration: underline;
}

.text-muted {
  color: var(--color-gray-400);
}

.items-count {
  color: var(--color-gray-600);
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
.ddt-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.detail-header {
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
  text-align: right;
}

.transport-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.items-table {
  font-size: var(--font-size-sm);
}

.notes-text {
  margin: 0;
  color: var(--color-gray-700);
  white-space: pre-wrap;
}

/* Create Form */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-section {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
}

.form-section h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-800);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.items-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.add-item-btn {
  align-self: flex-start;
}

/* From Order Dialog */
.from-order-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.order-preview {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
}

.order-preview h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
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

  .actions {
    justify-content: stretch;
  }

  .actions > * {
    flex: 1;
  }

  .detail-header {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .transport-grid {
    grid-template-columns: 1fr;
  }
}
</style>
