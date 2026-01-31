<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
  orderId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'shipped'): void;
}>();

const toast = useToast();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);

// Form data
const form = ref({
  carrier: '',
  trackingNumber: '',
  trackingUrl: '',
  shippedDate: new Date(),
  estimatedDelivery: null as Date | null,
  notes: '',
});

// Carrier options
const carriers = [
  { label: 'DHL', value: 'DHL' },
  { label: 'GLS', value: 'GLS' },
  { label: 'BRT (Bartolini)', value: 'BRT' },
  { label: 'SDA', value: 'SDA' },
  { label: 'Poste Italiane', value: 'POSTE' },
  { label: 'UPS', value: 'UPS' },
  { label: 'FedEx', value: 'FEDEX' },
  { label: 'TNT', value: 'TNT' },
  { label: 'Altro', value: 'OTHER' },
];

// Auto-generate tracking URL based on carrier
const suggestedTrackingUrl = computed(() => {
  const trackingNumber = form.value.trackingNumber;
  if (!trackingNumber) return '';

  const urls: Record<string, string> = {
    DHL: `https://www.dhl.com/it-it/home/tracciamento.html?tracking-id=${trackingNumber}`,
    GLS: `https://www.gls-italy.com/it/ricerca-spedizione?match=${trackingNumber}`,
    BRT: `https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Ession_Tracing=${trackingNumber}`,
    SDA: `https://www.sda.it/wps/portal/Servizi/SDA/traccia-spedizione?numero_spedizione=${trackingNumber}`,
    POSTE: `https://www.poste.it/cerca/index.html#/risultati-spedizioni/${trackingNumber}`,
    UPS: `https://www.ups.com/track?tracknum=${trackingNumber}&loc=it_IT`,
    FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    TNT: `https://www.tnt.it/tracking/Tracking.do?type=SHIPMENT&trackNumber=${trackingNumber}`,
  };

  return urls[form.value.carrier] || '';
});

// Watch for carrier/tracking changes to update URL
watch(() => [form.value.carrier, form.value.trackingNumber], () => {
  if (!form.value.trackingUrl && suggestedTrackingUrl.value) {
    form.value.trackingUrl = suggestedTrackingUrl.value;
  }
});

// Reset form when dialog opens
watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      carrier: '',
      trackingNumber: '',
      trackingUrl: '',
      shippedDate: new Date(),
      estimatedDelivery: null,
      notes: '',
    };
  }
});

// Create shipment
const createShipment = async () => {
  if (!props.orderId) return;

  if (!form.value.carrier) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona un corriere',
      life: 3000,
    });
    return;
  }

  loading.value = true;
  try {
    await api.post(`/orders/${props.orderId}/ship`, {
      carrier: form.value.carrier,
      trackingNumber: form.value.trackingNumber || null,
      trackingUrl: form.value.trackingUrl || null,
      shippedDate: form.value.shippedDate?.toISOString() || new Date().toISOString(),
      estimatedDelivery: form.value.estimatedDelivery?.toISOString() || null,
      shippingNotes: form.value.notes || null,
    });

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Spedizione creata con successo',
      life: 3000,
    });

    emit('shipped');
    visible.value = false;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella creazione della spedizione',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Crea Spedizione"
    :modal="true"
    :closable="true"
    :style="{ width: '550px', maxWidth: '95vw' }"
    class="shipment-dialog"
  >
    <div class="shipment-form">
      <div class="form-grid">
        <div class="field">
          <label for="carrier">Corriere *</label>
          <Dropdown
            id="carrier"
            v-model="form.carrier"
            :options="carriers"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona corriere"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="trackingNumber">Numero Tracking</label>
          <InputText
            id="trackingNumber"
            v-model="form.trackingNumber"
            placeholder="es. 1234567890"
            class="w-full"
          />
        </div>

        <div class="field full-width">
          <label for="trackingUrl">URL Tracking</label>
          <InputText
            id="trackingUrl"
            v-model="form.trackingUrl"
            :placeholder="suggestedTrackingUrl || 'URL per tracciare la spedizione'"
            class="w-full"
          />
          <small v-if="suggestedTrackingUrl && !form.trackingUrl" class="hint">
            <i class="pi pi-info-circle"></i>
            URL auto-generato in base al corriere
          </small>
        </div>

        <div class="field">
          <label for="shippedDate">Data Spedizione</label>
          <Calendar
            id="shippedDate"
            v-model="form.shippedDate"
            dateFormat="dd/mm/yy"
            :showIcon="true"
            :maxDate="new Date()"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="estimatedDelivery">Consegna Stimata</label>
          <Calendar
            id="estimatedDelivery"
            v-model="form.estimatedDelivery"
            dateFormat="dd/mm/yy"
            :showIcon="true"
            :minDate="new Date()"
            class="w-full"
          />
        </div>

        <div class="field full-width">
          <label for="notes">Note Spedizione</label>
          <Textarea
            id="notes"
            v-model="form.notes"
            rows="3"
            placeholder="Note opzionali sulla spedizione..."
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
          label="Crea Spedizione"
          icon="pi pi-truck"
          @click="createShipment"
          :loading="loading"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.shipment-form {
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

.field .hint {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
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
}
</style>
