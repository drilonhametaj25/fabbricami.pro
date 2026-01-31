<template>
  <Dialog
    v-model:visible="visible"
    header="Verifica Ordini Articolo"
    :modal="true"
    :closable="true"
    :style="{ width: '900px' }"
    @show="search"
  >
    <!-- Search Section -->
    <div class="search-section">
      <div class="search-row">
        <div class="search-field">
          <label>Cerca Prodotto o Materiale</label>
          <AutoComplete
            v-model="searchQuery"
            :suggestions="searchSuggestions"
            @complete="onSearchComplete"
            @item-select="onItemSelect"
            optionLabel="label"
            placeholder="Digita SKU o nome..."
            :loading="searching"
            class="search-input"
          >
            <template #option="{ option }">
              <div class="search-option">
                <span class="option-type" :class="option.type.toLowerCase()">{{ option.type === 'PRODUCT' ? 'P' : 'M' }}</span>
                <span class="option-sku">{{ option.sku }}</span>
                <span class="option-name">{{ option.name }}</span>
              </div>
            </template>
          </AutoComplete>
        </div>
        <div class="search-filters">
          <div class="filter-item">
            <label>Ultimi giorni</label>
            <Dropdown
              v-model="daysBack"
              :options="daysOptions"
              optionLabel="label"
              optionValue="value"
              class="days-dropdown"
            />
          </div>
          <div class="filter-item">
            <Checkbox v-model="includeReceived" :binary="true" inputId="includeReceived" />
            <label for="includeReceived">Includi completati</label>
          </div>
        </div>
      </div>
    </div>

    <!-- Item Info -->
    <div class="item-header" v-if="result?.item">
      <div class="item-info">
        <Tag :severity="result.item.type === 'PRODUCT' ? 'info' : 'warning'" class="type-badge">
          {{ result.item.type === 'PRODUCT' ? 'Prodotto' : 'Materiale' }}
        </Tag>
        <span class="item-sku">{{ result.item.sku }}</span>
        <span class="item-name">{{ result.item.name }}</span>
      </div>
      <div class="item-stock" v-if="result.item.currentStock !== undefined">
        <span class="stock-label">Giacenza:</span>
        <span class="stock-value">{{ result.item.currentStock }}</span>
      </div>
    </div>

    <!-- Summary Alert -->
    <div class="summary-section" v-if="result?.summary">
      <Message v-if="result.summary.hasOpenOrders" severity="warn" :closable="false">
        <template #default>
          <div class="summary-content">
            <i class="pi pi-exclamation-triangle"></i>
            <div class="summary-text">
              <strong>Attenzione:</strong> Ci sono {{ result.summary.openOrders }} ordini aperti per questo articolo.
              <span v-if="result.summary.totalPendingOpen > 0">
                In attesa di ricevere {{ result.summary.totalPendingOpen }} unita.
              </span>
            </div>
          </div>
        </template>
      </Message>
      <Message v-else-if="result.summary.totalOrders > 0" severity="success" :closable="false">
        <template #default>
          <div class="summary-content">
            <i class="pi pi-check-circle"></i>
            <span>Nessun ordine aperto. Ultimo ordine completato nel periodo selezionato.</span>
          </div>
        </template>
      </Message>
      <Message v-else severity="info" :closable="false">
        <template #default>
          <div class="summary-content">
            <i class="pi pi-info-circle"></i>
            <span>Nessun ordine trovato per questo articolo negli ultimi {{ daysBack }} giorni.</span>
          </div>
        </template>
      </Message>

      <!-- Consolidation Suggestion -->
      <div class="consolidate-section" v-if="result.summary.canConsolidateWith?.length > 0">
        <div class="consolidate-header">
          <i class="pi pi-link"></i>
          <span>Puoi consolidare con questi ordini in bozza:</span>
        </div>
        <div class="consolidate-list">
          <div
            v-for="order in result.summary.canConsolidateWith"
            :key="order.orderId"
            class="consolidate-item"
            @click="goToOrder(order.orderId)"
          >
            <span class="order-number">{{ order.orderNumber }}</span>
            <span class="supplier-name">{{ order.supplierName }}</span>
            <i class="pi pi-external-link"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Orders Table -->
    <DataTable
      v-if="result?.history?.length"
      :value="result.history"
      :loading="loading"
      responsiveLayout="scroll"
      class="orders-table"
      :rowHover="true"
      :rowClass="getRowClass"
    >
      <Column field="orderNumber" header="Ordine" style="min-width: 120px">
        <template #body="{ data }">
          <a class="order-link" @click="goToOrder(data.orderId)">
            {{ data.orderNumber }}
          </a>
        </template>
      </Column>

      <Column field="status" header="Stato" style="min-width: 130px">
        <template #body="{ data }">
          <Tag :severity="getStatusSeverity(data.status)" class="status-tag">
            {{ getStatusLabel(data.status) }}
          </Tag>
        </template>
      </Column>

      <Column field="supplier" header="Fornitore" style="min-width: 150px">
        <template #body="{ data }">
          <span class="supplier-text">{{ data.supplier.name }}</span>
        </template>
      </Column>

      <Column header="Quantita" style="min-width: 140px">
        <template #body="{ data }">
          <div class="qty-info">
            <span class="qty-ordered">{{ data.item.orderedQty }} ordinati</span>
            <span class="qty-received" v-if="data.item.receivedQty > 0">
              {{ data.item.receivedQty }} ricevuti
            </span>
            <span class="qty-pending" v-if="data.item.pendingQty > 0">
              {{ data.item.pendingQty }} in arrivo
            </span>
          </div>
        </template>
      </Column>

      <Column field="createdAt" header="Data" style="min-width: 100px">
        <template #body="{ data }">
          <span class="date-text">{{ formatDate(data.createdAt) }}</span>
        </template>
      </Column>

      <Column header="Azione" style="min-width: 120px">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              v-if="data.canConsolidate"
              label="Aggiungi"
              icon="pi pi-plus"
              size="small"
              severity="success"
              @click="goToOrder(data.orderId)"
            />
            <Button
              v-else-if="data.isOpen"
              label="Contatta"
              icon="pi pi-envelope"
              size="small"
              severity="secondary"
              @click="contactSupplier(data)"
            />
            <Button
              v-else
              label="Dettagli"
              icon="pi pi-eye"
              size="small"
              text
              @click="goToOrder(data.orderId)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && selectedItem">
      <i class="pi pi-inbox"></i>
      <p>Nessun ordine trovato per questo articolo</p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Chiudi"
          icon="pi pi-times"
          class="p-button-text"
          @click="close"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import AutoComplete from 'primevue/autocomplete';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import api from '../services/api.service';

