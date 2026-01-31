<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface PaymentDue {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

interface Props {
  modelValue: boolean;
  paymentDue: PaymentDue | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'recorded'): void;
}>();

const toast = useToast();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);

// Form data
const form = ref({
  amount: 0,
  paymentDate: new Date(),
  method: '',
  reference: '',
  notes: '',
});

// Payment methods
const paymentMethods = [
  { label: 'Bonifico Bancario', value: 'BONIFICO' },
  { label: 'RiBa', value: 'RIBA' },
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Assegno', value: 'ASSEGNO' },
  { label: 'Carta di Credito', value: 'CARTA' },
  { label: 'PayPal', value: 'PAYPAL' },
  { label: 'Altro', value: 'ALTRO' },
];

// Computed remaining amount
const remainingAmount = computed(() => {
  if (!props.paymentDue) return 0;
  return props.paymentDue.amount - props.paymentDue.paidAmount;
});

// Reset form when dialog opens
watch(() => props.modelValue, (val) => {
  if (val && props.paymentDue) {
    form.value = {
      amount: remainingAmount.value,
      paymentDate: new Date(),
      method: '',
      reference: '',
      notes: '',
    };
  }
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

// Record payment
const recordPayment = async () => {
  if (!props.paymentDue) return;

  if (!form.value.amount || form.value.amount <= 0) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci un importo valido',
      life: 3000,
    });
    return;
  }

  if (form.value.amount > remainingAmount.value) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: `L'importo non può superare ${formatCurrency(remainingAmount.value)}`,
      life: 3000,
    });
    return;
  }

  if (!form.value.method) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona un metodo di pagamento',
      life: 3000,
    });
    return;
  }

  loading.value = true;
  try {
    await api.post(`/accounting/payment-dues/${props.paymentDue.id}/payments`, {
      amount: form.value.amount,
      paymentDate: form.value.paymentDate.toISOString(),
      method: form.value.method,
      reference: form.value.reference || null,
      notes: form.value.notes || null,
    });

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Pagamento registrato con successo',
      life: 3000,
    });

    emit('recorded');
    visible.value = false;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella registrazione del pagamento',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

// Pay full remaining amount
const payFullAmount = () => {
  form.value.amount = remainingAmount.value;
};
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Registra Pagamento"
    :modal="true"
    :closable="true"
    :style="{ width: '500px', maxWidth: '95vw' }"
    class="record-payment-dialog"
  >
    <div class="payment-info" v-if="paymentDue">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Rata</span>
          <span class="info-value">{{ paymentDue.installmentNumber }}/{{ paymentDue.totalInstallments }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Scadenza</span>
          <span class="info-value">{{ formatDate(paymentDue.dueDate) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Importo Dovuto</span>
          <span class="info-value bold">{{ formatCurrency(paymentDue.amount) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Già Pagato</span>
          <span class="info-value" :class="{ 'text-green': paymentDue.paidAmount > 0 }">
            {{ formatCurrency(paymentDue.paidAmount) }}
          </span>
        </div>
      </div>
      <div class="remaining-highlight">
        <span class="label">Da Pagare</span>
        <span class="value">{{ formatCurrency(remainingAmount) }}</span>
      </div>
    </div>

    <Divider />

    <div class="payment-form">
      <div class="form-grid">
        <div class="field">
          <label for="amount">Importo Pagamento *</label>
          <div class="amount-input-group">
            <InputNumber
              id="amount"
              v-model="form.amount"
              mode="currency"
              currency="EUR"
              locale="it-IT"
              :min="0.01"
              :max="remainingAmount"
              class="w-full"
            />
            <Button
              label="Tutto"
              size="small"
              severity="secondary"
              @click="payFullAmount"
              v-tooltip.top="'Paga tutto l\'importo rimanente'"
            />
          </div>
          <small class="hint">Max: {{ formatCurrency(remainingAmount) }}</small>
        </div>

        <div class="field">
          <label for="paymentDate">Data Pagamento *</label>
          <Calendar
            id="paymentDate"
            v-model="form.paymentDate"
            dateFormat="dd/mm/yy"
            :showIcon="true"
            :maxDate="new Date()"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="method">Metodo di Pagamento *</label>
          <Dropdown
            id="method"
            v-model="form.method"
            :options="paymentMethods"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona metodo"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="reference">Riferimento (CRO, N. Assegno...)</label>
          <InputText
            id="reference"
            v-model="form.reference"
            placeholder="es. CRO123456"
            class="w-full"
          />
        </div>

        <div class="field full-width">
          <label for="notes">Note</label>
          <Textarea
            id="notes"
            v-model="form.notes"
            rows="2"
            placeholder="Note opzionali..."
            class="w-full"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Annulla"
          severity="secondary"
          @click="visible = false"
        />
        <Button
          label="Registra Pagamento"
          icon="pi pi-check"
          @click="recordPayment"
          :loading="loading"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.payment-info {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
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
  font-weight: 500;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
}

.info-value.bold {
  font-weight: 700;
}

.info-value.text-green {
  color: var(--green-600);
}

.remaining-highlight {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--primary-50);
  border: 2px solid var(--primary-200);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.remaining-highlight .label {
  font-weight: 600;
  color: var(--primary-700);
}

.remaining-highlight .value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-600);
}

.payment-form {
  padding: 0.5rem 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field.full-width {
  grid-column: 1 / -1;
}

.field label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-color);
}

.amount-input-group {
  display: flex;
  gap: 0.5rem;
}

.amount-input-group .w-full {
  flex: 1;
}

.hint {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

.w-full {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
