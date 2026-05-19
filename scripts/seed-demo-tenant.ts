/**
 * Seed Demo Tenant
 * Crea/ricrea il tenant demo con dati di esempio.
 *
 * Idempotente: pulisce i dati esistenti del tenant demo e li ricrea.
 *
 * Uso:
 *   npx tsx scripts/seed-demo-tenant.ts
 *
 * In produzione (dentro il container backend):
 *   docker compose -f docker-compose.prod.yml exec -T backend npx tsx scripts/seed-demo-tenant.ts
 */

import {
  PrismaClient,
  CustomerType,
  InventoryLocation,
  OrderSource,
  OrderStatus,
} from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

const DEMO_TENANT_ID = 'demo-tenant-fabbricami';
const DEMO_USER_EMAIL = 'demo@fabbricami.pro';
const DEMO_USER_PASSWORD = 'Demo123!';
const DEMO_CATEGORY_SLUG = 'demo-elettronica';

async function cleanDemoData() {
  console.log('🧹 Pulizia dati demo esistenti...');

  // L'ordine rispetta le FK: items prima dei container, container prima del tenant.
  // ProductCategoryAssignment cascada con Product/Category quindi non serve eliminarlo.
  await prisma.orderItem.deleteMany({
    where: { order: { tenantId: DEMO_TENANT_ID } },
  });
  await prisma.order.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  await prisma.inventoryMovement.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });
  await prisma.inventoryItem.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  await prisma.productVariant.deleteMany({
    where: { product: { tenantId: DEMO_TENANT_ID } },
  });
  await prisma.product.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  // ProductCategory ha slug globalmente unico: rimuovi quelle del tenant demo
  await prisma.productCategory.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  await prisma.customer.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });
  await prisma.supplier.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });
  await prisma.warehouse.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  // WordPressTenantConfig cascada via tenant FK, ma rimuoviamolo esplicitamente
  // per compatibilità con istanze dove il record è orfano.
  await prisma.wordPressTenantConfig
    .deleteMany({ where: { tenantId: DEMO_TENANT_ID } })
    .catch(() => null);

  // CompanySettings: deleteMany via tenantId (no cascade da Tenant)
  await prisma.companySettings.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  await prisma.tenantMember.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });
  await prisma.saasSubscription.deleteMany({ where: { tenantId: DEMO_TENANT_ID } });

  // L'utente demo ha tenantId con onDelete: Cascade verso Tenant: viene
  // rimosso quando eliminiamo il tenant. Lo facciamo prima esplicitamente
  // per coprire il caso in cui l'utente esista ma il tenant no.
  await prisma.user.deleteMany({ where: { email: DEMO_USER_EMAIL } });

  await prisma.tenant.deleteMany({ where: { id: DEMO_TENANT_ID } });

  console.log('✅ Dati demo eliminati');
}

async function createDemoTenant() {
  console.log('🏢 Creazione tenant demo...');

  const tenant = await prisma.tenant.create({
    data: {
      id: DEMO_TENANT_ID,
      name: 'Demo Azienda Srl',
      slug: 'demo',
      status: 'ACTIVE',
      // I flag billingConfigured/wordpressSkipped/onboardingComplete sono
      // letti da /api/v1/onboarding/status per saltare il wizard di
      // onboarding: l'utente demo deve atterrare direttamente sulla
      // dashboard, non sul wizard.
      settings: {
        currency: 'EUR',
        language: 'it',
        timezone: 'Europe/Rome',
        vatNumber: 'IT12345678901',
        fiscalCode: '12345678901',
        billingConfigured: true,
        billingSkipped: false,
        wordpressConfigured: false,
        wordpressSkipped: true,
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString(),
      },
    },
  });
  console.log(`✅ Tenant creato: ${tenant.name}`);

  const hashedPassword = await hashPassword(DEMO_USER_PASSWORD);
  const demoUser = await prisma.user.create({
    data: {
      email: DEMO_USER_EMAIL,
      password: hashedPassword,
      firstName: 'Utente',
      lastName: 'Demo',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      tenantId: DEMO_TENANT_ID,
    },
  });

  await prisma.tenantMember.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      userId: demoUser.id,
      role: 'ADMIN',
      acceptedAt: new Date(),
    },
  });
  console.log(`✅ Utente demo creato: ${DEMO_USER_EMAIL}`);

  // CompanySettings: necessario perché /onboarding/status verifica la
  // presenza di un record per marcare lo step 'company-settings' come
  // completato. Senza, la demo finirebbe sul wizard invece che sulla dashboard.
  await prisma.companySettings.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      companyName: 'Demo Azienda Srl',
      legalName: 'Demo Azienda S.r.l.',
      vatNumber: 'IT12345678901',
      fiscalCode: '12345678901',
      address: 'Via Roma 123',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      country: 'IT',
      phone: '+39 02 1234567',
      email: 'info@demo-azienda.example',
      taxRegime: 'RF01',
    },
  });
  console.log('✅ CompanySettings demo create');

  // Subscription opzionale: solo se esiste già un piano PRO seedato.
  // Il login non dipende dalla subscription, quindi se manca semplicemente
  // saltiamo.
  const proPlan = await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
  if (proPlan) {
    await prisma.saasSubscription.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('✅ Subscription PRO creata');
  } else {
    console.log('⚠️  Piano PRO non trovato — subscription non creata (esegui prima seed-plans)');
  }

  return tenant;
}

