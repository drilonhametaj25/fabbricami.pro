import { FastifyPluginAsync } from 'fastify';
import shopShippingService from '../services/shop-shipping.service';
import { successResponse, errorResponse } from '../utils/response.util';

/**
 * Shop Shipping Routes
 * API pubbliche per calcolo spedizioni e-commerce
 */
const shopShippingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/shop/shipping/calculate
   * Calcola metodi di spedizione disponibili
   */
  fastify.post<{
    Body: {
      country: string;
      state?: string;
      postcode?: string;
      city?: string;
      orderTotal: number;
      totalWeight?: number;
    };
  }>('/calculate', async (request, reply) => {
    try {
      const { country, state, postcode, city, orderTotal, totalWeight } = request.body;

      const methods = await shopShippingService.calculateShipping(
        { country, state, postcode, city },
        orderTotal,
        totalWeight || 0
      );

      return successResponse(reply, {
        methods,
        cheapest: methods.length > 0
          ? methods.reduce((min, m) => m.cost < min.cost ? m : min)
          : null,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  /**
   * GET /api/v1/shop/shipping/zones
   * Lista zone spedizione pubbliche
   */
  fastify.get('/zones', async (_request, reply) => {
    try {
      const zones = await shopShippingService.listZones(false);

      // Filtra informazioni sensibili
      const publicZones = zones.map(z => ({
        id: z.id,
        name: z.name,
        countries: z.countries,
      }));

      return successResponse(reply, publicZones);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/shipping/zone/:country
   * Ottiene zona per paese
   */
  fastify.get<{
    Params: { country: string };
    Querystring: { state?: string; postcode?: string };
  }>('/zone/:country', async (request, reply) => {
    try {
      const { country } = request.params;
      const { state, postcode } = request.query;

      const zone = await shopShippingService.findZoneForAddress({
        country,
        state,
        postcode,
      });

      if (!zone) {
        return errorResponse(reply, 'Zona non trovata per questo indirizzo', 404);
      }

      return successResponse(reply, {
        id: zone.id,
        name: zone.name,
      });
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });

  /**
   * GET /api/v1/shop/shipping/methods/:zoneId
   * Lista metodi spedizione per zona
   */
  fastify.get<{
    Params: { zoneId: string };
  }>('/methods/:zoneId', async (request, reply) => {
    try {
      const methods = await shopShippingService.listMethodsByZone(
        request.params.zoneId,
        false
      );

      const publicMethods = methods.map(m => ({
        id: m.id,
        name: m.name,
        carrier: m.carrier,
        type: m.type,
        baseCost: m.baseCost,
        freeAboveAmount: m.freeAboveAmount,
        estimatedDaysMin: m.estimatedDaysMin,
        estimatedDaysMax: m.estimatedDaysMax,
        description: m.description,
        logoUrl: m.logoUrl,
      }));

      return successResponse(reply, publicMethods);
    } catch (error: any) {
      return errorResponse(reply, error.message, 500);
    }
  });
};

export default shopShippingRoutes;
