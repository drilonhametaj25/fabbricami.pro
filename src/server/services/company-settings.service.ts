/**
 * Company Settings Service
 * Gestione impostazioni aziendali per fatturazione e configurazioni sistema
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Input per creazione/aggiornamento impostazioni aziendali
 */
interface CompanySettingsInput {
  // Dati Azienda
  companyName: string;
  legalName?: string;
  vatNumber: string;
  fiscalCode?: string;
  reaNumber?: string;
  capitalAmount?: number;
  legalForm?: string;

  // Indirizzo legale
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country?: string;

  // Contatti
  phone?: string;
  email: string;
  pec?: string;
  website?: string;

  // SDI
  sdiCode?: string;
  sdiPec?: string;
  sdiProvider?: string;
  sdiProviderApiKey?: string;
  sdiProviderApiSecret?: string;
  sdiProviderEndpoint?: string;

  // Regime fiscale
  taxRegime?: string;

  // Cassa Previdenziale
  socialSecurityType?: string;
  socialSecurityRate?: number;

  // Ritenuta d'acconto
  withholdingTaxType?: string;
  withholdingTaxRate?: number;

  // Logo
  logoUrl?: string;

  // Numerazione documenti
  invoicePrefix?: string;
  invoiceNextNumber?: number;
  creditNotePrefix?: string;
  creditNoteNextNumber?: number;
  ddtPrefix?: string;
  ddtNextNumber?: number;

  // Note default
  invoiceFooterNotes?: string;
  paymentInstructions?: string;

  // Banca
  bankName?: string;
  iban?: string;
  bic?: string;
}

/**
 * Servizio per gestione impostazioni aziendali
 */
class CompanySettingsService {
  /**
   * Recupera le impostazioni aziendali
   * (esiste un solo record per single-tenant)
   */
  async get() {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return null;
    }

