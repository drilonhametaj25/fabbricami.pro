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
// PRISMA MIDDLEWARE PER TENANT ISOLATION (via $extends)
// ============================================
//
// CRITICAL: in Prisma 5.22 `$use` è stato RIMOSSO dal runtime client (anche
// se ancora presente nei .d.ts). Tentare di chiamarlo lancia
// "basePrisma.$use is not a function" — il middleware multi-tenant via $use
// non si registrava mai e tutte le query erano effettivamente NON filtrate
// (causa diretta del data leak: tutti i tenant vedevano gli stessi dati).
//
// Usiamo `$extends` con `$allOperations`, che è l'API ufficiale Prisma 5+
// per query extensions. Funziona in modo equivalente: intercetta ogni
// operazione, può modificare args, e poi chiama `query(args)` per eseguire.
//
// - READ (findMany, findFirst, findUnique, count, aggregate): aggiunge tenantId al WHERE
// - CREATE (create, createMany): aggiunge tenantId ai dati
// - UPDATE (update, updateMany, upsert): aggiunge tenantId al WHERE
// - DELETE (delete, deleteMany): aggiunge tenantId al WHERE

// Mode strict: se TENANT_STRICT_MODE=true, una query verso un modello tenant-scoped
// SENZA tenantContext attivo lancia un'eccezione (con stack trace) invece di
// procedere unfiltered. Utile per debug/produzione per scoprire route che hanno
// bypassato il setup del context.
const TENANT_STRICT_MODE = process.env.TENANT_STRICT_MODE === 'true';

// Log diagnostico minimale: stampa ogni query tenant-scoped con tenantId iniettato
const TENANT_DEBUG_MODE = process.env.TENANT_DEBUG_MODE === 'true';

const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findUnique', 'findFirstOrThrow',
  'findUniqueOrThrow', 'count', 'aggregate', 'groupBy',
]);
const UPDATE_ACTIONS = new Set(['update', 'updateMany', 'upsert']);
const DELETE_ACTIONS = new Set(['delete', 'deleteMany']);

// Difesa contro mock di test: in ambiente Jest il PrismaClient è mockato e
// `$extends` ritorna un OGGETTO DIVERSO dal mock originale che i test settano.
// Risultato: i test trainano metodi su `prismaMock` ma il servizio usa
// `extendedPrisma` (un mock diverso) e non vede gli stub. In test mode
// saltiamo l'extension; il middleware tenant non è oggetto di test in
// quegli unit test (esistono test dedicati a tenant.middleware.test.ts).
const isJestEnv = process.env.NODE_ENV === 'test' || typeof (globalThis as { expect?: unknown }).expect !== 'undefined';
const hasExtends = !isJestEnv && typeof (basePrisma as { $extends?: unknown }).$extends === 'function';

const extendedPrisma = hasExtends
  ? basePrisma.$extends({
      name: 'tenantIsolation',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: { model?: string; operation: string; args: any; query: (a: any) => Promise<any> }) {
            const tenantId = getCurrentTenantId();
            const isTenantScoped = !!model && TENANT_SCOPED_MODELS.includes(model as Prisma.ModelName);

            if (TENANT_DEBUG_MODE && isTenantScoped) {
              // eslint-disable-next-line no-console
              console.error(`[TENANT_MW] ${model}.${operation} tenantId=${tenantId ?? '<NONE>'}`);
            }

            if (!tenantId && isTenantScoped) {
              if (TENANT_STRICT_MODE) {
                const err = new Error(
                  `[TENANT_STRICT] Query ${model}.${operation} senza tenantContext. ` +
                  `Aggiungi authenticate/tenantMiddleware al route o wrappa in runWithTenant().`
                );
                // eslint-disable-next-line no-console
                console.error(err.stack);
                throw err;
              }
              // eslint-disable-next-line no-console
              console.error(`[TENANT_LEAK_WARN] ${model}.${operation} senza tenantContext — query NON filtrata!`);
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
    })
  : basePrisma;

// Cast back al tipo di basePrisma per mantenere compatibilità coi call site
// esistenti (transazioni, repository, ecc.). Runtime usa l'extended client.
const prisma = extendedPrisma as unknown as typeof basePrisma;

// ============================================
// GESTIONE CONNESSIONE
// ============================================

// Skippa $connect in test mode: il PrismaClient è mockato e $connect()
// ritorna undefined (no .then()), oppure cerca di toccare un DB reale.
if (!isJestEnv && typeof (prisma as { $connect?: unknown })?.$connect === 'function') {
  const connectResult = prisma.$connect();
  if (connectResult && typeof connectResult.then === 'function') {
    connectResult
      .then(() => console.log('Database connected'))
      .catch((error: unknown) => {
        console.error('Database connection failed:', error);
        process.exit(1);
      });
  }

  process.on('beforeExit', async () => {
    if (typeof (prisma as { $disconnect?: unknown }).$disconnect === 'function') {
      await prisma.$disconnect();
      console.log('Database disconnected');
    }
  });
}

// ============================================
// EXPORTS
// ============================================

export { prisma, TENANT_SCOPED_MODELS };
export default prisma;
