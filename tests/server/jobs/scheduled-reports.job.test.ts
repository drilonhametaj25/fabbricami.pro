import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

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

// Mock reports service
const mockReportsService = {
  getProfitLossReport: jest.fn(),
  getDeadStockAnalysis: jest.fn(),
  getAgingReport: jest.fn(),
  getCashflowForecast: jest.fn(),
  getRFMAnalysis: jest.fn(),
  getChurnAnalysis: jest.fn(),
  getCategoryPerformance: jest.fn(),
};

jest.mock('@server/services/reports.service', () => ({
  __esModule: true,
  default: mockReportsService,
}));

// Mock export service
const mockExportService = {
  generateProfitLossReportPdf: jest.fn(),
  generateDeadStockReportPdf: jest.fn(),
  generateAgingReportPdf: jest.fn(),
  generateCashflowForecastPdf: jest.fn(),
  generateRFMReportPdf: jest.fn(),
  generateInventoryCsv: jest.fn(),
  generateOrdersCsv: jest.fn(),
};

jest.mock('@server/services/export.service', () => ({
  __esModule: true,
  default: mockExportService,
}));

// Mock email service
const mockEmailService = {
  send: jest.fn().mockResolvedValue(true),
};

jest.mock('@server/services/email.service', () => ({
  __esModule: true,
  default: mockEmailService,
}));

// Import after mocks
import {
  processScheduledReports,
  sendDailyDigest,
  sendWeeklyDigest,
} from '@server/jobs/scheduled-reports.job';
import { logger } from '@server/config/logger';

