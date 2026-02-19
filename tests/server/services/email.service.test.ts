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
// Mock verify that handles both callback and promise patterns
const mockVerify = jest.fn((callback?: (error: Error | null) => void) => {
  if (callback) {
    // Callback-based (used in initTransporter)
    callback(null);
    return;
  }
  // Promise-based (used in testConnection)
  return Promise.resolve(true);
});
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

    it('should handle overdue payments with negative daysUntilDue', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/003',
            customerName: 'Customer C',
            amount: 500,
            dueDate: new Date('2026-02-01'),
            daysUntilDue: -10,
          },
        ]
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  // =============================================
  // SEND TRIAL ENDING SOON EMAIL
  // =============================================
  describe('sendTrialEndingSoonEmail', () => {
    it('should send trial ending notification', async () => {
      const result = await emailService.sendTrialEndingSoonEmail(
        'admin@company.com',
        'Admin User',
        'Company Inc',
        3
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@company.com',
          subject: expect.stringContaining('3 giorni'),
        })
      );
    });

    it('should send trial ending notification with 1 day remaining', async () => {
      const result = await emailService.sendTrialEndingSoonEmail(
        'admin@company.com',
        'Admin User',
        'Company Inc',
        1
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@company.com',
          subject: expect.stringContaining('1 giorni'),
        })
      );
    });
  });

  // =============================================
  // TEST CONNECTION
  // =============================================
  describe('testConnection', () => {
    it('should return success when verify succeeds', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailService.testConnection();

      expect(result).toEqual({ success: true });
    });

    it('should return error when verify fails', async () => {
      mockVerify.mockRejectedValue(new Error('Connection refused'));

      const result = await emailService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
      });
    });
  });

  // =============================================
  // ADDITIONAL COVERAGE TESTS
  // =============================================
  describe('send with custom options', () => {
    it('should use custom from address when provided', async () => {
      const result = await emailService.send({
        to: 'recipient@test.com',
        subject: 'Custom From',
        html: '<p>Content</p>',
        from: 'custom@sender.com',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@sender.com',
        })
      );
    });

    it('should include replyTo when provided', async () => {
      const result = await emailService.send({
        to: 'recipient@test.com',
        subject: 'With Reply-To',
        html: '<p>Content</p>',
        replyTo: 'reply@test.com',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'reply@test.com',
        })
      );
    });

    it('should include text version when provided', async () => {
      const result = await emailService.send({
        to: 'recipient@test.com',
        subject: 'With Text',
        html: '<p>Content</p>',
        text: 'Plain text content',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text content',
        })
      );
    });
  });

  describe('sendTaskAssigned with different priority levels', () => {
    it('should handle URGENT priority', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Critical task',
        'Fix production issue',
        new Date('2026-02-20'),
        'URGENT'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle HIGH priority', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'High priority task',
        'Important review',
        new Date('2026-02-25'),
        'HIGH'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle LOW priority (default badge)', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Low priority task',
        'Review documentation',
        new Date('2026-02-28'),
        'LOW'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle task without priority', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Task without priority',
        'General task',
        new Date('2026-02-28')
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle task without due date and priority', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Simple task',
        ''
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  // =============================================
  // ADDITIONAL BRANCH COVERAGE TESTS
  // =============================================
  describe('sendOrderShipped with carrier variations', () => {
    it('should include carrier info with tracking number', async () => {
      const result = await emailService.sendOrderShipped({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/002',
        customerName: 'Jane Doe',
        trackingNumber: 'TRK789',
        carrier: 'FedEx',
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
      // Verify the HTML contains the carrier info
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('FedEx');
      expect(callArgs.html).toContain('TRK789');
    });

    it('should handle tracking number without carrier', async () => {
      const result = await emailService.sendOrderShipped({
        customerEmail: 'customer@test.com',
        orderNumber: 'ORD-2026/003',
        customerName: 'Jane Doe',
        trackingNumber: 'TRK456',
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
      // Verify fallback carrier text is used
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Da definire');
    });
  });

  describe('sendPaymentsDueSummary with different daysUntilDue values', () => {
    it('should handle payment with more than 7 days until due', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/004',
            customerName: 'Customer D',
            amount: 3000,
            dueDate: new Date('2026-03-15'),
            daysUntilDue: 15,
          },
        ]
      );

      expect(result).toBe(true);
      // Verify badge-success class is used
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('badge-success');
    });

    it('should handle payment with 7 days until due (warning)', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/005',
            customerName: 'Customer E',
            amount: 1500,
            dueDate: new Date('2026-02-26'),
            daysUntilDue: 7,
          },
        ]
      );

      expect(result).toBe(true);
      // Verify badge-warning class is used
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('badge-warning');
    });

    it('should handle payment with 0 days until due (overdue)', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/006',
            customerName: 'Customer F',
            amount: 2500,
            dueDate: new Date('2026-02-19'),
            daysUntilDue: 0,
          },
        ]
      );

      expect(result).toBe(true);
      // Verify badge-danger class is used
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('badge-danger');
    });
  });

  describe('sendPaymentReminder with daysOverdue variations', () => {
    it('should handle reminder without daysOverdue (not overdue)', async () => {
      const result = await emailService.sendPaymentReminder({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/007',
        customerName: 'Customer G',
        amount: 500,
        dueDate: new Date('2026-02-25'),
      });

      expect(result).toBe(true);
      // Should not have "URGENTE" in subject
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).not.toContain('URGENTE');
      expect(callArgs.html).toContain('In Scadenza');
    });

    it('should handle reminder with 0 daysOverdue (not overdue)', async () => {
      const result = await emailService.sendPaymentReminder({
        customerEmail: 'customer@test.com',
        invoiceNumber: 'FT-2026/008',
        customerName: 'Customer H',
        amount: 600,
        dueDate: new Date('2026-02-19'),
        daysOverdue: 0,
      });

      expect(result).toBe(true);
      // Should not have "URGENTE" in subject since daysOverdue is 0
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).not.toContain('URGENTE');
    });
  });

  describe('baseTemplate with logo variations', () => {
    it('should include logo when COMPANY_LOGO is set', async () => {
      // COMPANY_LOGO is set in the test setup
      const result = await emailService.sendWelcomeEmail(
        'user@test.com',
        'TestUser'
      );

      expect(result).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://test.com/logo.png');
    });
  });

  // =============================================
  // EDGE CASE BRANCH TESTS
  // =============================================
  describe('sendPaymentsDueSummary with 1 day until due', () => {
    it('should handle payment with 1 day until due (warning badge)', async () => {
      const result = await emailService.sendPaymentsDueSummary(
        ['accountant@test.com'],
        [
          {
            invoiceNumber: 'FT-2026/009',
            customerName: 'Customer I',
            amount: 800,
            dueDate: new Date('2026-02-20'),
            daysUntilDue: 1,
          },
        ]
      );

      expect(result).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('badge-warning');
    });
  });

  describe('Task description empty fallback', () => {
    it('should show default message when no description', async () => {
      const result = await emailService.sendTaskAssigned(
        'employee@test.com',
        'Mario Rossi',
        'Task title',
        '' // Empty description
      );

      expect(result).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Nessuna descrizione fornita');
    });
  });
});

