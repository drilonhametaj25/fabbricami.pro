import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { inventoryService } from '../services/inventory.service';
import { successResponse, errorResponse } from '../utils/response.util';
import { prisma } from '../config/database';

const inventoryRoutes: FastifyPluginAsync = async (server) => {
  // GET / - Lista giacenze con filtri, paginazione e previsioni stock
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    try {
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

      const result = await inventoryService.listInventoryWithPredictions({
        page,
        limit,
        productId: query.productId,
        locationId: query.locationId,
        lowStock: query.lowStock === 'true',
        outOfStock: query.outOfStock === 'true',
        search: query.search,
        statusFilter: query.statusFilter,
        sortBy: query.sortBy || 'updatedAt',
        sortOrder: query.sortOrder || 'desc',
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento inventario', 500);
    }
  });

  // GET /prediction/:productId - Previsione stock per singolo prodotto
  server.get('/prediction/:productId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId } = request.params as any;
      const { days } = request.query as any;

      const prediction = await inventoryService.getStockPrediction(
        productId,
        days ? parseInt(days) : 90
      );

      return successResponse(reply, prediction);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel calcolo previsione', 500);
    }
  });

  // GET /history/:productId - Storico stock per grafico temporale
  server.get('/history/:productId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId } = request.params as any;
      const { daysHistory, daysProjection } = request.query as any;

      const history = await inventoryService.getStockHistory(
        productId,
        daysHistory ? parseInt(daysHistory) : 90,
        daysProjection ? parseInt(daysProjection) : 60
      );

      return successResponse(reply, history);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento storico', 500);
    }
  });

  // GET /overview - Overview globale prodotti + materiali
  server.get('/overview', { preHandler: authenticate }, async (_request, reply) => {
    try {
      const overview = await inventoryService.getInventoryOverview();
      return successResponse(reply, overview);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento overview', 500);
    }
  });

  // GET /trend - Andamento globale valore inventario (prodotti + materiali)
  server.get('/trend', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { daysHistory, daysProjection } = request.query as any;
      const trend = await inventoryService.getGlobalStockTrend(
        daysHistory ? parseInt(daysHistory) : 60,
        daysProjection ? parseInt(daysProjection) : 30
      );
      return successResponse(reply, trend);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento trend', 500);
    }
  });

  // GET /forecast - Previsione avanzata multi-scenario con alert
  server.get('/forecast', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { daysHistory, daysProjection } = request.query as any;
      const forecast = await inventoryService.getAdvancedForecast(
        daysHistory ? parseInt(daysHistory) : 90,
        daysProjection ? parseInt(daysProjection) : 60
      );
      return successResponse(reply, forecast);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel calcolo previsioni', 500);
    }
  });

  // GET /materials - Lista inventario materiali con previsioni
  server.get('/materials', { preHandler: authenticate }, async (request, reply) => {
    try {
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

      const result = await inventoryService.listMaterialInventory({
        page,
        limit,
        search: query.search,
        category: query.category,
        locationId: query.locationId,
        statusFilter: query.statusFilter,
      });

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento materiali', 500);
    }
  });

  // GET /materials/history/:materialId - Storico materiale per grafico
  server.get('/materials/history/:materialId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { materialId } = request.params as any;
      const { daysHistory, daysProjection } = request.query as any;

      const history = await inventoryService.getMaterialHistory(
        materialId,
        daysHistory ? parseInt(daysHistory) : 90,
        daysProjection ? parseInt(daysProjection) : 60
      );

      return successResponse(reply, history);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento storico materiale', 500);
    }
  });

  // GET /stats - Statistiche inventario
  server.get('/stats', { preHandler: authenticate }, async (_request, reply) => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [inventoryItems, monthMovements, lowStockProducts] = await Promise.all([
        prisma.inventoryItem.findMany({
          include: { product: { select: { cost: true, minStockLevel: true } } }
        }),
        prisma.inventoryMovement.count({
          where: { createdAt: { gte: startOfMonth } }
        }),
        inventoryService.getLowStockProducts()
      ]);

      const totalQuantity = inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = inventoryItems.reduce((sum, i) =>
        sum + (i.quantity * Number(i.product?.cost || 0)), 0);

      return successResponse(reply, {
        totalQuantity,
        totalValue,
        monthMovements,
        criticalProducts: lowStockProducts.length
      });
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento statistiche', 500);
    }
  });

  // GET /movements - Lista movimenti con filtri
  server.get('/movements', { preHandler: authenticate }, async (request, reply) => {
    try {
      const query = request.query as any;
      const result = await inventoryService.listMovements({
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 50,
        productId: query.productId,
        locationId: query.locationId,
        type: query.type,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento movimenti', 500);
    }
  });

  // GET /low-stock - Prodotti sotto scorta
  server.get('/low-stock', { preHandler: authenticate }, async (request, reply) => {
    try {
      const query = request.query as any;
      const products = await inventoryService.getLowStockProducts(
        query.threshold ? parseInt(query.threshold) : undefined
      );
      return successResponse(reply, products);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento prodotti sotto scorta', 500);
    }
  });

  // POST /movement - Crea movimento IN/OUT
  server.post('/movement', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')]
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const user = request.user as any;

      if (!body.productId || !body.type || !body.quantity || !body.locationId) {
        return errorResponse(reply, 'Campi obbligatori: productId, type, quantity, locationId', 400);
      }

      if (!['IN', 'OUT'].includes(body.type)) {
        return errorResponse(reply, 'Tipo movimento non valido. Usa IN o OUT', 400);
      }

      const movement = await inventoryService.createMovement({
        productId: body.productId,
        type: body.type,
        quantity: body.quantity,
        locationId: body.locationId,
        userId: user.id,
        unit: body.unit || 'pz',
        notes: body.notes,
        referenceId: body.referenceId,
        lotNumber: body.lotNumber,
      });

      return successResponse(reply, movement, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella creazione movimento', 500);
    }
  });

  // POST /movement/batch - Crea movimenti multipli (per scanner barcode)
  server.post('/movement/batch', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')]
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const user = request.user as any;

      if (!body.movements || !Array.isArray(body.movements) || body.movements.length === 0) {
        return errorResponse(reply, 'Fornire un array di movimenti', 400);
      }

      const results = [];
      const errors = [];

      for (const mov of body.movements) {
        try {
          if (!mov.productId || !mov.type || !mov.quantity || !mov.locationId) {
            errors.push({ productId: mov.productId, error: 'Campi obbligatori mancanti' });
            continue;
          }

          const movement = await inventoryService.createMovement({
            productId: mov.productId,
            type: mov.type,
            quantity: mov.quantity,
            locationId: mov.locationId,
            userId: user.id,
            unit: mov.unit || 'pz',
            notes: mov.notes || body.notes,
            referenceId: mov.referenceId,
            lotNumber: mov.lotNumber,
          });

          results.push(movement);
        } catch (err: any) {
          errors.push({ productId: mov.productId, error: err.message });
        }
      }

      return successResponse(reply, {
        created: results.length,
        failed: errors.length,
        movements: results,
        errors: errors.length > 0 ? errors : undefined
      }, results.length > 0 ? 201 : 400);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella creazione movimenti batch', 500);
    }
  });

  // POST /transfer - Trasferimento tra location
  server.post('/transfer', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')]
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const user = request.user as any;

      if (!body.productId || !body.fromLocationId || !body.toLocationId || !body.quantity) {
        return errorResponse(reply, 'Campi obbligatori: productId, fromLocationId, toLocationId, quantity', 400);
      }

      if (body.fromLocationId === body.toLocationId) {
        return errorResponse(reply, 'Location di origine e destinazione devono essere diverse', 400);
      }

      const movement = await inventoryService.transferStock(
        body.productId,
        body.fromLocationId,
        body.toLocationId,
        body.quantity,
        user.id,
        body.notes
      );

      return successResponse(reply, movement, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel trasferimento', 500);
    }
  });

  // GET /:productId/availability - Verifica disponibilità prodotto
  server.get('/:productId/availability', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId } = request.params as any;
      const { location, quantity } = request.query as any;

      const result = await inventoryService.checkAvailability(
        productId,
        location || 'WEB',
        parseInt(quantity) || 1
      );

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella verifica disponibilità', 500);
    }
  });

  // GET /:productId/total - Giacenza totale prodotto (tutte le location)
  server.get('/:productId/total', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId } = request.params as any;
      const result = await inventoryService.getTotalStock(productId);
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento giacenza totale', 500);
    }
  });

  // ============================================
  // STOCK RESERVATION ENDPOINTS
  // ============================================

  // POST /reserve - Riserva stock per ordine
  server.post('/reserve', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId, location, quantity, orderId } = request.body as {
        productId: string;
        location: string;
        quantity: number;
        orderId: string;
      };

      if (!productId || !location || !quantity || !orderId) {
        return errorResponse(reply, 'productId, location, quantity e orderId sono obbligatori', 400);
      }

      const result = await inventoryService.reserveStock(
        productId,
        location,
        quantity,
        orderId
      );

      return successResponse(reply, result, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella prenotazione stock', 400);
    }
  });

  // POST /release - Rilascia prenotazione stock
  server.post('/release', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId, location, quantity, orderId } = request.body as {
        productId: string;
        location: string;
        quantity: number;
        orderId: string;
      };

      if (!productId || !location || !quantity || !orderId) {
        return errorResponse(reply, 'productId, location, quantity e orderId sono obbligatori', 400);
      }

      const result = await inventoryService.releaseReservation(
        productId,
        location,
        quantity,
        orderId
      );

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel rilascio prenotazione', 400);
    }
  });

  // POST /confirm - Conferma prenotazione (scarica stock effettivo)
  server.post('/confirm', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { productId, variantId, locationId, quantity, orderId, notes } = request.body as {
        productId: string;
        variantId?: string;
        locationId: string;
        quantity: number;
        orderId: string;
        notes?: string;
      };

      if (!productId || !locationId || !quantity || !orderId) {
        return errorResponse(reply, 'productId, locationId, quantity e orderId sono obbligatori', 400);
      }

      const userId = (request as any).user?.userId;

      // 1. Rilascia la prenotazione
      await inventoryService.releaseReservation(productId, locationId, quantity, orderId);

      // 2. Crea movimento di scarico effettivo
      const movement = await inventoryService.createMovement({
        productId,
        variantId,
        locationId,
        type: 'OUT',
        quantity,
        unit: 'pz',
        referenceType: 'ORDER',
        referenceId: orderId,
        notes: notes || 'Conferma prenotazione e scarico stock',
        userId: userId || 'system'
      });

      return successResponse(reply, {
        message: 'Prenotazione confermata e stock scaricato',
        movement
      });
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella conferma prenotazione', 400);
    }
  });

  // POST /batch-reserve - Riserva multipla per ordine
  server.post('/batch-reserve', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { items, orderId } = request.body as {
        items: Array<{ productId: string; location: string; quantity: number }>;
        orderId: string;
      };

      if (!items || !Array.isArray(items) || items.length === 0 || !orderId) {
        return errorResponse(reply, 'items array e orderId sono obbligatori', 400);
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      for (const item of items) {
        try {
          // Prima verifica disponibilità
          const availability = await inventoryService.checkAvailability(
            item.productId,
            item.location,
            item.quantity
          );

          if (!availability.available) {
            results.errors.push({
              productId: item.productId,
              location: item.location,
              requested: item.quantity,
              available: availability.availableStock,
              error: 'Stock insufficiente'
            });
            continue;
          }

          // Effettua prenotazione
          const result = await inventoryService.reserveStock(
            item.productId,
            item.location,
            item.quantity,
            orderId
          );
          results.success.push(result);
        } catch (error: any) {
          results.errors.push({
            productId: item.productId,
            location: item.location,
            error: error.message
          });
        }
      }

      const allSuccess = results.errors.length === 0;
      const allFailed = results.success.length === 0;

      return successResponse(reply, {
        status: allSuccess ? 'complete' : (allFailed ? 'failed' : 'partial'),
        ...results
      }, allFailed ? 400 : 200);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nella prenotazione batch', 500);
    }
  });

  // POST /batch-release - Rilascio multiplo
  server.post('/batch-release', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { items, orderId } = request.body as {
        items: Array<{ productId: string; location: string; quantity: number }>;
        orderId: string;
      };

      if (!items || !Array.isArray(items) || items.length === 0 || !orderId) {
        return errorResponse(reply, 'items array e orderId sono obbligatori', 400);
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      for (const item of items) {
        try {
          const result = await inventoryService.releaseReservation(
            item.productId,
            item.location,
            item.quantity,
            orderId
          );
          results.success.push(result);
        } catch (error: any) {
          results.errors.push({
            productId: item.productId,
            location: item.location,
            error: error.message
          });
        }
      }

      return successResponse(reply, results);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel rilascio batch', 500);
    }
  });

  // GET /reservations - Lista prodotti con prenotazioni attive
  server.get('/reservations', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { warehouseId, minReserved } = request.query as any;

      const reservations = await prisma.inventoryItem.findMany({
        where: {
          reservedQuantity: { gt: parseInt(minReserved) || 0 },
          ...(warehouseId && { warehouseId })
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          variant: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } }
        },
        orderBy: { reservedQuantity: 'desc' }
      });

      const summary = {
        totalItems: reservations.length,
        totalReserved: reservations.reduce((sum, r) => sum + r.reservedQuantity, 0),
        items: reservations.map(r => ({
          productId: r.productId,
          variantId: r.variantId,
          product: r.product,
          variant: r.variant,
          warehouse: r.warehouse,
          location: r.location,
          quantity: r.quantity,
          reserved: r.reservedQuantity,
          available: r.quantity - r.reservedQuantity
        }))
      };

      return successResponse(reply, summary);
    } catch (error: any) {
      return errorResponse(reply, error.message || 'Errore nel caricamento prenotazioni', 500);
    }
  });
};

export default inventoryRoutes;
