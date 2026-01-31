# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EcommerceERP - Enterprise resource planning system for e-commerce with real-time inventory tracking, production management, accounting, employee management, and custom e-commerce frontend.

**Three main applications:**
1. **ERP Backend** (Fastify API) - Port 3000
2. **ERP Frontend** (Vue 3 SPA) - Port 5173
3. **E-commerce Frontend** (Nuxt 3 SSR) - Port 3001

## Build & Development Commands

```bash
# Development (runs both backend and frontend)
npm run dev

# Individual services
npm run dev:server          # Backend only (tsx watch on port 3000)
npm run dev:client          # Frontend only (Vite on port 5173)
npm run dev:all             # All 3 services (backend + frontend + e-commerce)

# Build
npm run build               # Build both
npm run build:server        # TypeScript compilation → dist/server
npm run build:client        # Vite build → dist/client

# Testing
npm test                    # Jest unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report (80% threshold)
npm run test:e2e            # Vitest E2E tests

# Code Quality
npm run lint                # ESLint
npm run format              # Prettier

# Database (Prisma)
npm run prisma:generate     # Generate Prisma Client
npm run prisma:migrate      # Run migrations
npx prisma db push          # Push schema changes (dev only)
npm run prisma:studio       # Open Prisma Studio GUI
npm run prisma:seed         # Seed database

# Docker
npm run docker:up           # Start all services
npm run docker:down         # Stop services

# E-commerce Frontend (Nuxt 3)
npm run shop:dev            # Start on port 3001 (from root)
npm run shop:build          # Build for production (from root)
```

## Architecture

### Backend (`src/server/`)
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Real-time**: WebSocket
- **Validation**: Zod schemas

```
src/server/
├── config/         # Database, Redis, JWT, Swagger configuration
├── middleware/     # Auth (JWT), validation, error handling, audit
├── routes/         # REST API endpoints
├── services/       # Business logic services
├── repositories/   # Data access layer (Prisma queries)
├── jobs/           # BullMQ background jobs
├── websocket/      # Real-time handlers
└── schemas/        # Zod validation schemas
```

**Key Services**:
- `inventory.service.ts` - Core inventory with forecasting, dead stock detection, margin calculations
- `manufacturing.service.ts` - Production orders, BOM explosion
- `order.service.ts` - Order management with WordPress sync
- `purchase-order.service.ts` - Supplier purchase orders, goods receipt
- `supplier.service.ts` - Supplier management, catalog, performance metrics
- `accounting.service.ts` - Financial operations

### Frontend (`src/client/`)
- **Framework**: Vue 3 Composition API
- **State**: Pinia stores
- **UI**: PrimeVue components
- **Build**: Vite

```
src/client/
├── pages/          # Vue page components
├── components/     # Reusable components
├── stores/         # Pinia stores
├── composables/    # Reusable composition functions
├── services/       # API service layer (api.service.ts)
└── router/         # Vue Router configuration
```

### E-commerce Frontend (`src/ecommerce/`)
- **Framework**: Nuxt 3 with SSR (production) / SPA (development)
- **State**: Pinia stores
- **UI**: Tailwind CSS + Custom components
- **Animations**: GSAP + ScrollTrigger
- **Build**: Vite (via Nuxt)

```
src/ecommerce/
├── pages/              # File-based routing
│   ├── index.vue       # Home page
│   ├── shop/           # Shop & category pages
│   ├── product/        # Product detail [slug].vue
│   ├── account/        # Login, register, profile
│   ├── cart.vue        # Shopping cart
│   └── checkout/       # Checkout flow
├── components/
│   ├── layout/         # Header, Footer, MegaMenu, MobileMenu
│   ├── product/        # ProductCard, ProductGallery
│   ├── cart/           # CartDrawer, CartItem
│   ├── shop/           # ProductFilters, CategoryTree
│   ├── home/           # HeroSection, FeaturedProducts
│   └── common/         # Shared components
├── composables/        # useApi, useGsap, useAuth
├── stores/             # cart, auth, wishlist, checkout
├── plugins/            # gsap.client.ts (client-only)
├── middleware/         # auth.ts (route protection)
├── types/              # TypeScript interfaces
└── assets/css/         # Tailwind + custom styles
```