// =============================================
// TEST SMTP NOT CONFIGURED SCENARIO
// =============================================
describe('Email Service - SMTP Not Configured', () => {
  let unconfiguredEmailService: typeof emailService;

  beforeAll(() => {
    // Clear module cache to create fresh instance
    jest.resetModules();

    // Clear SMTP environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    // Re-mock logger
    jest.mock('@server/config/logger', () => ({
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    }));

    // Re-mock nodemailer with null transporter scenario
    jest.mock('nodemailer', () => ({
      __esModule: true,
      default: {
        createTransport: jest.fn().mockReturnValue(null),
      },
    }));
  });

  beforeEach(async () => {
    // Dynamic import to get fresh instance
    const module = await import('@server/services/email.service');
    unconfiguredEmailService = module.emailService;
  });

  afterAll(() => {
    // Restore environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password123';
  });

  it('should return false from isEnabled when SMTP not configured', () => {
    // The unconfiguredEmailService should have transporter as null
    expect(unconfiguredEmailService.isEnabled()).toBe(false);
  });

  it('should return false when trying to send without SMTP configured', async () => {
    const result = await unconfiguredEmailService.send({
      to: 'recipient@test.com',
      subject: 'Test',
      html: '<p>Content</p>',
    });

    expect(result).toBe(false);
  });

  it('should return error from testConnection when SMTP not configured', async () => {
    const result = await unconfiguredEmailService.testConnection();

    expect(result).toEqual({
      success: false,
      error: 'SMTP non configurato',
    });
  });
});

