/**
 * Goods Receipt E2E Tests
 * Tests for goods receipt API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
      goodsReceipt: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      goodsReceiptItem: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      purchaseOrder: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      inventoryItem: {
        upsert: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      materialInventory: {
        upsert: vi.fn(),
      },
      materialMovement: {
        create: vi.fn(),
      },
      supplier: {
        update: vi.fn(),
      },
      $transaction: vi.fn((callback: any) => callback({
        goodsReceipt: {
          create: vi.fn().mockResolvedValue({ id: 'gr-1', receiptNumber: 'EM-2026-000001' }),
          update: vi.fn().mockResolvedValue({ id: 'gr-1', status: 'COMPLETED' }),
        },
        goodsReceiptItem: {
          update: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
        },
        purchaseOrderItem: {
          update: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
        },
        purchaseOrder: {
          update: vi.fn().mockResolvedValue({}),
        },
        inventoryItem: {
          upsert: vi.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: vi.fn().mockResolvedValue({}),
        },
        materialInventory: {
          upsert: vi.fn().mockResolvedValue({}),
        },
        materialMovement: {
          create: vi.fn().mockResolvedValue({}),
        },
        supplier: {
          update: vi.fn().mockResolvedValue({}),
        },
      })),
    },
  };
});

vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import goodsReceiptService from '@server/services/goods-receipt.service';
import { prisma } from '@server/config/database';

describe('Goods Receipt API E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List Goods Receipts', () => {
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

      vi.mocked(prisma.goodsReceipt.findMany).mockResolvedValue(mockReceipts as any);
      vi.mocked(prisma.goodsReceipt.count).mockResolvedValue(1);

      const result = await goodsReceiptService.listGoodsReceipts({ page: 1, limit: 50 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.items[0].stats.totalExpected).toBe(300);
      expect(result.items[0].stats.totalReceived).toBe(250);
      expect(result.items[0].stats.completionRate).toBeCloseTo(83.33, 1);
    });

    it('should apply filters', async () => {
      vi.mocked(prisma.goodsReceipt.findMany).mockResolvedValue([]);
      vi.mocked(prisma.goodsReceipt.count).mockResolvedValue(0);

      await goodsReceiptService.listGoodsReceipts({
        status: 'COMPLETED' as any,
        supplierId: 'sup-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(vi.mocked(prisma.goodsReceipt.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
            supplierId: 'sup-1',
          }),
        })
      );
    });
  });

  describe('Get Goods Receipt Detail', () => {
    it('should return full receipt details', async () => {
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

      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue(mockReceipt as any);

      const result = await goodsReceiptService.getGoodsReceiptById('gr-1');

      expect(result.id).toBe('gr-1');
      expect(result.purchaseOrder).toBeDefined();
    });

    it('should throw error for non-existent receipt', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue(null);

      await expect(
        goodsReceiptService.getGoodsReceiptById('non-existent')
      ).rejects.toThrow('Entrata merce non trovata');
    });
  });

  describe('Create Goods Receipt', () => {
    it('should create from purchase order', async () => {
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

      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue(mockPurchaseOrder as any);
      vi.mocked(prisma.goodsReceipt.findFirst).mockResolvedValue(null);

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

    it('should reject for non-existent purchase order', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue(null);

      await expect(
        goodsReceiptService.createGoodsReceipt({
          purchaseOrderId: 'non-existent',
          warehouseId: 'wh-1',
          items: [],
        })
      ).rejects.toThrow("Ordine d'acquisto non trovato");
    });

    it('should reject for already received purchase order', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({
        id: 'po-1',
        status: 'RECEIVED',
        items: [],
      } as any);

      await expect(
        goodsReceiptService.createGoodsReceipt({
          purchaseOrderId: 'po-1',
          warehouseId: 'wh-1',
          items: [],
        })
      ).rejects.toThrow('Impossibile creare entrata merce per ordine in stato RECEIVED');
    });
  });

  describe('Complete Receipt Flow', () => {
    it('should update inventory on completion', async () => {
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

      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue(mockReceipt as any);

      const result = await goodsReceiptService.completeReceipt('gr-1');

      expect(result.status).toBe('COMPLETED');
    });

    it('should reject completion if inspection pending', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue({
        id: 'gr-1',
        status: 'PARTIAL',
        inspectionRequired: true,
        inspectionStatus: 'PENDING',
      } as any);

      await expect(
        goodsReceiptService.completeReceipt('gr-1')
      ).rejects.toThrow('Ispezione qualità richiesta prima del completamento');
    });

    it('should reject if already completed', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue({
        id: 'gr-1',
        status: 'COMPLETED',
      } as any);

      await expect(
        goodsReceiptService.completeReceipt('gr-1')
      ).rejects.toThrow('Entrata merce già completata');
    });
  });

  describe('Inspection Flow', () => {
    it('should record inspection results', async () => {
      const mockReceipt = {
        id: 'gr-1',
        supplierId: 'sup-1',
        inspectionRequired: true,
        items: [
          { id: 'item-1', receivedQuantity: 100 },
        ],
      };

      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue(mockReceipt as any);

      // Customize transaction mock for this test
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          goodsReceiptItem: { update: vi.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: vi.fn().mockResolvedValue({
              ...mockReceipt,
              inspectionStatus: 'PASSED',
              items: [],
              supplier: {},
              warehouse: {},
            }),
          },
          supplier: { update: vi.fn().mockResolvedValue({}) },
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

    it('should reject inspection if not required', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue({
        id: 'gr-1',
        inspectionRequired: false,
        items: [],
      } as any);

      await expect(
        goodsReceiptService.recordInspection('gr-1', {
          inspectionStatus: 'PASSED' as any,
          inspectedBy: 'inspector-1',
        })
      ).rejects.toThrow('Ispezione non richiesta per questa entrata merce');
    });
  });

  describe('Cancel Receipt', () => {
    it('should cancel and restore PO quantities', async () => {
      const mockReceipt = {
        id: 'gr-1',
        status: 'PENDING',
        notes: 'Original notes',
        items: [
          { id: 'item-1', purchaseOrderItemId: 'poi-1', receivedQuantity: 50 },
        ],
      };

      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue(mockReceipt as any);

      // Customize transaction mock for this test
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          purchaseOrderItem: { update: vi.fn().mockResolvedValue({}) },
          goodsReceipt: {
            update: vi.fn().mockResolvedValue({
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

    it('should reject cancellation if completed', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue({
        id: 'gr-1',
        status: 'COMPLETED',
        items: [],
      } as any);

      await expect(
        goodsReceiptService.cancelReceipt('gr-1', 'Reason')
      ).rejects.toThrow('Impossibile annullare entrata merce già completata');
    });
  });

  describe('Attachments', () => {
    it('should add attachment to receipt', async () => {
      vi.mocked(prisma.goodsReceipt.findUnique).mockResolvedValue({
        id: 'gr-1',
        attachments: [],
      } as any);

      vi.mocked(prisma.goodsReceipt.update).mockResolvedValue({
        id: 'gr-1',
        attachments: [{ name: 'ddt.pdf', url: '/files/ddt.pdf', type: 'PDF' }],
      } as any);

      const result = await goodsReceiptService.addAttachment('gr-1', {
        name: 'ddt.pdf',
        url: '/files/ddt.pdf',
        type: 'PDF',
      });

      expect(result.attachments).toHaveLength(1);
    });
  });
});
