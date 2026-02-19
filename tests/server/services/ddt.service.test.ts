import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter } from 'events';

// Create mock instance
const prismaMock = mockDeep<PrismaClient>();

const mockCompanySettingsService = {
  getNextDdtNumber: jest.fn().mockResolvedValue('DDT-2024/00001'),
  get: jest.fn().mockResolvedValue({
    companyName: 'Test Company',
    address: '123 Test St',
    postalCode: '12345',
    city: 'Test City',
    province: 'TC',
    vatNumber: 'IT12345678901',
    fiscalCode: 'TSTTST80A01H501A',
    phone: '+39 1234567890',
    email: 'test@company.com',
  }),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock PDFDocument
class MockPDFDocument extends EventEmitter {
  bufferedPageRange = jest.fn().mockReturnValue({ count: 1 });
  switchToPage = jest.fn();
  addPage = jest.fn().mockReturnThis();
  fontSize = jest.fn().mockReturnThis();
  font = jest.fn().mockReturnThis();
  text = jest.fn().mockReturnThis();
  rect = jest.fn().mockReturnThis();
  stroke = jest.fn().mockReturnThis();
  fill = jest.fn().mockReturnThis();
  fillColor = jest.fn().mockReturnThis();
  moveTo = jest.fn().mockReturnThis();
  lineTo = jest.fn().mockReturnThis();
  page = { height: 842 };

  end() {
    setTimeout(() => {
      this.emit('data', Buffer.from('test-pdf-content'));
      this.emit('end');
    }, 0);
  }
}

// Mock dependencies
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

jest.mock('@server/services/company-settings.service', () => ({
  companySettingsService: mockCompanySettingsService,
}));

jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => new MockPDFDocument());
});

import { ddtService } from '@server/services/ddt.service';

// Helper to create Decimal values
const createDecimal = (value: number): Decimal => new Decimal(value);

