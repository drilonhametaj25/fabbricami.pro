<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

async function handleSetup() {
  if (!name.value || !email.value || !password.value) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Compila tutti i campi',
      life: 3000,
    });
    return;
  }

  if (password.value.length < 8) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'La password deve essere di almeno 8 caratteri',
      life: 3000,
    });
    return;
  }

  if (password.value !== confirmPassword.value) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Le password non coincidono',
      life: 3000,
    });
    return;
  }

  loading.value = true;

  try {
    const success = await authStore.setup(email.value, password.value, name.value);

    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Setup completato',
        detail: 'Super admin creato con successo',
        life: 3000,
      });

      router.push('/dashboard');
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Il setup potrebbe essere già stato completato. Prova ad effettuare il login.',
        life: 5000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Si è verificato un errore durante il setup',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  router.push('/login');
}
</script>

<template>
  <div class="setup-page">
    <div class="setup-container">
      <div class="setup-header">
        <h1 class="setup-title">Setup Iniziale</h1>
        <p class="setup-subtitle">Crea il primo Super Admin per la piattaforma</p>
      </div>

      <form @submit.prevent="handleSetup" class="setup-form">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <InputText
            v-model="name"
            placeholder="Il tuo nome"
            class="w-full"
          />
        </div>

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
            placeholder="Minimo 8 caratteri"
            :feedback="true"
            toggleMask
            class="w-full"
            inputClass="w-full"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Conferma Password</label>
          <Password
            v-model="confirmPassword"
            placeholder="Ripeti la password"
            :feedback="false"
            toggleMask
            class="w-full"
            inputClass="w-full"
          />
        </div>

        <Button
          type="submit"
          label="Crea Super Admin"
          icon="pi pi-user-plus"
          :loading="loading"
          class="w-full"
        />
      </form>

      <div class="setup-footer">
        <p class="text-muted">Hai già un account?</p>
        <Button
          label="Vai al Login"
          class="p-button-text p-button-sm"
          @click="goToLogin"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.setup-container {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.setup-header {
  text-align: center;
  margin-bottom: 2rem;
}

.setup-title {
  font-size: 2rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 0.5rem;
}

.setup-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
}

.setup-form {
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

.setup-footer {
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
