// Imports
import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import logger from '../config/logger';
import { prisma } from '../config/database';

// Types/Interfaces
interface SocketConnection {
  socket: WebSocket;
}

interface WebSocketClient {
  id: string;
  userId: string;
  socket: SocketConnection;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

/**
 * WebSocket Handler
 * Gestione connessioni WebSocket per real-time updates
 */

const clients = new Map<string, WebSocketClient>();

/**
 * Broadcast messaggio a tutti i client connessi
 */
export function broadcast(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    try {
      client.socket.socket.send(messageStr);
    } catch (error) {
      logger.error(`Failed to send message to client ${client.id}: ${error}`);
    }
  });

  logger.debug(`Broadcasted message to ${clients.size} clients: ${message.type}`);
}

/**
 * Invia messaggio a cliente specifico
 */
export function sendToClient(userId: string, message: WebSocketMessage) {
  const client = Array.from(clients.values()).find((c) => c.userId === userId);

  if (client) {
    try {
      client.socket.socket.send(JSON.stringify(message));
      logger.debug(`Sent message to user ${userId}: ${message.type}`);
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}: ${error}`);
    }
  }
}

/**
 * Gestisce scanner barcode
 */
async function handleBarcodeScanned(data: any, client: WebSocketClient) {
  const { barcode, action } = data;

  logger.info(`Barcode scanned: ${barcode} - Action: ${action}`);

  try {
    // Trova prodotto per barcode (univoco per tenant: middleware aggiunge tenantId)
    const product = await prisma.product.findFirst({
      where: { barcode },
      include: {
        inventory: true,
      },
    });

    if (!product) {
      sendToClient(client.userId, {
        type: 'barcode-error',
        data: { error: 'Prodotto non trovato', barcode },
      });
      return;
    }

    // Invia dati prodotto al client
    sendToClient(client.userId, {
      type: 'barcode-success',
      data: { product, action },
    });
  } catch (error: any) {
    logger.error(`Barcode scan error: ${error.message}`);
    sendToClient(client.userId, {
      type: 'barcode-error',
      data: { error: error.message, barcode },
    });
  }
}

/**
 * Gestisce aggiornamento giacenze real-time
 */
async function handleInventoryUpdate(data: any) {
  const { productId, warehouseId, location, quantity } = data;

  logger.info(`Inventory update: Product ${productId} in ${location}`);

  // Broadcast aggiornamento a tutti i client
  broadcast({
    type: 'inventory-updated',
    data: { productId, warehouseId, location, quantity },
  });
}

/**
 * Gestisce notifica real-time
 */
function handleNotification(data: any) {
  const { userId, notification } = data;

  logger.info(`Sending notification to user ${userId}`);

  sendToClient(userId, {
    type: 'notification',
    data: notification,
  });
}

/**
 * Gestisce aggiornamento dashboard real-time
 */
function handleDashboardUpdate(data: any) {
  logger.info('Broadcasting dashboard update');

  broadcast({
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
 * Token invalido o mancante -> close con codice 4401.
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
    let tenantId: string | undefined;
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
      tenantId = decoded.tenantId;
      if (!userId) {
        throw new Error('Invalid token payload (no userId)');
      }
    } catch (err: any) {
      logger.warn(`WS reject ${clientId}: invalid token - ${err.message}`);
      try {
        socket.socket.close(4401, 'Invalid auth token');
      } catch {
        // ignore
      }
      return;
    }

    logger.info(`WebSocket client connected: ${clientId} (User: ${userId}, Tenant: ${tenantId || 'none'})`);

    const client: WebSocketClient = {
      id: clientId,
      userId,
      socket,
    };

    clients.set(clientId, client);

    // Invia conferma connessione
    socket.socket.send(
      JSON.stringify({
        type: 'connected',
        data: { clientId, userId },
      })
    );

    // Gestisci messaggi in arrivo
    socket.socket.on('message', async (messageBuffer: Buffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString()) as WebSocketMessage;

        logger.debug(`WebSocket message from ${clientId}: ${message.type}`);

        switch (message.type) {
          case 'barcode-scan':
            await handleBarcodeScanned(message.data, client);
            break;

          case 'inventory-update':
            await handleInventoryUpdate(message.data);
            break;

          case 'notification':
            handleNotification(message.data);
            break;

          case 'dashboard-update':
            handleDashboardUpdate(message.data);
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

    // Gestisci disconnessione
    socket.socket.on('close', () => {
      clients.delete(clientId);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    // Gestisci errori
    socket.socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
      clients.delete(clientId);
    });
  });

  logger.info('WebSocket initialized on /ws endpoint');
}

/**
 * Ottieni statistiche connessioni
 */
export function getStats() {
  return {
    totalClients: clients.size,
    clients: Array.from(clients.values()).map((c) => ({
      id: c.id,
      userId: c.userId,
    })),
  };
}
