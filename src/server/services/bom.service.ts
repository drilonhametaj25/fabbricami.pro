import { prisma } from '../config/database';

/**
 * Risultato dell'esplosione BOM
 */
export interface BomExplosionItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  level: number;
  isLeaf: boolean;
  cost: number;
  parentProductId?: string;
}

/**
 * BOM Service
 * Gestione Bill of Materials con esplosione ricorsiva e prevenzione cicli
 */
class BomService {
  /**
   * Ottieni componenti BOM per un prodotto (primo livello)
   */
  async getBomItems(productId: string) {
    return prisma.bomItem.findMany({
      where: { parentProductId: productId },
      include: {
        componentProduct: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            cost: true,
            price: true,
            mainImageUrl: true,
            minStockLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Esplosione BOM ricorsiva con prevenzione cicli
   * Restituisce lista piatta di tutti i componenti con quantita aggregate
   *
   * @param productId - ID del prodotto da esplodere
   * @param quantity - Quantita del prodotto padre (per calcolo proporzionale)
   * @param visited - Set di prodotti gia visitati per prevenire cicli
   * @param level - Livello corrente nella gerarchia
   */
  async explodeBomRecursive(
    productId: string,
    quantity: number = 1,
    visited: Set<string> = new Set(),
    level: number = 0
  ): Promise<BomExplosionItem[]> {
    // Check ciclo infinito
    if (visited.has(productId)) {
      throw new Error(`Ciclo rilevato nel BOM: prodotto ${productId} referenzia se stesso nella gerarchia`);
    }
    visited.add(productId);

    // Ottieni componenti diretti
    const bomItems = await prisma.bomItem.findMany({
      where: { parentProductId: productId },
      include: {
        componentProduct: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            cost: true,
          },
        },
      },
    });

    const results: BomExplosionItem[] = [];

    for (const item of bomItems) {
      // Calcola quantita effettiva con scarto
      const scrapMultiplier = 1 + Number(item.scrapPercentage) / 100;
      const effectiveQty = Number(item.quantity) * scrapMultiplier * quantity;

      // Controlla se questo componente ha a sua volta sotto-componenti
      const subBomCount = await prisma.bomItem.count({
        where: { parentProductId: item.componentProductId },
      });

      const isLeaf = subBomCount === 0;

      // Aggiungi componente
      results.push({
        productId: item.componentProductId,
        sku: item.componentProduct.sku,
        name: item.componentProduct.name,
        quantity: effectiveQty,
        unit: item.unit,
        level: level + 1,
        isLeaf,
        cost: Number(item.componentProduct.cost) * effectiveQty,
        parentProductId: productId,
      });

      // Ricorsione sui sotto-componenti
      if (!isLeaf) {
        const subComponents = await this.explodeBomRecursive(
          item.componentProductId,
          effectiveQty,
          new Set(visited), // Copia per branch separati
          level + 1
        );
        results.push(...subComponents);
      }
    }

    return results;
  }

  /**
   * Ottieni solo i componenti "foglia" (quelli da scalare effettivamente)
   * Utile per la scalatura giacenze
   */
  async getLeafComponents(productId: string, quantity: number = 1): Promise<BomExplosionItem[]> {
    const allComponents = await this.explodeBomRecursive(productId, quantity);
    return allComponents.filter((c) => c.isLeaf);
  }

  /**
   * Valida che l'aggiunta di un componente non crei cicli nel BOM
   *
   * @param parentId - ID del prodotto padre
   * @param componentId - ID del componente da aggiungere
   * @returns true se valido (nessun ciclo), false se creerebbe un ciclo
   */
  async validateBomNoCycles(parentId: string, componentId: string): Promise<boolean> {
    // 1. Verifica immediata: non puo essere componente di se stesso
    if (parentId === componentId) {
      return false;
    }

    // 2. Verifica transitiva: il componentId non deve avere parentId nei suoi sotto-componenti
    const checkCycle = async (
      currentId: string,
      targetId: string,
      visited: Set<string>
    ): Promise<boolean> => {
      if (visited.has(currentId)) {
        return true; // Gia visitato, ok
      }
      visited.add(currentId);

      const subComponents = await prisma.bomItem.findMany({
        where: { parentProductId: currentId },
        select: { componentProductId: true },
      });

      for (const sub of subComponents) {
        // Se troviamo targetId come sotto-componente, c'e un ciclo
        if (sub.componentProductId === targetId) {
          return false; // Ciclo trovato
        }

        // Ricorsione
        const isValid = await checkCycle(sub.componentProductId, targetId, visited);
        if (!isValid) {
          return false;
        }
      }

      return true;
    };

    return checkCycle(componentId, parentId, new Set());
  }

  /**
   * Aggiungi componente al BOM (con validazione cicli)
   */
  async addBomItem(data: {
    parentProductId: string;
    componentProductId: string;
    quantity: number;
    unit?: string;
    scrapPercentage?: number;
    notes?: string;
  }) {
    // Validazione cicli
    const isValid = await this.validateBomNoCycles(data.parentProductId, data.componentProductId);
    if (!isValid) {
      throw new Error('Impossibile aggiungere: creerebbe un ciclo nel BOM');
    }

    return prisma.bomItem.upsert({
      where: {
        parentProductId_componentProductId: {
          parentProductId: data.parentProductId,
          componentProductId: data.componentProductId,
        },
      },
      create: {
        parentProductId: data.parentProductId,
        componentProductId: data.componentProductId,
        quantity: data.quantity,
        unit: data.unit || 'pz',
        scrapPercentage: data.scrapPercentage || 0,
        notes: data.notes,
      },
      update: {
        quantity: data.quantity,
        unit: data.unit,
        scrapPercentage: data.scrapPercentage,
        notes: data.notes,
      },
      include: {
        componentProduct: {
          select: {
            id: true,
            sku: true,
            name: true,
            cost: true,
            mainImageUrl: true,
          },
        },
      },
    });
  }

  /**
   * Aggiorna componente BOM
   */
  async updateBomItem(
    parentProductId: string,
    componentProductId: string,
    data: {
      quantity?: number;
      unit?: string;
      scrapPercentage?: number;
      notes?: string;
    }
  ) {
    return prisma.bomItem.update({
      where: {
        parentProductId_componentProductId: {
          parentProductId,
          componentProductId,
        },
      },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.scrapPercentage !== undefined && { scrapPercentage: data.scrapPercentage }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        componentProduct: {
          select: {
            id: true,
            sku: true,
            name: true,
            cost: true,
            mainImageUrl: true,
          },
        },
      },
    });
  }

  /**
   * Rimuovi componente dal BOM
   */
  async removeBomItem(parentProductId: string, componentProductId: string) {
    return prisma.bomItem.delete({
      where: {
        parentProductId_componentProductId: {
          parentProductId,
          componentProductId,
        },
      },
    });
  }

  /**
   * Calcola costo totale BOM (ricorsivo)
   */
  async calculateBomCost(productId: string, quantity: number = 1): Promise<number> {
    const allComponents = await this.explodeBomRecursive(productId, quantity);

    // Somma costi solo delle foglie (per evitare doppi conteggi)
    return allComponents
      .filter((c) => c.isLeaf)
      .reduce((sum, item) => sum + item.cost, 0);
  }

  /**
   * Verifica disponibilita componenti BOM
   * Utile prima di processare un ordine
   */
  async checkBomAvailability(
    productId: string,
    quantity: number,
    location: string
  ): Promise<{
    available: boolean;
    shortages: Array<{
      productId: string;
      sku: string;
      name: string;
      required: number;
      available: number;
      shortage: number;
    }>;
  }> {
    const leafComponents = await this.getLeafComponents(productId, quantity);
    const shortages: Array<{
      productId: string;
      sku: string;
      name: string;
      required: number;
      available: number;
      shortage: number;
    }> = [];

    // Aggrega quantita per prodotto (stesso prodotto potrebbe apparire piu volte)
    const aggregated = new Map<string, { item: BomExplosionItem; totalQty: number }>();
    for (const item of leafComponents) {
      const existing = aggregated.get(item.productId);
      if (existing) {
        existing.totalQty += item.quantity;
      } else {
        aggregated.set(item.productId, { item, totalQty: item.quantity });
      }
    }

    // Verifica disponibilita per ogni componente aggregato
    for (const [, { item, totalQty }] of aggregated) {
      const inventory = await prisma.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          location: location as any,
        },
      });

