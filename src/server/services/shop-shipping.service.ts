import { prisma } from '../config/database';
import { ShopShippingZone, ShopShippingMethod, ShippingType } from '@prisma/client';
import logger from '../config/logger';

/**
 * Shipping method with zone details
 */
export interface ShippingMethodWithZone extends ShopShippingMethod {
  zone: ShopShippingZone;
}

/**
 * Address for shipping calculation
 */
export interface ShippingAddress {
  country: string;
  state?: string;
  postcode?: string;
  city?: string;
}

/**
 * Shipping calculation result
 */
export interface ShippingCalculation {
  method: ShippingMethodWithZone;
  cost: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isFreeShipping: boolean;
  amountForFreeShipping?: number;
}

/**
 * Create shipping zone input
 */
export interface CreateShippingZoneInput {
  name: string;
  countries: string[];
  regions?: string[];
  postcodes?: string[];
  priority?: number;
  isActive?: boolean;
}

/**
 * Create shipping method input
 */
export interface CreateShippingMethodInput {
  zoneId: string;
  name: string;
  carrier: string;
  type: ShippingType;
  baseCost: number;
  costPerKg?: number;
  costPerItem?: number;
  freeAboveAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  carrierServiceCode?: string;
  description?: string;
  logoUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Shop Shipping Service
 * Gestisce zone e metodi di spedizione per e-commerce
 */
class ShopShippingService {
  /**
   * Trova zona per indirizzo
   */
  async findZoneForAddress(address: ShippingAddress): Promise<ShopShippingZone | null> {
    const { country, state, postcode } = address;

    // Cerca zone ordinate per priorità (più alta = più specifica)
    const zones = await prisma.shopShippingZone.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const zone of zones) {
      const countries = zone.countries as string[];
      const regions = zone.regions as string[] | null;
      const postcodes = zone.postcodes as string[] | null;

      // Verifica paese
      if (!countries.includes(country)) {
        continue;
      }

      // Verifica CAP se specificati nella zona
      if (postcodes && postcodes.length > 0 && postcode) {
        const matchesPostcode = postcodes.some(pattern => {
          if (pattern.endsWith('*')) {
            return postcode.startsWith(pattern.slice(0, -1));
          }
          return postcode === pattern;
        });

        if (matchesPostcode) {
          return zone;
        }
        continue; // Non corrisponde ai CAP specificati
      }

      // Verifica regione se specificata nella zona
      if (regions && regions.length > 0 && state) {
        const normalizedState = state.toLowerCase();
        if (regions.some(r => r.toLowerCase() === normalizedState)) {
          return zone;
        }
        continue;
      }

      // Zona base (solo paese)
      return zone;
    }

    return null;
  }

  /**
   * Calcola metodi di spedizione disponibili
   */
  async calculateShipping(
    address: ShippingAddress,
    orderTotal: number,
    totalWeight: number = 0
  ): Promise<ShippingCalculation[]> {
    const zone = await this.findZoneForAddress(address);

    if (!zone) {
      return [];
    }

    const methods = await prisma.shopShippingMethod.findMany({
      where: {
        zoneId: zone.id,
        isActive: true,
      },
      include: { zone: true },
      orderBy: { sortOrder: 'asc' },
    });

    const results: ShippingCalculation[] = [];

    for (const method of methods) {
      // Verifica limiti
      if (method.minWeight && totalWeight < Number(method.minWeight)) continue;
      if (method.maxWeight && totalWeight > Number(method.maxWeight)) continue;
      if (method.minOrderAmount && orderTotal < Number(method.minOrderAmount)) continue;
      if (method.maxOrderAmount && orderTotal > Number(method.maxOrderAmount)) continue;

      // Calcola costo
      let cost = Number(method.baseCost);

      switch (method.type) {
        case 'WEIGHT_BASED':
          if (method.costPerKg && totalWeight > 0) {
            cost += Number(method.costPerKg) * totalWeight;
          }
          break;

        case 'PRICE_BASED':
          // Costo base già impostato, potrebbe variare per fasce di prezzo
          break;

        case 'FREE_ABOVE':
          if (method.freeAboveAmount && orderTotal >= Number(method.freeAboveAmount)) {
            cost = 0;
          }
          break;

        case 'PICKUP':
          cost = 0;
          break;
      }

      // Aggiungi costo per item se specificato
      // (non abbiamo itemCount qui, va passato come parametro se necessario)

      // Verifica soglia spedizione gratuita
      let isFreeShipping = cost === 0;
      let amountForFreeShipping: number | undefined;

      if (method.freeAboveAmount && orderTotal < Number(method.freeAboveAmount)) {
        amountForFreeShipping = Number(method.freeAboveAmount) - orderTotal;
      }

      results.push({
        method: method as ShippingMethodWithZone,
        cost: Math.round(cost * 100) / 100,
        estimatedDaysMin: method.estimatedDaysMin,
        estimatedDaysMax: method.estimatedDaysMax,
        isFreeShipping,
        amountForFreeShipping,
      });
    }

    return results;
  }

