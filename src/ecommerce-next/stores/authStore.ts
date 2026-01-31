'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { Customer } from '@/types';

interface AuthStore {
  customer: Customer | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<Customer>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;

  // Getters
  isAuthenticated: () => boolean;
  fullName: () => string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface LoginResponse {
  token: string;
  customer: Customer;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      customer: null,
      token: null,
      loading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post<LoginResponse>('/shop/auth/login', {
            email,
            password,
          });

          // Store token in localStorage for API requests
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', response.token);
          }

          set({
            customer: response.customer,
            token: response.token,
            loading: false,
          });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post<LoginResponse>('/shop/auth/register', data);

          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', response.token);
          }

          set({
            customer: response.customer,
            token: response.token,
            loading: false,
          });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        set({ customer: null, token: null, error: null });
      },

      fetchProfile: async () => {
        set({ loading: true, error: null });
        try {
          const customer = await api.get<Customer>('/shop/auth/me');
          set({ customer, loading: false });
        } catch (error) {
          // If token is invalid, logout
          get().logout();
          set({ error: (error as Error).message, loading: false });
        }
      },

      updateProfile: async (data: Partial<Customer>) => {
        set({ loading: true, error: null });
        try {
          const customer = await api.patch<Customer>('/shop/auth/profile', data);
          set({ customer, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        set({ loading: true, error: null });
        try {
          await api.post('/shop/auth/forgot-password', { email });
          set({ loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      resetPassword: async (token: string, password: string) => {
        set({ loading: true, error: null });
        try {
          await api.post('/shop/auth/reset-password', { token, password });
          set({ loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      // Getters
      isAuthenticated: () => {
        return !!get().token && !!get().customer;
      },

      fullName: () => {
        const customer = get().customer;
        if (!customer) return '';
        return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, customer: state.customer }),
      onRehydrateStorage: () => (state) => {
        // Restore token to localStorage on rehydration
        if (state?.token && typeof window !== 'undefined') {
          localStorage.setItem('auth_token', state.token);
        }
      },
    }
  )
);
