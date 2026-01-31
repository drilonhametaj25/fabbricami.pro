'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues with GSAP
const DefaultHomepage = dynamic(
  () => import('./layouts/default/DefaultHomepage').then((mod) => mod.DefaultHomepage),
  { ssr: false }
);
const BioscienceHomepage = dynamic(
  () => import('./layouts/bioscience/BioscienceHomepage').then((mod) => mod.BioscienceHomepage),
  { ssr: false }
);
const HeritageHomepage = dynamic(
  () => import('./layouts/heritage/HeritageHomepage').then((mod) => mod.HeritageHomepage),
  { ssr: false }
);
const CosmosHomepage = dynamic(
  () => import('./layouts/cosmos/CosmosHomepage').then((mod) => mod.CosmosHomepage),
  { ssr: false }
);
const NordicHomepage = dynamic(
  () => import('./layouts/nordic/NordicHomepage').then((mod) => mod.NordicHomepage),
  { ssr: false }
);

export function HomepageRenderer() {
  const { layout } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [currentLayout, setCurrentLayout] = useState(layout);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle layout change with transition
  useEffect(() => {
    if (mounted && layout !== currentLayout) {
      setIsTransitioning(true);
      // Brief delay to allow cleanup
      const timer = setTimeout(() => {
        setCurrentLayout(layout);
        setIsTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [layout, currentLayout, mounted]);

  if (!mounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="animate-pulse text-2xl font-heading" style={{ color: 'var(--color-text-muted)' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (isTransitioning) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="animate-pulse text-xl" style={{ color: 'var(--color-text-muted)' }}>
          Switching layout...
        </div>
      </div>
    );
  }

  // Use key to force complete remount and avoid DOM conflicts
  const renderLayout = () => {
    switch (currentLayout) {
      case 'default':
        return <DefaultHomepage key="default" />;
      case 'bioscience':
        return <BioscienceHomepage key="bioscience" />;
      case 'heritage':
        return <HeritageHomepage key="heritage" />;
      case 'cosmos':
        return <CosmosHomepage key="cosmos" />;
      case 'nordic':
        return <NordicHomepage key="nordic" />;
      default:
        return <DefaultHomepage key="default-fallback" />;
    }
  };

  return <div key={currentLayout}>{renderLayout()}</div>;
}
