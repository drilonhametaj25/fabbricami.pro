import ToastEventBus from 'primevue/toasteventbus';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Identifica la risposta del backend `requirePlanLimit` (subscription.middleware.ts):
 *  HTTP 403 + error === 'Plan limit reached' (oppure code === 'PLAN_LIMIT_REACHED'
 *  per compatibilita' futura). Quando il middleware aggiunge un `code` esplicito
 *  lo riconosciamo subito.
 */
function isPlanLimitResponse(status: number, result: any): boolean {
  if (status !== 403 || !result) return false;
  if (result.code === 'PLAN_LIMIT_REACHED') return true;
  return typeof result.error === 'string' && result.error.toLowerCase().includes('plan limit');
}

class ApiService {
  private async request(method: string, endpoint: string, data?: any, responseType?: 'json' | 'blob'): Promise<any> {
    const token = localStorage.getItem('token');

    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (data) {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(data);
    } else if (method === 'POST' || method === 'PATCH') {
      // Se non c'è data ma è POST/PATCH, non impostare Content-Type
      // per evitare errore "Body cannot be empty"
    }

    const response = await fetch(`${API_URL}/api/v1${endpoint}`, config);

    if (responseType === 'blob') {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
      }
      return response.blob();
    }

    const result = await response.json();

    if (!response.ok) {
      // Token scaduto - prova refresh
      if (response.status === 401 && token) {
        const refreshed = await this.attemptTokenRefresh();
        if (refreshed) {
          // Riprova la richiesta con il nuovo token
          return this.request(method, endpoint, data, responseType);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          throw new Error('Sessione scaduta, effettua nuovamente il login');
        }
      }

      // HTTP 403 Plan limit reached — il middleware `requirePlanLimit`
      // ha bloccato la creazione perche' il tenant ha superato il limite
      // del piano (es. > maxWarehouses). Mostriamo un toast specifico e
      // poi rilanciamo l'errore in modo che il chiamante possa comunque
      // gestirlo (es. mostrare un banner aggiuntivo).
      if (isPlanLimitResponse(response.status, result)) {
        ToastEventBus.emit('add', {
          severity: 'warn',
          summary: 'Limite raggiunto',
          detail: result.message || result.error || 'Hai raggiunto il limite del tuo piano. Esegui l\'upgrade per continuare.',
          life: 6000,
        });
        throw new Error(result.message || result.error || 'Plan limit reached');
      }

      // HTTP 402 Payment Required — il subscription gate ha bloccato la route
      // perche' trial scaduto / piano cancellato / pagamento non riuscito.
      // Redirect automatico alla pagina billing dove l'utente puo' pagare.
      if (response.status === 402) {
        const code = result?.code || '';
        // Eviita loop se siamo gia' su /settings/billing
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/settings/billing') &&
          !window.location.pathname.startsWith('/onboarding')
        ) {
          // Salva motivo per mostrarlo come banner sulla pagina billing
          sessionStorage.setItem('billing_redirect_reason', code || 'PAYMENT_REQUIRED');
          sessionStorage.setItem('billing_redirect_message', result?.message || '');
          window.location.href = '/settings/billing?upgrade=1&reason=' + encodeURIComponent(code);
        }
        throw new Error(result.message || result.error || 'Sottoscrizione richiesta');
      }

      throw new Error(result.error || 'Request failed');
    }

    return result;
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('token', data.data.token);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async get<T = any>(endpoint: string, options?: { params?: Record<string, any>; responseType?: 'json' | 'blob' }): Promise<T> {
    let url = endpoint;
    if (options?.params) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    return this.request('GET', url, undefined, options?.responseType) as Promise<T>;
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request('POST', endpoint, data) as Promise<T>;
  }

  async patch<T = any>(endpoint: string, data: any): Promise<T> {
    return this.request('PATCH', endpoint, data) as Promise<T>;
  }

  async put<T = any>(endpoint: string, data: any): Promise<T> {
    return this.request('PUT', endpoint, data) as Promise<T>;
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request('DELETE', endpoint) as Promise<T>;
  }
}

const apiService = new ApiService();
export { apiService };
export default apiService;
