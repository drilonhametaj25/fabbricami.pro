import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

/**
 * Configurazione Swagger/OpenAPI
 */
export async function setupSwagger(server: FastifyInstance) {
  await server.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'EcommerceERP API',
        description: `
## API REST per il gestionale EcommerceERP

Questo documento descrive le API disponibili per:
- **Gestione Prodotti**: CRUD prodotti, varianti, BOM, lavorazioni
- **Magazzino**: Giacenze multi-location, movimentazioni, alert scorte
- **Ordini**: Gestione ordini B2C/B2B, workflow stati
- **Clienti**: Anagrafica clienti, statistiche
- **Fornitori**: Anagrafica fornitori, ordini acquisto
- **Contabilità**: Fatture, pagamenti, scadenzario
- **Dipendenti**: Timbrature, ferie, costi
- **Task**: Workflow task, assegnazioni
- **Analytics**: KPI, report, analisi margini
- **WordPress**: Integrazione WooCommerce
- **MRP**: Calcolo fabbisogno materiali
- **Export**: Generazione PDF/Excel

### Autenticazione
Tutte le API (eccetto /auth/login) richiedono autenticazione JWT.
Includere il token nell'header: \`Authorization: Bearer <token>\`

### Rate Limiting
Le API pubbliche hanno un limite di 100 richieste/minuto per IP.

### Formato Response
\`\`\`json
{
  "success": boolean,
  "data": any,
  "error": string | null,
  "metadata": {
    "timestamp": "ISO 8601",
    "version": "1.0.0"
  }
}
\`\`\`
        `,
        version: '1.0.0',
        contact: {
          name: 'EcommerceERP',
          email: 'dev@ecommerceerp.com',
        },
        license: {
          name: 'Proprietary',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.ecommerceerp.com',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'Auth', description: 'Autenticazione e gestione sessione' },
        { name: 'Products', description: 'Gestione prodotti, varianti e BOM' },
        { name: 'Inventory', description: 'Gestione magazzino e movimentazioni' },
        { name: 'Orders', description: 'Gestione ordini clienti' },
        { name: 'Customers', description: 'Anagrafica clienti B2C/B2B' },
        { name: 'Suppliers', description: 'Anagrafica fornitori' },
        { name: 'Purchase Orders', description: 'Ordini di acquisto' },
        { name: 'Accounting', description: 'Fatturazione e contabilità' },
        { name: 'Employees', description: 'Gestione dipendenti e timbrature' },
        { name: 'Tasks', description: 'Task management e workflow' },
        { name: 'Analytics', description: 'Report e analisi KPI' },
        { name: 'WordPress', description: 'Integrazione WooCommerce' },
        { name: 'MRP', description: 'Material Requirements Planning' },
        { name: 'Export', description: 'Esportazione PDF/Excel' },
        { name: 'Notifications', description: 'Sistema notifiche' },
        { name: 'Calendar', description: 'Calendario eventi' },
        { name: 'Warehouses', description: 'Gestione magazzini' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: { type: 'string', example: 'Error message' },
            },
          },
          Pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
          Product: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              sku: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: ['SIMPLE', 'WITH_VARIANTS', 'RAW_MATERIAL', 'DIGITAL'] },
              category: { type: 'string' },
              cost: { type: 'number' },
              price: { type: 'number' },
              minStock: { type: 'integer' },
              isActive: { type: 'boolean' },
              isSellable: { type: 'boolean' },
            },
          },
          Order: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              orderNumber: { type: 'string' },
              customerId: { type: 'string', format: 'uuid' },
              source: { type: 'string', enum: ['WORDPRESS', 'B2B', 'MANUAL'] },
              status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] },
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              shipping: { type: 'number' },
              total: { type: 'number' },
              orderDate: { type: 'string', format: 'date-time' },
            },
          },
          Customer: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              code: { type: 'string' },
              type: { type: 'string', enum: ['B2C', 'B2B'] },
              businessName: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' },
              taxId: { type: 'string' },
            },
          },
          Invoice: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              invoiceNumber: { type: 'string' },
              type: { type: 'string', enum: ['SALE', 'PURCHASE'] },
              status: { type: 'string', enum: ['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'] },
              issueDate: { type: 'string', format: 'date' },
              dueDate: { type: 'string', format: 'date' },
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
              paidAmount: { type: 'number' },
            },
          },
          InventoryItem: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              productId: { type: 'string', format: 'uuid' },
              warehouseId: { type: 'string', format: 'uuid' },
              location: { type: 'string', enum: ['WEB', 'B2B', 'EVENTI', 'TRANSITO'] },
              quantity: { type: 'integer' },
              reservedQuantity: { type: 'integer' },
            },
          },
          MRPRequirement: {
            type: 'object',
            properties: {
              productId: { type: 'string', format: 'uuid' },
              sku: { type: 'string' },
              name: { type: 'string' },
              requiredQuantity: { type: 'number' },
              availableQuantity: { type: 'number' },
              shortageQuantity: { type: 'number' },
              priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
              suggestedOrderDate: { type: 'string', format: 'date' },
              estimatedCost: { type: 'number' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}

export default setupSwagger;
