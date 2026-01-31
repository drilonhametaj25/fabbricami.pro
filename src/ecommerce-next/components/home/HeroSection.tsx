'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  tagline: string;
  cta: { text: string; link: string };
  ctaSecondary?: { text: string; link: string };
  bgImage?: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'ECOMMERCEERP',
    subtitle: 'Premium Online Store',
    tagline: 'Quality products at the best prices!',
    cta: { text: 'Shop Now', link: '/shop' },
    ctaSecondary: { text: 'Learn More', link: '/about' },
    bgImage: '/images/banners/hero-main.jpg',
  },
  {
    id: 2,
    title: 'Wood Whisperer',
    subtitle: 'New Collection',
    tagline: 'Fantasy miniatures brought to life with exceptional detail',
    cta: { text: 'Explore Collection', link: '/shop?category=wood-whisperer' },
    bgImage: '/images/banners/wood-whisperer.jpg',
  },
  {
    id: 3,
    title: 'Velvet Paint',
    subtitle: 'Now Available',
    tagline: 'The color that conquered Kickstarter. Perfect for every painter!',
    cta: { text: 'Shop Velvet', link: '/shop?category=velvet' },
    bgImage: '/images/banners/velvet-paint.jpg',
  },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const parallaxShape1Ref = useRef<HTMLDivElement>(null);
  const parallaxShape2Ref = useRef<HTMLDivElement>(null);
  const parallaxShape3Ref = useRef<HTMLDivElement>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const currentSlideData = slides[currentSlide];

  // Cleanup all GSAP animations and ScrollTriggers on unmount
  useEffect(() => {
    return () => {
      // Kill all ScrollTriggers associated with this section
      ScrollTrigger.getAll().forEach((trigger) => {
        const triggerElement = trigger.vars.trigger;
        // Check if trigger is the section ref or if it's a Node contained within the section
        if (triggerElement === sectionRef.current ||
            (sectionRef.current && triggerElement instanceof Node && sectionRef.current.contains(triggerElement))) {
          trigger.kill();
        }
      });
      // Kill all GSAP animations
      gsap.killTweensOf('*');
      // Reset title innerHTML to prevent DOM conflicts
      if (titleRef.current) {
        titleRef.current.innerHTML = '';
      }
    };
  }, []);

  // Auto-rotate slides
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAnimating) {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [isAnimating]);

  // Handle slide change animations
  const changeSlide = useCallback((newIndex: number) => {
    if (isAnimating || newIndex === currentSlide) return;

    setIsAnimating(true);

    // Animate out current content
    const tl = gsap.timeline({
      onComplete: () => {
        setCurrentSlide(newIndex);
        setIsAnimating(false);
      },
    });

    tl.to([titleRef.current, subtitleRef.current, taglineRef.current, ctaRef.current], {
      opacity: 0,
      y: -30,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.in',
    });
  }, [isAnimating, currentSlide]);

  // Animate in new slide content
  useEffect(() => {
    if (!titleRef.current) return;

    // Split title into characters for animation
    const text = currentSlideData.title;
    const chars = text.split('');
    titleRef.current.innerHTML = chars
      .map((char) =>
        char === ' '
          ? '<span class="title-char" style="display: inline-block;">&nbsp;</span>'
          : `<span class="title-char" style="display: inline-block; opacity: 0; transform: translateY(50px);">${char}</span>`
      )
      .join('');

    // Animate in
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 });

      tl.to('.title-char', {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.03,
        ease: 'power4.out',
      });

      tl.fromTo(
        subtitleRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.5'
      );

      tl.fromTo(
        taglineRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.4'
      );

      tl.fromTo(
        ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
        '-=0.3'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [currentSlide, currentSlideData.title]);

  // Initial animations and scroll effects
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Scroll indicator
      gsap.fromTo(
        scrollIndicatorRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8, delay: 1.5 }
      );

      // Parallax shapes on scroll
      gsap.to(parallaxShape1Ref.current, {
        y: -150,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      gsap.to(parallaxShape2Ref.current, {
        y: -100,
        x: 50,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.5,
        },
      });

      gsap.to(parallaxShape3Ref.current, {
        y: -200,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      });

      // Scroll line animation
      gsap.to('.scroll-line', {
        keyframes: [{ y: 0 }, { y: 20 }, { y: 0 }],
        duration: 1.5,
        repeat: -1,
        ease: 'power2.inOut',
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Mouse move handler for title tilt effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 2;
      const y = (clientY / innerHeight - 0.5) * 2;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Apply tilt effect to title
  useEffect(() => {
    if (!titleRef.current) return;

    gsap.to(titleRef.current, {
      rotateX: -mousePosition.y * 3,
      rotateY: mousePosition.x * 3,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, [mousePosition]);

  const goToSlide = (index: number) => {
    changeSlide(index);
  };

  const nextSlide = () => {
    changeSlide((currentSlide + 1) % slides.length);
  };

  const prevSlide = () => {
    changeSlide((currentSlide - 1 + slides.length) % slides.length);
  };

  return (
    <section
      ref={sectionRef}
      className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      {currentSlideData.bgImage ? (
        <div className="absolute inset-0">
          <Image
            src={currentSlideData.bgImage}
            alt={currentSlideData.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/40" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#1a1a2e]" />
      )}

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Parallax Shapes */}
      <div
        ref={parallaxShape1Ref}
        className="absolute top-1/4 left-1/5 w-[400px] h-[400px] rounded-full opacity-20 will-change-transform pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201, 162, 39, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        ref={parallaxShape2Ref}
        className="absolute bottom-1/4 right-1/5 w-[300px] h-[300px] rounded-full opacity-15 will-change-transform pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201, 162, 39, 0.1) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        ref={parallaxShape3Ref}
        className="absolute top-1/3 right-1/3 w-[200px] h-[200px] rounded-full opacity-10 will-change-transform pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Gradient lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-1/3 opacity-20"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(201, 162, 39, 0.5), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto" style={{ perspective: '1000px' }}>
        {/* Subtitle above title */}
        <p
          ref={subtitleRef}
          className="text-gold/80 text-sm md:text-base uppercase tracking-[0.3em] mb-6 font-light"
        >
          {currentSlideData.subtitle}
        </p>

        {/* Main Title */}
        <h1
          ref={titleRef}
          className="font-display text-[10vw] md:text-[8vw] lg:text-[6rem] xl:text-[8rem] font-semibold text-white leading-none tracking-tight mb-6"
          style={{
            transformStyle: 'preserve-3d',
            textShadow: '0 0 60px rgba(201, 162, 39, 0.2)',
          }}
        >
          {currentSlideData.title}
        </h1>

        {/* Tagline */}
        <p
          ref={taglineRef}
          className="text-text-secondary text-lg md:text-xl lg:text-2xl font-light max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {currentSlideData.tagline}
        </p>

        {/* CTA Buttons */}
        <div ref={ctaRef} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={currentSlideData.cta.link}
            className="group relative px-10 py-4 bg-gold text-primary font-medium rounded-full overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,162,39,0.4)]"
          >
            <span className="relative z-10">{currentSlideData.cta.text}</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          </Link>
          {currentSlideData.ctaSecondary && (
            <Link
              href={currentSlideData.ctaSecondary.link}
              className="group px-10 py-4 border border-white/20 text-white font-medium rounded-full transition-all duration-500 hover:border-gold/50 hover:bg-white/5"
            >
              <span>{currentSlideData.ctaSecondary.text}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Slide Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Slide Navigation Dots */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-8 bg-gold'
                : 'bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Scroll Indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted"
      >
        <span className="text-xs uppercase tracking-[0.2em]">Scroll</span>
        <div className="relative w-px h-12 overflow-hidden">
          <div
            className="scroll-line absolute top-0 left-0 w-full h-4"
            style={{
              background: 'linear-gradient(to bottom, rgba(201, 162, 39, 0.8), transparent)',
            }}
          />
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.1), transparent)',
            }}
          />
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-8 left-8 w-16 h-px bg-gradient-to-r from-gold/40 to-transparent" />
      <div className="absolute top-8 left-8 w-px h-16 bg-gradient-to-b from-gold/40 to-transparent" />
      <div className="absolute bottom-8 right-8 w-16 h-px bg-gradient-to-l from-gold/40 to-transparent" />
      <div className="absolute bottom-8 right-8 w-px h-16 bg-gradient-to-t from-gold/40 to-transparent" />
    </section>
  );
}

export default HeroSection;
