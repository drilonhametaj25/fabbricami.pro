'use client';

import { GsapCleanupWrapper } from '@/hooks/useGsapCleanup';
import { HeroSection } from '@/components/home/HeroSection';
import { NewArrivalsSection } from '@/components/home/NewArrivalsSection';
import { ImperdibiliSection } from '@/components/home/ImperdibiliSection';
import { FeaturedShowcase } from '@/components/home/FeaturedShowcase';
import { BrandRevealSection } from '@/components/home/BrandRevealSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';

export function DefaultHomepage() {
  return (
    <GsapCleanupWrapper>
      {/* Hero - Full screen with text reveal and parallax */}
      <HeroSection />

      {/* New Arrivals - Horizontal scroll triggered by vertical scroll */}
      <NewArrivalsSection />

      {/* Imperdibili - Featured deals with parallax images */}
      <ImperdibiliSection />

      {/* Featured Showcase - Featured products and collections */}
      <FeaturedShowcase />

      {/* Featured Brand - Brand reveal with dissolving title */}
      <BrandRevealSection
        brandName="FEATURED BRAND"
        brandSubtitle="Quality Products"
        category="featured"
      />

      {/* Premium Collection - Brand reveal with dissolving title */}
      <BrandRevealSection
        brandName="PREMIUM COLLECTION"
        brandSubtitle="Exclusive Items"
        category="premium"
      />

      {/* Newsletter - Subscription form with animations */}
      <NewsletterSection />
    </GsapCleanupWrapper>
  );
}
