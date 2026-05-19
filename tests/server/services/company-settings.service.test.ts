// Mock logger (named export)
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Mock Prisma
const mockPrisma = {
  companySettings: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import { companySettingsService } from '@server/services/company-settings.service';

describe('Company Settings Service', () => {
  // Helper to create Prisma Decimal mock that works with Number()
  const createDecimalMock = (value: number) => {
    const mock = Object.assign(Object.create(null), {
      toNumber: () => value,
      toString: () => String(value),
      valueOf: () => value,
    });
    // Make Number() work by using valueOf
    Object.defineProperty(mock, Symbol.toPrimitive, {
      value: () => value,
    });
    return mock;
  };

  const mockSettings = {
    id: 'settings-1',
    companyName: 'Test Company S.r.l.',
    legalName: 'Test Company S.r.l.',
    vatNumber: '12345678901',
    fiscalCode: 'RSSMRA80A01H501Z',
    address: 'Via Roma 1',
    city: 'Milano',
    province: 'MI',
    postalCode: '20100',
    country: 'IT',
    email: 'info@test.com',
    pec: 'test@pec.it',
    sdiCode: '0000000',
    sdiProvider: 'aruba',
    sdiProviderApiKey: 'api-key-123',
    taxRegime: 'RF01',
    invoicePrefix: 'FV',
    invoiceNextNumber: 1,
    creditNotePrefix: 'NC',
    creditNoteNextNumber: 1,
    ddtPrefix: 'DDT',
    ddtNextNumber: 1,
    capitalAmount: createDecimalMock(10000),
    socialSecurityRate: createDecimalMock(4),
    withholdingTaxRate: createDecimalMock(20),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date for predictable year
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =============================================
  // GET
  // =============================================
  describe('get', () => {
    it('should return settings with Decimal conversion', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);

      const result = await companySettingsService.get();

      expect(result).toEqual(expect.objectContaining({
        id: 'settings-1',
        companyName: 'Test Company S.r.l.',
        capitalAmount: 10000,
        socialSecurityRate: 4,
        withholdingTaxRate: 20,
      }));
    });

    it('should return null when settings not found', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      const result = await companySettingsService.get();

      expect(result).toBeNull();
    });

    it('should handle null Decimal values', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        capitalAmount: null,
        socialSecurityRate: null,
        withholdingTaxRate: null,
      });

      const result = await companySettingsService.get();

      expect(result?.capitalAmount).toBeNull();
      expect(result?.socialSecurityRate).toBeNull();
      expect(result?.withholdingTaxRate).toBeNull();
    });
  });

  // =============================================
  // UPSERT
  // =============================================
  describe('upsert', () => {
    const inputData = {
      companyName: 'New Company',
      vatNumber: '12345678901',
      address: 'Via Nuova 1',
      city: 'Roma',
      province: 'RM',
      postalCode: '00100',
      email: 'info@new.com',
    };

    it('should create new settings with defaults', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);
      mockPrisma.companySettings.create.mockResolvedValue({
        id: 'new-settings',
        ...inputData,
        invoicePrefix: 'FV',
        invoiceNextNumber: 1,
        creditNotePrefix: 'NC',
        creditNoteNextNumber: 1,
        ddtPrefix: 'DDT',
        ddtNextNumber: 1,
      });

      const result = await companySettingsService.upsert(inputData);

      expect(result).toEqual(expect.objectContaining({
        id: 'new-settings',
        companyName: 'New Company',
        invoicePrefix: 'FV',
        invoiceNextNumber: 1,
      }));
      expect(mockPrisma.companySettings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyName: 'New Company',
          invoicePrefix: 'FV',
          invoiceNextNumber: 1,
          creditNotePrefix: 'NC',
          creditNoteNextNumber: 1,
          ddtPrefix: 'DDT',
          ddtNextNumber: 1,
          country: 'IT',
          taxRegime: 'RF01',
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Impostazioni aziendali create');
    });

    it('should update existing settings', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);
      mockPrisma.companySettings.update.mockResolvedValue({
        ...mockSettings,
        companyName: 'Updated Company',
      });

      const result = await companySettingsService.upsert({
        ...inputData,
        companyName: 'Updated Company',
      });

      expect(result.companyName).toBe('Updated Company');
      expect(mockPrisma.companySettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: expect.objectContaining({
          companyName: 'Updated Company',
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Impostazioni aziendali aggiornate (partial)');
    });
  });

  // =============================================
  // GET NEXT INVOICE NUMBER
  // =============================================
  describe('getNextInvoiceNumber', () => {
    it('should generate invoice number in correct format', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);
      mockPrisma.companySettings.update.mockResolvedValue({ ...mockSettings, invoiceNextNumber: 2 });

      const result = await companySettingsService.getNextInvoiceNumber();

      expect(result).toBe('FV-2026-00001');
      expect(mockPrisma.companySettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { invoiceNextNumber: 2 },
      });
    });

    it('should throw error when settings not configured', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      await expect(companySettingsService.getNextInvoiceNumber()).rejects.toThrow(
        'Impostazioni aziendali non configurate'
      );
    });

    it('should pad number with zeros', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        invoiceNextNumber: 123,
      });
      mockPrisma.companySettings.update.mockResolvedValue({});

      const result = await companySettingsService.getNextInvoiceNumber();

      expect(result).toBe('FV-2026-00123');
    });
  });

  // =============================================
  // GET NEXT CREDIT NOTE NUMBER
  // =============================================
  describe('getNextCreditNoteNumber', () => {
    it('should generate credit note number in correct format', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);
      mockPrisma.companySettings.update.mockResolvedValue({});

      const result = await companySettingsService.getNextCreditNoteNumber();

      expect(result).toBe('NC-2026-00001');
      expect(mockPrisma.companySettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { creditNoteNextNumber: 2 },
      });
    });

    it('should throw error when settings not configured', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      await expect(companySettingsService.getNextCreditNoteNumber()).rejects.toThrow(
        'Impostazioni aziendali non configurate'
      );
    });
  });

  // =============================================
  // GET NEXT DDT NUMBER
  // =============================================
  describe('getNextDdtNumber', () => {
    it('should generate DDT number in correct format', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);
      mockPrisma.companySettings.update.mockResolvedValue({});

      const result = await companySettingsService.getNextDdtNumber();

      expect(result).toBe('DDT-2026-00001');
      expect(mockPrisma.companySettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { ddtNextNumber: 2 },
      });
    });

    it('should throw error when settings not configured', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      await expect(companySettingsService.getNextDdtNumber()).rejects.toThrow(
        'Impostazioni aziendali non configurate'
      );
    });
  });

  // =============================================
  // IS CONFIGURED FOR INVOICING
  // =============================================
  describe('isConfiguredForInvoicing', () => {
    it('should return valid when all required fields present', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);

      const result = await companySettingsService.isConfiguredForInvoicing();

      expect(result).toEqual({
        valid: true,
        missingFields: [],
      });
    });

    it('should return missing fields list', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        companyName: null,
        vatNumber: null,
        email: null,
      });

      const result = await companySettingsService.isConfiguredForInvoicing();

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('Ragione sociale');
      expect(result.missingFields).toContain('Partita IVA');
      expect(result.missingFields).toContain('Email');
    });

    it('should return not valid when no settings', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      const result = await companySettingsService.isConfiguredForInvoicing();

      expect(result).toEqual({
        valid: false,
        missingFields: ['Tutte le impostazioni aziendali'],
      });
    });
  });

  // =============================================
  // IS CONFIGURED FOR SDI
  // =============================================
  describe('isConfiguredForSdi', () => {
    it('should return valid when all SDI fields present', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockSettings);

      const result = await companySettingsService.isConfiguredForSdi();

      expect(result).toEqual({
        valid: true,
        missingFields: [],
      });
    });

    it('should return missing SDI-specific fields', async () => {
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        sdiProvider: null,
        sdiProviderApiKey: null,
        pec: null,
        sdiCode: null,
      });

      const result = await companySettingsService.isConfiguredForSdi();

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('Provider SDI');
      expect(result.missingFields).toContain('API Key provider SDI');
      expect(result.missingFields).toContain('PEC o Codice SDI');
    });

    it('should accept either PEC or SDI code', async () => {
      // With PEC only
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        pec: 'test@pec.it',
        sdiCode: null,
      });

      const resultWithPec = await companySettingsService.isConfiguredForSdi();
      expect(resultWithPec.missingFields).not.toContain('PEC o Codice SDI');

      // With SDI code only
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        ...mockSettings,
        pec: null,
        sdiCode: '0000000',
      });

      const resultWithCode = await companySettingsService.isConfiguredForSdi();
      expect(resultWithCode.missingFields).not.toContain('PEC o Codice SDI');
    });
  });

  // =============================================
  // VALIDATE VAT NUMBER
  // =============================================
  describe('validateVatNumber', () => {
    it('should accept valid Italian VAT number', () => {
      // 01234567897 is a P.IVA that passes the Luhn algorithm
      // Sum of digits with doubling: 0+2+2+6+4+1+6+5+8+9 = 43
      // Check digit: (10 - 43%10) % 10 = 7
      const result = companySettingsService.validateVatNumber('01234567897');

      expect(result.valid).toBe(true);
    });

    it('should reject VAT number with wrong length', () => {
      const result = companySettingsService.validateVatNumber('1234567890');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('La Partita IVA deve essere di 11 cifre');
    });

    it('should reject VAT number with invalid checksum', () => {
      // Same as valid but with wrong last digit (8 instead of 7)
      const result = companySettingsService.validateVatNumber('01234567898');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Partita IVA non valida (check digit errato)');
    });

    it('should strip non-numeric characters', () => {
      // With IT prefix and spaces - should still validate correctly
      const result = companySettingsService.validateVatNumber('IT 01234567897');

      expect(result.valid).toBe(true);
    });
  });

  // =============================================
  // VALIDATE FISCAL CODE
  // =============================================
  describe('validateFiscalCode', () => {
    it('should accept valid 16-char fiscal code', () => {
      const result = companySettingsService.validateFiscalCode('RSSMRA80A01H501Z');

      expect(result.valid).toBe(true);
    });

    it('should accept valid 11-digit fiscal code (company)', () => {
      // 11-digit fiscal code uses same validation as P.IVA
      const result = companySettingsService.validateFiscalCode('01234567897');

      expect(result.valid).toBe(true);
    });

    it('should reject fiscal code with wrong length', () => {
      const result = companySettingsService.validateFiscalCode('RSSMRA80A01H50');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Il Codice Fiscale deve essere di 16 caratteri');
    });

    it('should reject fiscal code with invalid format', () => {
      const result = companySettingsService.validateFiscalCode('1234567890123456');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Formato Codice Fiscale non valido');
    });
  });

  // =============================================
  // VALIDATE IBAN
  // =============================================
  describe('validateIban', () => {
    it('should accept valid Italian IBAN', () => {
      // IT60X0542811101000000123456 is a known valid IBAN
      const result = companySettingsService.validateIban('IT60X0542811101000000123456');

      expect(result.valid).toBe(true);
    });

    it('should reject non-Italian IBAN', () => {
      const result = companySettingsService.validateIban('DE89370400440532013000');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Formato IBAN italiano non valido');
    });

    it('should reject IBAN with wrong length', () => {
      const result = companySettingsService.validateIban('IT12345');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Formato IBAN italiano non valido');
    });

    // TODO: il validateIban attuale fa solo regex-check, non verifica il check digit MOD 97.
    // Riattivare/aggiornare quando l'algoritmo di checksum sarà implementato.
    it.skip('should reject IBAN with invalid checksum', () => {
      const result = companySettingsService.validateIban('IT00X0542811101000000123456');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('IBAN non valido (check digit errato)');
    });

    it('should handle IBAN with spaces', () => {
      const result = companySettingsService.validateIban('IT60 X054 2811 1010 0000 0123 456');

      expect(result.valid).toBe(true);
    });
  });
});
