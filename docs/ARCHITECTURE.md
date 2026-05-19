# Architettura FabbricaMi.pro SaaS

## Overview

FabbricaMi.pro è un sistema gestionale multi-tenant per e-commerce con produzione, progettato per aziende che vendono tramite WordPress/WooCommerce e hanno processi produttivi interni.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ARCHITETTURA C4                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Landing    │     │   ERP App    │     │       WordPress          │ │
│  │   (Next.js)  │     │   (Vue 3)    │     │     (WooCommerce)        │ │
│  │   :3001      │     │   :5173      │     │       External           │ │
│  └──────┬───────┘     └──────┬───────┘     └────────────┬─────────────┘ │
│         │                    │                          │               │
│         │  ┌─────────────────┴──────────────────────────┤               │
│         │  │                                            │               │
│         ▼  ▼                                            ▼               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        API Gateway (Fastify)                        │ │
│  │                             :3000                                   │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────────────────┐ │ │
│  │  │ Auth        │ Tenant      │ Subscription│ Rate Limit          │ │ │
│  │  │ Middleware  │ Middleware  │ Middleware  │ Middleware          │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│         ┌──────────────────────────┼──────────────────────────┐        │
│         │                          │                          │        │
│         ▼                          ▼                          ▼        │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│  │  Services   │           │  Repositories│          │    Jobs     │   │
│  │  (56+)      │           │  (15)        │          │  (BullMQ)   │   │
│  └──────┬──────┘           └──────┬──────┘           └──────┬──────┘   │
│         │                         │                         │          │
│         └─────────────────────────┼─────────────────────────┘          │
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Data Layer                                  │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │ │
│  │  │ PostgreSQL  │    │   Redis     │    │    File Storage         │ │ │
│  │  │ (Prisma)    │    │  (Cache +   │    │   (PDF/XML/Images)      │ │ │
│  │  │ 151 Models  │    │   Queues)   │    │                         │ │ │
│  │  └─────────────┘    └─────────────┘    └─────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnologico

### Backend
| Componente | Tecnologia | Versione |
|------------|------------|----------|
| Runtime | Node.js | >= 20.0.0 |
| Framework | Fastify | 4.28.x |
| ORM | Prisma | 5.19.x |
| Database | PostgreSQL | 15+ |
| Cache/Queue | Redis + BullMQ | 5.x |
| Validation | Zod | 3.23.x |
| Auth | JWT (@fastify/jwt) | 8.x |
| Payments | Stripe | 14.x |

### Frontend ERP (Vue)
| Componente | Tecnologia | Versione |
|------------|------------|----------|
| Framework | Vue 3 | 3.5.x |
| State | Pinia | 2.2.x |
| Router | Vue Router | 4.4.x |
| UI | PrimeVue | 3.53.x |
| Build | Vite | 5.4.x |

### Landing Site (Next.js)
| Componente | Tecnologia | Versione |
|------------|------------|----------|
| Framework | Next.js | 14+ |
| Styling | Tailwind CSS | 3.x |
| Content | MDX | 2.x |

---

## Struttura Directory

