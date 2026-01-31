'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/types';

interface ProductFiltersProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function ProductFilters({ onClose, isMobile }: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories, loading: categoriesLoading } = useCategories();

  // Get current filter values from URL
  const currentCategory = searchParams.get('category') || '';
  const currentBrand = searchParams.get('brand') || '';
  const currentMinPrice = searchParams.get('minPrice') || '';
  const currentMaxPrice = searchParams.get('maxPrice') || '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentSort = searchParams.get('sort') || 'newest';
  const currentOnSale = searchParams.get('onSale') === 'true';
  const currentInStock = searchParams.get('inStock') === 'true';

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    price: true,
    brands: false,
    availability: false,
  });

  // Local state for price range
  const [minPrice, setMinPrice] = useState(currentMinPrice);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice);

  const brands = ['Brand A', 'Brand B', 'Brand C', 'Brand D'];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const updateFilter = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === '' || value === false) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }

    // Reset to page 1 when filters change
    params.delete('page');

    router.push(`/shop?${params.toString()}`);
  };

  const applyPriceFilter = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (minPrice) {
      params.set('minPrice', minPrice);
    } else {
      params.delete('minPrice');
    }

    if (maxPrice) {
      params.set('maxPrice', maxPrice);
    } else {
      params.delete('maxPrice');
    }

    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push('/shop');
    onClose?.();
  };

  const hasActiveFilters =
    currentCategory ||
    currentBrand ||
    currentMinPrice ||
    currentMaxPrice ||
    currentOnSale ||
    currentInStock;

  return (
    <div className={`space-y-6 ${isMobile ? 'p-6' : ''}`}>
      {/* Header (Mobile) */}
      {isMobile && (
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-white">Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-white transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Clear All */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="text-sm text-gold hover:underline"
        >
          Clear All Filters
        </button>
      )}

      {/* Categories */}
      <FilterSection
        title="Categories"
        expanded={expandedSections.categories}
        onToggle={() => toggleSection('categories')}
      >
        {categoriesLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 bg-surface-raised rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => updateFilter('category', '')}
              className={`w-full text-left py-2 px-3 rounded-lg transition-colors ${
                !currentCategory
                  ? 'bg-gold/10 text-gold'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-white'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                currentCategory={currentCategory}
                onSelect={(slug) => updateFilter('category', slug)}
              />
            ))}
          </div>
        )}
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title="Price"
        expanded={expandedSections.price}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
            />
            <span className="text-text-muted">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
            />
          </div>
          <button
            onClick={applyPriceFilter}
            className="w-full btn-secondary btn-small justify-center"
          >
            Apply
          </button>
        </div>
      </FilterSection>

      {/* Brands */}
      <FilterSection
        title="Brand"
        expanded={expandedSections.brands}
        onToggle={() => toggleSection('brands')}
      >
        <div className="space-y-1">
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => updateFilter('brand', currentBrand === brand ? '' : brand)}
              className={`w-full text-left py-2 px-3 rounded-lg transition-colors ${
                currentBrand === brand
                  ? 'bg-gold/10 text-gold'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-white'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Availability */}
      <FilterSection
        title="Availability"
        expanded={expandedSections.availability}
        onToggle={() => toggleSection('availability')}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={currentInStock}
              onChange={(e) => updateFilter('inStock', e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-surface-raised text-gold focus:ring-gold/50"
            />
            <span className="text-text-secondary">In Stock Only</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={currentOnSale}
              onChange={(e) => updateFilter('onSale', e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-surface-raised text-gold focus:ring-gold/50"
            />
            <span className="text-text-secondary">On Sale</span>
          </label>
        </div>
      </FilterSection>

      {/* Apply Button (Mobile) */}
      {isMobile && (
        <button
          onClick={onClose}
          className="w-full btn-primary btn-large justify-center"
        >
          Show Results
        </button>
      )}
    </div>
  );
}

// Filter Section Component
interface FilterSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, expanded, onToggle, children }: FilterSectionProps) {
  return (
    <div className="border-b border-white/10 pb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-white font-medium"
      >
        {title}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Category Item Component (recursive for nested categories)
interface CategoryItemProps {
  category: Category;
  currentCategory: string;
  onSelect: (slug: string) => void;
  depth?: number;
}

function CategoryItem({ category, currentCategory, onSelect, depth = 0 }: CategoryItemProps) {
  const hasChildren = category.children && category.children.length > 0;
  // Check if current selection is within this category's children (recursive)
  const isChildSelected = hasChildren && checkChildSelected(category.children!, currentCategory);
  // Expand by default if has children or if current category is a child
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={depth > 0 ? 'ml-3 border-l border-white/10' : ''}>
      <div className="flex items-center">
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-text-muted hover:text-white flex-shrink-0"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        ) : (
          <span className="w-6" /> /* Spacer for alignment */
        )}

        <button
          onClick={() => onSelect(category.slug)}
          className={`flex-1 text-left py-2 px-2 rounded-lg transition-colors text-sm ${
            currentCategory === category.slug
              ? 'bg-gold/10 text-gold font-medium'
              : isChildSelected
              ? 'text-gold/70'
              : 'text-text-secondary hover:bg-surface-raised hover:text-white'
          }`}
        >
          {category.name}
          {category.productCount !== undefined && category.productCount > 0 && (
            <span className="ml-1 text-text-muted text-xs">({category.productCount})</span>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pl-2"
          >
            {category.children!.map((child) => (
              <CategoryItem
                key={child.id}
                category={child}
                currentCategory={currentCategory}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper to check if any child (recursively) is selected
function checkChildSelected(children: Category[], currentSlug: string): boolean {
  for (const child of children) {
    if (child.slug === currentSlug) return true;
    if (child.children && checkChildSelected(child.children, currentSlug)) return true;
  }
  return false;
}
