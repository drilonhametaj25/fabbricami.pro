import { PrismaClient, PaymentStatus } from '@prisma/client';
import { shopCheckoutService } from './shop-checkout.service';

const prisma = new PrismaClient();

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const PAYPAL_API_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export interface CreateOrderData {
  orderId: string;
  amount: number; // in EUR
  currency: string;
  description?: string;
  items: {
    name: string;
    quantity: number;
    unitAmount: number;
    sku?: string;
  }[];
  shippingAmount: number;
}

export interface CaptureResult {
  captureId: string;
  status: string;
  amount: number;
  payerEmail?: string;
}

class PayPalService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Check if PayPal is configured
   */
  isConfigured(): boolean {
    return !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
  }

  /**
   * Get PayPal access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Errore autenticazione PayPal');
    }

    const data = await response.json();
    this.accessToken = data.access_token || '';
    this.tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000; // Subtract 60s for safety

    return this.accessToken!;
  }

  /**
   * Make authenticated request to PayPal API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: any
  ): Promise<any> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (method === 'POST') {
      headers['PayPal-Request-Id'] = `order-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    const response = await fetch(`${PAYPAL_API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('PayPal API Error:', responseData);
      throw new Error(responseData.message || 'Errore PayPal API');
    }

    return responseData;
  }

  /**
   * Create a PayPal order
   */
  async createOrder(data: CreateOrderData): Promise<{ paypalOrderId: string; approvalUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('PayPal non configurato');
    }

    const items = data.items.map(item => ({
      name: item.name.substring(0, 127), // PayPal limit
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: data.currency.toUpperCase(),
        value: item.unitAmount.toFixed(2),
      },
      sku: item.sku,
    }));

    const itemTotal = data.items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: data.orderId,
        description: data.description || `Ordine ${data.orderId}`,
        custom_id: data.orderId,
        amount: {
          currency_code: data.currency.toUpperCase(),
          value: data.amount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: data.currency.toUpperCase(),
              value: itemTotal.toFixed(2),
            },
            shipping: {
              currency_code: data.currency.toUpperCase(),
              value: data.shippingAmount.toFixed(2),
            },
          },
        },
        items,
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'EcommerceERP',
            locale: 'it-IT',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${FRONTEND_URL}/checkout/confirmation?paypal=success&order_id=${data.orderId}`,
            cancel_url: `${FRONTEND_URL}/checkout?paypal=cancelled&order_id=${data.orderId}`,
          },
        },
      },
    };

    const response = await this.makeRequest('/v2/checkout/orders', 'POST', orderPayload);

    // Find approval URL
    const approvalUrl = response.links?.find((link: any) => link.rel === 'payer-action')?.href ||
                        response.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('URL di approvazione PayPal non trovato');
    }

    // Store PayPal order
    await prisma.paymentTransaction.create({
      data: {
        orderId: data.orderId,
        provider: 'PAYPAL',
        transactionId: response.id,
        status: PaymentStatus.PENDING,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        metadata: { paypalOrderId: response.id },
      },
    });

    return {
      paypalOrderId: response.id,
      approvalUrl,
    };
  }

  /**
   * Capture a PayPal order after approval
   */
  async captureOrder(paypalOrderId: string): Promise<CaptureResult> {
    if (!this.isConfigured()) {
      throw new Error('PayPal non configurato');
    }

    const response = await this.makeRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, 'POST');

    const capture = response.purchase_units?.[0]?.payments?.captures?.[0];
    const orderId = response.purchase_units?.[0]?.reference_id ||
                   response.purchase_units?.[0]?.custom_id;

    if (!capture) {
      throw new Error('Cattura pagamento non riuscita');
    }

    // Update payment transaction
    await prisma.paymentTransaction.updateMany({
      where: { transactionId: paypalOrderId },
      data: {
        status: PaymentStatus.CAPTURED,
        webhookData: response,
        metadata: {
          paypalOrderId,
          captureId: capture.id,
        },
      },
    });

    // Update order status if we have the orderId
    if (orderId) {
      await shopCheckoutService.updatePaymentStatus(orderId, PaymentStatus.CAPTURED, capture.id);
    }

    return {
      captureId: capture.id,
      status: capture.status,
      amount: parseFloat(capture.amount?.value || '0'),
      payerEmail: response.payer?.email_address,
    };
  }

  /**
   * Get PayPal order details
   */
  async getOrder(paypalOrderId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('PayPal non configurato');
    }

    return this.makeRequest(`/v2/checkout/orders/${paypalOrderId}`);
  }

  /**
   * Create a refund for a captured payment
   */
  async createRefund(orderId: string, amount?: number, reason?: string): Promise<{ refundId: string; status: string }> {
    if (!this.isConfigured()) {
      throw new Error('PayPal non configurato');
    }

    // Find the payment transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        provider: 'PAYPAL',
        status: PaymentStatus.CAPTURED,
      },
    });

    if (!transaction) {
      throw new Error('Transazione non trovata');
    }

    const captureId = (transaction.metadata as any)?.captureId;
    if (!captureId) {
      throw new Error('ID cattura non trovato');
    }

    const refundPayload: any = {
      note_to_payer: reason || 'Rimborso richiesto dal cliente',
    };

    if (amount) {
      refundPayload.amount = {
        value: amount.toFixed(2),
        currency_code: transaction.currency,
      };
    }

    const response = await this.makeRequest(`/v2/payments/captures/${captureId}/refund`, 'POST', refundPayload);

    // Create refund transaction record
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        provider: 'PAYPAL',
        transactionId: response.id,
        status: PaymentStatus.REFUNDED,
        amount: parseFloat(response.amount?.value || '0') * -1,
        currency: response.amount?.currency_code || 'EUR',
        metadata: { refundId: response.id, originalCaptureId: captureId },
      },
    });

    return {
      refundId: response.id,
      status: response.status,
    };
  }

  /**
   * Handle PayPal webhook events
   */
  async handleWebhook(event: any): Promise<void> {
    const eventType = event.event_type;
    const resource = event.resource;

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED': {
        // Order was approved by buyer, ready to capture
        console.log(`PayPal order approved: ${resource.id}`);
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment was captured successfully
        const orderId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await prisma.paymentTransaction.updateMany({
            where: {
              OR: [
                { transactionId: resource.id },
                { metadata: { path: ['captureId'], equals: resource.id } },
              ],
            },
            data: {
              status: PaymentStatus.CAPTURED,
              webhookData: resource,
            },
          });
        }
        console.log(`PayPal payment captured: ${resource.id}`);
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        // Payment failed
        await prisma.paymentTransaction.updateMany({
          where: { transactionId: resource.id },
          data: {
            status: PaymentStatus.FAILED,
            webhookData: resource,
          },
        });
        console.log(`PayPal payment denied: ${resource.id}`);
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Refund completed
        console.log(`PayPal refund completed: ${resource.id}`);
        break;
      }

      default:
        console.log(`Unhandled PayPal event: ${eventType}`);
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    body: string,
    headers: Record<string, string>
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.warn('PAYPAL_WEBHOOK_ID non configurato');
      return true; // Skip verification in development
    }

    try {
      const verifyPayload = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      };

      const response = await this.makeRequest('/v1/notifications/verify-webhook-signature', 'POST', verifyPayload);

      return response.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Get client ID for frontend
   */
  getClientId(): string {
    return PAYPAL_CLIENT_ID;
  }
}

export const paypalService = new PayPalService();
