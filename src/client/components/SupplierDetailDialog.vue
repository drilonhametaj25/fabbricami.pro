<template>
  <Dialog
    v-model:visible="visible"
    :header="`Dettaglio Fornitore: ${supplier?.businessName || ''}`"
    :modal="true"
    :style="{ width: '900px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <div class="supplier-detail" v-if="supplier">
      <!-- Header con info base -->
      <div class="detail-header">
        <div class="supplier-avatar">
          <i class="pi pi-building"></i>
        </div>
        <div class="supplier-info">
          <h3 class="supplier-name">{{ supplier.businessName }}</h3>
          <p class="supplier-code">{{ supplier.code }}</p>
          <Tag :severity="supplier.isActive ? 'success' : 'danger'">
            {{ supplier.isActive ? 'Attivo' : 'Inattivo' }}
          </Tag>
        </div>
        <div class="supplier-quick-stats" v-if="performance">
          <div class="quick-stat">
            <span class="quick-stat-value" :class="getPerformanceClass(performance.currentMetrics?.onTimeDeliveryRate)">
              {{ formatPercent(performance.currentMetrics?.onTimeDeliveryRate) }}
            </span>
            <span class="quick-stat-label">Puntualita</span>
          </div>
          <div class="quick-stat">
            <span class="quick-stat-value" :class="getPerformanceClass(performance.currentMetrics?.qualityRating)">
              {{ formatPercent(performance.currentMetrics?.qualityRating) }}
            </span>
            <span class="quick-stat-label">Qualita</span>
          </div>
        </div>
      </div>

      <!-- Tabs per sezioni -->
      <TabView v-model:activeIndex="activeTab">
        <!-- Tab Informazioni -->
        <TabPanel header="Informazioni">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Codice</span>
              <span class="info-value code">{{ supplier.code }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <a v-if="supplier.email" :href="`mailto:${supplier.email}`" class="info-value link">{{ supplier.email }}</a>
              <span v-else class="info-value">-</span>
            </div>
            <div class="info-item">
              <span class="info-label">Telefono</span>
              <span class="info-value">{{ supplier.phone || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Partita IVA</span>
              <span class="info-value">{{ supplier.taxId || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Sito Web</span>
              <a v-if="supplier.website" :href="formatWebsite(supplier.website)" target="_blank" class="info-value link">
                {{ supplier.website }}
              </a>
              <span v-else class="info-value">-</span>
            </div>
            <div class="info-item">
              <span class="info-label">Condizioni Pagamento</span>
              <span class="info-value">{{ supplier.paymentTerms ? `${supplier.paymentTerms} giorni` : '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Lead Time Default</span>
              <span class="info-value">{{ supplier.defaultLeadTimeDays ? `${supplier.defaultLeadTimeDays} giorni` : '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">IBAN</span>
              <span class="info-value code">{{ supplier.iban || '-' }}</span>
            </div>
          </div>

          <Divider />

          <div class="address-section">
            <h4 class="section-title"><i class="pi pi-map-marker"></i> Indirizzo</h4>
            <div class="address-box" v-if="parsedAddress">
              <p v-if="parsedAddress.street">{{ parsedAddress.street }}</p>
              <p v-if="parsedAddress.city || parsedAddress.zip">
                {{ parsedAddress.zip }} {{ parsedAddress.city }}
                <span v-if="parsedAddress.province">({{ parsedAddress.province }})</span>
              </p>
              <p v-if="parsedAddress.country">{{ getCountryName(parsedAddress.country) }}</p>
              <p v-if="!parsedAddress.street && !parsedAddress.city && !parsedAddress.zip" class="text-muted">Indirizzo non specificato</p>
            </div>
            <div class="address-box" v-else>
              <p class="text-muted">Indirizzo non specificato</p>
            </div>
          </div>

          <Divider v-if="supplier.bankName || supplier.iban || supplier.swift" />

          <div class="bank-section" v-if="supplier.bankName || supplier.iban || supplier.swift">
            <h4 class="section-title"><i class="pi pi-wallet"></i> Dati Bancari</h4>
            <div class="info-grid">
              <div class="info-item" v-if="supplier.bankName">
                <span class="info-label">Banca</span>
                <span class="info-value">{{ supplier.bankName }}</span>
              </div>
              <div class="info-item" v-if="supplier.iban">
                <span class="info-label">IBAN</span>
                <span class="info-value code">{{ supplier.iban }}</span>
              </div>
              <div class="info-item" v-if="supplier.swift">
                <span class="info-label">SWIFT/BIC</span>
                <span class="info-value code">{{ supplier.swift }}</span>
              </div>
            </div>
          </div>

          <div v-if="supplier.notes" class="notes-section">
            <h4 class="section-title"><i class="pi pi-file-edit"></i> Note</h4>
            <p class="notes-text">{{ supplier.notes }}</p>
          </div>
        </TabPanel>

        <!-- Tab Performance -->
        <TabPanel header="Performance">
          <div class="performance-loading" v-if="performanceLoading">
            <i class="pi pi-spin pi-spinner"></i>
            <p>Caricamento metriche...</p>
          </div>
          <div class="performance-section" v-else-if="performance">
            <!-- KPI Cards -->
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-icon delivery"><i class="pi pi-truck"></i></div>
                <div class="kpi-content">
                  <span class="kpi-value" :class="getPerformanceClass(performance.calculatedMetrics?.delivery?.onTimeRate)">
                    {{ formatPercent(performance.calculatedMetrics?.delivery?.onTimeRate) }}
                  </span>
                  <span class="kpi-label">Consegne Puntuali</span>
                  <span class="kpi-detail">
                    {{ performance.calculatedMetrics?.delivery?.onTimeCount || 0 }} /
                    {{ (performance.calculatedMetrics?.delivery?.onTimeCount || 0) + (performance.calculatedMetrics?.delivery?.lateCount || 0) }} ordini
                  </span>
                </div>
              </div>

              <div class="kpi-card">
                <div class="kpi-icon quality"><i class="pi pi-check-circle"></i></div>
                <div class="kpi-content">
                  <span class="kpi-value" :class="getPerformanceClass(100 - (performance.calculatedMetrics?.quality?.rejectionRate || 0))">
                    {{ formatPercent(100 - (performance.calculatedMetrics?.quality?.rejectionRate || 0)) }}
                  </span>
                  <span class="kpi-label">Qualita Accettata</span>
                  <span class="kpi-detail">
                    {{ performance.calculatedMetrics?.quality?.passedInspection || 0 }} approvate
                  </span>
                </div>
              </div>

              <div class="kpi-card">
                <div class="kpi-icon time"><i class="pi pi-clock"></i></div>
                <div class="kpi-content">
                  <span class="kpi-value">
                    {{ performance.calculatedMetrics?.delivery?.avgLeadTimeDays?.toFixed(1) || '-' }}
                  </span>
                  <span class="kpi-label">Lead Time Medio (gg)</span>
                  <span class="kpi-detail">
                    Default: {{ supplier.defaultLeadTimeDays || '-' }} gg
                  </span>
                </div>
              </div>

              <div class="kpi-card">
                <div class="kpi-icon cost"><i class="pi pi-euro"></i></div>
                <div class="kpi-content">
                  <span class="kpi-value">
                    {{ formatCurrency(performance.calculatedMetrics?.cost?.totalSpentLast6Months || 0) }}
                  </span>
                  <span class="kpi-label">Spesa Ultimi 6 Mesi</span>
                  <span class="kpi-detail">
                    {{ performance.calculatedMetrics?.cost?.ordersLast6Months || 0 }} ordini
                  </span>
                </div>
              </div>
            </div>

            <!-- Trend Performance -->
            <div class="trend-section" v-if="performance.trend && performance.trend.length > 0">
              <h4 class="section-title"><i class="pi pi-chart-line"></i> Trend Puntualita (6 mesi)</h4>
              <div class="trend-chart">
                <div class="trend-bar" v-for="month in performance.trend" :key="month.month">
                  <div
                    class="trend-fill"
                    :style="{ height: `${month.onTimeRate}%` }"
                    :class="getPerformanceClass(month.onTimeRate)"
                  ></div>
                  <span class="trend-label">{{ formatMonth(month.month) }}</span>
                  <span class="trend-value">{{ month.onTimeRate?.toFixed(0) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Tab Catalogo -->
        <TabPanel header="Catalogo">
          <div class="catalog-loading" v-if="catalogLoading">
            <i class="pi pi-spin pi-spinner"></i>
            <p>Caricamento catalogo...</p>
          </div>
          <div class="catalog-section" v-else>
            <div class="catalog-header">
              <h4 class="section-title"><i class="pi pi-list"></i> Articoli del Fornitore</h4>
              <Button
                icon="pi pi-plus"
                label="Aggiungi Articolo"
                size="small"
                @click="showAddItemDialog = true"
                v-if="canEdit"
              />
            </div>

            <DataTable
              :value="catalog"
              class="catalog-table"
              :paginator="catalog.length > 10"
              :rows="10"
              responsiveLayout="scroll"
            >
              <Column header="Articolo" style="min-width: 200px">
                <template #body="{ data }">
                  <div class="item-info">
                    <span class="item-name">{{ data.product?.name || data.material?.name || '-' }}</span>
                    <span class="item-sku">{{ data.supplierSku || data.product?.sku || data.material?.code }}</span>
                  </div>
                </template>
              </Column>
              <Column field="lastPurchasePrice" header="Ultimo Prezzo" style="min-width: 120px">
                <template #body="{ data }">
                  <span class="price-value">{{ formatCurrency(data.lastPurchasePrice) }}</span>
                </template>
              </Column>
              <Column field="avgPurchasePrice" header="Prezzo Medio" style="min-width: 120px">
                <template #body="{ data }">
                  <span class="price-avg">{{ data.avgPurchasePrice ? formatCurrency(data.avgPurchasePrice) : '-' }}</span>
                </template>
              </Column>
              <Column field="leadTimeDays" header="Lead Time" style="min-width: 100px">
                <template #body="{ data }">
                  <span>{{ data.leadTimeDays ? `${data.leadTimeDays} gg` : '-' }}</span>
                </template>
              </Column>
              <Column field="isPreferred" header="Preferito" style="min-width: 80px">
                <template #body="{ data }">
                  <Tag v-if="data.isPreferred" severity="success">Si</Tag>
                  <span v-else class="text-muted">-</span>
                </template>
              </Column>
              <Column header="Sconti Volume" style="min-width: 150px">
                <template #body="{ data }">
                  <div class="discounts-list" v-if="data.volumeDiscounts?.length > 0">
                    <span
                      class="discount-badge"
                      v-for="d in data.volumeDiscounts.slice(0, 2)"
                      :key="d.id"
                      v-tooltip.top="`Da ${d.minQuantity} pz: ${d.discountPercent ? d.discountPercent + '%' : formatCurrency(d.fixedPrice)}`"
                    >
                      {{ d.minQuantity }}+ {{ d.discountPercent ? `-${d.discountPercent}%` : formatCurrency(d.fixedPrice) }}
                    </span>
                    <span v-if="data.volumeDiscounts.length > 2" class="more-discounts">
                      +{{ data.volumeDiscounts.length - 2 }}
                    </span>
                  </div>
                  <span v-else class="text-muted">-</span>
                </template>
              </Column>
              <template #empty>
                <div class="empty-catalog">
                  <i class="pi pi-box"></i>
                  <p>Nessun articolo nel catalogo</p>
                </div>
              </template>
            </DataTable>
          </div>
        </TabPanel>

        <!-- Tab Storico Prezzi -->
        <TabPanel header="Storico Prezzi">
          <div class="price-history-section">
            <div class="price-history-filters">
              <Dropdown
                v-model="selectedProductForHistory"
                :options="catalogProducts"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona prodotto/materiale"
                class="history-dropdown"
                showClear
                @change="loadPriceHistory"
              />
            </div>

            <div class="price-history-loading" v-if="priceHistoryLoading">
              <i class="pi pi-spin pi-spinner"></i>
              <p>Caricamento storico...</p>
            </div>

            <div class="price-history-content" v-else-if="priceHistory">
              <!-- Summary -->
              <div class="history-summary">
                <div class="summary-item">
                  <span class="summary-label">Prezzo Attuale</span>
                  <span class="summary-value">{{ formatCurrency(priceHistory.currentPrice) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Prezzo Medio</span>
                  <span class="summary-value">{{ formatCurrency(priceHistory.avgPrice) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Minimo</span>
                  <span class="summary-value success">{{ formatCurrency(priceHistory.minPrice) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Massimo</span>
                  <span class="summary-value danger">{{ formatCurrency(priceHistory.maxPrice) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Trend</span>
                  <Tag
                    :severity="getTrendSeverity(priceHistory.trend)"
                    :icon="getTrendIcon(priceHistory.trend)"
                  >
                    {{ getTrendLabel(priceHistory.trend) }}
                  </Tag>
                </div>
              </div>

              <!-- Price History Table -->
              <DataTable
                :value="priceHistory.priceHistory"
                class="history-table"
                :paginator="priceHistory.priceHistory?.length > 10"
                :rows="10"
              >
                <Column field="date" header="Data" sortable>
                  <template #body="{ data }">
                    {{ formatDate(data.date) }}
                  </template>
                </Column>
                <Column field="price" header="Prezzo">
                  <template #body="{ data }">
                    <span class="price-value">{{ formatCurrency(data.price) }}</span>
                  </template>
                </Column>
                <Column field="quantity" header="Quantita">
                  <template #body="{ data }">
                    {{ data.quantity }}
                  </template>
                </Column>
                <Column field="orderNumber" header="Ordine">
                  <template #body="{ data }">
                    <span class="order-ref">{{ data.orderNumber }}</span>
                  </template>
                </Column>
                <template #empty>
                  <div class="empty-history">
                    <i class="pi pi-history"></i>
                    <p>Nessuno storico prezzi disponibile</p>
                  </div>
                </template>
              </DataTable>
            </div>

            <div class="empty-history" v-else>
              <i class="pi pi-history"></i>
              <p>Seleziona un articolo per visualizzare lo storico prezzi</p>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Chiudi" icon="pi pi-times" class="p-button-text" @click="visible = false" />
        <Button
          v-if="canEdit"
          label="Modifica"
          icon="pi pi-pencil"
          @click="$emit('edit', supplier)"
        />
      </div>
    </template>
  </Dialog>

  <!-- Dialog Aggiungi Articolo -->
  <Dialog
    v-model:visible="showAddItemDialog"
    header="Aggiungi Articolo al Catalogo"
    :modal="true"
    :style="{ width: '500px' }"
  >
    <div class="add-item-form">
      <div class="form-field">
        <label>Tipo Articolo</label>
        <SelectButton
          v-model="newItem.type"
          :options="itemTypes"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="form-field" v-if="newItem.type === 'product'">
        <label>Prodotto</label>
        <Dropdown
          v-model="newItem.productId"
          :options="availableProducts"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona prodotto"
          filter
          class="w-full"
        />
      </div>

      <div class="form-field" v-if="newItem.type === 'material'">
        <label>Materiale</label>
        <Dropdown
          v-model="newItem.materialId"
          :options="availableMaterials"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona materiale"
          filter
          class="w-full"
        />
      </div>

      <div class="form-field">
        <label>SKU Fornitore</label>
        <InputText v-model="newItem.supplierSku" class="w-full" />
      </div>

      <div class="form-field">
        <label>Prezzo *</label>
        <InputNumber
          v-model="newItem.lastPurchasePrice"
          mode="currency"
          currency="EUR"
          locale="it-IT"
          class="w-full"
        />
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Lead Time (giorni)</label>
          <InputNumber v-model="newItem.leadTimeDays" class="w-full" />
        </div>
        <div class="form-field">
          <label>Min. Ordine</label>
          <InputNumber v-model="newItem.minOrderQuantity" class="w-full" />
        </div>
      </div>

      <div class="form-field">
        <div class="checkbox-wrapper">
          <Checkbox v-model="newItem.isPreferred" :binary="true" inputId="isPreferred" />
          <label for="isPreferred">Fornitore Preferito</label>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Annulla" class="p-button-text" @click="showAddItemDialog = false" />
      <Button label="Aggiungi" icon="pi pi-plus" @click="addCatalogItem" :loading="savingItem" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Divider from 'primevue/divider';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import SelectButton from 'primevue/selectbutton';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
  supplier?: any;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', supplier: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  supplier: null
});

const emit = defineEmits<Emits>();
const toast = useToast();
const authStore = useAuthStore();

const visible = ref(props.modelValue);
const activeTab = ref(0);
const performance = ref<any>(null);
const performanceLoading = ref(false);
const catalog = ref<any[]>([]);
const catalogLoading = ref(false);
const priceHistory = ref<any>(null);
const priceHistoryLoading = ref(false);
const selectedProductForHistory = ref<any>(null);

// Add item dialog
const showAddItemDialog = ref(false);
const savingItem = ref(false);
const newItem = ref({
  type: 'product',
  productId: null as string | null,
  materialId: null as string | null,
  supplierSku: '',
  lastPurchasePrice: null as number | null,
  leadTimeDays: null as number | null,
  minOrderQuantity: null as number | null,
  isPreferred: false,
});
const availableProducts = ref<any[]>([]);
const availableMaterials = ref<any[]>([]);

const itemTypes = [
  { label: 'Prodotto', value: 'product' },
  { label: 'Materiale', value: 'material' },
];

const canEdit = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER'].includes(user.role);
});

// Parse dell'indirizzo JSON
const parsedAddress = computed(() => {
  if (!props.supplier?.address) return null;

  const addr = props.supplier.address;

  // Se è già un oggetto
  if (typeof addr === 'object' && addr !== null) {
    return addr;
  }

  // Se è una stringa, prova a parsarla come JSON
  if (typeof addr === 'string') {
    try {
      return JSON.parse(addr);
    } catch (e) {
      // Se non è JSON, trattala come indirizzo semplice
      return { street: addr, city: '', province: '', zip: '', country: '' };
    }
  }

  return null;
});

// Mappa dei paesi
const countryNames: Record<string, string> = {
  IT: 'Italia',
  DE: 'Germania',
  FR: 'Francia',
  ES: 'Spagna',
  UK: 'Regno Unito',
  US: 'Stati Uniti',
  CN: 'Cina',
};

const getCountryName = (code: string) => {
  return countryNames[code] || code;
};

// Formatta URL website
const formatWebsite = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

const catalogProducts = computed(() => {
  return catalog.value.map(item => ({
    label: item.itemName || item.supplierSku || `${item.type}: ${item.itemId}`,
    value: {
      productId: item.itemId && item.type === 'PRODUCT' ? item.itemId : null,
      materialId: item.itemId && item.type === 'MATERIAL' ? item.itemId : null,
    }
  }));
});

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.supplier) {
    loadPerformance();
    loadCatalog();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

watch(activeTab, (tab) => {
  // Load data on tab change if not already loaded
  if (tab === 1 && !performance.value) {
    loadPerformance();
  } else if (tab === 2 && catalog.value.length === 0) {
    loadCatalog();
  }
});

const onHide = () => {
  activeTab.value = 0;
  performance.value = null;
  catalog.value = [];
  priceHistory.value = null;
  selectedProductForHistory.value = null;
};

const loadPerformance = async () => {
  if (!props.supplier?.id) return;

  performanceLoading.value = true;
  try {
    const response = await api.get(`/suppliers/${props.supplier.id}/performance`);
    if (response.success) {
      performance.value = response.data;
    }
  } catch (error) {
    console.error('Error loading performance:', error);
  } finally {
    performanceLoading.value = false;
  }
};

const loadCatalog = async () => {
  if (!props.supplier?.id) return;

  catalogLoading.value = true;
  try {
    const response = await api.get(`/suppliers/${props.supplier.id}/catalog`);
    if (response.success) {
      catalog.value = response.data || [];
    }
  } catch (error) {
    console.error('Error loading catalog:', error);
  } finally {
    catalogLoading.value = false;
  }
};

const loadPriceHistory = async () => {
  if (!props.supplier?.id || !selectedProductForHistory.value) {
    priceHistory.value = null;
    return;
  }

  priceHistoryLoading.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedProductForHistory.value.productId) {
      params.append('productId', selectedProductForHistory.value.productId);
    }
    if (selectedProductForHistory.value.materialId) {
      params.append('materialId', selectedProductForHistory.value.materialId);
    }

    const response = await api.get(`/suppliers/${props.supplier.id}/price-history?${params.toString()}`);
    if (response.success) {
      priceHistory.value = response.data;
    }
  } catch (error) {
    console.error('Error loading price history:', error);
  } finally {
    priceHistoryLoading.value = false;
  }
};

const loadAvailableItems = async () => {
  try {
    const [productsRes, materialsRes] = await Promise.all([
      api.get('/products?limit=100'),
      api.get('/materials?limit=100'),
    ]);

    availableProducts.value = (productsRes.data?.items || []).map((p: any) => ({
      label: `${p.sku} - ${p.name}`,
      value: p.id,
    }));

    availableMaterials.value = (materialsRes.data?.items || []).map((m: any) => ({
      label: `${m.code} - ${m.name}`,
      value: m.id,
    }));
  } catch (error) {
    console.error('Error loading items:', error);
  }
};

watch(showAddItemDialog, (val) => {
  if (val) {
    loadAvailableItems();
    newItem.value = {
      type: 'product',
      productId: null,
      materialId: null,
      supplierSku: '',
      lastPurchasePrice: null,
      leadTimeDays: null,
      minOrderQuantity: null,
      isPreferred: false,
    };
  }
});

const addCatalogItem = async () => {
  if (!newItem.value.lastPurchasePrice) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci il prezzo',
      life: 3000,
    });
    return;
  }

  savingItem.value = true;
  try {
    const data: any = {
      lastPurchasePrice: newItem.value.lastPurchasePrice,
      supplierSku: newItem.value.supplierSku || undefined,
      leadTimeDays: newItem.value.leadTimeDays || undefined,
      minOrderQuantity: newItem.value.minOrderQuantity || undefined,
      isPreferred: newItem.value.isPreferred,
    };

    if (newItem.value.type === 'product' && newItem.value.productId) {
      data.productId = newItem.value.productId;
    } else if (newItem.value.type === 'material' && newItem.value.materialId) {
      data.materialId = newItem.value.materialId;
    }

    await api.post(`/suppliers/${props.supplier.id}/catalog`, data);

    toast.add({
      severity: 'success',
      summary: 'Aggiunto',
      detail: 'Articolo aggiunto al catalogo',
      life: 3000,
    });

    showAddItemDialog.value = false;
    loadCatalog();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  } finally {
    savingItem.value = false;
  }
};

// Formatters
const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(0)}%`;
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('it-IT', { month: 'short' });
};

const getPerformanceClass = (value: number | null) => {
  if (value === null || value === undefined) return '';
  if (value >= 90) return 'excellent';
  if (value >= 70) return 'good';
  if (value >= 50) return 'warning';
  return 'danger';
};

const getTrendSeverity = (trend: string) => {
  switch (trend) {
    case 'DOWN': return 'success';
    case 'UP': return 'danger';
    default: return 'info';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'DOWN': return 'pi pi-arrow-down';
    case 'UP': return 'pi pi-arrow-up';
    default: return 'pi pi-minus';
  }
};

const getTrendLabel = (trend: string) => {
  switch (trend) {
    case 'DOWN': return 'In diminuzione';
    case 'UP': return 'In aumento';
    default: return 'Stabile';
  }
};
</script>

<style scoped>
.supplier-detail {
  padding: 0.5rem 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 1rem;
}

.supplier-avatar {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-400), var(--primary-600));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  flex-shrink: 0;
}

.supplier-info {
  flex: 1;
}

.supplier-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.supplier-code {
  margin: 0 0 0.5rem 0;
  color: var(--text-color-secondary);
  font-family: monospace;
}

.supplier-quick-stats {
  display: flex;
  gap: 1.5rem;
}

.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.quick-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.quick-stat-value.excellent { color: var(--green-600); }
.quick-stat-value.good { color: var(--blue-600); }
.quick-stat-value.warning { color: var(--orange-600); }
.quick-stat-value.danger { color: var(--red-600); }

.quick-stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
  padding: 1rem 0;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  font-weight: 600;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
}

.info-value.code {
  font-family: monospace;
  background: var(--surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.info-value.link {
  color: var(--primary-600);
  text-decoration: none;
}

.info-value.link:hover {
  text-decoration: underline;
}

/* Sections */
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 1rem;
}

.section-title i {
  color: var(--primary-600);
}

.address-section,
.notes-section {
  margin-top: 1rem;
}

.address-box {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  border-left: 3px solid var(--primary-600);
}

.address-box p {
  margin: 0.25rem 0;
  color: var(--text-color-secondary);
}

.notes-text {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  color: var(--text-color-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Performance */
.performance-loading,
.catalog-loading,
.price-history-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-color-secondary);
}

.performance-loading i,
.catalog-loading i,
.price-history-loading i {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--surface-50);
  border-radius: 12px;
  border: 1px solid var(--surface-border);
}

.kpi-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.kpi-icon.delivery { background: var(--blue-100); color: var(--blue-600); }
.kpi-icon.quality { background: var(--green-100); color: var(--green-600); }
.kpi-icon.time { background: var(--orange-100); color: var(--orange-600); }
.kpi-icon.cost { background: var(--purple-100); color: var(--purple-600); }

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
}

.kpi-value.excellent { color: var(--green-600); }
.kpi-value.good { color: var(--blue-600); }
.kpi-value.warning { color: var(--orange-600); }
.kpi-value.danger { color: var(--red-600); }

.kpi-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.kpi-detail {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

/* Trend Chart */
.trend-section {
  margin-top: 1.5rem;
}

.trend-chart {
  display: flex;
  gap: 0.5rem;
  height: 150px;
  align-items: flex-end;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.trend-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
}

.trend-fill {
  width: 100%;
  max-width: 40px;
  border-radius: 4px 4px 0 0;
  position: absolute;
  bottom: 30px;
  transition: height 0.3s ease;
}

.trend-fill.excellent { background: var(--green-500); }
.trend-fill.good { background: var(--blue-500); }
.trend-fill.warning { background: var(--orange-500); }
.trend-fill.danger { background: var(--red-500); }

.trend-label {
  position: absolute;
  bottom: 0;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.trend-value {
  position: absolute;
  bottom: 35px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Catalog */
.catalog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.catalog-table {
  margin-top: 1rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-weight: 500;
  color: var(--text-color);
}

.item-sku {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-color-secondary);
}

.price-value {
  font-weight: 600;
  color: var(--green-600);
}

.price-avg {
  color: var(--text-color-secondary);
}

.discounts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.discount-badge {
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  background: var(--blue-100);
  color: var(--blue-700);
  border-radius: 4px;
}

.more-discounts {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.text-muted {
  color: var(--text-color-secondary);
  font-style: italic;
}

.bank-section {
  margin-top: 1rem;
}

.empty-catalog,
.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-color-secondary);
}

.empty-catalog i,
.empty-history i {
  font-size: 2rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Price History */
.price-history-filters {
  margin-bottom: 1.5rem;
}

.history-dropdown {
  width: 100%;
  max-width: 400px;
}

.history-summary {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  min-width: 120px;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.summary-value.success { color: var(--green-600); }
.summary-value.danger { color: var(--red-600); }

.order-ref {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--primary-600);
}

/* Add Item Form */
.add-item-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.w-full {
  width: 100%;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    text-align: center;
  }

  .supplier-quick-stats {
    width: 100%;
    justify-content: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .history-summary {
    flex-direction: column;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
