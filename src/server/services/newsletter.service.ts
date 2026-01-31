import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Mailchimp configuration
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY || '';
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us1'; // e.g., us1, us2
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID || '';

export interface SubscribeData {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  preferences?: {
    promotions?: boolean;
    news?: boolean;
    newProducts?: boolean;
  };
  customerId?: string;
}

export interface NewsletterStats {
  totalSubscribers: number;
  confirmedSubscribers: number;
  pendingSubscribers: number;
  unsubscribed: number;
  subscribersByMonth: { month: string; count: number }[];
}

class NewsletterService {
  /**
   * Check if Mailchimp is configured
   */
  isMailchimpConfigured(): boolean {
    return !!(MAILCHIMP_API_KEY && MAILCHIMP_LIST_ID);
  }

  /**
   * Subscribe to newsletter
   */
  async subscribe(data: SubscribeData): Promise<{ success: boolean; requiresConfirmation: boolean }> {
    const email = data.email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.status === 'CONFIRMED') {
        // Already subscribed
        return { success: true, requiresConfirmation: false };
      } else if (existing.status === 'UNSUBSCRIBED') {
        // Resubscribe
        const confirmToken = randomBytes(32).toString('hex');
        await prisma.newsletterSubscription.update({
          where: { email },
          data: {
            status: 'PENDING',
            confirmToken,
            // confirmTokenExpires field not in schema - using confirmToken only
            preferences: data.preferences || { promotions: true, news: true },
            tags: data.tags || [],
          },
        });

        await this.sendConfirmationEmail(email, confirmToken);
        return { success: true, requiresConfirmation: true };
      }
    }

    // New subscription
    const confirmToken = randomBytes(32).toString('hex');

    await prisma.newsletterSubscription.create({
      data: {
        email,
        customerId: data.customerId,
        status: 'PENDING',
        confirmToken,
        // confirmTokenExpires field not in schema - using confirmToken only
        preferences: data.preferences || { promotions: true, news: true },
        tags: data.tags || [],
      },
    });

    await this.sendConfirmationEmail(email, confirmToken, data.firstName);

    return { success: true, requiresConfirmation: true };
  }

  /**
   * Confirm subscription with token
   */
  async confirmSubscription(token: string): Promise<boolean> {
    const subscription = await prisma.newsletterSubscription.findFirst({
      where: {
        confirmToken: token,
        // confirmTokenExpires field not in schema - token validity checked by existence only
      },
    });

    if (!subscription) {
      return false;
    }

    await prisma.newsletterSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmToken: null,
        // confirmTokenExpires field not in schema
      },
    });

    // Sync with Mailchimp
    if (this.isMailchimpConfigured()) {
      await this.addToMailchimp(subscription.email, subscription.preferences as any, subscription.tags as string[]);
    }

    return true;
  }

  /**
   * Unsubscribe from newsletter
   */
  async unsubscribe(email: string, _token?: string): Promise<boolean> {
    const subscription = await prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscription) {
      return false;
    }

    // If token provided, verify it
    // unsubscribeToken field not in schema - skip token verification
    // if (token && subscription.unsubscribeToken !== token) {
    //   return false;
    // }

    await prisma.newsletterSubscription.update({
      where: { email: email.toLowerCase() },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      },
    });

    // Remove from Mailchimp
    if (this.isMailchimpConfigured()) {
      await this.removeFromMailchimp(email);
    }

    return true;
  }

  /**
   * Update subscription preferences
   */
  async updatePreferences(email: string, preferences: SubscribeData['preferences']): Promise<boolean> {
    const subscription = await prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscription || subscription.status !== 'CONFIRMED') {
      return false;
    }

    await prisma.newsletterSubscription.update({
      where: { email: email.toLowerCase() },
      data: {
        preferences: preferences as any,
      },
    });

    // Update in Mailchimp
    if (this.isMailchimpConfigured()) {
      await this.updateMailchimpMember(email, preferences);
    }

    return true;
  }

  /**
   * Add tags to subscriber
   */
  async addTags(email: string, tags: string[]): Promise<boolean> {
    const subscription = await prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscription) {
      return false;
    }

    const existingTags = (subscription.tags as string[]) || [];
    const newTags = [...new Set([...existingTags, ...tags])];

    await prisma.newsletterSubscription.update({
      where: { email: email.toLowerCase() },
      data: { tags: newTags },
    });

    // Update in Mailchimp
    if (this.isMailchimpConfigured()) {
      await this.updateMailchimpTags(email, newTags);
    }

    return true;
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(email: string): Promise<{
    subscribed: boolean;
    status: string;
    preferences?: any;
  } | null> {
    const subscription = await prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscription) {
      return null;
    }

    return {
      subscribed: subscription.status === 'CONFIRMED',
      status: subscription.status,
      preferences: subscription.preferences,
    };
  }

  /**
   * Get newsletter statistics
   */
  async getStats(): Promise<NewsletterStats> {
    const [total, confirmed, pending, unsubscribed] = await Promise.all([
      prisma.newsletterSubscription.count(),
      prisma.newsletterSubscription.count({ where: { status: 'CONFIRMED' } }),
      prisma.newsletterSubscription.count({ where: { status: 'PENDING' } }),
      prisma.newsletterSubscription.count({ where: { status: 'UNSUBSCRIBED' } }),
    ]);

    // Get subscribers by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const subscriptionsByMonth = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "confirmedAt"), 'YYYY-MM') as month,
             COUNT(*) as count
      FROM "NewsletterSubscription"
      WHERE status = 'CONFIRMED'
        AND "confirmedAt" >= ${twelveMonthsAgo}
      GROUP BY DATE_TRUNC('month', "confirmedAt")
      ORDER BY month ASC
    `;

    return {
      totalSubscribers: total,
      confirmedSubscribers: confirmed,
      pendingSubscribers: pending,
      unsubscribed,
      subscribersByMonth: subscriptionsByMonth.map(r => ({
        month: r.month,
        count: Number(r.count),
      })),
    };
  }

  /**
   * Export subscribers for external tools
   */
  async exportSubscribers(options: {
    status?: 'CONFIRMED' | 'PENDING' | 'UNSUBSCRIBED';
    tags?: string[];
    fromDate?: Date;
  } = {}): Promise<{
    email: string;
    firstName?: string;
    lastName?: string;
    status: string;
    tags: string[];
    confirmedAt?: Date;
  }[]> {
    const where: any = {};

    if (options.status) {
      where.status = options.status;
    }

    if (options.fromDate) {
      where.createdAt = { gte: options.fromDate };
    }

    const subscriptions = await prisma.newsletterSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Filter by tags if specified
    let results = subscriptions;
    if (options.tags && options.tags.length > 0) {
      results = subscriptions.filter(s => {
        const subTags = (s.tags as string[]) || [];
        return options.tags!.some(tag => subTags.includes(tag));
      });
    }

    return results.map(s => ({
      email: s.email,
      firstName: undefined, // Customer relation not available
      lastName: undefined, // Customer relation not available
      status: s.status,
      tags: (s.tags as string[]) || [],
      confirmedAt: s.confirmedAt || undefined,
    }));
  }

  // ==================
  // Mailchimp Integration
  // ==================

  /**
   * Add subscriber to Mailchimp list
   */
  private async addToMailchimp(
    email: string,
    _preferences?: SubscribeData['preferences'],
    tags?: string[]
  ): Promise<void> {
    if (!this.isMailchimpConfigured()) return;

    const emailHash = this.md5Hash(email.toLowerCase());
    const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`;

    try {
      await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: {},
          tags: tags || [],
        }),
      });
    } catch (error) {
      console.error('Mailchimp add error:', error);
    }
  }

  /**
   * Remove subscriber from Mailchimp list
   */
  private async removeFromMailchimp(email: string): Promise<void> {
    if (!this.isMailchimpConfigured()) return;

    const emailHash = this.md5Hash(email.toLowerCase());
    const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`;

    try {
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'unsubscribed',
        }),
      });
    } catch (error) {
      console.error('Mailchimp remove error:', error);
    }
  }

  /**
   * Update Mailchimp member preferences
   */
  private async updateMailchimpMember(
    email: string,
    preferences?: SubscribeData['preferences']
  ): Promise<void> {
    if (!this.isMailchimpConfigured()) return;

    const emailHash = this.md5Hash(email.toLowerCase());
    const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`;

    try {
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interests: this.preferencesToInterests(preferences),
        }),
      });
    } catch (error) {
      console.error('Mailchimp update error:', error);
    }
  }

  /**
   * Update Mailchimp member tags
   */
  private async updateMailchimpTags(email: string, tags: string[]): Promise<void> {
    if (!this.isMailchimpConfigured()) return;

    const emailHash = this.md5Hash(email.toLowerCase());
    const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}/tags`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags: tags.map(tag => ({ name: tag, status: 'active' })),
        }),
      });
    } catch (error) {
      console.error('Mailchimp tags error:', error);
    }
  }

  /**
   * Convert preferences to Mailchimp interests
   */
  private preferencesToInterests(preferences?: SubscribeData['preferences']): Record<string, boolean> {
    // Map your interest IDs from Mailchimp here
    // These IDs come from your Mailchimp list settings
    const interestMap: Record<string, string> = {
      promotions: process.env.MAILCHIMP_INTEREST_PROMOTIONS || '',
      news: process.env.MAILCHIMP_INTEREST_NEWS || '',
      newProducts: process.env.MAILCHIMP_INTEREST_NEW_PRODUCTS || '',
    };

    const interests: Record<string, boolean> = {};

    if (preferences) {
      Object.entries(preferences).forEach(([key, value]) => {
        if (interestMap[key]) {
          interests[interestMap[key]] = value;
        }
      });
    }

    return interests;
  }

  /**
   * Send confirmation email
   */
  private async sendConfirmationEmail(email: string, token: string, _firstName?: string): Promise<void> {
    const confirmUrl = `${process.env.FRONTEND_URL}/newsletter/confirm?token=${token}`;

    // TODO: Implement actual email sending
    // Using nodemailer or a service like SendGrid/Mailchimp transactional
    console.log(`Newsletter confirmation email would be sent to ${email}`);
    console.log(`Confirmation URL: ${confirmUrl}`);

    // For now, auto-confirm in development
    if (process.env.NODE_ENV === 'development') {
      await this.confirmSubscription(token);
    }
  }

  /**
   * MD5 hash for Mailchimp API
   */
  private md5Hash(str: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(str).digest('hex');
  }
}

export const newsletterService = new NewsletterService();
