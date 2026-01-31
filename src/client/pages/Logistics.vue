<template>
  <div class="logistics-page">
    <PageHeader
      title="Logistica"
      subtitle="Pianificazione arrivi, evasione ordini e produzione"
      icon="pi pi-truck"
    >
      <template #actions>
        <Button
          icon="pi pi-refresh"
          label="Aggiorna"
          class="p-button-outlined"
          @click="refreshAll"
          :loading="loading"
        />
      </template>
    </PageHeader>

    <!-- KPI Dashboard -->
    <section class="dashboard-section">
      <div class="kpi-grid">
        <div class="kpi-card incoming">
          <div class="kpi-header">
            <div class="kpi-icon"><i class="pi pi-inbox"></i></div>
            <h4>Arrivi Previsti</h4>
          </div>
          <div class="kpi-body">
            <div class="kpi-main">
              <span class="kpi-value">{{ dashboard.incoming?.expectedThisWeek || 0 }}</span>
              <span class="kpi-label">questa settimana</span>
            </div>
            <div class="kpi-stats">
              <div class="stat-item">
                <span class="stat-value">{{ dashboard.incoming?.totalOrders || 0 }}</span>
                <span class="stat-label">totali</span>
              </div>
              <div class="stat-item warning" v-if="dashboard.incoming?.delayed > 0">
                <span class="stat-value">{{ dashboard.incoming.delayed }}</span>
                <span class="stat-label">in ritardo</span>
              </div>
            </div>
          </div>
          <div class="kpi-footer">
            <span class="kpi-footer-value">{{ formatCurrency(dashboard.incoming?.totalValue || 0) }}</span>
            <span class="kpi-footer-label">valore ordini</span>
          </div>
        </div>

        <div class="kpi-card fulfillment">
          <div class="kpi-header">
            <div class="kpi-icon"><i class="pi pi-send"></i></div>
            <h4>Evasione Ordini</h4>
          </div>
          <div class="kpi-body">
            <div class="kpi-main">
              <span class="kpi-value">{{ dashboard.fulfillment?.readyToShip || 0 }}</span>
              <span class="kpi-label">pronti a spedire</span>
            </div>
            <div class="kpi-stats">
              <div class="stat-item">
                <span class="stat-value">{{ dashboard.fulfillment?.avgFulfillmentRate || 0 }}%</span>
                <span class="stat-label">tasso medio</span>
              </div>
              <div class="stat-item danger" v-if="dashboard.fulfillment?.blocked > 0">
                <span class="stat-value">{{ dashboard.fulfillment.blocked }}</span>
                <span class="stat-label">bloccati</span>
              </div>
            </div>
          </div>
          <div class="kpi-footer">
            <span class="kpi-footer-value">{{ formatCurrency(dashboard.fulfillment?.readyValue || 0) }}</span>
            <span class="kpi-footer-label">valore pronto</span>
          </div>
        </div>

        <div class="kpi-card production">
          <div class="kpi-header">
            <div class="kpi-icon"><i class="pi pi-cog"></i></div>
            <h4>Produzione</h4>
          </div>
          <div class="kpi-body">
            <div class="kpi-main">
              <span class="kpi-value">{{ dashboard.production?.activeOrders || 0 }}</span>
              <span class="kpi-label">ordini attivi</span>
            </div>
            <div class="kpi-stats">
              <div class="stat-item success">
                <span class="stat-value">{{ dashboard.production?.readyToStart || 0 }}</span>
                <span class="stat-label">pronti</span>
              </div>
              <div class="stat-item warning" v-if="dashboard.production?.waitingMaterials > 0">
                <span class="stat-value">{{ dashboard.production.waitingMaterials }}</span>
                <span class="stat-label">in attesa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div class="alerts-section" v-if="dashboard.alerts?.length > 0">
        <div
          class="alert-item"
          v-for="(alert, index) in dashboard.alerts"
          :key="index"
          :class="`alert-${alert.type.toLowerCase()}`"
        >
          <i :class="getAlertIcon(alert.type)"></i>
          <span>{{ alert.message }}</span>
        </div>
      </div>
    </section>

    <!-- Main Content Tabs -->
    <section class="content-section">
      <TabView v-model:activeIndex="activeTab">
        <!-- Tab Arrivi -->
        <TabPanel header="Arrivi">
          <div class="tab-header">
            <div class="filters">
              <Dropdown
                v-model="incomingFilters.daysAhead"
                :options="daysOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Periodo"
                @change="loadIncoming"
              />
            </div>
            <div class="summary-badges">
              <Tag severity="info">{{ incomingSummary.totalOrders }} ordini</Tag>
              <Tag severity="warning" v-if="incomingSummary.inTransit > 0">
                {{ incomingSummary.inTransit }} in transito
              </Tag>
              <Tag severity="danger" v-if="incomingSummary.delayed > 0">
                {{ incomingSummary.delayed }} in ritardo
              </Tag>
            </div>
          </div>

          <DataTable
            :value="incomingMaterials"
            :loading="loadingIncoming"
            responsiveLayout="scroll"
            class="logistics-table"
            :expandedRows="expandedIncoming"
            @rowToggle="onIncomingRowToggle"
            dataKey="purchaseOrderId"
          >
            <Column expander style="width: 3rem" />
            <Column field="orderNumber" header="Ordine" style="min-width: 120px">
              <template #body="{ data }">
                <span class="order-number">{{ data.orderNumber }}</span>
              </template>
            </Column>
            <Column field="supplierName" header="Fornitore" style="min-width: 180px" />
            <Column field="estimatedDeliveryDate" header="Data Prevista" style="min-width: 140px">
              <template #body="{ data }">
                <span v-if="data.estimatedDeliveryDate" :class="getDateClass(data.estimatedDeliveryDate)">
                  {{ formatDate(data.estimatedDeliveryDate) }}
                </span>
                <span v-else class="text-muted">Non definita</span>
              </template>
            </Column>
            <Column field="deliveryStatus" header="Stato" style="min-width: 120px">
              <template #body="{ data }">
                <Tag :severity="getDeliveryStatusSeverity(data.deliveryStatus)">
                  {{ getDeliveryStatusLabel(data.deliveryStatus) }}
                </Tag>
              </template>
            </Column>
            <Column header="Articoli Pendenti" style="min-width: 120px">
              <template #body="{ data }">
                <span class="items-count">{{ data.items.length }} articoli</span>
              </template>
            </Column>

            <template #expansion="slotProps">
              <div class="expansion-content">
                <h5>Articoli in arrivo</h5>
                <DataTable :value="slotProps.data.items" class="nested-table">
                  <Column field="itemName" header="Articolo" />
                  <Column field="sku" header="SKU" />
                  <Column field="orderedQty" header="Ordinato" />
                  <Column field="receivedQty" header="Ricevuto" />
                  <Column field="pendingQty" header="Pendente">
                    <template #body="{ data }">
                      <span class="pending-qty">{{ data.pendingQty }}</span>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </template>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-inbox"></i>
                <p>Nessun arrivo previsto</p>
              </div>
            </template>
          </DataTable>
        </TabPanel>

        <!-- Tab Evasione Ordini -->
        <TabPanel header="Evasione Ordini">
          <div class="tab-header">
            <div class="filters">
              <Dropdown
                v-model="fulfillmentFilters.status"
                :options="fulfillmentStatusOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Stato"
                @change="loadFulfillment"
                showClear
              />
            </div>
            <div class="summary-badges">
              <Tag severity="success">{{ fulfillmentSummary.readyToShip }} pronti</Tag>
              <Tag severity="warning" v-if="fulfillmentSummary.partiallyReady > 0">
                {{ fulfillmentSummary.partiallyReady }} parziali
              </Tag>
              <Tag severity="danger" v-if="fulfillmentSummary.blocked > 0">
                {{ fulfillmentSummary.blocked }} bloccati
              </Tag>
            </div>
          </div>

          <DataTable
            :value="fulfillmentOrders"
            :loading="loadingFulfillment"
            responsiveLayout="scroll"
            class="logistics-table"
            :expandedRows="expandedFulfillment"
            @rowToggle="onFulfillmentRowToggle"
            dataKey="orderId"
          >
            <Column expander style="width: 3rem" />
            <Column field="orderNumber" header="Ordine" style="min-width: 120px">
              <template #body="{ data }">
                <div class="order-info">
                  <span class="order-number">{{ data.orderNumber }}</span>
                  <Tag
                    v-if="data.priority === 'HIGH'"
                    severity="danger"
                    class="priority-badge"
                  >
                    Urgente
                  </Tag>
                </div>
              </template>
            </Column>
            <Column field="customerName" header="Cliente" style="min-width: 180px" />
            <Column field="orderDate" header="Data Ordine" style="min-width: 120px">
              <template #body="{ data }">
                {{ formatDate(data.orderDate) }}
              </template>
            </Column>
            <Column field="totalAmount" header="Totale" style="min-width: 100px">
              <template #body="{ data }">
                <span class="amount">{{ formatCurrency(data.totalAmount) }}</span>
              </template>
            </Column>
            <Column field="fulfillmentStatus" header="Stato Evasione" style="min-width: 140px">
              <template #body="{ data }">
                <Tag :severity="getFulfillmentStatusSeverity(data.fulfillmentStatus)">
                  {{ getFulfillmentStatusLabel(data.fulfillmentStatus) }}
                </Tag>
              </template>
            </Column>
            <Column field="readyPercentage" header="Completamento" style="min-width: 150px">
              <template #body="{ data }">
                <div class="progress-cell">
                  <ProgressBar
                    :value="data.readyPercentage"
                    :showValue="false"
                    :class="getProgressClass(data.readyPercentage)"
                    style="height: 8px"
                  />
                  <span class="progress-label">{{ data.readyPercentage }}%</span>
                </div>
              </template>
            </Column>
            <Column field="estimatedFulfillmentDate" header="Data Stimata" style="min-width: 120px">
              <template #body="{ data }">
                <span v-if="data.estimatedFulfillmentDate">
                  {{ formatDate(data.estimatedFulfillmentDate) }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>

            <template #expansion="slotProps">
              <div class="expansion-content" v-if="slotProps.data.missingItems.length > 0">
                <h5>Articoli mancanti</h5>
                <DataTable :value="slotProps.data.missingItems" class="nested-table">
                  <Column field="productName" header="Prodotto" />
                  <Column field="sku" header="SKU" />
                  <Column field="requiredQty" header="Richiesto" />
                  <Column field="availableQty" header="Disponibile" />
                  <Column field="shortageQty" header="Mancante">
                    <template #body="{ data }">
                      <span class="shortage-qty">-{{ data.shortageQty }}</span>
                    </template>
                  </Column>
                  <Column field="expectedArrivalDate" header="Arrivo Previsto">
                    <template #body="{ data }">
                      <span v-if="data.expectedArrivalDate">
                        {{ formatDate(data.expectedArrivalDate) }}
                      </span>
                      <span v-else class="text-muted">Non previsto</span>
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div class="expansion-content" v-else>
                <p class="ready-message"><i class="pi pi-check-circle"></i> Tutti gli articoli sono disponibili</p>
              </div>
            </template>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-send"></i>
                <p>Nessun ordine da evadere</p>
              </div>
            </template>
          </DataTable>
        </TabPanel>

        <!-- Tab Pronti a Spedire -->
        <TabPanel header="Pronti a Spedire">
          <div class="tab-header">
            <div class="summary-info">
              <span class="summary-total">{{ readyToShip.totalOrders }} ordini pronti</span>
              <span class="summary-value">Valore: {{ formatCurrency(readyToShip.totalValue) }}</span>
            </div>
          </div>

          <DataTable
            :value="readyToShip.orders"
            :loading="loadingReadyToShip"
            responsiveLayout="scroll"
            class="logistics-table"
          >
            <Column field="orderNumber" header="Ordine" style="min-width: 120px">
              <template #body="{ data }">
                <div class="order-info">
                  <span class="order-number">{{ data.orderNumber }}</span>
                  <Tag
                    v-if="data.priority === 'URGENT'"
                    severity="danger"
                    class="priority-badge"
                  >
                    Urgente
                  </Tag>
                </div>
              </template>
            </Column>
            <Column field="customerName" header="Cliente" style="min-width: 180px" />
            <Column field="shippingAddress" header="Indirizzo" style="min-width: 250px">
              <template #body="{ data }">
                <span class="address">{{ data.shippingAddress }}</span>
              </template>
            </Column>
            <Column field="itemCount" header="Articoli" style="min-width: 80px" />
            <Column field="totalAmount" header="Totale" style="min-width: 100px">
              <template #body="{ data }">
                <span class="amount">{{ formatCurrency(data.totalAmount) }}</span>
              </template>
            </Column>
            <Column field="shippingMethod" header="Spedizione" style="min-width: 120px">
              <template #body="{ data }">
                <span v-if="data.shippingMethod">{{ data.shippingMethod }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>
            <Column field="createdAt" header="Data Ordine" style="min-width: 120px">
              <template #body="{ data }">
                {{ formatDate(data.createdAt) }}
              </template>
            </Column>
            <Column header="Azioni" style="min-width: 100px">
              <template #body="{ data }">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text"
                  @click="viewOrder(data.orderId)"
                  v-tooltip.top="'Visualizza ordine'"
                />
              </template>
            </Column>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-box"></i>
                <p>Nessun ordine pronto per la spedizione</p>
              </div>
            </template>
          </DataTable>
        </TabPanel>

        <!-- Tab Produzione -->
        <TabPanel header="Produzione">
          <div class="tab-header">
            <div class="filters">
              <Dropdown
                v-model="productionFilters.status"
                :options="productionStatusOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Stato"
                @change="loadProduction"
                showClear
              />
            </div>
            <div class="summary-badges">
              <Tag severity="success">{{ productionSummary.readyToStart }} pronti</Tag>
              <Tag severity="info" v-if="productionSummary.inProgress > 0">
                {{ productionSummary.inProgress }} in corso
              </Tag>
              <Tag severity="warning" v-if="productionSummary.waitingMaterials > 0">
                {{ productionSummary.waitingMaterials }} in attesa
              </Tag>
            </div>
          </div>

          <DataTable
            :value="productionSchedule"
            :loading="loadingProduction"
            responsiveLayout="scroll"
            class="logistics-table"
            :expandedRows="expandedProduction"
            @rowToggle="onProductionRowToggle"
            dataKey="productionOrderId"
          >
            <Column expander style="width: 3rem" />
            <Column field="orderNumber" header="Ordine" style="min-width: 120px">
              <template #body="{ data }">
                <div class="order-info">
                  <span class="order-number">{{ data.orderNumber }}</span>
                  <Tag
                    v-if="data.priority === 'HIGH'"
                    severity="danger"
                    class="priority-badge"
                  >
                    Urgente
                  </Tag>
                </div>
              </template>
            </Column>
            <Column field="productName" header="Prodotto" style="min-width: 200px">
              <template #body="{ data }">
                <div class="product-info">
                  <span class="product-name">{{ data.productName }}</span>
                  <span class="product-sku">{{ data.sku }}</span>
                </div>
              </template>
            </Column>
            <Column field="quantity" header="Quantita" style="min-width: 80px" />
            <Column field="status" header="Stato" style="min-width: 120px">
              <template #body="{ data }">
                <Tag :severity="getProductionStatusSeverity(data.status)">
                  {{ getProductionStatusLabel(data.status) }}
                </Tag>
              </template>
            </Column>
            <Column field="materialsReady" header="Materiali" style="min-width: 120px">
              <template #body="{ data }">
                <Tag :severity="data.materialsReady ? 'success' : 'warning'">
                  {{ data.materialsReady ? 'Pronti' : 'In attesa' }}
                </Tag>
              </template>
            </Column>
            <Column field="dueDate" header="Scadenza" style="min-width: 120px">
              <template #body="{ data }">
                <span v-if="data.dueDate" :class="getDateClass(data.dueDate)">
                  {{ formatDate(data.dueDate) }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>
            <Column field="linkedOrderNumber" header="Ordine Cliente" style="min-width: 120px">
              <template #body="{ data }">
                <span v-if="data.linkedOrderNumber" class="linked-order">
                  {{ data.linkedOrderNumber }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>

            <template #expansion="slotProps">
              <div class="expansion-content" v-if="slotProps.data.missingMaterials.length > 0">
                <h5>Materiali mancanti</h5>
                <DataTable :value="slotProps.data.missingMaterials" class="nested-table">
                  <Column field="materialName" header="Materiale" />
                  <Column field="code" header="Codice" />
                  <Column field="requiredQty" header="Richiesto" />
                  <Column field="availableQty" header="Disponibile" />
                  <Column field="shortageQty" header="Mancante">
                    <template #body="{ data }">
                      <span class="shortage-qty">-{{ data.shortageQty }}</span>
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div class="expansion-content" v-else>
                <p class="ready-message"><i class="pi pi-check-circle"></i> Tutti i materiali sono disponibili</p>
              </div>
            </template>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-cog"></i>
                <p>Nessun ordine di produzione</p>
              </div>
            </template>
          </DataTable>
        </TabPanel>
      </TabView>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Dropdown from 'primevue/dropdown';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';

const toast = useToast();
const router = useRouter();

// State
const loading = ref(false);
const activeTab = ref(0);

// Dashboard
const dashboard = ref<any>({});

// Incoming Materials
const incomingMaterials = ref<any[]>([]);
const incomingSummary = ref<any>({});
const loadingIncoming = ref(false);
const expandedIncoming = ref<any[]>([]);
const incomingFilters = ref({
  daysAhead: 30,
});

// Fulfillment
const fulfillmentOrders = ref<any[]>([]);
const fulfillmentSummary = ref<any>({});
const loadingFulfillment = ref(false);
const expandedFulfillment = ref<any[]>([]);
const fulfillmentFilters = ref({
  status: null as string | null,
});

// Ready to Ship
const readyToShip = ref<any>({ orders: [], totalValue: 0, totalOrders: 0 });
const loadingReadyToShip = ref(false);

// Production
const productionSchedule = ref<any[]>([]);
const productionSummary = ref<any>({});
const loadingProduction = ref(false);
const expandedProduction = ref<any[]>([]);
const productionFilters = ref({
  status: null as string | null,
});

// Options
const daysOptions = [
  { label: '7 giorni', value: 7 },
  { label: '14 giorni', value: 14 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
];

const fulfillmentStatusOptions = [
  { label: 'Pronti', value: 'READY' },
  { label: 'Parziali', value: 'PARTIAL' },
  { label: 'Bloccati', value: 'BLOCKED' },
  { label: 'In attesa materiali', value: 'WAITING_MATERIALS' },
];

const productionStatusOptions = [
  { label: 'In attesa', value: 'PENDING' },
  { label: 'Programmato', value: 'SCHEDULED' },
  { label: 'In corso', value: 'IN_PROGRESS' },
  { label: 'In pausa', value: 'PAUSED' },
];

// Formatters
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string | Date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

// Status helpers
const getDeliveryStatusSeverity = (status: string) => {
  switch (status) {
    case 'DELIVERED': return 'success';
    case 'IN_TRANSIT':
    case 'SHIPPED': return 'info';
    case 'DELAYED': return 'danger';
    default: return 'warning';
  }
};

const getDeliveryStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'In attesa',
    SHIPPED: 'Spedito',
    IN_TRANSIT: 'In transito',
    DELIVERED: 'Consegnato',
    DELAYED: 'In ritardo',
  };
  return labels[status] || status;
};

const getFulfillmentStatusSeverity = (status: string) => {
  switch (status) {
    case 'READY': return 'success';
    case 'PARTIAL': return 'warning';
    case 'BLOCKED': return 'danger';
    case 'WAITING_MATERIALS': return 'info';
    default: return 'secondary';
  }
};

const getFulfillmentStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    READY: 'Pronto',
    PARTIAL: 'Parziale',
    BLOCKED: 'Bloccato',
    WAITING_MATERIALS: 'In attesa',
  };
  return labels[status] || status;
};

const getProductionStatusSeverity = (status: string) => {
  switch (status) {
    case 'IN_PROGRESS': return 'info';
    case 'COMPLETED': return 'success';
    case 'PAUSED': return 'warning';
    case 'CANCELLED': return 'danger';
    default: return 'secondary';
  }
};

const getProductionStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'In attesa',
    SCHEDULED: 'Programmato',
    IN_PROGRESS: 'In corso',
    PAUSED: 'In pausa',
    COMPLETED: 'Completato',
    CANCELLED: 'Annullato',
  };
  return labels[status] || status;
};

