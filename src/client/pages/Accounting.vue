<template>
  <div class="accounting-page">
    <PageHeader
      title="Contabilità"
      subtitle="Dashboard finanziaria, scadenzario e previsioni cash flow"
      icon="pi pi-calculator"
    />

    <TabView v-model:activeIndex="activeTabIndex" class="accounting-tabs">
      <!-- TAB: Dashboard -->
      <TabPanel header="Dashboard">
        <div class="dashboard-content">
          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card kpi-card--primary">
              <div class="kpi-card__header">
                <i class="pi pi-wallet"></i>
                <span>Posizione di Cassa</span>
              </div>
              <div class="kpi-card__value" :class="{ 'negative': dashboard.cashPosition?.current < 0 }">
                {{ formatCurrency(dashboard.cashPosition?.current || 0) }}
              </div>
              <div class="kpi-card__sub">
                Proiezione 30gg: {{ formatCurrency(dashboard.cashPosition?.projected30Days || 0) }}
              </div>
            </div>

            <div class="kpi-card kpi-card--success">
              <div class="kpi-card__header">
                <i class="pi pi-arrow-down"></i>
                <span>Crediti Attivi</span>
              </div>
              <div class="kpi-card__value">{{ formatCurrency(dashboard.receivables?.total || 0) }}</div>
              <div class="kpi-card__sub text-warning">
                Scaduti: {{ formatCurrency(dashboard.receivables?.overdue || 0) }} ({{ dashboard.receivables?.overdueCount || 0 }})
              </div>
            </div>

            <div class="kpi-card kpi-card--warning">
              <div class="kpi-card__header">
                <i class="pi pi-arrow-up"></i>
                <span>Debiti Passivi</span>
              </div>
              <div class="kpi-card__value">{{ formatCurrency(dashboard.payables?.total || 0) }}</div>
              <div class="kpi-card__sub text-danger">
                Scaduti: {{ formatCurrency(dashboard.payables?.overdue || 0) }} ({{ dashboard.payables?.overdueCount || 0 }})
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-card__header">
                <i class="pi pi-calendar"></i>
                <span>Prossimi 30 Giorni</span>
              </div>
              <div class="kpi-card__value">
                {{ formatCurrency((dashboard.receivables?.dueNext30Days || 0) - (dashboard.payables?.dueNext30Days || 0)) }}
              </div>
              <div class="kpi-card__sub">
                Entrate: {{ formatCurrency(dashboard.receivables?.dueNext30Days || 0) }} | Uscite: {{ formatCurrency(dashboard.payables?.dueNext30Days || 0) }}
              </div>
            </div>
          </div>

          <!-- Aging Charts -->
          <div class="charts-grid">
            <div class="chart-card">
              <h3 class="chart-title">Aging Crediti</h3>
              <div class="aging-bars">
                <div
                  v-for="bucket in dashboard.aging?.receivables || []"
                  :key="bucket.label"
                  class="aging-bar"
                >
                  <div class="aging-bar__label">{{ bucket.label }}</div>
                  <div class="aging-bar__track">
                    <div
                      class="aging-bar__fill aging-bar__fill--receivable"
                      :style="{ width: bucket.percentage + '%' }"
                    ></div>
                  </div>
                  <div class="aging-bar__value">{{ formatCurrency(bucket.amount) }}</div>
                </div>
              </div>
            </div>

            <div class="chart-card">
              <h3 class="chart-title">Aging Debiti</h3>
              <div class="aging-bars">
                <div
                  v-for="bucket in dashboard.aging?.payables || []"
                  :key="bucket.label"
                  class="aging-bar"
                >
                  <div class="aging-bar__label">{{ bucket.label }}</div>
                  <div class="aging-bar__track">
                    <div
                      class="aging-bar__fill aging-bar__fill--payable"
                      :style="{ width: bucket.percentage + '%' }"
                    ></div>
                  </div>
                  <div class="aging-bar__value">{{ formatCurrency(bucket.amount) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- TAB: Scadenzario -->
      <TabPanel header="Scadenzario">
        <div class="section-card">
          <div class="section-header">
            <h2 class="section-title">Scadenzario</h2>
            <div class="header-actions">
              <Button label="Nuova Scadenza" icon="pi pi-plus" size="small" @click="showPaymentDueDialog = true" />
            </div>
          </div>

          <div class="table-toolbar">
            <div class="filters">
              <div class="filter-group">
                <label>Tipo</label>
                <Dropdown
                  v-model="dueFilters.type"
                  :options="dueTypes"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutti"
                  @change="loadPaymentDues"
                  showClear
                  class="filter-dropdown"
                />
              </div>
              <div class="filter-group">
                <label>Stato</label>
                <Dropdown
                  v-model="dueFilters.status"
                  :options="dueStatuses"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutti"
                  @change="loadPaymentDues"
                  showClear
                  class="filter-dropdown"
                />
              </div>
              <div class="filter-group">
                <label>Solo Scaduti</label>
                <InputSwitch
                  v-model="dueFilters.overdue"
                  @change="loadPaymentDues"
                />
              </div>
            </div>
          </div>

          <DataTable
            :value="paymentDues"
            :loading="loadingDues"
            responsiveLayout="scroll"
            stripedRows
            class="custom-table"
            :rowHover="true"
            :paginator="true"
            :rows="20"
          >
            <Column field="dueDate" header="Scadenza" sortable>
              <template #body="{ data }">
                <span :class="{ 'text-danger font-bold': data.daysOverdue > 0 }">
                  {{ formatDate(data.dueDate) }}
                  <span v-if="data.daysOverdue > 0" class="overdue-badge">
                    {{ data.daysOverdue }}gg
                  </span>
                </span>
              </template>
            </Column>
            <Column field="type" header="Tipo" sortable>
              <template #body="{ data }">
                <Tag :severity="data.type === 'RECEIVABLE' ? 'success' : 'warning'">
                  {{ data.type === 'RECEIVABLE' ? 'Credito' : 'Debito' }}
                </Tag>
              </template>
            </Column>
            <Column field="description" header="Descrizione"></Column>
            <Column field="entity" header="Cliente/Fornitore">
              <template #body="{ data }">
                {{ data.customer?.businessName || data.supplier?.businessName || 'N/A' }}
              </template>
            </Column>
            <Column field="invoice" header="Fattura">
              <template #body="{ data }">
                {{ data.invoice?.invoiceNumber || data.supplierInvoice?.invoiceNumber || '-' }}
              </template>
            </Column>
            <Column field="amount" header="Importo" sortable>
              <template #body="{ data }">
                <span class="amount-value">{{ formatCurrency(data.amount) }}</span>
              </template>
            </Column>
            <Column field="remainingAmount" header="Residuo">
              <template #body="{ data }">
                <span :class="{ 'text-success': data.remainingAmount === 0 }">
                  {{ formatCurrency(data.remainingAmount) }}
                </span>
              </template>
            </Column>
            <Column field="status" header="Stato" sortable>
              <template #body="{ data }">
                <Tag :severity="getStatusSeverity(data.status)">
                  {{ formatStatus(data.status) }}
                </Tag>
              </template>
            </Column>
            <Column header="Azioni" style="min-width: 120px">
              <template #body="{ data }">
                <div class="action-buttons">
                  <Button
                    v-if="data.status !== 'PAID'"
                    icon="pi pi-dollar"
                    class="p-button-rounded p-button-text action-btn action-btn--success"
                    @click="openRecordPaymentDialog(data)"
                    v-tooltip.top="'Registra Pagamento'"
                  />
                  <Button
                    icon="pi pi-eye"
                    class="p-button-rounded p-button-text action-btn action-btn--view"
                    @click="viewPaymentDue(data)"
                    v-tooltip.top="'Dettaglio'"
                  />
                </div>
              </template>
            </Column>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-calendar empty-state__icon"></i>
                <p class="empty-state__text">Nessuna scadenza trovata</p>
              </div>
            </template>
          </DataTable>
        </div>
      </TabPanel>

      <!-- TAB: Fatture -->
      <TabPanel header="Fatture">
        <div class="section-card">
          <div class="section-header">
            <h2 class="section-title">Fatture</h2>
            <Button label="Nuova Fattura" icon="pi pi-plus" size="small" @click="showInvoiceDialog = true" />
          </div>

          <div class="table-toolbar">
            <div class="filters">
              <div class="filter-group">
                <label>Tipo</label>
                <Dropdown
                  v-model="invoiceFilters.type"
                  :options="invoiceTypes"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutti"
                  @change="loadInvoices"
                  showClear
                  class="filter-dropdown"
                />
              </div>
              <div class="filter-group">
                <label>Stato</label>
                <Dropdown
                  v-model="invoiceFilters.status"
                  :options="invoiceStatuses"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutti"
                  @change="loadInvoices"
                  showClear
                  class="filter-dropdown"
                />
              </div>
            </div>
          </div>

          <DataTable
            :value="invoices"
            :loading="loadingInvoices"
            responsiveLayout="scroll"
            stripedRows
            class="custom-table"
            :rowHover="true"
            :paginator="true"
            :rows="20"
          >
            <Column field="invoiceNumber" header="Numero" sortable></Column>
            <Column field="issueDate" header="Data" sortable>
              <template #body="{ data }">{{ formatDate(data.issueDate) }}</template>
            </Column>
            <Column field="type" header="Tipo">
              <template #body="{ data }">
                <Tag :severity="data.type === 'SALE' ? 'info' : 'warning'">
                  {{ data.type === 'SALE' ? 'Vendita' : 'Acquisto' }}
                </Tag>
              </template>
            </Column>
            <Column field="customer" header="Cliente/Fornitore">
              <template #body="{ data }">
                {{ data.customer?.businessName || data.customer?.firstName + ' ' + data.customer?.lastName || 'N/A' }}
              </template>
            </Column>
            <Column field="total" header="Totale" sortable>
              <template #body="{ data }">
                <span class="amount-value">{{ formatCurrency(data.total) }}</span>
              </template>
            </Column>
            <Column field="status" header="Stato" sortable>
              <template #body="{ data }">
                <Tag :severity="getInvoiceStatusSeverity(data.status)">
                  {{ formatInvoiceStatus(data.status) }}
                </Tag>
              </template>
            </Column>
            <Column header="Azioni" style="min-width: 150px">
              <template #body="{ data }">
                <div class="action-buttons">
                  <Button
                    icon="pi pi-calendar-plus"
                    class="p-button-rounded p-button-text action-btn"
                    @click="generateDuesFromInvoice(data)"
                    v-tooltip.top="'Genera Scadenze'"
                  />
                  <Button
                    icon="pi pi-eye"
                    class="p-button-rounded p-button-text action-btn action-btn--view"
                    @click="viewInvoice(data)"
                    v-tooltip.top="'Dettaglio'"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </TabPanel>

      <!-- TAB: Cash Flow -->
      <TabPanel header="Cash Flow">
        <div class="cashflow-content">
          <div class="section-header mb-4">
            <h2 class="section-title">Previsione Cash Flow</h2>
            <div class="header-actions">
              <Dropdown
                v-model="cashFlowMonths"
                :options="[3, 6, 12]"
                @change="loadCashFlowForecast"
                class="months-dropdown"
              />
              <span class="months-label">mesi</span>
            </div>
          </div>

          <!-- Summary Cards -->
          <div class="cashflow-summary">
            <div class="summary-card">
              <div class="summary-label">Saldo Iniziale</div>
              <div class="summary-value">{{ formatCurrency(cashFlow.initialBalance || 0) }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Tasso Incasso</div>
              <div class="summary-value">{{ cashFlow.collectionRate || 0 }}%</div>
            </div>
            <div class="summary-card" :class="{ 'text-danger': (cashFlow.summary?.endBalanceRealistic || 0) < 0 }">
              <div class="summary-label">Saldo Finale (Realistico)</div>
              <div class="summary-value">{{ formatCurrency(cashFlow.summary?.endBalanceRealistic || 0) }}</div>
            </div>
            <div class="summary-card text-warning" v-if="(cashFlow.summary?.criticalMonths?.length || 0) > 0">
              <div class="summary-label">Mesi Critici</div>
              <div class="summary-value">{{ cashFlow.summary?.criticalMonths?.join(', ') }}</div>
            </div>
          </div>

          <!-- Forecast Table -->
          <div class="section-card mt-4">
            <DataTable
              :value="cashFlow.forecast || []"
              :loading="loadingCashFlow"
              responsiveLayout="scroll"
              class="custom-table cashflow-table"
            >
              <Column field="monthLabel" header="Mese" frozen></Column>
              <Column header="Crediti Programmati">
                <template #body="{ data }">{{ formatCurrency(data.scheduledReceivables) }}</template>
              </Column>
              <Column header="Debiti Programmati">
                <template #body="{ data }">{{ formatCurrency(data.scheduledPayables) }}</template>
              </Column>
              <ColumnGroup type="header">
                <Row>
                  <Column header="Mese" :rowspan="2" />
                  <Column header="Programmato" :colspan="2" />
                  <Column header="Ottimistico" :colspan="2" />
                  <Column header="Realistico" :colspan="2" />
                  <Column header="Pessimistico" :colspan="2" />
                </Row>
                <Row>
                  <Column header="Crediti" />
                  <Column header="Debiti" />
                  <Column header="Netto" />
                  <Column header="Cumulativo" />
                  <Column header="Netto" />
                  <Column header="Cumulativo" />
                  <Column header="Netto" />
                  <Column header="Cumulativo" />
                </Row>
              </ColumnGroup>
              <Column field="scenarios.optimistic.net" header="Netto Ott.">
                <template #body="{ data }">
                  <span :class="{ 'text-success': data.scenarios.optimistic.net > 0, 'text-danger': data.scenarios.optimistic.net < 0 }">
                    {{ formatCurrency(data.scenarios.optimistic.net) }}
                  </span>
                </template>
              </Column>
              <Column field="scenarios.optimistic.cumulative" header="Cum. Ott.">
                <template #body="{ data }">
                  <span :class="{ 'text-success': data.scenarios.optimistic.cumulative > 0, 'text-danger': data.scenarios.optimistic.cumulative < 0 }">
                    {{ formatCurrency(data.scenarios.optimistic.cumulative) }}
                  </span>
                </template>
              </Column>
              <Column field="scenarios.realistic.net" header="Netto Real.">
                <template #body="{ data }">
                  <span class="font-bold" :class="{ 'text-success': data.scenarios.realistic.net > 0, 'text-danger': data.scenarios.realistic.net < 0 }">
                    {{ formatCurrency(data.scenarios.realistic.net) }}
                  </span>
                </template>
              </Column>
              <Column field="scenarios.realistic.cumulative" header="Cum. Real.">
                <template #body="{ data }">
                  <span class="font-bold" :class="{ 'text-success': data.scenarios.realistic.cumulative > 0, 'text-danger': data.scenarios.realistic.cumulative < 0 }">
                    {{ formatCurrency(data.scenarios.realistic.cumulative) }}
                  </span>
                </template>
              </Column>
              <Column field="scenarios.pessimistic.net" header="Netto Pess.">
                <template #body="{ data }">
                  <span :class="{ 'text-success': data.scenarios.pessimistic.net > 0, 'text-danger': data.scenarios.pessimistic.net < 0 }">
                    {{ formatCurrency(data.scenarios.pessimistic.net) }}
                  </span>
                </template>
              </Column>
              <Column field="scenarios.pessimistic.cumulative" header="Cum. Pess.">
                <template #body="{ data }">
                  <span :class="{ 'text-success': data.scenarios.pessimistic.cumulative > 0, 'text-danger': data.scenarios.pessimistic.cumulative < 0 }">
                    {{ formatCurrency(data.scenarios.pessimistic.cumulative) }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </TabPanel>

      <!-- TAB: Raccomandazioni -->
      <TabPanel header="Raccomandazioni">
        <div class="recommendations-content">
          <div class="section-header mb-4">
            <h2 class="section-title">Raccomandazioni Finanziarie</h2>
            <Button icon="pi pi-refresh" label="Aggiorna" size="small" @click="loadRecommendations" :loading="loadingRecommendations" />
          </div>

          <!-- Summary -->
          <div class="recommendations-summary" v-if="recommendations.summary">
            <Tag severity="danger" class="summary-tag">{{ recommendations.summary.byPriority?.high || 0 }} Alte</Tag>
            <Tag severity="warning" class="summary-tag">{{ recommendations.summary.byPriority?.medium || 0 }} Medie</Tag>
            <Tag severity="info" class="summary-tag">{{ recommendations.summary.byPriority?.low || 0 }} Basse</Tag>
          </div>

          <!-- Recommendations List -->
          <div class="recommendations-list">
            <div
              v-for="(rec, index) in recommendations.recommendations || []"
              :key="index"
              class="recommendation-card"
              :class="`recommendation-card--${rec.type.toLowerCase()}`"
            >
              <div class="rec-header">
                <div class="rec-type">
                  <i :class="getRecTypeIcon(rec.type)"></i>
                  <Tag :severity="getRecTypeSeverity(rec.type)">{{ rec.category }}</Tag>
                </div>
                <Tag :severity="getRecPrioritySeverity(rec.priority)" class="rec-priority">
                  {{ rec.priority }}
                </Tag>
              </div>
              <h3 class="rec-title">{{ rec.title }}</h3>
              <p class="rec-description">{{ rec.description }}</p>
              <div class="rec-impact">
                <i class="pi pi-exclamation-triangle"></i>
                <span>{{ rec.impact }}</span>
              </div>
              <div class="rec-actions">
                <h4>Azioni Suggerite:</h4>
                <ul>
                  <li v-for="(action, i) in rec.actionItems" :key="i">{{ action }}</li>
                </ul>
              </div>
              <div class="rec-entities" v-if="rec.relatedEntities?.length">
                <h4>Entità Coinvolte:</h4>
                <div class="entity-chips">
                  <Chip
                    v-for="entity in rec.relatedEntities"
                    :key="entity.id"
                    :label="`${entity.name}: ${formatCurrency(entity.amount)}`"
                    class="entity-chip"
                  />
                </div>
              </div>
            </div>

            <div v-if="!recommendations.recommendations?.length && !loadingRecommendations" class="empty-state">
              <i class="pi pi-check-circle empty-state__icon text-success"></i>
              <p class="empty-state__text">Nessuna raccomandazione - situazione finanziaria ottimale!</p>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- TAB: Piani Pagamento -->
      <TabPanel header="Piani Pagamento">
        <div class="section-card">
          <div class="section-header">
            <h2 class="section-title">Piani di Pagamento</h2>
            <Button label="Nuovo Piano" icon="pi pi-plus" size="small" @click="showPaymentPlanDialog = true" />
          </div>

          <DataTable
            :value="paymentPlans"
            :loading="loadingPlans"
            responsiveLayout="scroll"
            stripedRows
            class="custom-table"
            :rowHover="true"
          >
            <Column field="code" header="Codice"></Column>
            <Column field="name" header="Nome"></Column>
            <Column field="installments" header="Rate">
              <template #body="{ data }">
                <div class="installments-preview">
                  <span v-for="(inst, i) in data.installments" :key="i" class="installment-chip">
                    {{ inst.percentage }}% a {{ inst.daysFromInvoice }}gg
                  </span>
                </div>
              </template>
            </Column>
            <Column field="isDefault" header="Default">
              <template #body="{ data }">
                <i v-if="data.isDefault" class="pi pi-check text-success"></i>
                <i v-else class="pi pi-times text-muted"></i>
              </template>
            </Column>
            <Column field="isActive" header="Attivo">
              <template #body="{ data }">
                <Tag :severity="data.isActive ? 'success' : 'danger'">
                  {{ data.isActive ? 'Attivo' : 'Inattivo' }}
                </Tag>
              </template>
            </Column>
          </DataTable>
        </div>
      </TabPanel>
    </TabView>

    <!-- Dialog: Registra Pagamento -->
    <Dialog
      v-model:visible="showRecordPaymentDialog"
      header="Registra Pagamento"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="dialog-form" v-if="selectedPaymentDue">
        <div class="form-info mb-4">
          <p><strong>Scadenza:</strong> {{ selectedPaymentDue.description }}</p>
          <p><strong>Importo Totale:</strong> {{ formatCurrency(selectedPaymentDue.amount) }}</p>
          <p><strong>Residuo:</strong> {{ formatCurrency(selectedPaymentDue.remainingAmount) }}</p>
        </div>

        <div class="form-field">
          <label>Importo Pagamento *</label>
          <InputNumber
            v-model="paymentForm.amount"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            :max="selectedPaymentDue.remainingAmount"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label>Data Pagamento *</label>
          <Calendar v-model="paymentForm.paymentDate" dateFormat="dd/mm/yy" class="w-full" />
        </div>

        <div class="form-field">
          <label>Metodo *</label>
          <Dropdown
            v-model="paymentForm.method"
            :options="paymentMethods"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona metodo"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label>Riferimento</label>
          <InputText v-model="paymentForm.reference" placeholder="CRO, numero assegno, ecc." class="w-full" />
        </div>

        <div class="form-field">
          <label>Note</label>
          <Textarea v-model="paymentForm.notes" rows="2" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="showRecordPaymentDialog = false" />
        <Button label="Registra" icon="pi pi-check" @click="recordPayment" :loading="savingPayment" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';
import Row from 'primevue/row';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Chip from 'primevue/chip';
import Dropdown from 'primevue/dropdown';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import InputSwitch from 'primevue/inputswitch';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';

const toast = useToast();
const activeTabIndex = ref(0);

// Loading states
const loadingDashboard = ref(false);
const loadingDues = ref(false);
const loadingInvoices = ref(false);
const loadingCashFlow = ref(false);
const loadingRecommendations = ref(false);
const loadingPlans = ref(false);
const savingPayment = ref(false);

// Data
const dashboard = ref<any>({});
const paymentDues = ref<any[]>([]);
const invoices = ref<any[]>([]);
const cashFlow = ref<any>({});
const recommendations = ref<any>({});
const paymentPlans = ref<any[]>([]);

// Filters
const dueFilters = ref({
  type: null as string | null,
  status: null as string | null,
  overdue: false,
});

const invoiceFilters = ref({
  type: null as string | null,
  status: null as string | null,
});

const cashFlowMonths = ref(6);

// Dialogs
const showPaymentDueDialog = ref(false);
const showRecordPaymentDialog = ref(false);
const showInvoiceDialog = ref(false);
const showPaymentPlanDialog = ref(false);
const selectedPaymentDue = ref<any>(null);

// Form
const paymentForm = ref({
  amount: 0,
  paymentDate: new Date(),
  method: 'BONIFICO',
  reference: '',
  notes: '',
});

// Options
const dueTypes = [
  { label: 'Crediti', value: 'RECEIVABLE' },
  { label: 'Debiti', value: 'PAYABLE' },
];

const dueStatuses = [
  { label: 'In Attesa', value: 'PENDING' },
  { label: 'Parziale', value: 'PARTIAL' },
  { label: 'Pagato', value: 'PAID' },
  { label: 'Scaduto', value: 'OVERDUE' },
];

const invoiceTypes = [
  { label: 'Vendita', value: 'SALE' },
  { label: 'Acquisto', value: 'PURCHASE' },
];

const invoiceStatuses = [
  { label: 'Emessa', value: 'ISSUED' },
  { label: 'Parzialmente Pagata', value: 'PARTIALLY_PAID' },
  { label: 'Pagata', value: 'PAID' },
  { label: 'Scaduta', value: 'OVERDUE' },
];

const paymentMethods = [
  { label: 'Bonifico', value: 'BONIFICO' },
  { label: 'RiBa', value: 'RIBA' },
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Assegno', value: 'ASSEGNO' },
  { label: 'Carta', value: 'CARTA' },
];

// Formatters
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('it-IT');
};

const formatStatus = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'In Attesa',
    PARTIAL: 'Parziale',
    PAID: 'Pagato',
    OVERDUE: 'Scaduto',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const formatInvoiceStatus = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    ISSUED: 'Emessa',
    PARTIALLY_PAID: 'Parz. Pagata',
    PAID: 'Pagata',
    OVERDUE: 'Scaduta',
    CANCELLED: 'Annullata',
  };
  return map[status] || status;
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'warning',
    PARTIAL: 'info',
    PAID: 'success',
    OVERDUE: 'danger',
    CANCELLED: 'secondary',
  };
  return map[status] || 'info';
};

const getInvoiceStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    ISSUED: 'info',
    PARTIALLY_PAID: 'warning',
    PAID: 'success',
    OVERDUE: 'danger',
    CANCELLED: 'secondary',
  };
  return map[status] || 'info';
};

const getRecTypeIcon = (type: string) => {
  const map: Record<string, string> = {
    WARNING: 'pi pi-exclamation-triangle',
    ACTION: 'pi pi-bolt',
    OPPORTUNITY: 'pi pi-star',
    INFO: 'pi pi-info-circle',
  };
  return map[type] || 'pi pi-info-circle';
};

const getRecTypeSeverity = (type: string) => {
  const map: Record<string, string> = {
    WARNING: 'danger',
    ACTION: 'warning',
    OPPORTUNITY: 'success',
    INFO: 'info',
  };
  return map[type] || 'info';
};

const getRecPrioritySeverity = (priority: string) => {
  const map: Record<string, string> = {
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'info',
  };
  return map[priority] || 'info';
};

// API Calls
const loadDashboard = async () => {
  try {
    loadingDashboard.value = true;
    const response = await api.get('/accounting/dashboard');
    if (response.success) {
      dashboard.value = response.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dashboard',
      life: 3000,
    });
  } finally {
    loadingDashboard.value = false;
  }
};

