'use client';

import Link from 'next/link';
import { Facebook, Instagram, Youtube, Mail } from 'lucide-react';

const footerLinks = {
  shop: [
    { href: '/shop', label: 'All Products' },
    { href: '/shop/new-arrivals', label: 'New Arrivals' },
    { href: '/shop/best-sellers', label: 'Best Sellers' },
    { href: '/shop?onSale=true', label: 'On Sale' },
    { href: '/shop?featured=true', label: 'Featured' },
  ],
  support: [
    { href: '/shipping', label: 'Shipping Info' },
    { href: '/returns', label: 'Returns & Refunds' },
    { href: '/contact', label: 'Contact Us' },
    { href: '/faq', label: 'FAQ' },
  ],
  company: [
    { href: '/about', label: 'About Us' },
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/terms', label: 'Terms of Service' },
    { href: '/legal/cookies', label: 'Cookie Policy' },
  ],
};

const socialLinks = [
  { href: 'https://facebook.com/', icon: Facebook, label: 'Facebook' },
  { href: 'https://instagram.com/', icon: Instagram, label: 'Instagram' },
  { href: 'https://youtube.com/', icon: Youtube, label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="bg-surface-raised border-t border-white/10">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Main Footer */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <span className="font-display text-2xl font-semibold text-white">
                EcommerceERP
              </span>
            </Link>
            <p className="text-text-secondary mb-6 max-w-sm">
              Your one-stop shop for quality products.
              Discover our curated selection of items for every need.
            </p>

            {/* Newsletter */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-white mb-3">
                Subscribe to our newsletter
              </h4>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 bg-surface-card border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                />
                <button type="submit" className="btn-primary btn-small">
                  <Mail className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-text-muted hover:text-gold hover:bg-surface-hover transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Shop
            </h4>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <p>&copy; {new Date().getFullYear()} EcommerceERP. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Secure payments via</span>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-surface-card rounded text-xs">Stripe</span>
              <span className="px-2 py-1 bg-surface-card rounded text-xs">PayPal</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
