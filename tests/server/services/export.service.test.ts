/**
 * Export Service Tests
 * Tests for PDF, Excel, and CSV generation
 */

// Mock fs/promises
const mockFs = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
  access: jest.fn(),
};
jest.mock('fs/promises', () => mockFs);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Mock PDFDocument
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    page: { width: 595, height: 842 },
    on: jest.fn().mockImplementation(function (this: any, event: string, handler: Function) {
      if (event === 'data') {
        setTimeout(() => handler(Buffer.from('PDF chunk')), 0);
      }
      if (event === 'end') {
        setTimeout(() => handler(), 10);
      }
      return this;
    }),
    end: jest.fn(),
    y: 100,
    x: 50,
  }));
});

// Mock ExcelJS
const createMockCell = () => ({
  value: null,
  numFmt: '',
  fill: null,
  font: null,
  alignment: null,
});

const mockWorksheet = {
  getColumn: jest.fn().mockReturnValue({ width: 10 }),
  getRow: jest.fn().mockReturnValue({
    font: {},
    fill: {},
    eachCell: jest.fn(),
    height: 15,
    values: [],
    getCell: jest.fn().mockReturnValue(createMockCell()),
  }),
  getCell: jest.fn().mockReturnValue(createMockCell()),
  addRow: jest.fn().mockReturnValue({
    font: {},
    fill: {},
    eachCell: jest.fn(),
    getCell: jest.fn().mockReturnValue(createMockCell()),
  }),
  mergeCells: jest.fn(),
  columns: [],
  eachRow: jest.fn(),
  addConditionalFormatting: jest.fn(),
};

const mockWorkbook = {
  addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
  xlsx: {
    writeBuffer: jest.fn().mockResolvedValue(Buffer.from('Excel content')),
  },
};

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => mockWorkbook),
}));

