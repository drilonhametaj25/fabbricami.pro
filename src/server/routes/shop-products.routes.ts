import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/database';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Products Routes
 * API pubbliche per catalogo prodotti e-commerce
 */
const shopProductsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/shop/products
   * Lista prodotti pubblici con filtri
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
      onSale?: boolean;
      featured?: boolean;
      sortBy?: 'name' | 'price' | 'createdAt' | 'wcTotalSales';
      sortOrder?: 'asc' | 'desc';
    };
  }>('/', async (request, reply) => {
    try {
      const {
        page: pageStr = '1',
        limit: limitStr = '20',
        category,
        search,
        minPrice: minPriceStr,
        maxPrice: maxPriceStr,
        inStock,
        onSale,
        featured,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = request.query;

      // Ensure numeric types
      const page = parseInt(String(pageStr), 10) || 1;
      const limit = parseInt(String(limitStr), 10) || 20;
      const minPrice = minPriceStr ? parseFloat(String(minPriceStr)) : undefined;
      const maxPrice = maxPriceStr ? parseFloat(String(maxPriceStr)) : undefined;

      const where: any = {
        isActive: true,
        isSellable: true,
        webActive: true,
      };

      // Filtro categoria
      if (category) {
        where.categories = {
          some: {
            category: {
              OR: [
                { slug: category },
                { id: category },
              ],
            },
          },
        };
      }

      // Ricerca
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { webDescription: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Filtro prezzo
      if (minPrice || maxPrice) {
        where.webPrice = {};
        if (minPrice) where.webPrice.gte = minPrice;
        if (maxPrice) where.webPrice.lte = maxPrice;
      }

      // Filtro stock
      if (inStock) {
        where.wcStockStatus = 'instock';
      }

      // Filtro saldi
      if (onSale) {
        where.wcOnSale = true;
      }

      // Filtro featured
      if (featured) {
        where.wcFeatured = true;
      }

      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            sku: true,
            name: true,
            webSlug: true,
            price: true,
            webPrice: true,
            wcSalePrice: true,
            wcOnSale: true,
            wcFeatured: true,
            wcStockStatus: true,
            mainImageUrl: true,
            wcAverageRating: true,
            wcRatingCount: true,
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.product.count({ where }),
      ]);

      // Trasforma risposta
      const items = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.webSlug,
        price: p.webPrice || p.price,
        salePrice: p.wcSalePrice,
        onSale: p.wcOnSale,
        featured: p.wcFeatured,
        inStock: p.wcStockStatus === 'instock',
        imageUrl: p.mainImageUrl,
        rating: p.wcAverageRating,
        reviewCount: p.wcRatingCount,
        categories: p.categories.map(c => c.category),
      }));

      return successResponse(reply, {
        items,
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
   * GET /api/v1/shop/products/:slug
   * Dettaglio prodotto per slug
   */
  fastify.get<{
    Params: { slug: string };
  }>('/:slug', async (request, reply) => {
    try {
      const { slug } = request.params;

      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { webSlug: slug },
            { id: slug },
          ],
          isActive: true,
          webActive: true,
        },
        include: {
          variants: {
            where: { isActive: true, webActive: true },
            select: {
              id: true,
              sku: true,
              name: true,
              attributes: true,
              priceDelta: true,
              webPrice: true,
              wcSalePrice: true,
              wcOnSale: true,
              wcStockStatus: true,
              mainImageUrl: true,
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  parentId: true,
                },
              },
            },
          },
          productImages: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              src: true,
              alt: true,
            },
          },
        },
      });

      if (!product) {
        return errorResponse(reply, 'Prodotto non trovato', 404);
      }

      // Prodotti correlati
      const relatedProducts = await prisma.product.findMany({
        where: {
          id: { not: product.id },
          isActive: true,
          webActive: true,
          categories: {
            some: {
              categoryId: {
                in: product.categories.map(c => c.category.id),
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          webSlug: true,
          webPrice: true,
          mainImageUrl: true,
          wcOnSale: true,
          wcSalePrice: true,
        },
        take: 4,
      });

      // Trasforma risposta
      const response = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        slug: product.webSlug,
        description: product.webDescription,
        shortDescription: product.webShortDescription,
        price: product.webPrice || product.price,
        salePrice: product.wcSalePrice,
        onSale: product.wcOnSale,
        featured: product.wcFeatured,
        inStock: product.wcStockStatus === 'instock',
        stockStatus: product.wcStockStatus,
        weight: product.weight,
        dimensions: product.dimensions,
        images: product.productImages.length > 0
          ? product.productImages.map(img => ({ id: img.id, url: img.src, alt: img.alt }))
          : product.mainImageUrl
            ? [{ id: 'main', url: product.mainImageUrl, alt: product.name }]
            : [],
        categories: product.categories.map(c => c.category),
        variants: product.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          attributes: v.attributes,
          price: v.webPrice || (Number(product.webPrice || product.price) + Number(v.priceDelta)),
          salePrice: v.wcSalePrice,
          onSale: v.wcOnSale,
          inStock: v.wcStockStatus === 'instock',
          imageUrl: v.mainImageUrl,
        })),
        averageRating: product.wcAverageRating,
        reviewCount: product.wcRatingCount,
        rating: product.wcAverageRating,
        relatedProducts: relatedProducts.map(r => ({
          id: r.id,
          name: r.name,
          slug: r.webSlug,
          price: r.webPrice,
          salePrice: r.wcSalePrice,
          onSale: r.wcOnSale,
          imageUrl: r.mainImageUrl,
        })),
        meta: {
          title: product.webMetaTitle || product.name,
          description: product.webMetaDescription || product.webShortDescription,
        },
      };

      return successResponse(reply, response);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/products/featured
   * Prodotti in evidenza
   */
  fastify.get('/featured', async (_request, reply) => {
    try {
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          webActive: true,
          wcFeatured: true,
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
        },
        take: 8,
        orderBy: { wcMenuOrder: 'asc' },
      });

      return successResponse(reply, products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.webSlug,
        price: p.webPrice,
        salePrice: p.wcSalePrice,
        onSale: p.wcOnSale,
        imageUrl: p.mainImageUrl,
        inStock: p.wcStockStatus === 'instock',
      })));
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/products/on-sale
   * Prodotti in saldo
   */
  fastify.get<{
    Querystring: { limit?: number };
  }>('/on-sale', async (request, reply) => {
    try {
      const limitParam = request.query.limit;
      const limit = limitParam ? parseInt(String(limitParam), 10) : 12;

      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          webActive: true,
          wcOnSale: true,
        },
        select: {
          id: true,
          name: true,
          webSlug: true,
          webPrice: true,
          wcSalePrice: true,
          mainImageUrl: true,
          wcStockStatus: true,
          webDescription: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(reply, products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.webSlug,
        price: p.webPrice,
        salePrice: p.wcSalePrice,
        imageUrl: p.mainImageUrl,
        inStock: p.wcStockStatus === 'instock',
        description: p.webDescription,
      })));
    } catch (error: any) {
      console.error('Error in /on-sale:', error);
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/products/new
   * Nuovi arrivi
   */
  fastify.get<{
    Querystring: { limit?: number };
  }>('/new', async (request, reply) => {
    try {
      const limitParam = request.query.limit;
      const limit = limitParam ? parseInt(String(limitParam), 10) : 12;

      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          webActive: true,
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
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(reply, products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.webSlug,
        price: p.webPrice,
        salePrice: p.wcSalePrice,
        onSale: p.wcOnSale,
        imageUrl: p.mainImageUrl,
        inStock: p.wcStockStatus === 'instock',
      })));
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/products/best-sellers
   * Prodotti più venduti
   */
  fastify.get<{
    Querystring: { limit?: number };
  }>('/best-sellers', async (request, reply) => {
    try {
      const { limit = 12 } = request.query;

      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          webActive: true,
          wcTotalSales: { gt: 0 },
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
          wcTotalSales: true,
        },
        take: limit,
        orderBy: { wcTotalSales: 'desc' },
      });

      return successResponse(reply, products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.webSlug,
        price: p.webPrice,
        salePrice: p.wcSalePrice,
        onSale: p.wcOnSale,
        imageUrl: p.mainImageUrl,
        inStock: p.wcStockStatus === 'instock',
      })));
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });
};

export default shopProductsRoutes;
