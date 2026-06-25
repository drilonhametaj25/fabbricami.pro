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
  attributes?: Record<string, string | number | boolean>; // {color:'red', size:'M'}
  barcode?: string | null;
  costDelta?: number | null;
  priceDelta?: number | null;
  // Le misure sono SEMPRE opzionali: le varianti importate da WooCommerce
  // spesso non hanno peso/dimensioni e devono poter essere salvate comunque.
  weight?: number | null;
  dimensions?: { width?: number; height?: number; depth?: number } | null;
  webPrice?: number | null;
  webActive?: boolean | null;
  webDescription?: string | null;
  mainImageUrl?: string | null;
  isActive?: boolean;
}

export interface UpdateVariantInput {
  sku?: string;
  name?: string;
  attributes?: Record<string, string | number | boolean>;
  barcode?: string | null;
  costDelta?: number | null;
  priceDelta?: number | null;
  weight?: number | null;
  dimensions?: { width?: number; height?: number; depth?: number } | null;
  webPrice?: number | null;
  webActive?: boolean | null;
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
    // Auto-promozione del tipo: se aggiungo una variante a un prodotto non
    // ancora "con varianti", lo promuovo a WITH_VARIANTS. Senza questo il
    // prodotto resta SIMPLE e il sync verso WooCommerce lo esporta come
    // "simple" pur avendo varianti (bug "creo variabile → diventa semplice").
    if (parent.type !== 'WITH_VARIANTS') {
      await prisma.product.update({
        where: { id: parent.id },
        data: { type: 'WITH_VARIANTS' },
      });
      logger.info(
        `Prodotto ${parent.sku} promosso a WITH_VARIANTS (aggiunta prima variante)`
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
        attributes: (data.attributes ?? {}) as Prisma.InputJsonValue,
        barcode: data.barcode ?? undefined,
        costDelta: data.costDelta ?? 0,
        priceDelta: data.priceDelta ?? 0,
        weight: data.weight ?? undefined,
        dimensions: (data.dimensions ?? undefined) as Prisma.InputJsonValue | undefined,
        webPrice: data.webPrice ?? undefined,
        webActive: data.webActive ?? undefined,
        webDescription: data.webDescription ?? undefined,
        mainImageUrl: data.mainImageUrl ?? undefined,
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
    if (data.costDelta !== undefined && data.costDelta !== null) updateData.costDelta = data.costDelta;
    if (data.priceDelta !== undefined && data.priceDelta !== null) updateData.priceDelta = data.priceDelta;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.dimensions !== undefined) {
      updateData.dimensions = (data.dimensions ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
    }
    if (data.webPrice !== undefined) updateData.webPrice = data.webPrice;
    if (data.webActive !== undefined && data.webActive !== null) updateData.webActive = data.webActive;
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
   * Suggerimenti attributi per l'editor varianti: unisce gli attributi globali
   * importati da WooCommerce (WooCommerceAttribute + termini) con gli attributi
   * già usati nelle varianti esistenti del tenant. Permette di scegliere
   * "Colore → Rosso" dagli esistenti invece di riscriverli a mano ogni volta.
   */
  async getAttributeSuggestions(): Promise<Array<{ name: string; values: string[] }>> {
    const map = new Map<string, Set<string>>();
    const addValue = (rawName: string, rawValue?: unknown) => {
      const name = (rawName || '').trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, new Set());
      if (rawValue !== undefined && rawValue !== null) {
        const value = String(rawValue).trim();
        if (value) map.get(name)!.add(value);
      }
    };

    // 1) Attributi globali WooCommerce importati (con i loro termini)
    try {
      const wooAttrs = await prisma.wooCommerceAttribute.findMany({
        include: { terms: { orderBy: { menuOrder: 'asc' } } },
      });
      for (const attr of wooAttrs) {
        addValue(attr.name);
        for (const term of attr.terms) addValue(attr.name, term.name);
      }
    } catch {
      // Tabelle WooCommerce non disponibili: ignora, usa solo gli attributi locali.
    }

    // 2) Attributi già usati nelle varianti esistenti (JSON)
    const variants = await prisma.productVariant.findMany({
      select: { attributes: true },
      take: 2000,
    });
    for (const variant of variants) {
      const attrs = (variant.attributes || {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(attrs)) addValue(key, value);
    }

    return Array.from(map.entries())
      .map(([name, values]) => ({
        name,
        values: Array.from(values).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
