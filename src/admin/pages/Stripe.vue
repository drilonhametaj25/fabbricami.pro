<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

const toast = useToast();

interface StripeStatus {
  isConfigured: boolean;
  mode: 'live' | 'test' | 'unknown';
  webhookConfigured: boolean;
}

interface StripeConnection {
  connected: boolean;
  accountId?: string;
  businessName?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  country?: string;
  defaultCurrency?: string;
  error?: string;
}

interface PlanSyncStatus {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  stripeProductId: string | null;
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
  isActive: boolean;
  syncStatus: 'synced' | 'partial' | 'not_synced';
  subscriptionCount: number;
}

interface WebhookLog {
  id: string;
  stripeInvoiceId?: string;
  amount: number;
  status: string;
  createdAt: string;
  subscription: {
    tenant: {
      name: string;
    };
  };
}

const loading = ref(true);
const stripeStatus = ref<StripeStatus | null>(null);
const stripeConnection = ref<StripeConnection | null>(null);
const plansSyncStatus = ref<PlanSyncStatus[]>([]);
const webhookLogs = ref<WebhookLog[]>([]);
const testingConnection = ref(false);
const syncingAll = ref(false);
const syncingPlan = ref<string | null>(null);

const syncedPlansCount = computed(() =>
  plansSyncStatus.value.filter((p) => p.syncStatus === 'synced').length
);

const totalPlansCount = computed(() => plansSyncStatus.value.length);

const unsyncedPlans = computed(() =>
  plansSyncStatus.value.filter((p) => p.syncStatus !== 'synced' && p.isActive)
);

onMounted(async () => {
  await Promise.all([
    loadStripeStatus(),
    loadStripeConnection(),
    loadPlansSyncStatus(),
    loadWebhookLogs(),
  ]);
  loading.value = false;
});

async function loadStripeStatus() {
  try {
    const response = await adminApi.getStripeStatus();
    if (response.success && response.data) {
      stripeStatus.value = response.data;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare lo stato di Stripe',
      life: 3000,
    });
  }
}

async function loadStripeConnection() {
  try {
    const response = await adminApi.testStripeConnection();
    if (response.success && response.data) {
      stripeConnection.value = response.data;
    }
  } catch (error) {
    // Silent fail - will show as not connected
  }
}

async function loadPlansSyncStatus() {
  try {
    const response = await adminApi.getPlansStripeStatus();
    if (response.success && response.data) {
      plansSyncStatus.value = response.data.plans;
    }
  } catch (error) {
    // Silent fail
  }
}

async function loadWebhookLogs() {
  try {
    const response = await adminApi.getWebhookLogs(50);
    if (response.success && response.data) {
      webhookLogs.value = response.data.items;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare i log webhook',
      life: 3000,
    });
  }
}

async function testConnection() {
  testingConnection.value = true;
  try {
    const response = await adminApi.testStripeConnection();
    if (response.success && response.data) {
      stripeConnection.value = response.data;
      if (response.data.connected) {
        toast.add({
          severity: 'success',
          summary: 'Connesso',
          detail: `Connesso a Stripe (${response.data.accountId})`,
          life: 3000,
        });
      } else {
        toast.add({
          severity: 'error',
          summary: 'Non connesso',
          detail: response.data.error || 'Impossibile connettersi a Stripe',
          life: 5000,
        });
      }
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore durante il test di connessione',
      life: 3000,
    });
  } finally {
    testingConnection.value = false;
  }
}

async function syncPlanToStripe(plan: PlanSyncStatus) {
  syncingPlan.value = plan.id;
  try {
    const response = await adminApi.syncPlanToStripe(plan.id);
    if (response.success && response.data) {
      toast.add({
        severity: 'success',
        summary: 'Sincronizzato',
        detail: `Piano "${plan.name}" sincronizzato con Stripe`,
        life: 3000,
      });
      await loadPlansSyncStatus();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Sincronizzazione fallita',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore di connessione',
      life: 3000,
    });
  } finally {
    syncingPlan.value = null;
  }
}

