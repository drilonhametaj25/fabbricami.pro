import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { exportService } from '../services/export.service';

const exportRoutes: FastifyPluginAsync = async (server: any) => {
  // =============================================
  // PDF EXPORTS
  // =============================================

  /**
   * GET /export/invoice/:invoiceId/pdf
   * Genera PDF fattura
   */
  server.get('/invoice/:invoiceId/pdf', async (
    request: FastifyRequest<{ Params: { invoiceId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { invoiceId } = request.params;
      const pdfBuffer = await exportService.generateInvoicePdf(invoiceId);

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="fattura-${invoiceId}.pdf"`)
        .send(pdfBuffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // EXCEL EXPORTS
  // =============================================

  /**
   * GET /export/products/excel
   * Esporta prodotti in Excel
   */
  server.get('/products/excel', async (
    request: FastifyRequest<{ Querystring: { category?: string; isActive?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { category, isActive } = request.query;
      const buffer = await exportService.generateProductsExcel({
        category,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="prodotti-${new Date().toISOString().split('T')[0]}.xlsx"`)
        .send(buffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /export/orders/excel
   * Esporta ordini in Excel
   */
  server.get('/orders/excel', async (
    request: FastifyRequest<{ Querystring: { dateFrom?: string; dateTo?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { dateFrom, dateTo } = request.query;

      const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 1));
      const to = dateTo ? new Date(dateTo) : new Date();

      const buffer = await exportService.generateOrdersExcel(from, to);

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="ordini-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.xlsx"`)
        .send(buffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /export/inventory/excel
   * Esporta inventario in Excel
   */
  server.get('/inventory/excel', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const buffer = await exportService.generateInventoryExcel();

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="inventario-${new Date().toISOString().split('T')[0]}.xlsx"`)
        .send(buffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /export/invoices/excel
   * Esporta fatture/scadenzario in Excel
   */
  server.get('/invoices/excel', async (
    request: FastifyRequest<{ Querystring: { dateFrom?: string; dateTo?: string; type?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { dateFrom, dateTo, type } = request.query;

      const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 3));
      const to = dateTo ? new Date(dateTo) : new Date();

      const buffer = await exportService.generateInvoicesExcel(
        from,
        to,
        type as 'receivable' | 'payable' | undefined
      );

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="fatture-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.xlsx"`)
        .send(buffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /export/sales-analytics/excel
   * Esporta analytics vendite in Excel
   */
  server.get('/sales-analytics/excel', async (
    request: FastifyRequest<{ Querystring: { dateFrom?: string; dateTo?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { dateFrom, dateTo } = request.query;

      const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 6));
      const to = dateTo ? new Date(dateTo) : new Date();

      const buffer = await exportService.generateSalesAnalyticsExcel(from, to);

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="analytics-vendite-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.xlsx"`)
        .send(buffer);

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default exportRoutes;
