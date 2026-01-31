'use client';

import Link from 'next/link';
import { Package, Heart, MapPin, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWishlistStore } from '@/stores/wishlistStore';

export default function AccountDashboard() {
  const { customer } = useAuthStore();
  const { items: wishlistItems } = useWishlistStore();

  const quickLinks = [
    {
      href: '/account/orders',
      icon: Package,
      label: 'I Miei Ordini',
      description: 'Visualizza e traccia i tuoi ordini',
    },
    {
      href: '/account/wishlist',
      icon: Heart,
      label: 'Lista Desideri',
      description: `${wishlistItems.length} prodotti salvati`,
    },
    {
      href: '/account/addresses',
      icon: MapPin,
      label: 'Indirizzi',
      description: 'Gestisci i tuoi indirizzi',
    },
    {
      href: '/shop',
      icon: ShoppingBag,
      label: 'Continua lo Shopping',
      description: 'Esplora i nostri prodotti',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="bg-surface-card rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Ciao, {customer?.firstName || 'Cliente'}!
        </h2>
        <p className="text-text-secondary">
          Da qui puoi gestire il tuo account, visualizzare i tuoi ordini e molto altro.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="bg-surface-card rounded-2xl p-6 hover:bg-surface-raised transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                  <Icon className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h3 className="font-medium text-white group-hover:text-gold transition-colors">
                    {link.label}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {link.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Orders (placeholder) */}
      <div className="bg-surface-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold text-white">
            Ordini Recenti
          </h2>
          <Link
            href="/account/orders"
            className="text-gold hover:underline text-sm"
          >
            Vedi tutti
          </Link>
        </div>

        <div className="text-center py-8">
          <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">Nessun ordine recente</p>
          <Link
            href="/shop"
            className="inline-block mt-4 text-gold hover:underline"
          >
            Inizia lo shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
