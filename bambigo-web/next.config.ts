const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {},
  async rewrites() {
    return [
      {
        source: '/@vite/client',
        destination: '/api/health', // Redirect to a healthy endpoint to avoid 404
      },
      {
        source: '/line-icon.png',
        destination: '/next.svg',
      },
    ]
  },
}

export default nextConfig
