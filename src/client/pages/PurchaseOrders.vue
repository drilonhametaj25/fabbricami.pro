<template>
  <div class="purchase-orders-page">
    <PageHeader
      title="Ordini d'Acquisto"
      subtitle="Gestisci gli ordini ai fornitori e il ricevimento merce"
      icon="pi pi-file-edit"
    >
      <template #actions>
        <Button
          label="Verifica Ordini"
          icon="pi pi-search"
          severity="secondary"
          @click="showItemHistoryDialog = true"
          class="mr-2"
        />
        <Button label="Nuovo Ordine" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Bozze"
          :value="stats.draft"
          icon="pi pi-file-edit"
          variant="primary"
          format="number"
          subtitle="ordini in bozza"
        />
        <StatsCard
          label="Inviati"
          :value="stats.sent"
          icon="pi pi-send"
          variant="info"
          format="number"
          subtitle="in attesa conferma"
        />
        <StatsCard
          label="Confermati"
          :value="stats.confirmed"
          icon="pi pi-clock"
          variant="warning"
          format="number"
          subtitle="da ricevere"
        />
        <StatsCard
          label="Ricevuti"
          :value="stats.received"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          subtitle="completati"
        />
      </div>
    </section>

    <!-- TabView for multiple views -->
    <TabView v-model:activeIndex="activeTab" class="purchase-tabs">
      <TabPanel header="Lista Ordini">
        <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per numero ordine..."
              @input="debounceSearch"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedStatus"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              @change="loadOrders"
              showClear
              class="filter-dropdown"
            />

            <Dropdown
              v-model="selectedSupplier"
              :options="suppliers"
              optionLabel="businessName"
              optionValue="id"
              placeholder="Tutti i fornitori"
              @change="loadOrders"
              showClear
              filter
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="orders"
          :loading="loading"
          paginator
          :rows="20"
          :totalRecords="totalRecords"
          :lazy="true"
          @page="onPage"
          @sort="onSort"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="orderNumber" header="Numero Ordine" sortable style="min-width: 150px">
            <template #body="{ data }">
              <span class="order-number">{{ data.orderNumber }}</span>
            </template>
          </Column>
          <Column field="supplier.businessName" header="Fornitore" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="supplier-cell">
                <i class="pi pi-building"></i>
                <span>{{ data.supplier?.businessName || '-' }}</span>
              </div>
            </template>
          </Column>
          <Column field="createdAt" header="Data Ordine" sortable style="min-width: 120px">
            <template #body="{ data }">
              {{ formatDate(data.createdAt) }}
            </template>
          </Column>
          <Column field="expectedDate" header="Data Prevista" sortable style="min-width: 130px">
            <template #body="{ data }">
              <span v-if="data.expectedDate">{{ formatDate(data.expectedDate) }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="total" header="Totale" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="amount">{{ formatCurrency(Number(data.total) || 0) }}</span>
            </template>
          </Column>
          <Column field="status" header="Stato" sortable style="min-width: 150px">
            <template #body="{ data }">
              <Tag :severity="getStatusSeverity(data.status)" :icon="getStatusIcon(data.status)">
                {{ getStatusLabel(data.status) }}
              </Tag>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 200px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewOrder(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  v-if="data.status === 'DRAFT'"
                  icon="pi pi-send"
                  class="p-button-rounded p-button-text action-btn action-btn--send"
                  @click="confirmOrder(data)"
                  v-tooltip.top="'Conferma e Invia'"
                />
                <Button
                  v-if="data.status === 'CONFIRMED' || data.status === 'PARTIALLY_RECEIVED'"
                  icon="pi pi-download"
                  class="p-button-rounded p-button-text action-btn action-btn--receive"
                  @click="receiveOrder(data)"
                  v-tooltip.top="'Ricevi Merce'"
                />
                <Button
                  v-if="data.status === 'DRAFT'"
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editOrder(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  v-if="data.status === 'DRAFT' || data.status === 'SENT'"
                  icon="pi pi-times"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="cancelOrder(data)"
                  v-tooltip.top="'Annulla'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox empty-state__icon"></i>
              <p class="empty-state__text">Nessun ordine trovato</p>
              <Button label="Crea il primo ordine" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
        </div>
      </TabPanel>

      <TabPanel header="Timeline">
        <PurchaseTimelineChart />
      </TabPanel>

      <TabPanel header="Forecasting">
        <PurchaseForecastingPanel @create-order="createOrderFromForecast" />
      </TabPanel>

      <TabPanel header="Opportunità Sconti">
        <DiscountOpportunitiesPanel />
      </TabPanel>
    </TabView>

    <!-- Dialog Create/Edit -->
    <Dialog
      v-model:visible="showDialog"
      :header="selectedOrder ? 'Modifica Ordine' : 'Nuovo Ordine d\'Acquisto'"
      :style="{ width: '900px' }"
      :modal="true"
      class="detail-dialog"
    >
      <div class="form-content">
        <div class="form-section">
          <h3 class="form-section__title">Informazioni Generali</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="supplier">Fornitore *</label>
              <Dropdown
                id="supplier"
                v-model="formData.supplierId"
                :options="suppliers"
                optionLabel="businessName"
                optionValue="id"
                placeholder="Seleziona fornitore"
                filter
                class="w-full"
              />
            </div>

            <div class="form-field">
              <label for="orderDate">Data Ordine *</label>
              <Calendar id="orderDate" v-model="formData.orderDate" dateFormat="dd/mm/yy" class="w-full" />
            </div>

            <div class="form-field">
              <label for="expectedDeliveryDate">Data Consegna Prevista</label>
              <Calendar id="expectedDeliveryDate" v-model="formData.expectedDeliveryDate" dateFormat="dd/mm/yy" class="w-full" />
            </div>

            <div class="form-field">
              <label for="paymentTerms">Termini Pagamento</label>
              <Dropdown
                id="paymentTerms"
                v-model="formData.paymentTerms"
                :options="paymentTermsOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona termini"
                class="w-full"
              />
            </div>

            <div class="form-field form-field--full">
              <label for="notes">Note</label>
              <Textarea id="notes" v-model="formData.notes" rows="2" class="w-full" />
            </div>
          </div>
        </div>

        <Divider />

        <div class="form-section">
          <div class="form-section__header">
            <h3 class="form-section__title">Righe Ordine</h3>
            <Button
              label="Aggiungi Articolo"
              icon="pi pi-plus"
              @click="addOrderItem"
              class="p-button-sm p-button-success"
              :disabled="!formData.supplierId"
            />
          </div>

          <DataTable :value="formData.items" class="items-table custom-table" responsiveLayout="scroll">
            <Column header="Tipo" style="min-width: 130px">
              <template #body="{ data, index }">
                <SelectButton
                  v-model="data.itemType"
                  :options="itemTypeOptions"
                  optionLabel="label"
                  optionValue="value"
                  @change="onItemTypeChange(index)"
                  class="item-type-select"
                />
              </template>
            </Column>
            <Column header="Articolo" style="min-width: 250px">
              <template #body="{ data, index }">
                <Dropdown
                  v-if="data.itemType === 'product'"
                  v-model="data.productId"
                  :options="supplierProducts"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Seleziona prodotto"
                  filter
                  @change="onItemSelected(index)"
                  class="w-full"
                />
                <Dropdown
                  v-else
                  v-model="data.materialId"
                  :options="supplierMaterials"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Seleziona materiale"
                  filter
                  @change="onItemSelected(index)"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Quantita" style="min-width: 120px">
              <template #body="{ data, index }">
                <InputNumber
                  v-model="data.quantity"
                  @input="calculateItemTotal(index)"
                  :min="1"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Prezzo Unitario" style="min-width: 180px">
              <template #body="{ data, index }">
                <div class="price-field">
                  <InputNumber
                    v-model="data.unitPrice"
                    mode="currency"
                    currency="EUR"
                    locale="it-IT"
                    @input="calculateItemTotal(index)"
                    class="w-full"
                  />
                  <div v-if="data.lastPrice" class="last-price-indicator">
                    <i class="pi pi-history"></i>
                    <span>Ultimo: {{ formatCurrency(data.lastPrice) }}</span>
                    <span v-if="data.priceVariance !== undefined" :class="getPriceVarianceClass(data.priceVariance)">
                      ({{ data.priceVariance > 0 ? '+' : '' }}{{ data.priceVariance.toFixed(1) }}%)
                    </span>
                  </div>
                </div>
              </template>
            </Column>
            <Column header="Totale" style="min-width: 120px">
              <template #body="{ data }">
                <span class="amount">{{ formatCurrency(data.totalPrice) }}</span>
              </template>
            </Column>
            <Column header="" style="min-width: 80px">
              <template #body="{ index }">
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="removeOrderItem(index)"
                />
              </template>
            </Column>
          </DataTable>
        </div>

        <Divider />

        <div class="totals-section">
          <div class="totals-grid">
            <div class="total-row">
              <span class="total-label">Subtotale:</span>
              <span class="total-value">{{ formatCurrency(formData.subtotalAmount) }}</span>
            </div>
            <div class="total-row">
              <span class="total-label">IVA ({{ formData.taxRate }}%):</span>
              <span class="total-value">{{ formatCurrency(formData.taxAmount) }}</span>
            </div>
            <div class="total-row total-row--grand">
              <span class="total-label">Totale:</span>
              <span class="total-value total-value--grand">{{ formatCurrency(formData.totalAmount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="showDialog = false" class="p-button-text" />
        <Button label="Salva" icon="pi pi-check" @click="handleSave" :loading="saving" />
      </template>
    </Dialog>

    <!-- Dialog View Details -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Ordine d'Acquisto"
      :style="{ width: '900px' }"
      :modal="true"
      class="detail-dialog"
    >
      <div v-if="selectedOrder" class="order-details">
        <div class="detail-header">
          <div>
            <h2 class="detail-header__title">{{ selectedOrder.orderNumber }}</h2>
            <p class="detail-header__supplier">{{ selectedOrder.supplier?.businessName }}</p>
          </div>
          <Tag :severity="getStatusSeverity(selectedOrder.status)" :icon="getStatusIcon(selectedOrder.status)" class="status-tag-large">
            {{ getStatusLabel(selectedOrder.status) }}
          </Tag>
        </div>

        <Divider />

        <div class="detail-section">
          <h3 class="detail-section__title"><i class="pi pi-info-circle"></i> Informazioni</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Data Ordine:</span>
              <span class="detail-value">{{ formatDate(selectedOrder.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Data Prevista:</span>
              <span class="detail-value">{{ formatDate(selectedOrder.expectedDate) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Termini Pagamento:</span>
              <span class="detail-value">{{ selectedOrder.paymentTerms ? `${selectedOrder.paymentTerms} giorni` : '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Data Ricezione:</span>
              <span class="detail-value">{{ formatDate(selectedOrder.receivedDate) }}</span>
            </div>
          </div>
        </div>

        <Divider />

        <div class="detail-section">
          <h3 class="detail-section__title"><i class="pi pi-list"></i> Righe Ordine</h3>
          <DataTable :value="selectedOrder.items" class="detail-items-table custom-table">
            <Column header="Tipo" style="min-width: 100px">
              <template #body="{ data }">
                <Tag :severity="data.productId ? 'info' : 'warning'">
                  {{ data.productId ? 'Prodotto' : 'Materiale' }}
                </Tag>
              </template>
            </Column>
            <Column header="Codice" style="min-width: 120px">
              <template #body="{ data }">
                <span class="sku-badge">{{ data.product?.sku || data.material?.sku || '-' }}</span>
              </template>
            </Column>
            <Column header="Articolo" style="min-width: 250px">
              <template #body="{ data }">
                {{ data.product?.name || data.material?.name || '-' }}
              </template>
            </Column>
            <Column field="quantity" header="Quantita" style="min-width: 100px">
              <template #body="{ data }">
                <span class="quantity-badge">{{ data.quantity }}</span>
              </template>
            </Column>
            <Column field="receivedQuantity" header="Ricevuto" style="min-width: 100px">
              <template #body="{ data }">
                <span class="quantity-badge quantity-badge--received">{{ data.receivedQuantity || 0 }}</span>
              </template>
            </Column>
            <Column field="unitPrice" header="Prezzo Unit." style="min-width: 120px">
              <template #body="{ data }">
                {{ formatCurrency(data.unitPrice) }}
              </template>
            </Column>
            <Column field="total" header="Totale" style="min-width: 120px">
              <template #body="{ data }">
                <span class="amount">{{ formatCurrency(Number(data.total) || 0) }}</span>
              </template>
            </Column>
          </DataTable>
        </div>

        <Divider />

        <div class="totals-section">
          <div class="totals-grid">
            <div class="total-row">
              <span class="total-label">Subtotale:</span>
              <span class="total-value">{{ formatCurrency(Number(selectedOrder.subtotal) || 0) }}</span>
            </div>
            <div class="total-row">
              <span class="total-label">IVA (22%):</span>
              <span class="total-value">{{ formatCurrency(Number(selectedOrder.tax) || 0) }}</span>
            </div>
            <div class="total-row total-row--grand">
              <span class="total-label">Totale:</span>
              <span class="total-value total-value--grand">{{ formatCurrency(Number(selectedOrder.total) || 0) }}</span>
            </div>
          </div>
        </div>

        <div v-if="selectedOrder.notes" class="detail-section">
          <h3 class="detail-section__title"><i class="pi pi-file-edit"></i> Note</h3>
          <p class="notes-text">{{ selectedOrder.notes }}</p>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" @click="showDetailDialog = false" class="p-button-text" />
        <Button
          v-if="selectedOrder?.status === 'DRAFT'"
          label="Conferma Ordine"
          icon="pi pi-send"
          @click="confirmOrderFromDetail"
          class="p-button-primary"
        />
        <Button
          v-if="selectedOrder?.status === 'CONFIRMED' || selectedOrder?.status === 'PARTIALLY_RECEIVED'"
          label="Ricevi Merce"
          icon="pi pi-download"
          @click="receiveOrderFromDetail"
          class="p-button-success"
        />
      </template>
    </Dialog>

    <!-- Dialog Receive Items -->
    <Dialog
      v-model:visible="showReceiveDialog"
      header="Ricevi Merce"
      :style="{ width: '700px' }"
      :modal="true"
      class="detail-dialog"
    >
      <div v-if="receiveData.order" class="receive-content">
        <p class="receive-intro">Inserisci le quantita ricevute per ciascun prodotto:</p>

        <DataTable :value="receiveData.items" class="receive-table custom-table">
          <Column header="Articolo" style="min-width: 250px">
            <template #body="{ data }">
              <div class="item-cell">
                <Tag :severity="data.productId ? 'info' : 'warning'" class="item-type-tag">
                  {{ data.productId ? 'P' : 'M' }}
                </Tag>
                <span>{{ data.product?.name || data.material?.name || '-' }}</span>
              </div>
            </template>
          </Column>
          <Column field="quantity" header="Ordinato" style="min-width: 100px">
            <template #body="{ data }">
              <span class="quantity-badge">{{ data.quantity }}</span>
            </template>
          </Column>
          <Column field="receivedQuantity" header="Gia Ricevuto" style="min-width: 120px">
            <template #body="{ data }">
              <span class="quantity-badge quantity-badge--received">{{ data.receivedQuantity || 0 }}</span>
            </template>
          </Column>
          <Column header="Da Ricevere" style="min-width: 150px">
            <template #body="{ data }">
              <InputNumber
                v-model="data.receiveNow"
                :min="0"
                :max="data.quantity - (data.receivedQuantity || 0)"
                class="w-full"
              />
            </template>
          </Column>
        </DataTable>

        <div class="warehouse-selection">
          <label for="warehouseId">Magazzino di Destinazione *</label>
          <Dropdown
            id="warehouseId"
            v-model="receiveData.warehouseId"
            :options="warehouses"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona magazzino"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="showReceiveDialog = false" class="p-button-text" />
        <Button label="Conferma Ricezione" icon="pi pi-check" @click="handleReceive" :loading="receiving" />
      </template>
    </Dialog>

    <!-- Item Order History Dialog -->
    <ItemOrderHistoryDialog v-model="showItemHistoryDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Calendar from 'primevue/calendar';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import SelectButton from 'primevue/selectbutton';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import PurchaseTimelineChart from '../components/PurchaseTimelineChart.vue';
import PurchaseForecastingPanel from '../components/PurchaseForecastingPanel.vue';
import DiscountOpportunitiesPanel from '../components/DiscountOpportunitiesPanel.vue';
import ItemOrderHistoryDialog from '../components/ItemOrderHistoryDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const showItemHistoryDialog = ref(false);
const saving = ref(false);
const receiving = ref(false);
const orders = ref([]);
const suppliers = ref([]);
const products = ref([]);
const materials = ref([]);
const warehouses = ref([]);
const totalRecords = ref(0);
const search = ref('');
const selectedStatus = ref(null);
const selectedSupplier = ref(null);
const page = ref(1);
const sortBy = ref('createdAt');
const sortOrder = ref('desc');
const activeTab = ref(0);

// Supplier catalog (items from selected supplier)
const supplierProducts = ref<any[]>([]);
const supplierMaterials = ref<any[]>([]);

const showDialog = ref(false);
const showDetailDialog = ref(false);
const showReceiveDialog = ref(false);
const selectedOrder = ref<any>(null);

// Item type options for toggle
const itemTypeOptions = [
  { label: 'Prodotto', value: 'product' },
  { label: 'Materiale', value: 'material' },
];

const stats = ref({
  draft: 0,
  sent: 0,
  confirmed: 0,
  received: 0,
});

interface OrderItem {
  itemType: 'product' | 'material';
  productId: string | null;
  materialId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  lastPrice?: number;
  priceVariance?: number;
}

const formData = ref({
  supplierId: null as string | null,
  orderDate: new Date(),
  expectedDeliveryDate: null as Date | null,
  paymentTerms: 30,
  notes: '',
  items: [] as OrderItem[],
  subtotalAmount: 0,
  taxRate: 22,
  taxAmount: 0,
  totalAmount: 0,
});

const receiveData = ref({
  order: null as any,
  items: [] as any[],
  warehouseId: null,
});

const statusOptions = [
  { label: 'Bozza', value: 'DRAFT' },
  { label: 'Inviato', value: 'SENT' },
  { label: 'Confermato', value: 'CONFIRMED' },
  { label: 'Parzialmente Ricevuto', value: 'PARTIALLY_RECEIVED' },
  { label: 'Ricevuto', value: 'RECEIVED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

// Opzioni termini di pagamento standard
const paymentTermsOptions = [
  { label: 'Pagamento anticipato', value: 0 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
  { label: '120 giorni', value: 120 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('it-IT');
};

const getStatusSeverity = (status: string) => {
  const map: any = {
    DRAFT: 'info',
    SENT: 'warning',
    CONFIRMED: 'warning',
    PARTIALLY_RECEIVED: 'warning',
    RECEIVED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

const getStatusIcon = (status: string) => {
  const map: any = {
    DRAFT: 'pi pi-file-edit',
    SENT: 'pi pi-send',
    CONFIRMED: 'pi pi-check',
    PARTIALLY_RECEIVED: 'pi pi-clock',
    RECEIVED: 'pi pi-check-circle',
    CANCELLED: 'pi pi-times-circle',
  };
  return map[status] || 'pi pi-info-circle';
};

const getStatusLabel = (status: string) => {
  const map: any = {
    DRAFT: 'Bozza',
    SENT: 'Inviato',
    CONFIRMED: 'Confermato',
    PARTIALLY_RECEIVED: 'Parz. Ricevuto',
    RECEIVED: 'Ricevuto',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadOrders();
  }, 500);
};

const calculateTotals = () => {
  formData.value.subtotalAmount = formData.value.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  formData.value.taxAmount = (formData.value.subtotalAmount * formData.value.taxRate) / 100;
  formData.value.totalAmount = formData.value.subtotalAmount + formData.value.taxAmount;
};

const calculateItemTotal = (index: number) => {
  const item = formData.value.items[index];
  item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
  calculateTotals();
};

const getPriceVarianceClass = (variance: number) => {
  if (variance > 5) return 'price-variance--increase';
  if (variance < -5) return 'price-variance--decrease';
  return 'price-variance--neutral';
};

const onItemTypeChange = (index: number) => {
  const item = formData.value.items[index];
  // Reset item selection when type changes
  item.productId = null;
  item.materialId = null;
  item.unitPrice = 0;
  item.totalPrice = 0;
  item.lastPrice = undefined;
  item.priceVariance = undefined;
};

const onItemSelected = async (index: number) => {
  const item = formData.value.items[index];
  const supplierId = formData.value.supplierId;
  const itemId = item.productId || item.materialId;

  if (!supplierId || !itemId) return;

  // Find the selected item from supplier catalog to get base price
  if (item.itemType === 'product') {
    const selectedProduct = supplierProducts.value.find((p: any) => p.id === item.productId);
    if (selectedProduct?.supplierPrice) {
      item.unitPrice = selectedProduct.supplierPrice;
    }
  } else {
    const selectedMaterial = supplierMaterials.value.find((m: any) => m.id === item.materialId);
    if (selectedMaterial?.supplierPrice) {
      item.unitPrice = selectedMaterial.supplierPrice;
    }
  }

  // Try to get price suggestion from API
  try {
    const params = new URLSearchParams({
      supplierId,
      quantity: (item.quantity || 1).toString(),
      ...(item.productId && { productId: item.productId }),
      ...(item.materialId && { materialId: item.materialId }),
    });

    const response = await api.get(`/suppliers/price-suggestions?${params}`);

    if (response.data?.recommended) {
      item.lastPrice = response.data.recommended.price;
      // Only set unit price if not already set
      if (!item.unitPrice) {
        item.unitPrice = item.lastPrice;
      }
      // Calculate price variance
      if (item.unitPrice && item.lastPrice) {
        item.priceVariance = ((item.unitPrice - item.lastPrice) / item.lastPrice) * 100;
      }
    }
  } catch (e) {
    console.error('Error fetching price suggestion', e);
  }

  calculateItemTotal(index);
};

const addOrderItem = () => {
  formData.value.items.push({
    itemType: 'product',
    productId: null,
    materialId: null,
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
  });
};

const loadSupplierCatalog = async (supplierId: string) => {
  try {
    const response = await api.get(`/suppliers/${supplierId}/catalog`);
    if (response.success) {
      supplierProducts.value = response.data?.products || [];
      supplierMaterials.value = response.data?.materials || [];
    }
  } catch (error) {
    console.error('Error loading supplier catalog:', error);
    // Fallback to all products and materials
    supplierProducts.value = products.value;
    supplierMaterials.value = materials.value;
  }
};

const createOrderFromForecast = (data: any) => {
  // Pre-fill form with forecast data
  formData.value = {
    supplierId: data.supplierId || null,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    paymentTerms: 30,
    notes: '',
    items: [{
      itemType: 'material',
      productId: null,
      materialId: data.materialId || null,
      quantity: data.quantity || 1,
      unitPrice: data.unitPrice || 0,
      totalPrice: (data.quantity || 1) * (data.unitPrice || 0),
      lastPrice: data.unitPrice,
    }],
    subtotalAmount: 0,
    taxRate: 22,
    taxAmount: 0,
    totalAmount: 0,
  };
  calculateTotals();

  // Load supplier catalog if supplier is set
  if (data.supplierId) {
    loadSupplierCatalog(data.supplierId);
  }

  showDialog.value = true;
};

// Watch for supplier changes to load catalog
watch(() => formData.value.supplierId, async (newSupplierId) => {
  if (newSupplierId) {
    await loadSupplierCatalog(newSupplierId);
  } else {
    supplierProducts.value = [];
    supplierMaterials.value = [];
  }
});

const removeOrderItem = (index: number) => {
  formData.value.items.splice(index, 1);
  calculateTotals();
};

const loadStats = async () => {
  try {
    const response = await api.get('/purchase-orders?limit=100');
    const allOrders = response.data?.items || [];

    stats.value = {
      draft: allOrders.filter((o: any) => o.status === 'DRAFT').length,
      sent: allOrders.filter((o: any) => o.status === 'SENT').length,
      confirmed: allOrders.filter((o: any) => o.status === 'CONFIRMED').length,
      received: allOrders.filter((o: any) => o.status === 'RECEIVED').length,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadOrders = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedStatus.value && { status: selectedStatus.value }),
      ...(selectedSupplier.value && { supplierId: selectedSupplier.value }),
    });

    const response = await api.get(`/purchase-orders?${params.toString()}`);

    if (response.success) {
      orders.value = response.data?.items || [];
      totalRecords.value = response.data?.pagination?.total || 0;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento degli ordini',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadSuppliers = async () => {
  try {
    const response = await api.get('/suppliers?limit=100&isActive=true');
    if (response.success) {
      suppliers.value = response.data?.items || [];
    }
  } catch (error) {
    console.error('Error loading suppliers:', error);
  }
};

const loadProducts = async () => {
  try {
    const response = await api.get('/products?limit=500&isActive=true');
    if (response.success) {
      products.value = response.data?.items || [];
    }
  } catch (error) {
    console.error('Error loading products:', error);
  }
};

const loadMaterials = async () => {
  try {
    const response = await api.get('/materials?limit=500&isActive=true');
    if (response.success) {
      materials.value = response.data?.items || [];
    }
  } catch (error) {
    console.error('Error loading materials:', error);
  }
};

const loadWarehouses = async () => {
  try {
    const response = await api.get('/warehouses?limit=100&isActive=true');
    if (response.success) {
      warehouses.value = response.data?.items || [];
    }
  } catch (error) {
    console.error('Error loading warehouses:', error);
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadOrders();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadOrders();
};

const openCreateDialog = () => {
  selectedOrder.value = null;
  formData.value = {
    supplierId: null,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    paymentTerms: 30,
    notes: '',
    items: [],
    subtotalAmount: 0,
    taxRate: 22,
    taxAmount: 0,
    totalAmount: 0,
  };
  showDialog.value = true;
};

const viewOrder = (order: any) => {
  selectedOrder.value = order;
  showDetailDialog.value = true;
};

const editOrder = async (order: any) => {
  selectedOrder.value = order;

  // Load supplier catalog first
  if (order.supplierId) {
    await loadSupplierCatalog(order.supplierId);
  }

  // Backend usa 'expectedDate', frontend usa 'expectedDeliveryDate'
  // Backend può usare 'createdAt' come data ordine se 'orderDate' non è presente
  const orderDate = order.orderDate || order.createdAt;
  const expectedDate = order.expectedDate || order.expectedDeliveryDate;

  formData.value = {
    supplierId: order.supplierId,
    orderDate: orderDate ? new Date(orderDate) : new Date(),
    expectedDeliveryDate: expectedDate ? new Date(expectedDate) : null,
    paymentTerms: order.paymentTerms || 30,
    notes: order.notes || '',
    items: order.items.map((item: any) => ({
      itemType: item.productId ? 'product' : 'material',
      productId: item.productId || null,
      materialId: item.materialId || null,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.total) || Number(item.totalPrice) || 0,
    })),
    subtotalAmount: Number(order.subtotal) || Number(order.subtotalAmount) || 0,
    taxRate: Number(order.taxRate) || 22,
    taxAmount: Number(order.tax) || Number(order.taxAmount) || 0,
    totalAmount: Number(order.total) || Number(order.totalAmount) || 0,
  };
  showDialog.value = true;
};

const confirmOrder = (order: any) => {
  confirm.require({
    message: `Confermare e inviare l'ordine ${order.orderNumber} al fornitore?`,
    header: 'Conferma Invio',
    icon: 'pi pi-send',
    acceptLabel: 'Si, invia',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-primary',
    accept: async () => {
      try {
        await api.post(`/purchase-orders/${order.id}/confirm`);
        toast.add({
          severity: 'success',
          summary: 'Inviato',
          detail: 'Ordine confermato e inviato al fornitore',
          life: 3000,
        });
        loadOrders();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante la conferma',
          life: 3000,
        });
      }
    },
  });
};

const confirmOrderFromDetail = () => {
  showDetailDialog.value = false;
  confirmOrder(selectedOrder.value);
};

const receiveOrder = (order: any) => {
  receiveData.value = {
    order: order,
    items: order.items.map((item: any) => ({
      ...item,
      receiveNow: item.quantity - (item.receivedQuantity || 0),
    })),
    warehouseId: warehouses.value[0]?.id || null,
  };
  showReceiveDialog.value = true;
};

const receiveOrderFromDetail = () => {
  showDetailDialog.value = false;
  receiveOrder(selectedOrder.value);
};

const handleReceive = async () => {
  try {
    if (!receiveData.value.warehouseId) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Seleziona un magazzino di destinazione',
        life: 3000,
      });
      return;
    }

    receiving.value = true;

    const receiveItems = receiveData.value.items
      .filter((item: any) => item.receiveNow > 0)
      .map((item: any) => ({
        itemId: item.id,
        receivedQuantity: item.receiveNow,
      }));

    if (receiveItems.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Inserisci almeno una quantita da ricevere',
        life: 3000,
      });
      return;
    }

    await api.post(`/purchase-orders/${receiveData.value.order.id}/receive`, {
      items: receiveItems,
      warehouseId: receiveData.value.warehouseId,
    });

    toast.add({
      severity: 'success',
      summary: 'Ricevuto',
      detail: 'Merce ricevuta e caricata a magazzino',
      life: 3000,
    });

    showReceiveDialog.value = false;
    loadOrders();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante la ricezione',
      life: 3000,
    });
  } finally {
    receiving.value = false;
  }
};

const cancelOrder = (order: any) => {
  confirm.require({
    message: `Sei sicuro di voler annullare l'ordine ${order.orderNumber}?`,
    header: 'Conferma Annullamento',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Si, annulla',
    rejectLabel: 'No',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.post(`/purchase-orders/${order.id}/cancel`);
        toast.add({
          severity: 'success',
          summary: 'Annullato',
          detail: 'Ordine annullato',
          life: 3000,
        });
        loadOrders();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante l\'annullamento',
          life: 3000,
        });
      }
    },
  });
};

const handleSave = async () => {
  try {
    // Validation
    if (!formData.value.supplierId) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Seleziona un fornitore',
        life: 3000,
      });
      return;
    }

    if (formData.value.items.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Aggiungi almeno un articolo',
        life: 3000,
      });
      return;
    }

    // Validate that all items have either productId or materialId
    const invalidItems = formData.value.items.filter(item => !item.productId && !item.materialId);
    if (invalidItems.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Seleziona un prodotto o materiale per ogni riga',
        life: 3000,
      });
      return;
    }

    saving.value = true;

    // Prepara payload con date in formato ISO e tutti i campi necessari
    const payload = {
      supplierId: formData.value.supplierId,
      orderDate: formData.value.orderDate instanceof Date
        ? formData.value.orderDate.toISOString()
        : new Date().toISOString(),
      expectedDeliveryDate: formData.value.expectedDeliveryDate instanceof Date
        ? formData.value.expectedDeliveryDate.toISOString()
        : null,
      paymentTerms: formData.value.paymentTerms || 30,
      notes: formData.value.notes || '',
      subtotalAmount: formData.value.subtotalAmount,
      taxRate: formData.value.taxRate,
      taxAmount: formData.value.taxAmount,
      totalAmount: formData.value.totalAmount,
      items: formData.value.items.map(item => ({
        productId: item.productId || null,
        materialId: item.materialId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tax: formData.value.taxRate, // IVA per singolo item
      })),
    };

    if (selectedOrder.value?.id) {
      // Update
      await api.patch(`/purchase-orders/${selectedOrder.value.id}`, payload);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Ordine aggiornato con successo',
        life: 3000,
      });
    } else {
      // Create
      await api.post('/purchase-orders', payload);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Ordine creato con successo',
        life: 3000,
      });
    }

    showDialog.value = false;
    loadOrders();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadOrders();
  loadSuppliers();
  loadProducts();
  loadMaterials();
  loadWarehouses();
  loadStats();
});
</script>