const loadPaymentDues = async () => {
  try {
    loadingDues.value = true;
    const params = new URLSearchParams({ page: '1', limit: '100' });

    if (dueFilters.value.type) params.append('type', dueFilters.value.type);
    if (dueFilters.value.status) params.append('status', dueFilters.value.status);
    if (dueFilters.value.overdue) params.append('overdue', 'true');

    const response = await api.get(`/accounting/payment-dues?${params.toString()}`);
    if (response.success) {
      paymentDues.value = response.data.items;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento scadenzario',
      life: 3000,
    });
  } finally {
    loadingDues.value = false;
  }
};

const loadInvoices = async () => {
  try {
    loadingInvoices.value = true;
    const params = new URLSearchParams({ page: '1', limit: '100' });

    if (invoiceFilters.value.type) params.append('type', invoiceFilters.value.type);
    if (invoiceFilters.value.status) params.append('status', invoiceFilters.value.status);

    const response = await api.get(`/accounting/invoices?${params.toString()}`);
    if (response.success) {
      invoices.value = response.data.items;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento fatture',
      life: 3000,
    });
  } finally {
    loadingInvoices.value = false;
  }
};

const loadCashFlowForecast = async () => {
  try {
    loadingCashFlow.value = true;
    const response = await api.get(`/accounting/cash-flow/forecast?months=${cashFlowMonths.value}`);
    if (response.success) {
      cashFlow.value = response.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento previsioni cash flow',
      life: 3000,
    });
  } finally {
    loadingCashFlow.value = false;
  }
};

