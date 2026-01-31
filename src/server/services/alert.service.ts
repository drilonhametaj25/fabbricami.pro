import { prisma } from '../config/database';
import { NotificationType, UserRole } from '@prisma/client';
import notificationService from './notification.service';
import logger from '../config/logger';

/**
 * Tipo di alert per stock
 */
export type StockAlertType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'OVERSTOCK'
  | 'REORDER_POINT'
  | 'EXPIRING_SOON'
  | 'MATERIAL_SHORTAGE';

/**
 * Alert generato dal check
 */
export interface StockAlert {
  type: StockAlertType;
  entityType: 'product' | 'material';
  entityId: string;
  entityName: string;
  sku?: string;
  currentValue: number;
  thresholdValue: number;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  quantity?: number;
}

/**
 * Risultato del check alert
 */
export interface AlertCheckResult {
  alerts: StockAlert[];
  checkedAt: Date;
  productsChecked: number;
  materialsChecked: number;
}

/**
 * Alert Service
 * Sistema di alert automatici per scorte prodotti e materiali
 */
class AlertService {
  /**
   * Check completo di tutti gli alert per prodotti e materiali
   */
  async checkAllStockAlerts(): Promise<AlertCheckResult> {
    const alerts: StockAlert[] = [];
    let productsChecked = 0;
    let materialsChecked = 0;

    // 1. Check prodotti
    const productsWithInventory = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventory: true,
      },
    });

    productsChecked = productsWithInventory.length;

    for (const product of productsWithInventory) {
      const totalStock = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0
      );

      // OUT_OF_STOCK
      if (totalStock <= 0) {
        alerts.push({
          type: 'OUT_OF_STOCK',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          sku: product.sku,
          currentValue: 0,
          thresholdValue: product.minStockLevel,
        });
      }
      // LOW_STOCK
      else if (totalStock <= product.minStockLevel && product.minStockLevel > 0) {
        alerts.push({
          type: 'LOW_STOCK',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          sku: product.sku,
          currentValue: totalStock,
          thresholdValue: product.minStockLevel,
        });
      }

      // OVERSTOCK
      if (product.maxStock && totalStock > product.maxStock) {
        alerts.push({
          type: 'OVERSTOCK',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          sku: product.sku,
          currentValue: totalStock,
          thresholdValue: product.maxStock,
        });
      }

      // REORDER_POINT
      if (
        product.reorderPoint > 0 &&
        totalStock <= product.reorderPoint &&
        totalStock > 0 &&
        totalStock > product.minStockLevel
      ) {
        alerts.push({
          type: 'REORDER_POINT',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          sku: product.sku,
          currentValue: totalStock,
          thresholdValue: product.reorderPoint,
        });
      }
    }

    // 2. Check materiali
    const materials = await prisma.material.findMany({
      include: {
        inventoryItems: true,
      },
    });

    materialsChecked = materials.length;

    for (const material of materials) {
      const totalStock = material.inventoryItems.reduce(
        (sum: number, inv: any) => sum + inv.quantity - inv.reservedQuantity,
        0
      );

      // OUT_OF_STOCK
      if (totalStock <= 0) {
        alerts.push({
          type: 'OUT_OF_STOCK',
          entityType: 'material',
          entityId: material.id,
          entityName: material.name,
          sku: material.sku,
          currentValue: 0,
          thresholdValue: material.minStock,
        });
      }
      // LOW_STOCK / MATERIAL_SHORTAGE
      else if (totalStock <= material.minStock && material.minStock > 0) {
        alerts.push({
          type: 'MATERIAL_SHORTAGE',
          entityType: 'material',
          entityId: material.id,
          entityName: material.name,
          sku: material.sku,
          currentValue: totalStock,
          thresholdValue: material.minStock,
        });
      }

      // REORDER_POINT
      if (
        material.reorderPoint > 0 &&
        totalStock <= material.reorderPoint &&
        totalStock > 0 &&
        totalStock > material.minStock
      ) {
        alerts.push({
          type: 'REORDER_POINT',
          entityType: 'material',
          entityId: material.id,
          entityName: material.name,
          sku: material.sku,
          currentValue: totalStock,
          thresholdValue: material.reorderPoint,
        });
      }
    }

    // 3. Check lotti in scadenza (prodotti)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringProducts = await prisma.inventoryItem.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
        quantity: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    for (const item of expiringProducts) {
      alerts.push({
        type: 'EXPIRING_SOON',
        entityType: 'product',
        entityId: item.productId,
        entityName: item.product.name,
        sku: item.product.sku,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        currentValue: item.quantity,
        thresholdValue: 0,
      });
    }

    // 4. Check lotti in scadenza (materiali)
    const expiringMaterials = await prisma.materialInventory.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
        quantity: { gt: 0 },
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    for (const item of expiringMaterials) {
      alerts.push({
        type: 'EXPIRING_SOON',
        entityType: 'material',
        entityId: item.materialId,
        entityName: item.material.name,
        sku: item.material.sku,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        currentValue: item.quantity,
        thresholdValue: 0,
      });
    }

    return {
      alerts,
      checkedAt: new Date(),
      productsChecked,
      materialsChecked,
    };
  }

  /**
   * Invia notifiche per gli alert trovati
   */
  async sendAlertNotifications(alerts: StockAlert[]): Promise<number> {
    let sentCount = 0;

    for (const alert of alerts) {
      try {
        const message = this.buildAlertMessage(alert);
        const notificationType = this.mapAlertToNotificationType(alert.type);

        await notificationService.notifyRoles(
          ['MAGAZZINIERE', 'ADMIN', 'MANAGER'] as UserRole[],
          {
            type: notificationType,
            title: this.getAlertTitle(alert.type),
            message,
            link: `/${alert.entityType}s/${alert.entityId}`,
          }
        );

        sentCount++;
        logger.info(`Sent alert notification: ${alert.type} for ${alert.entityName}`);
      } catch (error: any) {
        logger.error(`Failed to send alert notification: ${error.message}`);
      }
    }

    return sentCount;
  }

  /**
   * Mappa tipo alert a NotificationType di Prisma
   */
  private mapAlertToNotificationType(alertType: StockAlertType): NotificationType {
    const mapping: Record<StockAlertType, NotificationType> = {
      LOW_STOCK: 'LOW_STOCK',
      OUT_OF_STOCK: 'LOW_STOCK', // Usa LOW_STOCK per OUT_OF_STOCK (da aggiungere al schema)
      OVERSTOCK: 'LOW_STOCK', // Usa LOW_STOCK per OVERSTOCK (da aggiungere al schema)
      REORDER_POINT: 'LOW_STOCK', // Usa LOW_STOCK per REORDER_POINT (da aggiungere al schema)
      EXPIRING_SOON: 'LOW_STOCK', // Usa LOW_STOCK per EXPIRING_SOON (da aggiungere al schema)
      MATERIAL_SHORTAGE: 'MATERIAL_SHORTAGE',
    };
    return mapping[alertType];
  }

  /**
   * Titolo alert per notifica
   */
  private getAlertTitle(type: StockAlertType): string {
    const titles: Record<StockAlertType, string> = {
      LOW_STOCK: 'Scorta Minima Raggiunta',
      OUT_OF_STOCK: 'Prodotto Esaurito',
      OVERSTOCK: 'Sovrastock Rilevato',
      REORDER_POINT: 'Punto di Riordino Raggiunto',
      EXPIRING_SOON: 'Lotto in Scadenza',
      MATERIAL_SHORTAGE: 'Materiale Sotto Scorta',
    };
    return titles[type];
  }

  /**
   * Costruisce messaggio alert
   */
  private buildAlertMessage(alert: StockAlert): string {
    const entityLabel = alert.entityType === 'product' ? 'Prodotto' : 'Materiale';

    switch (alert.type) {
      case 'OUT_OF_STOCK':
        return `${entityLabel} "${alert.entityName}" (${alert.sku}) e' esaurito. Richiesto riordino immediato.`;

      case 'LOW_STOCK':
        return `${entityLabel} "${alert.entityName}" (${alert.sku}) sotto scorta minima: ${alert.currentValue} unita' (minimo: ${alert.thresholdValue})`;

      case 'MATERIAL_SHORTAGE':
        return `Materiale "${alert.entityName}" (${alert.sku}) sotto scorta minima: ${alert.currentValue} unita' (minimo: ${alert.thresholdValue})`;

      case 'OVERSTOCK':
        return `${entityLabel} "${alert.entityName}" (${alert.sku}) in sovrastock: ${alert.currentValue} unita' (massimo: ${alert.thresholdValue})`;

      case 'REORDER_POINT':
        return `${entityLabel} "${alert.entityName}" (${alert.sku}) ha raggiunto il punto di riordino: ${alert.currentValue} unita' (soglia: ${alert.thresholdValue})`;

      case 'EXPIRING_SOON':
        const expiryDateStr = alert.expiryDate
          ? alert.expiryDate.toLocaleDateString('it-IT')
          : 'N/D';
        return `Lotto ${alert.lotNumber || 'N/A'} di "${alert.entityName}" (${alert.sku}) in scadenza il ${expiryDateStr}. Quantita': ${alert.quantity}`;

      default:
        return `Alert per ${alert.entityName}`;
    }
  }

  /**
   * Filtra alert gia' notificati nelle ultime 24h
   * Evita spam di notifiche ripetute
   */
  async filterRecentAlerts(alerts: StockAlert[]): Promise<StockAlert[]> {
    // Se non esiste la tabella StockAlert, restituisce tutti gli alert
    // In futuro si puo' aggiungere la tabella per tracking
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Controlla notifiche recenti per evitare duplicati
      const recentNotifications = await prisma.notification.findMany({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
          type: { in: ['LOW_STOCK', 'MATERIAL_SHORTAGE'] },
        },
        select: {
          message: true,
        },
      });

      // Filtra alert che hanno gia' una notifica con lo stesso entityId nel messaggio
      const recentEntityIds = new Set(
        recentNotifications
          .map((n) => {
            // Estrai ID dal link se presente
            const match = n.message.match(/\(([A-Za-z0-9-]+)\)/);
            return match ? match[1] : null;
          })
          .filter(Boolean)
      );

      return alerts.filter((alert) => !recentEntityIds.has(alert.sku ?? null));
    } catch {
      // Se c'e' un errore, restituisce tutti gli alert
      return alerts;
    }
  }

  /**
   * Check e notifica singolo prodotto
   * Utile dopo movimentazione inventario
   */
  async checkProductStock(productId: string): Promise<StockAlert | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventory: true,
      },
    });

    if (!product) return null;

    const totalStock = product.inventory.reduce(
      (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
      0
    );

    // OUT_OF_STOCK
    if (totalStock <= 0) {
      return {
        type: 'OUT_OF_STOCK',
        entityType: 'product',
        entityId: product.id,
        entityName: product.name,
        sku: product.sku,
        currentValue: 0,
        thresholdValue: product.minStockLevel,
      };
    }

    // LOW_STOCK
    if (totalStock <= product.minStockLevel && product.minStockLevel > 0) {
      return {
        type: 'LOW_STOCK',
        entityType: 'product',
        entityId: product.id,
        entityName: product.name,
        sku: product.sku,
        currentValue: totalStock,
        thresholdValue: product.minStockLevel,
      };
    }

    // REORDER_POINT
    if (product.reorderPoint > 0 && totalStock <= product.reorderPoint) {
      return {
        type: 'REORDER_POINT',
        entityType: 'product',
        entityId: product.id,
        entityName: product.name,
        sku: product.sku,
        currentValue: totalStock,
        thresholdValue: product.reorderPoint,
      };
    }

    return null;
  }

  /**
   * Statistiche alert attuali
   */
  async getAlertStats(): Promise<{
    totalAlerts: number;
    byType: Record<StockAlertType, number>;
    byEntityType: Record<string, number>;
  }> {
    const result = await this.checkAllStockAlerts();

    const byType: Record<StockAlertType, number> = {
      LOW_STOCK: 0,
      OUT_OF_STOCK: 0,
      OVERSTOCK: 0,
      REORDER_POINT: 0,
      EXPIRING_SOON: 0,
      MATERIAL_SHORTAGE: 0,
    };

    const byEntityType: Record<string, number> = {
      product: 0,
      material: 0,
    };

    for (const alert of result.alerts) {
      byType[alert.type]++;
      byEntityType[alert.entityType]++;
    }

    return {
      totalAlerts: result.alerts.length,
      byType,
      byEntityType,
    };
  }
}

const alertService = new AlertService();
export { alertService, AlertService };
export default alertService;