async function createDemoWarehouse() {
  console.log('🏭 Creazione magazzini demo...');

  await prisma.warehouse.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      code: 'WEB',
      name: 'Magazzino E-commerce',
      description: 'Magazzino principale demo',
      address: {
        street: 'Via Roma 123',
        city: 'Milano',
        province: 'MI',
        zip: '20100',
        country: 'IT',
      },
      isActive: true,
      isPrimary: true,
    },
  });

  await prisma.warehouse.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      code: 'B2B',
      name: 'Magazzino B2B',
      description: 'Magazzino wholesale demo',
      address: {
        street: 'Via Industriale 45',
        city: 'Milano',
        province: 'MI',
        zip: '20100',
        country: 'IT',
      },
      isActive: true,
      isPrimary: false,
    },
  });

  console.log('✅ 2 magazzini creati');
}

async function createDemoProducts() {
  console.log('📦 Creazione prodotti demo...');

  const category = await prisma.productCategory.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      name: 'Elettronica',
      slug: DEMO_CATEGORY_SLUG,
      description: 'Prodotti elettronici (demo)',
    },
  });

  const productsData = [
    { name: 'Smartphone Pro X', sku: 'PHONE-001', price: 899.99 },
    { name: 'Tablet Air 10"', sku: 'TAB-001', price: 499.99 },
    { name: 'Laptop Ultra 15"', sku: 'LAP-001', price: 1299.99 },
    { name: 'Smartwatch Fit', sku: 'WATCH-001', price: 249.99 },
    { name: 'Cuffie Wireless Pro', sku: 'HEAD-001', price: 179.99 },
    { name: 'Caricatore USB-C 65W', sku: 'CHRG-001', price: 49.99 },
    { name: 'Cover Smartphone', sku: 'ACC-001', price: 19.99 },
    { name: 'Pellicola Protettiva', sku: 'ACC-002', price: 9.99 },
    { name: 'Powerbank 20000mAh', sku: 'PWR-001', price: 59.99 },
    { name: 'Mouse Wireless', sku: 'MOUSE-001', price: 29.99 },
  ];

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId: DEMO_TENANT_ID, code: 'WEB' },
  });
  if (!warehouse) throw new Error('Warehouse WEB non trovato dopo la creazione');

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        sku: p.sku,
        name: p.name,
        description: `Descrizione ${p.name}`,
        price: p.price,
        cost: p.price * 0.6,
        category: 'Elettronica',
        isActive: true,
        isSellable: true,
        minStock: 10,
        reorderPoint: 20,
      },
    });
    products.push(product);

    await prisma.productCategoryAssignment.create({
      data: {
        productId: product.id,
        categoryId: category.id,
        isPrimary: true,
      },
    });

    await prisma.inventoryItem.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        productId: product.id,
        warehouseId: warehouse.id,
        location: InventoryLocation.WEB,
        quantity: Math.floor(Math.random() * 100) + 20,
        reservedQuantity: 0,
      },
    });
  }

  console.log(`✅ ${products.length} prodotti creati`);
  return products;
}