const loadRecommendations = async () => {
  try {
    loadingRecommendations.value = true;
    const response = await api.get('/accounting/recommendations');
    if (response.success) {
      recommendations.value = response.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento raccomandazioni',
      life: 3000,
    });
  } finally {
    loadingRecommendations.value = false;
  }
};

const loadPaymentPlans = async () => {
  try {
    loadingPlans.value = true;
    const response = await api.get('/accounting/payment-plans?activeOnly=false');
    if (response.success) {
      paymentPlans.value = response.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento piani pagamento',
      life: 3000,
    });
  } finally {
    loadingPlans.value = false;
  }
};

// Actions
const openRecordPaymentDialog = (due: any) => {
  selectedPaymentDue.value = due;
  paymentForm.value = {
    amount: due.remainingAmount,
    paymentDate: new Date(),
    method: 'BONIFICO',
    reference: '',
    notes: '',
  };
  showRecordPaymentDialog.value = true;
};

const recordPayment = async () => {
  if (!selectedPaymentDue.value) return;

  try {
    savingPayment.value = true;
    const response = await api.post(`/accounting/payment-dues/${selectedPaymentDue.value.id}/payments`, {
      amount: paymentForm.value.amount,
      paymentDate: paymentForm.value.paymentDate.toISOString(),
      method: paymentForm.value.method,
      reference: paymentForm.value.reference,
      notes: paymentForm.value.notes,
    });

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Pagamento Registrato',
        detail: `Pagamento di ${formatCurrency(paymentForm.value.amount)} registrato con successo`,
        life: 3000,
      });
      showRecordPaymentDialog.value = false;
      loadPaymentDues();
      loadDashboard();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella registrazione del pagamento',
      life: 3000,
    });
  } finally {
    savingPayment.value = false;
  }
};

