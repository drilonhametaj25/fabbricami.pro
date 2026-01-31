/**
 * Dashboard Routes
 * API per la dashboard intelligente "Cosa fare oggi"
 */

import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';
import { suggestionEngineService } from '../services/suggestion-engine.service';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const kpisQuerySchema = z.object({
  dateRange: z.enum(['1d', '7d', '30d', '90d']).optional().default('7d'),
});

const suggestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  type: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['PENDING', 'DISMISSED', 'ACTED', 'EXPIRED', 'AUTO_RESOLVED']).optional().default('PENDING'),
});

const dismissSuggestionSchema = z.object({
  reason: z.string().optional(),
});

const preferencesSchema = z.object({
  layout: z.array(z.object({
    id: z.string(),
    position: z.number(),
    size: z.enum(['small', 'medium', 'large']),
    visible: z.boolean(),
  })).optional(),
  emailDailyDigest: z.boolean().optional(),
  emailWeeklyDigest: z.boolean().optional(),
  emailUrgentAlerts: z.boolean().optional(),
  showSuggestions: z.boolean().optional(),
  suggestionTypes: z.array(z.string()).optional(),
  defaultDateRange: z.enum(['1d', '7d', '30d', '90d']).optional(),
  showKpis: z.boolean().optional(),
  showUrgentTasks: z.boolean().optional(),
  showDayPlan: z.boolean().optional(),
  compactMode: z.boolean().optional(),
});

// ============================================
// ROUTES
// ============================================

const dashboardRoutes: FastifyPluginAsync = async (server: any) => {
  // ============================================
  // MAIN DASHBOARD
  // ============================================

  /**
   * GET /api/v1/dashboard/today
   * Recupera la dashboard completa "Cosa fare oggi"
   */
  server.get(
    '/today',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const dashboard = await dashboardService.getTodayDashboard(userId);

        return reply.send({
          success: true,
          data: dashboard,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore recupero dashboard',
        });
      }
    }
  );

  // ============================================
  // KPIs
  // ============================================

  /**
   * GET /api/v1/dashboard/kpis
   * Recupera KPI aggregati per periodo
   */
  server.get(
    '/kpis',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const query = kpisQuerySchema.parse(request.query);
        const kpis = await dashboardService.getKpis({
          dateRange: query.dateRange as '1d' | '7d' | '30d' | '90d',
          userId,
        });

        return reply.send({
          success: true,
          data: kpis,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore recupero KPIs',
        });
      }
    }
  );

  // ============================================
  // SUGGESTIONS
  // ============================================

  /**
   * GET /api/v1/dashboard/suggestions
   * Lista suggerimenti con filtri
   */
  server.get(
    '/suggestions',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const query = suggestionsQuerySchema.parse(request.query);

        const result = await suggestionEngineService.list({
          status: query.status as any,
          type: query.type as any,
          priority: query.priority as any,
          page: query.page,
          limit: query.limit,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore lista suggerimenti',
        });
      }
    }
  );

  /**
   * GET /api/v1/dashboard/suggestions/stats
   * Statistiche suggerimenti
   */
  server.get(
    '/suggestions/stats',
    { preHandler: authenticate },
    async (_request: any, reply: any) => {
      try {
        const stats = await suggestionEngineService.getStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore statistiche suggerimenti',
        });
      }
    }
  );

  /**
   * POST /api/v1/dashboard/suggestions/:id/dismiss
   * Scarta un suggerimento
   */
  server.post(
    '/suggestions/:id/dismiss',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const { id } = request.params;
        const body = dismissSuggestionSchema.parse(request.body || {});

        await suggestionEngineService.dismiss(id, userId, body.reason);

        return reply.send({
          success: true,
          message: 'Suggerimento scartato',
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore scarto suggerimento',
        });
      }
    }
  );

  /**
   * POST /api/v1/dashboard/suggestions/:id/act
   * Marca un suggerimento come "agito"
   */
  server.post(
    '/suggestions/:id/act',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const { id } = request.params;

        await suggestionEngineService.markActed(id, userId);

        return reply.send({
          success: true,
          message: 'Suggerimento segnato come completato',
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore azione suggerimento',
        });
      }
    }
  );

  /**
   * POST /api/v1/dashboard/suggestions/generate
   * Forza la generazione di nuovi suggerimenti (admin only)
   */
  server.post(
    '/suggestions/generate',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userRole = request.user?.role;

        if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
          return reply.status(403).send({
            success: false,
            error: 'Solo admin e manager possono generare suggerimenti',
          });
        }

        const result = await suggestionEngineService.runAllAlgorithms();

        return reply.send({
          success: true,
          data: result,
          message: `Generati ${result.created} suggerimenti`,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore generazione suggerimenti',
        });
      }
    }
  );

  // ============================================
  // PREFERENCES
  // ============================================

  /**
   * GET /api/v1/dashboard/preferences
   * Recupera preferenze dashboard utente
   */
  server.get(
    '/preferences',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const preferences = await dashboardService.getPreferences(userId);

        return reply.send({
          success: true,
          data: preferences,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore recupero preferenze',
        });
      }
    }
  );

  /**
   * PUT /api/v1/dashboard/preferences
   * Aggiorna preferenze dashboard utente
   */
  server.put(
    '/preferences',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const data = preferencesSchema.parse(request.body);
        const preferences = await dashboardService.updatePreferences(userId, data);

        return reply.send({
          success: true,
          data: preferences,
          message: 'Preferenze aggiornate',
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore aggiornamento preferenze',
        });
      }
    }
  );

  // ============================================
  // URGENT TASKS (standalone endpoint)
  // ============================================

  /**
   * GET /api/v1/dashboard/urgent-tasks
   * Recupera solo i task urgenti
   */
  server.get(
    '/urgent-tasks',
    { preHandler: authenticate },
    async (request: any, reply: any) => {
      try {
        const userId = request.user?.id;
        const userRole = request.user?.role;

        if (!userId || !userRole) {
          return reply.status(401).send({
            success: false,
            error: 'Utente non autenticato',
          });
        }

        const dashboard = await dashboardService.getTodayDashboard(userId);

        return reply.send({
          success: true,
          data: dashboard.urgentTasks,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message || 'Errore recupero task urgenti',
        });
      }
    }
  );
};

export default dashboardRoutes;
