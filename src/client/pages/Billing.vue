<template>
  <div class="billing-page">
    <PageHeader
      title="Fatturazione e Abbonamento"
      subtitle="Gestisci il tuo piano, visualizza l'utilizzo e lo storico pagamenti"
      icon="pi pi-credit-card"
    />

    <!-- Current Plan Section -->
    <div class="plan-overview">
      <div class="current-plan-card">
        <div class="plan-header">
          <div class="plan-info">
            <span class="plan-label">Piano Attuale</span>
            <h2 class="plan-name">{{ subscriptionStore.currentPlanName }}</h2>
          </div>
          <Tag :severity="statusSeverity" :value="statusLabel" class="status-tag" />
        </div>

        <div class="plan-details">
          <div class="detail-item" v-if="subscriptionStore.isTrialing">
            <i class="pi pi-clock"></i>
            <span>
              Trial termina tra <strong>{{ subscriptionStore.trialDaysRemaining }}</strong> giorni
            </span>
          </div>
          <div class="detail-item" v-else-if="subscriptionStore.willCancelAtPeriodEnd">
            <i class="pi pi-exclamation-circle"></i>
            <span class="text-warning">
              L'abbonamento termina il {{ formatDate(subscriptionStore.currentSubscription?.currentPeriodEnd) }}
            </span>
          </div>
          <div class="detail-item" v-else>
            <i class="pi pi-calendar"></i>
            <span>
              Prossimo rinnovo: <strong>{{ formatDate(subscriptionStore.currentSubscription?.currentPeriodEnd) }}</strong>
            </span>
          </div>
        </div>

        <div class="plan-actions">
          <Button
            label="Cambia Piano"
            icon="pi pi-arrow-up"
            @click="showPlanSelector = true"
            :disabled="loading"
          />
          <Button
            label="Gestisci su Stripe"
            icon="pi pi-external-link"
            severity="secondary"
            @click="openCustomerPortal"
            :loading="openingPortal"
          />
          <Button
            v-if="subscriptionStore.willCancelAtPeriodEnd"
            label="Riattiva Abbonamento"
            icon="pi pi-refresh"
            severity="success"
            @click="reactivateSubscription"
            :loading="reactivating"
          />
        </div>
      </div>
    </div>

    <!-- Usage Section -->
    <div class="usage-section">
      <h3 class="section-title">Utilizzo Risorse</h3>
      <div class="usage-grid">
        <div v-for="(stat, key) in subscriptionStore.usage" :key="key" class="usage-card">
          <div class="usage-header">
            <i :class="getUsageIcon(key)"></i>
            <span class="usage-label">{{ getUsageLabel(key) }}</span>
          </div>
          <div class="usage-values">
            <span class="usage-current">{{ stat.current }}</span>
            <span class="usage-separator">/</span>
            <span class="usage-limit">{{ stat.limit === -1 ? 'Illimitato' : stat.limit }}</span>
          </div>
          <ProgressBar
            :value="stat.percentage"
            :class="getUsageClass(stat.percentage)"
            :showValue="false"
          />
          <span class="usage-percentage">{{ stat.percentage }}%</span>
        </div>
      </div>
    </div>

    <!-- Plans Comparison -->
    <div class="plans-section">
      <h3 class="section-title">Piani Disponibili</h3>
      <div class="billing-toggle">
        <span :class="{ active: billingPeriod === 'monthly' }">Mensile</span>
        <InputSwitch v-model="yearlyBilling" />
        <span :class="{ active: billingPeriod === 'yearly' }">
          Annuale <Tag value="-2 mesi" severity="success" />
        </span>
      </div>

      <div class="plans-grid">
        <div
          v-for="plan in subscriptionStore.availablePlans"
          :key="plan.code"
          :class="['plan-card', { current: plan.code === subscriptionStore.currentPlanCode, recommended: plan.code === 'PRO' }]"
        >
          <div class="plan-card-header">
            <h4 class="plan-card-name">{{ plan.name }}</h4>
            <div class="plan-card-price">
              <span class="price-amount">{{ formatPrice(billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly) }}</span>
              <span class="price-period">/{{ billingPeriod === 'yearly' ? 'anno' : 'mese' }}</span>
            </div>
          </div>

          <div class="plan-card-limits">
            <div class="limit-item">
              <i class="pi pi-users"></i>
              <span>{{ plan.limits.maxUsers === -1 ? 'Illimitati' : plan.limits.maxUsers }} utenti</span>
            </div>
            <div class="limit-item">
              <i class="pi pi-box"></i>
              <span>{{ plan.limits.maxWarehouses === -1 ? 'Illimitati' : plan.limits.maxWarehouses }} magazzini</span>
            </div>
            <div class="limit-item">
              <i class="pi pi-shopping-bag"></i>
              <span>{{ plan.limits.maxProducts === -1 ? 'Illimitati' : plan.limits.maxProducts.toLocaleString('it-IT') }} prodotti</span>
            </div>
          </div>

          <ul class="plan-card-features">
            <li v-for="feature in planFeatureList(plan).slice(0, 5)" :key="feature">
              <i class="pi pi-check"></i>
              {{ feature }}
            </li>
          </ul>

          <div class="plan-card-action">
            <Button
              v-if="plan.code === subscriptionStore.currentPlanCode"
              label="Piano Attuale"
              severity="secondary"
              disabled
              class="w-full"
            />
            <Button
              v-else-if="isPlanUpgrade(plan)"
              :label="`Passa a ${plan.name}`"
              icon="pi pi-arrow-up"
              @click="selectPlan(plan)"
              class="w-full"
            />
            <Button
              v-else
              :label="`Downgrade a ${plan.name}`"
              icon="pi pi-arrow-down"
              severity="secondary"
              @click="selectPlan(plan)"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Billing History -->
    <div class="history-section">
      <h3 class="section-title">Storico Fatturazione</h3>
      <DataTable
        :value="subscriptionStore.billingHistory"
        :loading="loadingHistory"
        responsiveLayout="scroll"
        class="billing-table"
        emptyMessage="Nessuna fattura disponibile"
      >
        <Column field="date" header="Data" sortable>
          <template #body="{ data }">
            {{ formatDate(data.date) }}
          </template>
        </Column>
        <Column field="description" header="Descrizione" />
        <Column field="amount" header="Importo" sortable>
          <template #body="{ data }">
            {{ formatPrice(data.amount) }}
          </template>
        </Column>
        <Column field="status" header="Stato">
          <template #body="{ data }">
            <Tag :severity="getInvoiceStatusSeverity(data.status)" :value="getInvoiceStatusLabel(data.status)" />
          </template>
        </Column>
        <Column header="Fattura">
          <template #body="{ data }">
            <Button
              v-if="data.invoiceUrl"
              icon="pi pi-download"
              severity="secondary"
              text
              rounded
              @click="downloadInvoice(data.invoiceUrl)"
              v-tooltip="'Scarica fattura'"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Plan Selection Dialog -->
    <Dialog
      v-model:visible="showPlanSelector"
      :header="selectedPlan ? 'Conferma Cambio Piano' : 'Scegli il nuovo piano'"
      :modal="true"
      :style="{ width: selectedPlan ? '500px' : '720px' }"
      @hide="onPlanDialogHide"
    >
      <!-- STEP 1: scelta piano (nessun piano preselezionato, es. da bottone header) -->
      <div v-if="!selectedPlan" class="plan-picker">
        <p class="plan-picker-intro">
          Seleziona il piano a cui vuoi passare. Il piano attuale è
          <strong>{{ subscriptionStore.currentPlanName }}</strong>.
        </p>
        <div class="plan-picker-grid">
          <div
            v-for="plan in subscriptionStore.availablePlans"
            :key="plan.code"
            class="plan-picker-card"
            :class="{ disabled: plan.code === subscriptionStore.currentPlanCode }"
            @click="plan.code !== subscriptionStore.currentPlanCode && (selectedPlan = plan)"
          >
            <div class="plan-picker-name">
              {{ plan.name }}
              <Tag
                v-if="plan.code === subscriptionStore.currentPlanCode"
                value="Attuale"
                severity="secondary"
              />
            </div>
            <div class="plan-picker-price">
              <strong>{{ formatPrice(billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly) }}</strong>
              <span>/{{ billingPeriod === 'yearly' ? 'anno' : 'mese' }}</span>
            </div>
            <div class="plan-picker-limits">
              {{ plan.limits.maxUsers === -1 ? '∞' : plan.limits.maxUsers }} utenti ·
              {{ plan.limits.maxWarehouses === -1 ? '∞' : plan.limits.maxWarehouses }} magazzini ·
              {{ plan.limits.maxProducts === -1 ? '∞' : plan.limits.maxProducts.toLocaleString('it-IT') }} prodotti
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 2: conferma cambio piano -->
      <div v-else class="plan-change-dialog">
        <p>
          Stai passando da <strong>{{ subscriptionStore.currentPlanName }}</strong>
          a <strong>{{ selectedPlan.name }}</strong>.
        </p>
        <div class="price-summary">
          <div class="price-row">
            <span>Nuovo prezzo:</span>
            <strong>{{ formatPrice(billingPeriod === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly) }}/{{ billingPeriod === 'yearly' ? 'anno' : 'mese' }}</strong>
          </div>
        </div>

        <!-- Warning downgrade su risorse oltre il limite del nuovo piano -->
        <div v-if="downgradeOverages.length > 0" class="downgrade-warning">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Attenzione: alcune risorse superano i limiti del piano scelto</strong>
            <ul>
              <li v-for="o in downgradeOverages" :key="o.key">
                {{ o.label }}: <strong>{{ o.current }}</strong> attuali ·
                <strong>{{ o.newLimit === -1 ? '∞' : o.newLimit }}</strong> consentiti dal piano {{ selectedPlan.name }}
                (rimuovine almeno <strong>{{ o.toRemove }}</strong>)
              </li>
            </ul>
            <small>Riduci le risorse oltre limite prima del downgrade per evitare blocchi alle nuove creazioni.</small>
          </div>
        </div>

        <p class="change-note" v-if="isPlanUpgrade(selectedPlan)">
          Il cambio sarà effettivo immediatamente. Ti verrà addebitata la differenza proporzionale.
        </p>
        <p class="change-note" v-else>
          Il downgrade sarà effettivo alla fine del periodo corrente.
        </p>
      </div>

      <template #footer>
        <Button label="Annulla" severity="secondary" @click="showPlanSelector = false" />
        <Button
          v-if="selectedPlan"
          label="← Cambia piano scelto"
          severity="secondary"
          text
          @click="selectedPlan = null"
        />
        <Button
          v-if="selectedPlan"
          label="Conferma Cambio"
          icon="pi pi-check"
          @click="confirmPlanChange"
          :loading="changingPlan"
        />
      </template>
    </Dialog>

    <!-- Cancel Subscription Dialog -->
    <Dialog
      v-model:visible="showCancelDialog"
      header="Cancella Abbonamento"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="cancel-dialog">
        <i class="pi pi-exclamation-triangle warning-icon"></i>
        <p>Sei sicuro di voler cancellare il tuo abbonamento?</p>
        <p class="cancel-note">
          L'abbonamento rimarrà attivo fino alla fine del periodo corrente
          ({{ formatDate(subscriptionStore.currentSubscription?.currentPeriodEnd) }}).
        </p>
      </div>
      <template #footer>
        <Button label="Mantieni Abbonamento" @click="showCancelDialog = false" />
        <Button
          label="Cancella Abbonamento"
          severity="danger"
          @click="cancelSubscription"
          :loading="cancelling"
        />
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
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import InputSwitch from 'primevue/inputswitch';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import { useSubscriptionStore } from '../stores/subscription.store';
import type { SubscriptionPlan } from '../types';

