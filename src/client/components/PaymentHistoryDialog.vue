<script setup lang="ts">
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Timeline from 'primevue/timeline';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';

interface PaymentDuePayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

interface PaymentDue {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  payments?: PaymentDuePayment[];
}

interface Props {
  modelValue: boolean;
  paymentDue: PaymentDue | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Format datetime
const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get method label
const getMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    BONIFICO: 'Bonifico Bancario',
    RIBA: 'RiBa',
    CONTANTI: 'Contanti',
    ASSEGNO: 'Assegno',
    CARTA: 'Carta di Credito',
    PAYPAL: 'PayPal',
    ALTRO: 'Altro',
  };
  return labels[method] || method;
};

// Get method icon
const getMethodIcon = (method: string) => {
  const icons: Record<string, string> = {
    BONIFICO: 'pi pi-building',
    RIBA: 'pi pi-file',
    CONTANTI: 'pi pi-wallet',
    ASSEGNO: 'pi pi-money-bill',
    CARTA: 'pi pi-credit-card',
    PAYPAL: 'pi pi-paypal',
    ALTRO: 'pi pi-dollar',
  };
  return icons[method] || 'pi pi-dollar';
};

// Sort payments by date (newest first)
const sortedPayments = computed(() => {
  if (!props.paymentDue?.payments) return [];
  return [...props.paymentDue.payments].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );
});

// Calculate total paid
const totalPaid = computed(() => {
  if (!props.paymentDue?.payments) return 0;
  return props.paymentDue.payments.reduce((sum, p) => sum + p.amount, 0);
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Storico Pagamenti"
    :modal="true"
    :closable="true"
    :style="{ width: '550px', maxWidth: '95vw' }"
    class="payment-history-dialog"
  >
    <!-- Payment Due Summary -->
    <div class="payment-due-summary" v-if="paymentDue">
      <div class="summary-row">
        <span class="label">Rata</span>
        <span class="value">{{ paymentDue.installmentNumber }}/{{ paymentDue.totalInstallments }}</span>
      </div>
      <div class="summary-row">
        <span class="label">Scadenza</span>
        <span class="value">{{ formatDate(paymentDue.dueDate) }}</span>
      </div>
      <div class="summary-row">
        <span class="label">Importo Totale</span>
        <span class="value bold">{{ formatCurrency(paymentDue.amount) }}</span>
      </div>
      <div class="summary-row">
        <span class="label">Totale Pagato</span>
        <span class="value success">{{ formatCurrency(totalPaid) }}</span>
      </div>
      <div class="summary-row" v-if="paymentDue.amount - totalPaid > 0">
        <span class="label">Rimanente</span>
        <span class="value danger">{{ formatCurrency(paymentDue.amount - totalPaid) }}</span>
      </div>
    </div>

    <Divider />

    <!-- Payment History Timeline -->
    <div class="payment-history" v-if="sortedPayments.length > 0">
      <h4>Pagamenti Effettuati</h4>
      <Timeline :value="sortedPayments" class="payment-timeline">
        <template #content="{ item }">
          <div class="payment-event">
            <div class="payment-header">
              <span class="payment-amount">{{ formatCurrency(item.amount) }}</span>
              <Tag :value="getMethodLabel(item.method)" severity="info" />
            </div>
            <div class="payment-date">
              <i class="pi pi-calendar"></i>
              {{ formatDateTime(item.paymentDate) }}
            </div>
            <div v-if="item.reference" class="payment-reference">
              <i class="pi pi-file"></i>
              Rif: {{ item.reference }}
            </div>
            <div v-if="item.notes" class="payment-notes">
              <i class="pi pi-comment"></i>
              {{ item.notes }}
            </div>
          </div>
        </template>
        <template #marker="{ item }">
          <div class="payment-marker">
            <i :class="getMethodIcon(item.method)"></i>
          </div>
        </template>
      </Timeline>
    </div>

    <!-- No payments -->
    <div v-else class="no-payments">
      <i class="pi pi-info-circle"></i>
      <p>Nessun pagamento registrato per questa rata.</p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Chiudi"
          severity="secondary"
          @click="visible = false"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.payment-due-summary {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--surface-200);
}

.summary-row .label {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.summary-row .value {
  font-weight: 600;
  color: var(--text-color);
}

.summary-row .value.bold {
  font-weight: 700;
  font-size: 1.1rem;
}

.summary-row .value.success {
  color: var(--green-600);
}

.summary-row .value.danger {
  color: var(--red-600);
}

.payment-history h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-color);
}

.payment-timeline {
  margin: 0;
}

.payment-event {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-left: 0.5rem;
}

.payment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.payment-amount {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--green-600);
}

.payment-date,
.payment-reference,
.payment-notes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

.payment-date i,
.payment-reference i,
.payment-notes i {
  font-size: 0.75rem;
}

.payment-notes {
  font-style: italic;
}

.payment-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
}

.payment-marker i {
  color: var(--primary-600);
  font-size: 0.875rem;
}

.no-payments {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  text-align: center;
}

.no-payments i {
  font-size: 2rem;
  color: var(--surface-400);
  margin-bottom: 0.75rem;
}

.no-payments p {
  margin: 0;
  color: var(--text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.p-timeline-event-opposite) {
  display: none;
}

:deep(.p-timeline-event-connector) {
  background: var(--primary-200);
}
</style>
