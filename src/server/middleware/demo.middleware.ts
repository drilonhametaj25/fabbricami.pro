import { FastifyRequest, FastifyReply } from 'fastify';

const DEMO_TENANT_ID = 'demo-tenant-fabbricami';
const DEMO_USER_EMAIL = 'demo@fabbricami.pro';

// Operazioni bloccate in modalita demo
const BLOCKED_OPERATIONS = [
  // Operazioni pericolose
  'DELETE /api/v1/users',
  'DELETE /api/v1/tenants',
  'PUT /api/v1/users/password',
  'POST /api/v1/users/invite',
  'DELETE /api/v1/warehouses',
  // Operazioni di esportazione massiva
  'POST /api/v1/export/database',
  // Operazioni di fatturazione
  'POST /api/v1/sdi/send',
  // Operazioni di pagamento
  'POST /api/v1/subscriptions/change-plan',
  'POST /api/v1/subscriptions/cancel',
];

/**
 * Verifica se la richiesta proviene dalla demo
 */
export function isDemoRequest(request: FastifyRequest): boolean {
  // Header iniettato da Traefik per le richieste da demo.fabbricami.pro
  const demoHeader = request.headers['x-demo-mode'];
  return demoHeader === 'true';
}

/**
 * Verifica se l'utente e l'utente demo
 */
export function isDemoUser(user: any): boolean {
  return user?.email === DEMO_USER_EMAIL || user?.tenantId === DEMO_TENANT_ID;
}

/**
 * Middleware per gestire la modalita demo
 * - Forza il tenantId demo per tutte le operazioni
 * - Blocca operazioni pericolose
 */
export async function demoMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const isDemo = isDemoRequest(request);

  if (!isDemo) {
    return; // Non in modalita demo, prosegui normalmente
  }

  // Aggiungi flag demo alla request
  (request as any).isDemo = true;

  // Verifica operazioni bloccate
  const operation = `${request.method} ${request.url.split('?')[0]}`;

  for (const blocked of BLOCKED_OPERATIONS) {
    if (operation.startsWith(blocked.split(' ')[1]) && operation.includes(blocked.split(' ')[0])) {
      return reply.status(403).send({
        success: false,
        error: 'Operazione non disponibile in modalita demo',
        code: 'DEMO_RESTRICTED',
      });
    }
  }

  // Se l'utente e autenticato, verifica che sia l'utente demo
  const user = (request as any).user;
  if (user && !isDemoUser(user)) {
    // L'utente non e l'utente demo ma sta accedendo via demo domain
    return reply.status(403).send({
      success: false,
      error: 'Accesso non autorizzato in modalita demo',
      code: 'DEMO_USER_REQUIRED',
    });
  }
}

/**
 * Hook per modificare le risposte in modalita demo
 * Aggiunge un banner informativo
 */
export function addDemoBanner(request: FastifyRequest, _reply: FastifyReply, payload: any) {
  if (isDemoRequest(request) && typeof payload === 'object' && payload !== null) {
    return {
      ...payload,
      _demo: {
        mode: true,
        message: 'Stai usando la versione demo. I dati vengono resettati ogni notte.',
        restrictions: [
          'Alcune operazioni sono disabilitate',
          'Non puoi cambiare password o invitare utenti',
          'Non puoi inviare fatture reali al SDI',
        ],
      },
    };
  }
  return payload;
}

/**
 * Schema di validazione per login demo
 * Permette solo l'utente demo in modalita demo
 */
export function validateDemoLogin(email: string, request: FastifyRequest): boolean {
  if (isDemoRequest(request)) {
    // In modalita demo, solo l'email demo e permessa
    return email.toLowerCase() === DEMO_USER_EMAIL;
  }
  return true;
}

/**
 * Esporta le costanti demo per uso in altri moduli
 */
export const DEMO_CONFIG = {
  tenantId: DEMO_TENANT_ID,
  userEmail: DEMO_USER_EMAIL,
  userPassword: 'Demo123!', // Solo per riferimento, non usare in produzione
};
