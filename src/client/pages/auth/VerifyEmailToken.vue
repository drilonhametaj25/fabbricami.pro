<template>
  <div class="auth-page">
    <div class="auth-container">
      <div v-if="loading" class="verify-loading">
        <ProgressSpinner />
        <p>Verifica email in corso...</p>
      </div>

      <div v-else-if="success" class="verify-success">
        <div class="success-icon">
          <i class="pi pi-check-circle"></i>
        </div>
        <h1>Email Verificata!</h1>
        <p>Il tuo indirizzo email è stato verificato con successo.</p>
        <Button
          label="Continua con la configurazione"
          icon="pi pi-arrow-right"
          iconPos="right"
          @click="continueSetup"
        />
      </div>

      <div v-else class="verify-error">
        <div class="error-icon">
          <i class="pi pi-times-circle"></i>
        </div>
        <h1>Verifica Fallita</h1>
        <p>{{ errorMessage }}</p>
        <div class="error-actions">
          <Button
            label="Richiedi nuovo link"
            severity="secondary"
            @click="requestNewLink"
            :loading="requesting"
          />
          <Button
            label="Vai al Login"
            @click="goToLogin"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const loading = ref(true);
const success = ref(false);
const errorMessage = ref('');
const requesting = ref(false);

async function verifyToken() {
  const token = route.query.token as string;

  if (!token) {
    loading.value = false;
    errorMessage.value = 'Token di verifica mancante';
    return;
  }

  try {
    const response = await api.post('/auth/verify-email', { token });

    if (response.success) {
      success.value = true;
    } else {
      errorMessage.value = response.error || 'Il link di verifica non è valido o è scaduto';
    }
  } catch (error) {
    errorMessage.value = 'Errore durante la verifica. Riprova più tardi.';
  } finally {
    loading.value = false;
  }
}

function continueSetup() {
  router.push('/onboarding');
}

function goToLogin() {
  router.push('/login');
}

async function requestNewLink() {
  requesting.value = true;
  try {
    const response = await api.post('/auth/resend-verification');
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Email Inviata',
        detail: 'Un nuovo link di verifica è stato inviato',
        life: 5000,
      });
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile inviare il link',
        life: 5000,
      });
    }
  } finally {
    requesting.value = false;
  }
}

onMounted(() => {
  verifyToken();
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
  max-width: 400px;
  background: white;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--space-8);
  text-align: center;
}

.verify-loading,
.verify-success,
.verify-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.verify-loading p {
  color: var(--color-gray-600);
  margin: 0;
}

.success-icon,
.error-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-icon {
  background: var(--color-green-100);
}

.success-icon i {
  font-size: 3rem;
  color: var(--color-green-600);
}

.error-icon {
  background: var(--color-red-100);
}

.error-icon i {
  font-size: 3rem;
  color: var(--color-red-600);
}

h1 {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0;
}

p {
  color: var(--color-gray-600);
  margin: 0;
}

.error-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
</style>
