'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowRight, Star, ChevronLeft, ChevronRight, Package, Brush, Award, Shield, Truck, Clock } from 'lucide-react';
import { GsapCleanupWrapper } from '@/hooks/useGsapCleanup';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Rotating Hero with Product Showcase - Uses real featured product from API
function RotatingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const productRef = useRef<HTMLDivElement>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const { products, loading } = useFeaturedProducts(1);

  // Get the featured product
  const featuredProduct = products[0];

  // Get product images - use product's images array if available, otherwise use main image
  const getProductImages = (product: Product | undefined) => {
    if (!product) return ['/images/placeholder-product.svg'];

    // If product has multiple images, use them
    if (product.images && product.images.length > 0) {
      return product.images.slice(0, 3).map(img =>
        typeof img === 'string' ? img : img.url || '/images/placeholder-product.svg'
      );
    }

    // Fallback to main image (show it 3 times for the rotation effect)
    const mainImage = product.imageUrl || product.mainImageUrl || '/images/placeholder-product.svg';
    return [mainImage, mainImage, mainImage];
  };

  const productImages = getProductImages(featuredProduct);

  useEffect(() => {
    // Auto-rotate product images
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % productImages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [productImages.length]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance animation
      gsap.from(productRef.current, {
        scale: 0.8,
        opacity: 0,
        duration: 1.5,
        ease: 'power3.out',
      });

      // Floating animation
      gsap.to(productRef.current, {
        y: -20,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-accent) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-accent) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Radial Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, var(--color-accent) 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <p
              className="text-sm uppercase tracking-[0.3em] mb-4"
              style={{ color: 'var(--color-accent)' }}
            >
              {featuredProduct?.onSale ? 'Special Offer' : 'New Arrival'}
            </p>
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 leading-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {featuredProduct ? (
                <>
                  {featuredProduct.name.split(' ').slice(0, 2).join(' ')}
                  <br />
                  <span style={{ color: 'var(--color-accent)' }}>
                    {featuredProduct.name.split(' ').slice(2).join(' ') || 'Masterpiece'}
                  </span>
                </>
              ) : (
                <>
                  The Ultimate
                  <br />
                  <span style={{ color: 'var(--color-accent)' }}>Collector&apos;s Piece</span>
                </>
              )}
            </h1>
            <p
              className="text-lg md:text-xl mb-8 max-w-lg mx-auto lg:mx-0"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {featuredProduct?.description?.slice(0, 150) ||
                'Precision-engineered miniatures that push the boundaries of detail and craftsmanship.'}
              {featuredProduct?.description && featuredProduct.description.length > 150 ? '...' : ''}
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4">
              <Link
                href={featuredProduct ? `/product/${featuredProduct.slug}` : '/shop'}
                className="px-10 py-5 rounded-full font-medium transition-all duration-300 flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverted)',
                }}
              >
                {featuredProduct ? (
                  <>
                    View Product
                    <span className="ml-2">{formatPrice(featuredProduct.onSale && featuredProduct.salePrice ? featuredProduct.salePrice : featuredProduct.price)}</span>
                  </>
                ) : (
                  <>
                    Shop Now
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Link>
              <Link
                href="/shop"
                className="px-10 py-5 rounded-full font-medium transition-all duration-300 border flex items-center gap-2"
                style={{
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Browse Collection
              </Link>
            </div>
          </div>

          {/* Rotating Product */}
          <div className="order-1 lg:order-2 flex justify-center">
            {loading ? (
              <div className="relative w-[300px] h-[400px] md:w-[400px] md:h-[500px] animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
            ) : (
              <div
                ref={productRef}
                className="relative w-[300px] h-[400px] md:w-[400px] md:h-[500px]"
              >
                {productImages.map((img, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === currentImage ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={featuredProduct?.name || 'Product showcase'}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 300px, 400px"
                    />
                  </div>
                ))}

                {/* Sale badge */}
                {featuredProduct?.onSale && (
                  <span
                    className="absolute top-4 right-4 px-3 py-1 text-sm font-medium rounded-full"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-inverted)' }}
                  >
                    Sale
                  </span>
                )}

                {/* Rotation indicators */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
                  {productImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImage(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentImage ? 'w-6' : ''
                      }`}
                      style={{
                        backgroundColor: index === currentImage
                          ? 'var(--color-accent)'
                          : 'var(--color-border-default)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll to discover */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-bounce">
          <span
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Scroll to Discover
          </span>
          <ArrowDown className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
    </section>
  );
}

// Testimonial Section
function TestimonialSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      id: 1,
      name: 'Marco Rossi',
      title: 'Award-winning Painter',
      text: 'The level of detail in these miniatures is unmatched. Each piece is a canvas waiting for a masterpiece.',
      rating: 5,
    },
    {
      id: 2,
      name: 'Sarah Chen',
      title: 'Professional Collector',
      text: 'I have been collecting for 20 years. This store consistently delivers the highest quality pieces.',
      rating: 5,
    },
    {
      id: 3,
      name: 'David Miller',
      title: 'Competition Winner',
      text: 'My competition pieces always start here. The product quality gives me the perfect foundation.',
      rating: 5,
    },
  ];

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section
      ref={sectionRef}
      className="py-24 px-4 lg:px-8"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <p
          className="text-sm uppercase tracking-[0.3em] mb-4"
          style={{ color: 'var(--color-accent)' }}
        >
          Testimonials
        </p>
        <h2
          className="text-3xl md:text-4xl font-heading font-bold mb-12"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Trusted by Collectors
        </h2>

        <div className="relative">
          {/* Testimonial Content */}
          <div className="min-h-[250px] flex items-center justify-center">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={`absolute w-full transition-all duration-500 ${
                  index === currentTestimonial
                    ? 'opacity-100 translate-x-0'
                    : index < currentTestimonial
                    ? 'opacity-0 -translate-x-full'
                    : 'opacity-0 translate-x-full'
                }`}
              >
                {/* Stars */}
                <div className="flex justify-center gap-1 mb-6">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-current"
                      style={{ color: 'var(--color-accent)' }}
                    />
                  ))}
                </div>

                <p
                  className="text-xl md:text-2xl font-light italic mb-8 leading-relaxed"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  &ldquo;{testimonial.text}&rdquo;
                </p>

                <p
                  className="font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {testimonial.name}
                </p>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {testimonial.title}
                </p>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-6 mt-8">
            <button
              onClick={prevTestimonial}
              className="w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 hover:scale-110"
              style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentTestimonial ? 'w-6' : ''
                  }`}
                  style={{
                    backgroundColor: index === currentTestimonial
                      ? 'var(--color-accent)'
                      : 'var(--color-border-default)',
                  }}
                />
              ))}
            </div>

            <button
              onClick={nextTestimonial}
              className="w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 hover:scale-110"
              style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// Stacked Cards Carousel - Uses real products from API
function StackedCards() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const { products, loading } = useFeaturedProducts(4);

  useEffect(() => {
    if (loading || products.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from('.stacked-card', {
        opacity: 0,
        y: 60,
        duration: 0.8,
        stagger: 0.15,
        scrollTrigger: {
          trigger: carouselRef.current,
          start: 'top 70%',
        },
      });
    }, carouselRef);

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

  return (
    <section className="py-24 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto" ref={carouselRef}>
        <div className="text-center mb-12">
          <p
            className="text-sm uppercase tracking-[0.3em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            Featured Collection
          </p>
          <h2
            className="text-3xl md:text-4xl font-heading font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Explore Our Best
          </h2>
        </div>

        {loading ? (
          <div className="relative flex justify-center items-center h-[500px]">
            <div className="w-[280px] md:w-[350px] animate-pulse">
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <div className="aspect-[4/5]" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                <div className="p-6">
                  <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                  <div className="h-5 w-32 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                  <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Stacked Cards Layout */}
            <div className="relative flex justify-center items-center h-[500px]">
              {products.map((product, index) => {
                const offset = index - activeCard;
                const isActive = index === activeCard;

                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.slug}`}
                    onClick={(e) => {
                      if (!isActive) {
                        e.preventDefault();
                        setActiveCard(index);
                      }
                    }}
                    className={`stacked-card absolute w-[280px] md:w-[350px] cursor-pointer transition-all duration-500`}
                    style={{
                      transform: `
                        translateX(${offset * 100}px)
                        scale(${isActive ? 1 : 0.85})
                        rotateY(${offset * -5}deg)
                      `,
                      zIndex: products.length - Math.abs(offset),
                      opacity: Math.abs(offset) > 2 ? 0 : 1 - Math.abs(offset) * 0.3,
                    }}
                  >
                    <div
                      className="rounded-2xl overflow-hidden shadow-2xl"
                      style={{ backgroundColor: 'var(--color-bg-card)' }}
                    >
                      <div
                        className="aspect-[4/5] relative"
                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                      >
                        <Image
                          src={getProductImage(product)}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="350px"
                        />
                        {product.onSale && (
                          <span
                            className="absolute top-3 left-3 px-2 py-1 text-xs font-medium rounded"
                            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-inverted)' }}
                          >
                            Sale
                          </span>
                        )}
                      </div>
                      <div className="p-6">
                        <p
                          className="text-xs uppercase tracking-wider mb-1"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {getCategoryName(product)}
                        </p>
                        <h3
                          className="text-lg font-medium mb-2 line-clamp-1"
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
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Card Navigation */}
            <div className="flex justify-center gap-3 mt-8">
              {products.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveCard(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300`}
                  style={{
                    backgroundColor: index === activeCard
                      ? 'var(--color-accent)'
                      : 'var(--color-border-default)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// Feature Grid 2x3
function FeatureGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  const features = [
    { icon: <Package className="w-8 h-8" />, title: 'Premium Packaging', description: 'Every piece arrives in collector-grade packaging' },
    { icon: <Brush className="w-8 h-8" />, title: 'Master Sculpting', description: 'Created by world-renowned artists' },
    { icon: <Award className="w-8 h-8" />, title: 'Award Winning', description: 'Our pieces have won international competitions' },
    { icon: <Shield className="w-8 h-8" />, title: 'Quality Guarantee', description: '100% satisfaction or money back' },
    { icon: <Truck className="w-8 h-8" />, title: 'Global Shipping', description: 'Fast, secure delivery worldwide' },
    { icon: <Clock className="w-8 h-8" />, title: 'Limited Editions', description: 'Exclusive numbered releases' },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feature-item', {
        opacity: 0,
        y: 40,
        duration: 0.6,
        stagger: 0.1,
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      className="py-24 px-4 lg:px-8"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <div className="max-w-6xl mx-auto" ref={gridRef}>
        <div className="text-center mb-16">
          <p
            className="text-sm uppercase tracking-[0.3em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            Why Choose Us
          </p>
          <h2
            className="text-3xl md:text-4xl font-heading font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Technical Excellence
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-item p-8 rounded-2xl border transition-all duration-300 hover:scale-[1.02]"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-default)',
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  backgroundColor: 'var(--color-bg-hover)',
                  color: 'var(--color-accent)',
                }}
              >
                {feature.icon}
              </div>
              <h3
                className="text-xl font-medium mb-3"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {feature.title}
              </h3>
              <p style={{ color: 'var(--color-text-muted)' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Section
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'What scale are your miniatures?',
      answer: 'We offer miniatures in multiple scales including 54mm, 75mm, and 90mm. Each product page specifies the exact scale.',
    },
    {
      question: 'Are the miniatures pre-painted?',
      answer: 'No, our miniatures come unpainted to allow collectors and painters to apply their own artistic vision.',
    },
    {
      question: 'What materials do you use?',
      answer: 'We use high-quality white metal and resin, depending on the piece. Materials are specified on each product page.',
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes, we ship worldwide with tracked shipping. Delivery times vary by location.',
    },
  ];

  return (
    <section className="py-24 px-4 lg:px-8" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-sm uppercase tracking-[0.3em] mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            FAQ
          </p>
          <h2
            className="text-3xl md:text-4xl font-heading font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Common Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--color-border-default)' }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between"
                style={{ backgroundColor: 'var(--color-bg-surface)' }}
              >
                <span
                  className="font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {faq.question}
                </span>
                <ChevronRight
                  className={`w-5 h-5 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-90' : ''
                  }`}
                  style={{ color: 'var(--color-accent)' }}
                />
              </button>
              <div
                className={`px-6 overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'py-5' : 'max-h-0 py-0'
                }`}
                style={{ backgroundColor: 'var(--color-bg-card)' }}
              >
                <p style={{ color: 'var(--color-text-secondary)' }}>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Cosmos Newsletter
function CosmosNewsletter() {
  return (
    <section
      className="py-24 px-4 lg:px-8"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{
            backgroundColor: 'var(--color-bg-hover)',
            color: 'var(--color-accent)',
          }}
        >
          <Package className="w-10 h-10" />
        </div>
        <h2
          className="text-3xl md:text-4xl font-heading font-bold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Get Early Access
        </h2>
        <p
          className="text-lg mb-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Be the first to know about new releases and exclusive offers.
        </p>
        <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-6 py-4 rounded-full border outline-none"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="submit"
            className="px-8 py-4 rounded-full font-medium"
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

// Main Cosmos Homepage
export function CosmosHomepage() {
  return (
    <GsapCleanupWrapper>
      <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <RotatingHero />
        <TestimonialSection />
        <StackedCards />
        <FeatureGrid />
        <FAQSection />
        <CosmosNewsletter />
      </div>
    </GsapCleanupWrapper>
  );
}
