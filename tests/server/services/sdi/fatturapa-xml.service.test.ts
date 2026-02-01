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

    it('should return error when numero documento is missing', () => {
      const input = createValidInput();
      input.numero = '';
      const result = fatturaPaXmlService.generateXml(input, '00001');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Numero documento obbligatorio');
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
  });
});
