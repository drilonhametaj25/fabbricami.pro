'use client';

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;

    const ctx = gsap.context(() => {
      // Main content reveal
      gsap.fromTo(
        contentRef.current,
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Decorative elements animation
      gsap.fromTo(
        '.newsletter-decoration',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.1,
          duration: 0.8,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Floating animation for decorative elements
      gsap.utils.toArray('.newsletter-float').forEach((el: any, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -20 : 20,
          duration: 2 + i * 0.5,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Success animation
  useEffect(() => {
    if (status === 'success' && contentRef.current) {
      gsap.fromTo(
        '.success-message',
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
        }
      );

      // Confetti-like sparkles
      gsap.fromTo(
        '.success-sparkle',
        { scale: 0, rotation: -180 },
        {
          scale: 1,
          rotation: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: 'back.out(2)',
        }
      );
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    setStatus('loading');

    // Simulate API call - replace with actual Mailchimp integration
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus('success');
      setMessage('Thank you for subscribing!');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-gradient-to-b from-surface-raised via-primary to-primary overflow-hidden"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div
          className="newsletter-decoration newsletter-float absolute top-1/4 left-1/6 w-64 h-64 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(201, 162, 39, 0.2), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="newsletter-decoration newsletter-float absolute bottom-1/4 right-1/6 w-48 h-48 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(201, 162, 39, 0.15), transparent 70%)',
            filter: 'blur(30px)',
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative">
        <div
          ref={contentRef}
          className="max-w-3xl mx-auto text-center"
        >
          {/* Icon */}
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 bg-gold/20 rounded-full animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gold/10 flex items-center justify-center">
              <Mail className="w-10 h-10 text-gold" />
            </div>
            {/* Decorative sparkles */}
            <Sparkles className="newsletter-decoration absolute -top-2 -right-2 w-6 h-6 text-gold/60" />
            <Sparkles className="newsletter-decoration absolute -bottom-1 -left-3 w-4 h-4 text-gold/40" />
          </div>

          {/* Title */}
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6">
            Stay Updated
          </h2>

          {/* Description */}
          <p className="text-text-secondary text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Subscribe to our newsletter for exclusive offers, new arrivals, and collector tips
            delivered straight to your inbox.
          </p>

          {/* Form */}
          {status !== 'success' ? (
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto"
            >
              <div className="relative flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  className="w-full px-6 py-4 bg-surface-card border border-white/10 rounded-full text-white placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all duration-300"
                  disabled={status === 'loading'}
                  required
                />
                {/* Focus glow effect */}
                <div className="absolute inset-0 -z-10 rounded-full opacity-0 group-focus-within:opacity-100 blur-xl bg-gold/20 transition-opacity duration-300" />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="relative px-8 py-4 bg-gold text-primary font-medium rounded-full overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(201,162,39,0.4)] disabled:opacity-70"
              >
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </span>
                ) : (
                  <span>Subscribe</span>
                )}
                <div className="absolute inset-0 bg-white opacity-0 hover:opacity-20 transition-opacity duration-300" />
              </button>
            </form>
          ) : (
            <div className="success-message text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-green-500/20 rounded-full" />
                <CheckCircle className="w-12 h-12 text-green-400" />
                {/* Success sparkles */}
                <Sparkles className="success-sparkle absolute -top-3 -right-3 w-6 h-6 text-gold" />
                <Sparkles className="success-sparkle absolute -bottom-2 -left-4 w-5 h-5 text-gold/70" />
                <Sparkles className="success-sparkle absolute top-0 -left-6 w-4 h-4 text-gold/50" />
              </div>
              <p className="text-green-400 text-xl font-medium">{message}</p>
              <p className="text-text-secondary mt-3">
                Check your inbox to confirm your subscription.
              </p>
            </div>
          )}

          {/* Error message */}
          {status === 'error' && (
            <div className="flex items-center justify-center gap-2 mt-4 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{message}</span>
            </div>
          )}

          {/* Privacy Note */}
          <p className="text-text-muted text-sm mt-8">
            By subscribing you agree to our{' '}
            <a href="/legal/privacy" className="text-gold hover:underline transition-colors">
              Privacy Policy
            </a>
            . We respect your privacy and will never send spam.
          </p>
        </div>
      </div>
    </section>
  );
}

export default NewsletterSection;