  /**
   * Ottiene tutti i metodi di spedizione economici
   */
  async getCheapestMethod(
    address: ShippingAddress,
    orderTotal: number,
    totalWeight: number = 0
  ): Promise<ShippingCalculation | null> {
    const methods = await this.calculateShipping(address, orderTotal, totalWeight);

    if (methods.length === 0) {
      return null;
    }

    return methods.reduce((cheapest, current) =>
      current.cost < cheapest.cost ? current : cheapest
    );
  }

  // ==================
  // ZONE MANAGEMENT
  // ==================

  /**
   * Crea zona di spedizione
   */
  async createZone(input: CreateShippingZoneInput): Promise<ShopShippingZone> {
    const zone = await prisma.shopShippingZone.create({
      data: {
        name: input.name,
        countries: input.countries,
        regions: input.regions,
        postcodes: input.postcodes,
        priority: input.priority || 0,
        isActive: input.isActive ?? true,
      },
    });

    logger.info(`Zona spedizione creata: ${zone.name}`);
    return zone;
  }

  /**
   * Aggiorna zona di spedizione
   */
  async updateZone(
    id: string,
    input: Partial<CreateShippingZoneInput>
  ): Promise<ShopShippingZone> {
    return prisma.shopShippingZone.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Elimina zona di spedizione
   */
  async deleteZone(id: string): Promise<void> {
    await prisma.shopShippingZone.delete({ where: { id } });
    logger.info(`Zona spedizione eliminata: ${id}`);
  }

  /**
   * Lista zone di spedizione
   */
  async listZones(includeInactive: boolean = false): Promise<ShopShippingZone[]> {
    return prisma.shopShippingZone.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Ottiene zona per ID
   */
  async getZoneById(id: string): Promise<ShopShippingZone | null> {
    return prisma.shopShippingZone.findUnique({ where: { id } });
  }

  // ==================
  // METHOD MANAGEMENT
  // ==================

  /**
   * Crea metodo di spedizione
   */
  async createMethod(input: CreateShippingMethodInput): Promise<ShopShippingMethod> {
    const method = await prisma.shopShippingMethod.create({
      data: {
        zoneId: input.zoneId,
        name: input.name,
        carrier: input.carrier,
        type: input.type,
        baseCost: input.baseCost,
        costPerKg: input.costPerKg,
        costPerItem: input.costPerItem,
        freeAboveAmount: input.freeAboveAmount,
        minWeight: input.minWeight,
        maxWeight: input.maxWeight,
        minOrderAmount: input.minOrderAmount,
        maxOrderAmount: input.maxOrderAmount,
        estimatedDaysMin: input.estimatedDaysMin || 1,
        estimatedDaysMax: input.estimatedDaysMax || 5,
        carrierServiceCode: input.carrierServiceCode,
        description: input.description,
        logoUrl: input.logoUrl,
        sortOrder: input.sortOrder || 0,
        isActive: input.isActive ?? true,
      },
    });

    logger.info(`Metodo spedizione creato: ${method.name} (${method.carrier})`);
    return method;
  }

  /**
   * Aggiorna metodo di spedizione
   */
  async updateMethod(
    id: string,
    input: Partial<CreateShippingMethodInput>
  ): Promise<ShopShippingMethod> {
    return prisma.shopShippingMethod.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Elimina metodo di spedizione
   */
  async deleteMethod(id: string): Promise<void> {
    await prisma.shopShippingMethod.delete({ where: { id } });
    logger.info(`Metodo spedizione eliminato: ${id}`);
  }

  /**
   * Lista metodi di spedizione per zona
   */
  async listMethodsByZone(
    zoneId: string,
    includeInactive: boolean = false
  ): Promise<ShopShippingMethod[]> {
    return prisma.shopShippingMethod.findMany({
      where: {
        zoneId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Ottiene metodo per ID
   */
  async getMethodById(id: string): Promise<ShippingMethodWithZone | null> {
    const method = await prisma.shopShippingMethod.findUnique({
      where: { id },
      include: { zone: true },
    });
    return method as ShippingMethodWithZone | null;
  }

  // ==================
  // SEED DATA
  // ==================

  /**
   * Inizializza zone e metodi di default per l'Italia
   */
  async seedDefaultZones(): Promise<void> {
    const existingZones = await prisma.shopShippingZone.count();
    if (existingZones > 0) {
      logger.info('Zone spedizione già esistenti, skip seed');
      return;
    }

    // Zona Italia Continentale
    const italiaContinent = await this.createZone({
      name: 'Italia Continentale',
      countries: ['IT'],
      regions: [],
      postcodes: [],
      priority: 10,
    });

    // Zona Italia Isole
    const italiaIsole = await this.createZone({
      name: 'Italia Isole (Sicilia, Sardegna)',
      countries: ['IT'],
      regions: ['sicilia', 'sardegna'],
      postcodes: ['90*', '91*', '92*', '93*', '94*', '95*', '96*', '97*', '98*', '07*', '08*', '09*'],
      priority: 20, // Priorità più alta per match più specifico
    });

    // Zona Europa UE
    const europaUE = await this.createZone({
      name: 'Europa UE',
      countries: ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'],
      priority: 5,
    });

    // Zona Europa non-UE
    const europaNonUE = await this.createZone({
      name: 'Europa non-UE (UK, CH, NO)',
      countries: ['GB', 'CH', 'NO'],
      priority: 5,
    });

    // Zona USA & Canada
    const northAmerica = await this.createZone({
      name: 'USA & Canada',
      countries: ['US', 'CA'],
      priority: 3,
    });

    // Zona Resto del Mondo
    const restOfWorld = await this.createZone({
      name: 'Resto del Mondo',
      countries: ['*'],
      priority: 0,
    });

    // Metodi per Italia Continentale
    await this.createMethod({
      zoneId: italiaContinent.id,
      name: 'Poste Italiane Economy',
      carrier: 'POSTE',
      type: 'FLAT_RATE',
      baseCost: 4.90,
      estimatedDaysMin: 5,
      estimatedDaysMax: 7,
      sortOrder: 1,
    });

    await this.createMethod({
      zoneId: italiaContinent.id,
      name: 'GLS Standard',
      carrier: 'GLS',
      type: 'FREE_ABOVE',
      baseCost: 6.90,
      freeAboveAmount: 120,
      estimatedDaysMin: 3,
      estimatedDaysMax: 5,
      sortOrder: 2,
    });

    await this.createMethod({
      zoneId: italiaContinent.id,
      name: 'BRT Express',
      carrier: 'BRT',
      type: 'FLAT_RATE',
      baseCost: 9.90,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      sortOrder: 3,
    });

    await this.createMethod({
      zoneId: italiaContinent.id,
      name: 'DHL Express 24h',
      carrier: 'DHL',
      type: 'FLAT_RATE',
      baseCost: 14.90,
      estimatedDaysMin: 1,
      estimatedDaysMax: 1,
      sortOrder: 4,
    });

    // Metodi per Italia Isole (supplemento)
    await this.createMethod({
      zoneId: italiaIsole.id,
      name: 'Poste Italiane Raccomandata',
      carrier: 'POSTE',
      type: 'FLAT_RATE',
      baseCost: 6.90,
      estimatedDaysMin: 7,
      estimatedDaysMax: 10,
      sortOrder: 1,
    });

    await this.createMethod({
      zoneId: italiaIsole.id,
      name: 'GLS Standard',
      carrier: 'GLS',
      type: 'FREE_ABOVE',
      baseCost: 8.90, // +2 supplemento isole
      freeAboveAmount: 120,
      estimatedDaysMin: 4,
      estimatedDaysMax: 6,
      sortOrder: 2,
    });

    await this.createMethod({
      zoneId: italiaIsole.id,
      name: 'BRT Express',
      carrier: 'BRT',
      type: 'FLAT_RATE',
      baseCost: 11.90,
      estimatedDaysMin: 2,
      estimatedDaysMax: 3,
      sortOrder: 3,
    });

    // Metodi per Europa UE
    await this.createMethod({
      zoneId: europaUE.id,
      name: 'GLS Europe',
      carrier: 'GLS',
      type: 'FREE_ABOVE',
      baseCost: 12.90,
      freeAboveAmount: 150,
      estimatedDaysMin: 5,
      estimatedDaysMax: 7,
      sortOrder: 1,
    });

    await this.createMethod({
      zoneId: europaUE.id,
      name: 'DPD Express',
      carrier: 'BRT',
      type: 'FLAT_RATE',
      baseCost: 16.90,
      estimatedDaysMin: 3,
      estimatedDaysMax: 4,
      sortOrder: 2,
    });

    await this.createMethod({
      zoneId: europaUE.id,
      name: 'DHL Express',
      carrier: 'DHL',
      type: 'FLAT_RATE',
      baseCost: 24.90,
      estimatedDaysMin: 2,
      estimatedDaysMax: 3,
      sortOrder: 3,
    });

    // Metodi per Europa non-UE
    await this.createMethod({
      zoneId: europaNonUE.id,
      name: 'DHL Express',
      carrier: 'DHL',
      type: 'FLAT_RATE',
      baseCost: 29.90,
      estimatedDaysMin: 3,
      estimatedDaysMax: 5,
      description: 'Possibili dazi doganali a carico del destinatario',
      sortOrder: 1,
    });

    // Metodi per USA & Canada
    await this.createMethod({
      zoneId: northAmerica.id,
      name: 'DHL Express',
      carrier: 'DHL',
      type: 'FLAT_RATE',
      baseCost: 34.90,
      estimatedDaysMin: 5,
      estimatedDaysMax: 7,
      description: 'Possibili dazi doganali a carico del destinatario',
      sortOrder: 1,
    });

    // Metodi per Resto del Mondo
    await this.createMethod({
      zoneId: restOfWorld.id,
      name: 'Poste Italiane International',
      carrier: 'POSTE',
      type: 'FLAT_RATE',
      baseCost: 19.90,
      estimatedDaysMin: 15,
      estimatedDaysMax: 20,
      sortOrder: 1,
    });

    await this.createMethod({
      zoneId: restOfWorld.id,
      name: 'DHL Express',
      carrier: 'DHL',
      type: 'FLAT_RATE',
      baseCost: 44.90,
      estimatedDaysMin: 7,
      estimatedDaysMax: 10,
      description: 'Possibili dazi doganali a carico del destinatario',
      sortOrder: 2,
    });

    logger.info('Zone e metodi spedizione di default creati');
  }
}

export default new ShopShippingService();
