<template>
  <div class="onboarding-layout">
    <div class="onboarding-container">
      <!-- Header with logo and progress -->
      <header class="onboarding-header">
        <div class="logo-section">
          <div class="logo">
            <span>E</span>
          </div>
          <span class="logo-text">ERP SaaS</span>
        </div>

        <div class="progress-section">
          <ProgressBar :value="progress" :showValue="false" class="main-progress" />
          <span class="progress-label">{{ progress }}% completato</span>
        </div>
      </header>

      <!-- Steps indicator -->
      <nav class="steps-nav">
        <div
          v-for="step in steps"
          :key="step.id"
          :class="['step-item', { active: currentStep === step.id, completed: isStepCompleted(step.id) }]"
        >
          <div class="step-icon">
            <i v-if="isStepCompleted(step.id)" class="pi pi-check"></i>
            <i v-else :class="step.icon"></i>
          </div>
          <span class="step-label">{{ step.label }}</span>
        </div>
      </nav>

      <!-- Content area -->
      <main class="onboarding-content">
        <router-view />
      </main>

      <!-- Footer -->
      <!--
        I bottoni "Salta per ora" vivono nelle singole page (contestuali al
        form): SetupBilling "Configura dopo", WordPressIntegration "Salterò
        questo passaggio", CreateWarehouse "Salta per ora". Avere un secondo
        "Salta per ora" anche in footer creava UX confusa (due bottoni con la
        stessa label che facevano la stessa cosa o, peggio, cose diverse a
        seconda dello step).
      -->
      <footer class="onboarding-footer">
        <span /> <!-- spacer per mantenere logout a destra in space-between -->
        <Button
          v-if="showLogoutButton"
          label="Esci"
          severity="secondary"
          text
          icon="pi pi-sign-out"
          @click="logout"
        />
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import { useOnboarding } from '../../composables/useOnboarding';
import { useAuthStore } from '../../stores/auth.store';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const {
  status,
  currentStep,
  progress,
  steps,
  isStepCompleted,
  fetchStatus,
  skipWarehouse,
  skipWordPressIntegration,
  goToNextStep,
} = useOnboarding();

// Lo step "su cui l'utente è ora" si ricava dall'URL, NON da
// `currentStep.value` (che il backend computa come "primo incompleto" e quindi
// può differire dalla pagina che l'utente sta effettivamente vedendo dopo un
// passaggio di skip/continua).
const currentStepFromUrl = computed(() => {
  const match = route.path.match(/\/onboarding\/([\w-]+)/);
  return (match?.[1] ?? '') as
    | 'verify-email'
    | 'company-settings'
    | 'setup-billing'
    | 'wordpress-integration'
    | 'create-warehouse'
    | 'complete'
    | '';
});

// Computed
const showSkipButton = computed(() => {
  const step = currentStepFromUrl.value;
  // setup-billing è obbligatorio: l'utente deve scegliere se attivare la prova
  // o configurare il pagamento. Niente skip per questo step.
  return step === 'create-warehouse' || step === 'wordpress-integration';
});

const showLogoutButton = computed(() => true);

// Methods
async function skipStep() {
  const step = currentStepFromUrl.value;
  // setup-billing non è mai skippabile (il pulsante non viene mostrato).
  if (step === 'wordpress-integration') {
    await skipWordPressIntegration();
  } else if (step === 'create-warehouse') {
    await skipWarehouse();
  } else {
    return;
  }
  goToNextStep(step as any);
}

async function logout() {
  await authStore.logout();
  router.push('/login');
}

// Load status on mount
onMounted(async () => {
  await fetchStatus();

  // Se onboarding già completo, vai alla dashboard.
  if (status.value?.currentStep === 'complete') {
    router.push('/');
  }
});
</script>

<style scoped>
.onboarding-layout {
  /* width:100% perche' #app e' display:flex e senza questo il figlio
     prende solo la larghezza del contenuto, lasciando vuoto il resto */
  width: 100%;
  flex: 1;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--color-primary-50), var(--color-blue-50));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  box-sizing: border-box;
}

.onboarding-container {
  width: 100%;
  max-width: 700px;
  background: white;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

/* Header */
.onboarding-header {
  padding: var(--space-6);
  border-bottom: var(--border-width) solid var(--border-color);
}

.logo-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.logo {
  width: 40px;
  height: 40px;
  background: var(--color-primary-600);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo span {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
}

.logo-text {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-primary-600);
}

.progress-section {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.main-progress {
  flex: 1;
  height: 8px;
}

.progress-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  white-space: nowrap;
}

/* Steps Nav */
.steps-nav {
  display: flex;
  justify-content: center;
  gap: var(--space-8);
  padding: var(--space-6) var(--space-4);
  background: var(--color-gray-50);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  opacity: 0.5;
  transition: all 0.2s;
}

.step-item.active {
  opacity: 1;
}

.step-item.completed {
  opacity: 1;
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-gray-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--color-gray-500);
  transition: all 0.2s;
}

.step-item.active .step-icon {
  background: var(--color-primary-600);
  color: white;
}

.step-item.completed .step-icon {
  background: var(--color-green-500);
  color: white;
}

.step-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-600);
}

.step-item.active .step-label {
  color: var(--color-primary-600);
}

.step-item.completed .step-label {
  color: var(--color-green-600);
}

/* Content */
.onboarding-content {
  padding: var(--space-8);
  min-height: 400px;
}

/* Footer */
.onboarding-footer {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color);
  display: flex;
  justify-content: space-between;
  background: var(--color-gray-50);
}

/* Responsive */
@media (max-width: 640px) {
  .onboarding-layout {
    padding: 0;
  }

  .onboarding-container {
    border-radius: 0;
    min-height: 100vh;
  }

  .steps-nav {
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .step-label {
    display: none;
  }
}
</style>
