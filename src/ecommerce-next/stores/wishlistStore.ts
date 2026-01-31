'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { WishlistItem } from '@/types';

interface WishlistStore {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchWishlist: () => Promise<void>;
  toggle: (productId: string, variantId?: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  setRestockNotification: (itemId: string, notify: boolean) => Promise<void>;

  // Getters
  count: () => number;
  isEmpty: () => boolean;
  isInWishlist: (productId: string, variantId?: string) => boolean;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchWishlist: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get<{ items: WishlistItem[] }>('/shop/wishlist');
      set({ items: response.items || [], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false, items: [] });
    }
  },

  toggle: async (productId: string, variantId?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post<{ items: WishlistItem[]; added: boolean }>(
        '/shop/wishlist/toggle',
        { productId, variantId }
      );
      set({ items: response.items || [], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  removeItem: async (itemId: string) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/shop/wishlist/${itemId}`);
      set((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  clearWishlist: async () => {
    set({ loading: true, error: null });
    try {
      await api.delete('/shop/wishlist');
      set({ items: [], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  setRestockNotification: async (itemId: string, notify: boolean) => {
    set({ loading: true, error: null });
    try {
      const response = await api.patch<WishlistItem>(`/shop/wishlist/${itemId}/notify`, {
        notifyRestock: notify,
      });
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, notifyRestock: response.notifyRestock } : item
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // Getters
  count: () => get().items.length,

  isEmpty: () => get().items.length === 0,

  isInWishlist: (productId: string, variantId?: string) => {
    return get().items.some(
      (item) =>
        item.productId === productId &&
        (variantId ? item.variantId === variantId : !item.variantId)
    );
  },
}));
