/**
 * Stripe Configuration and Validation
 *
 * Validates Stripe configuration at startup to prevent runtime errors
 */

import { logger } from './logger';

interface StripePriceConfig {
  monthly: string;
  yearly: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  prices: {
    STARTER: StripePriceConfig;
    PRO: StripePriceConfig;
    BUSINESS: StripePriceConfig;
  };
  isConfigured: boolean;
  missingVars: string[];
}

/**
 * Get Stripe configuration from environment variables
 */
export function getStripeConfig(): StripeConfig {
  const missingVars: string[] = [];

  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // Check required keys
  if (!secretKey) missingVars.push('STRIPE_SECRET_KEY');
  if (!webhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET');

  // Price IDs
  const prices = {
    STARTER: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
    },
    PRO: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    },
    BUSINESS: {
      monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
    },
  };

  // Check price IDs
  const priceVars = [
    { key: 'STRIPE_PRICE_STARTER_MONTHLY', value: prices.STARTER.monthly },
    { key: 'STRIPE_PRICE_STARTER_YEARLY', value: prices.STARTER.yearly },
    { key: 'STRIPE_PRICE_PRO_MONTHLY', value: prices.PRO.monthly },
    { key: 'STRIPE_PRICE_PRO_YEARLY', value: prices.PRO.yearly },
    { key: 'STRIPE_PRICE_BUSINESS_MONTHLY', value: prices.BUSINESS.monthly },
    { key: 'STRIPE_PRICE_BUSINESS_YEARLY', value: prices.BUSINESS.yearly },
  ];

  for (const { key, value } of priceVars) {
    if (!value) missingVars.push(key);
  }

  return {
    secretKey,
    webhookSecret,
    prices,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Validate Stripe configuration at startup
 * Logs warnings if not configured, throws in production if critical
 */
export function validateStripeConfig(): void {
  const config = getStripeConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!config.isConfigured) {
    const message = `Stripe configuration incomplete. Missing: ${config.missingVars.join(', ')}`;

    if (isProduction) {
      // In production, log error but don't crash - allow the app to start
      // Subscription features will be disabled
      logger.error(`\n${'='.repeat(60)}`);
      logger.error('STRIPE CONFIGURATION ERROR');
      logger.error('='.repeat(60));
      logger.error(message);
      logger.error('Subscription features will be DISABLED until configured.');
      logger.error('To fix: Set the following environment variables:');
      config.missingVars.forEach((v) => logger.error(`  - ${v}`));
      logger.error('='.repeat(60) + '\n');
    } else {
      // In development, just warn
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
 * Get the price ID for a specific plan and billing period
 */
export function getStripePriceId(
  planCode: 'STARTER' | 'PRO' | 'BUSINESS',
  billingPeriod: 'monthly' | 'yearly'
): string | null {
  const config = getStripeConfig();

  if (!config.isConfigured) {
    return null;
  }

  const planPrices = config.prices[planCode];
  if (!planPrices) {
    return null;
  }

  return planPrices[billingPeriod] || null;
}

export default {
  getStripeConfig,
  validateStripeConfig,
  isStripeReady,
  getStripePriceId,
};
