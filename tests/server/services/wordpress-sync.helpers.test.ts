/**
 * @jest-environment node
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create prisma mock at module level
const prismaMock = mockDeep<PrismaClient>();

// Mock database config
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks
import {
  mapProductToWooCommerce,
  mapVariantToWooCommerce,
  mapAttributesForVariableProduct,
  mapWooCommerceToProduct,
  mapWooCommerceToVariant,
  logSync,
  resolveWooCommerceIds,
  findOrCreateShippingClass,
} from '@server/services/wordpress-sync.helpers';

describe('WordPress Sync Helpers', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('mapProductToWooCommerce', () => {
    it('should map basic product fields correctly', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        webPrice: 120,
        description: 'Product description',
        webDescription: 'Web description',
        webShortDescription: 'Short desc',
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.name).toBe('Test Product');
      expect(result.sku).toBe('TEST-001');
      expect(result.type).toBe('simple');
      expect(result.status).toBe('publish');
      expect(result.regular_price).toBe('120');
      expect(result.description).toBe('Web description');
      expect(result.short_description).toBe('Short desc');
    });

    it('should set status to draft when webActive is false', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: false,
        price: 100,
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.status).toBe('draft');
    });

    it('should calculate stock from WEB location inventory', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
      };

      const inventory = [
        { location: 'WEB', quantity: 50, reservedQuantity: 5 },
        { location: 'WEB', quantity: 30, reservedQuantity: 10 },
        { location: 'B2B', quantity: 100, reservedQuantity: 0 }, // Should be ignored
      ];

      const result = mapProductToWooCommerce(product, inventory, [], [], 'simple');

      expect(result.stock_quantity).toBe(65); // (50-5) + (30-10)
      expect(result.stock_status).toBe('instock');
    });

    it('should set stock_status to outofstock when no WEB stock', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
      };

      const inventory = [
        { location: 'WEB', quantity: 10, reservedQuantity: 10 },
      ];

      const result = mapProductToWooCommerce(product, inventory, [], [], 'simple');

      expect(result.stock_quantity).toBe(0);
      expect(result.stock_status).toBe('outofstock');
    });

    it('should set stock_status to onbackorder when allowed', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        wcBackordersAllowed: true,
      };

      const inventory = [
        { location: 'WEB', quantity: 0, reservedQuantity: 0 },
      ];

      const result = mapProductToWooCommerce(product, inventory, [], [], 'simple');

      expect(result.stock_status).toBe('onbackorder');
    });

    it('should map categories with WooCommerce IDs', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
      };

      const categories = [
        { category: { woocommerceId: 10 } },
        { category: { woocommerceId: 20 } },
        { category: { woocommerceId: null } }, // Should be filtered out
      ];

      const result = mapProductToWooCommerce(product, [], categories, [], 'simple');

      expect(result.categories).toEqual([{ id: 10 }, { id: 20 }]);
    });

    it('should map images with src and alt', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
      };

      const images = [
        { src: 'https://example.com/img1.jpg', name: 'Image 1', alt: 'Alt 1', woocommerceId: 100 },
        { src: 'https://example.com/img2.jpg', name: 'Image 2' },
      ];

      const result = mapProductToWooCommerce(product, [], [], images, 'simple');

      expect(result.images).toHaveLength(2);
      expect(result.images![0]).toEqual({
        id: 100,
        src: 'https://example.com/img1.jpg',
        name: 'Image 1',
        alt: 'Alt 1',
        position: 0,
      });
      expect(result.images![1]).toEqual({
        src: 'https://example.com/img2.jpg',
        name: 'Image 2',
        alt: 'Test Product',
        position: 1,
      });
    });

    it('should include sale price with dates', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        wcSalePrice: 80,
        wcDateOnSaleFrom: '2026-01-01T00:00:00Z',
        wcDateOnSaleTo: '2026-01-31T23:59:59Z',
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.sale_price).toBe('80');
      expect(result.date_on_sale_from).toBeDefined();
      expect(result.date_on_sale_to).toBeDefined();
    });

    it('should include dimensions when provided', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        dimensions: { width: 10, height: 20, depth: 30 },
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.dimensions).toEqual({
        width: '10',
        height: '20',
        length: '30', // depth maps to length in WC
      });
    });

    it('should include SEO meta data when provided', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        webMetaTitle: 'SEO Title',
        webMetaDescription: 'SEO Description',
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.meta_data).toEqual([
        { key: '_yoast_wpseo_title', value: 'SEO Title' },
        { key: '_yoast_wpseo_metadesc', value: 'SEO Description' },
      ]);
    });

    it('should handle external product type', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        wcExternalUrl: 'https://external.com/product',
        wcButtonText: 'Buy Now',
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'external');

      expect(result.type).toBe('external');
      expect(result.external_url).toBe('https://external.com/product');
      expect(result.button_text).toBe('Buy Now');
    });

    it('should handle grouped products', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Test Product',
        webActive: true,
        price: 100,
        wcGroupedProducts: [1, 2, 3],
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'grouped');

      expect(result.type).toBe('grouped');
      expect(result.grouped_products).toEqual([1, 2, 3]);
    });

    it('should include downloadable fields for digital products', () => {
      const product = {
        sku: 'TEST-001',
        name: 'Digital Product',
        webActive: true,
        price: 50,
        wcDownloadable: true,
        downloadFiles: [
          { name: 'File 1', url: 'https://example.com/file1.pdf' },
          { name: 'File 2', file: 'https://example.com/file2.zip' },
        ],
        wcDownloadLimit: 5,
        wcDownloadExpiry: 30,
      };

      const result = mapProductToWooCommerce(product, [], [], [], 'simple');

      expect(result.downloadable).toBe(true);
      expect(result.downloads).toEqual([
        { name: 'File 1', file: 'https://example.com/file1.pdf' },
        { name: 'File 2', file: 'https://example.com/file2.zip' },
      ]);
      expect(result.download_limit).toBe(5);
      expect(result.download_expiry).toBe(30);
    });
  });

  describe('mapVariantToWooCommerce', () => {
    it('should map basic variant fields correctly', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        webActive: true,
        priceDelta: 10,
        attributes: { Color: 'Red', Size: 'M' },
      };

      const parentProduct = {
        price: 100,
        webPrice: 100,
      };

      const inventory = [
        { location: 'WEB', variantId: 'var-1', quantity: 20, reservedQuantity: 5 },
      ];

      const result = mapVariantToWooCommerce(variant, parentProduct, inventory);

      expect(result.sku).toBe('TEST-001-RED');
      expect(result.status).toBe('publish');
      expect(result.regular_price).toBe('110'); // 100 + 10
      expect(result.stock_quantity).toBe(15);
      expect(result.stock_status).toBe('instock');
      expect(result.attributes).toEqual([
        { name: 'Color', option: 'Red' },
        { name: 'Size', option: 'M' },
      ]);
    });

    it('should use webPrice when available', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        webActive: true,
        webPrice: 150, // Override price
        priceDelta: 10,
        attributes: {},
      };

      const parentProduct = {
        price: 100,
        webPrice: 100,
      };

      const result = mapVariantToWooCommerce(variant, parentProduct, []);

      expect(result.regular_price).toBe('150');
    });

    it('should calculate variant stock correctly', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        webActive: true,
        attributes: {},
      };

      const parentProduct = {
        price: 100,
      };

      const inventory = [
        { location: 'WEB', variantId: 'var-1', quantity: 30, reservedQuantity: 5 },
        { location: 'WEB', variantId: 'var-2', quantity: 50, reservedQuantity: 0 }, // Different variant
        { location: 'B2B', variantId: 'var-1', quantity: 100, reservedQuantity: 0 }, // Different location
      ];

      const result = mapVariantToWooCommerce(variant, parentProduct, inventory);

      expect(result.stock_quantity).toBe(25); // Only var-1 in WEB location
    });

    it('should set status to private when not webActive', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        webActive: false,
        attributes: {},
      };

      const parentProduct = {
        price: 100,
      };

      const result = mapVariantToWooCommerce(variant, parentProduct, []);

      expect(result.status).toBe('private');
    });

    it('should include sale price with dates', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        webActive: true,
        attributes: {},
        wcSalePrice: 80,
        wcDateOnSaleFrom: '2026-01-01',
        wcDateOnSaleTo: '2026-01-31',
      };

      const parentProduct = {
        price: 100,
      };

      const result = mapVariantToWooCommerce(variant, parentProduct, []);

      expect(result.sale_price).toBe('80');
      expect(result.date_on_sale_from).toBeDefined();
      expect(result.date_on_sale_to).toBeDefined();
    });

    it('should include variant image', () => {
      const variant = {
        id: 'var-1',
        sku: 'TEST-001-RED',
        name: 'Red Variant',
        webActive: true,
        attributes: {},
        mainImageUrl: 'https://example.com/red.jpg',
        mainImageId: 200,
      };

      const parentProduct = {
        price: 100,
      };

      const result = mapVariantToWooCommerce(variant, parentProduct, []);

      expect(result.image).toEqual({
        id: 200,
        src: 'https://example.com/red.jpg',
        alt: 'Red Variant',
      });
    });
  });

  describe('mapAttributesForVariableProduct', () => {
    it('should collect unique attributes from variants', () => {
      const product = {};
      const variants = [
        { attributes: { Color: 'Red', Size: 'S' } },
        { attributes: { Color: 'Blue', Size: 'M' } },
        { attributes: { Color: 'Red', Size: 'L' } },
      ];

      const result = mapAttributesForVariableProduct(product, variants);

      expect(result).toHaveLength(2);

      const colorAttr = result.find(a => a.name === 'Color');
      expect(colorAttr).toBeDefined();
      expect(colorAttr!.options).toContain('Red');
      expect(colorAttr!.options).toContain('Blue');

      const sizeAttr = result.find(a => a.name === 'Size');
      expect(sizeAttr).toBeDefined();
      expect(sizeAttr!.options).toContain('S');
      expect(sizeAttr!.options).toContain('M');
      expect(sizeAttr!.options).toContain('L');
    });

    it('should return empty array for variants without attributes', () => {
      const product = {};
      const variants = [
        { name: 'Variant 1' },
        { name: 'Variant 2' },
      ];

      const result = mapAttributesForVariableProduct(product, variants);

      expect(result).toEqual([]);
    });

    it('should set all attributes as visible and variation', () => {
      const product = {};
      const variants = [
        { attributes: { Color: 'Red' } },
      ];

      const result = mapAttributesForVariableProduct(product, variants);

      expect(result[0].visible).toBe(true);
      expect(result[0].variation).toBe(true);
    });

    it('should assign sequential positions', () => {
      const product = {};
      const variants = [
        { attributes: { Size: 'S', Color: 'Red', Material: 'Cotton' } },
      ];

      const result = mapAttributesForVariableProduct(product, variants);

      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });

  describe('mapWooCommerceToProduct', () => {
    it('should map basic WC product to ERP format', () => {
      const wcProduct = {
        id: 123,
        sku: 'WOO-001',
        name: 'WC Product',
        description: 'Product description',
        type: 'simple',
        status: 'publish',
        regular_price: '99.99',
        weight: '2.5',
        permalink: 'https://shop.com/product/woo-001',
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.sku).toBe('WOO-001');
      expect(result.name).toBe('WC Product');
      expect(result.description).toBe('Product description');
      expect(result.type).toBe('SIMPLE');
      expect(result.woocommerceId).toBe(123);
      expect(result.price).toBe(99.99);
      expect(result.weight).toBe(2.5);
      expect(result.isActive).toBe(true);
      expect(result.webActive).toBe(true);
    });

    it('should generate SKU when missing', () => {
      const wcProduct = {
        id: 456,
        name: 'Product Without SKU',
        type: 'simple',
        regular_price: '50',
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.sku).toBe('WOO-456');
    });

    it('should detect variable product type', () => {
      const wcProduct = {
        id: 123,
        sku: 'VAR-001',
        name: 'Variable Product',
        type: 'variable',
        regular_price: '100',
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.type).toBe('WITH_VARIANTS');
    });

    it('should detect digital product type', () => {
      const wcProduct = {
        id: 123,
        sku: 'DIG-001',
        name: 'Digital Product',
        type: 'simple',
        regular_price: '25',
        virtual: true,
        downloadable: true,
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.type).toBe('DIGITAL');
    });

    it('should extract Yoast SEO meta data', () => {
      const wcProduct = {
        id: 123,
        sku: 'SEO-001',
        name: 'SEO Product',
        type: 'simple',
        regular_price: '100',
        meta_data: [
          { key: '_yoast_wpseo_title', value: 'Custom SEO Title' },
          { key: '_yoast_wpseo_metadesc', value: 'Custom meta description' },
          { key: 'some_other_meta', value: 'ignored' },
        ],
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.webMetaTitle).toBe('Custom SEO Title');
      expect(result.webMetaDescription).toBe('Custom meta description');
    });

    it('should map dimensions correctly', () => {
      const wcProduct = {
        id: 123,
        sku: 'DIM-001',
        name: 'Product with Dimensions',
        type: 'simple',
        regular_price: '100',
        dimensions: {
          length: '30',
          width: '10',
          height: '20',
        },
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.dimensions).toEqual({
        width: 10,
        height: 20,
        depth: 30, // length maps to depth in ERP
      });
    });

    it('should map images correctly', () => {
      const wcProduct = {
        id: 123,
        sku: 'IMG-001',
        name: 'Product with Images',
        type: 'simple',
        regular_price: '100',
        images: [
          { id: 10, src: 'https://example.com/main.jpg' },
          { id: 20, src: 'https://example.com/gallery.jpg' },
        ],
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.mainImageUrl).toBe('https://example.com/main.jpg');
      expect(result.mainImageId).toBe(10);
      expect(result.images).toEqual([
        'https://example.com/main.jpg',
        'https://example.com/gallery.jpg',
      ]);
    });

    it('should map sale price and dates', () => {
      const wcProduct = {
        id: 123,
        sku: 'SALE-001',
        name: 'Sale Product',
        type: 'simple',
        regular_price: '100',
        sale_price: '80',
        on_sale: true,
        date_on_sale_from: '2026-01-01T00:00:00',
        date_on_sale_to: '2026-01-31T23:59:59',
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.wcSalePrice).toBe(80);
      expect(result.wcOnSale).toBe(true);
      expect(result.wcDateOnSaleFrom).toEqual(new Date('2026-01-01T00:00:00'));
      expect(result.wcDateOnSaleTo).toEqual(new Date('2026-01-31T23:59:59'));
    });

    it('should map downloads for downloadable products', () => {
      const wcProduct = {
        id: 123,
        sku: 'DL-001',
        name: 'Downloadable Product',
        type: 'simple',
        regular_price: '25',
        downloadable: true,
        downloads: [
          { name: 'PDF File', file: 'https://example.com/file.pdf' },
          { name: 'ZIP Archive', file: 'https://example.com/archive.zip' },
        ],
        download_limit: 3,
        download_expiry: 7,
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.wcDownloadable).toBe(true);
      expect(result.downloadFiles).toEqual([
        { name: 'PDF File', url: 'https://example.com/file.pdf' },
        { name: 'ZIP Archive', url: 'https://example.com/archive.zip' },
      ]);
      expect(result.wcDownloadLimit).toBe(3);
      expect(result.wcDownloadExpiry).toBe(7);
    });

    it('should map stock and backorder settings', () => {
      const wcProduct = {
        id: 123,
        sku: 'STK-001',
        name: 'Stock Product',
        type: 'simple',
        regular_price: '100',
        stock_status: 'onbackorder',
        backorders: 'notify',
        backorders_allowed: true,
        sold_individually: true,
      };

      const result = mapWooCommerceToProduct(wcProduct);

      expect(result.wcStockStatus).toBe('onbackorder');
      expect(result.wcBackorders).toBe('notify');
      expect(result.wcBackordersAllowed).toBe(true);
      expect(result.wcSoldIndividually).toBe(true);
    });
  });

  describe('mapWooCommerceToVariant', () => {
    it('should map basic WC variation to ERP variant', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-RED',
        regular_price: '120',
        status: 'publish',
        attributes: [
          { name: 'Color', option: 'Red' },
          { name: 'Size', option: 'M' },
        ],
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.sku).toBe('VAR-001-RED');
      expect(result.name).toBe('Red / M');
      expect(result.attributes).toEqual({ Color: 'Red', Size: 'M' });
      expect(result.priceDelta).toBe(20); // 120 - 100
      expect(result.isActive).toBe(true);
      expect(result.woocommerceVariationId).toBe(456);
    });

    it('should generate SKU when missing', () => {
      const wcVariation = {
        id: 789,
        regular_price: '100',
        status: 'publish',
        attributes: [],
      };

      const parentProduct = {
        sku: 'PARENT',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.sku).toBe('PARENT-VAR-789');
    });

    it('should handle negative price delta', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-SMALL',
        regular_price: '80',
        status: 'publish',
        attributes: [{ name: 'Size', option: 'Small' }],
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.priceDelta).toBe(-20);
    });

    it('should map variation dimensions', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-L',
        regular_price: '100',
        status: 'publish',
        attributes: [],
        weight: '3.5',
        dimensions: {
          length: '50',
          width: '20',
          height: '30',
        },
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.weight).toBe(3.5);
      expect(result.dimensions).toEqual({
        width: 20,
        height: 30,
        depth: 50,
      });
    });

    it('should map variation image', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-RED',
        regular_price: '100',
        status: 'publish',
        attributes: [],
        image: {
          id: 300,
          src: 'https://example.com/red-variant.jpg',
        },
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.mainImageUrl).toBe('https://example.com/red-variant.jpg');
      expect(result.mainImageId).toBe(300);
    });

    it('should map sale price data', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-SALE',
        regular_price: '100',
        sale_price: '75',
        on_sale: true,
        date_on_sale_from: '2026-02-01',
        date_on_sale_to: '2026-02-28',
        status: 'publish',
        attributes: [],
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 100,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.wcSalePrice).toBe(75);
      expect(result.wcOnSale).toBe(true);
      expect(result.wcDateOnSaleFrom).toBeInstanceOf(Date);
      expect(result.wcDateOnSaleTo).toBeInstanceOf(Date);
    });

    it('should handle downloads for downloadable variations', () => {
      const wcVariation = {
        id: 456,
        sku: 'VAR-001-DL',
        regular_price: '50',
        status: 'publish',
        attributes: [],
        downloadable: true,
        downloads: [
          { name: 'High Res', file: 'https://example.com/highres.jpg' },
        ],
        download_limit: 2,
        download_expiry: 30,
      };

      const parentProduct = {
        sku: 'VAR-001',
        price: 50,
      };

      const result = mapWooCommerceToVariant(wcVariation, parentProduct);

      expect(result.wcDownloadable).toBe(true);
      expect(result.wcDownloads).toEqual([
        { name: 'High Res', url: 'https://example.com/highres.jpg' },
      ]);
      expect(result.wcDownloadLimit).toBe(2);
      expect(result.wcDownloadExpiry).toBe(30);
    });
  });

  describe('logSync', () => {
    it('should create sync log entry', async () => {
      (prismaMock.wordPressSyncLog.create as jest.Mock).mockResolvedValue({
        id: 'log-1',
        direction: 'TO_WP',
        entity: 'PRODUCT',
        entityId: 'prod-1',
        action: 'CREATE',
        status: 'SUCCESS',
      });

      await logSync(
        'TO_WP',
        'PRODUCT',
        'prod-1',
        'CREATE',
        'SUCCESS',
        { sku: 'TEST' },
        { id: 123 },
        undefined,
        150
      );

      expect(prismaMock.wordPressSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'TO_WP',
          entity: 'PRODUCT',
          entityId: 'prod-1',
          action: 'CREATE',
          status: 'SUCCESS',
          duration: 150,
        }),
      });
    });

    it('should log error message when sync fails', async () => {
      (prismaMock.wordPressSyncLog.create as jest.Mock).mockResolvedValue({});

      await logSync(
        'FROM_WP',
        'ORDER',
        'order-1',
        'IMPORT',
        'FAILED',
        null,
        null,
        'Connection timeout'
      );

      expect(prismaMock.wordPressSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'FROM_WP',
          entity: 'ORDER',
          status: 'FAILED',
          error: 'Connection timeout',
        }),
      });
    });

    it('should handle database errors gracefully', async () => {
      (prismaMock.wordPressSyncLog.create as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      // Should not throw
      await expect(
        logSync('TO_WP', 'PRODUCT', 'prod-1', 'UPDATE', 'SUCCESS')
      ).resolves.not.toThrow();
    });
  });

  describe('resolveWooCommerceIds', () => {
    it('should resolve product IDs', async () => {
      (prismaMock.product.findMany as jest.Mock).mockResolvedValue([
        { woocommerceId: 100 },
        { woocommerceId: 200 },
      ]);

      const result = await resolveWooCommerceIds(['prod-1', 'prod-2'], 'product');

      expect(result).toEqual([100, 200]);
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod-1', 'prod-2'] }, woocommerceId: { not: null } },
        select: { woocommerceId: true },
      });
    });

    it('should resolve category IDs', async () => {
      (prismaMock.productCategory.findMany as jest.Mock).mockResolvedValue([
        { woocommerceId: 10 },
        { woocommerceId: 20 },
        { woocommerceId: 30 },
      ]);

      const result = await resolveWooCommerceIds(['cat-1', 'cat-2', 'cat-3'], 'category');

      expect(result).toEqual([10, 20, 30]);
      expect(prismaMock.productCategory.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['cat-1', 'cat-2', 'cat-3'] }, woocommerceId: { not: null } },
        select: { woocommerceId: true },
      });
    });

    it('should return empty array for empty input', async () => {
      const result = await resolveWooCommerceIds([], 'product');

      expect(result).toEqual([]);
      expect(prismaMock.product.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for null input', async () => {
      const result = await resolveWooCommerceIds(null as any, 'product');

      expect(result).toEqual([]);
    });
  });

  describe('findOrCreateShippingClass', () => {
    it('should find existing shipping class by slug', async () => {
      (prismaMock.shippingClass.findFirst as jest.Mock).mockResolvedValue({
        id: 'ship-1',
        slug: 'express-shipping',
        name: 'Express Shipping',
      });

      const result = await findOrCreateShippingClass('express-shipping');

      expect(result).toBe('ship-1');
      expect(prismaMock.shippingClass.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ slug: 'express-shipping' }],
        },
      });
    });

    it('should find existing shipping class by WooCommerce ID', async () => {
      (prismaMock.shippingClass.findFirst as jest.Mock).mockResolvedValue({
        id: 'ship-2',
        slug: 'standard-shipping',
        woocommerceId: 50,
      });

      const result = await findOrCreateShippingClass('standard-shipping', 50);

      expect(result).toBe('ship-2');
      expect(prismaMock.shippingClass.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ slug: 'standard-shipping' }, { woocommerceId: 50 }],
        },
      });
    });

    it('should create shipping class when not found', async () => {
      (prismaMock.shippingClass.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.shippingClass.create as jest.Mock).mockResolvedValue({
        id: 'ship-new',
        slug: 'new-class',
        name: 'New Class',
        woocommerceId: 100,
      });

      const result = await findOrCreateShippingClass('new-class', 100);

      expect(result).toBe('ship-new');
      expect(prismaMock.shippingClass.create).toHaveBeenCalledWith({
        data: {
          name: 'New Class',
          slug: 'new-class',
          woocommerceId: 100,
        },
      });
    });

    it('should return null for empty slug', async () => {
      const result = await findOrCreateShippingClass('');

      expect(result).toBeNull();
      expect(prismaMock.shippingClass.findFirst).not.toHaveBeenCalled();
    });

    it('should not create when no WooCommerce ID provided', async () => {
      (prismaMock.shippingClass.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await findOrCreateShippingClass('unknown-class');

      expect(result).toBeNull();
      expect(prismaMock.shippingClass.create).not.toHaveBeenCalled();
    });
  });
});
