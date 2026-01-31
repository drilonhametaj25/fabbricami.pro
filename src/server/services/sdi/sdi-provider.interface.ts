/**
 * SDI Provider Interface
 * Interfaccia comune per tutti i provider di fatturazione elettronica (Aruba, Infocert, etc.)
 */

import { SdiStatus, FatturapaDocumentType, PaymentMethodPA } from '@prisma/client';

// ============================================
// TYPES & INTERFACES
// ============================================

/**
 * Dati cedente/prestatore (chi emette la fattura)
 */
export interface CedentePrestatoreData {
  // Dati anagrafici
  denominazione?: string;           // Ragione sociale (per aziende)
  nome?: string;                    // Nome (per persone fisiche)
  cognome?: string;                 // Cognome (per persone fisiche)

  // Identificativi fiscali
  partitaIva: string;
  codiceFiscale?: string;

  // Sede legale
  indirizzo: string;
  numeroCivico?: string;
  cap: string;
  comune: string;
  provincia: string;                // Sigla 2 caratteri (MI, RM, etc)
  nazione: string;                  // ISO 3166-1 alpha-2 (IT)

  // Contatti
  telefono?: string;
  email?: string;
  pec?: string;

  // REA
  reaUfficio?: string;              // Es: MI
  reaNumero?: string;               // Es: 1234567
  capitaleSociale?: number;
  socioUnico?: 'SU' | 'SM';         // SU = socio unico, SM = più soci
  statoLiquidazione?: 'LS' | 'LN';  // LS = in liquidazione, LN = non in liquidazione

  // Regime fiscale
  regimeFiscale: string;            // RF01, RF02, ..., RF19
}

/**
 * Dati cessionario/committente (chi riceve la fattura)
 */
export interface CessionarioCommittenteData {
  // Dati anagrafici
  denominazione?: string;           // Ragione sociale (per aziende)
  nome?: string;                    // Nome (per persone fisiche)
  cognome?: string;                 // Cognome (per persone fisiche)

  // Identificativi fiscali
  partitaIva?: string;
  codiceFiscale?: string;

  // Sede
  indirizzo: string;
  numeroCivico?: string;
  cap: string;
  comune: string;
  provincia?: string;               // Sigla 2 caratteri (opzionale per esteri)
  nazione: string;                  // ISO 3166-1 alpha-2

  // Destinatario SDI
  codiceDestinatario?: string;      // Codice SDI 7 caratteri (0000000 se PEC)
  pecDestinatario?: string;         // PEC alternativa a codice SDI
}

/**
 * Riga dettaglio fattura
 */
export interface DettaglioLineaData {
  numeroLinea: number;

  // Descrizione
  descrizione: string;

  // Quantità e prezzo
  quantita?: number;
  unitaMisura?: string;
  prezzoUnitario: number;
  prezzoTotale: number;

  // Sconti/Maggiorazioni
  scontoMaggiorazione?: Array<{
    tipo: 'SC' | 'MG';              // SC = sconto, MG = maggiorazione
    percentuale?: number;
    importo?: number;
  }>;

  // IVA
  aliquotaIva: number;              // Es: 22.00, 10.00, 4.00, 0.00
  natura?: string;                  // N1, N2, N3, N4, N5, N6, N7 (per aliquota 0)

  // Riferimenti
  riferimentoAmministrazione?: string;

  // Ritenuta (se applicabile alla linea)
  ritenuta?: 'SI';

  // Dati ordine/DDT
  datiOrdineAcquisto?: {
    riferimentoNumeroLinea?: number;
    idDocumento?: string;
    data?: Date;
    numItem?: string;
    codiceCommessaConvenzione?: string;
    codiceCup?: string;
    codiceCig?: string;
  };

  datiDdt?: {
    riferimentoNumeroLinea?: number;
    numeroDdt: string;
    dataDdt: Date;
  };
}

/**
 * Riepilogo IVA per aliquota
 */
export interface DatiRiepilogoData {
  aliquotaIva: number;
  natura?: string;                  // N1-N7 per operazioni esenti/non imponibili
  imponibileImporto: number;
  imposta: number;
  esigibilitaIva?: 'I' | 'D' | 'S'; // I=immediata, D=differita, S=scissione
  riferimentoNormativo?: string;    // Riferimento normativo per esenzione
}

/**
 * Dati pagamento
 */
export interface DatiPagamentoData {
  condizioniPagamento: 'TP01' | 'TP02' | 'TP03'; // TP01=pagamento a rate, TP02=completo, TP03=anticipo
  dettaglioPagamento: Array<{
    modalitaPagamento: PaymentMethodPA;
    dataRiferimentoTerminiPagamento?: Date;
    giorniTerminiPagamento?: number;
    dataScadenzaPagamento?: Date;
    importoPagamento: number;
    istitutoFinanziario?: string;
    iban?: string;
    abi?: string;
    cab?: string;
    bic?: string;
    codicePagamento?: string;
  }>;
}

