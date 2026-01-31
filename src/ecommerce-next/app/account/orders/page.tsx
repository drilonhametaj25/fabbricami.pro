'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Package, ChevronRight, Search, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Order, ApiResponse } from '@/types';

const orderStatusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'In attesa', color: 'text-warning' },
  CONFIRMED: { label: 'Confermato', color: 'text-blue-400' },
  PROCESSING: { label: 'In lavorazione', color: 'text-blue-400' },
  SHIPPED: { label: 'Spedito', color: 'text-gold' },
  DELIVERED: { label: 'Consegnato', color: 'text-success' },
  CANCELLED: { label: 'Annullato', color: 'text-error' },
  REFUNDED: { label: 'Rimborsato', color: 'text-text-muted' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.get<ApiResponse<{ items: Order[] }>>(
          '/shop/account/orders'
        );
        if (response.success && response.data) {
          setOrders(response.data.items || []);
        }
      } catch {
        setError('Impossibile caricare gli ordini');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface-card rounded-2xl p-6 animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-2">
                <div className="h-5 bg-surface-raised rounded w-32" />
                <div className="h-4 bg-surface-raised rounded w-24" />
              </div>
              <div className="h-6 bg-surface-raised rounded w-20" />
            </div>
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-surface-raised rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-raised rounded w-3/4" />
                <div className="h-4 bg-surface-raised rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-card rounded-2xl p-8 text-center">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-white">
          I Miei Ordini
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca ordine..."
            className="pl-12 pr-4 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-surface-card rounded-2xl p-8 text-center">
          <Package className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Nessun ordine trovato
          </h3>
          <p className="text-text-secondary mb-6">
            {searchQuery
              ? 'Prova con un termine di ricerca diverso'
              : 'Non hai ancora effettuato ordini'}
          </p>
          <Link href="/shop" className="btn-primary btn-medium">
            Inizia lo Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => {
            const status = orderStatusLabels[order.status] || {
              label: order.status,
              color: 'text-text-muted',
            };

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={`/account/orders/${order.id}`}
                  className="block bg-surface-card rounded-2xl p-6 hover:bg-surface-raised transition-colors group"
                >
                  {/* Order Header */}
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div>
                      <p className="font-medium text-white">
                        Ordine #{order.orderNumber || order.id.slice(0, 8)}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-gold transition-colors" />
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {order.items?.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-surface-raised"
                      >
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        )}
                        {item.quantity > 1 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-primary text-xs font-bold rounded-full flex items-center justify-center">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                    {order.items && order.items.length > 4 && (
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-surface-raised flex items-center justify-center">
                        <span className="text-sm text-text-muted">
                          +{order.items.length - 4}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Order Total */}
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                    <span className="text-text-secondary">
                      {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} articoli
                    </span>
                    <span className="font-semibold text-gold">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
