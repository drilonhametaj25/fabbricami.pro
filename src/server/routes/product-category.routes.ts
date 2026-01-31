import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const productCategoryRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET / - Get all categories as flat list or tree
   */
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { tree } = request.query as { tree?: string };

    const categories = await prisma.productCategory.findMany({
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: true, children: true },
        },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    // Se richiesto come albero, costruisci la struttura gerarchica
    if (tree === 'true') {
      const categoryMap = new Map<string, any>();
      const roots: any[] = [];

      // Prima passa: crea mappa e prepara nodi
      for (const cat of categories) {
        categoryMap.set(cat.id, {
          ...cat,
          children: [],
          productCount: cat._count.products,
          childCount: cat._count.children,
        });
      }

      // Seconda passa: costruisci albero
      for (const cat of categories) {
        const node = categoryMap.get(cat.id);
        if (cat.parentId && categoryMap.has(cat.parentId)) {
          categoryMap.get(cat.parentId).children.push(node);
        } else {
          roots.push(node);
        }
      }

      return reply.send({
        success: true,
        data: roots,
      });
    }

    return reply.send({
      success: true,
      data: categories,
    });
  });

  /**
   * GET /:id - Get category by ID
   */
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { position: 'asc' },
        },
        products: {
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
      },
    });

    if (!category) {
      return reply.status(404).send({
        success: false,
        error: 'Categoria non trovata',
      });
    }

    return reply.send({
      success: true,
      data: category,
    });
  });

  /**
   * POST / - Create category
   */
  server.post(
    '/',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        slug?: string;
        description?: string;
        parentId?: string;
        image?: string;
        position?: number;
      };

      // Genera slug se non fornito
      const slug = body.slug || body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Verifica unicità slug
      const existing = await prisma.productCategory.findUnique({
        where: { slug },
      });

      if (existing) {
        return reply.status(400).send({
          success: false,
          error: 'Slug già esistente',
        });
      }

      // Trova la prossima posizione se non specificata
      let position = body.position;
      if (position === undefined) {
        const lastCat = await prisma.productCategory.findFirst({
          where: { parentId: body.parentId || null },
          orderBy: { position: 'desc' },
        });
        position = (lastCat?.position || 0) + 1;
      }

      const category = await prisma.productCategory.create({
        data: {
          name: body.name,
          slug,
          description: body.description,
          parentId: body.parentId || null,
          image: body.image,
          position,
        },
        include: {
          parent: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: category,
      });
    }
  );

  /**
   * PUT /:id - Update category
   */
  server.put(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        slug?: string;
        description?: string;
        parentId?: string | null;
        image?: string;
        position?: number;
        isActive?: boolean;
      };

      // Verifica che non si stia impostando come parent se stesso
      if (body.parentId === id) {
        return reply.status(400).send({
          success: false,
          error: 'Una categoria non può essere parent di se stessa',
        });
      }

      // Verifica unicità slug se cambiato
      if (body.slug) {
        const existing = await prisma.productCategory.findFirst({
          where: {
            slug: body.slug,
            id: { not: id },
          },
        });
        if (existing) {
          return reply.status(400).send({
            success: false,
            error: 'Slug già esistente',
          });
        }
      }

      const category = await prisma.productCategory.update({
        where: { id },
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description,
          parentId: body.parentId,
          image: body.image,
          position: body.position,
          isActive: body.isActive,
        },
        include: {
          parent: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send({
        success: true,
        data: category,
      });
    }
  );

  /**
   * DELETE /:id - Delete category
   */
  server.delete(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { moveChildrenTo } = request.query as { moveChildrenTo?: string };

      // Verifica che la categoria esista
      const category = await prisma.productCategory.findUnique({
        where: { id },
        include: {
          _count: { select: { children: true, products: true } },
        },
      });

      if (!category) {
        return reply.status(404).send({
          success: false,
          error: 'Categoria non trovata',
        });
      }

      // Se ha figli, sposta al parent specificato o a root
      if (category._count.children > 0) {
        await prisma.productCategory.updateMany({
          where: { parentId: id },
          data: { parentId: moveChildrenTo || null },
        });
      }

      // Rimuovi assegnazioni prodotti (i prodotti restano, solo il link viene rimosso)
      await prisma.productCategoryAssignment.deleteMany({
        where: { categoryId: id },
      });

      // Elimina categoria
      await prisma.productCategory.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        data: { message: 'Categoria eliminata' },
      });
    }
  );

  /**
   * PUT /reorder - Reorder categories
   */
  server.put(
    '/reorder',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const body = request.body as {
        items: Array<{ id: string; parentId: string | null; position: number }>;
      };

      const updates = body.items.map((item) =>
        prisma.productCategory.update({
          where: { id: item.id },
          data: {
            parentId: item.parentId,
            position: item.position,
          },
        })
      );

      await prisma.$transaction(updates);

      return reply.send({
        success: true,
        data: { message: 'Ordine aggiornato' },
      });
    }
  );

  /**
   * POST /:id/products - Assign products to category
   */
  server.post(
    '/:id/products',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { productIds: string[] };

      // Verifica categoria
      const category = await prisma.productCategory.findUnique({ where: { id } });
      if (!category) {
        return reply.status(404).send({
          success: false,
          error: 'Categoria non trovata',
        });
      }

      // Crea assegnazioni (ignora duplicati)
      const assignments = await Promise.all(
        body.productIds.map(async (productId) => {
          try {
            return await prisma.productCategoryAssignment.upsert({
              where: {
                productId_categoryId: { productId, categoryId: id },
              },
              create: { productId, categoryId: id },
              update: {},
            });
          } catch {
            return null; // Prodotto non esiste
          }
        })
      );

      const created = assignments.filter((a) => a !== null).length;

      return reply.send({
        success: true,
        data: { assigned: created },
      });
    }
  );

  /**
   * DELETE /:id/products/:productId - Remove product from category
   */
  server.delete(
    '/:id/products/:productId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id, productId } = request.params as { id: string; productId: string };

      await prisma.productCategoryAssignment.delete({
        where: {
          productId_categoryId: { productId, categoryId: id },
        },
      });

      return reply.send({
        success: true,
        data: { message: 'Prodotto rimosso dalla categoria' },
      });
    }
  );
};

export default productCategoryRoutes;