const getDateClass = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d < today) return 'date-overdue';
  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  if (d <= threeDays) return 'date-soon';
  return '';
};

const getProgressClass = (value: number) => {
  if (value >= 100) return 'progress-success';
  if (value >= 50) return 'progress-warning';
  return 'progress-danger';
};

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'ERROR': return 'pi pi-times-circle';
    case 'WARNING': return 'pi pi-exclamation-triangle';
    default: return 'pi pi-info-circle';
  }
};

// Data loading
const loadDashboard = async () => {
  try {
    const response = await api.get('/logistics/dashboard');
    if (response.success) {
      dashboard.value = response.data;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
};

const loadIncoming = async () => {
  loadingIncoming.value = true;
  try {
    const params = new URLSearchParams({
      daysAhead: incomingFilters.value.daysAhead.toString(),
    });
    const response = await api.get(`/logistics/incoming?${params.toString()}`);
    if (response.success) {
      incomingMaterials.value = response.data.incoming || [];
      incomingSummary.value = response.data.summary || {};
    }
  } catch (error) {
    console.error('Error loading incoming:', error);
  } finally {
    loadingIncoming.value = false;
  }
};

const loadFulfillment = async () => {
  loadingFulfillment.value = true;
  try {
    const params = new URLSearchParams();
    if (fulfillmentFilters.value.status) {
      // Filter client-side since API returns all
    }
    const response = await api.get(`/logistics/fulfillment-forecast?${params.toString()}`);
    if (response.success) {
      let orders = response.data.orders || [];
      if (fulfillmentFilters.value.status) {
        orders = orders.filter((o: any) => o.fulfillmentStatus === fulfillmentFilters.value.status);
      }
      fulfillmentOrders.value = orders;
      fulfillmentSummary.value = response.data.summary || {};
    }
  } catch (error) {
    console.error('Error loading fulfillment:', error);
  } finally {
    loadingFulfillment.value = false;
  }
};

const loadReadyToShip = async () => {
  loadingReadyToShip.value = true;
  try {
    const response = await api.get('/logistics/ready-to-ship');
    if (response.success) {
      readyToShip.value = response.data;
    }
  } catch (error) {
    console.error('Error loading ready to ship:', error);
  } finally {
    loadingReadyToShip.value = false;
  }
};

const loadProduction = async () => {
  loadingProduction.value = true;
  try {
    const params = new URLSearchParams();
    if (productionFilters.value.status) {
      params.append('status', productionFilters.value.status);
    }
    const response = await api.get(`/logistics/production-schedule?${params.toString()}`);
    if (response.success) {
      productionSchedule.value = response.data.schedule || [];
      productionSummary.value = response.data.summary || {};
    }
  } catch (error) {
    console.error('Error loading production:', error);
  } finally {
    loadingProduction.value = false;
  }
};

const refreshAll = async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadDashboard(),
      loadIncoming(),
      loadFulfillment(),
      loadReadyToShip(),
      loadProduction(),
    ]);
    toast.add({
      severity: 'success',
      summary: 'Aggiornato',
      detail: 'Dati aggiornati con successo',
      life: 2000,
    });
  } finally {
    loading.value = false;
  }
};