const toast = useToast();
const subscriptionStore = useSubscriptionStore();

// State
const loading = ref(false);
const loadingHistory = ref(false);
const openingPortal = ref(false);
const changingPlan = ref(false);
const cancelling = ref(false);
const reactivating = ref(false);
const yearlyBilling = ref(false);
const showPlanSelector = ref(false);
const showCancelDialog = ref(false);
const selectedPlan = ref<SubscriptionPlan | null>(null);

// Computed
const billingPeriod = computed(() => (yearlyBilling.value ? 'yearly' : 'monthly'));

const statusSeverity = computed(() => {
  switch (subscriptionStore.currentSubscription?.status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIALING':
      return 'info';
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELLED':
    case 'PAUSED':
      return 'danger';
    default:
      return 'info';
  }
});

const statusLabel = computed(() => {
  switch (subscriptionStore.currentSubscription?.status) {
    case 'ACTIVE':
      return 'Attivo';
    case 'TRIALING':
      return 'Trial';
    case 'PAST_DUE':
      return 'Pagamento in ritardo';
    case 'CANCELLED':
      return 'Cancellato';
    case 'PAUSED':
      return 'In pausa';
    default:
      return 'Sconosciuto';
  }
});

// Mappa key risorsa (es. 'warehouses') → limit key del piano (es. 'maxWarehouses')
const USAGE_PLAN_LIMIT_MAP: Record<string, { limitKey: string; label: string }> = {
  users: { limitKey: 'maxUsers', label: 'Utenti' },
  warehouses: { limitKey: 'maxWarehouses', label: 'Magazzini' },
  products: { limitKey: 'maxProducts', label: 'Prodotti' },
  customers: { limitKey: 'maxCustomers', label: 'Clienti' },
  suppliers: { limitKey: 'maxSuppliers', label: 'Fornitori' },
  orders: { limitKey: 'maxOrders', label: 'Ordini' },
};

