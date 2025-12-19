import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack is generally stable in Next.js 15, but if full reloads occur, 
  // we can ensure the root is correctly set or adjust experimental flags.
  experimental: {
    // Adding any necessary experimental flags for HMR stability if needed
  },
}

export default nextConfig
