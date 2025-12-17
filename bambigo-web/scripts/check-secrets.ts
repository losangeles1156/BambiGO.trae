import fs from 'node:fs'
import path from 'node:path'

const SECRET_PATTERNS: RegExp[] = [
  /API_KEY\s*=\s*['"][^'"]+['"]/,
  /SECRET\s*=\s*['"][^'"]+['"]/,
  /PASSWORD\s*=\s*['"][^'"]+['"]/,
  /dify-[a-zA-Z0-9]+/,
  /sk-[a-zA-Z0-9]{20,}/
]

const IGNORED_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])
const IGNORED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.env.example'])

function scanFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
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