/**
 * Risorse che superano i limiti del piano selezionato (solo per downgrade).
 */
const downgradeOverages = computed<Array<{ key: string; label: string; current: number; newLimit: number; toRemove: number }>>(() => {
  const plan = selectedPlan.value;
  if (!plan) return [];
  if (isPlanUpgrade(plan)) return [];

  const usage = subscriptionStore.usage || {};
  const limits: any = plan.limits || {};
  const out: Array<{ key: string; label: string; current: number; newLimit: number; toRemove: number }> = [];

  for (const [usageKey, meta] of Object.entries(USAGE_PLAN_LIMIT_MAP)) {
    const stat = (usage as any)[usageKey];
    if (!stat) continue;
    const newLimit = limits[meta.limitKey];
    if (newLimit === undefined || newLimit === -1) continue;
    if (typeof stat.current === 'number' && stat.current > newLimit) {
      out.push({
        key: usageKey,
        label: meta.label,
        current: stat.current,
        newLimit,
        toRemove: stat.current - newLimit,
      });
    }
  }
  return out;
});

function onPlanDialogHide() {
  // Reset stato quando il dialog si chiude (X, ESC o click outside)
  selectedPlan.value = null;
}

// Methods
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function getUsageIcon(key: string): string {
  const icons: Record<string, string> = {
    users: 'pi pi-users',
    warehouses: 'pi pi-box',
    products: 'pi pi-shopping-bag',
    orders: 'pi pi-shopping-cart',
    suppliers: 'pi pi-truck',
  };
  return icons[key] || 'pi pi-chart-bar';
}

