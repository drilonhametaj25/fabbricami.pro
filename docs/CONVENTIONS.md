# Code Conventions - EcommerceERP

## Overview

Questo documento definisce le convenzioni di codice per il progetto EcommerceERP.

---

## Naming Conventions

### TypeScript/JavaScript

| Elemento | Convenzione | Esempio |
|----------|-------------|---------|
| Variabili | camelCase | `productName`, `totalAmount` |
| Costanti | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Funzioni | camelCase | `calculateTotal()`, `getUserById()` |
| Classi | PascalCase | `ProductService`, `OrderRepository` |
| Interfacce | PascalCase (con prefix I opzionale) | `Product`, `IProductService` |
| Types | PascalCase | `OrderStatus`, `CreateProductInput` |
| Enums | PascalCase | `UserRole`, `OrderSource` |
| Enum Values | UPPER_SNAKE_CASE | `IN_PROGRESS`, `LOW_STOCK` |

### File Names

| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| Services | kebab-case.service.ts | `inventory.service.ts` |
| Routes | kebab-case.routes.ts | `purchase-order.routes.ts` |
| Repositories | kebab-case.repository.ts | `product.repository.ts` |
| Middleware | kebab-case.middleware.ts | `auth.middleware.ts` |
| Schemas | kebab-case.schema.ts | `customer.schema.ts` |
| Utils | kebab-case.util.ts | `response.util.ts` |
| Jobs | kebab-case.job.ts | `email.job.ts` |
| Vue Components | PascalCase.vue | `ProductDialog.vue` |
| Vue Pages | PascalCase.vue | `Inventory.vue` |
| Stores | kebab-case.store.ts | `auth.store.ts` |
| Composables | useCamelCase.ts | `usePagination.ts` |

### Database (Prisma)

| Elemento | Convenzione | Mapping |
|----------|-------------|---------|
| Model Names | PascalCase | `ProductVariant` |
| Table Names | snake_case | `@@map("product_variants")` |
| Column Names | snake_case | `@map("created_at")` |
| Relations | camelCase | `productVariants`, `parentProduct` |

```prisma
model ProductVariant {
  id        String  @id @default(uuid())
  productId String  @map("product_id")
  createdAt DateTime @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id])

  @@map("product_variants")
}
```

### API Endpoints

| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| Resource | kebab-case, plurale | `/purchase-orders`, `/customers` |
| Actions | verbo HTTP | `POST /orders` (create), `PUT /orders/:id` (update) |
| Sub-resources | nested | `/orders/:id/items` |
| Filters | query params | `/products?category=electronics&isActive=true` |

---

## Code Structure

### Backend Service Structure

```typescript
// src/server/services/example.service.ts

import { prisma } from '../config/database';
import { tenantContext } from '../config/database';
import { ExampleCreateInput, ExampleUpdateInput } from '../schemas/example.schema';

class ExampleService {
  /**
   * Lista con paginazione e filtri
   */
  async list(params: ListParams): Promise<PaginatedResult<Example>> {
    const { page = 1, limit = 20, search, isActive } = params;

    const where: Prisma.ExampleWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await Promise.all([
      prisma.example.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.example.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Ottieni singolo elemento
   */
  async getById(id: string): Promise<Example | null> {
    return prisma.example.findUnique({ where: { id } });
  }

  /**
   * Crea nuovo elemento
   */
  async create(data: ExampleCreateInput): Promise<Example> {
    return prisma.example.create({ data });
  }

  /**
   * Aggiorna elemento
   */
  async update(id: string, data: ExampleUpdateInput): Promise<Example> {
    return prisma.example.update({ where: { id }, data });
  }

  /**
   * Elimina elemento (soft delete)
   */
  async delete(id: string): Promise<Example> {
    return prisma.example.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const exampleService = new ExampleService();
```

### Backend Route Structure

```typescript
// src/server/routes/example.routes.ts

import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { exampleService } from '../services/example.service';
import {
  createExampleSchema,
  updateExampleSchema,
  listExampleSchema,
} from '../schemas/example.schema';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response.util';

const exampleRoutes: FastifyPluginAsync = async (server) => {
  // Lista
  server.get('/', {
    preHandler: [authenticate],
    schema: { querystring: listExampleSchema.query },
  }, async (request, reply) => {
    const result = await exampleService.list(request.query);
    return paginatedResponse(reply, result.items, result.total, request.query);
  });

  // Dettaglio
  server.get('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await exampleService.getById(id);
    if (!item) {
      return errorResponse(reply, 'Not found', 404);
    }
    return successResponse(reply, item);
  });

  // Crea
  server.post('/', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(createExampleSchema)],
  }, async (request, reply) => {
    const item = await exampleService.create(request.body);
    return successResponse(reply, item, 201);
  });

  // Aggiorna
  server.put('/:id', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(updateExampleSchema)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await exampleService.update(id, request.body);
    return successResponse(reply, item);
  });

  // Elimina
  server.delete('/:id', {
    preHandler: [authenticate, authorize('ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await exampleService.delete(id);
    return successResponse(reply, { deleted: true });
  });
};

export default exampleRoutes;
```

