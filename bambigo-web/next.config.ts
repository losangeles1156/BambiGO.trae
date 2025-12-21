const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {},
  async rewrites() {
    return [
      {
        source: '/@vite/client',
        destination: '/api/vite-client',
      },
      {
        source: '/line-icon.png',
        destination: '/next.svg',
      },
    ]
  },
}

export default nextConfig
