import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ShippingType } from '@prisma/client';

// Mock prisma
const mockPrisma = {
  shopShippingZone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  shopShippingMethod: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import shopShippingService from '@server/services/shop-shipping.service';

describe('ShopShippingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================
  // findZoneForAddress
  // ===================
  describe('findZoneForAddress', () => {
    it('should return null when no zones exist', async () => {
      mockPrisma.shopShippingZone.findMany.mockResolvedValue([]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        state: 'Lombardia',
        postcode: '20100',
      });

      expect(result).toBeNull();
    });

    it('should return null when country does not match any zone', async () => {
      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        {
          id: 'zone-1',
          name: 'Italia',
          countries: ['IT'],
          regions: null,
          postcodes: null,
          priority: 10,
          isActive: true,
        },
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'DE',
        state: 'Bayern',
        postcode: '80000',
      });

      expect(result).toBeNull();
    });

    it('should match zone by country only', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
      });

      expect(result).toEqual(mockZone);
    });

    it('should match zone by postcode with exact match', async () => {
      const mockZoneSpecific = {
        id: 'zone-2',
        name: 'Milano',
        countries: ['IT'],
        regions: null,
        postcodes: ['20100', '20121'],
        priority: 20,
        isActive: true,
      };
      const mockZoneGeneral = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZoneSpecific, // Higher priority first
        mockZoneGeneral,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        postcode: '20100',
      });

      expect(result).toEqual(mockZoneSpecific);
    });

    it('should match zone by postcode with wildcard pattern', async () => {
      const mockZoneIslands = {
        id: 'zone-isole',
        name: 'Italia Isole',
        countries: ['IT'],
        regions: null,
        postcodes: ['90*', '91*', '92*'],
        priority: 20,
        isActive: true,
      };
      const mockZoneGeneral = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZoneIslands,
        mockZoneGeneral,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        postcode: '90145',
      });

      expect(result).toEqual(mockZoneIslands);
    });

    it('should skip zone when postcode does not match specified patterns', async () => {
      const mockZoneIslands = {
        id: 'zone-isole',
        name: 'Italia Isole',
        countries: ['IT'],
        regions: null,
        postcodes: ['90*', '91*'],
        priority: 20,
        isActive: true,
      };
      const mockZoneGeneral = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZoneIslands,
        mockZoneGeneral,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        postcode: '20100', // Milan, not in islands
      });

      expect(result).toEqual(mockZoneGeneral);
    });

    it('should match zone by region (case-insensitive)', async () => {
      const mockZoneRegion = {
        id: 'zone-sicilia',
        name: 'Sicilia',
        countries: ['IT'],
        regions: ['sicilia'],
        postcodes: null,
        priority: 15,
        isActive: true,
      };
      const mockZoneGeneral = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZoneRegion,
        mockZoneGeneral,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        state: 'SICILIA', // Uppercase
      });

      expect(result).toEqual(mockZoneRegion);
    });

    it('should skip zone when region does not match', async () => {
      const mockZoneRegion = {
        id: 'zone-sicilia',
        name: 'Sicilia',
        countries: ['IT'],
        regions: ['sicilia'],
        postcodes: null,
        priority: 15,
        isActive: true,
      };
      const mockZoneGeneral = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZoneRegion,
        mockZoneGeneral,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        state: 'Lombardia',
      });

      expect(result).toEqual(mockZoneGeneral);
    });

    it('should prioritize postcode over region match', async () => {
      const mockZonePostcode = {
        id: 'zone-postcode',
        name: 'Specific Postcodes',
        countries: ['IT'],
        regions: null,
        postcodes: ['20*'],
        priority: 25,
        isActive: true,
      };
      const mockZoneRegion = {
        id: 'zone-region',
        name: 'Lombardia',
        countries: ['IT'],
        regions: ['lombardia'],
        postcodes: null,
        priority: 15,
        isActive: true,
      };

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([
        mockZonePostcode,
        mockZoneRegion,
      ]);

      const result = await shopShippingService.findZoneForAddress({
        country: 'IT',
        state: 'Lombardia',
        postcode: '20100',
      });

      expect(result).toEqual(mockZonePostcode);
    });
  });

  // ===================
  // calculateShipping
  // ===================
  describe('calculateShipping', () => {
    it('should return empty array when no zone matches', async () => {
      mockPrisma.shopShippingZone.findMany.mockResolvedValue([]);

      const result = await shopShippingService.calculateShipping(
        { country: 'XX' },
        100,
        2
      );

      expect(result).toEqual([]);
    });

    it('should return all active methods for matching zone', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          zoneId: 'zone-1',
          name: 'Standard',
          carrier: 'GLS',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 6.90,
          costPerKg: null,
          freeAboveAmount: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        100,
        2
      );

      expect(result).toHaveLength(1);
      expect(result[0].cost).toBe(6.90);
      expect(result[0].isFreeShipping).toBe(false);
    });

    it('should filter methods by weight constraints', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Standard',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 6.90,
          minWeight: 0,
          maxWeight: 5, // Max 5kg
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          costPerKg: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
        {
          id: 'method-2',
          name: 'Heavy',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 15.90,
          minWeight: 5, // Min 5kg
          maxWeight: 30,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          costPerKg: null,
          estimatedDaysMin: 5,
          estimatedDaysMax: 7,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        100,
        10 // 10kg - should only match Heavy method
      );

      expect(result).toHaveLength(1);
      expect(result[0].method.name).toBe('Heavy');
    });

    it('should filter methods by order amount constraints', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Standard',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 6.90,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: 0,
          maxOrderAmount: 100, // Max 100 EUR
          freeAboveAmount: null,
          costPerKg: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
        {
          id: 'method-2',
          name: 'Premium',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 9.90,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: 100, // Min 100 EUR
          maxOrderAmount: null,
          freeAboveAmount: null,
          costPerKg: null,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        150, // 150 EUR - should only match Premium
        2
      );

      expect(result).toHaveLength(1);
      expect(result[0].method.name).toBe('Premium');
    });

    it('should calculate WEIGHT_BASED shipping cost', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Weight Based',
          type: 'WEIGHT_BASED' as ShippingType,
          baseCost: 5.00,
          costPerKg: 2.00,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        100,
        3 // 3kg
      );

      // 5.00 + (2.00 * 3) = 11.00
      expect(result[0].cost).toBe(11.00);
    });

    it('should calculate FREE_ABOVE shipping with free shipping', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Free Above 100',
          type: 'FREE_ABOVE' as ShippingType,
          baseCost: 6.90,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: 100,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        120, // Above 100 threshold
        2
      );

      expect(result[0].cost).toBe(0);
      expect(result[0].isFreeShipping).toBe(true);
    });

    it('should show amount for free shipping when below threshold', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Free Above 100',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 6.90,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: 100,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        80, // Below threshold
        2
      );

      expect(result[0].cost).toBe(6.90);
      expect(result[0].isFreeShipping).toBe(false);
      expect(result[0].amountForFreeShipping).toBe(20); // 100 - 80 = 20
    });

    it('should set cost to 0 for PICKUP type', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Pickup in Store',
          type: 'PICKUP' as ShippingType,
          baseCost: 0,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 0,
          estimatedDaysMax: 0,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        50,
        1
      );

      expect(result[0].cost).toBe(0);
      expect(result[0].isFreeShipping).toBe(true);
    });

    it('should round cost to 2 decimal places', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Weight Based',
          type: 'WEIGHT_BASED' as ShippingType,
          baseCost: 5.00,
          costPerKg: 2.333, // Causes decimal issues
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.calculateShipping(
        { country: 'IT' },
        100,
        3
      );

      // 5.00 + (2.333 * 3) = 5 + 6.999 = 11.999 → 12.00
      expect(result[0].cost).toBe(12);
    });
  });

  // ===================
  // getCheapestMethod
  // ===================
  describe('getCheapestMethod', () => {
    it('should return null when no methods available', async () => {
      mockPrisma.shopShippingZone.findMany.mockResolvedValue([]);

      const result = await shopShippingService.getCheapestMethod(
        { country: 'XX' },
        100,
        2
      );

      expect(result).toBeNull();
    });

    it('should return cheapest method when multiple available', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Italia',
        countries: ['IT'],
        regions: null,
        postcodes: null,
        priority: 10,
        isActive: true,
      };
      const mockMethods = [
        {
          id: 'method-1',
          name: 'Express',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 15.90,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
          isActive: true,
          zone: mockZone,
        },
        {
          id: 'method-2',
          name: 'Standard',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 6.90,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
          zone: mockZone,
        },
        {
          id: 'method-3',
          name: 'Economy',
          type: 'FLAT_RATE' as ShippingType,
          baseCost: 4.90,
          costPerKg: null,
          minWeight: null,
          maxWeight: null,
          minOrderAmount: null,
          maxOrderAmount: null,
          freeAboveAmount: null,
          estimatedDaysMin: 5,
          estimatedDaysMax: 7,
          isActive: true,
          zone: mockZone,
        },
      ];

      mockPrisma.shopShippingZone.findMany.mockResolvedValue([mockZone]);
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.getCheapestMethod(
        { country: 'IT' },
        100,
        2
      );

      expect(result).not.toBeNull();
      expect(result?.method.name).toBe('Economy');
      expect(result?.cost).toBe(4.90);
    });
  });

  // ===================
  // Zone Management
  // ===================
  describe('createZone', () => {
    it('should create zone with all fields', async () => {
      const mockZone = {
        id: 'zone-new',
        name: 'Test Zone',
        countries: ['IT', 'FR'],
        regions: ['lombardia'],
        postcodes: ['20*'],
        priority: 15,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.shopShippingZone.create.mockResolvedValue(mockZone);

      const result = await shopShippingService.createZone({
        name: 'Test Zone',
        countries: ['IT', 'FR'],
        regions: ['lombardia'],
        postcodes: ['20*'],
        priority: 15,
        isActive: true,
      });

      expect(result).toEqual(mockZone);
      expect(mockPrisma.shopShippingZone.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Zone',
          countries: ['IT', 'FR'],
          regions: ['lombardia'],
          postcodes: ['20*'],
          priority: 15,
          isActive: true,
        },
      });
    });

    it('should use default values when not provided', async () => {
      const mockZone = {
        id: 'zone-new',
        name: 'Test Zone',
        countries: ['IT'],
        regions: undefined,
        postcodes: undefined,
        priority: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.shopShippingZone.create.mockResolvedValue(mockZone);

      await shopShippingService.createZone({
        name: 'Test Zone',
        countries: ['IT'],
      });

      expect(mockPrisma.shopShippingZone.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Zone',
          countries: ['IT'],
          regions: undefined,
          postcodes: undefined,
          priority: 0,
          isActive: true,
        },
      });
    });
  });

  describe('updateZone', () => {
    it('should update zone with partial data', async () => {
      const mockZone = {
        id: 'zone-1',
        name: 'Updated Zone',
        countries: ['IT'],
        priority: 20,
        isActive: true,
      };
      mockPrisma.shopShippingZone.update.mockResolvedValue(mockZone);

      const result = await shopShippingService.updateZone('zone-1', {
        name: 'Updated Zone',
        priority: 20,
      });

      expect(result).toEqual(mockZone);
      expect(mockPrisma.shopShippingZone.update).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
        data: { name: 'Updated Zone', priority: 20 },
      });
    });
  });

  describe('deleteZone', () => {
    it('should delete zone by ID', async () => {
      mockPrisma.shopShippingZone.delete.mockResolvedValue({});

      await shopShippingService.deleteZone('zone-1');

      expect(mockPrisma.shopShippingZone.delete).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
      });
    });
  });

  describe('listZones', () => {
    it('should list only active zones by default', async () => {
      const mockZones = [
        { id: 'zone-1', name: 'Zone 1', isActive: true, priority: 10 },
        { id: 'zone-2', name: 'Zone 2', isActive: true, priority: 5 },
      ];
      mockPrisma.shopShippingZone.findMany.mockResolvedValue(mockZones);

      const result = await shopShippingService.listZones();

      expect(result).toEqual(mockZones);
      expect(mockPrisma.shopShippingZone.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      });
    });

    it('should include inactive zones when requested', async () => {
      const mockZones = [
        { id: 'zone-1', name: 'Zone 1', isActive: true, priority: 10 },
        { id: 'zone-2', name: 'Zone 2', isActive: false, priority: 5 },
      ];
      mockPrisma.shopShippingZone.findMany.mockResolvedValue(mockZones);

      const result = await shopShippingService.listZones(true);

      expect(result).toEqual(mockZones);
      expect(mockPrisma.shopShippingZone.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      });
    });
  });

  describe('getZoneById', () => {
    it('should return zone when found', async () => {
      const mockZone = { id: 'zone-1', name: 'Test Zone' };
      mockPrisma.shopShippingZone.findUnique.mockResolvedValue(mockZone);

      const result = await shopShippingService.getZoneById('zone-1');

      expect(result).toEqual(mockZone);
    });

    it('should return null when not found', async () => {
      mockPrisma.shopShippingZone.findUnique.mockResolvedValue(null);

      const result = await shopShippingService.getZoneById('zone-unknown');

      expect(result).toBeNull();
    });
  });

  // ===================
  // Method Management
  // ===================
  describe('createMethod', () => {
    it('should create method with all fields', async () => {
      const mockMethod = {
        id: 'method-new',
        zoneId: 'zone-1',
        name: 'Express',
        carrier: 'DHL',
        type: 'FLAT_RATE' as ShippingType,
        baseCost: 14.90,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isActive: true,
      };
      mockPrisma.shopShippingMethod.create.mockResolvedValue(mockMethod);

      const result = await shopShippingService.createMethod({
        zoneId: 'zone-1',
        name: 'Express',
        carrier: 'DHL',
        type: 'FLAT_RATE' as ShippingType,
        baseCost: 14.90,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
      });

      expect(result).toEqual(mockMethod);
    });

    it('should use default values for optional fields', async () => {
      mockPrisma.shopShippingMethod.create.mockResolvedValue({});

      await shopShippingService.createMethod({
        zoneId: 'zone-1',
        name: 'Standard',
        carrier: 'GLS',
        type: 'FLAT_RATE' as ShippingType,
        baseCost: 6.90,
      });

      expect(mockPrisma.shopShippingMethod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estimatedDaysMin: 1,
          estimatedDaysMax: 5,
          sortOrder: 0,
          isActive: true,
        }),
      });
    });
  });

  describe('updateMethod', () => {
    it('should update method with partial data', async () => {
      const mockMethod = {
        id: 'method-1',
        name: 'Updated Method',
        baseCost: 9.90,
      };
      mockPrisma.shopShippingMethod.update.mockResolvedValue(mockMethod);

      const result = await shopShippingService.updateMethod('method-1', {
        name: 'Updated Method',
        baseCost: 9.90,
      });

      expect(result).toEqual(mockMethod);
      expect(mockPrisma.shopShippingMethod.update).toHaveBeenCalledWith({
        where: { id: 'method-1' },
        data: { name: 'Updated Method', baseCost: 9.90 },
      });
    });
  });

  describe('deleteMethod', () => {
    it('should delete method by ID', async () => {
      mockPrisma.shopShippingMethod.delete.mockResolvedValue({});

      await shopShippingService.deleteMethod('method-1');

      expect(mockPrisma.shopShippingMethod.delete).toHaveBeenCalledWith({
        where: { id: 'method-1' },
      });
    });
  });

  describe('listMethodsByZone', () => {
    it('should list only active methods by default', async () => {
      const mockMethods = [
        { id: 'method-1', name: 'Standard', isActive: true, sortOrder: 1 },
        { id: 'method-2', name: 'Express', isActive: true, sortOrder: 2 },
      ];
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.listMethodsByZone('zone-1');

      expect(result).toEqual(mockMethods);
      expect(mockPrisma.shopShippingMethod.findMany).toHaveBeenCalledWith({
        where: { zoneId: 'zone-1', isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should include inactive methods when requested', async () => {
      const mockMethods = [
        { id: 'method-1', name: 'Standard', isActive: true, sortOrder: 1 },
        { id: 'method-2', name: 'Disabled', isActive: false, sortOrder: 2 },
      ];
      mockPrisma.shopShippingMethod.findMany.mockResolvedValue(mockMethods);

      const result = await shopShippingService.listMethodsByZone('zone-1', true);

      expect(result).toEqual(mockMethods);
      expect(mockPrisma.shopShippingMethod.findMany).toHaveBeenCalledWith({
        where: { zoneId: 'zone-1' },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('getMethodById', () => {
    it('should return method with zone when found', async () => {
      const mockMethod = {
        id: 'method-1',
        name: 'Standard',
        zone: { id: 'zone-1', name: 'Italia' },
      };
      mockPrisma.shopShippingMethod.findUnique.mockResolvedValue(mockMethod);

      const result = await shopShippingService.getMethodById('method-1');

      expect(result).toEqual(mockMethod);
      expect(mockPrisma.shopShippingMethod.findUnique).toHaveBeenCalledWith({
        where: { id: 'method-1' },
        include: { zone: true },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.shopShippingMethod.findUnique.mockResolvedValue(null);

      const result = await shopShippingService.getMethodById('method-unknown');

      expect(result).toBeNull();
    });
  });

  // ===================
  // seedDefaultZones
  // ===================
  describe('seedDefaultZones', () => {
    it('should skip seeding when zones already exist', async () => {
      mockPrisma.shopShippingZone.count.mockResolvedValue(5);

      await shopShippingService.seedDefaultZones();

      expect(mockPrisma.shopShippingZone.create).not.toHaveBeenCalled();
    });

    it('should create default zones and methods when empty', async () => {
      mockPrisma.shopShippingZone.count.mockResolvedValue(0);
      mockPrisma.shopShippingZone.create.mockImplementation(async ({ data }) => ({
        id: `zone-${data.name}`,
        ...data,
      }));
      mockPrisma.shopShippingMethod.create.mockResolvedValue({});

      await shopShippingService.seedDefaultZones();

      // Should create 6 zones
      expect(mockPrisma.shopShippingZone.create).toHaveBeenCalledTimes(6);

      // Should create multiple methods
      expect(mockPrisma.shopShippingMethod.create).toHaveBeenCalled();
    });
  });
});
