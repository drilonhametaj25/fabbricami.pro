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
      <footer class="onboarding-footer">
        <Button
          v-if="showSkipButton"
          label="Salta per ora"
          severity="secondary"
          text
          @click="skipStep"
        />
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
const _route = useRoute();
const authStore = useAuthStore();
const {
  status,
  currentStep,
  progress,
  steps,
  isStepCompleted,
  fetchStatus,
  skipBilling,
  skipWarehouse,
  skipWordPressIntegration,
} = useOnboarding();

// Computed
const showSkipButton = computed(() => {
  return currentStep.value === 'setup-billing' || currentStep.value === 'create-warehouse' || currentStep.value === 'wordpress-integration';
});

const showLogoutButton = computed(() => true);

// Methods
async function skipStep() {
  if (currentStep.value === 'setup-billing') {
    await skipBilling();
    router.push('/onboarding/wordpress-integration');
  } else if (currentStep.value === 'create-warehouse') {
    await skipWarehouse();
    router.push('/');
  } else if (currentStep.value === 'wordpress-integration') {
    await skipWordPressIntegration();
    router.push('/onboarding/create-warehouse');
  }
}

async function logout() {
  await authStore.logout();
  router.push('/login');
}

// Load status on mount
onMounted(async () => {
  await fetchStatus();

  // Se onboarding completo, redirect a dashboard
  if (status.value?.currentStep === 'complete') {
    router.push('/');
  }
});
</script>

<style scoped>
.onboarding-layout {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--color-primary-50), var(--color-blue-50));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
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
