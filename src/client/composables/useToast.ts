import { ref } from 'vue';

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

interface ToastMessage {
  id: number;
  severity: ToastSeverity;
  summary: string;
  detail?: string;
  life?: number;
}

// Singleton per toast globali
const toasts = ref<ToastMessage[]>([]);
let toastId = 0;

export function useToast() {
  function show(
    severity: ToastSeverity,
    summary: string,
    detail?: string,
    life: number = 3000
  ) {
    const id = ++toastId;
    const toast: ToastMessage = {
      id,
      severity,
      summary,
      detail,
      life,
    };

    toasts.value.push(toast);

    // Auto-remove dopo life ms
    if (life > 0) {
      setTimeout(() => {
        remove(id);
      }, life);
    }

    return id;
  }

  function success(summary: string, detail?: string) {
    return show('success', summary, detail);
  }

  function info(summary: string, detail?: string) {
    return show('info', summary, detail);
  }

  function warn(summary: string, detail?: string) {
    return show('warn', summary, detail);
  }

  function error(summary: string, detail?: string) {
    return show('error', summary, detail, 5000); // Errori durano di più
  }

  function remove(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  function clear() {
    toasts.value = [];
  }

  // Helper per errori API
  function apiError(err: any) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      'Si è verificato un errore';
    return error('Errore', message);
  }

  // Helper per operazioni CRUD
  function created(entity: string) {
    return success('Creato', `${entity} creato con successo`);
  }

  function updated(entity: string) {
    return success('Aggiornato', `${entity} aggiornato con successo`);
  }

  function deleted(entity: string) {
    return success('Eliminato', `${entity} eliminato con successo`);
  }

  function saved(entity: string) {
    return success('Salvato', `${entity} salvato con successo`);
  }

  return {
    toasts,
    show,
    success,
    info,
    warn,
    error,
    remove,
    clear,
    apiError,
    created,
    updated,
    deleted,
    saved,
  };
}

// Componente Toast per il layout
export const ToastContainer = {
  template: `
    <div class="toast-container">
      <transition-group name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', 'toast-' + toast.severity]"
          @click="remove(toast.id)"
        >
          <div class="toast-icon">
            <i :class="getIcon(toast.severity)"></i>
          </div>
          <div class="toast-content">
            <div class="toast-summary">{{ toast.summary }}</div>
            <div v-if="toast.detail" class="toast-detail">{{ toast.detail }}</div>
          </div>
          <button class="toast-close" @click.stop="remove(toast.id)">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </transition-group>
    </div>
  `,
  setup() {
    const { toasts, remove } = useToast();

    const getIcon = (severity: ToastSeverity) => {
      const icons = {
        success: 'pi pi-check-circle',
        info: 'pi pi-info-circle',
        warn: 'pi pi-exclamation-triangle',
        error: 'pi pi-times-circle',
      };
      return icons[severity];
    };

    return { toasts, remove, getIcon };
  },
};