describe('DdtService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // ==================== list ====================
  describe('list', () => {
    it('should return paginated DDT list', async () => {
      const mockDdts = [
        {
          id: 'ddt-1',
          ddtNumber: 'DDT-2024/00001',
          customerId: 'cust-1',
          customer: { id: 'cust-1', code: 'C001', businessName: 'Test Co' },
          order: { id: 'order-1', orderNumber: 'ORD-001' },
          items: [],
        },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);
      prismaMock.dDT.count.mockResolvedValue(1);

      const result = await ddtService.list({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by customerId', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ customerId: 'cust-1' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
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

    it('should filter by isInvoiced', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ isInvoiced: false });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isInvoiced: false,
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ search: 'DDT-2024' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { ddtNumber: { contains: 'DDT-2024', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should support sorting', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ sortBy: 'ddtNumber', sortOrder: 'asc' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { ddtNumber: 'asc' },
        })
      );
    });

    it('should apply pagination correctly', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(100);

      const result = await ddtService.list({ page: 3, limit: 20 });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
      expect(result.pages).toBe(5);
    });
  });

  // ==================== getById ====================
  describe('getById', () => {
    it('should return DDT with related data', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customer: { businessName: 'Test Co' },
        order: { orderNumber: 'ORD-001', items: [] },
        items: [{ lineNumber: 1, sku: 'SKU001' }],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);

      const result = await ddtService.getById('ddt-1');

      expect(result).toEqual(mockDdt);
      expect(prismaMock.dDT.findUnique).toHaveBeenCalledWith({
        where: { id: 'ddt-1' },
        include: expect.objectContaining({
          customer: true,
          order: expect.any(Object),
          items: expect.any(Object),
        }),
      });
    });

    it('should return null when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      const result = await ddtService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== getByNumber ====================
  describe('getByNumber', () => {
    it('should return DDT by number', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);

      const result = await ddtService.getByNumber('DDT-2024/00001');

      expect(result).toEqual(mockDdt);
      expect(prismaMock.dDT.findUnique).toHaveBeenCalledWith({
        where: { ddtNumber: 'DDT-2024/00001' },
        include: expect.any(Object),
      });
    });

    it('should return null when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      const result = await ddtService.getByNumber('DDT-INVALID');

      expect(result).toBeNull();
    });
  });

  // ==================== create ====================
  describe('create', () => {
    it('should create DDT with generated number', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customerId: 'cust-1',
        items: [],
      };

      prismaMock.dDT.create.mockResolvedValue(mockDdt as any);

      const result = await ddtService.create({
        customerId: 'cust-1',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          zip: '12345',
        },
        items: [
          {
            sku: 'SKU001',
            description: 'Test Product',
            quantity: 10,
          },
        ],
      });

      expect(mockCompanySettingsService.getNextDdtNumber).toHaveBeenCalled();
      expect(prismaMock.dDT.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ddtNumber: 'DDT-2024/00001',
          customerId: 'cust-1',
        }),
        include: expect.any(Object),
      });
    });

    it('should map items with line numbers', async () => {
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1', items: [] } as any);

      await ddtService.create({
        customerId: 'cust-1',
        shippingAddress: { street: '123', city: 'City', zip: '12345' },
        items: [
          { sku: 'SKU001', description: 'Product 1', quantity: 5 },
          { sku: 'SKU002', description: 'Product 2', quantity: 10 },
        ],
      });

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].lineNumber).toBe(1);
      expect(createCall.data.items.create[1].lineNumber).toBe(2);
    });

    it('should use default values for optional fields', async () => {
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1' } as any);

      await ddtService.create({
        customerId: 'cust-1',
        shippingAddress: { street: '123', city: 'City', zip: '12345' },
        items: [{ sku: 'SKU001', description: 'Product', quantity: 5 }],
      });

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.numberOfPackages).toBe(1);
      expect(createCall.data.transportReason).toBe('VENDITA');
      expect(createCall.data.items.create[0].unit).toBe('pz');
    });

    it('should log creation', async () => {
      prismaMock.dDT.create.mockResolvedValue({ ddtNumber: 'DDT-2024/00001' } as any);

      await ddtService.create({
        customerId: 'cust-1',
        shippingAddress: { street: '123', city: 'City', zip: '12345' },
        items: [{ sku: 'SKU001', description: 'Product', quantity: 5 }],
      });

      expect(mockLogger.info).toHaveBeenCalledWith('DDT creato: DDT-2024/00001');
    });
  });

  // ==================== createFromOrder ====================
  describe('createFromOrder', () => {
    it('should create DDT from order', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        carrier: 'DHL',
        shippingAddress: {
          address_1: '123 Test St',
          city: 'Test City',
          state: 'TC',
          postcode: '12345',
          country: 'IT',
        },
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU001',
            productName: 'Product 1',
            quantity: 5,
            unitPrice: createDecimal(10),
            product: { unit: 'pz' },
          },
        ],
        customer: { businessName: 'Test Co' },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1', ddtNumber: 'DDT-2024/00001' } as any);

      const result = await ddtService.createFromOrder('order-1', { notes: 'Test note' });

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: expect.any(Object),
      });
      expect(prismaMock.dDT.create).toHaveBeenCalled();
    });

    it('should throw error when order not found', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(ddtService.createFromOrder('non-existent')).rejects.toThrow(
        'Ordine non trovato'
      );
    });

    it('should throw error when order has no shipping address', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        shippingAddress: null,
        items: [],
      } as any);

      await expect(ddtService.createFromOrder('order-1')).rejects.toThrow(
        'Ordine senza indirizzo di spedizione'
      );
    });
  });

  // ==================== update ====================
  describe('update', () => {
    it('should update DDT fields', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        isInvoiced: false,
      } as any);
      prismaMock.dDT.update.mockResolvedValue({
        id: 'ddt-1',
        carrier: 'UPS',
      } as any);

      const result = await ddtService.update('ddt-1', { carrier: 'UPS' });

      expect(prismaMock.dDT.update).toHaveBeenCalledWith({
        where: { id: 'ddt-1' },
        data: expect.objectContaining({
          carrier: 'UPS',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(
        ddtService.update('non-existent', { carrier: 'UPS' })
      ).rejects.toThrow('DDT non trovato');
    });

    it('should throw error when DDT is already invoiced', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: true,
      } as any);

      await expect(ddtService.update('ddt-1', { carrier: 'UPS' })).rejects.toThrow(
        'Impossibile modificare un DDT già fatturato'
      );
    });

    it('should log update', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        isInvoiced: false,
      } as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      await ddtService.update('ddt-1', { carrier: 'UPS' });

      expect(mockLogger.info).toHaveBeenCalledWith('DDT aggiornato: DDT-2024/00001');
    });
  });

  // ==================== delete ====================
  describe('delete', () => {
    it('should delete DDT successfully', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        isInvoiced: false,
      } as any);
      prismaMock.dDT.delete.mockResolvedValue({} as any);

      const result = await ddtService.delete('ddt-1');

      expect(result).toEqual({ success: true });
      expect(prismaMock.dDT.delete).toHaveBeenCalledWith({ where: { id: 'ddt-1' } });
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(ddtService.delete('non-existent')).rejects.toThrow(
        'DDT non trovato'
      );
    });

    it('should throw error when DDT is invoiced', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: true,
      } as any);

      await expect(ddtService.delete('ddt-1')).rejects.toThrow(
        'Impossibile eliminare un DDT già fatturato'
      );
    });
  });

  // ==================== markAsInvoiced ====================
  describe('markAsInvoiced', () => {
    it('should mark multiple DDTs as invoiced', async () => {
      prismaMock.dDT.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await ddtService.markAsInvoiced(
        ['ddt-1', 'ddt-2', 'ddt-3'],
        'inv-1'
      );

      expect(result).toEqual({ success: true });
      expect(prismaMock.dDT.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ddt-1', 'ddt-2', 'ddt-3'] } },
        data: { isInvoiced: true, invoiceId: 'inv-1' },
      });
    });

    it('should log marked DDTs', async () => {
      prismaMock.dDT.updateMany.mockResolvedValue({ count: 2 } as any);

      await ddtService.markAsInvoiced(['ddt-1', 'ddt-2'], 'inv-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'DDT marcati come fatturati: ddt-1, ddt-2'
      );
    });
  });

  // ==================== getUninvoicedByCustomer ====================
  describe('getUninvoicedByCustomer', () => {
    it('should return uninvoiced DDTs for customer', async () => {
      const mockDdts = [
        { id: 'ddt-1', isInvoiced: false },
        { id: 'ddt-2', isInvoiced: false },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.getUninvoicedByCustomer('cust-1');

      expect(result).toHaveLength(2);
      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isInvoiced: false },
        include: expect.any(Object),
        orderBy: { issueDate: 'asc' },
      });
    });

    it('should return empty array when no uninvoiced DDTs', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);

      const result = await ddtService.getUninvoicedByCustomer('cust-1');

      expect(result).toHaveLength(0);
    });
  });

  // ==================== calculateTotal ====================
  describe('calculateTotal', () => {
    it('should calculate total from items', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        items: [
          { quantity: 5, unitPrice: createDecimal(10) },
          { quantity: 3, unitPrice: createDecimal(20) },
        ],
      } as any);

      const result = await ddtService.calculateTotal('ddt-1');

      expect(result).toBe(110); // 5*10 + 3*20
    });

    it('should handle null unitPrice', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        items: [
          { quantity: 5, unitPrice: createDecimal(10) },
          { quantity: 3, unitPrice: null },
        ],
      } as any);

      const result = await ddtService.calculateTotal('ddt-1');

      expect(result).toBe(50); // 5*10 + 0
    });

    it('should return 0 when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      const result = await ddtService.calculateTotal('non-existent');

      expect(result).toBe(0);
    });
  });

  // ==================== addItem ====================
  describe('addItem', () => {
    it('should add item with incremented line number', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        isInvoiced: false,
        items: [{ lineNumber: 1 }, { lineNumber: 2 }],
      } as any);
      prismaMock.dDTItem.create.mockResolvedValue({
        id: 'item-3',
        lineNumber: 3,
      } as any);

      const result = await ddtService.addItem('ddt-1', {
        sku: 'SKU003',
        description: 'New Product',
        quantity: 5,
      });

      expect(prismaMock.dDTItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ddtId: 'ddt-1',
          lineNumber: 3,
          sku: 'SKU003',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error when DDT is invoiced', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: true,
        items: [],
      } as any);

      await expect(
        ddtService.addItem('ddt-1', {
          sku: 'SKU001',
          description: 'Product',
          quantity: 5,
        })
      ).rejects.toThrow('Impossibile modificare un DDT già fatturato');
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(
        ddtService.addItem('non-existent', {
          sku: 'SKU001',
          description: 'Product',
          quantity: 5,
        })
      ).rejects.toThrow('DDT non trovato');
    });
  });

  // ==================== removeItem ====================
  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        isInvoiced: false,
      } as any);
      prismaMock.dDTItem.delete.mockResolvedValue({} as any);

      const result = await ddtService.removeItem('ddt-1', 'item-1');

      expect(result).toEqual({ success: true });
      expect(prismaMock.dDTItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw error when DDT is invoiced', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: true,
      } as any);

      await expect(
        ddtService.removeItem('ddt-1', 'item-1')
      ).rejects.toThrow('Impossibile modificare un DDT già fatturato');
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(
        ddtService.removeItem('non-existent', 'item-1')
      ).rejects.toThrow('DDT non trovato');
    });
  });

  // ==================== updateItem ====================
  describe('updateItem', () => {
    it('should update item successfully', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: false,
      } as any);
      prismaMock.dDTItem.update.mockResolvedValue({
        id: 'item-1',
        quantity: 10,
      } as any);

      const result = await ddtService.updateItem('ddt-1', 'item-1', {
        quantity: 10,
      });

      expect(prismaMock.dDTItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 10 },
        include: expect.any(Object),
      });
    });

    it('should throw error when DDT is invoiced', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        isInvoiced: true,
      } as any);

      await expect(
        ddtService.updateItem('ddt-1', 'item-1', { quantity: 10 })
      ).rejects.toThrow('Impossibile modificare un DDT già fatturato');
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(
        ddtService.updateItem('non-existent', 'item-1', { quantity: 10 })
      ).rejects.toThrow('DDT non trovato');
    });
  });

  // ==================== generatePdf ====================
  describe('generatePdf', () => {
    it('should generate PDF buffer', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        transportDate: new Date('2024-01-16'),
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        order: { orderNumber: 'ORD-001' },
        items: [
          { lineNumber: 1, sku: 'SKU001', description: 'Product 1', quantity: 5, unit: 'pz' },
        ],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.path).toContain('DDT_DDT-2024-00001.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(prismaMock.dDT.update).toHaveBeenCalledWith({
        where: { id: 'ddt-1' },
        data: { pdfFilePath: expect.any(String) },
      });
    });

    it('should throw error when DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(ddtService.generatePdf('non-existent')).rejects.toThrow(
        'DDT non trovato'
      );
    });

    it('should log PDF generation', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customer: { businessName: 'Test' },
        items: [],
      } as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      await ddtService.generatePdf('ddt-1');

      expect(mockLogger.info).toHaveBeenCalledWith('PDF DDT generato: DDT-2024/00001');
    });
  });

  // ==================== generatePeriodReport ====================
  describe('generatePeriodReport', () => {
    it('should aggregate DDTs by customer and carrier', async () => {
      const mockDdts = [
        {
          customerId: 'cust-1',
          customer: { id: 'cust-1', businessName: 'Customer 1' },
          carrier: 'DHL',
          isInvoiced: true,
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
        {
          customerId: 'cust-1',
          customer: { id: 'cust-1', businessName: 'Customer 1' },
          carrier: 'UPS',
          isInvoiced: false,
          items: [{ id: 'item-3' }],
        },
        {
          customerId: 'cust-2',
          customer: { id: 'cust-2', businessName: 'Customer 2' },
          carrier: 'DHL',
          isInvoiced: true,
          items: [{ id: 'item-4' }],
        },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.totalDdts).toBe(3);
      expect(result.totalItems).toBe(4);
      expect(result.invoiced).toBe(2);
      expect(result.notInvoiced).toBe(1);
      expect(result.byCustomer).toHaveLength(2);
      expect(result.byCarrier).toHaveLength(2);
    });

    it('should return empty report when no DDTs', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.totalDdts).toBe(0);
      expect(result.totalItems).toBe(0);
      expect(result.byCustomer).toHaveLength(0);
      expect(result.byCarrier).toHaveLength(0);
    });

    it('should sort by count descending', async () => {
      const mockDdts = [
        { customerId: 'cust-1', customer: { businessName: 'C1' }, carrier: 'DHL', isInvoiced: false, items: [] },
        { customerId: 'cust-2', customer: { businessName: 'C2' }, carrier: 'DHL', isInvoiced: false, items: [] },
        { customerId: 'cust-2', customer: { businessName: 'C2' }, carrier: 'DHL', isInvoiced: false, items: [] },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.byCustomer[0].customerName).toBe('C2');
      expect(result.byCustomer[0].count).toBe(2);
    });
  });

  // ==================== clone ====================
  describe('clone', () => {
    it('should clone DDT successfully', async () => {
      const original = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customerId: 'cust-1',
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        carrier: 'DHL',
        items: [
          { sku: 'SKU001', description: 'Product 1', quantity: 5, unit: 'pz' },
        ],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(original as any);
      prismaMock.dDT.create.mockResolvedValue({
        id: 'ddt-2',
        ddtNumber: 'DDT-2024/00002',
      } as any);

      const result = await ddtService.clone('ddt-1');

      expect(prismaMock.dDT.create).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('DDT clonato')
      );
    });

    it('should clone with new customer', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue({
        id: 'ddt-1',
        customerId: 'cust-1',
        shippingAddress: { street: '123', city: 'City', zip: '12345' },
        items: [],
      } as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-2' } as any);

      await ddtService.clone('ddt-1', { newCustomerId: 'cust-2' });

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.customerId).toBe('cust-2');
    });

    it('should throw error when original DDT not found', async () => {
      prismaMock.dDT.findUnique.mockResolvedValue(null);

      await expect(ddtService.clone('non-existent')).rejects.toThrow(
        'DDT originale non trovato'
      );
    });
  });

  // ==================== list - additional coverage ====================
  describe('list - additional filters', () => {
    it('should filter by orderId', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ orderId: 'order-123' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: 'order-123',
          }),
        })
      );
    });

    it('should filter by dateFrom only', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ dateFrom: '2024-01-01' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: {
              gte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('should filter by dateTo only', async () => {
      prismaMock.dDT.findMany.mockResolvedValue([]);
      prismaMock.dDT.count.mockResolvedValue(0);

      await ddtService.list({ dateTo: '2024-01-31' });

      expect(prismaMock.dDT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: {
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  // ==================== generatePdf - additional coverage ====================
  describe('generatePdf - additional scenarios', () => {
    it('should handle DDT without company settings', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        transportDate: new Date('2024-01-16'),
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [
          { lineNumber: 1, sku: 'SKU001', description: 'Product 1', quantity: 5, unit: 'pz' },
        ],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);
      // Return null for company settings to test the fallback
      mockCompanySettingsService.get.mockResolvedValueOnce(null);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
      // PDF should still be generated
      expect(result.path).toContain('DDT_DDT-2024-00001.pdf');
    });

    it('should render non-IT country in shipping address', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        transportDate: new Date('2024-01-16'),
        customer: { businessName: 'Foreign Customer' },
        shippingAddress: {
          street: '456 Foreign St',
          city: 'Paris',
          zip: '75001',
          province: null,
          country: 'FR', // Non-IT country
        },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should render DDT with all transport details', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        transportDate: new Date('2024-01-16'),
        carrier: 'DHL Express',
        numberOfPackages: 5,
        totalWeight: createDecimal(25.5),
        shipmentAppearance: 'Scatole di cartone',
        transportReason: 'VENDITA',
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should render items with lot and serial numbers', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [
          {
            lineNumber: 1,
            sku: 'SKU001',
            description: 'Product 1',
            quantity: 5,
            unit: 'pz',
            lotNumber: 'LOT-2024-001',
            serialNumber: 'SN-123456',
          },
          {
            lineNumber: 2,
            sku: 'SKU002',
            description: 'Product 2',
            quantity: 3,
            unit: 'pz',
            lotNumber: 'LOT-2024-002',
            serialNumber: null,
          },
        ],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should render DDT with notes and carrier notes', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        notes: 'Important delivery notes for the customer',
        carrierNotes: 'Handle with care - fragile contents',
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle DDT with many items requiring page break', async () => {
      // Create 50 items to trigger page break
      const items = Array.from({ length: 50 }, (_, i) => ({
        lineNumber: i + 1,
        sku: `SKU${String(i).padStart(3, '0')}`,
        description: `Product ${i} - This is a longer description`,
        quantity: (i + 1) * 2,
        unit: 'pz',
        lotNumber: i % 3 === 0 ? `LOT-${i}` : null,
        serialNumber: i % 5 === 0 ? `SN-${i}` : null,
      }));

      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        customer: { businessName: 'Large Order Customer' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: items,
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.path).toContain('DDT_DDT-2024-00001.pdf');
    });

    it('should render DDT without order reference', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        order: null, // No associated order
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should render customer with firstName and lastName', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        customer: {
          businessName: null,
          firstName: 'Mario',
          lastName: 'Rossi',
        },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle company settings with optional fields', async () => {
      const mockDdt = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        issueDate: new Date('2024-01-15'),
        customer: { businessName: 'Test Co' },
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(mockDdt as any);
      prismaMock.dDT.update.mockResolvedValue({} as any);
      mockCompanySettingsService.get.mockResolvedValueOnce({
        companyName: 'Test Company',
        address: '123 Test St',
        postalCode: '12345',
        city: 'Test City',
        province: 'TC',
        vatNumber: 'IT12345678901',
        fiscalCode: null, // Optional
        phone: null, // Optional
        email: null, // Optional
      });

      const result = await ddtService.generatePdf('ddt-1');

      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  // ==================== generatePeriodReport - additional coverage ====================
  describe('generatePeriodReport - additional scenarios', () => {
    it('should handle DDT without customer (edge case)', async () => {
      const mockDdts = [
        {
          customerId: 'cust-1',
          customer: null, // Customer deleted
          carrier: 'DHL',
          isInvoiced: false,
          items: [{ id: 'item-1' }],
        },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.totalDdts).toBe(1);
      // Customer without data should not be counted in byCustomer
      expect(result.byCustomer).toHaveLength(0);
    });

    it('should handle DDT with null carrier', async () => {
      const mockDdts = [
        {
          customerId: 'cust-1',
          customer: { businessName: 'Test' },
          carrier: null, // No carrier
          isInvoiced: true,
          items: [],
        },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.byCarrier).toContainEqual({
        carrier: null,
        count: 1,
      });
    });

    it('should handle customer with firstName/lastName but no businessName', async () => {
      const mockDdts = [
        {
          customerId: 'cust-1',
          customer: {
            id: 'cust-1',
            businessName: null,
            firstName: 'John',
            lastName: 'Doe',
          },
          carrier: 'DHL',
          isInvoiced: true,
          items: [{ id: 'item-1' }],
        },
      ];

      prismaMock.dDT.findMany.mockResolvedValue(mockDdts as any);

      const result = await ddtService.generatePeriodReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.byCustomer[0].customerName).toBe('John Doe');
    });
  });

  // ==================== createFromOrder - additional coverage ====================
  describe('createFromOrder - shipping address formats', () => {
    it('should handle order with street field instead of address_1', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        carrier: null,
        shippingAddress: {
          street: '456 Main Road', // Uses street instead of address_1
          city: 'Milan',
          province: 'MI',
          zip: '20100',
          country: 'IT',
        },
        items: [],
        customer: { businessName: 'Test Co' },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1', ddtNumber: 'DDT-2024/00001' } as any);

      const result = await ddtService.createFromOrder('order-1');

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.shippingAddress.street).toBe('456 Main Road');
    });

    it('should handle order with state field instead of province', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        carrier: null,
        shippingAddress: {
          address_1: '123 Test St',
          city: 'Milan',
          state: 'MI', // Uses state instead of province
          postcode: '20100',
          country: 'IT',
        },
        items: [],
        customer: { businessName: 'Test Co' },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1', ddtNumber: 'DDT-2024/00001' } as any);

      await ddtService.createFromOrder('order-1');

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.shippingAddress.province).toBe('MI');
    });

    it('should handle order item without product unit', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        shippingAddress: {
          street: '123 Test',
          city: 'City',
          zip: '12345',
        },
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU001',
            productName: 'Product 1',
            quantity: 5,
            unitPrice: createDecimal(10),
            product: null, // No product reference
          },
        ],
        customer: { businessName: 'Test Co' },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-1', ddtNumber: 'DDT-2024/00001' } as any);

      await ddtService.createFromOrder('order-1');

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      // Should default to 'pz' when product.unit is not available
      expect(createCall.data.items.create[0].unit).toBe('pz');
    });
  });

  // ==================== clone - additional coverage ====================
  describe('clone - additional scenarios', () => {
    it('should clone DDT with all optional fields', async () => {
      const original = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customerId: 'cust-1',
        shippingAddress: { street: '123 Test', city: 'City', province: 'MI', zip: '12345', country: 'IT' },
        carrier: 'DHL',
        carrierNotes: 'Handle with care',
        numberOfPackages: 3,
        totalWeight: createDecimal(15.5),
        transportReason: 'CONTO LAVORAZIONE',
        shipmentAppearance: 'Pallet',
        notes: 'Important notes',
        items: [
          {
            productId: 'prod-1',
            variantId: 'var-1',
            sku: 'SKU001',
            description: 'Product 1',
            quantity: 5,
            unit: 'kg',
            lotNumber: 'LOT-001',
            serialNumber: 'SN-001',
            unitPrice: createDecimal(10.5),
          },
        ],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(original as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-2', ddtNumber: 'DDT-2024/00002' } as any);

      await ddtService.clone('ddt-1');

      const createCall = prismaMock.dDT.create.mock.calls[0][0];
      expect(createCall.data.carrier).toBe('DHL');
      expect(createCall.data.carrierNotes).toBe('Handle with care');
      expect(createCall.data.numberOfPackages).toBe(3);
      expect(createCall.data.totalWeight).toBe(15.5);
      expect(createCall.data.transportReason).toBe('CONTO LAVORAZIONE');
      expect(createCall.data.shipmentAppearance).toBe('Pallet');
      expect(createCall.data.notes).toBe('Important notes');
    });

    it('should clone DDT with empty/null optional fields', async () => {
      const original = {
        id: 'ddt-1',
        ddtNumber: 'DDT-2024/00001',
        customerId: 'cust-1',
        shippingAddress: { street: '123 Test', city: 'City', zip: '12345' },
        carrier: null,
        carrierNotes: null,
        numberOfPackages: null,
        totalWeight: null,
        transportReason: null,
        shipmentAppearance: null,
        notes: null,
        items: [],
      };

      prismaMock.dDT.findUnique.mockResolvedValue(original as any);
      prismaMock.dDT.create.mockResolvedValue({ id: 'ddt-2', ddtNumber: 'DDT-2024/00002' } as any);

      await ddtService.clone('ddt-1');

      expect(prismaMock.dDT.create).toHaveBeenCalled();
    });
  });
});
