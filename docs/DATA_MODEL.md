# Data Model - EcommerceERP

## Overview

Il database utilizza PostgreSQL con Prisma ORM. Lo schema include **151+ modelli** organizzati in domini funzionali.

---

## Entity Relationship Diagram (Simplified)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CORE ENTITIES                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐         ┌──────────────┐         ┌──────────────┐                 │
│  │  Tenant  │─────────│TenantMember  │─────────│     User     │                 │
│  │          │    1:N  │              │    N:1  │              │                 │
│  └────┬─────┘         └──────────────┘         └──────────────┘                 │
│       │                                               │                          │
│       │ 1:1                                           │ 1:1                      │
│       ▼                                               ▼                          │
│  ┌──────────────┐                            ┌──────────────┐                   │
│  │ Subscription │                            │   Employee   │                   │
│  │              │                            │              │                   │
│  └──────────────┘                            └──────────────┘                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INVENTORY DOMAIN                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┐    1:N    ┌───────────────┐    N:1    ┌─────────────┐            │
│  │  Product  │───────────│ProductVariant │           │  Warehouse  │            │
│  │           │           │               │           │             │            │
│  └─────┬─────┘           └───────────────┘           └──────┬──────┘            │
│        │                                                     │                   │
│        │ 1:N                                                 │ 1:N               │
│        ▼                                                     ▼                   │
│  ┌─────────────────┐                              ┌─────────────────┐           │
│  │  InventoryItem  │──────────────────────────────│InventoryMovement│           │
│  │  (per location) │                              │                 │           │
│  └─────────────────┘                              └─────────────────┘           │
│                                                                                  │
│  ┌───────────┐    1:N    ┌───────────────────┐                                  │
│  │ Material  │───────────│MaterialInventory  │                                  │
│  │           │           │                   │                                  │
│  └─────┬─────┘           └───────────────────┘                                  │
│        │                                                                         │
│        │ 1:N                                                                     │
│        ▼                                                                         │
│  ┌─────────────────┐                                                            │
│  │MaterialMovement │                                                            │
│  └─────────────────┘                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                             ORDER DOMAIN                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┐    1:N    ┌───────────┐    N:1    ┌───────────┐                  │
│  │ Customer  │───────────│   Order   │───────────│  Product  │                  │
│  │           │           │           │           │           │                  │
│  └───────────┘           └─────┬─────┘           └───────────┘                  │
│                                │                                                 │
│                                │ 1:N                                             │
│                                ▼                                                 │
│                          ┌───────────┐                                          │
│                          │ OrderItem │                                          │
│                          │           │                                          │
│                          └───────────┘                                          │
│                                │                                                 │
│                                │ 1:1                                             │
│                                ▼                                                 │
│                          ┌───────────┐                                          │
│                          │  Invoice  │                                          │
│                          └───────────┘                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PURCHASING DOMAIN                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┐    1:N    ┌───────────────┐    1:N    ┌─────────────┐            │
│  │ Supplier  │───────────│PurchaseOrder  │───────────│PurchaseOrder│            │
│  │           │           │               │           │    Item     │            │
│  └───────────┘           └───────┬───────┘           └─────────────┘            │
│                                  │                                               │
│                                  │ 1:N                                           │
│                                  ▼                                               │
│                          ┌───────────────┐    1:N    ┌─────────────┐            │
│                          │ GoodsReceipt  │───────────│GoodsReceipt │            │
│                          │               │           │    Item     │            │
│                          └───────────────┘           └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MANUFACTURING DOMAIN                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────┐    1:N    ┌─────────────────┐    1:N    ┌──────────────┐         │
│  │  Product  │───────────│ManufacturingPhase│──────────│PhaseMaterial │         │
│  │           │           │                  │          │              │         │
│  └───────────┘           └────────┬─────────┘          └──────────────┘         │
│                                   │                                              │
│  ┌───────────────┐    1:N         │                                              │
│  │ProductionOrder│────────────────┘                                              │
│  │               │    1:N    ┌──────────────┐    1:N    ┌──────────────────┐    │
│  └───────┬───────┘───────────│ProductionPhase│──────────│MaterialConsumption│   │
│          │                   │               │          │                  │    │
│          │                   └───────────────┘          └──────────────────┘    │
│          │                                                                       │
│  ┌───────┴───────┐                                                              │
│  │    BomItem    │ (Bill of Materials - recursive)                              │
│  │ parent→child  │                                                              │
│  └───────────────┘                                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Modelli per Dominio

