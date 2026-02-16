/**
 * SDI Service Tests
 * Tests for the main SDI orchestration service
 */

import { prismaMock } from '../../__mocks__/prisma';

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('<?xml version="1.0"?><test></test>'),
}));

// Mock Aruba SDI service
jest.mock('@server/services/sdi/aruba-sdi.service', () => ({
  arubaSdiService: {
    configure: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
    sendInvoice: jest.fn().mockResolvedValue({
      success: true,
      sdiId: 'SDI-12345',
      fileName: 'IT12345678901_00001.xml',
      sentAt: new Date(),
    }),
    getInvoiceStatus: jest.fn().mockResolvedValue({
      status: 'DELIVERED',
      sdiId: 'SDI-12345',
      notifications: [],
    }),
    testConnection: jest.fn().mockResolvedValue({
      connected: true,
      message: 'Connection successful',
    }),
    processWebhook: jest.fn().mockReturnValue({
      tipo: 'RC',
      identificativoSdi: 'SDI-12345',
    }),
  },
}));

// Mock validator service
jest.mock('@server/services/sdi/fatturapa-validator.service', () => ({
  fatturaPaValidatorService: {
    validateXml: jest.fn().mockReturnValue({ valid: true }),
    quickValidate: jest.fn().mockReturnValue(true),
  },
}));

// Import after mocks
import { sdiService } from '@server/services/sdi';
import { arubaSdiService } from '@server/services/sdi/aruba-sdi.service';
import { fatturaPaValidatorService } from '@server/services/sdi/fatturapa-validator.service';

