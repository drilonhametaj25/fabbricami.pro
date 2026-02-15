# API Contracts - EcommerceERP

## Overview

API REST basata su Fastify con autenticazione JWT e validazione Zod.

**Base URL:** `https://api.erpsaas.com/api/v1`
**Documentation:** `/documentation` (Swagger UI), `/redoc` (ReDoc)

---

## Authentication

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### JWT Token Structure

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "tenantId": "uuid",
  "tenantSlug": "acme",
  "planCode": "PRO",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  },
  "metadata": { ... }
}
```

---

## API Endpoints

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Registra nuovo tenant | No |
| POST | `/auth/login` | Login utente | No |
| POST | `/auth/refresh` | Refresh token | No |
| POST | `/auth/verify-email` | Verifica email | No |
| POST | `/auth/forgot-password` | Reset password | No |
| POST | `/auth/reset-password` | Imposta nuova password | No |
| GET | `/auth/me` | Profilo utente corrente | Yes |
| PUT | `/auth/me` | Aggiorna profilo | Yes |

#### POST /auth/register

```json
// Request
{
  "email": "admin@company.com",
  "password": "SecurePassword123!",
  "firstName": "Mario",
  "lastName": "Rossi",
  "companyName": "Acme S.r.l.",
  "tenantSlug": "acme"
}

// Response (201)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "firstName": "Mario",
      "lastName": "Rossi"
    },
    "tenant": {
      "id": "uuid",
      "slug": "acme",
      "name": "Acme S.r.l."
    },
    "subscription": {
      "id": "uuid",
      "planCode": "STARTER",
      "status": "TRIALING",
      "trialEndsAt": "2024-01-15T00:00:00.000Z"
    }
  }
}
```

#### POST /auth/login

```json
// Request
{
  "email": "admin@company.com",
  "password": "SecurePassword123!"
}

// Response (200)
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "role": "ADMIN",
      "tenantId": "uuid"
    }
  }
}
```

---

### Tenant

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/tenant` | Info tenant corrente | Yes | All |
| PUT | `/tenant` | Aggiorna tenant | Yes | ADMIN |
| GET | `/tenant/members` | Lista membri | Yes | ADMIN, MANAGER |
| POST | `/tenant/invite` | Invita utente | Yes | ADMIN |
| DELETE | `/tenant/members/:id` | Rimuovi membro | Yes | ADMIN |

#### GET /tenant

```json
// Response (200)
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "acme",
    "name": "Acme S.r.l.",
    "domain": null,
    "status": "ACTIVE",
    "subscription": {
      "planCode": "PRO",
      "status": "ACTIVE",
      "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
    },
    "limits": {
      "maxUsers": 10,
      "maxWarehouses": 3,
      "maxProducts": 10000,
      "currentUsers": 5,
      "currentWarehouses": 2,
      "currentProducts": 1234
    }
  }
}
```

#### POST /tenant/invite

```json
// Request
{
  "email": "employee@company.com",
  "role": "OPERATORE"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "employee@company.com",
    "role": "OPERATORE",
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

---

### Subscription

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/subscription` | Abbonamento corrente | Yes | ADMIN |
| POST | `/subscription/checkout` | Crea checkout Stripe | Yes | ADMIN |
| POST | `/subscription/portal` | Apri customer portal | Yes | ADMIN |
| PUT | `/subscription/plan` | Cambia piano | Yes | ADMIN |
| DELETE | `/subscription` | Cancella abbonamento | Yes | ADMIN |

#### GET /subscription

```json
// Response (200)
{
  "success": true,
  "data": {
    "id": "uuid",
    "planCode": "PRO",
    "planName": "Pro",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "priceMonthly": 79,
    "priceYearly": 790,
    "billingCycle": "monthly",
    "features": {
      "maxUsers": 10,
      "maxWarehouses": 3,
      "maxProducts": 10000,
      "manufacturing": true,
      "apiAccess": true
    }
  }
}
```

#### POST /subscription/checkout