async function syncAllPlans() {
  syncingAll.value = true;
  try {
    const response = await adminApi.syncAllPlansToStripe();
    if (response.success && response.data) {
      const { syncedCount, failedCount } = response.data;
      if (failedCount === 0) {
        toast.add({
          severity: 'success',
          summary: 'Completato',
          detail: `${syncedCount} piani sincronizzati con successo`,
          life: 3000,
        });
      } else {
        toast.add({
          severity: 'warn',
          summary: 'Parziale',
          detail: `${syncedCount} sincronizzati, ${failedCount} falliti`,
          life: 5000,
        });
      }
      await loadPlansSyncStatus();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Sincronizzazione fallita',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore di connessione',
      life: 3000,
    });
  } finally {
    syncingAll.value = false;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function getStatusSeverity(status: string): 'success' | 'warning' | 'danger' | undefined {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return undefined;
  }
}

function getSyncStatusSeverity(status: string): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'synced':
      return 'success';
    case 'partial':
      return 'warning';
    default:
      return 'danger';
  }
}

function getSyncStatusLabel(status: string): string {
  switch (status) {
    case 'synced':
      return 'Sincronizzato';
    case 'partial':
      return 'Parziale';
    default:
      return 'Non sincronizzato';
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Stripe Integration</h1>
      <p class="page-subtitle">Gestione integrazione Stripe, sincronizzazione piani e webhook</p>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Status Cards -->
      <div class="status-cards-grid">
        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: stripeConnection?.connected }">
            <div
              class="status-card-icon"
              :class="stripeConnection?.connected ? 'success' : 'error'"
            >
              <i :class="stripeConnection?.connected ? 'pi pi-check' : 'pi pi-times'"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Connessione Stripe</span>
              <span class="status-card-value">
                {{ stripeConnection?.connected ? 'Connesso' : 'Non connesso' }}
              </span>
              <span v-if="stripeConnection?.accountId" class="status-card-detail">
                {{ stripeConnection.accountId }}
              </span>
            </div>
            <Button
              icon="pi pi-refresh"
              class="p-button-text p-button-sm test-btn"
              :loading="testingConnection"
              @click="testConnection"
              v-tooltip="'Testa connessione'"
            />
          </div>
        </div>

        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: stripeStatus?.webhookConfigured }">
            <div
              class="status-card-icon"
              :class="stripeStatus?.webhookConfigured ? 'success' : 'error'"
            >
              <i :class="stripeStatus?.webhookConfigured ? 'pi pi-check' : 'pi pi-times'"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Webhook</span>
              <span class="status-card-value">
                {{ stripeStatus?.webhookConfigured ? 'Configurato' : 'Non configurato' }}
              </span>
            </div>
          </div>
        </div>

        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: stripeStatus?.mode !== 'unknown' }">
            <div
              class="status-card-icon"
              :class="{
                success: stripeStatus?.mode === 'live',
                warning: stripeStatus?.mode === 'test',
                error: stripeStatus?.mode === 'unknown',
              }"
            >
              <i class="pi pi-bolt"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Modalità</span>
              <Tag
                :value="
                  stripeStatus?.mode === 'live'
                    ? 'LIVE'
                    : stripeStatus?.mode === 'test'
                      ? 'TEST'
                      : 'N/A'
                "
                :severity="
                  stripeStatus?.mode === 'live'
                    ? 'success'
                    : stripeStatus?.mode === 'test'
                      ? 'warning'
                      : 'danger'
                "
                class="status-tag"
              />
            </div>
          </div>
        </div>

        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: syncedPlansCount === totalPlansCount }">
            <div
              class="status-card-icon"
              :class="syncedPlansCount === totalPlansCount ? 'success' : 'warning'"
            >
              <i class="pi pi-sync"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Piani Sincronizzati</span>
              <span class="status-card-value"> {{ syncedPlansCount }} / {{ totalPlansCount }} </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Instructions (only if not configured) -->
      <div v-if="!stripeStatus?.isConfigured" class="config-card">
        <div class="config-header">
          <div class="config-icon">
            <i class="pi pi-cog"></i>
          </div>
          <div class="config-title-section">
            <h3>Configurazione Richiesta</h3>
            <p>Configura le variabili d'ambiente per attivare Stripe</p>
          </div>
        </div>

        <div class="config-content">
          <div class="config-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Variabili d'ambiente</h4>
              <p>Aggiungi queste variabili al tuo file <code>.env</code>:</p>
              <pre class="code-block">STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx</pre>
              <p class="note">
                I Price IDs non sono più necessari come variabili. Vengono creati automaticamente e
                salvati nel database.
              </p>
            </div>
          </div>

          <div class="config-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Configura Webhook</h4>
              <p>Su Stripe Dashboard, configura il webhook con questo URL:</p>
              <div class="webhook-url">
                <code>https://api.fabbricami.pro/api/v1/subscription/webhook</code>
                <Button
                  icon="pi pi-copy"
                  class="p-button-text p-button-sm"
                  v-tooltip="'Copia URL'"
                  @click="
                    () =>
                      navigator.clipboard.writeText(
                        'https://api.fabbricami.pro/api/v1/subscription/webhook'
                      )
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Plans Sync Status -->
      <div class="sync-card" v-if="stripeStatus?.isConfigured">
        <div class="sync-header">
          <div class="sync-title">
            <i class="pi pi-sync"></i>
            <h3>Sincronizzazione Piani</h3>
          </div>
          <div class="sync-actions">
            <Button
              v-if="unsyncedPlans.length > 0"
              :label="`Sincronizza Tutti (${unsyncedPlans.length})`"
              icon="pi pi-cloud-upload"
              :loading="syncingAll"
              @click="syncAllPlans"
            />
          </div>
        </div>

        <div class="sync-content">
          <div v-if="plansSyncStatus.length === 0" class="empty-state">
            <div class="empty-icon">
              <i class="pi pi-box"></i>
            </div>
            <h4>Nessun piano</h4>
            <p>Crea i piani dalla pagina Gestione Piani</p>
          </div>

          <DataTable
            v-else
            :value="plansSyncStatus"
            :rows="10"
            stripedRows
            class="sync-table"
          >
            <Column header="Piano" style="min-width: 180px">
              <template #body="{ data }">
                <div class="plan-info">
                  <Tag :value="data.code" :severity="data.isActive ? 'info' : 'danger'" />
                  <span class="plan-name">{{ data.name }}</span>
                </div>
              </template>
            </Column>
            <Column header="Prezzi" style="width: 160px">
              <template #body="{ data }">
                <div class="prices">
                  <div>{{ formatCurrency(data.priceMonthly) }}/mese</div>
                  <div class="text-muted text-sm">{{ formatCurrency(data.priceYearly) }}/anno</div>
                </div>
              </template>
            </Column>
            <Column header="Stato Sync" style="width: 150px">
              <template #body="{ data }">
                <Tag
                  :value="getSyncStatusLabel(data.syncStatus)"
                  :severity="getSyncStatusSeverity(data.syncStatus)"
                />
              </template>
            </Column>
            <Column header="Stripe Product" style="width: 200px">
              <template #body="{ data }">
                <code v-if="data.stripeProductId" class="stripe-id">
                  {{ data.stripeProductId }}
                </code>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>
            <Column header="Abbonati" style="width: 100px">
              <template #body="{ data }">
                {{ data.subscriptionCount }}
              </template>
            </Column>
            <Column header="Azioni" style="width: 120px">
              <template #body="{ data }">
                <Button
                  v-if="data.syncStatus !== 'synced'"
                  icon="pi pi-cloud-upload"
                  label="Sync"
                  class="p-button-outlined p-button-sm"
                  :loading="syncingPlan === data.id"
                  :disabled="!data.isActive"
                  @click="syncPlanToStripe(data)"
                />
                <i v-else class="pi pi-check-circle sync-ok" v-tooltip="'Sincronizzato'"></i>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- Webhook Logs -->
      <div class="logs-card">
        <div class="logs-header">
          <div class="logs-title">
            <i class="pi pi-history"></i>
            <h3>Attività Webhook Recente</h3>
          </div>
          <Button
            icon="pi pi-refresh"
            label="Aggiorna"
            class="p-button-outlined p-button-sm"
            @click="loadWebhookLogs"
          />
        </div>

        <div class="logs-content">
          <div v-if="webhookLogs.length === 0" class="empty-state">
            <div class="empty-icon">
              <i class="pi pi-inbox"></i>
            </div>
            <h4>Nessuna attività</h4>
            <p>I webhook ricevuti appariranno qui</p>
          </div>

          <DataTable
            v-else
            :value="webhookLogs"
            :rows="15"
            :paginator="webhookLogs.length > 15"
            stripedRows
            class="logs-table"
          >
            <Column header="Data" style="width: 160px">
              <template #body="{ data }">
                <span class="date-cell">{{ formatDate(data.createdAt) }}</span>
              </template>
            </Column>
            <Column header="Tenant">
              <template #body="{ data }">
                <span class="tenant-name">{{ data.subscription?.tenant?.name || '-' }}</span>
              </template>
            </Column>
            <Column header="Invoice ID" style="width: 220px">
              <template #body="{ data }">
                <code v-if="data.stripeInvoiceId" class="invoice-code">
                  {{ data.stripeInvoiceId }}
                </code>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>
            <Column header="Importo" style="width: 130px">
              <template #body="{ data }">
                <span class="amount-cell">{{ formatCurrency(data.amount) }}</span>
              </template>
            </Column>
            <Column header="Status" style="width: 110px">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