<style scoped>
.purchase-orders-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* TabView Styles */
.purchase-tabs {
  margin-top: var(--space-6);
}

.purchase-tabs :deep(.p-tabview-panels) {
  padding: var(--space-6) 0 0 0;
}

.purchase-tabs :deep(.p-tabview-nav) {
  background: var(--surface-card);
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  border: 1px solid var(--surface-border);
  border-bottom: none;
}

.purchase-tabs :deep(.p-tabview-nav-link) {
  padding: var(--space-4) var(--space-6);
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* Table Section */
.table-section {
  margin-top: var(--space-6);
}

.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-gray-400);
  font-size: 0.875rem;
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

/* Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

.custom-table :deep(.p-paginator) {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Cell Styles */
.order-number {
  font-family: 'Courier New', Consolas, monospace;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
}

.supplier-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-gray-900);
}

.supplier-cell i {
  color: var(--color-primary-600);
}

.sku-badge {
  font-family: 'Courier New', Consolas, monospace;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.amount {
  font-weight: 700;
  color: var(--color-success);
  font-size: var(--font-size-base);
}

.text-muted {
  color: var(--color-gray-400);
}

.quantity-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--color-info-light);
  color: var(--color-info-dark);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.quantity-badge--received {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
}

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-warning) !important;
}

