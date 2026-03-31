/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Allow images from external domains
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
    ],
  },
  
  // Ignore ESLint errors during production build (prevents build failure)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optional: Ignore TypeScript errors during build (if needed)
  typescript: {
    ignoreBuildErrors: false, // set to true only if desperate
  },
};

module.exports = nextConfig;