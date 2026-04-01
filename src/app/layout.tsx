import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { TransitionProvider } from '@/context/TransitionContext';
import Header from '@/components/Header';
import ToastProvider from '@/components/ToastProvider';
import TrackingScripts from '@/components/Scripts';
import MetaPixel from '@/components/MetaPixel';
import Providers from './providers'; // 👈 React Query provider
import { GoogleAnalytics } from '@next/third-parties/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Hungry Nomad – Best Fast Food, Nigerian & Chinese in Kaduna',
  description: 'Order delicious fast food, traditional Nigerian dishes, and authentic Chinese cuisine in Kaduna. Fast delivery, best prices.',
  keywords: 'restaurant kaduna, fast food kaduna, nigerian food, chinese food kaduna, order food online',
  authors: [{ name: 'Hungry Nomad' }],
  openGraph: {
    title: 'Hungry Nomad – Kaduna’s Finest Meals',
    description: 'Satisfy your cravings with our fast food, local dishes, and Chinese specialties.',
    url: 'https://yourdomain.com',
    siteName: 'Hungry Nomad',
    images: [
      {
        url: 'https://yourdomain.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Hungry Nomad - Delicious food in Kaduna',
      },
    ],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hungry Nomad – Order Online',
    description: 'Best food delivery in Kaduna',
    images: ['https://yourdomain.com/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              "name": "Hungry Nomad",
              "description": "Fast food, traditional Nigerian dishes and Chinese cuisine in Kaduna.",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "123 Ahmadu Bello Way",
                "addressLocality": "Kaduna",
                "addressRegion": "Kaduna",
                "addressCountry": "NG"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "10.5105",
                "longitude": "7.4165"
              },
              "url": "https://yourdomain.com",
              "telephone": "+2348023456789",
              "servesCuisine": ["Fast Food", "Nigerian", "Chinese"],
              "priceRange": "₦1500 - ₦5000",
              "openingHours": "Mo-Su 10:00-22:00",
              "image": "https://yourdomain.com/restaurant-image.jpg"
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <CartProvider>
            <TransitionProvider>
              <ToastProvider>
                {/* Meta Pixel – loads the script and tracks PageView */}
                <MetaPixel />
                
                {/* 
                  ⚠️ Make sure TrackingScripts does NOT load Google Analytics or Meta Pixel again.
                  If it does, remove those parts to avoid duplicates.
                */}
                <TrackingScripts />
                
                <Header />
                <main className="min-h-screen">{children}</main>
                <footer className="bg-neutral-900 text-white py-10 mt-20">
                  <div className="container mx-auto px-4 text-center">
                    <h3 className="text-2xl font-bold text-amber-500">Hungry Nomad</h3>
                    <p className="mt-2 text-neutral-400">Serving authentic meals in Kaduna, Nigeria</p>
                    <p className="text-sm text-neutral-500 mt-4">123 Ahmadu Bello Way, Kaduna | +234 802 345 6789</p>
                    <p className="text-xs text-neutral-600 mt-6">© 2025 Hungry Nomad – All rights reserved</p>
                  </div>
                </footer>
              </ToastProvider>
            </TransitionProvider>
          </CartProvider>
        </Providers>
        {/* Google Analytics – placed at the end of body for optimal performance */}
        <GoogleAnalytics gaId="G-SJR2X6Z9DS" />
      </body>
    </html>
  );
}