// =============================================
// TEST SMTP CONNECTION ERROR DURING INITIALIZATION
// =============================================
describe('Email Service - SMTP Connection Error', () => {
  let errorLoggerMock: jest.Mock;

  beforeAll(() => {
    // Clear module cache
    jest.resetModules();

    // Set SMTP environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password123';

    errorLoggerMock = jest.fn();

    // Re-mock logger
    jest.doMock('@server/config/logger', () => ({
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: errorLoggerMock,
        warn: jest.fn(),
      },
    }));

    // Mock nodemailer with verify callback that returns error
    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: {
        createTransport: jest.fn().mockReturnValue({
          sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
          verify: jest.fn((callback?: (error: Error | null) => void) => {
            if (callback) {
              // Call callback with an error to test error branch
              callback(new Error('SMTP connection failed'));
              return;
            }
            return Promise.reject(new Error('SMTP connection failed'));
          }),
        }),
      },
    }));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('should log error when SMTP connection verification fails', async () => {
    // Import fresh module to trigger initialization
    const module = await import('@server/services/email.service');
    const errorEmailService = module.emailService;

    // The service should still be created
    expect(errorEmailService).toBeDefined();
    expect(errorEmailService.isEnabled()).toBe(true);

    // Logger should have been called with error
    expect(errorLoggerMock).toHaveBeenCalledWith(
      'SMTP connection error:',
      expect.any(Error)
    );
  });
});

// =============================================
// TEST DEFAULT ENVIRONMENT VALUES
// =============================================
describe('Email Service - Default Environment Values', () => {
  beforeAll(() => {
    jest.resetModules();

    // Set only required SMTP vars, clear optional ones to test defaults
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '465'; // Test secure port
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password123';
    delete process.env.SMTP_FROM;
    delete process.env.COMPANY_NAME;
    delete process.env.COMPANY_LOGO;
    delete process.env.EMAIL_PRIMARY_COLOR;
    delete process.env.APP_URL;

    jest.doMock('@server/config/logger', () => ({
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    }));

    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: {
        createTransport: jest.fn().mockReturnValue({
          sendMail: jest.fn().mockResolvedValue({ messageId: 'test-default' }),
          verify: jest.fn((callback?: (error: Error | null) => void) => {
            if (callback) {
              callback(null);
              return;
            }
            return Promise.resolve(true);
          }),
        }),
      },
    }));
  });

  afterAll(() => {
    // Restore environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password123';
    process.env.SMTP_FROM = 'noreply@test.com';
    process.env.COMPANY_NAME = 'Test Company';
    process.env.COMPANY_LOGO = 'https://test.com/logo.png';
    process.env.EMAIL_PRIMARY_COLOR = '#007bff';
    process.env.APP_URL = 'https://app.test.com';
    jest.resetModules();
  });

  it('should use default values when env vars are not set', async () => {
    const module = await import('@server/services/email.service');
    const defaultService = module.emailService;

    expect(defaultService).toBeDefined();
    expect(defaultService.isEnabled()).toBe(true);

    // Send an email to verify it works with defaults
    const result = await defaultService.sendWelcomeEmail(
      'user@test.com',
      'TestUser'
    );

    expect(result).toBe(true);
  });

  it('should handle secure port (465)', async () => {
    const module = await import('@server/services/email.service');
    const secureService = module.emailService;

    expect(secureService.isEnabled()).toBe(true);
  });
});
