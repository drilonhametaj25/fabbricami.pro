import { PrismaClient, InventoryLocation, OrderStatus, OrderSource, CustomerType, UserRole } from '@prisma/client';
import { hashPassword } from '../src/server/utils/crypto.util';

const prisma = new PrismaClient();

// ============================================
// DATI DEMO - ECOMMERCEERP
// ============================================

// Nomi italiani realistici
const italianFirstNames = [
  'Marco', 'Luca', 'Andrea', 'Francesco', 'Alessandro', 'Matteo', 'Lorenzo', 'Simone',
  'Giulia', 'Chiara', 'Francesca', 'Sara', 'Valentina', 'Alessia', 'Martina', 'Elena',
  'Giuseppe', 'Antonio', 'Giovanni', 'Paolo', 'Stefano', 'Roberto', 'Davide', 'Federico'
];

const italianLastNames = [
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci',
  'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano',
  'Mancini', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani'
];

const italianCities = [
  { city: 'Milano', province: 'MI', zip: '20100' },
  { city: 'Roma', province: 'RM', zip: '00100' },
  { city: 'Napoli', province: 'NA', zip: '80100' },
  { city: 'Torino', province: 'TO', zip: '10100' },
  { city: 'Palermo', province: 'PA', zip: '90100' },
  { city: 'Genova', province: 'GE', zip: '16100' },
  { city: 'Bologna', province: 'BO', zip: '40100' },
  { city: 'Firenze', province: 'FI', zip: '50100' },
  { city: 'Bari', province: 'BA', zip: '70100' },
  { city: 'Catania', province: 'CT', zip: '95100' },
  { city: 'Venezia', province: 'VE', zip: '30100' },
  { city: 'Verona', province: 'VR', zip: '37100' },
];

const streetNames = [
  'Via Roma', 'Via Milano', 'Via Garibaldi', 'Via Mazzini', 'Via Dante', 'Via Cavour',
  'Corso Italia', 'Corso Vittorio Emanuele', 'Via della Repubblica', 'Via XX Settembre',
  'Via Marconi', 'Via Verdi', 'Via Leopardi', 'Via Foscolo', 'Viale Europa'
];