.action-btn--send {
  color: var(--color-success) !important;
}

.action-btn--receive {
  color: var(--color-success) !important;
}

.action-btn--delete {
  color: var(--color-danger) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__text {
  color: var(--color-gray-500);
  margin-bottom: var(--space-4);
}

/* Form Styles */
.form-content {
  max-height: 70vh;
  overflow-y: auto;
}

.form-section {
  margin-bottom: var(--space-6);
}

.form-section__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-4) 0;
}

.form-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-600);
}

.form-field--full {
  grid-column: span 2;
}

.items-table {
  margin-top: var(--space-4);
}

/* Totals Section */
.totals-section {
  background: var(--color-gray-50);
  padding: var(--space-6);
  border-radius: var(--border-radius-md);
  margin-top: var(--space-4);
}

.totals-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 400px;
  margin-left: auto;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
}

.total-row--grand {
  border-top: 2px solid var(--border-color);
  padding-top: var(--space-4);
  margin-top: var(--space-2);
}

.total-label {
  font-weight: 600;
  color: var(--color-gray-600);
}

.total-row--grand .total-label {
  font-size: var(--font-size-lg);
  color: var(--color-gray-900);
}

.total-value {
  font-weight: 700;
  color: var(--color-gray-900);
  font-size: var(--font-size-base);
}

