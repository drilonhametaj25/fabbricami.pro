import { PrismaClient, InventoryLocation, OrderStatus, OrderSource } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database con dati demo completi...');
  console.log('');

  // ===== CLEAR EXISTING DATA =====
  console.log('🗑️  Pulizia dati esistenti...');

  // Delete in order of dependencies
  try { await prisma.suggestion.deleteMany(); } catch (e) {}
  try { await prisma.dailySummary.deleteMany(); } catch (e) {}
  try { await prisma.stockAlert.deleteMany(); } catch (e) {}
  try { await prisma.notification.deleteMany(); } catch (e) {}
  try { await prisma.materialConsumption.deleteMany(); } catch (e) {}
  try { await prisma.productionPhase.deleteMany(); } catch (e) {}
  try { await prisma.productionOrder.deleteMany(); } catch (e) {}
  try { await prisma.dDTItem.deleteMany(); } catch (e) {}
  try { await prisma.dDT.deleteMany(); } catch (e) {}
  try { await prisma.goodsReceiptItem.deleteMany(); } catch (e) {}
  try { await prisma.goodsReceipt.deleteMany(); } catch (e) {}
  try { await prisma.purchaseOrderItem.deleteMany(); } catch (e) {}
  try { await prisma.purchaseOrder.deleteMany(); } catch (e) {}
  try { await prisma.supplierItem.deleteMany(); } catch (e) {}
  try { await prisma.supplier.deleteMany(); } catch (e) {}
  try { await prisma.orderItem.deleteMany(); } catch (e) {}
  try { await prisma.order.deleteMany(); } catch (e) {}
  try { await prisma.inventoryMovement.deleteMany(); } catch (e) {}
  try { await prisma.inventoryItem.deleteMany(); } catch (e) {}
  try { await prisma.materialMovement.deleteMany(); } catch (e) {}
  try { await prisma.materialInventory.deleteMany(); } catch (e) {}
  try { await prisma.bomItem.deleteMany(); } catch (e) {}
  try { await prisma.productMaterial.deleteMany(); } catch (e) {}
  try { await prisma.productVariant.deleteMany(); } catch (e) {}
  try { await prisma.product.deleteMany(); } catch (e) {}
  try { await prisma.material.deleteMany(); } catch (e) {}
  try { await prisma.productCategory.deleteMany(); } catch (e) {}
  try { await prisma.warehouse.deleteMany(); } catch (e) {}
  try { await prisma.customer.deleteMany(); } catch (e) {}
  try { await prisma.employee.deleteMany(); } catch (e) {}
  try { await prisma.user.deleteMany(); } catch (e) {}
  try { await prisma.companySettings.deleteMany(); } catch (e) {}

  // ===== COMPANY SETTINGS =====
  console.log('🏢 Configurazione azienda...');
  await prisma.companySettings.create({
    data: {
      companyName: 'FabbricaMi SRL',
      vatNumber: 'IT12345678901',
      fiscalCode: '12345678901',
      address: 'Via della Manifattura 42',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      country: 'IT',
      phone: '+39 02 12345678',
      email: 'info@fabbricami.pro',
      pec: 'fabbricami@pec.it',
      sdiCode: 'USAL8PV',
      website: 'https://fabbricami.pro',
      bankName: 'Banca Intesa',
      iban: 'IT60X0542811101000000123456',
      bic: 'BCITITMM',
      invoicePrefix: 'FV',
      invoiceNextNumber: 1,
    },
  });

  // ===== USERS =====
  console.log('👤 Creazione utenti...');
  const adminPassword = await hashPassword('admin123');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@fabbricami.pro',
      password: adminPassword,
      firstName: 'Marco',
      lastName: 'Bianchi',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@fabbricami.pro',
      password: adminPassword,
      firstName: 'Laura',
      lastName: 'Rossi',
      role: 'MANAGER',
      isActive: true,
    },
  });

  const magazziniere = await prisma.user.create({
    data: {
      email: 'magazzino@fabbricami.pro',
      password: adminPassword,
      firstName: 'Giuseppe',
      lastName: 'Verdi',
      role: 'MAGAZZINIERE',
      isActive: true,
    },
  });

  const contabile = await prisma.user.create({
    data: {
      email: 'contabilita@fabbricami.pro',
      password: adminPassword,
      firstName: 'Anna',
      lastName: 'Ferrari',
      role: 'CONTABILE',
      isActive: true,
    },
  });

  const commerciale = await prisma.user.create({
    data: {
      email: 'vendite@fabbricami.pro',
      password: adminPassword,
      firstName: 'Paolo',
      lastName: 'Colombo',
      role: 'COMMERCIALE',
      isActive: true,
    },
  });

  // ===== EMPLOYEES =====
  console.log('👷 Creazione dipendenti...');
  await prisma.employee.create({
    data: {
      userId: admin.id,
      employeeCode: 'EMP-001',
      position: 'Amministratore Delegato',
      department: 'Direzione',
      hourlyRate: 50.00,
      hireDate: new Date('2020-01-01'),
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      userId: manager.id,
      employeeCode: 'EMP-002',
      position: 'Responsabile Produzione',
      department: 'Produzione',
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
      department: 'Logistica',
      hourlyRate: 22.00,
      hireDate: new Date('2021-06-01'),
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      userId: contabile.id,
      employeeCode: 'EMP-004',
      position: 'Responsabile Amministrativo',
      department: 'Amministrazione',
      hourlyRate: 30.00,
      hireDate: new Date('2020-09-01'),
      isActive: true,
    },
  });

  await prisma.employee.create({
    data: {
      userId: commerciale.id,
      employeeCode: 'EMP-005',
      position: 'Sales Manager',
      department: 'Commerciale',
      hourlyRate: 28.00,
      hireDate: new Date('2022-01-15'),
      isActive: true,
    },
  });

  // ===== WAREHOUSES =====
  console.log('🏭 Creazione magazzini...');
  const mainWarehouse = await prisma.warehouse.create({
    data: {
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
      code: 'WH-SHOP',
      name: 'Magazzino E-commerce',
      description: 'Stock dedicato alle vendite online',
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

  // ===== PRODUCT CATEGORIES =====
  console.log('📂 Creazione categorie...');
  const catModellismo = await prisma.productCategory.create({
    data: {
      name: 'Modellismo',
      slug: 'modellismo',
      description: 'Modelli in scala di alta qualità',
    },
  });

  const catAuto = await prisma.productCategory.create({
    data: {
      name: 'Auto d\'Epoca',
      slug: 'auto-epoca',
      description: 'Riproduzioni di auto storiche',
      parentId: catModellismo.id,
    },
  });

  const catAerei = await prisma.productCategory.create({
    data: {
      name: 'Aerei',
      slug: 'aerei',
      description: 'Modelli di aerei storici e moderni',
      parentId: catModellismo.id,
    },
  });

  const catNavi = await prisma.productCategory.create({
    data: {
      name: 'Navi',
      slug: 'navi',
      description: 'Modelli navali in scala',
      parentId: catModellismo.id,
    },
  });

  // ===== MATERIALS (Materie Prime) =====
  console.log('🧱 Creazione materiali...');
  const materials = [];

  const materialData = [
    { sku: 'MAT-RES-001', name: 'Resina Epossidica Trasparente', unit: 'KG', cost: 45.00, stock: 150, minStock: 30 },
    { sku: 'MAT-RES-002', name: 'Resina Poliuretanica', unit: 'KG', cost: 38.00, stock: 80, minStock: 20 },
    { sku: 'MAT-MET-001', name: 'Lamiera Alluminio 0.5mm', unit: 'MQ', cost: 25.00, stock: 200, minStock: 50 },
    { sku: 'MAT-MET-002', name: 'Filo Ottone 1mm', unit: 'MT', cost: 2.50, stock: 500, minStock: 100 },
    { sku: 'MAT-MET-003', name: 'Lamiera Acciaio Inox 0.3mm', unit: 'MQ', cost: 35.00, stock: 100, minStock: 25 },
    { sku: 'MAT-LEG-001', name: 'Legno Tiglio 5mm', unit: 'MQ', cost: 18.00, stock: 120, minStock: 30 },
    { sku: 'MAT-LEG-002', name: 'Compensato Betulla 3mm', unit: 'MQ', cost: 12.00, stock: 200, minStock: 50 },
    { sku: 'MAT-VER-001', name: 'Vernice Acrilica Set Base', unit: 'SET', cost: 28.00, stock: 60, minStock: 15 },
    { sku: 'MAT-VER-002', name: 'Vernice Metallizzata Oro', unit: 'LT', cost: 42.00, stock: 25, minStock: 10 },
    { sku: 'MAT-VER-003', name: 'Trasparente Lucido 2K', unit: 'LT', cost: 55.00, stock: 40, minStock: 15 },
  ];

  for (const mat of materialData) {
    const material = await prisma.material.create({
      data: {
        sku: mat.sku,
        name: mat.name,
        description: `${mat.name} per produzione modelli`,
        unit: mat.unit,
        cost: mat.cost,
        minStock: mat.minStock,
        reorderPoint: mat.minStock * 1.5,
        currentStock: mat.stock,
        isActive: true,
      },
    });
    materials.push(material);

    await prisma.materialInventory.create({
      data: {
        materialId: material.id,
        warehouseId: mainWarehouse.id,
        quantity: mat.stock,
        reservedQuantity: 0,
      },
    });
  }

  // ===== SUPPLIERS =====
  console.log('🚚 Creazione fornitori...');
  const suppliers = [];

  const supplierData = [
    { code: 'SUP-001', name: 'Resine Italia SPA', rating: 4.5 },
    { code: 'SUP-002', name: 'MetalParts GmbH', rating: 4.8 },
    { code: 'SUP-003', name: 'Vernici Professionali SRL', rating: 4.2 },
    { code: 'SUP-004', name: 'Wood & More', rating: 4.0 },
    { code: 'SUP-005', name: '3D Printing Supplies', rating: 4.6 },
  ];

  for (const sup of supplierData) {
    const supplier = await prisma.supplier.create({
      data: {
        code: sup.code,
        name: sup.name,
        email: `ordini@${sup.name.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '+39 02 ' + Math.floor(Math.random() * 9000000 + 1000000),
        address: {
          street: `Via Fornitori ${Math.floor(Math.random() * 100)}`,
          city: 'Milano',
          province: 'MI',
          zip: '20100',
          country: 'IT',
        },
        vatNumber: 'IT' + Math.floor(Math.random() * 90000000000 + 10000000000),
        paymentTerms: 30,
        isActive: true,
        rating: sup.rating,
      },
    });
    suppliers.push(supplier);
  }

  // ===== PRODUCTS =====
  console.log('📦 Creazione prodotti...');
  const products = [];

  const productData = [
    { sku: 'FER-250-GTO', name: 'Ferrari 250 GTO 1962', scale: '1:18', price: 189.90, cost: 85.00, category: catAuto.id, stock: 25 },
    { sku: 'FER-F40', name: 'Ferrari F40 1987', scale: '1:18', price: 169.90, cost: 75.00, category: catAuto.id, stock: 30 },
    { sku: 'LAM-COUN', name: 'Lamborghini Countach LP400', scale: '1:18', price: 179.90, cost: 80.00, category: catAuto.id, stock: 20 },
    { sku: 'POR-911-73', name: 'Porsche 911 Carrera RS 1973', scale: '1:18', price: 159.90, cost: 70.00, category: catAuto.id, stock: 35 },
    { sku: 'AST-DB5', name: 'Aston Martin DB5 James Bond', scale: '1:18', price: 199.90, cost: 90.00, category: catAuto.id, stock: 15 },
    { sku: 'MER-300SL', name: 'Mercedes 300SL Gullwing', scale: '1:18', price: 174.90, cost: 78.00, category: catAuto.id, stock: 22 },
    { sku: 'JAG-ETYPE', name: 'Jaguar E-Type 1961', scale: '1:18', price: 164.90, cost: 73.00, category: catAuto.id, stock: 28 },
    { sku: 'AIR-CONC', name: 'Concorde Air France', scale: '1:200', price: 249.90, cost: 110.00, category: catAerei.id, stock: 12 },
    { sku: 'AIR-B747', name: 'Boeing 747-400 Alitalia', scale: '1:200', price: 189.90, cost: 85.00, category: catAerei.id, stock: 18 },
    { sku: 'AIR-SPIT', name: 'Spitfire Mk.V RAF', scale: '1:48', price: 89.90, cost: 40.00, category: catAerei.id, stock: 40 },
    { sku: 'NAV-TIT', name: 'RMS Titanic', scale: '1:400', price: 299.90, cost: 135.00, category: catNavi.id, stock: 8 },
    { sku: 'NAV-BISM', name: 'Bismarck 1941', scale: '1:350', price: 279.90, cost: 125.00, category: catNavi.id, stock: 10 },
  ];

  for (const prod of productData) {
    const product = await prisma.product.create({
      data: {
        sku: prod.sku,
        name: prod.name,
        description: `Modello in scala ${prod.scale} - ${prod.name}. Realizzato con materiali di alta qualità.`,
        type: 'SIMPLE',
        status: 'ACTIVE',
        barcode: '800' + Math.floor(Math.random() * 9000000000 + 1000000000),
        cost: prod.cost,
        price: prod.price,
        compareAtPrice: prod.price * 1.2,
        minStockLevel: 5,
        reorderQuantity: 15,
        weight: 1.5,
        isActive: true,
        isFeatured: Math.random() > 0.7,
        categoryId: prod.category,
      },
    });
    products.push(product);

    await prisma.inventoryItem.create({
      data: {
        warehouseId: mainWarehouse.id,
        productId: product.id,
        location: 'WEB',
        quantity: prod.stock,
        reservedQuantity: Math.floor(Math.random() * 3),
      },
    });
  }

  // ===== CUSTOMERS =====
  console.log('👥 Creazione clienti...');
  const customers = [];

  const b2cNames = [
    { first: 'Mario', last: 'Rossi' }, { first: 'Luigi', last: 'Bianchi' },
    { first: 'Giuseppe', last: 'Verdi' }, { first: 'Franco', last: 'Neri' },
    { first: 'Alessandro', last: 'Romano' }, { first: 'Andrea', last: 'Colombo' },
    { first: 'Matteo', last: 'Ricci' }, { first: 'Luca', last: 'Marino' },
  ];

  for (let i = 0; i < b2cNames.length; i++) {
    const name = b2cNames[i];
    const customer = await prisma.customer.create({
      data: {
        code: `CLI-B2C-${String(i + 1).padStart(3, '0')}`,
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
        code: `CLI-B2B-${String(i + 1).padStart(3, '0')}`,
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
        discountPercentage: 10,
        isActive: true,
      },
    });
    customers.push(customer);
  }

  // ===== ORDERS =====
  console.log('🛒 Creazione ordini...');
  const orderStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const orderSources: OrderSource[] = ['WORDPRESS', 'B2B', 'MANUAL'];

  for (let i = 0; i < 50; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const source = orderSources[Math.floor(Math.random() * orderSources.length)];
    const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 60);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - daysAgo);

    let status: OrderStatus = daysAgo > 14 ? 'DELIVERED' : orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-2026-${String(i + 1).padStart(6, '0')}`,
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

  // ===== STOCK ALERTS =====
  console.log('⚠️ Creazione alert stock...');
  for (const product of products.slice(0, 3)) {
    await prisma.stockAlert.create({
      data: {
        productId: product.id,
        alertType: 'LOW_STOCK',
        message: `Stock basso per ${product.name}`,
        threshold: 5,
        currentValue: Math.floor(Math.random() * 5) + 1,
        status: 'ACTIVE',
        priority: 'HIGH',
      },
    });
  }

  // ===== SUGGESTIONS =====
  console.log('💡 Creazione suggerimenti AI...');
  const suggestions = [
    { type: 'REORDER', title: 'Riordino Resina Epossidica', description: 'Scorta al 25%. Ordinare 50kg.', priority: 'HIGH', potentialSavings: 450, category: 'INVENTORY' },
    { type: 'PRICING', title: 'Aumento prezzo Ferrari 250 GTO', description: 'Conversione 85%. Aumentare del 10%.', priority: 'MEDIUM', potentialSavings: 1200, category: 'SALES' },
    { type: 'PRODUCTION', title: 'Produzione Porsche 911', description: 'Stock per 12 giorni. Produrre 25 unità.', priority: 'HIGH', potentialSavings: 0, category: 'PRODUCTION' },
  ];

  for (const sug of suggestions) {
    await prisma.suggestion.create({
      data: {
        type: sug.type as any,
        title: sug.title,
        description: sug.description,
        priority: sug.priority as any,
        status: 'PENDING',
        potentialSavings: sug.potentialSavings,
        category: sug.category,
        metadata: {},
      },
    });
  }

  // ===== DAILY SUMMARIES =====
  console.log('📊 Creazione riepiloghi giornalieri...');
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const ordersCount = Math.floor(Math.random() * 8) + 2;
    const avgOrderValue = 150 + Math.random() * 100;

    await prisma.dailySummary.create({
      data: {
        date,
        totalOrders: ordersCount,
        totalRevenue: ordersCount * avgOrderValue,
        totalCost: ordersCount * avgOrderValue * 0.45,
        newCustomers: Math.floor(Math.random() * 3),
        returningCustomers: Math.floor(ordersCount * 0.6),
        averageOrderValue: avgOrderValue,
        topSellingProductId: products[Math.floor(Math.random() * products.length)].id,
        lowStockAlerts: Math.floor(Math.random() * 3),
        pendingShipments: Math.floor(Math.random() * 5) + 1,
      },
    });
  }

  // ===== NOTIFICATIONS =====
  console.log('🔔 Creazione notifiche...');
  await prisma.notification.create({
    data: {
      type: 'ORDER',
      title: 'Nuovo ordine #ORD-2026-000050',
      message: 'Nuovo ordine da Mario Rossi per €289.90',
      priority: 'MEDIUM',
      isRead: false,
      userId: admin.id,
    },
  });

  await prisma.notification.create({
    data: {
      type: 'STOCK',
      title: 'Stock critico: Ferrari F40',
      message: 'Solo 3 unità disponibili',
      priority: 'HIGH',
      isRead: false,
      userId: admin.id,
    },
  });

  // ===== SUMMARY =====
  console.log('');
  console.log('🎉 Database popolato con successo!');
  console.log('');
  console.log('📊 Riepilogo:');
  console.log('  👤 Utenti: 5');
  console.log('  🏭 Magazzini: 2');
  console.log('  🧱 Materiali: 10');
  console.log('  📦 Prodotti: 12');
  console.log('  🚚 Fornitori: 5');
  console.log('  👥 Clienti: 11');
  console.log('  🛒 Ordini: 50');
  console.log('  💡 Suggerimenti: 3');
  console.log('  📊 Daily Summaries: 31');
  console.log('');
  console.log('🔐 Login: admin@fabbricami.pro / admin123');
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Errore:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
