/**
 * Goods Receipt Service Tests
 * Tests for goods receipt management (receiving goods from purchase orders)
 */

import { prismaMock, mockFactories, createDecimal } from '../__mocks__/prisma';

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

// Import after mocks
import goodsReceiptService from '@server/services/goods-receipt.service';

describe('GoodsReceiptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listGoodsReceipts', () => {
    it('should return paginated list with statistics', async () => {
      const mockReceipts = [
        {
          id: 'gr-1',
          receiptNumber: 'EM-2026-000001',
          status: 'PENDING',
          purchaseOrder: { id: 'po-1', orderNumber: 'PO-001', status: 'CONFIRMED' },
          supplier: { id: 'sup-1', code: 'SUP001', businessName: 'Supplier A' },
          warehouse: { id: 'wh-1', code: 'MAIN', name: 'Main Warehouse' },
          items: [
            { expectedQuantity: 100, receivedQuantity: 50, acceptedQuantity: 48, rejectedQuantity: 2 },
            { expectedQuantity: 200, receivedQuantity: 200, acceptedQuantity: 195, rejectedQuantity: 5 },
          ],
        },
      ];

      prismaMock.goodsReceipt.findMany.mockResolvedValue(mockReceipts as any);
      prismaMock.goodsReceipt.count.mockResolvedValue(1);

      const result = await goodsReceiptService.listGoodsReceipts({ page: 1, limit: 50 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.items[0].stats.totalExpected).toBe(300);
      expect(result.items[0].stats.totalReceived).toBe(250);
      expect(result.items[0].stats.completionRate).toBeCloseTo(83.33, 1);
    });

    it('should filter by status', async () => {
      prismaMock.goodsReceipt.findMany.mockResolvedValue([]);
      prismaMock.goodsReceipt.count.mockResolvedValue(0);

      await goodsReceiptService.listGoodsReceipts({ status: 'COMPLETED' as any });

      expect(prismaMock.goodsReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.goodsReceipt.findMany.mockResolvedValue([]);
      prismaMock.goodsReceipt.count.mockResolvedValue(0);

      await goodsReceiptService.listGoodsReceipts({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prismaMock.goodsReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            receiptDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('getGoodsReceiptById', () => {
    it('should return goods receipt with full details', async () => {
      const mockReceipt = {
        id: 'gr-1',
        receiptNumber: 'EM-2026-000001',
        purchaseOrder: {
          id: 'po-1',
          supplier: { id: 'sup-1', businessName: 'Supplier A' },
          items: [],
        },
        supplier: { id: 'sup-1', businessName: 'Supplier A' },
        warehouse: { id: 'wh-1', name: 'Main Warehouse' },
        items: [],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      const result = await goodsReceiptService.getGoodsReceiptById('gr-1');

      expect(result.id).toBe('gr-1');
      expect(result.purchaseOrder).toBeDefined();
    });

    it('should throw error for non-existent receipt', async () => {
      prismaMock.goodsReceipt.findUnique.mockResolvedValue(null);

      await expect(
        goodsReceiptService.getGoodsReceiptById('non-existent')
      ).rejects.toThrow('Entrata merce non trovata');
    });
  });

  describe('createGoodsReceipt', () => {
    it('should create goods receipt from purchase order', async () => {
      const mockPurchaseOrder = {
        id: 'po-1',
        supplierId: 'sup-1',
        status: 'CONFIRMED',
        items: [
          {
            id: 'poi-1',
            productId: 'prod-1',
            materialId: null,
            quantity: 100,
            receivedQuantity: 0,
            product: { id: 'prod-1', sku: 'SKU001' },
          },
        ],
      };

      const mockGoodsReceipt = {
        id: 'gr-1',
        receiptNumber: 'EM-2026-000001',
        purchaseOrderId: 'po-1',
        supplierId: 'sup-1',
        warehouseId: 'wh-1',
        items: [],
        supplier: {},
        warehouse: {},
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(mockPurchaseOrder as any);
      prismaMock.goodsReceipt.findFirst.mockResolvedValue(null); // For number generation
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          goodsReceipt: {
            create: jest.fn().mockResolvedValue(mockGoodsReceipt),
          },
          purchaseOrderItem: {
            update: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([
              { quantity: 100, receivedQuantity: 50 },
            ]),
          },
          purchaseOrder: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await goodsReceiptService.createGoodsReceipt({
        purchaseOrderId: 'po-1',
        warehouseId: 'wh-1',
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            receivedQuantity: 50,
            acceptedQuantity: 48,
            rejectedQuantity: 2,
          },
        ],
      });

      expect(result.id).toBe('gr-1');
    });

    it('should throw error for non-existent purchase order', async () => {
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        goodsReceiptService.createGoodsReceipt({
          purchaseOrderId: 'non-existent',
          warehouseId: 'wh-1',
          items: [],
        })
      ).rejects.toThrow("Ordine d'acquisto non trovato");
    });

    it('should throw error for received or cancelled purchase order', async () => {
      const mockPurchaseOrder = {
        id: 'po-1',
        status: 'RECEIVED',
        items: [],
      };

      prismaMock.purchaseOrder.findUnique.mockResolvedValue(mockPurchaseOrder as any);

      await expect(
        goodsReceiptService.createGoodsReceipt({
          purchaseOrderId: 'po-1',
          warehouseId: 'wh-1',
          items: [],
        })
      ).rejects.toThrow('Impossibile creare entrata merce per ordine in stato RECEIVED');
    });
  });

  describe('updateGoodsReceipt', () => {
    it('should update pending goods receipt', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'PENDING',
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.goodsReceipt.update.mockResolvedValue({
        ...mockReceipt,
        carrier: 'DHL',
      } as any);

      const result = await goodsReceiptService.updateGoodsReceipt('gr-1', {
        carrier: 'DHL',
      });

      expect(result.carrier).toBe('DHL');
    });

    it('should throw error for completed receipt', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'COMPLETED',
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.updateGoodsReceipt('gr-1', { carrier: 'DHL' })
      ).rejects.toThrow('Impossibile modificare entrata merce in stato COMPLETED');
    });
  });

  describe('receiveItems', () => {
    it('should update items and calculate status', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'PENDING',
        inspectionRequired: false,
        inspectionStatus: 'NOT_REQUIRED',
        items: [
          { id: 'item-1', expectedQuantity: 100 },
        ],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          goodsReceiptItem: {
            update: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([
              { expectedQuantity: 100, receivedQuantity: 100 },
            ]),
          },
          goodsReceipt: {
            update: jest.fn().mockResolvedValue({
              ...mockReceipt,
              status: 'COMPLETED',
              items: [],
              supplier: {},
              warehouse: {},
            }),
          },
        };
        return callback(tx);
      });

      const result = await goodsReceiptService.receiveItems('gr-1', {
        items: [
          {
            itemId: 'item-1',
            receivedQuantity: 100,
            acceptedQuantity: 98,
            rejectedQuantity: 2,
          },
        ],
      });

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error for completed receipt', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'COMPLETED',
        items: [],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.receiveItems('gr-1', { items: [] })
      ).rejects.toThrow('Impossibile modificare entrata merce completata o annullata');
    });
  });

  describe('completeReceipt', () => {
    it('should complete receipt and update inventory', async () => {
      const mockReceipt = {
        id: 'gr-1',
        receiptNumber: 'EM-2026-000001',
        status: 'PARTIAL',
        inspectionRequired: false,
        inspectionStatus: 'NOT_REQUIRED',
        supplierId: 'sup-1',
        warehouseId: 'wh-1',
        warehouse: { code: 'MAIN' },
        purchaseOrder: { expectedDate: new Date('2026-01-15') },
        items: [
          {
            productId: 'prod-1',
            materialId: null,
            acceptedQuantity: 50,
            product: { id: 'prod-1' },
          },
        ],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          inventoryItem: { upsert: jest.fn().mockResolvedValue({}) },
          inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
          materialInventory: { upsert: jest.fn().mockResolvedValue({}) },
          materialMovement: { create: jest.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: jest.fn().mockResolvedValue({
              ...mockReceipt,
              status: 'COMPLETED',
              purchaseOrder: {},
            }),
          },
          supplier: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const result = await goodsReceiptService.completeReceipt('gr-1');

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error if already completed', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'COMPLETED',
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.completeReceipt('gr-1')
      ).rejects.toThrow('Entrata merce già completata');
    });

    it('should throw error if inspection pending', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'PARTIAL',
        inspectionRequired: true,
        inspectionStatus: 'PENDING',
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.completeReceipt('gr-1')
      ).rejects.toThrow('Ispezione qualità richiesta prima del completamento');
    });
  });

  describe('recordInspection', () => {
    it('should record inspection and update items', async () => {
      const mockReceipt = {
        id: 'gr-1',
        supplierId: 'sup-1',
        inspectionRequired: true,
        items: [
          { id: 'item-1', receivedQuantity: 100 },
        ],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          goodsReceiptItem: { update: jest.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: jest.fn().mockResolvedValue({
              ...mockReceipt,
              inspectionStatus: 'PASSED',
              items: [],
              supplier: {},
              warehouse: {},
            }),
          },
          supplier: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const result = await goodsReceiptService.recordInspection('gr-1', {
        inspectionStatus: 'PASSED' as any,
        inspectedBy: 'inspector-1',
        itemResults: [
          {
            itemId: 'item-1',
            qualityStatus: 'ACCEPTED' as any,
            acceptedQuantity: 95,
            rejectedQuantity: 5,
          },
        ],
      });

      expect(result.inspectionStatus).toBe('PASSED');
    });

    it('should throw error if inspection not required', async () => {
      const mockReceipt = {
        id: 'gr-1',
        inspectionRequired: false,
        items: [],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.recordInspection('gr-1', {
          inspectionStatus: 'PASSED' as any,
          inspectedBy: 'inspector-1',
        })
      ).rejects.toThrow('Ispezione non richiesta per questa entrata merce');
    });

    it('should update supplier metrics on failed inspection', async () => {
      const mockReceipt = {
        id: 'gr-1',
        supplierId: 'sup-1',
        inspectionRequired: true,
        items: [],
      };

      let supplierUpdated = false;

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          goodsReceiptItem: { update: jest.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: jest.fn().mockResolvedValue({
              ...mockReceipt,
              inspectionStatus: 'FAILED',
              items: [],
              supplier: {},
              warehouse: {},
            }),
          },
          supplier: {
            update: jest.fn().mockImplementation(() => {
              supplierUpdated = true;
              return Promise.resolve({});
            }),
          },
        };
        return callback(tx);
      });

      await goodsReceiptService.recordInspection('gr-1', {
        inspectionStatus: 'FAILED' as any,
        inspectedBy: 'inspector-1',
      });

      expect(supplierUpdated).toBe(true);
    });
  });

  describe('addAttachment', () => {
    it('should add attachment to receipt', async () => {
      const mockReceipt = {
        id: 'gr-1',
        attachments: [],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.goodsReceipt.update.mockResolvedValue({
        ...mockReceipt,
        attachments: [{ name: 'ddt.pdf', url: '/files/ddt.pdf', type: 'PDF' }],
      } as any);

      const result = await goodsReceiptService.addAttachment('gr-1', {
        name: 'ddt.pdf',
        url: '/files/ddt.pdf',
        type: 'PDF',
      });

      expect(result.attachments).toHaveLength(1);
    });

    it('should append to existing attachments', async () => {
      const mockReceipt = {
        id: 'gr-1',
        attachments: [{ name: 'existing.pdf', url: '/files/existing.pdf', type: 'PDF' }],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.goodsReceipt.update.mockResolvedValue({
        ...mockReceipt,
        attachments: [
          { name: 'existing.pdf', url: '/files/existing.pdf', type: 'PDF' },
          { name: 'new.pdf', url: '/files/new.pdf', type: 'PDF' },
        ],
      } as any);

      await goodsReceiptService.addAttachment('gr-1', {
        name: 'new.pdf',
        url: '/files/new.pdf',
        type: 'PDF',
      });

      expect(prismaMock.goodsReceipt.update).toHaveBeenCalledWith({
        where: { id: 'gr-1' },
        data: {
          attachments: expect.arrayContaining([
            expect.objectContaining({ name: 'existing.pdf' }),
            expect.objectContaining({ name: 'new.pdf' }),
          ]),
        },
      });
    });
  });

  describe('cancelReceipt', () => {
    it('should cancel receipt and restore PO quantities', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'PENDING',
        notes: 'Original notes',
        items: [
          { id: 'item-1', purchaseOrderItemId: 'poi-1', receivedQuantity: 50 },
        ],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          purchaseOrderItem: { update: jest.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: jest.fn().mockResolvedValue({
              ...mockReceipt,
              status: 'CANCELLED',
            }),
          },
        };
        return callback(tx);
      });

      const result = await goodsReceiptService.cancelReceipt('gr-1', 'Wrong delivery');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error for completed receipt', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'COMPLETED',
        items: [],
      };

      prismaMock.goodsReceipt.findUnique.mockResolvedValue(mockReceipt as any);

      await expect(
        goodsReceiptService.cancelReceipt('gr-1', 'Reason')
      ).rejects.toThrow('Impossibile annullare entrata merce già completata');
    });

    it('should throw error for non-existent receipt', async () => {
      prismaMock.goodsReceipt.findUnique.mockResolvedValue(null);

      await expect(
        goodsReceiptService.cancelReceipt('non-existent', 'Reason')
      ).rejects.toThrow('Entrata merce non trovata');
    });
  });
});
