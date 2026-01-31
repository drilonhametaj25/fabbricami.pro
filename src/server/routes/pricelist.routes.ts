import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { priceListService } from '../services/pricelist.service';
import {
  createPriceListSchema,
  updatePriceListSchema,
  createPriceListItemSchema,
  createCategoryDiscountSchema,
  priceListQuerySchema,
  calculatePriceSchema,
  assignPriceListSchema,
  bulkPriceImportSchema,
} from '../schemas/pricelist.schema';

const priceListRoutes: FastifyPluginAsync = async (server: any) => {
  /**
   * GET /pricelists - Lista listini
   */
  server.get('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const query = priceListQuerySchema.parse(request.query);
      const result = await priceListService.listPriceLists({
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /pricelists/stats - Statistiche listini
   */
  server.get('/stats', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      const stats = await priceListService.getStats();
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /pricelists/:id - Dettaglio listino
   */
  server.get('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const priceList = await priceListService.getPriceListById(id);
      if (!priceList) {
        return reply.status(404).send({ success: false, error: 'Price list not found' });
      }
      return reply.send({ success: true, data: priceList });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists - Crea listino
   */
  server.post('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const data = createPriceListSchema.parse(request.body);
      const priceList = await priceListService.createPriceList(data);
      return reply.status(201).send({ success: true, data: priceList });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /pricelists/:id - Aggiorna listino
   */
  server.put('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = updatePriceListSchema.parse(request.body);
      const priceList = await priceListService.updatePriceList(id, data);
      return reply.send({ success: true, data: priceList });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /pricelists/:id - Elimina listino
   */
  server.delete('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      await priceListService.deletePriceList(id);
      return reply.send({ success: true, message: 'Price list deleted' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /pricelists/:id/customers - Lista clienti associati
   */
  server.get('/:id/customers', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const customers = await priceListService.getCustomersByPriceList(id);
      return reply.send({ success: true, data: customers });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/:id/items - Aggiungi prezzo prodotto
   */
  server.post('/:id/items', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = createPriceListItemSchema.parse({ ...request.body, priceListId: id });
      const item = await priceListService.setPriceListItem(data);
      return reply.status(201).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /pricelists/:id/items/:productId - Rimuovi prezzo prodotto
   */
  server.delete('/:id/items/:productId', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id, productId } = request.params;
      await priceListService.removePriceListItem(id, productId);
      return reply.send({ success: true, message: 'Item removed' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/:id/categories - Aggiungi sconto categoria
   */
  server.post('/:id/categories', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = createCategoryDiscountSchema.parse({ ...request.body, priceListId: id });
      const discount = await priceListService.setCategoryDiscount(data);
      return reply.status(201).send({ success: true, data: discount });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /pricelists/:id/categories/:categoryId - Rimuovi sconto categoria
   */
  server.delete('/:id/categories/:categoryId', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id, categoryId } = request.params;
      await priceListService.removeCategoryDiscount(id, categoryId);
      return reply.send({ success: true, message: 'Category discount removed' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/:id/bulk-import - Import bulk prezzi
   */
  server.post('/:id/bulk-import', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = bulkPriceImportSchema.parse({ ...request.body, priceListId: id });
      const result = await priceListService.bulkImportPrices(data);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/assign - Assegna listino a cliente
   */
  server.post('/assign', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const data = assignPriceListSchema.parse(request.body);
      const customer = await priceListService.assignToCustomer(data.customerId, data.priceListId);
      return reply.send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/calculate - Calcola prezzo per cliente
   */
  server.post('/calculate', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const data = calculatePriceSchema.parse(request.body);
      const result = await priceListService.calculatePrice(
        data.customerId,
        data.productId,
        data.quantity
      );
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /pricelists/calculate-order - Calcola prezzi per ordine completo
   */
  server.post('/calculate-order', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { customerId, items } = request.body;
      if (!customerId || !items || !Array.isArray(items)) {
        return reply.status(400).send({ success: false, error: 'Invalid request' });
      }
      const result = await priceListService.calculateOrderPrices(customerId, items);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });
};

export default priceListRoutes;
