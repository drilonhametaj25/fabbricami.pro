<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
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
const webhookLogs = ref<WebhookLog[]>([]);

onMounted(async () => {
  await Promise.all([loadStripeStatus(), loadWebhookLogs()]);
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
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Stripe Integration</h1>
      <p class="page-subtitle">Gestione integrazione Stripe e webhook</p>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Status Cards -->
      <div class="status-cards-grid">
        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: stripeStatus?.isConfigured }">
            <div class="status-card-icon" :class="stripeStatus?.isConfigured ? 'success' : 'error'">
              <i :class="stripeStatus?.isConfigured ? 'pi pi-check' : 'pi pi-times'"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Stripe API</span>
              <span class="status-card-value">{{ stripeStatus?.isConfigured ? 'Configurato' : 'Non configurato' }}</span>
            </div>
          </div>
        </div>

        <div class="status-card-wrapper">
          <div class="status-card-modern" :class="{ active: stripeStatus?.webhookConfigured }">
            <div class="status-card-icon" :class="stripeStatus?.webhookConfigured ? 'success' : 'error'">
              <i :class="stripeStatus?.webhookConfigured ? 'pi pi-check' : 'pi pi-times'"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Webhook</span>
              <span class="status-card-value">{{ stripeStatus?.webhookConfigured ? 'Configurato' : 'Non configurato' }}</span>
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
                error: stripeStatus?.mode === 'unknown'
              }"
            >
              <i class="pi pi-bolt"></i>
            </div>
            <div class="status-card-content">
              <span class="status-card-label">Modalità</span>
              <Tag
                :value="stripeStatus?.mode === 'live' ? 'LIVE' : stripeStatus?.mode === 'test' ? 'TEST' : 'N/A'"
                :severity="stripeStatus?.mode === 'live' ? 'success' : stripeStatus?.mode === 'test' ? 'warning' : 'danger'"
                class="status-tag"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Instructions -->
      <div v-if="!stripeStatus?.isConfigured" class="config-card">
        <div class="config-header">
          <div class="config-icon">
            <i class="pi pi-cog"></i>
          </div>
          <div class="config-title-section">
            <h3>Configurazione Richiesta</h3>
            <p>Segui questi passaggi per configurare l'integrazione Stripe</p>
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
            </div>
          </div>

          <div class="config-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Price IDs (da Stripe Dashboard)</h4>
              <p>Crea i prodotti su Stripe e aggiungi i Price IDs:</p>
              <pre class="code-block">STRIPE_PRICE_STARTER_MONTHLY=price_xxxxx
STRIPE_PRICE_STARTER_YEARLY=price_xxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxxxx</pre>
            </div>
          </div>

          <div class="config-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Configura Webhook</h4>
              <p>Su Stripe Dashboard, configura il webhook con questo URL:</p>
              <div class="webhook-url">
                <code>https://api.fabbricami.pro/api/v1/subscription/webhook</code>
                <Button
                  icon="pi pi-copy"
                  class="p-button-text p-button-sm"
                  v-tooltip="'Copia URL'"
                  @click="() => navigator.clipboard.writeText('https://api.fabbricami.pro/api/v1/subscription/webhook')"
                />
              </div>
            </div>
          </div>
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
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 1024px) {
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
  gap: 0.375rem;
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

.status-tag {
  margin-top: 0.25rem;
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

:deep(.logs-table .p-datatable-tbody > tr:nth-child(odd)) {
  background: rgba(15, 23, 42, 0.3);
}
</style>
