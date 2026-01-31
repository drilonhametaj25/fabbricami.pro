'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { GsapCleanupWrapper } from '@/hooks/useGsapCleanup';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Announcement Bar with Countdown
function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 30,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { hours, minutes, seconds } = prev;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }

        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="py-3 px-4 text-center relative"
      style={{ backgroundColor: 'var(--color-accent)' }}
    >
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-inverted)' }}>
          Flash Sale: 20% Off All Miniatures
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: 'var(--color-text-inverted)' }} />
          <div className="flex items-center gap-1 font-mono text-sm" style={{ color: 'var(--color-text-inverted)' }}>
            <span className="bg-black/20 px-2 py-0.5 rounded">
              {String(timeLeft.hours).padStart(2, '0')}
            </span>
            :
            <span className="bg-black/20 px-2 py-0.5 rounded">
              {String(timeLeft.minutes).padStart(2, '0')}
            </span>
            :
            <span className="bg-black/20 px-2 py-0.5 rounded">
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        <Link
          href="/shop?sale=true"
          className="text-sm font-medium underline underline-offset-4"
          style={{ color: 'var(--color-text-inverted)' }}
        >
          Shop Now
        </Link>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--color-text-inverted)' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Video Hero
function NordicHero() {
  const heroRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(contentRef.current?.children || [], {
        opacity: 0,
        y: 40,
        duration: 1,
        stagger: 0.2,
        delay: 0.3,
        ease: 'power3.out',
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative h-[80vh] min-h-[600px] flex items-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      {/* Background Image/Video Placeholder */}
      <div className="absolute inset-0">
        <Image
          src="/images/placeholder.svg"
          alt="Nordic Hero"
          fill
          className="object-cover opacity-60"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, var(--color-bg-primary) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div ref={contentRef} className="max-w-xl">
          <p
            className="text-sm uppercase tracking-[0.2em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            New Season Collection
          </p>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-light mb-6 leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Pure Form.
            <br />
            Perfect Detail.
          </h1>
          <p
            className="text-lg mb-8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Discover our latest collection of handcrafted miniatures,
            where Scandinavian simplicity meets Italian artistry.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-4 font-medium transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-text-primary)',
              color: 'var(--color-bg-primary)',
            }}
          >
            Explore Collection
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Swiper-style Carousel - Uses real products from API
function SwiperCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { products, loading } = useFeaturedProducts(6);

  const slidesPerView = 3;
  const maxSlide = Math.max(0, products.length - slidesPerView);

  const nextSlide = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, maxSlide));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  const getCategoryName = (product: Product) => {
    if (product.category?.name) return product.category.name;
    if (product.categories?.[0]?.name) return product.categories[0].name;
    return 'Miniatures';
  };

  const getProductImage = (product: Product) => {
    return product.imageUrl || product.mainImageUrl || '/images/placeholder-product.svg';
  };

  useEffect(() => {
    if (loading || products.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from('.swiper-product', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        stagger: 0.1,
        scrollTrigger: {
          trigger: carouselRef.current,
          start: 'top 80%',
        },
      });
    }, carouselRef);

    return () => ctx.revert();
  }, [loading, products.length]);

  return (
    <section className="py-20 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-7xl mx-auto" ref={carouselRef}>
        {/* Header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <p
              className="text-sm uppercase tracking-[0.2em] mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Featured
            </p>
            <h2
              className="text-2xl md:text-3xl font-heading"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Best Sellers
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0 || loading}
              className="w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 disabled:opacity-30"
              style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide === maxSlide || loading}
              className="w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 disabled:opacity-30"
              style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        {loading ? (
          <div className="flex gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-full md:w-[calc(33.333%-16px)] animate-pulse">
                <div className="aspect-[3/4] mb-4" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden">
            <div
              className="flex gap-6 transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentSlide * (100 / slidesPerView + 2)}%)` }}
            >
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  className="swiper-product flex-shrink-0 w-full md:w-[calc(33.333%-16px)] group"
                >
                  <div
                    className="aspect-[3/4] mb-4 overflow-hidden relative"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                  >
                    <Image
                      src={getProductImage(product)}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
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
                    className="text-base font-medium mb-1 line-clamp-1"
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
                      <span style={{ color: 'var(--color-text-secondary)' }}>{formatPrice(product.price)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Pagination Dots */}
        {!loading && products.length > slidesPerView && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: maxSlide + 1 }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'w-8' : ''
                }`}
                style={{
                  backgroundColor: index === currentSlide
                    ? 'var(--color-accent)'
                    : 'var(--color-border-default)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Image + Text Block (Alternating)
function ImageTextBlock({
  title,
  subtitle,
  description,
  buttonText,
  buttonLink,
  imagePosition = 'left',
}: {
  title: string;
  subtitle?: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  imagePosition?: 'left' | 'right';
}) {
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(blockRef.current?.children || [], {
        opacity: 0,
        y: 40,
        duration: 0.8,
        stagger: 0.2,
        scrollTrigger: {
          trigger: blockRef.current,
          start: 'top 80%',
        },
      });
    }, blockRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={blockRef}
      className={`grid lg:grid-cols-2 gap-8 lg:gap-0 items-center ${
        imagePosition === 'right' ? 'lg:grid-flow-dense' : ''
      }`}
    >
      {/* Image */}
      <div className={imagePosition === 'right' ? 'lg:col-start-2' : ''}>
        <div
          className="aspect-[4/3] lg:aspect-square"
          style={{ backgroundColor: 'var(--color-bg-surface)' }}
        >
          <Image
            src="/images/placeholder.svg"
            alt={title}
            width={800}
            height={800}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Text Content */}
      <div className={`px-4 lg:px-16 py-12 ${imagePosition === 'right' ? 'lg:col-start-1' : ''}`}>
        {subtitle && (
          <p
            className="text-sm uppercase tracking-[0.2em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            {subtitle}
          </p>
        )}
        <h2
          className="text-2xl md:text-3xl font-heading mb-6"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        <p
          className="text-base leading-relaxed mb-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {description}
        </p>
        <Link
          href={buttonLink}
          className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider group"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {buttonText}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
        </Link>
      </div>
    </div>
  );
}

// Collection Grid - Uses real categories from API
function CollectionGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { categories, loading } = useCategories(true);

  // Get top-level categories (limit to 4)
  const displayCategories = categories
    .filter(cat => !cat.parentId)
    .slice(0, 4);

  const getCategoryImage = (category: { imageUrl?: string | null; image?: string }) => {
    return category.imageUrl || category.image || '/images/placeholder.svg';
  };

  useEffect(() => {
    if (loading || displayCategories.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from('.collection-item', {
        opacity: 0,
        scale: 0.95,
        duration: 0.6,
        stagger: 0.1,
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, [loading, displayCategories.length]);

  return (
    <section className="py-20 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="max-w-7xl mx-auto" ref={gridRef}>
        <div className="text-center mb-12">
          <p
            className="text-sm uppercase tracking-[0.2em] mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Browse By
          </p>
          <h2
            className="text-2xl md:text-3xl font-heading"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Collections
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {displayCategories.map((category) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className="collection-item group relative overflow-hidden"
              >
                <div
                  className="aspect-[3/4] relative"
                  style={{ backgroundColor: 'var(--color-bg-hover)' }}
                >
                  <Image
                    src={getCategoryImage(category)}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-white text-lg font-medium mb-1">
                    {category.name}
                  </h3>
                  {category.productCount !== undefined && (
                    <p className="text-white/60 text-sm">{category.productCount} products</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Nordic Newsletter
function NordicNewsletter() {
  return (
    <section className="py-24 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p
              className="text-sm uppercase tracking-[0.2em] mb-4"
              style={{ color: 'var(--color-accent)' }}
            >
              Newsletter
            </p>
            <h2
              className="text-2xl md:text-3xl font-heading mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Stay in the Loop
            </h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Subscribe to receive updates on new arrivals, special offers,
              and exclusive content from our workshop.
            </p>
          </div>
          <form className="flex flex-col sm:flex-row gap-4">
            <input
              type="email"
              placeholder="Your email"
              className="flex-1 px-6 py-4 border outline-none"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              type="submit"
              className="px-8 py-4 font-medium transition-all duration-300"
              style={{
                backgroundColor: 'var(--color-text-primary)',
                color: 'var(--color-bg-primary)',
              }}
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Main Nordic Homepage
export function NordicHomepage() {
  return (
    <GsapCleanupWrapper>
      <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <AnnouncementBar />
        <NordicHero />
        <SwiperCarousel />

        <ImageTextBlock
          subtitle="Our Craft"
          title="Handmade Excellence"
          description="Every miniature begins as a vision and transforms into reality through the skilled hands of our artisans. We combine traditional techniques with modern precision to create pieces that stand the test of time."
          buttonText="Learn More"
          buttonLink="/about"
          imagePosition="left"
        />

        <ImageTextBlock
          subtitle="Materials"
          title="Premium Quality"
          description="We source only the finest materials from trusted suppliers. Our white metal alloys and premium resins ensure exceptional detail capture and durability that collectors expect."
          buttonText="View Process"
          buttonLink="/about"
          imagePosition="right"
        />

        <CollectionGrid />
        <NordicNewsletter />
      </div>
    </GsapCleanupWrapper>
  );
}
