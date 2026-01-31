'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice, getImageUrl } from '@/lib/utils';

export function CartDrawer() {
  const {
    cart,
    loading,
    isDrawerOpen,
    closeDrawer,
    fetchCart,
    updateQuantity,
    removeItem,
    itemCount,
  } = useCartStore();

  // Fetch cart when drawer opens
  useEffect(() => {
    if (isDrawerOpen) {
      fetchCart();
    }
  }, [isDrawerOpen, fetchCart]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateQuantity(itemId, newQuantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const count = itemCount();

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-surface-overlay z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-gold" />
                <h2 className="font-display text-xl font-semibold text-white">
                  Your Cart
                </h2>
                {count > 0 && (
                  <span className="px-2 py-0.5 bg-gold/20 text-gold text-sm rounded-full">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <button
                onClick={closeDrawer}
                className="btn-icon text-text-muted hover:text-white"
                aria-label="Close cart"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && !cart ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : !cart?.items || cart.items.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingBag className="w-16 h-16 text-text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Your cart is empty
                  </h3>
                  <p className="text-text-secondary mb-6">
                    Start adding some amazing products!
                  </p>
                  <Link href="/shop" onClick={closeDrawer} className="btn-primary">
                    Browse Shop
                  </Link>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {cart.items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      className="flex gap-4 p-3 bg-surface-card rounded-xl"
                    >
                      {/* Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0">
                        <Image
                          src={getImageUrl(
                            item.variant?.mainImageUrl || item.product.mainImageUrl
                          )}
                          alt={item.product.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">
                          {item.product.name}
                        </h4>
                        {item.variant && (
                          <p className="text-text-muted text-sm">
                            {item.variant.name}
                          </p>
                        )}
                        <p className="text-gold font-semibold mt-1">
                          {formatPrice(item.unitPrice)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1 || loading}
                            className="w-7 h-7 rounded-md bg-surface-hover flex items-center justify-center text-text-muted hover:text-white disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity + 1)
                            }
                            disabled={loading}
                            className="w-7 h-7 rounded-md bg-surface-hover flex items-center justify-center text-text-muted hover:text-white disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={loading}
                            className="ml-auto text-text-muted hover:text-error"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart?.items && cart.items.length > 0 && (
              <div className="p-4 border-t border-white/10 space-y-4">
                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Subtotal</span>
                    <span>{formatPrice(cart.subtotal)}</span>
                  </div>
                  {cart.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-{formatPrice(cart.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-gold">{formatPrice(cart.total)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/cart"
                    onClick={closeDrawer}
                    className="btn-secondary justify-center"
                  >
                    View Cart
                  </Link>
                  <Link
                    href="/checkout"
                    onClick={closeDrawer}
                    className="btn-primary justify-center"
                  >
                    Checkout
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
