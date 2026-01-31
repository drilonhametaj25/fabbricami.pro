/**
 * Aruba SDI Service
 * Integrazione con Aruba PEC/SDI per invio fatture elettroniche
 *
 * Documentazione: https://www.aruba.it/fatturazione-elettronica/
 * API Reference: https://fatturapa.aruba.it/apife/docs
 */

import {
  ISdiProvider,
  SdiProviderConfig,
  SendInvoiceResult,
  InvoiceStatusResult,
  SdiNotification,
} from './sdi-provider.interface';
import { SdiStatus } from '@prisma/client';
import { logger } from '../../config/logger';

/**
 * Configurazione specifica Aruba
 */
interface ArubaConfig extends SdiProviderConfig {
  username?: string;
  password?: string;
}

/**
 * Risposta autenticazione Aruba
 */
interface ArubaAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Risposta invio fattura Aruba
 */
interface ArubaSendResponse {
  uploadFileName: string;
  idSdi?: string;
  errorCode?: string;
  errorDescription?: string;
}

/**
 * Stato fattura Aruba
 */
interface ArubaInvoiceStatus {
  idSdi: string;
  fileName: string;
  status: string;
  lastUpdate: string;
  notifications: ArubaNotification[];
}

/**
 * Notifica Aruba
 */
interface ArubaNotification {
  type: string;
  messageId?: string;
  receivedAt: string;
  content?: string;
  errorCode?: string;
  errorDescription?: string;
}

/**
 * Servizio di integrazione con Aruba SDI
 */
class ArubaSdiService implements ISdiProvider {
  readonly name = 'Aruba';

  private config: ArubaConfig = {};
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Endpoint Aruba (sandbox/production)
  private baseUrl = 'https://ws.fatturazioneelettronica.aruba.it';
  private sandboxUrl = 'https://sandbox.fatturazioneelettronica.aruba.it';

  /**
   * Configura il provider con le credenziali
   */
  configure(config: ArubaConfig): void {
    this.config = config;

    if (config.environment === 'sandbox') {
      this.baseUrl = this.sandboxUrl;
    }

    logger.info(`Aruba SDI configurato: ${config.environment || 'production'}`);
  }

  /**
   * Verifica se il provider è configurato
   */
  isConfigured(): boolean {
    return !!(
      this.config.username &&
      this.config.password &&
      (this.config.apiKey || this.config.apiSecret)
    );
  }

  /**
   * Ottiene token di autenticazione
   */
  private async authenticate(): Promise<string> {
    // Se abbiamo un token valido, riutilizzalo
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error('Aruba SDI non configurato. Impostare credenziali in CompanySettings.');
    }

