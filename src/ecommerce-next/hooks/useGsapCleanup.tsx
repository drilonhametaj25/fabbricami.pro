'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hook to properly cleanup GSAP animations and ScrollTriggers on unmount.
 * This prevents React DOM conflicts when switching between components that use GSAP.
 */
export function useGsapCleanup() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    return () => {
      // Kill all ScrollTriggers associated with this container
      ScrollTrigger.getAll().forEach((trigger) => {
        const triggerElement = trigger.vars.trigger;
        if (
          triggerElement === container ||
          (container && triggerElement instanceof Element && container.contains(triggerElement))
        ) {
          trigger.kill();
        }
      });

      // Kill all tweens targeting elements in this container
      if (container) {
        gsap.killTweensOf(container.querySelectorAll('*'));
        gsap.killTweensOf(container);
      }

      // Refresh ScrollTrigger to recalculate positions
      ScrollTrigger.refresh();
    };
  }, []);

  return containerRef;
}

/**
 * Wraps a component with GSAP cleanup functionality.
 * Use this as a wrapper div around your layout content.
 */
export function GsapCleanupWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useGsapCleanup();

  return (
    <div ref={containerRef} className="gsap-cleanup-wrapper">
      {children}
    </div>
  );
}
