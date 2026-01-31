import { ref } from 'vue';
import { useAuthStore } from '../stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
  };
}

export function useApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const authStore = useAuthStore();

  async function request<T>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    loading.value = true;
    error.value = null;

    const { method = 'GET', body, headers = {} } = options;

    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      if (authStore.token) {
        requestHeaders['Authorization'] = `Bearer ${authStore.token}`;
      }

      const response = await fetch(`${API_URL}/api/v1${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        // Token scaduto - prova refresh
        if (response.status === 401 && authStore.token) {
          const refreshed = await refreshToken();
          if (refreshed) {
            // Riprova la richiesta
            return request<T>(endpoint, options);
          } else {
            authStore.logout();
            throw new Error('Sessione scaduta, effettua nuovamente il login');
          }
        }

        throw new Error(data.error || `Errore ${response.status}`);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: authStore.refreshToken,
        }),
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

  // Metodi helper
  const get = <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' });

  const post = <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'POST', body });

  const put = <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PUT', body });

  const patch = <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PATCH', body });

  const del = <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' });

  return {
    loading,
    error,
    request,
    get,
    post,
    put,
    patch,
    del,
  };
}

// API Service singleton per uso globale
class ApiService {
  private baseUrl = API_URL;

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      headers: await this.getHeaders(),
    });
    return response.json();
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    return response.json();
  }
}

export default new ApiService();
