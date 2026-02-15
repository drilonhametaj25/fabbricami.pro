<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <ProgressSpinner />
        <p>Caricamento invito...</p>
      </div>

      <!-- Invalid Token -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <i class="pi pi-times-circle"></i>
        </div>
        <h1>Invito Non Valido</h1>
        <p>{{ error }}</p>
        <Button
          label="Vai al Login"
          @click="goToLogin"
        />
      </div>

      <!-- Accept Invite Form -->
      <template v-else-if="invite && !success">
        <div class="auth-header">
          <div class="auth-logo">
            <span>E</span>
          </div>
          <h1 class="auth-title">Benvenuto!</h1>
          <p class="auth-subtitle">
            Sei stato invitato a far parte di <strong>{{ invite.tenantName }}</strong>
            come <strong>{{ getRoleLabel(invite.role) }}</strong>.
          </p>
        </div>

        <form @submit.prevent="acceptInvite" class="auth-form">
          <div class="invite-info">
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">{{ invite.email }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Organizzazione</span>
              <span class="info-value">{{ invite.tenantName }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Ruolo</span>
              <span class="info-value">{{ getRoleLabel(invite.role) }}</span>
            </div>
          </div>

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
            <label for="password">Crea una Password *</label>
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

          <Button
            type="submit"
            label="Accetta Invito"
            icon="pi pi-check"
            class="w-full"
            :loading="accepting"
          />

          <div class="auth-links">
            <p>
              Hai già un account?
              <router-link to="/login">Accedi</router-link>
            </p>
          </div>
        </form>
      </template>

      <!-- Success -->
      <div v-else-if="success" class="success-state">
        <div class="success-icon">
          <i class="pi pi-check-circle"></i>
        </div>
        <h1>Benvenuto nel team!</h1>
        <p>Il tuo account è stato creato con successo.</p>
        <Button
          label="Accedi alla piattaforma"
          icon="pi pi-arrow-right"
          iconPos="right"
          @click="goToDashboard"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api.service';
import { useAuthStore } from '../../stores/auth.store';
import type { TenantInvite, UserRole } from '../../types';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref('');
const invite = ref<TenantInvite | null>(null);
const accepting = ref(false);
const success = ref(false);

const form = reactive({
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
});

const errors = reactive({
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
});

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Amministratore',
    MANAGER: 'Manager',
    CONTABILE: 'Contabile',
    MAGAZZINIERE: 'Magazziniere',
    OPERATORE: 'Operatore',
    COMMERCIALE: 'Commerciale',
    VIEWER: 'Visualizzatore',
  };
  return labels[role] || role;
}

async function loadInvite() {
  const token = route.query.token as string;

  if (!token) {
    error.value = 'Token di invito mancante';
    loading.value = false;
    return;
  }

  try {
    const response = await api.get<TenantInvite>(`/auth/invite/${token}`);
    if (response.success) {
      invite.value = response.data;
      if (response.data.isExpired) {
        error.value = 'Questo invito è scaduto. Contatta l\'amministratore per ricevere un nuovo invito.';
        invite.value = null;
      }
    } else {
      error.value = response.error || 'Invito non valido';
    }
  } catch (err) {
    error.value = 'Errore durante il caricamento dell\'invito';
  } finally {
    loading.value = false;
  }
}

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

  return isValid;
}

async function acceptInvite() {
  if (!validate()) return;

  const token = route.query.token as string;

  accepting.value = true;
  try {
    const response = await api.post('/auth/accept-invite', {
      token,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    });

    if (response.success) {
      // Login automatico
      await authStore.login(invite.value!.email, form.password);
      success.value = true;
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile accettare l\'invito',
        life: 5000,
      });
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore durante l\'accettazione dell\'invito',
      life: 5000,
    });
  } finally {
    accepting.value = false;
  }
}

function goToLogin() {
  router.push('/login');
}

function goToDashboard() {
  router.push('/');
}

onMounted(() => {
  loadInvite();
});
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

.loading-state,
.error-state,
.success-state {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.loading-state p {
  color: var(--color-gray-600);
  margin: 0;
}

.error-icon,
.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon {
  background: var(--color-red-100);
}

.error-icon i {
  font-size: 3rem;
  color: var(--color-red-600);
}

.success-icon {
  background: var(--color-green-100);
}

.success-icon i {
  font-size: 3rem;
  color: var(--color-green-600);
}

h1 {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0;
}

.error-state p,
.success-state p {
  color: var(--color-gray-600);
  margin: 0;
}

.auth-header {
  text-align: center;
  margin-bottom: var(--space-6);
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
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
}

.auth-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.invite-info {
  background: var(--color-primary-50);
  border: var(--border-width) solid var(--color-primary-200);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-2);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
}

.info-row:not(:last-child) {
  border-bottom: var(--border-width) solid var(--color-primary-100);
}

.info-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.info-value {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-900);
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

.auth-links {
  text-align: center;
  margin-top: var(--space-2);
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

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
