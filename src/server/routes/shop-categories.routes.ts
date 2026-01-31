import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Categories Routes
 * API pubbliche per categorie e-commerce
 */
const shopCategoriesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/shop/categories
   * Lista categorie con struttura ad albero
   */
  fastify.get<{
    Querystring: { flat?: boolean };
  }>('/', async (request, reply) => {
    try {
      const { flat = false } = request.query;

      const categories = await prisma.productCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          parentId: true,
          position: true,
          _count: {
            select: {
              products: {
                where: {
                  product: {
                    isActive: true,
                    webActive: true,
                  },
                },
              },
            },
          },
        },
        orderBy: { position: 'asc' },
      });

      // Trasforma in formato pubblico
      const items = categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image,
        parentId: c.parentId,
        productCount: c._count.products,
      }));

      if (flat) {
        return successResponse(reply, items);
      }

      // Costruisci albero
      const tree = buildCategoryTree(items);

      return successResponse(reply, tree);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/categories/:slug
   * Dettaglio categoria con prodotti
   */
  fastify.get<{
    Params: { slug: string };
    Querystring: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    };
  }>('/:slug', async (request, reply) => {
    try {
      const { slug } = request.params;
      const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = request.query;

      const category = await prisma.productCategory.findFirst({
        where: {
          OR: [
            { slug },
            { id: slug },
          ],
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          children: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
        },
      });

      if (!category) {
        return errorResponse(reply, 'Categoria non trovata', 404);
      }

      // Ottieni ID di tutte le sottocategorie
      const categoryIds = [category.id, ...category.children.map(c => c.id)];

      const skip = (page - 1) * limit;

      // Prodotti della categoria (incluse sottocategorie)
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: {
            isActive: true,
            webActive: true,
            categories: {
              some: {
                categoryId: { in: categoryIds },
              },
            },
          },
          select: {
            id: true,
            name: true,
            webSlug: true,
            webPrice: true,
            wcSalePrice: true,
            wcOnSale: true,
            mainImageUrl: true,
            wcStockStatus: true,
            wcAverageRating: true,
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.product.count({
          where: {
            isActive: true,
            webActive: true,
            categories: {
              some: {
                categoryId: { in: categoryIds },
              },
            },
          },
        }),
      ]);

      return successResponse(reply, {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
          parent: category.parent,
          subcategories: category.children,
        },
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.webSlug,
          price: p.webPrice,
          salePrice: p.wcSalePrice,
          onSale: p.wcOnSale,
          image: p.mainImageUrl,
          inStock: p.wcStockStatus === 'instock',
          rating: p.wcAverageRating,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/categories/:slug/breadcrumb
   * Breadcrumb per categoria
   */
  fastify.get<{
    Params: { slug: string };
  }>('/:slug/breadcrumb', async (request, reply) => {
    try {
      const { slug } = request.params;

      const category = await prisma.productCategory.findFirst({
        where: {
          OR: [{ slug }, { id: slug }],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
        },
      });

      if (!category) {
        return errorResponse(reply, 'Categoria non trovata', 404);
      }

      // Costruisci breadcrumb ricorsivamente
      const breadcrumb = await buildBreadcrumb(category);

      return successResponse(reply, breadcrumb);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });
};

/**
 * Costruisce albero categorie
 */
function buildCategoryTree(categories: any[]): any[] {
  const map = new Map();
  const roots: any[] = [];

  // Prima passata: crea mappa
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  // Seconda passata: costruisci albero
  for (const cat of categories) {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Costruisce breadcrumb
 */
async function buildBreadcrumb(
  category: { id: string; name: string; slug: string; parentId: string | null }
): Promise<Array<{ id: string; name: string; slug: string }>> {
  const breadcrumb = [{ id: category.id, name: category.name, slug: category.slug }];

  let parentId = category.parentId;

  while (parentId) {
    const parent = await prisma.productCategory.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });

    if (!parent) break;

    breadcrumb.unshift({ id: parent.id, name: parent.name, slug: parent.slug });
    parentId = parent.parentId;
  }

  return breadcrumb;
}

export default shopCategoriesRoutes;
