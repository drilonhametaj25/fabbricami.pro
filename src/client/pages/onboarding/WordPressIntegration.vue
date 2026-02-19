<template>
  <div class="wordpress-step">
    <div class="step-header">
      <div class="icon-container">
        <i class="pi pi-shopping-cart"></i>
      </div>
      <h2>Integrazione E-commerce</h2>
      <p class="subtitle">
        Collega il tuo negozio WooCommerce per sincronizzare automaticamente
        prodotti, ordini e inventario.
      </p>
    </div>

    <!-- Toggle per abilitare/disabilitare -->
    <div class="enable-toggle">
      <div class="toggle-content">
        <div class="toggle-info">
          <h3>Sincronizzazione WooCommerce</h3>
          <p>
            Abilita per importare automaticamente prodotti e ordini dal tuo negozio WordPress.
          </p>
        </div>
        <InputSwitch v-model="formData.enabled" />
      </div>
    </div>

    <!-- Form di configurazione (visibile solo se abilitato) -->
    <Transition name="slide-down">
      <div v-if="formData.enabled" class="config-form">
        <div class="form-section">
          <h4>Configurazione WooCommerce</h4>

          <div class="field">
            <label for="siteUrl">
              <i class="pi pi-globe"></i>
              URL del sito WordPress
            </label>
            <InputText
              id="siteUrl"
              v-model="formData.siteUrl"
              placeholder="https://tuonegozio.com"
              class="w-full"
            />
            <small class="field-help">L'URL completo del tuo sito WordPress</small>
          </div>

          <div class="field">
            <label for="consumerKey">
              <i class="pi pi-key"></i>
              Consumer Key
            </label>
            <InputText
              id="consumerKey"
              v-model="formData.consumerKey"
              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="consumerSecret">
              <i class="pi pi-lock"></i>
              Consumer Secret
            </label>
            <Password
              id="consumerSecret"
              v-model="formData.consumerSecret"
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              :feedback="false"
              toggleMask
              class="w-full"
            />
          </div>

          <!-- Test connessione -->
          <div class="test-connection">
            <Button
              label="Testa Connessione"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              :loading="testing"
              :disabled="!canTestConnection"
              @click="testConnection"
            />
            <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
              <i :class="testResult.success ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
              <span>{{ testResult.message }}</span>
            </div>
          </div>

          <!-- Guida -->
          <div class="help-box">
            <div class="help-header">
              <i class="pi pi-info-circle"></i>
              <span>Come ottenere le credenziali API</span>
            </div>
            <ol class="help-steps">
              <li>Accedi al pannello admin di WordPress</li>
              <li>Vai su <strong>WooCommerce &gt; Impostazioni &gt; Avanzate &gt; REST API</strong></li>
              <li>Clicca su <strong>"Aggiungi chiave"</strong></li>
              <li>Inserisci una descrizione (es. "Fabbricami ERP")</li>
              <li>Seleziona <strong>Lettura/Scrittura</strong> come permessi</li>
              <li>Clicca su <strong>"Genera chiave API"</strong></li>
              <li>Copia Consumer Key e Consumer Secret qui sopra</li>
            </ol>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Actions -->
    <div class="step-actions">
      <Button
        v-if="!formData.enabled"
        label="Salterò questo passaggio"
        severity="secondary"
        text
        @click="handleSkip"
      />
      <Button
        :label="formData.enabled ? 'Salva e Continua' : 'Continua'"
        icon="pi pi-arrow-right"
        iconPos="right"
        :loading="loading"
        :disabled="formData.enabled && !isFormValid"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import InputSwitch from 'primevue/inputswitch';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';
import type { WordPressIntegrationForm } from '../../types';

const router = useRouter();
const toast = useToast();
const {
  loading,
  saveWordPressIntegration,
  skipWordPressIntegration,
  testWordPressConnection,
  goToNextStep,
} = useOnboarding();

const formData = ref<WordPressIntegrationForm>({
  enabled: false,
  siteUrl: '',
  consumerKey: '',
  consumerSecret: '',
});

const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// Computed
const canTestConnection = computed(() => {
  return (
    formData.value.siteUrl &&
    formData.value.consumerKey &&
    formData.value.consumerSecret
  );
});

const isFormValid = computed(() => {
  if (!formData.value.enabled) return true;
  return (
    formData.value.siteUrl &&
    formData.value.consumerKey &&
    formData.value.consumerSecret
  );
});

// Methods
async function testConnection() {
  testing.value = true;
  testResult.value = null;

  try {
    const result = await testWordPressConnection(formData.value);
    testResult.value = result;
  } finally {
    testing.value = false;
  }
}

async function handleSubmit() {
  if (formData.value.enabled) {
    // Salva le impostazioni
    const success = await saveWordPressIntegration(formData.value);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Salvato',
        detail: 'Integrazione WooCommerce configurata',
        life: 3000,
      });
      goToNextStep();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Errore durante il salvataggio',
        life: 3000,
      });
    }
  } else {
    // Salta lo step
    await handleSkip();
  }
}

async function handleSkip() {
  const success = await skipWordPressIntegration();
  if (success) {
    goToNextStep();
  } else {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore durante il salvataggio',
      life: 3000,
    });
  }
}

onMounted(() => {
  // Could load existing settings here if needed
});
</script>

<style scoped>
.wordpress-step {
  max-width: 600px;
  margin: 0 auto;
}

.step-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.icon-container {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--color-primary-100), var(--color-primary-200));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-4);
}

.icon-container i {
  font-size: 2rem;
  color: var(--color-primary-600);
}

.step-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2);
}

.step-header .subtitle {
  font-size: var(--font-size-base);
  color: var(--color-gray-600);
  margin: 0;
  line-height: 1.6;
}

/* Enable Toggle */
.enable-toggle {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.toggle-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.toggle-info h3 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-1);
}

.toggle-info p {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin: 0;
}

/* Config Form */
.config-form {
  margin-bottom: var(--space-6);
}

.form-section {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
}

.form-section h4 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-6);
}

.field {
  margin-bottom: var(--space-5);
}

.field label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  margin-bottom: var(--space-2);
}

.field label i {
  font-size: var(--font-size-sm);
  color: var(--color-primary-600);
}

.field-help {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

/* Test Connection */
.test-connection {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--border-color);
}

.test-result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.test-result.success {
  color: var(--color-green-600);
}

.test-result.error {
  color: var(--color-red-600);
}

.test-result i {
  font-size: 1.25rem;
}

/* Help Box */
.help-box {
  background: var(--color-blue-50);
  border: 1px solid var(--color-blue-200);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
}

.help-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  color: var(--color-blue-700);
  margin-bottom: var(--space-3);
}

.help-header i {
  font-size: 1rem;
}

.help-steps {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-blue-900);
  line-height: 1.8;
}

.help-steps li {
  margin-bottom: var(--space-1);
}

.help-steps strong {
  color: var(--color-blue-800);
}

/* Actions */
.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border-color);
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 640px) {
  .toggle-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .step-actions {
    flex-direction: column;
  }

  .step-actions button {
    width: 100%;
  }

  .test-connection {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