/**
 * Dati bollo
 */
export interface DatiBolloData {
  bolloVirtuale: 'SI';
  importoBollo: number;             // Normalmente 2.00 EUR
}

/**
 * Dati cassa previdenziale
 */
export interface DatiCassaPrevidenziale {
  tipoCassa: string;                // TC01, TC02, etc.
  alCassa: number;                  // Percentuale
  importoContributoCassa: number;
  imponibileCassa?: number;
  aliquotaIva: number;
  ritenuta?: 'SI';
  natura?: string;
  riferimentoAmministrazione?: string;
}

/**
 * Dati ritenuta d'acconto
 */
export interface DatiRitenutaData {
  tipoRitenuta: 'RT01' | 'RT02' | 'RT03' | 'RT04' | 'RT05' | 'RT06';
  importoRitenuta: number;
  aliquotaRitenuta: number;
  causalePagamento: string;         // A, B, C, D, E, etc.
}

/**
 * Input completo per generazione XML FatturaPA
 */
export interface FatturapaInput {
  // Tipo documento
  tipoDocumento: FatturapaDocumentType;

  // Soggetti
  cedentePrestatore: CedentePrestatoreData;
  cessionarioCommittente: CessionarioCommittenteData;

  // Dati generali documento
  divisa: string;                   // EUR
  data: Date;
  numero: string;                   // Numero fattura

  // Causale (max 200 caratteri per blocco, si possono avere più blocchi)
  causale?: string[];

  // Righe dettaglio
  dettaglioLinee: DettaglioLineaData[];

  // Riepiloghi IVA
  datiRiepilogo: DatiRiepilogoData[];

  // Totale documento
  importoTotaleDocumento?: number;
  arrotondamento?: number;

  // Bollo
  datiBollo?: DatiBolloData;

  // Cassa previdenziale
  datiCassaPrevidenziale?: DatiCassaPrevidenziale[];

  // Ritenuta d'acconto
  datiRitenuta?: DatiRitenutaData;

  // Pagamento
  datiPagamento?: DatiPagamentoData;

  // Riferimenti DDT (per fatture differite)
  datiDdt?: Array<{
    numeroDdt: string;
    dataDdt: Date;
    riferimentoNumeroLinea?: number[];
  }>;

  // Riferimenti ordine
  datiOrdineAcquisto?: Array<{
    riferimentoNumeroLinea?: number[];
    idDocumento: string;
    data?: Date;
    numItem?: string;
    codiceCommessaConvenzione?: string;
    codiceCup?: string;
    codiceCig?: string;
  }>;

  // Allegati
  allegati?: Array<{
    nomeAttachment: string;
    formatoAttachment?: string;
    descrizioneAttachment?: string;
    attachment: string;             // Base64 encoded
  }>;
}

/**
 * Risultato generazione XML
 */
export interface XmlGenerationResult {
  success: boolean;
  xml?: string;
  fileName?: string;                // IT01234567890_XXXXX.xml
  errors?: string[];
}

/**
 * Risultato validazione XSD
 */
export interface XsdValidationResult {
  valid: boolean;
  errors?: Array<{
    line?: number;
    column?: number;
    message: string;
  }>;
}

/**
 * Notifica SDI ricevuta
 */
export interface SdiNotification {
  tipo: 'RC' | 'NS' | 'MC' | 'NE' | 'AT' | 'DT' | 'EC';
  identificativoSdi?: string;
  nomeFile?: string;
  dataOraRicezione?: Date;
  dataOraConsegna?: Date;
  destinatario?: string;
  // Per notifiche di scarto (NS)
  listaErrori?: Array<{
    codice: string;
    descrizione: string;
  }>;
  // Per esito committente (EC)
  esito?: 'EC01' | 'EC02';          // EC01=accettata, EC02=rifiutata
  // Contenuto XML originale
  xmlContent?: string;
}

/**
 * Risultato invio fattura
 */
export interface SendInvoiceResult {
  success: boolean;
  sdiId?: string;                   // Identificativo assegnato da SDI
  fileName?: string;
  sentAt?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Stato fattura da SDI
 */
export interface InvoiceStatusResult {
  status: SdiStatus;
  sdiId?: string;
  notifications: SdiNotification[];
  lastUpdate?: Date;
}

// ============================================
// SDI PROVIDER INTERFACE
// ============================================

/**
 * Interfaccia per i provider SDI (Aruba, Infocert, etc.)
 */
export interface ISdiProvider {
  /**
   * Nome del provider
   */
  readonly name: string;