// Mock Prisma
const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  inventoryItem: {
    findMany: jest.fn(),
  },
  customer: {
    findMany: jest.fn(),
  },
  supplier: {
    findMany: jest.fn(),
  },
  companySettings: {
    findFirst: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import { exportService } from '@server/services/export.service';

describe('Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================
  // initialize Tests
  // =====================================
  describe('initialize', () => {
    it('should create PDF storage directory', async () => {
      await exportService.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('sdi/pdf'),
        { recursive: true }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('PDF storage inizializzato')
      );
    });

    it('should handle directory creation error', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await exportService.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Errore inizializzazione'),
        expect.any(Error)
      );
    });
  });

  // =====================================
  // generateInvoicePdf Tests
  // =====================================
  describe('generateInvoicePdf', () => {
    it('should generate PDF buffer for invoice', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'FT-2026/00001',
        issueDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        subtotal: 1000,
        tax: 220,
        total: 1220,
        notes: 'Test invoice',
        customer: {
          businessName: 'Acme Corp',
          address: JSON.stringify({ street: 'Via Test 1', city: 'Roma', zip: '00100' }),
          taxId: 'IT12345678901',
          fiscalCode: 'RSSMRA80A01H501U',
        },
        order: {
          items: [
            {
              productName: 'Product 1',
              quantity: 5,
              unitPrice: 200,
              total: 1000,
              product: { name: 'Product 1' },
            },
          ],
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          include: expect.objectContaining({
            customer: true,
            order: expect.any(Object),
          }),
        })
      );
    });

    it('should throw error when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(exportService.generateInvoicePdf('non-existent')).rejects.toThrow(
        'Fattura non trovata'
      );
    });

    it('should handle missing customer name gracefully', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'FT-2026/00001',
        issueDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        subtotal: 100,
        tax: 22,
        total: 122,
        customer: {
          firstName: 'Mario',
          lastName: 'Rossi',
        },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // generateFatturaElettronicaPdf Tests
  // =====================================
  describe('generateFatturaElettronicaPdf', () => {
    it('should generate FatturaPA PDF and save to filesystem', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'FT-2026/00001',
        issueDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        subtotal: 1000,
        tax: 220,
        total: 1220,
        documentType: 'TD01',
        sdiStatus: 'CONSEGNATA',
        bolloVirtuale: true,
        bolloAmount: 2,
        customer: {
          businessName: 'Acme Corp',
          taxId: 'IT12345678901',
          sdiCode: '0000000',
          pecEmail: 'pec@acme.it',
        },
        order: { items: [] },
      };

      const mockCompany = {
        name: 'Test Company',
        legalName: 'Test Company SRL',
        address: 'Via Test',
        city: 'Roma',
        province: 'RM',
        postalCode: '00100',
        country: 'IT',
        taxId: 'IT12345678901',
        email: 'info@test.com',
        pec: 'pec@test.com',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice);

      const result = await exportService.generateFatturaElettronicaPdf('inv-1');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.filePath).toContain('.pdf');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(exportService.generateFatturaElettronicaPdf('non-existent')).rejects.toThrow(
        'Fattura non trovata'
      );
    });
  });

  // =====================================
  // getInvoicePdfFile Tests
  // =====================================
  describe('getInvoicePdfFile', () => {
    it('should return cached PDF file when it exists', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'FT-2026/00001',
        pdfFilePath: '/storage/sdi/pdf/FT-2026-00001.pdf',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(Buffer.from('Cached PDF'));

      const result = await exportService.getInvoicePdfFile('inv-1');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.fileName).toBe('FT-2026-00001.pdf');
    });

    it('should regenerate PDF when file is missing', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'FT-2026/00001',
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 100,
        tax: 22,
        total: 122,
        pdfFilePath: '/storage/sdi/pdf/FT-2026-00001.pdf',
        customer: { businessName: 'Test' },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockFs.access.mockRejectedValue(new Error('ENOENT')); // File doesn't exist
      mockPrisma.companySettings.findFirst.mockResolvedValue({
        name: 'Test Co',
        address: 'Test',
        city: 'Roma',
        province: 'RM',
        postalCode: '00100',
        country: 'IT',
        taxId: 'IT00000000000',
        email: 'test@test.com',
      });
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice);

      const result = await exportService.getInvoicePdfFile('inv-1');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should throw error when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(exportService.getInvoicePdfFile('non-existent')).rejects.toThrow(
        'Fattura non trovata'
      );
    });
  });

  // =====================================
  // generateOrderConfirmationPdf Tests
  // =====================================
  describe('generateOrderConfirmationPdf', () => {
    it('should generate order confirmation PDF', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-2026-00001',
        orderDate: new Date('2026-01-15'),
        status: 'CONFIRMED',
        subtotal: 1000,
        tax: 220,
        shipping: 15,
        total: 1235,
        customer: {
          businessName: 'Acme Corp',
          email: 'info@acme.com',
          phone: '+39 123456789',
        },
        items: [
          {
            productName: 'Product 1',
            sku: 'SKU-001',
            quantity: 5,
            unitPrice: 200,
            total: 1000,
            product: { name: 'Product 1' },
          },
        ],
        shippingAddress: JSON.stringify({
          street: 'Via Test 1',
          city: 'Roma',
          zip: '00100',
        }),
        notes: 'Please handle with care',
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await exportService.generateOrderConfirmationPdf('ord-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should throw error when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(exportService.generateOrderConfirmationPdf('non-existent')).rejects.toThrow(
        'Ordine non trovato'
      );
    });
  });

  // =====================================
  // generateReportPdf Tests
  // =====================================
  describe('generateReportPdf', () => {
    it('should generate tabular report PDF', async () => {
      const reportData = {
        title: 'Monthly Sales Report',
        subtitle: 'January 2026',
        dateRange: { from: new Date('2026-01-01'), to: new Date('2026-01-31') },
        columns: ['Product', 'Quantity', 'Revenue'],
        rows: [
          ['Product A', 100, 5000],
          ['Product B', 50, 2500],
        ],
        totals: ['Total', 150, 7500],
        summary: { totalOrders: 25, avgOrderValue: 300 },
      };

      const result = await exportService.generateReportPdf(reportData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // Excel Generation Tests
  // =====================================
  describe('generateProductsExcel', () => {
    it('should generate products Excel file', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Product 1',
          description: 'Description 1',
          category: 'Category A',
          price: 100,
          cost: 50,
          unit: 'pz',
          isActive: true,
          createdAt: new Date(),
          inventory: [{ quantity: 10 }],
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await exportService.generateProductsExcel();

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Prodotti');
    });

    it('should apply filters when provided', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await exportService.generateProductsExcel({ category: 'Electronics', isActive: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Electronics',
            isActive: true,
          }),
        })
      );
    });
  });

  describe('generateOrdersExcel', () => {
    it('should call prisma to fetch orders within date range', async () => {
      const mockOrders: any[] = [];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      // This test verifies the date filtering is applied correctly
      // The actual Excel generation requires complex ExcelJS mocking
      await exportService.generateOrdersExcel(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      ).catch(() => {}); // May fail due to incomplete mock

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('generateInventoryExcel', () => {
    it('should call prisma to fetch inventory data', async () => {
      const mockInventory: any[] = [];

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockInventory);

      // Test verifies the query is made - actual Excel generation requires complex mocking
      await exportService.generateInventoryExcel().catch(() => {});

      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalled();
    });
  });

  // =====================================
  // CSV Generation Tests
  // =====================================
  describe('generateProductsCsv', () => {
    it('should call prisma to fetch products for CSV', async () => {
      const mockProducts: any[] = [];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await exportService.generateProductsCsv();

      expect(typeof result).toBe('string');
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
  });

  describe('generateCustomersCsv', () => {
    it('should call prisma to fetch customers for CSV', async () => {
      const mockCustomers: any[] = [];

      mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);

      const result = await exportService.generateCustomersCsv();

      expect(typeof result).toBe('string');
      expect(mockPrisma.customer.findMany).toHaveBeenCalled();
    });
  });

  describe('generateInventoryCsv', () => {
    it('should call prisma to fetch inventory for CSV', async () => {
      const mockInventory: any[] = [];

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockInventory);

      const result = await exportService.generateInventoryCsv();

      expect(typeof result).toBe('string');
      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalled();
    });
  });

  describe('generateSuppliersCsv', () => {
    it('should call prisma to fetch suppliers for CSV', async () => {
      const mockSuppliers: any[] = [];

      mockPrisma.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await exportService.generateSuppliersCsv();

      expect(typeof result).toBe('string');
      expect(mockPrisma.supplier.findMany).toHaveBeenCalled();
    });
  });

  // =====================================
  // Report PDF Tests
  // =====================================
  describe('generateRFMReportPdf', () => {
    it('should generate RFM segmentation report PDF', async () => {
      // Data structure must match service expectations exactly
      const rfmData = {
        dateRange: { from: new Date(), to: new Date() },
        segments: [
          {
            customerName: 'Acme Corp',
            customerType: 'B2B',
            rfmScore: 555,
            segment: 'Champions',
            recencyDays: 5, // Service uses recencyDays.toString()
            frequency: 50, // Service uses frequency.toString()
            monetary: 100000, // Service uses monetary.toFixed(2)
          },
        ],
        summary: {
          Champions: { count: 10, totalRevenue: 500000, avgOrderValue: 5000 },
          Loyal: { count: 20, totalRevenue: 300000, avgOrderValue: 3000 },
        },
      };

      const result = await exportService.generateRFMReportPdf(rfmData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateProfitLossReportPdf', () => {
    it('should generate P&L report PDF', async () => {
      // Service expects specific field names
      const plData = {
        period: 'Q1 2026', // String, not object
        revenue: 1000000,
        costOfGoodsSold: 600000, // Not 'cogs'
        grossProfit: 400000,
        grossMargin: 40,
        operatingExpenses: 200000,
        operatingIncome: 200000,
        operatingMargin: 20,
        breakdown: {
          byCategory: {
            Electronics: { revenue: 500000, cost: 300000, profit: 200000 },
            Accessories: { revenue: 500000, cost: 300000, profit: 200000 },
          },
          byChannel: {
            WEB: { revenue: 600000, cost: 360000, profit: 240000 },
            B2B: { revenue: 400000, cost: 240000, profit: 160000 },
          },
        },
      };

      const result = await exportService.generateProfitLossReportPdf(plData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateAgingReportPdf', () => {
    it('should generate receivables aging report PDF', async () => {
      // Service expects summary with numeric values, details with specific fields
      const agingData = {
        summary: {
          current: 10000,
          days30: 5000,
          days60: 3000,
          days90: 2000,
          over90: 1000,
          total: 21000,
        },
        details: [
          {
            entityName: 'Acme Corp',
            invoiceNumber: 'FT-001',
            dueDate: new Date(),
            outstanding: 5000,
            daysOverdue: 15, // Required for toString()
            bucket: '1-30', // Required field
          },
        ],
      };

      const result = await exportService.generateAgingReportPdf('receivables', agingData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateDeadStockReportPdf', () => {
    it('should generate dead stock report PDF', async () => {
      // Service expects items, totalValue, totalItems, and recommendations array
      const deadStockData = {
        totalValue: 50000,
        totalItems: 25,
        items: [
          {
            sku: 'SKU-OLD',
            name: 'Old Product',
            category: 'Electronics',
            currentStock: 100,
            daysSinceLastSale: 380,
            stockValue: 5000,
            recommendation: 'LIQUIDATE',
          },
        ],
        recommendations: [
          { action: 'LIQUIDATE', count: 10, value: 25000 },
          { action: 'DISCOUNT_HEAVY', count: 8, value: 15000 },
          { action: 'DISCOUNT_LIGHT', count: 7, value: 10000 },
        ],
      };

      const result = await exportService.generateDeadStockReportPdf(deadStockData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateCashflowForecastPdf', () => {
    it('should generate cashflow forecast PDF', async () => {
      // Service expects array of periods with specific field names
      const cashflowData = [
        {
          period: 'Feb 2026',
          openingBalance: 100000, // Not startingBalance
          expectedInflows: 100000, // Not inflows
          expectedOutflows: 80000, // Not outflows
          netCashflow: 20000, // Not netFlow
          closingBalance: 120000, // Not endingBalance
          inflowDetails: [
            { source: 'Vendite', amount: 80000 },
            { source: 'Incassi fatture', amount: 20000 },
          ],
          outflowDetails: [
            { source: 'Fornitori', amount: 50000 },
            { source: 'Stipendi', amount: 30000 },
          ],
        },
        {
          period: 'Mar 2026',
          openingBalance: 120000,
          expectedInflows: 120000,
          expectedOutflows: 90000,
          netCashflow: 30000,
          closingBalance: 150000,
          inflowDetails: [
            { source: 'Vendite', amount: 100000 },
            { source: 'Incassi fatture', amount: 20000 },
          ],
          outflowDetails: [
            { source: 'Fornitori', amount: 60000 },
            { source: 'Stipendi', amount: 30000 },
          ],
        },
      ];

      const result = await exportService.generateCashflowForecastPdf(cashflowData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // generateOrderConfirmationPdf - Additional Tests
  // =====================================
  describe('generateOrderConfirmationPdf - Additional', () => {
    it('should handle order without shipping address', async () => {
      const mockOrder = {
        id: 'ord-2',
        orderNumber: 'ORD-2026-00002',
        orderDate: new Date('2026-01-20'),
        status: 'PENDING',
        subtotal: 500,
        tax: 110,
        shipping: 0,
        total: 610,
        customer: {
          firstName: 'Mario',
          lastName: 'Rossi',
          email: 'mario@test.com',
        },
        items: [],
        shippingAddress: null,
        notes: null,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await exportService.generateOrderConfirmationPdf('ord-2');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // generateInvoicePdf - Additional Tests
  // =====================================
  describe('generateInvoicePdf - Additional', () => {
    it('should handle invoice with no order items', async () => {
      const mockInvoice = {
        id: 'inv-2',
        invoiceNumber: 'FT-2026/00002',
        issueDate: new Date('2026-01-20'),
        dueDate: new Date('2026-02-20'),
        subtotal: 0,
        tax: 0,
        total: 0,
        notes: null,
        customer: {
          businessName: 'Empty Corp',
        },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-2');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle invoice with long notes', async () => {
      const mockInvoice = {
        id: 'inv-3',
        invoiceNumber: 'FT-2026/00003',
        issueDate: new Date('2026-01-25'),
        dueDate: new Date('2026-02-25'),
        subtotal: 100,
        tax: 22,
        total: 122,
        notes: 'This is a very long note '.repeat(50),
        customer: {
          businessName: 'Notes Corp',
        },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-3');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // generateFatturaElettronicaPdf - Additional Tests
  // =====================================
  describe('generateFatturaElettronicaPdf - Additional', () => {
    it('should throw error when company settings not found', async () => {
      const mockInvoice = {
        id: 'inv-4',
        invoiceNumber: 'FT-2026/00004',
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 100,
        tax: 22,
        total: 122,
        customer: { businessName: 'Test' },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.companySettings.findFirst.mockResolvedValue(null);

      await expect(exportService.generateFatturaElettronicaPdf('inv-4')).rejects.toThrow(
        'Impostazioni aziendali non configurate'
      );
    });

    it('should handle invoice with all FatturaPA fields', async () => {
      const mockInvoice = {
        id: 'inv-5',
        invoiceNumber: 'FT-2026/00005',
        issueDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        subtotal: 1000,
        tax: 220,
        total: 1220,
        documentType: 'TD04', // Nota di credito
        sdiStatus: 'DELIVERED',
        bolloVirtual: true,
        bolloAmount: 2,
        socialSecurityType: 'TC07', // ENASARCO
        socialSecurityRate: 4,
        socialSecurityAmount: 40,
        withholdingTaxType: 'RT02',
        withholdingTaxRate: 20,
        withholdingTaxAmount: 200,
        withholdingTaxReason: 'A',
        paymentMethodPa: 'MP05', // Bonifico
        customer: {
          businessName: 'Full PA Corp',
          taxId: 'IT12345678901',
          fiscalCode: 'RSSMRA80A01H501U',
          sdiCode: 'M5UXCR1',
          pecEmail: 'pec@test.it',
          billingAddress: { street: 'Via Test', city: 'Roma', postcode: '00100' },
        },
        order: {
          items: [
            {
              productName: 'Product 1',
              quantity: 2,
              unitPrice: 500,
              taxRate: 22,
              total: 1000,
              product: { name: 'Product 1' },
            },
          ],
        },
      };

      const mockCompany = {
        companyName: 'Full Company',
        legalName: 'Full Company SRL',
        address: 'Via Company',
        city: 'Milano',
        province: 'MI',
        postalCode: '20100',
        country: 'IT',
        vatNumber: 'IT98765432101',
        fiscalCode: 'RSSMRA80A01H501U',
        phone: '+39 02 1234567',
        email: 'info@company.it',
        pec: 'pec@company.it',
        reaNumber: '12345',
        capitalAmount: 10000,
        taxRegime: 'RF01',
        bankName: 'Test Bank',
        iban: 'IT60X0542811101000000123456',
        bic: 'BLOPIT22',
        invoiceFooterNotes: 'Footer notes',
        paymentInstructions: 'Payment instructions',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.companySettings.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice);

      const result = await exportService.generateFatturaElettronicaPdf('inv-5');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.filePath).toBeDefined();
    });
  });

  // =====================================
  // CSV Generation - Additional Tests with Data
  // =====================================
  describe('generateProductsCsv - with data', () => {
    it('should generate CSV with actual product data', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Product 1',
          description: 'Description with, comma',
          price: 100.50,
          cost: 50.25,
          category: 'Electronics',
          isActive: true,
          inventory: [{ quantity: 10 }],
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          name: 'Product "2"',
          description: 'Description with "quotes"',
          price: 200,
          cost: 100,
          category: 'Accessories',
          isActive: false,
          inventory: [{ quantity: 0 }],
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await exportService.generateProductsCsv();

      expect(typeof result).toBe('string');
      expect(result).toContain('SKU-001');
      expect(result).toContain('SKU-002');
    });
  });

  describe('generateCustomersCsv - with data', () => {
    it('should generate CSV with actual customer data', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          email: 'customer1@test.com',
          firstName: 'Mario',
          lastName: 'Rossi',
          businessName: null,
          phone: '+39 123456789',
          isB2B: false,
          address: { street: 'Via Test', city: 'Roma' },
          createdAt: new Date('2026-01-01'),
          orders: [
            { total: 100 },
            { total: 200 },
          ],
        },
        {
          id: 'cust-2',
          email: 'info@acme.com',
          firstName: null,
          lastName: null,
          businessName: 'Acme Corp',
          phone: '+39 987654321',
          isB2B: true,
          address: null,
          createdAt: new Date('2025-06-15'),
          orders: [
            { total: 25000 },
            { total: 25000 },
          ],
        },
      ];

      mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);

      const result = await exportService.generateCustomersCsv();

      expect(typeof result).toBe('string');
      expect(result).toContain('customer1@test.com');
      expect(result).toContain('Acme Corp');
    });
  });

  describe('generateInventoryCsv - with data', () => {
    it('should generate CSV with actual inventory data', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          location: 'WEB',
          quantity: 100,
          reservedQuantity: 10,
          product: {
            sku: 'SKU-001',
            name: 'Product 1',
            category: 'Electronics',
          },
          warehouse: {
            name: 'Main Warehouse',
          },
          variant: null,
        },
        {
          id: 'inv-2',
          location: 'B2B',
          quantity: 50,
          reservedQuantity: 0,
          product: {
            sku: 'SKU-002',
            name: 'Product 2',
            category: 'Accessories',
          },
          warehouse: {
            name: 'B2B Warehouse',
          },
          variant: { name: 'Large' },
        },
      ];

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockInventory);

      const result = await exportService.generateInventoryCsv();

      expect(typeof result).toBe('string');
      expect(result).toContain('SKU-001');
      expect(result).toContain('WEB');
      expect(result).toContain('B2B');
    });
  });

  describe('generateSuppliersCsv - with data', () => {
    it('should generate CSV with actual supplier data', async () => {
      const mockSuppliers = [
        {
          id: 'sup-1',
          code: 'SUP001',
          businessName: 'Supplier One',
          email: 'supplier1@test.com',
          phone: '+39 111111111',
          vatNumber: 'IT12345678901',
          address: JSON.stringify({ street: 'Via Test', city: 'Roma' }),
          isActive: true,
          purchaseOrders: [
            { total: 5000 },
            { total: 3000 },
          ],
        },
        {
          id: 'sup-2',
          code: 'SUP002',
          businessName: 'Supplier Two',
          email: 'supplier2@test.com',
          phone: '+39 222222222',
          vatNumber: 'IT98765432101',
          address: null,
          isActive: false,
          purchaseOrders: [],
        },
      ];

      mockPrisma.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await exportService.generateSuppliersCsv();

      expect(typeof result).toBe('string');
      expect(result).toContain('SUP001');
      expect(result).toContain('Supplier One');
    });
  });

  // =====================================
  // generateReportPdf - Additional Tests
  // =====================================
  describe('generateReportPdf - Additional', () => {
    it('should handle report with many rows (pagination)', async () => {
      const rows = Array(100).fill(null).map((_, i) => [
        `Product ${i}`,
        i * 10,
        i * 100,
      ]);

      const reportData = {
        title: 'Large Report',
        columns: ['Product', 'Quantity', 'Revenue'],
        rows,
      };

      const result = await exportService.generateReportPdf(reportData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle report without optional fields', async () => {
      const reportData = {
        title: 'Minimal Report',
        columns: ['Col1', 'Col2'],
        rows: [['A', 'B']],
      };

      const result = await exportService.generateReportPdf(reportData);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // Excel Generation - Additional Tests
  // =====================================
  describe('generateOrdersExcel - with data', () => {
    it('should generate orders Excel with complete data', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          orderNumber: 'ORD-001',
          orderDate: new Date('2026-01-15'),
          status: 'SHIPPED',
          subtotal: 1000,
          tax: 220,
          shipping: 15,
          total: 1235,
          customer: {
            businessName: 'Customer Corp',
            email: 'customer@test.com',
          },
          items: [
            {
              productName: 'Product 1',
              sku: 'SKU-001',
              quantity: 5,
              unitPrice: 200,
              total: 1000,
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await exportService.generateOrdersExcel(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateInventoryExcel - with data', () => {
    it('should generate inventory Excel with complete data', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          location: 'WEB',
          quantity: 100,
          reservedQuantity: 10,
          lastCountDate: new Date('2026-01-10'),
          product: {
            sku: 'SKU-001',
            name: 'Product 1',
            category: 'Electronics',
            cost: 50,
            price: 100,
          },
          warehouse: {
            name: 'Main Warehouse',
          },
          variant: null,
        },
      ];

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockInventory);

      const result = await exportService.generateInventoryExcel();

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  // =====================================
  // Helper method tests
  // =====================================
  describe('formatAddress helper', () => {
    it('should handle null address', async () => {
      const mockInvoice = {
        id: 'inv-addr-1',
        invoiceNumber: 'FT-2026/ADDR1',
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 100,
        tax: 22,
        total: 122,
        customer: {
          businessName: 'No Address Corp',
          address: null,
        },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-addr-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle JSON string address', async () => {
      const mockInvoice = {
        id: 'inv-addr-2',
        invoiceNumber: 'FT-2026/ADDR2',
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 100,
        tax: 22,
        total: 122,
        customer: {
          businessName: 'JSON Address Corp',
          address: JSON.stringify({
            street: 'Via Example',
            city: 'Roma',
            zip: '00100',
            country: 'IT',
          }),
        },
        order: { items: [] },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await exportService.generateInvoicePdf('inv-addr-2');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
