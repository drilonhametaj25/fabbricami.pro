import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SdiStatus } from '@prisma/client';

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Import after mocks
import { arubaSdiService } from '@server/services/sdi/aruba-sdi.service';

describe('ArubaSdiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (arubaSdiService as any).accessToken = null;
    (arubaSdiService as any).tokenExpiry = null;
    (arubaSdiService as any).config = {};
    // Reset baseUrl to production default
    (arubaSdiService as any).baseUrl = 'https://ws.fatturazioneelettronica.aruba.it';
  });

  // ===================
  // configure
  // ===================
  describe('configure', () => {
    it('should configure with production environment', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
        environment: 'production',
      });

      expect((arubaSdiService as any).config.username).toBe('user');
      expect((arubaSdiService as any).baseUrl).toBe('https://ws.fatturazioneelettronica.aruba.it');
    });

    it('should configure with sandbox environment', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
        environment: 'sandbox',
      });

      expect((arubaSdiService as any).baseUrl).toBe('https://sandbox.fatturazioneelettronica.aruba.it');
    });

    it('should default to production URL when no environment specified', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      expect((arubaSdiService as any).baseUrl).toBe('https://ws.fatturazioneelettronica.aruba.it');
    });
  });

  // ===================
  // isConfigured
  // ===================
  describe('isConfigured', () => {
    it('should return false when no config', () => {
      expect(arubaSdiService.isConfigured()).toBe(false);
    });

    it('should return false when missing password', () => {
      arubaSdiService.configure({
        username: 'user',
        apiKey: 'key',
      });

      expect(arubaSdiService.isConfigured()).toBe(false);
    });

    it('should return false when missing username', () => {
      arubaSdiService.configure({
        password: 'pass',
        apiKey: 'key',
      });

      expect(arubaSdiService.isConfigured()).toBe(false);
    });

    it('should return false when missing api credentials', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
      });

      expect(arubaSdiService.isConfigured()).toBe(false);
    });

    it('should return true with full configuration', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      expect(arubaSdiService.isConfigured()).toBe(true);
    });

    it('should return true with apiSecret instead of apiKey', () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiSecret: 'secret',
      });

      expect(arubaSdiService.isConfigured()).toBe(true);
    });
  });

  // ===================
  // testConnection
  // ===================
  describe('testConnection', () => {
    it('should return not configured when not configured', async () => {
      const result = await arubaSdiService.testConnection();

      expect(result).toEqual({
        connected: false,
        message: 'Provider non configurato',
      });
    });

    it('should return connected when authentication succeeds', async () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      const result = await arubaSdiService.testConnection();

      expect(result).toEqual({
        connected: true,
        message: 'Connessione Aruba SDI attiva',
      });
    });

    it('should return not connected when authentication fails', async () => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials',
      } as Response);

      const result = await arubaSdiService.testConnection();

      expect(result).toEqual({
        connected: false,
        message: expect.stringContaining('401'),
      });
    });
  });

  // ===================
  // sendInvoice
  // ===================
  describe('sendInvoice', () => {
    beforeEach(() => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });
    });

    it('should authenticate and send invoice successfully', async () => {
      // Auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token123',
          expires_in: 3600,
        }),
      } as Response);

      // Send response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          uploadFileName: 'IT12345678901_00001.xml',
          idSdi: 'SDI12345',
        }),
      } as Response);

      const result = await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      expect(result).toEqual({
        success: true,
        sdiId: 'SDI12345',
        fileName: 'IT12345678901_00001.xml',
        sentAt: expect.any(Date),
      });
    });

    it('should return error when authentication fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      const result = await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should return error when send fails with error code', async () => {
      // Auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      } as Response);

      // Send response with error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({
          errorCode: 'ERR001',
          errorDescription: 'Fattura non valida',
        }),
      } as Response);

      const result = await arubaSdiService.sendInvoice('<xml>invalid</xml>', 'test.xml');

      expect(result).toEqual({
        success: false,
        error: 'Fattura non valida',
        errorCode: 'ERR001',
      });
    });

    it('should handle malformed JSON response', async () => {
      // Auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      } as Response);

      // Send response with invalid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'Not JSON',
      } as Response);

      const result = await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non valida');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });

    it('should reuse valid token', async () => {
      // First call - authenticates
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ uploadFileName: 'test1.xml', idSdi: 'SDI1' }),
      } as Response);

      await arubaSdiService.sendInvoice('<xml>1</xml>', 'test1.xml');

      // Second call - should reuse token (no auth call)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ uploadFileName: 'test2.xml', idSdi: 'SDI2' }),
      } as Response);

      await arubaSdiService.sendInvoice('<xml>2</xml>', 'test2.xml');

      // Only 3 fetch calls total (1 auth + 2 sends)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ===================
  // getInvoiceStatus
  // ===================
  describe('getInvoiceStatus', () => {
    beforeEach(() => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      // Pre-set a valid token
      (arubaSdiService as any).accessToken = 'valid-token';
      (arubaSdiService as any).tokenExpiry = new Date(Date.now() + 3600000);
    });

    it('should return invoice status for DELIVERED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          fileName: 'test.xml',
          status: 'DELIVERED',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [
            {
              type: 'RC',
              receivedAt: '2026-02-18T10:00:00Z',
              content: '<xml>receipt</xml>',
            },
          ],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('DELIVERED');
      expect(result.sdiId).toBe('SDI12345');
      expect(result.notifications).toHaveLength(1);
    });

    it('should return REJECTED status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          fileName: 'test.xml',
          status: 'REJECTED',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('REJECTED');
    });

    it('should return PENDING for SENT status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'SENT',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('PENDING');
    });

    it('should return NOT_DELIVERABLE for MANCATA_CONSEGNA', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'MANCATA_CONSEGNA',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('NOT_DELIVERABLE');
    });

    it('should return PENDING on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('PENDING');
      expect(result.notifications).toEqual([]);
    });

    it('should map notification with errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'REJECTED',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [
            {
              type: 'NS',
              receivedAt: '2026-02-18T10:00:00Z',
              errorCode: 'ERR001',
              errorDescription: 'XML non valido',
            },
          ],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.notifications[0].listaErrori).toEqual([
        { codice: 'ERR001', descrizione: 'XML non valido' },
      ]);
    });
  });

  // ===================
  // getNotifications
  // ===================
  describe('getNotifications', () => {
    beforeEach(() => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      (arubaSdiService as any).accessToken = 'valid-token';
      (arubaSdiService as any).tokenExpiry = new Date(Date.now() + 3600000);
    });

    it('should return notifications array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { type: 'RC', receivedAt: '2026-02-18T10:00:00Z' },
          { type: 'MC', receivedAt: '2026-02-18T11:00:00Z' },
        ],
      } as Response);

      const result = await arubaSdiService.getNotifications('SDI12345');

      expect(result).toHaveLength(2);
      expect(result[0].tipo).toBe('RC');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      } as Response);

      const result = await arubaSdiService.getNotifications('SDI-UNKNOWN');

      expect(result).toEqual([]);
    });

    it('should map notification content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            type: 'RC',
            receivedAt: '2026-02-18T10:00:00Z',
            content: '<xml>receipt</xml>',
          },
        ],
      } as Response);

      const result = await arubaSdiService.getNotifications('SDI12345');

      expect(result[0].xmlContent).toBe('<xml>receipt</xml>');
    });
  });

  // ===================
  // processWebhook
  // ===================
  describe('processWebhook', () => {
    it('should process valid webhook payload', () => {
      const payload = {
        type: 'RC',
        idSdi: 'SDI12345',
        fileName: 'test.xml',
        receivedAt: '2026-02-18T10:00:00Z',
        deliveredAt: '2026-02-18T10:01:00Z',
        content: '<xml>receipt</xml>',
      };

      const result = arubaSdiService.processWebhook(payload);

      expect(result).toEqual({
        tipo: 'RC',
        identificativoSdi: 'SDI12345',
        nomeFile: 'test.xml',
        dataOraRicezione: expect.any(Date),
        dataOraConsegna: expect.any(Date),
        xmlContent: '<xml>receipt</xml>',
      });
    });

    it('should return null for incomplete payload', () => {
      const result = arubaSdiService.processWebhook({ type: 'RC' });

      expect(result).toBeNull();
    });

    it('should return null for missing type', () => {
      const result = arubaSdiService.processWebhook({ idSdi: 'SDI12345' });

      expect(result).toBeNull();
    });

    it('should process NS (scarto) with errors', () => {
      const payload = {
        type: 'NS',
        idSdi: 'SDI12345',
        errors: [
          { code: 'ERR001', description: 'XML non valido' },
          { code: 'ERR002', description: 'Campo mancante' },
        ],
      };

      const result = arubaSdiService.processWebhook(payload);

      expect(result?.tipo).toBe('NS');
      expect(result?.listaErrori).toHaveLength(2);
      expect(result?.listaErrori?.[0]).toEqual({
        codice: 'ERR001',
        descrizione: 'XML non valido',
      });
    });

    it('should process EC (esito committente) with esito', () => {
      const payload = {
        type: 'EC',
        idSdi: 'SDI12345',
        esito: 'EC01',
      };

      const result = arubaSdiService.processWebhook(payload);

      expect(result?.tipo).toBe('EC');
      expect(result?.esito).toBe('EC01');
    });

    it('should use current date when receivedAt missing', () => {
      const before = new Date();
      const payload = {
        type: 'RC',
        idSdi: 'SDI12345',
      };

      const result = arubaSdiService.processWebhook(payload);

      expect(result?.dataOraRicezione.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should return null on processing error', () => {
      // Pass something that will cause error in processing
      const result = arubaSdiService.processWebhook(null);

      expect(result).toBeNull();
    });
  });

  // ===================
  // Status Mapping
  // ===================
  describe('mapArubaStatus', () => {
    beforeEach(() => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });

      (arubaSdiService as any).accessToken = 'valid-token';
      (arubaSdiService as any).tokenExpiry = new Date(Date.now() + 3600000);
    });

    it('should map ACCEPTED status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'ACCEPTED',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('ACCEPTED');
    });

    it('should map RECEIVED to DELIVERED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'RECEIVED',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('DELIVERED');
    });

    it('should map SCARTATA to REJECTED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'SCARTATA',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('REJECTED');
    });

    it('should map ERROR to REJECTED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'ERROR',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('REJECTED');
    });

    it('should default to PENDING for unknown status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idSdi: 'SDI12345',
          status: 'UNKNOWN_STATUS',
          lastUpdate: '2026-02-18T10:00:00Z',
          notifications: [],
        }),
      } as Response);

      const result = await arubaSdiService.getInvoiceStatus('SDI12345');

      expect(result.status).toBe('PENDING');
    });
  });

  // ===================
  // Token Expiry
  // ===================
  describe('Token Management', () => {
    beforeEach(() => {
      arubaSdiService.configure({
        username: 'user',
        password: 'pass',
        apiKey: 'key',
      });
    });

    it('should refresh token when expired', async () => {
      // Set expired token
      (arubaSdiService as any).accessToken = 'old-token';
      (arubaSdiService as any).tokenExpiry = new Date(Date.now() - 1000);

      // First fetch is auth, second is send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ uploadFileName: 'test.xml', idSdi: 'SDI1' }),
      } as Response);

      await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect((arubaSdiService as any).accessToken).toBe('new-token');
    });

    it('should not refresh valid token', async () => {
      // Set valid token
      (arubaSdiService as any).accessToken = 'valid-token';
      (arubaSdiService as any).tokenExpiry = new Date(Date.now() + 3600000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ uploadFileName: 'test.xml', idSdi: 'SDI1' }),
      } as Response);

      await arubaSdiService.sendInvoice('<xml>test</xml>', 'test.xml');

      // Only 1 fetch (send), no auth
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ===================
  // Service Name
  // ===================
  describe('name property', () => {
    it('should return Aruba', () => {
      expect(arubaSdiService.name).toBe('Aruba');
    });
  });
});