describe('Scheduled Reports Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
  });

  describe('processScheduledReports', () => {
    it('should process due reports', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Riepilogo Vendite Test',
          reportType: 'sales-summary',
          frequency: 'DAILY',
          format: 'pdf',
          recipients: ['admin@example.com'],
          parameters: {},
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 10000,
        costOfGoodsSold: 6000,
        grossProfit: 4000,
        grossMargin: 40,
      });
      mockExportService.generateProfitLossReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(logger.info).toHaveBeenCalledWith('Processing scheduled reports...');
      expect(logger.info).toHaveBeenCalledWith('Found 1 reports to execute');
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(prismaMock.scheduledReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({
            lastRun: expect.any(Date),
            nextRun: expect.any(Date),
          }),
        })
      );
    });

    it('should handle no due reports', async () => {
      prismaMock.scheduledReport.findMany.mockResolvedValue([]);

      await processScheduledReports();

      expect(logger.info).toHaveBeenCalledWith('Found 0 reports to execute');
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('should continue processing other reports on individual failures', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Failing Report',
          reportType: 'unknown-type', // Invalid type
          frequency: 'DAILY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
        {
          id: 'report-2',
          name: 'Working Report',
          reportType: 'dead-stock',
          frequency: 'DAILY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getDeadStockAnalysis.mockResolvedValue({
        totalItems: 5,
        totalValue: 1000,
      });
      mockExportService.generateDeadStockReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(logger.error).toHaveBeenCalledWith(
        'Report type not found: unknown-type'
      );
      // Second report should still be processed
      expect(mockReportsService.getDeadStockAnalysis).toHaveBeenCalled();
    });

    it('should send report to multiple recipients', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Multi-recipient Report',
          reportType: 'inventory-csv',
          frequency: 'WEEKLY',
          recipients: ['admin@example.com', 'manager@example.com', 'warehouse@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockExportService.generateInventoryCsv.mockResolvedValue('sku,name,qty\n001,Prod,10');

      await processScheduledReports();

      expect(mockEmailService.send).toHaveBeenCalledTimes(3);
    });

    it('should handle email send errors gracefully', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Email Fail Report',
          reportType: 'dead-stock',
          frequency: 'DAILY',
          recipients: ['fail@example.com', 'success@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getDeadStockAnalysis.mockResolvedValue({
        totalItems: 5,
        totalValue: 1000,
      });
      mockExportService.generateDeadStockReportPdf.mockResolvedValue(Buffer.from('PDF'));

      mockEmailService.send
        .mockRejectedValueOnce(new Error('Email failed'))
        .mockResolvedValueOnce(true);

      await processScheduledReports();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send report to fail@example.com:',
        expect.any(Error)
      );
      expect(logger.info).toHaveBeenCalledWith('Report sent to success@example.com');
    });
  });

  describe('AVAILABLE_REPORTS', () => {
    it('should generate sales-summary report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Sales Summary',
          reportType: 'sales-summary',
          frequency: 'DAILY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 10000,
        costOfGoodsSold: 6000,
        grossProfit: 4000,
        grossMargin: 40,
      });
      mockExportService.generateProfitLossReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getProfitLossReport).toHaveBeenCalled();
      expect(mockExportService.generateProfitLossReportPdf).toHaveBeenCalled();
    });

    it('should generate dead-stock report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Dead Stock',
          reportType: 'dead-stock',
          frequency: 'WEEKLY',
          parameters: { daysThreshold: 60 },
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getDeadStockAnalysis.mockResolvedValue({
        totalItems: 5,
        totalValue: 1000,
      });
      mockExportService.generateDeadStockReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getDeadStockAnalysis).toHaveBeenCalledWith(60);
    });

    it('should generate aging-receivables report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Aging Receivables',
          reportType: 'aging-receivables',
          frequency: 'WEEKLY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getAgingReport.mockResolvedValue({
        summary: { current: 5000, days30: 1000, days60: 500, days90: 200, over90: 100 },
        details: [],
      });
      mockExportService.generateAgingReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getAgingReport).toHaveBeenCalledWith('receivables');
      expect(mockExportService.generateAgingReportPdf).toHaveBeenCalledWith(
        'receivables',
        expect.anything()
      );
    });

    it('should generate aging-payables report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Aging Payables',
          reportType: 'aging-payables',
          frequency: 'MONTHLY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getAgingReport.mockResolvedValue({
        summary: { current: 3000, days30: 500, days60: 200, days90: 100, over90: 50 },
        details: [],
      });
      mockExportService.generateAgingReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getAgingReport).toHaveBeenCalledWith('payables');
    });

    it('should generate cashflow-forecast report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Cashflow',
          reportType: 'cashflow-forecast',
          frequency: 'WEEKLY',
          parameters: { days: 30 },
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getCashflowForecast.mockResolvedValue({
        periods: [],
        summary: { totalIncome: 50000, totalExpenses: 30000, netCashflow: 20000 },
      });
      mockExportService.generateCashflowForecastPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getCashflowForecast).toHaveBeenCalledWith(30);
    });

    it('should generate rfm-analysis report', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'RFM Analysis',
          reportType: 'rfm-analysis',
          frequency: 'MONTHLY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockReportsService.getRFMAnalysis.mockResolvedValue({
        segments: [],
        summary: {},
      });
      mockExportService.generateRFMReportPdf.mockResolvedValue(Buffer.from('PDF'));

      await processScheduledReports();

      expect(mockReportsService.getRFMAnalysis).toHaveBeenCalled();
    });

    it('should generate inventory-csv export', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Inventory CSV',
          reportType: 'inventory-csv',
          frequency: 'WEEKLY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockExportService.generateInventoryCsv.mockResolvedValue('sku,name,qty\n001,Prod,10');

      await processScheduledReports();

      expect(mockExportService.generateInventoryCsv).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'inventario.csv',
              contentType: 'text/csv',
            }),
          ]),
        })
      );
    });

    it('should generate orders-csv export', async () => {
      const dueReports = [
        {
          id: 'report-1',
          name: 'Orders CSV',
          reportType: 'orders-csv',
          frequency: 'DAILY',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      ];

      prismaMock.scheduledReport.findMany.mockResolvedValue(dueReports as any);
      prismaMock.scheduledReport.update.mockResolvedValue({} as any);

      mockExportService.generateOrdersCsv.mockResolvedValue('order,date,total\n001,2024-01-15,100');

      await processScheduledReports();

      expect(mockExportService.generateOrdersCsv).toHaveBeenCalled();
    });
  });

  describe('sendDailyDigest', () => {
    it('should send daily digest with KPIs', async () => {
      const recipients = ['admin@example.com', 'manager@example.com'];

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 5000,
        grossMargin: 45,
        grossProfit: 2250,
      });
      mockReportsService.getChurnAnalysis.mockResolvedValue({
        activeCustomers: 100,
        atRiskCustomers: 10,
        churnRate: 5,
      });
      mockReportsService.getDeadStockAnalysis.mockResolvedValue({
        totalItems: 20,
        totalValue: 3000,
      });
      mockReportsService.getAgingReport.mockResolvedValue({
        summary: { days30: 1000, days60: 500, days90: 200, over90: 100 },
      });

      await sendDailyDigest(recipients);

      expect(logger.info).toHaveBeenCalledWith('Sending daily digest...');
      expect(mockEmailService.send).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Daily digest sent to admin@example.com');
      expect(logger.info).toHaveBeenCalledWith('Daily digest sent to manager@example.com');
      expect(logger.info).toHaveBeenCalledWith('Daily digest completed');
    });

    it('should handle email errors gracefully', async () => {
      const recipients = ['fail@example.com'];

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 5000,
        grossMargin: 45,
        grossProfit: 2250,
      });
      mockReportsService.getChurnAnalysis.mockResolvedValue({
        activeCustomers: 100,
        atRiskCustomers: 10,
        churnRate: 5,
      });
      mockReportsService.getDeadStockAnalysis.mockResolvedValue({
        totalItems: 20,
        totalValue: 3000,
      });
      mockReportsService.getAgingReport.mockResolvedValue({
        summary: { days30: 1000, days60: 500, days90: 200, over90: 100 },
      });

      mockEmailService.send.mockRejectedValueOnce(new Error('SMTP error'));

      await sendDailyDigest(recipients);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send daily digest to fail@example.com:',
        expect.any(Error)
      );
    });

    it('should throw error on report generation failure', async () => {
      const recipients = ['admin@example.com'];

      mockReportsService.getProfitLossReport.mockRejectedValue(new Error('DB error'));

      await expect(sendDailyDigest(recipients)).rejects.toThrow('DB error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending daily digest:',
        expect.any(Error)
      );
    });
  });

  describe('sendWeeklyDigest', () => {
    it('should send weekly digest with stats', async () => {
      const recipients = ['admin@example.com'];

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 50000,
        costOfGoodsSold: 30000,
        grossProfit: 20000,
        grossMargin: 40,
        operatingIncome: 15000,
        operatingMargin: 30,
      });
      mockReportsService.getCategoryPerformance.mockResolvedValue([
        { category: 'Electronics', totalRevenue: 20000, grossMargin: 35, unitsSold: 100 },
        { category: 'Clothing', totalRevenue: 15000, grossMargin: 45, unitsSold: 200 },
        { category: 'Home', totalRevenue: 10000, grossMargin: 40, unitsSold: 50 },
      ]);

      await sendWeeklyDigest(recipients);

      expect(logger.info).toHaveBeenCalledWith('Sending weekly digest...');
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Weekly digest sent to admin@example.com');
      expect(logger.info).toHaveBeenCalledWith('Weekly digest completed');
    });

    it('should handle email errors gracefully', async () => {
      const recipients = ['fail@example.com'];

      mockReportsService.getProfitLossReport.mockResolvedValue({
        revenue: 50000,
        costOfGoodsSold: 30000,
        grossProfit: 20000,
        grossMargin: 40,
        operatingIncome: 15000,
        operatingMargin: 30,
      });
      mockReportsService.getCategoryPerformance.mockResolvedValue([]);

      mockEmailService.send.mockRejectedValueOnce(new Error('SMTP error'));

      await sendWeeklyDigest(recipients);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send weekly digest to fail@example.com:',
        expect.any(Error)
      );
    });

    it('should throw error on report generation failure', async () => {
      const recipients = ['admin@example.com'];

      mockReportsService.getProfitLossReport.mockRejectedValue(new Error('DB error'));

      await expect(sendWeeklyDigest(recipients)).rejects.toThrow('DB error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending weekly digest:',
        expect.any(Error)
      );
    });
  });
});
