'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowRight, Play } from 'lucide-react';
import { GsapCleanupWrapper } from '@/hooks/useGsapCleanup';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Animated Loader Component
function HeritageLoader({ onComplete }: { onComplete: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(loaderRef.current, {
            opacity: 0,
            duration: 0.5,
            onComplete,
          });
        },
      });

      // Animate progress bar
      tl.to(progressRef.current, {
        scaleX: 1,
        duration: 2,
        ease: 'power2.inOut',
      });

      // Scale down logo
      tl.to(
        logoRef.current,
        {
          scale: 0.8,
          duration: 0.5,
          ease: 'power2.in',
        },
        '-=0.5'
      );

      // Expand and fade
      tl.to(logoRef.current, {
        scale: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.in',
      });
    }, loaderRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={loaderRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div
        ref={logoRef}
        className="text-4xl md:text-6xl font-heading font-bold mb-12"
        style={{ color: 'var(--color-accent)' }}
      >
        HERITAGE
      </div>
      <div className="w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
        <div
          ref={progressRef}
          className="h-full origin-left"
          style={{
            backgroundColor: 'var(--color-accent)',
            transform: 'scaleX(0)',
          }}
        />
      </div>
    </div>
  );
}

// Video Hero with Full Viewport
function VideoHero() {
  const heroRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Content reveal
      gsap.from(contentRef.current?.children || [], {
        opacity: 0,
        y: 50,
        duration: 1.2,
        stagger: 0.2,
        delay: 0.5,
        ease: 'power3.out',
      });

      // Scroll indicator
      gsap.from(scrollIndicatorRef.current, {
        opacity: 0,
        y: -20,
        duration: 0.8,
        delay: 2,
        ease: 'power2.out',
      });

      // Floating animation for scroll indicator
      gsap.to(scrollIndicatorRef.current, {
        y: 10,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });

      // Parallax content on scroll
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden"
    >
      {/* Video Background Placeholder */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-surface) 50%, var(--color-bg-primary) 100%)`,
          }}
        />
        {/* Video overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div ref={contentRef} className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <p
          className="text-sm md:text-base uppercase tracking-[0.4em] mb-6"
          style={{ color: 'var(--color-accent)' }}
        >
          Since 1990
        </p>
        <h1
          className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Artisan
          <br />
          <span style={{ color: 'var(--color-accent)' }}>Tradition</span>
        </h1>
        <p
          className="text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Three decades of passion, dedication, and craftsmanship.
          Each piece carries the soul of Italian artistry.
        </p>
        <Link
          href="/about"
          className="inline-flex items-center gap-3 px-10 py-5 rounded-full font-medium transition-all duration-500 group"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-inverted)',
          }}
        >
          <Play className="w-5 h-5" />
          Watch Our Story
        </Link>
      </div>

      {/* Scroll Indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="text-xs uppercase tracking-[0.3em]">Discover</span>
        <ArrowDown className="w-5 h-5" />
      </div>
    </section>
  );
}

// Asymmetric Product Grid - Uses real products from API
function AsymmetricGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { products, loading } = useFeaturedProducts(5);

  useEffect(() => {
    if (loading || products.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from('.asymmetric-item', {
        opacity: 0,
        y: 60,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 70%',
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

  const getProductImage = (product: Product) => {
    return product.imageUrl || product.mainImageUrl || '/images/placeholder-product.svg';
  };

  // Ensure we have at least 5 products, fill with first product if needed
  const displayProducts = products.length >= 5
    ? products.slice(0, 5)
    : [...products, ...Array(5 - products.length).fill(products[0])].filter(Boolean);

  return (
    <section className="py-24 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-7xl mx-auto" ref={gridRef}>
        <div className="text-center mb-16">
          <p
            className="text-sm uppercase tracking-[0.3em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            Featured Works
          </p>
          <h2
            className="text-3xl md:text-5xl font-heading font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Masterpieces
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-12 gap-4 md:gap-6">
            <div className="col-span-12 md:col-span-7 row-span-2 animate-pulse">
              <div className="aspect-[4/5] md:aspect-[3/4] rounded-2xl" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`col-span-6 ${i >= 2 ? 'md:col-span-6' : 'md:col-span-5'} animate-pulse`}>
                <div className={`${i >= 2 ? 'aspect-[16/9]' : 'aspect-square'} rounded-2xl`} style={{ backgroundColor: 'var(--color-bg-surface)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 md:gap-6">
            {/* Large item - spans 7 columns */}
            {displayProducts[0] && (
              <div className="asymmetric-item col-span-12 md:col-span-7 row-span-2">
                <Link href={`/product/${displayProducts[0].slug}`} className="block group relative overflow-hidden rounded-2xl">
                  <div
                    className="aspect-[4/5] md:aspect-[3/4]"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(displayProducts[0])}
                      alt={displayProducts[0].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 58vw"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/60 text-sm mb-1">{getCategoryName(displayProducts[0])}</p>
                    <h3 className="text-white text-2xl font-heading font-bold">{displayProducts[0].name}</h3>
                    <p className="text-white mt-2">{formatPrice(displayProducts[0].salePrice || displayProducts[0].price)}</p>
                  </div>
                </Link>
              </div>
            )}

            {/* Small items - span 5 columns */}
            {displayProducts[1] && (
              <div className="asymmetric-item col-span-6 md:col-span-5">
                <Link href={`/product/${displayProducts[1].slug}`} className="block group relative overflow-hidden rounded-2xl">
                  <div
                    className="aspect-square"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(displayProducts[1])}
                      alt={displayProducts[1].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 42vw"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/60 text-xs mb-1">{getCategoryName(displayProducts[1])}</p>
                    <h3 className="text-white text-lg font-heading font-bold">{displayProducts[1].name}</h3>
                  </div>
                </Link>
              </div>
            )}

            {displayProducts[2] && (
              <div className="asymmetric-item col-span-6 md:col-span-5">
                <Link href={`/product/${displayProducts[2].slug}`} className="block group relative overflow-hidden rounded-2xl">
                  <div
                    className="aspect-square"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(displayProducts[2])}
                      alt={displayProducts[2].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 42vw"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/60 text-xs mb-1">{getCategoryName(displayProducts[2])}</p>
                    <h3 className="text-white text-lg font-heading font-bold">{displayProducts[2].name}</h3>
                  </div>
                </Link>
              </div>
            )}

            {/* Medium items */}
            {displayProducts[3] && (
              <div className="asymmetric-item col-span-12 md:col-span-6">
                <Link href={`/product/${displayProducts[3].slug}`} className="block group relative overflow-hidden rounded-2xl">
                  <div
                    className="aspect-[16/9]"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(displayProducts[3])}
                      alt={displayProducts[3].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/60 text-sm mb-1">{getCategoryName(displayProducts[3])}</p>
                    <h3 className="text-white text-xl font-heading font-bold">{displayProducts[3].name}</h3>
                  </div>
                </Link>
              </div>
            )}

            {displayProducts[4] && (
              <div className="asymmetric-item col-span-12 md:col-span-6">
                <Link href={`/product/${displayProducts[4].slug}`} className="block group relative overflow-hidden rounded-2xl">
                  <div
                    className="aspect-[16/9]"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(displayProducts[4])}
                      alt={displayProducts[4].name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/60 text-sm mb-1">{getCategoryName(displayProducts[4])}</p>
                    <h3 className="text-white text-xl font-heading font-bold">{displayProducts[4].name}</h3>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-lg font-medium transition-all duration-300 group"
            style={{ color: 'var(--color-accent)' }}
          >
            Explore All Works
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Scroll-Linked Brand Story Section
function BrandStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax image
      gsap.to(imageRef.current, {
        y: -100,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5,
        },
      });

      // Text reveal
      gsap.from(textRef.current?.children || [], {
        opacity: 0,
        y: 40,
        duration: 1,
        stagger: 0.2,
        scrollTrigger: {
          trigger: textRef.current,
          start: 'top 80%',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 px-4 lg:px-8 overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div ref={textRef} className="order-2 lg:order-1">
          <p
            className="text-sm uppercase tracking-[0.3em] mb-6"
            style={{ color: 'var(--color-accent)' }}
          >
            Our Heritage
          </p>
          <h2
            className="text-3xl md:text-5xl font-heading font-bold mb-8 leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Born from
            <br />
            Italian Passion
          </h2>
          <p
            className="text-lg leading-relaxed mb-8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            In the heart of Italy, where art has been perfected over centuries,
            we continue a tradition that spans generations. Every miniature is a
            tribute to the master sculptors who came before us.
          </p>
          <p
            className="text-lg leading-relaxed mb-10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Our workshop combines time-honored techniques with modern precision,
            creating pieces that honor history while pushing the boundaries of
            what&apos;s possible in miniature art.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-3 font-medium transition-all duration-300 group"
            style={{ color: 'var(--color-accent)' }}
          >
            Discover Our Story
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
          </Link>
        </div>

        <div ref={imageRef} className="order-1 lg:order-2">
          <div
            className="aspect-[4/5] rounded-3xl overflow-hidden"
            style={{ backgroundColor: 'var(--color-bg-hover)' }}
          >
            <Image
              src="/images/placeholder.svg"
              alt="Our Workshop"
              width={600}
              height={750}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Heritage Newsletter
function HeritageNewsletter() {
  return (
    <section className="py-32 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-4xl mx-auto text-center">
        <p
          className="text-sm uppercase tracking-[0.3em] mb-6"
          style={{ color: 'var(--color-accent)' }}
        >
          Stay Connected
        </p>
        <h2
          className="text-3xl md:text-5xl font-heading font-bold mb-8"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Join Our Circle
        </h2>
        <p
          className="text-lg mb-10 max-w-xl mx-auto"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Be the first to know about new releases, exclusive offers,
          and stories from our workshop.
        </p>
        <form className="flex flex-col md:flex-row gap-4 max-w-lg mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-8 py-5 rounded-full border-2 outline-none transition-all duration-300 text-center md:text-left"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="submit"
            className="px-10 py-5 rounded-full font-medium transition-all duration-500"
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

// Main Heritage Homepage
export function HeritageHomepage() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <GsapCleanupWrapper>
      {isLoading && <HeritageLoader onComplete={() => setIsLoading(false)} />}

      <div
        className={`transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <VideoHero />
        <AsymmetricGrid />
        <BrandStory />
        <HeritageNewsletter />
      </div>
    </GsapCleanupWrapper>
  );
}
