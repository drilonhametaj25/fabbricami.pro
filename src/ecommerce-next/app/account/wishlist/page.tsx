'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Trash2, ShoppingBag, AlertCircle } from 'lucide-react';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Product, ApiResponse } from '@/types';

export default function WishlistPage() {
  const { items: wishlistIds, removeItem: removeFromWishlist } = useWishlistStore();
  const { addItem: addToCart } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());

  // Fetch wishlist products
  useEffect(() => {
    const fetchProducts = async () => {
      if (wishlistIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch products by IDs
        const response = await api.get<ApiResponse<{ items: Product[] }>>(
          '/shop/products',
          { ids: wishlistIds.join(',') }
        );

        if (response.success && response.data) {
          setProducts(response.data.items || []);
        }
      } catch (err) {
        console.error('Failed to fetch wishlist products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [wishlistIds]);

  const handleAddToCart = async (productId: string) => {
    setAddingToCart((prev) => new Set(prev).add(productId));
    try {
      await addToCart(productId, 1);
    } finally {
      setAddingToCart((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-card rounded-2xl p-4 animate-pulse">
            <div className="aspect-square bg-surface-raised rounded-lg mb-4" />
            <div className="space-y-2">
              <div className="h-5 bg-surface-raised rounded w-3/4" />
              <div className="h-4 bg-surface-raised rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-white">
          Lista Desideri ({products.length})
        </h2>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="bg-surface-card rounded-2xl p-8 text-center">
          <Heart className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            La tua lista desideri e vuota
          </h3>
          <p className="text-text-secondary mb-6">
            Salva i prodotti che ti piacciono per trovarli facilmente in seguito
          </p>
          <Link href="/shop" className="btn-primary btn-medium">
            Esplora lo Shop
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {products.map((product) => {
              const hasDiscount = product.onSale && product.salePrice && product.salePrice < product.price;
              const discountPercentage = hasDiscount
                ? Math.round((1 - product.salePrice! / product.price) * 100)
                : 0;
              const inStock = product.inStock !== false;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: -100 }}
                  className="bg-surface-card rounded-2xl overflow-hidden group"
                >
                  {/* Image */}
                  <Link
                    href={`/product/${product.slug}`}
                    className="block relative aspect-square bg-surface-raised"
                  >
                    {product.imageUrl && (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {hasDiscount && (
                        <span className="px-2 py-1 bg-error text-white text-xs font-medium rounded">
                          -{discountPercentage}%
                        </span>
                      )}
                      {!inStock && (
                        <span className="px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded">
                          Esaurito
                        </span>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemove(product.id);
                      }}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-raised/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-error hover:text-white transition-colors"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Link>

                  {/* Content */}
                  <div className="p-4">
                    {/* Category */}
                    {product.categories?.[0] && (
                      <p className="text-xs text-gold mb-1">
                        {product.categories[0].name}
                      </p>
                    )}

                    {/* Title */}
                    <Link
                      href={`/product/${product.slug}`}
                      className="font-medium text-white hover:text-gold transition-colors line-clamp-2 mb-2"
                    >
                      {product.name}
                    </Link>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-lg font-semibold text-gold">
                        {formatPrice(hasDiscount ? product.salePrice! : product.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-sm text-text-muted line-through">
                          {formatPrice(product.price)}
                        </span>
                      )}
                    </div>

                    {/* Stock Status */}
                    {!inStock && (
                      <div className="flex items-center gap-2 text-sm text-warning mb-4">
                        <AlertCircle className="w-4 h-4" />
                        <span>Prodotto esaurito</span>
                      </div>
                    )}

                    {/* Add to Cart */}
                    <button
                      onClick={() => handleAddToCart(product.id)}
                      disabled={!inStock || addingToCart.has(product.id)}
                      className="w-full btn-primary btn-medium justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingToCart.has(product.id) ? (
                        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          {inStock ? 'Aggiungi al Carrello' : 'Non Disponibile'}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
