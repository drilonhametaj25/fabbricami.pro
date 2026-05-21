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

  // Base domain per risoluzione tenant via subdomain dello shop pubblico.
  // Es. "fabbricami.pro" → "acme.fabbricami.pro" risolve al tenant slug=acme.
  // Lasciare vuoto in dev (Nuxt gira su localhost:3001, si usa X-Tenant-Slug).
  SHOP_BASE_DOMAIN: z.string().optional(),

  // Tenant isolation guardrails (Prisma middleware in src/server/config/database.ts).
  // STRICT: query verso modelli tenant-scoped senza contesto attivo → throw.
  // DEBUG: log diagnostico verboso di ogni query con tenantId iniettato.
  TENANT_STRICT_MODE: z.string().default('false'),
  TENANT_DEBUG_MODE: z.string().default('false'),

  // SaaS Settings
  DEFAULT_TRIAL_DAYS: z.string().default('14'),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // SuperAdmin (separate auth realm from tenant users)
  SUPER_ADMIN_JWT_SECRET: z.string().optional(),

  // SMTP — required when sending emails (signup verification, order shipped, etc.)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

});

// Parse and validate
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

// ===========================================================================
// PRODUCTION SECRET HARDENING
// ===========================================================================
//
// In production we refuse to boot with placeholder or trivially weak secrets.
// This catches the very common deploy mistake of copying .env.example into a
// real environment and forgetting to fill the secrets with real values.
const PLACEHOLDER_PATTERNS = [
  'change',
  'changeme',
  'changeme123',
  'your-secret',
  'your_secret',
  'your-jwt',
  'replace-me',
  'replace_me',
  'secret',
  'password',
  'example',
  'placeholder',
  'todo',
];

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (v.length < 32) return true; // too short to be a real cryptographic secret
  return PLACEHOLDER_PATTERNS.some((p) => v === p || v.includes(p));
}

if (env.NODE_ENV === 'production') {
  const fatalIssues: string[] = [];
  const warnings: string[] = [];

  if (looksLikePlaceholder(env.JWT_SECRET)) {
    fatalIssues.push(
      'JWT_SECRET is empty, too short (<32 chars), or contains a placeholder value'
    );
  }
  if (looksLikePlaceholder(env.JWT_REFRESH_SECRET)) {
    fatalIssues.push(
      'JWT_REFRESH_SECRET is empty, too short (<32 chars), or contains a placeholder value'
    );
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    fatalIssues.push(
      'JWT_SECRET and JWT_REFRESH_SECRET MUST be different in production'
    );
  }
  if (
    env.SUPER_ADMIN_JWT_SECRET &&
    (looksLikePlaceholder(env.SUPER_ADMIN_JWT_SECRET) ||
      env.SUPER_ADMIN_JWT_SECRET === env.JWT_SECRET)
  ) {
    fatalIssues.push(
      'SUPER_ADMIN_JWT_SECRET must be set to a distinct strong secret (>=32 chars) in production'
    );
  }
  if (
    !env.ALLOWED_ORIGINS ||
    env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean).length === 0
  ) {
    fatalIssues.push(
      'ALLOWED_ORIGINS is empty — CORS will block every browser request'
    );
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('localhost')) {
    warnings.push('DATABASE_URL points to localhost in production');
  }

  // Stripe — required if SaaS billing is going to work at all
  if (looksLikePlaceholder(env.STRIPE_SECRET_KEY)) {
    warnings.push(
      'STRIPE_SECRET_KEY is empty or a placeholder — Checkout / subscription flows will fail'
    );
  }
  if (looksLikePlaceholder(env.STRIPE_WEBHOOK_SECRET)) {
    warnings.push(
      'STRIPE_WEBHOOK_SECRET is empty or a placeholder — Stripe events will be rejected'
    );
  }

  // SMTP — required for signup email verification, password reset, order shipped
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    warnings.push(
      'SMTP credentials missing — registration emails (verify, welcome) will silently fail and users will be unable to log in'
    );
  }

  for (const w of warnings) {
    console.warn(`⚠️  [env] ${w}`);
  }

  if (fatalIssues.length > 0) {
    console.error('\n❌ Refusing to boot in production due to invalid secrets:');
    for (const issue of fatalIssues) {
      console.error(`   - ${issue}`);
    }
    console.error(
      '\n   Fix the .env file and restart. See .env.production.example for guidance.\n'
    );
    process.exit(1);
  }
}

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

  shop: {
    baseDomain: env.SHOP_BASE_DOMAIN || null,
  },

  tenant: {
    strictMode: env.TENANT_STRICT_MODE === 'true',
    debugMode: env.TENANT_DEBUG_MODE === 'true',
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
