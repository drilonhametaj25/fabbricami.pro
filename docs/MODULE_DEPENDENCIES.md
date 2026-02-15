# Module Dependencies - EcommerceERP

## Overview

Questo documento descrive le dipendenze tra i moduli del sistema ERP e i loro servizi.

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MODULE DEPENDENCY GRAPH                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌─────────────┐                                    │
│                              │   TENANT    │                                    │
│                              │   (Core)    │                                    │
│                              └──────┬──────┘                                    │
│                                     │                                            │
│            ┌────────────────────────┼────────────────────────┐                  │
│            │                        │                        │                  │
│            ▼                        ▼                        ▼                  │
│     ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            │
│     │    AUTH     │         │SUBSCRIPTION │         │  SETTINGS   │            │
│     │             │         │   (Stripe)  │         │  (Company)  │            │
│     └──────┬──────┘         └─────────────┘         └─────────────┘            │
│            │                                                                     │
│            ▼                                                                     │
│     ┌─────────────┐                                                             │
│     │    USER     │◄────────────────────────────────────────────┐               │
│     │  MANAGEMENT │                                             │               │
│     └──────┬──────┘                                             │               │
│            │                                                     │               │
│            ├───────────────┬───────────────┬───────────────┐    │               │
│            │               │               │               │    │               │
│            ▼               ▼               ▼               ▼    │               │
│     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│     │  PRODUCTS   │ │  CUSTOMERS  │ │  SUPPLIERS  │ │    HR       │            │
│     │  CATALOG    │ │             │ │             │ │ (Employees) │            │
│     └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│            │               │               │               │                    │
│            │               │               │               │                    │
│            ▼               │               │               │                    │
│     ┌─────────────┐        │               │               │                    │
│     │  INVENTORY  │◄───────┤               │               │                    │
│     │             │        │               │               │                    │
│     └──────┬──────┘        │               │               │                    │
│            │               │               │               │                    │
│            ├───────────────┼───────────────┘               │                    │
│            │               │                               │                    │
│            ▼               ▼                               │                    │
│     ┌─────────────┐ ┌─────────────┐                       │                    │
│     │  PURCHASING │ │   ORDERS    │◄──────────────────────┤                    │
│     │             │ │             │                       │                    │
│     └──────┬──────┘ └──────┬──────┘                       │                    │
│            │               │                               │                    │
│            │               ├───────────────────────────────┘                    │
│            │               │                                                    │
│            ▼               ▼                                                    │
│     ┌─────────────┐ ┌─────────────┐                                            │
│     │MANUFACTURING│ │ ACCOUNTING  │                                            │
│     │             │ │  (Invoices) │                                            │
│     └─────────────┘ └──────┬──────┘                                            │
│                            │                                                     │
│                            ▼                                                     │
│                     ┌─────────────┐                                             │
│                     │     SDI     │                                             │
│                     │ (E-Invoice) │                                             │
│                     └─────────────┘                                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Moduli e Servizi

### 1. TENANT (Core)

**Servizi:**
- `tenant.service.ts` - CRUD tenant, setup iniziale
- `tenant-invite.service.ts` - Inviti utenti

**Dipendenze:** Nessuna (modulo base)

**Dipende da questo modulo:**
- Tutti gli altri moduli (via tenantId)

---

### 2. AUTH

**Servizi:**
- `auth.middleware.ts` - JWT validation, role checking

**Dipendenze:**
- Tenant (per tenantId nel JWT)
- User (per validazione utente)

**File principali:**
```
src/server/middleware/auth.middleware.ts
src/server/routes/auth.routes.ts
```

---

### 3. SUBSCRIPTION

**Servizi:**
- `subscription.service.ts` - Gestione abbonamenti
- `billing.service.ts` - Fatturazione
- `stripe.service.ts` - Integrazione Stripe

**Dipendenze:**
- Tenant
- Stripe API (esterno)

**File principali:**
```
src/server/services/subscription.service.ts
src/server/services/billing.service.ts
src/server/services/stripe.service.ts
src/server/routes/subscription.routes.ts
src/server/routes/billing.routes.ts
```

---

### 4. USER MANAGEMENT

