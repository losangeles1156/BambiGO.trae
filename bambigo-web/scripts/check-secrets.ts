import fs from 'node:fs'
import path from 'node:path'

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/,
  /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/,
]

const IGNORED_VALUES = new Set(['test', 'test-key', 'mock', 'dummy', 'example', 'changeme'])
const ENV_ASSIGNMENT_RE = /(API_KEY|SECRET|PASSWORD)\s*=\s*['"]([^'\"]+)['"]/g
const MIN_SECRET_LENGTH: Record<string, number> = { API_KEY: 16, SECRET: 16, PASSWORD: 8 }

const IGNORED_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])
const IGNORED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.env.example'])

function scanFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8')

    for (const m of content.matchAll(ENV_ASSIGNMENT_RE)) {
      const key = String(m[1] || '').trim()
      const value = String(m[2] || '').trim()
      const minLen = MIN_SECRET_LENGTH[key] || 0
      if (value.length < minLen) continue
      if (IGNORED_VALUES.has(value.toLowerCase())) continue
      console.error(`[SECURITY] Potential secret found in ${filePath} matching env assignment ${key}`)
      return true
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`[SECURITY] Potential secret found in ${filePath} matching pattern ${pattern}`)
        return true
      }
    }
  } catch {}
  return false
}

function walkDir(dir: string): boolean {
  let hasSecrets = false
  const files = fs.readdirSync(dir)
  for (const file of files) {
    if (IGNORED_DIRS.has(file)) continue
    if (IGNORED_FILES.has(file)) continue
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      if (walkDir(filePath)) hasSecrets = true
    } else {
      if (scanFile(filePath)) hasSecrets = true
    }
  }
  return hasSecrets
}

console.log('Scanning for secrets...')
if (walkDir('.')) {
  console.error('[SECURITY] Secrets detected! Commit rejected.')
  process.exit(1)
}
console.log('[SECURITY] No secrets found.')
