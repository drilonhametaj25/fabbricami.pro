<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <div class="auth-logo">
          <span>E</span>
        </div>
        <h1 class="auth-title">Crea il tuo account</h1>
        <p class="auth-subtitle">Inizia la tua prova gratuita di 14 giorni</p>
      </div>

      <form @submit.prevent="register" class="auth-form">
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">Nome *</label>
            <InputText
              id="firstName"
              v-model="form.firstName"
              class="w-full"
              :class="{ 'p-invalid': errors.firstName }"
            />
            <small v-if="errors.firstName" class="p-error">{{ errors.firstName }}</small>
          </div>

          <div class="form-field">
            <label for="lastName">Cognome *</label>
            <InputText
              id="lastName"
              v-model="form.lastName"
              class="w-full"
              :class="{ 'p-invalid': errors.lastName }"
            />
            <small v-if="errors.lastName" class="p-error">{{ errors.lastName }}</small>
          </div>
        </div>

        <div class="form-field">
          <label for="email">Email *</label>
          <InputText
            id="email"
            v-model="form.email"
            type="email"
            class="w-full"
            :class="{ 'p-invalid': errors.email }"
          />
          <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
        </div>

        <div class="form-field">
          <label for="companyName">Nome Azienda *</label>
          <InputText
            id="companyName"
            v-model="form.companyName"
            class="w-full"
            :class="{ 'p-invalid': errors.companyName }"
          />
          <small v-if="errors.companyName" class="p-error">{{ errors.companyName }}</small>
        </div>

        <div class="form-field">
          <label for="password">Password *</label>
          <Password
            id="password"
            v-model="form.password"
            class="w-full"
            toggleMask
            :feedback="true"
            :class="{ 'p-invalid': errors.password }"
          />
          <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
        </div>

        <div class="form-field">
          <label for="confirmPassword">Conferma Password *</label>
          <Password
            id="confirmPassword"
            v-model="form.confirmPassword"
            class="w-full"
            toggleMask
            :feedback="false"
            :class="{ 'p-invalid': errors.confirmPassword }"
          />
          <small v-if="errors.confirmPassword" class="p-error">{{ errors.confirmPassword }}</small>
        </div>

        <!-- Plan Selection -->
        <div class="form-field">
          <label>Scegli il tuo piano *</label>
          <div class="plan-selector">
            <div
              v-for="planOption in planOptions"
              :key="planOption.code"
              class="plan-option"
              :class="{ 'plan-option-selected': form.plan === planOption.code }"
              @click="form.plan = planOption.code"
            >
              <div class="plan-header">
                <RadioButton
                  :inputId="`plan-${planOption.code}`"
                  v-model="form.plan"
                  :value="planOption.code"
                />
                <div class="plan-info">
                  <span class="plan-name">{{ planOption.name }}</span>
                  <span v-if="planOption.popular" class="plan-badge">Consigliato</span>
                </div>
              </div>
              <div class="plan-price">
                <span class="price-amount">€{{ planOption.price }}</span>
                <span class="price-period">/mese</span>
              </div>
              <ul class="plan-features">
                <li v-for="feature in planOption.features" :key="feature">
                  <i class="pi pi-check"></i> {{ feature }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="form-field terms-field">
          <Checkbox
            id="acceptTerms"
            v-model="form.acceptTerms"
            :binary="true"
            :class="{ 'p-invalid': errors.acceptTerms }"
          />
          <label for="acceptTerms">
            Accetto i <a href="/legal/terms" target="_blank">Termini di Servizio</a>
            e la <a href="/legal/privacy" target="_blank">Privacy Policy</a>
          </label>
          <small v-if="errors.acceptTerms" class="p-error">{{ errors.acceptTerms }}</small>
        </div>

        <Button
          type="submit"
          label="Crea Account"
          icon="pi pi-user-plus"
          class="w-full"
          size="large"
          :loading="registering"
        />

        <div class="auth-divider">
          <span>oppure</span>
        </div>

        <div class="auth-links">
          <p>
            Hai già un account?
            <router-link to="/login">Accedi</router-link>
          </p>
        </div>
      </form>

      <div class="auth-footer">
        <p>
          Inizia con 14 giorni di prova gratuita del piano selezionato.
          Nessuna carta di credito richiesta.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Checkbox from 'primevue/checkbox';
import RadioButton from 'primevue/radiobutton';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api.service';
import { useAuthStore } from '../../stores/auth.store';
// import type { RegisterForm } from '../../types'; // Removed - not used

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const registering = ref(false);

// Piano options con caratteristiche
const planOptions = [
  {
    code: 'STARTER',
    name: 'Starter',
    price: 29,
    popular: false,
    features: [
      '3 utenti',
      '1 magazzino',
      '1.000 prodotti',
      'Report base',
    ],
  },
  {
    code: 'PRO',
    name: 'Pro',
    price: 79,
    popular: true,
    features: [
      '10 utenti',
      '3 magazzini',
      '10.000 prodotti',
      'WordPress sync',
      'Report avanzati',
    ],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    price: 149,
    popular: false,
    features: [
      'Utenti illimitati',
      'Magazzini illimitati',
      'Prodotti illimitati',
      'Fatturazione elettronica',
      'API access',
    ],
  },
];

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  companyName: '',
  plan: 'PRO' as 'STARTER' | 'PRO' | 'BUSINESS',
  acceptTerms: false,
});

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  companyName: '',
  acceptTerms: '',
});

