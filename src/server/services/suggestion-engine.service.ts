/**
 * Suggestion Engine Service
 * Motore di suggerimenti intelligenti per l'ERP
 *
 * Algoritmi implementati:
 * 1. REORDER - Predizione stockout basata su velocità vendita
 * 2. STOCKOUT_ALERT - Allarme scorte critiche
 * 3. MARGIN_ALERT - Flag prodotti a basso margine (<15%)
 * 4. TREND_UP/DOWN - Variazioni vendite +/-30%
 * 5. SEASONAL_PEAK - Pattern stagionali da dati storici
 * 6. BATCH_PRODUCTION - Suggerimenti produzione raggruppata
 * 7. ORDER_GROUPING - Raggruppa ordini fornitore per spedizione gratis
 * 8. DEAD_STOCK - Prodotti senza vendite 90+ giorni
 * 9. PAYMENT_DUE - Scadenze pagamento imminenti
 * 10. SUPPLIER_ISSUE - Problemi fornitori (ritardi)
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  SuggestionType,
  SuggestionPriority,
  SuggestionStatus,
  Prisma,
} from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface SuggestionInput {
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
  productId?: string;
  materialId?: string;
  supplierId?: string;
  customerId?: string;
  orderId?: string;
  data?: Record<string, unknown>;
  potentialSaving?: number;
  potentialRevenue?: number;
  expiresAt?: Date;
}

// ============================================
// SERVICE
// ============================================

class SuggestionEngineService {
  /**
   * Esegue tutti gli algoritmi di suggerimento
   */
  async runAllAlgorithms(): Promise<{ created: number; errors: string[] }> {
    logger.info('Avvio generazione suggerimenti...');

    const errors: string[] = [];
    let totalCreated = 0;

    // Pulisci suggerimenti scaduti o vecchi
    await this.cleanupOldSuggestions();

    // Esegui algoritmi in parallelo dove possibile
    const algorithms = [
      { name: 'stockout', fn: () => this.generateStockoutAlerts() },
      { name: 'reorder', fn: () => this.generateReorderSuggestions() },
      { name: 'margin', fn: () => this.generateMarginAlerts() },
      { name: 'trend', fn: () => this.generateTrendSuggestions() },
      { name: 'deadStock', fn: () => this.generateDeadStockAlerts() },
      { name: 'batchProduction', fn: () => this.generateBatchProductionSuggestions() },
      { name: 'orderGrouping', fn: () => this.generateOrderGroupingSuggestions() },
      { name: 'paymentDue', fn: () => this.generatePaymentDueSuggestions() },
      { name: 'supplierIssue', fn: () => this.generateSupplierIssueSuggestions() },
    ];

    for (const algo of algorithms) {
      try {
        const count = await algo.fn();
        totalCreated += count;
        logger.info(`Algoritmo ${algo.name}: ${count} suggerimenti creati`);
      } catch (error) {
        const msg = `Errore algoritmo ${algo.name}: ${(error as Error).message}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    logger.info(`Generazione suggerimenti completata: ${totalCreated} creati, ${errors.length} errori`);

    return { created: totalCreated, errors };
  }

  /**
   * Pulisce suggerimenti vecchi o scaduti
   */
  private async cleanupOldSuggestions(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Elimina suggerimenti scaduti o molto vecchi
    await prisma.suggestion.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { status: { in: ['DISMISSED', 'ACTED', 'EXPIRED'] }, updatedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });

    // Marca come scaduti quelli vecchi ancora pending
    await prisma.suggestion.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: thirtyDaysAgo },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  // ============================================
  // STOCKOUT ALERTS
  // ============================================

  /**
   * Genera alert per prodotti con scorte critiche (stock <= 0 o <= minStock)
   */
  private async generateStockoutAlerts(): Promise<number> {
    // Trova prodotti con stock critico
    const criticalProducts = await prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      sku: string;
      total_stock: number;
      min_stock: number;
      reorder_point: number;
      cost: number | null;
    }>>`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as total_stock,
        COALESCE(p.min_stock, 0) as min_stock,
        COALESCE(p.reorder_point, 0) as reorder_point,
        p.cost
      FROM products p
      LEFT JOIN inventory_items i ON p.id = i.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.min_stock, p.reorder_point, p.cost
      HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= COALESCE(p.min_stock, 0)
         AND COALESCE(p.min_stock, 0) > 0
      ORDER BY COALESCE(SUM(i.quantity - i.reserved_quantity), 0) ASC
      LIMIT 50
    `;

    let created = 0;

    for (const product of criticalProducts) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'STOCKOUT_ALERT',
          productId: product.product_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const priority: SuggestionPriority =
        Number(product.total_stock) <= 0 ? 'CRITICAL' : 'HIGH';

      await this.createSuggestion({
        type: 'STOCKOUT_ALERT',
        priority,
        title: `Scorte critiche: ${product.product_name}`,
        description: `Il prodotto ${product.sku} ha solo ${product.total_stock} unità in stock (minimo: ${product.min_stock}). Riordinare immediatamente.`,
        actionLabel: 'Crea ordine fornitore',
        actionUrl: `/purchase-orders/new?productId=${product.product_id}`,
        productId: product.product_id,
        data: {
          currentStock: Number(product.total_stock),
          minStock: product.min_stock,
          reorderPoint: product.reorder_point,
        },
        expiresAt: this.getExpirationDate(7),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // REORDER SUGGESTIONS
  // ============================================

  /**
   * Genera suggerimenti di riordino basati su velocità di vendita
   */
  private async generateReorderSuggestions(): Promise<number> {
    // Calcola velocità media vendita negli ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const productsWithVelocity = await prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      sku: string;
      total_stock: number;
      reorder_point: number;
      min_stock: number;
      total_sold: number;
      avg_daily_sales: number;
      days_until_stockout: number;
      suggested_quantity: number;
    }>>`
      WITH sales_velocity AS (
        SELECT
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          SUM(oi.quantity) / 30.0 as avg_daily_sales
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('SHIPPED', 'DELIVERED', 'COMPLETED')
          AND o.order_date >= ${thirtyDaysAgo}
        GROUP BY oi.product_id
      ),
      stock_status AS (
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.sku,
          COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as total_stock,
          COALESCE(p.reorder_point, 10) as reorder_point,
          COALESCE(p.min_stock, 5) as min_stock
        FROM products p
        LEFT JOIN inventory_items i ON p.id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.sku, p.reorder_point, p.min_stock
      )
      SELECT
        ss.product_id,
        ss.product_name,
        ss.sku,
        ss.total_stock,
        ss.reorder_point,
        ss.min_stock,
        COALESCE(sv.total_sold, 0) as total_sold,
        COALESCE(sv.avg_daily_sales, 0) as avg_daily_sales,
        CASE
          WHEN COALESCE(sv.avg_daily_sales, 0) > 0
          THEN FLOOR(ss.total_stock / sv.avg_daily_sales)
          ELSE 999
        END as days_until_stockout,
        CASE
          WHEN COALESCE(sv.avg_daily_sales, 0) > 0
          THEN CEIL(sv.avg_daily_sales * 30) -- 30 giorni di copertura
          ELSE ss.reorder_point
        END as suggested_quantity
      FROM stock_status ss
      LEFT JOIN sales_velocity sv ON ss.product_id = sv.product_id
      WHERE ss.total_stock <= ss.reorder_point
        AND ss.total_stock > ss.min_stock -- Non già in stockout
        AND COALESCE(sv.avg_daily_sales, 0) > 0 -- Ha vendite
      ORDER BY
        CASE WHEN COALESCE(sv.avg_daily_sales, 0) > 0 THEN ss.total_stock / sv.avg_daily_sales ELSE 999 END ASC
      LIMIT 30
    `;

    let created = 0;

    for (const product of productsWithVelocity) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'REORDER',
          productId: product.product_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const daysUntilStockout = Number(product.days_until_stockout);
      const priority: SuggestionPriority =
        daysUntilStockout <= 7 ? 'HIGH' : daysUntilStockout <= 14 ? 'MEDIUM' : 'LOW';

      await this.createSuggestion({
        type: 'REORDER',
        priority,
        title: `Riordina: ${product.product_name}`,
        description: `Scorte in esaurimento tra ${daysUntilStockout} giorni. Stock attuale: ${product.total_stock}, velocità vendita: ${Number(product.avg_daily_sales).toFixed(1)}/giorno. Quantità suggerita: ${product.suggested_quantity} unità.`,
        actionLabel: 'Crea ordine acquisto',
        actionUrl: `/purchase-orders/new?productId=${product.product_id}&qty=${product.suggested_quantity}`,
        productId: product.product_id,
        data: {
          currentStock: Number(product.total_stock),
          avgDailySales: Number(product.avg_daily_sales),
          daysUntilStockout,
          suggestedQuantity: Number(product.suggested_quantity),
          reorderPoint: product.reorder_point,
        } as Record<string, unknown>,
        expiresAt: this.getExpirationDate(14),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // MARGIN ALERTS
  // ============================================

  /**
   * Genera alert per prodotti con margine basso (<15%)
   */
  private async generateMarginAlerts(): Promise<number> {
    // Trova prodotti con margine basso
    const lowMarginProducts = await prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      sku: string;
      cost: number;
      price: number;
      margin: number;
      margin_percent: number;
    }>>`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.cost,
        p.price,
        (p.price - COALESCE(p.cost, 0)) as margin,
        CASE
          WHEN p.price > 0 THEN ((p.price - COALESCE(p.cost, 0)) / p.price * 100)
          ELSE 0
        END as margin_percent
      FROM products p
      WHERE p.is_active = true
        AND p.price > 0
        AND p.cost IS NOT NULL
        AND p.cost > 0
        AND ((p.price - p.cost) / p.price * 100) < 15
      ORDER BY margin_percent ASC
      LIMIT 20
    `;

    let created = 0;

    for (const product of lowMarginProducts) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'MARGIN_ALERT',
          productId: product.product_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const marginPercent = Number(product.margin_percent);
      const priority: SuggestionPriority =
        marginPercent < 5 ? 'HIGH' : marginPercent < 10 ? 'MEDIUM' : 'LOW';

      await this.createSuggestion({
        type: 'MARGIN_ALERT',
        priority,
        title: `Margine basso: ${product.product_name}`,
        description: `Il prodotto ${product.sku} ha un margine di solo ${marginPercent.toFixed(1)}% (€${Number(product.margin).toFixed(2)}). Costo: €${Number(product.cost).toFixed(2)}, Prezzo: €${Number(product.price).toFixed(2)}. Considera l'aumento del prezzo o la rinegoziazione con il fornitore.`,
        actionLabel: 'Modifica prodotto',
        actionUrl: `/products/${product.product_id}/edit`,
        productId: product.product_id,
        data: {
          cost: Number(product.cost),
          price: Number(product.price),
          margin: Number(product.margin),
          marginPercent,
        } as Record<string, unknown>,
        expiresAt: this.getExpirationDate(30),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // TREND DETECTION
  // ============================================

  /**
   * Genera suggerimenti basati su trend vendite (+/-30%)
   */
  private async generateTrendSuggestions(): Promise<number> {
    // Confronta vendite ultime 2 settimane vs 2 settimane precedenti
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const trendData = await prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      sku: string;
      current_period_sales: number;
      previous_period_sales: number;
      change_percent: number;
    }>>`
      WITH current_period AS (
        SELECT
          oi.product_id,
          SUM(oi.quantity) as sales
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('SHIPPED', 'DELIVERED', 'COMPLETED')
          AND o.order_date >= ${twoWeeksAgo}
          AND o.order_date < ${today}
        GROUP BY oi.product_id
      ),
      previous_period AS (
        SELECT
          oi.product_id,
          SUM(oi.quantity) as sales
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('SHIPPED', 'DELIVERED', 'COMPLETED')
          AND o.order_date >= ${fourWeeksAgo}
          AND o.order_date < ${twoWeeksAgo}
        GROUP BY oi.product_id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        COALESCE(cp.sales, 0) as current_period_sales,
        COALESCE(pp.sales, 0) as previous_period_sales,
        CASE
          WHEN COALESCE(pp.sales, 0) > 0
          THEN ((COALESCE(cp.sales, 0) - pp.sales) / pp.sales * 100)
          ELSE 0
        END as change_percent
      FROM products p
      LEFT JOIN current_period cp ON p.id = cp.product_id
      LEFT JOIN previous_period pp ON p.id = pp.product_id
      WHERE p.is_active = true
        AND (COALESCE(cp.sales, 0) > 0 OR COALESCE(pp.sales, 0) > 0)
        AND ABS(
          CASE
            WHEN COALESCE(pp.sales, 0) > 0
            THEN ((COALESCE(cp.sales, 0) - pp.sales) / pp.sales * 100)
            ELSE 0
          END
        ) >= 30
      ORDER BY ABS(
        CASE
          WHEN COALESCE(pp.sales, 0) > 0
          THEN ((COALESCE(cp.sales, 0) - pp.sales) / pp.sales * 100)
          ELSE 0
        END
      ) DESC
      LIMIT 20
    `;

    let created = 0;

    for (const item of trendData) {
      const changePercent = Number(item.change_percent);
      const direction = changePercent > 0 ? 'UP' : 'DOWN';
      const type: SuggestionType = direction === 'UP' ? 'TREND_UP' : 'TREND_DOWN';

      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type,
          productId: item.product_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const priority: SuggestionPriority =
        Math.abs(changePercent) >= 50 ? 'HIGH' : 'MEDIUM';

      const title = direction === 'UP'
        ? `📈 Trend positivo: ${item.product_name}`
        : `📉 Trend negativo: ${item.product_name}`;

      const description = direction === 'UP'
        ? `Le vendite di ${item.sku} sono aumentate del ${changePercent.toFixed(0)}% (${item.current_period_sales} vs ${item.previous_period_sales} unità). Considera l'aumento delle scorte.`
        : `Le vendite di ${item.sku} sono diminuite del ${Math.abs(changePercent).toFixed(0)}% (${item.current_period_sales} vs ${item.previous_period_sales} unità). Verifica le cause e considera promozioni.`;

      await this.createSuggestion({
        type,
        priority,
        title,
        description,
        actionLabel: direction === 'UP' ? 'Aumenta scorte' : 'Analizza vendite',
        actionUrl: `/products/${item.product_id}/analytics`,
        productId: item.product_id,
        data: {
          currentPeriodSales: Number(item.current_period_sales),
          previousPeriodSales: Number(item.previous_period_sales),
          changePercent,
          direction,
        } as Record<string, unknown>,
        expiresAt: this.getExpirationDate(7),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // DEAD STOCK
  // ============================================

  /**
   * Identifica prodotti senza vendite da 90+ giorni
   */
  private async generateDeadStockAlerts(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deadStockProducts = await prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      sku: string;
      total_stock: number;
      stock_value: number;
      last_sale_date: Date | null;
      days_since_last_sale: number;
    }>>`
      WITH last_sales AS (
        SELECT
          oi.product_id,
          MAX(o.order_date) as last_sale_date
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('SHIPPED', 'DELIVERED', 'COMPLETED')
        GROUP BY oi.product_id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as total_stock,
        COALESCE(SUM((i.quantity - i.reserved_quantity) * COALESCE(p.cost, 0)), 0) as stock_value,
        ls.last_sale_date,
        CASE
          WHEN ls.last_sale_date IS NOT NULL
          THEN EXTRACT(DAY FROM (NOW() - ls.last_sale_date))
          ELSE 999
        END as days_since_last_sale
      FROM products p
      LEFT JOIN inventory_items i ON p.id = i.product_id
      LEFT JOIN last_sales ls ON p.id = ls.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku, ls.last_sale_date
      HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) > 0
        AND (
          ls.last_sale_date IS NULL
          OR ls.last_sale_date < ${ninetyDaysAgo}
        )
      ORDER BY stock_value DESC
      LIMIT 30
    `;

    let created = 0;

    for (const product of deadStockProducts) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'DEAD_STOCK',
          productId: product.product_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const stockValue = Number(product.stock_value);
      const priority: SuggestionPriority =
        stockValue > 1000 ? 'HIGH' : stockValue > 500 ? 'MEDIUM' : 'LOW';

      await this.createSuggestion({
        type: 'DEAD_STOCK',
        priority,
        title: `Stock fermo: ${product.product_name}`,
        description: `Il prodotto ${product.sku} ha ${product.total_stock} unità in stock (valore €${stockValue.toFixed(2)}) senza vendite da ${product.days_since_last_sale} giorni. Considera sconti o promozioni per smaltire lo stock.`,
        actionLabel: 'Crea promozione',
        actionUrl: `/products/${product.product_id}/edit`,
        productId: product.product_id,
        data: {
          lastSaleDate: product.last_sale_date,
          daysSinceLastSale: Number(product.days_since_last_sale),
          currentStock: Number(product.total_stock),
          stockValue,
        } as Record<string, unknown>,
        potentialSaving: stockValue,
        expiresAt: this.getExpirationDate(30),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // BATCH PRODUCTION
  // ============================================

  /**
   * Suggerisce produzione batch quando più prodotti necessitano dello stesso materiale
   */
  private async generateBatchProductionSuggestions(): Promise<number> {
    // Trova materiali con scorte basse usati da più prodotti in esaurimento
    const batchOpportunities = await prisma.$queryRaw<Array<{
      material_id: string;
      material_name: string;
      material_sku: string;
      material_stock: number;
      products_count: number;
      product_names: string;
      total_needed: number;
    }>>`
      WITH low_stock_products AS (
        SELECT
          p.id as product_id,
          p.name as product_name,
          COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as stock
        FROM products p
        LEFT JOIN inventory_items i ON p.id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name
        HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= COALESCE(p.reorder_point, 10)
      ),
      material_usage AS (
        SELECT
          bi.material_id,
          m.name as material_name,
          m.sku as material_sku,
          m.current_stock as material_stock,
          COUNT(DISTINCT lsp.product_id) as products_count,
          STRING_AGG(DISTINCT lsp.product_name, ', ') as product_names,
          SUM(bi.quantity * 10) as total_needed -- Assume 10 unità per prodotto
        FROM bom_items bi
        JOIN bom b ON bi.bom_id = b.id
        JOIN low_stock_products lsp ON b.product_id = lsp.product_id
        JOIN materials m ON bi.material_id = m.id
        WHERE b.is_active = true
        GROUP BY bi.material_id, m.name, m.sku, m.current_stock
        HAVING COUNT(DISTINCT lsp.product_id) >= 2
      )
      SELECT *
      FROM material_usage
      WHERE material_stock >= total_needed
      ORDER BY products_count DESC, total_needed DESC
      LIMIT 10
    `;

    let created = 0;

    for (const opportunity of batchOpportunities) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'BATCH_PRODUCTION',
          materialId: opportunity.material_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      await this.createSuggestion({
        type: 'BATCH_PRODUCTION',
        priority: 'MEDIUM',
        title: `Produzione batch: ${opportunity.products_count} prodotti`,
        description: `${opportunity.products_count} prodotti (${opportunity.product_names}) necessitano del materiale ${opportunity.material_sku}. Hai ${opportunity.material_stock} unità disponibili. Produci in batch per efficienza.`,
        actionLabel: 'Crea ordine produzione',
        actionUrl: '/manufacturing/production-orders/new',
        materialId: opportunity.material_id,
        data: {
          materialName: opportunity.material_name,
          materialStock: Number(opportunity.material_stock),
          productsCount: Number(opportunity.products_count),
          productNames: opportunity.product_names,
          totalNeeded: Number(opportunity.total_needed),
        },
        expiresAt: this.getExpirationDate(14),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // ORDER GROUPING
  // ============================================

  /**
   * Suggerisce raggruppamento ordini fornitore per ottimizzare spedizioni
   */
  private async generateOrderGroupingSuggestions(): Promise<number> {
    // Trova fornitori con più prodotti da riordinare
    const groupingOpportunities = await prisma.$queryRaw<Array<{
      supplier_id: string;
      supplier_name: string;
      products_count: number;
      product_names: string;
      total_value: number;
      min_order_value: number | null;
    }>>`
      WITH low_stock_products AS (
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.cost,
          COALESCE(p.reorder_point, 10) as suggested_qty
        FROM products p
        LEFT JOIN inventory_items i ON p.id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.cost, p.reorder_point
        HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= COALESCE(p.reorder_point, 10)
      ),
      supplier_products AS (
        SELECT
          si.supplier_id,
          s.name as supplier_name,
          s.min_order_value,
          COUNT(DISTINCT lsp.product_id) as products_count,
          STRING_AGG(DISTINCT lsp.product_name, ', ') as product_names,
          SUM(COALESCE(lsp.cost, 0) * lsp.suggested_qty) as total_value
        FROM supplier_items si
        JOIN suppliers s ON si.supplier_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN low_stock_products lsp ON p.id = lsp.product_id
        WHERE s.is_active = true
        GROUP BY si.supplier_id, s.name, s.min_order_value
        HAVING COUNT(DISTINCT lsp.product_id) >= 2
      )
      SELECT *
      FROM supplier_products
      ORDER BY products_count DESC, total_value DESC
      LIMIT 10
    `;

    let created = 0;

    for (const opportunity of groupingOpportunities) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'ORDER_GROUPING',
          supplierId: opportunity.supplier_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const totalValue = Number(opportunity.total_value);
      const minOrder = opportunity.min_order_value ? Number(opportunity.min_order_value) : 0;

      let description = `Raggruppa ${opportunity.products_count} prodotti da ${opportunity.supplier_name}: ${opportunity.product_names}. Valore totale stimato: €${totalValue.toFixed(2)}.`;

      if (minOrder > 0 && totalValue >= minOrder) {
        description += ` Raggiungi il minimo d'ordine (€${minOrder.toFixed(2)}) per spedizione gratuita!`;
      }

      await this.createSuggestion({
        type: 'ORDER_GROUPING',
        priority: 'MEDIUM',
        title: `Raggruppa ordine: ${opportunity.supplier_name}`,
        description,
        actionLabel: 'Crea ordine raggruppato',
        actionUrl: `/purchase-orders/new?supplierId=${opportunity.supplier_id}`,
        supplierId: opportunity.supplier_id,
        data: {
          supplierName: opportunity.supplier_name,
          productsCount: Number(opportunity.products_count),
          productNames: opportunity.product_names,
          totalValue,
          minOrderValue: minOrder,
        },
        potentialSaving: minOrder > 0 && totalValue >= minOrder ? 20 : undefined, // Stima risparmio spedizione
        expiresAt: this.getExpirationDate(7),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // PAYMENT DUE
  // ============================================

  /**
   * Genera alert per scadenze pagamento imminenti
   */
  private async generatePaymentDueSuggestions(): Promise<number> {
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Trova fatture in scadenza nei prossimi 7 giorni
    const upcomingPayments = await prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: {
          gte: today,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    let created = 0;

    for (const invoice of upcomingPayments) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'PAYMENT_DUE',
          orderId: invoice.id, // Usiamo orderId per riferimento fattura
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const daysUntilDue = Math.ceil(
        (invoice.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const customerName = invoice.customer?.businessName ||
        `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim() ||
        'Cliente';

      const amount = Number(invoice.total) - Number(invoice.paidAmount);
      const priority: SuggestionPriority =
        daysUntilDue <= 2 ? 'HIGH' : daysUntilDue <= 5 ? 'MEDIUM' : 'LOW';

      await this.createSuggestion({
        type: 'PAYMENT_DUE',
        priority,
        title: `Scadenza: Fattura ${invoice.invoiceNumber}`,
        description: `La fattura ${invoice.invoiceNumber} per ${customerName} (€${amount.toFixed(2)}) scade tra ${daysUntilDue} giorni (${invoice.dueDate.toLocaleDateString('it-IT')}). Invia un promemoria al cliente.`,
        actionLabel: 'Invia promemoria',
        actionUrl: `/accounting/invoices/${invoice.id}`,
        customerId: invoice.customerId || undefined,
        orderId: invoice.id, // Riferimento fattura
        data: {
          invoiceNumber: invoice.invoiceNumber,
          amount,
          dueDate: invoice.dueDate,
          daysUntilDue,
          customerName,
        } as Record<string, unknown>,
        potentialRevenue: amount,
        expiresAt: invoice.dueDate,
      });

      created++;
    }

    return created;
  }

  // ============================================
  // SUPPLIER ISSUES
  // ============================================

  /**
   * Identifica problemi con fornitori (ritardi, qualità)
   */
  private async generateSupplierIssueSuggestions(): Promise<number> {
    // Trova fornitori con ordini in ritardo
    const today = new Date();

    const suppliersWithDelays = await prisma.$queryRaw<Array<{
      supplier_id: string;
      supplier_name: string;
      late_orders: number;
      avg_delay_days: number;
      total_pending_value: number;
    }>>`
      SELECT
        s.id as supplier_id,
        s.name as supplier_name,
        COUNT(DISTINCT po.id) as late_orders,
        AVG(EXTRACT(DAY FROM (NOW() - po.expected_date))) as avg_delay_days,
        SUM(po.total) as total_pending_value
      FROM suppliers s
      JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE po.status IN ('SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED')
        AND po.expected_date < ${today}
      GROUP BY s.id, s.name
      HAVING COUNT(DISTINCT po.id) >= 1
      ORDER BY COUNT(DISTINCT po.id) DESC, avg_delay_days DESC
      LIMIT 10
    `;

    let created = 0;

    for (const supplier of suppliersWithDelays) {
      // Verifica se esiste già un suggerimento attivo
      const existing = await prisma.suggestion.findFirst({
        where: {
          type: 'SUPPLIER_ISSUE',
          supplierId: supplier.supplier_id,
          status: 'PENDING',
        },
      });

      if (existing) continue;

      const avgDelay = Math.round(Number(supplier.avg_delay_days));
      const priority: SuggestionPriority =
        supplier.late_orders >= 3 || avgDelay > 14 ? 'HIGH' : 'MEDIUM';

      await this.createSuggestion({
        type: 'SUPPLIER_ISSUE',
        priority,
        title: `Ritardi fornitore: ${supplier.supplier_name}`,
        description: `Il fornitore ${supplier.supplier_name} ha ${supplier.late_orders} ordini in ritardo (media ${avgDelay} giorni). Valore totale pendente: €${Number(supplier.total_pending_value).toFixed(2)}. Contatta il fornitore per un aggiornamento.`,
        actionLabel: 'Vedi ordini',
        actionUrl: `/purchase-orders?supplierId=${supplier.supplier_id}&status=delayed`,
        supplierId: supplier.supplier_id,
        data: {
          lateOrders: Number(supplier.late_orders),
          avgDelayDays: avgDelay,
          totalPendingValue: Number(supplier.total_pending_value),
        },
        expiresAt: this.getExpirationDate(7),
      });

      created++;
    }

    return created;
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Crea un nuovo suggerimento
   */
  private async createSuggestion(input: SuggestionInput): Promise<void> {
    await prisma.suggestion.create({
      data: {
        type: input.type,
        priority: input.priority,
        status: 'PENDING',
        title: input.title,
        description: input.description,
        actionLabel: input.actionLabel,
        actionUrl: input.actionUrl,
        productId: input.productId,
        materialId: input.materialId,
        supplierId: input.supplierId,
        customerId: input.customerId,
        orderId: input.orderId,
        data: input.data as Prisma.JsonObject,
        potentialSaving: input.potentialSaving,
        potentialRevenue: input.potentialRevenue,
        expiresAt: input.expiresAt,
      },
    });
  }

  /**
   * Calcola data di scadenza
   */
  private getExpirationDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Lista suggerimenti attivi con filtri
   */
  async list(params: {
    status?: SuggestionStatus;
    type?: SuggestionType;
    priority?: SuggestionPriority;
    page?: number;
    limit?: number;
  }) {
    const { status = 'PENDING', type, priority, page = 1, limit = 50 } = params;

    const where: Prisma.SuggestionWhereInput = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [suggestions, total] = await Promise.all([
      prisma.suggestion.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          material: { select: { id: true, name: true, sku: true } },
          supplier: { select: { id: true, businessName: true } },
        },
        orderBy: [
          { priority: 'asc' }, // CRITICAL first
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.suggestion.count({ where }),
    ]);

    return {
      items: suggestions,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Dismisses a suggestion
   */
  async dismiss(id: string, userId: string, reason?: string): Promise<void> {
    await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedBy: userId,
        dismissedAt: new Date(),
        dismissReason: reason,
      },
    });
  }

  /**
   * Marks a suggestion as acted upon
   */
  async markActed(id: string, userId: string): Promise<void> {
    await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'ACTED',
        actedBy: userId,
        actedAt: new Date(),
      },
    });
  }

  /**
   * Get suggestion statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const [total, pending, byType, byPriority] = await Promise.all([
      prisma.suggestion.count(),
      prisma.suggestion.count({ where: { status: 'PENDING' } }),
      prisma.suggestion.groupBy({
        by: ['type'],
        _count: true,
        where: { status: 'PENDING' },
      }),
      prisma.suggestion.groupBy({
        by: ['priority'],
        _count: true,
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      total,
      pending,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const suggestionEngineService = new SuggestionEngineService();