const viewPaymentDue = (due: any) => {
  toast.add({
    severity: 'info',
    summary: 'Dettaglio Scadenza',
    detail: due.description,
    life: 3000,
  });
};

const viewInvoice = (invoice: any) => {
  toast.add({
    severity: 'info',
    summary: 'Dettaglio Fattura',
    detail: `Fattura ${invoice.invoiceNumber}`,
    life: 3000,
  });
};

const generateDuesFromInvoice = async (invoice: any) => {
  try {
    const response = await api.post(`/accounting/invoices/${invoice.id}/generate-dues`, {});
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Scadenze Generate',
        detail: 'Le scadenze sono state generate dalla fattura',
        life: 3000,
      });
      loadPaymentDues();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella generazione scadenze',
      life: 3000,
    });
  }
};

onMounted(() => {
  loadDashboard();
  loadPaymentDues();
  loadInvoices();
  loadCashFlowForecast();
  loadRecommendations();
  loadPaymentPlans();
});
</script>

<style scoped>
.accounting-page {
  max-width: 1800px;
  margin: 0 auto;
}

.accounting-tabs {
  margin-top: var(--space-6);
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.kpi-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
}

.kpi-card--primary {
  border-left: 4px solid var(--color-primary-500);
}

.kpi-card--success {
  border-left: 4px solid var(--color-success);
}

