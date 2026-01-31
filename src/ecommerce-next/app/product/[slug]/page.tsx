'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductInfo } from '@/components/product/ProductInfo';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductCard } from '@/components/product/ProductCard';
import { useProduct, useFeaturedProducts } from '@/hooks/useProducts';

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { product, loading, error } = useProduct(slug);
  const { products: relatedProducts, loading: relatedLoading } = useFeaturedProducts(4);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-primary pt-28">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="animate-pulse">
            {/* Breadcrumb skeleton */}
            <div className="h-4 bg-surface-raised rounded w-64 mb-8" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Gallery skeleton */}
              <div className="aspect-square bg-surface-card rounded-2xl" />

              {/* Info skeleton */}
              <div className="space-y-6">
                <div className="h-4 bg-surface-raised rounded w-32" />
                <div className="h-10 bg-surface-raised rounded w-3/4" />
                <div className="h-8 bg-surface-raised rounded w-24" />
                <div className="space-y-2">
                  <div className="h-4 bg-surface-raised rounded w-full" />
                  <div className="h-4 bg-surface-raised rounded w-5/6" />
                  <div className="h-4 bg-surface-raised rounded w-4/6" />
                </div>
                <div className="h-14 bg-surface-raised rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !product) {
    return (
      <div className="min-h-screen bg-primary pt-28 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold text-white mb-4">
            Product Not Found
          </h1>
          <p className="text-text-secondary mb-8">
            The product you are looking for does not exist or has been removed.
          </p>
          <Link href="/shop" className="btn-primary btn-large">
            <ArrowLeft className="w-5 h-5" />
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  // Get primary category
  const primaryCategory = product.categories?.[0];

  return (
    <div className="min-h-screen bg-primary pt-28">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="text-text-secondary hover:text-gold transition-colors">
            Home
          </Link>
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          <Link href="/shop" className="text-text-secondary hover:text-gold transition-colors">
            Shop
          </Link>
          {primaryCategory && (
            <>
              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
              <Link
                href={`/shop?category=${primaryCategory.slug}`}
                className="text-text-secondary hover:text-gold transition-colors"
              >
                {primaryCategory.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="text-gold truncate">{product.name}</span>
        </nav>

        {/* Product Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
        >
          {/* Gallery */}
          <ProductGallery
            images={
              product.images?.map((img) =>
                typeof img === 'string' ? img : img.url
              ) || (product.imageUrl ? [product.imageUrl] : [])
            }
            productName={product.name}
          />

          {/* Info */}
          <ProductInfo product={product} />
        </motion.div>

        {/* Reviews Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 lg:mt-24"
        >
          <ProductReviews productId={product.id} />
        </motion.section>

        {/* Related Products */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 lg:mt-24"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-white">
              You May Also Like
            </h2>
            <Link
              href="/shop"
              className="text-gold hover:underline hidden sm:block"
            >
              View All
            </Link>
          </div>

          {relatedLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
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
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts
                .filter((p) => p.id !== product.id)
                .slice(0, 4)
                .map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
