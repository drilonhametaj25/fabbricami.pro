<template>
  <div class="verify-email-step">
    <div class="step-icon-large">
      <i class="pi pi-envelope"></i>
    </div>

    <h1 class="step-title">Verifica la tua email</h1>

    <p class="step-description">
      Abbiamo inviato un'email di verifica a <strong>{{ userEmail }}</strong>.
      Clicca sul link nell'email per confermare il tuo account.
    </p>

    <div class="email-status" :class="{ verified: emailVerified }">
      <i :class="emailVerified ? 'pi pi-check-circle' : 'pi pi-clock'"></i>
      <span>{{ emailVerified ? 'Email verificata!' : 'In attesa di verifica...' }}</span>
    </div>

    <div class="actions">
      <Button
        v-if="!emailVerified"
        label="Reinvia email"
        icon="pi pi-refresh"
        severity="secondary"
        @click="resendEmail"
        :loading="resending"
        :disabled="resendCooldown > 0"
      />
      <span v-if="resendCooldown > 0" class="cooldown-text">
        Riprova tra {{ resendCooldown }} secondi
      </span>

      <Button
        v-if="emailVerified"
        label="Continua"
        icon="pi pi-arrow-right"
        iconPos="right"
        @click="goToNextStep"
      />
    </div>

    <div class="help-text">
      <p>Non hai ricevuto l'email?</p>
      <ul>
        <li>Controlla la cartella spam</li>
        <li>Assicurati che l'indirizzo {{ userEmail }} sia corretto</li>
        <li>
          <a href="#" @click.prevent="changeEmail">Cambia indirizzo email</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';
import { useAuthStore } from '../../stores/auth.store';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const { status, fetchStatus, resendVerificationEmail, goToNextStep } = useOnboarding();

// State
const resending = ref(false);
const resendCooldown = ref(0);
let cooldownInterval: number | null = null;
let statusInterval: number | null = null;

// Computed
const userEmail = computed(() => authStore.user?.email || '');
const emailVerified = computed(() => status.value?.emailVerified || false);

// Methods
async function resendEmail() {
  resending.value = true;
  try {
    const success = await resendVerificationEmail();
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Email Inviata',
        detail: 'Controlla la tua casella di posta',
        life: 5000,
      });
      // Start cooldown
      resendCooldown.value = 60;
      startCooldown();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Impossibile reinviare l\'email',
        life: 5000,
      });
    }
  } finally {
    resending.value = false;
  }
}

function startCooldown() {
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = window.setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }
  }, 1000);
}

function changeEmail() {
  // TODO: Implement email change flow
  toast.add({
    severity: 'info',
    summary: 'Funzionalità in arrivo',
    detail: 'Contatta il supporto per cambiare email',
    life: 5000,
  });
}

// Poll for status changes
function startPolling() {
  statusInterval = window.setInterval(async () => {
    await fetchStatus();
    if (emailVerified.value) {
      // Email verificata, ferma polling
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      toast.add({
        severity: 'success',
        summary: 'Email Verificata!',
        detail: 'Puoi continuare con la configurazione',
        life: 3000,
      });
    }
  }, 5000); // Poll ogni 5 secondi
}

onMounted(async () => {
  await fetchStatus();
  if (!emailVerified.value) {
    startPolling();
  }
});

onUnmounted(() => {
  if (cooldownInterval) clearInterval(cooldownInterval);
  if (statusInterval) clearInterval(statusInterval);
});
</script>

<style scoped>
.verify-email-step {
  text-align: center;
}

.step-icon-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-6);
}

.step-icon-large i {
  font-size: 2.5rem;
  color: var(--color-primary-600);
}

.step-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-3) 0;
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--color-gray-600);
  margin: 0 0 var(--space-6) 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.email-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-yellow-50);
  border: var(--border-width) solid var(--color-yellow-200);
  border-radius: var(--border-radius-full);
  color: var(--color-yellow-700);
  margin-bottom: var(--space-6);
}

.email-status.verified {
  background: var(--color-green-50);
  border-color: var(--color-green-200);
  color: var(--color-green-700);
}

.email-status i {
  font-size: 1.25rem;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.cooldown-text {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.help-text {
  text-align: left;
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  max-width: 400px;
  margin: 0 auto;
}

.help-text p {
  font-weight: 500;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-3) 0;
}

.help-text ul {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-gray-600);
}

.help-text li {
  margin-bottom: var(--space-2);
}

.help-text a {
  color: var(--color-primary-600);
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}
</style>
