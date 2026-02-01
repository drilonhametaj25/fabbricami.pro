<template>
  <div class="reports-page">
    <PageHeader
      title="Report Avanzati"
      subtitle="Dashboard reportistica finanziaria, clienti e inventario"
      icon="pi pi-file-pdf"
    />

    <!-- Report Type Selector -->
    <TabView v-model:activeIndex="activeTab" class="reports-tabs">
      <!-- Tab 1: Financial Reports -->
      <TabPanel header="Finanziari">
        <div class="report-section">
          <!-- Date Range Filter -->
          <div class="filters-row">
            <div class="filter-group">
              <label>Periodo</label>
              <Calendar
                v-model="dateRange"
                selectionMode="range"
                dateFormat="dd/mm/yy"
                showIcon
                :manualInput="false"
                placeholder="Seleziona periodo"
              />
            </div>
            <Button
              label="Applica"
              icon="pi pi-refresh"
              @click="loadFinancialReports"
              :loading="loadingFinancial"
            />
          </div>

          <!-- P&L Summary -->
          <div class="report-card">
            <div class="report-card__header">
              <h3>Conto Economico (P&L)</h3>
              <div class="report-card__actions">
                <Button
                  icon="pi pi-file-pdf"
                  label="PDF"
                  severity="secondary"
                  size="small"
                  @click="exportProfitLossPdf"
                  :loading="exportingPL"
                />
              </div>
            </div>
            <div class="report-card__content">
              <div v-if="profitLoss" class="pl-grid">
                <div class="pl-item pl-item--revenue">
                  <span class="pl-item__label">Ricavi</span>
                  <span class="pl-item__value">{{ formatCurrency(profitLoss.revenue) }}</span>
                </div>
                <div class="pl-item">
                  <span class="pl-item__label">Costo del venduto</span>
                  <span class="pl-item__value negative">-{{ formatCurrency(profitLoss.costOfGoodsSold) }}</span>
                </div>
                <div class="pl-item pl-item--subtotal">
                  <span class="pl-item__label">Margine Lordo</span>
                  <span class="pl-item__value">
                    {{ formatCurrency(profitLoss.grossProfit) }}
                    <small>({{ profitLoss.grossMargin?.toFixed(1) }}%)</small>
                  </span>
                </div>
                <div class="pl-item">
                  <span class="pl-item__label">Spese Operative</span>
                  <span class="pl-item__value negative">-{{ formatCurrency(profitLoss.operatingExpenses) }}</span>
                </div>
                <div class="pl-item pl-item--subtotal">
                  <span class="pl-item__label">Risultato Operativo (EBIT)</span>
                  <span class="pl-item__value" :class="{ negative: profitLoss.operatingIncome < 0 }">
                    {{ formatCurrency(profitLoss.operatingIncome) }}
                    <small>({{ profitLoss.operatingMargin?.toFixed(1) }}%)</small>
                  </span>
                </div>
                <div class="pl-item">
                  <span class="pl-item__label">Interessi Passivi</span>
                  <span class="pl-item__value negative">-{{ formatCurrency(profitLoss.interestExpense) }}</span>
                </div>
                <div class="pl-item">
                  <span class="pl-item__label">Tasse</span>
                  <span class="pl-item__value negative">-{{ formatCurrency(profitLoss.taxes) }}</span>
                </div>
                <div class="pl-item pl-item--total">
                  <span class="pl-item__label">Utile Netto</span>
                  <span class="pl-item__value" :class="{ negative: profitLoss.netIncome < 0 }">
                    {{ formatCurrency(profitLoss.netIncome) }}
                    <small>({{ profitLoss.netMargin?.toFixed(1) }}%)</small>
                  </span>
                </div>
              </div>
              <div v-else class="empty-state">
                <i class="pi pi-calculator"></i>
                <p>Seleziona un periodo per visualizzare il conto economico</p>
              </div>
            </div>
          </div>

          <!-- Aging Reports Grid -->
          <div class="charts-grid">
            <!-- Aging Receivables -->
            <div class="report-card">
              <div class="report-card__header">
                <h3>Scadenzario Crediti</h3>
                <Button
                  icon="pi pi-file-pdf"
                  severity="secondary"
                  size="small"
                  @click="exportAgingPdf('receivables')"
                />
              </div>
              <div class="report-card__content">
                <canvas ref="agingReceivablesChart"></canvas>
                <div v-if="agingReceivables" class="aging-summary">
                  <div class="aging-item">
                    <span>Corrente</span>
                    <span class="success">{{ formatCurrency(agingReceivables.summary?.current || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>1-30 gg</span>
                    <span class="warning">{{ formatCurrency(agingReceivables.summary?.days30 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>31-60 gg</span>
                    <span class="warning">{{ formatCurrency(agingReceivables.summary?.days60 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>61-90 gg</span>
                    <span class="danger">{{ formatCurrency(agingReceivables.summary?.days90 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>> 90 gg</span>
                    <span class="danger">{{ formatCurrency(agingReceivables.summary?.over90 || 0) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Aging Payables -->
            <div class="report-card">
              <div class="report-card__header">
                <h3>Scadenzario Debiti</h3>
                <Button
                  icon="pi pi-file-pdf"
                  severity="secondary"
                  size="small"
                  @click="exportAgingPdf('payables')"
                />
              </div>
              <div class="report-card__content">
                <canvas ref="agingPayablesChart"></canvas>
                <div v-if="agingPayables" class="aging-summary">
                  <div class="aging-item">
                    <span>Corrente</span>
                    <span class="success">{{ formatCurrency(agingPayables.summary?.current || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>1-30 gg</span>
                    <span class="warning">{{ formatCurrency(agingPayables.summary?.days30 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>31-60 gg</span>
                    <span class="warning">{{ formatCurrency(agingPayables.summary?.days60 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>61-90 gg</span>
                    <span class="danger">{{ formatCurrency(agingPayables.summary?.days90 || 0) }}</span>
                  </div>
                  <div class="aging-item">
                    <span>> 90 gg</span>
                    <span class="danger">{{ formatCurrency(agingPayables.summary?.over90 || 0) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cashflow Forecast -->
          <div class="report-card">
            <div class="report-card__header">
              <h3>Previsione Cashflow (90 giorni)</h3>
              <Button
                icon="pi pi-file-pdf"
                label="PDF"
                severity="secondary"
                size="small"
                @click="exportCashflowPdf"
              />
            </div>
            <div class="report-card__content">
              <canvas ref="cashflowChart"></canvas>
              <div v-if="cashflowForecast" class="cashflow-summary">
                <div class="cashflow-item">
                  <i class="pi pi-wallet"></i>
                  <div>
                    <span class="label">Saldo Iniziale</span>
                    <span class="value">{{ formatCurrency(cashflowForecast.startingBalance) }}</span>
                  </div>
                </div>
                <div class="cashflow-item success">
                  <i class="pi pi-arrow-down"></i>
                  <div>
                    <span class="label">Incassi Previsti</span>
                    <span class="value">{{ formatCurrency(cashflowForecast.projectedInflows) }}</span>
                  </div>
                </div>
                <div class="cashflow-item danger">
                  <i class="pi pi-arrow-up"></i>
                  <div>
                    <span class="label">Pagamenti Previsti</span>
                    <span class="value">{{ formatCurrency(cashflowForecast.projectedOutflows) }}</span>
                  </div>
                </div>
                <div class="cashflow-item" :class="{ danger: cashflowForecast.projectedEndBalance < 0 }">
                  <i class="pi pi-chart-line"></i>
                  <div>
                    <span class="label">Saldo Finale Previsto</span>
                    <span class="value">{{ formatCurrency(cashflowForecast.projectedEndBalance) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 2: Customer Reports -->
      <TabPanel header="Clienti">
        <div class="report-section">
          <!-- RFM Analysis -->
          <div class="report-card">
            <div class="report-card__header">
              <h3>Analisi RFM Clienti</h3>
              <Button
                icon="pi pi-file-pdf"
                label="PDF"
                severity="secondary"
                size="small"
                @click="exportRfmPdf"
              />
            </div>
            <div class="report-card__content">
              <div v-if="rfmAnalysis" class="rfm-grid">
                <div
                  v-for="segment in rfmAnalysis.segments"
                  :key="segment.segment"
                  class="rfm-segment"
                  :class="getRfmSegmentClass(segment.segment)"
                >
                  <div class="rfm-segment__header">
                    <span class="segment-name">{{ segment.segment }}</span>
                    <Tag :severity="getRfmSeverity(segment.segment)">
                      {{ segment.count }} clienti
                    </Tag>
                  </div>
                  <div class="rfm-segment__metrics">
                    <div class="metric">
                      <span class="label">Fatturato</span>
                      <span class="value">{{ formatCurrency(segment.totalRevenue) }}</span>
                    </div>
                    <div class="metric">
                      <span class="label">Media</span>
                      <span class="value">{{ formatCurrency(segment.avgRevenue) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <i class="pi pi-users"></i>
                <p>Caricamento analisi RFM...</p>
              </div>
            </div>
          </div>

          <!-- Customer Retention -->
          <div class="charts-grid">
            <div class="report-card">
              <div class="report-card__header">
                <h3>Retention Clienti</h3>
              </div>
              <div class="report-card__content">
                <canvas ref="retentionChart"></canvas>
                <div v-if="retentionData" class="retention-summary">
                  <div class="retention-item">
                    <span>Clienti Attivi</span>
                    <span class="value success">{{ retentionData.activeCustomers }}</span>
                  </div>
                  <div class="retention-item">
                    <span>Clienti Persi</span>
                    <span class="value danger">{{ retentionData.churned }}</span>
                  </div>
                  <div class="retention-item">
                    <span>Tasso Retention</span>
                    <span class="value">{{ retentionData.retentionRate?.toFixed(1) }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="report-card">
              <div class="report-card__header">
                <h3>Churn Analysis</h3>
              </div>
              <div class="report-card__content">
                <canvas ref="churnChart"></canvas>
                <div v-if="churnData" class="churn-summary">
                  <div class="churn-item">
                    <span>A Rischio</span>
                    <span class="value warning">{{ churnData.atRiskCustomers }}</span>
                  </div>
                  <div class="churn-item">
                    <span>Persi (Churn)</span>
                    <span class="value danger">{{ churnData.churnedCustomers }}</span>
                  </div>
                  <div class="churn-item">
                    <span>Tasso Churn</span>
                    <span class="value">{{ churnData.churnRate?.toFixed(1) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 3: Inventory Reports -->
      <TabPanel header="Magazzino">
        <div class="report-section">
          <!-- Dead Stock Analysis -->
          <div class="report-card">
            <div class="report-card__header">
              <h3>Dead Stock Analysis</h3>
              <div class="report-card__actions">
                <Dropdown
                  v-model="deadStockDays"
                  :options="deadStockOptions"
                  optionLabel="label"
                  optionValue="value"
                  @change="loadDeadStock"
                />
                <Button
                  icon="pi pi-file-pdf"
                  label="PDF"
                  severity="secondary"
                  size="small"
                  @click="exportDeadStockPdf"
                />
              </div>
            </div>
            <div class="report-card__content">
              <div v-if="deadStock" class="dead-stock-summary">
                <div class="summary-cards">
                  <div class="summary-card danger">
                    <i class="pi pi-box"></i>
                    <div>
                      <span class="value">{{ deadStock.totalItems }}</span>
                      <span class="label">Prodotti fermi</span>
                    </div>
                  </div>
                  <div class="summary-card warning">
                    <i class="pi pi-euro"></i>
                    <div>
                      <span class="value">{{ formatCurrency(deadStock.totalValue) }}</span>
                      <span class="label">Valore bloccato</span>
                    </div>
                  </div>
                  <div class="summary-card info">
                    <i class="pi pi-calendar"></i>
                    <div>
                      <span class="value">{{ deadStock.avgDaysWithoutSale?.toFixed(0) || 0 }}</span>
                      <span class="label">Giorni medi senza vendita</span>
                    </div>
                  </div>
                </div>
                <DataTable
                  :value="deadStock.items"
                  :paginator="true"
                  :rows="10"
                  stripedRows
                  class="dead-stock-table"
                >
                  <Column field="sku" header="SKU" sortable></Column>
                  <Column field="name" header="Prodotto" sortable>
                    <template #body="{ data }">
                      <span class="product-name">{{ data.name }}</span>
                    </template>
                  </Column>
                  <Column field="currentStock" header="Giacenza" sortable></Column>
                  <Column field="value" header="Valore" sortable>
                    <template #body="{ data }">
                      {{ formatCurrency(data.value) }}
                    </template>
                  </Column>
                  <Column field="daysSinceLastSale" header="Giorni" sortable>
                    <template #body="{ data }">
                      <Tag :severity="getDaysSeverity(data.daysSinceLastSale)">
                        {{ data.daysSinceLastSale }} gg
                      </Tag>
                    </template>
                  </Column>
                  <Column field="suggestedAction" header="Azione">
                    <template #body="{ data }">
                      <Tag severity="info">{{ data.suggestedAction }}</Tag>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </div>
          </div>

          <!-- Category Performance -->
          <div class="report-card">
            <div class="report-card__header">
              <h3>Performance Categorie</h3>
            </div>
            <div class="report-card__content">
              <canvas ref="categoryPerformanceChart"></canvas>
              <DataTable
                v-if="categoryPerformance"
                :value="categoryPerformance"
                :paginator="true"
                :rows="10"
                stripedRows
                class="category-table"
              >
                <Column field="category" header="Categoria" sortable></Column>
                <Column field="totalRevenue" header="Fatturato" sortable>
                  <template #body="{ data }">
                    {{ formatCurrency(data.totalRevenue) }}
                  </template>
                </Column>
                <Column field="totalCost" header="Costo" sortable>
                  <template #body="{ data }">
                    {{ formatCurrency(data.totalCost) }}
                  </template>
                </Column>
                <Column field="grossMargin" header="Margine" sortable>
                  <template #body="{ data }">
                    <Tag :severity="getMarginSeverity(data.grossMargin)">
                      {{ data.grossMargin?.toFixed(1) }}%
                    </Tag>
                  </template>
                </Column>
                <Column field="unitsSold" header="Unità Vendute" sortable></Column>
              </DataTable>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 4: Production Reports -->
      <TabPanel header="Produzione">
        <div class="report-section">
          <div class="report-card">
            <div class="report-card__header">
              <h3>Efficienza Produzione</h3>
            </div>
            <div class="report-card__content">
              <div v-if="productionEfficiency" class="production-summary">
                <div class="summary-cards">
                  <div class="summary-card success">
                    <i class="pi pi-check-circle"></i>
                    <div>
                      <span class="value">{{ productionEfficiency.completedOrders }}</span>
                      <span class="label">Ordini completati</span>
                    </div>
                  </div>
                  <div class="summary-card info">
                    <i class="pi pi-clock"></i>
                    <div>
                      <span class="value">{{ productionEfficiency.avgCompletionTime?.toFixed(1) || 0 }}h</span>
                      <span class="label">Tempo medio</span>
                    </div>
                  </div>
                  <div class="summary-card" :class="productionEfficiency.onTimeRate >= 90 ? 'success' : 'warning'">
                    <i class="pi pi-calendar-times"></i>
                    <div>
                      <span class="value">{{ productionEfficiency.onTimeRate?.toFixed(1) || 0 }}%</span>
                      <span class="label">Puntuali</span>
                    </div>
                  </div>
                  <div class="summary-card" :class="productionEfficiency.defectRate <= 2 ? 'success' : 'danger'">
                    <i class="pi pi-exclamation-triangle"></i>
                    <div>
                      <span class="value">{{ productionEfficiency.defectRate?.toFixed(2) || 0 }}%</span>
                      <span class="label">Difetti</span>
                    </div>
                  </div>
                </div>
                <canvas ref="productionEfficiencyChart"></canvas>
              </div>
              <div v-else class="empty-state">
                <i class="pi pi-cog"></i>
                <p>Caricamento dati produzione...</p>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 5: Scheduled Reports -->
      <TabPanel header="Report Schedulati">
        <div class="report-section">
          <div class="report-card">
            <div class="report-card__header">
              <h3>Report Automatici</h3>
              <Button
                label="Nuovo Report"
                icon="pi pi-plus"
                @click="openScheduledReportDialog"
              />
            </div>
            <div class="report-card__content">
              <DataTable
                :value="scheduledReports"
                :loading="loadingScheduled"
                stripedRows
              >
                <Column field="name" header="Nome" sortable></Column>
                <Column field="reportType" header="Tipo" sortable>
                  <template #body="{ data }">
                    <Tag>{{ getReportTypeLabel(data.reportType) }}</Tag>
                  </template>
                </Column>
                <Column field="frequency" header="Frequenza" sortable>
                  <template #body="{ data }">
                    {{ getFrequencyLabel(data.frequency) }}
                  </template>
                </Column>
                <Column field="recipients" header="Destinatari">
                  <template #body="{ data }">
                    <span class="recipients-list">
                      {{ data.recipients?.join(', ') || '-' }}
                    </span>
                  </template>
                </Column>
                <Column field="lastRun" header="Ultima esecuzione">
                  <template #body="{ data }">
                    {{ data.lastRun ? formatDate(data.lastRun) : 'Mai' }}
                  </template>
                </Column>
                <Column field="enabled" header="Stato">
                  <template #body="{ data }">
                    <Tag :severity="data.enabled ? 'success' : 'danger'">
                      {{ data.enabled ? 'Attivo' : 'Disattivo' }}
                    </Tag>
                  </template>
                </Column>
                <Column header="Azioni" :style="{ width: '120px' }">
                  <template #body="{ data }">
                    <div class="action-buttons">
                      <Button
                        icon="pi pi-play"
                        severity="info"
                        size="small"
                        text
                        @click="runScheduledReport(data.id)"
                        v-tooltip="'Esegui ora'"
                      />
                      <Button
                        icon="pi pi-pencil"
                        severity="secondary"
                        size="small"
                        text
                        @click="editScheduledReport(data)"
                      />
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        size="small"
                        text
                        @click="deleteScheduledReport(data.id)"
                      />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 6: Export -->
      <TabPanel header="Export">
        <div class="report-section">
          <div class="export-grid">
            <div class="export-card" @click="exportInventoryCsv">
              <i class="pi pi-box"></i>
              <h4>Inventario</h4>
              <p>Export completo giacenze</p>
              <Tag>CSV</Tag>
            </div>
            <div class="export-card" @click="exportOrdersCsv">
              <i class="pi pi-shopping-cart"></i>
              <h4>Ordini</h4>
              <p>Export ordini periodo</p>
              <Tag>CSV</Tag>
            </div>
            <div class="export-card" @click="exportCustomersCsv">
              <i class="pi pi-users"></i>
              <h4>Clienti</h4>
              <p>Anagrafica clienti</p>
              <Tag>CSV</Tag>
            </div>
            <div class="export-card" @click="exportProductsCsv">
              <i class="pi pi-tag"></i>
              <h4>Prodotti</h4>
              <p>Catalogo prodotti</p>
              <Tag>CSV</Tag>
            </div>
          </div>
        </div>
      </TabPanel>
    </TabView>

    <!-- Scheduled Report Dialog -->
    <Dialog
      v-model:visible="showScheduledDialog"
      :header="editingReport ? 'Modifica Report' : 'Nuovo Report Schedulato'"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="scheduled-form">
        <div class="form-field">
          <label>Nome Report</label>
          <InputText v-model="scheduledForm.name" placeholder="Es: Report Vendite Settimanale" />
        </div>
        <div class="form-field">
          <label>Tipo Report</label>
          <Dropdown
            v-model="scheduledForm.reportType"
            :options="reportTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona tipo"
          />
        </div>
        <div class="form-field">
          <label>Frequenza</label>
          <Dropdown
            v-model="scheduledForm.frequency"
            :options="frequencyOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona frequenza"
          />
        </div>
        <div class="form-field">
          <label>Destinatari (email separate da virgola)</label>
          <InputText v-model="scheduledForm.recipientsText" placeholder="email1@example.com, email2@example.com" />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" severity="secondary" @click="showScheduledDialog = false" />
        <Button label="Salva" icon="pi pi-check" @click="saveScheduledReport" :loading="savingScheduled" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const toast = useToast();
const activeTab = ref(0);

// Loading states
const loadingFinancial = ref(false);
const loadingScheduled = ref(false);
const savingScheduled = ref(false);
const exportingPL = ref(false);

// Date range filter
const dateRange = ref<Date[]>([
  new Date(new Date().setMonth(new Date().getMonth() - 1)),
  new Date(),
]);

// Financial data
const profitLoss = ref<any>(null);
const agingReceivables = ref<any>(null);
const agingPayables = ref<any>(null);
const cashflowForecast = ref<any>(null);

// Customer data
const rfmAnalysis = ref<any>(null);
const retentionData = ref<any>(null);
const churnData = ref<any>(null);

// Inventory data
const deadStock = ref<any>(null);
const categoryPerformance = ref<any[]>([]);
const deadStockDays = ref(90);

// Production data
const productionEfficiency = ref<any>(null);

// Scheduled reports
const scheduledReports = ref<any[]>([]);
const showScheduledDialog = ref(false);
const editingReport = ref<any>(null);
const scheduledForm = ref({
  name: '',
  reportType: '',
  frequency: 'WEEKLY',
  recipientsText: '',
});

// Chart refs
const agingReceivablesChart = ref<HTMLCanvasElement | null>(null);
const agingPayablesChart = ref<HTMLCanvasElement | null>(null);
const cashflowChart = ref<HTMLCanvasElement | null>(null);
const retentionChart = ref<HTMLCanvasElement | null>(null);
const churnChart = ref<HTMLCanvasElement | null>(null);
const categoryPerformanceChart = ref<HTMLCanvasElement | null>(null);
const productionEfficiencyChart = ref<HTMLCanvasElement | null>(null);

// Chart instances
let agingRecChart: Chart | null = null;
let agingPayChart: Chart | null = null;
let cashChart: Chart | null = null;
let retChart: Chart | null = null;
let chrnChart: Chart | null = null;
let catPerfChart: Chart | null = null;
let prodEffChart: Chart | null = null;

// Options
const deadStockOptions = [
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
  { label: '120 giorni', value: 120 },
  { label: '180 giorni', value: 180 },
];

const reportTypeOptions = [
  { label: 'Riepilogo Vendite', value: 'sales-summary' },
  { label: 'Dead Stock', value: 'dead-stock' },
  { label: 'Scadenzario Crediti', value: 'aging-receivables' },
  { label: 'Scadenzario Debiti', value: 'aging-payables' },
  { label: 'Previsione Cashflow', value: 'cashflow-forecast' },
  { label: 'Analisi RFM', value: 'rfm-analysis' },
  { label: 'Export Inventario', value: 'inventory-csv' },
  { label: 'Export Ordini', value: 'orders-csv' },
];

const frequencyOptions = [
  { label: 'Giornaliero', value: 'DAILY' },
  { label: 'Settimanale', value: 'WEEKLY' },
  { label: 'Mensile', value: 'MONTHLY' },
];

// Formatters
const formatCurrency = (value: number | undefined | null) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helpers
const getRfmSegmentClass = (segment: string): string => {
  const map: Record<string, string> = {
    Champions: 'rfm--champions',
    'Loyal Customers': 'rfm--loyal',
    'Potential Loyalist': 'rfm--potential',
    'New Customers': 'rfm--new',
    'At Risk': 'rfm--risk',
    'Hibernating': 'rfm--hibernating',
    Lost: 'rfm--lost',
  };
  return map[segment] || '';
};

const getRfmSeverity = (segment: string): string => {
  const map: Record<string, string> = {
    Champions: 'success',
    'Loyal Customers': 'success',
    'Potential Loyalist': 'info',
    'New Customers': 'info',
    'At Risk': 'warning',
    'Hibernating': 'warning',
    Lost: 'danger',
  };
  return map[segment] || 'info';
};

const getDaysSeverity = (days: number): string => {
  if (days > 180) return 'danger';
  if (days > 120) return 'warning';
  return 'info';
};

const getMarginSeverity = (margin: number): string => {
  if (margin >= 40) return 'success';
  if (margin >= 20) return 'info';
  if (margin >= 10) return 'warning';
  return 'danger';
};

const getReportTypeLabel = (type: string): string => {
  return reportTypeOptions.find((o) => o.value === type)?.label || type;
};

const getFrequencyLabel = (freq: string): string => {
  return frequencyOptions.find((o) => o.value === freq)?.label || freq;
};

// Load functions
const loadFinancialReports = async () => {
  try {
    loadingFinancial.value = true;
    const [from, to] = dateRange.value;

    // Load P&L
    const plResponse = await api.get('/reports/financial/profit-loss', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    if (plResponse.success) {
      profitLoss.value = plResponse.data;
    }

    // Load Aging Reports
    const [agingRec, agingPay] = await Promise.all([
      api.get('/reports/aging/receivables'),
      api.get('/reports/aging/payables'),
    ]);
    if (agingRec.success) agingReceivables.value = agingRec.data;
    if (agingPay.success) agingPayables.value = agingPay.data;

    // Load Cashflow
    const cashflowResponse = await api.get('/reports/cashflow-forecast', {
      params: { days: 90 },
    });
    if (cashflowResponse.success) {
      cashflowForecast.value = cashflowResponse.data;
    }

    await nextTick();
    renderAgingCharts();
    renderCashflowChart();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento report',
      life: 3000,
    });
  } finally {
    loadingFinancial.value = false;
  }
};

const loadCustomerReports = async () => {
  try {
    const [from, to] = dateRange.value;

    // Load RFM
    const rfmResponse = await api.get('/reports/rfm-analysis', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    if (rfmResponse.success) {
      rfmAnalysis.value = rfmResponse.data;
    }

    // Load Retention
    const retResponse = await api.get('/reports/customer-retention', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    if (retResponse.success) {
      retentionData.value = retResponse.data;
    }

    // Load Churn
    const churnResponse = await api.get('/reports/churn-analysis', {
      params: { from: from.toISOString(), to: to.toISOString(), inactivityDays: 90 },
    });
    if (churnResponse.success) {
      churnData.value = churnResponse.data;
    }

    await nextTick();
    renderCustomerCharts();
  } catch (error: any) {
    console.error('Error loading customer reports:', error);
  }
};

const loadDeadStock = async () => {
  try {
    const response = await api.get('/reports/dead-stock', {
      params: { daysThreshold: deadStockDays.value },
    });
    if (response.success) {
      deadStock.value = response.data;
    }
  } catch (error: any) {
    console.error('Error loading dead stock:', error);
  }
};

const loadCategoryPerformance = async () => {
  try {
    const [from, to] = dateRange.value;
    const response = await api.get('/reports/category-performance', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    if (response.success) {
      categoryPerformance.value = response.data || [];
      await nextTick();
      renderCategoryChart();
    }
  } catch (error: any) {
    console.error('Error loading category performance:', error);
  }
};

const loadProductionEfficiency = async () => {
  try {
    const [from, to] = dateRange.value;
    const response = await api.get('/reports/production-efficiency', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    if (response.success) {
      productionEfficiency.value = response.data;
      await nextTick();
      renderProductionChart();
    }
  } catch (error: any) {
    console.error('Error loading production efficiency:', error);
  }
};

const loadScheduledReports = async () => {
  try {
    loadingScheduled.value = true;
    const response = await api.get('/reports/scheduled');
    if (response.success) {
      scheduledReports.value = response.data || [];
    }
  } catch (error: any) {
    console.error('Error loading scheduled reports:', error);
  } finally {
    loadingScheduled.value = false;
  }
};

// Chart rendering
const renderAgingCharts = () => {
  // Receivables
  if (agingReceivablesChart.value && agingReceivables.value) {
    if (agingRecChart) agingRecChart.destroy();
    const summary = agingReceivables.value.summary;
    agingRecChart = new Chart(agingReceivablesChart.value, {
      type: 'doughnut',
      data: {
        labels: ['Corrente', '1-30 gg', '31-60 gg', '61-90 gg', '> 90 gg'],
        datasets: [{
          data: [summary.current, summary.days30, summary.days60, summary.days90, summary.over90],
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444', '#dc2626'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed as number)}`,
            },
          },
        },
      },
    });
  }

  // Payables
  if (agingPayablesChart.value && agingPayables.value) {
    if (agingPayChart) agingPayChart.destroy();
    const summary = agingPayables.value.summary;
    agingPayChart = new Chart(agingPayablesChart.value, {
      type: 'doughnut',
      data: {
        labels: ['Corrente', '1-30 gg', '31-60 gg', '61-90 gg', '> 90 gg'],
        datasets: [{
          data: [summary.current, summary.days30, summary.days60, summary.days90, summary.over90],
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444', '#dc2626'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed as number)}`,
            },
          },
        },
      },
    });
  }
};

const renderCashflowChart = () => {
  if (!cashflowChart.value || !cashflowForecast.value) return;
  if (cashChart) cashChart.destroy();

  const data = cashflowForecast.value.dailyProjections || [];
  cashChart = new Chart(cashflowChart.value, {
    type: 'line',
    data: {
      labels: data.map((d: any) => new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })),
      datasets: [
        {
          label: 'Saldo Previsto',
          data: data.map((d: any) => d.projectedBalance),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => `${(Number(value) / 1000).toFixed(0)}k`,
          },
        },
      },
    },
  });
};

const renderCustomerCharts = () => {
  // Retention chart
  if (retentionChart.value && retentionData.value) {
    if (retChart) retChart.destroy();
    retChart = new Chart(retentionChart.value, {
      type: 'doughnut',
      data: {
        labels: ['Attivi', 'Persi'],
        datasets: [{
          data: [retentionData.value.activeCustomers, retentionData.value.churned],
          backgroundColor: ['#22c55e', '#ef4444'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  }

  // Churn chart
  if (churnChart.value && churnData.value) {
    if (chrnChart) chrnChart.destroy();
    chrnChart = new Chart(churnChart.value, {
      type: 'bar',
      data: {
        labels: ['Attivi', 'A Rischio', 'Persi'],
        datasets: [{
          data: [churnData.value.activeCustomers, churnData.value.atRiskCustomers, churnData.value.churnedCustomers],
          backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }
};

const renderCategoryChart = () => {
  if (!categoryPerformanceChart.value || !categoryPerformance.value.length) return;
  if (catPerfChart) catPerfChart.destroy();

  const data = categoryPerformance.value.slice(0, 10);
  catPerfChart = new Chart(categoryPerformanceChart.value, {
    type: 'bar',
    data: {
      labels: data.map((c: any) => c.category),
      datasets: [{
        label: 'Fatturato',
        data: data.map((c: any) => c.totalRevenue),
        backgroundColor: 'rgb(59, 130, 246)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.x),
          },
        },
      },
    },
  });
};

const renderProductionChart = () => {
  if (!productionEfficiencyChart.value || !productionEfficiency.value) return;
  if (prodEffChart) prodEffChart.destroy();

  const data = productionEfficiency.value;
  prodEffChart = new Chart(productionEfficiencyChart.value, {
    type: 'bar',
    data: {
      labels: ['Completati', 'In Corso', 'In Ritardo'],
      datasets: [{
        data: [data.completedOrders || 0, data.inProgressOrders || 0, data.delayedOrders || 0],
        backgroundColor: ['#22c55e', '#3b82f6', '#ef4444'],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
};

// Export functions
const exportProfitLossPdf = async () => {
  try {
    exportingPL.value = true;
    const [from, to] = dateRange.value;
    const response = await api.get('/reports/export/profit-loss/pdf', {
      params: { from: from.toISOString(), to: to.toISOString() },
      responseType: 'blob',
    });
    downloadBlob(response, 'conto-economico.pdf');
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export PDF', life: 3000 });
  } finally {
    exportingPL.value = false;
  }
};

const exportAgingPdf = async (type: 'receivables' | 'payables') => {
  try {
    const response = await api.get(`/reports/export/aging/${type}/pdf`, { responseType: 'blob' });
    downloadBlob(response, `scadenzario-${type === 'receivables' ? 'crediti' : 'debiti'}.pdf`);
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export PDF', life: 3000 });
  }
};

const exportCashflowPdf = async () => {
  try {
    const response = await api.get('/reports/export/cashflow/pdf', {
      params: { days: 90 },
      responseType: 'blob',
    });
    downloadBlob(response, 'previsione-cashflow.pdf');
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export PDF', life: 3000 });
  }
};

const exportRfmPdf = async () => {
  try {
    const [from, to] = dateRange.value;
    const response = await api.get('/reports/export/rfm/pdf', {
      params: { from: from.toISOString(), to: to.toISOString() },
      responseType: 'blob',
    });
    downloadBlob(response, 'analisi-rfm.pdf');
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export PDF', life: 3000 });
  }
};

const exportDeadStockPdf = async () => {
  try {
    const response = await api.get('/reports/export/dead-stock/pdf', {
      params: { daysThreshold: deadStockDays.value },
      responseType: 'blob',
    });
    downloadBlob(response, 'dead-stock.pdf');
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export PDF', life: 3000 });
  }
};

const exportInventoryCsv = async () => {
  try {
    const response = await api.get('/reports/export/inventory/csv', { responseType: 'blob' });
    downloadBlob(response, 'inventario.csv');
    toast.add({ severity: 'success', summary: 'Completato', detail: 'Export inventario completato', life: 3000 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export CSV', life: 3000 });
  }
};

const exportOrdersCsv = async () => {
  try {
    const [from, to] = dateRange.value;
    const response = await api.get('/reports/export/orders/csv', {
      params: { from: from.toISOString(), to: to.toISOString() },
      responseType: 'blob',
    });
    downloadBlob(response, 'ordini.csv');
    toast.add({ severity: 'success', summary: 'Completato', detail: 'Export ordini completato', life: 3000 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export CSV', life: 3000 });
  }
};

const exportCustomersCsv = async () => {
  try {
    const response = await api.get('/export/customers', { responseType: 'blob' });
    downloadBlob(response, 'clienti.csv');
    toast.add({ severity: 'success', summary: 'Completato', detail: 'Export clienti completato', life: 3000 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export CSV', life: 3000 });
  }
};

const exportProductsCsv = async () => {
  try {
    const response = await api.get('/export/products', { responseType: 'blob' });
    downloadBlob(response, 'prodotti.csv');
    toast.add({ severity: 'success', summary: 'Completato', detail: 'Export prodotti completato', life: 3000 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore export CSV', life: 3000 });
  }
};

const downloadBlob = (response: any, filename: string) => {
  const blob = response instanceof Blob ? response : new Blob([response]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// Scheduled reports functions
const openScheduledReportDialog = () => {
  editingReport.value = null;
  scheduledForm.value = {
    name: '',
    reportType: '',
    frequency: 'WEEKLY',
    recipientsText: '',
  };
  showScheduledDialog.value = true;
};

const editScheduledReport = (report: any) => {
  editingReport.value = report;
  scheduledForm.value = {
    name: report.name,
    reportType: report.reportType,
    frequency: report.frequency,
    recipientsText: report.recipients?.join(', ') || '',
  };
  showScheduledDialog.value = true;
};

const saveScheduledReport = async () => {
  try {
    savingScheduled.value = true;
    const payload = {
      name: scheduledForm.value.name,
      reportType: scheduledForm.value.reportType,
      frequency: scheduledForm.value.frequency,
      recipients: scheduledForm.value.recipientsText.split(',').map((e) => e.trim()).filter(Boolean),
      enabled: true,
    };

    if (editingReport.value) {
      await api.put(`/reports/scheduled/${editingReport.value.id}`, payload);
    } else {
      await api.post('/reports/scheduled', payload);
    }

    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Report schedulato salvato', life: 3000 });
    showScheduledDialog.value = false;
    loadScheduledReports();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error.message || 'Errore salvataggio', life: 3000 });
  } finally {
    savingScheduled.value = false;
  }
};

const deleteScheduledReport = async (id: string) => {
  try {
    await api.delete(`/reports/scheduled/${id}`);
    toast.add({ severity: 'success', summary: 'Eliminato', detail: 'Report eliminato', life: 3000 });
    loadScheduledReports();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore eliminazione', life: 3000 });
  }
};

const runScheduledReport = async (id: string) => {
  try {
    await api.post(`/reports/scheduled/${id}/run`);
    toast.add({ severity: 'success', summary: 'Eseguito', detail: 'Report in esecuzione', life: 3000 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Errore esecuzione report', life: 3000 });
  }
};

// Watch tab changes
watch(activeTab, (newTab) => {
  if (newTab === 1) loadCustomerReports();
  if (newTab === 2) {
    loadDeadStock();
    loadCategoryPerformance();
  }
  if (newTab === 3) loadProductionEfficiency();
  if (newTab === 4) loadScheduledReports();
});

onMounted(() => {
  loadFinancialReports();
});
</script>

<style scoped>
.reports-page {
  padding: var(--space-6);
}

.reports-tabs {
  margin-top: var(--space-4);
}

:deep(.p-tabview-panels) {
  padding: var(--space-4) 0;
}

/* Filters Row */
.filters-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-600);
}

/* Report Section */
.report-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--space-5);
}

/* Report Card */
.report-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
  overflow: hidden;
}

.report-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: var(--border-width) solid var(--border-color-light);
  background: var(--color-gray-50);
}

.report-card__header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
}

.report-card__actions {
  display: flex;
  gap: var(--space-2);
}

.report-card__content {
  padding: var(--space-5);
}

/* P&L Grid */
.pl-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pl-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--border-radius);
  background: var(--color-gray-50);
}

.pl-item--revenue {
  background: rgba(34, 197, 94, 0.1);
}

.pl-item--subtotal {
  background: var(--color-gray-100);
  font-weight: 600;
}

.pl-item--total {
  background: var(--primary-color);
  color: white;
  font-weight: 700;
  font-size: var(--font-size-lg);
}

.pl-item--total .pl-item__value.negative {
  color: #fca5a5;
}

.pl-item__label {
  color: var(--color-gray-700);
}

.pl-item__value {
  font-weight: 500;
  color: var(--color-gray-900);
}

.pl-item__value.negative {
  color: var(--red-600);
}

.pl-item__value small {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-left: var(--space-2);
}

.pl-item--total .pl-item__label,
.pl-item--total .pl-item__value {
  color: white;
}

.pl-item--total .pl-item__value small {
  color: rgba(255, 255, 255, 0.8);
}

/* Aging Summary */
.aging-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.aging-item {
  display: flex;
  justify-content: space-between;
  flex: 1;
  min-width: 120px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
  font-size: var(--font-size-sm);
}

.aging-item .success { color: var(--green-600); font-weight: 600; }
.aging-item .warning { color: var(--yellow-600); font-weight: 600; }
.aging-item .danger { color: var(--red-600); font-weight: 600; }

/* Cashflow Summary */
.cashflow-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.cashflow-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
}

.cashflow-item i {
  font-size: 1.5rem;
  color: var(--color-gray-400);
}

.cashflow-item.success i { color: var(--green-500); }
.cashflow-item.danger i { color: var(--red-500); }

.cashflow-item .label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.cashflow-item .value {
  font-weight: 600;
  font-size: var(--font-size-lg);
}

/* RFM Grid */
.rfm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4);
}

.rfm-segment {
  padding: var(--space-4);
  border-radius: var(--border-radius-lg);
  border: 2px solid var(--border-color-light);
}

.rfm--champions { border-color: var(--green-500); background: rgba(34, 197, 94, 0.05); }
.rfm--loyal { border-color: var(--green-400); background: rgba(34, 197, 94, 0.03); }
.rfm--potential { border-color: var(--blue-400); background: rgba(59, 130, 246, 0.05); }
.rfm--new { border-color: var(--cyan-400); background: rgba(6, 182, 212, 0.05); }
.rfm--risk { border-color: var(--yellow-500); background: rgba(234, 179, 8, 0.05); }
.rfm--hibernating { border-color: var(--orange-400); background: rgba(251, 146, 60, 0.05); }
.rfm--lost { border-color: var(--red-400); background: rgba(239, 68, 68, 0.05); }

.rfm-segment__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.segment-name {
  font-weight: 600;
  font-size: var(--font-size-base);
}

.rfm-segment__metrics {
  display: flex;
  gap: var(--space-4);
}

.rfm-segment__metrics .metric {
  display: flex;
  flex-direction: column;
}

.rfm-segment__metrics .label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.rfm-segment__metrics .value {
  font-weight: 600;
}

/* Retention/Churn Summary */
.retention-summary,
.churn-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.retention-item,
.churn-item {
  display: flex;
  justify-content: space-between;
  flex: 1;
  min-width: 100px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius);
  font-size: var(--font-size-sm);
}

.retention-item .value,
.churn-item .value {
  font-weight: 600;
}

.retention-item .value.success,
.churn-item .value.success { color: var(--green-600); }
.retention-item .value.warning,
.churn-item .value.warning { color: var(--yellow-600); }
.retention-item .value.danger,
.churn-item .value.danger { color: var(--red-600); }

/* Dead Stock Summary */
.dead-stock-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--border-radius-lg);
  background: var(--color-gray-50);
  border: var(--border-width) solid var(--border-color-light);
}

.summary-card i {
  font-size: 2rem;
  color: var(--color-gray-400);
}

.summary-card.success { background: rgba(34, 197, 94, 0.1); }
.summary-card.success i { color: var(--green-500); }
.summary-card.warning { background: rgba(234, 179, 8, 0.1); }
.summary-card.warning i { color: var(--yellow-500); }
.summary-card.danger { background: rgba(239, 68, 68, 0.1); }
.summary-card.danger i { color: var(--red-500); }
.summary-card.info { background: rgba(59, 130, 246, 0.1); }
.summary-card.info i { color: var(--blue-500); }

.summary-card .value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.summary-card .label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Production Summary */
.production-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Export Grid */
.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.export-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: 2px solid var(--border-color-light);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.export-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.export-card i {
  font-size: 2.5rem;
  color: var(--primary-color);
  margin-bottom: var(--space-3);
}

.export-card h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.export-card p {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Scheduled Form */
.scheduled-form {
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
  font-weight: 500;
  color: var(--color-gray-700);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
}

/* Tables */
.dead-stock-table,
.category-table {
  margin-top: var(--space-4);
}

.product-name {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.recipients-list {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-gray-400);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.empty-state p {
  font-size: var(--font-size-base);
}

/* Responsive */
@media (max-width: 768px) {
  .reports-page {
    padding: var(--space-4);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }

  .rfm-grid {
    grid-template-columns: 1fr;
  }

  .export-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
