const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';

class ApiService {
  private async request(method: string, endpoint: string, data?: any, responseType?: 'json' | 'blob') {
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
      throw new Error(result.error || 'Request failed');
    }

    return result;
  }

  async get(endpoint: string, options?: { params?: Record<string, any>; responseType?: 'json' | 'blob' }) {
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
    return this.request('GET', url, undefined, options?.responseType);
  }

  async post(endpoint: string, data?: any) {
    return this.request('POST', endpoint, data);
  }

  async patch(endpoint: string, data: any) {
    return this.request('PATCH', endpoint, data);
  }

  async put(endpoint: string, data: any) {
    return this.request('PUT', endpoint, data);
  }

  async delete(endpoint: string) {
    return this.request('DELETE', endpoint);
  }
}

const apiService = new ApiService();
export { apiService };
export default apiService;
