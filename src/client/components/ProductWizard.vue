<template>
  <Dialog
    v-model:visible="visible"
    header="Nuovo Prodotto"
    :modal="true"
    :style="{ width: '1100px', maxWidth: '95vw', maxHeight: '95vh' }"
    :closable="!saving"
    @hide="onHide"
    class="product-wizard-dialog"
  >
    <!-- Stepper Header -->
    <div class="wizard-header">
      <Steps :model="steps" :activeIndex="activeStep" :readonly="!productId" />
    </div>

    <!-- Step Content -->
    <div class="wizard-content">
      <!-- Step 1: Info Base -->
      <div v-show="activeStep === 0" class="step-panel">
        <ProductBasicInfo v-model="form" :disabled="saving" />
      </div>

      <!-- Step 2: Web/SEO -->
      <div v-show="activeStep === 1" class="step-panel">
        <template v-if="productId">
          <ProductWebFields
            v-model="webFields"
            :product-type="form.type"
            :product-price="form.price"
          />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>

      <!-- Step 3: Immagini -->
      <div v-show="activeStep === 2" class="step-panel">
        <template v-if="productId">
          <ProductImagesManager :product-id="productId" />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>

      <!-- Step 4: Giacenze -->
      <div v-show="activeStep === 3" class="step-panel">
        <template v-if="productId">
          <ProductInventoryManager :product-id="productId" />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>

      <!-- Step 5: Composizione (Materiali) -->
      <div v-show="activeStep === 4" class="step-panel">
        <template v-if="productId">
          <ProductMaterials :product-id="productId" />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>

      <!-- Step 6: BOM (Componenti) -->
      <div v-show="activeStep === 5" class="step-panel">
        <template v-if="productId">
          <ProductBom :product-id="productId" />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>

      <!-- Step 7: Lavorazione (Fasi) -->
      <div v-show="activeStep === 6" class="step-panel">
        <template v-if="productId">
          <ProductPhases :product-id="productId" />
        </template>
        <StepPlaceholder v-else message="Completa prima le informazioni base" @go-to-first="activeStep = 0" />
      </div>
    </div>

    <!-- Footer Navigation -->
    <template #footer>
      <div class="wizard-footer">
        <div class="footer-left">
          <Button
            v-if="activeStep > 0"
            label="Indietro"
            icon="pi pi-arrow-left"
            class="p-button-text"
            :disabled="saving"
            @click="prevStep"
          />
        </div>
        <div class="footer-center">
          <span class="step-indicator">{{ activeStep + 1 }} / {{ steps.length }}</span>
        </div>
        <div class="footer-right">
          <!-- Skip button per step opzionali (2-6) -->
          <Button
            v-if="activeStep > 0 && activeStep < steps.length - 1 && productId"
            label="Salta"
            class="p-button-text p-button-secondary"
            :disabled="saving"
            @click="nextStep"
          />

          <!-- Step 1: Crea/Salva -->
          <Button
            v-if="activeStep === 0"
            :label="productId ? 'Salva e Continua' : 'Crea Prodotto'"
            icon="pi pi-arrow-right"
            iconPos="right"
            :loading="saving"
            @click="saveBasicInfo"
          />

          <!-- Step 2-6: Continua -->
          <Button
            v-else-if="activeStep < steps.length - 1"
            label="Continua"
            icon="pi pi-arrow-right"
            iconPos="right"
            :disabled="!productId"
            @click="nextStep"
          />

          <!-- Ultimo Step: Completa -->
          <Button
            v-else
            label="Completa"
            icon="pi pi-check"
            :disabled="!productId"
            @click="complete"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Steps from 'primevue/steps';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import ProductBasicInfo from './ProductBasicInfo.vue';
import ProductWebFields from './ProductWebFields.vue';
import ProductMaterials from './ProductMaterials.vue';
import ProductBom from './ProductBom.vue';
import ProductPhases from './ProductPhases.vue';
import ProductImagesManager from './ProductImagesManager.vue';
import ProductInventoryManager from './ProductInventoryManager.vue';
import StepPlaceholder from './StepPlaceholder.vue';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', product: any): void;
  (e: 'completed'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const toast = useToast();
const visible = ref(props.modelValue);
const saving = ref(false);
const activeStep = ref(0);
const productId = ref<string | null>(null);

// Steps definition
const steps = ref([
  { label: 'Info Base' },
  { label: 'Web/SEO' },
  { label: 'Immagini' },
  { label: 'Giacenze' },
  { label: 'Composizione' },
  { label: 'BOM' },
  { label: 'Lavorazione' },
]);

// Form data
const getDefaultForm = () => ({
  id: undefined as string | undefined,
  sku: '',
  name: '',
  description: '',
  category: '',
  categoryIds: [] as string[],
  type: 'SIMPLE' as 'SIMPLE' | 'WITH_VARIANTS' | 'DIGITAL' | 'RAW_MATERIAL',
  unit: 'PZ',
  barcode: '',
  weight: null as number | null,
  price: 0,
  cost: 0,
  minStockLevel: 10,
  reorderQuantity: 20,
  isActive: true,
  isSellable: true,
});

const getDefaultWebFields = () => ({
  webActive: false,
  webPrice: null as number | null,
  webDescription: null as string | null,
  webShortDescription: null as string | null,
  webSlug: null as string | null,
  webMetaTitle: null as string | null,
  webMetaDescription: null as string | null,
  webAttributes: null,
  downloadFiles: null,
});

const form = ref(getDefaultForm());
const webFields = ref(getDefaultWebFields());

// Sync visibility
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    resetWizard();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// Navigation
const nextStep = () => {
  if (activeStep.value < steps.value.length - 1) {
    activeStep.value++;
  }
};

const prevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value--;
  }
};

