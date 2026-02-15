import { PrismaClient, Prisma } from '@prisma/client';
import { config } from './environment';
import { getCurrentTenantId } from '../middleware/tenant.middleware';

// ============================================
// TENANT-SCOPED MODELS
// ============================================

// Lista di tutti i modelli che richiedono filtering per tenant
// Questi modelli hanno il campo tenantId e saranno automaticamente filtrati
const TENANT_SCOPED_MODELS: Prisma.ModelName[] = [
  // Core
  'User',
  'CompanySettings',
  'Warehouse',
  // Materials
  'Material',
  // Products
  'Product',
  'ProductCategory',
  // Inventory
  'InventoryItem',
  'InventoryMovement',
  'ShippingClass',
  'WooCommerceAttribute',
  'WooCommerceTag',
  // Customers
  'Customer',
  'PriceList',
  'CustomerAddress',
  // Suppliers
  'Supplier',
  // Orders
  'Order',
  // Purchasing
  'PurchaseOrder',
  'GoodsReceipt',
  // Invoicing
  'Invoice',
  'SupplierInvoice',
  // Payments
  'PaymentPlan',
  'PaymentDue',
  'OverheadCost',
  // HR
  'Employee',
  'Task',
  'Workflow',
  'OperationType',
  // Manufacturing
  'ManufacturingPhase',
  'ProductionOrder',
  // Notifications & System
  'Notification',
  'CalendarEvent',
  'StockAlert',
  'AuditLog',
  'Suggestion',
  'DailySummary',
  'UserDashboardPreference',
  'PhysicalCountSession',
  'ScheduledReport',
  'ImportJob',
  // WordPress
  'WordPressPluginAuth',
  'WordPressSyncLog',
  // Logistics
  'DDT',
  'RMA',
  // E-commerce
  'ShoppingCart',
  'WishlistItem',
  'Coupon',
  'PaymentTransaction',
  'ShopShippingZone',
  'ProductReview',
  'LoyaltyAccount',
  'AgeVerification',
  'UserEvent',
  'NewsletterSubscription',
];

// Modelli che NON richiedono tenant filtering (globali o sistema)
// - Tenant, TenantMember, TenantInvite (gestione tenant)
// - SubscriptionPlan, SaasSubscription, BillingHistory (abbonamenti)
// - SystemSetting (configurazioni globali)

// ============================================
// PRISMA CLIENT CON MIDDLEWARE TENANT
// ============================================

// Configurazione Prisma con logging
const prisma = new PrismaClient({
  log: config.isDevelopment
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty',
});

// ============================================
// PRISMA MIDDLEWARE PER TENANT ISOLATION
// ============================================

/**
 * Middleware che auto-inietta tenantId nelle query
 *
 * - READ (findMany, findFirst, findUnique, count, aggregate): aggiunge tenantId al WHERE
 * - CREATE (create, createMany): aggiunge tenantId ai dati
 * - UPDATE (update, updateMany): aggiunge tenantId al WHERE
 * - DELETE (delete, deleteMany): aggiunge tenantId al WHERE
 *
 * Questo assicura che ogni tenant veda solo i propri dati
 */
prisma.$use(async (params, next) => {
  const tenantId = getCurrentTenantId();

  // Se non c'è contesto tenant o il modello non è tenant-scoped, procedi normalmente
  if (!tenantId || !params.model || !TENANT_SCOPED_MODELS.includes(params.model as Prisma.ModelName)) {
    return next(params);
  }

  // Azioni di lettura - aggiungi tenantId al filtro WHERE
  if (['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = {
      ...params.args.where,
      tenantId,
    };
  }

  // Azioni di creazione - aggiungi tenantId ai dati
  if (params.action === 'create') {
    params.args = params.args || {};
    params.args.data = {
      ...params.args.data,
      tenantId,
    };
  }

  if (params.action === 'createMany') {
    params.args = params.args || {};
    if (Array.isArray(params.args.data)) {
      params.args.data = params.args.data.map((item: Record<string, unknown>) => ({
        ...item,
        tenantId,
      }));
    } else {
      params.args.data = {
        ...params.args.data,
        tenantId,
      };
    }
  }

  // Azioni di aggiornamento - aggiungi tenantId al filtro WHERE
  if (['update', 'updateMany', 'upsert'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = {
      ...params.args.where,
      tenantId,
    };
    // Per upsert, aggiungi tenantId anche ai dati create
    if (params.action === 'upsert' && params.args.create) {
      params.args.create = {
        ...params.args.create,
        tenantId,
      };
    }
  }

  // Azioni di eliminazione - aggiungi tenantId al filtro WHERE
  if (['delete', 'deleteMany'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = {
      ...params.args.where,
      tenantId,
    };
  }

  return next(params);
});

// ============================================
// GESTIONE CONNESSIONE
// ============================================

prisma.$connect()
  .then(() => console.log('Database connected'))
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('Database disconnected');
});

// ============================================
// EXPORTS
// ============================================

export { prisma, TENANT_SCOPED_MODELS };
export default prisma;
