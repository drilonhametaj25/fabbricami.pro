<template>
  <!-- TEST VITE HMR - Se vedi questo commento nel browser, Vite funziona -->
  <div class="login-page">
    <!-- Left Panel - Info Section -->
    <div class="info-panel">
      <div class="info-content">
        <!-- Logo & Brand -->
        <div class="brand">
          <div class="logo">
            <span>E</span>
          </div>
          <h1>FabbricaMi.pro</h1>
          <p class="tagline">Sistema Gestionale Completo per E-commerce</p>
        </div>

        <!-- Description -->
        <div class="description">
          <p>
            La soluzione all-in-one per gestire la tua attività di modellismo.
            Dalla gestione del magazzino agli ordini, dalla fatturazione al CRM,
            tutto in un'unica piattaforma potente e intuitiva.
          </p>
        </div>

        <!-- Features Grid -->
        <div class="features">
          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-box"></i>
            </div>
            <div class="feature-text">
              <h3>Gestione Magazzino</h3>
              <p>Controllo completo dell'inventario con tracciamento lotti e movimenti</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-shopping-cart"></i>
            </div>
            <div class="feature-text">
              <h3>Ordini & Vendite</h3>
              <p>Gestione ordini clienti e fornitori con workflow automatizzati</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-file-pdf"></i>
            </div>
            <div class="feature-text">
              <h3>Fatturazione</h3>
              <p>Emissione fatture, DDT e documenti fiscali integrati</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-users"></i>
            </div>
            <div class="feature-text">
              <h3>CRM Clienti</h3>
              <p>Anagrafica clienti completa con storico ordini e comunicazioni</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-chart-bar"></i>
            </div>
            <div class="feature-text">
              <h3>Dashboard & Report</h3>
              <p>Analisi in tempo reale con grafici e statistiche avanzate</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">
              <i class="pi pi-cog"></i>
            </div>
            <div class="feature-text">
              <h3>Multi-Magazzino</h3>
              <p>Gestione di più sedi e magazzini con trasferimenti interni</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="info-footer">
          <p>&copy; 2026 FabbricaMi.pro. Tutti i diritti riservati.</p>
        </div>
      </div>

      <!-- Background decoration -->
      <div class="bg-decoration">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
      </div>
    </div>

    <!-- Right Panel - Login Form -->
    <div class="form-panel">
      <div class="form-container">
        <!-- Mobile Logo (only visible on mobile) -->
        <div class="mobile-brand">
          <div class="logo-small">
            <span>E</span>
          </div>
          <h2>FabbricaMi.pro</h2>
        </div>

        <!-- Login Card -->
        <div class="login-card">
          <div class="card-header">
            <h2>Bentornato!</h2>
            <p>Accedi al tuo account per continuare</p>
          </div>

          <!-- Demo Credentials Box -->
          <div class="demo-credentials">
            <div class="demo-icon">
              <i class="pi pi-info-circle"></i>
            </div>
            <div class="demo-content">
              <strong>Credenziali Demo</strong>
              <div class="credentials-list">
                <span><i class="pi pi-envelope"></i> admin@fabbricami.pro</span>
                <span><i class="pi pi-lock"></i> admin123</span>
              </div>
            </div>
          </div>

          <!-- Login Form -->
          <form @submit.prevent="handleLogin" class="login-form">
            <div class="field">
              <label for="email">
                <i class="pi pi-envelope"></i>
                Email
              </label>
              <InputText
                id="email"
                v-model="email"
                type="email"
                placeholder="nome@esempio.com"
                class="input-field"
              />
            </div>

            <div class="field">
              <label for="password">
                <i class="pi pi-lock"></i>
                Password
              </label>
              <Password
                id="password"
                v-model="password"
                placeholder="Inserisci la password"
                :feedback="false"
                toggleMask
                class="input-field"
                inputClass="password-input"
              />
            </div>

            <div class="form-options">
              <label class="remember-me">
                <input type="checkbox" v-model="rememberMe" />
                <span>Ricordami</span>
              </label>
              <a href="#" class="forgot-password">Password dimenticata?</a>
            </div>

            <Button
              type="submit"
              :loading="loading"
              class="login-button"
            >
              <i v-if="!loading" class="pi pi-sign-in"></i>
              <span v-if="!loading">Accedi</span>
              <span v-else>Accesso in corso...</span>
            </Button>
          </form>

          <!-- Footer -->
          <div class="card-footer">
            <p>Hai bisogno di aiuto? <a href="mailto:support@fabbricami.pro">Contatta il supporto</a></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth.store';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const rememberMe = ref(false);