/* Status Cards Grid */
.status-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 1280px) {
  .status-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .status-cards-grid {
    grid-template-columns: 1fr;
  }
}

.status-card-modern {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  transition: all 0.2s ease;
  position: relative;
}

.status-card-modern:hover {
  border-color: #475569;
  transform: translateY(-2px);
}

.status-card-modern.active {
  border-color: #22c55e40;
}

.status-card-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-card-icon.success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1));
  color: #22c55e;
}

.status-card-icon.warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1));
  color: #f59e0b;
}

.status-card-icon.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
  color: #ef4444;
}

.status-card-icon i {
  font-size: 1.5rem;
}

.status-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.status-card-label {
  font-size: 0.8125rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-card-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
}

.status-card-detail {
  font-size: 0.75rem;
  color: #64748b;
  font-family: monospace;
}

.status-tag {
  margin-top: 0.25rem;
}

.test-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
}

/* Configuration Card */
.config-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  margin-bottom: 2rem;
  overflow: hidden;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
  background: linear-gradient(to right, rgba(79, 70, 229, 0.1), transparent);
}

.config-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(79, 70, 229, 0.2);
  color: #818cf8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-icon i {
  font-size: 1.25rem;
}

.config-title-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 0.25rem;
}

.config-title-section p {
  font-size: 0.875rem;
  color: #94a3b8;
}

