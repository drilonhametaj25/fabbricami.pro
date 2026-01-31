'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Palette, Paintbrush } from 'lucide-react';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ShowcaseItem {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  link: string;
  icon: React.ReactNode;
  reverse?: boolean;
}

const showcaseItems: ShowcaseItem[] = [
  {
    title: 'Featured Products',
    subtitle: 'Top Quality',
    description: 'Discover our selection of premium products. Carefully curated for exceptional quality and value.',
    imageUrl: '/images/featured-1.jpg',
    link: '/shop?category=featured',
    icon: <Palette className="w-6 h-6" />,
    reverse: false,
  },
  {
    title: 'New Arrivals',
    subtitle: 'Latest Collection',
    description: 'Explore our newest additions. Fresh products selected to meet the highest standards.',
    imageUrl: '/images/featured-2.jpg',
    link: '/shop?category=new-arrivals',
    icon: <Paintbrush className="w-6 h-6" />,
    reverse: true,
  },
];

export function FeaturedShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Animate each row
      showcaseItems.forEach((_, index) => {
        const row = `.showcase-row-${index}`;
        const image = `${row} .showcase-image`;
        const content = `${row} .showcase-content`;

        // Image animation
        gsap.fromTo(
          image,
          {
            x: showcaseItems[index].reverse ? 100 : -100,
            opacity: 0,
          },
          {
            x: 0,
            opacity: 1,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row,
              start: 'top 70%',
              toggleActions: 'play none none none',
            },
          }
        );

        // Content animation
        gsap.fromTo(
          content,
          {
            x: showcaseItems[index].reverse ? -100 : 100,
            opacity: 0,
          },
          {
            x: 0,
            opacity: 1,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row,
              start: 'top 70%',
              toggleActions: 'play none none none',
            },
          }
        );

        // Parallax on image
        gsap.to(`${image} img`, {
          yPercent: -15,
          ease: 'none',
          scrollTrigger: {
            trigger: row,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 bg-primary overflow-hidden">
      {/* Background lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
      </div>

      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-gold text-sm uppercase tracking-[0.2em] mb-3">Accessories & Colors</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-white">
            Everything for Painting
          </h2>
        </div>

        {/* Showcase Rows */}
        <div className="space-y-24 lg:space-y-32">
          {showcaseItems.map((item, index) => (
            <div
              key={item.title}
              className={`showcase-row-${index} grid lg:grid-cols-2 gap-8 lg:gap-16 items-center`}
            >
              {/* Image */}
              <div
                className={`showcase-image relative aspect-[4/3] rounded-3xl overflow-hidden ${
                  item.reverse ? 'lg:order-2' : ''
                }`}
              >
                <div className="absolute inset-0 scale-110">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: item.reverse
                      ? 'linear-gradient(to left, rgba(15, 15, 26, 0.3), transparent)'
                      : 'linear-gradient(to right, rgba(15, 15, 26, 0.3), transparent)',
                  }}
                />

                {/* Decorative corner */}
                <div
                  className={`absolute ${item.reverse ? 'right-0 top-0' : 'left-0 bottom-0'} w-24 h-24`}
                >
                  <div
                    className={`absolute ${
                      item.reverse ? 'top-4 right-4' : 'bottom-4 left-4'
                    } w-16 h-px bg-gold/50`}
                  />
                  <div
                    className={`absolute ${
                      item.reverse ? 'top-4 right-4' : 'bottom-4 left-4'
                    } w-px h-16 bg-gold/50`}
                  />
                </div>
              </div>

              {/* Content */}
              <div
                className={`showcase-content ${item.reverse ? 'lg:order-1 lg:text-right' : ''}`}
              >
                {/* Icon Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold rounded-full mb-6 ${
                    item.reverse ? 'lg:flex-row-reverse' : ''
                  }`}
                >
                  {item.icon}
                  <span className="text-sm uppercase tracking-wider">{item.subtitle}</span>
                </div>

                {/* Title */}
                <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-6">
                  {item.title}
                </h3>

                {/* Description */}
                <p className="text-text-secondary text-lg leading-relaxed mb-8 max-w-xl">
                  {item.description}
                </p>

                {/* CTA */}
                <Link
                  href={item.link}
                  className={`group inline-flex items-center gap-3 ${
                    item.reverse ? 'lg:flex-row-reverse' : ''
                  }`}
                >
                  <span className="px-8 py-4 bg-gold text-primary font-medium rounded-full transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(201,162,39,0.4)]">
                    Explore Collection
                  </span>
                  <span
                    className={`flex items-center justify-center w-12 h-12 rounded-full border border-white/20 text-white transition-all duration-300 group-hover:border-gold group-hover:text-gold ${
                      item.reverse ? 'rotate-180' : ''
                    }`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedShowcase;
