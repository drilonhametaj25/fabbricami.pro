import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../config/logger';

/**
 * Email Service
 * Gestione invio email con Nodemailer e template HTML
 */

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    zip: string;
    country: string;
  };
  orderDate: Date;
  trackingNumber?: string;
  carrier?: string;
}

interface InvoiceEmailData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  pdfBuffer?: Buffer;
}

interface PaymentReminderData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  dueDate: Date;
  daysOverdue?: number;
}

interface LowStockEmailData {
  products: Array<{
    sku: string;
    name: string;
    currentStock: number;
    minStock: number;
    location: string;
  }>;
}

class EmailService {
  private transporter: Transporter | null = null;
  private defaultFrom: string;
  private companyName: string;
  private companyLogo: string;
  private primaryColor: string;

  constructor() {
    this.defaultFrom = process.env.SMTP_FROM || 'noreply@ecommerceerp.com';
    this.companyName = process.env.COMPANY_NAME || 'EcommerceERP';
    this.companyLogo = process.env.COMPANY_LOGO || '';
    this.primaryColor = process.env.EMAIL_PRIMARY_COLOR || '#2563eb';
    this.initTransporter();
  }

  /**
   * Inizializza transporter Nodemailer
   */
  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      logger.warn('SMTP non configurato, email disabilitate');
      return;
    }

    const config: EmailConfig = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    };

    this.transporter = nodemailer.createTransport(config);

    // Verifica connessione
    this.transporter.verify((error) => {
      if (error) {
        logger.error('SMTP connection error:', error);
      } else {
        logger.info('SMTP server ready');
      }
    });
  }

  /**
   * Verifica se email sono abilitate
   */
  isEnabled(): boolean {
    return this.transporter !== null;
  }

  /**
   * Invia email generica
   */
  async send(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Email non inviate: SMTP non configurato');
      return false;
    }

    try {
      const result = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      logger.info(`Email inviata: ${options.subject} a ${options.to}`, { messageId: result.messageId });
      return true;
    } catch (error: any) {
      logger.error('Errore invio email:', error);
      throw error;
    }
  }

  // =============================================
  // TEMPLATE BASE
  // =============================================

  /**
   * Genera layout base email
   */
  private baseTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: ${this.primaryColor}; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .logo { max-height: 50px; margin-bottom: 12px; }
    .content { padding: 32px 24px; color: #1f2937; line-height: 1.6; }
    .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .button { display: inline-block; background: ${this.primaryColor}; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .button:hover { background: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .highlight { background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid ${this.primaryColor}; margin: 16px 0; }
    .total-row { font-weight: 600; background: #f9fafb; }
    .text-right { text-align: right; }
    .text-muted { color: #6b7280; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${this.companyLogo ? `<img src="${this.companyLogo}" alt="${this.companyName}" class="logo">` : ''}
      <h1>${this.companyName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${this.companyName}. Tutti i diritti riservati.</p>
      <p>Questa email è stata inviata automaticamente dal sistema gestionale.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  // =============================================
  // EMAIL ORDINI
  // =============================================

  /**
   * Email conferma ordine
   */
  async sendOrderConfirmation(data: OrderEmailData): Promise<boolean> {
    const itemsHtml = data.items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">€${item.unitPrice.toFixed(2)}</td>
        <td class="text-right">€${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const content = `
      <h2>Ordine Confermato!</h2>
      <p>Ciao ${data.customerName},</p>
      <p>Grazie per il tuo ordine. Abbiamo ricevuto la tua richiesta e la stiamo elaborando.</p>

      <div class="highlight">
        <strong>Numero Ordine:</strong> ${data.orderNumber}<br>
        <strong>Data:</strong> ${data.orderDate.toLocaleDateString('it-IT')}
      </div>

      <h3>Riepilogo Ordine</h3>
      <table>
        <thead>
          <tr>
            <th>Prodotto</th>
            <th class="text-right">Qtà</th>
            <th class="text-right">Prezzo</th>
            <th class="text-right">Totale</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td colspan="3" class="text-right">Subtotale</td>
            <td class="text-right">€${data.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" class="text-right">Spedizione</td>
            <td class="text-right">€${data.shipping.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" class="text-right">IVA</td>
            <td class="text-right">€${data.tax.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" class="text-right"><strong>Totale</strong></td>
            <td class="text-right"><strong>€${data.total.toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>

      <h3>Indirizzo di Spedizione</h3>
      <p>
        ${data.shippingAddress.street}<br>
        ${data.shippingAddress.zip} ${data.shippingAddress.city}<br>
        ${data.shippingAddress.country}
      </p>

      <p>Ti invieremo una notifica quando il tuo ordine sarà spedito.</p>

      <p>Grazie per aver scelto ${this.companyName}!</p>
    `;

    return this.send({
      to: data.customerEmail,
      subject: `Conferma Ordine ${data.orderNumber}`,
      html: this.baseTemplate('Conferma Ordine', content),
    });
  }

  /**
   * Email ordine spedito
   */
  async sendOrderShipped(data: OrderEmailData): Promise<boolean> {
    const content = `
      <h2>Il tuo ordine è in viaggio!</h2>
      <p>Ciao ${data.customerName},</p>
      <p>Siamo lieti di informarti che il tuo ordine <strong>${data.orderNumber}</strong> è stato spedito.</p>

      ${data.trackingNumber ? `
      <div class="highlight">
        <strong>Corriere:</strong> ${data.carrier || 'Da definire'}<br>
        <strong>Tracking:</strong> ${data.trackingNumber}
      </div>
      ` : ''}

      <h3>Indirizzo di Consegna</h3>
      <p>
        ${data.shippingAddress.street}<br>
        ${data.shippingAddress.zip} ${data.shippingAddress.city}<br>
        ${data.shippingAddress.country}
      </p>

      <p>Potrai tracciare la spedizione utilizzando il numero di tracking fornito.</p>

      <p>Grazie per la fiducia!</p>
    `;

    return this.send({
      to: data.customerEmail,
      subject: `Ordine ${data.orderNumber} Spedito`,
      html: this.baseTemplate('Ordine Spedito', content),
    });
  }

  /**
   * Email ordine consegnato
   */
  async sendOrderDelivered(data: OrderEmailData): Promise<boolean> {
    const content = `
      <h2>Ordine Consegnato!</h2>
      <p>Ciao ${data.customerName},</p>
      <p>Il tuo ordine <strong>${data.orderNumber}</strong> è stato consegnato con successo.</p>

      <p>Speriamo che tu sia soddisfatto del tuo acquisto. Se hai domande o feedback, non esitare a contattarci.</p>

      <p>Grazie per aver scelto ${this.companyName}!</p>
    `;

    return this.send({
      to: data.customerEmail,
      subject: `Ordine ${data.orderNumber} Consegnato`,
      html: this.baseTemplate('Ordine Consegnato', content),
    });
  }

  // =============================================
  // EMAIL FATTURE
  // =============================================

  /**
   * Email fattura
   */
  async sendInvoice(data: InvoiceEmailData): Promise<boolean> {
    const content = `
      <h2>Nuova Fattura</h2>
      <p>Gentile ${data.customerName},</p>
      <p>In allegato trovi la fattura n. <strong>${data.invoiceNumber}</strong>.</p>

      <div class="highlight">
        <strong>Numero Fattura:</strong> ${data.invoiceNumber}<br>
        <strong>Data Emissione:</strong> ${data.issueDate.toLocaleDateString('it-IT')}<br>
        <strong>Scadenza:</strong> ${data.dueDate.toLocaleDateString('it-IT')}<br>
        <strong>Importo:</strong> €${data.total.toFixed(2)}
      </div>

      <p>Ti preghiamo di effettuare il pagamento entro la data di scadenza indicata.</p>

      <p>Per qualsiasi chiarimento, non esitare a contattarci.</p>

      <p>Cordiali saluti,<br>${this.companyName}</p>
    `;

    const attachments = data.pdfBuffer ? [{
      filename: `Fattura_${data.invoiceNumber}.pdf`,
      content: data.pdfBuffer,
      contentType: 'application/pdf',
    }] : undefined;

    return this.send({
      to: data.customerEmail,
      subject: `Fattura ${data.invoiceNumber}`,
      html: this.baseTemplate('Nuova Fattura', content),
      attachments,
    });
  }

  /**
   * Email promemoria pagamento
   */
  async sendPaymentReminder(data: PaymentReminderData): Promise<boolean> {
    const isOverdue = data.daysOverdue && data.daysOverdue > 0;
    const badgeClass = isOverdue ? 'badge-danger' : 'badge-warning';
    const badgeText = isOverdue ? `Scaduta da ${data.daysOverdue} giorni` : 'In Scadenza';

    const content = `
      <h2>Promemoria Pagamento</h2>
      <p>Gentile ${data.customerName},</p>

      <p>Ti ricordiamo che la fattura <strong>${data.invoiceNumber}</strong>
      ${isOverdue ? 'è scaduta' : 'è in scadenza'}.</p>

      <div class="highlight">
        <span class="badge ${badgeClass}">${badgeText}</span><br><br>
        <strong>Fattura:</strong> ${data.invoiceNumber}<br>
        <strong>Importo:</strong> €${data.amount.toFixed(2)}<br>
        <strong>Scadenza:</strong> ${data.dueDate.toLocaleDateString('it-IT')}
      </div>

      <p>Ti preghiamo di provvedere al pagamento al più presto.</p>

      <p>Se hai già effettuato il pagamento, ti preghiamo di ignorare questa comunicazione.</p>

      <p>Cordiali saluti,<br>${this.companyName}</p>
    `;

    return this.send({
      to: data.customerEmail,
      subject: `${isOverdue ? 'URGENTE: ' : ''}Promemoria Pagamento - Fattura ${data.invoiceNumber}`,
      html: this.baseTemplate('Promemoria Pagamento', content),
    });
  }

  // =============================================
  // EMAIL ALERT INTERNI
  // =============================================

  /**
   * Email alert scorte basse
   */
  async sendLowStockAlert(data: LowStockEmailData, recipients: string[]): Promise<boolean> {
    const productsHtml = data.products.map(p => `
      <tr>
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${p.location}</td>
        <td class="text-right">${p.currentStock}</td>
        <td class="text-right">${p.minStock}</td>
        <td class="text-right">
          <span class="badge badge-danger">${p.currentStock - p.minStock}</span>
        </td>
      </tr>
    `).join('');

    const content = `
      <h2>Alert Scorte Basse</h2>
      <p>I seguenti prodotti hanno raggiunto o superato il livello minimo di scorta:</p>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Prodotto</th>
            <th>Ubicazione</th>
            <th class="text-right">Stock Attuale</th>
            <th class="text-right">Stock Min</th>
            <th class="text-right">Differenza</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
      </table>

      <p><strong>Azione richiesta:</strong> Verificare e procedere con il riordino dei materiali.</p>

      <a href="${process.env.APP_URL || '#'}/inventory?filter=low-stock" class="button">
        Vai a Gestione Magazzino
      </a>
    `;

    return this.send({
      to: recipients,
      subject: `Alert: ${data.products.length} Prodotti con Scorte Basse`,
      html: this.baseTemplate('Alert Scorte Basse', content),
    });
  }

  /**
   * Email nuovo ordine ricevuto (per admin)
   */
  async sendNewOrderNotification(data: OrderEmailData, recipients: string[]): Promise<boolean> {
    const content = `
      <h2>Nuovo Ordine Ricevuto</h2>
      <p>È stato ricevuto un nuovo ordine:</p>

      <div class="highlight">
        <strong>Ordine:</strong> ${data.orderNumber}<br>
        <strong>Cliente:</strong> ${data.customerName}<br>
        <strong>Totale:</strong> €${data.total.toFixed(2)}<br>
        <strong>Articoli:</strong> ${data.items.length}
      </div>

      <a href="${process.env.APP_URL || '#'}/orders/${data.orderNumber}" class="button">
        Visualizza Ordine
      </a>
    `;

    return this.send({
      to: recipients,
      subject: `Nuovo Ordine ${data.orderNumber} - €${data.total.toFixed(2)}`,
      html: this.baseTemplate('Nuovo Ordine', content),
    });
  }

  /**
   * Email task assegnato
   */
  async sendTaskAssigned(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    taskDescription: string,
    dueDate?: Date,
    priority?: string
  ): Promise<boolean> {
    const priorityBadge = priority === 'URGENT' ? 'badge-danger'
      : priority === 'HIGH' ? 'badge-warning'
      : 'badge-success';

    const content = `
      <h2>Nuovo Task Assegnato</h2>
      <p>Ciao ${recipientName},</p>
      <p>Ti è stato assegnato un nuovo task:</p>

      <div class="highlight">
        <strong>${taskTitle}</strong>
        ${priority ? `<span class="badge ${priorityBadge}" style="margin-left: 8px;">${priority}</span>` : ''}
        <br><br>
        ${taskDescription || 'Nessuna descrizione fornita.'}
        ${dueDate ? `<br><br><strong>Scadenza:</strong> ${dueDate.toLocaleDateString('it-IT')}` : ''}
      </div>

      <a href="${process.env.APP_URL || '#'}/tasks" class="button">
        Vai ai Task
      </a>
    `;

    return this.send({
      to: recipientEmail,
      subject: `Nuovo Task: ${taskTitle}`,
      html: this.baseTemplate('Task Assegnato', content),
    });
  }

  /**
   * Email scadenze pagamenti imminenti
   */
  async sendPaymentsDueSummary(
    recipients: string[],
    payments: Array<{
      invoiceNumber: string;
      customerName: string;
      amount: number;
      dueDate: Date;
      daysUntilDue: number;
    }>
  ): Promise<boolean> {
    const paymentsHtml = payments.map(p => `
      <tr>
        <td>${p.invoiceNumber}</td>
        <td>${p.customerName}</td>
        <td class="text-right">€${p.amount.toFixed(2)}</td>
        <td class="text-right">${p.dueDate.toLocaleDateString('it-IT')}</td>
        <td class="text-right">
          <span class="badge ${p.daysUntilDue <= 0 ? 'badge-danger' : p.daysUntilDue <= 7 ? 'badge-warning' : 'badge-success'}">
            ${p.daysUntilDue <= 0 ? `Scaduto ${Math.abs(p.daysUntilDue)}gg` : `${p.daysUntilDue}gg`}
          </span>
        </td>
      </tr>
    `).join('');

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    const content = `
      <h2>Riepilogo Scadenze Pagamenti</h2>
      <p>Ecco il riepilogo delle fatture in scadenza o scadute:</p>

      <table>
        <thead>
          <tr>
            <th>Fattura</th>
            <th>Cliente</th>
            <th class="text-right">Importo</th>
            <th class="text-right">Scadenza</th>
            <th class="text-right">Giorni</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsHtml}
          <tr class="total-row">
            <td colspan="2"><strong>Totale</strong></td>
            <td class="text-right"><strong>€${totalAmount.toFixed(2)}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>

      <a href="${process.env.APP_URL || '#'}/accounting?tab=receivables" class="button">
        Vai a Contabilità
      </a>
    `;

    return this.send({
      to: recipients,
      subject: `Scadenze Pagamenti: ${payments.length} fatture - €${totalAmount.toFixed(2)}`,
      html: this.baseTemplate('Scadenze Pagamenti', content),
    });
  }

  // =============================================
  // E-COMMERCE CUSTOMER EMAILS
  // =============================================

  /**
   * Send email verification to customer
   */
  async sendVerificationEmail(email: string, token: string, firstName: string): Promise<boolean> {
    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3001'}/account/verify-email?token=${token}`;

    const content = `
      <h2>Verify Your Email Address</h2>
      <p>Hi ${firstName},</p>
      <p>Thank you for creating an account with ${this.companyName}! Please click the button below to verify your email address:</p>

      <p style="text-align: center;">
        <a href="${verifyUrl}" class="button">Verify Email Address</a>
      </p>

      <p class="text-muted">If the button doesn't work, copy and paste this link into your browser:</p>
      <p class="text-muted" style="word-break: break-all; font-size: 12px;">${verifyUrl}</p>

      <p class="text-muted">This link will expire in 24 hours.</p>

      <p>If you didn't create an account with us, you can safely ignore this email.</p>
    `;

    return this.send({
      to: email,
      subject: `Verify your email - ${this.companyName}`,
      html: this.baseTemplate('Verify Email', content),
      text: `Hi ${firstName},\n\nThank you for creating an account with ${this.companyName}!\n\nPlease verify your email by visiting: ${verifyUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account with us, you can safely ignore this email.`,
    });
  }

  /**
   * Send password reset email to customer
   */
  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}/account/reset-password?token=${token}`;

    const content = `
      <h2>Reset Your Password</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the button below to choose a new password:</p>

      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>

      <p class="text-muted">If the button doesn't work, copy and paste this link into your browser:</p>
      <p class="text-muted" style="word-break: break-all; font-size: 12px;">${resetUrl}</p>

      <p class="text-muted">This link will expire in 1 hour.</p>

      <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
    `;

    return this.send({
      to: email,
      subject: `Reset your password - ${this.companyName}`,
      html: this.baseTemplate('Reset Password', content),
      text: `Hi ${firstName},\n\nWe received a request to reset your password.\n\nReset your password by visiting: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.`,
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const shopUrl = `${process.env.APP_URL || 'http://localhost:3001'}/shop`;

    const content = `
      <h2>Welcome to ${this.companyName}!</h2>
      <p>Hi ${firstName},</p>
      <p>Your email has been verified and your account is now active.</p>

      <div class="highlight">
        <strong>Bonus!</strong> You've earned <strong>50 loyalty points</strong> just for signing up!
      </div>

      <p>Start exploring our collection of premium miniatures and find your next masterpiece:</p>

      <p style="text-align: center;">
        <a href="${shopUrl}" class="button">Start Shopping</a>
      </p>

      <p>Thank you for joining our community!</p>
    `;

    return this.send({
      to: email,
      subject: `Welcome to ${this.companyName}!`,
      html: this.baseTemplate('Welcome', content),
      text: `Hi ${firstName},\n\nWelcome to ${this.companyName}!\n\nYour email has been verified and your account is now active.\n\nYou've earned 50 bonus loyalty points just for signing up!\n\nStart shopping: ${shopUrl}\n\nThank you for joining our community!`,
    });
  }

  // =============================================
  // UTILITY
  // =============================================

  /**
   * Test connessione SMTP
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP non configurato' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
