<template>
  <div class="create-warehouse-step">
    <h1 class="step-title">Crea il tuo primo magazzino</h1>
    <p class="step-description">
      Configura il magazzino principale per iniziare a gestire il tuo inventario.
    </p>

    <form @submit.prevent="saveWarehouse" class="warehouse-form">
      <div class="form-grid">
        <div class="form-field">
          <label for="name">Nome Magazzino *</label>
          <InputText
            id="name"
            v-model="form.name"
            class="w-full"
            placeholder="es. Magazzino Principale"
            :class="{ 'p-invalid': errors.name }"
          />
          <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
        </div>

        <div class="form-field">
          <label for="code">Codice *</label>
          <InputText
            id="code"
            v-model="form.code"
            class="w-full"
            placeholder="es. MAIN"
            maxlength="10"
            :class="{ 'p-invalid': errors.code }"
          />
          <small v-if="errors.code" class="p-error">{{ errors.code }}</small>
          <small v-else class="field-hint">Codice breve per identificare il magazzino</small>
        </div>

        <div class="form-field form-field--full">
          <label for="type">Tipo Magazzino</label>
          <div class="type-cards">
            <div
              v-for="option in typeOptions"
              :key="option.value"
              :class="['type-card', { selected: form.type === option.value }]"
              @click="form.type = option.value"
            >
              <i :class="option.icon"></i>
              <span class="type-name">{{ option.label }}</span>
              <span class="type-desc">{{ option.description }}</span>
            </div>
          </div>
        </div>

        <!-- Optional Address -->
        <div class="form-field form-field--full">
          <div class="address-toggle">
            <Checkbox
              id="hasAddress"
              v-model="hasAddress"
              :binary="true"
            />
            <label for="hasAddress">Aggiungi indirizzo magazzino</label>
          </div>
        </div>

        <template v-if="hasAddress">
          <div class="form-field form-field--full">
            <label for="street">Indirizzo</label>
            <InputText
              id="street"
              v-model="form.street"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label for="city">Città</label>
            <InputText
              id="city"
              v-model="form.city"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label for="province">Provincia</label>
            <InputText
              id="province"
              v-model="form.province"
              class="w-full"
              maxlength="2"
            />
          </div>

          <div class="form-field">
            <label for="postalCode">CAP</label>
            <InputText
              id="postalCode"
              v-model="form.postalCode"
              class="w-full"
              maxlength="5"
            />
          </div>

          <div class="form-field">
            <label for="country">Paese</label>
            <Dropdown
              id="country"
              v-model="form.country"
              :options="countries"
              optionLabel="name"
              optionValue="code"
              class="w-full"
            />
          </div>
        </template>
      </div>

      <div class="form-actions">
        <Button
          type="button"
          label="Salta per ora"
          severity="secondary"
          @click="skipWarehouse"
          :loading="skipping"
        />
        <Button
          type="submit"
          label="Crea Magazzino"
          icon="pi pi-check"
          :loading="saving"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';
import type { CreateWarehouseForm } from '../../types';

const router = useRouter();
const toast = useToast();
const {
  createWarehouse,
  skipWarehouse: skipWarehouseApi,
  goToNextStep,
} = useOnboarding();

// State
const saving = ref(false);
const skipping = ref(false);
const hasAddress = ref(false);

const form = reactive<CreateWarehouseForm>({
  name: '',
  code: '',
  type: 'MAIN',
  street: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'IT',
});

const errors = reactive({
  name: '',
  code: '',
});

const typeOptions = [
  {
    value: 'MAIN',
    label: 'Principale',
    description: 'Magazzino principale dell\'azienda',
    icon: 'pi pi-home',
  },
  {
    value: 'SECONDARY',
    label: 'Secondario',
    description: 'Magazzino aggiuntivo o deposito',
    icon: 'pi pi-box',
  },
  {
    value: 'TRANSIT',
    label: 'Transito',
    description: 'Merce in transito o spedizione',
    icon: 'pi pi-truck',
  },
];

const countries = [
  { name: 'Italia', code: 'IT' },
  { name: 'Germania', code: 'DE' },
  { name: 'Francia', code: 'FR' },
  { name: 'Spagna', code: 'ES' },
];

// Auto-generate code from name
watch(
  () => form.name,
  (name) => {
    if (!form.code || form.code === form.name.slice(0, 4).toUpperCase()) {
      form.code = name.slice(0, 4).toUpperCase().replace(/\s/g, '');
    }
  }
);

// Validation
function validate(): boolean {
  let isValid = true;
  errors.name = '';
  errors.code = '';

  if (!form.name.trim()) {
    errors.name = 'Nome magazzino obbligatorio';
    isValid = false;
  }

  if (!form.code.trim()) {
    errors.code = 'Codice obbligatorio';
    isValid = false;
  } else if (form.code.length < 2) {
    errors.code = 'Il codice deve avere almeno 2 caratteri';
    isValid = false;
  }

  return isValid;
}

async function saveWarehouse() {
  if (!validate()) return;

  saving.value = true;
  try {
    // Clean up form - remove empty address fields if no address
    const payload = { ...form };
    if (!hasAddress.value) {
      delete payload.street;
      delete payload.city;
      delete payload.province;
      delete payload.postalCode;
      delete payload.country;
    }

    const success = await createWarehouse(payload);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Magazzino Creato',
        detail: 'Il magazzino è stato creato con successo',
        life: 3000,
      });
      goToNextStep();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Impossibile creare il magazzino',
        life: 5000,
      });
    }
  } finally {
    saving.value = false;
  }
}

async function skipWarehouse() {
  skipping.value = true;
  try {
    const success = await skipWarehouseApi();
    if (success) {
      // create-warehouse è l'ultimo step prima del complete: goToNextStep
      // calcola la transizione e navigherà a '/' (mappato a 'complete').
      // Manteniamo la single source of truth nel composable invece che fare
      // router.push('/') hardcoded qua.
      goToNextStep('create-warehouse');
    }
  } finally {
    skipping.value = false;
  }
}
</script>

<style scoped>
.create-warehouse-step {
  max-width: 100%;
}

.step-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
  text-align: center;
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--color-gray-600);
  margin: 0 0 var(--space-6) 0;
  text-align: center;
}

.warehouse-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

/* Type Cards */
.type-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4);
  background: var(--color-gray-50);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.type-card:hover {
  border-color: var(--color-primary-300);
}

.type-card.selected {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.type-card i {
  font-size: 1.5rem;
  color: var(--color-primary-600);
  margin-bottom: var(--space-2);
}

.type-name {
  font-weight: 600;
  color: var(--color-gray-900);
}

.type-desc {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

/* Address Toggle */
.address-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.address-toggle label {
  cursor: pointer;
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  padding-top: var(--space-4);
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .type-cards {
    grid-template-columns: 1fr;
  }
}
</style>
