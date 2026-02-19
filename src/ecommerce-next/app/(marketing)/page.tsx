import { Hero } from '@/components/marketing/Hero';
import { Features } from '@/components/marketing/Features';
import { ToolsPreview } from '@/components/marketing/ToolsPreview';
import { PricingTable } from '@/components/marketing/PricingTable';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FAQ } from '@/components/marketing/FAQ';
import { CTASection } from '@/components/marketing/CTASection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <ToolsPreview />
      <PricingTable />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
