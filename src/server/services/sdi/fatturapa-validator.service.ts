/**
 * FatturaPA XML Validator Service
 * Validazione strutturale e semantica per XML FatturaPA v1.2.2
 *
 * Implementa validazione basata su regole derivate dallo schema XSD ufficiale
 * dell'Agenzia delle Entrate per la Fattura Elettronica.
 *
 * Riferimento: https://www.fatturapa.gov.it/it/norme-e-regole/documentazione-fattura-elettronica/
 */

import { XsdValidationResult } from './sdi-provider.interface';
import { logger } from '../../config/logger';

// ============================================
// TYPES
// ============================================

interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  code?: string;
  path?: string;
}

// XmlElement interface reserved for future DOM-based validation
// interface XmlElement {
//   name: string;
//   value?: string;
//   attributes?: Record<string, string>;
//   children?: XmlElement[];
//   line?: number;
// }

// ============================================
// CONSTANTS - FatturaPA 1.2.2 Schema Rules
// ============================================

const VALID_FORMATO_TRASMISSIONE = ['FPA12', 'FPR12']; // FPA12 = PA, FPR12 = Privati
const VALID_TIPO_DOCUMENTO = [
  'TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06',
  'TD16', 'TD17', 'TD18', 'TD19', 'TD20',
  'TD24', 'TD25', 'TD26', 'TD27'
];
const VALID_REGIME_FISCALE = [
  'RF01', 'RF02', 'RF04', 'RF05', 'RF06', 'RF07', 'RF08', 'RF09',
  'RF10', 'RF11', 'RF12', 'RF13', 'RF14', 'RF15', 'RF16', 'RF17', 'RF18', 'RF19'
];
const VALID_NATURA = [
  'N1', 'N2', 'N2.1', 'N2.2', 'N3', 'N3.1', 'N3.2', 'N3.3', 'N3.4', 'N3.5', 'N3.6',
  'N4', 'N5', 'N6', 'N6.1', 'N6.2', 'N6.3', 'N6.4', 'N6.5', 'N6.6', 'N6.7', 'N6.8', 'N6.9',
  'N7'
];
const VALID_CONDIZIONI_PAGAMENTO = ['TP01', 'TP02', 'TP03'];
const VALID_MODALITA_PAGAMENTO = [
  'MP01', 'MP02', 'MP03', 'MP04', 'MP05', 'MP06', 'MP07', 'MP08', 'MP09',
  'MP10', 'MP11', 'MP12', 'MP13', 'MP14', 'MP15', 'MP16', 'MP17', 'MP18',
  'MP19', 'MP20', 'MP21', 'MP22', 'MP23'
];
const VALID_TIPO_RITENUTA = ['RT01', 'RT02', 'RT03', 'RT04', 'RT05', 'RT06'];
const VALID_ESIGIBILITA_IVA = ['I', 'D', 'S'];
const VALID_TIPO_CASSA = [
  'TC01', 'TC02', 'TC03', 'TC04', 'TC05', 'TC06', 'TC07', 'TC08', 'TC09',
  'TC10', 'TC11', 'TC12', 'TC13', 'TC14', 'TC15', 'TC16', 'TC17', 'TC18',
  'TC19', 'TC20', 'TC21', 'TC22'
];

// Campo obbligatori per sezione
const REQUIRED_DATI_TRASMISSIONE = ['IdTrasmittente', 'ProgressivoInvio', 'FormatoTrasmissione', 'CodiceDestinatario'];
const REQUIRED_CEDENTE_PRESTATORE = ['DatiAnagrafici', 'Sede'];
const REQUIRED_CEDENTE_DATI_ANAGRAFICI = ['IdFiscaleIVA', 'Anagrafica', 'RegimeFiscale'];
const REQUIRED_SEDE = ['Indirizzo', 'CAP', 'Comune', 'Nazione'];
const REQUIRED_CESSIONARIO_COMMITTENTE = ['DatiAnagrafici', 'Sede'];
const REQUIRED_DATI_GENERALI_DOCUMENTO = ['TipoDocumento', 'Divisa', 'Data', 'Numero'];
const REQUIRED_DETTAGLIO_LINEE = ['NumeroLinea', 'Descrizione', 'PrezzoUnitario', 'PrezzoTotale', 'AliquotaIVA'];
const REQUIRED_DATI_RIEPILOGO = ['AliquotaIVA', 'ImponibileImporto', 'Imposta'];

// ============================================
// VALIDATOR CLASS
// ============================================

