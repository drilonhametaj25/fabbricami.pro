/**
 * RMA Service Tests
 * Tests for Return Merchandise Authorization service
 */

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

// Mock inventory service
const mockInventoryService = {
  createMovement: jest.fn().mockResolvedValue({ id: 'mov-1' }),
};
jest.mock('@server/services/inventory.service', () => ({
  __esModule: true,
  inventoryService: mockInventoryService,
  default: mockInventoryService,
}));

// Mock Prisma
const mockPrisma = {
  rMA: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  rMAItem: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import { rmaService } from '@server/services/rma.service';

describe('RMA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================
  // list Tests
  // =====================================
  describe('list', () => {
    it('should return paginated RMA list with defaults', async () => {
      const mockRmas = [
        { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'REQUESTED' },
        { id: 'rma-2', rmaNumber: 'RMA-2026-00002', status: 'APPROVED' },
      ];

      mockPrisma.rMA.findMany.mockResolvedValue(mockRmas);
      mockPrisma.rMA.count.mockResolvedValue(2);

      const result = await rmaService.list({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.pages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.count.mockResolvedValue(0);

      await rmaService.list({ status: 'REQUESTED' });

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'REQUESTED',
          }),
        })
      );
    });

    it('should filter by customer', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.count.mockResolvedValue(0);

      await rmaService.list({ customerId: 'cust-1' });

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.count.mockResolvedValue(0);

      await rmaService.list({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestedAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.count.mockResolvedValue(0);

      await rmaService.list({ search: 'test' });

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rmaNumber: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should apply pagination', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.count.mockResolvedValue(100);

      const result = await rmaService.list({ page: 3, limit: 20 });

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
      expect(result.pages).toBe(5);
    });
  });

  // =====================================
  // getById Tests
  // =====================================
  describe('getById', () => {
    it('should return RMA with includes', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        customer: { id: 'cust-1', businessName: 'Test Customer' },
        order: { id: 'ord-1', orderNumber: 'ORD-001' },
        items: [{ id: 'item-1', productId: 'prod-1' }],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      const result = await rmaService.getById('rma-1');

      expect(result).toEqual(mockRma);
      expect(mockPrisma.rMA.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rma-1' },
          include: expect.objectContaining({
            customer: true,
            order: expect.any(Object),
            items: expect.any(Object),
          }),
        })
      );
    });

    it('should return null when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      const result = await rmaService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  // =====================================
  // getByNumber Tests
  // =====================================
  describe('getByNumber', () => {
    it('should return RMA by number with includes', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        customer: { id: 'cust-1' },
        order: { id: 'ord-1' },
        items: [],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      const result = await rmaService.getByNumber('RMA-2026-00001');

      expect(result).toEqual(mockRma);
      expect(mockPrisma.rMA.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rmaNumber: 'RMA-2026-00001' },
        })
      );
    });

    it('should return null when RMA number not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      const result = await rmaService.getByNumber('RMA-INVALID');

      expect(result).toBeNull();
    });
  });

  // =====================================
  // create Tests
  // =====================================
  describe('create', () => {
    const createInput = {
      orderId: 'ord-1',
      customerId: 'cust-1',
      reason: 'DEFECTIVE' as const,
      reasonDetail: 'Product not working',
      items: [
        {
          orderItemId: 'oi-1',
          productId: 'prod-1',
          sku: 'SKU-001',
          productName: 'Test Product',
          quantityRequested: 2,
          unitPrice: 100,
        },
      ],
    };

    it('should create RMA successfully', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: { email: 'test@test.com' },
        items: [{ id: 'oi-1', quantity: 5 }],
      };

      const mockCreatedRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        ...createInput,
        status: 'REQUESTED',
        customer: { id: 'cust-1' },
        order: mockOrder,
        items: [{ id: 'item-1', productId: 'prod-1' }],
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.rMA.findFirst.mockResolvedValue(null); // No existing RMA for year
      mockPrisma.rMA.create.mockResolvedValue(mockCreatedRma);

      const result = await rmaService.create(createInput);

      expect(result).toEqual(mockCreatedRma);
      expect(mockPrisma.rMA.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'ord-1',
            customerId: 'cust-1',
            status: 'REQUESTED',
            reason: 'DEFECTIVE',
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RMA creato'));
    });

    it('should generate sequential RMA number', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        customer: { email: 'test@test.com' },
        items: [{ id: 'oi-1', quantity: 5 }],
      };

      const lastRma = { rmaNumber: 'RMA-2026-00042' };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.rMA.findFirst.mockResolvedValue(lastRma);
      mockPrisma.rMA.create.mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-2026-00043' });

      await rmaService.create(createInput);

      expect(mockPrisma.rMA.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rmaNumber: 'RMA-2026-00043',
          }),
        })
      );
    });

    it('should throw error when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(rmaService.create(createInput)).rejects.toThrow('Ordine non trovato');
    });

    it('should throw error when customer does not match order', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'other-customer',
        items: [],
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(rmaService.create(createInput)).rejects.toThrow(
        'Il cliente non corrisponde all\'ordine'
      );
    });

    it('should throw error when order item not found', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        items: [], // No items
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(rmaService.create(createInput)).rejects.toThrow(
        'Item ordine oi-1 non trovato'
      );
    });

    it('should throw error when quantity exceeds ordered amount', async () => {
      const mockOrder = {
        id: 'ord-1',
        customerId: 'cust-1',
        items: [{ id: 'oi-1', quantity: 1 }], // Only 1 ordered, requesting 2
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(rmaService.create(createInput)).rejects.toThrow(
        'Quantità richiesta per SKU-001 superiore a quella ordinata'
      );
    });
  });

  // =====================================
  // approve Tests
  // =====================================
  describe('approve', () => {
    const approveInput = {
      approvedBy: 'user-1',
      returnShippingMethod: 'GLS',
      internalNotes: 'Approved for return',
    };

    it('should approve RMA from REQUESTED status', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'REQUESTED' };
      const updatedRma = { ...mockRma, status: 'APPROVED', approvedAt: new Date() };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue(updatedRma);
      mockPrisma.rMAItem.updateMany.mockResolvedValue({ count: 1 });

      const result = await rmaService.approve('rma-1', approveInput);

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedBy: 'user-1',
            approvedAt: expect.any(Date),
          }),
        })
      );
      expect(mockPrisma.rMAItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { itemStatus: 'APPROVED' },
        })
      );
    });

    it('should approve RMA from PENDING status', async () => {
      const mockRma = { id: 'rma-1', status: 'PENDING' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({ ...mockRma, status: 'APPROVED' });
      mockPrisma.rMAItem.updateMany.mockResolvedValue({ count: 1 });

      await rmaService.approve('rma-1', approveInput);

      expect(mockPrisma.rMA.update).toHaveBeenCalled();
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.approve('non-existent', approveInput)).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error when status is not REQUESTED or PENDING', async () => {
      const mockRma = { id: 'rma-1', status: 'COMPLETED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.approve('rma-1', approveInput)).rejects.toThrow(
        'Impossibile approvare RMA con stato COMPLETED'
      );
    });
  });

  // =====================================
  // reject Tests
  // =====================================
  describe('reject', () => {
    it('should reject RMA successfully', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'REQUESTED' };
      const updatedRma = { ...mockRma, status: 'REJECTED', rejectedAt: new Date() };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue(updatedRma);
      mockPrisma.rMAItem.updateMany.mockResolvedValue({ count: 1 });

      const result = await rmaService.reject('rma-1', 'user-1', 'Out of policy');

      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectedBy: 'user-1',
            resolutionNotes: 'Out of policy',
          }),
        })
      );
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.reject('non-existent', 'user-1')).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error when trying to reject COMPLETED RMA', async () => {
      const mockRma = { id: 'rma-1', status: 'COMPLETED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.reject('rma-1', 'user-1')).rejects.toThrow(
        'Impossibile rifiutare RMA con stato COMPLETED'
      );
    });

    it('should throw error when trying to reject already REJECTED RMA', async () => {
      const mockRma = { id: 'rma-1', status: 'REJECTED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.reject('rma-1', 'user-1')).rejects.toThrow(
        'Impossibile rifiutare RMA con stato REJECTED'
      );
    });
  });

  // =====================================
  // updateShipping Tests
  // =====================================
  describe('updateShipping', () => {
    it('should update shipping info successfully', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'APPROVED' };
      const updatedRma = {
        ...mockRma,
        status: 'SHIPPED',
        returnTrackingNumber: 'TRACK123',
        returnCarrier: 'GLS',
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue(updatedRma);

      const result = await rmaService.updateShipping('rma-1', 'TRACK123', 'GLS');

      expect(result.returnTrackingNumber).toBe('TRACK123');
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SHIPPED',
            returnTrackingNumber: 'TRACK123',
            returnCarrier: 'GLS',
            shippedByCustomerAt: expect.any(Date),
          }),
        })
      );
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.updateShipping('non-existent', 'TRACK123')).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error when status is not APPROVED', async () => {
      const mockRma = { id: 'rma-1', status: 'REQUESTED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.updateShipping('rma-1', 'TRACK123')).rejects.toThrow(
        'RMA deve essere approvato per aggiungere tracking'
      );
    });
  });

  // =====================================
  // receive Tests
  // =====================================
  describe('receive', () => {
    const receiveInput = {
      receivedBy: 'user-1',
      items: [
        {
          rmaItemId: 'item-1',
          quantityReceived: 2,
          condition: 'GOOD',
          conditionNotes: 'Minor scratches',
          canRestock: true,
        },
      ],
      inspectionNotes: 'All items received',
    };

    it('should receive items successfully', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        status: 'SHIPPED',
        items: [{ id: 'item-1', productId: 'prod-1' }],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMAItem.update.mockResolvedValue({});
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'RECEIVED',
        receivedAt: new Date(),
      });

      const result = await rmaService.receive('rma-1', receiveInput);

      expect(result.status).toBe('RECEIVED');
      expect(mockPrisma.rMAItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            quantityReceived: 2,
            condition: 'GOOD',
            canRestock: true,
            itemStatus: 'RECEIVED',
          }),
        })
      );
    });

    it('should accept from APPROVED status', async () => {
      const mockRma = {
        id: 'rma-1',
        status: 'APPROVED',
        items: [{ id: 'item-1' }],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMAItem.update.mockResolvedValue({});
      mockPrisma.rMA.update.mockResolvedValue({ ...mockRma, status: 'RECEIVED' });

      await rmaService.receive('rma-1', receiveInput);

      expect(mockPrisma.rMA.update).toHaveBeenCalled();
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.receive('non-existent', receiveInput)).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error when status is invalid', async () => {
      const mockRma = { id: 'rma-1', status: 'REQUESTED', items: [] };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.receive('rma-1', receiveInput)).rejects.toThrow(
        'Impossibile ricevere RMA con stato REQUESTED'
      );
    });

    it('should throw error when RMA item not found', async () => {
      const mockRma = {
        id: 'rma-1',
        status: 'SHIPPED',
        items: [], // No items
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.receive('rma-1', receiveInput)).rejects.toThrow(
        'Item RMA item-1 non trovato'
      );
    });
  });

  // =====================================
  // startInspection Tests
  // =====================================
  describe('startInspection', () => {
    it('should start inspection successfully', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'RECEIVED' };
      const updatedRma = { ...mockRma, status: 'INSPECTING', inspectedBy: 'user-1' };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue(updatedRma);

      const result = await rmaService.startInspection('rma-1', 'user-1');

      expect(result.status).toBe('INSPECTING');
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'INSPECTING',
            inspectedBy: 'user-1',
          }),
        })
      );
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.startInspection('non-existent', 'user-1')).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error when status is not RECEIVED', async () => {
      const mockRma = { id: 'rma-1', status: 'APPROVED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.startInspection('rma-1', 'user-1')).rejects.toThrow(
        'RMA deve essere ricevuto per iniziare l\'ispezione'
      );
    });
  });

  // =====================================
  // completeInspection Tests
  // =====================================
  describe('completeInspection', () => {
    it('should complete inspection successfully', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'INSPECTING' };
      const photos = [{ url: 'http://photo.jpg', description: 'Front view' }];

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        inspectedAt: new Date(),
        inspectionNotes: 'Good condition',
        itemCondition: 'GOOD',
        inspectionPhotos: photos,
      });

      const result = await rmaService.completeInspection(
        'rma-1',
        'user-1',
        'Good condition',
        'GOOD',
        photos
      );

      expect(result.inspectedAt).toBeDefined();
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inspectedAt: expect.any(Date),
            inspectedBy: 'user-1',
            inspectionNotes: 'Good condition',
            itemCondition: 'GOOD',
          }),
        })
      );
    });

    it('should complete inspection from RECEIVED status', async () => {
      const mockRma = { id: 'rma-1', status: 'RECEIVED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({ ...mockRma, inspectedAt: new Date() });

      await rmaService.completeInspection('rma-1', 'user-1', 'Notes', 'GOOD');

      expect(mockPrisma.rMA.update).toHaveBeenCalled();
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(
        rmaService.completeInspection('non-existent', 'user-1', 'Notes', 'GOOD')
      ).rejects.toThrow('RMA non trovato');
    });

    it('should throw error when status is invalid', async () => {
      const mockRma = { id: 'rma-1', status: 'APPROVED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(
        rmaService.completeInspection('rma-1', 'user-1', 'Notes', 'GOOD')
      ).rejects.toThrow('RMA deve essere in ispezione');
    });
  });

  // =====================================
  // complete Tests
  // =====================================
  describe('complete', () => {
    it('should complete with REFUND resolution', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        status: 'INSPECTING',
        items: [{ id: 'item-1', unitPrice: 100, quantityReceived: 2, quantityRequested: 2 }],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'COMPLETED',
        resolution: 'REFUND',
        refundAmount: 200,
      });

      const result = await rmaService.complete('rma-1', {
        completedBy: 'user-1',
        resolution: 'REFUND',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.resolution).toBe('REFUND');
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            resolution: 'REFUND',
            refundAmount: 200, // Calculated automatically
          }),
        })
      );
    });

    it('should complete with PARTIAL_REFUND at 80%', async () => {
      const mockRma = {
        id: 'rma-1',
        status: 'INSPECTING',
        items: [{ unitPrice: 100, quantityReceived: 1, quantityRequested: 1 }],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'COMPLETED',
        resolution: 'PARTIAL_REFUND',
        refundAmount: 80,
      });

      await rmaService.complete('rma-1', {
        completedBy: 'user-1',
        resolution: 'PARTIAL_REFUND',
      });

      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refundAmount: 80, // 100 * 0.8
          }),
        })
      );
    });

    it('should complete with EXCHANGE resolution', async () => {
      const mockRma = {
        id: 'rma-1',
        status: 'INSPECTING',
        items: [],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'COMPLETED',
        resolution: 'EXCHANGE',
        exchangeOrderId: 'new-ord-1',
      });

      const result = await rmaService.complete('rma-1', {
        completedBy: 'user-1',
        resolution: 'EXCHANGE',
        exchangeOrderId: 'new-ord-1',
      });

      expect(result.exchangeOrderId).toBe('new-ord-1');
    });

    it('should complete with STORE_CREDIT resolution', async () => {
      const mockRma = {
        id: 'rma-1',
        status: 'INSPECTING',
        items: [],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'COMPLETED',
        resolution: 'STORE_CREDIT',
        storeCreditCode: 'CREDIT-123',
      });

      const result = await rmaService.complete('rma-1', {
        completedBy: 'user-1',
        resolution: 'STORE_CREDIT',
        storeCreditCode: 'CREDIT-123',
      });

      expect(result.storeCreditCode).toBe('CREDIT-123');
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(
        rmaService.complete('non-existent', {
          completedBy: 'user-1',
          resolution: 'REFUND',
        })
      ).rejects.toThrow('RMA non trovato');
    });

    it('should throw error for COMPLETED status', async () => {
      const mockRma = { id: 'rma-1', status: 'COMPLETED', items: [] };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(
        rmaService.complete('rma-1', { completedBy: 'user-1', resolution: 'REFUND' })
      ).rejects.toThrow('Impossibile completare RMA con stato COMPLETED');
    });
  });

  // =====================================
  // restockItems Tests
  // =====================================
  describe('restockItems', () => {
    it('should restock items with canRestock=true', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            quantityReceived: 2,
            canRestock: true,
            quantityRestocked: null,
          },
        ],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMAItem.update.mockResolvedValue({});

      const result = await rmaService.restockItems('rma-1', 'WEB', 'user-1');

      expect(result.restockedItems).toHaveLength(1);
      expect(result.restockedItems[0].quantity).toBe(2);
      expect(mockInventoryService.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RETURN',
          productId: 'prod-1',
          quantity: 2,
          locationId: 'WEB',
          referenceType: 'RETURN',
        })
      );
      expect(mockPrisma.rMAItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantityRestocked: 2,
            itemStatus: 'RESTOCKED',
          }),
        })
      );
    });

    it('should skip items with canRestock=false', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        items: [
          { id: 'item-1', canRestock: false, quantityReceived: 2, quantityRestocked: null },
        ],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      const result = await rmaService.restockItems('rma-1', 'WEB', 'user-1');

      expect(result.restockedItems).toHaveLength(0);
      expect(mockInventoryService.createMovement).not.toHaveBeenCalled();
    });

    it('should skip already restocked items', async () => {
      const mockRma = {
        id: 'rma-1',
        rmaNumber: 'RMA-2026-00001',
        items: [
          { id: 'item-1', canRestock: true, quantityReceived: 2, quantityRestocked: 2 },
        ],
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      const result = await rmaService.restockItems('rma-1', 'WEB', 'user-1');

      expect(result.restockedItems).toHaveLength(0);
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.restockItems('non-existent', 'WEB', 'user-1')).rejects.toThrow(
        'RMA non trovato'
      );
    });
  });

  // =====================================
  // cancel Tests
  // =====================================
  describe('cancel', () => {
    it('should cancel RMA before receiving', async () => {
      const mockRma = { id: 'rma-1', rmaNumber: 'RMA-2026-00001', status: 'APPROVED' };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        status: 'CANCELLED',
        resolutionNotes: 'Customer changed mind',
      });

      const result = await rmaService.cancel('rma-1', 'user-1', 'Customer changed mind');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.cancel('non-existent', 'user-1')).rejects.toThrow(
        'RMA non trovato'
      );
    });

    it('should throw error for COMPLETED status', async () => {
      const mockRma = { id: 'rma-1', status: 'COMPLETED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.cancel('rma-1', 'user-1')).rejects.toThrow(
        'Impossibile annullare RMA con stato COMPLETED'
      );
    });

    it('should throw error for RECEIVED status', async () => {
      const mockRma = { id: 'rma-1', status: 'RECEIVED' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.cancel('rma-1', 'user-1')).rejects.toThrow(
        'Impossibile annullare RMA già ricevuto'
      );
    });

    it('should throw error for INSPECTING status', async () => {
      const mockRma = { id: 'rma-1', status: 'INSPECTING' };
      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);

      await expect(rmaService.cancel('rma-1', 'user-1')).rejects.toThrow(
        'Impossibile annullare RMA già ricevuto'
      );
    });
  });

  // =====================================
  // getStatistics Tests
  // =====================================
  describe('getStatistics', () => {
    it('should return comprehensive statistics', async () => {
      mockPrisma.rMA.count.mockResolvedValue(50);
      mockPrisma.rMA.groupBy
        .mockResolvedValueOnce([
          { status: 'COMPLETED', _count: { status: 30 } },
          { status: 'REQUESTED', _count: { status: 20 } },
        ])
        .mockResolvedValueOnce([
          { reason: 'DEFECTIVE', _count: { reason: 25 } },
          { reason: 'WRONG_ITEM', _count: { reason: 15 } },
        ])
        .mockResolvedValueOnce([
          { resolution: 'REFUND', _count: { resolution: 20 } },
          { resolution: 'EXCHANGE', _count: { resolution: 10 } },
        ]);

      const completedRmas = [
        { requestedAt: new Date('2026-01-01'), completedAt: new Date('2026-01-05') }, // 4 days
        { requestedAt: new Date('2026-01-10'), completedAt: new Date('2026-01-12') }, // 2 days
      ];
      mockPrisma.rMA.findMany.mockResolvedValue(completedRmas);
      mockPrisma.rMA.aggregate.mockResolvedValue({
        _sum: { refundAmount: 5000 },
        _avg: { refundAmount: 250 },
      });

      const result = await rmaService.getStatistics();

      expect(result.totalRmas).toBe(50);
      expect(result.byStatus).toHaveLength(2);
      expect(result.byReason).toHaveLength(2);
      expect(result.byResolution).toHaveLength(2);
      expect(result.avgProcessingDays).toBe(3); // (4+2)/2 = 3
      expect(result.totalRefunds).toBe(5000);
      expect(result.avgRefundAmount).toBe(250);
    });

    it('should filter by date range', async () => {
      mockPrisma.rMA.count.mockResolvedValue(10);
      mockPrisma.rMA.groupBy.mockResolvedValue([]);
      mockPrisma.rMA.findMany.mockResolvedValue([]);
      mockPrisma.rMA.aggregate.mockResolvedValue({ _sum: { refundAmount: null }, _avg: { refundAmount: null } });

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await rmaService.getStatistics(dateFrom, dateTo);

      expect(mockPrisma.rMA.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });
  });

  // =====================================
  // getRecent Tests
  // =====================================
  describe('getRecent', () => {
    it('should return recent non-completed RMAs', async () => {
      const mockRmas = [
        { id: 'rma-1', status: 'REQUESTED', customer: { businessName: 'Customer A' } },
        { id: 'rma-2', status: 'APPROVED', customer: { businessName: 'Customer B' } },
      ];

      mockPrisma.rMA.findMany.mockResolvedValue(mockRmas);

      const result = await rmaService.getRecent(10);

      expect(result).toHaveLength(2);
      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: ['REQUESTED', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'INSPECTING'],
            },
          },
          orderBy: { requestedAt: 'desc' },
          take: 10,
        })
      );
    });

    it('should use default limit of 10', async () => {
      mockPrisma.rMA.findMany.mockResolvedValue([]);

      await rmaService.getRecent();

      expect(mockPrisma.rMA.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  // =====================================
  // getPendingActions Tests
  // =====================================
  describe('getPendingActions', () => {
    it('should return counts by status bucket', async () => {
      mockPrisma.rMA.count
        .mockResolvedValueOnce(5) // awaitingApproval
        .mockResolvedValueOnce(3) // awaitingShipment
        .mockResolvedValueOnce(2) // awaitingReceipt
        .mockResolvedValueOnce(4) // awaitingInspection
        .mockResolvedValueOnce(1); // awaitingResolution

      const result = await rmaService.getPendingActions();

      expect(result.awaitingApproval).toBe(5);
      expect(result.awaitingShipment).toBe(3);
      expect(result.awaitingReceipt).toBe(2);
      expect(result.awaitingInspection).toBe(4);
      expect(result.awaitingResolution).toBe(1);
      expect(result.total).toBe(15);
    });
  });

  // =====================================
  // addInternalNote Tests
  // =====================================
  describe('addInternalNote', () => {
    it('should append timestamped note to existing notes', async () => {
      const mockRma = {
        id: 'rma-1',
        internalNotes: '[2026-01-01T10:00:00.000Z] Previous note',
      };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        internalNotes: expect.any(String),
      });

      await rmaService.addInternalNote('rma-1', 'New note');

      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            internalNotes: expect.stringContaining('Previous note'),
          },
        })
      );
      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            internalNotes: expect.stringContaining('New note'),
          },
        })
      );
    });

    it('should create first note when no existing notes', async () => {
      const mockRma = { id: 'rma-1', internalNotes: null };

      mockPrisma.rMA.findUnique.mockResolvedValue(mockRma);
      mockPrisma.rMA.update.mockResolvedValue({
        ...mockRma,
        internalNotes: 'New note',
      });

      await rmaService.addInternalNote('rma-1', 'New note');

      expect(mockPrisma.rMA.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            internalNotes: expect.stringContaining('New note'),
          },
        })
      );
    });

    it('should throw error when RMA not found', async () => {
      mockPrisma.rMA.findUnique.mockResolvedValue(null);

      await expect(rmaService.addInternalNote('non-existent', 'Note')).rejects.toThrow(
        'RMA non trovato'
      );
    });
  });
});