// Save basic info and create product
const saveBasicInfo = async () => {
  // Validation
  if (!form.value.sku?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci un codice SKU',
      life: 3000,
    });
    return;
  }

  if (!form.value.name?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci il nome del prodotto',
      life: 3000,
    });
    return;
  }

  if (!form.value.price || form.value.price <= 0) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci un prezzo valido',
      life: 3000,
    });
    return;
  }

  saving.value = true;

  try {
    if (productId.value) {
      // Update existing product
      const response = await api.patch(`/products/${productId.value}`, {
        ...form.value,
        ...webFields.value,
      });

      if (response.success) {
        toast.add({
          severity: 'success',
          summary: 'Salvato',
          detail: 'Prodotto aggiornato',
          life: 2000,
        });
        nextStep();
      } else {
        throw new Error(response.error || 'Errore durante l\'aggiornamento');
      }
    } else {
      // Create new product
      const response = await api.post('/products', {
        ...form.value,
        ...webFields.value,
      });

      if (response.success && response.data) {
        productId.value = response.data.id;
        form.value.id = response.data.id;

        toast.add({
          severity: 'success',
          summary: 'Prodotto creato',
          detail: 'Ora puoi configurare tutti i dettagli',
          life: 4000,
        });

        emit('created', response.data);
        nextStep();
      } else {
        throw new Error(response.error || 'Errore durante la creazione');
      }
    }
  } catch (error: any) {
    console.error('Errore salvataggio:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Complete wizard
const complete = () => {
  toast.add({
    severity: 'success',
    summary: 'Completato',
    detail: 'Configurazione prodotto completata',
    life: 3000,
  });
  emit('completed');
  visible.value = false;
};

// Reset wizard
const resetWizard = () => {
  activeStep.value = 0;
  productId.value = null;
  form.value = getDefaultForm();
  webFields.value = getDefaultWebFields();
};

const onHide = () => {
  resetWizard();
};
</script>

<style scoped>
.wizard-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color-light, #e2e8f0);
}

.wizard-content {
  min-height: 400px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 0 0.5rem;
}

.step-panel {
  padding: 0.5rem 0;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color-light, #e2e8f0);
  width: 100%;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 0.5rem;
}

.footer-center {
  color: var(--color-gray-500, #6b7280);
  font-size: 0.9rem;
}

.step-indicator {
  font-weight: 500;
}

/* Steps styling */
:deep(.p-steps) {
  padding: 0;
}

:deep(.p-steps .p-steps-item) {
  flex: 1;
}

:deep(.p-steps .p-steps-item .p-menuitem-link) {
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
}

:deep(.p-steps .p-steps-item .p-steps-title) {
  font-size: 0.75rem;
  white-space: nowrap;
}

:deep(.p-steps .p-steps-item.p-highlight .p-steps-number) {
  background: var(--color-primary, #3b82f6);
  color: white;
  border-color: var(--color-primary, #3b82f6);
}

:deep(.p-steps .p-steps-item:not(.p-highlight):not(.p-disabled) .p-steps-number) {
  background: var(--color-success, #22c55e);
  color: white;
  border-color: var(--color-success, #22c55e);
}

:deep(.p-steps .p-steps-item.p-disabled .p-steps-number) {
  background: var(--color-gray-200, #e5e7eb);
  color: var(--color-gray-500, #6b7280);
  border-color: var(--color-gray-200, #e5e7eb);
}

/* Dialog styling */
:deep(.p-dialog-header) {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color-light, #e2e8f0);
}

:deep(.p-dialog-content) {
  padding: 1.5rem;
}

:deep(.p-dialog-footer) {
  padding: 1rem 1.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  :deep(.p-steps .p-steps-item .p-steps-title) {
    display: none;
  }

  :deep(.p-steps .p-steps-item .p-menuitem-link) {
    padding: 0.5rem 0.25rem;
  }
}
</style>
