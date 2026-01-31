import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { accountingService } from '../services/accounting.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  createPaymentSchema,
  invoiceQuerySchema,
  createOverheadCostSchema,
  createPaymentPlanSchema,
  createPaymentDueSchemaV2,
  updatePaymentDueSchemaV2,
  recordPaymentDuePaymentSchema,
  generateDuesFromInvoiceSchema,
  paymentDueQuerySchemaV2,
} from '../schemas/accounting.schema';

const accountingRoutes: FastifyPluginAsync = async (server: any) => {
  // ============================================
  // INVOICES (Fatture)
  // ============================================

  /**
   * GET /api/v1/accounting/invoices
   * Lista fatture con filtri e paginazione
   */
  server.get('/invoices', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = invoiceQuerySchema.parse(request.query);
      const result = await accountingService.listInvoices(query);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list invoices',
      });
    }
  });

  /**
   * GET /api/v1/accounting/invoices/:id
   * Dettaglio fattura
   */
  server.get('/invoices/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await accountingService.getInvoiceById(id);

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found',
        });
      }

      return reply.send({ success: true, data: invoice });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get invoice',
      });
    }
  });

  /**
   * POST /api/v1/accounting/invoices
   * Crea fattura manuale
   */
  server.post('/invoices', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createInvoiceSchema.parse(request.body);
      const invoice = await accountingService.createInvoice(data);
      return reply.status(201).send({ success: true, data: invoice });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create invoice',
      });
    }
  });

  /**
   * POST /api/v1/accounting/invoices/from-order/:orderId
   * Crea fattura da ordine
   */
  server.post('/invoices/from-order/:orderId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const invoice = await accountingService.createInvoiceFromOrder(orderId);
      return reply.status(201).send({ success: true, data: invoice });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create invoice from order',
      });
    }
  });

  /**
   * PUT /api/v1/accounting/invoices/:id
   * Aggiorna fattura
   */
  server.put('/invoices/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateInvoiceSchema.parse(request.body);
      const invoice = await accountingService.updateInvoice(id, data);
      return reply.send({ success: true, data: invoice });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update invoice',
      });
    }
  });

  /**
   * POST /api/v1/accounting/invoices/:id/generate-dues
   * Genera scadenze da fattura con piano di pagamento
   */
  server.post('/invoices/:id/generate-dues', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = generateDuesFromInvoiceSchema.parse(request.body || {});
      const paymentDues = await accountingService.createPaymentDuesFromInvoice(id, data.paymentPlanId);
      return reply.status(201).send({ success: true, data: paymentDues });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to generate payment dues from invoice',
      });
    }
  });

  // ============================================
  // PAYMENTS (Pagamenti su fatture)
  // ============================================

  /**
   * POST /api/v1/accounting/payments
   * Registra pagamento su fattura
   */
  server.post('/payments', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPaymentSchema.parse(request.body);
      const payment = await accountingService.recordPayment(data);
      return reply.status(201).send({ success: true, data: payment });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to record payment',
      });
    }
  });

  // ============================================
  // PAYMENT PLANS (Piani di Pagamento)
  // ============================================

  /**
   * GET /api/v1/accounting/payment-plans
   * Lista piani di pagamento
   */
  server.get('/payment-plans', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { activeOnly } = request.query as { activeOnly?: string };
      const plans = await accountingService.listPaymentPlans(activeOnly !== 'false');
      return reply.send({ success: true, data: plans });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list payment plans',
      });
    }
  });

  /**
   * GET /api/v1/accounting/payment-plans/:id
   * Dettaglio piano di pagamento
   */
  server.get('/payment-plans/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const plan = await accountingService.getPaymentPlanById(id);

      if (!plan) {
        return reply.status(404).send({
          success: false,
          error: 'Payment plan not found',
        });
      }

      return reply.send({ success: true, data: plan });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get payment plan',
      });
    }
  });

  /**
   * POST /api/v1/accounting/payment-plans
   * Crea piano di pagamento
   */
  server.post('/payment-plans', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPaymentPlanSchema.parse(request.body);
      const plan = await accountingService.createPaymentPlan(data);
      return reply.status(201).send({ success: true, data: plan });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create payment plan',
      });
    }
  });

  /**
   * DELETE /api/v1/accounting/payment-plans/:id
   * Elimina (disattiva) piano di pagamento
   */
  server.delete('/payment-plans/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const plan = await accountingService.deletePaymentPlan(id);
      return reply.send({ success: true, data: plan });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to delete payment plan',
      });
    }
  });

  // ============================================
  // PAYMENT DUES (Scadenzario)
  // ============================================

  /**
   * GET /api/v1/accounting/payment-dues
   * Lista scadenze con filtri e paginazione
   */
  server.get('/payment-dues', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = paymentDueQuerySchemaV2.parse(request.query);
      const result = await accountingService.listPaymentDues(query);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list payment dues',
      });
    }
  });

  /**
   * GET /api/v1/accounting/payment-dues/:id
   * Dettaglio scadenza
   */
  server.get('/payment-dues/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const paymentDue = await accountingService.getPaymentDueById(id);
      return reply.send({ success: true, data: paymentDue });
    } catch (error: any) {
      if (error.message === 'Scadenza non trovata') {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get payment due',
      });
    }
  });

  /**
   * POST /api/v1/accounting/payment-dues
   * Crea scadenza manuale
   */
  server.post('/payment-dues', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPaymentDueSchemaV2.parse(request.body);
      const paymentDue = await accountingService.createPaymentDue({
        ...data,
        dueDate: new Date(data.dueDate),
      });
      return reply.status(201).send({ success: true, data: paymentDue });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create payment due',
      });
    }
  });

  /**
   * PATCH /api/v1/accounting/payment-dues/:id
   * Aggiorna scadenza
   */
  server.patch('/payment-dues/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updatePaymentDueSchemaV2.parse(request.body);
      const updateData: any = { ...data };
      if (data.dueDate) {
        updateData.dueDate = new Date(data.dueDate);
      }
      const paymentDue = await accountingService.updatePaymentDue(id, updateData);
      return reply.send({ success: true, data: paymentDue });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update payment due',
      });
    }
  });

  /**
   * DELETE /api/v1/accounting/payment-dues/:id
   * Elimina scadenza
   */
  server.delete('/payment-dues/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await accountingService.deletePaymentDue(id);
      return reply.send({ success: true, message: 'Payment due deleted successfully' });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to delete payment due',
      });
    }
  });

  /**
   * POST /api/v1/accounting/payment-dues/:id/payments
   * Registra pagamento su scadenza
   */
  server.post('/payment-dues/:id/payments', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = recordPaymentDuePaymentSchema.parse(request.body);
      const result = await accountingService.recordPaymentDuePayment({
        paymentDueId: id,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to record payment due payment',
      });
    }
  });

  // ============================================
  // RECEIVABLES & PAYABLES (Scadenzario legacy)
  // ============================================

  /**
   * GET /api/v1/accounting/receivables
   * Crediti (fatture da incassare)
   */
  server.get('/receivables', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { overdue, daysRange } = request.query as { overdue?: string; daysRange?: string };
      const receivables = await accountingService.getReceivables({
        overdue: overdue === 'true',
        daysRange: daysRange ? parseInt(daysRange, 10) : undefined,
      });
      return reply.send({ success: true, data: receivables });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get receivables',
      });
    }
  });

  /**
   * GET /api/v1/accounting/payables
   * Debiti (fatture da pagare)
   */
  server.get('/payables', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { overdue, daysRange } = request.query as { overdue?: string; daysRange?: string };
      const payables = await accountingService.getPayables({
        overdue: overdue === 'true',
        daysRange: daysRange ? parseInt(daysRange, 10) : undefined,
      });
      return reply.send({ success: true, data: payables });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get payables',
      });
    }
  });

  // ============================================
  // OVERHEAD COSTS (Costi Generali)
  // ============================================

  /**
   * GET /api/v1/accounting/general-costs
   * Lista costi generali per periodo
   */
  server.get('/general-costs', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { year, month } = request.query as { year?: string; month?: string };
      const currentYear = new Date().getFullYear();
      const costs = await accountingService.getOverheadCosts(
        year ? parseInt(year, 10) : currentYear,
        month ? parseInt(month, 10) : undefined
      );
      return reply.send({ success: true, data: costs });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get overhead costs',
      });
    }
  });

  /**
   * POST /api/v1/accounting/general-costs
   * Crea costo generale
   */
  server.post('/general-costs', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createOverheadCostSchema.parse(request.body);
      const cost = await accountingService.createOverheadCost(data);
      return reply.status(201).send({ success: true, data: cost });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create overhead cost',
      });
    }
  });

  /**
   * POST /api/v1/accounting/allocate-overhead
   * Ripartizione costi generali su prodotti
   */
  server.post('/allocate-overhead', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { year, month, method } = request.body as {
        year: number;
        month: number;
        method: 'LABOR_HOURS' | 'PRODUCTION_VOLUME' | 'EQUAL';
      };
      const allocation = await accountingService.allocateOverheadCosts(year, month, method);
      return reply.send({ success: true, data: allocation });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to allocate overhead costs',
      });
    }
  });

  // ============================================
  // FINANCIAL DASHBOARD & REPORTS
  // ============================================

  /**
   * GET /api/v1/accounting/dashboard
   * Dashboard finanziaria
   */
  server.get('/dashboard', { preHandler: authenticate }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = await accountingService.getFinancialDashboard();
      return reply.send({ success: true, data: dashboard });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get financial dashboard',
      });
    }
  });

  /**
   * GET /api/v1/accounting/aging/:type
   * Report aging per tipo (RECEIVABLE o PAYABLE)
   */
  server.get('/aging/:type', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type } = request.params as { type: 'RECEIVABLE' | 'PAYABLE' };
      if (type !== 'RECEIVABLE' && type !== 'PAYABLE') {
        return reply.status(400).send({
          success: false,
          error: 'Type must be RECEIVABLE or PAYABLE',
        });
      }
      const report = await accountingService.getAgingReport(type);
      return reply.send({ success: true, data: report });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get aging report',
      });
    }
  });

  /**
   * GET /api/v1/accounting/break-even/:productId
   * Analisi break-even per prodotto
   */
  server.get('/break-even/:productId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = request.params as { productId: string };
      const { fixedCosts, period } = request.query as { fixedCosts?: string; period?: 'month' | 'year' };
      const analysis = await accountingService.calculateBreakEven(
        productId,
        fixedCosts ? parseFloat(fixedCosts) : 10000,
        period || 'month'
      );
      return reply.send({ success: true, data: analysis });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to calculate break-even',
      });
    }
  });

  // ============================================
  // CASH FLOW FORECASTING
  // ============================================

  /**
   * GET /api/v1/accounting/cash-flow/forecast
   * Previsione cash flow con 3 scenari (ottimistico, realistico, pessimistico)
   */
  server.get('/cash-flow/forecast', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { months } = request.query as { months?: string };
      const forecast = await accountingService.getCashFlowForecast(
        months ? parseInt(months, 10) : 6
      );
      return reply.send({ success: true, data: forecast });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get cash flow forecast',
      });
    }
  });

  // ============================================
  // FINANCIAL RECOMMENDATIONS
  // ============================================

  /**
   * GET /api/v1/accounting/recommendations
   * Raccomandazioni finanziarie intelligenti
   */
  server.get('/recommendations', { preHandler: authenticate }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const recommendations = await accountingService.getFinancialRecommendations();
      return reply.send({ success: true, data: recommendations });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get financial recommendations',
      });
    }
  });
};

export default accountingRoutes;
