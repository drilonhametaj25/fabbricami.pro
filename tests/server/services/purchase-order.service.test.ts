/**
 * Purchase Order Service Tests
 * Comprehensive tests for purchase order management and analytics
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
}));

// Mock notification service
const mockNotificationService = {
  notifyRoles: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

// Mock purchase order repository
const mockPurchaseOrderRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  generateOrderNumber: jest.fn().mockResolvedValue('PO-2026-000001'),
  createWithItems: jest.fn(),
  update: jest.fn(),
  receiveItems: jest.fn(),
  updateStatus: jest.fn(),
  cancel: jest.fn(),
  getSupplierOrderStats: jest.fn(),
};
jest.mock('@server/repositories/purchase-order.repository', () => ({
  __esModule: true,
  default: mockPurchaseOrderRepository,
}));

// Mock supplier repository
const mockSupplierRepository = {
  findById: jest.fn(),
};
jest.mock('@server/repositories/supplier.repository', () => ({
  __esModule: true,
  default: mockSupplierRepository,
}));

import purchaseOrderService from '@server/services/purchase-order.service';

describe('PurchaseOrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  const createMockPurchaseOrder = (overrides: any = {}) => ({
    id: 'po-1',
    orderNumber: 'PO-2026-000001',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    status: 'DRAFT',
    orderType: 'MATERIAL',
    subtotal: createDecimal(5000),
    discount: createDecimal(0),
    tax: createDecimal(1100),
    total: createDecimal(6100),
    currency: 'EUR',
    orderDate: new Date(),
    expectedDate: createMockDate(14),
    deliveryStatus: 'PENDING',
    receivedQuantityPercent: createDecimal(0),
    paymentTerms: 30,
    paymentStatus: 'PENDING',
    notes: null,
    internalNotes: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: mockFactories.supplier({ id: 'sup-1' }),
    items: [],
    ...overrides,
  });

  const createMockPurchaseOrderItem = (overrides: any = {}) => ({
    id: 'poi-1',
    purchaseOrderId: 'po-1',
    productId: null,
    materialId: 'mat-1',
    sku: 'MAT001',
    name: 'Test Material',
    quantity: 100,
    receivedQuantity: 0,
    unitPrice: createDecimal(50),
    discount: createDecimal(0),
    tax: createDecimal(22),
    taxAmount: createDecimal(1100),
    total: createDecimal(6100),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==========================================
  // LIST PURCHASE ORDERS TESTS
  // ==========================================

  describe('listPurchaseOrders', () => {
    it('should return paginated purchase orders', async () => {
      const orders = [
        createMockPurchaseOrder({ id: 'po-1' }),
        createMockPurchaseOrder({ id: 'po-2', orderNumber: 'PO-2026-000002' }),
      ];

      mockPurchaseOrderRepository.findAll.mockResolvedValue({
        items: orders,
        total: 10,
      });

      const result = await purchaseOrderService.listPurchaseOrders({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by supplier', async () => {
      mockPurchaseOrderRepository.findAll.mockResolvedValue({
        items: [],
        total: 0,
      });

      await purchaseOrderService.listPurchaseOrders({
        supplierId: 'sup-1',
      });

      expect(mockPurchaseOrderRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplierId: 'sup-1' },
        })
      );
    });

    it('should filter by status', async () => {
      mockPurchaseOrderRepository.findAll.mockResolvedValue({
        items: [],
        total: 0,
      });

      await purchaseOrderService.listPurchaseOrders({
        status: 'SENT',
      });

      expect(mockPurchaseOrderRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'SENT' },
        })
      );
    });

    it('should filter by search term', async () => {
      mockPurchaseOrderRepository.findAll.mockResolvedValue({
        items: [],
        total: 0,
      });

      await purchaseOrderService.listPurchaseOrders({
        search: 'PO-2026',
      });

      expect(mockPurchaseOrderRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should apply custom sorting', async () => {
      mockPurchaseOrderRepository.findAll.mockResolvedValue({
        items: [],
        total: 0,
      });

      await purchaseOrderService.listPurchaseOrders({
        sortBy: 'total',
        sortOrder: 'asc',
      });

      expect(mockPurchaseOrderRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' },
        })
      );
    });
  });

  // ==========================================
  // GET PURCHASE ORDER TESTS
  // ==========================================

  describe('getPurchaseOrderById', () => {
    it('should return purchase order with details', async () => {
      const order = createMockPurchaseOrder({
        items: [createMockPurchaseOrderItem()],
      });

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      const result = await purchaseOrderService.getPurchaseOrderById('po-1');

      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('PO-2026-000001');
    });

    it('should throw error if order not found', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.getPurchaseOrderById('invalid-id')
      ).rejects.toThrow('Ordine d\'acquisto non trovato');
    });
  });

  // ==========================================
  // CREATE PURCHASE ORDER TESTS
  // ==========================================

  describe('createPurchaseOrder', () => {
    it('should create purchase order with items', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1', businessName: 'Test Supplier' });
      const newOrder = createMockPurchaseOrder({
        items: [createMockPurchaseOrderItem()],
      });

      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.generateOrderNumber.mockResolvedValue('PO-2026-000001');
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(newOrder);

      const result = await purchaseOrderService.createPurchaseOrder({
        supplierId: 'sup-1',
        items: [
          { materialId: 'mat-1', quantity: 100, unitPrice: 50 },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalled();
      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });

    it('should calculate totals correctly', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      const newOrder = createMockPurchaseOrder();

      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(newOrder);

      await purchaseOrderService.createPurchaseOrder({
        supplierId: 'sup-1',
        items: [
          { materialId: 'mat-1', quantity: 10, unitPrice: 100, tax: 22 },
          { materialId: 'mat-2', quantity: 5, unitPrice: 50, tax: 22 },
        ],
      });

      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 1250, // (10*100) + (5*50)
          tax: 275, // 1250 * 22%
          total: 1525,
        }),
        expect.any(Array)
      );
    });

    it('should determine order type as MATERIAL for material-only orders', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(createMockPurchaseOrder());

      await purchaseOrderService.createPurchaseOrder({
        supplierId: 'sup-1',
        items: [
          { materialId: 'mat-1', quantity: 10, unitPrice: 100 },
        ],
      });

      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          orderType: 'MATERIAL',
        }),
        expect.any(Array)
      );
    });

    it('should determine order type as FINISHED_PRODUCT for product-only orders', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(createMockPurchaseOrder());

      await purchaseOrderService.createPurchaseOrder({
        supplierId: 'sup-1',
        items: [
          { productId: 'prod-1', quantity: 10, unitPrice: 100 },
        ],
      });

      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          orderType: 'FINISHED_PRODUCT',
        }),
        expect.any(Array)
      );
    });

    it('should determine order type as MIXED for mixed orders', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1' });
      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.createWithItems.mockResolvedValue(createMockPurchaseOrder());

      await purchaseOrderService.createPurchaseOrder({
        supplierId: 'sup-1',
        items: [
          { productId: 'prod-1', quantity: 10, unitPrice: 100 },
          { materialId: 'mat-1', quantity: 5, unitPrice: 50 },
        ],
      });

      expect(mockPurchaseOrderRepository.createWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          orderType: 'MIXED',
        }),
        expect.any(Array)
      );
    });

    it('should throw error if supplier not found', async () => {
      mockSupplierRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.createPurchaseOrder({
          supplierId: 'invalid-sup',
          items: [{ materialId: 'mat-1', quantity: 10, unitPrice: 100 }],
        })
      ).rejects.toThrow('Fornitore non trovato');
    });
  });

  // ==========================================
  // UPDATE PURCHASE ORDER TESTS
  // ==========================================

  describe('updatePurchaseOrder', () => {
    it('should update draft order', async () => {
      const order = createMockPurchaseOrder({ status: 'DRAFT' });
      const updatedOrder = { ...order, notes: 'Updated notes' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await purchaseOrderService.updatePurchaseOrder('po-1', {
        notes: 'Updated notes',
      });

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw error if order not found', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.updatePurchaseOrder('invalid-id', { notes: 'Test' })
      ).rejects.toThrow('Ordine d\'acquisto non trovato');
    });

    it('should throw error if order is RECEIVED', async () => {
      const order = createMockPurchaseOrder({ status: 'RECEIVED' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.updatePurchaseOrder('po-1', { notes: 'Test' })
      ).rejects.toThrow('Non è possibile modificare un ordine ricevuto o cancellato');
    });

    it('should throw error if order is CANCELLED', async () => {
      const order = createMockPurchaseOrder({ status: 'CANCELLED' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.updatePurchaseOrder('po-1', { notes: 'Test' })
      ).rejects.toThrow('Non è possibile modificare un ordine ricevuto o cancellato');
    });
  });

  // ==========================================
  // RECEIVE ITEMS TESTS
  // ==========================================

  describe('receiveItems', () => {
    it('should receive items and update inventory for products', async () => {
      const order = createMockPurchaseOrder({
        status: 'SENT',
        items: [
          createMockPurchaseOrderItem({ id: 'poi-1', productId: 'prod-1', materialId: null }),
        ],
      });
      const updatedOrder = { ...order, status: 'RECEIVED' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.receiveItems.mockResolvedValue(updatedOrder);
      prismaMock.inventoryMovement.create.mockResolvedValue({} as any);
      prismaMock.inventoryItem.upsert.mockResolvedValue({} as any);

      const result = await purchaseOrderService.receiveItems({
        orderId: 'po-1',
        items: [
          { itemId: 'poi-1', receivedQuantity: 100 },
        ],
        warehouseId: 'wh-1',
        warehouseLocation: 'WEB',
      });

      expect(result.status).toBe('RECEIVED');
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalled();
      expect(prismaMock.inventoryItem.upsert).toHaveBeenCalled();
      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });

    it('should receive items and update stock for materials', async () => {
      const order = createMockPurchaseOrder({
        status: 'SENT',
        items: [
          createMockPurchaseOrderItem({ id: 'poi-1', productId: null, materialId: 'mat-1' }),
        ],
      });
      const updatedOrder = { ...order, status: 'PARTIALLY_RECEIVED' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.receiveItems.mockResolvedValue(updatedOrder);
      // Mock material validation (Fix HIGH #5)
      prismaMock.material.findUnique.mockResolvedValue({ id: 'mat-1', sku: 'MAT-001', name: 'Test Material' } as any);
      prismaMock.materialMovement.create.mockResolvedValue({} as any);
      prismaMock.material.update.mockResolvedValue({} as any);

      await purchaseOrderService.receiveItems({
        orderId: 'po-1',
        items: [
          { itemId: 'poi-1', receivedQuantity: 50 },
        ],
      });

      expect(prismaMock.materialMovement.create).toHaveBeenCalled();
      expect(prismaMock.material.update).toHaveBeenCalledWith({
        where: { id: 'mat-1' },
        data: { currentStock: { increment: 50 } },
      });
    });

    it('should throw error if order not found', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.receiveItems({
          orderId: 'invalid-id',
          items: [{ itemId: 'poi-1', receivedQuantity: 100 }],
        })
      ).rejects.toThrow('Ordine d\'acquisto non trovato');
    });

    it('should throw error if order is CANCELLED', async () => {
      const order = createMockPurchaseOrder({ status: 'CANCELLED' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.receiveItems({
          orderId: 'po-1',
          items: [{ itemId: 'poi-1', receivedQuantity: 100 }],
        })
      ).rejects.toThrow('Non è possibile ricevere merce per questo ordine');
    });

    it('should throw error if order is DRAFT', async () => {
      const order = createMockPurchaseOrder({ status: 'DRAFT' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.receiveItems({
          orderId: 'po-1',
          items: [{ itemId: 'poi-1', receivedQuantity: 100 }],
        })
      ).rejects.toThrow('Non è possibile ricevere merce per questo ordine');
    });
  });

  // ==========================================
  // CONFIRM PURCHASE ORDER TESTS
  // ==========================================

  describe('confirmPurchaseOrder', () => {
    it('should confirm draft order', async () => {
      const order = createMockPurchaseOrder({ status: 'DRAFT' });
      const confirmedOrder = { ...order, status: 'SENT' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.updateStatus.mockResolvedValue(confirmedOrder);

      const result = await purchaseOrderService.confirmPurchaseOrder('po-1');

      expect(result.status).toBe('SENT');
    });

    it('should throw error if order not found', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.confirmPurchaseOrder('invalid-id')
      ).rejects.toThrow('Ordine d\'acquisto non trovato');
    });

    it('should throw error if order is not DRAFT', async () => {
      const order = createMockPurchaseOrder({ status: 'SENT' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.confirmPurchaseOrder('po-1')
      ).rejects.toThrow('Solo gli ordini in bozza possono essere confermati');
    });
  });

  // ==========================================
  // CANCEL PURCHASE ORDER TESTS
  // ==========================================

  describe('cancelPurchaseOrder', () => {
    it('should cancel draft order', async () => {
      const order = createMockPurchaseOrder({ status: 'DRAFT' });
      const cancelledOrder = { ...order, status: 'CANCELLED' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.cancel.mockResolvedValue(cancelledOrder);

      const result = await purchaseOrderService.cancelPurchaseOrder('po-1', 'Not needed');

      expect(result.status).toBe('CANCELLED');
      expect(mockNotificationService.notifyRoles).toHaveBeenCalled();
    });

    it('should cancel sent order', async () => {
      const order = createMockPurchaseOrder({ status: 'SENT' });
      const cancelledOrder = { ...order, status: 'CANCELLED' };

      mockPurchaseOrderRepository.findById.mockResolvedValue(order);
      mockPurchaseOrderRepository.cancel.mockResolvedValue(cancelledOrder);

      const result = await purchaseOrderService.cancelPurchaseOrder('po-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if order not found', async () => {
      mockPurchaseOrderRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.cancelPurchaseOrder('invalid-id')
      ).rejects.toThrow('Ordine d\'acquisto non trovato');
    });

    it('should throw error if order is RECEIVED', async () => {
      const order = createMockPurchaseOrder({ status: 'RECEIVED' });
      mockPurchaseOrderRepository.findById.mockResolvedValue(order);

      await expect(
        purchaseOrderService.cancelPurchaseOrder('po-1')
      ).rejects.toThrow('Non è possibile cancellare un ordine già ricevuto');
    });
  });

  // ==========================================
  // SUPPLIER ORDER STATISTICS TESTS
  // ==========================================

  describe('getSupplierOrderStatistics', () => {
    it('should return supplier order statistics', async () => {
      const supplier = mockFactories.supplier({ id: 'sup-1', code: 'SUP001', businessName: 'Test Supplier' });
      const stats = {
        totalOrders: 10,
        totalValue: 50000,
        avgOrderValue: 5000,
      };

      mockSupplierRepository.findById.mockResolvedValue(supplier);
      mockPurchaseOrderRepository.getSupplierOrderStats.mockResolvedValue(stats);

      const result = await purchaseOrderService.getSupplierOrderStatistics('sup-1');

      expect(result.supplier.code).toBe('SUP001');
      expect(result.supplier.businessName).toBe('Test Supplier');
      expect(result.totalOrders).toBe(10);
    });

    it('should throw error if supplier not found', async () => {
      mockSupplierRepository.findById.mockResolvedValue(null);

      await expect(
        purchaseOrderService.getSupplierOrderStatistics('invalid-sup')
      ).rejects.toThrow('Fornitore non trovato');
    });
  });

  // ==========================================
  // ANALYTICS TESTS
  // ==========================================

  describe('getPurchaseTimeline', () => {
    it('should return purchase timeline data', async () => {
      const orders = [
        createMockPurchaseOrder({ total: createDecimal(1000), createdAt: new Date() }),
        createMockPurchaseOrder({ total: createDecimal(2000), createdAt: new Date() }),
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(orders as any);

      const result = await purchaseOrderService.getPurchaseTimeline(30);

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('ordersCount');
      expect(result).toHaveProperty('totalSpent');
      expect(result).toHaveProperty('summary');
      expect(result.summary.totalOrders).toBe(2);
    });

    it('should return empty timeline for no orders', async () => {
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await purchaseOrderService.getPurchaseTimeline(30);

      expect(result.summary.totalOrders).toBe(0);
      expect(result.summary.totalSpent).toBe(0);
    });
  });

  describe('getPurchaseSeasonality', () => {
    it('should return seasonality analysis', async () => {
      const orders = [
        createMockPurchaseOrder({ total: createDecimal(1000), createdAt: new Date('2026-01-15') }),
        createMockPurchaseOrder({ total: createDecimal(2000), createdAt: new Date('2026-06-15') }),
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(orders as any);

      const result = await purchaseOrderService.getPurchaseSeasonality();

      expect(result).toHaveProperty('monthlyPattern');
      expect(result.monthlyPattern).toHaveLength(12);
      expect(result).toHaveProperty('peakMonths');
      expect(result).toHaveProperty('lowMonths');
    });
  });

  describe('getPurchaseForecasting', () => {
    it('should return material forecasts', async () => {
      const materials = [
        {
          ...mockFactories.material({ id: 'mat-1', name: 'Material 1', currentStock: 50, minStock: 10 }),
          supplierItems: [{
            supplier: mockFactories.supplier({ id: 'sup-1', businessName: 'Supplier 1' }),
            leadTimeDays: 7,
            lastPurchasePrice: createDecimal(10),
          }],
        },
      ];

      prismaMock.material.findMany.mockResolvedValue(materials as any);
      prismaMock.materialConsumption.aggregate.mockResolvedValue({
        _sum: { actualQuantity: 90 }, // 90 consumed in 90 days = 1/day
      });

      const result = await purchaseOrderService.getPurchaseForecasting();

      expect(result).toHaveProperty('materials');
      expect(result).toHaveProperty('summary');
    });

    it('should use material movements if no consumption records', async () => {
      const materials = [
        {
          ...mockFactories.material({ id: 'mat-1', name: 'Material 1', currentStock: 50 }),
          supplierItems: [],
        },
      ];

      prismaMock.material.findMany.mockResolvedValue(materials as any);
      prismaMock.materialConsumption.aggregate.mockResolvedValue({
        _sum: { actualQuantity: 0 },
      });
      prismaMock.materialMovement.aggregate.mockResolvedValue({
        _sum: { quantity: 45 },
      });

      const result = await purchaseOrderService.getPurchaseForecasting();

      expect(prismaMock.materialMovement.aggregate).toHaveBeenCalled();
    });
  });

  describe('getDiscountOpportunities', () => {
    it('should return discount opportunities', async () => {
      prismaMock.purchaseOrderItem.groupBy.mockResolvedValue([
        { materialId: 'mat-1', productId: null, _sum: { quantity: 80, total: 4000 } },
      ] as any);

      prismaMock.supplierItem.findMany.mockResolvedValue([
        {
          supplier: mockFactories.supplier({ id: 'sup-1', businessName: 'Test Supplier' }),
          material: { name: 'Test Material', sku: 'MAT001' },
          product: null,
          volumeDiscounts: [
            { minQuantity: 100, discountPercent: createDecimal(10) },
            { minQuantity: 200, discountPercent: createDecimal(15) },
          ],
        },
      ] as any);

      const result = await purchaseOrderService.getDiscountOpportunities();

      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('getItemOrderHistory', () => {
    it('should return order history for a material', async () => {
      const orders = [
        {
          ...createMockPurchaseOrder({ id: 'po-1', status: 'DRAFT' }),
          items: [createMockPurchaseOrderItem({ materialId: 'mat-1' })],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(orders as any);
      prismaMock.material.findUnique.mockResolvedValue(mockFactories.material({ id: 'mat-1' }) as any);

      const result = await purchaseOrderService.getItemOrderHistory({
        materialId: 'mat-1',
      });

      expect(result).toHaveProperty('item');
      expect(result).toHaveProperty('history');
      expect(result).toHaveProperty('summary');
      expect(result.summary.totalOrders).toBe(1);
    });

    it('should return order history for a product', async () => {
      const orders = [
        {
          ...createMockPurchaseOrder({ id: 'po-1', status: 'SENT' }),
          items: [createMockPurchaseOrderItem({ productId: 'prod-1', materialId: null })],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(orders as any);
      prismaMock.product.findUnique.mockResolvedValue(mockFactories.product({ id: 'prod-1' }) as any);

      const result = await purchaseOrderService.getItemOrderHistory({
        productId: 'prod-1',
      });

      expect(result.item?.type).toBe('PRODUCT');
    });

    it('should identify consolidation opportunities', async () => {
      const orders = [
        {
          ...createMockPurchaseOrder({ id: 'po-1', status: 'DRAFT' }),
          items: [createMockPurchaseOrderItem({ materialId: 'mat-1' })],
          goodsReceipts: [],
        },
      ];

      prismaMock.purchaseOrder.findMany.mockResolvedValue(orders as any);
      prismaMock.material.findUnique.mockResolvedValue(mockFactories.material({ id: 'mat-1' }) as any);

      const result = await purchaseOrderService.getItemOrderHistory({
        materialId: 'mat-1',
      });

      expect(result.summary.hasOpenOrders).toBe(true);
      expect(result.summary.canConsolidateWith).toHaveLength(1);
    });

    it('should throw error if neither productId nor materialId provided', async () => {
      await expect(
        purchaseOrderService.getItemOrderHistory({})
      ).rejects.toThrow('Specificare productId o materialId');
    });
  });
});
