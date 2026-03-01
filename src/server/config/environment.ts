import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadEnv();

// Schema validazione environment
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_VERSION: z.string().default('v1'),
  
  DATABASE_URL: z.string(),
  
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),         // Access token: 15 minuti
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),   // Refresh token: 7 giorni
  
  WORDPRESS_URL: z.string().optional(),
  WORDPRESS_API_KEY: z.string().optional(),
  WORDPRESS_CONSUMER_SECRET: z.string().optional(),
  WORDPRESS_WEBHOOK_SECRET: z.string().optional(),
  WORDPRESS_SYNC_ENABLED: z.string().default('false'),
  WORDPRESS_SYNC_INTERVAL: z.string().default('300000'), // 5 minuti
  
  MAX_FILE_SIZE: z.string().default('10485760'),
  UPLOAD_DIR: z.string().default('./uploads'),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ELASTICSEARCH_NODE: z.string().optional(),
  
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_TIMEWINDOW: z.string().default('60000'),

  OVERHEAD_ALLOCATION_METHOD: z.enum(['labor_hours', 'production_volume']).default('labor_hours'),

  // Stripe SaaS (only API keys, Price IDs are managed in database)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // PayPal (BUG-004 fix: add validation)
  PAYPAL_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Frontend URLs (BUG-003 fix: no more hardcoded localhost fallbacks)
  // FRONTEND_URL is the e-commerce frontend (Nuxt 3)
  // APP_URL is the ERP admin frontend (Vue 3)
  FRONTEND_URL: z.string().default('http://localhost:3001'),
  APP_URL: z.string().default('http://localhost:5173'),

  // SaaS Settings
  DEFAULT_TRIAL_DAYS: z.string().default('14'),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),
});

// Parse and validate
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

export const config = {
  env: env.NODE_ENV,
  port: parseInt(env.PORT),
  apiVersion: env.API_VERSION,
  
  database: {
    url: env.DATABASE_URL,
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  wordpress: {
    url: env.WORDPRESS_URL || '',
    apiKey: env.WORDPRESS_API_KEY || '',
    consumerSecret: env.WORDPRESS_CONSUMER_SECRET || '',
    webhookSecret: env.WORDPRESS_WEBHOOK_SECRET || '',
    syncEnabled: env.WORDPRESS_SYNC_ENABLED === 'true',
    syncInterval: parseInt(env.WORDPRESS_SYNC_INTERVAL),
  },
  
  upload: {
    maxFileSize: parseInt(env.MAX_FILE_SIZE),
    uploadDir: env.UPLOAD_DIR,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    elasticsearchNode: env.ELASTICSEARCH_NODE,
  },
  
  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX),
    timeWindow: parseInt(env.RATE_LIMIT_TIMEWINDOW),
  },
  
  overhead: {
    allocationMethod: env.OVERHEAD_ALLOCATION_METHOD,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    // Note: Price IDs are now managed in database, not environment variables
  },

  paypal: {
    mode: env.PAYPAL_MODE,
    clientId: env.PAYPAL_CLIENT_ID || '',
    clientSecret: env.PAYPAL_CLIENT_SECRET || '',
    webhookId: env.PAYPAL_WEBHOOK_ID || '',
    apiBase: env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com',
  },

  frontend: {
    url: env.FRONTEND_URL,  // E-commerce frontend (Nuxt 3)
    appUrl: env.APP_URL,    // ERP admin frontend (Vue 3)
  },

  saas: {
    appUrl: env.APP_URL,
    defaultTrialDays: parseInt(env.DEFAULT_TRIAL_DAYS),
  },

  cors: {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [],
  },

  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export default config;