  /**
   * Verifica se il provider è configurato correttamente
   */
  isConfigured(): boolean;

  /**
   * Invia una fattura al Sistema di Interscambio
   * @param xml XML della fattura FatturaPA
   * @param fileName Nome file (IT + P.IVA + _XXXXX.xml)
   */
  sendInvoice(xml: string, fileName: string): Promise<SendInvoiceResult>;

  /**
   * Recupera lo stato di una fattura
   * @param sdiId Identificativo SDI della fattura
   */
  getInvoiceStatus(sdiId: string): Promise<InvoiceStatusResult>;

  /**
   * Recupera le notifiche per una fattura
   * @param sdiId Identificativo SDI della fattura
   */
  getNotifications(sdiId: string): Promise<SdiNotification[]>;

  /**
   * Verifica lo stato della connessione con SDI
   */
  testConnection(): Promise<{ connected: boolean; message?: string }>;
}

/**
 * Configurazione provider SDI
 */
export interface SdiProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  environment?: 'sandbox' | 'production';
  webhookUrl?: string;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Regimi fiscali FatturaPA
 */
export const REGIMI_FISCALI = {
  RF01: 'Ordinario',
  RF02: 'Contribuenti minimi (art.1 c.96-117 L.244/2007)',
  RF04: 'Agricoltura e attività connesse e pesca (artt.34 e 34-bis DPR 633/72)',
  RF05: 'Vendita sali e tabacchi (art.74 c.1 DPR 633/72)',
  RF06: 'Commercio fiammiferi (art.74 c.1 DPR 633/72)',
  RF07: 'Editoria (art.74 c.1 DPR 633/72)',
  RF08: 'Gestione servizi telefonia pubblica (art.74 c.1 DPR 633/72)',
  RF09: 'Rivendita documenti di trasporto e sosta (art.74 c.1 DPR 633/72)',
  RF10: 'Intrattenimenti, giochi e altre attività (art.74 c.6 DPR 633/72)',
  RF11: 'Agenzie viaggi e turismo (art.74-ter DPR 633/72)',
  RF12: 'Agriturismo (art.5 c.2 L.413/91)',
  RF13: 'Vendite a domicilio (art.25-bis c.6 DPR 600/73)',
  RF14: 'Rivendita beni usati, oggetti d\'arte, antiquariato, collezione (art.36 DL 41/95)',
  RF15: 'Agenzie di vendite all\'asta di oggetti d\'arte, antiquariato, collezione (art.40-bis DL 41/95)',
  RF16: 'IVA per cassa P.A. (art.6 c.5 DPR 633/72)',
  RF17: 'IVA per cassa (art.32-bis DL 83/2012)',
  RF18: 'Altro',
  RF19: 'Regime forfettario (art.1 c.54-89 L.190/2014)',
} as const;

/**
 * Tipi documento FatturaPA
 */
export const TIPI_DOCUMENTO = {
  TD01: 'Fattura',
  TD02: 'Acconto/Anticipo su fattura',
  TD03: 'Acconto/Anticipo su parcella',
  TD04: 'Nota di credito',
  TD05: 'Nota di debito',
  TD06: 'Parcella',
  TD16: 'Integrazione fattura reverse charge interno',
  TD17: 'Integrazione/autofattura per acquisto servizi dall\'estero',
  TD18: 'Integrazione per acquisto di beni intracomunitari',
  TD19: 'Integrazione/autofattura per acquisto di beni ex art.17 c.2 DPR 633/72',
  TD20: 'Autofattura per regolarizzazione e integrazione delle fatture',
  TD24: 'Fattura differita di cui all\'art.21 c.4 lett.a',
  TD25: 'Fattura differita di cui all\'art.21 c.4 terzo periodo lett.b',
  TD26: 'Cessione di beni ammortizzabili e per passaggi interni',
  TD27: 'Fattura per autoconsumo o per cessioni gratuite senza rivalsa',
} as const;

/**
 * Nature IVA (per operazioni a aliquota 0)
 */
export const NATURE_IVA = {
  N1: 'Escluse ex art.15',
  N2: 'Non soggette (N2.1 e N2.2 per dettaglio)',
  'N2.1': 'Non soggette ad IVA ai sensi artt. da 7 a 7-septies DPR 633/72',
  'N2.2': 'Non soggette - altri casi',
  N3: 'Non imponibili (N3.1 a N3.6 per dettaglio)',
  'N3.1': 'Non imponibili - esportazioni',
  'N3.2': 'Non imponibili - cessioni intracomunitarie',
  'N3.3': 'Non imponibili - cessioni verso San Marino',
  'N3.4': 'Non imponibili - operazioni assimilate alle cessioni all\'esportazione',
  'N3.5': 'Non imponibili - a seguito di dichiarazioni d\'intento',
  'N3.6': 'Non imponibili - altre operazioni che non concorrono alla formazione del plafond',
  N4: 'Esenti',
  N5: 'Regime del margine / IVA non esposta in fattura',
  N6: 'Inversione contabile (N6.1 a N6.9 per dettaglio)',
  'N6.1': 'Inversione contabile - cessione di rottami e altri materiali di recupero',
  'N6.2': 'Inversione contabile - cessione di oro e argento puro',
  'N6.3': 'Inversione contabile - subappalto nel settore edile',
  'N6.4': 'Inversione contabile - cessione di fabbricati',
  'N6.5': 'Inversione contabile - cessione di telefoni cellulari',
  'N6.6': 'Inversione contabile - cessione di prodotti elettronici',
  'N6.7': 'Inversione contabile - prestazioni comparto edile e settori connessi',
  'N6.8': 'Inversione contabile - operazioni settore energetico',
  'N6.9': 'Inversione contabile - altri casi',
  N7: 'IVA assolta in altro stato UE',
} as const;

/**
 * Modalità pagamento FatturaPA
 */
export const MODALITA_PAGAMENTO = {
  MP01: 'Contanti',
  MP02: 'Assegno',
  MP03: 'Assegno circolare',
  MP04: 'Contanti presso Tesoreria',
  MP05: 'Bonifico',
  MP06: 'Vaglia cambiario',
  MP07: 'Bollettino bancario',
  MP08: 'Carta di pagamento',
  MP09: 'RID',
  MP10: 'RID utenze',
  MP11: 'RID veloce',
  MP12: 'RIBA',
  MP13: 'MAV',
  MP14: 'Quietanza erario',
  MP15: 'Giroconto su conti di contabilità speciale',
  MP16: 'Domiciliazione bancaria',
  MP17: 'Domiciliazione postale',
  MP18: 'Bollettino di c/c postale',
  MP19: 'SEPA Direct Debit',
  MP20: 'SEPA Direct Debit CORE',
  MP21: 'SEPA Direct Debit B2B',
  MP22: 'Trattenuta su somme già riscosse',
  MP23: 'PagoPA',
} as const;

/**
 * Tipi cassa previdenziale
 */
export const TIPI_CASSA = {
  TC01: 'Cassa nazionale previdenza e assistenza avvocati e procuratori legali',
  TC02: 'Cassa previdenza dottori commercialisti',
  TC03: 'Cassa previdenza e assistenza geometri',
  TC04: 'Cassa nazionale previdenza e assistenza ingegneri e architetti liberi professionisti',
  TC05: 'Cassa nazionale del notariato',
  TC06: 'Cassa nazionale previdenza e assistenza ragionieri e periti commerciali',
  TC07: 'Ente nazionale assistenza agenti e rappresentanti di commercio (ENASARCO)',
  TC08: 'Ente nazionale previdenza e assistenza consulenti del lavoro (ENPACL)',
  TC09: 'Ente nazionale previdenza e assistenza medici (ENPAM)',
  TC10: 'Ente nazionale previdenza e assistenza farmacisti (ENPAF)',
  TC11: 'Ente nazionale previdenza e assistenza veterinari (ENPAV)',
  TC12: 'Ente nazionale previdenza e assistenza impiegati dell\'agricoltura (ENPAIA)',
  TC13: 'Fondo previdenza impiegati imprese di spedizione e agenzie marittime',
  TC14: 'Istituto nazionale previdenza giornalisti italiani (INPGI)',
  TC15: 'Opera nazionale assistenza orfani sanitari italiani (ONAOSI)',
  TC16: 'Cassa autonoma assistenza integrativa giornalisti italiani (CASAGIT)',
  TC17: 'Ente previdenza periti industriali e periti industriali laureati (EPPI)',
  TC18: 'Ente previdenza e assistenza pluricategoriale (EPAP)',
  TC19: 'Ente nazionale previdenza e assistenza biologi (ENPAB)',
  TC20: 'Ente nazionale previdenza e assistenza della professione infermieristica (ENPAPI)',
  TC21: 'Ente nazionale previdenza e assistenza psicologi (ENPAP)',
  TC22: 'INPS',
} as const;

/**
 * Tipi ritenuta d'acconto
 */
export const TIPI_RITENUTA = {
  RT01: 'Ritenuta persone fisiche',
  RT02: 'Ritenuta persone giuridiche',
  RT03: 'Contributo INPS',
  RT04: 'Contributo ENASARCO',
  RT05: 'Contributo ENPAM',
  RT06: 'Altro contributo previdenziale',
} as const;
