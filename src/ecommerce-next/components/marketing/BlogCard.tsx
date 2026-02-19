import Link from 'next/link';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/lib/blog-posts';
import { formatDate } from '@/lib/blog-posts';

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  if (featured) {
    return (
      <Link href={`/blog/${post.slug}`} className="group block">
        <article className="grid md:grid-cols-2 gap-8 bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-emerald-200 hover:shadow-xl transition-all">
          <div className="aspect-video md:aspect-auto bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
            <span className="text-6xl">
              {post.categorySlug === 'guide' && '📚'}
              {post.categorySlug === 'normativa' && '📋'}
              {post.categorySlug === 'integrazioni' && '🔗'}
              {post.categorySlug === 'strategia' && '📈'}
              {post.categorySlug === 'produzione' && '🏭'}
            </span>
          </div>
          <div className="p-8 flex flex-col justify-center">
            <span className="inline-block px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full w-fit mb-4">
              {post.category}
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors">
              {post.title}
            </h2>
            <p className="text-gray-600 mb-4 line-clamp-2">{post.excerpt}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readTime}
              </span>
            </div>
            <span className="inline-flex items-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
              Leggi l&apos;articolo
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="h-full bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all">
        <div className="aspect-video bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
          <span className="text-5xl">
            {post.categorySlug === 'guide' && '📚'}
            {post.categorySlug === 'normativa' && '📋'}
            {post.categorySlug === 'integrazioni' && '🔗'}
            {post.categorySlug === 'strategia' && '📈'}
            {post.categorySlug === 'produzione' && '🏭'}
          </span>
        </div>
        <div className="p-6">
          <span className="inline-block px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full mb-3">
            {post.category}
          </span>
          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
