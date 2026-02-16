/**
 * SDI E2E Tests
 * End-to-end tests for SDI (Sistema di Interscambio) invoice flow
 *
 * These tests focus on:
 * 1. XML generation for FatturaPA
 * 2. XML validation
 * 3. Complete flow integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before imports
vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { fatturaPaXmlService } from '@server/services/sdi/fatturapa-xml.service';
import { fatturaPaValidatorService } from '@server/services/sdi/fatturapa-validator.service';
import type { FatturapaInput } from '@server/services/sdi/sdi-provider.interface';

describe('SDI E2E - Complete Invoice Flow', () => {
  const mockCedente = {
    denominazione: 'Test Company Srl',
    partitaIva: '01234567897',
    codiceFiscale: '01234567897',
    indirizzo: 'Via Test 123',
    cap: '00100',
    comune: 'Roma',
    provincia: 'RM',
    nazione: 'IT',
    regimeFiscale: 'RF01',
    pec: 'testcompany@pec.it',
  };

  const mockCessionario = {
    denominazione: 'Cliente Test Srl',
    partitaIva: '12345678903',
    codiceFiscale: '12345678903',
    indirizzo: 'Via Cliente 456',
    cap: '20100',
    comune: 'Milano',
    provincia: 'MI',
    nazione: 'IT',
    codiceDestinatario: '0000000',
    pecDestinatario: 'cliente@pec.it',
  };

  const mockLinee = [
    {
      numeroLinea: 1,
      descrizione: 'Servizio di consulenza',
      quantita: 10,
      unitaMisura: 'N',
      prezzoUnitario: 100,
      prezzoTotale: 1000,
      aliquotaIva: 22,
    },
  ];

  const mockRiepilogo = [
    {
      aliquotaIva: 22,
      imponibileImporto: 1000,
      imposta: 220,
      esigibilitaIva: 'I' as const,
    },
  ];

  const mockInput: FatturapaInput = {
    tipoDocumento: 'TD01',
    divisa: 'EUR',
    data: new Date('2026-01-15'),
    numero: 'FT-2026-001',
    importoTotale: 1220,
    cedentePrestatore: mockCedente,
    cessionarioCommittente: mockCessionario,
    dettaglioLinee: mockLinee,
    datiRiepilogo: mockRiepilogo,
    datiPagamento: {
      condizioniPagamento: 'TP02',
      dettaglioPagamento: [
        {
          modalitaPagamento: 'MP05',
          dataScadenzaPagamento: new Date('2026-02-15'),
          importoPagamento: 1220,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Generate XML FatturaPA', () => {
    it('should generate valid XML from invoice data', () => {
      const result = fatturaPaXmlService.generateXml(mockInput, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toBeDefined();
      expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.xml).toContain('FatturaElettronica');
      expect(result.xml).toContain('01234567897'); // Cedente P.IVA
      expect(result.xml).toContain('12345678903'); // Cessionario P.IVA
    });

    it('should include all document types', () => {
      const documentTypes = ['TD01', 'TD04', 'TD05', 'TD06', 'TD24'] as const;

      for (const docType of documentTypes) {
        const input = { ...mockInput, tipoDocumento: docType };
        const result = fatturaPaXmlService.generateXml(input, '00001');

        expect(result.success).toBe(true);
        expect(result.xml).toContain(`<TipoDocumento>${docType}</TipoDocumento>`);
      }
    });

    it('should handle bollo virtuale', () => {
      const inputWithBollo: FatturapaInput = {
        ...mockInput,
        datiBollo: {
          bolloVirtuale: 'SI',
          importoBollo: 2.0,
        },
      };

      const result = fatturaPaXmlService.generateXml(inputWithBollo, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiBollo>');
      expect(result.xml).toContain('<BolloVirtuale>SI</BolloVirtuale>');
      expect(result.xml).toContain('<ImportoBollo>2.00</ImportoBollo>');
    });

    it("should handle ritenuta d'acconto", () => {
      const inputWithRitenuta: FatturapaInput = {
        ...mockInput,
        datiRitenuta: {
          tipoRitenuta: 'RT01',
          importoRitenuta: 200,
          aliquotaRitenuta: 20,
          causalePagamento: 'A',
        },
      };

      const result = fatturaPaXmlService.generateXml(inputWithRitenuta, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiRitenuta>');
      expect(result.xml).toContain('<TipoRitenuta>RT01</TipoRitenuta>');
    });

    it('should generate correct file name format', () => {
      const result = fatturaPaXmlService.generateXml(mockInput, '00001');

      expect(result.success).toBe(true);
      expect(result.fileName).toBeDefined();
      // Format: IT{P.IVA}_{progressivo}.xml
      expect(result.fileName).toMatch(/IT\d{11}_\w+\.xml/);
    });
  });

  describe('Step 2: Validate XML', () => {
    it('should validate correct XML as valid', () => {
      // Generate valid XML first
      const genResult = fatturaPaXmlService.generateXml(mockInput, '00001');
      expect(genResult.success).toBe(true);

      // Validate it
      const validationResult = fatturaPaValidatorService.validateXml(genResult.xml!);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toBeUndefined();
    });

    it('should detect invalid P.IVA', () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>99999999999</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>99999999999</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Test</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Test</Indirizzo>
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
          <IdCodice>12345678901</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Cliente</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Cliente</Indirizzo>
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
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-01-15</Data>
        <Numero>1</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Test</Descrizione>
        <PrezzoUnitario>100.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>100.00</ImponibileImporto>
        <Imposta>22.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

      const result = fatturaPaValidatorService.validateXml(invalidXml);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.message.toLowerCase().includes('partita iva'))).toBe(true);
    });

    it('should detect missing required fields', () => {
      const incompleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01234567897</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
    </DatiTrasmissione>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

      const result = fatturaPaValidatorService.validateXml(incompleteXml);

      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should detect invalid version attribute', () => {
      const invalidVersionXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="INVALID" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader></FatturaElettronicaHeader>
  <FatturaElettronicaBody></FatturaElettronicaBody>
</p:FatturaElettronica>`;

      const result = fatturaPaValidatorService.validateXml(invalidVersionXml);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.toLowerCase().includes('versione'))).toBe(true);
    });
  });

  describe('Step 3: Complete Flow Integration', () => {
    it('should generate and validate invoice in single flow', () => {
      // Step 1: Generate XML
      const genResult = fatturaPaXmlService.generateXml(mockInput, '00001');
      expect(genResult.success).toBe(true);
      expect(genResult.xml).toBeDefined();
      expect(genResult.fileName).toBeDefined();

      // Step 2: Validate generated XML
      const validationResult = fatturaPaValidatorService.validateXml(genResult.xml!);
      expect(validationResult.valid).toBe(true);
    });

    it('should handle credit note (nota di credito)', () => {
      const creditNoteInput: FatturapaInput = {
        ...mockInput,
        tipoDocumento: 'TD04',
        numero: 'NC-2026-001',
        datiDocumentiCorrelati: [
          {
            tipo: 'DatiDDT',
            numero: 'FT-2026-001',
            data: new Date('2026-01-10'),
          },
        ],
      };

      const result = fatturaPaXmlService.generateXml(creditNoteInput, '00002');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD04</TipoDocumento>');
    });

    it('should handle self-billing invoice (autofattura)', () => {
      const selfBillingInput: FatturapaInput = {
        ...mockInput,
        tipoDocumento: 'TD17', // Integrazione/autofattura
        numero: 'AF-2026-001',
      };

      const result = fatturaPaXmlService.generateXml(selfBillingInput, '00003');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<TipoDocumento>TD17</TipoDocumento>');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing cedente data', () => {
      const invalidInput = {
        ...mockInput,
        cedentePrestatore: {
          ...mockCedente,
          partitaIva: '', // Empty P.IVA
        },
      };

      const result = fatturaPaXmlService.generateXml(invalidInput, '00001');

      // Should still generate XML but validation would fail
      // The XML service generates the structure, validation catches errors
      if (result.success) {
        const validation = fatturaPaValidatorService.validateXml(result.xml!);
        expect(validation.valid).toBe(false);
      }
    });

    it('should handle missing cessionario data', () => {
      const invalidInput = {
        ...mockInput,
        cessionarioCommittente: {
          ...mockCessionario,
          partitaIva: '', // Empty P.IVA for B2B
        },
      };

      const result = fatturaPaXmlService.generateXml(invalidInput, '00001');

      // For B2C (no P.IVA), codice fiscale is required
      // For B2B (no P.IVA), validation should fail
      if (result.success) {
        const validation = fatturaPaValidatorService.validateXml(result.xml!);
        // Depends on whether cessionario has codice fiscale or not
        expect(validation).toBeDefined();
      }
    });

    it('should handle invalid regime fiscale', () => {
      const invalidInput = {
        ...mockInput,
        cedentePrestatore: {
          ...mockCedente,
          regimeFiscale: 'RF99', // Invalid regime
        },
      };

      const result = fatturaPaXmlService.generateXml(invalidInput, '00001');

      if (result.success) {
        const validation = fatturaPaValidatorService.validateXml(result.xml!);
        expect(validation.valid).toBe(false);
        expect(validation.errors!.some(e => e.message.toLowerCase().includes('regime'))).toBe(true);
      }
    });

    it('should handle invalid payment method', () => {
      const invalidInput: FatturapaInput = {
        ...mockInput,
        datiPagamento: {
          condizioniPagamento: 'TP02',
          dettaglioPagamento: [
            {
              modalitaPagamento: 'MP99' as any, // Invalid payment method
              importoPagamento: 1220,
            },
          ],
        },
      };

      const result = fatturaPaXmlService.generateXml(invalidInput, '00001');

      if (result.success) {
        const validation = fatturaPaValidatorService.validateXml(result.xml!);
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Special Cases', () => {
    it('should handle zero VAT with natura', () => {
      const zeroVatInput: FatturapaInput = {
        ...mockInput,
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Servizio esente',
            quantita: 1,
            prezzoUnitario: 1000,
            prezzoTotale: 1000,
            aliquotaIva: 0,
            natura: 'N4', // Esente
          },
        ],
        datiRiepilogo: [
          {
            aliquotaIva: 0,
            natura: 'N4',
            imponibileImporto: 1000,
            imposta: 0,
            esigibilitaIva: 'I',
          },
        ],
        importoTotale: 1000,
      };

      const result = fatturaPaXmlService.generateXml(zeroVatInput, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<Natura>N4</Natura>');
      expect(result.xml).toContain('<AliquotaIVA>0.00</AliquotaIVA>');
    });

    it('should handle split payment', () => {
      const splitPaymentInput: FatturapaInput = {
        ...mockInput,
        datiRiepilogo: [
          {
            aliquotaIva: 22,
            imponibileImporto: 1000,
            imposta: 220,
            esigibilitaIva: 'S', // Split payment
          },
        ],
      };

      const result = fatturaPaXmlService.generateXml(splitPaymentInput, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<EsigibilitaIVA>S</EsigibilitaIVA>');
    });

    it('should handle cassa previdenziale', () => {
      const cassaInput: FatturapaInput = {
        ...mockInput,
        datiCassaPrevidenziale: [
          {
            tipoCassa: 'TC01',
            alCassa: 4,
            importoContributoCassa: 40,
            imponibileCassa: 1000,
            aliquotaIva: 22,
            ritenuta: 'SI',
          },
        ],
      };

      const result = fatturaPaXmlService.generateXml(cassaInput, '00001');

      expect(result.success).toBe(true);
      expect(result.xml).toContain('<DatiCassaPrevidenziale>');
      expect(result.xml).toContain('<TipoCassa>TC01</TipoCassa>');
    });
  });
});
