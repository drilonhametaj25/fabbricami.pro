/**
 * @jest-environment node
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
  hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword'),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  verify: jest.fn(),
}));

// Mock email service
jest.mock('@server/services/email.service', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock config
jest.mock('@server/config/environment', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '7d',
    },
  },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { shopAuthService } from '@server/services/shop-auth.service';
import { emailService } from '@server/services/email.service';

describe('ShopAuthService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new customer successfully', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        newsletter: true,
      };

      const createdCustomer = {
        id: 'cust-1',
        email: 'new@example.com',
        password: '$2a$10$hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        type: 'B2C',
        code: 'WEB-123',
        isActive: true,
        emailVerified: false,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.customer.create as jest.Mock).mockResolvedValue(createdCustomer);
      (prismaMock.loyaltyAccount.create as jest.Mock).mockResolvedValue({
        id: 'loyalty-1',
        customerId: 'cust-1',
        points: 50,
      });
      (prismaMock.newsletterSubscription.create as jest.Mock).mockResolvedValue({});

      const result = await shopAuthService.register(registerData);

      expect(result.customer.email).toBe('new@example.com');
      expect(result.token).toBe('mocked-jwt-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
      expect(prismaMock.loyaltyAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            points: 50, // Welcome bonus
          }),
        })
      );
      expect(prismaMock.newsletterSubscription.create).toHaveBeenCalled();
    });

    it('should throw error for duplicate email', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-customer',
        email: 'existing@example.com',
      });

      await expect(
        shopAuthService.register({
          email: 'existing@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow('An account with this email already exists');
    });

    it('should not create newsletter subscription when not opted in', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        newsletter: false,
      };

      const createdCustomer = {
        id: 'cust-1',
        email: 'new@example.com',
        password: '$2a$10$hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        type: 'B2C',
        isActive: true,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.customer.create as jest.Mock).mockResolvedValue(createdCustomer);
      (prismaMock.loyaltyAccount.create as jest.Mock).mockResolvedValue({});

      await shopAuthService.register(registerData);

      expect(prismaMock.newsletterSubscription.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        password: '$2a$10$hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        loyaltyAccount: { points: 100 },
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue(customer);

      const result = await shopAuthService.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.customer.email).toBe('user@example.com');
      expect(result.token).toBe('mocked-jwt-token');
      expect(prismaMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lastLoginAt: expect.any(Date) },
        })
      );
    });

    it('should throw error for non-existent email', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        password: '$2a$10$hashedpassword',
        isActive: true,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        shopAuthService.login({
          email: 'user@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive account', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        password: '$2a$10$hashedpassword',
        isActive: false,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);

      await expect(
        shopAuthService.login({
          email: 'user@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account disabled');
    });

    it('should throw error when password not set', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        password: null,
        isActive: true,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);

      await expect(
        shopAuthService.login({
          email: 'user@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account not configured for password login');
    });
  });

  describe('getCustomer', () => {
    it('should return customer with includes', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashed',
        loyaltyAccount: { points: 100 },
        savedAddresses: [],
      };

      (prismaMock.customer.findUnique as jest.Mock).mockResolvedValue(customer);

      const result = await shopAuthService.getCustomer('cust-1');

      expect(result!.email).toBe('user@example.com');
      expect(result!.password).toBeUndefined();
    });

    it('should return null when customer not found', async () => {
      (prismaMock.customer.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await shopAuthService.getCustomer('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update customer profile', async () => {
      const updatedCustomer = {
        id: 'cust-1',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+9876543210',
        password: 'hashed',
        loyaltyAccount: { points: 100 },
      };

      (prismaMock.customer.update as jest.Mock).mockResolvedValue(updatedCustomer);

      const result = await shopAuthService.updateProfile('cust-1', {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+9876543210',
      });

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
      expect(result.password).toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const customer = {
        id: 'cust-1',
        password: '$2a$10$oldhashedpassword',
      };

      (prismaMock.customer.findUnique as jest.Mock).mockResolvedValue(customer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue({});

      await shopAuthService.changePassword('cust-1', {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(prismaMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { password: expect.any(String) },
        })
      );
    });

    it('should throw error for wrong current password', async () => {
      const customer = {
        id: 'cust-1',
        password: '$2a$10$hashedpassword',
      };

      (prismaMock.customer.findUnique as jest.Mock).mockResolvedValue(customer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        shopAuthService.changePassword('cust-1', {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword',
        })
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error when customer not found', async () => {
      (prismaMock.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.changePassword('unknown', {
          currentPassword: 'old',
          newPassword: 'new',
        })
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email for existing user', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        firstName: 'John',
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue(customer);

      await shopAuthService.requestPasswordReset('user@example.com');

      expect(prismaMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetTokenExpires: expect.any(Date),
          }),
        })
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should silently return for unknown email', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await shopAuthService.requestPasswordReset('unknown@example.com');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(prismaMock.customer.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const customer = {
        id: 'cust-1',
        resetToken: 'valid-token',
        resetTokenExpires: new Date(Date.now() + 3600000),
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue(customer);

      await shopAuthService.resetPassword({
        token: 'valid-token',
        password: 'newpassword123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prismaMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: expect.any(String),
            resetToken: null,
            resetTokenExpires: null,
          }),
        })
      );
    });

    it('should throw error for invalid token', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.resetPassword({
          token: 'invalid-token',
          password: 'newpassword',
        })
      ).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and send welcome email', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        firstName: 'John',
        emailVerifyToken: 'valid-token',
        emailVerifyTokenExpires: new Date(Date.now() + 3600000),
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue({
        ...customer,
        emailVerified: true,
        emailVerifyToken: null,
      });

      const result = await shopAuthService.verifyEmail('valid-token');

      expect(result.customer.emailVerified).toBe(true);
      expect(result.token).toBe('mocked-jwt-token');
      expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('should throw error for invalid token', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.verifyEmail('invalid-token')
      ).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        firstName: 'John',
        emailVerified: false,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);
      (prismaMock.customer.update as jest.Mock).mockResolvedValue(customer);

      await shopAuthService.resendVerificationEmail('user@example.com');

      expect(prismaMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerifyToken: expect.any(String),
            emailVerifyTokenExpires: expect.any(Date),
          }),
        })
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw error when email already verified', async () => {
      const customer = {
        id: 'cust-1',
        email: 'user@example.com',
        emailVerified: true,
      };

      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(customer);

      await expect(
        shopAuthService.resendVerificationEmail('user@example.com')
      ).rejects.toThrow('Email is already verified');
    });

    it('should silently return for unknown email', async () => {
      (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await shopAuthService.resendVerificationEmail('unknown@example.com');

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const payload = { id: 'cust-1', email: 'user@example.com', type: 'customer' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      const result = shopAuthService.verifyToken('valid-token');

      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      expect(() => shopAuthService.verifyToken('invalid-token')).toThrow('Invalid token');
    });
  });

  describe('addAddress', () => {
    it('should add new address', async () => {
      const address = {
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St',
        city: 'Rome',
        postalCode: '00100',
        country: 'IT',
        isDefault: false,
      };

      const createdAddress = {
        id: 'addr-1',
        customerId: 'cust-1',
        ...address,
      };

      (prismaMock.customerAddress.create as jest.Mock).mockResolvedValue(createdAddress);

      const result = await shopAuthService.addAddress('cust-1', address);

      expect(result.id).toBe('addr-1');
    });

    it('should unset other defaults when setting new default', async () => {
      const address = {
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St',
        city: 'Rome',
        postalCode: '00100',
        country: 'IT',
        isDefault: true,
      };

      (prismaMock.customerAddress.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaMock.customerAddress.create as jest.Mock).mockResolvedValue({
        id: 'addr-new',
        ...address,
      });

      await shopAuthService.addAddress('cust-1', address);

      expect(prismaMock.customerAddress.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1', isDefault: true },
          data: { isDefault: false },
        })
      );
    });
  });

  describe('updateAddress', () => {
    it('should update existing address', async () => {
      const existing = {
        id: 'addr-1',
        customerId: 'cust-1',
      };

      (prismaMock.customerAddress.findFirst as jest.Mock).mockResolvedValue(existing);
      (prismaMock.customerAddress.update as jest.Mock).mockResolvedValue({
        id: 'addr-1',
        city: 'Milan',
      });

      const result = await shopAuthService.updateAddress('cust-1', 'addr-1', {
        city: 'Milan',
      });

      expect(result.city).toBe('Milan');
    });

    it('should throw error when address not found', async () => {
      (prismaMock.customerAddress.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.updateAddress('cust-1', 'addr-unknown', { city: 'Milan' })
      ).rejects.toThrow('Address not found');
    });
  });

  describe('deleteAddress', () => {
    it('should delete address', async () => {
      const existing = {
        id: 'addr-1',
        customerId: 'cust-1',
      };

      (prismaMock.customerAddress.findFirst as jest.Mock).mockResolvedValue(existing);
      (prismaMock.customerAddress.delete as jest.Mock).mockResolvedValue({});

      await shopAuthService.deleteAddress('cust-1', 'addr-1');

      expect(prismaMock.customerAddress.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-1' },
        })
      );
    });

    it('should throw error when address not found', async () => {
      (prismaMock.customerAddress.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.deleteAddress('cust-1', 'addr-unknown')
      ).rejects.toThrow('Address not found');
    });
  });

  describe('getAddresses', () => {
    it('should return customer addresses sorted', async () => {
      const addresses = [
        { id: 'addr-1', isDefault: false },
        { id: 'addr-2', isDefault: true },
      ];

      (prismaMock.customerAddress.findMany as jest.Mock).mockResolvedValue(addresses);

      const result = await shopAuthService.getAddresses('cust-1');

      expect(result).toHaveLength(2);
      expect(prismaMock.customerAddress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1' },
          orderBy: expect.any(Array),
        })
      );
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const orders = [
        { id: 'order-1', items: [] },
        { id: 'order-2', items: [] },
      ];

      (prismaMock.order.findMany as jest.Mock).mockResolvedValue(orders);
      (prismaMock.order.count as jest.Mock).mockResolvedValue(5);

      const result = await shopAuthService.getOrders('cust-1', 1, 10);

      expect(result.orders).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('getOrder', () => {
    it('should return order with details', async () => {
      const order = {
        id: 'order-1',
        customerId: 'cust-1',
        items: [{ product: { id: 'prod-1' } }],
        customer: { firstName: 'John' },
      };

      (prismaMock.order.findFirst as jest.Mock).mockResolvedValue(order);

      const result = await shopAuthService.getOrder('cust-1', 'order-1');

      expect(result.id).toBe('order-1');
    });

    it('should throw error when order not found', async () => {
      (prismaMock.order.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        shopAuthService.getOrder('cust-1', 'order-unknown')
      ).rejects.toThrow('Order not found');
    });
  });
});
