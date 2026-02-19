<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const email = ref('');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci email e password',
      life: 3000,
    });
    return;
  }

  loading.value = true;

  try {
    const success = await authStore.login(email.value, password.value);

    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Login effettuato',
        detail: 'Benvenuto nel pannello di amministrazione',
        life: 3000,
      });

      const redirect = (route.query.redirect as string) || '/dashboard';
      router.push(redirect);
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Credenziali non valide',
        life: 3000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Si è verificato un errore durante il login',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function goToSetup() {
  router.push('/setup');
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1 class="login-title">MegaAdmin</h1>
        <p class="login-subtitle">Pannello di Amministrazione Piattaforma</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <InputText
            v-model="email"
            type="email"
            placeholder="admin@fabbricami.pro"
            class="w-full"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Password</label>
          <Password
            v-model="password"
            placeholder="********"
            :feedback="false"
            toggleMask
            class="w-full"
            inputClass="w-full"
          />
        </div>

        <Button
          type="submit"
          label="Accedi"
          icon="pi pi-sign-in"
          :loading="loading"
          class="w-full"
        />
      </form>

      <div class="login-footer">
        <p class="text-muted">Primo accesso?</p>
        <Button
          label="Configura Super Admin"
          class="p-button-text p-button-sm"
          @click="goToSetup"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 0.5rem;
}

.login-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
}

.login-form {
  background: #1e293b;
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid #334155;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.w-full {
  width: 100%;
}

.login-footer {
  margin-top: 1.5rem;
  text-align: center;
}

.text-muted {
  color: #64748b;
  font-size: 0.875rem;
}

:deep(.p-inputtext) {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;
}

:deep(.p-inputtext:enabled:focus) {
  border-color: #4f46e5;
  box-shadow: 0 0 0 1px #4f46e5;
}

:deep(.p-password-input) {
  width: 100%;
}
</style>