// Row toggles
const onIncomingRowToggle = (event: any) => {
  expandedIncoming.value = event.data;
};

const onFulfillmentRowToggle = (event: any) => {
  expandedFulfillment.value = event.data;
};

const onProductionRowToggle = (event: any) => {
  expandedProduction.value = event.data;
};

// Navigation
const viewOrder = (orderId: string) => {
  router.push(`/orders?view=${orderId}`);
};

// Initialize
onMounted(() => {
  loadDashboard();
  loadIncoming();
  loadFulfillment();
  loadReadyToShip();
  loadProduction();
});
</script>

<style scoped>
.logistics-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Dashboard Section */
.dashboard-section {
  margin-bottom: var(--space-8);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  margin-bottom: var(--space-6);
}

.kpi-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.kpi-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.kpi-card.incoming .kpi-icon {
  background: var(--blue-100);
  color: var(--blue-600);
}

.kpi-card.fulfillment .kpi-icon {
  background: var(--green-100);
  color: var(--green-600);
}

.kpi-card.production .kpi-icon {
  background: var(--purple-100);
  color: var(--purple-600);
}

.kpi-header h4 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
}

.kpi-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.kpi-main {
  display: flex;
  flex-direction: column;
}

.kpi-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1;
}

.kpi-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

.kpi-stats {
  display: flex;
  gap: var(--space-4);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-sm);
}

