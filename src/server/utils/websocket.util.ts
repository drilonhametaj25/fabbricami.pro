// Imports
import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import logger from '../config/logger';
import { prisma } from '../config/database';
import { runWithTenant } from './tenant-context';

// Types/Interfaces
interface SocketConnection {
  socket: WebSocket;
}

interface WebSocketClient {
  id: string;
  userId: string;
  tenantId: string;
  socket: SocketConnection;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

/**
 * WebSocket Handler
 * Real-time updates scoped per tenant. Ogni client è associato al tenantId
 * derivato dal JWT al momento della connessione. Broadcast e sendToClient
 * filtrano per tenantId — un client non riceve mai messaggi di altri tenant.
 */

const clients = new Map<string, WebSocketClient>();

/**
 * Broadcast a tutti i client del tenant specificato.
 * tenantId è OBBLIGATORIO: usare broadcastGlobal() per messaggi di sistema.
 */
export function broadcast(tenantId: string, message: WebSocketMessage) {
  if (!tenantId) {
    throw new Error('[ws] broadcast() richiede tenantId. Usa broadcastGlobal() per messaggi di sistema.');
  }
  const messageStr = JSON.stringify(message);
  let count = 0;
  clients.forEach((client) => {
    if (client.tenantId !== tenantId) return;
    try {
      client.socket.socket.send(messageStr);
      count++;
    } catch (error) {
      logger.error(`Failed to send message to client ${client.id}: ${error}`);
    }
  });
  logger.debug(`Broadcasted ${message.type} to ${count} clients of tenant ${tenantId}`);
}

/**
 * Broadcast cross-tenant (system-wide). Usare con cautela — solo per
 * messaggi che TUTTI gli utenti devono ricevere (es. manutenzione globale).
 */
export function broadcastGlobal(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    try {
      client.socket.socket.send(messageStr);
    } catch (error) {
      logger.error(`Failed to send message to client ${client.id}: ${error}`);
    }
  });
  logger.debug(`Broadcasted GLOBAL ${message.type} to ${clients.size} clients`);
}

/**
 * Invia messaggio a un utente specifico (filtrato per tenantId per
 * impedire cross-tenant impersonation se due tenant condividono userId).
 */
