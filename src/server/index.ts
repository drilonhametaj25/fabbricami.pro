import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { config } from './config/environment';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { setupSwagger } from './config/swagger';
import path from 'path';

// Import routes
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import inventoryRoutes from './routes/inventory.routes';
import orderRoutes from './routes/order.routes';
import customerRoutes from './routes/customer.routes';
import employeeRoutes from './routes/employee.routes';
import accountingRoutes from './routes/accounting.routes';
import taskRoutes from './routes/task.routes';
import analyticsRoutes from './routes/analytics.routes';
import wordpressRoutes from './routes/wordpress.routes';
import warehouseRoutes from './routes/warehouse.routes';
import workProcessRoutes from './routes/work-process.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import goodsReceiptRoutes from './routes/goods-receipt.routes';
import notificationRoutes from './routes/notification.routes';
import calendarRoutes from './routes/calendar.routes';
import exportRoutes from './routes/export.routes';
import mrpRoutes from './routes/mrp.routes';
import materialRoutes from './routes/material.routes';
import operationTypeRoutes from './routes/operation-type.routes';
import manufacturingRoutes from './routes/manufacturing.routes';
import productCategoryRoutes from './routes/product-category.routes';
import priceListRoutes from './routes/pricelist.routes';
import productAnalyticsRoutes from './routes/product-analytics.routes';
import logisticsRoutes from './routes/logistics.routes';
import sdiRoutes from './routes/sdi.routes';
import ddtRoutes from './routes/ddt.routes';
import rmaRoutes from './routes/rma.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { physicalInventoryRoutes } from './routes/physical-inventory.routes';
import threeWayMatchRoutes from './routes/three-way-match.routes';
import { initQueueSystem, shutdownSystems } from './config/features';

// Shop/E-commerce routes (public)
import shopCartRoutes from './routes/shop-cart.routes';
import shopWishlistRoutes from './routes/shop-wishlist.routes';
import shopShippingRoutes from './routes/shop-shipping.routes';
import shopReviewsRoutes from './routes/shop-reviews.routes';
import shopProductsRoutes from './routes/shop-products.routes';
import shopCategoriesRoutes from './routes/shop-categories.routes';
import shopAuthRoutes from './routes/shop-auth.routes';
import shopCheckoutRoutes from './routes/shop-checkout.routes';
import newsletterRoutes from './routes/newsletter.routes';

// Create Fastify instance
const server = Fastify({
  logger: {
    level: config.logging.level,
  },
  bodyLimit: config.upload.maxFileSize,
  trustProxy: true,
});

/**
 * Setup server
 */
