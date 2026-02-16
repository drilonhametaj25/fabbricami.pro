/**
 * @file wordpress-plugin.service.test.ts
 * @description Unit tests for WordPress Plugin Service
 * @coverage ~20 tests covering credential management, validation, sync logging
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create prisma mock at module level
const prismaMock = mockDeep<PrismaClient>();

// Mock PrismaClient constructor
jest.mock('@prisma/client', () => {
  const actualModule = jest.requireActual('@prisma/client');
  return {
    ...actualModule,
    PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  };
});

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: jest.fn(),
}));

// Import after mocks
import wordpressPluginService from '@server/services/wordpress-plugin.service';
import bcrypt from 'bcryptjs';

describe('WordPressPluginService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('generateSecurePassword', () => {
    it('should generate a password of default length 32', () => {
      const password = wordpressPluginService.generateSecurePassword();

      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(32);
    });

    it('should generate a password of specified length', () => {
      const password = wordpressPluginService.generateSecurePassword(16);

      expect(password.length).toBe(16);
    });

    it('should generate unique passwords', () => {
      const password1 = wordpressPluginService.generateSecurePassword();
      const password2 = wordpressPluginService.generateSecurePassword();

      expect(password1).not.toBe(password2);
    });
  });

  describe('createCredentials', () => {
    it('should create credentials with hashed password', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue(null);

      prismaMock.wordPressPluginAuth.create.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$2a$12$hashedpassword',
        label: 'Test Label',
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.createCredentials({
        username: 'test_user',
        password: 'plain_password',
        label: 'Test Label',
      });

      expect(result.credential.username).toBe('test_user');
      expect(result.credential.label).toBe('Test Label');
      expect(result.credential.isActive).toBe(true);
      expect(result.plainPassword).toBe('plain_password');
      expect(bcrypt.hash).toHaveBeenCalledWith('plain_password', 12);
    });

    it('should throw error for duplicate username', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue({
        id: 'existing-1',
        username: 'existing_user',
        password: 'hashed',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(wordpressPluginService.createCredentials({
        username: 'existing_user',
        password: 'password',
      })).rejects.toThrow('Username già esistente');
    });

    it('should handle null label', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue(null);

      prismaMock.wordPressPluginAuth.create.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.createCredentials({
        username: 'test_user',
        password: 'password',
      });

      expect(result.credential.label).toBeNull();
    });
  });

  describe('generateCredentials', () => {
    it('should generate credentials with auto-generated username and password', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue(null);

      prismaMock.wordPressPluginAuth.create.mockResolvedValue({
        id: 'cred-1',
        username: 'wp_plugin_abc12345',
        password: '$hashed$',
        label: 'Auto Generated',
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.generateCredentials('Auto Generated');

      expect(result.username).toMatch(/^wp_plugin_[0-9a-f]{8}$/);
      expect(result.password.length).toBe(32);
      expect(result.credential).toBeDefined();
    });

    it('should generate credentials without label', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue(null);

      prismaMock.wordPressPluginAuth.create.mockResolvedValue({
        id: 'cred-1',
        username: 'wp_plugin_abc12345',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.generateCredentials();

      expect(result.credential).toBeDefined();
    });
  });

  describe('validateCredentials', () => {
    it('should return true and update lastUsed for valid credentials', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaMock.wordPressPluginAuth.update.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.validateCredentials('test_user', 'correct_password');

      expect(result).toBe(true);
      expect(prismaMock.wordPressPluginAuth.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: { lastUsed: expect.any(Date) },
      });
    });

    it('should return false for invalid password', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await wordpressPluginService.validateCredentials('test_user', 'wrong_password');

      expect(result).toBe(false);
      expect(prismaMock.wordPressPluginAuth.update).not.toHaveBeenCalled();
    });

    it('should return false for inactive credentials', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue({
        id: 'cred-1',
        username: 'test_user',
        password: '$hashed$',
        label: null,
        isActive: false,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await wordpressPluginService.validateCredentials('test_user', 'password');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      prismaMock.wordPressPluginAuth.findUnique.mockResolvedValue(null);

      const result = await wordpressPluginService.validateCredentials('unknown_user', 'password');

      expect(result).toBe(false);
    });
  });

  describe('listCredentials', () => {
    it('should return credentials list without passwords', async () => {
      prismaMock.wordPressPluginAuth.findMany.mockResolvedValue([
        {
          id: 'cred-1',
          username: 'user1',
          password: '$secret$',
          label: 'Label 1',
          isActive: true,
          lastUsed: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cred-2',
          username: 'user2',
          password: '$secret2$',
          label: null,
          isActive: false,
          lastUsed: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await wordpressPluginService.listCredentials();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('user1');
      expect(result[1].username).toBe('user2');
      // Password should not be in result (the service maps to PluginCredential which excludes password)
      expect((result[0] as any).password).toBeUndefined();
    });
  });

  describe('revokeCredentials', () => {
    it('should set isActive to false', async () => {
      prismaMock.wordPressPluginAuth.update.mockResolvedValue({
        id: 'cred-1',
        username: 'user1',
        password: '$hashed$',
        label: null,
        isActive: false,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await wordpressPluginService.revokeCredentials('cred-1');

      expect(prismaMock.wordPressPluginAuth.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: { isActive: false },
      });
    });
  });

  describe('activateCredentials', () => {
    it('should set isActive to true', async () => {
      prismaMock.wordPressPluginAuth.update.mockResolvedValue({
        id: 'cred-1',
        username: 'user1',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await wordpressPluginService.activateCredentials('cred-1');

      expect(prismaMock.wordPressPluginAuth.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: { isActive: true },
      });
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials', async () => {
      prismaMock.wordPressPluginAuth.delete.mockResolvedValue({
        id: 'cred-1',
        username: 'user1',
        password: '$hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await wordpressPluginService.deleteCredentials('cred-1');

      expect(prismaMock.wordPressPluginAuth.delete).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
      });
    });
  });

  describe('updatePassword', () => {
    it('should update password with new hashed value', async () => {
      prismaMock.wordPressPluginAuth.update.mockResolvedValue({
        id: 'cred-1',
        username: 'user1',
        password: '$new_hashed$',
        label: null,
        isActive: true,
        lastUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await wordpressPluginService.updatePassword('cred-1', 'new_password');

      expect(bcrypt.hash).toHaveBeenCalledWith('new_password', 12);
      expect(prismaMock.wordPressPluginAuth.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: { password: '$2a$12$hashedpassword' },
      });
    });
  });

  describe('logSyncOperation', () => {
    it('should create sync log entry with all fields', async () => {
      const mockLog = {
        id: 'log-1',
        direction: 'TO_WP',
        entity: 'PRODUCT',
        entityId: 'prod-123',
        action: 'CREATE',
        status: 'SUCCESS',
        request: { sku: 'TEST' },
        response: { id: 456 },
        error: null,
        duration: 150,
        createdAt: new Date(),
      };

      prismaMock.wordPressSyncLog.create.mockResolvedValue(mockLog);

      const result = await wordpressPluginService.logSyncOperation(
        'TO_WP',
        'PRODUCT',
        'prod-123',
        'CREATE',
        'SUCCESS',
        {
          request: { sku: 'TEST' },
          response: { id: 456 },
          duration: 150,
        }
      );

      expect(result.id).toBe('log-1');
      expect(result.direction).toBe('TO_WP');
      expect(result.status).toBe('SUCCESS');
    });

    it('should create sync log entry with error', async () => {
      const mockLog = {
        id: 'log-2',
        direction: 'FROM_WP',
        entity: 'ORDER',
        entityId: 'order-456',
        action: 'IMPORT',
        status: 'FAILED',
        request: null,
        response: null,
        error: 'Connection timeout',
        duration: null,
        createdAt: new Date(),
      };

      prismaMock.wordPressSyncLog.create.mockResolvedValue(mockLog);

      const result = await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'ORDER',
        'order-456',
        'IMPORT',
        'FAILED',
        { error: 'Connection timeout' }
      );

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('getSyncLogs', () => {
    it('should return filtered logs with pagination', async () => {
      const mockLogs = [
        { id: 'log-1', direction: 'TO_WP', entity: 'PRODUCT', entityId: '1', action: 'CREATE', status: 'SUCCESS', request: null, response: null, error: null, duration: null, createdAt: new Date() },
        { id: 'log-2', direction: 'TO_WP', entity: 'PRODUCT', entityId: '2', action: 'UPDATE', status: 'SUCCESS', request: null, response: null, error: null, duration: null, createdAt: new Date() },
      ];

      prismaMock.wordPressSyncLog.findMany.mockResolvedValue(mockLogs);
      prismaMock.wordPressSyncLog.count.mockResolvedValue(2);

      const result = await wordpressPluginService.getSyncLogs({
        direction: 'TO_WP',
        entity: 'PRODUCT',
        status: 'SUCCESS',
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by date range', async () => {
      prismaMock.wordPressSyncLog.findMany.mockResolvedValue([]);
      prismaMock.wordPressSyncLog.count.mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await wordpressPluginService.getSyncLogs({
        startDate,
        endDate,
      });

      expect(prismaMock.wordPressSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        })
      );
    });
  });

  describe('getSyncStats', () => {
    it('should return aggregated statistics', async () => {
      prismaMock.wordPressSyncLog.findMany.mockResolvedValue([
        { entity: 'PRODUCT', direction: 'TO_WP', status: 'SUCCESS' },
        { entity: 'PRODUCT', direction: 'TO_WP', status: 'SUCCESS' },
        { entity: 'PRODUCT', direction: 'TO_WP', status: 'FAILED' },
        { entity: 'ORDER', direction: 'FROM_WP', status: 'SUCCESS' },
        { entity: 'ORDER', direction: 'FROM_WP', status: 'FAILED' },
      ]);

      const result = await wordpressPluginService.getSyncStats(7);

      expect(result.total).toBe(5);
      expect(result.success).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.byEntity['PRODUCT'].success).toBe(2);
      expect(result.byEntity['PRODUCT'].failed).toBe(1);
      expect(result.byDirection['TO_WP'].success).toBe(2);
      expect(result.byDirection['FROM_WP'].success).toBe(1);
    });
  });

  describe('cleanOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      prismaMock.wordPressSyncLog.deleteMany.mockResolvedValue({ count: 150 });

      const result = await wordpressPluginService.cleanOldLogs(30);

      expect(result).toBe(150);
      expect(prismaMock.wordPressSyncLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('getLastSyncForEntity', () => {
    it('should return last successful sync for entity', async () => {
      const mockLog = {
        id: 'log-latest',
        direction: 'TO_WP',
        entity: 'PRODUCT',
        entityId: 'prod-123',
        action: 'UPDATE',
        status: 'SUCCESS',
        request: null,
        response: null,
        error: null,
        duration: 100,
        createdAt: new Date(),
      };

      prismaMock.wordPressSyncLog.findFirst.mockResolvedValue(mockLog);

      const result = await wordpressPluginService.getLastSyncForEntity('PRODUCT', 'prod-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('log-latest');
      expect(prismaMock.wordPressSyncLog.findFirst).toHaveBeenCalledWith({
        where: {
          entity: 'PRODUCT',
          entityId: 'prod-123',
          status: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return null when no sync found', async () => {
      prismaMock.wordPressSyncLog.findFirst.mockResolvedValue(null);

      const result = await wordpressPluginService.getLastSyncForEntity('PRODUCT', 'unknown-123');

      expect(result).toBeNull();
    });
  });
});