interface ItemOrderHistory {
  item: {
    id: string;
    name: string;
    sku: string;
    type: 'PRODUCT' | 'MATERIAL';
    price?: number;
    currentStock?: number;
    minStock?: number;
  };
  history: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    isOpen: boolean;
    createdAt: string;
    expectedDeliveryDate?: string;
    supplier: {
      id: string;
      name: string;
      code: string;
      email?: string;
    };
    item: {
      orderedQty: number;
      receivedQty: number;
      pendingQty: number;
      unitPrice: number;
    };
    canConsolidate: boolean;
    consolidateMessage?: string;
  }>;
  summary: {
    totalOrders: number;
    openOrders: number;
    totalOrderedInPeriod: number;
    totalReceivedInPeriod: number;
    totalPendingOpen: number;
    hasOpenOrders: boolean;
    canConsolidateWith: Array<{
      orderId: string;
      orderNumber: string;
      supplierName: string;
    }>;
  };
}

interface SearchItem {
  id: string;
  type: 'PRODUCT' | 'MATERIAL';
  name: string;
  sku: string;
  label: string;
}

interface Props {
  modelValue: boolean;
  productId?: string;
  materialId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const toast = useToast();
const router = useRouter();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);
const searching = ref(false);
const result = ref<ItemOrderHistory | null>(null);
const searchQuery = ref<string | SearchItem>('');
const searchSuggestions = ref<SearchItem[]>([]);
const selectedItem = ref<SearchItem | null>(null);
const daysBack = ref(180);
const includeReceived = ref(true);

const daysOptions = [
  { label: '30 giorni', value: 30 },
  { label: '90 giorni', value: 90 },
  { label: '180 giorni', value: 180 },
  { label: '1 anno', value: 365 },
];

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getStatusSeverity = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'secondary';
    case 'SENT': return 'info';
    case 'CONFIRMED': return 'primary';
    case 'PARTIALLY_RECEIVED': return 'warning';
    case 'RECEIVED': return 'success';
    case 'CANCELLED': return 'danger';
    default: return 'secondary';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'Bozza';
    case 'SENT': return 'Inviato';
    case 'CONFIRMED': return 'Confermato';
    case 'PARTIALLY_RECEIVED': return 'Parz. Ricevuto';
    case 'RECEIVED': return 'Completato';
    case 'CANCELLED': return 'Annullato';
    default: return status;
  }
};

const getRowClass = (data: any) => {
  if (data.isOpen) return 'row-open';
  return '';
};