.kpi-card--warning {
  border-left: 4px solid var(--color-warning);
}

.kpi-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
}

.kpi-card__header i {
  font-size: 1.2rem;
}

.kpi-card__value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-gray-900);
}

.kpi-card__value.negative {
  color: var(--color-danger);
}

.kpi-card__sub {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-2);
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--space-5);
}

.chart-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
}

.chart-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-4);
  color: var(--color-gray-900);
}

/* Aging Bars */
.aging-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.aging-bar {
  display: grid;
  grid-template-columns: 120px 1fr 100px;
  align-items: center;
  gap: var(--space-3);
}

.aging-bar__label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.aging-bar__track {
  height: 20px;
  background: var(--color-gray-100);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.aging-bar__fill {
  height: 100%;
  border-radius: var(--border-radius);
  transition: width 0.3s ease;
}

.aging-bar__fill--receivable {
  background: linear-gradient(90deg, var(--color-success), var(--color-success-light));
}

.aging-bar__fill--payable {
  background: linear-gradient(90deg, var(--color-warning), var(--color-warning-light));
}

.aging-bar__value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-align: right;
  color: var(--color-gray-700);
}

/* Section Card */
.section-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: var(--border-width) solid var(--border-color-light);
  background: var(--bg-card);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Table Toolbar */