export function sendToClient(tenantId: string, userId: string, message: WebSocketMessage) {
  const client = Array.from(clients.values()).find((c) => c.userId === userId && c.tenantId === tenantId);
  if (client) {
    try {
      client.socket.socket.send(JSON.stringify(message));
      logger.debug(`Sent ${message.type} to user ${userId} (tenant ${tenantId})`);
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}: ${error}`);
    }
  }
}

/**
 * Gestisce scanner barcode (tenant-scoped via runWithTenant)
 */
async function handleBarcodeScanned(data: any, client: WebSocketClient) {
  const { barcode, action } = data;
  logger.info(`Barcode scanned: ${barcode} - Action: ${action} - Tenant: ${client.tenantId}`);

  await runWithTenant(client.tenantId, async () => {
    try {
      const product = await prisma.product.findFirst({
        where: { barcode },
        include: { inventory: true },
      });

      if (!product) {
        sendToClient(client.tenantId, client.userId, {
          type: 'barcode-error',
          data: { error: 'Prodotto non trovato', barcode },
        });
        return;
      }

      sendToClient(client.tenantId, client.userId, {
        type: 'barcode-success',
        data: { product, action },
      });
    } catch (error: any) {
      logger.error(`Barcode scan error: ${error.message}`);
      sendToClient(client.tenantId, client.userId, {
        type: 'barcode-error',
        data: { error: error.message, barcode },
      });
    }
  });
}

/**
 * Gestisce aggiornamento giacenze real-time (broadcast scoped al tenant del client)
 */
async function handleInventoryUpdate(data: any, client: WebSocketClient) {
  const { productId, warehouseId, location, quantity } = data;
  logger.info(`Inventory update: Product ${productId} in ${location} (tenant ${client.tenantId})`);
  broadcast(client.tenantId, {
    type: 'inventory-updated',
    data: { productId, warehouseId, location, quantity },
  });
}

/**
 * Notifica real-time a un utente specifico (scoped al tenant del client mittente)
 */
function handleNotification(data: any, client: WebSocketClient) {
  const { userId, notification } = data;
  logger.info(`Sending notification to user ${userId} (tenant ${client.tenantId})`);
  sendToClient(client.tenantId, userId, {
    type: 'notification',
    data: notification,
  });
}

/**
 * Gestisce aggiornamento dashboard real-time (broadcast scoped al tenant del client)
 */
function handleDashboardUpdate(data: any, client: WebSocketClient) {
  logger.info(`Broadcasting dashboard update (tenant ${client.tenantId})`);
  broadcast(client.tenantId, {
    type: 'dashboard-update',
    data,
  });
}

/**
 * Inizializza WebSocket routes.
 *
 * Auth: il browser non puo' settare header custom su `new WebSocket(url)`.
 * Estraiamo il JWT da query string `?token=...` (es. da `?token=${authStore.token}`).
 * In alternativa accettiamo il token via Sec-WebSocket-Protocol (compat con piu' setup).
 * Token invalido o mancante → close con 4401. tenantId mancante nel JWT → close 4401.
 */
export function initWebSocket(server: FastifyInstance) {
  (server.get as any)('/ws', { websocket: true }, async (socket: SocketConnection, request: FastifyRequest): Promise<void> => {
    const clientId = Math.random().toString(36).substring(7);

    // 1. Estrai token: query ?token=... oppure Sec-WebSocket-Protocol header
    const url = new URL(request.url || '/', 'http://placeholder');
    const queryToken = url.searchParams.get('token');
    const protocolHeader = request.headers['sec-websocket-protocol'] as string | undefined;
    const protocolToken =
      typeof protocolHeader === 'string'
        ? protocolHeader.split(',').map((s) => s.trim()).find((p) => p.startsWith('Bearer.'))?.slice(7)
        : undefined;
    const token = queryToken || protocolToken;

    if (!token) {
      logger.warn(`WS reject ${clientId}: no token provided`);
      try {
        socket.socket.close(4401, 'Missing auth token');
      } catch {
        // ignore
      }
      return;
    }

    // 2. Verifica JWT
    let userId: string;
    let tenantId: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
      const { config } = await import('../config/environment');
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId?: string;
        id?: string;
        tenantId?: string;
      };
      userId = decoded.userId || decoded.id || '';
      if (!userId) throw new Error('Invalid token payload (no userId)');
      if (!decoded.tenantId) throw new Error('Invalid token payload (no tenantId)');
      tenantId = decoded.tenantId;
    } catch (err: any) {
      logger.warn(`WS reject ${clientId}: invalid token - ${err.message}`);
      try {
        socket.socket.close(4401, 'Invalid auth token');
      } catch {
        // ignore
      }
      return;
    }

    logger.info(`WebSocket client connected: ${clientId} (User: ${userId}, Tenant: ${tenantId})`);

    const client: WebSocketClient = {
      id: clientId,
      userId,
      tenantId,
      socket,
    };

    clients.set(clientId, client);

    socket.socket.send(
      JSON.stringify({
        type: 'connected',
        data: { clientId, userId },
      })
    );

    socket.socket.on('message', async (messageBuffer: Buffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString()) as WebSocketMessage;

        logger.debug(`WebSocket message from ${clientId}: ${message.type}`);

        switch (message.type) {
          case 'barcode-scan':
            await handleBarcodeScanned(message.data, client);
            break;

          case 'inventory-update':
            await handleInventoryUpdate(message.data, client);
            break;

          case 'notification':
            handleNotification(message.data, client);
            break;

          case 'dashboard-update':
            handleDashboardUpdate(message.data, client);
            break;

          case 'ping':
            socket.socket.send(JSON.stringify({ type: 'pong', data: {} }));
            break;

          default:
            logger.warn(`Unknown WebSocket message type: ${message.type}`);
        }
      } catch (error: any) {
        logger.error(`WebSocket message error: ${error.message}`);
      }
    });

    socket.socket.on('close', () => {
      clients.delete(clientId);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    socket.socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
      clients.delete(clientId);
    });
  });

  logger.info('WebSocket initialized on /ws endpoint');
}

/**
 * Ottieni statistiche connessioni (cross-tenant: solo super-admin dovrebbe leggere)
 */
export function getStats() {
  return {
    totalClients: clients.size,
    clients: Array.from(clients.values()).map((c) => ({
      id: c.id,
      userId: c.userId,
      tenantId: c.tenantId,
    })),
  };
}