```json
// Request
{
  "planCode": "BUSINESS",
  "billingCycle": "yearly",
  "successUrl": "https://app.erpsaas.com/billing/success",
  "cancelUrl": "https://app.erpsaas.com/billing"
}

// Response (200)
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_xxx"
  }
}
```

---

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/products` | Lista prodotti | Yes |
| GET | `/products/:id` | Dettaglio prodotto | Yes |
| POST | `/products` | Crea prodotto | Yes |
| PUT | `/products/:id` | Aggiorna prodotto | Yes |
| DELETE | `/products/:id` | Elimina prodotto | Yes |
| GET | `/products/:id/pipeline` | Pipeline produzione | Yes |
| GET | `/products/:id/cost-breakdown` | Breakdown costi | Yes |

#### GET /products

```
Query params:
- page: number (default 1)
- limit: number (default 20, max 100)
- search: string (cerca in sku, name)
- category: string (filtro categoria)
- type: SIMPLE | WITH_VARIANTS | RAW_MATERIAL | DIGITAL
- isActive: boolean
- lowStock: boolean (stock <= reorderPoint)
- sortBy: string (default "createdAt")
- sortOrder: asc | desc (default "desc")
```

```json
// Response (200)
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "sku": "PROD-001",
        "name": "Prodotto Test",
        "type": "SIMPLE",
        "category": "Electronics",
        "cost": 10.50,
        "price": 29.99,
        "minStock": 10,
        "currentStock": 50,
        "reorderPoint": 20,
        "isActive": true,
        "imageUrl": "https://...",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### POST /products

```json
// Request
{
  "sku": "PROD-002",
  "name": "Nuovo Prodotto",
  "type": "SIMPLE",
  "category": "Electronics",
  "description": "Descrizione prodotto",
  "unit": "pz",
  "cost": 15.00,
  "price": 39.99,
  "minStock": 5,
  "reorderPoint": 10,
  "reorderQuantity": 50,
  "leadTimeDays": 7,
  "supplierId": "uuid",
  "taxRate": 22,
  "isActive": true
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "PROD-002",
    "name": "Nuovo Prodotto",
    ...
  }
}
```

---

