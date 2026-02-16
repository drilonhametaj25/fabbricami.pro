import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';
import { Job } from 'bullmq';

// Mock prisma
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock config
jest.mock('@server/config/environment', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
    },
  },
}));

// Mock BullMQ
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockWorkerOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
  })),
  Job: jest.fn(),
}));

// Mock email service
const mockEmailService = {
  isEnabled: jest.fn().mockReturnValue(true),
  send: jest.fn().mockResolvedValue(true),
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
  sendOrderShipped: jest.fn().mockResolvedValue(true),
  sendOrderDelivered: jest.fn().mockResolvedValue(true),
  sendInvoice: jest.fn().mockResolvedValue(true),
  sendPaymentReminder: jest.fn().mockResolvedValue(true),
  sendLowStockAlert: jest.fn().mockResolvedValue(true),
  sendNewOrderNotification: jest.fn().mockResolvedValue(true),
  sendTaskAssigned: jest.fn().mockResolvedValue(true),
  sendPaymentsDueSummary: jest.fn().mockResolvedValue(true),
};

jest.mock('@server/services/email.service', () => ({
  emailService: mockEmailService,
}));

// Import after mocks
import {
  processEmailJob,
  initEmailWorker,
  scheduleEmailJobs,
  queueOrderConfirmation,
  queueOrderShipped,
  queueInvoiceEmail,
  queuePaymentReminder,
  queueTaskAssigned,
  emailQueue,
} from '@server/jobs/email.job';
import { logger } from '@server/config/logger';

// Helper to create Decimal mock
const createDecimalMock = (value: number | string): Prisma.Decimal => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => String(numVal),
    toFixed: (dp?: number) => numVal.toFixed(dp),
    valueOf: () => numVal,
  } as unknown as Prisma.Decimal;
};

// Helper to create mock job
const createMockJob = (data: any): Job => ({
  id: `job-${Date.now()}`,
  name: 'test-job',
  data,
  progress: jest.fn(),
  updateProgress: jest.fn().mockResolvedValue(undefined),
  updateData: jest.fn().mockResolvedValue(undefined),
  log: jest.fn().mockResolvedValue(undefined),
} as unknown as Job);

