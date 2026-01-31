'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice, getDiscountPercentage, cn } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  showQuickAdd?: boolean;
  className?: string;
}

export function ProductCard({ product, showQuickAdd = true, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const { addItem } = useCartStore();

  const hasDiscount = product.onSale && product.salePrice && product.salePrice < product.price;
  const displayPrice = hasDiscount ? product.salePrice! : product.price;
  const discountPercent = hasDiscount
    ? getDiscountPercentage(product.price, product.salePrice!)
    : 0;

  const imageUrl = product.imageUrl || product.mainImageUrl || '/images/placeholder-product.svg';

  // 3D Tilt effect on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;

    gsap.to(card, {
      rotateX: rotateX,
      rotateY: rotateY,
      duration: 0.3,
      ease: 'power2.out',
      transformPerspective: 1000,
    });

    // Update glow position
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        x: x - 100,
        y: y - 100,
        opacity: 0.15,
        duration: 0.3,
      });
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 1.02,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 60px rgba(201, 162, 39, 0.1)',
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        duration: 0.5,
        ease: 'power3.out',
      });
    }
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 0,
        duration: 0.3,
      });
    }
  }, []);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAddingToCart) return;

    setIsAddingToCart(true);

    // Button animation
    const button = e.currentTarget;
    gsap.fromTo(
      button,
      { scale: 1 },
      { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }
    );

    try {
      await addItem(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Heart animation
    const heart = e.currentTarget;
    gsap.fromTo(
      heart,
      { scale: 1 },
      { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1, ease: 'back.out(2)' }
    );

    setIsWishlisted(!isWishlisted);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'product-card group relative bg-surface-card rounded-2xl overflow-hidden',
        'transform-gpu will-change-transform',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Glow effect that follows cursor */}
      <div
        ref={glowRef}
        className="absolute w-[200px] h-[200px] rounded-full pointer-events-none opacity-0 z-10"
        style={{
          background: 'radial-gradient(circle, rgba(201, 162, 39, 0.3), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      <Link href={`/product/${product.slug}`} className="block">
        {/* Image Container */}
        <div className="product-card-image relative aspect-[4/5] overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            priority={false}
          />

          {/* Shine effect on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
              transform: 'translateX(-100%)',
              animation: isHovered ? 'shine 1.5s ease-in-out infinite' : 'none',
            }}
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
            {product.isNew && (
              <span className="px-3 py-1 bg-gold text-primary text-xs font-bold rounded-full shadow-lg">
                NEW
              </span>
            )}
            {hasDiscount && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                -{discountPercent}%
              </span>
            )}
            {!product.inStock && (
              <span className="px-3 py-1 bg-surface-card/90 backdrop-blur-sm text-text-muted text-xs font-medium rounded-full">
                Out of Stock
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={handleToggleWishlist}
            className={cn(
              'absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all z-20',
              'bg-surface-card/80 backdrop-blur-sm',
              isWishlisted
                ? 'text-red-500'
                : 'text-text-muted hover:text-white hover:bg-surface-hover'
            )}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart className={cn('w-5 h-5 transition-transform', isWishlisted && 'fill-current scale-110')} />
          </button>

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Quick Actions */}
          {showQuickAdd && product.inStock && (
            <div className="absolute bottom-4 left-4 right-4 flex gap-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 z-20">
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gold text-primary font-medium rounded-xl hover:bg-gold-400 transition-all active:scale-95"
              >
                {isAddingToCart ? (
                  <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add</span>
                  </>
                )}
              </button>
              <span
                className="p-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="View details"
              >
                <Eye className="w-5 h-5" />
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 relative z-10">
          {/* Category */}
          {product.category && (
            <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
              {typeof product.category === 'string' ? product.category : product.category.name}
            </p>
          )}

          {/* Name */}
          <h3 className="text-white font-medium mb-2 line-clamp-2 group-hover:text-gold transition-colors duration-300">
            {product.name}
          </h3>

          {/* Rating */}
          {(product.rating || product.averageRating) && (
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={cn(
                    'w-4 h-4 transition-colors',
                    star <= Math.round(Number(product.rating || product.averageRating) || 0)
                      ? 'text-gold fill-current'
                      : 'text-text-muted'
                  )}
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-text-muted text-xs ml-1">
                ({product.reviewCount || 0})
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="text-gold font-semibold text-lg">
              {formatPrice(displayPrice)}
            </span>
            {hasDiscount && (
              <span className="text-text-muted text-sm line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* CSS for shine animation */}
      <style jsx>{`
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export default ProductCard;