function validate(): boolean {
  let isValid = true;
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });

  if (!form.firstName.trim()) {
    errors.firstName = 'Nome obbligatorio';
    isValid = false;
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Cognome obbligatorio';
    isValid = false;
  }

  if (!form.email.trim()) {
    errors.email = 'Email obbligatoria';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email non valida';
    isValid = false;
  }

  if (!form.companyName.trim()) {
    errors.companyName = 'Nome azienda obbligatorio';
    isValid = false;
  }

  if (!form.password) {
    errors.password = 'Password obbligatoria';
    isValid = false;
  } else if (form.password.length < 8) {
    errors.password = 'La password deve avere almeno 8 caratteri';
    isValid = false;
  }

  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Le password non corrispondono';
    isValid = false;
  }

  if (!form.acceptTerms) {
    errors.acceptTerms = 'Devi accettare i termini di servizio';
    isValid = false;
  }

  return isValid;
}

async function register() {
  if (!validate()) return;

  registering.value = true;
  try {
    const response = await api.post('/auth/register', {
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      companyName: form.companyName,
      plan: form.plan,
    });

    if (response.success) {
      // Login automatico dopo registrazione
      await authStore.login(form.email, form.password);

      toast.add({
        severity: 'success',
        summary: 'Account Creato',
        detail: 'Benvenuto! Completa la configurazione del tuo account.',
        life: 5000,
      });

      // Redirect a onboarding
      router.push('/onboarding');
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile creare l\'account',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore durante la registrazione',
      life: 5000,
    });
  } finally {
    registering.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-50), var(--color-blue-50));
  padding: var(--space-6);
}

.auth-container {
  width: 100%;
  max-width: 480px;
  background: white;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--space-8);
}

.auth-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.auth-logo {
  width: 56px;
  height: 56px;
  background: var(--color-primary-600);
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-4);
}

.auth-logo span {
  font-size: 1.75rem;
  font-weight: 700;
  color: white;
}

.auth-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
}

.auth-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-gray-600);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.terms-field {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-2);
}

.terms-field label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.terms-field a {
  color: var(--color-primary-600);
  text-decoration: none;
}

.terms-field a:hover {
  text-decoration: underline;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin: var(--space-4) 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.auth-divider span {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.auth-links {
  text-align: center;
}

.auth-links p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.auth-links a {
  color: var(--color-primary-600);
  text-decoration: none;
  font-weight: 500;
}

.auth-links a:hover {
  text-decoration: underline;
}

.auth-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: var(--border-width) solid var(--border-color);
  text-align: center;
}

.auth-footer p {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin: 0;
}

/* Plan Selector Styles */
.plan-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.plan-option {
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.plan-option:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.plan-option-selected {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.plan-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.plan-name {
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
}

.plan-badge {
  background: var(--color-primary-600);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  text-transform: uppercase;
}

.plan-price {
  margin-bottom: var(--space-3);
}

.price-amount {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.price-period {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.plan-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.plan-features li {
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
  display: flex;
  align-items: center;
  gap: 4px;
}

.plan-features li i {
  color: var(--color-green-600);
  font-size: 10px;
}

@media (max-width: 480px) {
  .auth-container {
    padding: var(--space-6);
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
