import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond, Manrope, DM_Sans } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

// Additional fonts for different layouts
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'EcommerceERP - Your Online Store',
    template: '%s | EcommerceERP',
  },
  description:
    'Discover quality products in our online store. Shop the best selection with fast shipping and excellent customer service.',
  keywords: ['e-commerce', 'online store', 'shop', 'products', 'online shopping'],
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://ecommerceerp.com',
    siteName: 'EcommerceERP',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${manrope.variable} ${dmSans.variable}`}
      data-color-mode="dark"
      data-layout="default"
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <CustomCursor />
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
        </ThemeProvider>
      </body>
    </html>
  );
}
