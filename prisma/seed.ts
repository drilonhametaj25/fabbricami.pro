import { PrismaClient, InventoryLocation, OrderStatus, OrderSource } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.productOperation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  // Clear SaaS data
  await prisma.billingHistory.deleteMany();
  await prisma.saasSubscription.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.subscriptionPlan.deleteMany();

  // ===========================================
  // SUBSCRIPTION PLANS
  // ===========================================
  console.log('Creating subscription plans...');

  const starterPlan = await prisma.subscriptionPlan.create({
    data: {
      code: 'STARTER',
      name: 'Starter',
      description: 'Ideale per piccole attivita con gestione base di inventario e ordini',
      priceMonthly: 29.00,
      priceYearly: 290.00, // 2 mesi gratis
      features: {
        modules: ['inventory', 'orders', 'customers', 'basic_reports'],
        capabilities: ['wordpress_sync_basic', 'email_support'],
      },
      limits: {
        maxUsers: 3,
        maxWarehouses: 1,
        maxProducts: 1000,
        maxOrders: 500,
        maxSuppliers: 20,
      },
      isActive: true,
      sortOrder: 1,
    },
  });

  const proPlan = await prisma.subscriptionPlan.create({
    data: {
      code: 'PRO',
      name: 'Professional',
      description: 'Per aziende in crescita con produzione e gestione avanzata',
      priceMonthly: 79.00,
      priceYearly: 790.00, // 2 mesi gratis
      features: {
        modules: [
          'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
          'manufacturing', 'hr', 'advanced_reports', 'wordpress_sync',
        ],
        capabilities: ['wordpress_sync_full', 'priority_support', 'api_readonly'],
      },
      limits: {
        maxUsers: 10,
        maxWarehouses: 3,
        maxProducts: 10000,
        maxOrders: 2000,
        maxSuppliers: 100,
      },
      isActive: true,
      sortOrder: 2,
    },
  });

  const businessPlan = await prisma.subscriptionPlan.create({
    data: {
      code: 'BUSINESS',
      name: 'Business',
      description: 'Soluzione completa per aziende strutturate con tutte le funzionalita',
      priceMonthly: 199.00,
      priceYearly: 1990.00, // 2 mesi gratis
      features: {
        modules: [
          'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
          'manufacturing', 'hr', 'accounting', 'sdi', 'advanced_reports',
          'wordpress_sync', 'api_access', 'custom_integrations',
        ],
        capabilities: [
          'wordpress_sync_full', 'sdi_integration', 'dedicated_support',
          'api_full', 'custom_reports', 'white_label',
        ],
      },
      limits: {
        maxUsers: -1, // Illimitati
        maxWarehouses: -1,
        maxProducts: -1,
        maxOrders: -1,
        maxSuppliers: -1,
      },
      isActive: true,
      sortOrder: 3,
    },
  });

  console.log('Subscription plans created: STARTER, PRO, BUSINESS');

  // ===========================================
  // DEFAULT TENANT (per migrazione dati esistenti)
  // ===========================================
  console.log('Creating default tenant...');

  const defaultTenant = await prisma.tenant.create({
    data: {
      slug: 'default',
      name: 'Default Tenant',
      domain: null,
      settings: {
        timezone: 'Europe/Rome',
        locale: 'it-IT',
        currency: 'EUR',
      },
      status: 'ACTIVE',
    },
  });

  // Create trial subscription for default tenant
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 giorni trial

  await prisma.saasSubscription.create({
    data: {
      tenantId: defaultTenant.id,
      planId: proPlan.id, // Trial con piano PRO
      status: 'TRIALING',
      billingInterval: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate,
      trialEndsAt: trialEndDate,
    },
  });

  console.log('Default tenant created with PRO trial subscription');

  // Create users (con tenantId)
  console.log('Creating users...');
  const adminPassword = await hashPassword('admin123');

  const admin = await prisma.user.create({
    data: {
      tenantId: defaultTenant.id,
      email: 'admin@ecommerceerp.com',
      password: adminPassword,
      firstName: 'Marco',
      lastName: 'Bianchi',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Create tenant membership for admin
  await prisma.tenantMember.create({
    data: {
      tenantId: defaultTenant.id,
      userId: admin.id,
      role: 'ADMIN',
      acceptedAt: new Date(),
    },
  });

  const manager = await prisma.user.create({
    data: {
      tenantId: defaultTenant.id,
      email: 'manager@ecommerceerp.com',
      password: adminPassword,
      firstName: 'Laura',
      lastName: 'Rossi',
      role: 'MANAGER',
      isActive: true,
    },
  });

  // Create tenant membership for manager
  await prisma.tenantMember.create({
    data: {
      tenantId: defaultTenant.id,
      userId: manager.id,
      role: 'MANAGER',
      acceptedAt: new Date(),
    },
  });

  console.log('Users created with tenant memberships');

  // Create employees (con tenantId)
  console.log('Creating employees...');
  const employee1 = await prisma.employee.create({
    data: {
      tenantId: defaultTenant.id,
      userId: admin.id,
      employeeCode: 'EMP-001',
      position: 'Amministratore Delegato',
      hourlyRate: 50.00,
      hireDate: new Date('2020-01-01'),
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      tenantId: defaultTenant.id,
      userId: manager.id,
      employeeCode: 'EMP-002',
      position: 'Responsabile Produzione',
      hourlyRate: 35.00,
      hireDate: new Date('2020-03-15'),
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      userId: magazziniere.id,
      employeeCode: 'EMP-003',
      position: 'Responsabile Magazzino',
      hourlyRate: 22.00,
      hireDate: new Date('2021-06-01'),
      isActive: true,
    },
  });

  console.log('Employees created');

  // Create warehouses (con tenantId)
  console.log('Creating warehouses...');
  const mainWarehouse = await prisma.warehouse.create({
    data: {
      tenantId: defaultTenant.id,
      code: 'WH-MAIN',
      name: 'Magazzino Centrale Milano',
      description: 'Magazzino principale per produzione e stoccaggio',
      address: {
        street: 'Via della Manifattura 42',
        city: 'Milano',
        province: 'MI',
        zip: '20100',
        country: 'IT',
      },
      isActive: true,
      isPrimary: true,
    },
  });

  const shopWarehouse = await prisma.warehouse.create({
    data: {
      tenantId: defaultTenant.id,
      code: 'WH-EVENTI',
      name: 'Magazzino Eventi e Fiere',
      description: 'Magazzino per gestione stock eventi e manifestazioni',
      address: {
        street: 'Via della Manifattura 42',
        city: 'Milano',
        province: 'MI',
        zip: '20100',
        country: 'IT',
      },
      isActive: true,
      isPrimary: false,
    },
  });

  console.log('Warehouses created');

  // Create customers (con tenantId)
  console.log('Creating customers...');
  const customers = [];

  // B2C Customers
  for (let i = 1; i <= 10; i++) {
    const customer = await prisma.customer.create({
      data: {
        tenantId: defaultTenant.id,
        code: `CUST-B2C-${String(i).padStart(3, '0')}`,
        type: 'B2C',
        firstName: name.first,
        lastName: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@email.com`,
        phone: `+39 333 ${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
        address: {
          street: `Via Roma ${Math.floor(Math.random() * 100) + 1}`,
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

  const b2bCompanies = ['Modellismo Italia SRL', 'Hobby Center SPA', 'Scale Models Shop'];

  for (let i = 0; i < b2bCompanies.length; i++) {
    const customer = await prisma.customer.create({
      data: {
        tenantId: defaultTenant.id,
        code: `CUST-B2B-${String(i).padStart(3, '0')}`,
        type: 'B2B',
        businessName: b2bCompanies[i],
        taxId: 'IT' + String(Math.floor(Math.random() * 90000000000 + 10000000000)),
        email: `ordini@${b2bCompanies[i].toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        phone: `+39 02 ${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
        address: {
          street: `Via Commercio ${Math.floor(Math.random() * 100) + 1}`,
          city: 'Milano',
          province: 'MI',
          zip: '20100',
          country: 'IT',
        },
        paymentTerms: 30,
        discount: 10,
        isActive: true,
      },
    });
    customers.push(customer);
  }

  console.log('Customers created:', customers.length);

  // Create products (con tenantId)
  console.log('Creating products...');
  const products = [];

  const productData = [
    { name: 'Ferrari 250 GTO 1:18', category: 'AUTO', price: 89.90, cost: 45.00 },
    { name: 'Porsche 911 Carrera 1:18', category: 'AUTO', price: 79.90, cost: 40.00 },
    { name: 'Lamborghini Countach 1:18', category: 'AUTO', price: 94.90, cost: 48.00 },
    { name: 'Aston Martin DB5 1:18', category: 'AUTO', price: 99.90, cost: 50.00 },
    { name: 'Ford Mustang 1967 1:18', category: 'AUTO', price: 74.90, cost: 38.00 },
    { name: 'Boeing 747 1:200', category: 'AEREI', price: 129.90, cost: 65.00 },
    { name: 'Airbus A380 1:200', category: 'AEREI', price: 149.90, cost: 75.00 },
    { name: 'F-16 Fighting Falcon 1:72', category: 'AEREI', price: 59.90, cost: 30.00 },
    { name: 'Spitfire WWII 1:48', category: 'AEREI', price: 69.90, cost: 35.00 },
    { name: 'USS Enterprise 1:350', category: 'NAVI', price: 199.90, cost: 100.00 },
    { name: 'Titanic 1:400', category: 'NAVI', price: 179.90, cost: 90.00 },
    { name: 'Bismarck 1:350', category: 'NAVI', price: 189.90, cost: 95.00 },
    { name: 'Tiger I Tank 1:35', category: 'MILITARI', price: 84.90, cost: 42.00 },
    { name: 'Sherman M4 1:35', category: 'MILITARI', price: 79.90, cost: 40.00 },
    { name: 'T-34/85 Soviet Tank 1:35', category: 'MILITARI', price: 82.90, cost: 41.00 },
  ];

  for (let i = 0; i < productData.length; i++) {
    const data = productData[i];
    const product = await prisma.product.create({
      data: {
        tenantId: defaultTenant.id,
        sku: `PROD-${String(i + 1).padStart(4, '0')}`,
        name: data.name,
        description: `Modello dettagliato ${data.name} in scala`,
        type: 'SIMPLE',
        category: data.category,
        barcode: `800${String(i + 1).padStart(10, '0')}`,
        cost: data.cost,
        price: data.price,
        minStockLevel: 5,
        reorderQuantity: 15,
        isActive: true,
      },
    });
    products.push(product);
  }

  console.log('Products created:', products.length);

  // Create inventory for products (con tenantId)
  console.log('Creating inventory...');
  const locations: InventoryLocation[] = ['WEB', 'B2B', 'EVENTI'];

  for (const product of products) {
    for (const location of locations) {
      const baseQuantity = location === 'WEB' ? 50 : 20;
      const quantity = Math.floor(Math.random() * baseQuantity) + 5;

      await prisma.inventoryItem.create({
        data: {
          tenantId: defaultTenant.id,
          warehouseId: mainWarehouse.id,
          productId: product.id,
          location,
          quantity,
          reservedQuantity: Math.floor(Math.random() * 3),
        },
      });
    }
  }

  console.log('Inventory created');

  // Create orders (con tenantId)
  console.log('Creating orders...');
  const orderStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const sources = ['WORDPRESS', 'B2B', 'MANUAL'];

  for (let i = 1; i <= 30; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

    // Random date in last 60 days
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 60));

    const order = await prisma.order.create({
      data: {
        tenantId: defaultTenant.id,
        orderNumber: `ORD-2025-${String(i).padStart(6, '0')}`,
        customerId: customer.id,
        source,
        status,
        orderDate,
        subtotal: 0,
        discount: 0,
        tax: 0,
        shipping: 9.90,
        total: 0,
        paymentMethod: 'credit_card',
        paymentStatus: status === 'DELIVERED' ? 'paid' : 'pending',
        shippingAddress: customer.address as any,
        billingAddress: customer.address as any,
      },
    });

    const itemCount = Math.floor(Math.random() * 3) + 1;
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * quantity;
      const tax = lineTotal * 0.22;

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          tax,
          total: lineTotal + tax,
        },
      });

      subtotal += lineTotal;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        tax: subtotal * 0.22,
        total: subtotal * 1.22 + 9.90,
      },
    });
  }

  console.log('Orders created: 30');

  // Create inventory movements (con tenantId)
  console.log('Creating inventory movements...');
  for (let i = 0; i < 50; i++) {
    const product = products[Math.floor(Math.random() * products.length)];
    const types = ['IN', 'OUT', 'ADJUSTMENT'];
    const type = types[Math.floor(Math.random() * types.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];

    const movementDate = new Date();
    movementDate.setDate(movementDate.getDate() - Math.floor(Math.random() * 90));

    await prisma.inventoryMovement.create({
      data: {
        tenantId: defaultTenant.id,
        productId: product.id,
        alertType: 'LOW_STOCK',
        thresholdValue: 5,
        currentValue: Math.floor(Math.random() * 5) + 1,
        status: 'ACTIVE',
      },
    });
  }

  console.log('Inventory movements created: 50');

  console.log('');
  console.log('Database seeded successfully!');
  console.log('');
  console.log('Summary:');
  console.log('  - Subscription Plans: 3 (STARTER, PRO, BUSINESS)');
  console.log('  - Tenant: 1 (default with PRO trial)');
  console.log('  - Users: 2 (admin@ecommerceerp.com / admin123)');
  console.log('  - Tenant Members: 2');
  console.log('  - Employees: 2');
  console.log('  - Warehouses: 2');
  console.log('  - Customers: 15 (10 B2C + 5 B2B)');
  console.log('  - Products: 15');
  console.log('  - Inventory Items: 45 (3 locations per product)');
  console.log('  - Orders: 30');
  console.log('  - Inventory Movements: 50');
}

main()
  .catch((error) => {
    console.error('❌ Errore:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