function getUsageLabel(key: string): string {
  const labels: Record<string, string> = {
    users: 'Utenti',
    warehouses: 'Magazzini',
    products: 'Prodotti',
    orders: 'Ordini',
    suppliers: 'Fornitori',
  };
  return labels[key] || key;
}

function getUsageClass(percentage: number): string {
  if (percentage >= 100) return 'usage-critical';
  if (percentage >= 80) return 'usage-warning';
  return 'usage-ok';
}

function getInvoiceStatusSeverity(status: string): string {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Pagato';
    case 'pending':
      return 'In attesa';
    case 'failed':
      return 'Fallito';
    default:
      return status;
  }
}

function isPlanUpgrade(plan: SubscriptionPlan): boolean {
  const currentPlan = subscriptionStore.currentPlan;
  if (!currentPlan) return true;
  return plan.priceMonthly > currentPlan.priceMonthly;
}

// L'API restituisce features come { modules, capabilities } (struttura nuova)
// o come string[] (legacy). Appiattiamo in modo da poter iterare uniformemente.
function planFeatureList(plan: SubscriptionPlan | null | undefined): string[] {
  const f = (plan as any)?.features;
  if (Array.isArray(f)) return f;
  if (f && typeof f === 'object') {
    return [
      ...(Array.isArray(f.modules) ? f.modules : []),
      ...(Array.isArray(f.capabilities) ? f.capabilities : []),
    ];
  }
  return [];
}

