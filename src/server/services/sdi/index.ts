/**
 * SDI Service - Main Orchestrator
 * Servizio principale per la gestione della Fatturazione Elettronica
 *
 * Funzionalità:
 * - Generazione XML FatturaPA
 * - Invio a SDI tramite provider (Aruba, Infocert, etc.)
 * - Tracciamento stato fatture
 * - Gestione notifiche SDI
 */

import { prisma } from '../../config/database';
import {
  FatturapaInput,
  XmlGenerationResult,
  SendInvoiceResult,
  InvoiceStatusResult,
  SdiNotification as SdiNotificationData,
  CedentePrestatoreData,
  CessionarioCommittenteData,
  DettaglioLineaData,
  DatiRiepilogoData,
} from './sdi-provider.interface';
import { fatturaPaXmlService } from './fatturapa-xml.service';
import { arubaSdiService } from './aruba-sdi.service';
import { FatturapaDocumentType, SdiStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

// Re-export per comodità
export * from './sdi-provider.interface';
export { fatturaPaXmlService } from './fatturapa-xml.service';
export { arubaSdiService } from './aruba-sdi.service';

/**
 * Directory per salvataggio file XML
 */
const XML_STORAGE_PATH = process.env.SDI_XML_PATH || './storage/sdi/xml';
const PDF_STORAGE_PATH = process.env.SDI_PDF_PATH || './storage/sdi/pdf';

/**
 * Servizio principale SDI
 */
class SdiService {
  /**
   * Inizializza le directory di storage
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(XML_STORAGE_PATH, { recursive: true });
      await fs.mkdir(PDF_STORAGE_PATH, { recursive: true });
      logger.info('SDI Service inizializzato');
    } catch (error) {
      logger.error('Errore inizializzazione SDI Service:', error);
    }
  }

  /**
   * Configura il provider SDI con le impostazioni aziendali
   */
  async configureProvider(): Promise<boolean> {
    try {
      const settings = await prisma.companySettings.findFirst();

      if (!settings) {
        logger.warn('CompanySettings non trovate - SDI non configurato');
        return false;
      }

      if (settings.sdiProvider === 'aruba') {
        arubaSdiService.configure({
          username: settings.sdiProviderApiKey || undefined,
          password: settings.sdiProviderApiSecret || undefined,
          endpoint: settings.sdiProviderEndpoint || undefined,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
        });
        return arubaSdiService.isConfigured();
      }

      logger.warn(`Provider SDI non supportato: ${settings.sdiProvider}`);
      return false;
    } catch (error) {
      logger.error('Errore configurazione provider SDI:', error);
      return false;
    }
  }

  /**
   * Genera l'XML FatturaPA per una fattura esistente
   */
  async generateInvoiceXml(invoiceId: string): Promise<XmlGenerationResult> {
    try {
      // Carica fattura con tutte le relazioni necessarie
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          order: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
          paymentDues: true,
        },
      });

      if (!invoice) {
        return { success: false, errors: ['Fattura non trovata'] };
      }

      // Carica impostazioni aziendali
      const companySettings = await prisma.companySettings.findFirst();

      if (!companySettings) {
        return { success: false, errors: ['Impostazioni aziendali non configurate'] };
      }

      // Verifica che la fattura abbia un cliente
      if (!invoice.customer) {
        return { success: false, errors: ['Fattura senza cliente associato'] };
      }

      // Costruisci input per generazione XML
      const input = await this.buildFatturapaInput(
        { ...invoice, customer: invoice.customer },
        companySettings
      );

      // Genera progressivo invio (basato su timestamp + id)
      const progressivo = this.generateProgressivoInvio(invoice.invoiceNumber);

      // Genera XML
      const result = fatturaPaXmlService.generateXml(input, progressivo);

      if (result.success && result.xml && result.fileName) {
        // Salva file XML
        const xmlPath = path.join(XML_STORAGE_PATH, result.fileName);
        await fs.writeFile(xmlPath, result.xml, 'utf-8');

        // Aggiorna fattura con path XML e info
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            xmlFilePath: xmlPath,
            sdiFileName: result.fileName,
            documentType: input.tipoDocumento,
          },
        });

        logger.info(`XML generato per fattura ${invoice.invoiceNumber}: ${result.fileName}`);
      }

      return result;
    } catch (error) {
      logger.error('Errore generazione XML fattura:', error);
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Invia una fattura al Sistema di Interscambio
   */
  async sendInvoiceToSdi(invoiceId: string): Promise<SendInvoiceResult> {
    try {
      // Configura provider se necessario
      const configured = await this.configureProvider();
      if (!configured) {
        return {
          success: false,
          error: 'Provider SDI non configurato',
        };
      }

      // Carica fattura
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        return { success: false, error: 'Fattura non trovata' };
      }

      // Verifica che l'XML sia stato generato
      if (!invoice.xmlFilePath || !invoice.sdiFileName) {
        // Genera XML se non esiste
        const xmlResult = await this.generateInvoiceXml(invoiceId);
        if (!xmlResult.success) {
          return {
            success: false,
            error: `Errore generazione XML: ${xmlResult.errors?.join(', ')}`,
          };
        }

        // Ricarica fattura con path aggiornato
        const updatedInvoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (!updatedInvoice?.xmlFilePath) {
          return { success: false, error: 'XML non generato correttamente' };
        }
      }

      // Leggi contenuto XML
      const xml = await fs.readFile(invoice.xmlFilePath!, 'utf-8');

      // Invia tramite provider
      const result = await arubaSdiService.sendInvoice(xml, invoice.sdiFileName!);

      // Aggiorna fattura con risultato
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          sdiStatus: result.success ? 'PENDING' : 'NOT_SENT',
          sdiId: result.sdiId,
          sdiSentAt: result.sentAt,
          sdiErrorCode: result.errorCode,
          sdiErrorMessage: result.error,
        },
      });

      if (result.success) {
        logger.info(`Fattura ${invoice.invoiceNumber} inviata a SDI: ${result.sdiId}`);
      } else {
        logger.error(`Errore invio fattura ${invoice.invoiceNumber}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Errore invio fattura a SDI:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Aggiorna lo stato di una fattura da SDI
   */
  async updateInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult | null> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice || !invoice.sdiId) {
        return null;
      }

      // Configura provider
      await this.configureProvider();

      // Recupera stato da provider
      const status = await arubaSdiService.getInvoiceStatus(invoice.sdiId);

      // Aggiorna stato fattura
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          sdiStatus: status.status,
          sdiReceivedAt: status.status === 'DELIVERED' ? new Date() : undefined,
        },
      });

      // Salva notifiche
      for (const notification of status.notifications) {
        await this.saveNotification(invoiceId, notification);
      }

      logger.info(`Stato fattura ${invoice.invoiceNumber} aggiornato: ${status.status}`);

      return status;
    } catch (error) {
      logger.error('Errore aggiornamento stato fattura:', error);
      return null;
    }
  }

  /**
   * Processa una notifica webhook da SDI
   */
  async processWebhook(
    provider: string,
    payload: unknown
  ): Promise<{ processed: boolean; invoiceId?: string }> {
    try {
      let notification: SdiNotificationData | null = null;

      if (provider === 'aruba') {
        notification = arubaSdiService.processWebhook(payload);
      }

      if (!notification || !notification.identificativoSdi) {
        return { processed: false };
      }

      // Trova fattura per ID SDI
      const invoice = await prisma.invoice.findFirst({
        where: { sdiId: notification.identificativoSdi },
      });

      if (!invoice) {
        logger.warn(`Notifica SDI per fattura non trovata: ${notification.identificativoSdi}`);
        return { processed: false };
      }

      // Determina nuovo stato basato sul tipo notifica
      const newStatus = this.mapNotificationToStatus(notification.tipo);

      // Aggiorna fattura
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          sdiStatus: newStatus,
          sdiReceivedAt:
            notification.tipo === 'RC' ? notification.dataOraConsegna || new Date() : undefined,
          sdiErrorCode: notification.listaErrori?.[0]?.codice,
          sdiErrorMessage: notification.listaErrori?.[0]?.descrizione,
        },
      });

      // Salva notifica
      await this.saveNotification(invoice.id, notification);

      logger.info(
        `Webhook SDI processato: ${notification.tipo} per fattura ${invoice.invoiceNumber}`
      );

      return { processed: true, invoiceId: invoice.id };
    } catch (error) {
      logger.error('Errore processamento webhook SDI:', error);
      return { processed: false };
    }
  }

  /**
   * Salva una notifica SDI nel database
   */
  private async saveNotification(invoiceId: string, notification: SdiNotificationData): Promise<void> {
    await prisma.sdiNotification.create({
      data: {
        invoiceId,
        notificationType: notification.tipo,
        messageId: notification.identificativoSdi,
        fileName: notification.nomeFile,
        content: notification.xmlContent,
        errorCode: notification.listaErrori?.[0]?.codice,
        errorMessage: notification.listaErrori?.[0]?.descrizione,
        receivedAt: notification.dataOraRicezione || new Date(),
      },
    });
  }

  /**
   * Mappa tipo notifica a SdiStatus
   */
  private mapNotificationToStatus(tipoNotifica: string): SdiStatus {
    const statusMap: Record<string, SdiStatus> = {
      RC: 'DELIVERED',     // Ricevuta di consegna
      NS: 'REJECTED',      // Notifica di scarto
      MC: 'NOT_DELIVERABLE', // Mancata consegna
      NE: 'REJECTED',      // Notifica di esito (rifiuto)
      AT: 'DELIVERED',     // Attestazione di avvenuta trasmissione
      DT: 'DELIVERED',     // Notifica decorrenza termini
      EC: 'ACCEPTED',      // Esito committente (accettata)
    };

    return statusMap[tipoNotifica] || 'PENDING';
  }

  /**
   * Genera progressivo invio univoco
   */
  private generateProgressivoInvio(invoiceNumber: string): string {
    // Usa un hash del numero fattura + timestamp per unicità
    const timestamp = Date.now().toString(36).toUpperCase();
    const cleanNumber = invoiceNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return (cleanNumber + timestamp).slice(-5).padStart(5, '0');
  }

  /**
   * Costruisce l'input FatturaPA dai dati fattura
   */
  private async buildFatturapaInput(
    invoice: Awaited<ReturnType<typeof prisma.invoice.findUnique>> & {
      customer: NonNullable<Awaited<ReturnType<typeof prisma.customer.findUnique>>>;
      order: {
        items: Array<{
          product: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>;
          quantity: number;
          unitPrice: unknown;
          total: unknown;
          taxRate: unknown;
          productName: string;
          sku: string;
        }>;
      } | null;
    },
    companySettings: NonNullable<Awaited<ReturnType<typeof prisma.companySettings.findFirst>>>
  ): Promise<FatturapaInput> {
    // Cedente/Prestatore (chi emette la fattura - l'azienda)
    const cedentePrestatore: CedentePrestatoreData = {
      denominazione: companySettings.companyName,
      partitaIva: companySettings.vatNumber,
      codiceFiscale: companySettings.fiscalCode || undefined,
      indirizzo: companySettings.address,
      cap: companySettings.postalCode,
      comune: companySettings.city,
      provincia: companySettings.province,
      nazione: companySettings.country,
      regimeFiscale: companySettings.taxRegime,
      email: companySettings.email,
      pec: companySettings.pec || undefined,
      reaUfficio: companySettings.reaNumber ? companySettings.province : undefined,
      reaNumero: companySettings.reaNumber || undefined,
      capitaleSociale: companySettings.capitalAmount ? Number(companySettings.capitalAmount) : undefined,
      statoLiquidazione: 'LN',
    };

    // Cessionario/Committente (chi riceve la fattura - il cliente)
    const customer = invoice.customer;
    const billingAddress = customer.billingAddress as Record<string, string> | null;

    const cessionarioCommittente: CessionarioCommittenteData = {
      denominazione: customer.businessName || undefined,
      nome: customer.firstName || undefined,
      cognome: customer.lastName || undefined,
      partitaIva: customer.taxId || undefined,
      codiceFiscale: customer.fiscalCode || undefined,
      indirizzo: billingAddress?.address1 || billingAddress?.street || '',
      cap: billingAddress?.postcode || billingAddress?.zip || '',
      comune: billingAddress?.city || '',
      provincia: billingAddress?.state || undefined,
      nazione: billingAddress?.country || 'IT',
      codiceDestinatario: customer.sdiCode || '0000000',
      pecDestinatario: customer.pecEmail || undefined,
    };

    // Righe dettaglio
    const dettaglioLinee: DettaglioLineaData[] = [];
    const riepilogoByAliquota: Map<number, { imponibile: number; imposta: number }> = new Map();

    if (invoice.order?.items) {
      let numeroLinea = 1;

      for (const item of invoice.order.items) {
        const prezzoUnitario = Number(item.unitPrice);
        const quantita = item.quantity;
        const prezzoTotale = Number(item.total);
        const aliquotaIva = Number(item.taxRate) || 22;

        dettaglioLinee.push({
          numeroLinea,
          descrizione: item.productName,
          quantita,
          unitaMisura: item.product?.unit || 'PZ',
          prezzoUnitario,
          prezzoTotale,
          aliquotaIva,
        });

        // Accumula per riepilogo
        const current = riepilogoByAliquota.get(aliquotaIva) || { imponibile: 0, imposta: 0 };
        const imponibileLinea = prezzoTotale / (1 + aliquotaIva / 100);
        const impostaLinea = prezzoTotale - imponibileLinea;
        current.imponibile += imponibileLinea;
        current.imposta += impostaLinea;
        riepilogoByAliquota.set(aliquotaIva, current);

        numeroLinea++;
      }
    }

    // Riepiloghi IVA
    const datiRiepilogo: DatiRiepilogoData[] = [];
    for (const [aliquota, values] of riepilogoByAliquota.entries()) {
      datiRiepilogo.push({
        aliquotaIva: aliquota,
        imponibileImporto: Math.round(values.imponibile * 100) / 100,
        imposta: Math.round(values.imposta * 100) / 100,
        esigibilitaIva: 'I',
      });
    }

    // Determina tipo documento
    let tipoDocumento: FatturapaDocumentType = 'TD01'; // Fattura standard
    if (invoice.documentType) {
      tipoDocumento = invoice.documentType;
    } else if (Number(invoice.total) < 0) {
      tipoDocumento = 'TD04'; // Nota di credito
    }

    // Costruisci input
    const input: FatturapaInput = {
      tipoDocumento,
      cedentePrestatore,
      cessionarioCommittente,
      divisa: 'EUR',
      data: invoice.issueDate,
      numero: invoice.invoiceNumber,
      dettaglioLinee,
      datiRiepilogo,
      importoTotaleDocumento: Number(invoice.total),
    };

    // Aggiungi bollo se presente
    if (invoice.bolloVirtual && invoice.bolloAmount) {
      input.datiBollo = {
        bolloVirtuale: 'SI',
        importoBollo: Number(invoice.bolloAmount),
      };
    }

    // Aggiungi cassa previdenziale se presente
    if (invoice.socialSecurityType && invoice.socialSecurityAmount) {
      input.datiCassaPrevidenziale = [
        {
          tipoCassa: invoice.socialSecurityType,
          alCassa: Number(invoice.socialSecurityRate) || 4,
          importoContributoCassa: Number(invoice.socialSecurityAmount),
          aliquotaIva: 22, // Default, dovrebbe essere parametrizzato
          ritenuta: invoice.withholdingTaxAmount ? 'SI' : undefined,
        },
      ];
    }

    // Aggiungi ritenuta se presente
    if (invoice.withholdingTaxType && invoice.withholdingTaxAmount) {
      input.datiRitenuta = {
        tipoRitenuta: invoice.withholdingTaxType as 'RT01' | 'RT02' | 'RT03' | 'RT04' | 'RT05' | 'RT06',
        importoRitenuta: Number(invoice.withholdingTaxAmount),
        aliquotaRitenuta: Number(invoice.withholdingTaxRate) || 20,
        causalePagamento: invoice.withholdingTaxReason || 'A',
      };
    }

    // Aggiungi dati pagamento
    if (invoice.paymentMethodPa) {
      input.datiPagamento = {
        condizioniPagamento: 'TP02', // Pagamento completo
        dettaglioPagamento: [
          {
            modalitaPagamento: invoice.paymentMethodPa,
            dataScadenzaPagamento: invoice.dueDate,
            importoPagamento: Number(invoice.total),
            iban: companySettings.iban || undefined,
            bic: companySettings.bic || undefined,
            istitutoFinanziario: companySettings.bankName || undefined,
          },
        ],
      };
    }

    return input;
  }

  /**
   * Lista fatture con stato SDI
   */
  async listInvoicesWithSdiStatus(params: {
    page?: number;
    limit?: number;
    sdiStatus?: SdiStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page = 1, limit = 50, sdiStatus, dateFrom, dateTo } = params;

    const where: Record<string, unknown> = {};

    if (sdiStatus) {
      where.sdiStatus = sdiStatus;
    }

    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) {
        (where.issueDate as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.issueDate as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              businessName: true,
              firstName: true,
              lastName: true,
            },
          },
          sdiNotifications: {
            orderBy: { receivedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      items: invoices,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Recupera XML di una fattura
   */
  async getInvoiceXml(invoiceId: string): Promise<string | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice?.xmlFilePath) {
      return null;
    }

    try {
      return await fs.readFile(invoice.xmlFilePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Retry invio fattura fallita
   */
  async retryFailedInvoice(invoiceId: string): Promise<SendInvoiceResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return { success: false, error: 'Fattura non trovata' };
    }

    if (invoice.sdiStatus !== 'REJECTED' && invoice.sdiStatus !== 'NOT_SENT') {
      return { success: false, error: 'La fattura non è in stato di errore' };
    }

    // Reset stato
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        sdiStatus: 'NOT_SENT',
        sdiId: null,
        sdiErrorCode: null,
        sdiErrorMessage: null,
        sdiSentAt: null,
      },
    });

    // Rigenera e reinvia
    return this.sendInvoiceToSdi(invoiceId);
  }
}

export const sdiService = new SdiService();
