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
        <p class="redirect-hint">Stiamo aprendo la configurazione iniziale...</p>
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

        <div class="resend-section">
          <label for="resendEmail">Per richiedere un nuovo link, inserisci la tua email:</label>
          <InputText
            id="resendEmail"
            v-model="resendEmail"
            type="email"
            placeholder="nome@azienda.it"
            class="w-full"
          />
        </div>

        <div class="error-actions">
          <Button
            label="Richiedi nuovo link"
            severity="secondary"
            @click="requestNewLink"
            :loading="requesting"
            :disabled="!resendEmail || !isValidEmail(resendEmail)"
          />
          <Button label="Vai al Login" @click="goToLogin" />
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
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api.service';
import { useAuthStore } from '../../stores/auth.store';
import { clearOnboardingCache } from '../../router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

const loading = ref(true);
const success = ref(false);
const errorMessage = ref('');
const requesting = ref(false);
const resendEmail = ref('');

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyToken() {
  const token = route.query.token as string;

  if (!token) {
    loading.value = false;
    errorMessage.value = 'Token di verifica mancante';
    return;
  }

  try {
    // Backend response shape after fix:
    // { success: true, data: { token, refreshToken, user, tenant, message } }
    const response = await api.post('/auth/verify-email', { token });

    if (response.success && response.data?.token) {
      // Persist the new session so the user can proceed to /onboarding
      // without a separate login step.
      auth.setSession({
        user: response.data.user,
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        tenant: response.data.tenant || null,
      });

      success.value = true;
      // Invalida la cache del router-guard onboarding status: l'utente è
      // appena passato da `verify-email` a `company-settings` (next step) e
      // la guard, senza clear, manterrebbe per 60s il vecchio currentStep
      // potenzialmente facendo rimbalzo a `/onboarding/verify-email` o
      // peggio direttamente a `/dashboard` se cache stale dice 'complete'.
      clearOnboardingCache();
      // Auto-redirect after a short moment so the user sees the confirmation.
      // Andiamo direttamente al primo step "vero" dell'onboarding (company-settings):
      // verify-email è appena stato completato e la guard re-fetcha lo status fresco.
      setTimeout(() => {
        router.push('/onboarding/company-settings');
      }, 1500);
    } else if (response.success) {
      // Backwards compat: verify ok but no token issued
      success.value = true;
    } else {
      errorMessage.value =
        response.error || 'Il link di verifica non è valido o è scaduto';
    }
  } catch (error: any) {
    errorMessage.value =
      error?.response?.data?.error ||
      error?.message ||
      'Errore durante la verifica. Riprova più tardi.';
  } finally {
    loading.value = false;
  }
}

function continueSetup() {
  clearOnboardingCache();
  router.push('/onboarding/company-settings');
}

function goToLogin() {
  router.push('/login');
}

async function requestNewLink() {
  if (!resendEmail.value || !isValidEmail(resendEmail.value)) {
    toast.add({
      severity: 'warn',
      summary: 'Email mancante',
      detail: 'Inserisci una email valida per ricevere un nuovo link',
      life: 4000,
    });
    return;
  }

  requesting.value = true;
  try {
    const response = await api.post('/auth/resend-verification', {
      email: resendEmail.value,
    });
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Email Inviata',
        detail:
          'Se l\'indirizzo è registrato, riceverai un nuovo link di verifica',
        life: 6000,
      });
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile inviare il link',
        life: 5000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail:
        error?.response?.data?.error || 'Impossibile inviare il link al momento',
      life: 5000,
    });
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
  max-width: 420px;
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

.redirect-hint {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-style: italic;
}

.resend-section {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.resend-section label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  font-weight: 500;
}

.error-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
}
</style>