**Key Configuration** (`nuxt.config.ts`):
- SSR disabled in dev for performance: `ssr: process.env.NODE_ENV === 'production'`
- API base URL: `runtimeConfig.public.apiBase` (default: `http://localhost:3000/api/v1`)
- Component auto-import with prefixes (e.g., `LayoutHeader`, `ShopProductFilters`)

**Shop API Endpoints** (used by e-commerce):
- `GET /api/v1/shop/products` - Product listing with filters
- `GET /api/v1/shop/products/:slug` - Product detail
- `GET /api/v1/shop/categories` - Category tree
- `POST /api/v1/shop/cart/*` - Cart operations
- `POST /api/v1/shop-auth/*` - Customer authentication

### Shared (`src/shared/`)
Common types and constants used across backend and frontend.

## Code Conventions

### Naming
- Database columns: `snake_case` (mapped with `@map()` in Prisma)
- API endpoints: `kebab-case` (e.g., `/api/v1/purchase-orders`)
- TypeScript variables: `camelCase`
- Types/Interfaces: `PascalCase`
- Files: `kebab-case.ts`

### API Response Format
Always use utility functions from `src/server/utils/response.util.ts`:

```typescript
// Success response
return successResponse(reply, data, statusCode);

// Error response
return errorResponse(reply, errorMessage, statusCode);

// Paginated response
return paginatedResponse(reply, items, total, paginationParams);
```

Response structure:
```typescript
{
  success: boolean;
  data: any;
  error?: string;
  metadata: { timestamp: string; version: string; }
}
```

### Validation Schemas (Zod)
Schema format for validation middleware:
```typescript
// CORRECT - Plain object with body/params/query keys
export const createSomethingSchema = {
  body: z.object({
    field: z.string(),
  }),
};

// WRONG - Don't wrap in z.object()
export const wrongSchema = z.object({
  body: z.object({ ... })  // This won't work!
});
```

### Path Aliases
```typescript
import { something } from '@server/services/inventory.service';
import { Component } from '@client/components/Component.vue';
import { Type } from '@shared/types';
```

## User Roles
1. **ADMIN** - Full system access
2. **MANAGER** - Everything except system config
3. **CONTABILE** - Accounting, reporting, customers
4. **MAGAZZINIERE** - Warehouse, inventory movements
5. **OPERATORE** - Assigned tasks, timesheets
6. **COMMERCIALE** - Customers, orders, sales
7. **VIEWER** - Read-only reports

## Key Business Logic

### Inventory Forecasting (`inventory.service.ts`)
- **Product predictions**: Based on actual OrderItems (SHIPPED/DELIVERED status), falls back to inventory movements
- **Material predictions**: Based on MaterialConsumption records, falls back to material movements
- **Dead stock detection**: Products with stock but no orders in 90+ days
- **Margin calculations**: Cost value, retail value, margin percentage
- **Timeline actions**: Grouped by date with REORDER (materials) and PRODUCE (products) suggestions

### Inventory Status Filters
| Filter | Condition |
|--------|-----------|
| CRITICAL | `stock <= 0` OR `stock <= minStock` |
| LOW | `stock <= reorderPoint` |
| REORDER_SOON | `daysUntilStockout <= 30` (based on historical sales) |
| OK | No issues |

### Multi-Warehouse Locations
- `WEB` - E-commerce stock
- `B2B` - B2B wholesale stock
- `EVENTI` - Events/fairs stock
- `TRANSITO` - In-transit stock

### Purchase Orders
- Support for both **products** (finished goods) and **materials** (raw materials)
- `orderType`: MATERIAL, FINISHED_PRODUCT, or MIXED
- Goods receipt updates inventory for products AND material `currentStock`
- Payment terms: 0, 30, 60, 90, 120 days