### 1. Multi-Tenancy & Auth (6 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Tenant** | Organizzazione cliente | id, slug, name, domain, status |
| **TenantMember** | Associazione user-tenant | tenantId, userId, role |
| **TenantInvite** | Inviti pendenti | tenantId, email, token, expiresAt |
| **User** | Utenti sistema | email, password, role, isActive |
| **SubscriptionPlan** | Piani abbonamento | code, priceMonthly, priceYearly, limits |
| **Subscription** | Abbonamento tenant | tenantId, planId, stripeSubscriptionId, status |

### 2. Company Settings (1 modello)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **CompanySettings** | Dati aziendali per fatturazione | companyName, vatNumber, fiscalCode, sdiCode, address |

### 3. Warehouse & Locations (1 modello)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Warehouse** | Magazzini fisici | code, name, address, isPrimary |

### 4. Products & Catalog (15 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Product** | Prodotti finiti | sku, name, type, cost, price, minStock |
| **ProductVariant** | Varianti (colore, taglia) | productId, sku, attributes, priceDelta |
| **ProductCategory** | Categorie gerarchiche | name, slug, parentId |
| **ProductCategoryAssignment** | M:N Product-Category | productId, categoryId, isPrimary |
| **ProductImage** | Galleria immagini | productId, src, alt, isMain |
| **ProductMaterial** | Composizione per etichetta | productId, materialId, percentage |
| **ProductOperation** | Cicli di lavorazione | productId, operationName, standardTime |
| **ProductIdeationCost** | Costi R&D/design | productId, type, amount |
| **BomItem** | Bill of Materials | parentProductId, componentProductId, quantity |
| **ShippingClass** | Classi spedizione | name, slug, woocommerceId |
| **WooCommerceAttribute** | Attributi globali | name, slug, type |
| **WooCommerceAttributeTerm** | Valori attributi | attributeId, name, slug |
| **WooCommerceTag** | Tag prodotti | name, slug |
| **InventoryItem** | Giacenza per location | productId, warehouseId, location, quantity |
| **InventoryMovement** | Movimenti stock | productId, type, quantity, reference |

### 5. Materials (4 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Material** | Materie prime | sku, name, cost, currentStock |
| **MaterialInventory** | Giacenza materiali | materialId, warehouseId, quantity |
| **MaterialMovement** | Movimenti materiali | materialId, type, quantity |
| **MaterialConsumption** | Consumo in produzione | productionPhaseId, materialId, actualQuantity |

### 6. Customers (4 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Customer** | Clienti B2B/B2C | type, code, businessName, email, taxId |
| **CustomerContact** | Contatti aziendali | customerId, firstName, lastName, role |
| **CustomerBankInfo** | Dati bancari | customerId, bankName, iban |
| **CustomerAddress** | Indirizzi salvati | customerId, type, address, city |

### 7. Orders & Sales (6 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Order** | Ordini di vendita | orderNumber, customerId, status, total |
| **OrderItem** | Righe ordine | orderId, productId, quantity, unitPrice |
| **OrderNote** | Note ordine | orderId, type, content |
| **OrderRefund** | Rimborsi | orderId, amount, status |
| **OrderRefundItem** | Righe rimborso | refundId, orderItemId, quantity |
| **PriceList** | Listini prezzi | code, name, globalDiscount |

### 8. Purchasing (10 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Supplier** | Fornitori | code, businessName, taxId, paymentTerms |
| **SupplierItem** | Catalogo fornitore | supplierId, productId, lastPurchasePrice |
| **SupplierVolumeDiscount** | Sconti volume | supplierItemId, minQuantity, discountPercent |
| **SupplierScorecard** | Scorecard periodico | supplierId, period, overallScore |
| **PurchaseOrder** | Ordini d'acquisto | orderNumber, supplierId, status, total |
| **PurchaseOrderItem** | Righe OdA | purchaseOrderId, productId, quantity, unitPrice |
| **GoodsReceipt** | Entrata merce | receiptNumber, purchaseOrderId, status |
| **GoodsReceiptItem** | Righe EM | goodsReceiptId, productId, receivedQuantity |
| **SupplierInvoice** | Fatture fornitori | invoiceNumber, supplierId, total |
| **ThreeWayMatch** | Matching PO-GR-Invoice | supplierInvoiceId, purchaseOrderId, status |

