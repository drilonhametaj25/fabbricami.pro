'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, Heart, Menu, X, User } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { MobileMenu } from './MobileMenu';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { LayoutSwitcher } from '@/components/ui/LayoutSwitcher';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/shop/new-arrivals', label: 'New Arrivals' },
  { href: '/shop/best-sellers', label: 'Best Sellers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { itemCount, openDrawer } = useCartStore();
  const { count: wishlistCount } = useWishlistStore();
  const { isAuthenticated } = useAuthStore();

  const cartCount = itemCount();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled
            ? 'backdrop-blur-md border-b'
            : 'bg-transparent'
        )}
        style={{
          backgroundColor: isScrolled ? 'var(--color-bg-primary)' : 'transparent',
          borderColor: isScrolled ? 'var(--color-border-default)' : 'transparent',
        }}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <span
                className="text-2xl font-semibold"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-text-primary)',
                }}
              >
                EcommerceERP
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium transition-colors"
                  style={{
                    color: pathname === link.href
                      ? 'var(--color-accent)'
                      : 'var(--color-text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    if (pathname !== link.href) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pathname !== link.href) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Layout Switcher - Desktop only */}
              <div className="hidden md:block">
                <LayoutSwitcher />
              </div>

              {/* Theme Switcher (Dark/Light) */}
              <ThemeSwitcher />

              {/* Divider */}
              <div
                className="hidden md:block w-px h-6 mx-1"
                style={{ backgroundColor: 'var(--color-border-default)' }}
              />

              {/* Search Toggle */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="btn-icon"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Wishlist */}
              <Link
                href={isAuthenticated() ? '/account/wishlist' : '/account/login'}
                className="btn-icon relative"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount() > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 text-xs font-bold rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-text-inverted)',
                    }}
                  >
                    {wishlistCount()}
                  </span>
                )}
              </Link>

              {/* Account */}
              <Link
                href={isAuthenticated() ? '/account' : '/account/login'}
                className="btn-icon hidden sm:flex"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Account"
              >
                <User className="w-5 h-5" />
              </Link>

              {/* Cart */}
              <button
                onClick={openDrawer}
                className="btn-icon relative"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 text-xs font-bold rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-text-inverted)',
                    }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="btn-icon lg:hidden"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden border-t"
                style={{ borderColor: 'var(--color-border-default)' }}
              >
                <form onSubmit={handleSearch} className="py-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="input w-full rounded-full px-6 py-3 pr-12"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        links={navLinks}
        currentPath={pathname}
      />
    </>
  );
}