```
fabbricami-pro/
├── docs/                       # Documentazione
│   ├── ARCHITECTURE.md         # Questo file
│   ├── DATA_MODEL.md           # Schema ER
│   ├── MODULE_DEPENDENCIES.md  # Dipendenze moduli
│   ├── API_CONTRACTS.md        # API REST
│   ├── CONVENTIONS.md          # Convenzioni codice
│   └── CHANGELOG.md            # Log modifiche
│
├── prisma/
│   ├── schema.prisma           # Schema database (151+ modelli)
│   ├── migrations/             # Migrazioni database
│   ├── seed.ts                 # Seed iniziale
│   └── seed-demo.ts            # Seed demo
│
├── src/
│   ├── server/                 # Backend Fastify
│   │   ├── config/             # Configurazioni
│   │   │   ├── database.ts     # Prisma client + tenant middleware
│   │   │   ├── redis.ts        # Redis client
│   │   │   ├── environment.ts  # Env validation (Zod)
│   │   │   ├── swagger.ts      # OpenAPI docs
│   │   │   └── features.ts     # Feature flags + init
│   │   │
│   │   ├── middleware/         # Middleware Fastify
│   │   │   ├── auth.middleware.ts        # JWT + roles
│   │   │   ├── tenant.middleware.ts      # Tenant isolation
│   │   │   ├── subscription.middleware.ts # Plan limits
│   │   │   ├── validation.middleware.ts  # Zod validation
│   │   │   ├── audit.middleware.ts       # Audit logging
│   │   │   └── error.middleware.ts       # Error handling
│   │   │
│   │   ├── routes/             # API Routes (39+ file)
│   │   │   ├── auth.routes.ts
│   │   │   ├── tenant.routes.ts
│   │   │   ├── subscription.routes.ts
│   │   │   ├── product.routes.ts
│   │   │   ├── order.routes.ts
│   │   │   └── ... (36+ altri)
│   │   │
│   │   ├── services/           # Business Logic (56+ file)
│   │   │   ├── tenant.service.ts
│   │   │   ├── subscription.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── manufacturing.service.ts
│   │   │   └── ... (52+ altri)
│   │   │
│   │   ├── repositories/       # Data Access (15 file)
│   │   │   ├── product.repository.ts
│   │   │   ├── order.repository.ts
│   │   │   └── ... (13 altri)
│   │   │
│   │   ├── jobs/               # Background Jobs
│   │   │   ├── email.job.ts
│   │   │   ├── notification.job.ts
│   │   │   ├── subscription.job.ts
│   │   │   └── ... (4+ altri)
│   │   │
│   │   ├── schemas/            # Zod Schemas
│   │   ├── utils/              # Utilities
│   │   └── index.ts            # Entry point
│   │
│   ├── client/                 # Frontend Vue
│   │   ├── pages/              # 29 pagine
│   │   ├── components/         # 88 componenti
│   │   ├── stores/             # 8+ Pinia stores
│   │   ├── composables/        # 7 composables
│   │   ├── services/           # API client
│   │   ├── router/             # Vue Router
│   │   └── App.vue
│   │
│   ├── landing/                # Landing Site (Next.js)
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   └── content/            # MDX blog posts
│   │
│   └── shared/                 # Codice condiviso
│       └── types/              # TypeScript types
│
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── CLAUDE.md                   # Istruzioni per Claude Code
```

---

## Multi-Tenancy Architecture

### Row-Level Security Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. HTTP Request                                                 │
│       ↓                                                          │
│  2. Auth Middleware                                              │
│       └─→ Extract JWT → Validate → Get userId, tenantId, role   │
│       ↓                                                          │
│  3. Tenant Middleware                                            │
│       └─→ Set tenantId in AsyncLocalStorage                     │
│       ↓                                                          │
│  4. Subscription Middleware                                      │
│       └─→ Check plan active → Check feature limits              │
│       ↓                                                          │
│  5. Route Handler                                                │
│       └─→ Call Service → Call Repository                        │
│       ↓                                                          │
│  6. Prisma Middleware (Auto-inject tenantId)                    │
│       └─→ WHERE tenantId = ? → INSERT tenantId = ?              │
│       ↓                                                          │
│  7. PostgreSQL                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tenant Data Isolation

```typescript
// Ogni query include automaticamente il tenantId
prisma.product.findMany({ where: { isActive: true } })
// Diventa automaticamente:
// SELECT * FROM products WHERE is_active = true AND tenant_id = 'xxx'

// Ogni insert include automaticamente il tenantId
prisma.product.create({ data: { name: 'Test', sku: 'SKU001' } })
// Diventa automaticamente:
// INSERT INTO products (name, sku, tenant_id) VALUES ('Test', 'SKU001', 'xxx')
```

---

## Authentication & Authorization

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

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| ADMIN | Amministratore tenant | Full access + billing |
| MANAGER | Manager | Everything except billing/settings |
| CONTABILE | Contabilità | Accounting, invoices, reports |
| MAGAZZINIERE | Magazzino | Inventory, warehouses, movements |
| OPERATORE | Operatore | Tasks, production, timesheets |
| COMMERCIALE | Sales | Customers, orders, sales |
| VIEWER | Sola lettura | Read-only reports |

---

## Subscription Plans

### Plan Features Matrix

| Feature | STARTER | PRO | BUSINESS |
|---------|---------|-----|----------|
| Utenti | 3 | 10 | Unlimited |
| Magazzini | 1 | 3 | Unlimited |
| Prodotti | 1,000 | 10,000 | Unlimited |
| Ordini/mese | 500 | 5,000 | Unlimited |
| Manufacturing | No | Si | Si |
| Multi-location | No | Si | Si |
| SDI/FatturaPA | Si | Si | Si |
| API Access | No | Si | Si |
| WordPress Sync | Si | Si | Si |
| Support | Email | Priority | Dedicated |

### Pricing