.stat-item.warning {
  background: var(--orange-50);
}

.stat-item.warning .stat-value {
  color: var(--orange-600);
}

.stat-item.danger {
  background: var(--red-50);
}

.stat-item.danger .stat-value {
  color: var(--red-600);
}

.stat-item.success {
  background: var(--green-50);
}

.stat-item.success .stat-value {
  color: var(--green-600);
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-gray-900);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.kpi-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-3);
  border-top: var(--border-width) solid var(--border-color-light);
}

.kpi-footer-value {
  font-weight: 600;
  color: var(--color-gray-700);
}

.kpi-footer-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Alerts */
.alerts-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.alert-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.alert-item.alert-warning {
  background: var(--orange-50);
  color: var(--orange-700);
  border: 1px solid var(--orange-200);
}

.alert-item.alert-error {
  background: var(--red-50);
  color: var(--red-700);
  border: 1px solid var(--red-200);
}

.alert-item.alert-info {
  background: var(--blue-50);
  color: var(--blue-700);
  border: 1px solid var(--blue-200);
}

/* Content Section */
.content-section {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding: var(--space-4) 0;
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.filters {
  display: flex;
  gap: var(--space-3);
}

.summary-badges {
  display: flex;
  gap: var(--space-2);
}

.summary-info {
  display: flex;
  gap: var(--space-4);
}

.summary-total {
  font-weight: 600;
  color: var(--color-gray-900);
}

.summary-value {
  color: var(--color-gray-600);
}

/* Tables */
.logistics-table {
  margin-top: var(--space-4);
}

.order-number {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-primary-700);
}

