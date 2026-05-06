import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';

/**
 * ProductVariant Service
 *
 * CRUD per le varianti di un prodotto. Una variante e' una combinazione
 * specifica di attributi (es. colore=rosso, taglia=M) con SKU proprio,
 * delta cost/prezzo e (eventualmente) inventario separato.
 *
 * Vincoli:
 * - SKU univoco a livello tenant (composite unique con il padre tramite il
 *   product.tenantId via Prisma middleware).
 * - barcode univoco se valorizzato.
 * - Solo i product di tipo `VARIABLE` possono avere varianti (warning soft).
 */

export interface CreateVariantInput {
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, string | number | boolean>; // {color:'red', size:'M'}
  barcode?: string;
  costDelta?: number;
  priceDelta?: number;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
  webPrice?: number;
  webDescription?: string;
  mainImageUrl?: string;
  isActive?: boolean;
}

export interface UpdateVariantInput {
  sku?: string;
  name?: string;
  attributes?: Record<string, string | number | boolean>;
  barcode?: string | null;
  costDelta?: number;
  priceDelta?: number;
  weight?: number | null;
  dimensions?: { width: number; height: number; depth: number } | null;
  webPrice?: number | null;
  webDescription?: string | null;
  mainImageUrl?: string | null;
  isActive?: boolean;
}

class ProductVariantService {
  /**
   * Lista varianti di un prodotto.
   */
  async listByProduct(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId },
      include: {
        inventory: true,
        images: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Recupera variante per id (e include inventory).
   */
  async getById(variantId: string) {
    return prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { id: true, sku: true, name: true, type: true } },
        inventory: true,
        images: { orderBy: { position: 'asc' } },
      },
    });
  }

  /**
   * Crea variante. SKU univoco per tenant.
   */
  async create(data: CreateVariantInput) {
    // Verifica esistenza prodotto padre + warning se non VARIABLE
    const parent = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, type: true, sku: true },
    });
    if (!parent) {
      throw new Error('Prodotto padre non trovato');
    }
    if (parent.type !== 'WITH_VARIANTS') {
      logger.warn(
        `Creazione variante su prodotto ${parent.sku} di tipo ${parent.type} (atteso WITH_VARIANTS)`
      );
    }

    // Verifica univocita SKU (Prisma middleware aggiunge tenantId)
    const skuExists = await prisma.productVariant.findFirst({
      where: { sku: data.sku },
    });
    if (skuExists) {
      throw new Error(`SKU variante ${data.sku} gia' esistente`);
    }

    if (data.barcode) {
      const barcodeExists = await prisma.productVariant.findFirst({
        where: { barcode: data.barcode },
      });
      if (barcodeExists) {
        throw new Error(`Barcode ${data.barcode} gia' esistente`);
      }
    }

    return prisma.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku,
        name: data.name,
        attributes: data.attributes as Prisma.InputJsonValue,
        barcode: data.barcode,
        costDelta: data.costDelta ?? 0,
        priceDelta: data.priceDelta ?? 0,
        weight: data.weight,
        dimensions: data.dimensions as Prisma.InputJsonValue | undefined,
        webPrice: data.webPrice,
        webDescription: data.webDescription,
        mainImageUrl: data.mainImageUrl,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Aggiorna variante.
   */
  async update(variantId: string, data: UpdateVariantInput) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new Error('Variante non trovata');
    }

    // Verifica unique SKU se cambiato
    if (data.sku && data.sku !== variant.sku) {
      const skuExists = await prisma.productVariant.findFirst({
        where: { sku: data.sku, id: { not: variantId } },
      });
      if (skuExists) {
        throw new Error(`SKU variante ${data.sku} gia' esistente`);
      }
    }

    if (data.barcode && data.barcode !== variant.barcode) {
      const barcodeExists = await prisma.productVariant.findFirst({
        where: { barcode: data.barcode, id: { not: variantId } },
      });
      if (barcodeExists) {
        throw new Error(`Barcode ${data.barcode} gia' esistente`);
      }
    }

    const updateData: Prisma.ProductVariantUpdateInput = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.attributes !== undefined) updateData.attributes = data.attributes as Prisma.InputJsonValue;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.costDelta !== undefined) updateData.costDelta = data.costDelta;
    if (data.priceDelta !== undefined) updateData.priceDelta = data.priceDelta;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.dimensions !== undefined) {
      updateData.dimensions = data.dimensions as Prisma.InputJsonValue | typeof Prisma.JsonNull;
    }
    if (data.webPrice !== undefined) updateData.webPrice = data.webPrice;
    if (data.webDescription !== undefined) updateData.webDescription = data.webDescription;
    if (data.mainImageUrl !== undefined) updateData.mainImageUrl = data.mainImageUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });
  }

  /**
   * Elimina variante. Blocca se ci sono OrderItem associati (FK protect).
   */
  async delete(variantId: string) {
    const orderItemCount = await prisma.orderItem.count({
      where: { variantId },
    });
    if (orderItemCount > 0) {
      throw new Error(
        `Impossibile eliminare la variante: ci sono ${orderItemCount} righe ordine collegate. Usa isActive=false per disattivarla.`
      );
    }

    return prisma.productVariant.delete({
      where: { id: variantId },
    });
  }

  /**
   * Calcola prezzo finale di una variante (parent.price + priceDelta o webPrice).
   */
  async getEffectivePrice(variantId: string): Promise<number> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { price: true } } },
    });
    if (!variant) throw new Error('Variante non trovata');

    if (variant.webPrice) {
      return Number(variant.webPrice);
    }
    return Number(variant.product.price) + Number(variant.priceDelta);
  }

  /**
   * Calcola costo finale di una variante (parent.cost + costDelta).
   */
  async getEffectiveCost(variantId: string): Promise<number> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { cost: true, weightedAvgCost: true } } },
    });
    if (!variant) throw new Error('Variante non trovata');

    const baseCost = Number(variant.product.weightedAvgCost) || Number(variant.product.cost) || 0;
    return baseCost + Number(variant.costDelta);
  }
}

export const productVariantService = new ProductVariantService();
export default productVariantService;
