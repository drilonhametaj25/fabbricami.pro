import { PrismaClient, Customer } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { emailService } from './email.service';
import { config } from '../config/environment';

const prisma = new PrismaClient();

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;
const SALT_ROUNDS = 10;

export interface CustomerTokenPayload {
  id: string;
  email: string;
  type: 'customer';
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  newsletter?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

class ShopAuthService {
  /**
   * Register a new customer
   */
  async register(data: RegisterData): Promise<{ customer: Customer; token: string }> {
    // Check if email already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: { email: data.email.toLowerCase() },
    });

    if (existingCustomer) {
      throw new Error('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Generate unique customer code
    const customerCode = `WEB-${Date.now().toString(36).toUpperCase()}`;

    // Generate email verification token
    const verifyToken = randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 3600000); // 24 hours

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        type: 'B2C',
        code: customerCode,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isActive: true,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyTokenExpires: verifyExpires,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(
      customer.email!,
      verifyToken,
      customer.firstName || 'Customer'
    );

    // Create loyalty account with bonus points for registration
    await prisma.loyaltyAccount.create({
      data: {
        customerId: customer.id,
        points: 50, // Bonus registration points
        tier: 'BRONZE',
        totalEarned: 50,
        totalSpent: 0,
      },
    });

    // Subscribe to newsletter if opted in
    if (data.newsletter) {
      await prisma.newsletterSubscription.create({
        data: {
          email: customer.email || '',
          customerId: customer.id,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          preferences: { promotions: true, news: true },
        },
      });
    }

    // Generate JWT token
    const token = this.generateToken(customer);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;

    return {
      customer: customerWithoutPassword as Customer,
      token,
    };
  }

  /**
   * Login customer
   */
  async login(data: LoginData): Promise<{ customer: Customer; token: string }> {
    // Find customer by email
    const customer = await prisma.customer.findFirst({
      where: { email: data.email.toLowerCase() },
      include: {
        loyaltyAccount: true,
      },
    });

    if (!customer) {
      throw new Error('Invalid credentials');
    }

    if (!customer.password) {
      throw new Error('Account not configured for password login');
    }

    if (!customer.isActive) {
      throw new Error('Account disabled. Please contact support.');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, customer.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.generateToken(customer);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;

    return {
      customer: customerWithoutPassword as unknown as Customer,
      token,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyAccount: true,
        savedAddresses: true,
      },
    });

    if (!customer) return null;

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;
    return customerWithoutPassword as unknown as Customer;
  }

  /**
   * Update customer profile
   */
  async updateProfile(customerId: string, data: UpdateProfileData): Promise<Customer> {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
      },
      include: {
        loyaltyAccount: true,
      },
    });

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;
    return customerWithoutPassword as unknown as Customer;
  }

  /**
   * Change password
   */
  async changePassword(customerId: string, data: ChangePasswordData): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || !customer.password) {
      throw new Error('Customer not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, customer.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, SALT_ROUNDS);

    // Update password
    await prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetToken,
        resetTokenExpires: resetExpires,
      },
    });

    // Send password reset email
    await emailService.sendPasswordResetEmail(
      customer.email!,
      resetToken,
      customer.firstName || 'Customer'
    );
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordData): Promise<void> {
    const customer = await prisma.customer.findFirst({
      where: {
        resetToken: data.token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!customer) {
      throw new Error('Invalid or expired token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Update password and clear reset token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ customer: Customer; token: string }> {
    const customer = await prisma.customer.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!customer) {
      throw new Error('Invalid or expired verification token');
    }

    // Update customer as verified
    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpires: null,
      },
    });

    // Send welcome email
    await emailService.sendWelcomeEmail(
      customer.email!,
      customer.firstName || 'Customer'
    );

    // Generate JWT token
    const jwtToken = this.generateToken(updatedCustomer);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = updatedCustomer;

    return {
      customer: customerWithoutPassword as Customer,
      token: jwtToken,
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      // Don't reveal if email exists
      return;
    }

    if (customer.emailVerified) {
      throw new Error('Email is already verified');
    }

    // Generate new verification token
    const verifyToken = randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 3600000); // 24 hours

    // Update verification token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyTokenExpires: verifyExpires,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(
      customer.email!,
      verifyToken,
      customer.firstName || 'Customer'
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): CustomerTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as CustomerTokenPayload;
    } catch {
      throw new Error('Invalid token');
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(customer: Customer): string {
    const payload: CustomerTokenPayload = {
      id: customer.id,
      email: customer.email || '',
      type: 'customer',
    };

    return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN as any });
  }

  /**
   * Add customer address
   */
  async addAddress(customerId: string, address: {
    firstName: string;
    lastName: string;
    company?: string;
    address: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
    isDefault?: boolean;
  }): Promise<any> {
    // If setting as default, unset other defaults
    if (address.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.create({
      data: {
        customerId,
        type: 'shipping',
        firstName: address.firstName,
        lastName: address.lastName,
        company: address.company,
        address1: address.address,
        address2: address.addressLine2,
        city: address.city,
        state: address.state,
        postcode: address.postalCode,
        country: address.country,
        phone: address.phone,
        isDefault: address.isDefault,
      } as any,
    });
  }

  /**
   * Update customer address
   */
  async updateAddress(customerId: string, addressId: string, address: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  }): Promise<any> {
    // Verify ownership
    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new Error('Address not found');
    }

    // If setting as default, unset other defaults
    if (address.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.update({
      where: { id: addressId },
      data: address,
    });
  }

  /**
   * Delete customer address
   */
  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    // Verify ownership
    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new Error('Address not found');
    }

    await prisma.customerAddress.delete({
      where: { id: addressId },
    });
  }

  /**
   * Get customer addresses
   */
  async getAddresses(customerId: string): Promise<any[]> {
    return prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get customer orders
   */
  async getOrders(customerId: string, page = 1, limit = 10): Promise<{
    orders: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, images: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single order
   */
  async getOrder(customerId: string, orderId: string): Promise<any> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true },
            },
          },
        },
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }
}

export const shopAuthService = new ShopAuthService();
