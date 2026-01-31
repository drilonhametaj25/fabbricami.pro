import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏭 Seeding manufacturing data for miniatures production...');

  // ==========================================
  // OPERATION TYPES (Tipi Operazione)
  // ==========================================
  console.log('⚙️  Creating operation types...');

  const operationTypes = [
    // DESIGN & PROTOTIPAZIONE
    {
      code: 'SCULTURA_3D',
      name: 'Scultura Digitale 3D',
      description: 'Modellazione 3D digitale della miniatura (ZBrush, Blender, etc.)',
      isExternal: false,
      defaultHourlyRate: 35.00,
      requiresLiquidProduct: false,
      sortOrder: 1,
    },
    {
      code: 'STAMPA_3D_MASTER',
      name: 'Stampa 3D Master',
      description: 'Stampa 3D del master ad alta risoluzione (SLA/DLP)',
      isExternal: false,
      defaultHourlyRate: 25.00,
      requiresLiquidProduct: false,
      sortOrder: 2,
    },
    {
      code: 'STAMPA_3D_EXT',
      name: 'Stampa 3D Esterna',
      description: 'Stampa 3D master presso servizio esterno',
      isExternal: true,
      defaultHourlyRate: null,
      requiresLiquidProduct: false,
      sortOrder: 3,
    },

    // PRODUZIONE RESINA
    {
      code: 'STAMPI_SILICONE',
      name: 'Creazione Stampi Silicone',
      description: 'Realizzazione stampi in silicone per colata resina',
      isExternal: false,
      defaultHourlyRate: 22.00,
      requiresLiquidProduct: false,
      sortOrder: 10,
    },
    {
      code: 'COLATA_RESINA',
      name: 'Colata Resina',
      description: 'Colata resina poliuretanica negli stampi silicone',
      isExternal: false,
      defaultHourlyRate: 18.00,
      requiresLiquidProduct: true,
      sortOrder: 11,
    },
    {
      code: 'PULIZIA_RESINA',
      name: 'Pulizia e Rifinitura Resina',
      description: 'Rimozione bave, carteggiatura, rifinitura pezzi in resina',
      isExternal: false,
      defaultHourlyRate: 15.00,
      requiresLiquidProduct: false,
      sortOrder: 12,
    },

    // PRODUZIONE METALLO
    {
      code: 'VULCANIZZAZIONE',
      name: 'Vulcanizzazione Stampi',
      description: 'Creazione stampi in gomma vulcanizzata per fusione metallo',
      isExternal: true,
      defaultHourlyRate: null,
      requiresLiquidProduct: false,
      sortOrder: 20,
    },
    {
      code: 'FUSIONE_METALLO',
      name: 'Fusione Metallo / Centrifuga',
      description: 'Fusione metallo bianco e colata centrifuga',
      isExternal: true,
      defaultHourlyRate: null,
      requiresLiquidProduct: true,
      sortOrder: 21,
    },
    {
      code: 'PULIZIA_METALLO',
      name: 'Pulizia e Sbavatura Metallo',
      description: 'Rimozione materozze, sbavatura, rifinitura pezzi in metallo',
      isExternal: false,
      defaultHourlyRate: 16.00,
      requiresLiquidProduct: false,
      sortOrder: 22,
    },

    // FINITURA & QC
    {
      code: 'CONTROLLO_QUALITA',
      name: 'Controllo Qualita',
      description: 'Ispezione visiva e controllo qualita dei pezzi',
      isExternal: false,
      defaultHourlyRate: 18.00,
      requiresLiquidProduct: false,
      sortOrder: 30,
    },
    {
      code: 'PRIMER',
      name: 'Applicazione Primer',
      description: 'Applicazione primer/fondo per preparazione verniciatura',
      isExternal: false,
      defaultHourlyRate: 15.00,
      requiresLiquidProduct: false,
      sortOrder: 31,
    },
    {
      code: 'VERNICIATURA_INT',
      name: 'Verniciatura Interna',
      description: 'Verniciatura/pittura base interna',
      isExternal: false,
      defaultHourlyRate: 20.00,
      requiresLiquidProduct: false,
      sortOrder: 32,
    },
    {
      code: 'VERNICIATURA_EXT',
      name: 'Verniciatura Professionale',
      description: 'Verniciatura professionale presso pittore esterno',
      isExternal: true,
      defaultHourlyRate: null,
      requiresLiquidProduct: false,
      sortOrder: 33,
    },

    // ASSEMBLAGGIO & PACKAGING
    {
      code: 'ASSEMBLAGGIO',
      name: 'Assemblaggio',
      description: 'Assemblaggio componenti della miniatura',
      isExternal: false,
      defaultHourlyRate: 16.00,
      requiresLiquidProduct: false,
      sortOrder: 40,
    },
    {
      code: 'PACKAGING',
      name: 'Packaging / Scatolamento',
      description: 'Confezionamento finale: blister, scatola, etichette',
      isExternal: false,
      defaultHourlyRate: 12.00,
      requiresLiquidProduct: false,
      sortOrder: 41,
    },
    {
      code: 'PACKAGING_EXT',
      name: 'Packaging Esterno',
      description: 'Confezionamento presso terzista',
      isExternal: true,
      defaultHourlyRate: null,
      requiresLiquidProduct: false,
      sortOrder: 42,
    },
  ];

  for (const opType of operationTypes) {
    await prisma.operationType.upsert({
      where: { code: opType.code },
      update: opType,
      create: opType,
    });
  }
  console.log(`✅ Operation types created: ${operationTypes.length}`);

  // ==========================================
  // MATERIALS (Materiali)
  // ==========================================
  console.log('🧪 Creating materials...');

  const materials = [
    // RESINE E SILICONI
    {
      sku: 'MAT-RES-PU-001',
      name: 'Resina Poliuretanica Bicomponente',
      description: 'Resina PU per colata, rapporto 1:1, tempo demold 15min',
      unit: 'kg',
      cost: 28.50,
      minStock: 5,
      currentStock: 20,
      reorderPoint: 8,
      reorderQuantity: 20,
      leadTimeDays: 5,
      category: 'RESINE',
      isConsumable: false,
    },
    {
      sku: 'MAT-RES-FLEX-001',
      name: 'Resina Flessibile',
      description: 'Resina flessibile per parti sottili e bandiere',
      unit: 'kg',
      cost: 35.00,
      minStock: 2,
      currentStock: 8,
      reorderPoint: 3,
      reorderQuantity: 10,
      leadTimeDays: 7,
      category: 'RESINE',
      isConsumable: false,
    },
    {
      sku: 'MAT-SIL-RTV-001',
      name: 'Silicone RTV per Stampi',
      description: 'Silicone bicomponente per stampi, Shore A 25',
      unit: 'kg',
      cost: 42.00,
      minStock: 3,
      currentStock: 15,
      reorderPoint: 5,
      reorderQuantity: 15,
      leadTimeDays: 5,
      category: 'SILICONI',
      isConsumable: false,
    },
    {
      sku: 'MAT-SIL-CAT-001',
      name: 'Catalizzatore Silicone',
      description: 'Catalizzatore per silicone RTV',
      unit: 'kg',
      cost: 18.00,
      minStock: 1,
      currentStock: 5,
      reorderPoint: 2,
      reorderQuantity: 5,
      leadTimeDays: 5,
      category: 'SILICONI',
      isConsumable: false,
    },

    // METALLI
    {
      sku: 'MAT-MET-BIANCO-001',
      name: 'Metallo Bianco (Lega Sn/Pb)',
      description: 'Lega per fusione miniature: Stagno 60%, Piombo 40%',
      unit: 'kg',
      cost: 22.00,
      minStock: 10,
      currentStock: 50,
      reorderPoint: 15,
      reorderQuantity: 30,
      leadTimeDays: 10,
      category: 'METALLI',
      isConsumable: false,
    },
    {
      sku: 'MAT-MET-PEWTER-001',
      name: 'Pewter (Lega senza Piombo)',
      description: 'Lega pewter lead-free per miniature',
      unit: 'kg',
      cost: 35.00,
      minStock: 5,
      currentStock: 25,
      reorderPoint: 10,
      reorderQuantity: 20,
      leadTimeDays: 10,
      category: 'METALLI',
      isConsumable: false,
    },

    // VERNICI E PRIMER
    {
      sku: 'MAT-PRI-SPRAY-001',
      name: 'Primer Spray Grigio 400ml',
      description: 'Primer acrilico spray per miniature',
      unit: 'pz',
      cost: 8.50,
      minStock: 20,
      currentStock: 100,
      reorderPoint: 30,
      reorderQuantity: 50,
      leadTimeDays: 3,
      category: 'VERNICI',
      isConsumable: true,
    },
    {
      sku: 'MAT-PRI-SPRAY-002',
      name: 'Primer Spray Nero 400ml',
      description: 'Primer acrilico spray nero per miniature',
      unit: 'pz',
      cost: 8.50,
      minStock: 20,
      currentStock: 80,
      reorderPoint: 30,
      reorderQuantity: 50,
      leadTimeDays: 3,
      category: 'VERNICI',
      isConsumable: true,
    },
    {
      sku: 'MAT-PRI-SPRAY-003',
      name: 'Primer Spray Bianco 400ml',
      description: 'Primer acrilico spray bianco per miniature',
      unit: 'pz',
      cost: 8.50,
      minStock: 10,
      currentStock: 50,
      reorderPoint: 15,
      reorderQuantity: 30,
      leadTimeDays: 3,
      category: 'VERNICI',
      isConsumable: true,
    },

    // PACKAGING
    {
      sku: 'MAT-PKG-BLIST-S',
      name: 'Blister Piccolo 10x15cm',
      description: 'Blister trasparente per miniature singole piccole',
      unit: 'pz',
      cost: 0.35,
      minStock: 200,
      currentStock: 1000,
      reorderPoint: 300,
      reorderQuantity: 500,
      leadTimeDays: 14,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-BLIST-M',
      name: 'Blister Medio 15x20cm',
      description: 'Blister trasparente per miniature medie',
      unit: 'pz',
      cost: 0.45,
      minStock: 200,
      currentStock: 800,
      reorderPoint: 300,
      reorderQuantity: 500,
      leadTimeDays: 14,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-BLIST-L',
      name: 'Blister Grande 20x25cm',
      description: 'Blister trasparente per miniature grandi o set',
      unit: 'pz',
      cost: 0.65,
      minStock: 100,
      currentStock: 500,
      reorderPoint: 150,
      reorderQuantity: 300,
      leadTimeDays: 14,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-BOX-S',
      name: 'Scatola Cartone Piccola',
      description: 'Scatola cartoncino stampato piccola 12x8x4cm',
      unit: 'pz',
      cost: 0.80,
      minStock: 200,
      currentStock: 600,
      reorderPoint: 250,
      reorderQuantity: 500,
      leadTimeDays: 21,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-BOX-M',
      name: 'Scatola Cartone Media',
      description: 'Scatola cartoncino stampato media 18x12x6cm',
      unit: 'pz',
      cost: 1.20,
      minStock: 150,
      currentStock: 400,
      reorderPoint: 200,
      reorderQuantity: 400,
      leadTimeDays: 21,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-BOX-L',
      name: 'Scatola Cartone Grande',
      description: 'Scatola cartoncino stampato grande 25x18x8cm',
      unit: 'pz',
      cost: 1.80,
      minStock: 100,
      currentStock: 250,
      reorderPoint: 120,
      reorderQuantity: 200,
      leadTimeDays: 21,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-FOAM-001',
      name: 'Foam Protettivo (foglio)',
      description: 'Schiuma PE per protezione miniature, foglio 50x50cm',
      unit: 'pz',
      cost: 0.25,
      minStock: 500,
      currentStock: 2000,
      reorderPoint: 600,
      reorderQuantity: 1000,
      leadTimeDays: 10,
      category: 'PACKAGING',
      isConsumable: true,
    },
    {
      sku: 'MAT-PKG-ETICH-001',
      name: 'Etichette Prodotto (rotolo 500)',
      description: 'Etichette adesive con codice e nome prodotto',
      unit: 'rotolo',
      cost: 25.00,
      minStock: 5,
      currentStock: 20,
      reorderPoint: 8,
      reorderQuantity: 15,
      leadTimeDays: 14,
      category: 'PACKAGING',
      isConsumable: true,
    },

    // CONSUMABILI VARI
    {
      sku: 'MAT-CON-COLLA-001',
      name: 'Colla Cianoacrilica 20g',
      description: 'Super colla per assemblaggio miniature',
      unit: 'pz',
      cost: 3.50,
      minStock: 30,
      currentStock: 100,
      reorderPoint: 40,
      reorderQuantity: 60,
      leadTimeDays: 3,
      category: 'CONSUMABILI',
      isConsumable: true,
    },
    {
      sku: 'MAT-CON-CARTA-180',
      name: 'Carta Abrasiva 180 (foglio)',
      description: 'Carta abrasiva grana 180 per rifinitura',
      unit: 'pz',
      cost: 0.40,
      minStock: 100,
      currentStock: 500,
      reorderPoint: 150,
      reorderQuantity: 300,
      leadTimeDays: 5,
      category: 'CONSUMABILI',
      isConsumable: true,
    },
    {
      sku: 'MAT-CON-CARTA-400',
      name: 'Carta Abrasiva 400 (foglio)',
      description: 'Carta abrasiva grana 400 per rifinitura fine',
      unit: 'pz',
      cost: 0.45,
      minStock: 100,
      currentStock: 400,
      reorderPoint: 150,
      reorderQuantity: 300,
      leadTimeDays: 5,
      category: 'CONSUMABILI',
      isConsumable: true,
    },
    {
      sku: 'MAT-CON-GUANTI-M',
      name: 'Guanti Nitrile M (box 100)',
      description: 'Guanti monouso nitrile taglia M',
      unit: 'box',
      cost: 12.00,
      minStock: 5,
      currentStock: 20,
      reorderPoint: 8,
      reorderQuantity: 15,
      leadTimeDays: 3,
      category: 'CONSUMABILI',
      isConsumable: true,
    },
    {
      sku: 'MAT-CON-DISTAC-001',
      name: 'Distaccante Spray 400ml',
      description: 'Spray distaccante per stampi silicone',
      unit: 'pz',
      cost: 9.50,
      minStock: 10,
      currentStock: 40,
      reorderPoint: 15,
      reorderQuantity: 25,
      leadTimeDays: 5,
      category: 'CONSUMABILI',
      isConsumable: true,
    },
  ];

  for (const material of materials) {
    await prisma.material.upsert({
      where: { sku: material.sku },
      update: material,
      create: material,
    });
  }
  console.log(`✅ Materials created: ${materials.length}`);

  // ==========================================
  // SUPPLIERS (Fornitori per fasi esterne)
  // ==========================================
  console.log('🏭 Creating suppliers for external operations...');

  const suppliers = [
    {
      code: 'SUP-STAMP3D-001',
      businessName: 'Print3D Pro SRL',
      email: 'ordini@print3dpro.it',
      phone: '+39 02 1234567',
      address: {
        street: 'Via della Stampa 3D, 15',
        city: 'Milano',
        zip: '20100',
        country: 'Italia',
      },
      paymentTerms: 30,
      notes: 'Servizio stampa 3D SLA/DLP professionale',
    },
    {
      code: 'SUP-FUSIONE-001',
      businessName: 'MetalCast Italia SRL',
      email: 'info@metalcast.it',
      phone: '+39 011 9876543',
      address: {
        street: 'Via Fonderia 42',
        city: 'Torino',
        zip: '10100',
        country: 'Italia',
      },
      paymentTerms: 45,
      notes: 'Fusione metallo bianco, vulcanizzazione stampi',
    },
    {
      code: 'SUP-VERN-001',
      businessName: 'Studio Colori Miniature di Rossi M.',
      email: 'studio@colori-miniature.it',
      phone: '+39 051 5551234',
      address: {
        street: 'Via Artisti 8',
        city: 'Bologna',
        zip: '40100',
        country: 'Italia',
      },
      paymentTerms: 30,
      notes: 'Verniciatura professionale miniature, servizio display',
    },
    {
      code: 'SUP-PKG-001',
      businessName: 'PackBox SRL',
      email: 'commerciale@packbox.it',
      phone: '+39 02 8889999',
      address: {
        street: 'Via Imballaggi 100',
        city: 'Lodi',
        zip: '26900',
        country: 'Italia',
      },
      paymentTerms: 60,
      notes: 'Scatole personalizzate, blister, packaging',
    },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: supplier,
      create: supplier,
    });
  }
  console.log(`✅ Suppliers created: ${suppliers.length}`);

  console.log('');
  console.log('🎉 Manufacturing seed completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`  - Operation Types: ${operationTypes.length}`);
  console.log(`  - Materials: ${materials.length}`);
  console.log(`  - Suppliers: ${suppliers.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Error seeding manufacturing data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
