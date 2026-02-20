/**
 * Stripe Configuration
 *
 * Simplified configuration - Price IDs are stored in the database
 * and managed through the admin panel, not environment variables.
 */

import { logger } from './logger';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  isConfigured: boolean;
  missingVars: string[];
}

/**
 * Get Stripe configuration from environment variables
 * Only requires the API keys, not price IDs (those come from DB)
 */
export function getStripeConfig(): StripeConfig {
  const missingVars: string[] = [];

  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

  // Check required keys
  if (!secretKey) missingVars.push('STRIPE_SECRET_KEY');
  if (!webhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET');

  // Publishable key is optional but recommended
  if (!publishableKey) {
    logger.warn('STRIPE_PUBLISHABLE_KEY not set - client-side Stripe features may not work');
  }

  return {
    secretKey,
    webhookSecret,
    publishableKey,
    isConfigured: secretKey !== '' && webhookSecret !== '',
    missingVars,
  };
}

/**
 * Validate Stripe configuration at startup
 */
export function validateStripeConfig(): void {
  const config = getStripeConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!config.isConfigured) {
    const message = `Stripe configuration incomplete. Missing: ${config.missingVars.join(', ')}`;

    if (isProduction) {
      logger.error(`\n${'='.repeat(60)}`);
      logger.error('STRIPE CONFIGURATION WARNING');
      logger.error('='.repeat(60));
      logger.error(message);
      logger.error('Subscription features will be DISABLED until configured.');
      logger.error('Required environment variables:');
      logger.error('  - STRIPE_SECRET_KEY');
      logger.error('  - STRIPE_WEBHOOK_SECRET');
      logger.error('Optional:');
      logger.error('  - STRIPE_PUBLISHABLE_KEY');
      logger.error('');
      logger.error('Price IDs are managed through the admin panel.');
      logger.error('='.repeat(60) + '\n');
    } else {
      logger.warn(`\n${'⚠'.repeat(30)}`);
      logger.warn('Stripe not configured (OK for development)');
      logger.warn(`Missing: ${config.missingVars.join(', ')}`);
      logger.warn('⚠'.repeat(30) + '\n');
    }
  } else {
    logger.info('✅ Stripe configuration validated');
  }
}

/**
 * Check if Stripe is properly configured for accepting payments
 */
export function isStripeReady(): boolean {
  const config = getStripeConfig();
  return config.isConfigured;
}

/**
 * Check if Stripe is configured (alias for consistency)
 */
export function isStripeConfigured(): boolean {
  return isStripeReady();
}

export default {
  getStripeConfig,
  validateStripeConfig,
  isStripeReady,
  isStripeConfigured,
};