const onSearchComplete = async (event: { query: string }) => {
  if (event.query.length < 2) {
    searchSuggestions.value = [];
    return;
  }

  try {
    searching.value = true;

    // Cerca prodotti
    const productsRes = await api.get(`/products?search=${encodeURIComponent(event.query)}&limit=5`);
    const products = (productsRes.data?.items || []).map((p: any) => ({
      id: p.id,
      type: 'PRODUCT' as const,
      name: p.name,
      sku: p.sku,
      label: `${p.sku} - ${p.name}`,
    }));

    // Cerca materiali
    const materialsRes = await api.get(`/materials?search=${encodeURIComponent(event.query)}&limit=5`);
    const materials = (materialsRes.data?.items || materialsRes.data || []).map((m: any) => ({
      id: m.id,
      type: 'MATERIAL' as const,
      name: m.name,
      sku: m.sku,
      label: `${m.sku} - ${m.name}`,
    }));

    searchSuggestions.value = [...products, ...materials];
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    searching.value = false;
  }
};

const onItemSelect = (event: { value: SearchItem }) => {
  selectedItem.value = event.value;
  search();
};

const search = async () => {
  // Se abbiamo props, usa quelli
  let productId = props.productId;
  let materialId = props.materialId;

  // Altrimenti usa la selezione
  if (!productId && !materialId && selectedItem.value) {
    if (selectedItem.value.type === 'PRODUCT') {
      productId = selectedItem.value.id;
    } else {
      materialId = selectedItem.value.id;
    }
  }

  if (!productId && !materialId) {
    result.value = null;
    return;
  }

  try {
    loading.value = true;

    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    if (materialId) params.append('materialId', materialId);
    params.append('daysBack', daysBack.value.toString());
    params.append('includeReceived', includeReceived.value.toString());

    const response = await api.get(`/purchase-orders/item-history?${params.toString()}`);
    result.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella ricerca',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

const goToOrder = (orderId: string) => {
  close();
  router.push({ name: 'purchase-orders', query: { id: orderId } });
};

const contactSupplier = (data: any) => {
  if (data.supplier.email) {
    window.open(`mailto:${data.supplier.email}?subject=Ordine ${data.orderNumber} - Aggiunta articoli`);
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Email non disponibile',
      detail: 'Il fornitore non ha un\'email configurata',
      life: 3000,
    });
  }
};

const close = () => {
  visible.value = false;
};

// Watch for filter changes
watch([daysBack, includeReceived], () => {
  if (selectedItem.value || props.productId || props.materialId) {
    search();
  }
});

// Watch for prop changes
watch([() => props.productId, () => props.materialId], () => {
  if (visible.value) {
    search();
  }
});
</script>

<style scoped>
.search-section {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-color-light);
}

.search-row {
  display: flex;
  gap: var(--space-4);
  align-items: flex-end;
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  min-width: 300px;
}

.search-field label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
  margin-bottom: var(--space-1);
}

.search-input {
  width: 100%;
}

.search-filters {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-item label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.days-dropdown {
  width: 120px;
}

.search-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.option-type {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
}

.option-type.product {
  background: var(--color-info);
}

.option-type.material {
  background: var(--color-warning);
}

.option-sku {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.option-name {
  color: var(--color-gray-800);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
  margin-bottom: var(--space-4);
}

.item-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.type-badge {
  font-size: var(--font-size-xs);
}

.item-sku {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-primary-700);
}

.item-name {
  color: var(--color-gray-800);
  font-weight: 500;
}

.item-stock {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stock-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.stock-value {
  font-weight: 600;
  color: var(--color-gray-800);
}

.summary-section {
  margin-bottom: var(--space-4);
}

.summary-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.summary-text {
  line-height: 1.4;
}

.consolidate-section {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-success-50);
  border: 1px solid var(--color-success-200);
  border-radius: var(--border-radius);
}

.consolidate-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-success-800);
  margin-bottom: var(--space-2);
}

.consolidate-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.consolidate-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: white;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.consolidate-item:hover {
  background: var(--color-success-100);
}

.consolidate-item .order-number {
  font-weight: 600;
  color: var(--color-gray-800);
}

.consolidate-item .supplier-name {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.consolidate-item .pi-external-link {
  font-size: 0.75rem;
  color: var(--color-gray-400);
}

.orders-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.orders-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
}

.orders-table :deep(.row-open) {
  background: var(--color-warning-50);
}

.order-link {
  color: var(--color-primary-600);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.order-link:hover {
  text-decoration: underline;
}

.supplier-text {
  color: var(--color-gray-700);
}

.qty-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qty-ordered {
  font-weight: 500;
  color: var(--color-gray-800);
}

.qty-received {
  font-size: var(--font-size-xs);
  color: var(--color-success);
}

.qty-pending {
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  font-weight: 500;
}

.date-text {
  color: var(--color-gray-600);
  font-size: var(--font-size-xs);
}

.action-buttons {
  display: flex;
  gap: var(--space-2);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-gray-500);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: var(--space-3);
}

.empty-state p {
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
