/**
 * Three-Way Match Service Tests
 * Comprehensive tests for PO-GR-Invoice matching and reconciliation
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';

// Mock dependencies before importing the service
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import threeWayMatchService from '@server/services/three-way-match.service';

describe('ThreeWayMatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  const createMockSupplierInvoice = (overrides: any = {}) => ({
    id: 'sinv-1',
    invoiceNumber: 'SINV-2026-001',
    supplierId: 'sup-1',
    issueDate: new Date(),
    dueDate: createMockDate(30),
    subtotal: createDecimal(5000),
    tax: createDecimal(1100),
    total: createDecimal(6100),
    paidAmount: createDecimal(0),
    status: 'PENDING',
    matchStatus: 'PENDING',
    notes: null,
    autoMatched: false,
    matchedAt: null,
    matchedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: mockFactories.supplier({ id: 'sup-1' }),
    items: [],
    threeWayMatches: [],
    ...overrides,
  });

  const createMockSupplierInvoiceItem = (overrides: any = {}) => ({
    id: 'sii-1',
    supplierInvoiceId: 'sinv-1',
    purchaseOrderItemId: 'poi-1',
    productId: null,
    materialId: 'mat-1',
    description: 'Test Material',
    quantity: 100,
    unitPrice: createDecimal(50),
    tax: createDecimal(22),
    total: createDecimal(6100),
    matchStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseOrderItem: {
      id: 'poi-1',
      purchaseOrderId: 'po-1',
      purchaseOrder: mockFactories.purchaseOrder({ id: 'po-1' }),
      goodsReceiptItems: [],
    },
    ...overrides,
  });

  const createMockThreeWayMatch = (overrides: any = {}) => ({
    id: 'twm-1',
    supplierInvoiceId: 'sinv-1',
    purchaseOrderId: 'po-1',
    goodsReceiptId: 'gr-1',
    status: 'PENDING',
    matchDate: new Date(),
    matchedBy: 'user-1',
    poTotal: createDecimal(6100),
    poQuantity: 100,
    grTotal: createDecimal(6100),
    grQuantity: 100,
    invoiceTotal: createDecimal(6100),
    invoiceQuantity: 100,
    priceVariance: createDecimal(0),
    priceVariancePct: createDecimal(0),
    qtyVariance: 0,
    qtyVariancePct: createDecimal(0),
    withinTolerance: true,
    toleranceUsed: createDecimal(2),
    resolutionStatus: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==========================================
  // CREATE SUPPLIER INVOICE TESTS
  // ==========================================

  describe('createSupplierInvoice', () => {
    it('should create supplier invoice without auto-matching', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      const invoice = createMockSupplierInvoice();

      prismaMock.supplier.findUnique.mockResolvedValue(supplier as any);
      prismaMock.supplierInvoice.create.mockResolvedValue(invoice as any);

      const result = await threeWayMatchService.createSupplierInvoice({
        invoiceNumber: 'SINV-2026-001',
        supplierId: 'sup-1',
        issueDate: new Date(),
        dueDate: createMockDate(30),
        subtotal: 5000,
        tax: 1100,
        total: 6100,
        items: [
          { materialId: 'mat-1', description: 'Test Material', quantity: 100, unitPrice: 50, total: 5000 },
        ],
      }, 'user-1');

      expect(result).toBeDefined();
      expect(prismaMock.supplierInvoice.create).toHaveBeenCalled();
    });

    it('should create invoice and trigger auto-matching when items have PO links', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      const invoice = createMockSupplierInvoice({
        items: [createMockSupplierInvoiceItem()],
      });
      const purchaseOrder = mockFactories.purchaseOrder({
        id: 'po-1',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [],
      });

      prismaMock.supplier.findUnique.mockResolvedValue(supplier as any);
      prismaMock.supplierInvoice.create.mockResolvedValue(invoice as any);
      prismaMock.supplierInvoice.findUnique.mockResolvedValue(invoice as any);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch() as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);
      prismaMock.supplierInvoice.update.mockResolvedValue(invoice as any);

      const result = await threeWayMatchService.createSupplierInvoice({
        invoiceNumber: 'SINV-2026-001',
        supplierId: 'sup-1',
        issueDate: new Date(),
        dueDate: createMockDate(30),
        subtotal: 5000,
        tax: 1100,
        total: 6100,
        items: [
          { purchaseOrderItemId: 'poi-1', materialId: 'mat-1', quantity: 100, unitPrice: 50, total: 5000 },
        ],
      }, 'user-1');

      expect(result).toBeDefined();
    });

    it('should throw error if supplier not found', async () => {
      prismaMock.supplier.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.createSupplierInvoice({
          invoiceNumber: 'SINV-001',
          supplierId: 'invalid-sup',
          issueDate: new Date(),
          dueDate: createMockDate(30),
          subtotal: 1000,
          tax: 220,
          total: 1220,
          items: [],
        }, 'user-1')
      ).rejects.toThrow('Fornitore non trovato');
    });
  });

  // ==========================================
  // PERFORM AUTO MATCH TESTS
  // ==========================================

  describe('performAutoMatch', () => {
    it('should perform auto-matching and return MATCHED status', async () => {
      const invoice = createMockSupplierInvoice({
        items: [
          createMockSupplierInvoiceItem({
            quantity: 100,
            total: createDecimal(5000),
          }),
        ],
      });
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [{
          id: 'gr-1',
          status: 'COMPLETED',
          items: [{ purchaseOrderItemId: 'poi-1', acceptedQuantity: 100 }],
        }],
      };

      prismaMock.supplierInvoice.findUnique.mockResolvedValue(invoice as any);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch({ status: 'MATCHED' }) as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);
      prismaMock.supplierInvoice.update.mockResolvedValue(invoice as any);

      const result = await threeWayMatchService.performAutoMatch('sinv-1', 'user-1');

      expect(result.overallStatus).toBe('MATCHED');
    });

    it('should throw error if invoice not found', async () => {
      prismaMock.supplierInvoice.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.performAutoMatch('invalid-id', 'user-1')
      ).rejects.toThrow('Fattura non trovata');
    });
  });

  // ==========================================
  // MATCH INVOICE TO PO TESTS
  // ==========================================

  describe('matchInvoiceToPo', () => {
    it('should return MATCHED when totals match exactly', async () => {
      const invoice = createMockSupplierInvoice();
      const invoiceItems = [
        createMockSupplierInvoiceItem({ quantity: 100, total: createDecimal(5000) }),
      ];
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [],
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch({ status: 'MATCHED' }) as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoice, 'po-1', invoiceItems, 'user-1'
      );

      expect(result.status).toBe('MATCHED');
      expect(result.priceVariance).toBe(0);
      expect(result.qtyVariance).toBe(0);
    });

    it('should return APPROVED when within tolerance', async () => {
      const invoice = createMockSupplierInvoice();
      const invoiceItems = [
        createMockSupplierInvoiceItem({ quantity: 100, total: createDecimal(5050) }), // 1% over
      ];
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [],
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch({ status: 'APPROVED', withinTolerance: true }) as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoice, 'po-1', invoiceItems, 'user-1'
      );

      expect(result.status).toBe('APPROVED');
      expect(result.withinTolerance).toBe(true);
    });

    it('should return DISCREPANCY when outside tolerance', async () => {
      const invoice = createMockSupplierInvoice();
      const invoiceItems = [
        createMockSupplierInvoiceItem({ quantity: 100, total: createDecimal(5500) }), // 10% over
      ];
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [],
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch({ status: 'DISCREPANCY', withinTolerance: false }) as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoice, 'po-1', invoiceItems, 'user-1'
      );

      expect(result.status).toBe('DISCREPANCY');
      expect(result.withinTolerance).toBe(false);
    });

    it('should use goods receipt totals when available', async () => {
      const invoice = createMockSupplierInvoice();
      const invoiceItems = [
        createMockSupplierInvoiceItem({ quantity: 90, total: createDecimal(4500) }),
      ];
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [{
          id: 'gr-1',
          status: 'COMPLETED',
          items: [{ purchaseOrderItemId: 'poi-1', acceptedQuantity: 90 }], // Only 90 received
        }],
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch({ status: 'MATCHED' }) as any);
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoice, 'po-1', invoiceItems, 'user-1'
      );

      expect(result.details.gr?.quantity).toBe(90);
    });

    it('should throw error if PO not found', async () => {
      const invoice = createMockSupplierInvoice();
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.matchInvoiceToPo(invoice, 'invalid-po', [], 'user-1')
      ).rejects.toThrow('Ordine di acquisto non trovato');
    });
  });

  // ==========================================
  // RESOLVE MATCH TESTS
  // ==========================================

  describe('resolveMatch', () => {
    it('should approve a discrepancy', async () => {
      const match = {
        ...createMockThreeWayMatch({ status: 'DISCREPANCY' }),
        supplierInvoice: createMockSupplierInvoice(),
      };
      const updatedMatch = { ...match, status: 'APPROVED', resolutionStatus: 'APPROVED' };

      prismaMock.threeWayMatch.findUnique.mockResolvedValue(match as any);
      prismaMock.threeWayMatch.update.mockResolvedValue(updatedMatch as any);
      prismaMock.threeWayMatch.findMany.mockResolvedValue([updatedMatch] as any);
      prismaMock.supplierInvoice.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.resolveMatch('twm-1', {
        resolutionStatus: 'APPROVED',
        resolutionNotes: 'Approved by manager',
        resolvedBy: 'user-1',
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should reject a discrepancy', async () => {
      const match = {
        ...createMockThreeWayMatch({ status: 'DISCREPANCY' }),
        supplierInvoice: createMockSupplierInvoice(),
      };
      const updatedMatch = { ...match, status: 'REJECTED', resolutionStatus: 'REJECTED' };

      prismaMock.threeWayMatch.findUnique.mockResolvedValue(match as any);
      prismaMock.threeWayMatch.update.mockResolvedValue(updatedMatch as any);
      prismaMock.supplierInvoice.update.mockResolvedValue({} as any);

      const result = await threeWayMatchService.resolveMatch('twm-1', {
        resolutionStatus: 'REJECTED',
        resolutionNotes: 'Invoice incorrect',
        resolvedBy: 'user-1',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('should throw error if match not found', async () => {
      prismaMock.threeWayMatch.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.resolveMatch('invalid-id', {
          resolutionStatus: 'APPROVED',
          resolvedBy: 'user-1',
        })
      ).rejects.toThrow('Match non trovato');
    });
  });

  // ==========================================
  // GET PENDING DISCREPANCIES TESTS
  // ==========================================

  describe('getPendingDiscrepancies', () => {
    it('should return invoices with pending discrepancies', async () => {
      const invoices = [
        {
          ...createMockSupplierInvoice({ matchStatus: 'DISCREPANCY' }),
          supplier: mockFactories.supplier({ id: 'sup-1', code: 'SUP001', businessName: 'Test Supplier' }),
          items: [],
          threeWayMatches: [createMockThreeWayMatch({ status: 'DISCREPANCY' })],
        },
      ];

      prismaMock.supplierInvoice.findMany.mockResolvedValue(invoices as any);

      const result = await threeWayMatchService.getPendingDiscrepancies();

      expect(result).toHaveLength(1);
      expect(result[0].matchStatus).toBe('DISCREPANCY');
    });

    it('should filter by supplier', async () => {
      prismaMock.supplierInvoice.findMany.mockResolvedValue([]);

      await threeWayMatchService.getPendingDiscrepancies('sup-1');

      expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierId: 'sup-1',
          }),
        })
      );
    });
  });

  // ==========================================
  // GET MATCH DETAILS TESTS
  // ==========================================

  describe('getMatchDetails', () => {
    it('should return detailed match information', async () => {
      const invoice = {
        ...createMockSupplierInvoice(),
        supplier: mockFactories.supplier({ id: 'sup-1', businessName: 'Test Supplier' }),
        items: [createMockSupplierInvoiceItem()],
        threeWayMatches: [{
          ...createMockThreeWayMatch(),
          purchaseOrder: { id: 'po-1', orderNumber: 'PO-001', total: createDecimal(5000) },
          goodsReceipt: { id: 'gr-1', receiptNumber: 'GR-001', receiptDate: new Date() },
        }],
      };

      prismaMock.supplierInvoice.findUnique.mockResolvedValue(invoice as any);

      const result = await threeWayMatchService.getMatchDetails('sinv-1');

      expect(result.invoice).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.matches).toHaveLength(1);
    });

    it('should throw error if invoice not found', async () => {
      prismaMock.supplierInvoice.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.getMatchDetails('invalid-id')
      ).rejects.toThrow('Fattura non trovata');
    });
  });

  // ==========================================
  // GET MATCH STATISTICS TESTS
  // ==========================================

  describe('getMatchStatistics', () => {
    it('should return comprehensive statistics', async () => {
      const matches = [
        { priceVariance: createDecimal(50), priceVariancePct: createDecimal(1), qtyVariance: 0, withinTolerance: true, resolutionStatus: null },
        { priceVariance: createDecimal(100), priceVariancePct: createDecimal(2), qtyVariance: 0, withinTolerance: true, resolutionStatus: 'APPROVED' },
      ];

      prismaMock.supplierInvoice.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(6)  // matched
        .mockResolvedValueOnce(2)  // discrepancy
        .mockResolvedValueOnce(2); // pending
      prismaMock.threeWayMatch.findMany.mockResolvedValue(matches as any);

      const result = await threeWayMatchService.getMatchStatistics();

      expect(result.invoices.total).toBe(10);
      expect(result.invoices.matched).toBe(6);
      expect(result.invoices.matchRate).toBe(60);
      expect(result.matches.total).toBe(2);
      expect(result.matches.autoApproved).toBe(2);
    });

    it('should filter by date range', async () => {
      prismaMock.supplierInvoice.count.mockResolvedValue(0);
      prismaMock.threeWayMatch.findMany.mockResolvedValue([]);

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await threeWayMatchService.getMatchStatistics(dateFrom, dateTo);

      expect(prismaMock.supplierInvoice.count).toHaveBeenCalledWith({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      });
    });
  });

  // ==========================================
  // LINK INVOICE TO PO TESTS
  // ==========================================

  describe('linkInvoiceToPo', () => {
    it('should manually link invoice items to PO items', async () => {
      const invoice = createMockSupplierInvoice({
        items: [createMockSupplierInvoiceItem({ id: 'sii-1' })],
      });
      const purchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-001',
        items: [{ id: 'poi-1', quantity: 100, unitPrice: createDecimal(50), total: createDecimal(5000) }],
        goodsReceipts: [],
      };

      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);
      prismaMock.supplierInvoice.findUnique.mockResolvedValue(invoice as any);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder as any);
      prismaMock.threeWayMatch.upsert.mockResolvedValue(createMockThreeWayMatch() as any);

      const result = await threeWayMatchService.linkInvoiceToPo(
        'sinv-1',
        'po-1',
        [{ invoiceItemId: 'sii-1', poItemId: 'poi-1' }],
        'user-1'
      );

      expect(prismaMock.supplierInvoiceItem.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error if invoice not found after linking', async () => {
      prismaMock.supplierInvoiceItem.update.mockResolvedValue({} as any);
      prismaMock.supplierInvoice.findUnique.mockResolvedValue(null);

      await expect(
        threeWayMatchService.linkInvoiceToPo(
          'invalid-id',
          'po-1',
          [{ invoiceItemId: 'sii-1', poItemId: 'poi-1' }],
          'user-1'
        )
      ).rejects.toThrow('Fattura non trovata');
    });
  });

  // ==========================================
  // GET AVAILABLE PO FOR INVOICE TESTS
  // ==========================================

  describe('getAvailablePoForInvoice', () => {
    it('should return available POs for matching', async () => {
      const purchaseOrders = [
        {
          id: 'po-1',
          orderNumber: 'PO-001',
          status: 'CONFIRMED',
          total: createDecimal(5000),
          createdAt: new Date(),
          items: [
            {
              id: 'poi-1',
              quantity: 100,
              receivedQuantity: 0,
              unitPrice: createDecimal(50),
              total: createDecimal(5000),
              product: null,
              material: { id: 'mat-1', sku: 'MAT001', name: 'Test Material' },
            },
          ],
          threeWayMatches: [],
          goodsReceipts: [{ id: 'gr-1', receiptNumber: 'GR-001', receiptDate: new Date() }],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(purchaseOrders as any);

      const result = await threeWayMatchService.getAvailablePoForInvoice('sup-1');

      expect(result).toHaveLength(1);
      expect(result[0].hasGoodsReceipt).toBe(true);
      expect(result[0].items).toHaveLength(1);
    });
  });

  // ==========================================
  // LIST SUPPLIER INVOICES TESTS
  // ==========================================

  describe('listSupplierInvoices', () => {
    it('should return paginated supplier invoices', async () => {
      const invoices = [
        {
          ...createMockSupplierInvoice({ id: 'sinv-1' }),
          supplier: mockFactories.supplier({ code: 'SUP001', businessName: 'Test Supplier' }),
          _count: { items: 5, threeWayMatches: 1 },
        },
      ];

      prismaMock.supplierInvoice.findMany.mockResolvedValue(invoices as any);
      prismaMock.supplierInvoice.count.mockResolvedValue(1);

      const result = await threeWayMatchService.listSupplierInvoices({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].itemCount).toBe(5);
      expect(result.items[0].matchCount).toBe(1);
    });

    it('should filter by supplier', async () => {
      prismaMock.supplierInvoice.findMany.mockResolvedValue([]);
      prismaMock.supplierInvoice.count.mockResolvedValue(0);

      await threeWayMatchService.listSupplierInvoices({
        supplierId: 'sup-1',
      });

      expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplierId: 'sup-1' },
        })
      );
    });

    it('should filter by match status', async () => {
      prismaMock.supplierInvoice.findMany.mockResolvedValue([]);
      prismaMock.supplierInvoice.count.mockResolvedValue(0);

      await threeWayMatchService.listSupplierInvoices({
        matchStatus: 'DISCREPANCY',
      });

      expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchStatus: 'DISCREPANCY' },
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.supplierInvoice.findMany.mockResolvedValue([]);
      prismaMock.supplierInvoice.count.mockResolvedValue(0);

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await threeWayMatchService.listSupplierInvoices({
        dateFrom,
        dateTo,
      });

      expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: { gte: dateFrom, lte: dateTo },
          }),
        })
      );
    });
  });
});
