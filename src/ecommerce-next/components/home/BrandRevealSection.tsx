'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, Heart, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';

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
  imageUrl: string;
}

interface BrandRevealSectionProps {
  brandName: string;
  brandSubtitle?: string;
  category: string;
  products?: Product[];
  accentColor?: string;
}

export function BrandRevealSection({
  brandName,
  brandSubtitle,
  category,
  products,
  accentColor: _accentColor = 'gold',
}: BrandRevealSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const brandTitleRef = useRef<HTMLDivElement>(null);
  const productsGridRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();

  // Mock products if none provided
  const displayProducts: Product[] = products || [
    { id: `${category}-1`, name: 'Product One', slug: 'product-one', price: 89.99, imageUrl: '/images/placeholder-product.svg' },
    { id: `${category}-2`, name: 'Product Two', slug: 'product-two', price: 79.99, imageUrl: '/images/placeholder-product.svg' },
    { id: `${category}-3`, name: 'Product Three', slug: 'product-three', price: 95.00, imageUrl: '/images/placeholder-product.svg' },
    { id: `${category}-4`, name: 'Product Four', slug: 'product-four', price: 110.00, imageUrl: '/images/placeholder-product.svg' },
  ];

  useEffect(() => {
    if (!sectionRef.current || !brandTitleRef.current || !productsGridRef.current) return;

    const ctx = gsap.context(() => {
      const section = sectionRef.current!;
      const title = brandTitleRef.current!;
      const grid = productsGridRef.current!;

      // Create pinned timeline - starts when section is 30% from top
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 30%',
          end: '+=120%',
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // Title appears and scales down
      tl.fromTo(
        title,
        {
          scale: 2,
          opacity: 0,
        },
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
        }
      );

      // Hold title visible
      tl.to(title, { duration: 0.2 });

      // Title fades out and moves up
      tl.to(title, {
        opacity: 0,
        y: -100,
        scale: 0.8,
        duration: 0.3,
        ease: 'power2.in',
      });

      // Products grid appears
      tl.fromTo(
        grid,
        {
          opacity: 0,
          y: 100,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power3.out',
        },
        '-=0.1'
      );

      // Stagger product cards
      tl.fromTo(
        '.brand-product-card',
        {
          opacity: 0,
          y: 50,
          scale: 0.95,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.05,
          duration: 0.3,
          ease: 'power2.out',
        },
        '-=0.3'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleAddToCart = async (product: Product) => {
    try {
      await addItem(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen bg-primary overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(201, 162, 39, 0.1) 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Brand Title - Large centered */}
      <div
        ref={brandTitleRef}
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
      >
        {brandSubtitle && (
          <p className="text-gold/60 text-sm md:text-base uppercase tracking-[0.3em] mb-4">
            {brandSubtitle}
          </p>
        )}
        <h2
          className="font-display text-[15vw] md:text-[12vw] lg:text-[10vw] font-bold text-white leading-none tracking-tight text-center"
          style={{
            textShadow: '0 0 80px rgba(201, 162, 39, 0.3)',
          }}
        >
          {brandName}
        </h2>
      </div>

      {/* Products Grid - Appears after title dissolves */}
      <div
        ref={productsGridRef}
        className="relative min-h-screen flex flex-col justify-center px-4 lg:px-8 py-24"
        style={{ opacity: 0 }}
      >
        {/* Section header */}
        <div className="text-center mb-12">
          <h3 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4">
            {brandName}
          </h3>
          <p className="text-text-secondary">Discover Our Selection</p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-7xl mx-auto w-full">
          {displayProducts.map((product) => (
            <div
              key={product.id}
              className="brand-product-card group"
            >
              <div className="relative overflow-hidden rounded-2xl bg-surface-card">
                {/* Image */}
                <Link
                  href={`/product/${product.slug}`}
                  className="block relative aspect-[3/4] overflow-hidden"
                >
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Quick actions */}
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddToCart(product);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gold text-primary text-sm font-medium rounded-lg hover:bg-gold-400 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => e.preventDefault()}
                      className="p-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>
                </Link>

                {/* Info */}
                <div className="p-4">
                  <Link href={`/product/${product.slug}`}>
                    <h4 className="text-white font-medium text-sm mb-2 group-hover:text-gold transition-colors line-clamp-1">
                      {product.name}
                    </h4>
                  </Link>
                  <div className="flex items-center gap-2">
                    {product.salePrice ? (
                      <>
                        <span className="text-gold font-semibold">
                          {formatPrice(product.salePrice)}
                        </span>
                        <span className="text-text-muted line-through text-xs">
                          {formatPrice(product.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-white font-semibold">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View all link */}
        <div className="text-center mt-12">
          <Link
            href={`/shop?category=${category}`}
            className="inline-flex items-center gap-3 group"
          >
            <span className="px-8 py-4 border border-white/20 text-white font-medium rounded-full transition-all duration-300 group-hover:border-gold group-hover:bg-gold/5">
              View All Products
            </span>
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-gold text-primary transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(201,162,39,0.4)]">
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default BrandRevealSection;
