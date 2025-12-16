import type { NextConfig } from 'next'
import fs from 'node:fs'
import path from 'node:path'
function injectEnv() {
  const tryPaths = [
    path.resolve(__dirname, '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ]
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      const txt = fs.readFileSync(p, 'utf8')
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          if (!(k in process.env)) process.env[k] = v
        }
      }
    }
  }
}
injectEnv()

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
