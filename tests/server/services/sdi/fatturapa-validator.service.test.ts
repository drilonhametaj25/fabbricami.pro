/**
 * FatturaPA Validator Service Tests
 * Tests for XSD-like validation of FatturaPA XML
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

import { fatturaPaValidatorService } from '@server/services/sdi/fatturapa-validator.service';

describe('FatturaPaValidatorService', () => {
  // Sample valid XML
  // Using valid Italian Partita IVA with correct check digits
  // 01234567897 is valid, 12345678903 is valid
  const createValidXml = (overrides: Record<string, string> = {}): string => {
    const {
      versione = 'FPR12',
      tipoDocumento = 'TD01',
      regimeFiscale = 'RF01',
      codiceDestinatario = '0000000',
      partitaIvaCedente = '01234567897',
      partitaIvaCessionario = '12345678903',
    } = overrides;

    return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="${versione}">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${partitaIvaCedente}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${codiceDestinatario}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${partitaIvaCedente}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${partitaIvaCedente}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>Test Company Srl</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${regimeFiscale}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Test 123</Indirizzo>
        <CAP>00100</CAP>
        <Comune>Roma</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${partitaIvaCessionario}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Cliente Test Srl</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Cliente 456</Indirizzo>
        <CAP>20100</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${tipoDocumento}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-01-15</Data>
        <Numero>FT-2026-0001</Numero>
        <ImportoTotaleDocumento>244.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Prodotto di test</Descrizione>
        <Quantita>2.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>100.00</PrezzoUnitario>
        <PrezzoTotale>200.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>200.00</ImponibileImporto>
        <Imposta>44.00</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
  };

  describe('validateXml', () => {
    it('should validate a correct XML as valid', () => {
      const xml = createValidXml();
      const result = fatturaPaValidatorService.validateXml(xml);

      // Debug: log errors if validation fails
      if (!result.valid) {
        console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing XML declaration', () => {
      const xml = createValidXml().replace('<?xml version="1.0" encoding="UTF-8"?>', '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.message.includes('Dichiarazione XML'))).toBe(true);
    });

    it('should detect invalid versione attribute', () => {
      const xml = createValidXml({ versione: 'INVALID' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.toLowerCase().includes('versione'))).toBe(true);
    });

    it('should validate FPA12 versione for PA invoices', () => {
      const xml = createValidXml({ versione: 'FPA12', codiceDestinatario: 'XXXXXX' });
      const result = fatturaPaValidatorService.validateXml(xml);

      // Should fail because CodiceDestinatario should be 6 chars for FPA12
      expect(result.valid).toBe(true); // FPA12 is valid version
    });

    it('should detect missing FatturaElettronicaHeader', () => {
      const xml = createValidXml().replace(/<FatturaElettronicaHeader>[\s\S]*<\/FatturaElettronicaHeader>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('FatturaElettronicaHeader'))).toBe(true);
    });

    it('should detect missing FatturaElettronicaBody', () => {
      const xml = createValidXml().replace(/<FatturaElettronicaBody>[\s\S]*<\/FatturaElettronicaBody>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('FatturaElettronicaBody'))).toBe(true);
    });
  });

  describe('DatiTrasmissione validation', () => {
    it('should detect missing IdTrasmittente', () => {
      const xml = createValidXml().replace(/<IdTrasmittente>[\s\S]*?<\/IdTrasmittente>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('IdTrasmittente'))).toBe(true);
    });

    it('should detect invalid IdPaese format', () => {
      const xml = createValidXml().replace('<IdPaese>IT</IdPaese>', '<IdPaese>ITALY</IdPaese>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('IdPaese'))).toBe(true);
    });

    it('should detect missing CodiceDestinatario', () => {
      const xml = createValidXml().replace(/<CodiceDestinatario>[^<]*<\/CodiceDestinatario>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('CodiceDestinatario'))).toBe(true);
    });

    it('should validate 7-char CodiceDestinatario for FPR12', () => {
      const xml = createValidXml({ codiceDestinatario: '1234567' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(true);
    });

    it('should reject wrong length CodiceDestinatario', () => {
      const xml = createValidXml({ codiceDestinatario: '123' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('CodiceDestinatario'))).toBe(true);
    });
  });

  describe('CedentePrestatore validation', () => {
    it('should detect missing RegimeFiscale', () => {
      const xml = createValidXml().replace(/<RegimeFiscale>[^<]*<\/RegimeFiscale>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('RegimeFiscale'))).toBe(true);
    });

    it('should detect invalid RegimeFiscale', () => {
      const xml = createValidXml({ regimeFiscale: 'RF99' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('RegimeFiscale'))).toBe(true);
    });

    it('should detect missing Sede', () => {
      const xml = createValidXml().replace(
        /<CedentePrestatore>[\s\S]*?<\/Sede>/,
        '<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Test</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici>'
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Sede'))).toBe(true);
    });

    it('should validate Italian partita IVA format', () => {
      // Invalid partita IVA (wrong check digit - 12345678901 is invalid)
      const xml = createValidXml({ partitaIvaCedente: '12345678901' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Partita IVA'))).toBe(true);
    });
  });

  describe('CessionarioCommittente validation', () => {
    it('should require at least IdFiscaleIVA or CodiceFiscale', () => {
      let xml = createValidXml();
      // Remove IdFiscaleIVA from cessionario
      xml = xml.replace(
        /<CessionarioCommittente>[\s\S]*?<\/DatiAnagrafici>/,
        `<CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Cliente Test Srl</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('IdFiscaleIVA') || e.message.includes('CodiceFiscale'))).toBe(true);
    });

    it('should validate Italian CAP format', () => {
      const xml = createValidXml().replace('<CAP>20100</CAP>', '<CAP>2010</CAP>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('CAP'))).toBe(true);
    });

    it('should require Provincia for Italian addresses', () => {
      const xml = createValidXml()
        .replace('<Provincia>MI</Provincia>', '')
        .replace('</Sede>\n    </CessionarioCommittente>', '</Sede>\n    </CessionarioCommittente>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Provincia'))).toBe(true);
    });
  });

  describe('DatiGenerali validation', () => {
    it('should detect invalid TipoDocumento', () => {
      const xml = createValidXml({ tipoDocumento: 'TD99' });
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('TipoDocumento'))).toBe(true);
    });

    it('should validate all standard document types', () => {
      const validTypes = ['TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD24'];

      for (const tipo of validTypes) {
        const xml = createValidXml({ tipoDocumento: tipo });
        const result = fatturaPaValidatorService.validateXml(xml);
        expect(result.valid).toBe(true);
      }
    });

    it('should detect invalid date format', () => {
      const xml = createValidXml().replace('<Data>2026-01-15</Data>', '<Data>15/01/2026</Data>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Data'))).toBe(true);
    });

    it('should detect missing Numero', () => {
      const xml = createValidXml().replace(/<Numero>[^<]*<\/Numero>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Numero'))).toBe(true);
    });
  });

  describe('DettaglioLinee validation', () => {
    it('should require at least one line item', () => {
      const xml = createValidXml().replace(/<DettaglioLinee>[\s\S]*?<\/DettaglioLinee>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('DettaglioLinee'))).toBe(true);
    });

    it('should detect duplicate NumeroLinea', () => {
      let xml = createValidXml();
      // Add duplicate line number
      xml = xml.replace(
        '</DettaglioLinee>',
        `</DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Altro prodotto</Descrizione>
        <PrezzoUnitario>50.00</PrezzoUnitario>
        <PrezzoTotale>50.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('NumeroLinea') && e.message.includes('duplicato'))).toBe(true);
    });

    it('should require Natura for AliquotaIVA = 0', () => {
      const xml = createValidXml().replace('<AliquotaIVA>22.00</AliquotaIVA>', '<AliquotaIVA>0.00</AliquotaIVA>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Natura'))).toBe(true);
    });

    it('should validate Natura codes', () => {
      let xml = createValidXml().replace(
        '<AliquotaIVA>22.00</AliquotaIVA>',
        '<AliquotaIVA>0.00</AliquotaIVA><Natura>N99</Natura>'
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Natura'))).toBe(true);
    });
  });

  describe('DatiRiepilogo validation', () => {
    it('should require at least one riepilogo', () => {
      const xml = createValidXml().replace(/<DatiRiepilogo>[\s\S]*?<\/DatiRiepilogo>/, '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('DatiRiepilogo'))).toBe(true);
    });

    it('should validate EsigibilitaIVA values', () => {
      const xml = createValidXml().replace('<EsigibilitaIVA>I</EsigibilitaIVA>', '<EsigibilitaIVA>X</EsigibilitaIVA>');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('EsigibilitaIVA'))).toBe(true);
    });
  });

  describe('DatiPagamento validation', () => {
    it('should validate CondizioniPagamento', () => {
      let xml = createValidXml();
      xml = xml.replace(
        '</DatiBeniServizi>',
        `</DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP99</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <ImportoPagamento>244.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('CondizioniPagamento'))).toBe(true);
    });

    it('should validate ModalitaPagamento', () => {
      let xml = createValidXml();
      xml = xml.replace(
        '</DatiBeniServizi>',
        `</DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP99</ModalitaPagamento>
        <ImportoPagamento>244.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('ModalitaPagamento'))).toBe(true);
    });

    it('should validate IBAN format', () => {
      let xml = createValidXml();
      xml = xml.replace(
        '</DatiBeniServizi>',
        `</DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <ImportoPagamento>244.00</ImportoPagamento>
        <IBAN>INVALID_IBAN</IBAN>
      </DettaglioPagamento>
    </DatiPagamento>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('IBAN'))).toBe(true);
    });

    it('should accept valid IBAN', () => {
      let xml = createValidXml();
      xml = xml.replace(
        '</DatiBeniServizi>',
        `</DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <ImportoPagamento>244.00</ImportoPagamento>
        <IBAN>IT60X0542811101000000123456</IBAN>
      </DettaglioPagamento>
    </DatiPagamento>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(true);
    });
  });

  describe('Cross-field validation', () => {
    it('should detect mismatch between line item aliquote and riepiloghi', () => {
      let xml = createValidXml();
      // Add a line with 10% IVA but no corresponding riepilogo
      xml = xml.replace(
        '</DettaglioLinee>',
        `</DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Altro prodotto</Descrizione>
        <PrezzoUnitario>50.00</PrezzoUnitario>
        <PrezzoTotale>50.00</PrezzoTotale>
        <AliquotaIVA>10.00</AliquotaIVA>
      </DettaglioLinee>`
      );
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Aliquota') && e.message.includes('riepilog'))).toBe(true);
    });
  });

  describe('quickValidate', () => {
    it('should return true for valid XML', () => {
      const xml = createValidXml();
      const result = fatturaPaValidatorService.quickValidate(xml);

      expect(result).toBe(true);
    });

    it('should return false for invalid XML', () => {
      const xml = '<invalid>not a fattura</invalid>';
      const result = fatturaPaValidatorService.quickValidate(xml);

      expect(result).toBe(false);
    });
  });

  describe('XML structure validation', () => {
    it('should detect unbalanced tags', () => {
      const xml = createValidXml().replace('</CedentePrestatore>', '');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Tag non') || e.message.includes('bilanciato'))).toBe(true);
    });

    it('should detect invalid characters', () => {
      const xml = createValidXml().replace('Test Company Srl', 'Test\x00Company');
      const result = fatturaPaValidatorService.validateXml(xml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('caratteri'))).toBe(true);
    });
  });
});
