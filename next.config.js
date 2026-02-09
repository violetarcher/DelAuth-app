/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PORT: '3005',
  },
  // Suppress Next.js dev server logs for specific routes
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

module.exports = nextConfig
