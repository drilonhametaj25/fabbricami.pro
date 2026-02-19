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
      <div class="grid-3 mb-4">
        <Card>
          <template #content>
            <div class="status-card">
              <div class="status-icon" :class="{ success: stripeStatus?.isConfigured }">
                <i :class="stripeStatus?.isConfigured ? 'pi pi-check' : 'pi pi-times'"></i>
              </div>
              <div class="status-info">
                <h3>Stripe API</h3>
                <p>{{ stripeStatus?.isConfigured ? 'Configurato' : 'Non configurato' }}</p>
              </div>
            </div>
          </template>
        </Card>

        <Card>
          <template #content>
            <div class="status-card">
              <div class="status-icon" :class="{ success: stripeStatus?.webhookConfigured }">
                <i :class="stripeStatus?.webhookConfigured ? 'pi pi-check' : 'pi pi-times'"></i>
              </div>
              <div class="status-info">
                <h3>Webhook</h3>
                <p>{{ stripeStatus?.webhookConfigured ? 'Configurato' : 'Non configurato' }}</p>
              </div>
            </div>
          </template>
        </Card>

        <Card>
          <template #content>
            <div class="status-card">
              <div
                class="status-icon"
                :class="{
                  success: stripeStatus?.mode === 'live',
                  warning: stripeStatus?.mode === 'test',
                }"
              >
                <i class="pi pi-bolt"></i>
              </div>
              <div class="status-info">
                <h3>Modalità</h3>
                <p>
                  <Tag
                    :value="stripeStatus?.mode === 'live' ? 'LIVE' : stripeStatus?.mode === 'test' ? 'TEST' : 'N/A'"
                    :severity="stripeStatus?.mode === 'live' ? 'success' : stripeStatus?.mode === 'test' ? 'warning' : 'danger'"
                  />
                </p>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Configuration Instructions -->
      <Card v-if="!stripeStatus?.isConfigured" class="mb-4">
        <template #title>Configurazione Richiesta</template>
        <template #content>
          <div class="config-instructions">
            <p class="mb-2">Per attivare Stripe, configura le seguenti variabili d'ambiente:</p>
            <pre class="code-block">
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Price IDs (da creare su Stripe Dashboard)
STRIPE_PRICE_STARTER_MONTHLY=price_xxxxx
STRIPE_PRICE_STARTER_YEARLY=price_xxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxxxx</pre>
            <p class="mt-2">
              <strong>Webhook URL:</strong>
              <code>https://api.fabbricami.pro/api/v1/subscription/webhook</code>
            </p>
          </div>
        </template>
      </Card>

      <!-- Webhook Logs -->
      <Card>
        <template #title>
          <div class="flex justify-between items-center">
            <span>Attività Webhook Recente</span>
            <Button
              icon="pi pi-refresh"
              class="p-button-text p-button-sm"
              @click="loadWebhookLogs"
              v-tooltip="'Aggiorna'"
            />
          </div>
        </template>
        <template #content>
          <div v-if="webhookLogs.length === 0" class="empty-state">
            <i class="pi pi-inbox"></i>
            <p>Nessuna attività webhook registrata</p>
          </div>
          <DataTable v-else :value="webhookLogs" :rows="20" :paginator="webhookLogs.length > 20">
            <Column header="Data" style="width: 180px">
              <template #body="{ data }">
                {{ formatDate(data.createdAt) }}
              </template>
            </Column>
            <Column header="Tenant">
              <template #body="{ data }">
                {{ data.subscription?.tenant?.name || '-' }}
              </template>
            </Column>
            <Column header="Invoice ID" style="width: 200px">
              <template #body="{ data }">
                <code v-if="data.stripeInvoiceId" class="invoice-code">
                  {{ data.stripeInvoiceId }}
                </code>
                <span v-else class="text-muted">-</span>
              </template>
            </Column>
            <Column header="Importo" style="width: 120px">
              <template #body="{ data }">
                {{ formatCurrency(data.amount) }}
              </template>
            </Column>
            <Column header="Status" style="width: 100px">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-icon.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-icon.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-icon i {
  font-size: 1.25rem;
}

.status-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 0.25rem;
}

.status-info p {
  color: #94a3b8;
  font-size: 0.875rem;
}

.config-instructions {
  color: #94a3b8;
}

.code-block {
  background: #0f172a;
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  overflow-x: auto;
  color: #e2e8f0;
}

.invoice-code {
  background: #0f172a;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mt-2 {
  margin-top: 0.5rem;
}
</style>