    return {
      ...settings,
      capitalAmount: settings.capitalAmount ? Number(settings.capitalAmount) : null,
      socialSecurityRate: settings.socialSecurityRate ? Number(settings.socialSecurityRate) : null,
      withholdingTaxRate: settings.withholdingTaxRate ? Number(settings.withholdingTaxRate) : null,
    };
  }

  /**
   * Crea o aggiorna le impostazioni aziendali
   */
  async upsert(data: CompanySettingsInput) {
    const existing = await prisma.companySettings.findFirst();

    if (existing) {
      const updated = await prisma.companySettings.update({
        where: { id: existing.id },
        data: {
          companyName: data.companyName,
          legalName: data.legalName,
          vatNumber: data.vatNumber,
          fiscalCode: data.fiscalCode,
          reaNumber: data.reaNumber,
          capitalAmount: data.capitalAmount,
          legalForm: data.legalForm,
          address: data.address,
          city: data.city,
          province: data.province,
          postalCode: data.postalCode,
          country: data.country || 'IT',
          phone: data.phone,
          email: data.email,
          pec: data.pec,
          website: data.website,
          sdiCode: data.sdiCode,
          sdiPec: data.sdiPec,
          sdiProvider: data.sdiProvider,
          sdiProviderApiKey: data.sdiProviderApiKey,
          sdiProviderApiSecret: data.sdiProviderApiSecret,
          sdiProviderEndpoint: data.sdiProviderEndpoint,
          taxRegime: data.taxRegime || 'RF01',
          socialSecurityType: data.socialSecurityType,
          socialSecurityRate: data.socialSecurityRate,
          withholdingTaxType: data.withholdingTaxType,
          withholdingTaxRate: data.withholdingTaxRate,
          logoUrl: data.logoUrl,
          invoicePrefix: data.invoicePrefix,
          invoiceNextNumber: data.invoiceNextNumber,
          creditNotePrefix: data.creditNotePrefix,
          creditNoteNextNumber: data.creditNoteNextNumber,
          ddtPrefix: data.ddtPrefix,
          ddtNextNumber: data.ddtNextNumber,
          invoiceFooterNotes: data.invoiceFooterNotes,
          paymentInstructions: data.paymentInstructions,
          bankName: data.bankName,
          iban: data.iban,
          bic: data.bic,
        },
      });

      logger.info('Impostazioni aziendali aggiornate');
      return updated;
    } else {
      const created = await prisma.companySettings.create({
        data: {
          companyName: data.companyName,
          legalName: data.legalName,
          vatNumber: data.vatNumber,
          fiscalCode: data.fiscalCode,
          reaNumber: data.reaNumber,
          capitalAmount: data.capitalAmount,
          legalForm: data.legalForm,
          address: data.address,
          city: data.city,
          province: data.province,
          postalCode: data.postalCode,
          country: data.country || 'IT',
          phone: data.phone,
          email: data.email,
          pec: data.pec,
          website: data.website,
          sdiCode: data.sdiCode,
          sdiPec: data.sdiPec,
          sdiProvider: data.sdiProvider,
          sdiProviderApiKey: data.sdiProviderApiKey,
          sdiProviderApiSecret: data.sdiProviderApiSecret,
          sdiProviderEndpoint: data.sdiProviderEndpoint,
          taxRegime: data.taxRegime || 'RF01',
          socialSecurityType: data.socialSecurityType,
          socialSecurityRate: data.socialSecurityRate,
          withholdingTaxType: data.withholdingTaxType,
          withholdingTaxRate: data.withholdingTaxRate,
          logoUrl: data.logoUrl,
          invoicePrefix: data.invoicePrefix || 'FV',
          invoiceNextNumber: data.invoiceNextNumber || 1,
          creditNotePrefix: data.creditNotePrefix || 'NC',
          creditNoteNextNumber: data.creditNoteNextNumber || 1,
          ddtPrefix: data.ddtPrefix || 'DDT',
          ddtNextNumber: data.ddtNextNumber || 1,
          invoiceFooterNotes: data.invoiceFooterNotes,
          paymentInstructions: data.paymentInstructions,
          bankName: data.bankName,
          iban: data.iban,
          bic: data.bic,
        },
      });

      logger.info('Impostazioni aziendali create');
      return created;
    }
  }

  /**
   * Genera il prossimo numero fattura
   */
  async getNextInvoiceNumber(): Promise<string> {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      throw new Error('Impostazioni aziendali non configurate');
    }

    const prefix = settings.invoicePrefix;
    const number = settings.invoiceNextNumber;
    const year = new Date().getFullYear();

    // Incrementa il numero
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: { invoiceNextNumber: number + 1 },
    });

    // Formato: FV-2025-00001
    return `${prefix}-${year}-${number.toString().padStart(5, '0')}`;
  }

  /**
   * Genera il prossimo numero nota di credito
   */
  async getNextCreditNoteNumber(): Promise<string> {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      throw new Error('Impostazioni aziendali non configurate');
    }

    const prefix = settings.creditNotePrefix;
    const number = settings.creditNoteNextNumber;
    const year = new Date().getFullYear();

    await prisma.companySettings.update({
      where: { id: settings.id },
      data: { creditNoteNextNumber: number + 1 },
    });

    return `${prefix}-${year}-${number.toString().padStart(5, '0')}`;
  }

  /**
   * Genera il prossimo numero DDT
   */
  async getNextDdtNumber(): Promise<string> {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      throw new Error('Impostazioni aziendali non configurate');
    }

    const prefix = settings.ddtPrefix;
    const number = settings.ddtNextNumber;
    const year = new Date().getFullYear();

    await prisma.companySettings.update({
      where: { id: settings.id },
      data: { ddtNextNumber: number + 1 },
    });

    return `${prefix}-${year}-${number.toString().padStart(5, '0')}`;
  }

  /**
   * Verifica se le impostazioni aziendali sono complete per la fatturazione
   */
  async isConfiguredForInvoicing(): Promise<{ valid: boolean; missingFields: string[] }> {
    const settings = await this.get();

    if (!settings) {
      return {
        valid: false,
        missingFields: ['Tutte le impostazioni aziendali'],
      };
    }

    const requiredFields: Array<{ field: keyof typeof settings; label: string }> = [
      { field: 'companyName', label: 'Ragione sociale' },
      { field: 'vatNumber', label: 'Partita IVA' },
      { field: 'address', label: 'Indirizzo' },
      { field: 'city', label: 'Città' },
      { field: 'province', label: 'Provincia' },
      { field: 'postalCode', label: 'CAP' },
      { field: 'email', label: 'Email' },
      { field: 'taxRegime', label: 'Regime fiscale' },
    ];

    const missingFields: string[] = [];

    for (const { field, label } of requiredFields) {
      if (!settings[field]) {
        missingFields.push(label);
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Verifica se le impostazioni SDI sono complete
   */
  async isConfiguredForSdi(): Promise<{ valid: boolean; missingFields: string[] }> {
    const settings = await this.get();

    if (!settings) {
      return {
        valid: false,
        missingFields: ['Tutte le impostazioni aziendali'],
      };
    }

    const missingFields: string[] = [];

    // Verifica campi base per fatturazione
    const baseCheck = await this.isConfiguredForInvoicing();
    if (!baseCheck.valid) {
      missingFields.push(...baseCheck.missingFields);
    }

    // Verifica campi specifici SDI
    if (!settings.sdiProvider) {
      missingFields.push('Provider SDI');
    }

    if (!settings.sdiProviderApiKey) {
      missingFields.push('API Key provider SDI');
    }

    // PEC o Codice SDI per ricezione
    if (!settings.pec && !settings.sdiCode) {
      missingFields.push('PEC o Codice SDI');
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Verifica validità Partita IVA italiana
   */
  validateVatNumber(vatNumber: string): { valid: boolean; message?: string } {
    // Rimuovi spazi e caratteri non numerici
    const cleanVat = vatNumber.replace(/[^0-9]/g, '');

    if (cleanVat.length !== 11) {
      return { valid: false, message: 'La Partita IVA deve essere di 11 cifre' };
    }

    // Algoritmo di controllo Luhn per P.IVA italiana
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let digit = parseInt(cleanVat[i], 10);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;

    if (checkDigit !== parseInt(cleanVat[10], 10)) {
      return { valid: false, message: 'Partita IVA non valida (check digit errato)' };
    }

    return { valid: true };
  }

  /**
   * Verifica validità Codice Fiscale italiano
   */
  validateFiscalCode(fiscalCode: string): { valid: boolean; message?: string } {
    const cleanCf = fiscalCode.toUpperCase().replace(/\s/g, '');

    // Codice fiscale può essere 11 cifre (per aziende = P.IVA) o 16 caratteri (per persone fisiche)
    if (cleanCf.length === 11) {
      return this.validateVatNumber(cleanCf);
    }

    if (cleanCf.length !== 16) {
      return { valid: false, message: 'Il Codice Fiscale deve essere di 16 caratteri' };
    }

    // Pattern base per codice fiscale persone fisiche
    const cfPattern = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;

    if (!cfPattern.test(cleanCf)) {
      return { valid: false, message: 'Formato Codice Fiscale non valido' };
    }

    // Verifica carattere di controllo (algoritmo complesso, semplificato qui)
    // Per una validazione completa servirebbe l'algoritmo ufficiale

    return { valid: true };
  }

  /**
   * Verifica validità IBAN
   */
  validateIban(iban: string): { valid: boolean; message?: string } {
    const cleanIban = iban.toUpperCase().replace(/\s/g, '');

    // IBAN italiano: IT + 2 cifre controllo + 1 lettera CIN + 5 cifre ABI + 5 cifre CAB + 12 caratteri conto
    if (!cleanIban.startsWith('IT') || cleanIban.length !== 27) {
      return { valid: false, message: 'IBAN italiano deve essere di 27 caratteri' };
    }

    // Algoritmo di validazione IBAN (ISO 13616)
    const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
    const numericIban = rearranged.replace(/[A-Z]/g, (char) => (char.charCodeAt(0) - 55).toString());

    let remainder = numericIban;
    while (remainder.length > 2) {
      const block = remainder.slice(0, 9);
      remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(9);
    }

    if (parseInt(remainder, 10) % 97 !== 1) {
      return { valid: false, message: 'IBAN non valido (check digit errato)' };
    }

    return { valid: true };
  }
}

export const companySettingsService = new CompanySettingsService();