### Validation Schema Structure

```typescript
// src/server/schemas/example.schema.ts

import { z } from 'zod';

// Schema per creazione
export const createExampleSchema = {
  body: z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
  }),
};

// Schema per aggiornamento
export const updateExampleSchema = {
  body: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
};

// Schema per lista
export const listExampleSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    sortBy: z.enum(['name', 'code', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

// Types derivati
export type CreateExampleInput = z.infer<typeof createExampleSchema.body>;
export type UpdateExampleInput = z.infer<typeof updateExampleSchema.body>;
export type ListExampleParams = z.infer<typeof listExampleSchema.query>;
```

---

## Vue/Frontend Conventions

### Component Structure

```vue
<!-- src/client/components/ExampleDialog.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import type { Example } from '@/types';

// Props
interface Props {
  visible: boolean;
  example?: Example | null;
}
const props = withDefaults(defineProps<Props>(), {
  example: null,
});

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved', example: Example): void;
}>();

// State
const formData = ref<Partial<Example>>({});
const isSubmitting = ref(false);

// Composables
const { success, error } = useToast();

// Computed
const isEditing = computed(() => !!props.example?.id);
const dialogTitle = computed(() => isEditing.value ? 'Modifica' : 'Nuovo');

// Watchers
watch(() => props.visible, (newVal) => {
  if (newVal) {
    formData.value = props.example ? { ...props.example } : {};
  }
});

// Methods
const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    // API call
    success('Salvato');
    emit('saved', formData.value as Example);
    emit('update:visible', false);
  } catch (e) {
    error('Errore durante il salvataggio');
  } finally {
    isSubmitting.value = false;
  }
};

const handleClose = () => {
  emit('update:visible', false);
};
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    modal
    @update:visible="handleClose"
  >
    <form @submit.prevent="handleSubmit">
      <!-- Form fields -->
    </form>

    <template #footer>
      <Button label="Annulla" @click="handleClose" />
      <Button label="Salva" type="submit" :loading="isSubmitting" />
    </template>
  </Dialog>
</template>
```

### Pinia Store Structure

```typescript
// src/client/stores/example.store.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api.service';
import type { Example, ListParams, PaginatedResult } from '@/types';

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref<Example[]>([]);
  const currentItem = ref<Example | null>(null);
  const total = ref(0);
  const isLoading = ref(false);
  const filters = ref<ListParams>({
    page: 1,
    limit: 20,
  });

  // Getters
  const activeItems = computed(() => items.value.filter(i => i.isActive));
  const hasMore = computed(() => items.value.length < total.value);

  // Actions
  const fetchItems = async (params?: Partial<ListParams>) => {
    isLoading.value = true;
    try {
      const mergedParams = { ...filters.value, ...params };
      const response = await api.get<PaginatedResult<Example>>('/examples', { params: mergedParams });
      items.value = response.data.items;
      total.value = response.data.total;
      filters.value = mergedParams;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchItem = async (id: string) => {
    isLoading.value = true;
    try {
      const response = await api.get<Example>(`/examples/${id}`);
      currentItem.value = response.data;
    } finally {
      isLoading.value = false;
    }
  };

  const createItem = async (data: Partial<Example>) => {
    const response = await api.post<Example>('/examples', data);
    items.value.unshift(response.data);
    total.value++;
    return response.data;
  };

  const updateItem = async (id: string, data: Partial<Example>) => {
    const response = await api.put<Example>(`/examples/${id}`, data);
    const index = items.value.findIndex(i => i.id === id);
    if (index !== -1) {
      items.value[index] = response.data;
    }
    return response.data;
  };

  const deleteItem = async (id: string) => {
    await api.delete(`/examples/${id}`);
    items.value = items.value.filter(i => i.id !== id);
    total.value--;
  };

  const reset = () => {
    items.value = [];
    currentItem.value = null;
    total.value = 0;
    filters.value = { page: 1, limit: 20 };
  };

  return {
    // State
    items,
    currentItem,
    total,
    isLoading,
    filters,
    // Getters
    activeItems,
    hasMore,
    // Actions
    fetchItems,
    fetchItem,
    createItem,
    updateItem,
    deleteItem,
    reset,
  };
});
```

