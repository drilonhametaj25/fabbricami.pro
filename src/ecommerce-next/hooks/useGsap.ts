'use client';

import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hook for basic GSAP animations
 */
export function useGsap<T extends HTMLElement>(
  animation: (element: T, gsapLib: typeof gsap) => gsap.core.Tween | gsap.core.Timeline | void,
  deps: unknown[] = []
) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      animation(element, gsap);
    });

    return () => ctx.revert();
  }, deps);

  return elementRef;
}

/**
 * Hook for fade-up animation on scroll
 */
export function useFadeUp<T extends HTMLElement>(
  options: {
    delay?: number;
    duration?: number;
    distance?: number;
    start?: string;
  } = {}
) {
  const { delay = 0, duration = 0.8, distance = 40, start = 'top 85%' } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: distance,
        },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start,
            toggleActions: 'play none none none',
          },
        }
      );
    });

    return () => ctx.revert();
  }, [delay, duration, distance, start]);

  return elementRef;
}

/**
 * Hook for staggered children animation
 */
export function useStagger<T extends HTMLElement>(
  selector: string,
  options: {
    delay?: number;
    stagger?: number;
    duration?: number;
    distance?: number;
    start?: string;
  } = {}
) {
  const { delay = 0, stagger = 0.1, duration = 0.6, distance = 30, start = 'top 85%' } = options;
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll(selector);
    if (children.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        children,
        {
          opacity: 0,
          y: distance,
        },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start,
            toggleActions: 'play none none none',
          },
        }
      );
    });

    return () => ctx.revert();
  }, [selector, delay, stagger, duration, distance, start]);

  return containerRef;
}

/**
 * Hook for parallax effect on scroll
 */
export function useParallax<T extends HTMLElement>(
  options: {
    speed?: number;
    direction?: 'up' | 'down';
  } = {}
) {
  const { speed = 0.5, direction = 'up' } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      gsap.to(element, {
        y: direction === 'up' ? -100 * speed : 100 * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: element,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    return () => ctx.revert();
  }, [speed, direction]);

  return elementRef;
}

/**
 * Hook for reveal animation
 */
export function useReveal<T extends HTMLElement>(
  options: {
    delay?: number;
    duration?: number;
    from?: 'left' | 'right' | 'top' | 'bottom';
    start?: string;
  } = {}
) {
  const { delay = 0, duration = 1, from = 'bottom', start = 'top 80%' } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const direction = {
      left: { x: -100, y: 0 },
      right: { x: 100, y: 0 },
      top: { x: 0, y: -100 },
      bottom: { x: 0, y: 100 },
    };

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          opacity: 0,
          ...direction[from],
          clipPath: 'inset(0% 0% 100% 0%)',
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration,
          delay,
          ease: 'power4.out',
          scrollTrigger: {
            trigger: element,
            start,
            toggleActions: 'play none none none',
          },
        }
      );
    });

    return () => ctx.revert();
  }, [delay, duration, from, start]);

  return elementRef;
}

/**
 * Hook for text split and animate
 */
export function useTextReveal<T extends HTMLElement>(
  options: {
    type?: 'chars' | 'words' | 'lines';
    delay?: number;
    stagger?: number;
    duration?: number;
    start?: string;
  } = {}
) {
  const { type = 'words', delay = 0, stagger = 0.05, duration = 0.8, start = 'top 85%' } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Simple split text implementation
    const text = element.textContent || '';
    const items =
      type === 'chars'
        ? text.split('')
        : type === 'words'
        ? text.split(' ')
        : text.split('\n');

    element.innerHTML = items
      .map((item) => `<span class="gsap-text-item" style="display: inline-block; overflow: hidden;"><span style="display: inline-block;">${item}${type === 'words' ? '&nbsp;' : ''}</span></span>`)
      .join('');

    const innerSpans = element.querySelectorAll('.gsap-text-item > span');

    const ctx = gsap.context(() => {
      gsap.fromTo(
        innerSpans,
        {
          y: '100%',
          opacity: 0,
        },
        {
          y: '0%',
          opacity: 1,
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start,
            toggleActions: 'play none none none',
          },
        }
      );
    });

    return () => {
      ctx.revert();
      element.textContent = text; // Restore original text
    };
  }, [type, delay, stagger, duration, start]);

  return elementRef;
}

/**
 * Hook for scale animation
 */
export function useScale<T extends HTMLElement>(
  options: {
    from?: number;
    to?: number;
    duration?: number;
    delay?: number;
    start?: string;
  } = {}
) {
  const { from = 0.8, to = 1, duration = 0.8, delay = 0, start = 'top 85%' } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          scale: from,
          opacity: 0,
        },
        {
          scale: to,
          opacity: 1,
          duration,
          delay,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: element,
            start,
            toggleActions: 'play none none none',
          },
        }
      );
    });

    return () => ctx.revert();
  }, [from, to, duration, delay, start]);

  return elementRef;
}

/**
 * Hook for pin element during scroll
 */
export function usePin<T extends HTMLElement>(
  options: {
    start?: string;
    end?: string;
    pinSpacing?: boolean;
  } = {}
) {
  const { start = 'top top', end = '+=500', pinSpacing = true } = options;
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: element,
        start,
        end,
        pin: true,
        pinSpacing,
      });
    });

    return () => ctx.revert();
  }, [start, end, pinSpacing]);

  return elementRef;
}

/**
 * Hook for horizontal scroll section
 */
export function useHorizontalScroll<T extends HTMLElement>(containerSelector: string) {
  const sectionRef = useRef<T>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const container = section.querySelector(containerSelector) as HTMLElement;
    if (!container) return;

    const ctx = gsap.context(() => {
      const totalWidth = container.scrollWidth - section.offsetWidth;

      gsap.to(container, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${totalWidth}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });
    });

    return () => ctx.revert();
  }, [containerSelector]);

  return sectionRef;
}

/**
 * Utility to refresh ScrollTrigger
 */
export function refreshScrollTrigger() {
  if (typeof window !== 'undefined') {
    ScrollTrigger.refresh();
  }
}

/**
 * Utility to kill all ScrollTriggers
 */
export function killScrollTriggers() {
  if (typeof window !== 'undefined') {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
}
