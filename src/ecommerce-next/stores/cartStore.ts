'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setSessionId } from '@/lib/api';
import type { Cart, ShippingAddress } from '@/types';
import { generateId } from '@/lib/utils';

interface CartStore {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  sessionId: string | null;
  isDrawerOpen: boolean;

  // Actions
  initSession: () => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  setShippingAddress: (address: ShippingAddress) => Promise<void>;
  setShippingMethod: (methodId: string) => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Getters
  itemCount: () => number;
  subtotal: () => number;
  total: () => number;
  isEmpty: () => boolean;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: null,
      loading: false,
      error: null,
      sessionId: null,
      isDrawerOpen: false,

      initSession: () => {
        let sessionId = get().sessionId;
        if (!sessionId) {
          sessionId = generateId();
          set({ sessionId });
        }
        setSessionId(sessionId);
      },

      fetchCart: async () => {
        set({ loading: true, error: null });
        try {
          get().initSession();
          const cart = await api.get<Cart>('/shop/cart');
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
        }
      },

      addItem: async (productId: string, quantity: number, variantId?: string) => {
        set({ loading: true, error: null });
        try {
          get().initSession();
          const cart = await api.post<Cart>('/shop/cart/items', {
            productId,
            quantity,
            variantId,
          });
          set({ cart, loading: false, isDrawerOpen: true });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      updateQuantity: async (itemId: string, quantity: number) => {
        set({ loading: true, error: null });
        try {
          const cart = await api.patch<Cart>(`/shop/cart/items/${itemId}`, { quantity });
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      removeItem: async (itemId: string) => {
        set({ loading: true, error: null });
        try {
          const cart = await api.delete<Cart>(`/shop/cart/items/${itemId}`);
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      clearCart: async () => {
        set({ loading: true, error: null });
        try {
          await api.delete<void>('/shop/cart');
          set({ cart: null, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      applyCoupon: async (code: string) => {
        set({ loading: true, error: null });
        try {
          const cart = await api.post<Cart>('/shop/cart/coupon', { code });
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      removeCoupon: async () => {
        set({ loading: true, error: null });
        try {
          const cart = await api.delete<Cart>('/shop/cart/coupon');
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      setShippingAddress: async (address: ShippingAddress) => {
        set({ loading: true, error: null });
        try {
          const cart = await api.put<Cart>('/shop/cart/shipping-address', address);
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      setShippingMethod: async (methodId: string) => {
        set({ loading: true, error: null });
        try {
          const cart = await api.put<Cart>('/shop/cart/shipping-method', { methodId });
          set({ cart, loading: false });
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      // Getters
      itemCount: () => {
        const cart = get().cart;
        if (!cart?.items) return 0;
        return cart.items.reduce((sum, item) => sum + item.quantity, 0);
      },

      subtotal: () => {
        const cart = get().cart;
        return cart?.subtotal ?? 0;
      },

      total: () => {
        const cart = get().cart;
        return cart?.total ?? 0;
      },

      isEmpty: () => {
        const cart = get().cart;
        return !cart?.items || cart.items.length === 0;
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ sessionId: state.sessionId }),
    }
  )
);