      const availableStock = (inventory?.quantity || 0) - (inventory?.reservedQuantity || 0);

      if (availableStock < totalQty) {
        shortages.push({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          required: totalQty,
          available: availableStock,
          shortage: totalQty - availableStock,
        });
      }
    }

    return {
      available: shortages.length === 0,
      shortages,
    };
  }

  /**
   * Conta il numero di livelli nel BOM
   */
  async getBomDepth(productId: string): Promise<number> {
    const allComponents = await this.explodeBomRecursive(productId, 1);
    if (allComponents.length === 0) return 0;
    return Math.max(...allComponents.map((c) => c.level));
  }

  /**
   * Calcola quantità producibile basata sullo stock disponibile dei componenti
   * Restituisce il massimo numero di unità che possono essere prodotte
   *
   * @param productId - ID del prodotto da produrre
   * @param location - Location per stock prodotti (default 'WEB')
   * @returns Oggetto con quantità producibile, componente limitante e breakdown
   */
  async calculateProducibleQuantity(
    productId: string,
    location: string = 'WEB'
  ): Promise<{
    producibleQuantity: number;
    limitingComponents: Array<{
      productId: string;
      sku: string;
      name: string;
      requiredPerUnit: number;
      availableStock: number;
      maxProducible: number;
      isBottleneck: boolean;
    }>;
    hasBom: boolean;
    totalComponentTypes: number;
  }> {
    // Ottieni tutti i componenti foglia per 1 unità di prodotto
    const leafComponents = await this.getLeafComponents(productId, 1);

    if (leafComponents.length === 0) {
      // Nessun BOM definito, controlla se ci sono fasi di produzione con materiali
      const phaseMaterials = await this.getProductionPhaseMaterials(productId);

      if (phaseMaterials.length === 0) {
        return {
          producibleQuantity: 0,
          limitingComponents: [],
          hasBom: false,
          totalComponentTypes: 0,
        };
      }

      // Calcola producibilità basata sui materiali delle fasi
      return this.calculateFromPhaseMaterials(productId, phaseMaterials, location);
    }

    // Aggrega quantità per prodotto (stesso componente potrebbe apparire più volte)
    const aggregated = new Map<string, { item: BomExplosionItem; totalQty: number }>();
    for (const item of leafComponents) {
      const existing = aggregated.get(item.productId);
      if (existing) {
        existing.totalQty += item.quantity;
      } else {
        aggregated.set(item.productId, { item, totalQty: item.quantity });
      }
    }

    const limitingComponents: Array<{
      productId: string;
      sku: string;
      name: string;
      requiredPerUnit: number;
      availableStock: number;
      maxProducible: number;
      isBottleneck: boolean;
    }> = [];

    let minProducible = Infinity;

    // Verifica disponibilità per ogni componente aggregato
    for (const [, { item, totalQty }] of aggregated) {
      // Ottieni stock disponibile per il componente
      const inventory = await prisma.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          location: location as any,
        },
      });

      const availableStock = Math.max(0, (inventory?.quantity || 0) - (inventory?.reservedQuantity || 0));

      // Calcola quante unità del prodotto finale posso fare con questo componente
      const maxProducibleFromComponent = totalQty > 0
        ? Math.floor(availableStock / totalQty)
        : Infinity;

      limitingComponents.push({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        requiredPerUnit: totalQty,
        availableStock,
        maxProducible: maxProducibleFromComponent,
        isBottleneck: false, // Aggiornato dopo
      });

      if (maxProducibleFromComponent < minProducible) {
        minProducible = maxProducibleFromComponent;
      }
    }

    // Marca i componenti bottleneck
    for (const comp of limitingComponents) {
      comp.isBottleneck = comp.maxProducible === minProducible && minProducible < Infinity;
    }

    // Ordina per maxProducible (mostra prima i bottleneck)
    limitingComponents.sort((a, b) => a.maxProducible - b.maxProducible);

    return {
      producibleQuantity: minProducible === Infinity ? 0 : minProducible,
      limitingComponents,
      hasBom: true,
      totalComponentTypes: aggregated.size,
    };
  }

  /**
   * Ottieni materiali dalle fasi di produzione del prodotto
   */
  private async getProductionPhaseMaterials(productId: string): Promise<Array<{
    materialId: string;
    materialName: string;
    materialSku: string;
    quantity: number;
    scrapPercentage: number;
    unit: string;
    cost: number;
  }>> {
    const phases = await prisma.manufacturingPhase.findMany({
      where: { productId, isActive: true },
      include: {
        materials: {
          include: { material: true }
        }
      }
    });

    const materials: Array<{
      materialId: string;
      materialName: string;
      materialSku: string;
      quantity: number;
      scrapPercentage: number;
      unit: string;
      cost: number;
    }> = [];

    for (const phase of phases) {
      for (const pm of phase.materials) {
        materials.push({
          materialId: pm.materialId,
          materialName: pm.material.name,
          materialSku: pm.material.sku,
          quantity: Number(pm.quantity),
          scrapPercentage: Number(pm.scrapPercentage),
          unit: pm.unit,
          cost: Number(pm.material.cost),
        });
      }
    }

    return materials;
  }

  /**
   * Calcola producibilità dai materiali delle fasi di produzione
   * Note: productId e location non usati perché i materiali usano currentStock
   */
  private async calculateFromPhaseMaterials(
    _productId: string,
    materials: Array<{
      materialId: string;
      materialName: string;
      materialSku: string;
      quantity: number;
      scrapPercentage: number;
      unit: string;
      cost: number;
    }>,
    _location: string
  ): Promise<{
    producibleQuantity: number;
    limitingComponents: Array<{
      productId: string;
      sku: string;
      name: string;
      requiredPerUnit: number;
      availableStock: number;
      maxProducible: number;
      isBottleneck: boolean;
    }>;
    hasBom: boolean;
    totalComponentTypes: number;
  }> {
    // Aggrega materiali per ID
    const aggregated = new Map<string, {
      materialId: string;
      materialName: string;
      materialSku: string;
      totalQty: number;
    }>();

    for (const mat of materials) {
      const effectiveQty = mat.quantity * (1 + mat.scrapPercentage / 100);
      const existing = aggregated.get(mat.materialId);
      if (existing) {
        existing.totalQty += effectiveQty;
      } else {
        aggregated.set(mat.materialId, {
          materialId: mat.materialId,
          materialName: mat.materialName,
          materialSku: mat.materialSku,
          totalQty: effectiveQty,
        });
      }
    }

    const limitingComponents: Array<{
      productId: string;
      sku: string;
      name: string;
      requiredPerUnit: number;
      availableStock: number;
      maxProducible: number;
      isBottleneck: boolean;
    }> = [];

    let minProducible = Infinity;

    // Per ogni materiale, controlla lo stock
    for (const [, mat] of aggregated) {
      // I materiali usano currentStock sul modello Material
      const material = await prisma.material.findUnique({
        where: { id: mat.materialId },
        select: { currentStock: true }
      });

      const availableStock = material?.currentStock || 0;

      const maxProducibleFromMaterial = mat.totalQty > 0
        ? Math.floor(availableStock / mat.totalQty)
        : Infinity;

      limitingComponents.push({
        productId: mat.materialId, // Usa materialId come riferimento
        sku: mat.materialSku,
        name: mat.materialName,
        requiredPerUnit: mat.totalQty,
        availableStock,
        maxProducible: maxProducibleFromMaterial,
        isBottleneck: false,
      });

      if (maxProducibleFromMaterial < minProducible) {
        minProducible = maxProducibleFromMaterial;
      }
    }

    // Marca i bottleneck
    for (const comp of limitingComponents) {
      comp.isBottleneck = comp.maxProducible === minProducible && minProducible < Infinity;
    }

    limitingComponents.sort((a, b) => a.maxProducible - b.maxProducible);

    return {
      producibleQuantity: minProducible === Infinity ? 0 : minProducible,
      limitingComponents,
      hasBom: false, // Non ha BOM, usa materiali fasi
      totalComponentTypes: aggregated.size,
    };
  }

  /**
   * Calcola producibilità per più prodotti (batch)
   * Utile per dashboard o pianificazione
   */
  async calculateProducibleQuantityBatch(
    productIds: string[],
    location: string = 'WEB'
  ): Promise<Map<string, {
    productId: string;
    producibleQuantity: number;
    limitingComponent: string | null;
    hasBom: boolean;
  }>> {
    const results = new Map();

    for (const productId of productIds) {
      try {
        const result = await this.calculateProducibleQuantity(productId, location);
        const bottleneck = result.limitingComponents.find(c => c.isBottleneck);

        results.set(productId, {
          productId,
          producibleQuantity: result.producibleQuantity,
          limitingComponent: bottleneck ? `${bottleneck.sku} (${bottleneck.name})` : null,
          hasBom: result.hasBom,
        });
      } catch (error) {
        results.set(productId, {
          productId,
          producibleQuantity: 0,
          limitingComponent: null,
          hasBom: false,
        });
      }
    }

    return results;
  }
}

const bomService = new BomService();
export { bomService, BomService };
export default bomService;