### 9. Manufacturing (8 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **OperationType** | Tipi operazione | code, name, defaultHourlyRate |
| **OperationTypeEmployee** | Operatori qualificati | operationTypeId, employeeId |
| **ManufacturingPhase** | Fasi produttive | productId, operationTypeId, sequence |
| **PhaseMaterial** | Materiali per fase | phaseId, materialId, quantity |
| **PhaseEmployee** | Dipendenti per fase | phaseId, employeeId |
| **ProductionOrder** | Ordini produzione | orderNumber, productId, quantity, status |
| **ProductionPhase** | Esecuzione fase | productionOrderId, manufacturingPhaseId, status |
| **Workflow** | Workflow configurabili | name, orderSource, steps |

### 10. Accounting (8 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Invoice** | Fatture vendita | invoiceNumber, customerId, status, total, sdiStatus |
| **Payment** | Pagamenti registrati | invoiceId, amount, method, paymentDate |
| **PaymentPlan** | Piani rateali | code, name |
| **PaymentPlanInstallment** | Rate del piano | paymentPlanId, sequence, percentage |
| **PaymentDue** | Scadenze | type, invoiceId, amount, dueDate, status |
| **PaymentDuePayment** | Pagamenti su scadenza | paymentDueId, amount |
| **OverheadCost** | Costi generali | category, amount, allocationMethod |
| **BillingHistory** | Storico fatturazione SaaS | subscriptionId, amount, status |

### 11. SDI / E-Invoicing (1 modello)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **SdiNotification** | Notifiche SDI | invoiceId, notificationType, messageId |

### 12. HR & Operations (5 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Employee** | Dipendenti | employeeCode, userId, position, hourlyRate |
| **TimeEntry** | Registrazioni orario | employeeId, type, clockIn, clockOut |
| **EmployeeLeave** | Assenze | employeeId, type, startDate, endDate |
| **Task** | Task assegnati | title, orderId, assignedToId, status |
| **TaskOperation** | Operazioni su task | taskId, operationId, actualTime |

### 13. Logistics & Shipping (4 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **DDT** | Documenti di trasporto | ddtNumber, orderId, carrier |
| **DDTItem** | Righe DDT | ddtId, productId, quantity |
| **RMA** | Resi merce | rmaNumber, orderId, status, resolution |
| **RMAItem** | Prodotti in reso | rmaId, productId, quantityRequested |

### 14. Notifications & Alerts (4 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **Notification** | Notifiche utente | userId, type, title, isRead |
| **StockAlert** | Alert scorte | productId, alertType, status |
| **Suggestion** | Suggerimenti intelligenti | type, priority, status, description |
| **CalendarEvent** | Eventi calendario | title, startDate, endDate |

### 15. Audit & System (3 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **AuditLog** | Audit trail | userId, action, entity, changes |
| **DailySummary** | KPI giornalieri | date, ordersCount, ordersTotal |
| **UserDashboardPreference** | Preferenze dashboard | userId, layout |

### 16. Physical Inventory (2 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **PhysicalCountSession** | Sessioni inventario | code, warehouseId, status |
| **PhysicalCountItem** | Conteggi singoli | sessionId, productId, countedQuantity |

### 17. WordPress Integration (3 modelli)

| Modello | Descrizione | Campi Chiave |
|---------|-------------|--------------|
| **WordPressPluginAuth** | Auth plugin WP | username, password |
| **WordPressSyncLog** | Log sincronizzazioni | direction, entity, status |
| **ImportJob** | Job di import | type, status, imported, errors |

---

## Enums

### User & Auth
```prisma
enum UserRole { ADMIN, MANAGER, CONTABILE, MAGAZZINIERE, OPERATORE, COMMERCIALE, VIEWER }
enum TenantStatus { ACTIVE, SUSPENDED, CANCELLED }
enum SubscriptionStatus { TRIALING, ACTIVE, PAST_DUE, CANCELLED, PAUSED }
```

### Products
```prisma
enum ProductType { SIMPLE, WITH_VARIANTS, RAW_MATERIAL, DIGITAL }
enum InventoryLocation { WEB, B2B, EVENTI, TRANSITO }
enum MovementType { IN, OUT, TRANSFER, ADJUSTMENT, PRODUCTION, RETURN }
```