class FatturaPaValidatorService {
  private errors: ValidationError[] = [];

  /**
   * Valida un XML FatturaPA
   * @param xml Stringa XML da validare
   * @returns Risultato validazione con eventuali errori
   */
  validateXml(xml: string): XsdValidationResult {
    this.errors = [];

    try {
      // 1. Validazione struttura XML base
      this.validateXmlStructure(xml);
      if (this.errors.length > 0) {
        return { valid: false, errors: this.errors };
      }

      // 2. Parse XML (semplificato - estrae elementi principali)
      const parsed = this.parseXml(xml);

      // 3. Validazione root element
      this.validateRootElement(parsed);

      // 4. Validazione Header
      this.validateHeader(parsed);

      // 5. Validazione Body
      this.validateBody(parsed);

      // 6. Validazioni semantiche cross-field
      this.validateCrossFieldRules(parsed);

      return {
        valid: this.errors.length === 0,
        errors: this.errors.length > 0 ? this.errors : undefined,
      };
    } catch (error) {
      logger.error('Errore validazione XML FatturaPA:', error);
      return {
        valid: false,
        errors: [{
          message: `Errore parsing XML: ${(error as Error).message}`,
        }],
      };
    }
  }

  /**
   * Validazione rapida - verifica solo struttura base
   */
  quickValidate(xml: string): boolean {
    try {
      this.errors = [];
      this.validateXmlStructure(xml);
      const parsed = this.parseXml(xml);
      this.validateRootElement(parsed);
      return this.errors.length === 0;
    } catch {
      return false;
    }
  }

  // ============================================
  // XML STRUCTURE VALIDATION
  // ============================================

  private validateXmlStructure(xml: string): void {
    // Verifica XML declaration
    if (!xml.trim().startsWith('<?xml')) {
      this.addError('Dichiarazione XML mancante: <?xml version="1.0" encoding="UTF-8"?>');
    }

    // Verifica encoding
    const encodingMatch = xml.match(/encoding=["']([^"']+)["']/i);
    if (encodingMatch && !['UTF-8', 'utf-8'].includes(encodingMatch[1])) {
      this.addError(`Encoding non supportato: ${encodingMatch[1]}. Usare UTF-8`);
    }

    // Verifica bilanciamento tag
    const openTags: string[] = [];
    let match;
    let lineNum = 1;

    const lines = xml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNum = i + 1;

      // Reset regex per ogni linea
      const lineTagRegex = /<\/?([a-zA-Z0-9:]+)[^>]*\/?>/g;
      while ((match = lineTagRegex.exec(line)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];

        // Ignora self-closing e declaration
        if (fullTag.endsWith('/>') || fullTag.startsWith('<?')) continue;

        if (fullTag.startsWith('</')) {
          // Closing tag
          const lastOpen = openTags.pop();
          if (lastOpen !== tagName) {
            this.addError(`Tag non bilanciato: atteso </${lastOpen}>, trovato </${tagName}>`, lineNum);
          }
        } else {
          // Opening tag
          openTags.push(tagName);
        }
      }
    }

    if (openTags.length > 0) {
      this.addError(`Tag non chiusi: ${openTags.join(', ')}`);
    }

