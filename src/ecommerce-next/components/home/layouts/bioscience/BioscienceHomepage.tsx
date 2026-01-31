'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Palette, Ruler, Award, Sparkles, Clock, Shield } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GsapCleanupWrapper } from '@/hooks/useGsapCleanup';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Minimal Hero - Compact, not full-screen
function BioscienceHero() {
  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: 'power3.out',
      });
      gsap.from(subtitleRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out',
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="pt-32 pb-24 px-4 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1
          ref={titleRef}
          className="font-heading text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Precision Craftsmanship
        </h1>
        <p
          ref={subtitleRef}
          className="text-lg md:text-xl font-light max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          We create miniatures with scientific precision and artistic soul.
          Every piece tells a story of dedication and excellence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-medium transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverted)',
            }}
          >
            Explore Collection
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-medium transition-all duration-300 border"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          >
            Our Story
          </Link>
        </div>
      </div>
    </section>
  );
}

// Numbered Section Component
function NumberedSection({
  number,
  title,
  description,
  children,
  reverse = false,
}: {
  number: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  reverse?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(sectionRef.current, {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-4 lg:px-8">
      <div className={`max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center ${reverse ? 'lg:grid-flow-dense' : ''}`}>
        <div className={reverse ? 'lg:col-start-2' : ''}>
          <div className="flex items-baseline gap-4 mb-6">
            <span
              className="text-6xl md:text-7xl font-light opacity-20"
              style={{ color: 'var(--color-accent)' }}
            >
              {number}
            </span>
            <h2
              className="text-2xl md:text-3xl font-heading font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
          </div>
          <p
            className="text-base md:text-lg leading-relaxed mb-8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {description}
          </p>
          {children}
        </div>
        <div
          className={`aspect-[4/3] rounded-2xl ${reverse ? 'lg:col-start-1' : ''}`}
          style={{ backgroundColor: 'var(--color-bg-surface)' }}
        >
          <Image
            src="/images/placeholder.svg"
            alt={title}
            width={600}
            height={450}
            className="w-full h-full object-cover rounded-2xl opacity-80"
          />
        </div>
      </div>
    </section>
  );
}

// Feature Grid - 3 columns with icons
function FeatureGrid({
  title,
  features,
}: {
  title?: string;
  features: Array<{ icon: React.ReactNode; title: string; description: string }>;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feature-card', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={gridRef} className="py-20 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {title && (
          <h3
            className="text-xl md:text-2xl font-heading font-medium text-center mb-12"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {title}
          </h3>
        )}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card p-8 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--color-bg-surface)' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{
                  backgroundColor: 'var(--color-bg-hover)',
                  color: 'var(--color-accent)',
                }}
              >
                {feature.icon}
              </div>
              <h4
                className="text-lg font-medium mb-3"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {feature.title}
              </h4>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Minimal Products Grid - Uses real products from API
function ProductsGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { products, loading } = useFeaturedProducts(6);

  useEffect(() => {
    if (loading || products.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from('.product-item', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, [loading, products.length]);

  const getCategoryName = (product: Product) => {
    if (product.category?.name) return product.category.name;
    if (product.categories?.[0]?.name) return product.categories[0].name;
    return 'Miniatures';
  };

  return (
    <section className="py-20 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="max-w-6xl mx-auto" ref={gridRef}>
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-heading font-medium mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Featured Collection
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Discover our most popular pieces
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl mb-4" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
                <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
                <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
                <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="product-item group"
              >
                <div
                  className="aspect-square rounded-xl mb-4 overflow-hidden relative"
                  style={{ backgroundColor: 'var(--color-bg-hover)' }}
                >
                  <Image
                    src={product.imageUrl || product.mainImageUrl || '/images/placeholder-product.svg'}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  {product.onSale && (
                    <span
                      className="absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-inverted)' }}
                    >
                      Sale
                    </span>
                  )}
                </div>
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {getCategoryName(product)}
                </p>
                <h3
                  className="font-medium mb-1 line-clamp-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  {product.onSale && product.salePrice ? (
                    <>
                      <span style={{ color: 'var(--color-accent)' }}>{formatPrice(product.salePrice)}</span>
                      <span className="text-sm line-through" style={{ color: 'var(--color-text-muted)' }}>
                        {formatPrice(product.price)}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-accent)' }}>{formatPrice(product.price)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-medium transition-all duration-300 border"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          >
            View All Products
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Minimal Newsletter
function MinimalNewsletter() {
  return (
    <section className="py-24 px-4 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2
          className="text-2xl md:text-3xl font-heading font-medium mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Stay Updated
        </h2>
        <p
          className="mb-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Subscribe to receive updates on new releases and exclusive offers.
        </p>
        <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 px-6 py-4 rounded-full border outline-none transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="submit"
            className="px-8 py-4 rounded-full font-medium transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverted)',
            }}
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}

// Main Bioscience Homepage
export function BioscienceHomepage() {
  return (
    <GsapCleanupWrapper>
      <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <BioscienceHero />

        <NumberedSection
          number="01"
          title="Our Philosophy"
          description="Every miniature we create is a testament to the art of precision. We blend traditional craftsmanship with modern techniques to produce pieces that collectors treasure for generations. Our commitment to excellence drives every detail, from concept to final finish."
        >
          <Link
            href="/about"
            className="inline-flex items-center gap-2 font-medium transition-colors"
            style={{ color: 'var(--color-accent)' }}
          >
            Learn about our process
            <ArrowRight className="w-4 h-4" />
          </Link>
        </NumberedSection>

        <FeatureGrid
          title="The Process"
          features={[
            {
              icon: <Palette className="w-6 h-6" />,
              title: 'Master Sculpting',
              description: 'Each piece begins with hand-sculpted masters by world-renowned artists.',
            },
            {
              icon: <Ruler className="w-6 h-6" />,
              title: 'Precision Casting',
              description: 'We use advanced resin and metal casting for exceptional detail capture.',
            },
            {
              icon: <Award className="w-6 h-6" />,
              title: 'Quality Control',
              description: 'Every piece undergoes rigorous inspection before leaving our workshop.',
            },
          ]}
        />

        <NumberedSection
          number="02"
          title="Materials & Quality"
          description="We source only the finest materials from trusted suppliers. Our resins are specially formulated for optimal detail retention, while our metal alloys ensure durability and weight that collectors expect. Each material is selected for its specific application."
          reverse
        />

        <FeatureGrid
          features={[
            {
              icon: <Sparkles className="w-6 h-6" />,
              title: 'Premium Resins',
              description: 'Low-shrinkage formulas that capture every microscopic detail.',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title: 'White Metal Alloys',
              description: 'Lead-free alloys with optimal casting properties.',
            },
            {
              icon: <Clock className="w-6 h-6" />,
              title: 'Curing Process',
              description: 'Controlled curing for maximum strength and stability.',
            },
          ]}
        />

        <NumberedSection
          number="03"
          title="For Collectors"
          description="Whether you&apos;re a beginner exploring the hobby or a seasoned collector seeking museum-quality pieces, our range caters to all levels. We provide comprehensive resources and support to help you get the most from your collection."
        />

        <ProductsGrid />

        <MinimalNewsletter />
      </div>
    </GsapCleanupWrapper>
  );
}
