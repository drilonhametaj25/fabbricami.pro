import { PrismaClient, InventoryLocation } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
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

  // Create users
  console.log('👤 Creating users...');
  const adminPassword = await hashPassword('admin123');
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@ecommerceerp.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'EcommerceERP',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@ecommerceerp.com',
      password: adminPassword,
      firstName: 'Marco',
      lastName: 'Rossi',
      role: 'MANAGER',
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Create employees
  console.log('👷 Creating employees...');
  const employee1 = await prisma.employee.create({
    data: {
      userId: admin.id,
      employeeCode: 'EMP-001',
      position: 'Amministratore',
      hourlyRate: 25.00,
      hireDate: new Date('2020-01-01'),
      isActive: true,
    },
  });

  const employee2 = await prisma.employee.create({
    data: {
      userId: manager.id,
      employeeCode: 'EMP-002',
      position: 'Responsabile Produzione',
      hourlyRate: 22.00,
      hireDate: new Date('2021-06-01'),
      isActive: true,
    },
  });

  console.log('✅ Employees created');

  // Create warehouses
  console.log('🏢 Creating warehouses...');
  const mainWarehouse = await prisma.warehouse.create({
    data: {
      code: 'WH-MAIN',
      name: 'Magazzino Principale',
      description: 'Magazzino principale EcommerceERP - Sede di Milano',
      address: {
        street: 'Via della Logistica 15',
        city: 'Milano',
        zip: '20100',
        country: 'Italia',
      },
      isActive: true,
      isPrimary: true,
    },
  });

  const eventWarehouse = await prisma.warehouse.create({
    data: {
      code: 'WH-EVENTI',
      name: 'Magazzino Eventi e Fiere',
      description: 'Magazzino per gestione stock eventi e manifestazioni',
      address: {
        street: 'Via Fiera 42',
        city: 'Milano',
        zip: '20145',
        country: 'Italia',
      },
      isActive: true,
      isPrimary: false,
    },
  });

  console.log('✅ Warehouses created');

  // Create customers
  console.log('👥 Creating customers...');
  const customers = [];
  
  // B2C Customers
  for (let i = 1; i <= 10; i++) {
    const customer = await prisma.customer.create({
      data: {
        code: `CUST-B2C-${String(i).padStart(3, '0')}`,
        type: 'B2C',
        firstName: `Cliente${i}`,
        lastName: `Privato${i}`,
        email: `cliente${i}@example.com`,
        phone: `+39 333 ${String(i).padStart(7, '0')}`,
        address: {
          street: `Via Roma ${i}`,
          city: 'Milano',
          zip: '20100',
          country: 'IT',
        },
        isActive: true,
      },
    });
    customers.push(customer);
  }

  // B2B Customers
  for (let i = 1; i <= 5; i++) {
    const customer = await prisma.customer.create({
      data: {
        code: `CUST-B2B-${String(i).padStart(3, '0')}`,
        type: 'B2B',
        businessName: `Azienda Modellismo ${i} SRL`,
        taxId: `IT0123456789${i}`,
        email: `azienda${i}@example.com`,
        phone: `+39 02 ${String(i).padStart(7, '0')}`,
        address: {
          street: `Via Industria ${i}`,
          city: 'Torino',
          zip: '10100',
          country: 'IT',
        },
        isActive: true,
      },
    });
    customers.push(customer);
  }

  console.log('✅ Customers created:', customers.length);

  // Create products
  console.log('📦 Creating products...');
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

  console.log('✅ Products created:', products.length);

  // Create inventory for products
  console.log('📊 Creating inventory...');
  const locations: InventoryLocation[] = ['WEB', 'B2B', 'EVENTI'];
  
  for (const product of products) {
    for (const location of locations) {
      const baseQuantity = location === 'WEB' ? 50 : 20;
      const quantity = Math.floor(Math.random() * baseQuantity) + 5;
      
      await prisma.inventoryItem.create({
        data: {
          warehouseId: mainWarehouse.id,
          productId: product.id,
          location,
          quantity,
          reservedQuantity: Math.floor(Math.random() * 3),
        },
      });
    }
  }

  console.log('✅ Inventory created');

  // Create orders
  console.log('🛒 Creating orders...');
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
        orderNumber: `ORD-2025-${String(i).padStart(6, '0')}`,
        customerId: customer.id,
        source: source as any,
        status: status as any,
        orderDate,
        subtotal: 0,
        discount: 0,
        tax: 0,
        shipping: 9.90,
        total: 0,
        paymentMethod: 'credit_card',
        paymentStatus: status === 'DELIVERED' ? 'paid' : 'pending',
        shippingAddress: customer.address || { street: 'Via Roma 1', city: 'Milano', zip: '20100', country: 'IT' },
        billingAddress: customer.address || { street: 'Via Roma 1', city: 'Milano', zip: '20100', country: 'IT' },
      },
    });

    // Add 1-4 random items to order
    const itemCount = Math.floor(Math.random() * 3) + 1;
    let orderSubtotal = 0;
    
    for (let j = 0; j < itemCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Number(product.price);
      const tax = unitPrice * quantity * 0.22;
      const total = unitPrice * quantity + tax;
      
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          tax,
          total,
        },
      });
      
      orderSubtotal += unitPrice * quantity;
    }
    
    // Update order totals
    const orderTax = orderSubtotal * 0.22;
    const orderTotal = orderSubtotal + orderTax + 9.90;
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal: orderSubtotal,
        tax: orderTax,
        total: orderTotal,
      },
    });
  }

  console.log('✅ Orders created: 30');

  // Create inventory movements
  console.log('📦 Creating inventory movements...');
  for (let i = 0; i < 50; i++) {
    const product = products[Math.floor(Math.random() * products.length)];
    const types = ['IN', 'OUT', 'ADJUSTMENT'];
    const type = types[Math.floor(Math.random() * types.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    
    const movementDate = new Date();
    movementDate.setDate(movementDate.getDate() - Math.floor(Math.random() * 90));
    
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: type as any,
        quantity: Math.floor(Math.random() * 20) + 1,
        ...(type === 'IN' && { toLocation: location as any }),
        ...(type === 'OUT' && { fromLocation: location as any }),
        reference: `MOV-${String(i + 1).padStart(6, '0')}`,
        notes: `Movement ${type} for ${product.name}`,
        performedBy: admin.id,
        createdAt: movementDate,
      },
    });
  }

  console.log('✅ Inventory movements created: 50');

  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Users: 2 (admin@ecommerceerp.com / admin123)');
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
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
