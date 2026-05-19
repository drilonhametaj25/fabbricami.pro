/**
 * Fatture in Cloud (FIC) SDI Service - STUB
 *
 * Integrazione futura con Fatture in Cloud (https://developers.fattureincloud.it).
 * Per ora ritorna sempre risposte negative con messaggio "integrazione in arrivo",
 * mantenendo la stessa interfaccia di {@link ArubaSdiService} per poter essere
 * orchestrato dallo stesso `SdiService`.
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

interface FicConfig extends SdiProviderConfig {
  // Eventuali campi specifici FIC (es. companyId) verranno aggiunti qui
  companyId?: string;
}

const NOT_IMPLEMENTED_ERROR = 'Fatture in Cloud: integrazione in arrivo';

/**
 * Stub provider per Fatture in Cloud.
 * Tutti i metodi sono no-op che restituiscono errore in modo controllato.
 */
class FicSdiService implements ISdiProvider {
  readonly name = 'Fatture in Cloud';

  private config: FicConfig = {};

  /**
   * Configura il provider (placeholder).
   */
  configure(config: FicConfig): void {
    this.config = config;
    logger.info(
      `Fatture in Cloud SDI configurato (stub): env=${config.environment || 'production'}`
    );
  }

  /**
   * Verifica che siano presenti le credenziali minime (apiKey).
   * Nota: appena l'integrazione reale sarà disponibile, qui verranno
   * controllati anche companyId e altri campi obbligatori.
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey || this.config.apiSecret);
  }

  /**
   * Invio fattura - NON IMPLEMENTATO
   */
  async sendInvoice(_xml: string, _fileName: string): Promise<SendInvoiceResult> {
    logger.warn('FIC sendInvoice chiamato ma non implementato');
    return {
      success: false,
      error: NOT_IMPLEMENTED_ERROR,
      errorCode: 'NOT_IMPLEMENTED',
    };
  }

  /**
   * Stato fattura - NON IMPLEMENTATO
   */
  async getInvoiceStatus(_sdiId: string): Promise<InvoiceStatusResult> {
    logger.warn('FIC getInvoiceStatus chiamato ma non implementato');
    return {
      status: 'PENDING' as SdiStatus,
      notifications: [],
    };
  }

  /**
   * Notifiche - NON IMPLEMENTATO
   */
  async getNotifications(_sdiId: string): Promise<SdiNotification[]> {
    logger.warn('FIC getNotifications chiamato ma non implementato');
    return [];
  }

  /**
   * Test connessione - NON IMPLEMENTATO
   */
  async testConnection(): Promise<{ connected: boolean; message?: string }> {
    return {
      connected: false,
      message: NOT_IMPLEMENTED_ERROR,
    };
  }

  /**
   * Webhook processor - NON IMPLEMENTATO
   */
  processWebhook(_payload: unknown): SdiNotification | null {
    logger.warn('FIC processWebhook chiamato ma non implementato');
    return null;
  }
}

export const ficSdiService = new FicSdiService();
