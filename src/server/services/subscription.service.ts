import { prisma } from '../config/database';
import { SaasSubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

// ============================================
// STRIPE CONFIGURATION
// ============================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
}) : null;

// Price IDs per piano (configurare in Stripe Dashboard)
const STRIPE_PRICES = {
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

// ============================================
// TYPES
// ============================================

export interface CreateSubscriptionData {
  tenantId: string;
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

export interface UpdateSubscriptionData {
  planCode?: string;
  billingPeriod?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionInfo {
  id: string;
  tenantId: string;
  planCode: string;
  planName: string;
  status: SaasSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

// ============================================
// SUBSCRIPTION SERVICE
// ============================================

class SubscriptionService {
  /**
   * Check if Stripe is configured
   */
  isStripeConfigured(): boolean {
    return !!stripe;
  }

  /**
   * Get subscription for a tenant
   */
  async getSubscription(tenantId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }

  /**
   * Get all available plans
   */
  async getPlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  /**
   * Create a new subscription (with Stripe)
   */
  async createSubscription(data: CreateSubscriptionData): Promise<SubscriptionInfo> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    // Verifica che il tenant esista
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
      include: {
        members: {
          where: { role: 'ADMIN' },
          include: { user: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new Error('Tenant non trovato');
    }

    // Verifica che non esista già una subscription
    const existingSubscription = await prisma.saasSubscription.findUnique({
      where: { tenantId: data.tenantId },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      throw new Error('Subscription già attiva. Usa updateSubscription per modificarla.');
    }

    // Recupera il piano
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: data.planCode },
    });

    if (!plan) {
      throw new Error('Piano non trovato');
    }

    // Trova l'email dell'admin per Stripe
    const adminEmail = tenant.members[0]?.user?.email || `${tenant.slug}@tenant.local`;

    // Crea o recupera il customer Stripe
    let stripeCustomerId = existingSubscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: adminEmail,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Recupera il price ID corretto
    const priceConfig = STRIPE_PRICES[data.planCode as keyof typeof STRIPE_PRICES];
    if (!priceConfig) {
      throw new Error(`Piano ${data.planCode} non configurato in Stripe`);
    }

    const priceId = data.billingPeriod === 'yearly' ? priceConfig.yearly : priceConfig.monthly;
    if (!priceId) {
      throw new Error(`Price ID non configurato per ${data.planCode} ${data.billingPeriod}`);
    }

    // Attach payment method se fornito
    if (data.paymentMethodId) {
      await stripe.paymentMethods.attach(data.paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: data.paymentMethodId,
        },
      });
    }

    // Crea la subscription Stripe
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        tenantId: tenant.id,
        planCode: data.planCode,
      },
    });

    // Calcola le date del periodo
    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

    // Crea o aggiorna la subscription nel database
    const subscription = await prisma.saasSubscription.upsert({
      where: { tenantId: data.tenantId },
      update: {
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        tenantId: data.tenantId,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }

  /**
   * Start a trial subscription (without Stripe)
   */
  async createTrialSubscription(tenantId: string, planCode: string): Promise<SubscriptionInfo> {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });

    if (!plan) {
      throw new Error('Piano non trovato');
    }

    const now = new Date();
    const trialDays = parseInt(process.env.DEFAULT_TRIAL_DAYS || '14');
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const subscription = await prisma.saasSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'TRIALING',
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        cancelAtPeriodEnd: false,
      },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }

  /**
   * Update subscription (change plan or billing period)
   */
  async updateSubscription(tenantId: string, data: UpdateSubscriptionData): Promise<SubscriptionInfo> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription non trovata');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('Subscription non collegata a Stripe');
    }

    // Gestisci cancellazione
    if (data.cancelAtPeriodEnd !== undefined) {
      if (data.cancelAtPeriodEnd) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
      }

      await prisma.saasSubscription.update({
        where: { tenantId },
        data: { cancelAtPeriodEnd: data.cancelAtPeriodEnd },
      });
    }

    // Cambio piano
    if (data.planCode && data.planCode !== subscription.plan.code) {
      const newPlan = await prisma.subscriptionPlan.findUnique({
        where: { code: data.planCode },
      });

      if (!newPlan) {
        throw new Error('Nuovo piano non trovato');
      }

      // Recupera la subscription Stripe per ottenere l'item ID
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const subscriptionItemId = stripeSubscription.items.data[0].id;

      // Determina il billing period (usa quello nuovo o mantieni l'attuale)
      const billingPeriod = data.billingPeriod ||
        (stripeSubscription.items.data[0].plan.interval === 'year' ? 'yearly' : 'monthly');

      const priceConfig = STRIPE_PRICES[data.planCode as keyof typeof STRIPE_PRICES];
      const priceId = billingPeriod === 'yearly' ? priceConfig.yearly : priceConfig.monthly;

      // Aggiorna la subscription Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: subscriptionItemId,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          planCode: data.planCode,
        },
      });

      // Aggiorna nel database
      await prisma.saasSubscription.update({
        where: { tenantId },
        data: { planId: newPlan.id },
      });
    }

    // Ritorna la subscription aggiornata
    return this.getSubscription(tenantId) as Promise<SubscriptionInfo>;
  }

  /**
   * Cancel subscription immediately
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription non trovata');
    }

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    await prisma.saasSubscription.update({
      where: { tenantId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(tenantId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription non trovata');
    }

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: {
          behavior: 'void',
        },
      });
    }

    await prisma.saasSubscription.update({
      where: { tenantId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Resume paused subscription
   */
  async resumeSubscription(tenantId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription non trovata');
    }

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: '', // Remove pause
      } as Stripe.SubscriptionUpdateParams);
    }

    await prisma.saasSubscription.update({
      where: { tenantId },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * Create Stripe Customer Portal session
   */
  async createPortalSession(tenantId: string, returnUrl?: string): Promise<{ url: string }> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const subscription = await prisma.saasSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('Customer Stripe non trovato');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || `${APP_URL}/settings/billing`,
    });

    return { url: session.url };
  }

  /**
   * Create Stripe Checkout session for subscription
   */
  async createCheckoutSession(
    tenantId: string,
    planCode: string,
    billingPeriod: 'monthly' | 'yearly',
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ sessionId: string; url: string }> {
    if (!stripe) {
      throw new Error('Stripe non configurato');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        members: {
          where: { role: 'ADMIN' },
          include: { user: true },
          take: 1,
        },
        subscription: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant non trovato');
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });

    if (!plan) {
      throw new Error('Piano non trovato');
    }

    // Recupera il price ID
    const priceConfig = STRIPE_PRICES[planCode as keyof typeof STRIPE_PRICES];
    if (!priceConfig) {
      throw new Error(`Piano ${planCode} non configurato in Stripe`);
    }

    const priceId = billingPeriod === 'yearly' ? priceConfig.yearly : priceConfig.monthly;
    if (!priceId) {
      throw new Error(`Price ID non configurato per ${planCode} ${billingPeriod}`);
    }

    const adminEmail = tenant.members[0]?.user?.email;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${APP_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${APP_URL}/settings/billing?cancelled=true`,
      metadata: {
        tenantId,
        planCode,
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          tenantId,
          planCode,
        },
      },
      locale: 'it',
    };

    // Se esiste già un customer, usalo
    if (tenant.subscription?.stripeCustomerId) {
      sessionParams.customer = tenant.subscription.stripeCustomerId;
    } else if (adminEmail) {
      sessionParams.customer_email = adminEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Handle Stripe subscription webhook events
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.syncSubscriptionFromStripe(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata.tenantId;
        if (tenantId) {
          await prisma.saasSubscription.update({
            where: { tenantId },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        // TODO: Inviare email di avviso fine trial
        console.log(`Trial ending soon for subscription ${subscription.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.recordBillingHistory(invoice, 'paid');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.recordBillingHistory(invoice, 'failed');

        // Aggiorna status a PAST_DUE
        if (invoice.subscription && typeof invoice.subscription === 'string') {
          const subscription = await prisma.saasSubscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
          });
          if (subscription) {
            await prisma.saasSubscription.update({
              where: { id: subscription.id },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const tenantId = session.metadata?.tenantId;
          const planCode = session.metadata?.planCode;

          if (tenantId && planCode) {
            const stripeSubscription = await stripe!.subscriptions.retrieve(session.subscription as string);
            await this.syncSubscriptionFromStripe(stripeSubscription, tenantId, planCode);

            // Aggiorna stripeCustomerId se nuovo
            if (session.customer && typeof session.customer === 'string') {
              await prisma.saasSubscription.update({
                where: { tenantId },
                data: { stripeCustomerId: session.customer },
              });
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled subscription event: ${event.type}`);
    }
  }

  /**
   * Sync subscription data from Stripe
   */
  private async syncSubscriptionFromStripe(
    stripeSubscription: Stripe.Subscription,
    tenantId?: string,
    planCode?: string
  ): Promise<void> {
    const resolvedTenantId = tenantId || stripeSubscription.metadata.tenantId;
    const resolvedPlanCode = planCode || stripeSubscription.metadata.planCode;

    if (!resolvedTenantId) {
      console.error('No tenantId found in subscription metadata');
      return;
    }

    const plan = resolvedPlanCode
      ? await prisma.subscriptionPlan.findUnique({ where: { code: resolvedPlanCode } })
      : await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } }); // Default

    if (!plan) {
      console.error('Plan not found');
      return;
    }

    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    const trialEndsAt = stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null;

    await prisma.saasSubscription.upsert({
      where: { tenantId: resolvedTenantId },
      update: {
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        planId: plan.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
      create: {
        tenantId: resolvedTenantId,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
  }

  /**
   * Record billing history from invoice
   */
  private async recordBillingHistory(invoice: Stripe.Invoice, status: 'paid' | 'failed' | 'pending'): Promise<void> {
    if (!invoice.subscription || typeof invoice.subscription !== 'string') {
      return;
    }

    const subscription = await prisma.saasSubscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
    });

    if (!subscription) {
      return;
    }

    // Calculate period dates from invoice
    const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : new Date();
    const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date();

    // Check if record exists by stripeInvoiceId
    const existing = await prisma.billingHistory.findFirst({
      where: { stripeInvoiceId: invoice.id },
    });

    if (existing) {
      await prisma.billingHistory.update({
        where: { id: existing.id },
        data: {
          amount: invoice.amount_paid / 100,
          status,
          invoiceUrl: invoice.hosted_invoice_url || null,
        },
      });
    } else {
      await prisma.billingHistory.create({
        data: {
          subscriptionId: subscription.id,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          status,
          invoiceUrl: invoice.hosted_invoice_url || null,
          periodStart,
          periodEnd,
        },
      });
    }
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SaasSubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'trialing':
        return 'TRIALING';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELLED';
      case 'paused':
        return 'PAUSED';
      case 'incomplete':
      case 'incomplete_expired':
      case 'unpaid':
      default:
        return 'PAST_DUE';
    }
  }
}

export const subscriptionService = new SubscriptionService();
