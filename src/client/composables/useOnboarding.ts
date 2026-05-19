import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.service';
import { clearOnboardingCache } from '../router';
import type {
  OnboardingStatus,
  OnboardingStep,
  CompanySettingsForm,
  CreateWarehouseForm,
  WordPressIntegrationForm,
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

  const billingSetupComplete = computed(
    () => status.value?.billingSetupComplete || false
  );

  const wordpressIntegrationComplete = computed(
    () => status.value?.wordpressIntegrationComplete || false
  );

  // Calcola la percentuale di progresso
  const progress = computed(() => {
    const steps: OnboardingStep[] = [
      'verify-email',
      'company-settings',
      'setup-billing',
      'wordpress-integration',
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
      id: 'setup-billing' as OnboardingStep,
      label: 'Fatturazione',
      icon: 'pi pi-credit-card',
      completed: billingSetupComplete.value,
    },
    {
      id: 'wordpress-integration' as OnboardingStep,
      label: 'E-commerce',
      icon: 'pi pi-shopping-cart',
      completed: wordpressIntegrationComplete.value,
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

  // Recupera lo stato corrente dell'onboarding.
  //
  // Ogni fetch invalida ANCHE la cache del router guard. Senza questo passo, la
  // guard manteneva per 60s il vecchio currentStep e dopo uno skip dell'ultimo
  // step (warehouse) ridirigeva l'utente a /onboarding/setup-billing invece di
  // farlo atterrare sulla dashboard. Mantenere il cache pinned al fresh value
  // è il modo più semplice di evitare race fra UI navigation e guard.
  async function fetchStatus(): Promise<OnboardingStatus | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<OnboardingStatus>('/onboarding/status');
      if (response.success) {
        status.value = response.data;
        clearOnboardingCache();
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

  // Salva le impostazioni WordPress
  async function saveWordPressIntegration(data: WordPressIntegrationForm): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/wordpress-integration', data);
      if (response.success) {
        // Aggiorna lo stato
        await fetchStatus();
        return true;
      } else {
        error.value = response.error || 'Errore salvataggio integrazione WordPress';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore salvataggio integrazione WordPress';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Salta integrazione WordPress
  async function skipWordPressIntegration(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/onboarding/skip-wordpress');
      if (response.success) {
        // Aggiorna lo stato
        await fetchStatus();
        return true;
      } else {
        error.value = response.error || 'Errore skip WordPress';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore skip WordPress';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Test connessione WordPress
  async function testWordPressConnection(data: WordPressIntegrationForm): Promise<{ success: boolean; message: string }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<{ valid: boolean; message: string }>('/onboarding/test-wordpress', data);
      if (response.success && response.data) {
        return {
          success: response.data.valid,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          message: response.error || 'Errore test connessione',
        };
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Errore test connessione',
      };
    } finally {
      loading.value = false;
    }
  }

  // Inizia setup billing - apre Stripe Checkout o porta a trial
  async function setupBilling(
    startTrial: boolean = false,
    planCode: string = 'PRO',
    billingPeriod: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{ success: boolean; checkoutUrl?: string; fallbackToTrial?: boolean }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<{
        success: boolean;
        checkoutUrl?: string;
        fallbackToTrial?: boolean;
      }>('/onboarding/setup-billing', {
        startTrial,
        planCode,
        billingPeriod,
        successUrl: `${window.location.origin}/onboarding/wordpress-integration`,
        cancelUrl: `${window.location.origin}/onboarding/setup-billing?canceled=true`,
      });
      if (response.success) {
        // Se Stripe checkout con fallback a trial, aggiorna status e vai avanti
        if (response.data?.fallbackToTrial) {
          await fetchStatus();
        }
        return {
          success: true,
          checkoutUrl: response.data?.checkoutUrl,
          fallbackToTrial: response.data?.fallbackToTrial,
        };
      } else {
        error.value = response.error || 'Errore setup billing';
        return { success: false };
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore setup billing';
      return { success: false };
    } finally {
      loading.value = false;
    }
  }

  // DEPRECATED: lo step di billing non è più skippabile. Questa funzione
  // rimane per backward-compat ma ora chiama l'endpoint setup-billing in
  // modalità trial. Da rimuovere quando tutti i client saranno aggiornati.
  async function skipBilling(): Promise<boolean> {
    const result = await setupBilling(true, 'PRO');
    return result.success;
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

  // Naviga allo step successivo nell'ordine canonico.
  //
  // FIX: in passato si usava `currentStep.value` (computed da
  // `status.currentStep`, che il backend ricalcola come "il primo step
  // incompleto"). Ma "il primo step incompleto" NON è uguale a "lo step su cui
  // l'utente è ora": dopo aver skippato WP, se billing era ancora vuoto, il
  // backend ritornava `currentStep='setup-billing'` → `goToNextStep` mandava a
  // wordpress-integration → loop. Adesso lo step di partenza viene letto
  // dall'URL corrente; può essere overridato da `fromStep` per casi speciali.
  function goToNextStep(fromStep?: OnboardingStep): void {
    const stepOrder: OnboardingStep[] = [
      'verify-email',
      'company-settings',
      'setup-billing',
      'wordpress-integration',
      'create-warehouse',
      'complete',
    ];

    // Ricava lo step di partenza dall'URL se non passato esplicitamente
    let from: OnboardingStep | null = fromStep ?? null;
    if (!from) {
      const path = router.currentRoute.value.path;
      const match = path.match(/\/onboarding\/([\w-]+)/);
      const fromUrl = match?.[1] as OnboardingStep | undefined;
      if (fromUrl && stepOrder.includes(fromUrl)) {
        from = fromUrl;
      } else {
        // Fallback: se URL non onboarding (es. chiamato post-stripe-redirect)
        // usiamo il currentStep dal backend.
        from = currentStep.value;
      }
    }

    const currentIdx = stepOrder.indexOf(from);
    if (currentIdx >= 0 && currentIdx < stepOrder.length - 1) {
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
    billingSetupComplete,
    wordpressIntegrationComplete,
    firstWarehouseCreated,
    progress,
    steps,

    // Methods
    isStepCompleted,
    fetchStatus,
    fetchCompanySettings,
    saveCompanySettings,
    setupBilling,
    skipBilling,
    createWarehouse,
    skipWarehouse,
    saveWordPressIntegration,
    skipWordPressIntegration,
    testWordPressConnection,
    completeOnboarding,
    resendVerificationEmail,
    goToCurrentStep,
    goToNextStep,
    checkOnboardingRequired,
  };
}
