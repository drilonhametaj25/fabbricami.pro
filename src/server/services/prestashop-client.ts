import { logger } from '../config/logger';

/**
 * Client per il Webservice di PrestaShop 8.x (compatibile 1.7.x).
 *
 * - Base URL: `{apiUrl}/api`
 * - Auth: HTTP Basic, username = Webservice API key, password vuota.
 * - Lettura: `?output_format=JSON` → risposte JSON.
 * - Scrittura: PrestaShop richiede XML in input → costruiamo `<prestashop>…`.
 *
 * PrestaShop NON ha webhook nativi: l'import ordini/clienti è pull (polling),
 * gestito dal service/job. Questo client espone solo le primitive HTTP.
 */
export interface PrestaShopClientConfig {
  apiUrl: string; // senza /api e senza trailing slash
  apiKey: string;
  // Iniettabile nei test per non colpire la rete.
  fetchImpl?: typeof fetch;
}

export interface ListParams {
  display?: 'full' | string[]; // 'full' o lista di campi
  filters?: Record<string, string | number>;
  limit?: number;
  sort?: string; // es. 'id_DESC'
}

export class PrestaShopClient {
  private base: string;
  private authHeader: string;
  private fetchImpl: typeof fetch;

  constructor(cfg: PrestaShopClientConfig) {
    this.base = cfg.apiUrl.replace(/\/+$/, '') + '/api';
    // Basic auth: "apiKey:" (password vuota) → base64
    this.authHeader = 'Basic ' + Buffer.from(`${cfg.apiKey}:`).toString('base64');
    this.fetchImpl = cfg.fetchImpl || fetch;
  }

  private buildUrl(resource: string, params?: ListParams & { id?: number }): string {
    const url = new URL(`${this.base}/${resource}${params?.id ? '/' + params.id : ''}`);
    url.searchParams.set('output_format', 'JSON');
    if (params?.display) {
      url.searchParams.set('display', Array.isArray(params.display) ? `[${params.display.join(',')}]` : params.display);
    }
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.sort) url.searchParams.set('sort', `[${params.sort}]`);
    if (params?.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        url.searchParams.set(`filter[${k}]`, String(v));
      }
    }
    return url.toString();
  }

  private async request(method: string, url: string, body?: string): Promise<any> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        ...(body ? { 'Content-Type': 'text/xml' } : {}),
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      logger.warn(`PrestaShop ${method} ${url} → ${res.status}: ${text.slice(0, 200)}`);
      throw new Error(`PrestaShop API ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text; // alcune risposte (es. write) sono XML
    }
  }

  /** Verifica connessione: GET /api → 200 con auth valida. */
  async testConnection(): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const url = new URL(this.base);
      url.searchParams.set('output_format', 'JSON');
      const res = await this.fetchImpl(url.toString(), { headers: { Authorization: this.authHeader } });
      if (res.ok) return { ok: true, status: res.status };
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Lista una risorsa. Ritorna sempre un array (anche se vuoto). */
  async list(resource: string, params?: ListParams): Promise<any[]> {
    const data = await this.request('GET', this.buildUrl(resource, params));
    if (!data) return [];
    // PrestaShop JSON: { products: [...] } | { orders: [...] } ecc.
    const key = Object.keys(data)[0];
    const val = key ? data[key] : null;
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return [val];
    return [];
  }

  /** Recupera una risorsa per id. Ritorna l'oggetto interno (unwrapped). */
  async getOne(resource: string, id: number): Promise<any | null> {
    const data = await this.request('GET', this.buildUrl(resource, { id }));
    if (!data) return null;
    const key = Object.keys(data)[0];
    return key ? data[key] : data;
  }

  async create(resource: string, payload: Record<string, any>): Promise<any> {
    const xml = buildPrestaXml(resource, payload);
    return this.request('POST', this.buildUrl(resource), xml);
  }

  async update(resource: string, id: number, payload: Record<string, any>): Promise<any> {
    const xml = buildPrestaXml(resource, { id, ...payload });
    return this.request('PUT', this.buildUrl(resource, { id }), xml);
  }
}

/** Escape minimale per i valori XML. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Costruisce il body XML PrestaShop: `<prestashop><{resourceSingular}>…`.
 * Supporta valori scalari e, per i campi multilingua (name/description), il
 * wrapping `<language id="1">`. Le chiavi con valore oggetto/array sono
 * serializzate ricorsivamente (es. associations).
 */
export function buildPrestaXml(resource: string, obj: Record<string, any>): string {
  const singular = SINGULAR[resource] || resource.replace(/s$/, '');
  const lang = (val: unknown) => `<language id="1"><![CDATA[${esc(val)}]]></language>`;
  const MULTILANG = new Set(['name', 'description', 'description_short', 'link_rewrite', 'meta_title']);

  const fields = Object.entries(obj)
    .map(([k, v]) => {
      if (v === undefined || v === null) return '';
      if (MULTILANG.has(k)) return `<${k}>${lang(v)}</${k}>`;
      if (typeof v === 'object') return `<${k}>${serializeObj(v)}</${k}>`;
      return `<${k}><![CDATA[${esc(v)}]]></${k}>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<${singular}>${fields}</${singular}>\n</prestashop>`;
}

function serializeObj(v: any): string {
  if (Array.isArray(v)) return v.map((x) => serializeObj(x)).join('');
  if (v && typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `<${k}>${typeof val === 'object' ? serializeObj(val) : `<![CDATA[${esc(val)}]]>`}</${k}>`)
      .join('');
  }
  return `<![CDATA[${esc(v)}]]>`;
}

const SINGULAR: Record<string, string> = {
  products: 'product',
  categories: 'category',
  orders: 'order',
  customers: 'customer',
  stock_availables: 'stock_available',
  addresses: 'address',
};
