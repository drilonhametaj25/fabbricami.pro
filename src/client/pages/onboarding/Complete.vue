<template>
  <div class="complete-step">
    <div class="success-animation">
      <div class="checkmark-circle">
        <i class="pi pi-check"></i>
      </div>
    </div>

    <h1 class="step-title">Configurazione Completata!</h1>

    <p class="step-description">
      La tua azienda è pronta per iniziare. Ecco cosa puoi fare ora:
    </p>

    <div class="next-steps">
      <div class="next-step-card" @click="goTo('/products')">
        <div class="step-card-icon">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="step-card-content">
          <h4>Aggiungi Prodotti</h4>
          <p>Crea il tuo catalogo prodotti e inizia a gestire l'inventario</p>
        </div>
        <i class="pi pi-arrow-right"></i>
      </div>

      <div class="next-step-card" @click="goTo('/customers')">
        <div class="step-card-icon">
          <i class="pi pi-users"></i>
        </div>
        <div class="step-card-content">
          <h4>Importa Clienti</h4>
          <p>Aggiungi i tuoi clienti e inizia a gestire gli ordini</p>
        </div>
        <i class="pi pi-arrow-right"></i>
      </div>

      <div class="next-step-card" @click="goTo('/suppliers')">
        <div class="step-card-icon">
          <i class="pi pi-truck"></i>
        </div>
        <div class="step-card-content">
          <h4>Configura Fornitori</h4>
          <p>Aggiungi i tuoi fornitori per gestire gli acquisti</p>
        </div>
        <i class="pi pi-arrow-right"></i>
      </div>

      <div class="next-step-card" @click="goTo('/settings/team')">
        <div class="step-card-icon">
          <i class="pi pi-user-plus"></i>
        </div>
        <div class="step-card-content">
          <h4>Invita il Team</h4>
          <p>Aggiungi i tuoi collaboratori e assegna i permessi</p>
        </div>
        <i class="pi pi-arrow-right"></i>
      </div>
    </div>

    <div class="cta-section">
      <Button
        label="Vai alla Dashboard"
        icon="pi pi-home"
        size="large"
        @click="goToDashboard"
      />
    </div>

    <div class="help-section">
      <p>
        Hai bisogno di aiuto?
        <a href="#" @click.prevent="openHelp">Consulta la guida</a>
        oppure
        <a href="#" @click.prevent="openSupport">contatta il supporto</a>.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useOnboarding } from '../../composables/useOnboarding';

const router = useRouter();
const _toast = useToast();
const { completeOnboarding } = useOnboarding();

function goTo(path: string) {
  router.push(path);
}

function goToDashboard() {
  router.push('/');
}

function openHelp() {
  // Open help documentation in new tab
  window.open('/docs', '_blank');
}

function openSupport() {
  // Open support email
  const supportEmail = 'support@ecommerceerp.com';
  const subject = encodeURIComponent('Richiesta di supporto - EcommerceERP');
  const body = encodeURIComponent(`Ciao,

Ho bisogno di assistenza con EcommerceERP.

Descrizione del problema:



Grazie!`);

  window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

onMounted(async () => {
  // Mark onboarding as complete
  await completeOnboarding();
});
</script>

<style scoped>
.complete-step {
  text-align: center;
}

/* Success Animation */
.success-animation {
  margin-bottom: var(--space-6);
}

.checkmark-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: var(--color-green-500);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  animation: scaleIn 0.5s ease-out;
}

.checkmark-circle i {
  font-size: 3rem;
  color: white;
  animation: checkIn 0.3s ease-out 0.2s both;
}

@keyframes scaleIn {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes checkIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
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
  margin: 0 0 var(--space-8) 0;
}

/* Next Steps */
.next-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.next-step-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.next-step-card:hover {
  background: white;
  border-color: var(--color-primary-300);
  box-shadow: var(--shadow-md);
}

.step-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-lg);
  background: var(--color-primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-card-icon i {
  font-size: 1.5rem;
  color: var(--color-primary-600);
}

.step-card-content {
  flex: 1;
}

.step-card-content h4 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-1) 0;
}

.step-card-content p {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin: 0;
}

.next-step-card > .pi-arrow-right {
  color: var(--color-gray-400);
  transition: transform 0.2s;
}

.next-step-card:hover > .pi-arrow-right {
  transform: translateX(4px);
  color: var(--color-primary-600);
}

/* CTA */
.cta-section {
  margin-bottom: var(--space-6);
}

/* Help */
.help-section {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.help-section a {
  color: var(--color-primary-600);
  text-decoration: none;
}

.help-section a:hover {
  text-decoration: underline;
}
</style>