    try {
      const authUrl = `${this.baseUrl}/services/auth/signin`;

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: this.config.username!,
          password: this.config.password!,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Autenticazione Aruba fallita: ${response.status} - ${errorText}`);
      }

      const data: ArubaAuthResponse = await response.json();

      this.accessToken = data.access_token;
      // Token scade in X secondi, rinnova 5 minuti prima
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

      logger.debug('Token Aruba SDI ottenuto con successo');

      return this.accessToken;
    } catch (error) {
      logger.error('Errore autenticazione Aruba SDI:', error);
      throw error;
    }
  }

  /**
   * Invia una fattura al Sistema di Interscambio
   */
  async sendInvoice(xml: string, fileName: string): Promise<SendInvoiceResult> {
    try {
      const token = await this.authenticate();

      logger.info(`Invio fattura Aruba SDI: ${fileName}`);

      const uploadUrl = `${this.baseUrl}/services/invoice/upload`;

      // Prepara il file XML come FormData
      const formData = new FormData();
      const blob = new Blob([xml], { type: 'application/xml' });
      formData.append('file', blob, fileName);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      let data: ArubaSendResponse;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Risposta Aruba non valida: ${responseText}`);
      }

      if (!response.ok || data.errorCode) {
        logger.error(`Errore invio fattura Aruba: ${data.errorCode} - ${data.errorDescription}`);
        return {
          success: false,
          error: data.errorDescription || 'Errore invio fattura',
          errorCode: data.errorCode,
        };
      }

      logger.info(`Fattura inviata con successo: ${fileName}, ID SDI: ${data.idSdi || 'in attesa'}`);

      return {
        success: true,
        sdiId: data.idSdi,
        fileName: data.uploadFileName || fileName,
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error('Errore invio fattura Aruba SDI:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Recupera lo stato di una fattura
   */
  async getInvoiceStatus(sdiId: string): Promise<InvoiceStatusResult> {
    try {
      const token = await this.authenticate();

      logger.debug(`Recupero stato fattura Aruba: ${sdiId}`);

      const statusUrl = `${this.baseUrl}/services/invoice/status/${sdiId}`;

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore recupero stato: ${response.status} - ${errorText}`);
      }

      const data: ArubaInvoiceStatus = await response.json();

      // Mappa lo stato Aruba allo stato interno
      const status = this.mapArubaStatus(data.status);

      // Mappa le notifiche
      const notifications = data.notifications.map(n => this.mapArubaNotification(n));

      return {
        status,
        sdiId: data.idSdi,
        notifications,
        lastUpdate: new Date(data.lastUpdate),
      };
    } catch (error) {
      logger.error('Errore recupero stato fattura Aruba:', error);
      return {
        status: 'PENDING' as SdiStatus,
        notifications: [],
      };
    }
  }

  /**
   * Recupera le notifiche per una fattura
   */
  async getNotifications(sdiId: string): Promise<SdiNotification[]> {
    try {
      const token = await this.authenticate();

      const notificationsUrl = `${this.baseUrl}/services/invoice/notifications/${sdiId}`;

      const response = await fetch(notificationsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore recupero notifiche: ${response.status} - ${errorText}`);
      }

      const data: ArubaNotification[] = await response.json();

      return data.map(n => this.mapArubaNotification(n));
    } catch (error) {
      logger.error('Errore recupero notifiche Aruba:', error);
      return [];
    }
  }

  /**
   * Testa la connessione con Aruba SDI
   */
  async testConnection(): Promise<{ connected: boolean; message?: string }> {
    try {
      if (!this.isConfigured()) {
        return {
          connected: false,
          message: 'Provider non configurato',
        };
      }

      await this.authenticate();

      return {
        connected: true,
        message: 'Connessione Aruba SDI attiva',
      };
    } catch (error) {
      return {
        connected: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Mappa lo stato Aruba allo stato interno SdiStatus
   */
  private mapArubaStatus(arubaStatus: string): SdiStatus {
    const statusMap: Record<string, SdiStatus> = {
      'PENDING': 'PENDING',
      'SENT': 'PENDING',
      'DELIVERED': 'DELIVERED',
      'RECEIVED': 'DELIVERED',
      'ACCEPTED': 'ACCEPTED',
      'REJECTED': 'REJECTED',
      'NOT_DELIVERABLE': 'NOT_DELIVERABLE',
      'MANCATA_CONSEGNA': 'NOT_DELIVERABLE',
      'SCARTATA': 'REJECTED',
      'ERROR': 'REJECTED',
    };

    return statusMap[arubaStatus.toUpperCase()] || 'PENDING';
  }

  /**
   * Mappa una notifica Aruba nel formato interno
   */
  private mapArubaNotification(notification: ArubaNotification): SdiNotification {
    return {
      tipo: notification.type as SdiNotification['tipo'],
      dataOraRicezione: new Date(notification.receivedAt),
      xmlContent: notification.content,
      listaErrori: notification.errorCode
        ? [{
            codice: notification.errorCode,
            descrizione: notification.errorDescription || '',
          }]
        : undefined,
    };
  }

  /**
   * Processa un webhook ricevuto da Aruba
   * Questo metodo viene chiamato quando Aruba invia una notifica al nostro endpoint
   */
  processWebhook(payload: unknown): SdiNotification | null {
    try {
      const data = payload as Record<string, unknown>;

      if (!data.type || !data.idSdi) {
        logger.warn('Webhook Aruba incompleto:', payload);
        return null;
      }

      const notification: SdiNotification = {
        tipo: data.type as SdiNotification['tipo'],
        identificativoSdi: data.idSdi as string,
        nomeFile: data.fileName as string | undefined,
        dataOraRicezione: data.receivedAt ? new Date(data.receivedAt as string) : new Date(),
        dataOraConsegna: data.deliveredAt ? new Date(data.deliveredAt as string) : undefined,
        xmlContent: data.content as string | undefined,
      };

      // Gestisci notifica di scarto
      if (data.type === 'NS' && data.errors) {
        notification.listaErrori = (data.errors as Array<{ code: string; description: string }>).map(e => ({
          codice: e.code,
          descrizione: e.description,
        }));
      }

      // Gestisci esito committente
      if (data.type === 'EC') {
        notification.esito = data.esito as 'EC01' | 'EC02';
      }

      logger.info(`Webhook Aruba processato: ${notification.tipo} per ${notification.identificativoSdi}`);

      return notification;
    } catch (error) {
      logger.error('Errore processamento webhook Aruba:', error);
      return null;
    }
  }
}

export const arubaSdiService = new ArubaSdiService();
