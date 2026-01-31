'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

interface CursorPosition {
  x: number;
  y: number;
}

interface TrailParticle {
  id: number;
  x: number;
  y: number;
  opacity: number;
}

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _trailRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const mousePos = useRef<CursorPosition>({ x: 0, y: 0 });
  const cursorPos = useRef<CursorPosition>({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [trails, setTrails] = useState<TrailParticle[]>([]);
  const trailIdRef = useRef(0);

  // Check for touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // Animation loop with lerp
  const animate = useCallback(() => {
    const lerp = 0.15;

    cursorPos.current.x += (mousePos.current.x - cursorPos.current.x) * lerp;
    cursorPos.current.y += (mousePos.current.y - cursorPos.current.y) * lerp;

    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0)`;
    }
    if (cursorDotRef.current) {
      cursorDotRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
    }
    if (glowRef.current) {
      glowRef.current.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0)`;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  // Mouse move handler
  useEffect(() => {
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (!isVisible) {
        setIsVisible(true);
        cursorPos.current = { x: e.clientX, y: e.clientY };
      }

      // Create trail particle
      trailIdRef.current += 1;
      const newTrail: TrailParticle = {
        id: trailIdRef.current,
        x: e.clientX,
        y: e.clientY,
        opacity: 0.6,
      };

      setTrails(prev => [...prev.slice(-8), newTrail]);
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isTouchDevice, isVisible, animate]);

  // Fade out trails
  useEffect(() => {
    if (trails.length === 0) return;

    const timeout = setTimeout(() => {
      setTrails(prev => prev.filter(t => t.opacity > 0.1).map(t => ({
        ...t,
        opacity: t.opacity * 0.8
      })));
    }, 50);

    return () => clearTimeout(timeout);
  }, [trails]);

  // Hover detection for interactive elements
  useEffect(() => {
    if (isTouchDevice) return;

    const interactiveSelectors = 'a, button, [role="button"], input, textarea, select, [data-cursor-hover]';

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(interactiveSelectors)) {
        setIsHovering(true);
        if (cursorRef.current) {
          gsap.to(cursorRef.current, {
            scale: 1.5,
            duration: 0.3,
            ease: 'power2.out',
          });
        }
        if (glowRef.current) {
          gsap.to(glowRef.current, {
            scale: 1.3,
            opacity: 0.8,
            duration: 0.3,
            ease: 'power2.out',
          });
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(interactiveSelectors)) {
        setIsHovering(false);
        if (cursorRef.current) {
          gsap.to(cursorRef.current, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
          });
        }
        if (glowRef.current) {
          gsap.to(glowRef.current, {
            scale: 1,
            opacity: 0.4,
            duration: 0.3,
            ease: 'power2.out',
          });
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [isTouchDevice]);

  // Hide on touch devices
  if (isTouchDevice) return null;

  return (
    <div
      className="custom-cursor-container"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* Trail particles */}
      {trails.map((trail) => (
        <div
          key={trail.id}
          className="cursor-trail"
          style={{
            position: 'fixed',
            left: trail.x - 3,
            top: trail.y - 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201, 162, 39, 0.8) 0%, transparent 70%)',
            opacity: trail.opacity,
            pointerEvents: 'none',
            transition: 'opacity 0.1s ease-out',
          }}
        />
      ))}

      {/* Glow / Spotlight effect */}
      <div
        ref={glowRef}
        className="cursor-glow"
        style={{
          position: 'fixed',
          left: -75,
          top: -75,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201, 162, 39, 0.15) 0%, rgba(201, 162, 39, 0.05) 40%, transparent 70%)',
          opacity: 0.4,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          filter: 'blur(5px)',
          willChange: 'transform',
        }}
      />

      {/* Main cursor ring */}
      <div
        ref={cursorRef}
        className="cursor-ring"
        style={{
          position: 'fixed',
          left: -20,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(201, 162, 39, 0.6)',
          background: isHovering
            ? 'rgba(201, 162, 39, 0.1)'
            : 'transparent',
          pointerEvents: 'none',
          willChange: 'transform',
          transition: 'background 0.3s ease',
        }}
      />

      {/* Center dot */}
      <div
        ref={cursorDotRef}
        className="cursor-dot"
        style={{
          position: 'fixed',
          left: -4,
          top: -4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#c9a227',
          pointerEvents: 'none',
          willChange: 'transform',
          boxShadow: '0 0 10px rgba(201, 162, 39, 0.5)',
        }}
      />
    </div>
  );
}

export default CustomCursor;