function selectPlan(plan: SubscriptionPlan) {
  selectedPlan.value = plan;
  showPlanSelector.value = true;
}

async function confirmPlanChange() {
  if (!selectedPlan.value) return;

  changingPlan.value = true;
  try {
    if (subscriptionStore.isTrialing) {
      // Durante trial, vai a checkout
      const checkoutUrl = await subscriptionStore.createCheckout(
        selectedPlan.value.code,
        billingPeriod.value
      );
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } else {
      // Se già abbonato, aggiorna piano
      const success = await subscriptionStore.updateSubscription(selectedPlan.value.code);
      if (success) {
        toast.add({
          severity: 'success',
          summary: 'Piano Aggiornato',
          detail: `Sei passato al piano ${selectedPlan.value.name}`,
          life: 5000,
        });
        showPlanSelector.value = false;
        selectedPlan.value = null;
      }
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile cambiare piano',
      life: 5000,
    });
  } finally {
    changingPlan.value = false;
  }
}

async function openCustomerPortal() {
  openingPortal.value = true;
  try {
    const portalUrl = await subscriptionStore.openCustomerPortal();
    if (portalUrl) {
      window.open(portalUrl, '_blank');
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile aprire il portale Stripe',
      life: 5000,
    });
  } finally {
    openingPortal.value = false;
  }
}

async function cancelSubscription() {
  cancelling.value = true;
  try {
    const success = await subscriptionStore.cancelSubscription(true);
    if (success) {
      toast.add({
        severity: 'info',
        summary: 'Abbonamento Cancellato',
        detail: 'L\'abbonamento terminerà alla fine del periodo corrente',
        life: 5000,
      });
      showCancelDialog.value = false;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile cancellare l\'abbonamento',
      life: 5000,
    });
  } finally {
    cancelling.value = false;
  }
}

async function reactivateSubscription() {
  reactivating.value = true;
  try {
    const success = await subscriptionStore.reactivateSubscription();
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Abbonamento Riattivato',
        detail: 'L\'abbonamento continuerà normalmente',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile riattivare l\'abbonamento',
      life: 5000,
    });
  } finally {
    reactivating.value = false;
  }
}

function downloadInvoice(url: string) {
  window.open(url, '_blank');
}

// Load data on mount
onMounted(async () => {
  loading.value = true;
  loadingHistory.value = true;

  try {
    await Promise.all([
      subscriptionStore.fetchSubscription(),
      subscriptionStore.fetchPlans(),
      subscriptionStore.fetchUsage(),
      subscriptionStore.fetchBillingHistory(),
    ]);
  } finally {
    loading.value = false;
    loadingHistory.value = false;
  }
});
</script>

<style scoped>
.billing-page {
  max-width: 1200px;
}

/* Current Plan Card */
.plan-overview {
  margin-bottom: var(--space-8);
}

.current-plan-card {
  background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
  border-radius: var(--border-radius-xl);
  padding: var(--space-8);
  color: white;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
}

.plan-label {
  font-size: var(--font-size-sm);
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.plan-name {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin: var(--space-1) 0 0 0;
}

.plan-details {
  margin-bottom: var(--space-6);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
}

.detail-item i {
  font-size: 1.25rem;
}

.text-warning {
  color: var(--color-yellow-300);
}

.plan-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Usage Section */
.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-5) 0;
}