.config-content {
  padding: 1.5rem;
}

.config-step {
  display: flex;
  gap: 1.25rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid #334155;
}

.config-step:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.config-step:first-child {
  padding-top: 0;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-content h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 0.5rem;
}

.step-content p {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-bottom: 0.75rem;
}

.step-content .note {
  background: rgba(34, 197, 94, 0.1);
  border-left: 3px solid #22c55e;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
  color: #86efac;
}

.step-content code {
  background: #0f172a;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  color: #f59e0b;
}

.code-block {
  background: #0f172a;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  overflow-x: auto;
  color: #e2e8f0;
  line-height: 1.6;
  border: 1px solid #334155;
}

.webhook-url {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #0f172a;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
}

.webhook-url code {
  background: transparent;
  padding: 0;
  color: #22c55e;
  font-size: 0.875rem;
}

/* Sync Card */
.sync-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  margin-bottom: 2rem;
  overflow: hidden;
}

.sync-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #334155;
}

.sync-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sync-title i {
  font-size: 1.25rem;
  color: #94a3b8;
}

.sync-title h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
}

.sync-content {
  padding: 1.5rem;
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.plan-name {
  font-weight: 500;
  color: #f1f5f9;
}

.prices {
  font-size: 0.875rem;
}

.text-sm {
  font-size: 0.75rem;
}

.stripe-id {
  background: #0f172a;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.7rem;
  color: #94a3b8;
  font-family: monospace;
}

.sync-ok {
  font-size: 1.5rem;
  color: #22c55e;
}

/* Logs Card */
.logs-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  overflow: hidden;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #334155;
}

.logs-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logs-title i {
  font-size: 1.25rem;
  color: #94a3b8;
}

.logs-title h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
}

.logs-content {
  padding: 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon i {
  font-size: 1.75rem;
  color: #64748b;
}

.empty-state h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.375rem;
}

.empty-state p {
  font-size: 0.875rem;
  color: #64748b;
}

/* Table styling */
.date-cell {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.tenant-name {
  font-weight: 500;
  color: #f1f5f9;
}

.amount-cell {
  font-weight: 600;
  color: #f1f5f9;
}

.invoice-code {
  background: #0f172a;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: monospace;
}

:deep(.logs-table .p-datatable-tbody > tr:nth-child(odd)),
:deep(.sync-table .p-datatable-tbody > tr:nth-child(odd)) {
  background: rgba(15, 23, 42, 0.3);
}
</style>