### Supplier Management
- Address stored as JSON: `{ street, city, province, zip, country }`
- Bank info: `bankName`, `iban`, `swift`
- Performance metrics: on-time delivery rate, quality rating
- Catalog with volume discounts per item

## Database Schema

Key models in `prisma/schema.prisma`:

**Products & Inventory**:
- `Product`, `ProductVariant`, `ProductCategory`
- `Material`, `MaterialMovement`, `MaterialConsumption`
- `InventoryItem`, `InventoryMovement`
- `Warehouse`

**Sales**:
- `Order`, `OrderItem`, `Customer`
- `PriceList`, `PriceListItem`

**Purchasing**:
- `Supplier`, `SupplierItem`, `SupplierVolumeDiscount`
- `PurchaseOrder`, `PurchaseOrderItem`
- `GoodsReceipt`, `GoodsReceiptItem`

**Manufacturing**:
- `ProductionOrder`, `BOM`, `BOMItem`
- `OperationType`, `ManufacturingPhase`

**HR & Operations**:
- `Employee`, `Task`, `Timesheet`
- `Accounting`, `Payment`, `PaymentDue`

## Frontend Patterns

### Date Handling
Always convert dates to ISO strings before sending to backend:
```typescript
const payload = {
  orderDate: formData.orderDate?.toISOString() || new Date().toISOString(),
  expectedDate: formData.expectedDate?.toISOString() || null,
};
```

### JSON Fields (Address, etc.)
Parse JSON fields when loading from backend:
```typescript
if (typeof data.address === 'string') {
  addressData = JSON.parse(data.address);
} else if (typeof data.address === 'object') {
  addressData = data.address;
}
```

### Decimal Fields from Prisma
Prisma returns Decimal as objects - convert to numbers:
```typescript
const total = Number(order.total) || 0;
```

### PrimeVue Dropdowns for Enums
Use Dropdown with options for enum-like selections:
```vue
<Dropdown
  v-model="formData.paymentTerms"
  :options="paymentTermsOptions"
  optionLabel="label"
  optionValue="value"
/>

const paymentTermsOptions = [
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
];
```

## Testing

- Jest for unit tests with 80% coverage threshold
- Test files: `*.test.ts` or `*.spec.ts`
- Run single test: `npm test -- --testPathPattern="filename"`

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET` - Token signing key
- `PORT` - Server port (default 3000)
- `NODE_ENV` - development/staging/production

Engine requirements: Node.js >= 20.0.0, npm >= 10.0.0

## API Documentation

- Swagger UI: http://localhost:3000/documentation
- Redoc: http://localhost:3000/redoc

## WordPress Integration

Sync endpoints:
- `POST /api/v1/wordpress/sync-products` - Sync products to WordPress
- `POST /api/v1/wordpress/sync-inventory` - Update stock levels
- `POST /api/v1/wordpress/webhook/order` - Receive orders from WooCommerce

## Comments Language

Business logic comments are in Italian (the client's language).

## Common Gotchas

### Backend/ERP
1. **Material model uses `sku`, not `code`** - Always use `material.sku` in queries
2. **PurchaseOrder uses `expectedDate`**, frontend may send `expectedDeliveryDate` - map correctly
3. **Validation schema must be plain object**, not wrapped in `z.object()`
4. **successResponse requires reply as first arg**: `successResponse(reply, data, 201)`
5. **Prisma Decimal fields** need `Number()` conversion in frontend
6. **Address is JSON** - parse when reading, stringify when saving if needed

### E-commerce Frontend (Nuxt 3)
1. **Use Node 20+** - Run `nvm use 20` before starting the dev server
2. **GSAP must be client-only** - Use the `gsap.client.ts` plugin, not dynamic imports
3. **SSR is disabled in dev** - For faster HMR; SSR only in production
4. **Component naming**: `components/shop/ProductFilters.vue` → `<ShopProductFilters />`
5. **API response format**: Products are in `data.items`, not `data.products`
6. **Product images**: Use `product.imageUrl` (string) for list, `product.images` (array) for detail
7. **Query params are strings** - Convert to numbers: `parseInt(String(limit), 10)`
