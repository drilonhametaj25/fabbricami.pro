// Set environment variables FIRST before any imports
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'password123';
process.env.SMTP_FROM = 'noreply@test.com';
process.env.COMPANY_NAME = 'Test Company';
process.env.COMPANY_LOGO = 'https://test.com/logo.png';
process.env.EMAIL_PRIMARY_COLOR = '#007bff';
process.env.APP_URL = 'https://app.test.com';

// Mock logger (named export)
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify,
};

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn().mockReturnValue(mockTransporter),
  },
}));

// Import after mocks
import { emailService } from '@server/services/email.service';

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'msg-123' });
    mockVerify.mockResolvedValue(true);
  });

  // =============================================
  // IS ENABLED
  // =============================================
  describe('isEnabled', () => {
    it('should return true when SMTP is configured', () => {
      const result = emailService.isEnabled();
      expect(result).toBe(true);
    });
  });

  // =============================================
  // SEND
  // =============================================
  describe('send', () => {
    it('should send email successfully', async () => {
      const result = await emailService.send({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'recipient@test.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email inviata'),
        expect.anything()
      );
    });

    it('should send to multiple recipients as comma-separated string', async () => {
      const result = await emailService.send({
        to: ['user1@test.com', 'user2@test.com'],
        subject: 'Broadcast',
        html: '<p>Content</p>',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user1@test.com, user2@test.com',
        })
      );
    });

    it('should include attachments when provided', async () => {
      const result = await emailService.send({
        to: 'recipient@test.com',
        subject: 'With Attachment',
        html: '<p>See attached</p>',
        attachments: [
          { filename: 'test.pdf', content: Buffer.from('PDF content') },
        ],
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            { filename: 'test.pdf', content: Buffer.from('PDF content') },
          ],
        })
      );
    });

    it('should handle send failure gracefully', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        emailService.send({
          to: 'recipient@test.com',
          subject: 'Test',
          html: '<p>Content</p>',
        })
      ).rejects.toThrow('SMTP connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Errore invio email'),
        expect.any(Error)
      );
    });
  });

  // =============================================
  // SEND ORDER CONFIRMATION
  // =============================================
  describe('sendOrderConfirmation', () => {
    it('should send order confirmation with items', async () => {
      const result = await emailService.sendOrderConfirmation({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/001',
        customerName: 'John Doe',
        orderDate: new Date('2026-02-15'),
        items: [
          { name: 'Product A', quantity: 2, unitPrice: 100, total: 200 },
          { name: 'Product B', quantity: 1, unitPrice: 50, total: 50 },
        ],
        subtotal: 250,
        shipping: 10,
        tax: 55,
        total: 315,
        shippingAddress: {
          street: 'Via Roma 1',
          city: 'Milano',
          zip: '20100',
          country: 'Italy',
        },
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND ORDER SHIPPED
  // =============================================
  describe('sendOrderShipped', () => {
    it('should send shipped notification with tracking', async () => {
      const result = await emailService.sendOrderShipped({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/001',
        customerName: 'John Doe',
        trackingNumber: 'TRK123456',
        carrier: 'DHL',
        orderDate: new Date('2026-02-15'),
        items: [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        shippingAddress: {
          street: 'Via Roma 1',
          city: 'Milano',
          zip: '20100',
          country: 'Italy',
        },
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });

    it('should send shipped notification without tracking', async () => {
      const result = await emailService.sendOrderShipped({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/001',
        customerName: 'John Doe',
        orderDate: new Date('2026-02-15'),
        items: [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        shippingAddress: {
          street: 'Via Roma 1',
          city: 'Milano',
          zip: '20100',
          country: 'Italy',
        },
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  // =============================================
  // SEND ORDER DELIVERED
  // =============================================
  describe('sendOrderDelivered', () => {
    it('should send delivery confirmation', async () => {
      const result = await emailService.sendOrderDelivered({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/001',
        customerName: 'John Doe',
        orderDate: new Date('2026-02-15'),
        items: [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        shippingAddress: {
          street: 'Via Roma 1',
          city: 'Milano',
          zip: '20100',
          country: 'Italy',
        },
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND INVOICE
  // =============================================
  describe('sendInvoice', () => {
    it('should send invoice with PDF attachment', async () => {
      const pdfBuffer = Buffer.from('PDF content');
      const result = await emailService.sendInvoice({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/001',
        customerName: 'John Doe',
        total: 1500,
        issueDate: new Date('2026-02-15'),
        dueDate: new Date('2026-03-15'),
        pdfBuffer,
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              content: pdfBuffer,
            }),
          ]),
        })
      );
    });

    it('should send invoice without PDF', async () => {
      const result = await emailService.sendInvoice({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/001',
        customerName: 'John Doe',
        total: 1500,
        issueDate: new Date('2026-02-15'),
        dueDate: new Date('2026-03-15'),
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND PAYMENT REMINDER
  // =============================================
  describe('sendPaymentReminder', () => {
    it('should send due payment reminder', async () => {
      const result = await emailService.sendPaymentReminder({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/001',
        customerName: 'John Doe',
        amount: 1500,
        dueDate: new Date('2026-02-20'),
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });

    it('should send overdue payment reminder', async () => {
      const result = await emailService.sendPaymentReminder({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/001',
        customerName: 'John Doe',
        amount: 1500,
        dueDate: new Date('2026-02-01'),
        daysOverdue: 14,
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND LOW STOCK ALERT
  // =============================================
  describe('sendLowStockAlert', () => {
    it('should send low stock alert to multiple recipients', async () => {
      const result = await emailService.sendLowStockAlert(
        {
          products: [
            { sku: 'PROD-001', name: 'Widget', currentStock: 5, minStock: 10, location: 'MAIN' },
            { sku: 'PROD-002', name: 'Gadget', currentStock: 0, minStock: 5, location: 'MAIN' },
          ],
        },
        ['warehouse@test.com', 'admin@test.com']
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'warehouse@test.com, admin@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND NEW ORDER NOTIFICATION
  // =============================================
  describe('sendNewOrderNotification', () => {
    it('should notify admins about new order', async () => {
      const result = await emailService.sendNewOrderNotification(
        {
          orderNumber: 'ORD-2026/001',
          customerName: 'Acme Corp',
          customerEmail: 'acme@test.com',
          total: 2500,
          items: [
            { name: 'Product A', quantity: 2, unitPrice: 1000, total: 2000 },
            { name: 'Product B', quantity: 1, unitPrice: 500, total: 500 },
          ],
          subtotal: 2500,
          shipping: 0,
          tax: 0,
          orderDate: new Date('2026-02-15'),
          shippingAddress: {
            street: 'Via Roma 1',
            city: 'Milano',
            zip: '20100',
            country: 'Italy',
          },
        },
        ['admin@test.com', 'sales@test.com']
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com, sales@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND TASK ASSIGNED
  // =============================================
  describe('sendTaskAssigned', () => {
    it('should send task assignment notification', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Prepare quarterly report',
        'Prepare the Q1 2026 report',
        new Date('2026-02-28'),
        'HIGH'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'employee@test.com',
          subject: expect.stringContaining('Task'),
        })
      );
    });
  });

  // =============================================
  // SEND VERIFICATION EMAIL
  // =============================================
  describe('sendVerificationEmail', () => {
    it('should send customer verification email', async () => {
      const result = await emailService.sendVerificationEmail(
        'newuser@test.com',
        'verify-token-123',
        'Mario'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND PASSWORD RESET EMAIL
  // =============================================
  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'user@test.com',
        'reset-token-456',
        'Mario'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
        })
      );
    });
  });

  // =============================================
  // SEND WELCOME EMAIL
  // =============================================
  describe('sendWelcomeEmail', () => {
    it('should send welcome email after verification', async () => {
      const result = await emailService.sendWelcomeEmail(
        'user@test.com',
        'Mario'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('Welcome'),
        })
      );
    });
  });

  // =============================================
  // SAAS EMAILS
  // =============================================
  describe('sendSaasVerificationEmail', () => {
    it('should send SaaS user verification email', async () => {
      const result = await emailService.sendSaasVerificationEmail(
        'admin@company.com',
        'saas-verify-token',
        'Admin User'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@company.com',
        })
      );
    });
  });

  describe('sendSaasPasswordResetEmail', () => {
    it('should send SaaS password reset email', async () => {
      const result = await emailService.sendSaasPasswordResetEmail(
        'admin@company.com',
        'saas-reset-token',
        'Admin User'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('sendSaasWelcomeEmail', () => {
    it('should send SaaS welcome email with tenant info', async () => {
      const result = await emailService.sendSaasWelcomeEmail(
        'admin@company.com',
        'Admin User',
        'Company Inc'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('sendTeamMemberJoinedEmail', () => {
    it('should notify admin when team member joins', async () => {
      const result = await emailService.sendTeamMemberJoinedEmail(
        'owner@company.com',
        'Owner Name',
        'New Member',
        'newmember@company.com',
        'Company Inc'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@company.com',
        })
      );
    });
  });

  // =============================================
  // SEND PAYMENTS DUE SUMMARY
  // =============================================
  describe('sendPaymentsDueSummary', () => {
    it('should send summary of due payments', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com', 'admin@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/001',
            customerName: 'Customer A',
            amount: 1000,
            dueDate: new Date('2026-02-20'),
            daysUntilDue: 5,
          },
          {
            invoiceNumber: 'FT-2026/002',
            customerName: 'Customer B',
            amount: 2000,
            dueDate: new Date('2026-02-15'),
            daysUntilDue: 0,
          },
        ]
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'accountant@test.com, admin@test.com',
        })
      );
    });
  });
});