---

## API Response Patterns

### Success Response

```typescript
// Sempre usare le utility functions
import { successResponse, paginatedResponse } from '../utils/response.util';

// Single item
return successResponse(reply, item);
return successResponse(reply, item, 201); // Created

// Paginated list
return paginatedResponse(reply, items, total, { page, limit });
```

### Error Response

```typescript
import { errorResponse } from '../utils/response.util';

// Not found
return errorResponse(reply, 'Resource not found', 404);

// Validation error
return errorResponse(reply, 'Invalid input', 400);

// Unauthorized
return errorResponse(reply, 'Unauthorized', 401);

// Forbidden
return errorResponse(reply, 'Forbidden', 403);
```

---

## Git Conventions

### Commit Messages

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` - Nuova funzionalita
- `fix` - Bug fix
- `docs` - Documentazione
- `style` - Formattazione (no code change)
- `refactor` - Refactoring
- `test` - Aggiunta/modifica test
- `chore` - Manutenzione, dipendenze

**Examples:**
```
feat(inventory): add stock forecasting algorithm
fix(orders): correct tax calculation for B2B customers
docs(api): update subscription endpoints documentation
refactor(auth): extract tenant middleware to separate file
chore(deps): update prisma to 5.19.1
```

### Branch Naming

```
<type>/<ticket-id>-<short-description>
```

**Examples:**
```
feat/SAAS-123-multi-tenancy
fix/SAAS-456-subscription-webhook
docs/SAAS-789-api-documentation
```

---

## Comments

### When to Comment

- Complex business logic
- Non-obvious workarounds
- API contracts that aren't self-documenting
- TODOs with ticket references

### Comment Language

I commenti di business logic sono in **italiano** (lingua del cliente).

```typescript
// Calcola il margine considerando i costi di produzione e overhead
const margin = calculateMargin(product, costs);

// TODO(SAAS-123): Implementare notifica email per scadenze
```

### JSDoc for Public APIs

```typescript
/**
 * Calcola il costo totale di produzione per un prodotto
 * @param productId - ID del prodotto
 * @param quantity - Quantita da produrre
 * @returns Breakdown dei costi (materiali, lavoro, overhead)
 */
async calculateProductionCost(productId: string, quantity: number): Promise<CostBreakdown> {
  // ...
}
```

---

## Testing Conventions

### Test File Naming

```
src/server/services/__tests__/inventory.service.test.ts
src/server/routes/__tests__/product.routes.test.ts
```

### Test Structure

```typescript
describe('InventoryService', () => {
  describe('list', () => {
    it('should return paginated inventory items', async () => {
      // Arrange
      const params = { page: 1, limit: 10 };

      // Act
      const result = await inventoryService.list(params);

      // Assert
      expect(result.items).toHaveLength(10);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by warehouse', async () => {
      // ...
    });
  });
});
```

---

## Import Order

```typescript
// 1. Node.js built-in modules
import { AsyncLocalStorage } from 'async_hooks';

// 2. External packages
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// 3. Internal config/utils
import { prisma } from '../config/database';
import { successResponse } from '../utils/response.util';

// 4. Internal services/repositories
import { inventoryService } from '../services/inventory.service';
import { productRepository } from '../repositories/product.repository';

// 5. Types
import type { Product, ListParams } from '../types';
```

---

## Error Handling

### Backend

```typescript
// Service layer: throw errors
async getById(id: string): Promise<Example> {
  const item = await prisma.example.findUnique({ where: { id } });
  if (!item) {
    throw new Error('RESOURCE_NOT_FOUND');
  }
  return item;
}

// Route layer: catch and respond
server.get('/:id', async (request, reply) => {
  try {
    const item = await exampleService.getById(request.params.id);
    return successResponse(reply, item);
  } catch (error) {
    if (error.message === 'RESOURCE_NOT_FOUND') {
      return errorResponse(reply, 'Not found', 404);
    }
    throw error; // Let global error handler catch it
  }
});
```

### Frontend

```typescript
// Use composable for consistent error handling
const { apiError } = useToast();

try {
  await store.createItem(formData);
  success('Salvato!');
} catch (e) {
  apiError(e); // Shows formatted error message
}
```
