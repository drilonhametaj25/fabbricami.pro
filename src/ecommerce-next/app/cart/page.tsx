'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Tag, X } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const {
    cart,
    loading,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCartStore();

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));
    try {
      await updateQuantity(itemId, newQuantity);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));
    try {
      await removeItem(itemId);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      await applyCoupon(couponCode);
      setCouponCode('');
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setCouponLoading(false);
    }
  };

  // Empty cart
  if (!loading && (!cart || cart.items.length === 0)) {
    return (
      <div className="min-h-screen bg-primary pt-28 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-surface-card flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-text-muted" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-white mb-4">
            Your cart is empty
          </h1>
          <p className="text-text-secondary mb-8 max-w-md">
            You haven&apos;t added any products to your cart yet. Browse our shop to find the perfect miniatures for you.
          </p>
          <Link href="/shop" className="btn-primary btn-large">
            Start Shopping
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary pt-28">
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-white mb-8">
          Cart ({cart?.items.length || 0})
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-card rounded-2xl p-4 animate-pulse flex gap-4"
                >
                  <div className="w-24 h-24 bg-surface-raised rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-surface-raised rounded w-3/4" />
                    <div className="h-4 bg-surface-raised rounded w-1/2" />
                    <div className="h-6 bg-surface-raised rounded w-24" />
                  </div>
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {cart?.items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={`bg-surface-card rounded-2xl p-4 md:p-6 ${
                      updatingItems.has(item.id) ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex gap-4 md:gap-6">
                      {/* Product Image */}
                      <Link
                        href={`/product/${item.product?.slug || item.productId}`}
                        className="flex-shrink-0"
                      >
                        <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden bg-surface-raised">
                          {(item.product?.mainImageUrl || item.product?.imageUrl) && (
                            <Image
                              src={item.product.mainImageUrl || item.product.imageUrl || ''}
                              alt={item.product?.name || 'Product'}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                      </Link>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/product/${item.product?.slug || item.productId}`}
                          className="font-medium text-white hover:text-gold transition-colors line-clamp-2"
                        >
                          {item.product?.name || 'Product'}
                        </Link>

                        {item.variant && (
                          <p className="text-sm text-text-secondary mt-1">
                            Variant: {item.variant.name}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-4">
                          {/* Quantity */}
                          <div className="flex items-center border border-white/10 rounded-lg">
                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity - 1)
                              }
                              disabled={
                                item.quantity <= 1 || updatingItems.has(item.id)
                              }
                              className="p-2 text-white hover:text-gold disabled:text-gray-600 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity + 1)
                              }
                              disabled={updatingItems.has(item.id)}
                              className="p-2 text-white hover:text-gold disabled:text-gray-600 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={updatingItems.has(item.id)}
                            className="text-text-secondary hover:text-error transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-semibold text-gold">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-sm text-text-muted">
                            {formatPrice(item.unitPrice)} each
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-surface-card rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-xl font-semibold text-white mb-6">
                Order Summary
              </h2>

              {/* Coupon */}
              <form onSubmit={handleApplyCoupon} className="mb-6">
                <label className="text-sm text-text-secondary mb-2 block">
                  Discount Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="CODICE"
                    className="flex-1 px-4 py-2 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50 uppercase"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="btn-secondary btn-small"
                  >
                    {couponLoading ? (
                      <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Tag className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {couponError && (
                  <p className="text-sm text-error mt-2">{couponError}</p>
                )}
              </form>

              {/* Applied Coupon */}
              {cart?.coupon && (
                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg mb-6">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-success" />
                    <span className="text-success font-medium">
                      {cart.coupon.code}
                    </span>
                  </div>
                  <button
                    onClick={() => removeCoupon()}
                    className="text-text-muted hover:text-error transition-colors"
                    aria-label="Remove coupon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart?.subtotal || 0)}</span>
                </div>

                {cart?.discount && cart.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>-{formatPrice(cart.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-text-secondary">
                  <span>Shipping</span>
                  <span>
                    {cart?.shipping
                      ? formatPrice(cart.shipping)
                      : 'Calculated at checkout'}
                  </span>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between text-white font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-gold">{formatPrice(cart?.total || 0)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href="/checkout"
                className="w-full btn-primary btn-large justify-center"
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </Link>

              {/* Continue Shopping */}
              <Link
                href="/shop"
                className="block text-center text-text-secondary hover:text-gold mt-4 text-sm transition-colors"
              >
                Continue Shopping
              </Link>

              {/* Payment Icons */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-text-muted text-center mb-3">
                  Accepted payment methods
                </p>
                <div className="flex justify-center gap-2 opacity-50">
                  <div className="w-10 h-6 bg-white rounded" />
                  <div className="w-10 h-6 bg-white rounded" />
                  <div className="w-10 h-6 bg-white rounded" />
                  <div className="w-10 h-6 bg-white rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