.total-value--grand {
  font-size: var(--font-size-xl);
  color: var(--color-success);
}

/* Detail Dialog Styles */
.order-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail-header__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0;
}

.detail-header__supplier {
  color: var(--color-gray-500);
  font-size: var(--font-size-base);
  margin: var(--space-1) 0 0 0;
}

.status-tag-large {
  font-size: var(--font-size-base) !important;
  padding: var(--space-2) var(--space-4) !important;
}

.detail-section {
  padding-top: var(--space-4);
}

.detail-section__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-section__title i {
  color: var(--color-primary-500);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
}

.detail-items-table {
  margin-top: var(--space-4);
}

.notes-text {
  color: var(--color-gray-600);
  margin: 0;
  line-height: var(--line-height-relaxed);
  background: var(--color-gray-50);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
}

/* Receive Dialog Styles */
.receive-content {
  padding: var(--space-4) 0;
}

.receive-intro {
  margin-bottom: var(--space-6);
  color: var(--color-gray-600);
  font-size: var(--font-size-base);
}

.receive-table {
  margin-bottom: var(--space-6);
}

.warehouse-selection {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.warehouse-selection label {
  font-weight: 600;
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

/* Item Type Select Button */
.item-type-select :deep(.p-button) {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
}

.item-type-select :deep(.p-button.p-highlight) {
  background: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

/* Price Field with Last Price Indicator */
.price-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.last-price-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}

.last-price-indicator i {
  font-size: 0.7rem;
  color: var(--color-gray-400);
}

.price-variance--increase {
  color: var(--red-600);
  font-weight: 600;
}

.price-variance--decrease {
  color: var(--green-600);
  font-weight: 600;
}

.price-variance--neutral {
  color: var(--text-color-secondary);
}

/* Item Cell in Receive Dialog */
.item-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.item-type-tag {
  font-size: var(--font-size-xs);
  padding: var(--space-1);
  min-width: 24px;
  text-align: center;
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper {
    min-width: 100%;
  }

  .filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-field--full {
    grid-column: span 1;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-header {
    flex-direction: column;
    gap: var(--space-4);
  }
}
</style>
