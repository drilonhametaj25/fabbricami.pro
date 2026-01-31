import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { customerService } from '../services/customer.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  createContactSchema,
  updateContactSchema,
  createBankInfoSchema,
  updateBankInfoSchema,
  wpCustomerImportSchema,
} from '../schemas/customer.schema';

const customerRoutes: FastifyPluginAsync = async (server: any) => {
  /**
   * GET /customers - Lista clienti
   */
  server.get('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const query = customerQuerySchema.parse(request.query);
      const result = await customerService.listCustomers({
        page: query.page,
        limit: query.limit,
        type: query.type,
        search: query.search,
        isActive: query.isActive,
        customerGroup: query.customerGroup,
        priceListId: query.priceListId,
        hasOrders: query.hasOrders,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/top - Top clienti per spesa
   */
  server.get('/top', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { limit, type } = request.query;
      const customers = await customerService.getTopCustomers(
        limit ? parseInt(limit) : 10,
        type
      );
      return reply.send({ success: true, data: customers });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/inactive - Clienti inattivi
   */
  server.get('/inactive', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { days } = request.query;
      const customers = await customerService.getInactiveCustomers(
        days ? parseInt(days) : 180
      );
      return reply.send({ success: true, data: customers });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/segments - Segmentazione RFM
   */
  server.get('/segments', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      const segments = await customerService.segmentCustomers();
      return reply.send({ success: true, data: segments });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/:id - Dettaglio cliente
   */
  server.get('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const customer = await customerService.getCustomerById(id);
      if (!customer) {
        return reply.status(404).send({ success: false, error: 'Customer not found' });
      }
      return reply.send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /customers - Crea cliente
   */
  server.post('/', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const data = createCustomerSchema.parse(request.body);
      const customer = await customerService.createCustomer(data);
      return reply.status(201).send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /customers/:id - Aggiorna cliente
   */
  server.put('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = updateCustomerSchema.parse(request.body);
      const customer = await customerService.updateCustomer(id, data);
      return reply.send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /customers/:id - Elimina cliente (soft delete)
   */
  server.delete('/:id', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      await customerService.deleteCustomer(id);
      return reply.send({ success: true, message: 'Customer deleted' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/:id/stats - Statistiche cliente
   */
  server.get('/:id/stats', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const stats = await customerService.calculateCustomerStats(id);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /customers/:id/stats/refresh - Aggiorna statistiche cliente
   */
  server.post('/:id/stats/refresh', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const customer = await customerService.updateCustomerStats(id);
      return reply.send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ==================
  // CONTACTS (B2B)
  // ==================

  /**
   * GET /customers/:id/contacts - Lista contatti cliente
   */
  server.get('/:id/contacts', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const contacts = await customerService.getContacts(id);
      return reply.send({ success: true, data: contacts });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /customers/:id/contacts - Aggiungi contatto
   */
  server.post('/:id/contacts', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = createContactSchema.parse({ ...request.body, customerId: id });
      const contact = await customerService.addContact(data);
      return reply.status(201).send({ success: true, data: contact });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /customers/:customerId/contacts/:contactId - Aggiorna contatto
   */
  server.put('/:customerId/contacts/:contactId', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { contactId } = request.params;
      const data = updateContactSchema.parse(request.body);
      const contact = await customerService.updateContact(contactId, data);
      return reply.send({ success: true, data: contact });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /customers/:customerId/contacts/:contactId - Elimina contatto
   */
  server.delete('/:customerId/contacts/:contactId', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { contactId } = request.params;
      await customerService.deleteContact(contactId);
      return reply.send({ success: true, message: 'Contact deleted' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ==================
  // BANK INFO (B2B)
  // ==================

  /**
   * POST /customers/:id/bank-info - Imposta info bancarie
   */
  server.post('/:id/bank-info', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = createBankInfoSchema.parse({ ...request.body, customerId: id });
      const bankInfo = await customerService.setBankInfo(data);
      return reply.status(201).send({ success: true, data: bankInfo });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /customers/:id/bank-info - Aggiorna info bancarie
   */
  server.put('/:id/bank-info', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const data = updateBankInfoSchema.parse(request.body);
      const bankInfo = await customerService.updateBankInfo(id, data);
      return reply.send({ success: true, data: bankInfo });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /customers/:id/bank-info - Elimina info bancarie
   */
  server.delete('/:id/bank-info', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      await customerService.deleteBankInfo(id);
      return reply.send({ success: true, message: 'Bank info deleted' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ==================
  // WORDPRESS IMPORT
  // ==================

  /**
   * POST /customers/import/wordpress - Import cliente da WordPress
   */
  server.post('/import/wordpress', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const data = wpCustomerImportSchema.parse(request.body);
      const customer = await customerService.importFromWordPress(data);
      return reply.status(201).send({ success: true, data: customer });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ==================
  // ANALYTICS
  // ==================

  /**
   * GET /customers/analytics/global - Analytics globale clienti
   */
  server.get('/analytics/global', { preHandler: authenticate }, async (_request: any, reply: any) => {
    try {
      const analytics = await customerService.getGlobalCustomerAnalytics();
      return reply.send({ success: true, data: analytics });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/:id/analytics - Analytics dettagliato cliente
   */
  server.get('/:id/analytics', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const analytics = await customerService.getCustomerDetailedAnalytics(id);
      return reply.send({ success: true, data: analytics });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/:id/top-products - Prodotti più acquistati dal cliente
   */
  server.get('/:id/top-products', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const { limit } = request.query;
      const products = await customerService.getCustomerTopProducts(id, limit ? parseInt(limit) : 10);
      return reply.send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /customers/:id/orders - Storico ordini cliente con paginazione
   */
  server.get('/:id/orders', { preHandler: authenticate }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const { page, limit, status, dateFrom, dateTo } = request.query;
      const orders = await customerService.getCustomerOrderHistory(id, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        status,
        dateFrom,
        dateTo,
      });
      return reply.send({ success: true, data: orders });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
};

export default customerRoutes;
