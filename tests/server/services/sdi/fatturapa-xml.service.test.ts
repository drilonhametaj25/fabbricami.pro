/**
 * FatturaPA XML Service Tests
 * Tests for XML generation conforming to FatturaPA v1.2.2 schema
 */

// Mock logger before imports
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { fatturaPaXmlService } from '@server/services/sdi/fatturapa-xml.service';
import { FatturapaInput, CedentePrestatoreData, CessionarioCommittenteData } from '@server/services/sdi/sdi-provider.interface';
import { logger } from '@server/config/logger';

describe('FatturaPaXmlService', () => {
  // Helper to create valid base input
  // Using valid Italian Partita IVA with correct check digits (01234567897, 12345678903)
  const createValidInput = (overrides: Partial<FatturapaInput> = {}): FatturapaInput => ({
    tipoDocumento: 'TD01',
    cedentePrestatore: {
      denominazione: 'Test Company Srl',
      partitaIva: '01234567897',
      codiceFiscale: '01234567897',
      indirizzo: 'Via Test 123',
      cap: '00100',
      comune: 'Roma',
      provincia: 'RM',
      nazione: 'IT',
      regimeFiscale: 'RF01',
      email: 'test@company.it',
    },
    cessionarioCommittente: {
      denominazione: 'Cliente Test Srl',
      partitaIva: '12345678903',
      indirizzo: 'Via Cliente 456',
      cap: '20100',
      comune: 'Milano',
      provincia: 'MI',
      nazione: 'IT',
      codiceDestinatario: '0000000',
    },
    divisa: 'EUR',
    data: new Date('2026-01-15'),
    numero: 'FT-2026-0001',
    dettaglioLinee: [
      {
        numeroLinea: 1,
        descrizione: 'Prodotto di test',
        quantita: 2,
        unitaMisura: 'PZ',
        prezzoUnitario: 100.00,
        prezzoTotale: 200.00,
        aliquotaIva: 22,
      },
    ],
    datiRiepilogo: [
      {
        aliquotaIva: 22,
        imponibileImporto: 200.00,
        imposta: 44.00,
        esigibilitaIva: 'I',
      },
    ],
    importoTotaleDocumento: 244.00,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateXml', () => {
    it('should generate valid XML for standard invoice (TD01)', () => {
      const input = createValidInput();
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toBeDefined();
      expect(result.fileName).toBeDefined();
      expect(result.fileName).toMatch(/^IT\d{11}_[A-Z0-9]{5}\.xml$/);
    });

    it('should generate correct XML structure with all mandatory sections', () => {
      const input = createValidInput();
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.xml).toContain('<p:FatturaElettronica');
      expect(result.xml).toContain('versione="FPR12"');
      expect(result.xml).toContain('<FatturaElettronicaHeader>');
      expect(result.xml).toContain('<FatturaElettronicaBody>');
      expect(result.xml).toContain('<DatiTrasmissione>');
      expect(result.xml).toContain('<CedentePrestatore>');
      expect(result.xml).toContain('<CessionarioCommittente>');
      expect(result.xml).toContain('<DatiGenerali>');
      expect(result.xml).toContain('<DatiBeniServizi>');
    });

    it('should include correct cedente prestatore data', () => {
      const input = createValidInput();
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<Denominazione>Test Company Srl</Denominazione>');
      expect(result.xml).toContain('<IdCodice>01234567897</IdCodice>');
      expect(result.xml).toContain('<RegimeFiscale>RF01</RegimeFiscale>');
      expect(result.xml).toContain('<CAP>00100</CAP>');
      expect(result.xml).toContain('<Comune>Roma</Comune>');
      expect(result.xml).toContain('<Provincia>RM</Provincia>');
    });

    it('should include correct cessionario committente data', () => {
      const input = createValidInput();
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<Denominazione>Cliente Test Srl</Denominazione>');
      expect(result.xml).toContain('<CodiceDestinatario>0000000</CodiceDestinatario>');
    });

    it('should include PEC when codice destinatario is 0000000', () => {
      const input = createValidInput({
        cessionarioCommittente: {
          ...createValidInput().cessionarioCommittente,
          codiceDestinatario: '0000000',
          pecDestinatario: 'cliente@pec.it',
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<PECDestinatario>cliente@pec.it</PECDestinatario>');
    });

    it('should generate credit note (TD04) correctly', () => {
      const input = createValidInput({ tipoDocumento: 'TD04' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD04</TipoDocumento>');
    });

    it('should generate debit note (TD05) correctly', () => {
      const input = createValidInput({ tipoDocumento: 'TD05' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD05</TipoDocumento>');
    });

    it('should generate parcella (TD06) correctly', () => {
      const input = createValidInput({ tipoDocumento: 'TD06' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD06</TipoDocumento>');
    });

    it('should include bollo virtuale when present', () => {
      const input = createValidInput({
        datiBollo: {
          bolloVirtuale: 'SI',
          importoBollo: 2.00,
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<DatiBollo>');
      expect(result.xml).toContain('<BolloVirtuale>SI</BolloVirtuale>');
      expect(result.xml).toContain('<ImportoBollo>2.00</ImportoBollo>');
    });

    it('should include cassa previdenziale when present', () => {
      const input = createValidInput({
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC22',
            alCassa: 4,
            importoContributoCassa: 8.00,
            aliquotaIva: 22,
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<DatiCassaPrevidenziale>');
      expect(result.xml).toContain('<TipoCassa>TC22</TipoCassa>');
      expect(result.xml).toContain('<AlCassa>4.00</AlCassa>');
    });

    it('should include ritenuta dacconto when present', () => {
      const input = createValidInput({
        datiRitenuta: {
          tipoRitenuta: 'RT01',
          importoRitenuta: 40.00,
          aliquotaRitenuta: 20,
          causalePagamento: 'A',
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<DatiRitenuta>');
      expect(result.xml).toContain('<TipoRitenuta>RT01</TipoRitenuta>');
      expect(result.xml).toContain('<ImportoRitenuta>40.00</ImportoRitenuta>');
      expect(result.xml).toContain('<AliquotaRitenuta>20.00</AliquotaRitenuta>');
      expect(result.xml).toContain('<CausalePagamento>A</CausalePagamento>');
    });

    it('should include dati pagamento when present', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              dataScadenzaPagamento: new Date('2026-02-15'),
              importoPagamento: 244.00,
              iban: 'IT60X0542811101000000123456',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<DatiPagamento>');
      expect(result.xml).toContain('<CondizioniPagamento>TP02</CondizioniPagamento>');
      expect(result.xml).toContain('<ModalitaPagamento>MP05</ModalitaPagamento>');
      expect(result.xml).toContain('<IBAN>IT60X0542811101000000123456</IBAN>');
    });

    it('should include multiple line items correctly', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto A',
            quantita: 2,
            unitaMisura: 'PZ',
            prezzoUnitario: 100.00,
            prezzoTotale: 200.00,
            aliquotaIva: 22,
          },
          {
            numeroLinea: 2,
            descrizione: 'Prodotto B',
            quantita: 1,
            unitaMisura: 'PZ',
            prezzoUnitario: 50.00,
            prezzoTotale: 50.00,
            aliquotaIva: 22,
          },
        ],
        datiRiepilogo: [
          {
            aliquotaIva: 22,
            imponibileImporto: 250.00,
            imposta: 55.00,
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<NumeroLinea>1</NumeroLinea>');
      expect(result.xml).toContain('<NumeroLinea>2</NumeroLinea>');
      expect(result.xml).toContain('<Descrizione>Prodotto A</Descrizione>');
      expect(result.xml).toContain('<Descrizione>Prodotto B</Descrizione>');
    });

    it('should handle multiple IVA rates with natura codes', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con IVA',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 100.00,
            aliquotaIva: 22,
          },
          {
            numeroLinea: 2,
            descrizione: 'Prodotto esente',
            quantita: 1,
            prezzoUnitario: 50.00,
            prezzoTotale: 50.00,
            aliquotaIva: 0,
            natura: 'N4', // Esente
          },
        ],
        datiRiepilogo: [
          {
            aliquotaIva: 22,
            imponibileImporto: 100.00,
            imposta: 22.00,
          },
          {
            aliquotaIva: 0,
            natura: 'N4',
            imponibileImporto: 50.00,
            imposta: 0,
            riferimentoNormativo: 'Art. 10 DPR 633/72',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<Natura>N4</Natura>');
      expect(result.xml).toContain('<RiferimentoNormativo>Art. 10 DPR 633/72</RiferimentoNormativo>');
    });

    it('should include dati DDT for deferred invoices', () => {
      const input = createValidInput({
        tipoDocumento: 'TD24',
        datiDdt: [
          {
            numeroDdt: 'DDT-2026-001',
            dataDdt: new Date('2026-01-10'),
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<DatiDDT>');
      expect(result.xml).toContain('<NumeroDDT>DDT-2026-001</NumeroDDT>');
      expect(result.xml).toContain('<DataDDT>2026-01-10</DataDDT>');
    });

    it('should include allegati when present', () => {
      const input = createValidInput({
        allegati: [
          {
            nomeAttachment: 'documento.pdf',
            formatoAttachment: 'PDF',
            descrizioneAttachment: 'Documento allegato',
            attachment: 'SGVsbG8gV29ybGQ=', // Base64 "Hello World"
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.xml).toContain('<Allegati>');
      expect(result.xml).toContain('<NomeAttachment>documento.pdf</NomeAttachment>');
      expect(result.xml).toContain('<FormatoAttachment>PDF</FormatoAttachment>');
    });

    // Test for lines 50-51: error handling in catch block
    it('should catch and log errors during XML generation', () => {
      // Create an input that will cause an error during XML building
      const input = createValidInput();
      // Force an error by making data invalid (causing toISOString to fail)
      (input as any).data = 'not-a-date';

      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generateFileName', () => {
    it('should generate correct file name format', () => {
      const fileName = fatturaPaXmlService.generateFileName('12345678901', '00001');

      expect(fileName).toBe('IT12345678901_00001.xml');
    });

    it('should pad partita IVA to 11 digits', () => {
      const fileName = fatturaPaXmlService.generateFileName('123', '00001');

      expect(fileName).toBe('IT00000000123_00001.xml');
    });

    it('should uppercase and limit progressivo to 5 characters', () => {
      const fileName = fatturaPaXmlService.generateFileName('12345678901', 'abc123');

      expect(fileName).toMatch(/^IT\d{11}_[A-Z0-9]{5}\.xml$/);
    });
  });

  describe('validation', () => {
    it('should return error when partita IVA cedente is missing', () => {
      const input = createValidInput();
      input.cedentePrestatore.partitaIva = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Partita IVA cedente obbligatoria');
    });

    it('should return error when regime fiscale is missing', () => {
      const input = createValidInput();
      input.cedentePrestatore.regimeFiscale = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Regime fiscale cedente obbligatorio');
    });

    it('should return error when cedente address is incomplete', () => {
      const input = createValidInput();
      input.cedentePrestatore.cap = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Indirizzo completo cedente obbligatorio');
    });

    it('should return error when cessionario has no tax identifier', () => {
      const input = createValidInput();
      input.cessionarioCommittente.partitaIva = undefined;
      input.cessionarioCommittente.codiceFiscale = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Partita IVA o Codice Fiscale cessionario obbligatorio');
    });

    // Line 94: cessionario address incomplete
    it('should return error when cessionario address is incomplete - cap missing', () => {
      const input = createValidInput();
      input.cessionarioCommittente.cap = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Indirizzo completo cessionario obbligatorio');
    });

    it('should return error when cessionario address is incomplete - comune missing', () => {
      const input = createValidInput();
      input.cessionarioCommittente.comune = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Indirizzo completo cessionario obbligatorio');
    });

    it('should return error when cessionario address is incomplete - indirizzo missing', () => {
      const input = createValidInput();
      input.cessionarioCommittente.indirizzo = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Indirizzo completo cessionario obbligatorio');
    });

    it('should return error when numero documento is missing', () => {
      const input = createValidInput();
      input.numero = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Numero documento obbligatorio');
    });

    // Line 102: data documento missing
    it('should return error when data documento is missing', () => {
      const input = createValidInput();
      (input as any).data = null;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Data documento obbligatoria');
    });

    it('should return error when no detail lines', () => {
      const input = createValidInput();
      input.dettaglioLinee = [];
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Almeno una riga dettaglio obbligatoria');
    });

    it('should return error when no riepilogo IVA', () => {
      const input = createValidInput();
      input.datiRiepilogo = [];
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Almeno un riepilogo IVA obbligatorio');
    });
  });

  describe('XML escaping', () => {
    it('should escape special XML characters in text', () => {
      const input = createValidInput();
      input.dettaglioLinee[0].descrizione = 'Prodotto "A" & <test>';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('&amp;');
      expect(result.xml).toContain('&lt;');
      expect(result.xml).toContain('&gt;');
      expect(result.xml).toContain('&quot;');
    });

    it('should escape apostrophe in XML', () => {
      const input = createValidInput();
      input.dettaglioLinee[0].descrizione = "L'articolo speciale";
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('&apos;');
    });

    it('should handle long descriptions by truncating', () => {
      const input = createValidInput();
      input.dettaglioLinee[0].descrizione = 'A'.repeat(1500);
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Description should be truncated to 1000 chars
      const descMatch = result.xml!.match(/<Descrizione>([^<]+)<\/Descrizione>/);
      expect(descMatch![1].length).toBeLessThanOrEqual(1000);
    });
  });

  describe('persona fisica handling', () => {
    it('should use nome and cognome for persona fisica cedente', () => {
      const input = createValidInput();
      input.cedentePrestatore.denominazione = undefined;
      input.cedentePrestatore.nome = 'Mario';
      input.cedentePrestatore.cognome = 'Rossi';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Nome>Mario</Nome>');
      expect(result.xml).toContain('<Cognome>Rossi</Cognome>');
    });

    it('should use nome and cognome for persona fisica cessionario', () => {
      const input = createValidInput();
      input.cessionarioCommittente.denominazione = undefined;
      input.cessionarioCommittente.nome = 'Luigi';
      input.cessionarioCommittente.cognome = 'Bianchi';
      input.cessionarioCommittente.codiceFiscale = 'BNCLGU80A01H501X';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Nome>Luigi</Nome>');
      expect(result.xml).toContain('<Cognome>Bianchi</Cognome>');
    });

    it('should handle empty nome/cognome for persona fisica cedente', () => {
      const input = createValidInput();
      input.cedentePrestatore.denominazione = undefined;
      input.cedentePrestatore.nome = undefined;
      input.cedentePrestatore.cognome = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Nome></Nome>');
      expect(result.xml).toContain('<Cognome></Cognome>');
    });

    it('should handle empty nome/cognome for persona fisica cessionario', () => {
      const input = createValidInput();
      input.cessionarioCommittente.denominazione = undefined;
      input.cessionarioCommittente.nome = undefined;
      input.cessionarioCommittente.cognome = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Nome></Nome>');
      expect(result.xml).toContain('<Cognome></Cognome>');
    });
  });

  // Line 215: cedente numeroCivico
  describe('cedente prestatore with numeroCivico', () => {
    it('should include NumeroCivico when present for cedente', () => {
      const input = createValidInput();
      input.cedentePrestatore.numeroCivico = '42/A';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<NumeroCivico>42/A</NumeroCivico>');
    });
  });

  // Lines 227-237: IscrizioneREA
  describe('IscrizioneREA block', () => {
    it('should include IscrizioneREA when ufficio and numero are present', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = '1234567';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<IscrizioneREA>');
      expect(result.xml).toContain('<Ufficio>MI</Ufficio>');
      expect(result.xml).toContain('<NumeroREA>1234567</NumeroREA>');
      expect(result.xml).toContain('<StatoLiquidazione>LN</StatoLiquidazione>');
    });

    it('should include CapitaleSociale when defined', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = '1234567';
      input.cedentePrestatore.capitaleSociale = 100000.00;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CapitaleSociale>100000.00</CapitaleSociale>');
    });

    it('should include SocioUnico when defined (SU)', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = '1234567';
      input.cedentePrestatore.socioUnico = 'SU';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<SocioUnico>SU</SocioUnico>');
    });

    it('should include SocioUnico when defined (SM)', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = '1234567';
      input.cedentePrestatore.socioUnico = 'SM';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<SocioUnico>SM</SocioUnico>');
    });

    it('should include custom StatoLiquidazione when defined', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = '1234567';
      input.cedentePrestatore.statoLiquidazione = 'LS';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<StatoLiquidazione>LS</StatoLiquidazione>');
    });

    it('should not include IscrizioneREA when only ufficio is present', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = 'MI';
      input.cedentePrestatore.reaNumero = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<IscrizioneREA>');
    });

    it('should not include IscrizioneREA when only numero is present', () => {
      const input = createValidInput();
      input.cedentePrestatore.reaUfficio = undefined;
      input.cedentePrestatore.reaNumero = '1234567';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<IscrizioneREA>');
    });
  });

  // Line 244: cedente telefono in Contatti
  describe('cedente contatti', () => {
    it('should include Telefono when present', () => {
      const input = createValidInput();
      input.cedentePrestatore.telefono = '+39 02 12345678';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Contatti>');
      expect(result.xml).toContain('<Telefono>+39 02 12345678</Telefono>');
    });

    it('should include both Telefono and Email when present', () => {
      const input = createValidInput();
      input.cedentePrestatore.telefono = '+39 02 12345678';
      input.cedentePrestatore.email = 'info@company.it';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Contatti>');
      expect(result.xml).toContain('<Telefono>+39 02 12345678</Telefono>');
      expect(result.xml).toContain('<Email>info@company.it</Email>');
    });

    it('should not include Contatti when neither telefono nor email present', () => {
      const input = createValidInput();
      input.cedentePrestatore.telefono = undefined;
      input.cedentePrestatore.email = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<Contatti>');
    });
  });

  // Line 293: cessionario numeroCivico
  describe('cessionario committente with numeroCivico', () => {
    it('should include NumeroCivico when present for cessionario', () => {
      const input = createValidInput();
      input.cessionarioCommittente.numeroCivico = '15/B';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Find the cessionario section and verify numeroCivico is in it
      expect(result.xml).toContain('<NumeroCivico>15/B</NumeroCivico>');
    });
  });

  // Lines 389, 393, 396: cassa imponibileCassa, ritenuta, natura
  describe('dati cassa previdenziale full options', () => {
    it('should include ImponibileCassa when defined', () => {
      const input = createValidInput({
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC02',
            alCassa: 4,
            importoContributoCassa: 8.00,
            imponibileCassa: 200.00,
            aliquotaIva: 22,
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ImponibileCassa>200.00</ImponibileCassa>');
    });

    it('should include Ritenuta when cassa is subject to ritenuta', () => {
      const input = createValidInput({
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC02',
            alCassa: 4,
            importoContributoCassa: 8.00,
            aliquotaIva: 22,
            ritenuta: 'SI',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Ritenuta>SI</Ritenuta>');
    });

    it('should include Natura when cassa IVA is exempt', () => {
      const input = createValidInput({
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC02',
            alCassa: 4,
            importoContributoCassa: 8.00,
            aliquotaIva: 0,
            natura: 'N4',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Natura>N4</Natura>');
    });

    it('should include all optional cassa fields together', () => {
      const input = createValidInput({
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC02',
            alCassa: 4,
            importoContributoCassa: 8.00,
            imponibileCassa: 200.00,
            aliquotaIva: 0,
            ritenuta: 'SI',
            natura: 'N4',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ImponibileCassa>200.00</ImponibileCassa>');
      expect(result.xml).toContain('<Ritenuta>SI</Ritenuta>');
      expect(result.xml).toContain('<Natura>N4</Natura>');
    });
  });

  // Line 409: Arrotondamento
  describe('arrotondamento', () => {
    it('should include Arrotondamento when non-zero positive', () => {
      const input = createValidInput({
        arrotondamento: 0.01,
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Arrotondamento>0.01</Arrotondamento>');
    });

    it('should include Arrotondamento when non-zero negative', () => {
      const input = createValidInput({
        arrotondamento: -0.02,
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Arrotondamento>-0.02</Arrotondamento>');
    });

    it('should not include Arrotondamento when zero', () => {
      const input = createValidInput({
        arrotondamento: 0,
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<Arrotondamento>');
    });

    it('should not include Arrotondamento when undefined', () => {
      const input = createValidInput();
      input.arrotondamento = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<Arrotondamento>');
    });
  });

  // Lines 414-418: Causale with splitting
  describe('causale', () => {
    it('should include single short causale', () => {
      const input = createValidInput({
        causale: ['Vendita prodotti'],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Causale>Vendita prodotti</Causale>');
    });

    it('should include multiple causali', () => {
      const input = createValidInput({
        causale: ['Prima causale', 'Seconda causale'],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Causale>Prima causale</Causale>');
      expect(result.xml).toContain('<Causale>Seconda causale</Causale>');
    });

    // Lines 665-673: splitString for causale > 200 chars
    it('should split long causale into multiple chunks of 200 chars', () => {
      const longCausale = 'A'.repeat(450); // Will need 3 chunks
      const input = createValidInput({
        causale: [longCausale],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Count occurrences of <Causale>
      const matches = result.xml!.match(/<Causale>/g);
      expect(matches).toBeDefined();
      expect(matches!.length).toBe(3); // 450 chars = 200 + 200 + 50 = 3 chunks
    });

    it('should handle exactly 200 char causale without splitting', () => {
      const exactCausale = 'B'.repeat(200);
      const input = createValidInput({
        causale: [exactCausale],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      const matches = result.xml!.match(/<Causale>/g);
      expect(matches).toBeDefined();
      expect(matches!.length).toBe(1);
    });

    it('should not include Causale when empty array', () => {
      const input = createValidInput({
        causale: [],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<Causale>');
    });
  });

  // Lines 427-450: DatiOrdineAcquisto
  describe('datiOrdineAcquisto', () => {
    it('should include basic DatiOrdineAcquisto', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiOrdineAcquisto>');
      expect(result.xml).toContain('<IdDocumento>ORD-2026-001</IdDocumento>');
    });

    it('should include RiferimentoNumeroLinea when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            riferimentoNumeroLinea: [1, 2],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>');
      expect(result.xml).toContain('<RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>');
    });

    it('should include Data when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            data: new Date('2026-01-10'),
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Data>2026-01-10</Data>');
    });

    it('should include NumItem when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            numItem: '001',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<NumItem>001</NumItem>');
    });

    it('should include CodiceCommessaConvenzione when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            codiceCommessaConvenzione: 'CONV-2026-001',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CodiceCommessaConvenzione>CONV-2026-001</CodiceCommessaConvenzione>');
    });

    it('should include CodiceCUP when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            codiceCup: 'J11B17000000001',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CodiceCUP>J11B17000000001</CodiceCUP>');
    });

    it('should include CodiceCIG when present', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            idDocumento: 'ORD-2026-001',
            codiceCig: '1234567890',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CodiceCIG>1234567890</CodiceCIG>');
    });

    it('should include all optional fields in DatiOrdineAcquisto', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          {
            riferimentoNumeroLinea: [1],
            idDocumento: 'ORD-2026-001',
            data: new Date('2026-01-10'),
            numItem: '001',
            codiceCommessaConvenzione: 'CONV-001',
            codiceCup: 'J11B17000000001',
            codiceCig: '1234567890',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiOrdineAcquisto>');
      expect(result.xml).toContain('<RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>');
      expect(result.xml).toContain('<IdDocumento>ORD-2026-001</IdDocumento>');
      expect(result.xml).toContain('<NumItem>001</NumItem>');
      expect(result.xml).toContain('<CodiceCommessaConvenzione>CONV-001</CodiceCommessaConvenzione>');
      expect(result.xml).toContain('<CodiceCUP>J11B17000000001</CodiceCUP>');
      expect(result.xml).toContain('<CodiceCIG>1234567890</CodiceCIG>');
    });

    it('should include multiple DatiOrdineAcquisto blocks', () => {
      const input = createValidInput({
        datiOrdineAcquisto: [
          { idDocumento: 'ORD-001' },
          { idDocumento: 'ORD-002' },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<IdDocumento>ORD-001</IdDocumento>');
      expect(result.xml).toContain('<IdDocumento>ORD-002</IdDocumento>');
    });
  });

  // Lines 461-462: DatiDDT riferimentoNumeroLinea
  describe('datiDDT with riferimentoNumeroLinea', () => {
    it('should include RiferimentoNumeroLinea in DDT when present', () => {
      const input = createValidInput({
        datiDdt: [
          {
            numeroDdt: 'DDT-2026-001',
            dataDdt: new Date('2026-01-10'),
            riferimentoNumeroLinea: [1, 2, 3],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiDDT>');
      expect(result.xml).toContain('<NumeroDDT>DDT-2026-001</NumeroDDT>');
      // Check for RiferimentoNumeroLinea in DatiDDT context
      const ddtSection = result.xml!.substring(
        result.xml!.indexOf('<DatiDDT>'),
        result.xml!.indexOf('</DatiDDT>') + 10
      );
      expect(ddtSection).toContain('<RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>');
      expect(ddtSection).toContain('<RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>');
      expect(ddtSection).toContain('<RiferimentoNumeroLinea>3</RiferimentoNumeroLinea>');
    });
  });

  // Line 507: linea ritenuta
  describe('dettaglio linea with ritenuta', () => {
    it('should include Ritenuta SI for line subject to withholding', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Consulenza professionale',
            quantita: 1,
            prezzoUnitario: 1000.00,
            prezzoTotale: 1000.00,
            aliquotaIva: 22,
            ritenuta: 'SI',
          },
        ],
        datiRitenuta: {
          tipoRitenuta: 'RT01',
          importoRitenuta: 200.00,
          aliquotaRitenuta: 20,
          causalePagamento: 'A',
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Find the DettaglioLinee section
      const lineSection = result.xml!.substring(
        result.xml!.indexOf('<DettaglioLinee>'),
        result.xml!.indexOf('</DettaglioLinee>') + 17
      );
      expect(lineSection).toContain('<Ritenuta>SI</Ritenuta>');
    });
  });

  // Lines 524-533: ScontoMaggiorazione
  describe('sconto maggiorazione', () => {
    it('should include ScontoMaggiorazione with percentuale for discount', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con sconto',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 90.00,
            aliquotaIva: 22,
            scontoMaggiorazione: [
              {
                tipo: 'SC',
                percentuale: 10,
              },
            ],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ScontoMaggiorazione>');
      expect(result.xml).toContain('<Tipo>SC</Tipo>');
      expect(result.xml).toContain('<Percentuale>10.00</Percentuale>');
    });

    it('should include ScontoMaggiorazione with importo for fixed amount discount', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con sconto fisso',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 85.00,
            aliquotaIva: 22,
            scontoMaggiorazione: [
              {
                tipo: 'SC',
                importo: 15,
              },
            ],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ScontoMaggiorazione>');
      expect(result.xml).toContain('<Tipo>SC</Tipo>');
      expect(result.xml).toContain('<Importo>15.00</Importo>');
    });

    it('should include ScontoMaggiorazione for maggiorazione (surcharge)', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con maggiorazione',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 110.00,
            aliquotaIva: 22,
            scontoMaggiorazione: [
              {
                tipo: 'MG',
                percentuale: 10,
              },
            ],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ScontoMaggiorazione>');
      expect(result.xml).toContain('<Tipo>MG</Tipo>');
    });

    it('should include multiple ScontoMaggiorazione for cascading discounts', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con sconti multipli',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 81.00,
            aliquotaIva: 22,
            scontoMaggiorazione: [
              {
                tipo: 'SC',
                percentuale: 10,
              },
              {
                tipo: 'SC',
                percentuale: 10,
              },
            ],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      const matches = result.xml!.match(/<ScontoMaggiorazione>/g);
      expect(matches).toBeDefined();
      expect(matches!.length).toBe(2);
    });

    it('should include both percentuale and importo when both present', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto con sconto misto',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 80.00,
            aliquotaIva: 22,
            scontoMaggiorazione: [
              {
                tipo: 'SC',
                percentuale: 10,
                importo: 10,
              },
            ],
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Percentuale>10.00</Percentuale>');
      expect(result.xml).toContain('<Importo>10.00</Importo>');
    });
  });

  // Line 545: riferimentoAmministrazione
  describe('dettaglio linea with riferimentoAmministrazione', () => {
    it('should include RiferimentoAmministrazione when present', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Prodotto PA',
            quantita: 1,
            prezzoUnitario: 100.00,
            prezzoTotale: 100.00,
            aliquotaIva: 22,
            riferimentoAmministrazione: 'CIG:1234567890',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<RiferimentoAmministrazione>CIG:1234567890</RiferimentoAmministrazione>');
    });
  });

  // Lines 596, 600: payment dataRiferimentoTerminiPagamento, giorniTerminiPagamento
  describe('dati pagamento advanced options', () => {
    it('should include DataRiferimentoTerminiPagamento when present', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              dataRiferimentoTerminiPagamento: new Date('2026-01-15'),
              importoPagamento: 244.00,
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DataRiferimentoTerminiPagamento>2026-01-15</DataRiferimentoTerminiPagamento>');
    });

    it('should include GiorniTerminiPagamento when present', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              giorniTerminiPagamento: 30,
              importoPagamento: 244.00,
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<GiorniTerminiPagamento>30</GiorniTerminiPagamento>');
    });

    it('should include GiorniTerminiPagamento with value 0', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP01', // Contanti - immediate payment
              giorniTerminiPagamento: 0,
              importoPagamento: 244.00,
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<GiorniTerminiPagamento>0</GiorniTerminiPagamento>');
    });
  });

  // Line 610: istitutoFinanziario
  describe('dati pagamento with istitutoFinanziario', () => {
    it('should include IstitutoFinanziario when present', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              importoPagamento: 244.00,
              istitutoFinanziario: 'Banca Test SpA',
              iban: 'IT60X0542811101000000123456',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<IstitutoFinanziario>Banca Test SpA</IstitutoFinanziario>');
    });
  });

  // Line 618: BIC
  describe('dati pagamento with BIC', () => {
    it('should include BIC when present', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              importoPagamento: 244.00,
              iban: 'IT60X0542811101000000123456',
              bic: 'BCITITMM',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<BIC>BCITITMM</BIC>');
    });
  });

  describe('payment methods', () => {
    it('should handle MP01 (contanti) payment', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP01',
              importoPagamento: 244.00,
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ModalitaPagamento>MP01</ModalitaPagamento>');
    });

    it('should handle MP08 (carta) payment', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP08',
              importoPagamento: 244.00,
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<ModalitaPagamento>MP08</ModalitaPagamento>');
    });

    it('should handle TP01 (pagamento a rate) with multiple dettagli', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP01',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              dataScadenzaPagamento: new Date('2026-02-15'),
              importoPagamento: 122.00,
              iban: 'IT60X0542811101000000123456',
            },
            {
              modalitaPagamento: 'MP05',
              dataScadenzaPagamento: new Date('2026-03-15'),
              importoPagamento: 122.00,
              iban: 'IT60X0542811101000000123456',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CondizioniPagamento>TP01</CondizioniPagamento>');
      const dettagliMatches = result.xml!.match(/<DettaglioPagamento>/g);
      expect(dettagliMatches!.length).toBe(2);
    });

    it('should strip spaces from IBAN', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              importoPagamento: 244.00,
              iban: 'IT60 X054 2811 1010 0000 0123 456',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<IBAN>IT60X0542811101000000123456</IBAN>');
    });

    it('should include all payment details together', () => {
      const input = createValidInput({
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP05',
              dataRiferimentoTerminiPagamento: new Date('2026-01-15'),
              giorniTerminiPagamento: 30,
              dataScadenzaPagamento: new Date('2026-02-15'),
              importoPagamento: 244.00,
              istitutoFinanziario: 'Banca Test SpA',
              iban: 'IT60X0542811101000000123456',
              bic: 'BCITITMM',
            },
          ],
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DataRiferimentoTerminiPagamento>2026-01-15</DataRiferimentoTerminiPagamento>');
      expect(result.xml).toContain('<GiorniTerminiPagamento>30</GiorniTerminiPagamento>');
      expect(result.xml).toContain('<DataScadenzaPagamento>2026-02-15</DataScadenzaPagamento>');
      expect(result.xml).toContain('<IstitutoFinanziario>Banca Test SpA</IstitutoFinanziario>');
      expect(result.xml).toContain('<IBAN>IT60X0542811101000000123456</IBAN>');
      expect(result.xml).toContain('<BIC>BCITITMM</BIC>');
    });
  });

  describe('split payment (scissione pagamenti)', () => {
    it('should include EsigibilitaIVA S for split payment', () => {
      const input = createValidInput({
        datiRiepilogo: [
          {
            aliquotaIva: 22,
            imponibileImporto: 200.00,
            imposta: 44.00,
            esigibilitaIva: 'S', // Scissione pagamenti
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<EsigibilitaIVA>S</EsigibilitaIVA>');
    });
  });

  describe('allegati without optional fields', () => {
    it('should include allegato without formato and descrizione', () => {
      const input = createValidInput({
        allegati: [
          {
            nomeAttachment: 'documento.pdf',
            attachment: 'SGVsbG8gV29ybGQ=',
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<NomeAttachment>documento.pdf</NomeAttachment>');
      expect(result.xml).toContain('<Attachment>SGVsbG8gV29ybGQ=</Attachment>');
      expect(result.xml).not.toContain('<FormatoAttachment>');
      expect(result.xml).not.toContain('<DescrizioneAttachment>');
    });
  });

  describe('document types', () => {
    it('should handle TD16 (integrazione reverse charge interno)', () => {
      const input = createValidInput({ tipoDocumento: 'TD16' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD16</TipoDocumento>');
    });

    it('should handle TD17 (autofattura servizi estero)', () => {
      const input = createValidInput({ tipoDocumento: 'TD17' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD17</TipoDocumento>');
    });

    it('should handle TD24 (fattura differita)', () => {
      const input = createValidInput({ tipoDocumento: 'TD24' });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD24</TipoDocumento>');
    });
  });

  describe('line items without optional fields', () => {
    it('should handle line without quantita', () => {
      const input = createValidInput({
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Servizio a corpo',
            prezzoUnitario: 500.00,
            prezzoTotale: 500.00,
            aliquotaIva: 22,
          },
        ],
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<Quantita>');
      expect(result.xml).not.toContain('<UnitaMisura>');
    });
  });

  describe('cessionario with only codiceFiscale', () => {
    it('should generate valid XML with only codiceFiscale for cessionario', () => {
      const input = createValidInput();
      input.cessionarioCommittente.partitaIva = undefined;
      input.cessionarioCommittente.codiceFiscale = 'RSSMRA80A01H501U';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CodiceFiscale>RSSMRA80A01H501U</CodiceFiscale>');
      // IdFiscaleIVA should not be in CessionarioCommittente section (it will still be in CedentePrestatore)
      const cessionarioSection = result.xml!.substring(
        result.xml!.indexOf('<CessionarioCommittente>'),
        result.xml!.indexOf('</CessionarioCommittente>')
      );
      expect(cessionarioSection).not.toContain('<IdFiscaleIVA>');
    });
  });

  describe('cedente without provincia', () => {
    it('should generate valid XML without provincia for cedente', () => {
      const input = createValidInput();
      input.cedentePrestatore.provincia = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Should not contain Provincia in CedentePrestatore section
      const cedenteSection = result.xml!.substring(
        result.xml!.indexOf('<CedentePrestatore>'),
        result.xml!.indexOf('</CedentePrestatore>')
      );
      expect(cedenteSection).not.toContain('<Provincia>');
    });
  });

  describe('cessionario without provincia', () => {
    it('should generate valid XML without provincia for cessionario', () => {
      const input = createValidInput();
      input.cessionarioCommittente.provincia = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Should not contain Provincia in CessionarioCommittente section
      const cessionarioSection = result.xml!.substring(
        result.xml!.indexOf('<CessionarioCommittente>'),
        result.xml!.indexOf('</CessionarioCommittente>')
      );
      expect(cessionarioSection).not.toContain('<Provincia>');
    });
  });

  describe('cedente without nazione (should default to IT)', () => {
    it('should default nazione to IT when not specified', () => {
      const input = createValidInput();
      input.cedentePrestatore.nazione = undefined as any;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Nazione>IT</Nazione>');
    });
  });

  describe('divisa default to EUR', () => {
    it('should default divisa to EUR when not specified', () => {
      const input = createValidInput();
      input.divisa = undefined as any;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Divisa>EUR</Divisa>');
    });
  });

  describe('codice destinatario default', () => {
    it('should default codiceDestinatario to 0000000 when not specified', () => {
      const input = createValidInput();
      input.cessionarioCommittente.codiceDestinatario = undefined;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<CodiceDestinatario>0000000</CodiceDestinatario>');
    });
  });

  describe('PEC not included when codice destinatario is not 0000000', () => {
    it('should not include PEC when codice destinatario is set', () => {
      const input = createValidInput({
        cessionarioCommittente: {
          ...createValidInput().cessionarioCommittente,
          codiceDestinatario: 'ABC1234',
          pecDestinatario: 'cliente@pec.it',
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).not.toContain('<PECDestinatario>');
    });
  });

  describe('cessionario with explicit nazione', () => {
    it('should use provided nazione for cessionario IdPaese', () => {
      const input = createValidInput({
        cessionarioCommittente: {
          ...createValidInput().cessionarioCommittente,
          nazione: 'DE',
          partitaIva: 'DE123456789',
        },
      });
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      // Check that IdPaese in cessionario section uses DE
      const cessionarioSection = result.xml!.substring(
        result.xml!.indexOf('<CessionarioCommittente>'),
        result.xml!.indexOf('</CessionarioCommittente>')
      );
      expect(cessionarioSection).toContain('<IdPaese>DE</IdPaese>');
      expect(cessionarioSection).toContain('<Nazione>DE</Nazione>');
    });

    it('should default IdPaese to IT when nazione not provided but partitaIva exists', () => {
      const input = createValidInput();
      // Remove nazione but keep partitaIva
      input.cessionarioCommittente.nazione = undefined as any;
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(true);
      const cessionarioSection = result.xml!.substring(
        result.xml!.indexOf('<CessionarioCommittente>'),
        result.xml!.indexOf('</CessionarioCommittente>')
      );
      // Should default to IT
      expect(cessionarioSection).toContain('<IdPaese>IT</IdPaese>');
      expect(cessionarioSection).toContain('<Nazione>IT</Nazione>');
    });
  });
});
