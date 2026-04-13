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
                <footer className="bg-neutral-900 text-white py-12 mt-20">
  <div className="container mx-auto px-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
      {/* Brand */}
      <div>
        <h3 className="text-2xl font-bold text-amber-500">Hungry Nomad</h3>
        <p className="mt-2 text-neutral-400">Serving authentic meals in Kaduna, Nigeria</p>
      </div>

      {/* Contact Info */}
      <div>
        <h4 className="text-lg font-semibold mb-3">Contact Us</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>4 Ibrahim Zaki road, Kaduna</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>070 6216 9786</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>11:00am – 10:30pm (Daily)</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h4 className="text-lg font-semibold mb-3">Quick Links</h4>
        <ul className="space-y-2">
          <li><a href="/menu" className="text-neutral-400 hover:text-amber-500 transition">Our Menu</a></li>
          <li><a href="/cart" className="text-neutral-400 hover:text-amber-500 transition">Cart</a></li>
          <li><a href="/" className="text-neutral-400 hover:text-amber-500 transition">Home</a></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-neutral-800 mt-8 pt-6 text-center text-sm text-neutral-500">
      © {new Date().getFullYear()} Hungry Nomad – All rights reserved
    </div>
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