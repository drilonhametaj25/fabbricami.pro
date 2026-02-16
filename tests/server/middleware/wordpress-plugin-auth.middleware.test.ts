// Mock WordPress plugin service
const mockWordpressPluginService = {
  validateCredentials: jest.fn(),
};

jest.mock('@server/services/wordpress-plugin.service', () => ({
  __esModule: true,
  default: mockWordpressPluginService,
}));

// Import after mocks
import {
  authenticateWordPressPlugin,
  logWordPressPluginRequest,
  addWordPressPluginCorsHeaders,
} from '@server/middleware/wordpress-plugin-auth.middleware';

// Helper functions
const createMockRequest = (headers: Record<string, string> = {}, extras: Record<string, any> = {}) => ({
  headers,
  method: 'POST',
  url: '/api/v1/wordpress/sync',
  ...extras,
});

const createMockReply = () => {
  const reply: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status: jest.fn().mockImplementation((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockImplementation((key: string, value: string) => {
      reply.headers[key] = value;
      return reply;
    }),
  };
  return reply;
};

// Helper to create Basic Auth header
const createBasicAuthHeader = (username: string, password: string): string => {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

describe('WordPress Plugin Auth Middleware', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // =============================================
  // AUTHENTICATE WORDPRESS PLUGIN
  // =============================================
  describe('authenticateWordPressPlugin', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization header mancante',
        code: 'MISSING_AUTH_HEADER',
      });
    });

    it('should return 401 when auth format is not Basic', async () => {
      const request = createMockRequest({
        authorization: 'Bearer some-token',
      }) as any;
      const reply = createMockReply();

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Formato autenticazione non valido. Usa Basic Auth.',
        code: 'INVALID_AUTH_FORMAT',
      });
    });

    it('should return 401 when credentials are malformed', async () => {
      // Base64 with no colon separator
      const invalidCredentials = Buffer.from('invalidformat').toString('base64');
      const request = createMockRequest({
        authorization: `Basic ${invalidCredentials}`,
      }) as any;
      const reply = createMockReply();

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Credenziali non valide',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should return 401 when password is empty', async () => {
      const request = createMockRequest({
        authorization: createBasicAuthHeader('username', ''),
      }) as any;
      const reply = createMockReply();

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Credenziali non valide',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should return 401 when credentials are invalid', async () => {
      const request = createMockRequest({
        authorization: createBasicAuthHeader('wp_user', 'wrong_password'),
      }) as any;
      const reply = createMockReply();

      mockWordpressPluginService.validateCredentials.mockResolvedValue(false);

      await authenticateWordPressPlugin(request, reply);

      expect(mockWordpressPluginService.validateCredentials).toHaveBeenCalledWith('wp_user', 'wrong_password');
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Credenziali non valide o disattivate',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should attach plugin info to request when credentials are valid', async () => {
      const request = createMockRequest({
        authorization: createBasicAuthHeader('wp_user', 'correct_password'),
      }) as any;
      const reply = createMockReply();

      mockWordpressPluginService.validateCredentials.mockResolvedValue(true);

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.wordpressPlugin).toBeDefined();
      expect(request.wordpressPlugin.username).toBe('wp_user');
      expect(request.wordpressPlugin.authenticatedAt).toBeInstanceOf(Date);
    });

    it('should decode base64 credentials correctly', async () => {
      const username = 'test_user';
      const password = 'test_password_123';
      const request = createMockRequest({
        authorization: createBasicAuthHeader(username, password),
      }) as any;
      const reply = createMockReply();

      mockWordpressPluginService.validateCredentials.mockResolvedValue(true);

      await authenticateWordPressPlugin(request, reply);

      expect(mockWordpressPluginService.validateCredentials).toHaveBeenCalledWith(username, password);
    });

    it('should handle special characters in password', async () => {
      const username = 'wp_user';
      const password = 'p@$$w0rd!#%&*()';
      const request = createMockRequest({
        authorization: createBasicAuthHeader(username, password),
      }) as any;
      const reply = createMockReply();

      mockWordpressPluginService.validateCredentials.mockResolvedValue(true);

      await authenticateWordPressPlugin(request, reply);

      expect(mockWordpressPluginService.validateCredentials).toHaveBeenCalledWith(username, password);
      expect(request.wordpressPlugin.username).toBe(username);
    });

    it('should return 500 on service errors', async () => {
      const request = createMockRequest({
        authorization: createBasicAuthHeader('wp_user', 'password'),
      }) as any;
      const reply = createMockReply();

      mockWordpressPluginService.validateCredentials.mockRejectedValue(new Error('Database error'));

      await authenticateWordPressPlugin(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Errore interno di autenticazione',
        code: 'AUTH_ERROR',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // =============================================
  // LOG WORDPRESS PLUGIN REQUEST
  // =============================================
  describe('logWordPressPluginRequest', () => {
    it('should log request when plugin info is present', async () => {
      const request = createMockRequest({}, {
        wordpressPlugin: { username: 'wp_user' },
      }) as any;
      const reply = createMockReply();

      await logWordPressPluginRequest(request, reply);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[WordPress Plugin] Request from wp_user: POST /api/v1/wordpress/sync'
      );
    });

    it('should not log when plugin info is absent', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await logWordPressPluginRequest(request, reply);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // ADD WORDPRESS PLUGIN CORS HEADERS
  // =============================================
  describe('addWordPressPluginCorsHeaders', () => {
    it('should set Access-Control-Allow-Origin header', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await addWordPressPluginCorsHeaders(request, reply);

      expect(reply.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should set Access-Control-Allow-Methods header', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await addWordPressPluginCorsHeaders(request, reply);

      expect(reply.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
    });

    it('should set Access-Control-Allow-Headers header', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await addWordPressPluginCorsHeaders(request, reply);

      expect(reply.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-EcommerceERP-API-Key'
      );
    });

    it('should set Access-Control-Allow-Credentials header', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();

      await addWordPressPluginCorsHeaders(request, reply);

      expect(reply.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });
  });
});