### Inventory

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/inventory` | Lista giacenze | Yes |
| GET | `/inventory/:productId` | Stock per prodotto | Yes |
| POST | `/inventory/movements` | Crea movimento | Yes |
| GET | `/inventory/movements` | Lista movimenti | Yes |
| POST | `/inventory/transfer` | Trasferisci tra location | Yes |
| GET | `/inventory/forecasts` | Previsioni stock | Yes |

#### GET /inventory

```
Query params:
- warehouseId: uuid
- location: WEB | B2B | EVENTI | TRANSITO
- productId: uuid
- lowStock: boolean
- outOfStock: boolean
- page, limit, sortBy, sortOrder
```

```json
// Response (200)
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "productSku": "PROD-001",
        "productName": "Prodotto Test",
        "warehouseId": "uuid",
        "warehouseName": "Magazzino Principale",
        "location": "WEB",
        "quantity": 50,
        "reservedQuantity": 5,
        "availableQuantity": 45,
        "lotNumber": "LOT-2024-001",
        "expiryDate": null,
        "lastCountDate": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    ...
  }
}
```

#### POST /inventory/movements

```json
// Request
{
  "productId": "uuid",
  "variantId": null,
  "type": "IN",
  "quantity": 100,
  "fromLocation": null,
  "toLocation": "WEB",
  "reference": "PO-2024-001",
  "lotNumber": "LOT-2024-002",
  "notes": "Entrata da ordine fornitore"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "IN",
    "quantity": 100,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/orders` | Lista ordini | Yes |
| GET | `/orders/:id` | Dettaglio ordine | Yes |
| POST | `/orders` | Crea ordine | Yes |
| PUT | `/orders/:id` | Aggiorna ordine | Yes |
| PUT | `/orders/:id/status` | Cambia stato | Yes |
| POST | `/orders/:id/items` | Aggiungi riga | Yes |
| DELETE | `/orders/:id/items/:itemId` | Rimuovi riga | Yes |

#### GET /orders

```
Query params:
- status: PENDING | CONFIRMED | PROCESSING | READY | SHIPPED | DELIVERED | CANCELLED | REFUNDED
- source: WORDPRESS | B2B | MANUAL
- customerId: uuid
- dateFrom: ISO date
- dateTo: ISO date
- page, limit, sortBy, sortOrder
```

#### POST /orders

```json
// Request
{
  "customerId": "uuid",
  "source": "B2B",
  "items": [
    {
      "productId": "uuid",
      "variantId": null,
      "quantity": 5,
      "unitPrice": 29.99,
      "discount": 10
    }
  ],
  "shippingAddress": {
    "firstName": "Mario",
    "lastName": "Rossi",
    "address1": "Via Roma 1",
    "city": "Milano",
    "state": "MI",
    "postcode": "20100",
    "country": "IT"
  },
  "notes": "Consegna urgente"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-2024-00001",
    "status": "PENDING",
    "subtotal": 134.95,
    "discount": 13.50,
    "tax": 26.72,
    "shipping": 0,
    "total": 148.17,
    "items": [...],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Customers

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/customers` | Lista clienti | Yes |
| GET | `/customers/:id` | Dettaglio cliente | Yes |
| POST | `/customers` | Crea cliente | Yes |
| PUT | `/customers/:id` | Aggiorna cliente | Yes |
| DELETE | `/customers/:id` | Elimina cliente | Yes |

#### POST /customers

```json
// Request B2B
{
  "type": "B2B",
  "businessName": "Azienda Cliente S.r.l.",
  "taxId": "IT12345678901",
  "fiscalCode": "12345678901",
  "sdiCode": "M5UXCR1",
  "pecEmail": "pec@azienda.it",
  "email": "ordini@azienda.it",
  "phone": "+39 02 1234567",
  "billingAddress": {
    "address1": "Via Milano 1",
    "city": "Roma",
    "state": "RM",
    "postcode": "00100",
    "country": "IT"
  },
  "paymentTerms": 30,
  "creditLimit": 10000,
  "priceListId": "uuid"
}

// Request B2C
{
  "type": "B2C",
  "firstName": "Mario",
  "lastName": "Rossi",
  "email": "mario.rossi@email.com",
  "phone": "+39 333 1234567"
}
```

---

### Suppliers

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/suppliers` | Lista fornitori | Yes |
| GET | `/suppliers/:id` | Dettaglio fornitore | Yes |
| POST | `/suppliers` | Crea fornitore | Yes |
| PUT | `/suppliers/:id` | Aggiorna fornitore | Yes |
| DELETE | `/suppliers/:id` | Elimina fornitore | Yes |
| GET | `/suppliers/:id/catalog` | Catalogo fornitore | Yes |
| POST | `/suppliers/:id/catalog` | Aggiungi articolo | Yes |

---

### Purchase Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/purchase-orders` | Lista OdA | Yes |
| GET | `/purchase-orders/:id` | Dettaglio OdA | Yes |
| POST | `/purchase-orders` | Crea OdA | Yes |
| PUT | `/purchase-orders/:id` | Aggiorna OdA | Yes |
| POST | `/purchase-orders/:id/send` | Invia a fornitore | Yes |
| POST | `/purchase-orders/:id/receive` | Ricevi merce | Yes |
| DELETE | `/purchase-orders/:id` | Cancella OdA | Yes |

---

### Manufacturing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/production-orders` | Lista ordini produzione | Yes |
| GET | `/production-orders/:id` | Dettaglio | Yes |
| POST | `/production-orders` | Crea ordine produzione | Yes |
| PUT | `/production-orders/:id/status` | Cambia stato | Yes |
| POST | `/production-orders/:id/phases/:phaseId/complete` | Completa fase | Yes |
| GET | `/operation-types` | Lista tipi operazione | Yes |
| GET | `/manufacturing/phases/:productId` | Fasi per prodotto | Yes |

#### POST /production-orders

```json
// Request
{
  "productId": "uuid",
  "quantity": 100,
  "salesOrderId": "uuid",
  "priority": 1,
  "plannedStartDate": "2024-01-15T08:00:00.000Z",
  "notes": "Urgente per cliente VIP"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "PO-2024-00001",
    "productId": "uuid",
    "productName": "Prodotto Finito",
    "quantity": 100,
    "status": "PLANNED",
    "phases": [
      {
        "id": "uuid",
        "sequence": 1,
        "name": "Preparazione",
        "status": "PENDING",
        "estimatedTime": 60
      },
      ...
    ]
  }
}
```

---

### Accounting

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/invoices` | Lista fatture | Yes |
| GET | `/invoices/:id` | Dettaglio fattura | Yes |
| POST | `/invoices` | Crea fattura da ordine | Yes |
| PUT | `/invoices/:id` | Aggiorna fattura | Yes |
| POST | `/invoices/:id/send-sdi` | Invia a SDI | Yes |
| GET | `/invoices/:id/pdf` | Scarica PDF | Yes |
| GET | `/payments-due` | Scadenzario | Yes |
| POST | `/payments-due/:id/payment` | Registra pagamento | Yes |

---

### Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard/today` | Dashboard "Cosa fare oggi" | Yes |
| GET | `/dashboard/kpis` | KPI per periodo | Yes |
| GET | `/dashboard/suggestions` | Suggerimenti intelligenti | Yes |
| POST | `/dashboard/suggestions/:id/dismiss` | Ignora suggerimento | Yes |
| POST | `/dashboard/suggestions/:id/act` | Agisci su suggerimento | Yes |

#### GET /dashboard/today

```json
// Response (200)
{
  "success": true,
  "data": {
    "greeting": {
      "message": "Buongiorno, Mario!",
      "subtitle": "Ecco cosa ti aspetta oggi"
    },
    "dailyKpis": [
      { "label": "Ordini oggi", "value": 12, "trend": "+5%" },
      { "label": "Fatturato", "value": 4523.50, "trend": "+12%" },
      { "label": "In spedizione", "value": 8, "trend": "0%" }
    ],
    "urgentTasks": [
      {
        "id": "uuid",
        "title": "Confermare ordine #1234",
        "priority": "HIGH",
        "dueDate": "2024-01-01T12:00:00.000Z"
      }
    ],
    "dayPlan": {
      "morning": [...],
      "afternoon": [...],
      "completed": 3,
      "total": 10
    },
    "suggestions": {
      "items": [
        {
          "id": "uuid",
          "type": "REORDER",
          "priority": "HIGH",
          "title": "Riordina PROD-001",
          "description": "Stock in esaurimento tra 5 giorni"
        }
      ],
      "stats": {
        "critical": 2,
        "high": 5,
        "medium": 10
      }
    }
  }
}
```

---

### Webhooks (Stripe)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/webhooks/stripe` | Webhook Stripe | Signature |

#### Events Handled

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.trial_will_end`

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_INVALID_TOKEN` | 401 | Token JWT non valido |
| `AUTH_TOKEN_EXPIRED` | 401 | Token scaduto |
| `AUTH_UNAUTHORIZED` | 403 | Permessi insufficienti |
| `TENANT_NOT_FOUND` | 404 | Tenant non trovato |
| `TENANT_SUSPENDED` | 403 | Tenant sospeso |
| `SUBSCRIPTION_INACTIVE` | 402 | Abbonamento non attivo |
| `PLAN_LIMIT_EXCEEDED` | 402 | Limite piano superato |
| `RESOURCE_NOT_FOUND` | 404 | Risorsa non trovata |
| `VALIDATION_ERROR` | 400 | Errore validazione input |
| `DUPLICATE_ENTRY` | 409 | Duplicato (es. SKU) |
| `INTERNAL_ERROR` | 500 | Errore interno server |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 10 req/min per IP |
| API endpoints | 100 req/min per tenant |
| Webhook endpoints | 1000 req/min |

Headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```
