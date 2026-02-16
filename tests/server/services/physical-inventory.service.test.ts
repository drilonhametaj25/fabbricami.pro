/**
 * Physical Inventory Service Tests
 * Tests for physical counting sessions, variance reports, and inventory reconciliation
 */

// Mock Prisma
const mockPrisma = {
  physicalCountSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  physicalCountItem: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  warehouse: {
    findUnique: jest.fn(),
  },
  inventoryItem: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
  },
  materialInventory: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  },
  materialMovement: {
    create: jest.fn(),
  },
  material: {
    update: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((callbacks: any[]) => Promise.all(callbacks)),
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import { physicalInventoryService } from '@server/services/physical-inventory.service';

describe('Physical Inventory Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================
  // createSession Tests
  // =====================================
  describe('createSession', () => {
    const createInput = {
      warehouseId: 'wh-1',
      name: 'Q1 2026 Full Count',
      description: 'Quarterly inventory count',
      countType: 'FULL' as const,
      createdById: 'user-1',
    };

    it('should create session successfully', async () => {
      const mockWarehouse = { id: 'wh-1', code: 'WH1', name: 'Main Warehouse' };
      const mockSession = {
        id: 'session-1',
        code: 'INV-WH1-2026-001',
        ...createInput,
        status: 'DRAFT',
        warehouse: mockWarehouse,
      };

      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.physicalCountSession.findFirst.mockResolvedValue(null);
      mockPrisma.physicalCountSession.create.mockResolvedValue(mockSession);

      const result = await physicalInventoryService.createSession(createInput);

      expect(result.code).toBe('INV-WH1-2026-001');
      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.physicalCountSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warehouseId: 'wh-1',
            name: 'Q1 2026 Full Count',
            status: 'DRAFT',
          }),
        })
      );
    });

    it('should generate sequential session code', async () => {
      const mockWarehouse = { id: 'wh-1', code: 'WH1' };
      const lastSession = { code: 'INV-WH1-2026-005' };

      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.physicalCountSession.findFirst.mockResolvedValue(lastSession);
      mockPrisma.physicalCountSession.create.mockResolvedValue({
        id: 'session-1',
        code: 'INV-WH1-2026-006',
      });

      const result = await physicalInventoryService.createSession(createInput);

      expect(result.code).toBe('INV-WH1-2026-006');
    });

    it('should throw error when warehouse not found', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(physicalInventoryService.createSession(createInput)).rejects.toThrow(
        'Warehouse non trovato'
      );
    });
  });

  // =====================================
  // startSession Tests
  // =====================================
  describe('startSession', () => {
    it('should start session and create count items from inventory', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'DRAFT',
        warehouseId: 'wh-1',
        filters: null,
        warehouse: { id: 'wh-1', code: 'WH1' },
      };

      const mockInventoryItems = [
        {
          productId: 'prod-1',
          variantId: null,
          location: 'A1',
          quantity: 100,
          product: { sku: 'SKU-001', name: 'Product 1', unit: 'pz', cost: 10 },
          variant: null,
        },
      ];

      const mockMaterialInventory = [
        {
          materialId: 'mat-1',
          location: 'B1',
          quantity: 50,
          material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg', cost: 5 },
        },
      ];

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockInventoryItems);
      mockPrisma.materialInventory.findMany.mockResolvedValue(mockMaterialInventory);
      mockPrisma.physicalCountItem.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.physicalCountSession.update.mockResolvedValue({ ...mockSession, status: 'IN_PROGRESS' });

      // Mock getSession call at the end
      mockPrisma.physicalCountSession.findUnique
        .mockResolvedValueOnce(mockSession)
        .mockResolvedValueOnce({
          ...mockSession,
          status: 'IN_PROGRESS',
          items: [],
        });

      await physicalInventoryService.startSession('session-1', 'user-1');

      expect(mockPrisma.physicalCountItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            sessionId: 'session-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            expectedQuantity: 100,
          }),
        ]),
      });
    });

    it('should filter by categories when specified', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'DRAFT',
        warehouseId: 'wh-1',
        filters: { categories: ['Electronics'] },
        warehouse: { id: 'wh-1', code: 'WH1' },
      };

      mockPrisma.physicalCountSession.findUnique
        .mockResolvedValueOnce(mockSession) // First call in startSession
        .mockResolvedValueOnce({ ...mockSession, status: 'IN_PROGRESS', items: [] }); // Second call in getSession
      mockPrisma.inventoryItem.findMany.mockResolvedValue([]);
      mockPrisma.materialInventory.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountItem.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.physicalCountSession.update.mockResolvedValue({ ...mockSession, status: 'IN_PROGRESS' });

      await physicalInventoryService.startSession('session-1', 'user-1');

      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: expect.objectContaining({
              category: { in: ['Electronics'] },
            }),
          }),
        })
      );
    });

    it('should throw error when session not found', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(
        physicalInventoryService.startSession('non-existent', 'user-1')
      ).rejects.toThrow('Sessione non trovata');
    });

    it('should throw error when session is not in DRAFT status', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS' };
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        physicalInventoryService.startSession('session-1', 'user-1')
      ).rejects.toThrow('La sessione non è in stato DRAFT');
    });
  });

  // =====================================
  // getSession Tests
  // =====================================
  describe('getSession', () => {
    it('should return session with computed stats', async () => {
      const mockSession = {
        id: 'session-1',
        warehouse: { id: 'wh-1', code: 'WH1' },
        items: [
          { id: 'item-1', status: 'NOT_COUNTED', variance: null },
          { id: 'item-2', status: 'COUNTED', variance: 5 },
          { id: 'item-3', status: 'VERIFIED', variance: 0 },
          { id: 'item-4', status: 'RECONCILED', variance: -3 },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);

      const result = await physicalInventoryService.getSession('session-1');

      expect(result.stats.totalItems).toBe(4);
      expect(result.stats.countedItems).toBe(3); // COUNTED, VERIFIED, RECONCILED
      expect(result.stats.verifiedItems).toBe(2); // VERIFIED, RECONCILED
      expect(result.stats.discrepancyItems).toBe(2); // variance !== 0
      expect(result.stats.progress).toBe(75); // 3/4 = 75%
    });

    it('should throw error when session not found', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(physicalInventoryService.getSession('non-existent')).rejects.toThrow(
        'Sessione non trovata'
      );
    });
  });

  // =====================================
  // listSessions Tests
  // =====================================
  describe('listSessions', () => {
    it('should return paginated sessions', async () => {
      const mockSessions = [
        { id: 'session-1', code: 'INV-WH1-2026-001', warehouse: { code: 'WH1' } },
        { id: 'session-2', code: 'INV-WH1-2026-002', warehouse: { code: 'WH1' } },
      ];

      mockPrisma.physicalCountSession.findMany.mockResolvedValue(mockSessions);
      mockPrisma.physicalCountSession.count.mockResolvedValue(2);

      const result = await physicalInventoryService.listSessions({}, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status array', async () => {
      mockPrisma.physicalCountSession.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.count.mockResolvedValue(0);

      await physicalInventoryService.listSessions({
        status: ['IN_PROGRESS', 'PENDING_REVIEW'] as any,
      });

      expect(mockPrisma.physicalCountSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['IN_PROGRESS', 'PENDING_REVIEW'] },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.physicalCountSession.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.count.mockResolvedValue(0);

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await physicalInventoryService.listSessions({ dateFrom, dateTo });

      expect(mockPrisma.physicalCountSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            plannedDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });
  });

  // =====================================
  // countItem Tests
  // =====================================
  describe('countItem', () => {
    const countInput = {
      sessionId: 'session-1',
      itemId: 'item-1',
      countedQuantity: 95,
      countedById: 'user-1',
      notes: 'Count notes',
    };

    it('should count item and auto-reconcile when variance is 0', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS', requireDoubleCount: false };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        countedQuantity: 100,
        status: 'RECONCILED',
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      const result = await physicalInventoryService.countItem({
        ...countInput,
        countedQuantity: 100, // No variance
      });

      expect(result.status).toBe('RECONCILED');
    });

    it('should mark as DISCREPANCY when variance is not 0', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS', requireDoubleCount: false };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        countedQuantity: 95,
        status: 'DISCREPANCY',
        variance: -5,
        varianceValue: 50, // 5 * 10
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      const result = await physicalInventoryService.countItem(countInput);

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DISCREPANCY',
            variance: -5,
            varianceValue: 50,
          }),
        })
      );
    });

    it('should mark as COUNTED when double count is required', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS', requireDoubleCount: true };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        countedQuantity: 95,
        status: 'COUNTED',
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      await physicalInventoryService.countItem(countInput);

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COUNTED',
          }),
        })
      );
    });

    it('should throw error when session not found', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(physicalInventoryService.countItem(countInput)).rejects.toThrow(
        'Sessione non trovata'
      );
    });

    it('should throw error when session is not IN_PROGRESS', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'DRAFT',
      });

      await expect(physicalInventoryService.countItem(countInput)).rejects.toThrow(
        'La sessione non è in corso'
      );
    });

    it('should throw error when item not found in session', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'IN_PROGRESS',
      });
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(null);

      await expect(physicalInventoryService.countItem(countInput)).rejects.toThrow(
        'Item non trovato nella sessione'
      );
    });
  });

  // =====================================
  // verifyItem Tests
  // =====================================
  describe('verifyItem', () => {
    const verifyInput = {
      sessionId: 'session-1',
      itemId: 'item-1',
      verifiedQuantity: 95,
      verifiedBy: 'user-2',
      notes: 'Verified',
    };

    it('should verify item when counts match', async () => {
      const mockSession = { id: 'session-1', requireDoubleCount: true };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        status: 'COUNTED',
        countedQuantity: 95,
        expectedQuantity: 100,
        unitCost: 10,
        notes: 'Original notes',
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        status: 'DISCREPANCY',
        verifiedQuantity: 95,
        finalQuantity: 95,
        variance: -5,
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      const result = await physicalInventoryService.verifyItem(verifyInput);

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedQuantity: 95,
            finalQuantity: 95,
            variance: -5,
          }),
        })
      );
    });

    it('should mark as VERIFIED when counts match and no variance', async () => {
      const mockSession = { id: 'session-1', requireDoubleCount: true };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        status: 'COUNTED',
        countedQuantity: 100,
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        status: 'VERIFIED',
        verifiedQuantity: 100,
        finalQuantity: 100,
        variance: 0,
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      await physicalInventoryService.verifyItem({
        ...verifyInput,
        verifiedQuantity: 100,
      });

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'VERIFIED',
          }),
        })
      );
    });

    it('should mark as DISCREPANCY when counts do not match', async () => {
      const mockSession = { id: 'session-1', requireDoubleCount: true };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        status: 'COUNTED',
        countedQuantity: 95, // First count
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        status: 'DISCREPANCY',
        verifiedQuantity: 90, // Different from first count
        finalQuantity: null,
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      await physicalInventoryService.verifyItem({
        ...verifyInput,
        verifiedQuantity: 90, // Different from countedQuantity
      });

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DISCREPANCY',
            finalQuantity: null, // Not determined
          }),
        })
      );
    });

    it('should throw error when session does not require double count', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        requireDoubleCount: false,
      });

      await expect(physicalInventoryService.verifyItem(verifyInput)).rejects.toThrow(
        'La sessione non richiede doppio conteggio'
      );
    });

    it('should throw error when item status is not COUNTED', async () => {
      const mockSession = { id: 'session-1', requireDoubleCount: true };
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue({
        id: 'item-1',
        sessionId: 'session-1',
        status: 'NOT_COUNTED',
      });

      await expect(physicalInventoryService.verifyItem(verifyInput)).rejects.toThrow(
        'Item non ancora conteggiato o già verificato'
      );
    });
  });

  // =====================================
  // reconcileItem Tests
  // =====================================
  describe('reconcileItem', () => {
    const reconcileInput = {
      sessionId: 'session-1',
      itemId: 'item-1',
      finalQuantity: 98,
      reconcileReason: 'Manager decision',
    };

    it('should reconcile item with final quantity', async () => {
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        expectedQuantity: 100,
        unitCost: 10,
        notes: 'Previous notes',
      };

      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({
        ...mockItem,
        finalQuantity: 98,
        variance: -2,
        varianceValue: 20,
        status: 'RECONCILED',
      });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      const result = await physicalInventoryService.reconcileItem(reconcileInput);

      expect(mockPrisma.physicalCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finalQuantity: 98,
            variance: -2,
            varianceValue: 20,
            status: 'RECONCILED',
          }),
        })
      );
    });

    it('should throw error when item not found', async () => {
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(null);

      await expect(physicalInventoryService.reconcileItem(reconcileInput)).rejects.toThrow(
        'Item non trovato nella sessione'
      );
    });
  });

  // =====================================
  // getItemsToCount Tests
  // =====================================
  describe('getItemsToCount', () => {
    it('should return items to count with pagination', async () => {
      const mockSession = { id: 'session-1', allowBlindCount: false };
      const mockItems = [
        { id: 'item-1', sku: 'SKU-001', expectedQuantity: 100, status: 'NOT_COUNTED' },
        { id: 'item-2', sku: 'SKU-002', expectedQuantity: 50, status: 'NOT_COUNTED' },
      ];

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.physicalCountItem.count.mockResolvedValue(2);

      const result = await physicalInventoryService.getItemsToCount('session-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].expectedQuantity).toBe(100); // Not hidden
    });

    it('should hide expected quantity when blind count is enabled', async () => {
      const mockSession = { id: 'session-1', allowBlindCount: true };
      const mockItems = [
        { id: 'item-1', sku: 'SKU-001', expectedQuantity: 100, status: 'NOT_COUNTED' },
      ];

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.physicalCountItem.count.mockResolvedValue(1);

      const result = await physicalInventoryService.getItemsToCount('session-1');

      expect(result.items[0].expectedQuantity).toBeUndefined();
    });
  });

  // =====================================
  // getDiscrepancyItems Tests
  // =====================================
  describe('getDiscrepancyItems', () => {
    it('should return items with discrepancies sorted by value', async () => {
      const mockItems = [
        { id: 'item-1', status: 'DISCREPANCY', varianceValue: 100 },
        { id: 'item-2', status: 'DISCREPANCY', varianceValue: 500 },
      ];

      mockPrisma.physicalCountItem.findMany.mockResolvedValue(mockItems);

      const result = await physicalInventoryService.getDiscrepancyItems('session-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.physicalCountItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sessionId: 'session-1',
            status: 'DISCREPANCY',
          },
          orderBy: [{ varianceValue: 'desc' }],
        })
      );
    });
  });

  // =====================================
  // completeSession Tests
  // =====================================
  describe('completeSession', () => {
    it('should complete session and apply inventory adjustments', async () => {
      const mockSession = {
        id: 'session-1',
        code: 'INV-WH1-2026-001',
        status: 'IN_PROGRESS',
        warehouseId: 'wh-1',
        requireDoubleCount: false,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            location: 'A1',
            status: 'RECONCILED',
            finalQuantity: 95,
            expectedQuantity: 100,
            variance: -5,
          },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'mov-1' });
      mockPrisma.physicalCountSession.update.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });

      const result = await physicalInventoryService.completeSession('session-1', 'user-1', true);

      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.inventoryItem.updateMany).toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT',
            productId: 'prod-1',
          }),
        })
      );
    });

    it('should complete from PENDING_REVIEW status', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'PENDING_REVIEW',
        requireDoubleCount: false,
        items: [{ status: 'RECONCILED', variance: 0, finalQuantity: 100 }],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountSession.update.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });

      const result = await physicalInventoryService.completeSession('session-1', 'user-1', false);

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error when unreconciled items exist', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'IN_PROGRESS',
        requireDoubleCount: false,
        items: [
          { status: 'DISCREPANCY' },
          { status: 'NOT_COUNTED' },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        physicalInventoryService.completeSession('session-1', 'user-1')
      ).rejects.toThrow('Ci sono ancora 2 items non riconciliati');
    });

    it('should throw error when status is invalid', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'DRAFT',
        items: [],
      });

      await expect(
        physicalInventoryService.completeSession('session-1', 'user-1')
      ).rejects.toThrow('La sessione non può essere completata in questo stato');
    });
  });

  // =====================================
  // generateVarianceReport Tests
  // =====================================
  describe('generateVarianceReport', () => {
    it('should generate comprehensive variance report', async () => {
      const mockSession = {
        id: 'session-1',
        items: [
          {
            sku: 'SKU-001',
            description: 'Product 1',
            expectedQuantity: 100,
            finalQuantity: 95,
            variance: -5,
            varianceValue: 50,
            product: { category: 'Electronics' },
            material: null,
          },
          {
            sku: 'SKU-002',
            description: 'Product 2',
            expectedQuantity: 50,
            finalQuantity: 55,
            variance: 5,
            varianceValue: 25,
            product: { category: 'Electronics' },
            material: null,
          },
          {
            sku: 'SKU-003',
            description: 'Product 3',
            expectedQuantity: 30,
            finalQuantity: 30,
            variance: 0,
            varianceValue: 0,
            product: { category: 'Accessories' },
            material: null,
          },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);

      const result = await physicalInventoryService.generateVarianceReport('session-1');

      expect(result.totalItems).toBe(3);
      expect(result.countedItems).toBe(3);
      expect(result.itemsWithVariance).toBe(2);
      expect(result.positiveVariance.count).toBe(1);
      expect(result.positiveVariance.units).toBe(5);
      expect(result.negativeVariance.count).toBe(1);
      expect(result.negativeVariance.units).toBe(5);
      expect(result.byCategory['Electronics']).toBeDefined();
      expect(result.topVariances).toHaveLength(2);
    });

    it('should throw error when session not found', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(
        physicalInventoryService.generateVarianceReport('non-existent')
      ).rejects.toThrow('Sessione non trovata');
    });
  });

  // =====================================
  // cancelSession Tests
  // =====================================
  describe('cancelSession', () => {
    it('should cancel session successfully', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS', notes: null };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountSession.update.mockResolvedValue({
        ...mockSession,
        status: 'CANCELLED',
      });

      const result = await physicalInventoryService.cancelSession('session-1', 'Not needed');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when session is COMPLETED', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'COMPLETED',
      });

      await expect(
        physicalInventoryService.cancelSession('session-1')
      ).rejects.toThrow('Non è possibile annullare una sessione completata');
    });

    it('should throw error when session not found', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(
        physicalInventoryService.cancelSession('non-existent')
      ).rejects.toThrow('Sessione non trovata');
    });
  });

  // =====================================
  // submitForReview Tests
  // =====================================
  describe('submitForReview', () => {
    it('should submit session for review', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'IN_PROGRESS',
        items: [
          { status: 'COUNTED' },
          { status: 'RECONCILED' },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountSession.update.mockResolvedValue({
        ...mockSession,
        status: 'PENDING_REVIEW',
      });

      const result = await physicalInventoryService.submitForReview('session-1');

      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('should throw error when uncounted items exist', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'IN_PROGRESS',
        items: [
          { status: 'COUNTED' },
          { status: 'NOT_COUNTED' },
        ],
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        physicalInventoryService.submitForReview('session-1')
      ).rejects.toThrow('Ci sono ancora 1 items non conteggiati');
    });

    it('should throw error when session is not IN_PROGRESS', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'DRAFT',
        items: [],
      });

      await expect(
        physicalInventoryService.submitForReview('session-1')
      ).rejects.toThrow('La sessione non è in corso');
    });
  });

  // =====================================
  // batchCount Tests
  // =====================================
  describe('batchCount', () => {
    it('should process batch count successfully', async () => {
      const mockSession = { id: 'session-1', status: 'IN_PROGRESS', requireDoubleCount: false };
      const mockItem = {
        id: 'item-1',
        sessionId: 'session-1',
        sku: 'SKU-001',
        expectedQuantity: 100,
        unitCost: 10,
      };

      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.physicalCountItem.findFirst.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.physicalCountItem.update.mockResolvedValue({ ...mockItem, status: 'RECONCILED' });
      mockPrisma.physicalCountItem.findMany.mockResolvedValue([]);
      mockPrisma.physicalCountSession.update.mockResolvedValue({});

      const counts = [
        { sku: 'SKU-001', quantity: 100 },
      ];

      const result = await physicalInventoryService.batchCount('session-1', counts, 'user-1');

      expect(result.success).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should track errors for invalid SKUs', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'IN_PROGRESS',
      });
      mockPrisma.physicalCountItem.findFirst.mockResolvedValue(null); // SKU not found

      const counts = [
        { sku: 'INVALID-SKU', quantity: 10 },
      ];

      const result = await physicalInventoryService.batchCount('session-1', counts, 'user-1');

      expect(result.success).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].sku).toBe('INVALID-SKU');
      expect(result.errors[0].error).toBe('SKU non trovato nella sessione');
    });

    it('should throw error when session is not valid', async () => {
      mockPrisma.physicalCountSession.findUnique.mockResolvedValue(null);

      await expect(
        physicalInventoryService.batchCount('invalid', [{ sku: 'SKU', quantity: 1 }], 'user-1')
      ).rejects.toThrow('Sessione non valida o non in corso');
    });
  });
});
