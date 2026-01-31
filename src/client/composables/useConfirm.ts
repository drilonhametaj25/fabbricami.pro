import { ref } from 'vue';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClass?: string;
  icon?: string;
  severity?: 'info' | 'warn' | 'danger';
}

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmClass: string;
  icon: string;
  resolve: ((value: boolean) => void) | null;
}

// Stato globale del dialog di conferma
const state = ref<ConfirmState>({
  visible: false,
  title: 'Conferma',
  message: '',
  confirmLabel: 'Conferma',
  cancelLabel: 'Annulla',
  confirmClass: 'p-button-primary',
  icon: 'pi pi-question-circle',
  resolve: null,
});

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const severity = options.severity || 'info';
      const severityClasses = {
        info: 'p-button-primary',
        warn: 'p-button-warning',
        danger: 'p-button-danger',
      };
      const severityIcons = {
        info: 'pi pi-question-circle',
        warn: 'pi pi-exclamation-triangle',
        danger: 'pi pi-exclamation-circle',
      };

      state.value = {
        visible: true,
        title: options.title || 'Conferma',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Conferma',
        cancelLabel: options.cancelLabel || 'Annulla',
        confirmClass: options.confirmClass || severityClasses[severity],
        icon: options.icon || severityIcons[severity],
        resolve,
      };
    });
  }

  function onConfirm() {
    if (state.value.resolve) {
      state.value.resolve(true);
    }
    state.value.visible = false;
    state.value.resolve = null;
  }

  function onCancel() {
    if (state.value.resolve) {
      state.value.resolve(false);
    }
    state.value.visible = false;
    state.value.resolve = null;
  }

  // Shortcut per eliminazione
  function confirmDelete(entityName: string): Promise<boolean> {
    return confirm({
      title: 'Conferma Eliminazione',
      message: `Sei sicuro di voler eliminare ${entityName}? Questa azione non può essere annullata.`,
      confirmLabel: 'Elimina',
      severity: 'danger',
    });
  }

  // Shortcut per azioni generiche
  function confirmAction(action: string, details?: string): Promise<boolean> {
    return confirm({
      title: 'Conferma Azione',
      message: details || `Sei sicuro di voler ${action}?`,
      confirmLabel: 'Procedi',
      severity: 'warn',
    });
  }

  // Shortcut per salvataggio con modifiche non salvate
  function confirmDiscard(): Promise<boolean> {
    return confirm({
      title: 'Modifiche Non Salvate',
      message:
        'Ci sono modifiche non salvate. Vuoi davvero uscire senza salvare?',
      confirmLabel: 'Esci senza salvare',
      cancelLabel: 'Rimani',
      severity: 'warn',
    });
  }

  return {
    state,
    confirm,
    onConfirm,
    onCancel,
    confirmDelete,
    confirmAction,
    confirmDiscard,
  };
}

// Componente ConfirmDialog per il layout
export const ConfirmDialog = {
  template: `
    <Dialog
      v-model:visible="state.visible"
      :header="state.title"
      :modal="true"
      :closable="true"
      :style="{ width: '400px' }"
      @hide="onCancel"
    >
      <div class="confirm-content">
        <i :class="[state.icon, 'confirm-icon']"></i>
        <p class="confirm-message">{{ state.message }}</p>
      </div>
      <template #footer>
        <Button
          :label="state.cancelLabel"
          icon="pi pi-times"
          class="p-button-text"
          @click="onCancel"
        />
        <Button
          :label="state.confirmLabel"
          icon="pi pi-check"
          :class="state.confirmClass"
          @click="onConfirm"
          autofocus
        />
      </template>
    </Dialog>
  `,
  components: {
    // Dialog e Button di PrimeVue vanno importati nel componente padre
  },
  setup() {
    const { state, onConfirm, onCancel } = useConfirm();
    return { state, onConfirm, onCancel };
  },
};
