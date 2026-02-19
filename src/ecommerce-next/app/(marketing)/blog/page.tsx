import type { Metadata } from 'next';
import { BookOpen, Bell, Rss } from 'lucide-react';
import { getAllPosts, getAllCategories } from '@/lib/blog-posts';
import { BlogCard } from '@/components/marketing/BlogCard';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Blog - Fabbricami ERP',
  description:
    'Guide, tutorial e best practice per gestire il tuo e-commerce. Scopri come ottimizzare inventario, ordini, produzione e fatturazione.',
  openGraph: {
    title: 'Blog - Fabbricami ERP',
    description: 'Guide e tutorial per e-commerce italiani.',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const featuredPost = posts[0];
  const otherPosts = posts.slice(1);

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Il Blog di{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                Fabbricami
              </span>
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Guide, tutorial e best practice per gestire il tuo e-commerce al meglio.
              Impara a ottimizzare inventario, ordini, produzione e fatturazione.
            </p>

            {/* Categories */}
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map(category => (
                <span
                  key={category.slug}
                  className="px-4 py-2 bg-white/10 text-white/80 rounded-full text-sm font-medium hover:bg-white/20 transition-colors cursor-pointer"
                >
                  {category.name} ({category.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Articolo in Evidenza</h2>
          <BlogCard post={featuredPost} featured />
        </div>
      </section>

      {/* All Posts */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Tutti gli Articoli</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherPosts.map(post => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-gradient-to-br from-emerald-600 to-teal-600">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-6">
              <Rss className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Resta Aggiornato
            </h2>
            <p className="text-white/80 mb-8">
              Iscriviti alla newsletter per ricevere i nuovi articoli direttamente nella tua inbox.
              Niente spam, solo contenuti utili per il tuo e-commerce.
            </p>
            <div className="max-w-md mx-auto">
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="La tua email"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  className="px-6 py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Iscriviti
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection />
    </>
  );
}
