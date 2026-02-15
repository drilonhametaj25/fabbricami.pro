import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.service';
import type {
  OnboardingStatus,
  OnboardingStep,
  CompanySettingsForm,
  CreateWarehouseForm,
} from '../types';

export function useOnboarding() {
  const router = useRouter();

  const status = ref<OnboardingStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters computati
  const isComplete = computed(() => status.value?.currentStep === 'complete');

  const currentStep = computed<OnboardingStep>(
    () => status.value?.currentStep || 'verify-email'
  );

  const completedSteps = computed(() => status.value?.completedSteps || []);

  const emailVerified = computed(() => status.value?.emailVerified || false);

  const companySettingsComplete = computed(
    () => status.value?.companySettingsComplete || false
  );

  const firstWarehouseCreated = computed(
    () => status.value?.firstWarehouseCreated || false
  );

  // Calcola la percentuale di progresso
  const progress = computed(() => {
    const steps: OnboardingStep[] = [
      'verify-email',
      'company-settings',
      'create-warehouse',
      'complete',
    ];
    const idx = steps.indexOf(currentStep.value);
    return Math.round((idx / (steps.length - 1)) * 100);
  });

  // Definizione degli step per UI
  const steps = computed(() => [
    {
      id: 'verify-email' as OnboardingStep,
      label: 'Verifica Email',
      icon: 'pi pi-envelope',
      completed: emailVerified.value,
    },
    {
      id: 'company-settings' as OnboardingStep,
      label: 'Dati Azienda',
      icon: 'pi pi-building',
      completed: companySettingsComplete.value,
    },
    {
      id: 'create-warehouse' as OnboardingStep,
      label: 'Magazzino',
      icon: 'pi pi-box',
      completed: firstWarehouseCreated.value,
    },
    {
      id: 'complete' as OnboardingStep,
      label: 'Completato',
      icon: 'pi pi-check-circle',
      completed: isComplete.value,
    },
  ]);

  // Verifica se uno step è completato
  function isStepCompleted(stepId: OnboardingStep): boolean {
    return completedSteps.value.includes(stepId);
  }

  // Recupera lo stato corrente dell'onboarding
  async function fetchStatus(): Promise<OnboardingStatus | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<OnboardingStatus>('/onboarding/status');
      if (response.success) {
        status.value = response.data;
        return response.data;
      } else {
        error.value = response.error || 'Errore caricamento stato onboarding';
        return null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento stato onboarding';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // Recupera le impostazioni azienda correnti
  async function fetchCompanySettings(): Promise<CompanySettingsForm | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<CompanySettingsForm>('/onboarding/company-settings');
      if (response.success) {
        return response.data;
      } else {
        error.value = response.error || 'Errore caricamento impostazioni';
        return null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento impostazioni';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // Salva le impostazioni azienda
  async function saveCompanySettings(data: CompanySettingsForm): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/company-settings', data);
      if (response.success) {
        // Aggiorna lo stato
        await fetchStatus();
        return true;
      } else {
        error.value = response.error || 'Errore salvataggio impostazioni';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore salvataggio impostazioni';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Crea il primo magazzino
  async function createWarehouse(data: CreateWarehouseForm): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/first-warehouse', data);
      if (response.success) {
        // Aggiorna lo stato
        await fetchStatus();
        return true;
      } else {
        error.value = response.error || 'Errore creazione magazzino';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore creazione magazzino';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Salta la creazione del magazzino (crea magazzino di default)
  async function skipWarehouse(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/skip-warehouse');
      if (response.success) {
        // Aggiorna lo stato
        await fetchStatus();
        return true;
      } else {
        error.value = response.error || 'Errore skip magazzino';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore skip magazzino';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Marca l'onboarding come completo
  async function completeOnboarding(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/complete');
      if (response.success) {
        // Aggiorna lo stato
        if (status.value) {
          status.value.currentStep = 'complete';
        }
        return true;
      } else {
        error.value = response.error || 'Errore completamento onboarding';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore completamento onboarding';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Reinvia email di verifica
  async function resendVerificationEmail(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/auth/resend-verification');
      if (response.success) {
        return true;
      } else {
        error.value = response.error || 'Errore reinvio email';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore reinvio email';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Naviga allo step corrente
  function goToCurrentStep(): void {
    const step = currentStep.value;
    if (step === 'complete') {
      router.push('/');
    } else {
      router.push(`/onboarding/${step}`);
    }
  }

  // Naviga allo step successivo
  function goToNextStep(): void {
    const stepOrder: OnboardingStep[] = [
      'verify-email',
      'company-settings',
      'create-warehouse',
      'complete',
    ];
    const currentIdx = stepOrder.indexOf(currentStep.value);
    if (currentIdx < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIdx + 1];
      if (nextStep === 'complete') {
        router.push('/');
      } else {
        router.push(`/onboarding/${nextStep}`);
      }
    }
  }

  // Verifica se l'onboarding deve essere mostrato
  async function checkOnboardingRequired(): Promise<boolean> {
    const onboardingStatus = await fetchStatus();
    if (!onboardingStatus) return false;
    return onboardingStatus.currentStep !== 'complete';
  }

  return {
    // State
    status,
    loading,
    error,

    // Getters
    isComplete,
    currentStep,
    completedSteps,
    emailVerified,
    companySettingsComplete,
    firstWarehouseCreated,
    progress,
    steps,

    // Methods
    isStepCompleted,
    fetchStatus,
    fetchCompanySettings,
    saveCompanySettings,
    createWarehouse,
    skipWarehouse,
    completeOnboarding,
    resendVerificationEmail,
    goToCurrentStep,
    goToNextStep,
    checkOnboardingRequired,
  };
}