const handleLogin = async () => {
  loading.value = true;

  try {
    const response = await authStore.login(email.value, password.value);

    if (response.success) {
      router.push('/');
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
      detail: 'Errore durante il login',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* ===== PAGE LAYOUT - SPLIT SCREEN ===== */
.login-page {
  min-height: 100vh;
  display: flex;
  width: 100%;
}

/* ===== LEFT PANEL - INFO SECTION ===== */
.info-panel {
  flex: 1;
  background: linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%);
  color: white;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.info-content {
  position: relative;
  z-index: 2;
  max-width: 600px;
  width: 100%;
}

/* Brand */
.brand {
  margin-bottom: 2.5rem;
}

.logo {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.logo span {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
}

.brand h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  letter-spacing: -1px;
}

.tagline {
  font-size: 1.125rem;
  opacity: 0.9;
  margin: 0;
  font-weight: 400;
}

/* Description */
.description {
  margin-bottom: 3rem;
}

.description p {
  font-size: 1.1rem;
  line-height: 1.8;
  opacity: 0.9;
  margin: 0;
}

/* Features Grid */
.features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.feature {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
}

.feature-icon i {
  font-size: 1.25rem;
  color: white;
}

.feature-text h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.feature-text p {
  font-size: 0.875rem;
  opacity: 0.8;
  margin: 0;
  line-height: 1.5;
}

/* Info Footer */
.info-footer {
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.info-footer p {
  font-size: 0.875rem;
  opacity: 0.7;
  margin: 0;
}

/* Background Decoration */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
}

.circle-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  right: -100px;
}

.circle-2 {
  width: 300px;
  height: 300px;
  bottom: -50px;
  left: -50px;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ===== RIGHT PANEL - FORM SECTION ===== */
.form-panel {
  flex: 0 0 480px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.form-container {
  width: 100%;
  max-width: 400px;
}

/* Mobile Brand (hidden on desktop) */
.mobile-brand {
  display: none;
  text-align: center;
  margin-bottom: 2rem;
}

.logo-small {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.logo-small span {
  font-size: 1.75rem;
  font-weight: 800;
  color: white;
}

.mobile-brand h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

/* ===== LOGIN CARD ===== */
.login-card {
  background: white;
  border-radius: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
}

.card-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.card-header p {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
}

/* ===== DEMO CREDENTIALS ===== */
.demo-credentials {
  margin: 1.5rem 2rem 0;
  padding: 1rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.demo-icon {
  width: 40px;
  height: 40px;
  background: #d1fae5;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.demo-icon i {
  font-size: 1.125rem;
  color: #059669;
}

.demo-content {
  flex: 1;
}

.demo-content strong {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #065f46;
  margin-bottom: 0.5rem;
}

.credentials-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.credentials-list span {
  font-size: 0.875rem;
  color: #047857;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Monaco', 'Menlo', monospace;
}

.credentials-list span i {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* ===== LOGIN FORM ===== */
.login-form {
  padding: 1.5rem 2rem 2rem;
}

.field {
  margin-bottom: 1.25rem;
}

.field label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
}

.field label i {
  font-size: 0.875rem;
  color: #059669;
}

.input-field {
  width: 100%;
}

.input-field :deep(input),
.input-field:not(.p-password) {
  width: 100%;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.input-field :deep(input):hover,
.input-field:not(.p-password):hover {
  border-color: #cbd5e1;
  background: white;
}

.input-field :deep(input):focus,
.input-field:not(.p-password):focus {
  border-color: #059669;
  background: white;
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.1);
  outline: none;
}

.input-field :deep(input)::placeholder {
  color: #94a3b8;
}

/* Password field */
:deep(.p-password) {
  width: 100%;
}

:deep(.p-password-input) {
  width: 100%;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  background: #f8fafc;
  transition: all 0.2s ease;
}

:deep(.p-password-input):hover {
  border-color: #cbd5e1;
  background: white;
}

:deep(.p-password-input):focus {
  border-color: #059669;
  background: white;
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.1);
  outline: none;
}

:deep(.p-password .p-password-toggle-icon) {
  color: #94a3b8;
  transition: color 0.2s ease;
}

:deep(.p-password .p-password-toggle-icon):hover {
  color: #059669;
}

/* Form Options */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #64748b;
}

.remember-me input {
  width: 16px;
  height: 16px;
  accent-color: #059669;
}

.forgot-password {
  font-size: 0.875rem;
  color: #059669;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.forgot-password:hover {
  color: #047857;
  text-decoration: underline;
}

/* ===== LOGIN BUTTON ===== */
.login-button {
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.login-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -5px rgba(5, 150, 105, 0.4);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ===== CARD FOOTER ===== */
.card-footer {
  padding: 1rem 2rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  text-align: center;
}

.card-footer p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.card-footer a {
  color: #059669;
  text-decoration: none;
  font-weight: 500;
}

.card-footer a:hover {
  text-decoration: underline;
}

/* ===== RESPONSIVE - TABLET ===== */
@media (max-width: 1024px) {
  .info-panel {
    flex: 1;
    padding: 2rem;
  }

  .form-panel {
    flex: 0 0 420px;
    padding: 2rem;
  }

  .features {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .brand h1 {
    font-size: 2rem;
  }
}

/* ===== RESPONSIVE - MOBILE ===== */
@media (max-width: 768px) {
  .login-page {
    flex-direction: column;
  }

  .info-panel {
    display: none;
  }

  .form-panel {
    flex: 1;
    min-height: 100vh;
    padding: 2rem 1.5rem;
    align-items: flex-start;
    padding-top: 3rem;
  }

  .form-container {
    max-width: 100%;
  }

  .mobile-brand {
    display: block;
  }

  .login-card {
    border-radius: 16px;
  }

  .card-header {
    padding: 1.5rem 1.5rem 1rem;
  }

  .card-header h2 {
    font-size: 1.5rem;
  }

  .demo-credentials {
    margin: 1rem 1.5rem 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  .demo-icon {
    width: 36px;
    height: 36px;
  }

  .login-form {
    padding: 1rem 1.5rem 1.5rem;
  }

  .form-options {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .card-footer {
    padding: 0.75rem 1.5rem;
  }
}

/* ===== REDUCED MOTION ===== */
@media (prefers-reduced-motion: reduce) {
  .login-button:hover {
    transform: none;
  }
}
</style>
