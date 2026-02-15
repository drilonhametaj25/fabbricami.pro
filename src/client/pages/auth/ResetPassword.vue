<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Request Reset Form -->
      <template v-if="!hasToken && !requestSent">
        <div class="auth-header">
          <div class="auth-logo">
            <span>E</span>
          </div>
          <h1 class="auth-title">Reimposta Password</h1>
          <p class="auth-subtitle">
            Inserisci la tua email e ti invieremo un link per reimpostare la password.
          </p>
        </div>

        <form @submit.prevent="requestReset" class="auth-form">
          <div class="form-field">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="email"
              type="email"
              class="w-full"
              :class="{ 'p-invalid': emailError }"
            />
            <small v-if="emailError" class="p-error">{{ emailError }}</small>
          </div>

          <Button
            type="submit"
            label="Invia Link di Reset"
            icon="pi pi-send"
            class="w-full"
            :loading="requesting"
          />

          <div class="auth-links">
            <router-link to="/login">
              <i class="pi pi-arrow-left"></i> Torna al login
            </router-link>
          </div>
        </form>
      </template>

      <!-- Request Sent Confirmation -->
      <template v-else-if="requestSent && !hasToken">
        <div class="success-state">
          <div class="success-icon">
            <i class="pi pi-envelope"></i>
          </div>
          <h1>Email Inviata!</h1>
          <p>
            Se l'indirizzo <strong>{{ email }}</strong> è associato a un account,
            riceverai un'email con le istruzioni per reimpostare la password.
          </p>
          <Button
            label="Torna al Login"
            severity="secondary"
            @click="goToLogin"
          />
        </div>
      </template>

      <!-- Reset Password Form -->
      <template v-else-if="hasToken && !resetSuccess">
        <div class="auth-header">
          <div class="auth-logo">
            <span>E</span>
          </div>
          <h1 class="auth-title">Nuova Password</h1>
          <p class="auth-subtitle">Inserisci la tua nuova password.</p>
        </div>

        <form @submit.prevent="resetPassword" class="auth-form">
          <div class="form-field">
            <label for="newPassword">Nuova Password</label>
            <Password
              id="newPassword"
              v-model="newPassword"
              class="w-full"
              toggleMask
              :feedback="true"
              :class="{ 'p-invalid': passwordError }"
            />
            <small v-if="passwordError" class="p-error">{{ passwordError }}</small>
          </div>

          <div class="form-field">
            <label for="confirmPassword">Conferma Password</label>
            <Password
              id="confirmPassword"
              v-model="confirmPassword"
              class="w-full"
              toggleMask
              :feedback="false"
              :class="{ 'p-invalid': confirmError }"
            />
            <small v-if="confirmError" class="p-error">{{ confirmError }}</small>
          </div>

          <Button
            type="submit"
            label="Reimposta Password"
            icon="pi pi-check"
            class="w-full"
            :loading="resetting"
          />
        </form>
      </template>

      <!-- Reset Success -->
      <template v-else-if="resetSuccess">
        <div class="success-state">
          <div class="success-icon success">
            <i class="pi pi-check-circle"></i>
          </div>
          <h1>Password Reimpostata!</h1>
          <p>La tua password è stata aggiornata con successo.</p>
          <Button
            label="Accedi"
            icon="pi pi-sign-in"
            @click="goToLogin"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// State
const email = ref('');
const emailError = ref('');
const requesting = ref(false);
const requestSent = ref(false);

const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const confirmError = ref('');
const resetting = ref(false);
const resetSuccess = ref(false);

// Computed
const hasToken = computed(() => !!route.query.token);
const token = computed(() => route.query.token as string);

// Methods
async function requestReset() {
  emailError.value = '';

  if (!email.value.trim()) {
    emailError.value = 'Email obbligatoria';
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailError.value = 'Email non valida';
    return;
  }

  requesting.value = true;
  try {
    const response = await api.post('/auth/forgot-password', {
      email: email.value,
    });

    // Mostra sempre successo per sicurezza (non rivelare se email esiste)
    requestSent.value = true;
  } catch (error) {
    // Mostra comunque successo
    requestSent.value = true;
  } finally {
    requesting.value = false;
  }
}

async function resetPassword() {
  passwordError.value = '';
  confirmError.value = '';

  if (!newPassword.value) {
    passwordError.value = 'Password obbligatoria';
    return;
  }

  if (newPassword.value.length < 8) {
    passwordError.value = 'La password deve avere almeno 8 caratteri';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    confirmError.value = 'Le password non corrispondono';
    return;
  }

  resetting.value = true;
  try {
    const response = await api.post('/auth/reset-password', {
      token: token.value,
      newPassword: newPassword.value,
    });

    if (response.success) {
      resetSuccess.value = true;
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Il link di reset non è valido o è scaduto',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore durante il reset della password',
      life: 5000,
    });
  } finally {
    resetting.value = false;
  }
}

function goToLogin() {
  router.push('/login');
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
  max-width: 400px;
  background: white;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--space-8);
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
  margin-top: var(--space-4);
}

.auth-links a {
  font-size: var(--font-size-sm);
  color: var(--color-primary-600);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.auth-links a:hover {
  text-decoration: underline;
}

.success-state {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-icon i {
  font-size: 2.5rem;
  color: var(--color-primary-600);
}

.success-icon.success {
  background: var(--color-green-100);
}

.success-icon.success i {
  color: var(--color-green-600);
}

.success-state h1 {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0;
}

.success-state p {
  color: var(--color-gray-600);
  margin: 0;
}
</style>
