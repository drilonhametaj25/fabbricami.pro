import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.middleware';
import { prisma } from '../config/database';
import {
  companySettingsSchema,
  createWarehouseSchema,
} from '../schemas/onboarding.schema';

// ============================================
// ONBOARDING STATUS TYPES
// ============================================

type OnboardingStep = 'verify-email' | 'company-settings' | 'wordpress-integration' | 'create-warehouse' | 'complete';

interface OnboardingStatus {
  emailVerified: boolean;
  companySettingsComplete: boolean;
  wordpressIntegrationComplete: boolean;
  firstWarehouseCreated: boolean;
  currentStep: OnboardingStep;
  completedSteps: string[];
}

// ============================================
// ONBOARDING ROUTES
// ============================================

const onboardingRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /onboarding/status
   * Get current onboarding status
   */
  server.get(
    '/status',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const currentUser = (request as any).user;

      // Get user email verification status
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { emailVerified: true },
      });

      // Check if company settings exist
      const companySettings = await prisma.companySettings.findFirst({
        where: { tenantId: tenantRequest.tenant.tenantId },
      });

      // Check if at least one warehouse exists
      const warehouseCount = await prisma.warehouse.count({
        where: { tenantId: tenantRequest.tenant.tenantId },
      });

      // Check if WordPress integration was configured or skipped
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantRequest.tenant.tenantId },
      });
      const tenantSettings = (tenant?.settings as Record<string, unknown>) || {};
      const wordpressIntegrationComplete = !!tenantSettings.wordpressConfigured || !!tenantSettings.wordpressSkipped;

      const emailVerified = user?.emailVerified ?? false;
      const companySettingsComplete = !!companySettings;
      const firstWarehouseCreated = warehouseCount > 0;

      // Determine current step
      let currentStep: OnboardingStep;
      const completedSteps: string[] = [];

      if (!emailVerified) {
        currentStep = 'verify-email';
      } else {
        completedSteps.push('verify-email');

        if (!companySettingsComplete) {
          currentStep = 'company-settings';
        } else {
          completedSteps.push('company-settings');

          if (!wordpressIntegrationComplete) {
            currentStep = 'wordpress-integration';
          } else {
            completedSteps.push('wordpress-integration');

            if (!firstWarehouseCreated) {
              currentStep = 'create-warehouse';
            } else {
              completedSteps.push('create-warehouse');
              currentStep = 'complete';
            }
          }
        }
      }

      const status: OnboardingStatus = {
        emailVerified,
        companySettingsComplete,
        wordpressIntegrationComplete,
        firstWarehouseCreated,
        currentStep,
        completedSteps,
      };

      return reply.send({
        success: true,
        data: status,
      });
    }
  );

  /**
   * POST /onboarding/company-settings
   * Create or update company settings during onboarding
   */
  server.post(
    '/company-settings',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const body = companySettingsSchema.body.parse(request.body);

        // Check if settings already exist
        const existing = await prisma.companySettings.findFirst({
          where: { tenantId: tenantRequest.tenant.tenantId },
        });

        let companySettings;

        if (existing) {
          // Update existing
          companySettings = await prisma.companySettings.update({
            where: { id: existing.id },
            data: {
              companyName: body.companyName,
              legalName: body.legalName,
              vatNumber: body.vatNumber,
              fiscalCode: body.fiscalCode,
              address: body.street,
              city: body.city,
              province: body.province,
              postalCode: body.postalCode,
              country: body.country,
              phone: body.phone,
              email: body.email,
              pec: body.pec,
              sdiCode: body.sdiCode,
              bankName: body.bankName,
              iban: body.iban,
              bic: body.swift,
              logoUrl: body.logo,
            },
          });
        } else {
          // Create new
          companySettings = await prisma.companySettings.create({
            data: {
              tenantId: tenantRequest.tenant.tenantId,
              companyName: body.companyName,
              legalName: body.legalName,
              vatNumber: body.vatNumber,
              fiscalCode: body.fiscalCode,
              address: body.street,
              city: body.city,
              province: body.province,
              postalCode: body.postalCode,
              country: body.country,
              phone: body.phone,
              email: body.email || body.companyName + '@example.com',
              pec: body.pec,
              sdiCode: body.sdiCode,
              bankName: body.bankName,
              iban: body.iban,
              bic: body.swift,
              logoUrl: body.logo,
            },
          });
        }

        // Also update tenant name to match company name
        await prisma.tenant.update({
          where: { id: tenantRequest.tenant.tenantId },
          data: { name: body.companyName },
        });

        return reply.send({
          success: true,
          data: companySettings,
        });
      } catch (error) {
        console.error('Company settings error:', error);
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore salvataggio impostazioni',
        });
      }
    }
  );

  /**
   * GET /onboarding/company-settings
   * Get current company settings
   */
  server.get(
    '/company-settings',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      const companySettings = await prisma.companySettings.findFirst({
        where: { tenantId: tenantRequest.tenant.tenantId },
      });

      return reply.send({
        success: true,
        data: companySettings,
      });
    }
  );

  /**
   * POST /onboarding/first-warehouse
   * Create first warehouse during onboarding
   */
  server.post(
    '/first-warehouse',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const body = createWarehouseSchema.body.parse(request.body);

        // Check if any warehouse exists
        const existingCount = await prisma.warehouse.count({
          where: { tenantId: tenantRequest.tenant.tenantId },
        });

        if (existingCount > 0) {
          return reply.status(400).send({
            success: false,
            error: 'Un magazzino esiste già. Usa l\'endpoint standard per crearne altri.',
          });
        }

        // Build address object if provided
        const address = body.street ? {
          street: body.street,
          city: body.city || '',
          province: body.province || '',
          postalCode: body.postalCode || '',
          country: body.country || 'IT',
        } : undefined;

        // Create warehouse
        const warehouse = await prisma.warehouse.create({
          data: {
            tenantId: tenantRequest.tenant.tenantId,
            name: body.name,
            code: body.code.toUpperCase(),
            address,
            isActive: true,
            isPrimary: true,
          },
        });

        return reply.status(201).send({
          success: true,
          data: warehouse,
        });
      } catch (error) {
        console.error('Create warehouse error:', error);
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore creazione magazzino',
        });
      }
    }
  );

  /**
   * POST /onboarding/skip-warehouse
   * Skip warehouse creation step
   */
  server.post(
    '/skip-warehouse',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      // Create a default warehouse so onboarding is complete
      const existingCount = await prisma.warehouse.count({
        where: { tenantId: tenantRequest.tenant.tenantId },
      });

      if (existingCount === 0) {
        // Create default warehouse
        await prisma.warehouse.create({
          data: {
            tenantId: tenantRequest.tenant.tenantId,
            name: 'Magazzino Principale',
            code: 'MAIN',
            isActive: true,
            isPrimary: true,
          },
        });
      }

      return reply.send({
        success: true,
        data: { message: 'Magazzino di default creato' },
      });
    }
  );

  /**
   * POST /onboarding/wordpress-integration
   * Save WordPress/WooCommerce integration settings
   */
  server.post(
    '/wordpress-integration',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      try {
        const tenantRequest = request as TenantRequest;
        const body = request.body as {
          enabled: boolean;
          siteUrl?: string;
          consumerKey?: string;
          consumerSecret?: string;
        };

        // Get current tenant settings
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantRequest.tenant.tenantId },
        });

        const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

        if (body.enabled) {
          // Save WordPress configuration
          const newSettings = {
            ...currentSettings,
            wordpressConfigured: true,
            wordpressSkipped: false,
            wordpress: {
              enabled: true,
              siteUrl: body.siteUrl,
              consumerKey: body.consumerKey,
              // Store consumer secret securely (in production, encrypt this)
              consumerSecret: body.consumerSecret,
              configuredAt: new Date().toISOString(),
            },
          };

          await prisma.tenant.update({
            where: { id: tenantRequest.tenant.tenantId },
            data: { settings: newSettings },
          });
        } else {
          // Mark as skipped
          const newSettings = {
            ...currentSettings,
            wordpressConfigured: false,
            wordpressSkipped: true,
          };

          await prisma.tenant.update({
            where: { id: tenantRequest.tenant.tenantId },
            data: { settings: newSettings },
          });
        }

        return reply.send({
          success: true,
          data: { message: 'Configurazione WordPress salvata' },
        });
      } catch (error) {
        console.error('WordPress integration error:', error);
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Errore salvataggio configurazione',
        });
      }
    }
  );

  /**
   * POST /onboarding/skip-wordpress
   * Skip WordPress integration step
   */
  server.post(
    '/skip-wordpress',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      // Get current tenant settings
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantRequest.tenant.tenantId },
      });

      const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
      const newSettings = {
        ...currentSettings,
        wordpressConfigured: false,
        wordpressSkipped: true,
      };

      await prisma.tenant.update({
        where: { id: tenantRequest.tenant.tenantId },
        data: { settings: newSettings },
      });

      return reply.send({
        success: true,
        data: { message: 'Integrazione WordPress saltata' },
      });
    }
  );

  /**
   * POST /onboarding/test-wordpress
   * Test WordPress/WooCommerce connection
   */
  server.post(
    '/test-wordpress',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      try {
        const body = request.body as {
          siteUrl?: string;
          consumerKey?: string;
          consumerSecret?: string;
        };

        if (!body.siteUrl || !body.consumerKey || !body.consumerSecret) {
          return reply.send({
            success: true,
            data: {
              valid: false,
              message: 'Tutti i campi sono obbligatori',
            },
          });
        }

        // Normalize URL
        let url = body.siteUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        if (url.endsWith('/')) {
          url = url.slice(0, -1);
        }

        // Try to connect to WooCommerce REST API
        const testUrl = `${url}/wp-json/wc/v3/system_status`;
        const credentials = Buffer.from(`${body.consumerKey}:${body.consumerSecret}`).toString('base64');

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          return reply.send({
            success: true,
            data: {
              valid: true,
              message: 'Connessione riuscita! WooCommerce configurato correttamente.',
            },
          });
        } else if (response.status === 401) {
          return reply.send({
            success: true,
            data: {
              valid: false,
              message: 'Credenziali API non valide. Verifica Consumer Key e Secret.',
            },
          });
        } else if (response.status === 404) {
          return reply.send({
            success: true,
            data: {
              valid: false,
              message: 'WooCommerce REST API non trovata. Verifica che WooCommerce sia installato.',
            },
          });
        } else {
          return reply.send({
            success: true,
            data: {
              valid: false,
              message: `Errore connessione: ${response.status} ${response.statusText}`,
            },
          });
        }
      } catch (error) {
        console.error('WordPress test error:', error);
        return reply.send({
          success: true,
          data: {
            valid: false,
            message: error instanceof Error ? `Errore: ${error.message}` : 'Impossibile connettersi al sito',
          },
        });
      }
    }
  );

  /**
   * POST /onboarding/complete
   * Mark onboarding as complete (optional - can store in tenant settings)
   */
  server.post(
    '/complete',
    { preHandler: [authenticate, tenantMiddleware] },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;

      // Get current tenant settings
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantRequest.tenant.tenantId },
      });

      // Update tenant settings to mark onboarding complete
      const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
      const newSettings = {
        ...currentSettings,
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString(),
      };

      await prisma.tenant.update({
        where: { id: tenantRequest.tenant.tenantId },
        data: { settings: newSettings },
      });

      return reply.send({
        success: true,
        data: { message: 'Onboarding completato' },
      });
    }
  );
};

export default onboardingRoutes;
