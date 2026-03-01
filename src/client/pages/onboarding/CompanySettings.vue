<template>
  <div class="company-settings-step">
    <h1 class="step-title">Configura la tua azienda</h1>
    <p class="step-description">
      Inserisci i dati della tua azienda. Potrai modificarli in seguito dalle impostazioni.
    </p>

    <form @submit.prevent="saveSettings" class="settings-form">
      <!-- Company Info -->
      <div class="form-section">
        <h3 class="section-title">Informazioni Azienda</h3>
        <div class="form-grid">
          <div class="form-field">
            <label for="companyName">Ragione Sociale *</label>
            <InputText
              id="companyName"
              v-model="form.companyName"
              class="w-full"
              :class="{ 'p-invalid': errors.companyName }"
            />
            <small v-if="errors.companyName" class="p-error">{{ errors.companyName }}</small>
          </div>

          <div class="form-field">
            <label for="legalName">Denominazione Legale</label>
            <InputText
              id="legalName"
              v-model="form.legalName"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label for="vatNumber">Partita IVA *</label>
            <InputText
              id="vatNumber"
              v-model="form.vatNumber"
              class="w-full"
              placeholder="IT12345678901"
              :class="{ 'p-invalid': errors.vatNumber }"
            />
            <small v-if="errors.vatNumber" class="p-error">{{ errors.vatNumber }}</small>
          </div>

          <div class="form-field">
            <label for="fiscalCode">Codice Fiscale</label>
            <InputText
              id="fiscalCode"
              v-model="form.fiscalCode"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Address -->
      <div class="form-section">
        <h3 class="section-title">Sede Legale</h3>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label for="street">Indirizzo *</label>
            <InputText
              id="street"
              v-model="form.street"
              class="w-full"
              :class="{ 'p-invalid': errors.street }"
            />
            <small v-if="errors.street" class="p-error">{{ errors.street }}</small>
          </div>

          <div class="form-field">
            <label for="city">Comune *</label>
            <InputText
              id="city"
              v-model="form.city"
              class="w-full"
              :class="{ 'p-invalid': errors.city }"
            />
            <small v-if="errors.city" class="p-error">{{ errors.city }}</small>
          </div>

          <div class="form-field">
            <label for="province">Provincia *</label>
            <InputText
              id="province"
              v-model="form.province"
              class="w-full"
              maxlength="2"
              placeholder="MI"
              :class="{ 'p-invalid': errors.province }"
            />
            <small v-if="errors.province" class="p-error">{{ errors.province }}</small>
          </div>

          <div class="form-field">
            <label for="postalCode">CAP *</label>
            <InputText
              id="postalCode"
              v-model="form.postalCode"
              class="w-full"
              maxlength="5"
              :class="{ 'p-invalid': errors.postalCode }"
            />
            <small v-if="errors.postalCode" class="p-error">{{ errors.postalCode }}</small>
          </div>

          <div class="form-field">
            <label for="country">Paese *</label>
            <Dropdown
              id="country"
              v-model="form.country"
              :options="countries"
              optionLabel="name"
              optionValue="code"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Contact & SDI -->
      <div class="form-section">
        <h3 class="section-title">Contatti e Fatturazione Elettronica</h3>
        <div class="form-grid">
          <div class="form-field">
            <label for="phone">Telefono</label>
            <InputText
              id="phone"
              v-model="form.phone"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="form.email"
              type="email"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label for="pec">PEC</label>
            <InputText
              id="pec"
              v-model="form.pec"
              type="email"
              class="w-full"
              placeholder="azienda@pec.it"
            />
          </div>

          <div class="form-field">
            <label for="sdiCode">Codice SDI</label>
            <InputText
              id="sdiCode"
              v-model="form.sdiCode"
              class="w-full"
              maxlength="7"
              placeholder="0000000"
            />
            <small class="field-hint">Codice destinatario per fatturazione elettronica</small>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <Button
          type="submit"
          label="Salva e Continua"
          icon="pi pi-arrow-right"
          iconPos="right"
          :loading="saving"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';
import type { CompanySettingsForm } from '../../types';

const _router = useRouter();
const toast = useToast();
const { fetchCompanySettings, saveCompanySettings, goToNextStep } = useOnboarding();

// State
const saving = ref(false);
const form = reactive<CompanySettingsForm>({
  companyName: '',
  legalName: '',
  vatNumber: '',
  fiscalCode: '',
  street: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'IT',
  phone: '',
  email: '',
  pec: '',
  sdiCode: '',
});

const errors = reactive({
  companyName: '',
  vatNumber: '',
  street: '',
  city: '',
  province: '',
  postalCode: '',
});

const countries = [
  { name: 'Italia', code: 'IT' },
  { name: 'Germania', code: 'DE' },
  { name: 'Francia', code: 'FR' },
  { name: 'Spagna', code: 'ES' },
  { name: 'Regno Unito', code: 'GB' },
  { name: 'Svizzera', code: 'CH' },
  { name: 'Austria', code: 'AT' },
];

// Validation
function validate(): boolean {
  let isValid = true;

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });

  if (!form.companyName.trim()) {
    errors.companyName = 'Ragione sociale obbligatoria';
    isValid = false;
  }

  if (!form.vatNumber.trim()) {
    errors.vatNumber = 'Partita IVA obbligatoria';
    isValid = false;
  } else if (form.country === 'IT' && !/^IT\d{11}$/.test(form.vatNumber.replace(/\s/g, ''))) {
    errors.vatNumber = 'Formato Partita IVA non valido (es. IT12345678901)';
    isValid = false;
  }

  if (!form.street.trim()) {
    errors.street = 'Indirizzo obbligatorio';
    isValid = false;
  }

  if (!form.city.trim()) {
    errors.city = 'Comune obbligatorio';
    isValid = false;
  }

  if (!form.province.trim()) {
    errors.province = 'Provincia obbligatoria';
    isValid = false;
  }

  if (!form.postalCode.trim()) {
    errors.postalCode = 'CAP obbligatorio';
    isValid = false;
  }

  return isValid;
}

async function saveSettings() {
  if (!validate()) return;

  saving.value = true;
  try {
    const success = await saveCompanySettings(form);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Dati Salvati',
        detail: 'I dati aziendali sono stati salvati',
        life: 3000,
      });
      goToNextStep();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Impossibile salvare i dati',
        life: 5000,
      });
    }
  } finally {
    saving.value = false;
  }
}

// Load existing settings
onMounted(async () => {
  const existing = await fetchCompanySettings();
  if (existing) {
    Object.assign(form, existing);
  }
});
</script>

<style scoped>
.company-settings-step {
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

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-section {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-4) 0;
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

.form-actions {
  display: flex;
  justify-content: center;
  padding-top: var(--space-4);
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
