import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, NotificationType, UserRole } from '@prisma/client';

// Create mock instances
const prismaMock = mockDeep<PrismaClient>();

const mockNotificationService = {
  notifyRoles: jest.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock dependencies
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

import alertService, { AlertService, StockAlert, StockAlertType } from '@server/services/alert.service';

describe('AlertService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // ==================== checkAllStockAlerts ====================
  describe('checkAllStockAlerts', () => {
    it('should return empty alerts when no products or materials exist', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(0);
      expect(result.productsChecked).toBe(0);
      expect(result.materialsChecked).toBe(0);
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should detect OUT_OF_STOCK for products with zero inventory', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 0,
          inventory: [
            { quantity: 0, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'OUT_OF_STOCK',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Product 1',
        sku: 'SKU001',
        currentValue: 0,
        thresholdValue: 10,
      });
    });

    it('should detect OUT_OF_STOCK when reserved quantity equals available', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 5,
          maxStock: null,
          reorderPoint: 0,
          inventory: [
            { quantity: 10, reservedQuantity: 10 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('OUT_OF_STOCK');
    });

    it('should detect LOW_STOCK for products below minimum level', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 20,
          maxStock: null,
          reorderPoint: 0,
          inventory: [
            { quantity: 15, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'LOW_STOCK',
        entityType: 'product',
        currentValue: 15,
        thresholdValue: 20,
      });
    });

    it('should detect OVERSTOCK for products above maximum level', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 5,
          maxStock: 50,
          reorderPoint: 0,
          inventory: [
            { quantity: 100, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'OVERSTOCK',
        entityType: 'product',
        currentValue: 100,
        thresholdValue: 50,
      });
    });

    it('should detect REORDER_POINT when stock at reorder level', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 5,
          maxStock: null,
          reorderPoint: 15,
          inventory: [
            { quantity: 12, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'REORDER_POINT',
        entityType: 'product',
        currentValue: 12,
        thresholdValue: 15,
      });
    });

    it('should not trigger REORDER_POINT when stock is below minStockLevel', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 15,
          inventory: [
            { quantity: 8, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      // Should only trigger LOW_STOCK, not REORDER_POINT
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('LOW_STOCK');
    });

    it('should detect OUT_OF_STOCK for materials', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'Material 1',
          sku: 'MAT001',
          minStock: 10,
          reorderPoint: 0,
          inventoryItems: [
            { quantity: 0, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'OUT_OF_STOCK',
        entityType: 'material',
        entityId: 'mat-1',
      });
    });

    it('should detect MATERIAL_SHORTAGE for materials below minimum', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'Material 1',
          sku: 'MAT001',
          minStock: 20,
          reorderPoint: 0,
          inventoryItems: [
            { quantity: 10, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('MATERIAL_SHORTAGE');
    });

    it('should detect REORDER_POINT for materials', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'Material 1',
          sku: 'MAT001',
          minStock: 5,
          reorderPoint: 15,
          inventoryItems: [
            { quantity: 10, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'REORDER_POINT',
        entityType: 'material',
      });
    });

    it('should detect EXPIRING_SOON for product inventory items', async () => {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 15); // 15 days from now

      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          productId: 'prod-1',
          lotNumber: 'LOT001',
          expiryDate,
          quantity: 50,
          product: {
            id: 'prod-1',
            name: 'Expiring Product',
            sku: 'SKU001',
          },
        } as any,
      ]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'EXPIRING_SOON',
        entityType: 'product',
        entityId: 'prod-1',
        lotNumber: 'LOT001',
        quantity: 50,
      });
    });

    it('should detect EXPIRING_SOON for material inventory items', async () => {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now

      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([
        {
          materialId: 'mat-1',
          lotNumber: 'LOT002',
          expiryDate,
          quantity: 100,
          material: {
            id: 'mat-1',
            name: 'Expiring Material',
            sku: 'MAT001',
          },
        } as any,
      ]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'EXPIRING_SOON',
        entityType: 'material',
        entityId: 'mat-1',
        lotNumber: 'LOT002',
      });
    });

    it('should aggregate stock across multiple inventory locations', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 50,
          maxStock: null,
          reorderPoint: 0,
          inventory: [
            { quantity: 20, reservedQuantity: 5 },
            { quantity: 15, reservedQuantity: 0 },
            { quantity: 10, reservedQuantity: 5 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      // Total: (20-5) + (15-0) + (10-5) = 35, which is < 50 minStockLevel
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('LOW_STOCK');
      expect(result.alerts[0].currentValue).toBe(35);
    });

    it('should handle multiple alert types for same product', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU001',
          isActive: true,
          minStockLevel: 0,
          maxStock: 50,
          reorderPoint: 0,
          inventory: [
            { quantity: 100, reservedQuantity: 0 },
          ],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      // Only OVERSTOCK since minStockLevel is 0
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('OVERSTOCK');
    });

    it('should return correct counts for checked items', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'P1', sku: 'S1', isActive: true, minStockLevel: 0, maxStock: null, reorderPoint: 0, inventory: [] } as any,
        { id: 'prod-2', name: 'P2', sku: 'S2', isActive: true, minStockLevel: 0, maxStock: null, reorderPoint: 0, inventory: [] } as any,
        { id: 'prod-3', name: 'P3', sku: 'S3', isActive: true, minStockLevel: 0, maxStock: null, reorderPoint: 0, inventory: [] } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([
        { id: 'mat-1', name: 'M1', sku: 'M1', minStock: 0, reorderPoint: 0, inventoryItems: [] } as any,
        { id: 'mat-2', name: 'M2', sku: 'M2', minStock: 0, reorderPoint: 0, inventoryItems: [] } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.checkAllStockAlerts();

      expect(result.productsChecked).toBe(3);
      expect(result.materialsChecked).toBe(2);
    });
  });

  // ==================== sendAlertNotifications ====================
  describe('sendAlertNotifications', () => {
    it('should send notifications for each alert', async () => {
      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
        {
          type: 'OUT_OF_STOCK',
          entityType: 'product',
          entityId: 'prod-2',
          entityName: 'Product 2',
          sku: 'SKU002',
          currentValue: 0,
          thresholdValue: 5,
        },
      ];

      const result = await alertService.sendAlertNotifications(alerts);

      expect(result).toBe(2);
      expect(mockNotificationService.notifyRoles).toHaveBeenCalledTimes(2);
    });

    it('should call notifyRoles with correct roles', async () => {
      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
      ];

      await alertService.sendAlertNotifications(alerts);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        ['MAGAZZINIERE', 'ADMIN', 'MANAGER'],
        expect.objectContaining({
          type: 'LOW_STOCK',
          title: 'Scorta Minima Raggiunta',
        })
      );
    });

    it('should include correct link in notification', async () => {
      const alerts: StockAlert[] = [
        {
          type: 'MATERIAL_SHORTAGE',
          entityType: 'material',
          entityId: 'mat-1',
          entityName: 'Material 1',
          sku: 'MAT001',
          currentValue: 2,
          thresholdValue: 10,
        },
      ];

      await alertService.sendAlertNotifications(alerts);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          link: '/materials/mat-1',
        })
      );
    });

    it('should log success for each sent notification', async () => {
      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
      ];

      await alertService.sendAlertNotifications(alerts);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sent alert notification: LOW_STOCK for Product 1')
      );
    });

    it('should handle notification errors and continue', async () => {
      mockNotificationService.notifyRoles
        .mockRejectedValueOnce(new Error('Notification failed'))
        .mockResolvedValueOnce(undefined);

      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
        {
          type: 'OUT_OF_STOCK',
          entityType: 'product',
          entityId: 'prod-2',
          entityName: 'Product 2',
          sku: 'SKU002',
          currentValue: 0,
          thresholdValue: 5,
        },
      ];

      const result = await alertService.sendAlertNotifications(alerts);

      expect(result).toBe(1); // Only second succeeded
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send alert notification')
      );
    });

    it('should return 0 for empty alerts array', async () => {
      const result = await alertService.sendAlertNotifications([]);

      expect(result).toBe(0);
      expect(mockNotificationService.notifyRoles).not.toHaveBeenCalled();
    });
  });

  // ==================== mapAlertToNotificationType (via sendAlertNotifications) ====================
  describe('mapAlertToNotificationType', () => {
    const testCases: Array<{ alertType: StockAlertType; expectedNotificationType: NotificationType }> = [
      { alertType: 'LOW_STOCK', expectedNotificationType: 'LOW_STOCK' },
      { alertType: 'OUT_OF_STOCK', expectedNotificationType: 'LOW_STOCK' },
      { alertType: 'OVERSTOCK', expectedNotificationType: 'LOW_STOCK' },
      { alertType: 'REORDER_POINT', expectedNotificationType: 'LOW_STOCK' },
      { alertType: 'EXPIRING_SOON', expectedNotificationType: 'LOW_STOCK' },
      { alertType: 'MATERIAL_SHORTAGE', expectedNotificationType: 'MATERIAL_SHORTAGE' },
    ];

    testCases.forEach(({ alertType, expectedNotificationType }) => {
      it(`should map ${alertType} to ${expectedNotificationType}`, async () => {
        const alert: StockAlert = {
          type: alertType,
          entityType: 'product',
          entityId: 'test-id',
          entityName: 'Test',
          sku: 'TEST',
          currentValue: 0,
          thresholdValue: 10,
        };

        await alertService.sendAlertNotifications([alert]);

        expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            type: expectedNotificationType,
          })
        );
      });
    });
  });

  // ==================== getAlertTitle (via sendAlertNotifications) ====================
  describe('getAlertTitle', () => {
    const titleTestCases: Array<{ alertType: StockAlertType; expectedTitle: string }> = [
      { alertType: 'LOW_STOCK', expectedTitle: 'Scorta Minima Raggiunta' },
      { alertType: 'OUT_OF_STOCK', expectedTitle: 'Prodotto Esaurito' },
      { alertType: 'OVERSTOCK', expectedTitle: 'Sovrastock Rilevato' },
      { alertType: 'REORDER_POINT', expectedTitle: 'Punto di Riordino Raggiunto' },
      { alertType: 'EXPIRING_SOON', expectedTitle: 'Lotto in Scadenza' },
      { alertType: 'MATERIAL_SHORTAGE', expectedTitle: 'Materiale Sotto Scorta' },
    ];

    titleTestCases.forEach(({ alertType, expectedTitle }) => {
      it(`should return correct title for ${alertType}`, async () => {
        const alert: StockAlert = {
          type: alertType,
          entityType: 'product',
          entityId: 'test-id',
          entityName: 'Test',
          sku: 'TEST',
          currentValue: 0,
          thresholdValue: 10,
        };

        await alertService.sendAlertNotifications([alert]);

        expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            title: expectedTitle,
          })
        );
      });
    });
  });

  // ==================== buildAlertMessage (via sendAlertNotifications) ====================
  describe('buildAlertMessage', () => {
    it('should build correct message for OUT_OF_STOCK', async () => {
      const alert: StockAlert = {
        type: 'OUT_OF_STOCK',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 0,
        thresholdValue: 10,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('Prodotto "Test Product" (SKU001) e\' esaurito'),
        })
      );
    });

    it('should build correct message for LOW_STOCK', async () => {
      const alert: StockAlert = {
        type: 'LOW_STOCK',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 5,
        thresholdValue: 10,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('sotto scorta minima: 5 unita\''),
        })
      );
    });

    it('should build correct message for MATERIAL_SHORTAGE', async () => {
      const alert: StockAlert = {
        type: 'MATERIAL_SHORTAGE',
        entityType: 'material',
        entityId: 'mat-1',
        entityName: 'Test Material',
        sku: 'MAT001',
        currentValue: 3,
        thresholdValue: 20,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('Materiale "Test Material" (MAT001) sotto scorta minima'),
        })
      );
    });

    it('should build correct message for OVERSTOCK', async () => {
      const alert: StockAlert = {
        type: 'OVERSTOCK',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 100,
        thresholdValue: 50,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('in sovrastock: 100 unita\' (massimo: 50)'),
        })
      );
    });

    it('should build correct message for REORDER_POINT', async () => {
      const alert: StockAlert = {
        type: 'REORDER_POINT',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 12,
        thresholdValue: 15,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('ha raggiunto il punto di riordino: 12 unita\''),
        })
      );
    });

    it('should build correct message for EXPIRING_SOON', async () => {
      const expiryDate = new Date('2024-12-25');
      const alert: StockAlert = {
        type: 'EXPIRING_SOON',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 50,
        thresholdValue: 0,
        lotNumber: 'LOT001',
        expiryDate,
        quantity: 50,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('Lotto LOT001 di "Test Product"'),
        })
      );
    });

    it('should handle missing lot number in EXPIRING_SOON message', async () => {
      const expiryDate = new Date('2024-12-25');
      const alert: StockAlert = {
        type: 'EXPIRING_SOON',
        entityType: 'product',
        entityId: 'prod-1',
        entityName: 'Test Product',
        sku: 'SKU001',
        currentValue: 50,
        thresholdValue: 0,
        lotNumber: null,
        expiryDate,
        quantity: 50,
      };

      await alertService.sendAlertNotifications([alert]);

      expect(mockNotificationService.notifyRoles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: expect.stringContaining('Lotto N/A di "Test Product"'),
        })
      );
    });
  });

  // ==================== filterRecentAlerts ====================
  describe('filterRecentAlerts', () => {
    it('should return all alerts when no recent notifications exist', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
      ];

      const result = await alertService.filterRecentAlerts(alerts);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('prod-1');
    });

    it('should filter out alerts with recent notifications matching SKU', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        {
          message: 'Alert for product (SKU001) something',
        } as any,
      ]);

      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-2',
          entityName: 'Product 2',
          sku: 'SKU002',
          currentValue: 3,
          thresholdValue: 10,
        },
      ];

      const result = await alertService.filterRecentAlerts(alerts);

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe('SKU002');
    });

    it('should return all alerts on database error', async () => {
      prismaMock.notification.findMany.mockRejectedValue(new Error('DB error'));

      const alerts: StockAlert[] = [
        {
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: 'prod-1',
          entityName: 'Product 1',
          sku: 'SKU001',
          currentValue: 5,
          thresholdValue: 10,
        },
      ];

      const result = await alertService.filterRecentAlerts(alerts);

      expect(result).toHaveLength(1);
    });

    it('should use 24 hour window for filtering', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await alertService.filterRecentAlerts([]);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          type: { in: ['LOW_STOCK', 'MATERIAL_SHORTAGE'] },
        },
        select: {
          message: true,
        },
      });
    });
  });

  // ==================== checkProductStock ====================
  describe('checkProductStock', () => {
    it('should return null when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const result = await alertService.checkProductStock('non-existent');

      expect(result).toBeNull();
    });

    it('should return OUT_OF_STOCK when stock is zero', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU001',
        minStockLevel: 10,
        reorderPoint: 0,
        inventory: [
          { quantity: 0, reservedQuantity: 0 },
        ],
      } as any);

      const result = await alertService.checkProductStock('prod-1');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('OUT_OF_STOCK');
      expect(result?.currentValue).toBe(0);
    });

    it('should return LOW_STOCK when below minimum', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU001',
        minStockLevel: 20,
        reorderPoint: 0,
        inventory: [
          { quantity: 15, reservedQuantity: 0 },
        ],
      } as any);

      const result = await alertService.checkProductStock('prod-1');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('LOW_STOCK');
      expect(result?.currentValue).toBe(15);
    });

    it('should return REORDER_POINT when at reorder level', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU001',
        minStockLevel: 5,
        reorderPoint: 15,
        inventory: [
          { quantity: 12, reservedQuantity: 0 },
        ],
      } as any);

      const result = await alertService.checkProductStock('prod-1');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('REORDER_POINT');
    });

    it('should return null when stock is OK', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU001',
        minStockLevel: 10,
        reorderPoint: 15,
        inventory: [
          { quantity: 100, reservedQuantity: 0 },
        ],
      } as any);

      const result = await alertService.checkProductStock('prod-1');

      expect(result).toBeNull();
    });

    it('should account for reserved quantity', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU001',
        minStockLevel: 10,
        reorderPoint: 0,
        inventory: [
          { quantity: 20, reservedQuantity: 15 },
        ],
      } as any);

      const result = await alertService.checkProductStock('prod-1');

      // Available = 20 - 15 = 5, which is < 10 minStockLevel
      expect(result).not.toBeNull();
      expect(result?.type).toBe('LOW_STOCK');
      expect(result?.currentValue).toBe(5);
    });
  });

  // ==================== getAlertStats ====================
  describe('getAlertStats', () => {
    it('should return stats with zero counts when no alerts', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.material.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.getAlertStats();

      expect(result.totalAlerts).toBe(0);
      expect(result.byType).toEqual({
        LOW_STOCK: 0,
        OUT_OF_STOCK: 0,
        OVERSTOCK: 0,
        REORDER_POINT: 0,
        EXPIRING_SOON: 0,
        MATERIAL_SHORTAGE: 0,
      });
      expect(result.byEntityType).toEqual({
        product: 0,
        material: 0,
      });
    });

    it('should aggregate alerts by type', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'P1',
          sku: 'S1',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 0,
          inventory: [{ quantity: 5, reservedQuantity: 0 }],
        } as any,
        {
          id: 'prod-2',
          name: 'P2',
          sku: 'S2',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 0,
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'M1',
          sku: 'M1',
          minStock: 10,
          reorderPoint: 0,
          inventoryItems: [{ quantity: 5, reservedQuantity: 0 }],
        } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.getAlertStats();

      expect(result.totalAlerts).toBe(3);
      expect(result.byType.LOW_STOCK).toBe(1);
      expect(result.byType.OUT_OF_STOCK).toBe(1);
      expect(result.byType.MATERIAL_SHORTAGE).toBe(1);
    });

    it('should aggregate alerts by entity type', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'P1',
          sku: 'S1',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 0,
          inventory: [{ quantity: 5, reservedQuantity: 0 }],
        } as any,
        {
          id: 'prod-2',
          name: 'P2',
          sku: 'S2',
          isActive: true,
          minStockLevel: 10,
          maxStock: null,
          reorderPoint: 0,
          inventory: [{ quantity: 3, reservedQuantity: 0 }],
        } as any,
      ]);
      prismaMock.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'M1',
          sku: 'M1',
          minStock: 10,
          reorderPoint: 0,
          inventoryItems: [{ quantity: 5, reservedQuantity: 0 }],
        } as any,
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.materialInventory.findMany.mockResolvedValue([]);

      const result = await alertService.getAlertStats();

      expect(result.byEntityType.product).toBe(2);
      expect(result.byEntityType.material).toBe(1);
    });
  });
});
