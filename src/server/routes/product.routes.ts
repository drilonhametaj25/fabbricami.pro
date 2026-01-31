import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import productRepository from '../repositories/product.repository';
import manufacturingService from '../services/manufacturing.service';
import { parsePagination, paginatedResponse } from '../utils/response.util';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { prisma } from '../config/database';

const productRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET / - Get all products
   */
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    // Allow higher limit for dropdown lists (up to 1000)
    const pagination = parsePagination(request.query, 1000);
    const { search } = request.query as { search?: string };

    const where = search
      ? {
          OR: [
            { sku: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const { items, total } = await productRepository.findAll({
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      where,
      orderBy: { [pagination.sortBy || 'createdAt']: pagination.sortOrder },
    });

    return paginatedResponse(reply, items, total, pagination);
  });

  /**
   * GET /lookup/barcode/:code - Find product by barcode, SKU, or variant barcode
   * Used by barcode scanner for inventory movements
   */
  server.get('/lookup/barcode/:code', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.params as { code: string };

    if (!code || code.trim().length < 2) {
      return reply.status(400).send({
        success: false,
        error: 'Codice troppo corto (minimo 2 caratteri)',
      });
    }

    const searchCode = code.trim();

    // 1. Prima cerca per barcode esatto nel prodotto
    let product = await prisma.product.findFirst({
      where: { barcode: searchCode },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        cost: true,
        price: true,
        mainImageUrl: true,
        unit: true,
        minStockLevel: true,
      },
    });

    if (product) {
      return reply.send({
        success: true,
        data: {
          product,
          variant: null,
          matchedBy: 'barcode' as const,
        },
      });
    }

    // 2. Cerca per SKU esatto nel prodotto
    product = await prisma.product.findFirst({
      where: { sku: searchCode },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        cost: true,
        price: true,
        mainImageUrl: true,
        unit: true,
        minStockLevel: true,
      },
    });

    if (product) {
      return reply.send({
        success: true,
        data: {
          product,
          variant: null,
          matchedBy: 'sku' as const,
        },
      });
    }

    // 3. Cerca per barcode nelle varianti
    const variant = await prisma.productVariant.findFirst({
      where: { barcode: searchCode },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            barcode: true,
            cost: true,
            price: true,
            mainImageUrl: true,
            unit: true,
            minStockLevel: true,
          },
        },
      },
    });

    if (variant) {
      return reply.send({
        success: true,
        data: {
          product: variant.product,
          variant: {
            id: variant.id,
            sku: variant.sku,
            name: variant.name,
            barcode: variant.barcode,
            attributes: variant.attributes,
            mainImageUrl: variant.mainImageUrl,
          },
          matchedBy: 'variant_barcode' as const,
        },
      });
    }

    // 4. Non trovato
    return reply.status(404).send({
      success: false,
      error: `Prodotto non trovato per codice: ${searchCode}`,
    });
  });

  /**
   * GET /:id - Get product by ID
   */
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await productRepository.findById(id);

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: 'Product not found',
      });
    }

    return reply.send({
      success: true,
      data: product,
    });
  });

  /**
   * POST / - Create product
   */
  server.post(
    '/',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      try {
        // Valida i dati in ingresso
        const validatedData = createProductSchema.parse(request.body);
        
        // Prepara i dati per Prisma (gestisce JSON field per dimensions)
        const createData: any = {
          ...validatedData,
          dimensions: validatedData.dimensions || undefined, // Rimuove null se presente
        };
        
        const product = await productRepository.create(createData);

        return reply.status(201).send({
          success: true,
          data: product,
        });
      } catch (error: any) {
        // Se errore di validazione Zod
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  /**
   * PATCH /:id - Update product
   */
  server.patch(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Valida i dati in ingresso
        const validatedData = updateProductSchema.parse(request.body);

        // Campi da escludere (relazioni e campi non aggiornabili direttamente)
        const excludeFields = [
          'id', 'createdAt', 'updatedAt', 'variants', 'inventory',
          'supplier', 'productImages', 'categories', 'images',
          'minStock', 'maxStock', 'reorderPoint' // Alias non nel DB
        ];

        // Prepara i dati per Prisma filtrando i campi non validi
        const updateData: any = {};
        for (const [key, value] of Object.entries(validatedData)) {
          if (excludeFields.includes(key)) continue;
          if (value === undefined) continue;

          // Gestione speciale per dimensions
          if (key === 'dimensions') {
            updateData[key] = value || undefined;
          } else {
            updateData[key] = value;
          }
        }

        const product = await productRepository.update(id, updateData);

        return reply.send({
          success: true,
          data: product,
        });
      } catch (error: any) {
        // Se errore di validazione Zod
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /:id - Delete product
   */
  server.delete(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await productRepository.delete(id);

      return reply.send({
        success: true,
        data: { message: 'Product deleted' },
      });
    }
  );

  /**
   * GET /low-stock - Get products with low stock
   */
  server.get(
    '/low-stock',
    { preHandler: authenticate },
    async (_request, reply) => {
      const products = await productRepository.getLowStockProducts();

      return reply.send({
        success: true,
        data: products,
      });
    }
  );

  /**
   * GET /:id/cost - Calculate product cost
   */
  server.get(
    '/:id/cost',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const cost = await productRepository.calculateProductCost(id);

      return reply.send({
        success: true,
        data: { cost },
      });
    }
  );

  /**
   * GET /:id/cost-summary - Get product cost summary with BOM explosion
   * Solo ADMIN, MANAGER, CONTABILE possono vedere i costi
   */
  server.get(
    '/:id/cost-summary',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      try {
        const costSummary = await manufacturingService.getProductCostSummary(id);

        return reply.send({
          success: true,
          data: costSummary,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore nel calcolo costi',
        });
      }
    }
  );

  /**
   * GET /:id/cost-detailed - Get detailed product cost breakdown
   * Solo ADMIN, MANAGER, CONTABILE possono vedere i costi
   */
  server.get(
    '/:id/cost-detailed',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { quantity } = request.query as { quantity?: string };

      try {
        const costBreakdown = await manufacturingService.calculateProductCostDetailed(
          id,
          quantity ? Number(quantity) : 1
        );

        return reply.send({
          success: true,
          data: costBreakdown,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore nel calcolo costi dettagliato',
        });
      }
    }
  );

  // ==========================================
  // PRODUCT MATERIALS (Composizione prodotto)
  // ==========================================

  /**
   * GET /:id/materials - Get product materials (composition)
   */
  server.get(
    '/:id/materials',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const materials = await prisma.productMaterial.findMany({
        where: { productId: id },
        include: {
          material: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              cost: true,
              category: true,
            },
          },
        },
        orderBy: [
          { displayOrder: 'asc' },
          { isMainIngredient: 'desc' },
        ],
      });

      return reply.send({
        success: true,
        data: materials,
      });
    }
  );

  /**
   * POST /:id/materials - Add material to product
   */
  server.post(
    '/:id/materials',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        materialId: string;
        quantity: number;
        unit?: string;
        percentage?: number;
        isMainIngredient?: boolean;
        displayOrder?: number;
        origin?: string;
        certifications?: string[];
        allergens?: string[];
        notes?: string;
      };

      // Verifica che il prodotto esista
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Prodotto non trovato',
        });
      }

      // Verifica che il materiale esista
      const material = await prisma.material.findUnique({ where: { id: body.materialId } });
      if (!material) {
        return reply.status(404).send({
          success: false,
          error: 'Materiale non trovato',
        });
      }

      // Cerca se esiste già il legame
      const existing = await prisma.productMaterial.findFirst({
        where: {
          productId: id,
          variantId: null,
          materialId: body.materialId,
        },
      });

      // Crea o aggiorna il legame
      const productMaterial = existing
        ? await prisma.productMaterial.update({
            where: { id: existing.id },
            data: {
              quantity: body.quantity,
              unit: body.unit || material.unit,
              percentage: body.percentage,
              isMainIngredient: body.isMainIngredient,
              displayOrder: body.displayOrder,
              origin: body.origin,
              certifications: body.certifications,
              allergens: body.allergens,
              notes: body.notes,
            },
            include: {
              material: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                  cost: true,
                },
              },
            },
          })
        : await prisma.productMaterial.create({
            data: {
              productId: id,
              materialId: body.materialId,
              quantity: body.quantity,
              unit: body.unit || material.unit,
              percentage: body.percentage,
              isMainIngredient: body.isMainIngredient || false,
              displayOrder: body.displayOrder || 0,
              origin: body.origin,
              certifications: body.certifications || [],
              allergens: body.allergens || [],
              notes: body.notes,
            },
            include: {
              material: {
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

      return reply.status(201).send({
        success: true,
        data: productMaterial,
      });
    }
  );

  /**
   * PUT /:id/materials/:materialId - Update product material
   */
  server.put(
    '/:id/materials/:materialId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, materialId } = request.params as { id: string; materialId: string };
      const body = request.body as {
        quantity?: number;
        unit?: string;
        percentage?: number;
        isMainIngredient?: boolean;
        displayOrder?: number;
        origin?: string;
        certifications?: string[];
        allergens?: string[];
        notes?: string;
      };

      // Cerca il legame esistente
      const existing = await prisma.productMaterial.findFirst({
        where: {
          productId: id,
          variantId: null,
          materialId: materialId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Legame prodotto-materiale non trovato',
        });
      }

      const productMaterial = await prisma.productMaterial.update({
        where: { id: existing.id },
        data: {
          quantity: body.quantity,
          unit: body.unit,
          percentage: body.percentage,
          isMainIngredient: body.isMainIngredient,
          displayOrder: body.displayOrder,
          origin: body.origin,
          certifications: body.certifications,
          allergens: body.allergens,
          notes: body.notes,
        },
        include: {
          material: {
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

      return reply.send({
        success: true,
        data: productMaterial,
      });
    }
  );

  /**
   * DELETE /:id/materials/:materialId - Remove material from product
   */
  server.delete(
    '/:id/materials/:materialId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, materialId } = request.params as { id: string; materialId: string };

      // Cerca il legame esistente
      const existing = await prisma.productMaterial.findFirst({
        where: {
          productId: id,
          variantId: null,
          materialId: materialId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Legame prodotto-materiale non trovato',
        });
      }

      await prisma.productMaterial.delete({
        where: { id: existing.id },
      });

      return reply.send({
        success: true,
        data: { message: 'Materiale rimosso dal prodotto' },
      });
    }
  );

  /**
   * PUT /:id/materials/reorder - Reorder materials
   */
  server.put(
    '/:id/materials/reorder',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { materialIds: string[] };

      // Trova tutti i legami esistenti per questo prodotto (senza variante)
      const existingMaterials = await prisma.productMaterial.findMany({
        where: {
          productId: id,
          variantId: null,
          materialId: { in: body.materialIds },
        },
      });

      // Crea un map materialId -> id
      const materialIdToId = new Map(
        existingMaterials.map(m => [m.materialId, m.id])
      );

      // Aggiorna l'ordine di tutti i materiali
      const updates = body.materialIds
        .map((materialId, index) => {
          const recordId = materialIdToId.get(materialId);
          if (!recordId) return null;
          return prisma.productMaterial.update({
            where: { id: recordId },
            data: { displayOrder: index },
          });
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      await prisma.$transaction(updates);

      return reply.send({
        success: true,
        data: { message: 'Ordine aggiornato' },
      });
    }
  );

  // ==========================================
  // MANUFACTURING PHASES (Fasi di lavorazione)
  // ==========================================

  /**
   * GET /:id/phases - Get product manufacturing phases
   */
  server.get(
    '/:id/phases',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const phases = await prisma.manufacturingPhase.findMany({
        where: { productId: id },
        include: {
          operationType: {
            select: {
              id: true,
              code: true,
              name: true,
              isExternal: true,
            },
          },
          externalSupplier: {
            select: {
              id: true,
              code: true,
              businessName: true,
            },
          },
          materials: {
            include: {
              material: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
        orderBy: { sequence: 'asc' },
      });

      return reply.send({
        success: true,
        data: phases,
      });
    }
  );

  /**
   * POST /:id/phases - Add manufacturing phase
   */
  server.post(
    '/:id/phases',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        operationTypeId: string;
        name: string;
        description?: string | null;
        standardTime: number;
        setupTime?: number | null;
        externalCostPerUnit?: number | null;
        supplierId?: string | null;
      };

      // Validazione base
      if (!body.operationTypeId || !body.name || body.standardTime === undefined) {
        return reply.status(400).send({
          success: false,
          error: 'Campi obbligatori mancanti: operationTypeId, name, standardTime',
        });
      }

      // Verifica che il prodotto esista
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Prodotto non trovato',
        });
      }

      // Verifica che il tipo operazione esista
      const operationType = await prisma.operationType.findUnique({
        where: { id: body.operationTypeId }
      });
      if (!operationType) {
        return reply.status(404).send({
          success: false,
          error: 'Tipo operazione non trovato',
        });
      }

      // Trova la sequenza successiva
      const lastPhase = await prisma.manufacturingPhase.findFirst({
        where: { productId: id },
        orderBy: { sequence: 'desc' },
      });
      const nextSequence = (lastPhase?.sequence || 0) + 1;

      // Filtra i valori null per Prisma (null -> undefined)
      const phase = await prisma.manufacturingPhase.create({
        data: {
          productId: id,
          operationTypeId: body.operationTypeId,
          name: body.name,
          description: body.description || undefined,
          standardTime: body.standardTime,
          setupTime: body.setupTime ?? 0,
          externalCostPerUnit: body.externalCostPerUnit ?? undefined,
          supplierId: body.supplierId || undefined,
          sequence: nextSequence,
        },
        include: {
          operationType: {
            select: {
              id: true,
              code: true,
              name: true,
              isExternal: true,
            },
          },
          externalSupplier: {
            select: {
              id: true,
              code: true,
              businessName: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: phase,
      });
    }
  );

  /**
   * PUT /:id/phases/:phaseId - Update manufacturing phase
   */
  server.put(
    '/:id/phases/:phaseId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id: _id, phaseId } = request.params as { id: string; phaseId: string };
      const body = request.body as {
        operationTypeId?: string | null;
        name?: string | null;
        description?: string | null;
        standardTime?: number | null;
        setupTime?: number | null;
        externalCostPerUnit?: number | null;
        supplierId?: string | null;
        isActive?: boolean | null;
      };

      // Verifica che la fase esista
      const existingPhase = await prisma.manufacturingPhase.findUnique({
        where: { id: phaseId }
      });
      if (!existingPhase) {
        return reply.status(404).send({
          success: false,
          error: 'Fase non trovata',
        });
      }

      // Costruisci oggetto update filtrando null/undefined
      const updateData: any = {};
      if (body.operationTypeId !== undefined && body.operationTypeId !== null) {
        updateData.operationTypeId = body.operationTypeId;
      }
      if (body.name !== undefined && body.name !== null) {
        updateData.name = body.name;
      }
      if (body.description !== undefined) {
        updateData.description = body.description || null; // Permetti di settare a null
      }
      if (body.standardTime !== undefined && body.standardTime !== null) {
        updateData.standardTime = body.standardTime;
      }
      if (body.setupTime !== undefined) {
        updateData.setupTime = body.setupTime ?? 0;
      }
      if (body.externalCostPerUnit !== undefined) {
        updateData.externalCostPerUnit = body.externalCostPerUnit || null;
      }
      if (body.supplierId !== undefined) {
        updateData.supplierId = body.supplierId || null;
      }
      if (body.isActive !== undefined && body.isActive !== null) {
        updateData.isActive = body.isActive;
      }

      const phase = await prisma.manufacturingPhase.update({
        where: { id: phaseId },
        data: updateData,
        include: {
          operationType: {
            select: {
              id: true,
              code: true,
              name: true,
              isExternal: true,
            },
          },
          externalSupplier: {
            select: {
              id: true,
              code: true,
              businessName: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: phase,
      });
    }
  );

  /**
   * DELETE /:id/phases/:phaseId - Delete manufacturing phase
   */
  server.delete(
    '/:id/phases/:phaseId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, phaseId } = request.params as { id: string; phaseId: string };

      await prisma.manufacturingPhase.delete({
        where: { id: phaseId },
      });

      // Riordina le sequenze
      const remainingPhases = await prisma.manufacturingPhase.findMany({
        where: { productId: id },
        orderBy: { sequence: 'asc' },
      });

      const updates = remainingPhases.map((phase, index) =>
        prisma.manufacturingPhase.update({
          where: { id: phase.id },
          data: { sequence: index + 1 },
        })
      );

      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }

      return reply.send({
        success: true,
        data: { message: 'Fase eliminata' },
      });
    }
  );

  /**
   * PUT /:id/phases/reorder - Reorder phases
   */
  server.put(
    '/:id/phases/reorder',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id: _id } = request.params as { id: string };
      const body = request.body as { phaseIds: string[] };

      const updates = body.phaseIds.map((phaseId, index) =>
        prisma.manufacturingPhase.update({
          where: { id: phaseId },
          data: { sequence: index + 1 },
        })
      );

      await prisma.$transaction(updates);

      return reply.send({
        success: true,
        data: { message: 'Ordine fasi aggiornato' },
      });
    }
  );

  // ==========================================
  // PRODUCT IMAGES
  // ==========================================

  /**
   * GET /:id/images - Get product images
   */
  server.get(
    '/:id/images',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const images = await prisma.productImage.findMany({
        where: { productId: id, variantId: null },
        orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
      });

      return reply.send({
        success: true,
        data: images,
      });
    }
  );

  /**
   * POST /:id/images - Add image to product (URL)
   */
  server.post(
    '/:id/images',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        src: string;
        alt?: string;
        name?: string;
        isMain?: boolean;
      };

      // Se è l'immagine principale, rimuovi il flag dalle altre
      if (body.isMain) {
        await prisma.productImage.updateMany({
          where: { productId: id, variantId: null },
          data: { isMain: false },
        });
      }

      // Trova la prossima posizione
      const lastImage = await prisma.productImage.findFirst({
        where: { productId: id, variantId: null },
        orderBy: { position: 'desc' },
      });
      const nextPosition = (lastImage?.position || 0) + 1;

      // Se non ci sono immagini, questa sarà la principale
      const imageCount = await prisma.productImage.count({
        where: { productId: id, variantId: null },
      });

      const image = await prisma.productImage.create({
        data: {
          productId: id,
          src: body.src,
          alt: body.alt,
          name: body.name,
          position: nextPosition,
          isMain: body.isMain ?? (imageCount === 0),
        },
      });

      // Aggiorna anche mainImageUrl del prodotto se è l'immagine principale
      if (image.isMain) {
        await prisma.product.update({
          where: { id },
          data: { mainImageUrl: body.src },
        });
      }

      return reply.status(201).send({
        success: true,
        data: image,
      });
    }
  );

  /**
   * POST /:id/images/upload - Upload image file
   */
  server.post(
    '/:id/images/upload',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        // Verifica che il prodotto esista
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) {
          return reply.status(404).send({
            success: false,
            error: 'Prodotto non trovato',
          });
        }

        // Ottieni il file multipart
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({
            success: false,
            error: 'Nessun file caricato',
          });
        }

        // Verifica tipo file
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            success: false,
            error: 'Tipo file non supportato. Usa JPEG, PNG, GIF o WebP.',
          });
        }

        // Genera nome file unico
        const path = await import('path');
        const fs = await import('fs/promises');
        const crypto = await import('crypto');

        const ext = path.extname(data.filename) || '.jpg';
        const uniqueName = `${product.sku.replace(/[^a-zA-Z0-9]/g, '-')}-${crypto.randomBytes(8).toString('hex')}${ext}`;

        // Crea directory uploads/products se non esiste
        const uploadDir = path.join(process.cwd(), 'uploads', 'products');
        await fs.mkdir(uploadDir, { recursive: true });

        // Salva file
        const filePath = path.join(uploadDir, uniqueName);
        const buffer = await data.toBuffer();
        await fs.writeFile(filePath, buffer);

        // URL relativo per accesso
        const fileUrl = `/uploads/products/${uniqueName}`;

        // Trova la prossima posizione
        const lastImage = await prisma.productImage.findFirst({
          where: { productId: id, variantId: null },
          orderBy: { position: 'desc' },
        });
        const nextPosition = (lastImage?.position || 0) + 1;

        // Conta immagini esistenti
        const imageCount = await prisma.productImage.count({
          where: { productId: id, variantId: null },
        });

        // Crea record immagine
        const image = await prisma.productImage.create({
          data: {
            productId: id,
            src: fileUrl,
            alt: data.filename.replace(ext, ''),
            name: data.filename,
            position: nextPosition,
            isMain: imageCount === 0, // Prima immagine = principale
          },
        });

        // Aggiorna mainImageUrl se è la principale
        if (image.isMain) {
          await prisma.product.update({
            where: { id },
            data: { mainImageUrl: fileUrl },
          });
        }

        return reply.status(201).send({
          success: true,
          data: image,
        });

      } catch (error: any) {
        console.error('Errore upload immagine:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Errore durante upload',
        });
      }
    }
  );

  /**
   * PUT /:id/images/:imageId - Update image
   */
  server.put(
    '/:id/images/:imageId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, imageId } = request.params as { id: string; imageId: string };
      const body = request.body as {
        src?: string;
        alt?: string;
        name?: string;
        isMain?: boolean;
      };

      // Se diventa l'immagine principale, rimuovi il flag dalle altre
      if (body.isMain) {
        await prisma.productImage.updateMany({
          where: { productId: id, variantId: null, id: { not: imageId } },
          data: { isMain: false },
        });
      }

      const image = await prisma.productImage.update({
        where: { id: imageId },
        data: {
          src: body.src,
          alt: body.alt,
          name: body.name,
          isMain: body.isMain,
        },
      });

      // Aggiorna mainImageUrl del prodotto se è l'immagine principale
      if (image.isMain && body.src) {
        await prisma.product.update({
          where: { id },
          data: { mainImageUrl: body.src },
        });
      }

      return reply.send({
        success: true,
        data: image,
      });
    }
  );

  /**
   * PUT /:id/images/:imageId/main - Set image as main
   */
  server.put(
    '/:id/images/:imageId/main',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, imageId } = request.params as { id: string; imageId: string };

      // Rimuovi il flag main da tutte le immagini del prodotto
      await prisma.productImage.updateMany({
        where: { productId: id, variantId: null },
        data: { isMain: false },
      });

      // Imposta questa come principale
      const image = await prisma.productImage.update({
        where: { id: imageId },
        data: { isMain: true, position: 0 },
      });

      // Aggiorna mainImageUrl del prodotto
      await prisma.product.update({
        where: { id },
        data: { mainImageUrl: image.src },
      });

      return reply.send({
        success: true,
        data: image,
      });
    }
  );

  /**
   * PUT /:id/images/reorder - Reorder images
   */
  server.put(
    '/:id/images/reorder',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { imageIds: string[] };

      const updates = body.imageIds.map((imageId, index) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: {
            position: index,
            // La prima immagine diventa la principale
            isMain: index === 0,
          },
        })
      );

      await prisma.$transaction(updates);

      // Aggiorna mainImageUrl con la prima immagine
      if (body.imageIds.length > 0) {
        const mainImage = await prisma.productImage.findUnique({
          where: { id: body.imageIds[0] },
        });
        if (mainImage) {
          await prisma.product.update({
            where: { id },
            data: { mainImageUrl: mainImage.src },
          });
        }
      }

      return reply.send({
        success: true,
        data: { message: 'Ordine immagini aggiornato' },
      });
    }
  );

  /**
   * DELETE /:id/images/:imageId - Delete image
   */
  server.delete(
    '/:id/images/:imageId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, imageId } = request.params as { id: string; imageId: string };

      const image = await prisma.productImage.findUnique({
        where: { id: imageId },
      });

      await prisma.productImage.delete({
        where: { id: imageId },
      });

      // Se era l'immagine principale, imposta la prossima come principale
      if (image?.isMain) {
        const nextImage = await prisma.productImage.findFirst({
          where: { productId: id, variantId: null },
          orderBy: { position: 'asc' },
        });

        if (nextImage) {
          await prisma.productImage.update({
            where: { id: nextImage.id },
            data: { isMain: true },
          });
          await prisma.product.update({
            where: { id },
            data: { mainImageUrl: nextImage.src },
          });
        } else {
          await prisma.product.update({
            where: { id },
            data: { mainImageUrl: null },
          });
        }
      }

      return reply.send({
        success: true,
        data: { message: 'Immagine eliminata' },
      });
    }
  );

  // ==========================================
  // PRODUCT INVENTORY
  // ==========================================

  /**
   * GET /:id/inventory - Get product inventory by location
   */
  server.get(
    '/:id/inventory',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const inventory = await prisma.inventoryItem.findMany({
        where: { productId: id, variantId: null },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { location: 'asc' },
      });

      return reply.send({
        success: true,
        data: inventory,
      });
    }
  );

  /**
   * PUT /:id/inventory - Update product inventory (bulk)
   */
  server.put(
    '/:id/inventory',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        items: Array<{
          location: 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO';
          quantity: number;
          reservedQuantity?: number;
        }>;
        warehouseId?: string;
      };

      // Trova o crea il warehouse di default
      let warehouseId = body.warehouseId;
      if (!warehouseId) {
        let warehouse = await prisma.warehouse.findFirst({
          where: { isPrimary: true },
        });
        if (!warehouse) {
          warehouse = await prisma.warehouse.findFirst();
        }
        if (!warehouse) {
          warehouse = await prisma.warehouse.create({
            data: {
              code: 'MAIN',
              name: 'Magazzino Principale',
              isPrimary: true,
            },
          });
        }
        warehouseId = warehouse.id;
      }

      const results = [];

      for (const item of body.items) {
        // Find existing inventory item (handle null values in composite key properly)
        const existing = await prisma.inventoryItem.findFirst({
          where: {
            warehouseId,
            productId: id,
            variantId: null,
            location: item.location,
            lotNumber: null,
          },
        });

        let inventoryItem;
        if (existing) {
          // Update existing record
          inventoryItem = await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantity: item.quantity,
              reservedQuantity: item.reservedQuantity ?? 0,
            },
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          });
        } else {
          // Create new record
          inventoryItem = await prisma.inventoryItem.create({
            data: {
              warehouseId,
              productId: id,
              location: item.location,
              quantity: item.quantity,
              reservedQuantity: item.reservedQuantity || 0,
            },
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          });
        }
        results.push(inventoryItem);
      }

      // Aggiorna wcStockStatus del prodotto
      const totalQty = results.reduce((sum, inv) => sum + inv.quantity - inv.reservedQuantity, 0);
      await prisma.product.update({
        where: { id },
        data: {
          wcStockStatus: totalQty > 0 ? 'instock' : 'outofstock',
        },
      });

      return reply.send({
        success: true,
        data: results,
      });
    }
  );

  // ==========================================
  // PRODUCT VARIANTS
  // ==========================================

  /**
   * GET /:id/variants - Get product variants
   */
  server.get(
    '/:id/variants',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const variants = await prisma.productVariant.findMany({
        where: { productId: id },
        include: {
          inventory: {
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          images: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: variants,
      });
    }
  );

  /**
   * POST /:id/variants - Create variant
   */
  server.post(
    '/:id/variants',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        sku: string;
        name: string;
        attributes: Record<string, string>; // {color: "red", size: "M"}
        barcode?: string;
        costDelta?: number;
        priceDelta?: number;
        weight?: number;
        dimensions?: { width?: number; height?: number; depth?: number };
        webPrice?: number;
        webActive?: boolean;
        mainImageUrl?: string;
        webDescription?: string;
      };

      // Verifica che il prodotto esista ed sia di tipo WITH_VARIANTS
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Prodotto non trovato',
        });
      }

      // Aggiorna il tipo prodotto se necessario
      if (product.type !== 'WITH_VARIANTS') {
        await prisma.product.update({
          where: { id },
          data: { type: 'WITH_VARIANTS' },
        });
      }

      const variant = await prisma.productVariant.create({
        data: {
          productId: id,
          sku: body.sku,
          name: body.name,
          attributes: body.attributes,
          barcode: body.barcode,
          costDelta: body.costDelta || 0,
          priceDelta: body.priceDelta || 0,
          weight: body.weight,
          dimensions: body.dimensions,
          webPrice: body.webPrice,
          webActive: body.webActive ?? true,
          mainImageUrl: body.mainImageUrl,
          webDescription: body.webDescription,
        },
        include: {
          inventory: true,
          images: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: variant,
      });
    }
  );

  /**
   * PUT /:id/variants/:variantId - Update variant
   */
  server.put(
    '/:id/variants/:variantId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id: _id, variantId } = request.params as { id: string; variantId: string };
      const body = request.body as {
        sku?: string;
        name?: string;
        attributes?: Record<string, string>;
        barcode?: string;
        costDelta?: number;
        priceDelta?: number;
        weight?: number;
        dimensions?: { width?: number; height?: number; depth?: number };
        webPrice?: number;
        webActive?: boolean;
        mainImageUrl?: string;
        webDescription?: string;
        isActive?: boolean;
      };

      const variant = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          sku: body.sku,
          name: body.name,
          attributes: body.attributes,
          barcode: body.barcode,
          costDelta: body.costDelta,
          priceDelta: body.priceDelta,
          weight: body.weight,
          dimensions: body.dimensions,
          webPrice: body.webPrice,
          webActive: body.webActive,
          mainImageUrl: body.mainImageUrl,
          webDescription: body.webDescription,
          isActive: body.isActive,
        },
        include: {
          inventory: {
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          images: true,
        },
      });

      return reply.send({
        success: true,
        data: variant,
      });
    }
  );

  /**
   * DELETE /:id/variants/:variantId - Delete variant
   */
  server.delete(
    '/:id/variants/:variantId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, variantId } = request.params as { id: string; variantId: string };

      await prisma.productVariant.delete({
        where: { id: variantId },
      });

      // Se non ci sono più varianti, torna a prodotto semplice
      const remainingVariants = await prisma.productVariant.count({
        where: { productId: id },
      });

      if (remainingVariants === 0) {
        await prisma.product.update({
          where: { id },
          data: { type: 'SIMPLE' },
        });
      }

      return reply.send({
        success: true,
        data: { message: 'Variante eliminata' },
      });
    }
  );

  /**
   * PUT /:id/variants/:variantId/inventory - Update variant inventory
   */
  server.put(
    '/:id/variants/:variantId/inventory',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request, reply) => {
      const { id, variantId } = request.params as { id: string; variantId: string };
      const body = request.body as {
        items: Array<{
          location: 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO';
          quantity: number;
          reservedQuantity?: number;
        }>;
        warehouseId?: string;
      };

      // Trova o crea il warehouse di default
      let warehouseId = body.warehouseId;
      if (!warehouseId) {
        let warehouse = await prisma.warehouse.findFirst({
          where: { isPrimary: true },
        });
        if (!warehouse) {
          warehouse = await prisma.warehouse.findFirst();
        }
        if (!warehouse) {
          warehouse = await prisma.warehouse.create({
            data: {
              code: 'MAIN',
              name: 'Magazzino Principale',
              isPrimary: true,
            },
          });
        }
        warehouseId = warehouse.id;
      }

      const results = [];

      for (const item of body.items) {
        // Find existing inventory item (handle null values in composite key properly)
        const existing = await prisma.inventoryItem.findFirst({
          where: {
            warehouseId,
            productId: id,
            variantId: variantId,
            location: item.location,
            lotNumber: null,
          },
        });

        let inventoryItem;
        if (existing) {
          // Update existing record
          inventoryItem = await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantity: item.quantity,
              reservedQuantity: item.reservedQuantity ?? 0,
            },
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          });
        } else {
          // Create new record
          inventoryItem = await prisma.inventoryItem.create({
            data: {
              warehouseId,
              productId: id,
              variantId: variantId,
              location: item.location,
              quantity: item.quantity,
              reservedQuantity: item.reservedQuantity || 0,
            },
            include: {
              warehouse: {
                select: { id: true, code: true, name: true },
              },
            },
          });
        }
        results.push(inventoryItem);
      }

      return reply.send({
        success: true,
        data: results,
      });
    }
  );

  /**
   * POST /:id/variants/:variantId/images - Add image to variant
   */
  server.post(
    '/:id/variants/:variantId/images',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, variantId } = request.params as { id: string; variantId: string };
      const body = request.body as {
        src: string;
        alt?: string;
        name?: string;
      };

      // Trova la prossima posizione
      const lastImage = await prisma.productImage.findFirst({
        where: { productId: id, variantId: variantId },
        orderBy: { position: 'desc' },
      });
      const nextPosition = (lastImage?.position || 0) + 1;

      const image = await prisma.productImage.create({
        data: {
          productId: id,
          variantId: variantId,
          src: body.src,
          alt: body.alt,
          name: body.name,
          position: nextPosition,
          isMain: nextPosition === 1,
        },
      });

      // Aggiorna mainImageUrl della variante se è la prima
      if (image.isMain) {
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { mainImageUrl: body.src },
        });
      }

      return reply.status(201).send({
        success: true,
        data: image,
      });
    }
  );

  // ==========================================
  // PRODUCT CATEGORIES ASSIGNMENT
  // ==========================================

  /**
   * GET /:id/categories - Get assigned categories
   */
  server.get(
    '/:id/categories',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const categories = await prisma.productCategoryAssignment.findMany({
        where: { productId: id },
        include: {
          category: true,
        },
        orderBy: [{ isPrimary: 'desc' }, { category: { name: 'asc' } }],
      });

      return reply.send({
        success: true,
        data: categories,
      });
    }
  );

  /**
   * PUT /:id/categories - Update assigned categories
   */
  server.put(
    '/:id/categories',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        categoryIds: string[];
        primaryCategoryId?: string;
      };

      // Elimina tutte le assegnazioni esistenti
      await prisma.productCategoryAssignment.deleteMany({
        where: { productId: id },
      });

      // Crea le nuove assegnazioni
      const assignments = await Promise.all(
        body.categoryIds.map((categoryId) =>
          prisma.productCategoryAssignment.create({
            data: {
              productId: id,
              categoryId: categoryId,
              isPrimary: categoryId === body.primaryCategoryId,
            },
            include: {
              category: true,
            },
          })
        )
      );

      // Aggiorna il campo category del prodotto con la categoria principale
      if (body.primaryCategoryId) {
        const primaryCategory = await prisma.productCategory.findUnique({
          where: { id: body.primaryCategoryId },
        });
        if (primaryCategory) {
          await prisma.product.update({
            where: { id },
            data: { category: primaryCategory.name },
          });
        }
      }

      return reply.send({
        success: true,
        data: assignments,
      });
    }
  );

  // ==========================================
  // PRODUCT BOM (Bill of Materials)
  // ==========================================

  /**
   * GET /:id/bom - Get product BOM items
   */
  server.get(
    '/:id/bom',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const bomItems = await prisma.bomItem.findMany({
        where: { parentProductId: id },
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

      return reply.send({
        success: true,
        data: bomItems,
      });
    }
  );

  /**
   * POST /:id/bom - Add component to BOM
   */
  server.post(
    '/:id/bom',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        componentProductId: string;
        quantity: number;
        unit?: string;
        scrapPercentage?: number;
        notes?: string;
      };

      // Validazione: non può essere componente di se stesso
      if (id === body.componentProductId) {
        return reply.status(400).send({
          success: false,
          error: 'Un prodotto non può essere componente di se stesso',
        });
      }

      // Validazione cicli: verifica che non crei cicli nel BOM
      const checkCycle = async (
        currentId: string,
        targetId: string,
        visited: Set<string>
      ): Promise<boolean> => {
        if (visited.has(currentId)) return true;
        visited.add(currentId);

        const subComponents = await prisma.bomItem.findMany({
          where: { parentProductId: currentId },
          select: { componentProductId: true },
        });

        for (const sub of subComponents) {
          if (sub.componentProductId === targetId) return false;
          const isValid = await checkCycle(sub.componentProductId, targetId, visited);
          if (!isValid) return false;
        }
        return true;
      };

      const isValid = await checkCycle(body.componentProductId, id, new Set());
      if (!isValid) {
        return reply.status(400).send({
          success: false,
          error: 'Impossibile aggiungere: creerebbe un ciclo nel BOM',
        });
      }

      const bomItem = await prisma.bomItem.upsert({
        where: {
          parentProductId_componentProductId: {
            parentProductId: id,
            componentProductId: body.componentProductId,
          },
        },
        create: {
          parentProductId: id,
          componentProductId: body.componentProductId,
          quantity: body.quantity,
          unit: body.unit || 'pz',
          scrapPercentage: body.scrapPercentage || 0,
          notes: body.notes,
        },
        update: {
          quantity: body.quantity,
          unit: body.unit,
          scrapPercentage: body.scrapPercentage,
          notes: body.notes,
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

      return reply.status(201).send({
        success: true,
        data: bomItem,
      });
    }
  );

  /**
   * POST /:id/bom/validate - Validate BOM addition (check cycles)
   */
  server.post(
    '/:id/bom/validate',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { componentProductId: string };

      // Non può essere componente di se stesso
      if (id === body.componentProductId) {
        return reply.send({
          success: true,
          data: {
            valid: false,
            message: 'Un prodotto non può essere componente di se stesso',
          },
        });
      }

      // Check cicli
      const checkCycle = async (
        currentId: string,
        targetId: string,
        visited: Set<string>
      ): Promise<boolean> => {
        if (visited.has(currentId)) return true;
        visited.add(currentId);

        const subComponents = await prisma.bomItem.findMany({
          where: { parentProductId: currentId },
          select: { componentProductId: true },
        });

        for (const sub of subComponents) {
          if (sub.componentProductId === targetId) return false;
          const isValid = await checkCycle(sub.componentProductId, targetId, visited);
          if (!isValid) return false;
        }
        return true;
      };

      const isValid = await checkCycle(body.componentProductId, id, new Set());

      return reply.send({
        success: true,
        data: {
          valid: isValid,
          message: isValid ? null : 'Questo componente creerebbe un ciclo nel BOM',
        },
      });
    }
  );

  /**
   * PUT /:id/bom/:componentId - Update BOM item
   */
  server.put(
    '/:id/bom/:componentId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, componentId } = request.params as { id: string; componentId: string };
      const body = request.body as {
        quantity?: number;
        unit?: string;
        scrapPercentage?: number;
        notes?: string;
      };

      try {
        const bomItem = await prisma.bomItem.update({
          where: {
            parentProductId_componentProductId: {
              parentProductId: id,
              componentProductId: componentId,
            },
          },
          data: {
            ...(body.quantity !== undefined && { quantity: body.quantity }),
            ...(body.unit !== undefined && { unit: body.unit }),
            ...(body.scrapPercentage !== undefined && { scrapPercentage: body.scrapPercentage }),
            ...(body.notes !== undefined && { notes: body.notes }),
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

        return reply.send({
          success: true,
          data: bomItem,
        });
      } catch (error: any) {
        return reply.status(404).send({
          success: false,
          error: 'Componente BOM non trovato',
        });
      }
    }
  );

  /**
   * DELETE /:id/bom/:componentId - Remove component from BOM
   */
  server.delete(
    '/:id/bom/:componentId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, componentId } = request.params as { id: string; componentId: string };

      try {
        await prisma.bomItem.delete({
          where: {
            parentProductId_componentProductId: {
              parentProductId: id,
              componentProductId: componentId,
            },
          },
        });

        return reply.send({
          success: true,
          data: { message: 'Componente rimosso dal BOM' },
        });
      } catch (error: any) {
        return reply.status(404).send({
          success: false,
          error: 'Componente BOM non trovato',
        });
      }
    }
  );

  /**
   * GET /:id/bom/explode - Explode BOM recursively
   */
  server.get(
    '/:id/bom/explode',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quantity = '1' } = request.query as { quantity?: string };

      // Import dinamico per evitare dipendenze circolari
      const { bomService } = await import('../services/bom.service');

      try {
        const explosion = await bomService.explodeBomRecursive(id, Number(quantity));

        return reply.send({
          success: true,
          data: explosion,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore durante esplosione BOM',
        });
      }
    }
  );

  /**
   * GET /:id/bom/cost - Calculate total BOM cost
   */
  server.get(
    '/:id/bom/cost',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quantity = '1' } = request.query as { quantity?: string };

      const { bomService } = await import('../services/bom.service');

      try {
        const cost = await bomService.calculateBomCost(id, Number(quantity));

        return reply.send({
          success: true,
          data: {
            productId: id,
            quantity: Number(quantity),
            totalBomCost: cost,
          },
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore durante calcolo costo BOM',
        });
      }
    }
  );

  /**
   * GET /:id/bom/availability - Check BOM availability
   */
  server.get(
    '/:id/bom/availability',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quantity = '1', location = 'WEB' } = request.query as {
        quantity?: string;
        location?: string;
      };

      const { bomService } = await import('../services/bom.service');

      try {
        const availability = await bomService.checkBomAvailability(
          id,
          Number(quantity),
          location
        );

        return reply.send({
          success: true,
          data: availability,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore durante verifica disponibilita BOM',
        });
      }
    }
  );
};

export default productRoutes;
