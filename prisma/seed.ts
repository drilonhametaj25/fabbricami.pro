import { PrismaClient, InventoryLocation, OrderStatus, OrderSource } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database con dati demo completi...');
  console.log('');

  // ===== CLEAR EXISTING DATA =====
  console.log('🗑️  Pulizia dati esistenti...');

  // Delete in order of dependencies
  await prisma.suggestion.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.stockAlert.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.materialConsumption.deleteMany();
  await prisma.productionPhase.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.dDTItem.deleteMany();
  await prisma.dDT.deleteMany();
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplierItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.materialMovement.deleteMany();
  await prisma.materialInventory.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.productMaterial.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.material.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySettings.deleteMany();

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
      logo: null,
      bankName: 'Banca Intesa',
      iban: 'IT60X0542811101000000123456',
      swift: 'BCITITMM',
      defaultPaymentTerms: 30,
      defaultVatRate: 22,
      invoicePrefix: 'FT',
      invoiceNextNumber: 1,
      orderPrefix: 'ORD',
      orderNextNumber: 100,
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
    { sku: 'MAT-PLA-001', name: 'ABS Filamento 1.75mm', unit: 'KG', cost: 22.00, stock: 50, minStock: 15 },
    { sku: 'MAT-PLA-002', name: 'PLA Filamento 1.75mm', unit: 'KG', cost: 18.00, stock: 80, minStock: 20 },
    { sku: 'MAT-ELE-001', name: 'LED SMD 3528 Bianco', unit: 'PZ', cost: 0.15, stock: 2000, minStock: 500 },
    { sku: 'MAT-ELE-002', name: 'Microcontroller Arduino Nano', unit: 'PZ', cost: 8.00, stock: 30, minStock: 10 },
    { sku: 'MAT-IMB-001', name: 'Scatola Espositore Plexiglass', unit: 'PZ', cost: 15.00, stock: 100, minStock: 25 },
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

    // Crea inventory per materiale
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
    { code: 'SUP-001', name: 'Resine Italia SPA', type: 'materials', rating: 4.5 },
    { code: 'SUP-002', name: 'MetalParts GmbH', type: 'components', rating: 4.8 },
    { code: 'SUP-003', name: 'Vernici Professionali SRL', type: 'paints', rating: 4.2 },
    { code: 'SUP-004', name: 'Wood & More', type: 'wood', rating: 4.0 },
    { code: 'SUP-005', name: '3D Printing Supplies', type: 'printing', rating: 4.6 },
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
    { sku: 'AIR-P51', name: 'P-51 Mustang USAAF', scale: '1:48', price: 94.90, cost: 42.00, category: catAerei.id, stock: 35 },
    { sku: 'NAV-TIT', name: 'RMS Titanic', scale: '1:400', price: 299.90, cost: 135.00, category: catNavi.id, stock: 8 },
    { sku: 'NAV-BISM', name: 'Bismarck 1941', scale: '1:350', price: 279.90, cost: 125.00, category: catNavi.id, stock: 10 },
    { sku: 'NAV-YAMATO', name: 'Yamato 1945', scale: '1:350', price: 329.90, cost: 150.00, category: catNavi.id, stock: 6 },
    { sku: 'NAV-CUTTY', name: 'Cutty Sark', scale: '1:96', price: 189.90, cost: 85.00, category: catNavi.id, stock: 15 },
  ];

  for (const prod of productData) {
    const product = await prisma.product.create({
      data: {
        sku: prod.sku,
        name: prod.name,
        description: `Modello in scala ${prod.scale} - ${prod.name}. Realizzato con materiali di alta qualità e finiture di pregio. Include basetta espositore.`,
        type: 'SIMPLE',
        status: 'ACTIVE',
        barcode: '800' + Math.floor(Math.random() * 9000000000 + 1000000000),
        cost: prod.cost,
        price: prod.price,
        compareAtPrice: prod.price * 1.2,
        minStockLevel: 5,
        reorderQuantity: 15,
        weight: 1.5,
        length: 30,
        width: 15,
        height: 12,
        isActive: true,
        isFeatured: Math.random() > 0.7,
        categoryId: prod.category,
      },
    });
    products.push(product);

    // Crea inventory
    await prisma.inventoryItem.create({
      data: {
        warehouseId: mainWarehouse.id,
        productId: product.id,
        location: 'WEB',
        quantity: prod.stock,
        reservedQuantity: Math.floor(Math.random() * 3),
      },
    });

    await prisma.inventoryItem.create({
      data: {
        warehouseId: shopWarehouse.id,
        productId: product.id,
        location: 'B2B',
        quantity: Math.floor(prod.stock * 0.5),
        reservedQuantity: 0,
      },
    });
  }

  // ===== CUSTOMERS =====
  console.log('👥 Creazione clienti...');
  const customers = [];

  // B2C Customers
  const b2cNames = [
    { first: 'Mario', last: 'Rossi' }, { first: 'Luigi', last: 'Bianchi' },
    { first: 'Giuseppe', last: 'Verdi' }, { first: 'Franco', last: 'Neri' },
    { first: 'Alessandro', last: 'Romano' }, { first: 'Andrea', last: 'Colombo' },
    { first: 'Matteo', last: 'Ricci' }, { first: 'Luca', last: 'Marino' },
    { first: 'Giovanni', last: 'Greco' }, { first: 'Davide', last: 'Bruno' },
    { first: 'Simone', last: 'Gallo' }, { first: 'Federico', last: 'Conti' },
    { first: 'Stefano', last: 'Costa' }, { first: 'Marco', last: 'Giordano' },
    { first: 'Roberto', last: 'Mancini' },
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
          street: `Via ${['Roma', 'Milano', 'Torino', 'Venezia', 'Firenze'][Math.floor(Math.random() * 5)]} ${Math.floor(Math.random() * 100) + 1}`,
          city: ['Milano', 'Roma', 'Torino', 'Bologna', 'Firenze'][Math.floor(Math.random() * 5)],
          province: ['MI', 'RM', 'TO', 'BO', 'FI'][Math.floor(Math.random() * 5)],
          zip: String(Math.floor(Math.random() * 90000 + 10000)),
          country: 'IT',
        },
        isActive: true,
        totalOrders: Math.floor(Math.random() * 10),
        totalSpent: Math.floor(Math.random() * 2000),
      },
    });
    customers.push(customer);
  }

  // B2B Customers
  const b2bCompanies = [
    'Modellismo Italia SRL', 'Hobby Center SPA', 'Scale Models Shop',
    'Collezionismo & Modelli', 'Auto d\'Epoca Store', 'Museum Gift Shop SRL',
  ];

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
        paymentTerms: [30, 60, 90][Math.floor(Math.random() * 3)],
        discountPercentage: [5, 10, 15][Math.floor(Math.random() * 3)],
        isActive: true,
        totalOrders: Math.floor(Math.random() * 50) + 10,
        totalSpent: Math.floor(Math.random() * 50000) + 5000,
      },
    });
    customers.push(customer);
  }

  // ===== ORDERS =====
  console.log('🛒 Creazione ordini (ultimi 90 giorni)...');
  const orderStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const orderSources: OrderSource[] = ['WORDPRESS', 'B2B', 'MANUAL'];

  for (let i = 0; i < 120; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const source = customer.type === 'B2B' ? 'B2B' : orderSources[Math.floor(Math.random() * orderSources.length)];

    // Distribuzione realistica: più ordini recenti
    const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 90);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - daysAgo);

    // Status basato sull'età dell'ordine
    let status: OrderStatus;
    if (daysAgo > 14) {
      status = 'DELIVERED';
    } else if (daysAgo > 7) {
      status = Math.random() > 0.3 ? 'DELIVERED' : 'SHIPPED';
    } else if (daysAgo > 3) {
      status = ['SHIPPED', 'PROCESSING', 'DELIVERED'][Math.floor(Math.random() * 3)] as OrderStatus;
    } else {
      status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-2026-${String(i + 1).padStart(6, '0')}`,
        customerId: customer.id,
        source,
        status,
        orderDate,
        subtotal: 0,
        discount: customer.discountPercentage || 0,
        tax: 0,
        shipping: source === 'B2B' ? 0 : 9.90,
        total: 0,
        paymentMethod: source === 'B2B' ? 'bank_transfer' : ['credit_card', 'paypal', 'credit_card'][Math.floor(Math.random() * 3)],
        paymentStatus: status === 'DELIVERED' ? 'paid' : (status === 'PENDING' ? 'pending' : 'paid'),
        shippingAddress: customer.address as any,
        billingAddress: customer.address as any,
        notes: source === 'B2B' ? 'Ordine B2B - Pagamento a 30gg' : null,
      },
    });

    // Add items
    const itemCount = Math.floor(Math.random() * 4) + 1;
    let subtotal = 0;
    const usedProducts = new Set();

    for (let j = 0; j < itemCount; j++) {
      let product;
      do {
        product = products[Math.floor(Math.random() * products.length)];
      } while (usedProducts.has(product.id));
      usedProducts.add(product.id);

      const quantity = source === 'B2B' ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 2) + 1;
      const unitPrice = Number(product.price);
      const discount = customer.discountPercentage ? unitPrice * (customer.discountPercentage / 100) : 0;
      const lineTotal = (unitPrice - discount) * quantity;
      const tax = lineTotal * 0.22;

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          discount,
          tax,
          total: lineTotal + tax,
          status: status === 'DELIVERED' ? 'DELIVERED' : 'PENDING',
        },
      });

      subtotal += lineTotal;
    }

    const orderTax = subtotal * 0.22;
    const shipping = source === 'B2B' ? 0 : 9.90;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        tax: orderTax,
        total: subtotal + orderTax + shipping,
      },
    });
  }

  // ===== PURCHASE ORDERS =====
  console.log('📋 Creazione ordini di acquisto...');
  for (let i = 0; i < 20; i++) {
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const daysAgo = Math.floor(Math.random() * 60);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - daysAgo);

    const expectedDate = new Date(orderDate);
    expectedDate.setDate(expectedDate.getDate() + 14);

    const status = daysAgo > 21 ? 'RECEIVED' : (daysAgo > 7 ? 'SHIPPED' : ['DRAFT', 'SENT', 'CONFIRMED'][Math.floor(Math.random() * 3)]);

    const po = await prisma.purchaseOrder.create({
      data: {
        orderNumber: `PO-2026-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        status: status as any,
        orderDate,
        expectedDate,
        subtotal: 0,
        tax: 0,
        total: 0,
        notes: `Ordine materiali da ${supplier.name}`,
        createdById: admin.id,
      },
    });

    // Add materials
    let poSubtotal = 0;
    const itemCount = Math.floor(Math.random() * 4) + 1;

    for (let j = 0; j < itemCount; j++) {
      const material = materials[Math.floor(Math.random() * materials.length)];
      const quantity = Math.floor(Math.random() * 50) + 10;
      const unitPrice = Number(material.cost) * (0.9 + Math.random() * 0.2);
      const total = quantity * unitPrice;

      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          materialId: material.id,
          description: material.name,
          quantity,
          unitPrice,
          tax: total * 0.22,
          total: total * 1.22,
          receivedQuantity: status === 'RECEIVED' ? quantity : 0,
        },
      });

      poSubtotal += total;
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        subtotal: poSubtotal,
        tax: poSubtotal * 0.22,
        total: poSubtotal * 1.22,
      },
    });
  }

  // ===== STOCK ALERTS =====
  console.log('⚠️ Creazione alert stock...');

  // Find low stock products/materials
  for (const product of products.slice(0, 5)) {
    await prisma.stockAlert.create({
      data: {
        productId: product.id,
        alertType: 'LOW_STOCK',
        message: `Stock basso per ${product.name}: solo ${Math.floor(Math.random() * 5) + 1} unità disponibili`,
        threshold: 5,
        currentValue: Math.floor(Math.random() * 5) + 1,
        status: 'ACTIVE',
        priority: 'HIGH',
      },
    });
  }

  for (const material of materials.slice(0, 3)) {
    await prisma.stockAlert.create({
      data: {
        materialId: material.id,
        alertType: 'REORDER_POINT',
        message: `Materiale ${material.name} sotto il punto di riordino`,
        threshold: material.reorderPoint || 0,
        currentValue: Math.floor(Math.random() * (material.minStock || 10)),
        status: 'ACTIVE',
        priority: 'MEDIUM',
      },
    });
  }

  // ===== SUGGESTIONS (AI Suggestions) =====
  console.log('💡 Creazione suggerimenti AI...');

  const suggestions = [
    {
      type: 'REORDER',
      title: 'Riordino Resina Epossidica',
      description: 'La scorta di Resina Epossidica Trasparente è al 25%. Basandosi sui consumi degli ultimi 30 giorni, si consiglia di ordinare 50kg per evitare stock-out.',
      priority: 'HIGH',
      potentialSavings: 450,
      category: 'INVENTORY',
    },
    {
      type: 'PRICING',
      title: 'Opportunità aumento prezzo Ferrari 250 GTO',
      description: 'Il modello Ferrari 250 GTO ha un tasso di conversione del 85% nelle ultime 4 settimane. Si suggerisce un aumento del prezzo del 10% per massimizzare il margine.',
      priority: 'MEDIUM',
      potentialSavings: 1200,
      category: 'SALES',
    },
    {
      type: 'PRODUCTION',
      title: 'Pianifica produzione Porsche 911',
      description: 'Le scorte del modello Porsche 911 Carrera RS 1973 copriranno solo 12 giorni di vendite. Avviare un ordine di produzione per 25 unità.',
      priority: 'HIGH',
      potentialSavings: 0,
      category: 'PRODUCTION',
    },
    {
      type: 'SUPPLIER',
      title: 'Negozia con MetalParts GmbH',
      description: 'Hai ordinato €15.000 di componenti metallici negli ultimi 6 mesi. Contatta il fornitore per negoziare uno sconto volume del 8-10%.',
      priority: 'MEDIUM',
      potentialSavings: 1500,
      category: 'PURCHASING',
    },
    {
      type: 'DEADSTOCK',
      title: 'Promozione Cutty Sark',
      description: 'Il modello Cutty Sark non ha vendite da 45 giorni. Considera una promozione del 15% o inseriscilo in un bundle con altri modelli navali.',
      priority: 'LOW',
      potentialSavings: 800,
      category: 'INVENTORY',
    },
    {
      type: 'CASHFLOW',
      title: 'Sollecito pagamento Cliente B2B',
      description: 'Il cliente "Hobby Center SPA" ha una fattura scaduta da 15 giorni per €2.340. Inviare sollecito di pagamento.',
      priority: 'HIGH',
      potentialSavings: 2340,
      category: 'FINANCE',
    },
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

    const baseOrders = Math.floor(Math.random() * 8) + 2;
    const weekday = date.getDay();
    const multiplier = weekday === 0 || weekday === 6 ? 0.6 : 1;
    const ordersCount = Math.floor(baseOrders * multiplier);
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

  const notifications = [
    { type: 'ORDER', title: 'Nuovo ordine #ORD-2026-000118', message: 'Hai ricevuto un nuovo ordine da Mario Rossi per €289.90', priority: 'MEDIUM' },
    { type: 'STOCK', title: 'Stock critico: Ferrari F40', message: 'Il prodotto Ferrari F40 ha solo 3 unità disponibili', priority: 'HIGH' },
    { type: 'PAYMENT', title: 'Pagamento ricevuto', message: 'Pagamento di €1.250,00 ricevuto da Hobby Center SPA', priority: 'LOW' },
    { type: 'SHIPMENT', title: 'Ordine spedito', message: 'L\'ordine #ORD-2026-000102 è stato spedito con BRT', priority: 'LOW' },
    { type: 'SYSTEM', title: 'Backup completato', message: 'Il backup giornaliero del database è stato completato con successo', priority: 'LOW' },
  ];

  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        type: notif.type as any,
        title: notif.title,
        message: notif.message,
        priority: notif.priority as any,
        isRead: Math.random() > 0.5,
        userId: admin.id,
      },
    });
  }

  // ===== SUMMARY =====
  console.log('');
  console.log('🎉 Database popolato con successo!');
  console.log('');
  console.log('📊 Riepilogo dati creati:');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  👤 Utenti:            5');
  console.log('  👷 Dipendenti:        5');
  console.log('  🏭 Magazzini:         2');
  console.log('  📂 Categorie:         4');
  console.log('  🧱 Materiali:        15');
  console.log('  📦 Prodotti:         15');
  console.log('  🚚 Fornitori:         5');
  console.log('  👥 Clienti:          21 (15 B2C + 6 B2B)');
  console.log('  🛒 Ordini:          120');
  console.log('  📋 Ordini Acquisto:  20');
  console.log('  ⚠️  Stock Alerts:      8');
  console.log('  💡 Suggerimenti AI:   6');
  console.log('  📊 Daily Summaries:  31');
  console.log('  🔔 Notifiche:         5');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔐 Credenziali di accesso:');
  console.log('  Email:    admin@fabbricami.pro');
  console.log('  Password: admin123');
  console.log('');
  console.log('  Altri utenti (stessa password):');
  console.log('  - manager@fabbricami.pro (Manager)');
  console.log('  - magazzino@fabbricami.pro (Magazziniere)');
  console.log('  - contabilita@fabbricami.pro (Contabile)');
  console.log('  - vendite@fabbricami.pro (Commerciale)');
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Errore durante il seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