.usage-section {
  margin-bottom: var(--space-8);
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.usage-card {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
}

.usage-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.usage-header i {
  color: var(--color-primary-600);
  font-size: 1.25rem;
}

.usage-label {
  font-weight: 500;
  color: var(--color-gray-700);
}

.usage-values {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.usage-current {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.usage-separator {
  color: var(--color-gray-400);
}

.usage-limit {
  font-size: var(--font-size-lg);
  color: var(--color-gray-500);
}

.usage-percentage {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-2);
  display: block;
  text-align: right;
}

:deep(.usage-ok .p-progressbar-value) {
  background: var(--color-green-500);
}

:deep(.usage-warning .p-progressbar-value) {
  background: var(--color-yellow-500);
}

:deep(.usage-critical .p-progressbar-value) {
  background: var(--color-red-500);
}

/* Plans Section */
.plans-section {
  margin-bottom: var(--space-8);
}

.billing-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  font-weight: 500;
}

.billing-toggle span {
  color: var(--color-gray-500);
  transition: color 0.2s;
}

.billing-toggle span.active {
  color: var(--color-gray-900);
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}

.plan-card {
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-xl);
  padding: var(--space-6);
  position: relative;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: var(--color-primary-300);
  box-shadow: var(--shadow-lg);
}

.plan-card.current {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.plan-card.recommended::before {
  content: 'Consigliato';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary-600);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-full);
}

.plan-card-header {
  text-align: center;
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: var(--border-width) solid var(--border-color);
}

.plan-card-name {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin: 0 0 var(--space-2) 0;
  color: var(--color-gray-900);
}

.plan-card-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-1);
}

.price-amount {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-primary-600);
}

.price-period {
  font-size: var(--font-size-base);
  color: var(--color-gray-500);
}

.plan-card-limits {
  margin-bottom: var(--space-5);
}

.limit-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.limit-item i {
  color: var(--color-primary-600);
  width: 20px;
}

.plan-card-features {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-5) 0;
}

.plan-card-features li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.plan-card-features li i {
  color: var(--color-green-500);
  font-size: 0.875rem;
}

.plan-card-action {
  margin-top: auto;
}

/* History Section */
.history-section {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
}

.billing-table {
  margin-top: var(--space-4);
}

/* Dialogs */
.plan-change-dialog,
.cancel-dialog {
  text-align: center;
}

.price-summary {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  margin: var(--space-4) 0;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.change-note {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin-top: var(--space-4);
}

.cancel-dialog .warning-icon {
  font-size: 3rem;
  color: var(--color-yellow-500);
  margin-bottom: var(--space-4);
}

.cancel-note {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin-top: var(--space-3);
}

/* Responsive */
@media (max-width: 768px) {
  .plan-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .plan-actions {
    flex-direction: column;
  }

  .plans-grid {
    grid-template-columns: 1fr;
  }
}

/* Plan picker (step 1 del dialog Cambia Piano) */
.plan-picker-intro {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-gray-600);
}
.plan-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}
.plan-picker-card {
  border: 1px solid var(--color-gray-200);
  border-radius: var(--border-radius-md);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
  background: white;
}
.plan-picker-card:hover {
  border-color: var(--color-primary-500, #3b82f6);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transform: translateY(-1px);
}
.plan-picker-card.disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: var(--color-gray-50);
}
.plan-picker-card.disabled:hover {
  border-color: var(--color-gray-200);
  box-shadow: none;
  transform: none;
}
.plan-picker-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-weight: 700;
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
  margin-bottom: var(--space-2);
}
.plan-picker-price {
  font-size: var(--font-size-lg);
  color: var(--color-primary-600, #2563eb);
  margin-bottom: var(--space-2);
}
.plan-picker-price strong { font-size: var(--font-size-xl); }
.plan-picker-price span { color: var(--color-gray-500); font-size: var(--font-size-sm); }
.plan-picker-limits {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Downgrade warning box */
.downgrade-warning {
  display: flex;
  gap: var(--space-3);
  background: #fff7ed;
  border: 1px solid #fdba74;
  color: #9a3412;
  border-radius: var(--border-radius-md);
  padding: var(--space-3);
  margin: var(--space-3) 0;
}
.downgrade-warning > i {
  color: #ea580c;
  font-size: 1.25rem;
  margin-top: 2px;
}
.downgrade-warning ul {
  margin: var(--space-2) 0;
  padding-left: 1.25rem;
}
.downgrade-warning li { margin: 2px 0; }
.downgrade-warning small { color: #9a3412; opacity: 0.85; }

</style>
