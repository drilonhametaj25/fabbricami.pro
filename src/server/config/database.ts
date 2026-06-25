import { PrismaClient, Prisma } from '@prisma/client';
import { config } from './environment';
import { getCurrentTenantId, isUnscoped } from '../utils/tenant-context';

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
  'ProductMaterial',
  'ProductImage',
  'ProductCategoryAssignment',
  'BomItem',
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
  'CategoryDiscount',
  'CustomerAddress',
  'CustomerContact',
  'CustomerBankInfo',
  // Suppliers
  'Supplier',
  'SupplierItem',
  'SupplierScorecard',
  'SupplierVolumeDiscount',
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
  'OperationTypeEmployee',
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
  // Billing add-ons (il catalogo AddonCatalog è globale; le sottoscrizioni del tenant sono scoped)
  'TenantAddon',
  // WordPress
  'WordPressPluginAuth',
  'WordPressSyncLog',
  // PrestaShop
  'PrestaShopSyncLog',
  // Logistics
  'DDT',
  'DDTItem',
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
  'ShopShippingMethod',
  'ProductReview',
  'LoyaltyAccount',
  'LoyaltyTransaction',
  'AgeVerification',
  'UserEvent',
  'NewsletterSubscription',
];

// ============================================
// NESTED-WRITE TENANT INJECTION (DMMF)
// ============================================
//
// Il middleware $extends inietta tenantId nel `data` top-level di una create,
// ma NON nei nested write (`items: { create: [...] }`). I child models hanno
// tenant_id NOT NULL → senza injection la create fallisce (incident PO/DDT/GR).
//
// Costruiamo da Prisma.dmmf, per ogni modello, la mappa dei campi-relazione il
// cui target è tenant-scoped (relName → targetModel). L'injector ricorsivo
// aggiunge tenantId SOLO a quelle relazioni (mai a modelli globali → niente
// "Unknown argument tenantId").
const SCOPED_RELATIONS: Record<string, Map<string, string>> = {};
try {
  for (const m of (Prisma as any).dmmf.datamodel.models) {
    const map = new Map<string, string>();
    for (const f of m.fields) {
      if (f.kind === 'object' && TENANT_SCOPED_MODELS.includes(f.type as Prisma.ModelName)) {
        map.set(f.name, f.type);
      }
    }
    SCOPED_RELATIONS[m.name] = map;
  }
} catch {
  // DMMF non disponibile in alcuni contesti (es. mock di test): no-op.
}

