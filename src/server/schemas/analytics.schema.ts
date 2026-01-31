import { z } from 'zod';

/**
 * Schema per dashboard KPI
 */
export const dashboardKpiSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * Schema per analisi vendite
 */
export const salesAnalysisSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  productId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  orderType: z.enum(['WEB', 'B2B', 'MANUAL', 'WORDPRESS']).optional(),
});

/**
 * Schema per analisi marginalità prodotto
 */
export const productMarginAnalysisSchema = z.object({
  productId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minMarginPercentage: z.number().min(0).max(100).optional(),
});

/**
 * Schema per top prodotti
 */
export const topProductsSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  limit: z.number().int().positive().max(100).default(10),
  orderBy: z.enum(['quantity', 'revenue', 'margin']).default('revenue'),
});

/**
 * Schema per top clienti
 */
export const topCustomersSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  limit: z.number().int().positive().max(100).default(10),
  orderBy: z.enum(['orders', 'revenue', 'averageOrderValue']).default('revenue'),
  customerType: z.enum(['B2C', 'B2B']).optional(),
});

/**
 * Schema per analisi ABC prodotti (basata su Pareto)
 */
export const abcAnalysisSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  metric: z.enum(['revenue', 'quantity', 'margin']).default('revenue'),
  // Thresholds per classificazione ABC
  aThreshold: z.number().min(0).max(100).default(80), // A: top 80% del valore
  bThreshold: z.number().min(0).max(100).default(95), // B: 80-95%
  // C: resto
});

/**
 * Schema per forecast vendite (semplice - media mobile)
 */
export const salesForecastSchema = z.object({
  productId: z.string().uuid().optional(),
  historicalMonths: z.number().int().positive().default(12),
  forecastMonths: z.number().int().positive().default(3),
  method: z.enum(['MOVING_AVERAGE', 'WEIGHTED_AVERAGE', 'LINEAR_REGRESSION']).default('MOVING_AVERAGE'),
});

/**
 * Schema per analisi clienti da ricontattare
 */
export const inactiveCustomersSchema = z.object({
  daysSinceLastOrder: z.number().int().positive().default(90),
  minPreviousOrders: z.number().int().positive().default(1),
  customerType: z.enum(['B2C', 'B2B']).optional(),
});

/**
 * Schema per report personalizzato
 */
export const customReportSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['SALES', 'INVENTORY', 'FINANCIAL', 'PRODUCTIVITY', 'CUSTOM']),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  metrics: z.array(z.string()).min(1), // ['revenue', 'orders', 'margin', etc.]
  filters: z.record(z.any()).optional(), // Filtri dinamici
  format: z.enum(['JSON', 'CSV', 'PDF', 'EXCEL']).default('JSON'),
});

/**
 * Schema per trend analysis
 */
export const trendAnalysisSchema = z.object({
  metric: z.enum(['sales', 'orders', 'customers', 'inventory_value', 'margin']),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
  compareWithPreviousPeriod: z.boolean().default(true),
});

/**
 * Schema per inventory valuation
 */
export const inventoryValuationSchema = z.object({
  date: z.string().datetime().optional(), // Se non fornito, usa data corrente
  locationId: z.string().uuid().optional(),
  method: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).default('WEIGHTED_AVERAGE'),
});

export type DashboardKpiInput = z.infer<typeof dashboardKpiSchema>;
export type SalesAnalysisInput = z.infer<typeof salesAnalysisSchema>;
export type ProductMarginAnalysisInput = z.infer<typeof productMarginAnalysisSchema>;
export type TopProductsInput = z.infer<typeof topProductsSchema>;
export type TopCustomersInput = z.infer<typeof topCustomersSchema>;
export type AbcAnalysisInput = z.infer<typeof abcAnalysisSchema>;
export type SalesForecastInput = z.infer<typeof salesForecastSchema>;
export type InactiveCustomersInput = z.infer<typeof inactiveCustomersSchema>;
export type CustomReportInput = z.infer<typeof customReportSchema>;
export type TrendAnalysisInput = z.infer<typeof trendAnalysisSchema>;
export type InventoryValuationInput = z.infer<typeof inventoryValuationSchema>;
