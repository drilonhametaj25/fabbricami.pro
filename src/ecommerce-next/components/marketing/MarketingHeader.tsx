'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  {
    href: '/features',
    label: 'Funzionalita',
    children: [
      { href: '/features/inventory', label: 'Gestione Inventario' },
      { href: '/features/orders', label: 'Gestione Ordini' },
      { href: '/features/production', label: 'Produzione' },
      { href: '/features/accounting', label: 'Contabilita' },
      { href: '/features/integrations', label: 'Integrazioni' },
    ],
  },
  { href: '/pricing', label: 'Prezzi' },
  {
    href: '/tools',
    label: 'Strumenti Gratuiti',
    children: [
      { href: '/tools/roi-calculator', label: 'Calcolatore ROI' },
      { href: '/tools/inventory-checker', label: 'Checker Inventario' },
      { href: '/tools/invoice-generator', label: 'Generatore Fattura' },
    ],
  },
  { href: '/blog', label: 'Blog' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
            : 'bg-transparent'
        )}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">F</span>
              </div>
              <span className={cn(
                'text-xl font-bold transition-colors',
                isScrolled ? 'text-gray-900' : 'text-white'
              )}>
                Fabbricami
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => link.children && setOpenDropdown(link.href)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <Link
                    href={link.href}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1',
                      isScrolled
                        ? pathname === link.href || pathname.startsWith(link.href + '/')
                          ? 'text-emerald-600'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                        : pathname === link.href || pathname.startsWith(link.href + '/')
                        ? 'text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    )}
                  >
                    {link.label}
                    {link.children && <ChevronDown className="w-4 h-4" />}
                  </Link>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {link.children && openDropdown === link.href && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 pt-2 w-56"
                      >
                        <div className="bg-white rounded-xl shadow-xl border border-gray-100 py-2 overflow-hidden">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'block px-4 py-2.5 text-sm transition-colors',
                                pathname === child.href
                                  ? 'text-emerald-600 bg-emerald-50'
                                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </nav>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="https://demo.fabbricami.pro"
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900'
                    : 'text-white/90 hover:text-white'
                )}
              >
                Prova Demo
              </Link>
              <Link
                href="https://erp.fabbricami.pro/login"
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900'
                    : 'text-white/90 hover:text-white'
                )}
              >
                Accedi
              </Link>
              <Link
                href="/auth/register"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
              >
                Inizia Gratis
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                'lg:hidden p-2 rounded-lg transition-colors',
                isScrolled
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-white hover:bg-white/10'
              )}
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
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <span className="text-lg font-bold text-gray-900">Menu</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Links */}
                <div className="flex-1 overflow-y-auto py-4">
                  {navLinks.map((link) => (
                    <div key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          'block px-6 py-3 text-base font-medium transition-colors',
                          pathname === link.href
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {link.label}
                      </Link>
                      {link.children && (
                        <div className="pl-8 border-l-2 border-gray-100 ml-6">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'block px-4 py-2.5 text-sm transition-colors',
                                pathname === child.href
                                  ? 'text-emerald-600'
                                  : 'text-gray-600 hover:text-gray-900'
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="p-4 border-t space-y-3">
                  <Link
                    href="https://demo.fabbricami.pro"
                    className="block w-full px-4 py-3 text-center text-gray-700 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Prova Demo
                  </Link>
                  <Link
                    href="/auth/register"
                    className="block w-full px-4 py-3 text-center text-white font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all"
                  >
                    Inizia Gratis
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
