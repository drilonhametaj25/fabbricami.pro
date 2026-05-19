import { FastifyRequest, FastifyReply } from 'fastify';
import wordpressPluginService from '../services/wordpress-plugin.service';
import { prisma } from '../config/database';
import wordpressSettingsService from '../services/wordpress-settings.service';

/**
 * Middleware per autenticazione Basic Auth dal plugin WordPress (multi-tenant).
 *
 * Il plugin DEVE indirizzare le sue chiamate a route con `:tenantSlug`
 * (es. `/api/v1/wordpress/plugin/:tenantSlug/order`). Il middleware:
 *   1. risolve `tenantSlug` → `tenantId` via DB
 *   2. valida le credenziali Basic Auth contro (tenantId, username)
 *   3. attacca `request.wordpressPlugin = { username, tenantId, credentialId }`
 *
 * Senza `tenantSlug` valido nell'URL → 404 (auth rifiutata): non c'è modo
 * sicuro di disambiguare username uguali tra tenant diversi.
 */
export const authenticateWordPressPlugin = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    // 1) Risolvi tenantSlug dall'URL
    const params = (request.params as Record<string, string>) || {};
    const tenantSlug = params.tenantSlug;
    if (!tenantSlug) {
      reply.status(404).send({
        success: false,
        error: 'Tenant slug mancante nella route. Atteso /plugin/:tenantSlug/...',
        code: 'MISSING_TENANT_SLUG',
      });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      // 404 e non 401, per non rivelare se il tenant esiste/è sospeso/cancellato
      reply.status(404).send({
        success: false,
        error: 'Tenant non trovato',
        code: 'TENANT_NOT_FOUND',
      });
      return;
    }

    // 2) Estrai Basic Auth
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.status(401).send({
        success: false,
        error: 'Authorization header mancante',
        code: 'MISSING_AUTH_HEADER',
      });
      return;
    }
    if (!authHeader.startsWith('Basic ')) {
      reply.status(401).send({
        success: false,
        error: 'Formato autenticazione non valido. Usa Basic Auth.',
        code: 'INVALID_AUTH_FORMAT',
      });
      return;
    }

    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (!username || !password) {
      reply.status(401).send({
        success: false,
        error: 'Credenziali non valide',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // 3) Valida contro (tenantId, username)
    const result = await wordpressPluginService.validateCredentials(tenant.id, username, password);
    if (!result.valid) {
      reply.status(401).send({
        success: false,
        error: 'Credenziali non valide o disattivate',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // 4) Attacca info alla request per gli handler downstream
    (request as any).wordpressPlugin = {
      username,
      tenantId: tenant.id,
      tenantSlug,
      credentialId: result.credentialId,
      authenticatedAt: new Date(),
    };
  } catch (error: any) {
    console.error('WordPress Plugin Auth Error:', error);
    reply.status(500).send({
      success: false,
      error: 'Errore interno di autenticazione',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Middleware opzionale per logging delle richieste dal plugin
 */
export const logWordPressPluginRequest = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const pluginInfo = (request as unknown as Record<string, unknown>).wordpressPlugin as
    | { username: string; tenantSlug?: string }
    | undefined;

  if (pluginInfo) {
    console.log(
      `[WordPress Plugin] Request from tenant=${pluginInfo.tenantSlug || '?'} user=${pluginInfo.username}: ${request.method} ${request.url}`
    );
  }
};

/**
 * Hook per aggiungere header CORS per il plugin WordPress.
 *
 * Multi-tenant: leggiamo l'URL WP del tenant corrente (settato dal middleware
 * di auth qua sopra) per validare l'origin invece di un valore globale.
 */
export const addWordPressPluginCorsHeaders = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const requestOrigin = request.headers.origin;
  const pluginInfo = (request as unknown as Record<string, unknown>).wordpressPlugin as
    | { tenantId: string }
    | undefined;

  let allowedOrigin = '';

  if (pluginInfo?.tenantId) {
    // Origin di questo tenant (dal DB)
    const cfg = await wordpressSettingsService.getSettings(pluginInfo.tenantId).catch(() => null);
    if (cfg?.url && requestOrigin?.startsWith(cfg.url)) {
      allowedOrigin = requestOrigin;
    } else if (cfg?.url) {
      allowedOrigin = cfg.url;
    }
  }

  // In development consenti localhost anche senza tenant risolto
  if (!allowedOrigin && process.env.NODE_ENV !== 'production' && requestOrigin) {
    if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
      allowedOrigin = requestOrigin;
    }
  }

  if (allowedOrigin) {
    reply.header('Access-Control-Allow-Origin', allowedOrigin);
  }
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-FabbricaMi.pro-API-Key');
  reply.header('Access-Control-Allow-Credentials', 'true');
};

export default {
  authenticateWordPressPlugin,
  logWordPressPluginRequest,
  addWordPressPluginCorsHeaders,
};
