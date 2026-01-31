'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatPrice, getDiscountPercentage } from '@/lib/utils';
import { ShoppingBag, Clock, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  salePrice: number;
  imageUrl: string;
  endDate?: string;
}

interface ImperdibiliSectionProps {
  products?: FeaturedProduct[];
}

export function ImperdibiliSection({ products }: ImperdibiliSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();

  // Mock data if no products provided
  const displayProducts: FeaturedProduct[] = products || [
    {
      id: 'deal-1',
      name: 'Napoleonic General - Limited Edition',
      slug: 'napoleonic-general-limited',
      description: 'Limited edition Napoleonic General figure with scenic base included. Historically accurate details and premium painting.',
      price: 189.00,
      salePrice: 149.00,
      imageUrl: '/images/banners/hero-main.jpg',
    },
    {
      id: 'deal-2',
      name: 'Premium Product Set',
      slug: 'premium-product-set',
      description: 'Complete set of 24 premium items. High quality materials and excellent craftsmanship for professional results.',
      price: 129.00,
      salePrice: 99.00,
      imageUrl: '/images/featured-2.jpg',
    },
  ];

  // GSAP Animations
  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        titleRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Product cards animation
      gsap.fromTo(
        '.deal-card',
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.2,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Parallax on images
      gsap.utils.toArray('.deal-image').forEach((img: any) => {
        gsap.to(img, {
          yPercent: -10,
          ease: 'none',
          scrollTrigger: {
            trigger: img,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleAddToCart = async (product: FeaturedProduct) => {
    try {
      await addItem(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-surface-raised overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-1/2 h-1/2 opacity-10"
          style={{
            background: 'radial-gradient(circle at top right, rgba(201, 162, 39, 0.3), transparent 50%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-1/2 h-1/2 opacity-10"
          style={{
            background: 'radial-gradient(circle at bottom left, rgba(201, 162, 39, 0.2), transparent 50%)',
          }}
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative">
        {/* Section Header */}
        <div ref={titleRef} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-full mb-6">
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm font-medium uppercase tracking-wider">
              Limited Offers
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-4">
            Don&apos;t Miss Out
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Discover exclusive offers selected just for you
          </p>
        </div>

        {/* Deals Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {displayProducts.map((product) => {
            const discount = getDiscountPercentage(product.price, product.salePrice);

            return (
              <div
                key={product.id}
                className="deal-card group relative bg-surface-card rounded-3xl overflow-hidden"
              >
                <div className="grid lg:grid-cols-2 gap-0">
                  {/* Image Section */}
                  <div className="relative aspect-square lg:aspect-auto overflow-hidden">
                    <div className="deal-image absolute inset-0 scale-110">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent lg:bg-gradient-to-r" />

                    {/* Discount Badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <div className="px-4 py-2 bg-red-500 text-white font-bold rounded-full text-sm">
                        -{discount}%
                      </div>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="relative p-6 lg:p-8 flex flex-col justify-center">
                    <Link href={`/product/${product.slug}`}>
                      <h3 className="font-display text-2xl lg:text-3xl font-semibold text-white mb-4 group-hover:text-gold transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    {product.description && (
                      <p className="text-text-secondary text-sm mb-6 line-clamp-3">
                        {product.description}
                      </p>
                    )}

                    {/* Pricing */}
                    <div className="flex items-baseline gap-4 mb-6">
                      <span className="text-gold font-display text-3xl lg:text-4xl font-semibold">
                        {formatPrice(product.salePrice)}
                      </span>
                      <span className="text-text-muted line-through text-lg">
                        {formatPrice(product.price)}
                      </span>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gold text-primary font-medium rounded-xl hover:bg-gold-400 transition-colors"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        <span>Add to Cart</span>
                      </button>
                      <Link
                        href={`/product/${product.slug}`}
                        className="flex items-center justify-center gap-2 px-6 py-4 border border-white/20 text-white rounded-xl hover:bg-white/5 hover:border-white/40 transition-colors"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Hover glow effect */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(201, 162, 39, 0.05), transparent 50%)',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* View All Link */}
        <div className="text-center mt-12">
          <Link
            href="/shop?sale=true"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-gold transition-colors group"
          >
            <span className="text-sm uppercase tracking-wider">All Deals</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ImperdibiliSection;