**Servizi:**
- Gestione utenti (integrato in auth)
- Employee management

**Dipendenze:**
- Tenant
- Auth

---

### 5. PRODUCTS (Catalog)

**Servizi:**
- `product.service.ts` - CRUD prodotti
- `bom.service.ts` - Bill of Materials

**Dipendenze:**
- Tenant
- Inventory (per stock)
- Supplier (per fornitore principale)

**Usato da:**
- Inventory (per movimenti)
- Orders (per righe ordine)
- Manufacturing (per BOM, fasi)
- Purchasing (per OdA)

**File principali:**
```
src/server/services/product.service.ts
src/server/services/bom.service.ts
src/server/repositories/product.repository.ts
src/server/routes/product.routes.ts
```

---

### 6. MATERIALS

**Servizi:**
- `material.service.ts` - CRUD materiali

**Dipendenze:**
- Tenant
- Supplier (per fornitore)

**Usato da:**
- Manufacturing (per consumo)
- Inventory (per giacenze)
- Purchasing (per approvvigionamento)

**File principali:**
```
src/server/services/material.service.ts
src/server/repositories/material.repository.ts
src/server/routes/material.routes.ts
```

---

### 7. INVENTORY

**Servizi:**
- `inventory.service.ts` - Giacenze, movimenti, previsioni
- `warehouse.service.ts` - Gestione magazzini
- `alert.service.ts` - Alert scorte

**Dipendenze:**
- Tenant
- Products (per prodotti)
- Materials (per materiali)
- Warehouse (per location)

**Usato da:**
- Orders (per disponibilità)
- Manufacturing (per consumo/versamento)
- Purchasing (per riordino)

**File principali:**
```
src/server/services/inventory.service.ts
src/server/services/warehouse.service.ts
src/server/services/alert.service.ts
src/server/repositories/inventory.repository.ts
src/server/routes/inventory.routes.ts
src/server/routes/warehouse.routes.ts
```

---

### 8. CUSTOMERS

**Servizi:**
- `customer.service.ts` - CRUD clienti B2B/B2C
- `pricelist.service.ts` - Listini prezzi

**Dipendenze:**
- Tenant

**Usato da:**
- Orders (per ordini cliente)
- Accounting (per fatturazione)

**File principali:**
```
src/server/services/customer.service.ts
src/server/services/pricelist.service.ts
src/server/repositories/customer.repository.ts
src/server/routes/customer.routes.ts
src/server/routes/pricelist.routes.ts
```

---

### 9. SUPPLIERS

**Servizi:**
- `supplier.service.ts` - CRUD fornitori

**Dipendenze:**
- Tenant

