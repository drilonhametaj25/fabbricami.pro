'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Package, Heart, MapPin, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { href: '/account', label: 'Dashboard', icon: User, exact: true },
  { href: '/account/orders', label: 'Ordini', icon: Package },
  { href: '/account/wishlist', label: 'Lista Desideri', icon: Heart },
  { href: '/account/addresses', label: 'Indirizzi', icon: MapPin },
  { href: '/account/profile', label: 'Profilo', icon: Settings },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading, customer, logout } = useAuthStore();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      router.push(`/account/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, loading, router, pathname]);

  // Skip layout for login/register pages
  if (pathname === '/account/login' || pathname === '/account/register') {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-primary">
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-white">
            Il Mio Account
          </h1>
          <p className="text-text-secondary mt-2">
            Benvenuto, {customer?.firstName || customer?.email}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav className="bg-surface-card rounded-2xl p-4 sticky top-24">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-gold/10 text-gold'
                            : 'text-text-secondary hover:bg-surface-raised hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}

                {/* Logout */}
                <li className="pt-4 mt-4 border-t border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-error/10 hover:text-error transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Esci
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
