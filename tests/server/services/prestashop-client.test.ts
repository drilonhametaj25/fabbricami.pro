import { PrestaShopClient, buildPrestaXml } from '../../../src/server/services/prestashop-client';

/** Mock fetch che registra le chiamate e ritorna risposte canned. */
function makeFetch(responder: (url: string, init?: any) => { ok?: boolean; status?: number; body?: string }) {
  const calls: Array<{ url: string; init?: any }> = [];
  const fn = (async (url: string, init?: any) => {
    calls.push({ url, init });
    const r = responder(url, init) || {};
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => r.body ?? '',
    } as any;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('PrestaShopClient', () => {
  const cfg = (fetchImpl: typeof fetch) => ({ apiUrl: 'https://shop.example.com/', apiKey: 'WSKEY', fetchImpl });

  it('usa Basic auth con la API key come username (password vuota)', async () => {
    const { fn, calls } = makeFetch(() => ({ body: '{}' }));
    const client = new PrestaShopClient(cfg(fn));
    await client.testConnection();
    const auth = calls[0].init.headers.Authorization as string;
    expect(auth.startsWith('Basic ')).toBe(true);
    const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('WSKEY:');
  });

  it('costruisce URL con base /api, output JSON e normalizza trailing slash', async () => {
    const { fn, calls } = makeFetch(() => ({ body: JSON.stringify({ products: [] }) }));
    const client = new PrestaShopClient(cfg(fn));
    await client.list('products', { limit: 5, filters: { active: 1 } });
    const url = calls[0].url;
    expect(url).toContain('https://shop.example.com/api/products');
    expect(url).toContain('output_format=JSON');
    expect(url).toContain('limit=5');
    expect(url).toContain('filter%5Bactive%5D=1'); // filter[active]=1 url-encoded
  });

  it('list() spacchetta la collezione JSON in array', async () => {
    const { fn } = makeFetch(() => ({ body: JSON.stringify({ orders: [{ id: 1 }, { id: 2 }] }) }));
    const client = new PrestaShopClient(cfg(fn));
    const out = await client.list('orders');
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe(1);
  });

  it('list() ritorna [] su risposta vuota', async () => {
    const { fn } = makeFetch(() => ({ body: '' }));
    const client = new PrestaShopClient(cfg(fn));
    expect(await client.list('orders')).toEqual([]);
  });

  it('getOne() spacchetta il singolo oggetto', async () => {
    const { fn } = makeFetch(() => ({ body: JSON.stringify({ product: { id: 7, reference: 'SKU7' } }) }));
    const client = new PrestaShopClient(cfg(fn));
    const p = await client.getOne('products', 7);
    expect(p.reference).toBe('SKU7');
  });

  it('create() invia XML in POST e ritorna il payload', async () => {
    const { fn, calls } = makeFetch(() => ({ body: '<prestashop><product><id>77</id></product></prestashop>' }));
    const client = new PrestaShopClient(cfg(fn));
    await client.create('products', { reference: 'SKU9', price: 10, name: 'Test' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['Content-Type']).toBe('text/xml');
    expect(calls[0].init.body).toContain('<product>');
    expect(calls[0].init.body).toContain('SKU9');
  });

  it('testConnection() ritorna ok:false su HTTP error', async () => {
    const { fn } = makeFetch(() => ({ ok: false, status: 401 }));
    const client = new PrestaShopClient(cfg(fn));
    const r = await client.testConnection();
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it('lancia su risposta non-ok per le richieste dati', async () => {
    const { fn } = makeFetch(() => ({ ok: false, status: 500, body: 'boom' }));
    const client = new PrestaShopClient(cfg(fn));
    await expect(client.list('products')).rejects.toThrow(/500/);
  });
});

describe('buildPrestaXml', () => {
  it('produce XML PrestaShop con campi multilingua e CDATA', () => {
    const xml = buildPrestaXml('products', { reference: 'SKU1', price: 9.9, name: 'Modello & Co', active: 1 });
    expect(xml).toContain('<prestashop');
    expect(xml).toContain('<product>');
    expect(xml).toContain('<reference><![CDATA[SKU1]]></reference>');
    // name è multilingua
    expect(xml).toContain('<name><language id="1"><![CDATA[Modello &amp; Co]]></language></name>');
    expect(xml).toContain('<price><![CDATA[9.9]]></price>');
  });

  it('serializza oggetti annidati (associations)', () => {
    const xml = buildPrestaXml('orders', { associations: { order_rows: [{ product_id: 5, product_quantity: 2 }] } });
    expect(xml).toContain('<associations>');
    expect(xml).toContain('<product_id><![CDATA[5]]></product_id>');
  });
});
