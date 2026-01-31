import { FastifyRequest, FastifyReply } from 'fastify';
import wordpressPluginService from '../services/wordpress-plugin.service';

/**
 * Middleware per autenticazione Basic Auth dal plugin WordPress
 *
 * Verifica le credenziali nell'header Authorization: Basic base64(username:password)
 */
export const authenticateWordPressPlugin = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      reply.status(401).send({
        success: false,
        error: 'Authorization header mancante',
        code: 'MISSING_AUTH_HEADER',
      });
      return;
    }

    // Verifica che sia Basic Auth
    if (!authHeader.startsWith('Basic ')) {
      reply.status(401).send({
        success: false,
        error: 'Formato autenticazione non valido. Usa Basic Auth.',
        code: 'INVALID_AUTH_FORMAT',
      });
      return;
    }

    // Decodifica credenziali
    const base64Credentials = authHeader.slice(6); // Rimuove 'Basic '
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

    // Valida credenziali
    const isValid = await wordpressPluginService.validateCredentials(username, password);

    if (!isValid) {
      reply.status(401).send({
        success: false,
        error: 'Credenziali non valide o disattivate',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Aggiungi info plugin alla request per uso successivo
    (request as any).wordpressPlugin = {
      username,
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
  const pluginInfo = (request as unknown as Record<string, unknown>).wordpressPlugin as { username: string } | undefined;

  if (pluginInfo) {
    console.log(`[WordPress Plugin] Request from ${pluginInfo.username}: ${request.method} ${request.url}`);
  }
};

/**
 * Hook per aggiungere header CORS per il plugin WordPress
 */
export const addWordPressPluginCorsHeaders = async (
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Permetti richieste da qualsiasi origine WordPress
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-EcommerceERP-API-Key');
  reply.header('Access-Control-Allow-Credentials', 'true');
};

export default {
  authenticateWordPressPlugin,
  logWordPressPluginRequest,
  addWordPressPluginCorsHeaders,
};
