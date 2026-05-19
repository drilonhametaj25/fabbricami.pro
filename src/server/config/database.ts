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
const basePrisma = new PrismaClient({
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
// Mode strict: se TENANT_STRICT_MODE=true, una query verso un modello tenant-scoped
// SENZA tenantContext attivo lancia un'eccezione (con stack trace) invece di
// procedere unfiltered. Utile per debug/produzione per scoprire route che hanno
// bypassato il setup del context.
const TENANT_STRICT_MODE = process.env.TENANT_STRICT_MODE === 'true';

// Log diagnostico minimale: stampa ogni query tenant-scoped con tenantId iniettato
const TENANT_DEBUG_MODE = process.env.TENANT_DEBUG_MODE === 'true';

basePrisma.$use(async (params, next) => {
  const tenantId = getCurrentTenantId();
  const isTenantScoped = !!params.model && TENANT_SCOPED_MODELS.includes(params.model as Prisma.ModelName);

  if (TENANT_DEBUG_MODE && isTenantScoped) {
    // eslint-disable-next-line no-console
    console.error(`[TENANT_MW $use] ${params.model}.${params.action} tenantId=${tenantId ?? '<NONE>'}`);
  }

  if (!tenantId && isTenantScoped) {
    if (TENANT_STRICT_MODE) {
      const err = new Error(
        `[TENANT_STRICT] Query ${params.model}.${params.action} eseguita senza tenantContext. ` +
        `Questo è un data leak: aggiungi authenticate/tenantMiddleware al route o wrappa in runWithTenant().`
      );
      // eslint-disable-next-line no-console
      console.error(err.stack);
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error(`[TENANT_LEAK_WARN $use] ${params.model}.${params.action} senza tenantContext — query NON filtrata!`);
  }

  if (!tenantId || !params.model || !TENANT_SCOPED_MODELS.includes(params.model as Prisma.ModelName)) {
    return next(params);
  }

  if (['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = { ...params.args.where, tenantId };
  }

  if (params.action === 'create') {
    params.args = params.args || {};
    params.args.data = { ...params.args.data, tenantId };
  }

  if (params.action === 'createMany') {
    params.args = params.args || {};
    if (Array.isArray(params.args.data)) {
      params.args.data = params.args.data.map((item: Record<string, unknown>) => ({ ...item, tenantId }));
    } else {
      params.args.data = { ...params.args.data, tenantId };
    }
  }

  if (['update', 'updateMany', 'upsert'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = { ...params.args.where, tenantId };
    if (params.action === 'upsert' && params.args.create) {
      params.args.create = { ...params.args.create, tenantId };
    }
  }

  if (['delete', 'deleteMany'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = { ...params.args.where, tenantId };
  }

  return next(params);
});

// ============================================
// DOPPIO LIVELLO DI ISOLAMENTO TENANT (Prisma 5+)
// ============================================
// `$use` è deprecato in Prisma 5 e potrebbe NON essere applicato correttamente
// dipendendo dalla versione/configurazione. `$extends` è l'API ufficiale e
// sicura: intercetta ogni query e applica il filtro tenant.
// Usiamo ENTRAMBI come belt-and-suspenders — sono idempotenti (settare
// tenantId due volte produce lo stesso WHERE).
const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findUnique', 'findFirstOrThrow',
  'findUniqueOrThrow', 'count', 'aggregate', 'groupBy',
]);
const UPDATE_ACTIONS = new Set(['update', 'updateMany', 'upsert']);
const DELETE_ACTIONS = new Set(['delete', 'deleteMany']);

// L'extended client ha un tipo diverso da PrismaClient. Per non rompere centinaia
// di call site (firme di transazioni, repository, ecc.) lo castiamo dietro lo
// stesso tipo del base client. A runtime intercetta correttamente; a compile
// time appare come PrismaClient normale.
const extendedPrisma = basePrisma.$extends({
  name: 'tenantIsolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: { model?: string; operation: string; args: any; query: (a: any) => Promise<any> }) {
        const tenantId = getCurrentTenantId();
        const isTenantScoped = !!model && TENANT_SCOPED_MODELS.includes(model as Prisma.ModelName);

        if (TENANT_DEBUG_MODE && isTenantScoped) {
          // eslint-disable-next-line no-console
          console.error(`[TENANT_MW $extends] ${model}.${operation} tenantId=${tenantId ?? '<NONE>'}`);
        }

        if (!tenantId && isTenantScoped) {
          if (TENANT_STRICT_MODE) {
            const err = new Error(
              `[TENANT_STRICT $extends] Query ${model}.${operation} senza tenantContext. ` +
              `Aggiungi authenticate/tenantMiddleware al route o wrappa in runWithTenant().`
            );
            // eslint-disable-next-line no-console
            console.error(err.stack);
            throw err;
          }
          // eslint-disable-next-line no-console
          console.error(`[TENANT_LEAK_WARN $extends] ${model}.${operation} senza tenantContext — query NON filtrata!`);
        }

        if (!tenantId || !isTenantScoped) {
          return query(args);
        }

        const a: any = args ?? {};

        if (READ_ACTIONS.has(operation)) {
          a.where = { ...(a.where ?? {}), tenantId };
        } else if (operation === 'create') {
          a.data = { ...(a.data ?? {}), tenantId };
        } else if (operation === 'createMany') {
          if (Array.isArray(a.data)) {
            a.data = a.data.map((item: Record<string, unknown>) => ({ ...item, tenantId }));
          } else {
            a.data = { ...(a.data ?? {}), tenantId };
          }
        } else if (UPDATE_ACTIONS.has(operation)) {
          a.where = { ...(a.where ?? {}), tenantId };
          if (operation === 'upsert' && a.create) {
            a.create = { ...a.create, tenantId };
          }
        } else if (DELETE_ACTIONS.has(operation)) {
          a.where = { ...(a.where ?? {}), tenantId };
        }

        return query(a);
      },
    },
  },
});

// Cast back al tipo di basePrisma per mantenere compatibilità coi call site
// esistenti (transazioni, repository, ecc.). Runtime usa l'extended client.
const prisma = extendedPrisma as unknown as typeof basePrisma;

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