.order-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.priority-badge {
  font-size: var(--font-size-xs);
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.product-sku {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-gray-500);
}

.items-count {
  color: var(--color-gray-600);
}

.amount {
  font-weight: 600;
  color: var(--color-success);
}

.address {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.linked-order {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-primary-600);
}

.text-muted {
  color: var(--color-gray-400);
}

.date-overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.date-soon {
  color: var(--color-warning);
  font-weight: 500;
}

.pending-qty,
.shortage-qty {
  font-weight: 600;
  color: var(--color-danger);
}

/* Progress */
.progress-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  min-width: 40px;
}

:deep(.progress-success .p-progressbar-value) {
  background: var(--green-500);
}

:deep(.progress-warning .p-progressbar-value) {
  background: var(--orange-500);
}

:deep(.progress-danger .p-progressbar-value) {
  background: var(--red-500);
}

/* Expansion */
.expansion-content {
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  margin: var(--space-2) 0;
}

.expansion-content h5 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
}

.nested-table {
  font-size: var(--font-size-sm);
}

.ready-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-weight: 500;
  margin: 0;
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

.empty-state i {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state p {
  color: var(--color-gray-500);
  margin: 0;
}

/* Responsive */
@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .tab-header {
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }

  .kpi-body {
    flex-direction: column;
    gap: var(--space-3);
  }

  .kpi-stats {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