describe('Email Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
    mockEmailService.isEnabled.mockReturnValue(true);
  });

  describe('processEmailJob', () => {
    describe('generic email', () => {
      it('should send generic email when all params provided', async () => {
        const job = createMockJob({
          type: 'generic',
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        });

        await processEmailJob(job);

        expect(mockEmailService.send).toHaveBeenCalledWith({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        });
      });

      it('should throw error when generic email params missing', async () => {
        const job = createMockJob({
          type: 'generic',
          to: 'test@example.com',
          // missing subject and html
        });

        await expect(processEmailJob(job)).rejects.toThrow(
          'to, subject e html richiesti per email generica'
        );
      });
    });

    describe('order-confirmation', () => {
      it('should send order confirmation email', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          items: [
            {
              productName: 'Product 1',
              product: { name: 'Product 1' },
              quantity: 2,
              unitPrice: createDecimalMock(100),
              total: createDecimalMock(200),
            },
          ],
          subtotal: createDecimalMock(200),
          shipping: createDecimalMock(10),
          tax: createDecimalMock(44),
          total: createDecimalMock(254),
          shippingAddress: {
            address1: '123 Main St',
            city: 'Rome',
            postcode: '00100',
            country: 'Italia',
          },
          orderDate: new Date('2024-01-15'),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

        const job = createMockJob({
          type: 'order-confirmation',
          orderId: 'order-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalledWith(
          expect.objectContaining({
            orderNumber: 'ORD-001',
            customerName: 'John Doe',
            customerEmail: 'customer@example.com',
          })
        );
      });

      it('should throw error when orderId missing', async () => {
        const job = createMockJob({
          type: 'order-confirmation',
        });

        await expect(processEmailJob(job)).rejects.toThrow('orderId richiesto');
      });

      it('should throw error when order not found', async () => {
        prismaMock.order.findUnique.mockResolvedValue(null);

        const job = createMockJob({
          type: 'order-confirmation',
          orderId: 'order-1',
        });

        await expect(processEmailJob(job)).rejects.toThrow(
          'Ordine o email cliente non trovati'
        );
      });

      it('should use businessName when personal names missing', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'company@example.com',
            firstName: null,
            lastName: null,
            businessName: 'ACME Corp',
          },
          items: [],
          subtotal: createDecimalMock(100),
          shipping: createDecimalMock(0),
          tax: createDecimalMock(22),
          total: createDecimalMock(122),
          shippingAddress: {},
          orderDate: new Date(),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

        const job = createMockJob({
          type: 'order-confirmation',
          orderId: 'order-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalledWith(
          expect.objectContaining({
            customerName: 'ACME Corp',
          })
        );
      });
    });

    describe('order-shipped', () => {
      it('should send order shipped email with tracking', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          items: [],
          subtotal: createDecimalMock(100),
          shipping: createDecimalMock(10),
          tax: createDecimalMock(22),
          total: createDecimalMock(132),
          shippingAddress: {},
          orderDate: new Date(),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

        const job = createMockJob({
          type: 'order-shipped',
          orderId: 'order-1',
          data: { trackingNumber: 'TRK123', carrier: 'DHL' },
        });

        await processEmailJob(job);

        expect(mockEmailService.sendOrderShipped).toHaveBeenCalledWith(
          expect.objectContaining({
            trackingNumber: 'TRK123',
            carrier: 'DHL',
          })
        );
      });

      it('should throw error when orderId missing', async () => {
        const job = createMockJob({
          type: 'order-shipped',
        });

        await expect(processEmailJob(job)).rejects.toThrow('orderId richiesto');
      });
    });

    describe('order-delivered', () => {
      it('should send order delivered email', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          items: [],
          subtotal: createDecimalMock(100),
          shipping: createDecimalMock(10),
          tax: createDecimalMock(22),
          total: createDecimalMock(132),
          shippingAddress: {},
          orderDate: new Date(),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

        const job = createMockJob({
          type: 'order-delivered',
          orderId: 'order-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendOrderDelivered).toHaveBeenCalled();
      });

      it('should throw error when orderId missing', async () => {
        const job = createMockJob({
          type: 'order-delivered',
        });

        await expect(processEmailJob(job)).rejects.toThrow('orderId richiesto');
      });
    });

    describe('invoice', () => {
      it('should send invoice email with PDF', async () => {
        const mockInvoice = {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          issueDate: new Date('2024-01-15'),
          dueDate: new Date('2024-02-15'),
          total: createDecimalMock(1000),
        };

        prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);

        const pdfBuffer = Buffer.from('PDF content');
        const job = createMockJob({
          type: 'invoice',
          invoiceId: 'inv-1',
          data: { pdfBuffer },
        });

        await processEmailJob(job);

        expect(mockEmailService.sendInvoice).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceNumber: 'INV-001',
            pdfBuffer,
          })
        );
      });

      it('should throw error when invoiceId missing', async () => {
        const job = createMockJob({
          type: 'invoice',
        });

        await expect(processEmailJob(job)).rejects.toThrow('invoiceId richiesto');
      });

      it('should throw error when invoice not found', async () => {
        prismaMock.invoice.findUnique.mockResolvedValue(null);

        const job = createMockJob({
          type: 'invoice',
          invoiceId: 'inv-1',
        });

        await expect(processEmailJob(job)).rejects.toThrow(
          'Fattura o email cliente non trovati'
        );
      });
    });

    describe('payment-reminder', () => {
      it('should send payment reminder for overdue invoice', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 10);

        const mockInvoice = {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          dueDate: pastDate,
          total: createDecimalMock(1000),
          paidAmount: createDecimalMock(0),
        };

        prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);

        const job = createMockJob({
          type: 'payment-reminder',
          invoiceId: 'inv-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendPaymentReminder).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceNumber: 'INV-001',
            amount: 1000,
            daysOverdue: expect.any(Number),
          })
        );
      });

      it('should throw error when invoiceId missing', async () => {
        const job = createMockJob({
          type: 'payment-reminder',
        });

        await expect(processEmailJob(job)).rejects.toThrow('invoiceId richiesto');
      });
    });

    describe('low-stock-alert', () => {
      it('should send low stock alert when products found', async () => {
        prismaMock.$queryRaw.mockResolvedValue([
          { sku: 'SKU-001', name: 'Product 1', location: 'WEB', quantity: 5, minStock: 10 },
          { sku: 'SKU-002', name: 'Product 2', location: 'WEB', quantity: 2, minStock: 5 },
        ] as any);

        prismaMock.user.findMany.mockResolvedValue([
          { email: 'admin@example.com' },
          { email: 'warehouse@example.com' },
        ] as any);

        const job = createMockJob({
          type: 'low-stock-alert',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendLowStockAlert).toHaveBeenCalledWith(
          expect.objectContaining({
            products: expect.arrayContaining([
              expect.objectContaining({ sku: 'SKU-001' }),
            ]),
          }),
          ['admin@example.com', 'warehouse@example.com']
        );
      });

      it('should skip when no low stock products', async () => {
        prismaMock.$queryRaw.mockResolvedValue([] as any);

        const job = createMockJob({
          type: 'low-stock-alert',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendLowStockAlert).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Nessun prodotto con scorte basse');
      });

      it('should skip when no recipients found', async () => {
        prismaMock.$queryRaw.mockResolvedValue([
          { sku: 'SKU-001', name: 'Product 1', location: 'WEB', quantity: 5, minStock: 10 },
        ] as any);

        prismaMock.user.findMany.mockResolvedValue([]);

        const job = createMockJob({
          type: 'low-stock-alert',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendLowStockAlert).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith('Nessun destinatario per alert scorte basse');
      });
    });

    describe('new-order-notification', () => {
      it('should send notification to admin/manager/sales', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          items: [],
          subtotal: createDecimalMock(100),
          shipping: createDecimalMock(10),
          tax: createDecimalMock(22),
          total: createDecimalMock(132),
          shippingAddress: {},
          orderDate: new Date(),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
        prismaMock.user.findMany.mockResolvedValue([
          { email: 'admin@example.com' },
          { email: 'sales@example.com' },
        ] as any);

        const job = createMockJob({
          type: 'new-order-notification',
          orderId: 'order-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendNewOrderNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            orderNumber: 'ORD-001',
          }),
          ['admin@example.com', 'sales@example.com']
        );
      });

      it('should throw error when orderId missing', async () => {
        const job = createMockJob({
          type: 'new-order-notification',
        });

        await expect(processEmailJob(job)).rejects.toThrow('orderId richiesto');
      });

      it('should throw error when order not found', async () => {
        prismaMock.order.findUnique.mockResolvedValue(null);

        const job = createMockJob({
          type: 'new-order-notification',
          orderId: 'order-1',
        });

        await expect(processEmailJob(job)).rejects.toThrow('Ordine non trovato');
      });

      it('should skip when no recipients found', async () => {
        const mockOrder = {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: null,
          },
          items: [],
          subtotal: createDecimalMock(100),
          shipping: createDecimalMock(10),
          tax: createDecimalMock(22),
          total: createDecimalMock(132),
          shippingAddress: {},
          orderDate: new Date(),
        };

        prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
        prismaMock.user.findMany.mockResolvedValue([]);

        const job = createMockJob({
          type: 'new-order-notification',
          orderId: 'order-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendNewOrderNotification).not.toHaveBeenCalled();
      });
    });

    describe('task-assigned', () => {
      it('should send task assignment email', async () => {
        const mockTask = {
          id: 'task-1',
          title: 'Complete order',
          description: 'Process order #123',
          dueDate: new Date('2024-02-01'),
          priority: 'HIGH',
          assignedTo: {
            email: 'employee@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        };

        prismaMock.task.findUnique.mockResolvedValue(mockTask as any);

        const job = createMockJob({
          type: 'task-assigned',
          taskId: 'task-1',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendTaskAssigned).toHaveBeenCalledWith(
          'employee@example.com',
          'Jane Smith',
          'Complete order',
          'Process order #123',
          expect.any(Date),
          'HIGH'
        );
      });

      it('should throw error when taskId missing', async () => {
        const job = createMockJob({
          type: 'task-assigned',
        });

        await expect(processEmailJob(job)).rejects.toThrow('taskId richiesto');
      });

      it('should throw error when task not found', async () => {
        prismaMock.task.findUnique.mockResolvedValue(null);

        const job = createMockJob({
          type: 'task-assigned',
          taskId: 'task-1',
        });

        await expect(processEmailJob(job)).rejects.toThrow(
          'Task o email assegnatario non trovati'
        );
      });
    });

    describe('payments-due-summary', () => {
      it('should send payments due summary', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 3);

        const mockInvoices = [
          {
            invoiceNumber: 'INV-001',
            customer: { businessName: 'ACME Corp', firstName: null, lastName: null },
            dueDate: futureDate,
            total: createDecimalMock(1000),
            paidAmount: createDecimalMock(0),
          },
          {
            invoiceNumber: 'INV-002',
            customer: { businessName: null, firstName: 'John', lastName: 'Doe' },
            dueDate: new Date(),
            total: createDecimalMock(500),
            paidAmount: createDecimalMock(100),
          },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);
        prismaMock.user.findMany.mockResolvedValue([
          { email: 'admin@example.com' },
          { email: 'accountant@example.com' },
        ] as any);

        const job = createMockJob({
          type: 'payments-due-summary',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendPaymentsDueSummary).toHaveBeenCalledWith(
          ['admin@example.com', 'accountant@example.com'],
          expect.arrayContaining([
            expect.objectContaining({ invoiceNumber: 'INV-001', amount: 1000 }),
            expect.objectContaining({ invoiceNumber: 'INV-002', amount: 400 }),
          ])
        );
      });

      it('should skip when no invoices due', async () => {
        prismaMock.invoice.findMany.mockResolvedValue([]);

        const job = createMockJob({
          type: 'payments-due-summary',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendPaymentsDueSummary).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Nessuna fattura in scadenza');
      });

      it('should skip when no recipients', async () => {
        const mockInvoices = [
          {
            invoiceNumber: 'INV-001',
            customer: { businessName: 'ACME Corp' },
            dueDate: new Date(),
            total: createDecimalMock(1000),
            paidAmount: createDecimalMock(0),
          },
        ];

        prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);
        prismaMock.user.findMany.mockResolvedValue([]);

        const job = createMockJob({
          type: 'payments-due-summary',
        });

        await processEmailJob(job);

        expect(mockEmailService.sendPaymentsDueSummary).not.toHaveBeenCalled();
      });
    });

    describe('unknown type', () => {
      it('should throw error for unknown job type', async () => {
        const job = createMockJob({
          type: 'unknown-type',
        });

        await expect(processEmailJob(job)).rejects.toThrow(
          'Tipo job email sconosciuto: unknown-type'
        );
      });
    });

    describe('email service disabled', () => {
      it('should skip when email service is disabled', async () => {
        mockEmailService.isEnabled.mockReturnValue(false);

        const job = createMockJob({
          type: 'generic',
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });

        await processEmailJob(job);

        expect(mockEmailService.send).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith('Email service non abilitato, skip job');
      });
    });
  });

  describe('initEmailWorker', () => {
    it('should create worker with correct config', () => {
      const worker = initEmailWorker();

      expect(worker).toBeDefined();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('scheduleEmailJobs', () => {
    it('should schedule recurring jobs', async () => {
      await scheduleEmailJobs();

      // Low stock check every hour
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-low-stock-check',
        { type: 'low-stock-alert' },
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
        })
      );

      // Payments due summary daily at 9:00
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scheduled-payments-due',
        { type: 'payments-due-summary' },
        expect.objectContaining({
          repeat: { pattern: '0 9 * * *' },
        })
      );

      expect(logger.info).toHaveBeenCalledWith('Email scheduled jobs configurati');
    });
  });

  describe('queue helper functions', () => {
    describe('queueOrderConfirmation', () => {
      it('should add order confirmation job to queue', async () => {
        await queueOrderConfirmation('order-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'order-confirmation-order-123',
          { type: 'order-confirmation', orderId: 'order-123' },
          expect.objectContaining({
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          })
        );
      });
    });

    describe('queueOrderShipped', () => {
      it('should add order shipped job with tracking', async () => {
        await queueOrderShipped('order-123', 'TRK456', 'UPS');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'order-shipped-order-123',
          {
            type: 'order-shipped',
            orderId: 'order-123',
            data: { trackingNumber: 'TRK456', carrier: 'UPS' },
          },
          expect.any(Object)
        );
      });

      it('should add order shipped job without tracking', async () => {
        await queueOrderShipped('order-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'order-shipped-order-123',
          {
            type: 'order-shipped',
            orderId: 'order-123',
            data: { trackingNumber: undefined, carrier: undefined },
          },
          expect.any(Object)
        );
      });
    });

    describe('queueInvoiceEmail', () => {
      it('should add invoice email job with PDF', async () => {
        const pdfBuffer = Buffer.from('PDF content');
        await queueInvoiceEmail('inv-123', pdfBuffer);

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'invoice-inv-123',
          {
            type: 'invoice',
            invoiceId: 'inv-123',
            data: { pdfBuffer },
          },
          expect.any(Object)
        );
      });

      it('should add invoice email job without PDF', async () => {
        await queueInvoiceEmail('inv-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'invoice-inv-123',
          {
            type: 'invoice',
            invoiceId: 'inv-123',
            data: { pdfBuffer: undefined },
          },
          expect.any(Object)
        );
      });
    });

    describe('queuePaymentReminder', () => {
      it('should add payment reminder job', async () => {
        await queuePaymentReminder('inv-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'payment-reminder-inv-123',
          { type: 'payment-reminder', invoiceId: 'inv-123' },
          expect.any(Object)
        );
      });
    });

    describe('queueTaskAssigned', () => {
      it('should add task assigned job', async () => {
        await queueTaskAssigned('task-123');

        expect(mockQueueAdd).toHaveBeenCalledWith(
          'task-assigned-task-123',
          { type: 'task-assigned', taskId: 'task-123' },
          expect.any(Object)
        );
      });
    });
  });
});
