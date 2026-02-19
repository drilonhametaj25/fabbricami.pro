/**
 * Seed Demo Tenant
 * Crea/ricrea il tenant demo con dati di esempio
 *
 * Uso: npx tsx scripts/seed-demo-tenant.ts
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

const DEMO_TENANT_ID = 'demo-tenant-fabbricami';
const DEMO_USER_EMAIL = 'demo@fabbricami.pro';
const DEMO_USER_PASSWORD = 'Demo123!';

async function cleanDemoData() {
  console.log('🧹 Pulizia dati demo esistenti...');

  // Trova il tenant demo
  const tenant = await prisma.tenant.findUnique({
    where: { id: DEMO_TENANT_ID },
  });

  if (tenant) {
    // Elimina tutti i dati collegati al tenant demo
    // L'ordine è importante per le foreign key

    await prisma.orderItem.deleteMany({
      where: { order: { tenantId: DEMO_TENANT_ID } },
    });

    await prisma.order.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.inventoryMovement.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.inventoryItem.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.productVariant.deleteMany({
      where: { product: { tenantId: DEMO_TENANT_ID } },
    });

    await prisma.product.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.customer.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.supplier.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.warehouse.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.tenantMember.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    await prisma.saasSubscription.deleteMany({
      where: { tenantId: DEMO_TENANT_ID },
    });

    // Elimina utente demo
    await prisma.user.deleteMany({
      where: { email: DEMO_USER_EMAIL },
    });

    // Elimina tenant
    await prisma.tenant.delete({
      where: { id: DEMO_TENANT_ID },
    });

    console.log('✅ Dati demo eliminati');
  }
}

async function createDemoTenant() {
  console.log('🏢 Creazione tenant demo...');

  // Trova il piano PRO
  const proPlan = await prisma.subscriptionPlan.findFirst({
    where: { code: 'PRO' },
  });

  if (!proPlan) {
    throw new Error('Piano PRO non trovato. Esegui prima il seed dei piani.');
  }

  // Crea tenant demo
  const tenant = await prisma.tenant.create({
    data: {
      id: DEMO_TENANT_ID,
      name: 'Demo Azienda Srl',
      slug: 'demo',
      status: 'ACTIVE',
      settings: {
        currency: 'EUR',
        language: 'it',
        timezone: 'Europe/Rome',
        vatNumber: 'IT12345678901',
        fiscalCode: '12345678901',
      },
    },
  });

  console.log(`✅ Tenant creato: ${tenant.name}`);

  // Crea utente demo
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

  // Collega utente al tenant
  await prisma.tenantMember.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      userId: demoUser.id,
      role: 'OWNER',
    },
  });

  console.log(`✅ Utente demo creato: ${DEMO_USER_EMAIL}`);

  // Crea subscription demo
  await prisma.saasSubscription.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 anno
    },
  });

  console.log('✅ Subscription creata');

  return tenant;
}

async function createDemoWarehouse() {
  console.log('🏭 Creazione magazzini demo...');

  const warehouses = await prisma.warehouse.createMany({
    data: [
      {
        tenantId: DEMO_TENANT_ID,
        code: 'WEB',
        name: 'Magazzino E-commerce',
        type: 'WEB',
        address: 'Via Roma 123',
        city: 'Milano',
        province: 'MI',
        zipCode: '20100',
        country: 'IT',
        isActive: true,
        isDefault: true,
      },
      {
        tenantId: DEMO_TENANT_ID,
        code: 'B2B',
        name: 'Magazzino B2B',
        type: 'B2B',
        address: 'Via Industriale 45',
        city: 'Milano',
        province: 'MI',
        zipCode: '20100',
        country: 'IT',
        isActive: true,
        isDefault: false,
      },
    ],
  });

  console.log(`✅ ${warehouses.count} magazzini creati`);
}

async function createDemoProducts() {
  console.log('📦 Creazione prodotti demo...');

  // Crea categoria
  const category = await prisma.productCategory.create({
    data: {
      tenantId: DEMO_TENANT_ID,
      name: 'Elettronica',
      slug: 'elettronica',
      description: 'Prodotti elettronici',
    },
  });

  const products = [
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

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        sku: p.sku,
        name: p.name,
        description: `Descrizione ${p.name}`,
        price: p.price,
        costPrice: p.price * 0.6,
        categoryId: category.id,
        status: 'ACTIVE',
        trackInventory: true,
        minStock: 10,
        reorderPoint: 20,
      },
    });

    // Crea inventory item
    if (warehouse) {
      await prisma.inventoryItem.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: Math.floor(Math.random() * 100) + 20,
          reservedQuantity: 0,
        },
      });
    }
  }

  console.log(`✅ ${products.length} prodotti creati`);
}

async function createDemoCustomers() {
  console.log('👥 Creazione clienti demo...');

  const customers = [
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

  for (const c of customers) {
    await prisma.customer.create({
      data: {
        tenantId: DEMO_TENANT_ID,
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
  }

  console.log(`✅ ${customers.length} clienti creati`);
}

async function createDemoSuppliers() {
  console.log('🏪 Creazione fornitori demo...');

  const suppliers = [
    { name: 'Tech Wholesale Srl', email: 'ordini@techwholesale.it' },
    { name: 'Elettronica Italia SpA', email: 'b2b@elettronicaitalia.it' },
    { name: 'Accessori Plus', email: 'vendite@accessoriplus.com' },
    { name: 'Digital Import', email: 'info@digitalimport.it' },
    { name: 'Fast Electronics', email: 'orders@fastelectronics.eu' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        name: s.name,
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

  console.log(`✅ ${suppliers.length} fornitori creati`);
}

async function createDemoOrders() {
  console.log('📋 Creazione ordini demo...');

  const customers = await prisma.customer.findMany({
    where: { tenantId: DEMO_TENANT_ID },
    take: 5,
  });

  const products = await prisma.product.findMany({
    where: { tenantId: DEMO_TENANT_ID },
    take: 5,
  });

  const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const ordersToCreate = 20;

  for (let i = 0; i < ordersToCreate; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const selectedProducts = products
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 1);

    let subtotal = 0;
    const items = selectedProducts.map((p) => {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const lineTotal = Number(p.price) * quantity;
      subtotal += lineTotal;
      return {
        productId: p.id,
        quantity,
        unitPrice: Number(p.price),
        totalPrice: lineTotal,
        productName: p.name,
        productSku: p.sku,
      };
    });

    const vatAmount = subtotal * 0.22;
    const total = subtotal + vatAmount;

    await prisma.order.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        orderNumber: `ORD-DEMO-${String(i + 1).padStart(4, '0')}`,
        customerId: customer.id,
        status: status as any,
        subtotal,
        vatAmount,
        total,
        shippingCost: 0,
        currency: 'EUR',
        orderDate,
        shippingAddress: customer.address as any,
        billingAddress: customer.address as any,
        items: {
          create: items,
        },
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
    await createDemoProducts();
    await createDemoCustomers();
    await createDemoSuppliers();
    await createDemoOrders();

    console.log('\n✅ Seed demo completato!');
    console.log(`\n📧 Credenziali demo:`);
    console.log(`   Email: ${DEMO_USER_EMAIL}`);
    console.log(`   Password: ${DEMO_USER_PASSWORD}`);
  } catch (error) {
    console.error('❌ Errore durante il seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