### Orders
```prisma
enum OrderSource { WORDPRESS, B2B, MANUAL }
enum OrderStatus { PENDING, CONFIRMED, PROCESSING, READY, SHIPPED, DELIVERED, CANCELLED, REFUNDED }
enum CustomerType { B2C, B2B }
```

### Purchasing
```prisma
enum PurchaseOrderStatus { DRAFT, SENT, CONFIRMED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED }
enum PurchaseOrderType { MATERIAL, FINISHED_PRODUCT, MIXED }
enum GoodsReceiptStatus { PENDING, PARTIAL, COMPLETED, CANCELLED }
enum ThreeWayMatchStatus { PENDING, MATCHED, DISCREPANCY, APPROVED, REJECTED }
```

### Accounting
```prisma
enum InvoiceType { SALE, PURCHASE }
enum InvoiceStatus { DRAFT, ISSUED, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED }
enum SdiStatus { NOT_SENT, PENDING, DELIVERED, ACCEPTED, REJECTED }
enum PaymentMethod { CASH, BANK_TRANSFER, CREDIT_CARD, PAYPAL, OTHER }
enum PaymentDueType { RECEIVABLE, PAYABLE }
enum PaymentDueStatus { PENDING, PARTIAL, PAID, OVERDUE, CANCELLED }
```

### Manufacturing
```prisma
enum ProductionOrderStatus { DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED }
enum ProductionPhaseStatus { PENDING, IN_PROGRESS, COMPLETED, SKIPPED }
```

### Tasks
```prisma
enum TaskStatus { TODO, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED }
enum TaskPriority { LOW, MEDIUM, HIGH, URGENT }
```

### Notifications
```prisma
enum NotificationType { LOW_STOCK, OUT_OF_STOCK, PAYMENT_DUE, TASK_ASSIGNED, ... }
enum SuggestionType { REORDER, STOCKOUT_ALERT, MARGIN_ALERT, TREND_UP, ... }
enum SuggestionPriority { CRITICAL, HIGH, MEDIUM, LOW }
```

---

## Indici Principali

```prisma
// Performance indexes
@@index([tenantId])                    // Su tutti i modelli
@@index([tenantId, isActive])          // Filtri attivi
@@index([tenantId, createdAt])         // Ordinamento temporale
@@index([tenantId, status])            // Filtri stato

// Unique constraints
@@unique([tenantId, sku])              // Product, Material
@@unique([tenantId, orderNumber])      // Order, PurchaseOrder
@@unique([tenantId, invoiceNumber])    // Invoice
@@unique([tenantId, email])            // Customer (per B2C)
@@unique([tenantId, code])             // Supplier, Customer
```

---

## Relazioni Multi-Tenant

Ogni modello con `tenantId` ha una relazione con `Tenant`:

```prisma
model Product {
  id        String @id @default(uuid())
  tenantId  String @map("tenant_id")
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  // ... altri campi

  @@index([tenantId])
}
```

---

## Migration Strategy

### Da Single-Tenant a Multi-Tenant

1. **Creare modelli Tenant/Subscription**
2. **Aggiungere tenantId (nullable inizialmente)**
3. **Creare tenant di default**
4. **Migrare dati esistenti al tenant default**
5. **Rendere tenantId NOT NULL**
6. **Aggiungere indici**

```sql
-- Step 1: Add nullable column
ALTER TABLE products ADD COLUMN tenant_id UUID;

-- Step 2: Create default tenant
INSERT INTO tenants (id, slug, name) VALUES ('default-uuid', 'default', 'Default Tenant');

-- Step 3: Update existing data
UPDATE products SET tenant_id = 'default-uuid';

-- Step 4: Make NOT NULL
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Add foreign key
ALTER TABLE products ADD CONSTRAINT fk_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Step 6: Add index
CREATE INDEX idx_products_tenant ON products(tenant_id);
```

---

## Data Volume Estimates (per tenant medio)

| Entità | Volume stimato | Growth rate |
|--------|----------------|-------------|
| Products | 1,000-10,000 | +10%/mese |
| Orders | 500-5,000/mese | +15%/mese |
| Customers | 500-5,000 | +5%/mese |
| Inventory Movements | 10,000/mese | +20%/mese |
| Invoices | 500-2,000/mese | +10%/mese |
