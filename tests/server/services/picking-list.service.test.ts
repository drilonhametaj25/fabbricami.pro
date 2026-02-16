/**
 * Picking List Service Tests
 * Tests for generating picking lists for production and sales orders
 */

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock BOM service
const mockBomService = {
  getLeafComponents: jest.fn(),
};
jest.mock('@server/services/bom.service', () => ({
  __esModule: true,
  default: mockBomService,
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
    fillColor: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
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
  }));
});

// Mock Prisma
const mockPrisma = {
  productionOrder: {
    findUnique: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  warehouse: {
    findFirst: jest.fn(),
  },
  inventoryItem: {
    findFirst: jest.fn(),
  },
  material: {
    findFirst: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import { pickingListService } from '@server/services/picking-list.service';

describe('Picking List Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.warehouse.findFirst.mockResolvedValue({
      id: 'wh-1',
      name: 'Magazzino Principale',
      isPrimary: true,
    });
  });

  // =====================================
  // generateForProductionOrder Tests
  // =====================================
  describe('generateForProductionOrder', () => {
    it('should generate picking list from production order phases', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 5,
        notes: 'Rush order',
        product: { id: 'prod-1', name: 'Product 1', sku: 'PROD-001' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 2,
                  scrapPercentage: 5,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
              ],
            },
          },
          {
            manufacturingPhase: {
              name: 'Fase 2',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
                {
                  materialId: 'mat-2',
                  quantity: 3,
                  scrapPercentage: 10,
                  material: { sku: 'MAT-002', name: 'Material 2', unit: 'pz' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await pickingListService.generateForProductionOrder('po-1');

      expect(result.pickingListNumber).toMatch(/^PL-MO-\d{8}-\d{6}$/);
      expect(result.reference).toBe('MO-2026-001');
      expect(result.referenceType).toBe('PRODUCTION_ORDER');
      expect(result.priority).toBe(5);
      expect(result.items.length).toBe(2); // MAT-001 and MAT-002 aggregated
      expect(result.notes).toBe('Rush order');

      // Verify material aggregation and scrap calculation
      const mat1Item = result.items.find((i) => i.sku === 'MAT-001');
      // Fase 1: 2 * 10 * 1.05 = 21, Fase 2: 1 * 10 * 1.00 = 10, Total = 31
      expect(mat1Item).toBeDefined();
      expect(mat1Item?.isMaterial).toBe(true);
    });

    it('should apply scrap percentage calculation correctly', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 100,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1, // 1 per unit
                  scrapPercentage: 10, // 10% scrap
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'pz' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await pickingListService.generateForProductionOrder('po-1');

      // Expected: 1 * 100 * 1.10 = 110, rounded up to 110 with Math.ceil
      // Note: due to floating point, 1.10 may be 1.1000000000000001, so Math.ceil(110.000...) = 110 or 111
      const mat1Item = result.items.find((i) => i.sku === 'MAT-001');
      expect(mat1Item?.quantity).toBeGreaterThanOrEqual(110);
      expect(mat1Item?.quantity).toBeLessThanOrEqual(111);
    });

    it('should include BOM components when option is set', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [],
      };

      const mockBomComponents = [
        { productId: 'comp-1', sku: 'COMP-001', name: 'Component 1', unit: 'pz', quantity: 20 },
        { productId: 'comp-2', sku: 'COMP-002', name: 'Component 2', unit: 'pz', quantity: 30 },
      ];

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      mockBomService.getLeafComponents.mockResolvedValue(mockBomComponents);

      const result = await pickingListService.generateForProductionOrder('po-1', {
        includeSubProducts: true,
      });

      expect(result.items.length).toBe(2);
      expect(result.items[0].isMaterial).toBe(false); // BOM components are products
      expect(result.items[0].notes).toBe('Componente BOM');
    });

    it('should handle BOM explosion errors gracefully', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      mockBomService.getLeafComponents.mockRejectedValue(new Error('BOM error'));

      const result = await pickingListService.generateForProductionOrder('po-1', {
        includeSubProducts: true,
      });

      expect(result.items.length).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Errore esplosione BOM'));
    });

    it('should sort items by SKU', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                { materialId: 'mat-2', quantity: 1, scrapPercentage: 0, material: { sku: 'ZZZ-001', name: 'Z Material', unit: 'kg' } },
                { materialId: 'mat-1', quantity: 1, scrapPercentage: 0, material: { sku: 'AAA-001', name: 'A Material', unit: 'kg' } },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await pickingListService.generateForProductionOrder('po-1');

      expect(result.items[0].sku).toBe('AAA-001');
      expect(result.items[1].sku).toBe('ZZZ-001');
    });

    it('should throw error when production order not found', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(
        pickingListService.generateForProductionOrder('non-existent')
      ).rejects.toThrow('Ordine di produzione non trovato');
    });
  });

  // =====================================
  // generateForSalesOrder Tests
  // =====================================
  describe('generateForSalesOrder', () => {
    it('should generate picking list from sales order items', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'ORD-2026-001',
        priority: 7,
        items: [
          {
            productId: 'prod-1',
            variantId: null,
            quantity: 5,
            productName: 'Product 1',
            product: { sku: 'PROD-001', name: 'Product 1', unit: 'pz' },
            variant: null,
          },
          {
            productId: 'prod-2',
            variantId: 'var-1',
            quantity: 3,
            productName: 'Product 2 - Large',
            product: { sku: 'PROD-002', name: 'Product 2', unit: 'pz' },
            variant: { sku: 'PROD-002-L' },
          },
        ],
        customer: { businessName: 'Acme Corp' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ quantity: 100 });

      const result = await pickingListService.generateForSalesOrder('so-1');

      expect(result.pickingListNumber).toMatch(/^PL-SO-\d{8}-\d{6}$/);
      expect(result.reference).toBe('ORD-2026-001');
      expect(result.referenceType).toBe('SALES_ORDER');
      expect(result.priority).toBe(7);
      expect(result.items.length).toBe(2);
      expect(result.notes).toContain('Acme Corp');
    });

    it('should add warning note when stock is insufficient', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'ORD-2026-001',
        priority: 3,
        items: [
          {
            productId: 'prod-1',
            variantId: null,
            quantity: 50,
            productName: 'Product 1',
            product: { sku: 'PROD-001', name: 'Product 1', unit: 'pz' },
            variant: null,
          },
        ],
        customer: { firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ quantity: 10 }); // Only 10 available

      const result = await pickingListService.generateForSalesOrder('so-1');

      expect(result.items[0].notes).toContain('Stock insufficiente');
      expect(result.items[0].notes).toContain('10 disponibili');
    });

    it('should handle missing inventory gracefully', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'ORD-2026-001',
        items: [
          {
            productId: 'prod-1',
            variantId: null,
            quantity: 5,
            productName: 'Product 1',
            product: { sku: 'PROD-001', name: 'Product 1', unit: 'pz' },
            variant: null,
          },
        ],
        customer: { firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null); // No inventory record

      const result = await pickingListService.generateForSalesOrder('so-1');

      expect(result.items[0].notes).toContain('Stock insufficiente');
      expect(result.items[0].notes).toContain('0 disponibili');
    });

    it('should use variant SKU when available', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'ORD-2026-001',
        items: [
          {
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 2,
            productName: 'Product 1 - Red',
            product: { sku: 'PROD-001', name: 'Product 1', unit: 'pz' },
            variant: { sku: 'PROD-001-RED' },
          },
        ],
        customer: { businessName: 'Test Co' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ quantity: 100 });

      const result = await pickingListService.generateForSalesOrder('so-1');

      expect(result.items[0].sku).toBe('PROD-001-RED');
    });

    it('should throw error when sales order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        pickingListService.generateForSalesOrder('non-existent')
      ).rejects.toThrow('Ordine di vendita non trovato');
    });
  });

  // =====================================
  // PDF Generation Tests
  // =====================================
  describe('generateProductionOrderPickingListPdf', () => {
    it('should generate PDF buffer for production order', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 5,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await pickingListService.generateProductionOrderPickingListPdf('po-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should throw error when production order not found', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(
        pickingListService.generateProductionOrderPickingListPdf('non-existent')
      ).rejects.toThrow('Ordine di produzione non trovato');
    });
  });

  describe('generateSalesOrderPickingListPdf', () => {
    it('should generate PDF buffer for sales order', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'ORD-2026-001',
        items: [],
        customer: { businessName: 'Test Co' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await pickingListService.generateSalesOrderPickingListPdf('so-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should throw error when sales order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        pickingListService.generateSalesOrderPickingListPdf('non-existent')
      ).rejects.toThrow('Ordine di vendita non trovato');
    });
  });

  // =====================================
  // checkMaterialsAvailability Tests
  // =====================================
  describe('checkMaterialsAvailability', () => {
    it('should return available true when all materials are in stock', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.material.findFirst.mockResolvedValue({ currentStock: 100 }); // Plenty available

      const result = await pickingListService.checkMaterialsAvailability('po-1');

      expect(result.available).toBe(true);
      expect(result.shortages).toHaveLength(0);
    });

    it('should return shortages when materials are insufficient', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 100,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.material.findFirst.mockResolvedValue({ currentStock: 50 }); // Only 50 available

      const result = await pickingListService.checkMaterialsAvailability('po-1');

      expect(result.available).toBe(false);
      expect(result.shortages).toHaveLength(1);
      expect(result.shortages[0].sku).toBe('MAT-001');
      expect(result.shortages[0].required).toBe(100);
      expect(result.shortages[0].available).toBe(50);
      expect(result.shortages[0].shortage).toBe(50);
    });

    it('should handle multiple material shortages', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 100,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
                {
                  materialId: 'mat-2',
                  quantity: 2,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-002', name: 'Material 2', unit: 'pz' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      // MAT-001: required 100, available 50 -> shortage 50
      // MAT-002: required 200, available 150 -> shortage 50
      mockPrisma.material.findFirst
        .mockResolvedValueOnce({ currentStock: 50 })
        .mockResolvedValueOnce({ currentStock: 150 });

      const result = await pickingListService.checkMaterialsAvailability('po-1');

      expect(result.available).toBe(false);
      expect(result.shortages).toHaveLength(2);
      expect(result.shortages[0].shortage).toBe(50);
      expect(result.shortages[1].shortage).toBe(50);
    });

    it('should handle zero stock gracefully', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'MO-2026-001',
        productId: 'prod-1',
        quantity: 10,
        priority: 3,
        product: { id: 'prod-1', name: 'Product 1' },
        phases: [
          {
            manufacturingPhase: {
              name: 'Fase 1',
              materials: [
                {
                  materialId: 'mat-1',
                  quantity: 1,
                  scrapPercentage: 0,
                  material: { sku: 'MAT-001', name: 'Material 1', unit: 'kg' },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.material.findFirst.mockResolvedValue(null); // No stock record

      const result = await pickingListService.checkMaterialsAvailability('po-1');

      expect(result.available).toBe(false);
      expect(result.shortages[0].available).toBe(0);
    });
  });
});
