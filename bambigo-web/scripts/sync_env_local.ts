import fs from 'node:fs'
import path from 'node:path'

function parseEnv(text: string) {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const mEq = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    const mColon = line.match(/^\s*([A-Z0-9_]+)\s*:\s*(.*)\s*$/)
    const m = mEq || mColon
    if (m) {
      const k = m[1]
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      out[k] = v
    }
  }
  return out
}

function main() {
  const src = path.resolve(process.cwd(), '..', '.env.local')
  const dst = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(src)) {
    console.log(JSON.stringify({ synced: false, reason: 'source_missing', src }))
    return
  }
  const srcTxt = fs.readFileSync(src, 'utf8')
  const dstTxt = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : ''
  const srcEnv = parseEnv(srcTxt)
  const dstEnv = parseEnv(dstTxt)
  const merged = { ...dstEnv, ...srcEnv }
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`)
  fs.writeFileSync(dst, lines.join('\n'))
  console.log(JSON.stringify({ synced: true, keys: Object.keys(merged).length }))
}

main()
