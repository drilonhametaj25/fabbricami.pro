'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, List, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductFilters } from '@/components/shop/ProductFilters';
import { useProducts } from '@/hooks/useProducts';

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A-Z' },
  { value: 'name-desc', label: 'Name: Z-A' },
  { value: 'bestselling', label: 'Best Sellers' },
  { value: 'most-viewed', label: 'Most Viewed' },
];

function ShopContent() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Get params from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 12;
  const category = searchParams.get('category') || undefined;
  // const brand = searchParams.get('brand') || undefined; // Reserved for future use
  const minPrice = searchParams.get('minPrice')
    ? parseFloat(searchParams.get('minPrice')!)
    : undefined;
  const maxPrice = searchParams.get('maxPrice')
    ? parseFloat(searchParams.get('maxPrice')!)
    : undefined;
  const sort = searchParams.get('sort') || 'newest';
  const onSale = searchParams.get('onSale') === 'true';
  const inStock = searchParams.get('inStock') === 'true';
  const search = searchParams.get('q') || undefined;

  const { products, pagination, loading, error } = useProducts({
    page,
    limit,
    category,
    // brand, // Not in ProductFilters type
    minPrice,
    maxPrice,
    sortBy: sort.includes('-') ? sort.split('-')[0] : sort === 'newest' ? 'createdAt' : sort,
    sortOrder: sort.includes('desc') ? 'desc' : sort === 'newest' ? 'desc' : 'asc',
    onSale: onSale || undefined,
    inStock: inStock || undefined,
    search,
  });

  const total = pagination?.total || 0;
  const totalPages = pagination?.totalPages || Math.ceil(total / limit);
  const currentSort = sortOptions.find((opt) => opt.value === sort)?.label || 'Newest';

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSort(false);
    if (showSort) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSort]);

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-surface-card to-surface-raised py-12 lg:py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white text-center">
            {search ? `Results for "${search}"` : category ? category : 'Shop'}
          </h1>
          <p className="text-text-secondary text-center mt-4 max-w-2xl mx-auto">
            Discover our collection of miniatures, paints, and modeling accessories
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <ProductFilters />
            </div>
          </aside>

          {/* Products Section */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {/* Results Count */}
              <p className="text-text-secondary">
                {loading ? 'Loading...' : `${total} products found`}
              </p>

              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 bg-surface-card rounded-lg text-white hover:bg-surface-raised transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </button>

                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSort(!showSort);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-card rounded-lg text-white hover:bg-surface-raised transition-colors"
                  >
                    {currentSort}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showSort ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showSort && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-surface-card rounded-lg shadow-xl border border-white/10 overflow-hidden z-20"
                      >
                        {sortOptions.map((option) => (
                          <a
                            key={option.value}
                            href={`?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), sort: option.value, page: '1' }).toString()}`}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              sort === option.value
                                ? 'bg-gold/10 text-gold'
                                : 'text-white hover:bg-surface-raised'
                            }`}
                          >
                            {option.label}
                          </a>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* View Mode */}
                <div className="hidden sm:flex items-center border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-gold text-primary'
                        : 'text-white hover:bg-surface-raised'
                    }`}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${
                      viewMode === 'list'
                        ? 'bg-gold text-primary'
                        : 'text-white hover:bg-surface-raised'
                    }`}
                    aria-label="List view"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Products Grid/List */}
            {loading ? (
              <div className={`grid gap-6 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1'
              }`}>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-surface-card rounded-2xl overflow-hidden animate-pulse"
                  >
                    <div className="aspect-square bg-surface-raised" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-surface-raised rounded w-3/4" />
                      <div className="h-4 bg-surface-raised rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-error">{error}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary text-lg">No products found</p>
                <p className="text-text-muted mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              <motion.div
                className={`grid gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                {/* Previous */}
                <a
                  href={page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page - 1) }).toString()}` : '#'}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    page === 1
                      ? 'bg-surface-card text-gray-600 cursor-not-allowed'
                      : 'bg-surface-card text-white hover:bg-surface-raised'
                  }`}
                >
                  Previous
                </a>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Show first, last, and pages around current
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= page - 1 && pageNum <= page + 1)
                    ) {
                      return (
                        <a
                          key={pageNum}
                          href={`?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(pageNum) }).toString()}`}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                            page === pageNum
                              ? 'bg-gold text-primary'
                              : 'bg-surface-card text-white hover:bg-surface-raised'
                          }`}
                        >
                          {pageNum}
                        </a>
                      );
                    }
                    // Show ellipsis
                    if (pageNum === page - 2 || pageNum === page + 2) {
                      return (
                        <span key={pageNum} className="px-2 text-text-muted">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Next */}
                <a
                  href={page < totalPages ? `?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page + 1) }).toString()}` : '#'}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    page === totalPages
                      ? 'bg-surface-card text-gray-600 cursor-not-allowed'
                      : 'bg-surface-card text-white hover:bg-surface-raised'
                  }`}
                >
                  Next
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-80 bg-surface-card z-50 overflow-y-auto lg:hidden"
            >
              <ProductFilters isMobile onClose={() => setShowFilters(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
    </div>}>
      <ShopContent />
    </Suspense>
  );
}