async function setupServer() {
  // Register plugins
  // CORS: in development allow localhost origins, in production use ALLOWED_ORIGINS
  const allowedOrigins = config.isDevelopment
    ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3100', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:3100', 'http://127.0.0.1:3001']
    : (process.env.ALLOWED_ORIGINS?.split(',') || []);

  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  });

  await server.register(jwt, {
    secret: config.jwt.secret,
  });

  await server.register(multipart, {
    limits: {
      fileSize: config.upload.maxFileSize,
    },
  });

  await server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../uploads'),
    prefix: '/uploads/',
  });

  await server.register(websocket);

  // Setup Swagger documentation
  await setupSwagger(server);

  // Error handlers
  server.setErrorHandler(errorHandler);
  server.setNotFoundHandler(notFoundHandler);

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Register routes
  const apiPrefix = `/api/${config.apiVersion}`;

  await server.register(authRoutes, { prefix: `${apiPrefix}/auth` });
  await server.register(productRoutes, { prefix: `${apiPrefix}/products` });
  await server.register(inventoryRoutes, { prefix: `${apiPrefix}/inventory` });
  await server.register(orderRoutes, { prefix: `${apiPrefix}/orders` });
  await server.register(customerRoutes, { prefix: `${apiPrefix}/customers` });
  await server.register(employeeRoutes, { prefix: `${apiPrefix}/employees` });
  await server.register(accountingRoutes, { prefix: `${apiPrefix}/accounting` });
  await server.register(taskRoutes, { prefix: `${apiPrefix}/tasks` });
  await server.register(analyticsRoutes, { prefix: `${apiPrefix}/analytics` });
  await server.register(wordpressRoutes, { prefix: `${apiPrefix}/wordpress` });
  await server.register(warehouseRoutes, { prefix: `${apiPrefix}/warehouses` });
  await server.register(workProcessRoutes, { prefix: `${apiPrefix}/work-processes` });
  await server.register(supplierRoutes, { prefix: `${apiPrefix}/suppliers` });
  await server.register(purchaseOrderRoutes, { prefix: `${apiPrefix}/purchase-orders` });
  await server.register(goodsReceiptRoutes, { prefix: `${apiPrefix}/goods-receipts` });
  await server.register(notificationRoutes, { prefix: `${apiPrefix}/notifications` });
  await server.register(calendarRoutes, { prefix: `${apiPrefix}/calendar` });
  await server.register(calendarRoutes, { prefix: `${apiPrefix}/calendar-events` }); // Alias for frontend compatibility
  await server.register(exportRoutes, { prefix: `${apiPrefix}/export` });
  await server.register(mrpRoutes, { prefix: `${apiPrefix}/mrp` });
  await server.register(materialRoutes, { prefix: `${apiPrefix}/materials` });
  await server.register(operationTypeRoutes, { prefix: `${apiPrefix}/operation-types` });
  await server.register(manufacturingRoutes, { prefix: `${apiPrefix}/manufacturing` });
  await server.register(productCategoryRoutes, { prefix: `${apiPrefix}/product-categories` });
  await server.register(priceListRoutes, { prefix: `${apiPrefix}/pricelists` });
  await server.register(productAnalyticsRoutes, { prefix: apiPrefix }); // Product analytics (covers /products/:id/analytics and /analytics/products/*)
  await server.register(logisticsRoutes, { prefix: `${apiPrefix}/logistics` });
  await server.register(sdiRoutes, { prefix: `${apiPrefix}/sdi` });
  await server.register(ddtRoutes, { prefix: `${apiPrefix}/ddt` });
  await server.register(rmaRoutes, { prefix: `${apiPrefix}/rma` });
  await server.register(dashboardRoutes, { prefix: `${apiPrefix}/dashboard` });
  await server.register(physicalInventoryRoutes, { prefix: `${apiPrefix}/physical-inventory` });
  await server.register(threeWayMatchRoutes, { prefix: `${apiPrefix}/three-way-match` });

  // Shop/E-commerce routes (public API for frontend)
  await server.register(shopCartRoutes, { prefix: `${apiPrefix}/shop/cart` });
  await server.register(shopWishlistRoutes, { prefix: `${apiPrefix}/shop/wishlist` });
  await server.register(shopShippingRoutes, { prefix: `${apiPrefix}/shop/shipping` });
  await server.register(shopReviewsRoutes, { prefix: `${apiPrefix}/shop/reviews` });
  await server.register(shopProductsRoutes, { prefix: `${apiPrefix}/shop/products` });
  await server.register(shopCategoriesRoutes, { prefix: `${apiPrefix}/shop/categories` });
  await server.register(shopAuthRoutes, { prefix: `${apiPrefix}/shop/auth` });
  await server.register(shopCheckoutRoutes, { prefix: `${apiPrefix}/shop/checkout` });
  await server.register(newsletterRoutes, { prefix: `${apiPrefix}/newsletter` });

  logger.info('✅ All routes registered');
}

/**
 * Start server
 */
async function start() {
  try {
    await setupServer();

    await server.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`🚀 Server listening on http://localhost:${config.port}`);
    logger.info(`📚 API Version: ${config.apiVersion}`);
    logger.info(`🌍 Environment: ${config.env}`);

    // Initialize background systems (queues, workers, scheduled jobs)
    await initQueueSystem();
  } catch (error) {
    logger.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received, shutting down gracefully...`);

    try {
      await shutdownSystems();
      await server.close();
      logger.info('👋 Server closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

// Start server
start();

export default server;