.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-group label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.filter-dropdown {
  min-width: 150px;
}

/* Tables */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  font-size: var(--font-size-xs);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.amount-value {
  font-weight: 600;
  color: var(--color-gray-900);
}

.overdue-badge {
  background: var(--color-danger);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  margin-left: var(--space-2);
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

.action-btn--success {
  color: var(--color-success) !important;
}

/* Cash Flow */
.cashflow-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--border-radius);
  padding: var(--space-4);
  border: var(--border-width) solid var(--border-color-light);
  text-align: center;
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin-bottom: var(--space-2);
}

.summary-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.months-dropdown {
  width: 80px;
}

.months-label {
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

/* Recommendations */
.recommendations-summary {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.summary-tag {
  font-size: var(--font-size-sm) !important;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.recommendation-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  border: var(--border-width) solid var(--border-color-light);
  border-left: 4px solid var(--color-gray-300);
}

.recommendation-card--warning {
  border-left-color: var(--color-danger);
}

.recommendation-card--action {
  border-left-color: var(--color-warning);
}

.recommendation-card--opportunity {
  border-left-color: var(--color-success);
}

.recommendation-card--info {
  border-left-color: var(--color-info);
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.rec-type {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.rec-type i {
  font-size: 1.2rem;
}

.rec-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
}

.rec-description {
  color: var(--color-gray-600);
  margin-bottom: var(--space-3);
}

.rec-impact {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.rec-impact i {
  color: var(--color-warning);
}

.rec-actions h4,
.rec-entities h4 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-2) 0;
}

.rec-actions ul {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

.rec-actions li {
  margin-bottom: var(--space-1);
}

.entity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.entity-chip {
  font-size: var(--font-size-xs) !important;
}

/* Installments */
.installments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.installment-chip {
  background: var(--color-gray-100);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-gray-700);
}

/* Dialog Form */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-info {
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
}

.form-info p {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
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
  margin: 0;
}

/* Utility Classes */
.text-success {
  color: var(--color-success) !important;
}

.text-danger {
  color: var(--color-danger) !important;
}

.text-warning {
  color: var(--color-warning) !important;
}

.text-muted {
  color: var(--color-gray-400) !important;
}

.font-bold {
  font-weight: 700 !important;
}

.mb-4 {
  margin-bottom: var(--space-4);
}

.mt-4 {
  margin-top: var(--space-4);
}

.w-full {
  width: 100%;
}

/* Responsive */
@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .aging-bar {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }

  .section-header {
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .filters {
    flex-direction: column;
    width: 100%;
  }

  .filter-dropdown {
    min-width: 100%;
  }
}
</style>