// Prodotti demo - Modellini in scala
const demoProducts = [
  // AUTO CLASSICHE
  { name: 'Ferrari 250 GTO 1962', category: 'AUTO', price: 189.90, cost: 95.00, description: 'Replica in scala 1:18 della leggendaria Ferrari 250 GTO, vincitrice di numerosi campionati mondiali. Dettagli minuziosi e verniciatura metallizzata.', image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800' },
  { name: 'Lamborghini Miura SV 1971', category: 'AUTO', price: 199.90, cost: 100.00, description: 'Modello in scala 1:18 della Lamborghini Miura SV, considerata la prima supercar della storia. Porte apribili e motore dettagliato.', image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800' },
  { name: 'Porsche 911 Carrera RS 2.7', category: 'AUTO', price: 159.90, cost: 80.00, description: 'Iconica Porsche 911 Carrera RS in scala 1:18 con la caratteristica striscia laterale e alettone posteriore.', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800' },
  { name: 'Alfa Romeo 33 Stradale', category: 'AUTO', price: 219.90, cost: 110.00, description: 'Capolavoro del design italiano in scala 1:18. Porte ad ali di gabbiano e interni in pelle riprodotti fedelmente.', image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800' },
  { name: 'Aston Martin DB5 1964', category: 'AUTO', price: 179.90, cost: 90.00, description: 'La vettura di James Bond in scala 1:18. Dettagli cromati e verniciatura Silver Birch originale.', image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800' },
  { name: 'Jaguar E-Type Series 1', category: 'AUTO', price: 169.90, cost: 85.00, description: 'Definita da Enzo Ferrari "la macchina più bella mai costruita". Scala 1:18 con cofano apribile.', image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800' },
  { name: 'Mercedes 300SL Gullwing', category: 'AUTO', price: 209.90, cost: 105.00, description: 'Mercedes-Benz 300SL con le iconiche porte ad ali di gabbiano funzionanti. Scala 1:18.', image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800' },
  { name: 'Ford GT40 Le Mans 1966', category: 'AUTO', price: 189.90, cost: 95.00, description: 'La vettura che ha battuto Ferrari a Le Mans. Livrea Gulf Racing in scala 1:18.', image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800' },

  // AEREI
  { name: 'Spitfire Mk.V RAF 1942', category: 'AEREI', price: 129.90, cost: 65.00, description: 'Leggendario caccia britannico della WWII in scala 1:48. Dettagli cockpit e carrello retrattile.', image: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800' },
  { name: 'P-51D Mustang "Big Beautiful Doll"', category: 'AEREI', price: 139.90, cost: 70.00, description: 'Caccia americano WWII in scala 1:48 con nose art originale e dettagli interni.', image: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=800' },
  { name: 'Messerschmitt Bf 109 G-6', category: 'AEREI', price: 119.90, cost: 60.00, description: 'Caccia tedesco in scala 1:48 con camouflage desertico e pilota incluso.', image: 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800' },
  { name: 'Concorde Air France', category: 'AEREI', price: 199.90, cost: 100.00, description: 'Il supersonico Concorde in scala 1:200 con livrea Air France. Supporto incluso.', image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800' },
  { name: 'Boeing 747-400 Lufthansa', category: 'AEREI', price: 149.90, cost: 75.00, description: 'Jumbo jet in scala 1:200 con livrea Lufthansa attuale. Carrello e winglet dettagliati.', image: 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800' },
  { name: 'F-14 Tomcat "Top Gun"', category: 'AEREI', price: 159.90, cost: 80.00, description: 'Il caccia del film Top Gun in scala 1:72. Ali a geometria variabile funzionanti.', image: 'https://images.unsplash.com/photo-1534481016308-0fca71578ae5?w=800' },

  // NAVI
  { name: 'RMS Titanic 1912', category: 'NAVI', price: 249.90, cost: 125.00, description: 'Il transatlantico più famoso in scala 1:400. Oltre 300 pezzi, scialuppe e dettagli ponte.', image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800' },
  { name: 'USS Enterprise CVN-65', category: 'NAVI', price: 299.90, cost: 150.00, description: 'Prima portaerei nucleare in scala 1:350. Include aerei di bordo e personale.', image: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800' },
  { name: 'Bismarck 1941', category: 'NAVI', price: 279.90, cost: 140.00, description: 'Corazzata tedesca WWII in scala 1:350. Torrette rotanti e dettagli radar.', image: 'https://images.unsplash.com/photo-1534397860164-120c97f4db0b?w=800' },
  { name: 'Amerigo Vespucci', category: 'NAVI', price: 349.90, cost: 175.00, description: 'La nave scuola più bella del mondo in scala 1:150. Vele in tessuto e attrezzatura velica completa.', image: 'https://images.unsplash.com/photo-1534854638093-bada1813ca19?w=800' },
  { name: 'HMS Victory 1765', category: 'NAVI', price: 399.90, cost: 200.00, description: 'La nave ammiraglia di Nelson in scala 1:100. Kit in legno con istruzioni dettagliate.', image: 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800' },
  { name: 'Yacht Riva Aquarama', category: 'NAVI', price: 189.90, cost: 95.00, description: 'Iconico motoscafo italiano in scala 1:20. Legno e cromo come l\'originale.', image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800' },

  // MEZZI MILITARI
  { name: 'Tiger I Ausf. E 1943', category: 'MILITARI', price: 89.90, cost: 45.00, description: 'Carro armato pesante tedesco in scala 1:35. Torretta rotante e cingoli articolati.', image: 'https://images.unsplash.com/photo-1580424917967-a8867a6e676e?w=800' },
  { name: 'Sherman M4A3 "Fury"', category: 'MILITARI', price: 84.90, cost: 42.00, description: 'Il carro del film Fury in scala 1:35. Dettagli interni visibili e equipaggio.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
  { name: 'T-34/85 Soviet Tank', category: 'MILITARI', price: 79.90, cost: 40.00, description: 'Carro medio sovietico WWII in scala 1:35. Il più prodotto della storia.', image: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800' },
  { name: 'Panther Ausf. G', category: 'MILITARI', price: 94.90, cost: 47.00, description: 'Il miglior carro tedesco WWII in scala 1:35. Camouflage ambush e zimmerit.', image: 'https://images.unsplash.com/photo-1562575214-da9fcf59b907?w=800' },
  { name: 'Humvee M1025', category: 'MILITARI', price: 69.90, cost: 35.00, description: 'Veicolo militare americano in scala 1:35. Configurazione Desert Storm.', image: 'https://images.unsplash.com/photo-1503594384566-461fe158e797?w=800' },

  // MOTO D\'EPOCA
  { name: 'Harley-Davidson WLA 1942', category: 'MOTO', price: 99.90, cost: 50.00, description: 'La moto dell\'esercito americano WWII in scala 1:9. Dettagli cromati e sella in pelle.', image: 'https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=800' },
  { name: 'Ducati 916 SPS', category: 'MOTO', price: 119.90, cost: 60.00, description: 'Capolavoro del design Tamburini in scala 1:9. Livrea rossa Ducati e scarichi Termignoni.', image: 'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=800' },
  { name: 'BMW R75 con Sidecar', category: 'MOTO', price: 139.90, cost: 70.00, description: 'Combinazione moto-sidecar tedesca WWII in scala 1:9. Due figure incluse.', image: 'https://images.unsplash.com/photo-1558980664-769d59546b3d?w=800' },
  { name: 'Vespa 150 GS 1955', category: 'MOTO', price: 89.90, cost: 45.00, description: 'Icona del design italiano in scala 1:6. La "Vespa Sport" in verde metallizzato.', image: 'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=800' },
  { name: 'Honda CB750 Four 1969', category: 'MOTO', price: 109.90, cost: 55.00, description: 'La prima superbike giapponese in scala 1:9. Quattro cilindri e scarichi cromati.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
];

// Aziende B2B italiane
const b2bCompanies = [
  { name: 'Model Shop Italia SRL', city: 'Milano' },
  { name: 'Hobby Center Roma SPA', city: 'Roma' },
  { name: 'Modellismo Professionale SNC', city: 'Bologna' },
  { name: 'Scale Models Torino SRL', city: 'Torino' },
  { name: 'Giocattoli & Modelli Napoli SAS', city: 'Napoli' },
  { name: 'Collezionismo Firenze SRL', city: 'Firenze' },
  { name: 'Miniature World Verona', city: 'Verona' },
  { name: 'Diecast Italia Distribution', city: 'Genova' },
];

// Utility functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

function generateItalianTaxId(): string {
  return `IT${String(Math.floor(Math.random() * 10000000000)).padStart(11, '0')}`;
}

function generateFiscalCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * 26)];
  code += String(randomInt(10, 99));
  code += letters[Math.floor(Math.random() * 26)];
  code += String(randomInt(10, 31)).padStart(2, '0');
  code += letters[Math.floor(Math.random() * 26)];
  code += String(randomInt(100, 999));
  code += letters[Math.floor(Math.random() * 26)];
  return code;
}

async function main() {
  console.log('🌱 Seeding database with DEMO data...\n');

  // ============================================
  // CLEAR EXISTING DATA
  // ============================================
  console.log('🗑️  Clearing existing data...');

  // Cancella in ordine inverso alle dipendenze
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

  console.log('✅ Data cleared\n');

  // ============================================
  // CREATE USERS
  // ============================================
  console.log('👤 Creating demo users...');

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'demo@ecommerceerp.com',
        password: await hashPassword('Demo2024!'),
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'ADMIN' as UserRole,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'viewer@ecommerceerp.com',
        password: await hashPassword('Viewer2024!'),
        firstName: 'Visualizzatore',
        lastName: 'Demo',
        role: 'VIEWER' as UserRole,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'magazzino@ecommerceerp.com',
        password: await hashPassword('Magazzino2024!'),
        firstName: 'Magazziniere',
        lastName: 'Demo',
        role: 'MAGAZZINIERE' as UserRole,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users\n`);

  // ============================================
  // CREATE EMPLOYEES
  // ============================================
  console.log('👷 Creating employees...');

  const employees = await Promise.all(
    users.map((user, index) =>
      prisma.employee.create({
        data: {
          userId: user.id,
          employeeCode: `EMP-${String(index + 1).padStart(3, '0')}`,
          position: index === 0 ? 'Amministratore' : index === 1 ? 'Responsabile Vendite' : 'Magazziniere',
          hourlyRate: index === 0 ? 30.0 : index === 1 ? 22.0 : 18.0,
          hireDate: new Date('2020-01-15'),
          isActive: true,
        },
      })
    )
  );

  console.log(`✅ Created ${employees.length} employees\n`);

  // ============================================
  // CREATE WAREHOUSES
  // ============================================
  console.log('🏢 Creating warehouses...');

  const mainWarehouse = await prisma.warehouse.create({
    data: {
      code: 'WH-MAIN',
      name: 'Magazzino Principale',
      description: 'Magazzino principale EcommerceERP - Sede di Milano',
      address: {
        street: 'Via della Logistica 15',
        city: 'Milano',
        province: 'MI',
        zip: '20157',
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
      description: 'Magazzino dedicato alle fiere del modellismo e eventi speciali',
      address: {
        street: 'Via Fiera 42',
        city: 'Rho',
        province: 'MI',
        zip: '20017',
        country: 'Italia',
      },
      isActive: true,
      isPrimary: false,
    },
  });

  console.log('✅ Created 2 warehouses\n');

  // ============================================
  // CREATE CUSTOMERS
  // ============================================
  console.log('👥 Creating customers...');

  const customers: any[] = [];

  // B2C Customers (12)
  for (let i = 1; i <= 12; i++) {
    const firstName = randomElement(italianFirstNames);
    const lastName = randomElement(italianLastNames);
    const location = randomElement(italianCities);
    const street = `${randomElement(streetNames)} ${randomInt(1, 150)}`;

    const customer = await prisma.customer.create({
      data: {
        code: `CUST-B2C-${String(i).padStart(3, '0')}`,
        type: 'B2C' as CustomerType,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@gmail.com`,
        phone: `+39 3${randomInt(20, 99)} ${randomInt(1000000, 9999999)}`,
        fiscalCode: generateFiscalCode(),
        address: {
          street,
          city: location.city,
          province: location.province,
          zip: location.zip,
          country: 'IT',
        },
        billingAddress: {
          firstName,
          lastName,
          address1: street,
          city: location.city,
          state: location.province,
          postcode: location.zip,
          country: 'IT',
        },
        shippingAddress: {
          firstName,
          lastName,
          address1: street,
          city: location.city,
          state: location.province,
          postcode: location.zip,
          country: 'IT',
        },
        isActive: true,
        paymentTerms: 0,
      },
    });
    customers.push(customer);
  }

  // B2B Customers (8)
  for (let i = 0; i < b2bCompanies.length; i++) {
    const company = b2bCompanies[i];
    const location = italianCities.find(c => c.city === company.city) || italianCities[0];
    const street = `${randomElement(streetNames)} ${randomInt(1, 150)}`;

    const customer = await prisma.customer.create({
      data: {
        code: `CUST-B2B-${String(i + 1).padStart(3, '0')}`,
        type: 'B2B' as CustomerType,
        businessName: company.name,
        taxId: generateItalianTaxId(),
        email: `ordini@${company.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.it`,
        phone: `+39 02 ${randomInt(1000000, 9999999)}`,
        sdiCode: String(randomInt(1000000, 9999999)),
        address: {
          street,
          city: location.city,
          province: location.province,
          zip: location.zip,
          country: 'IT',
        },
        billingAddress: {
          company: company.name,
          address1: street,
          city: location.city,
          state: location.province,
          postcode: location.zip,
          country: 'IT',
        },
        shippingAddress: {
          company: company.name,
          address1: street,
          city: location.city,
          state: location.province,
          postcode: location.zip,
          country: 'IT',
        },
        isActive: true,
        paymentTerms: randomElement([30, 60, 90]),
        discount: randomInt(5, 20),
      },
    });
    customers.push(customer);
  }

  console.log(`✅ Created ${customers.length} customers (12 B2C + 8 B2B)\n`);

  // ============================================
  // CREATE PRODUCTS
  // ============================================
  console.log('📦 Creating products...');

  const products: any[] = [];

  for (let i = 0; i < demoProducts.length; i++) {
    const p = demoProducts[i];
    const product = await prisma.product.create({
      data: {
        sku: `PROD-${String(i + 1).padStart(4, '0')}`,
        name: p.name,
        description: p.description,
        type: 'SIMPLE',
        category: p.category,
        barcode: `800${String(i + 1).padStart(10, '0')}`,
        cost: p.cost,
        price: p.price,
        webPrice: p.price,
        minStockLevel: 5,
        reorderQuantity: 10,
        minStock: 5,
        reorderPoint: 8,
        isActive: true,
        isSellable: true,
        webActive: true,
        mainImageUrl: p.image,
        images: [p.image],
        webDescription: p.description,
        webShortDescription: p.description.substring(0, 100) + '...',
      },
    });
    products.push(product);
  }

  console.log(`✅ Created ${products.length} products\n`);

  // ============================================
  // CREATE INVENTORY
  // ============================================
  console.log('📊 Creating inventory...');

  const locations: InventoryLocation[] = ['WEB', 'B2B', 'EVENTI'];
  let inventoryCount = 0;

  for (const product of products) {
    for (const location of locations) {
      const baseQuantity = location === 'WEB' ? 30 : location === 'B2B' ? 20 : 10;
      const quantity = randomInt(baseQuantity - 5, baseQuantity + 15);

      await prisma.inventoryItem.create({
        data: {
          warehouseId: mainWarehouse.id,
          productId: product.id,
          location,
          quantity,
          reservedQuantity: randomInt(0, Math.min(3, quantity)),
        },
      });
      inventoryCount++;
    }
  }

  console.log(`✅ Created ${inventoryCount} inventory items\n`);

  // ============================================
  // CREATE ORDERS
  // ============================================
  console.log('🛒 Creating orders...');

  const orderStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const sources: OrderSource[] = ['WORDPRESS', 'B2B', 'MANUAL'];
  const paymentMethods = ['credit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'];

  let orderCount = 0;

  for (let i = 1; i <= 120; i++) {
    const customer = randomElement(customers);
    const isB2B = customer.type === 'B2B';
    const source = isB2B ? 'B2B' : randomElement(['WORDPRESS', 'MANUAL']) as OrderSource;
    const status = randomElement(orderStatuses);
    const orderDate = randomDate(90);

    // Crea ordine
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-2025-${String(i).padStart(6, '0')}`,
        customerId: customer.id,
        source,
        status,
        orderDate,
        subtotal: 0,
        discount: isB2B ? Number(customer.discount) : 0,
        tax: 0,
        shipping: randomElement([0, 5.90, 9.90, 12.90]),
        total: 0,
        paymentMethod: randomElement(paymentMethods),
        paymentStatus: ['DELIVERED', 'SHIPPED'].includes(status) ? 'paid' : 'pending',
        shippingAddress: customer.shippingAddress || customer.address,
        billingAddress: customer.billingAddress || customer.address,
        shippedDate: status === 'SHIPPED' || status === 'DELIVERED' ? randomDate(30) : null,
        deliveredDate: status === 'DELIVERED' ? randomDate(15) : null,
      },
    });

    // Aggiungi items (1-5 prodotti per ordine)
    const itemCount = randomInt(1, 5);
    let orderSubtotal = 0;
    const usedProducts = new Set<string>();

    for (let j = 0; j < itemCount; j++) {
      let product;
      do {
        product = randomElement(products);
      } while (usedProducts.has(product.id) && usedProducts.size < products.length);

      if (usedProducts.has(product.id)) continue;
      usedProducts.add(product.id);

      const quantity = randomInt(1, 3);
      const unitPrice = Number(product.price);
      const itemSubtotal = unitPrice * quantity;
      const tax = itemSubtotal * 0.22;
      const total = itemSubtotal + tax;

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

      orderSubtotal += itemSubtotal;
    }

    // Aggiorna totali ordine
    const discountAmount = orderSubtotal * (Number(order.discount) / 100);
    const taxableAmount = orderSubtotal - discountAmount;
    const orderTax = taxableAmount * 0.22;
    const orderTotal = taxableAmount + orderTax + Number(order.shipping);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal: orderSubtotal,
        tax: orderTax,
        total: orderTotal,
      },
    });

    orderCount++;
  }

  console.log(`✅ Created ${orderCount} orders\n`);

  // ============================================
  // CREATE INVENTORY MOVEMENTS
  // ============================================
  console.log('📦 Creating inventory movements...');

  const movementTypes = ['IN', 'OUT', 'ADJUSTMENT'] as const;
  let movementCount = 0;

  for (let i = 0; i < 80; i++) {
    const product = randomElement(products);
    const type = randomElement(movementTypes);
    const location = randomElement(locations);
    const movementDate = randomDate(90);

    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type,
        quantity: randomInt(1, 15),
        ...(type === 'IN' && { toLocation: location }),
        ...(type === 'OUT' && { fromLocation: location }),
        reference: `MOV-${String(i + 1).padStart(6, '0')}`,
        notes: type === 'IN'
          ? 'Rifornimento magazzino'
          : type === 'OUT'
          ? 'Spedizione ordine'
          : 'Rettifica inventario',
        performedBy: users[0].id,
        createdAt: movementDate,
      },
    });
    movementCount++;
  }

  console.log(`✅ Created ${movementCount} inventory movements\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('🎉 Database seeded successfully!\n');
  console.log('📊 Summary:');
  console.log('  ┌──────────────────────────────────────┐');
  console.log('  │ Entity                    │ Count    │');
  console.log('  ├──────────────────────────────────────┤');
  console.log(`  │ Users                     │ ${String(users.length).padStart(8)} │`);
  console.log(`  │ Employees                 │ ${String(employees.length).padStart(8)} │`);
  console.log('  │ Warehouses                │        2 │');
  console.log(`  │ Customers                 │ ${String(customers.length).padStart(8)} │`);
  console.log(`  │ Products                  │ ${String(products.length).padStart(8)} │`);
  console.log(`  │ Inventory Items           │ ${String(inventoryCount).padStart(8)} │`);
  console.log(`  │ Orders                    │ ${String(orderCount).padStart(8)} │`);
  console.log(`  │ Inventory Movements       │ ${String(movementCount).padStart(8)} │`);
  console.log('  └──────────────────────────────────────┘');
  console.log('');
  console.log('🔐 Demo Credentials:');
  console.log('  ┌──────────────────────────────────────────────────┐');
  console.log('  │ Email                      │ Password    │ Role  │');
  console.log('  ├──────────────────────────────────────────────────┤');
  console.log('  │ demo@ecommerceerp.com       │ Demo2024!   │ ADMIN │');
  console.log('  │ viewer@ecommerceerp.com     │ Viewer2024! │ VIEWER│');
  console.log('  │ magazzino@ecommerceerp.com  │ Magazzino2024!│ MAG. │');
  console.log('  └──────────────────────────────────────────────────┘');
}

main()
  .catch((error) => {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