    // Verifica caratteri non validi
    const invalidChars = xml.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
    if (invalidChars) {
      this.addError('XML contiene caratteri di controllo non validi');
    }
  }

  // ============================================
  // XML PARSING (Simplified)
  // ============================================

  private parseXml(xml: string): Record<string, any> {
    const result: Record<string, any> = {};

    // Estrae contenuto tra i tag principali
    result.versione = this.extractAttribute(xml, 'FatturaElettronica', 'versione');
    result.header = this.extractSection(xml, 'FatturaElettronicaHeader');
    result.body = this.extractSection(xml, 'FatturaElettronicaBody');

    // Parse Header sections
    if (result.header) {
      result.datiTrasmissione = this.extractSection(result.header, 'DatiTrasmissione');
      result.cedentePrestatore = this.extractSection(result.header, 'CedentePrestatore');
      result.cessionarioCommittente = this.extractSection(result.header, 'CessionarioCommittente');
    }

    // Parse Body sections
    if (result.body) {
      result.datiGenerali = this.extractSection(result.body, 'DatiGenerali');
      result.datiBeniServizi = this.extractSection(result.body, 'DatiBeniServizi');
      result.datiPagamento = this.extractSection(result.body, 'DatiPagamento');
    }

    return result;
  }

  private extractSection(xml: string, tagName: string): string | null {
    // Handle optional namespace prefix (e.g., <p:FatturaElettronica> or <FatturaElettronica>)
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private extractValue(xml: string, tagName: string): string | null {
    // Handle optional namespace prefix
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[a-zA-Z0-9]+:)?${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractAttribute(xml: string, tagName: string, attrName: string): string | null {
    // Handle optional namespace prefix (e.g., <p:FatturaElettronica> or <FatturaElettronica>)
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*${attrName}=["']([^"']+)["']`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private extractAllSections(xml: string, tagName: string): string[] {
    // Handle optional namespace prefix
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tagName}>`, 'gi');
    const sections: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      sections.push(match[1]);
    }
    return sections;
  }

  private hasElement(xml: string, tagName: string): boolean {
    // Handle optional namespace prefix
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>`, 'i');
    return regex.test(xml);
  }

  // ============================================
  // ROOT ELEMENT VALIDATION
  // ============================================

  private validateRootElement(parsed: Record<string, any>): void {
    // Verifica versione
    if (!parsed.versione) {
      this.addError('Attributo versione mancante in FatturaElettronica');
    } else if (!['FPA12', 'FPR12'].includes(parsed.versione)) {
      this.addError(`Versione non valida: ${parsed.versione}. Valori ammessi: FPA12, FPR12`);
    }

    // Verifica presenza sezioni principali
    if (!parsed.header) {
      this.addError('FatturaElettronicaHeader mancante');
    }
    if (!parsed.body) {
      this.addError('FatturaElettronicaBody mancante');
    }
  }

  // ============================================
  // HEADER VALIDATION
  // ============================================

  private validateHeader(parsed: Record<string, any>): void {
    if (!parsed.header) return;

    // DatiTrasmissione
    this.validateDatiTrasmissione(parsed.datiTrasmissione, parsed.versione);

    // CedentePrestatore
    this.validateCedentePrestatore(parsed.cedentePrestatore);

    // CessionarioCommittente
    this.validateCessionarioCommittente(parsed.cessionarioCommittente);
  }

  private validateDatiTrasmissione(section: string | null, versione: string): void {
    if (!section) {
      this.addError('DatiTrasmissione mancante', undefined, 'FatturaElettronicaHeader');
      return;
    }

    // Campi obbligatori
    this.validateRequiredFields(section, REQUIRED_DATI_TRASMISSIONE, 'DatiTrasmissione');

    // IdTrasmittente
    const idTrasmittente = this.extractSection(section, 'IdTrasmittente');
    if (idTrasmittente) {
      const idPaese = this.extractValue(idTrasmittente, 'IdPaese');
      const idCodice = this.extractValue(idTrasmittente, 'IdCodice');

      if (!idPaese) {
        this.addError('IdPaese mancante in IdTrasmittente', undefined, 'DatiTrasmissione/IdTrasmittente');
      } else if (!/^[A-Z]{2}$/.test(idPaese)) {
        this.addError(`IdPaese non valido: ${idPaese}. Deve essere codice ISO 3166-1 alpha-2`, undefined, 'DatiTrasmissione/IdTrasmittente');
      }

      if (!idCodice) {
        this.addError('IdCodice mancante in IdTrasmittente', undefined, 'DatiTrasmissione/IdTrasmittente');
      }
    }

    // FormatoTrasmissione
    const formatoTrasmissione = this.extractValue(section, 'FormatoTrasmissione');
    if (formatoTrasmissione && !VALID_FORMATO_TRASMISSIONE.includes(formatoTrasmissione)) {
      this.addError(`FormatoTrasmissione non valido: ${formatoTrasmissione}`, undefined, 'DatiTrasmissione');
    }

    // CodiceDestinatario
    const codiceDestinatario = this.extractValue(section, 'CodiceDestinatario');
    if (codiceDestinatario) {
      if (versione === 'FPA12' && codiceDestinatario.length !== 6) {
        this.addError('CodiceDestinatario per PA deve essere 6 caratteri', undefined, 'DatiTrasmissione');
      } else if (versione === 'FPR12' && codiceDestinatario.length !== 7) {
        this.addError('CodiceDestinatario per privati deve essere 7 caratteri', undefined, 'DatiTrasmissione');
      }
    }

    // PECDestinatario (se CodiceDestinatario è 0000000)
    if (codiceDestinatario === '0000000') {
      const pecDestinatario = this.extractValue(section, 'PECDestinatario');
      if (!pecDestinatario) {
        // Non è un errore, ma potrebbe essere utile un warning
        // La PEC può essere omessa se il destinatario non ha PEC
      } else if (!this.isValidEmail(pecDestinatario)) {
        this.addError(`PECDestinatario non valida: ${pecDestinatario}`, undefined, 'DatiTrasmissione');
      }
    }
  }

  private validateCedentePrestatore(section: string | null): void {
    if (!section) {
      this.addError('CedentePrestatore mancante', undefined, 'FatturaElettronicaHeader');
      return;
    }

    // Campi obbligatori
    this.validateRequiredFields(section, REQUIRED_CEDENTE_PRESTATORE, 'CedentePrestatore');

    // DatiAnagrafici
    const datiAnagrafici = this.extractSection(section, 'DatiAnagrafici');
    if (datiAnagrafici) {
      this.validateRequiredFields(datiAnagrafici, REQUIRED_CEDENTE_DATI_ANAGRAFICI, 'CedentePrestatore/DatiAnagrafici');

      // IdFiscaleIVA
      const idFiscaleIVA = this.extractSection(datiAnagrafici, 'IdFiscaleIVA');
      if (idFiscaleIVA) {
        const idPaese = this.extractValue(idFiscaleIVA, 'IdPaese');
        const idCodice = this.extractValue(idFiscaleIVA, 'IdCodice');

        if (idPaese === 'IT' && idCodice && !this.isValidPartitaIva(idCodice)) {
          this.addError(`Partita IVA cedente non valida: ${idCodice}`, undefined, 'CedentePrestatore/DatiAnagrafici/IdFiscaleIVA');
        }
      }

      // RegimeFiscale
      const regimeFiscale = this.extractValue(datiAnagrafici, 'RegimeFiscale');
      if (regimeFiscale && !VALID_REGIME_FISCALE.includes(regimeFiscale)) {
        this.addError(`RegimeFiscale non valido: ${regimeFiscale}`, undefined, 'CedentePrestatore/DatiAnagrafici');
      }

      // Anagrafica - almeno Denominazione o Nome+Cognome
      const anagrafica = this.extractSection(datiAnagrafici, 'Anagrafica');
      if (anagrafica) {
        const denominazione = this.extractValue(anagrafica, 'Denominazione');
        const nome = this.extractValue(anagrafica, 'Nome');
        const cognome = this.extractValue(anagrafica, 'Cognome');

        if (!denominazione && (!nome || !cognome)) {
          this.addError('Anagrafica: specificare Denominazione oppure Nome e Cognome', undefined, 'CedentePrestatore/DatiAnagrafici/Anagrafica');
        }
      }
    }

    // Sede
    const sede = this.extractSection(section, 'Sede');
    if (sede) {
      this.validateSede(sede, 'CedentePrestatore/Sede');
    }
  }

  private validateCessionarioCommittente(section: string | null): void {
    if (!section) {
      this.addError('CessionarioCommittente mancante', undefined, 'FatturaElettronicaHeader');
      return;
    }

    // Campi obbligatori
    this.validateRequiredFields(section, REQUIRED_CESSIONARIO_COMMITTENTE, 'CessionarioCommittente');

    // DatiAnagrafici
    const datiAnagrafici = this.extractSection(section, 'DatiAnagrafici');
    if (datiAnagrafici) {
      // Almeno IdFiscaleIVA o CodiceFiscale
      const idFiscaleIVA = this.extractSection(datiAnagrafici, 'IdFiscaleIVA');
      const codiceFiscale = this.extractValue(datiAnagrafici, 'CodiceFiscale');

      if (!idFiscaleIVA && !codiceFiscale) {
        this.addError('Cessionario: specificare almeno IdFiscaleIVA o CodiceFiscale', undefined, 'CessionarioCommittente/DatiAnagrafici');
      }

      // Validazione Codice Fiscale italiano
      if (codiceFiscale && !this.isValidCodiceFiscale(codiceFiscale)) {
        this.addError(`Codice Fiscale non valido: ${codiceFiscale}`, undefined, 'CessionarioCommittente/DatiAnagrafici');
      }
    }

    // Sede
    const sede = this.extractSection(section, 'Sede');
    if (sede) {
      this.validateSede(sede, 'CessionarioCommittente/Sede');
    }
  }

  private validateSede(section: string, path: string): void {
    this.validateRequiredFields(section, REQUIRED_SEDE, path);

    // CAP
    const cap = this.extractValue(section, 'CAP');
    if (cap) {
      const nazione = this.extractValue(section, 'Nazione');
      if (nazione === 'IT' && !/^\d{5}$/.test(cap)) {
        this.addError(`CAP non valido per Italia: ${cap}`, undefined, path);
      }
    }

    // Provincia (obbligatoria per Italia)
    const nazione = this.extractValue(section, 'Nazione');
    if (nazione === 'IT') {
      const provincia = this.extractValue(section, 'Provincia');
      if (!provincia) {
        this.addError('Provincia obbligatoria per indirizzi italiani', undefined, path);
      } else if (!/^[A-Z]{2}$/.test(provincia)) {
        this.addError(`Provincia deve essere sigla 2 caratteri: ${provincia}`, undefined, path);
      }
    }
  }

  // ============================================
  // BODY VALIDATION
  // ============================================

  private validateBody(parsed: Record<string, any>): void {
    if (!parsed.body) return;

    // DatiGenerali
    this.validateDatiGenerali(parsed.datiGenerali);

    // DatiBeniServizi
    this.validateDatiBeniServizi(parsed.datiBeniServizi);

    // DatiPagamento (opzionale ma se presente deve essere valido)
    if (parsed.datiPagamento) {
      this.validateDatiPagamento(parsed.datiPagamento);
    }
  }

  private validateDatiGenerali(section: string | null): void {
    if (!section) {
      this.addError('DatiGenerali mancante', undefined, 'FatturaElettronicaBody');
      return;
    }

    // DatiGeneraliDocumento
    const datiDoc = this.extractSection(section, 'DatiGeneraliDocumento');
    if (!datiDoc) {
      this.addError('DatiGeneraliDocumento mancante', undefined, 'DatiGenerali');
      return;
    }

    this.validateRequiredFields(datiDoc, REQUIRED_DATI_GENERALI_DOCUMENTO, 'DatiGeneraliDocumento');

    // TipoDocumento
    const tipoDocumento = this.extractValue(datiDoc, 'TipoDocumento');
    if (tipoDocumento && !VALID_TIPO_DOCUMENTO.includes(tipoDocumento)) {
      this.addError(`TipoDocumento non valido: ${tipoDocumento}`, undefined, 'DatiGeneraliDocumento');
    }

    // Divisa
    const divisa = this.extractValue(datiDoc, 'Divisa');
    if (divisa && !/^[A-Z]{3}$/.test(divisa)) {
      this.addError(`Divisa deve essere codice ISO 4217 (3 caratteri): ${divisa}`, undefined, 'DatiGeneraliDocumento');
    }

    // Data
    const data = this.extractValue(datiDoc, 'Data');
    if (data && !this.isValidDate(data)) {
      this.addError(`Data non valida: ${data}. Formato: YYYY-MM-DD`, undefined, 'DatiGeneraliDocumento');
    }

    // DatiRitenuta (se presente)
    const datiRitenuta = this.extractSection(datiDoc, 'DatiRitenuta');
    if (datiRitenuta) {
      const tipoRitenuta = this.extractValue(datiRitenuta, 'TipoRitenuta');
      if (tipoRitenuta && !VALID_TIPO_RITENUTA.includes(tipoRitenuta)) {
        this.addError(`TipoRitenuta non valido: ${tipoRitenuta}`, undefined, 'DatiRitenuta');
      }
    }

    // DatiCassaPrevidenziale (se presente)
    const datiCassa = this.extractAllSections(datiDoc, 'DatiCassaPrevidenziale');
    for (const cassa of datiCassa) {
      const tipoCassa = this.extractValue(cassa, 'TipoCassa');
      if (tipoCassa && !VALID_TIPO_CASSA.includes(tipoCassa)) {
        this.addError(`TipoCassa non valido: ${tipoCassa}`, undefined, 'DatiCassaPrevidenziale');
      }
    }
  }

  private validateDatiBeniServizi(section: string | null): void {
    if (!section) {
      this.addError('DatiBeniServizi mancante', undefined, 'FatturaElettronicaBody');
      return;
    }

    // DettaglioLinee
    const linee = this.extractAllSections(section, 'DettaglioLinee');
    if (linee.length === 0) {
      this.addError('Almeno una riga DettaglioLinee obbligatoria', undefined, 'DatiBeniServizi');
    }

    const numeriLinea = new Set<number>();
    for (let i = 0; i < linee.length; i++) {
      const linea = linee[i];
      this.validateDettaglioLinea(linea, i + 1, numeriLinea);
    }

    // DatiRiepilogo
    const riepiloghi = this.extractAllSections(section, 'DatiRiepilogo');
    if (riepiloghi.length === 0) {
      this.addError('Almeno un DatiRiepilogo obbligatorio', undefined, 'DatiBeniServizi');
    }

    for (let i = 0; i < riepiloghi.length; i++) {
      this.validateDatiRiepilogo(riepiloghi[i], i + 1);
    }
  }

  private validateDettaglioLinea(linea: string, index: number, numeriLinea: Set<number>): void {
    const path = `DettaglioLinee[${index}]`;

    this.validateRequiredFields(linea, REQUIRED_DETTAGLIO_LINEE, path);

    // NumeroLinea univoco
    const numeroLinea = this.extractValue(linea, 'NumeroLinea');
    if (numeroLinea) {
      const num = parseInt(numeroLinea, 10);
      if (isNaN(num) || num <= 0) {
        this.addError(`NumeroLinea deve essere un intero positivo: ${numeroLinea}`, undefined, path);
      } else if (numeriLinea.has(num)) {
        this.addError(`NumeroLinea duplicato: ${num}`, undefined, path);
      } else {
        numeriLinea.add(num);
      }
    }

    // Descrizione max 1000 caratteri
    const descrizione = this.extractValue(linea, 'Descrizione');
    if (descrizione && descrizione.length > 1000) {
      this.addError('Descrizione supera 1000 caratteri', undefined, path);
    }

    // AliquotaIVA
    const aliquotaIVA = this.extractValue(linea, 'AliquotaIVA');
    if (aliquotaIVA) {
      const aliquota = parseFloat(aliquotaIVA);
      if (isNaN(aliquota) || aliquota < 0 || aliquota > 100) {
        this.addError(`AliquotaIVA non valida: ${aliquotaIVA}`, undefined, path);
      }

      // Se aliquota è 0, deve essere specificata Natura
      if (aliquota === 0) {
        const natura = this.extractValue(linea, 'Natura');
        if (!natura) {
          this.addError('Natura obbligatoria per AliquotaIVA = 0', undefined, path);
        } else if (!VALID_NATURA.includes(natura)) {
          this.addError(`Natura non valida: ${natura}`, undefined, path);
        }
      }
    }

    // PrezzoUnitario e PrezzoTotale devono essere decimali validi
    const prezzoUnitario = this.extractValue(linea, 'PrezzoUnitario');
    if (prezzoUnitario && isNaN(parseFloat(prezzoUnitario))) {
      this.addError(`PrezzoUnitario non valido: ${prezzoUnitario}`, undefined, path);
    }

    const prezzoTotale = this.extractValue(linea, 'PrezzoTotale');
    if (prezzoTotale && isNaN(parseFloat(prezzoTotale))) {
      this.addError(`PrezzoTotale non valido: ${prezzoTotale}`, undefined, path);
    }
  }

  private validateDatiRiepilogo(riepilogo: string, index: number): void {
    const path = `DatiRiepilogo[${index}]`;

    this.validateRequiredFields(riepilogo, REQUIRED_DATI_RIEPILOGO, path);

    // AliquotaIVA
    const aliquotaIVA = this.extractValue(riepilogo, 'AliquotaIVA');
    if (aliquotaIVA) {
      const aliquota = parseFloat(aliquotaIVA);
      if (isNaN(aliquota) || aliquota < 0 || aliquota > 100) {
        this.addError(`AliquotaIVA non valida: ${aliquotaIVA}`, undefined, path);
      }

      // Se aliquota è 0, deve essere specificata Natura
      if (aliquota === 0) {
        const natura = this.extractValue(riepilogo, 'Natura');
        if (!natura) {
          this.addError('Natura obbligatoria per AliquotaIVA = 0', undefined, path);
        } else if (!VALID_NATURA.includes(natura)) {
          this.addError(`Natura non valida: ${natura}`, undefined, path);
        }
      }
    }

    // EsigibilitaIVA
    const esigibilita = this.extractValue(riepilogo, 'EsigibilitaIVA');
    if (esigibilita && !VALID_ESIGIBILITA_IVA.includes(esigibilita)) {
      this.addError(`EsigibilitaIVA non valida: ${esigibilita}`, undefined, path);
    }

    // Importi devono essere decimali
    const imponibile = this.extractValue(riepilogo, 'ImponibileImporto');
    if (imponibile && isNaN(parseFloat(imponibile))) {
      this.addError(`ImponibileImporto non valido: ${imponibile}`, undefined, path);
    }

    const imposta = this.extractValue(riepilogo, 'Imposta');
    if (imposta && isNaN(parseFloat(imposta))) {
      this.addError(`Imposta non valida: ${imposta}`, undefined, path);
    }
  }

  private validateDatiPagamento(section: string): void {
    // CondizioniPagamento
    const condizioni = this.extractValue(section, 'CondizioniPagamento');
    if (!condizioni) {
      this.addError('CondizioniPagamento mancante', undefined, 'DatiPagamento');
    } else if (!VALID_CONDIZIONI_PAGAMENTO.includes(condizioni)) {
      this.addError(`CondizioniPagamento non valido: ${condizioni}`, undefined, 'DatiPagamento');
    }

    // DettaglioPagamento
    const dettagli = this.extractAllSections(section, 'DettaglioPagamento');
    if (dettagli.length === 0) {
      this.addError('Almeno un DettaglioPagamento obbligatorio', undefined, 'DatiPagamento');
    }

    for (let i = 0; i < dettagli.length; i++) {
      this.validateDettaglioPagamento(dettagli[i], i + 1);
    }
  }

  private validateDettaglioPagamento(dettaglio: string, index: number): void {
    const path = `DettaglioPagamento[${index}]`;

    // ModalitaPagamento obbligatorio
    const modalita = this.extractValue(dettaglio, 'ModalitaPagamento');
    if (!modalita) {
      this.addError('ModalitaPagamento mancante', undefined, path);
    } else if (!VALID_MODALITA_PAGAMENTO.includes(modalita)) {
      this.addError(`ModalitaPagamento non valida: ${modalita}`, undefined, path);
    }

    // ImportoPagamento obbligatorio
    const importo = this.extractValue(dettaglio, 'ImportoPagamento');
    if (!importo) {
      this.addError('ImportoPagamento mancante', undefined, path);
    } else if (isNaN(parseFloat(importo))) {
      this.addError(`ImportoPagamento non valido: ${importo}`, undefined, path);
    }

    // IBAN (se presente, validare formato)
    const iban = this.extractValue(dettaglio, 'IBAN');
    if (iban && !this.isValidIban(iban)) {
      this.addError(`IBAN non valido: ${iban}`, undefined, path);
    }

    // DataScadenzaPagamento (se presente)
    const dataScadenza = this.extractValue(dettaglio, 'DataScadenzaPagamento');
    if (dataScadenza && !this.isValidDate(dataScadenza)) {
      this.addError(`DataScadenzaPagamento non valida: ${dataScadenza}`, undefined, path);
    }
  }

  // ============================================
  // CROSS-FIELD VALIDATION
  // ============================================

  private validateCrossFieldRules(parsed: Record<string, any>): void {
    // Verifica coerenza totali
    this.validateTotals(parsed);

    // Verifica coerenza aliquote tra linee e riepiloghi
    this.validateAliquoteCoherence(parsed);
  }

  private validateTotals(parsed: Record<string, any>): void {
    if (!parsed.datiBeniServizi) return;

    const datiDoc = parsed.datiGenerali ? this.extractSection(parsed.datiGenerali, 'DatiGeneraliDocumento') : null;
    if (!datiDoc) return;

    const importoTotaleDocumento = this.extractValue(datiDoc, 'ImportoTotaleDocumento');
    if (!importoTotaleDocumento) return;

    const totaleDocumento = parseFloat(importoTotaleDocumento);
    if (isNaN(totaleDocumento)) return;

    // Calcola totale da riepiloghi
    const riepiloghi = this.extractAllSections(parsed.datiBeniServizi, 'DatiRiepilogo');
    let totaleCalcolato = 0;
    for (const riepilogo of riepiloghi) {
      const imponibile = parseFloat(this.extractValue(riepilogo, 'ImponibileImporto') || '0');
      const imposta = parseFloat(this.extractValue(riepilogo, 'Imposta') || '0');
      totaleCalcolato += imponibile + imposta;
    }

    // Tolleranza per arrotondamenti
    const diff = Math.abs(totaleDocumento - totaleCalcolato);
    if (diff > 0.02) { // tolleranza 2 centesimi
      this.addError(
        `ImportoTotaleDocumento (${totaleDocumento.toFixed(2)}) non corrisponde alla somma dei riepiloghi (${totaleCalcolato.toFixed(2)})`,
        undefined,
        'DatiGeneraliDocumento'
      );
    }
  }

  private validateAliquoteCoherence(parsed: Record<string, any>): void {
    if (!parsed.datiBeniServizi) return;

    // Raccogli aliquote dalle linee
    const linee = this.extractAllSections(parsed.datiBeniServizi, 'DettaglioLinee');
    const aliquoteLinee = new Set<string>();
    for (const linea of linee) {
      const aliquota = this.extractValue(linea, 'AliquotaIVA');
      if (aliquota) {
        aliquoteLinee.add(parseFloat(aliquota).toFixed(2));
      }
    }

    // Raccogli aliquote dai riepiloghi
    const riepiloghi = this.extractAllSections(parsed.datiBeniServizi, 'DatiRiepilogo');
    const aliquoteRiepiloghi = new Set<string>();
    for (const riepilogo of riepiloghi) {
      const aliquota = this.extractValue(riepilogo, 'AliquotaIVA');
      if (aliquota) {
        aliquoteRiepiloghi.add(parseFloat(aliquota).toFixed(2));
      }
    }

    // Verifica che ogni aliquota nelle linee abbia un riepilogo corrispondente
    for (const aliquota of aliquoteLinee) {
      if (!aliquoteRiepiloghi.has(aliquota)) {
        this.addError(
          `Aliquota IVA ${aliquota}% presente nelle linee ma mancante nei riepiloghi`,
          undefined,
          'DatiBeniServizi'
        );
      }
    }
  }

  // ============================================
  // VALIDATION UTILITIES
  // ============================================

  private validateRequiredFields(section: string, fields: string[], path: string): void {
    for (const field of fields) {
      if (!this.hasElement(section, field)) {
        this.addError(`Campo obbligatorio mancante: ${field}`, undefined, path);
      }
    }
  }

  private isValidPartitaIva(piva: string): boolean {
    // Partita IVA italiana: 11 cifre con check digit
    if (!/^\d{11}$/.test(piva)) return false;

    // Algoritmo di validazione
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(piva[i], 10);
      if (i % 2 === 0) {
        sum += digit;
      } else {
        const doubled = digit * 2;
        sum += doubled > 9 ? doubled - 9 : doubled;
      }
    }
    return sum % 10 === 0;
  }

  private isValidCodiceFiscale(cf: string): boolean {
    // Codice fiscale: 16 caratteri alfanumerici o 11 cifre (per aziende)
    if (/^\d{11}$/.test(cf)) {
      return this.isValidPartitaIva(cf); // Stesso algoritmo per aziende
    }

    // Persone fisiche: 16 caratteri
    if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(cf)) {
      return false;
    }

    // Validazione con check character
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const evenValues: Record<string, number> = {};
    const oddValues: Record<string, number> = {};

    for (let i = 0; i < 26; i++) {
      evenValues[validChars[i]] = i;
      evenValues[i.toString()] = i;
    }

    const oddValuesArray = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
    for (let i = 0; i < 26; i++) {
      oddValues[validChars[i]] = oddValuesArray[i];
    }
    for (let i = 0; i < 10; i++) {
      oddValues[i.toString()] = oddValuesArray[i];
    }

    const cfUpper = cf.toUpperCase();
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      const char = cfUpper[i];
      sum += i % 2 === 0 ? oddValues[char] : evenValues[char];
    }

    const checkChar = validChars[sum % 26];
    return cfUpper[15] === checkChar;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidDate(date: string): boolean {
    // Formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  private isValidIban(iban: string): boolean {
    // IBAN italiano: IT + 2 cifre check + 1 lettera + 5 cifre + 5 alfanumerici + 12 alfanumerici = 27 caratteri
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();

    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleanIban)) return false;

    // IBAN italiano deve essere 27 caratteri
    if (cleanIban.startsWith('IT') && cleanIban.length !== 27) return false;

    // Algoritmo di validazione IBAN (mod 97)
    const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
    let numericIban = '';
    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numericIban += (char.charCodeAt(0) - 55).toString();
      } else {
        numericIban += char;
      }
    }

    // Calcolo mod 97 per numeri grandi
    let remainder = 0;
    for (let i = 0; i < numericIban.length; i++) {
      remainder = (remainder * 10 + parseInt(numericIban[i], 10)) % 97;
    }

    return remainder === 1;
  }

  private addError(message: string, line?: number, path?: string): void {
    this.errors.push({
      message,
      line,
      path,
    });
  }
}

export const fatturaPaValidatorService = new FatturaPaValidatorService();
