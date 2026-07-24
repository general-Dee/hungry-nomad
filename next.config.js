const { withSentryConfig } = require('@sentry/nextjs');
const defaultRuntimeCaching = require('next-pwa/cache');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    // Served by the service worker (offline, cache miss, or network error)
    // whenever a full-page navigation can't be completed. Precached at
    // build time from src/app/offline/page.tsx — see workbox's
    // `handlerDidError` wiring next-pwa adds to every runtimeCaching entry.
    document: '/offline',
  },
  runtimeCaching: [
    {
      // Direct Supabase REST calls (menu/product/delivery-zone data fetched
      // client-side from src/app/menu/page.tsx and src/app/checkout/page.tsx)
      // carry live pricing, so default workbox caching (NetworkFirst, 1hr TTL)
      // is too long-lived — a much shorter TTL keeps stale-price exposure to
      // a few minutes if the network is unreachable, without disabling
      // offline caching entirely.
      //
      // This entry must come before the spread defaults below: workbox uses
      // first-match-wins, and next-pwa's default list ends with a generic
      // cross-origin catch-all that would otherwise shadow this one.
      urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-rest-cache',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Supplement, don't replace, next-pwa's default cache list (fonts,
    // images, JS/CSS chunks, /_next/data, same-origin /api/*, etc.) — passing
    // any runtimeCaching array overrides next-pwa's `= defaultCache` default
    // entirely, so the defaults must be spread back in explicitly.
    ...defaultRuntimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'didjqzebvouurvpdjofb.supabase.co',
      },
    ],
  },
};

module.exports = withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // SENTRY_AUTH_TOKEN is read automatically. Without it, source map upload
  // is skipped (errors still report, just with unminified stack traces).
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});