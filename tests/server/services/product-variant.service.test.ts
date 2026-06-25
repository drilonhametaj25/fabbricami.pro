import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));
jest.mock('@server/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { productVariantService } from '@server/services/product-variant.service';

describe('ProductVariantService.create', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  const baseInput = {
    productId: 'prod-1',
    sku: 'SKU-RED',
    name: 'Rosso',
    attributes: { Colore: 'Rosso' },
  };

  function mockNoConflicts() {
    (prismaMock.productVariant.findFirst as any).mockResolvedValue(null);
    (prismaMock.productVariant.create as any).mockResolvedValue({ id: 'var-1', ...baseInput });
    (prismaMock.product.update as any).mockResolvedValue({ id: 'prod-1', type: 'WITH_VARIANTS' });
  }

  it('promotes a SIMPLE parent product to WITH_VARIANTS when first variant is added', async () => {
    (prismaMock.product.findUnique as any).mockResolvedValue({
      id: 'prod-1',
      type: 'SIMPLE',
      sku: 'P-1',
    });
    mockNoConflicts();

    await productVariantService.create(baseInput as any);

    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: expect.objectContaining({ type: 'WITH_VARIANTS' }),
      })
    );
    expect(prismaMock.productVariant.create).toHaveBeenCalled();
  });

  it('does NOT re-promote a product already WITH_VARIANTS', async () => {
    (prismaMock.product.findUnique as any).mockResolvedValue({
      id: 'prod-1',
      type: 'WITH_VARIANTS',
      sku: 'P-1',
    });
    mockNoConflicts();

    await productVariantService.create(baseInput as any);

    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it('throws if parent product does not exist', async () => {
    (prismaMock.product.findUnique as any).mockResolvedValue(null);

    await expect(productVariantService.create(baseInput as any)).rejects.toThrow(
      /padre non trovato/i
    );
  });

  it('throws a clear error on duplicate SKU', async () => {
    (prismaMock.product.findUnique as any).mockResolvedValue({
      id: 'prod-1',
      type: 'WITH_VARIANTS',
      sku: 'P-1',
    });
    (prismaMock.productVariant.findFirst as any).mockResolvedValue({ id: 'existing' });

    await expect(productVariantService.create(baseInput as any)).rejects.toThrow(/SKU/);
  });

  it('builds attribute suggestions merging WooCommerce attributes and existing variant attributes', async () => {
    (prismaMock.wooCommerceAttribute.findMany as any).mockResolvedValue([
      { name: 'Colore', terms: [{ name: 'Rosso' }, { name: 'Blu' }] },
    ]);
    (prismaMock.productVariant.findMany as any).mockResolvedValue([
      { attributes: { Colore: 'Verde', Taglia: 'M' } },
      { attributes: { Taglia: 'L' } },
    ]);

    const result = await productVariantService.getAttributeSuggestions();
    const colore = result.find((a) => a.name === 'Colore');
    const taglia = result.find((a) => a.name === 'Taglia');

    expect(colore?.values).toEqual(expect.arrayContaining(['Rosso', 'Blu', 'Verde']));
    expect(taglia?.values).toEqual(expect.arrayContaining(['M', 'L']));
  });

  it('still returns local attribute suggestions when WooCommerce tables are unavailable', async () => {
    (prismaMock.wooCommerceAttribute.findMany as any).mockRejectedValue(new Error('no table'));
    (prismaMock.productVariant.findMany as any).mockResolvedValue([
      { attributes: { Materiale: 'Cotone' } },
    ]);

    const result = await productVariantService.getAttributeSuggestions();
    expect(result.find((a) => a.name === 'Materiale')?.values).toContain('Cotone');
  });

  it('accepts a variant without measurements (weight/dimensions optional)', async () => {
    (prismaMock.product.findUnique as any).mockResolvedValue({
      id: 'prod-1',
      type: 'WITH_VARIANTS',
      sku: 'P-1',
    });
    mockNoConflicts();

    await expect(
      productVariantService.create({ ...baseInput, weight: null, dimensions: null } as any)
    ).resolves.toBeDefined();
    expect(prismaMock.productVariant.create).toHaveBeenCalled();
  });
});
