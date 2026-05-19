<template>
  <div class="setup-billing-step">
    <h1 class="step-title">Configura la Fatturazione</h1>
    <p class="step-description">
      Scegli il tuo piano e configura il metodo di pagamento.
      Puoi iniziare con un periodo di prova gratuito di 14 giorni.
    </p>

    <!-- Plan Selection -->
    <div class="plans-grid">
      <div
        v-for="plan in plans"
        :key="plan.code"
        :class="['plan-card', { selected: selectedPlan === plan.code, popular: plan.popular }]"
        @click="selectedPlan = plan.code"
      >
        <div v-if="plan.popular" class="popular-badge">Consigliato</div>
        <h3 class="plan-name">{{ plan.name }}</h3>
        <div class="plan-price">
          <span class="price-amount">&euro;{{ plan.price }}</span>
          <span class="price-period">/mese</span>
        </div>
        <ul class="plan-features">
          <li v-for="(feature, idx) in plan.features" :key="idx">
            <i class="pi pi-check"></i>
            {{ feature }}
          </li>
        </ul>
        <div class="plan-select-indicator">
          <RadioButton
            :modelValue="selectedPlan"
            :value="plan.code"
            @update:modelValue="selectedPlan = $event"
          />
        </div>
      </div>
    </div>

    <!-- Trial Info -->
    <div class="trial-info">
      <i class="pi pi-info-circle"></i>
      <div>
        <strong>14 giorni di prova gratuita, senza carta</strong>
        <p>Nessun addebito automatico. Al termine dei 14 giorni dovrai aggiungere un metodo di pagamento per continuare ad usare il servizio.</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <Button
        label="Inizia Prova Gratuita"
        icon="pi pi-play"
        :loading="loading"
        @click="startTrial"
      />
      <span class="actions-divider">oppure</span>
      <Button
        label="Configura Pagamento"
        icon="pi pi-credit-card"
        severity="secondary"
        :loading="loading"
        @click="setupPayment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Button from 'primevue/button';
import RadioButton from 'primevue/radiobutton';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';

const _router = useRouter();
const route = useRoute();
const toast = useToast();
const { setupBilling, goToNextStep } = useOnboarding();

// State
const loading = ref(false);
const selectedPlan = ref('PRO');

const plans = [
  {
    code: 'STARTER',
    name: 'Starter',
    price: 29,
    popular: false,
    features: [
      '1 utente',
      '100 prodotti',
      '1 magazzino',
      'Supporto email',
    ],
  },
  {
    code: 'PRO',
    name: 'Pro',
    price: 79,
    popular: true,
    features: [
      '5 utenti',
      '1.000 prodotti',
      '3 magazzini',
      'Integrazione WooCommerce',
      'Supporto prioritario',
    ],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    price: 149,
    popular: false,
    features: [
      'Utenti illimitati',
      'Prodotti illimitati',
      'Magazzini illimitati',
      'API avanzate',
      'Supporto dedicato',
    ],
  },
];

// Check for canceled checkout
if (route.query.canceled === 'true') {
  toast.add({
    severity: 'info',
    summary: 'Pagamento annullato',
    detail: 'Puoi riprovare quando vuoi o iniziare con la prova gratuita',
    life: 5000,
  });
}

async function startTrial() {
  loading.value = true;
  try {
    const result = await setupBilling(true, selectedPlan.value);
    if (result.success) {
      toast.add({
        severity: 'success',
        summary: 'Prova Attivata',
        detail: 'Il tuo periodo di prova di 14 giorni e iniziato!',
        life: 3000,
      });
      goToNextStep();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Impossibile attivare la prova',
        life: 5000,
      });
    }
  } finally {
    loading.value = false;
  }
}

async function setupPayment() {
  loading.value = true;
  try {
    const result = await setupBilling(false, selectedPlan.value, 'monthly');
    if (result.success) {
      if (result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else if (result.fallbackToTrial) {
        // Stripe non configurato - fallback a trial
        toast.add({
          severity: 'info',
          summary: 'Pagamento non disponibile',
          detail: 'Stripe non configurato. Prova gratuita attivata automaticamente.',
          life: 5000,
        });
        goToNextStep();
      }
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Impossibile avviare il checkout',
        life: 5000,
      });
    }
  } finally {
    loading.value = false;
  }
}

</script>

<style scoped>
.setup-billing-step {
  max-width: 100%;
}

.step-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
  text-align: center;
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--color-gray-600);
  margin: 0 0 var(--space-6) 0;
  text-align: center;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.plan-card {
  position: relative;
  background: white;
  border: 2px solid var(--color-gray-200);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: var(--color-primary-300);
}

.plan-card.selected {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.plan-card.popular {
  border-color: var(--color-primary-400);
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary-500);
  color: white;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.plan-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-2) 0;
  text-align: center;
}

.plan-price {
  text-align: center;
  margin-bottom: var(--space-4);
}

.price-amount {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-primary-600);
}

.price-period {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4) 0;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  padding: var(--space-1) 0;
}

.plan-features li i {
  color: var(--color-green-500);
}

.plan-select-indicator {
  display: flex;
  justify-content: center;
}

.trial-info {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--color-blue-50);
  border: 1px solid var(--color-blue-200);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.trial-info i {
  color: var(--color-blue-500);
  font-size: 1.25rem;
  margin-top: 2px;
}

.trial-info strong {
  color: var(--color-blue-700);
  display: block;
  margin-bottom: var(--space-1);
}

.trial-info p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-blue-600);
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.actions-divider {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.skip-option {
  text-align: center;
}

@media (max-width: 768px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
    gap: var(--space-2);
  }

  .actions-divider {
    display: none;
  }
}
</style>
