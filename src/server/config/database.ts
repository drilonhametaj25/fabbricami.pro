import { PrismaClient, Prisma } from '@prisma/client';
import { config } from './environment';
import { getCurrentTenantId } from '../utils/tenant-context';

// ============================================
// TENANT-SCOPED MODELS
// ============================================
//
// Lista esaustiva dei modelli che richiedono filtering automatico per tenant.
// Il middleware $extends sotto inietta `tenantId` in where/data per ogni
// operazione sui modelli qui elencati. I modelli NON elencati sono "globali"
// (gestione tenant/SaaS/sistema, super-admin) o sono child models che
// derivano scoping dalla FK al padre + RLS a livello DB.
const TENANT_SCOPED_MODELS: Prisma.ModelName[] = [
  // Core
  'User',
  'CompanySettings',
  'Warehouse',
  // Materials
  'Material',
  'MaterialInventory',
  'MaterialMovement',
  'MaterialConsumption',
  // Products
  'Product',
  'ProductCategory',
  'ProductVariant',
  'ProductIdeationCost',
  'ProductOperation',
  // Inventory
  'InventoryItem',
  'InventoryMovement',
  'ShippingClass',
  'WooCommerceAttribute',
  'WooCommerceAttributeTerm',
  'WooCommerceTag',
  // Customers
  'Customer',
  'PriceList',
  'PriceListItem',
  'CustomerAddress',
  'CustomerContact',
  'CustomerBankInfo',
  // Suppliers
  'Supplier',
  'SupplierItem',
  'SupplierScorecard',
  // Orders
  'Order',
  'OrderItem',
  'OrderNote',
  'OrderRefund',
  'OrderRefundItem',
  // Purchasing
  'PurchaseOrder',
  'PurchaseOrderItem',
  'GoodsReceipt',
  'GoodsReceiptItem',
  'ThreeWayMatch',
  // Invoicing
  'Invoice',
  'SupplierInvoice',
  'SupplierInvoiceItem',
  // Payments
  'PaymentPlan',
  'PaymentDue',
  'Payment',
  'PaymentDuePayment',
  'PaymentPlanInstallment',
  'OverheadCost',
  // HR
  'Employee',
  'TimeEntry',
  'EmployeeLeave',
  'Task',
  'TaskOperation',
  'Workflow',
  'OperationType',
  // Manufacturing
  'ManufacturingPhase',
  'PhaseMaterial',
  'PhaseEmployee',
  'ProductionOrder',
  'ProductionPhase',
  // Notifications & System
  'Notification',
  'CalendarEvent',
  'StockAlert',
  'AuditLog',
  'Suggestion',
  'DailySummary',
  'UserDashboardPreference',
  'PhysicalCountSession',
  'PhysicalCountItem',
  'ScheduledReport',
  'ImportJob',
  // WordPress
  'WordPressPluginAuth',
  'WordPressSyncLog',
  // Logistics
  'DDT',
  'RMA',
  'RMAItem',
  // E-commerce
  'ShoppingCart',
  'CartItem',
  'WishlistItem',
  'Coupon',
  'CouponUsage',
  'PaymentTransaction',
  'ShopShippingZone',
  'ProductReview',
  'LoyaltyAccount',
  'AgeVerification',
  'UserEvent',
  'NewsletterSubscription',
];

// Modelli esplicitamente GLOBALI (gestione SaaS/sistema/super-admin):
// - Tenant, TenantMember, TenantInvite
// - SubscriptionPlan, SaasSubscription, BillingHistory
// - SystemSetting, SuperAdmin, SuperAdminAuditLog
// - SignupCoupon, SignupCouponUsage, Ticket
// - WordPressTenantConfig (FK unique a Tenant, comportamento equivalente)

// ============================================
// PRISMA CLIENT
// ============================================

const basePrisma = new PrismaClient({
  log: config.isDevelopment
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty',
});

// ============================================
// MIDDLEWARE — TENANT ISOLATION via $extends
// ============================================
//
// STRATO 2 (applicativo): intercetta ogni operazione ORM, inietta tenantId
// nel `where` per READ/UPDATE/DELETE e nel `data` per CREATE.
//
// STRATO 3 (DB-level RLS): esegue `set_config('app.tenant_id', ...)` prima
// di ogni query così le POLICY RLS attive vedono il tenant corrente.
// session-scope (`set_config(_, _, false)`): persiste sulla connection
// finché non sostituito. Race possibile se il pool Prisma riusa la connection
// tra request DIVERSE senza che il middleware abbia eseguito SET prima della
// query — è il motivo per cui questa è "defense-in-depth", non difesa primaria.
//
// In ambiente Jest skippiamo $extends: i mock fixture vengono shadow dal client
// extended (oggetto diverso) — la suite di test dedicata a tenant isolation
// usa DB reale.

const TENANT_STRICT_MODE = process.env.TENANT_STRICT_MODE === 'true';
const TENANT_DEBUG_MODE = process.env.TENANT_DEBUG_MODE === 'true';

const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findUnique', 'findFirstOrThrow',
  'findUniqueOrThrow', 'count', 'aggregate', 'groupBy',
]);
const UPDATE_ACTIONS = new Set(['update', 'updateMany', 'upsert']);
const DELETE_ACTIONS = new Set(['delete', 'deleteMany']);

const isJestEnv = process.env.NODE_ENV === 'test' || typeof (globalThis as { expect?: unknown }).expect !== 'undefined';
const hasExtends = !isJestEnv && typeof (basePrisma as { $extends?: unknown }).$extends === 'function';

// Cache: evita di ri-eseguire set_config sulla stessa connection con stesso
// tenant in rapida sequenza. Best-effort — non garantisce correctness se la
// connection viene riassegnata; serve solo a ridurre l'overhead.
let lastSetTenantId: string | undefined;

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
                  `Aggiungi authenticate/tenantMiddleware/shopTenantMiddleware al route, ` +
                  `oppure wrappa in runWithTenant().`
                );
                // eslint-disable-next-line no-console
                console.error(err.stack);
                throw err;
              }
              // eslint-disable-next-line no-console
              console.error(`[TENANT_LEAK_WARN] ${model}.${operation} senza tenantContext — query NON filtrata!`);
            }

            // STRATO 3: imposta `app.tenant_id` per RLS Postgres. Session-scope:
            // persiste sulla connection corrente. Skip se identico all'ultimo
            // set (best-effort cache).
            if (tenantId && lastSetTenantId !== tenantId) {
              try {
                await basePrisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
                lastSetTenantId = tenantId;
              } catch (rlsErr) {
                // Pre-RLS deploy: la setting potrebbe non essere riconosciuta.
                // Loggare ma non bloccare — Strato 2 è la difesa primaria.
                if (TENANT_DEBUG_MODE) {
                  // eslint-disable-next-line no-console
                  console.error(`[TENANT_RLS] set_config failed: ${String(rlsErr)}`);
                }
              }
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
// CONNECTION LIFECYCLE
// ============================================

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