| Plan | Monthly | Yearly (-2 months) |
|------|---------|-------------------|
| STARTER | €29 | €290 |
| PRO | €79 | €790 |
| BUSINESS | €199 | €1,990 |

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       ERP MODULES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  INVENTORY  │  │   ORDERS    │  │      PURCHASING         │  │
│  │  - Products │  │  - B2B/B2C  │  │  - Suppliers            │  │
│  │  - Materials│  │  - Pricing  │  │  - Purchase Orders      │  │
│  │  - Movements│  │  - Shipments│  │  - Goods Receipt        │  │
│  │  - Forecasts│  │  - Returns  │  │  - 3-Way Matching       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────────┐  │
│  │MANUFACTURING│  │  ACCOUNTING │  │         HR              │  │
│  │  - BOM      │  │  - Invoices │  │  - Employees            │  │
│  │  - Phases   │  │  - SDI      │  │  - Tasks                │  │
│  │  - Costing  │  │  - Payments │  │  - Timesheets           │  │
│  │  - Schedule │  │  - Due Dates│  │  - Calendar             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      INTEGRATIONS                            │ │
│  │  - WordPress/WooCommerce Sync                                │ │
│  │  - Stripe Payments                                           │ │
│  │  - SDI (Sistema di Interscambio) for Italian e-invoicing    │ │
│  │  - Email (SMTP)                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Background Jobs (BullMQ)

| Queue | Job | Schedule | Description |
|-------|-----|----------|-------------|
| email | send | On demand | Send transactional emails |
| notification | check-low-stock | Every 6 hours | Check inventory levels |
| notification | check-payments-due | Daily 9:00 | Check payment deadlines |
| stock-alert | check-alerts | Every 4 hours | Generate stock alerts |
| stock-alert | check-expiring-lots | Daily | Check expiring batches |
| subscription | sync-status | Every hour | Sync Stripe subscription status |
| suggestion | generate | Every 12 hours | Generate smart suggestions |
| sdi | process | On demand | Process SDI invoices |
| wordpress | sync | On demand | Sync products to WooCommerce |

---

## API Design

### Base URL
```
Production: https://api.erpsaas.com/api/v1
Development: http://localhost:3000/api/v1
```

### Authentication
```http
Authorization: Bearer <jwt_token>
X-Tenant-Id: <tenant_uuid>  # Optional, extracted from JWT
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Pagination
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

## Security Considerations

### Data Isolation
- Row-level security via Prisma middleware
- All queries filtered by tenantId
- Audit logging for sensitive operations

### Authentication
- JWT tokens with short expiry (15 min)
- Refresh tokens with longer expiry (7 days)
- Password hashing with bcrypt (10 rounds)

### API Security
- Rate limiting per tenant/IP
- Input validation with Zod
- SQL injection protection via Prisma
- XSS protection headers
- CORS configuration

### Compliance
- GDPR compliant (EU data)
- Italian e-invoicing (SDI) compliant
- Audit trail for all changes

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Vercel    │ ← Landing Site (Next.js)                       │
│  │   CDN       │   www.erpsaas.com                              │
│  └──────┬──────┘                                                │
│         │                                                        │
│  ┌──────┴──────┐                                                │
│  │  Cloudflare │ ← CDN + WAF + DDoS Protection                  │
│  │             │                                                 │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ├─────────────────────────────────────┐                 │
│         │                                     │                 │
│  ┌──────┴──────┐                      ┌───────┴──────┐         │
│  │   Docker    │                      │    Vercel    │         │
│  │   (Railway/ │                      │    or S3     │         │
│  │   Render)   │                      │              │         │
│  │             │                      │   Vue SPA    │         │
│  │  Fastify    │                      │   app.erpsaas│         │
│  │  API        │                      │   .com       │         │
│  │  :3000      │                      │              │         │
│  └──────┬──────┘                      └──────────────┘         │
│         │                                                        │
│         ├──────────────────────┬──────────────────┐             │
│         │                      │                  │             │
│  ┌──────┴──────┐       ┌───────┴──────┐   ┌──────┴──────┐      │
│  │ PostgreSQL  │       │    Redis     │   │    S3/R2    │      │
│  │ (Neon/      │       │   (Upstash)  │   │   (Files)   │      │
│  │  Supabase)  │       │              │   │             │      │
│  └─────────────┘       └──────────────┘   └─────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

### Metrics
- Request latency (p50, p95, p99)
- Error rates per endpoint
- Active tenants
- Database query performance

### Logging
- Structured JSON logging (Pino)
- Request/response logging
- Error tracking with stack traces
- Audit logs for compliance

### Alerting
- High error rate alerts
- Database connection issues
- Queue backlog alerts
- Subscription payment failures

---

## Development Workflow

```bash
# Setup
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed

# Development
npm run dev              # Backend + Frontend
npm run dev:server       # Backend only
npm run dev:client       # Frontend only

# Testing
npm test                 # Unit tests
npm run test:e2e         # E2E tests

# Build
npm run build            # Production build

# Database
npm run prisma:studio    # GUI for database
npm run prisma:migrate   # Run migrations
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | TBD | Initial SaaS release |
| 0.9.0 | Current | Single-tenant ERP |