**Usato da:**
- Products (fornitore principale)
- Materials (fornitore principale)
- Purchasing (ordini d'acquisto)
- Manufacturing (lavorazioni esterne)

**File principali:**
```
src/server/services/supplier.service.ts
src/server/repositories/supplier.repository.ts
src/server/routes/supplier.routes.ts
```

---

### 10. ORDERS

**Servizi:**
- `order.service.ts` - Gestione ordini
- `ddt.service.ts` - Documenti di trasporto
- `rma.service.ts` - Resi

**Dipendenze:**
- Tenant
- Customers (per cliente)
- Products (per righe)
- Inventory (per disponibilità)
- PriceList (per prezzi)

**Usato da:**
- Manufacturing (per ordini produzione)
- Accounting (per fatturazione)
- Logistics (per spedizioni)

**File principali:**
```
src/server/services/order.service.ts
src/server/services/ddt.service.ts
src/server/services/rma.service.ts
src/server/repositories/order.repository.ts
src/server/routes/order.routes.ts
src/server/routes/ddt.routes.ts
src/server/routes/rma.routes.ts
```

---

### 11. PURCHASING

**Servizi:**
- `purchase-order.service.ts` - Ordini d'acquisto
- `goods-receipt.service.ts` - Entrata merce
- `three-way-match.service.ts` - Matching PO-GR-Invoice

**Dipendenze:**
- Tenant
- Suppliers (per fornitore)
- Products/Materials (per articoli)
- Inventory (per aggiornamento stock)

**Usato da:**
- Accounting (per fatture fornitori)

**File principali:**
```
src/server/services/purchase-order.service.ts
src/server/services/goods-receipt.service.ts
src/server/services/three-way-match.service.ts
src/server/routes/purchase-order.routes.ts
src/server/routes/goods-receipt.routes.ts
```

---

### 12. MANUFACTURING

**Servizi:**
- `manufacturing.service.ts` - Pipeline produzione, costi
- `operation-type.service.ts` - Tipi operazione
- `mrp.service.ts` - Material Requirements Planning

**Dipendenze:**
- Tenant
- Products (per BOM, fasi)
- Materials (per consumo)
- Inventory (per giacenze, versamento)
- Employees (per operatori)
- Suppliers (per lavorazioni esterne)
- Orders (per ordini collegati)

**File principali:**
```
src/server/services/manufacturing.service.ts
src/server/services/operation-type.service.ts
src/server/services/mrp.service.ts
src/server/routes/manufacturing.routes.ts
src/server/routes/operation-type.routes.ts
```

---

### 13. HR (Human Resources)

**Servizi:**
- `employee.service.ts` - Gestione dipendenti
- `task.service.ts` - Task e assegnazioni
- `calendar.service.ts` - Calendario

**Dipendenze:**
- Tenant
- User (per account utente)

**Usato da:**
- Manufacturing (per operatori)
- Orders (per task ordine)

**File principali:**
```
src/server/services/employee.service.ts
src/server/services/task.service.ts
src/server/services/calendar.service.ts
src/server/routes/employee.routes.ts
src/server/routes/task.routes.ts
src/server/routes/calendar.routes.ts
```

---

### 14. ACCOUNTING

**Servizi:**
- `accounting.service.ts` - Fatturazione, scadenzario
- `reports.service.ts` - Report finanziari

**Dipendenze:**
- Tenant
- Orders (per fatture vendita)
- Customers (per dati cliente)
- Suppliers (per fatture acquisto)
- Purchasing (per three-way match)
- Company Settings (per dati aziendali)

**Usato da:**
- SDI (per invio fatture)

**File principali:**
```
src/server/services/accounting.service.ts
src/server/services/reports.service.ts
src/server/routes/accounting.routes.ts
src/server/routes/reports.routes.ts
```

---

### 15. SDI (Sistema di Interscambio)

**Servizi:**
- `sdi/index.ts` - Orchestratore
- `sdi/fatturapa-xml.service.ts` - Generazione XML
- `sdi/aruba-sdi.service.ts` - Integrazione Aruba

**Dipendenze:**
- Tenant
- Accounting (per fatture)
- Company Settings (per dati mittente)
- Customers (per dati destinatario)

**File principali:**
```
src/server/services/sdi/
src/server/routes/sdi.routes.ts
src/server/jobs/sdi.job.ts
```

---

### 16. NOTIFICATIONS

**Servizi:**
- `notification.service.ts` - Notifiche in-app
- `email.service.ts` - Email transazionali
- `suggestion-engine.service.ts` - Suggerimenti intelligenti

**Dipendenze:**
- Tenant
- User (per destinatario)
- Tutti i moduli (per generare notifiche)

**File principali:**
```
src/server/services/notification.service.ts
src/server/services/email.service.ts
src/server/services/suggestion-engine.service.ts
src/server/routes/notification.routes.ts
```

---

### 17. WORDPRESS INTEGRATION

**Servizi:**
- `wordpress.service.ts` - Sync bidirezionale
- `wordpress-sync.helpers.ts` - Mapping dati

**Dipendenze:**
- Tenant
- Products (per sync prodotti)
- Orders (per sync ordini)
- Inventory (per sync stock)
- WordPress API (esterno)

**File principali:**
```
src/server/services/wordpress.service.ts
src/server/services/wordpress-sync.helpers.ts
src/server/routes/wordpress.routes.ts
src/server/jobs/wordpress.job.ts
```

---

## Matrice delle Dipendenze

| Modulo | Dipende da | Usato da |
|--------|-----------|----------|
| Tenant | - | Tutti |
| Auth | Tenant, User | Tutti |
| Subscription | Tenant, Stripe | - |
| User | Tenant, Auth | HR, Notifications |
| Products | Tenant, Supplier | Inventory, Orders, Manufacturing, Purchasing |
| Materials | Tenant, Supplier | Inventory, Manufacturing, Purchasing |
| Inventory | Tenant, Products, Materials | Orders, Manufacturing, Purchasing |
| Customers | Tenant | Orders, Accounting |
| Suppliers | Tenant | Products, Materials, Purchasing, Manufacturing |
| Orders | Tenant, Customers, Products, Inventory | Manufacturing, Accounting, Logistics |
| Purchasing | Tenant, Suppliers, Products, Materials | Accounting |
| Manufacturing | Tenant, Products, Materials, Inventory, HR, Suppliers | - |
| HR | Tenant, User | Manufacturing, Orders |
| Accounting | Tenant, Orders, Customers, Suppliers | SDI |
| SDI | Tenant, Accounting, Company Settings | - |
| Notifications | Tenant, User | - |
| WordPress | Tenant, Products, Orders, Inventory | - |

---

## Service Layer Dependencies

```
┌──────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     CORE SERVICES                            │ │
│  │                                                              │ │
│  │  tenant.service ← subscription.service                      │ │
│  │        ↑                                                     │ │
│  │        └── auth.middleware                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    DOMAIN SERVICES                           │ │
│  │                                                              │ │
│  │  product.service ──┬──► inventory.service                   │ │
│  │        ↑           │           ↑                             │ │
│  │  material.service ─┘           │                             │ │
│  │        ↑                       │                             │ │
│  │  supplier.service ◄────────────┘                             │ │
│  │                                                              │ │
│  │  customer.service ──► order.service ──► accounting.service  │ │
│  │        ↑                    ↑                   ↑            │ │
│  │  pricelist.service ─────────┘                   │            │ │
│  │                                                  │            │ │
│  │  manufacturing.service ──────────────────────────┘           │ │
│  │        ↑                                                     │ │
│  │  bom.service                                                 │ │
│  │                                                              │ │
│  │  purchase-order.service ──► goods-receipt.service           │ │
│  │                                      ↓                       │ │
│  │                             three-way-match.service          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   SUPPORT SERVICES                           │ │
│  │                                                              │ │
│  │  notification.service ◄── email.service                     │ │
│  │        ↑                                                     │ │
│  │  suggestion-engine.service                                   │ │
│  │                                                              │ │
│  │  sdi.service ◄── fatturapa-xml.service                      │ │
│  │                                                              │ │
│  │  wordpress.service                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Import Guidelines

### Correct Import Pattern

```typescript
// Services can import other services
import { inventoryService } from './inventory.service';

// Services should NOT import repositories from other domains
// ❌ import { orderRepository } from '../repositories/order.repository';

// Use service methods instead
// ✅ const orders = await orderService.getOrdersByProduct(productId);
```

### Circular Dependency Prevention

Per evitare dipendenze circolari, alcuni servizi usano lazy loading:

```typescript
// manufacturing.service.ts
export class ManufacturingService {
  private orderServiceInstance: OrderService | null = null;

  private get orderService(): OrderService {
    if (!this.orderServiceInstance) {
      // Lazy load to avoid circular dependency
      this.orderServiceInstance = require('./order.service').orderService;
    }
    return this.orderServiceInstance;
  }
}
```

---

## Module Activation by Plan

| Module | STARTER | PRO | BUSINESS |
|--------|---------|-----|----------|
| Tenant | Yes | Yes | Yes |
| Auth | Yes | Yes | Yes |
| Products | Yes (1000 max) | Yes (10000) | Yes (unlimited) |
| Materials | No | Yes | Yes |
| Inventory | Yes (1 warehouse) | Yes (3) | Yes (unlimited) |
| Customers | Yes | Yes | Yes |
| Suppliers | Yes | Yes | Yes |
| Orders | Yes (500/month) | Yes (5000) | Yes (unlimited) |
| Purchasing | Yes | Yes | Yes |
| Manufacturing | No | Yes | Yes |
| HR | Basic | Full | Full |
| Accounting | Yes | Yes | Yes |
| SDI | Yes | Yes | Yes |
| WordPress | Yes | Yes | Yes |
| API Access | No | Yes | Yes |
