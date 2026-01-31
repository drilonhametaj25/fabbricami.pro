import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { goodsReceiptService } from '../services/goods-receipt.service';
import {
  goodsReceiptQuerySchema,
  createGoodsReceiptSchema,
  updateGoodsReceiptSchema,
  receiveItemsSchema,
  inspectionSchema,
  attachmentSchema,
  cancelReceiptSchema,
} from '../schemas/goods-receipt.schema';

const goodsReceiptRoutes: FastifyPluginAsync = async (server: any) => {
  /**
   * GET /api/v1/goods-receipts
   * Lista entrate merce con filtri e paginazione
   */
  server.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = goodsReceiptQuerySchema.parse(request.query);
      const result = await goodsReceiptService.listGoodsReceipts(query);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to list goods receipts',
      });
    }
  });

  /**
   * GET /api/v1/goods-receipts/:id
   * Dettaglio entrata merce
   */
  server.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const receipt = await goodsReceiptService.getGoodsReceiptById(id);
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      if (error.message === 'Entrata merce non trovata') {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to get goods receipt',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts
   * Crea entrata merce da ordine d'acquisto
   */
  server.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createGoodsReceiptSchema.parse(request.body);
      const receipt = await goodsReceiptService.createGoodsReceipt({
        ...data,
        documentDate: data.documentDate ? new Date(data.documentDate) : undefined,
        items: data.items.map((item) => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        })),
      });
      return reply.status(201).send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create goods receipt',
      });
    }
  });

  /**
   * PUT /api/v1/goods-receipts/:id
   * Aggiorna entrata merce
   */
  server.put('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateGoodsReceiptSchema.parse(request.body);
      const receipt = await goodsReceiptService.updateGoodsReceipt(id, {
        ...data,
        documentDate: data.documentDate ? new Date(data.documentDate) : undefined,
      });
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to update goods receipt',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts/:id/receive
   * Ricevi articoli (ricezione parziale o totale)
   */
  server.post('/:id/receive', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = receiveItemsSchema.parse(request.body);
      const receipt = await goodsReceiptService.receiveItems(id, {
        items: data.items.map((item) => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        })),
      });
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to receive items',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts/:id/complete
   * Completa entrata merce e aggiorna inventario
   */
  server.post('/:id/complete', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const receipt = await goodsReceiptService.completeReceipt(id);
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to complete goods receipt',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts/:id/inspect
   * Registra ispezione qualità
   */
  server.post('/:id/inspect', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = inspectionSchema.parse(request.body);
      const receipt = await goodsReceiptService.recordInspection(id, data);
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to record inspection',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts/:id/attachments
   * Aggiungi allegato
   */
  server.post('/:id/attachments', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = attachmentSchema.parse(request.body);
      const receipt = await goodsReceiptService.addAttachment(id, data);
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to add attachment',
      });
    }
  });

  /**
   * POST /api/v1/goods-receipts/:id/cancel
   * Annulla entrata merce
   */
  server.post('/:id/cancel', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = cancelReceiptSchema.parse(request.body);
      const receipt = await goodsReceiptService.cancelReceipt(id, data.reason);
      return reply.send({ success: true, data: receipt });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to cancel goods receipt',
      });
    }
  });
};

export default goodsReceiptRoutes;