function injectNestedTenant(modelName: string | undefined, data: any, tenantId: string): void {
  if (!modelName || !data || typeof data !== 'object') return;
  const relations = SCOPED_RELATIONS[modelName];
  if (!relations || relations.size === 0) return;

  const applyToPayload = (payload: any, targetModel: string): void => {
    if (Array.isArray(payload)) {
      payload.forEach((p) => applyToPayload(p, targetModel));
    } else if (payload && typeof payload === 'object') {
      if (payload.tenantId === undefined) payload.tenantId = tenantId;
      injectNestedTenant(targetModel, payload, tenantId); // ricorsione su nested più profondi
    }
  };

  for (const [rel, targetModel] of relations) {
    const nested = data[rel];
    if (!nested || typeof nested !== 'object') continue;
    if (nested.create) applyToPayload(nested.create, targetModel);
    if (nested.createMany?.data) applyToPayload(nested.createMany.data, targetModel);
    if (nested.connectOrCreate) {
      const coc = Array.isArray(nested.connectOrCreate) ? nested.connectOrCreate : [nested.connectOrCreate];
      coc.forEach((c: any) => {
        if (c?.create) applyToPayload(c.create, targetModel);
      });
    }
  }
}

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
            // Bypass esplicito per operazioni cross-tenant/pre-auth fidate.
            if (isUnscoped()) {
              return query(args);
            }

            const tenantId = getCurrentTenantId();
            const isTenantScoped = !!model && TENANT_SCOPED_MODELS.includes(model as Prisma.ModelName);

            if (TENANT_DEBUG_MODE && isTenantScoped) {
              // eslint-disable-next-line no-console
              console.error(`[TENANT_MW] ${model}.${operation} tenantId=${tenantId ?? '<NONE>'}`);
            }

            if (!tenantId && isTenantScoped) {
              // Eccezione esplicita: i flow di registrazione (POST /auth/register)
              // e accept-invite creano User+Tenant atomicamente prima che esista
              // un tenant context. Se il caller fornisce `tenantId` esplicito nel
              // payload di CREATE/createMany, è un'iniezione intenzionale → permetti.
              const explicitCreate =
                (operation === 'create' &&
                  args?.data &&
                  typeof args.data === 'object' &&
                  args.data.tenantId) ||
                (operation === 'createMany' &&
                  args?.data &&
                  (Array.isArray(args.data)
                    ? args.data.every((d: Record<string, unknown>) => d?.tenantId)
                    : (args.data as Record<string, unknown>)?.tenantId));

              if (explicitCreate) {
                // Caller responsabile dell'iniezione tenantId — passa unfiltered.
                return query(args);
              }

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

              // FAILSAFE: anche in modalità non-strict NON lasciamo passare query
              // unfiltered su modelli scoped — sarebbe un data leak garantito
              // (cfr. incident S586 e successivi). Iniettiamo un sentinel
              // `__NO_TENANT_CTX__` come tenantId: i record reali hanno UUID
              // validi, quindi la query ritorna 0 righe. Loggare aggressivamente.
              // eslint-disable-next-line no-console
              console.error(
                `[TENANT_LEAK_WARN] ${model}.${operation} senza tenantContext — applico filtro sentinel ` +
                `(zero-result). Indagare il call site per missing authenticate/runWithTenant.`
              );
              const sentinelArgs: any = args ?? {};
              const SENTINEL = '__NO_TENANT_CTX__';
              if (READ_ACTIONS.has(operation)) {
                sentinelArgs.where = { ...(sentinelArgs.where ?? {}), tenantId: SENTINEL };
              } else if (UPDATE_ACTIONS.has(operation)) {
                sentinelArgs.where = { ...(sentinelArgs.where ?? {}), tenantId: SENTINEL };
              } else if (DELETE_ACTIONS.has(operation)) {
                sentinelArgs.where = { ...(sentinelArgs.where ?? {}), tenantId: SENTINEL };
              }
              // operation create/createMany senza data.tenantId esplicito è già
              // stato eccezionato sopra (`explicitCreate`); se siamo qui significa
              // che NON c'è tenantId esplicito → lascia che Postgres rifiuti con NOT NULL.
              return query(sentinelArgs);
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
              injectNestedTenant(model, a.data, tenantId);
            } else if (operation === 'createMany') {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((item: Record<string, unknown>) => ({ ...item, tenantId }));
              } else {
                a.data = { ...(a.data ?? {}), tenantId };
              }
            } else if (UPDATE_ACTIONS.has(operation)) {
              a.where = { ...(a.where ?? {}), tenantId };
              if (a.data) injectNestedTenant(model, a.data, tenantId); // nested create in update
              if (operation === 'upsert' && a.create) {
                a.create = { ...a.create, tenantId };
                injectNestedTenant(model, a.create, tenantId);
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

// ============================================
// UNSCOPED CLIENT (cross-tenant, pre-auth)
// ============================================
//
// Il client `prisma` di default applica il tenant-isolation middleware: senza
// tenant context attivo, ogni query su modello scoped viene filtrata con un
// sentinel (zero risultati) e ogni create senza tenantId esplicito fallisce.
//
// Alcune operazioni sono LEGITTIMAMENTE cross-tenant e avvengono PRIMA che il
// tenant context esista — non possono altrimenti:
//   - login: lookup utente per email (email è globalmente @unique)
//   - verifica email / reset password: lookup per token
//
// Per questi casi usare `prismaBase` (client non-extended). È security-sensitive:
// usarlo SOLO per lookup di autenticazione, mai per ritornare liste di dati.
const prismaBase = basePrisma as unknown as typeof basePrisma;

export { prisma, prismaBase, TENANT_SCOPED_MODELS };
export default prisma;
