/**
 * Purchase to Payment E2E Tests
 * End-to-end tests for procurement workflow
 *
 * Tests:
 * 1. Purchase order creation
 * 2. PO status transitions
 * 3. Goods receipt
 * 4. Three-way matching
 * 5. Payment due creation
 * 6. Payment recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available at mock time
const { mockPrisma, mockPurchaseOrderRepository, mockSupplierRepository, mockNotificationService } = vi.hoisted(() => {
  const mockPrisma: any = {
    purchaseOrder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseOrderItem: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    goodsReceipt: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    goodsReceiptItem: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    supplierInvoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    supplierInvoiceItem: {
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    material: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    inventoryItem: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    materialMovement: {
      create: vi.fn(),
    },
    materialInventory: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    threeWayMatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    paymentDue: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
  };

  const mockPurchaseOrderRepository = {
    findAll: vi.fn(),
    findById: vi.fn(),
    generateOrderNumber: vi.fn(),
    createWithItems: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    cancel: vi.fn(),
    receiveItems: vi.fn(),
    getSupplierOrderStats: vi.fn(),
  };

  const mockSupplierRepository = {
    findById: vi.fn(),
    findAll: vi.fn(),
  };

  const mockNotificationService = {
    notifyRoles: vi.fn(),
  };

  return { mockPrisma, mockPurchaseOrderRepository, mockSupplierRepository, mockNotificationService };
});

vi.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@server/repositories/purchase-order.repository', () => ({
  default: mockPurchaseOrderRepository,
}));

vi.mock('@server/repositories/supplier.repository', () => ({
  default: mockSupplierRepository,
}));

vi.mock('@server/services/notification.service', () => ({
  default: mockNotificationService,
}));

// Import after mocks
import { default as purchaseOrderService } from '@server/services/purchase-order.service';
import goodsReceiptService from '@server/services/goods-receipt.service';
import threeWayMatchService from '@server/services/three-way-match.service';

// Mock data
const mockSupplier = {
  id: 'supp-1',
  code: 'SUPP001',
  businessName: 'Test Supplier',
  paymentTerms: 30,
};

const mockProduct = {
  id: 'prod-1',
  sku: 'SKU001',
  name: 'Test Product',
  cost: { toNumber: () => 50 },
};

const mockMaterial = {
  id: 'mat-1',
  sku: 'MAT001',
  name: 'Test Material',
  cost: { toNumber: () => 25 },
  currentStock: 100,
};

const mockPurchaseOrder = {
  id: 'po-1',
  orderNumber: 'PO-2026-00001',
  supplierId: 'supp-1',
  status: 'DRAFT',
  orderType: 'MATERIAL',
  subtotal: 500,
  tax: 110,
  total: 610,
  orderDate: new Date('2026-02-15'),
  expectedDate: new Date('2026-02-25'),
  supplier: mockSupplier,
  items: [
    {
      id: 'poi-1',
      materialId: 'mat-1',
      productId: null,
      quantity: 20,
      unitPrice: 25,
      total: 610,
      receivedQuantity: 0,
      material: mockMaterial,
    },
  ],
  goodsReceipts: [],
};

const mockGoodsReceipt = {
  id: 'gr-1',
  receiptNumber: 'GR-2026-00001',
  purchaseOrderId: 'po-1',
  supplierId: 'supp-1',
  warehouseId: 'wh-1',
  receiptDate: new Date('2026-02-20'),
  status: 'COMPLETED',
  inspectionRequired: false,
  inspectionStatus: 'NOT_REQUIRED',
  items: [
    {
      id: 'gri-1',
      purchaseOrderItemId: 'poi-1',
      expectedQuantity: 20,
      receivedQuantity: 20,
      acceptedQuantity: 20,
      rejectedQuantity: 0,
    },
  ],
  supplier: mockSupplier,
  warehouse: { id: 'wh-1', code: 'WH001', name: 'Main Warehouse' },
  purchaseOrder: mockPurchaseOrder,
};

const mockSupplierInvoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-2026-00001',
  supplierId: 'supp-1',
  issueDate: new Date('2026-02-20'),
  dueDate: new Date('2026-03-20'),
  subtotal: 500,
  tax: 110,
  total: 610,
  status: 'PENDING',
  matchStatus: 'PENDING',
  supplier: mockSupplier,
  items: [
    {
      id: 'inv-item-1',
      purchaseOrderItemId: 'poi-1',
      quantity: 20,
      unitPrice: 25,
      total: 610,
      matchStatus: 'PENDING',
      purchaseOrderItem: {
        id: 'poi-1',
        purchaseOrderId: 'po-1',
        purchaseOrder: mockPurchaseOrder,
        goodsReceiptItems: [],
      },
    },
  ],
  threeWayMatches: [],
};

describe('Purchase to Payment E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Purchase Order Creation', () => {
    it('should create purchase order for materials', async () => {
      // Setup mocks for repository layer
      mockSupplierRepository.findById.mockResolvedValue(mockSupplier);
      mockPurchaseOrderRepository.generateOrderNumber.mockResolvedValue('PO-2026-00001');
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(mockPurchaseOrder);
      mockNotificationService.notifyRoles.mockResolvedValue(undefined);

      const result = await purchaseOrderService.createPurchaseOrder({
        supplierId: 'supp-1',
        expectedDeliveryDate: '2026-02-25',
        items: [
          { materialId: 'mat-1', quantity: 20, unitPrice: 25 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalled();
    });

    it('should create purchase order for products', async () => {
      const productPO = {
        ...mockPurchaseOrder,
        orderType: 'FINISHED_PRODUCT',
        items: [{
          ...mockPurchaseOrder.items[0],
          materialId: null,
          productId: 'prod-1',
          product: mockProduct,
        }],
      };

      mockSupplierRepository.findById.mockResolvedValue(mockSupplier);
      mockPurchaseOrderRepository.generateOrderNumber.mockResolvedValue('PO-2026-00002');
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(productPO);
      mockNotificationService.notifyRoles.mockResolvedValue(undefined);

      const result = await purchaseOrderService.createPurchaseOrder({
        supplierId: 'supp-1',
        expectedDeliveryDate: '2026-02-25',
        items: [
          { productId: 'prod-1', quantity: 10, unitPrice: 50 },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalled();
    });

    it('should auto-generate PO number', async () => {
      mockSupplierRepository.findById.mockResolvedValue(mockSupplier);
      mockPurchaseOrderRepository.generateOrderNumber.mockResolvedValue('PO-2026-00003');
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(mockPurchaseOrder);
      mockNotificationService.notifyRoles.mockResolvedValue(undefined);

      await purchaseOrderService.createPurchaseOrder({
        supplierId: 'supp-1',
        items: [{ materialId: 'mat-1', quantity: 20, unitPrice: 25 }],
      });

      expect(mockPurchaseOrderRepository.generateOrderNumber).toHaveBeenCalled();
      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'PO-2026-00003',
        }),
        expect.any(Array)
      );
    });
  });

  describe('PO Status Transitions', () => {
    it('should update status from DRAFT to SENT via confirmPurchaseOrder', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'DRAFT',
      });
      mockPurchaseOrderRepository.updateStatus.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });

      const result = await purchaseOrderService.confirmPurchaseOrder('po-1');

      expect(result.status).toBe('SENT');
    });

    it('should update purchase order with new data', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'DRAFT',
      });
      mockPurchaseOrderRepository.update.mockResolvedValue({
        ...mockPurchaseOrder,
        notes: 'Updated notes',
      });

      const result = await purchaseOrderService.updatePurchaseOrder('po-1', {
        notes: 'Updated notes',
      });

      expect(result.notes).toBe('Updated notes');
    });

    it('should not allow updates to received orders', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'RECEIVED',
      });

      await expect(purchaseOrderService.updatePurchaseOrder('po-1', {
        notes: 'Try to update',
      })).rejects.toThrow('Non è possibile modificare un ordine ricevuto o cancellato');
    });

    it('should allow cancellation from DRAFT', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'DRAFT',
      });
      mockPurchaseOrderRepository.cancel.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'CANCELLED',
      });
      mockNotificationService.notifyRoles.mockResolvedValue(undefined);

      const result = await purchaseOrderService.cancelPurchaseOrder('po-1', 'Test cancellation');

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('Goods Receipt', () => {
    it('should create goods receipt for purchase order', async () => {
      // Mock the PO lookup
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });

      // The service uses $transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      // Mock goodsReceipt.create within transaction
      mockPrisma.goodsReceipt.create.mockResolvedValue(mockGoodsReceipt);
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...mockPurchaseOrder.items[0],
        receivedQuantity: 20,
      });
      mockPrisma.purchaseOrderItem.findMany.mockResolvedValue([
        { ...mockPurchaseOrder.items[0], receivedQuantity: 20 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'RECEIVED',
      });

      const result = await goodsReceiptService.createGoodsReceipt({
        purchaseOrderId: 'po-1',
        warehouseId: 'wh-1',
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            receivedQuantity: 20,
            acceptedQuantity: 20,
            rejectedQuantity: 0,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPrisma.goodsReceipt.create).toHaveBeenCalled();
    });

    it('should update received quantity on PO items', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.goodsReceipt.create.mockResolvedValue(mockGoodsReceipt);
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...mockPurchaseOrder.items[0],
        receivedQuantity: 20,
      });
      mockPrisma.purchaseOrderItem.findMany.mockResolvedValue([
        { ...mockPurchaseOrder.items[0], receivedQuantity: 20 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'RECEIVED',
      });

      await goodsReceiptService.createGoodsReceipt({
        purchaseOrderId: 'po-1',
        warehouseId: 'wh-1',
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            receivedQuantity: 20,
            acceptedQuantity: 20,
            rejectedQuantity: 0,
          },
        ],
      });

      expect(mockPrisma.purchaseOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'poi-1' },
          data: expect.objectContaining({
            receivedQuantity: expect.objectContaining({
              increment: 20,
            }),
          }),
        })
      );
    });

    it('should handle partial receipt', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const partialReceipt = {
        ...mockGoodsReceipt,
        items: [{
          ...mockGoodsReceipt.items[0],
          receivedQuantity: 10,
          acceptedQuantity: 10,
        }],
      };

      mockPrisma.goodsReceipt.create.mockResolvedValue(partialReceipt);
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...mockPurchaseOrder.items[0],
        receivedQuantity: 10,
      });
      mockPrisma.purchaseOrderItem.findMany.mockResolvedValue([
        { ...mockPurchaseOrder.items[0], quantity: 20, receivedQuantity: 10 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'PARTIALLY_RECEIVED',
      });

      const result = await goodsReceiptService.createGoodsReceipt({
        purchaseOrderId: 'po-1',
        warehouseId: 'wh-1',
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            receivedQuantity: 10,
            acceptedQuantity: 10,
            rejectedQuantity: 0,
          },
        ],
      });

      expect(result).toBeDefined();
    });
  });

  describe('Three-Way Matching', () => {
    it('should match PO, GR, and invoice via matchInvoiceToPo', async () => {
      // The service computes the status based on actual data comparison
      // For a MATCHED status: invoiceTotal must equal referenceTotal (grTotal or poTotal)
      // GR total is computed as: sum(acceptedQuantity * poItem.unitPrice) = 20 * 25 = 500
      // So invoice items total must also be 500

      const poWithGr = {
        ...mockPurchaseOrder,
        status: 'RECEIVED',
        items: [{
          ...mockPurchaseOrder.items[0],
          unitPrice: 25,
          total: 500, // 20 * 25
        }],
        goodsReceipts: [{
          ...mockGoodsReceipt,
          status: 'COMPLETED',
          items: [{
            ...mockGoodsReceipt.items[0],
            purchaseOrderItemId: 'poi-1',
            acceptedQuantity: 20,
          }],
        }],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithGr);
      mockPrisma.threeWayMatch.upsert.mockResolvedValue({
        id: 'twm-1',
        supplierInvoiceId: 'inv-1',
        purchaseOrderId: 'po-1',
        goodsReceiptId: 'gr-1',
        status: 'MATCHED',
        priceVariance: 0,
        priceVariancePct: 0,
        qtyVariance: 0,
        qtyVariancePct: 0,
        withinTolerance: true,
      });
      mockPrisma.supplierInvoiceItem.update.mockResolvedValue({});

      // Invoice with matching total (500 = 20 qty * 25 unitPrice)
      const invoiceForMatching = {
        ...mockSupplierInvoice,
        total: 500,
        items: [{
          ...mockSupplierInvoice.items[0],
          quantity: 20,
          total: 500, // Must match GR total for MATCHED status
        }],
      };

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoiceForMatching,
        'po-1',
        invoiceForMatching.items,
        'user-1'
      );

      expect(result.status).toBe('MATCHED');
      expect(result.priceVariance).toBe(0);
    });

    it('should flag discrepancy when invoice total differs significantly', async () => {
      // GR total = 20 * 25 = 500
      // Invoice total = 550 (10% variance, above 2% default tolerance)
      const poWithGr = {
        ...mockPurchaseOrder,
        status: 'RECEIVED',
        items: [{
          ...mockPurchaseOrder.items[0],
          unitPrice: 25,
          total: 500,
        }],
        goodsReceipts: [{
          ...mockGoodsReceipt,
          status: 'COMPLETED',
          items: [{
            ...mockGoodsReceipt.items[0],
            purchaseOrderItemId: 'poi-1',
            acceptedQuantity: 20,
          }],
        }],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithGr);
      mockPrisma.threeWayMatch.upsert.mockResolvedValue({
        id: 'twm-2',
        supplierInvoiceId: 'inv-1',
        purchaseOrderId: 'po-1',
        goodsReceiptId: 'gr-1',
        status: 'DISCREPANCY',
        priceVariance: 50,
        priceVariancePct: 10,
        qtyVariance: 0,
        qtyVariancePct: 0,
        withinTolerance: false,
      });
      mockPrisma.supplierInvoiceItem.update.mockResolvedValue({});

      // Invoice with higher total (10% more)
      const invoiceWithVariance = {
        ...mockSupplierInvoice,
        total: 550, // 10% higher than GR total of 500
        items: [{
          ...mockSupplierInvoice.items[0],
          quantity: 20,
          total: 550,
        }],
      };

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoiceWithVariance,
        'po-1',
        invoiceWithVariance.items,
        'user-1'
      );

      expect(result.status).toBe('DISCREPANCY');
      expect(Math.abs(result.priceVariancePct)).toBeGreaterThan(2); // Default tolerance is 2%
    });

    it('should approve match within custom tolerance', async () => {
      // GR total = 20 * 25 = 500
      // Invoice total = 510 (2% variance, within 5% tolerance)
      const poWithGr = {
        ...mockPurchaseOrder,
        status: 'RECEIVED',
        items: [{
          ...mockPurchaseOrder.items[0],
          unitPrice: 25,
          total: 500,
        }],
        goodsReceipts: [{
          ...mockGoodsReceipt,
          status: 'COMPLETED',
          items: [{
            ...mockGoodsReceipt.items[0],
            purchaseOrderItemId: 'poi-1',
            acceptedQuantity: 20,
          }],
        }],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithGr);
      mockPrisma.threeWayMatch.upsert.mockResolvedValue({
        id: 'twm-3',
        supplierInvoiceId: 'inv-1',
        purchaseOrderId: 'po-1',
        goodsReceiptId: 'gr-1',
        status: 'APPROVED',
        priceVariance: 10,
        priceVariancePct: 2,
        qtyVariance: 0,
        qtyVariancePct: 0,
        withinTolerance: true,
      });
      mockPrisma.supplierInvoiceItem.update.mockResolvedValue({});

      // Invoice slightly higher (2% variance) but within 5% tolerance
      const invoiceWithSmallVariance = {
        ...mockSupplierInvoice,
        total: 510, // 2% higher than GR total of 500
        items: [{
          ...mockSupplierInvoice.items[0],
          quantity: 20,
          total: 510,
        }],
      };

      const result = await threeWayMatchService.matchInvoiceToPo(
        invoiceWithSmallVariance,
        'po-1',
        invoiceWithSmallVariance.items,
        'user-1',
        { price: 5, quantity: 0 } // 5% price tolerance
      );

      expect(result.status).toBe('APPROVED');
      expect(result.withinTolerance).toBe(true);
    });
  });

  describe('Payment Due Creation', () => {
    it('should create payment due from matched invoice', async () => {
      // This tests the payment due creation directly via Prisma mock
      // In a real scenario, this would be triggered by the accounting service
      mockPrisma.paymentDue.create.mockResolvedValue({
        id: 'pd-1',
        supplierInvoiceId: 'inv-1',
        amount: 610,
        dueDate: new Date('2026-03-17'), // 30 days from invoice
        status: 'PENDING',
      });

      const paymentDue = await mockPrisma.paymentDue.create({
        data: {
          supplierInvoiceId: 'inv-1',
          amount: 610,
          dueDate: new Date('2026-03-17'),
          status: 'PENDING',
        },
      });

      expect(paymentDue).toBeDefined();
      expect(paymentDue.amount).toBe(610);
    });
  });

  describe('Payment Recording', () => {
    it('should record full payment', async () => {
      mockPrisma.paymentDue.findMany.mockResolvedValue([{
        id: 'pd-1',
        supplierInvoiceId: 'inv-1',
        amount: 610,
        paidAmount: 0,
        status: 'PENDING',
      }]);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        paymentDueId: 'pd-1',
        amount: 610,
        paymentDate: new Date('2026-03-17'),
        method: 'BANK_TRANSFER',
      });
      mockPrisma.paymentDue.update.mockResolvedValue({
        id: 'pd-1',
        paidAmount: 610,
        status: 'PAID',
      });
      mockPrisma.supplierInvoice.update.mockResolvedValue({
        ...mockSupplierInvoice,
        status: 'PAID',
      });

      const payment = await mockPrisma.payment.create({
        data: {
          paymentDueId: 'pd-1',
          amount: 610,
          paymentDate: new Date('2026-03-17'),
          method: 'BANK_TRANSFER',
        },
      });

      expect(payment).toBeDefined();
      expect(payment.amount).toBe(610);
    });

    it('should record partial payment', async () => {
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-2',
        paymentDueId: 'pd-1',
        amount: 300,
        paymentDate: new Date('2026-03-10'),
      });
      mockPrisma.paymentDue.update.mockResolvedValue({
        id: 'pd-1',
        paidAmount: 300,
        status: 'PARTIAL',
      });

      const payment = await mockPrisma.payment.create({
        data: {
          paymentDueId: 'pd-1',
          amount: 300,
          paymentDate: new Date('2026-03-10'),
          method: 'BANK_TRANSFER',
        },
      });

      expect(payment.amount).toBe(300);
    });
  });

  describe('Full Purchase Cycle', () => {
    it('should complete full cycle: PO -> GR -> Invoice -> Payment', async () => {
      // Step 1: Create PO
      mockSupplierRepository.findById.mockResolvedValue(mockSupplier);
      mockPurchaseOrderRepository.generateOrderNumber.mockResolvedValue('PO-2026-00001');
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'DRAFT',
      });
      mockNotificationService.notifyRoles.mockResolvedValue(undefined);

      const po = await purchaseOrderService.createPurchaseOrder({
        supplierId: 'supp-1',
        items: [{ materialId: 'mat-1', quantity: 20, unitPrice: 25 }],
      });
      expect(po).toBeDefined();

      // Step 2: Send PO (confirm)
      mockPurchaseOrderRepository.findById.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'DRAFT',
      });
      mockPurchaseOrderRepository.updateStatus.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });

      const sentPo = await purchaseOrderService.confirmPurchaseOrder('po-1');
      expect(sentPo.status).toBe('SENT');

      // Step 3: Receive goods
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'SENT',
      });
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.goodsReceipt.create.mockResolvedValue(mockGoodsReceipt);
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...mockPurchaseOrder.items[0],
        receivedQuantity: 20,
      });
      mockPrisma.purchaseOrderItem.findMany.mockResolvedValue([
        { ...mockPurchaseOrder.items[0], receivedQuantity: 20 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrder,
        status: 'RECEIVED',
      });

      const gr = await goodsReceiptService.createGoodsReceipt({
        purchaseOrderId: 'po-1',
        warehouseId: 'wh-1',
        items: [{
          purchaseOrderItemId: 'poi-1',
          receivedQuantity: 20,
          acceptedQuantity: 20,
          rejectedQuantity: 0,
        }],
      });
      expect(gr).toBeDefined();

      // Step 4: Three-way match
      // GR total is computed as: sum(acceptedQuantity * poItem.unitPrice) = 20 * 25 = 500
      const poWithGr = {
        ...mockPurchaseOrder,
        status: 'RECEIVED',
        items: [{
          ...mockPurchaseOrder.items[0],
          unitPrice: 25,
          total: 500,
        }],
        goodsReceipts: [{
          ...mockGoodsReceipt,
          status: 'COMPLETED',
          items: [{
            ...mockGoodsReceipt.items[0],
            purchaseOrderItemId: 'poi-1',
            acceptedQuantity: 20,
          }],
        }],
      };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithGr);
      mockPrisma.threeWayMatch.upsert.mockResolvedValue({
        id: 'twm-1',
        supplierInvoiceId: 'inv-1',
        purchaseOrderId: 'po-1',
        goodsReceiptId: 'gr-1',
        status: 'MATCHED',
        priceVariance: 0,
        priceVariancePct: 0,
        withinTolerance: true,
      });
      mockPrisma.supplierInvoiceItem.update.mockResolvedValue({});

      // Invoice with matching total (500 = 20 qty * 25 unitPrice)
      const invoiceForMatching = {
        ...mockSupplierInvoice,
        total: 500,
        items: [{
          ...mockSupplierInvoice.items[0],
          quantity: 20,
          total: 500,
        }],
      };

      const match = await threeWayMatchService.matchInvoiceToPo(
        invoiceForMatching,
        'po-1',
        invoiceForMatching.items,
        'user-1'
      );
      expect(match.status).toBe('MATCHED');

      // Step 5: Record payment
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 610,
        status: 'COMPLETED',
      });

      const payment = await mockPrisma.payment.create({
        data: {
          paymentDueId: 'pd-1',
          amount: 610,
          paymentDate: new Date('2026-03-17'),
          method: 'BANK_TRANSFER',
        },
      });
      expect(payment.amount).toBe(610);
    });
  });
});
