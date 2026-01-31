'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Minus, Plus, Truck, Shield, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import type { ProductDetail, ProductVariant } from '@/types';
import { formatPrice } from '@/lib/utils';

interface ProductInfoProps {
  product: ProductDetail;
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const { addItem } = useCartStore();
  const { isInWishlist, toggle: toggleWishlist } = useWishlistStore();

  const inWishlist = isInWishlist(product.id);

  // Calculate prices - if on sale, salePrice is the discounted price
  const variantOnSale = selectedVariant?.onSale && selectedVariant?.salePrice;
  const productOnSale = product.onSale && product.salePrice;
  const hasDiscount = variantOnSale || productOnSale;

  const currentPrice = hasDiscount
    ? (selectedVariant?.salePrice ?? product.salePrice ?? product.price)
    : (selectedVariant?.price ?? product.price);
  const originalPrice = selectedVariant?.price ?? product.price;
  const discountPercentage = hasDiscount && originalPrice > currentPrice
    ? Math.round((1 - currentPrice / originalPrice) * 100)
    : 0;

  // Check stock
  const inStock = selectedVariant
    ? selectedVariant.inStock
    : product.inStock !== false;
  const stockQuantity = selectedVariant?.stockQuantity ?? product.stockQuantity ?? 999;
  const lowStock = inStock && stockQuantity > 0 && stockQuantity <= 5;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > stockQuantity) return stockQuantity;
      return newQty;
    });
  };

  const handleAddToCart = async () => {
    if (!inStock || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      await addItem(product.id, quantity, selectedVariant?.id);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleWishlist = () => {
    toggleWishlist(product.id);
  };

  return (
    <div className="space-y-6">
      {/* Category */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        {product.categories?.[0] && (
          <span className="text-gold">{product.categories[0].name}</span>
        )}
      </div>

      {/* Title */}
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-white">
        {product.name}
      </h1>

      {/* Reviews Summary */}
      {(product.reviewCount ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-5 h-5 ${
                  i < Math.round(product.averageRating || product.rating || 0) ? 'text-gold' : 'text-gray-600'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-text-secondary">
            {product.rating?.toFixed(1)} ({product.reviewCount} reviews)
          </span>
        </div>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-gold">
          {formatPrice(currentPrice)}
        </span>
        {hasDiscount && (
          <>
            <span className="text-lg text-text-muted line-through">
              {formatPrice(originalPrice)}
            </span>
            <span className="px-2 py-1 bg-error/20 text-error text-sm font-medium rounded">
              -{discountPercentage}%
            </span>
          </>
        )}
      </div>

      {/* Short Description */}
      {product.shortDescription && (
        <p className="text-text-secondary leading-relaxed">
          {product.shortDescription}
        </p>
      )}

      {/* Variants */}
      {product.variants && product.variants.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-white">
            Variant
          </label>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                disabled={!variant.inStock}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  selectedVariant?.id === variant.id
                    ? 'border-gold bg-gold/10 text-gold'
                    : !variant.inStock
                    ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'border-white/10 text-white hover:border-gold/50'
                }`}
              >
                {variant.name}
                {!variant.inStock && (
                  <span className="ml-2 text-xs">(Out of Stock)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white">Quantity</label>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-white/10 rounded-lg">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="p-3 text-white hover:text-gold disabled:text-gray-600 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-white font-medium">
              {quantity}
            </span>
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= stockQuantity}
              className="p-3 text-white hover:text-gold disabled:text-gray-600 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Stock Status */}
          {inStock ? (
            <span className={`flex items-center gap-1.5 text-sm ${lowStock ? 'text-warning' : 'text-success'}`}>
              {lowStock ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Only {stockQuantity} left
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  In Stock
                </>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-error">
              <AlertCircle className="w-4 h-4" />
              Out of Stock
            </span>
          )}
        </div>
      </div>

      {/* Add to Cart & Wishlist */}
      <div className="flex gap-4">
        <motion.button
          onClick={handleAddToCart}
          disabled={!inStock || isAddingToCart}
          className={`flex-1 btn-primary btn-large justify-center ${
            !inStock ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isAddingToCart ? (
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : addedToCart ? (
            <>
              <Check className="w-5 h-5" />
              Added
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5" />
              {inStock ? 'Add to Cart' : 'Unavailable'}
            </>
          )}
        </motion.button>

        <motion.button
          onClick={handleToggleWishlist}
          className={`w-14 h-14 rounded-xl border flex items-center justify-center transition-all ${
            inWishlist
              ? 'border-gold bg-gold/10 text-gold'
              : 'border-white/10 text-white hover:border-gold/50 hover:text-gold'
          }`}
          whileTap={{ scale: 0.95 }}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} />
        </motion.button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/10">
        <div className="flex items-center gap-3 text-text-secondary">
          <div className="w-10 h-10 rounded-lg bg-surface-card flex items-center justify-center">
            <Truck className="w-5 h-5 text-gold" />
          </div>
          <div className="text-sm">
            <p className="text-white font-medium">Free Shipping</p>
            <p>Orders over 50</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-text-secondary">
          <div className="w-10 h-10 rounded-lg bg-surface-card flex items-center justify-center">
            <Shield className="w-5 h-5 text-gold" />
          </div>
          <div className="text-sm">
            <p className="text-white font-medium">Warranty</p>
            <p>Authentic products</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-text-secondary">
          <div className="w-10 h-10 rounded-lg bg-surface-card flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-gold" />
          </div>
          <div className="text-sm">
            <p className="text-white font-medium">Easy Returns</p>
            <p>30 days</p>
          </div>
        </div>
      </div>

      {/* Full Description */}
      {product.description && (
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
          <div
            className="text-text-secondary leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </div>
      )}

      {/* SKU */}
      {product.sku && (
        <p className="text-sm text-text-muted">
          SKU: {selectedVariant?.sku || product.sku}
        </p>
      )}
    </div>
  );
}
