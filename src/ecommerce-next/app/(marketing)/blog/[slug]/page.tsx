import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, User, Tag, ArrowRight } from 'lucide-react';
import { getAllPosts, getPostBySlug, getRelatedPosts, formatDate } from '@/lib/blog-posts';
import { BlogCard } from '@/components/marketing/BlogCard';
import { CTASection } from '@/components/marketing/CTASection';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map(post => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Articolo non trovato - Fabbricami ERP',
    };
  }

  return {
    title: `${post.title} - Fabbricami ERP`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(slug, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna al Blog
            </Link>

            <span className="inline-block px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/20 rounded-full mb-4">
              {post.category}
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {post.title}
            </h1>

            <p className="text-lg text-white/70 mb-8">{post.excerpt}</p>

            <div className="flex flex-wrap items-center gap-6 text-white/60">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>
                  {post.author}
                  <span className="text-white/40"> - {post.authorRole}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {post.readTime} di lettura
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <article
              className="prose prose-lg prose-gray max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900
                prose-ul:my-4 prose-li:text-gray-700
                prose-ol:my-4"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center gap-3 flex-wrap">
                <Tag className="w-5 h-5 text-gray-400" />
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Author Box */}
            <div className="mt-8 p-6 bg-gray-50 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xl">
                  {post.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{post.author}</h3>
                  <p className="text-emerald-600 text-sm mb-2">{post.authorRole}</p>
                  <p className="text-gray-600 text-sm">
                    Esperto di soluzioni e-commerce e ERP per il mercato italiano.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Box */}
            <div className="mt-12 p-8 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                Pronto a Ottimizzare il Tuo E-commerce?
              </h3>
              <p className="text-white/80 mb-6">
                Prova Fabbricami gratis per 14 giorni. Nessuna carta di credito richiesta.
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Inizia la Prova Gratuita
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Articoli Correlati</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {relatedPosts.map(relatedPost => (
                <BlogCard key={relatedPost.slug} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <CTASection />
    </>
  );
}
