import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata: Metadata = {
  title: {
    default: 'Fabbricami ERP - Gestisci il tuo E-commerce',
    template: '%s | Fabbricami ERP',
  },
  description:
    'L\'ERP completo per e-commerce italiani. Gestisci inventario, ordini, produzione e contabilita in un\'unica piattaforma. Integrazione WooCommerce inclusa.',
  keywords: [
    'ERP e-commerce',
    'gestionale e-commerce',
    'gestione inventario',
    'WooCommerce ERP',
    'gestione ordini',
    'produzione',
    'contabilita',
    'fatturazione elettronica',
    'magazzino',
    'software gestionale italiano',
  ],
  authors: [{ name: 'Fabbricami' }],
  creator: 'Fabbricami',
  publisher: 'Fabbricami',
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://fabbricami.pro',
    siteName: 'Fabbricami ERP',
    title: 'Fabbricami ERP - Il Gestionale per E-commerce',
    description:
      'Gestisci il tuo e-commerce con un ERP completo: inventario, ordini, produzione, contabilita. Provalo gratis per 14 giorni.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Fabbricami ERP Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fabbricami ERP - Il Gestionale per E-commerce',
    description: 'Gestisci il tuo e-commerce con un ERP completo.',
    images: ['/og-image.png'],
    creator: '@fabbricami',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
