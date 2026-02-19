/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone per Docker deployment ottimizzato
  output: 'standalone',

  // Ignore ESLint errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignore TypeScript errors during production build
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api/v1',
  },
};

module.exports = nextConfig;
