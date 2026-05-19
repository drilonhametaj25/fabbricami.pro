/**
 * Admin API Service
 * HTTP client for MegaAdmin panel
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('admin_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || 'Request failed',
      };
    }

    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    request<{
      superAdmin: { id: string; email: string; name: string };
      tokens: { accessToken: string; refreshToken: string };
    }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  setup: (email: string, password: string, name: string) =>
    request<{
      superAdmin: { id: string; email: string; name: string };
      tokens: { accessToken: string; refreshToken: string };
    }>('/admin/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  // Dashboard
  getDashboard: () =>
    request<{
      totalTenants: number;
      activeTenants: number;
      trialTenants: number;
      paidTenants: number;
      expiredTenants: number;
      mrr: number;
      arr: number;
      trialConversionRate: number;
      churnRate: number;
      recentSignups: Array<{
        id: string;
        name: string;
        createdAt: string;
        status: string;
      }>;
      trialsEndingSoon: Array<{
        id: string;
        name: string;
        trialEndsAt: string;
        ownerEmail: string;
      }>;
      revenueByPlan: Array<{
        planCode: string;
        planName: string;
        count: number;
        revenue: number;
      }>;
    }>('/admin/dashboard'),

  // Plans
  getPlans: () =>
    request<{
      items: Array<{
        id: string;
        code: string;
        name: string;
        description?: string;
        priceMonthly: number;
        priceYearly: number;
        features: { modules: string[]; capabilities: string[] };
        limits: {
          maxUsers: number;
          maxWarehouses: number;
          maxProducts: number;
          maxOrders: number;
          maxSuppliers: number;
        };
        isActive: boolean;
        sortOrder: number;
        stripeProductId?: string;
        stripePriceMonthlyId?: string;
        stripePriceYearlyId?: string;
        _count: { subscriptions: number };
      }>;
    }>('/admin/plans'),

  getPlan: (id: string) =>
    request<{
      id: string;
      code: string;
      name: string;
      description?: string;
      priceMonthly: number;
      priceYearly: number;
      features: { modules: string[]; capabilities: string[] };
      limits: {
        maxUsers: number;
        maxWarehouses: number;
        maxProducts: number;
        maxOrders: number;
        maxSuppliers: number;
      };
      isActive: boolean;
      sortOrder: number;
    }>(`/admin/plans/${id}`),

  createPlan: (data: {
    code: string;
    name: string;
    description?: string;
    priceMonthly: number;
    priceYearly: number;
    features: { modules: string[]; capabilities: string[] };
    limits: {
      maxUsers: number;
      maxWarehouses: number;
      maxProducts: number;
      maxOrders: number;
      maxSuppliers: number;
    };
    sortOrder?: number;
    isActive?: boolean;
  }) =>
    request('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePlan: (id: string, data: Partial<Parameters<typeof adminApi.createPlan>[0]>) =>
    request(`/admin/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePlan: (id: string) =>
    request(`/admin/plans/${id}`, {
      method: 'DELETE',
    }),

  syncPlanToStripe: (id: string) =>
    request<{
      success: boolean;
      productId?: string;
      priceMonthlyId?: string;
      priceYearlyId?: string;
      error?: string;
    }>(`/admin/plans/${id}/sync-stripe`, {
      method: 'POST',
    }),

  // Tenants
  getTenants: (params?: {
    status?: string;
    subscriptionStatus?: string;
    planCode?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return request<{
      items: Array<{
        id: string;
        name: string;
        slug: string;
        status: string;
        createdAt: string;
        subscription: {
          status: string;
          planCode: string;
          planName: string;
          trialEndsAt?: string;
          currentPeriodEnd: string;
        } | null;
        owner: {
          email: string;
          name: string;
        } | null;
        membersCount: number;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/admin/tenants${query ? `?${query}` : ''}`);
  },

  getTenant: (id: string) =>
    request<{
      id: string;
      name: string;
      slug: string;
      status: string;
      createdAt: string;
      subscription: {
        id: string;
        status: string;
        trialEndsAt?: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        plan: {
          code: string;
          name: string;
          priceMonthly: number;
          priceYearly: number;
        };
        billing: Array<{
          id: string;
          amount: number;
          status: string;
          createdAt: string;
        }>;
      } | null;
      members: Array<{
        id: string;
        role: string;
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          lastLogin?: string;
          isActive: boolean;
        };
      }>;
    }>(`/admin/tenants/${id}`),

  extendTrial: (tenantId: string, days: number) =>
    request<{ success: boolean; newTrialEnd?: string; error?: string }>(
      `/admin/tenants/${tenantId}/extend-trial`,
      {
        method: 'POST',
        body: JSON.stringify({ days }),
      }
    ),

  changeTenantPlan: (tenantId: string, planCode: string) =>
    request(`/admin/tenants/${tenantId}/change-plan`, {
      method: 'POST',
      body: JSON.stringify({ planCode }),
    }),

  setTenantStatus: (tenantId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') =>
    request(`/admin/tenants/${tenantId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  // Stripe
  getStripeStatus: () =>
    request<{
      isConfigured: boolean;
      mode: 'live' | 'test' | 'unknown';
      webhookConfigured: boolean;
    }>('/admin/stripe/status'),

  testStripeConnection: () =>
    request<{
      connected: boolean;
      accountId?: string;
      businessName?: string;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
      country?: string;
      defaultCurrency?: string;
      error?: string;
    }>('/admin/stripe/test-connection'),

  getPlansStripeStatus: () =>
    request<{
      plans: Array<{
        id: string;
        code: string;
        name: string;
        priceMonthly: number;
        priceYearly: number;
        stripeProductId: string | null;
        stripePriceMonthlyId: string | null;
        stripePriceYearlyId: string | null;
        isActive: boolean;
        syncStatus: 'synced' | 'partial' | 'not_synced';
        subscriptionCount: number;
      }>;
    }>('/admin/stripe/plans-status'),

  syncAllPlansToStripe: () =>
    request<{
      results: Array<{
        planId: string;
        planCode: string;
        success: boolean;
        error?: string;
      }>;
      syncedCount: number;
      failedCount: number;
    }>('/admin/stripe/sync-all', {
      method: 'POST',
    }),

  getWebhookLogs: (limit?: number) =>
    request<{
      items: Array<{
        id: string;
        stripeInvoiceId?: string;
        amount: number;
        status: string;
        createdAt: string;
        subscription: {
          tenant: {
            name: string;
          };
        };
      }>;
    }>(`/admin/stripe/webhooks${limit ? `?limit=${limit}` : ''}`),

  // Coupons
  getCoupons: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.limit) qs.append('limit', String(params.limit));
    const q = qs.toString();
    return request<{
      items: Array<{
        id: string;
        code: string;
        name?: string;
        type: 'PERCENTAGE' | 'FIXED_AMOUNT';
        discountValue: number;
        validFrom: string;
        validTo: string;
        maxUses?: number;
        usageCount: number;
        isActive: boolean;
      }>;
      total: number;
    }>(`/admin/coupons${q ? `?${q}` : ''}`);
  },

  createCoupon: (data: {
    code: string;
    name?: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    validFrom?: string;
    validUntil?: string;
    maxUses?: number | null;
    isActive?: boolean;
  }) =>
    request('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCoupon: (id: string, data: Partial<{
    name: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    validFrom: string;
    validUntil: string;
    maxUses: number | null;
    isActive: boolean;
  }>) =>
    request(`/admin/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Tickets
  getTickets: (params?: { status?: string; type?: string; priority?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
    });
    const q = qs.toString();
    return request<{
      items: Array<{
        id: string;
        tenantId: string;
        createdById: string;
        type: 'BUG' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'SUPPORT';
        priority: 'LOW' | 'NORMAL' | 'HIGH';
        status: 'OPEN' | 'IN_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
        title: string;
        description: string;
        adminNotes?: string;
        createdAt: string;
        resolvedAt?: string;
      }>;
      total: number;
    }>(`/admin/tickets${q ? `?${q}` : ''}`);
  },

  updateTicket: (id: string, data: { status?: string; priority?: string; adminNotes?: string | null }) =>
    request(`/admin/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Audit Logs
  getAuditLogs: (page?: number, limit?: number) =>
    request<{
      items: Array<{
        id: string;
        action: string;
        entityType?: string;
        entityId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
        createdAt: string;
        superAdmin: {
          email: string;
          name: string;
        };
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/admin/audit-logs?page=${page || 1}&limit=${limit || 50}`),
};

export default adminApi;