describe('SdiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create storage directories', async () => {
      const fs = require('fs/promises');
      await sdiService.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('configureProvider', () => {
    it('should configure Aruba provider when settings specify aruba', async () => {
      prismaMock.companySettings.findFirst.mockResolvedValue({
        id: '1',
        sdiProvider: 'aruba',
        sdiProviderApiKey: 'test-key',
        sdiProviderApiSecret: 'test-secret',
        sdiProviderEndpoint: 'https://test.aruba.it',
      } as any);

      const result = await sdiService.configureProvider();

      expect(result).toBe(true);
      expect(arubaSdiService.configure).toHaveBeenCalled();
    });

    it('should return false when company settings not found', async () => {
      prismaMock.companySettings.findFirst.mockResolvedValue(null);

      const result = await sdiService.configureProvider();

      expect(result).toBe(false);
    });

    it('should return false for unsupported provider', async () => {
      prismaMock.companySettings.findFirst.mockResolvedValue({
        id: '1',
        sdiProvider: 'unsupported',
      } as any);

      const result = await sdiService.configureProvider();

      expect(result).toBe(false);
    });
  });

  describe('generateInvoiceXml', () => {
    const mockInvoice = {
      id: 'inv-1',
      invoiceNumber: 'FT-2026-0001',
      issueDate: new Date('2026-01-15'),
      dueDate: new Date('2026-02-15'),
      total: { toNumber: () => 244 },
      subtotal: { toNumber: () => 200 },
      tax: { toNumber: () => 44 },
      documentType: 'TD01',
      customer: {
        id: 'cust-1',
        businessName: 'Cliente Test',
        taxId: '98765432109',
        fiscalCode: '98765432109',
        billingAddress: {
          address1: 'Via Test 123',
          city: 'Milano',
          postcode: '20100',
          state: 'MI',
          country: 'IT',
        },
        sdiCode: '0000000',
      },
      order: {
        items: [
          {
            productName: 'Prodotto Test',
            quantity: 2,
            unitPrice: { toNumber: () => 100 },
            total: { toNumber: () => 200 },
            taxRate: { toNumber: () => 22 },
            sku: 'SKU001',
            product: { unit: 'PZ' },
          },
        ],
      },
    };

    const mockCompanySettings = {
      id: '1',
      companyName: 'Test Company Srl',
      vatNumber: '12345678901',
      fiscalCode: '12345678901',
      address: 'Via Test 456',
      postalCode: '00100',
      city: 'Roma',
      province: 'RM',
      country: 'IT',
      taxRegime: 'RF01',
      email: 'test@company.it',
    };

    it('should generate XML for a valid invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.companySettings.findFirst.mockResolvedValue(mockCompanySettings as any);
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any);

      const result = await sdiService.generateInvoiceXml('inv-1');

      expect(result.success).toBe(true);
      expect(result.xml).toBeDefined();
      expect(result.fileName).toBeDefined();
    });

    it('should return error when invoice not found', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      const result = await sdiService.generateInvoiceXml('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Fattura non trovata');
    });

    it('should return error when company settings not configured', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.companySettings.findFirst.mockResolvedValue(null);

      const result = await sdiService.generateInvoiceXml('inv-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Impostazioni aziendali non configurate');
    });

    it('should save XML file and update invoice record', async () => {
      const fs = require('fs/promises');
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.companySettings.findFirst.mockResolvedValue(mockCompanySettings as any);
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any);

      await sdiService.generateInvoiceXml('inv-1');

      expect(fs.writeFile).toHaveBeenCalled();
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            xmlFilePath: expect.any(String),
            sdiFileName: expect.any(String),
          }),
        })
      );
    });
  });

  describe('sendInvoiceToSdi', () => {
    const mockInvoice = {
      id: 'inv-1',
      invoiceNumber: 'FT-2026-0001',
      xmlFilePath: '/storage/sdi/xml/test.xml',
      sdiFileName: 'IT12345678901_00001.xml',
    };

    beforeEach(() => {
      prismaMock.companySettings.findFirst.mockResolvedValue({
        id: '1',
        sdiProvider: 'aruba',
        sdiProviderApiKey: 'test-key',
      } as any);
    });

    it('should send invoice to SDI', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any);

      const result = await sdiService.sendInvoiceToSdi('inv-1');

      expect(result.success).toBe(true);
      expect(result.sdiId).toBe('SDI-12345');
      expect(arubaSdiService.sendInvoice).toHaveBeenCalled();
    });

    it('should return error when invoice not found', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      const result = await sdiService.sendInvoiceToSdi('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovata');
    });

    it('should generate XML if not exists and then send', async () => {
      const invoiceWithoutXml = { ...mockInvoice, xmlFilePath: null, sdiFileName: null };
      prismaMock.invoice.findUnique
        .mockResolvedValueOnce(invoiceWithoutXml as any)
        .mockResolvedValueOnce(mockInvoice as any);
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any);

      // Mock successful XML generation
      const mockGenResult = { success: true, xml: '<?xml?>', fileName: 'test.xml' };
      jest.spyOn(sdiService, 'generateInvoiceXml').mockResolvedValueOnce(mockGenResult);

      const result = await sdiService.sendInvoiceToSdi('inv-1');

      expect(sdiService.generateInvoiceXml).toHaveBeenCalled();
    });

    it('should update invoice status after successful send', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any);

      await sdiService.sendInvoiceToSdi('inv-1');

      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sdiStatus: 'PENDING',
            sdiId: 'SDI-12345',
          }),
        })
      );
    });

    it('should fail validation and not send when XML is invalid', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      (fatturaPaValidatorService.validateXml as jest.Mock).mockReturnValueOnce({
        valid: false,
        errors: [{ message: 'Test error' }],
      });

      const result = await sdiService.sendInvoiceToSdi('inv-1');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(arubaSdiService.sendInvoice).not.toHaveBeenCalled();
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status from SDI', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'FT-2026-0001',
        sdiId: 'SDI-12345',
      } as any);
      prismaMock.invoice.update.mockResolvedValue({} as any);
      prismaMock.sdiNotification.create.mockResolvedValue({} as any);
      prismaMock.companySettings.findFirst.mockResolvedValue({
        sdiProvider: 'aruba',
      } as any);

      const result = await sdiService.updateInvoiceStatus('inv-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('DELIVERED');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sdiStatus: 'DELIVERED',
          }),
        })
      );
    });

    it('should return null when invoice not found', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      const result = await sdiService.updateInvoiceStatus('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when invoice has no sdiId', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        sdiId: null,
      } as any);

      const result = await sdiService.updateInvoiceStatus('inv-1');

      expect(result).toBeNull();
    });
  });

  describe('validateInvoiceXml', () => {
    it('should validate existing XML', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        xmlFilePath: '/storage/test.xml',
      } as any);
      (fatturaPaValidatorService.validateXml as jest.Mock).mockReturnValueOnce({ valid: true });

      const result = await sdiService.validateInvoiceXml('inv-1');

      expect(result.valid).toBe(true);
    });

    it('should generate XML first if not exists', async () => {
      prismaMock.invoice.findUnique
        .mockResolvedValueOnce({ id: 'inv-1', xmlFilePath: null } as any)
        .mockResolvedValueOnce({ id: 'inv-1', xmlFilePath: '/storage/test.xml' } as any);

      jest.spyOn(sdiService, 'generateInvoiceXml').mockResolvedValueOnce({
        success: true,
        xml: '<?xml?>',
        fileName: 'test.xml',
      });

      const result = await sdiService.validateInvoiceXml('inv-1');

      expect(sdiService.generateInvoiceXml).toHaveBeenCalledWith('inv-1');
    });

    it('should return validation errors', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        xmlFilePath: '/storage/test.xml',
      } as any);
      (fatturaPaValidatorService.validateXml as jest.Mock).mockReturnValueOnce({
        valid: false,
        errors: [{ message: 'Campo mancante' }],
      });

      const result = await sdiService.validateInvoiceXml('inv-1');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('processWebhook', () => {
    it('should process Aruba webhook notification', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'FT-2026-0001',
      } as any);
      prismaMock.invoice.update.mockResolvedValue({} as any);
      prismaMock.sdiNotification.create.mockResolvedValue({} as any);

      const result = await sdiService.processWebhook('aruba', { test: 'payload' });

      expect(result.processed).toBe(true);
      expect(result.invoiceId).toBe('inv-1');
    });

    it('should return processed false when invoice not found', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      const result = await sdiService.processWebhook('aruba', { test: 'payload' });

      expect(result.processed).toBe(false);
    });

    it('should update invoice status based on notification type', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'FT-2026-0001',
      } as any);
      prismaMock.invoice.update.mockResolvedValue({} as any);
      prismaMock.sdiNotification.create.mockResolvedValue({} as any);

      await sdiService.processWebhook('aruba', { test: 'payload' });

      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sdiStatus: 'DELIVERED', // RC notification maps to DELIVERED
          }),
        })
      );
    });
  });

  describe('retryFailedInvoice', () => {
    it('should retry sending failed invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        sdiStatus: 'REJECTED',
        xmlFilePath: '/storage/test.xml',
        sdiFileName: 'test.xml',
      } as any);
      prismaMock.invoice.update.mockResolvedValue({} as any);
      prismaMock.companySettings.findFirst.mockResolvedValue({
        sdiProvider: 'aruba',
      } as any);

      const result = await sdiService.retryFailedInvoice('inv-1');

      expect(result.success).toBe(true);
    });

    it('should reset SDI fields before retry', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        sdiStatus: 'REJECTED',
        xmlFilePath: '/storage/test.xml',
        sdiFileName: 'test.xml',
      } as any);
      prismaMock.invoice.update.mockResolvedValue({} as any);
      prismaMock.companySettings.findFirst.mockResolvedValue({
        sdiProvider: 'aruba',
      } as any);

      await sdiService.retryFailedInvoice('inv-1');

      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sdiStatus: 'NOT_SENT',
            sdiId: null,
            sdiErrorCode: null,
            sdiErrorMessage: null,
          }),
        })
      );
    });

    it('should reject retry for non-error status', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        sdiStatus: 'DELIVERED',
      } as any);

      const result = await sdiService.retryFailedInvoice('inv-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non è in stato di errore');
    });
  });

  describe('listInvoicesWithSdiStatus', () => {
    it('should list invoices with pagination', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', invoiceNumber: 'FT-001', sdiStatus: 'PENDING' },
        { id: 'inv-2', invoiceNumber: 'FT-002', sdiStatus: 'DELIVERED' },
      ] as any);
      prismaMock.invoice.count.mockResolvedValue(2);

      const result = await sdiService.listInvoicesWithSdiStatus({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pages).toBe(1);
    });

    it('should filter by sdiStatus', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoice.count.mockResolvedValue(0);

      await sdiService.listInvoicesWithSdiStatus({ sdiStatus: 'REJECTED' });

      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sdiStatus: 'REJECTED',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoice.count.mockResolvedValue(0);

      await sdiService.listInvoicesWithSdiStatus({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('getInvoiceXml', () => {
    it('should return XML content', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        xmlFilePath: '/storage/test.xml',
      } as any);

      const result = await sdiService.getInvoiceXml('inv-1');

      expect(result).toContain('<?xml');
    });

    it('should return null when no XML path', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        xmlFilePath: null,
      } as any);

      const result = await sdiService.getInvoiceXml('inv-1');

      expect(result).toBeNull();
    });
  });
});
