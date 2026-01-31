'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, Heart } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useNewArrivals } from '@/hooks/useProducts';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number | null;
  imageUrl: string | null;
  category?: { name: string } | string;
  isNew?: boolean;
}

export function NewArrivalsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const { addItem } = useCartStore();

  const { products: apiProducts, loading } = useNewArrivals(8);

  // Mock data fallback
  const mockProducts: Product[] = [
    { id: '1', name: 'Product One', slug: 'product-one', price: 89.99, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '2', name: 'Product Two', slug: 'product-two', price: 79.99, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '3', name: 'Product Three', slug: 'product-three', price: 49.99, salePrice: 39.99, imageUrl: '/images/placeholder-product.svg', category: 'Category B', isNew: true },
    { id: '4', name: 'Product Four', slug: 'product-four', price: 95.00, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '5', name: 'Product Five', slug: 'product-five', price: 110.00, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '6', name: 'Product Six', slug: 'product-six', price: 85.00, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '7', name: 'Product Seven', slug: 'product-seven', price: 125.00, imageUrl: '/images/placeholder-product.svg', category: 'Category A', isNew: true },
    { id: '8', name: 'Product Eight', slug: 'product-eight', price: 35.00, imageUrl: '/images/placeholder-product.svg', category: 'Category B', isNew: true },
  ];

  const displayProducts = apiProducts.length > 0 ? apiProducts : mockProducts;

  // Horizontal scroll animation
  useEffect(() => {
    if (!sectionRef.current || !trackRef.current || loading) return;

    const section = sectionRef.current;
    const track = trackRef.current;

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      const ctx = gsap.context(() => {
        // Calculate scroll distance
        const getScrollAmount = () => {
          const trackWidth = track.scrollWidth;
          const viewportWidth = window.innerWidth;
          return -(trackWidth - viewportWidth + 100);
        };

        // Title reveal animation
        gsap.fromTo(
          titleRef.current,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
          }
        );

        // Horizontal scroll with pin
        gsap.to(track, {
          x: getScrollAmount,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${track.scrollWidth - window.innerWidth}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              setProgress(self.progress * 100);
            },
          },
        });

        // Product cards stagger animation
        gsap.fromTo(
          '.product-card-item',
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 60%',
              toggleActions: 'play none none none',
            },
          }
        );
      }, section);

      return () => ctx.revert();
    }, 100);

    return () => clearTimeout(timeout);
  }, [loading, displayProducts]);

  const handleAddToCart = async (product: Product) => {
    try {
      await addItem(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const getCategoryName = (category: Product['category']): string => {
    if (!category) return '';
    if (typeof category === 'string') return category;
    return category.name || '';
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-primary py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-4 bg-surface-card rounded w-24 mb-3" />
            <div className="h-12 bg-surface-card rounded w-64 mb-12" />
          </div>
          <div className="flex gap-6 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[350px]">
                <div className="aspect-[4/5] bg-surface-card rounded-2xl mb-4" />
                <div className="h-4 bg-surface-card rounded w-3/4 mb-2" />
                <div className="h-4 bg-surface-card rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen bg-primary overflow-hidden"
    >
      {/* Section Header */}
      <div ref={titleRef} className="pt-24 pb-12 px-8 lg:px-16">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <p className="text-gold text-sm uppercase tracking-[0.2em] mb-3">New</p>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white">
              New Arrivals
            </h2>
          </div>
          <Link
            href="/shop?sort=newest"
            className="hidden md:flex items-center gap-2 text-text-secondary hover:text-gold transition-colors"
          >
            <span className="text-sm uppercase tracking-wider">View All</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 max-w-7xl mx-auto">
          <div className="h-px bg-white/10 relative overflow-hidden">
            <div
              ref={progressRef}
              className="absolute top-0 left-0 h-full bg-gold transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={trackRef}
        className="flex gap-6 lg:gap-8 px-8 lg:px-16 pb-24 will-change-transform"
      >
        {displayProducts.map((product) => (
          <div
            key={product.id}
            className="product-card-item flex-shrink-0 w-[300px] md:w-[350px] lg:w-[400px] group"
          >
            {/* Product Card */}
            <div className="relative overflow-hidden rounded-2xl bg-surface-card">
              {/* Image Container */}
              <Link href={`/product/${product.slug}`} className="block relative aspect-[4/5] overflow-hidden">
                <Image
                  src={product.imageUrl || '/images/placeholder-product.svg'}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 300px, (max-width: 1024px) 350px, 400px"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.isNew && (
                    <span className="px-3 py-1 bg-gold text-primary text-xs font-medium rounded-full">
                      NEW
                    </span>
                  )}
                  {product.salePrice && (
                    <span className="px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full">
                      SALE
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleAddToCart(product);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gold text-primary font-medium rounded-xl hover:bg-gold-400 transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="p-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                  </button>
                </div>
              </Link>

              {/* Product Info */}
              <div className="p-5">
                <p className="text-text-muted text-xs uppercase tracking-wider mb-2">
                  {getCategoryName(product.category)}
                </p>
                <Link href={`/product/${product.slug}`}>
                  <h3 className="text-white font-medium text-lg mb-3 group-hover:text-gold transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-3">
                  {product.salePrice ? (
                    <>
                      <span className="text-gold font-semibold text-lg">
                        {formatPrice(product.salePrice)}
                      </span>
                      <span className="text-text-muted line-through text-sm">
                        {formatPrice(product.price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-white font-semibold text-lg">
                      {formatPrice(product.price)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* View All Card */}
        <div className="product-card-item flex-shrink-0 w-[300px] md:w-[350px] lg:w-[400px]">
          <Link
            href="/shop?sort=newest"
            className="block h-full min-h-[500px] rounded-2xl bg-surface-card border border-white/10 hover:border-gold/30 transition-colors group"
          >
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
                <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <h3 className="text-white font-display text-2xl mb-3">Discover All</h3>
              <p className="text-text-secondary text-sm">
                Explore our complete collection of new arrivals
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NewArrivalsSection;
