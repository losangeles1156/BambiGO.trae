import path from 'path'

const config = {
  test: {
    include: ['tests/**/*.ts', 'test/**/*.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}

export default config