async function createDemoCustomers() {
  console.log('👥 Creazione clienti demo...');

  const customersData = [
    { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com' },
    { firstName: 'Giulia', lastName: 'Bianchi', email: 'giulia.bianchi@example.com' },
    { firstName: 'Luca', lastName: 'Verdi', email: 'luca.verdi@example.com' },
    { firstName: 'Anna', lastName: 'Neri', email: 'anna.neri@example.com' },
    { firstName: 'Paolo', lastName: 'Gialli', email: 'paolo.gialli@example.com' },
    { firstName: 'Sara', lastName: 'Blu', email: 'sara.blu@example.com' },
    { firstName: 'Marco', lastName: 'Viola', email: 'marco.viola@example.com' },
    { firstName: 'Elena', lastName: 'Rosa', email: 'elena.rosa@example.com' },
    { firstName: 'Andrea', lastName: 'Marrone', email: 'andrea.marrone@example.com' },
    { firstName: 'Chiara', lastName: 'Grigio', email: 'chiara.grigio@example.com' },
  ];

  const customers = [];
  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const customer = await prisma.customer.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        type: CustomerType.B2C,
        code: `CUST-${String(i + 1).padStart(4, '0')}`,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: '+39 333 1234567',
        address: {
          street: 'Via Example 123',
          city: 'Milano',
          province: 'MI',
          zip: '20100',
          country: 'IT',
        },
        isActive: true,
      },
    });
    customers.push(customer);
  }

  console.log(`✅ ${customers.length} clienti creati`);
  return customers;
}

async function createDemoSuppliers() {
  console.log('🏪 Creazione fornitori demo...');

  const suppliersData = [
    { businessName: 'Tech Wholesale Srl', email: 'ordini@techwholesale.it' },
    { businessName: 'Elettronica Italia SpA', email: 'b2b@elettronicaitalia.it' },
    { businessName: 'Accessori Plus', email: 'vendite@accessoriplus.com' },
    { businessName: 'Digital Import', email: 'info@digitalimport.it' },
    { businessName: 'Fast Electronics', email: 'orders@fastelectronics.eu' },
  ];

  for (let i = 0; i < suppliersData.length; i++) {
    const s = suppliersData[i];
    await prisma.supplier.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        code: `SUP-${String(i + 1).padStart(4, '0')}`,
        businessName: s.businessName,
        email: s.email,
        phone: '+39 02 1234567',
        address: {
          street: 'Via Industriale 1',
          city: 'Milano',
          province: 'MI',
          zip: '20100',
          country: 'IT',
        },
        paymentTerms: 30,
        isActive: true,
      },
    });
  }

  console.log(`✅ ${suppliersData.length} fornitori creati`);
}

async function createDemoOrders(
  customers: Awaited<ReturnType<typeof createDemoCustomers>>,
  products: Awaited<ReturnType<typeof createDemoProducts>>
) {
  console.log('📋 Creazione ordini demo...');

  const statuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ];
  const ordersToCreate = 20;

  for (let i = 0; i < ordersToCreate; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    const selectedProducts = [...products]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 1);

    let subtotal = 0;
    const items = selectedProducts.map((p) => {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Number(p.price);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity,
        unitPrice,
        total: lineTotal,
      };
    });

    const tax = subtotal * 0.22;
    const total = subtotal + tax;

    await prisma.order.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        orderNumber: `ORD-DEMO-${String(i + 1).padStart(4, '0')}`,
        customerId: customer.id,
        source: OrderSource.MANUAL,
        status,
        subtotal,
        tax,
        shipping: 0,
        total,
        orderDate,
        shippingAddress: customer.address as object,
        billingAddress: customer.address as object,
        items: { create: items },
      },
    });
  }

  console.log(`✅ ${ordersToCreate} ordini creati`);
}

async function main() {
  console.log('🚀 Avvio seed demo tenant...\n');

  try {
    await cleanDemoData();
    await createDemoTenant();
    await createDemoWarehouse();
    const products = await createDemoProducts();
    const customers = await createDemoCustomers();
    await createDemoSuppliers();
    await createDemoOrders(customers, products);

    console.log('\n✅ Seed demo completato!');
    console.log(`\n📧 Credenziali demo:`);
    console.log(`   Email:    ${DEMO_USER_EMAIL}`);
    console.log(`   Password: ${DEMO_USER_PASSWORD}`);
  } catch (error) {
    console.error('❌ Errore durante il seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
