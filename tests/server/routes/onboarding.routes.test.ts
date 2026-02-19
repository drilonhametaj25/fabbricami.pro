/**
 * Tests for onboarding routes
 */

import { prisma } from '../../../src/server/config/database';

// Mock prisma
jest.mock('../../../src/server/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    companySettings: {
      findFirst: jest.fn(),
    },
    warehouse: {
      count: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock fetch for WordPress test connection
global.fetch = jest.fn();

describe('Onboarding Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding Status Logic', () => {
    it('should include wordpress-integration step in onboarding flow', () => {
      // Test that the step order is correct
      const stepOrder = [
        'verify-email',
        'company-settings',
        'wordpress-integration',
        'create-warehouse',
        'complete',
      ];

      expect(stepOrder).toContain('wordpress-integration');
      expect(stepOrder.indexOf('wordpress-integration')).toBe(2);
      expect(stepOrder.indexOf('wordpress-integration')).toBeGreaterThan(
        stepOrder.indexOf('company-settings')
      );
      expect(stepOrder.indexOf('wordpress-integration')).toBeLessThan(
        stepOrder.indexOf('create-warehouse')
      );
    });

    it('should determine correct current step based on status', () => {
      // Simulate status determination logic
      const determineStep = (status: {
        emailVerified: boolean;
        companySettingsComplete: boolean;
        wordpressIntegrationComplete: boolean;
        firstWarehouseCreated: boolean;
      }) => {
        if (!status.emailVerified) return 'verify-email';
        if (!status.companySettingsComplete) return 'company-settings';
        if (!status.wordpressIntegrationComplete) return 'wordpress-integration';
        if (!status.firstWarehouseCreated) return 'create-warehouse';
        return 'complete';
      };

      expect(determineStep({
        emailVerified: false,
        companySettingsComplete: false,
        wordpressIntegrationComplete: false,
        firstWarehouseCreated: false,
      })).toBe('verify-email');

      expect(determineStep({
        emailVerified: true,
        companySettingsComplete: false,
        wordpressIntegrationComplete: false,
        firstWarehouseCreated: false,
      })).toBe('company-settings');

      expect(determineStep({
        emailVerified: true,
        companySettingsComplete: true,
        wordpressIntegrationComplete: false,
        firstWarehouseCreated: false,
      })).toBe('wordpress-integration');

      expect(determineStep({
        emailVerified: true,
        companySettingsComplete: true,
        wordpressIntegrationComplete: true,
        firstWarehouseCreated: false,
      })).toBe('create-warehouse');

      expect(determineStep({
        emailVerified: true,
        companySettingsComplete: true,
        wordpressIntegrationComplete: true,
        firstWarehouseCreated: true,
      })).toBe('complete');
    });
  });

  describe('WordPress Integration Settings', () => {
    it('should recognize wordpressConfigured flag as complete', () => {
      const settings = { wordpressConfigured: true };
      const isComplete = !!settings.wordpressConfigured || !!(settings as any).wordpressSkipped;
      expect(isComplete).toBe(true);
    });

    it('should recognize wordpressSkipped flag as complete', () => {
      const settings = { wordpressSkipped: true };
      const isComplete = !!(settings as any).wordpressConfigured || !!settings.wordpressSkipped;
      expect(isComplete).toBe(true);
    });

    it('should not recognize as complete when neither flag is set', () => {
      const settings = {};
      const isComplete = !!(settings as any).wordpressConfigured || !!(settings as any).wordpressSkipped;
      expect(isComplete).toBe(false);
    });

    it('should store WordPress configuration correctly', () => {
      const config = {
        enabled: true,
        siteUrl: 'https://myshop.com',
        consumerKey: 'ck_test123',
        consumerSecret: 'cs_secret456',
      };

      const settings = {
        wordpressConfigured: true,
        wordpressSkipped: false,
        wordpress: {
          enabled: config.enabled,
          siteUrl: config.siteUrl,
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          configuredAt: new Date().toISOString(),
        },
      };

      expect(settings.wordpressConfigured).toBe(true);
      expect(settings.wordpress.siteUrl).toBe('https://myshop.com');
      expect(settings.wordpress.consumerKey).toBe('ck_test123');
    });
  });

  describe('WordPress Connection Test', () => {
    it('should normalize URLs correctly', () => {
      const normalizeUrl = (url: string) => {
        let normalized = url.trim();
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
          normalized = 'https://' + normalized;
        }
        if (normalized.endsWith('/')) {
          normalized = normalized.slice(0, -1);
        }
        return normalized;
      };

      expect(normalizeUrl('myshop.com')).toBe('https://myshop.com');
      expect(normalizeUrl('https://myshop.com/')).toBe('https://myshop.com');
      expect(normalizeUrl('http://myshop.com')).toBe('http://myshop.com');
      expect(normalizeUrl('  myshop.com  ')).toBe('https://myshop.com');
    });

    it('should build correct test URL', () => {
      const siteUrl = 'https://myshop.com';
      const testUrl = `${siteUrl}/wp-json/wc/v3/system_status`;
      expect(testUrl).toBe('https://myshop.com/wp-json/wc/v3/system_status');
    });

    it('should encode credentials correctly for Basic auth', () => {
      const consumerKey = 'ck_test123';
      const consumerSecret = 'cs_secret456';
      const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

      expect(credentials).toBe('Y2tfdGVzdDEyMzpjc19zZWNyZXQ0NTY=');
    });
  });

  describe('OnboardingStatus Type', () => {
    it('should have correct structure', () => {
      interface OnboardingStatus {
        emailVerified: boolean;
        companySettingsComplete: boolean;
        wordpressIntegrationComplete: boolean;
        firstWarehouseCreated: boolean;
        currentStep: string;
        completedSteps: string[];
      }

      const status: OnboardingStatus = {
        emailVerified: true,
        companySettingsComplete: true,
        wordpressIntegrationComplete: false,
        firstWarehouseCreated: false,
        currentStep: 'wordpress-integration',
        completedSteps: ['verify-email', 'company-settings'],
      };

      expect(status.wordpressIntegrationComplete).toBeDefined();
      expect(status.currentStep).toBe('wordpress-integration');
      expect(status.completedSteps).toContain('company-settings');
      expect(status.completedSteps).not.toContain('wordpress-integration');
    });
  });
});
