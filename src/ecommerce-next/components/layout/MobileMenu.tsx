'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: Array<{ href: string; label: string }>;
  currentPath: string;
}

export function MobileMenu({ isOpen, onClose, links, currentPath }: MobileMenuProps) {
  const { isAuthenticated, customer, logout } = useAuthStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-80 max-w-full bg-surface-overlay z-50 lg:hidden overflow-y-auto"
          >
            <div className="p-6">
              {/* User Section */}
              {isAuthenticated() ? (
                <div className="mb-8 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {customer?.firstName || 'User'}
                      </p>
                      <p className="text-text-muted text-sm">{customer?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/account"
                      onClick={onClose}
                      className="btn-secondary btn-small flex-1"
                    >
                      My Account
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        onClose();
                      }}
                      className="btn-ghost btn-small"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-8 pb-6 border-b border-white/10">
                  <div className="flex gap-2">
                    <Link
                      href="/account/login"
                      onClick={onClose}
                      className="btn-primary btn-small flex-1"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/account/register"
                      onClick={onClose}
                      className="btn-secondary btn-small flex-1"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="space-y-1">
                {links.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className={cn(
                        'block py-3 px-4 rounded-xl text-lg font-medium transition-colors',
                        currentPath === link.href
                          ? 'bg-gold/10 text-gold'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      )}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Quick Links */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <h3 className="text-xs uppercase tracking-wider text-text-muted mb-4">
                  Quick Links
                </h3>
                <div className="space-y-2 text-sm">
                  <Link
                    href="/shipping"
                    onClick={onClose}
                    className="block text-text-secondary hover:text-white"
                  >
                    Shipping Info
                  </Link>
                  <Link
                    href="/returns"
                    onClick={onClose}
                    className="block text-text-secondary hover:text-white"
                  >
                    Returns & Refunds
                  </Link>
                  <Link
                    href="/contact"
                    onClick={onClose}
                    className="block text-text-secondary hover:text-white"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
