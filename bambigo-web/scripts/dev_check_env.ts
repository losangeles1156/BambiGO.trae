import 'dotenv/config'

const required = [
  'DATABASE_URL',
  'ODPT_API_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const missing: string[] = []
for (const k of required) {
  if (!process.env[k] || String(process.env[k]).trim().length === 0) missing.push(k)
}

if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '))
  process.exit(1)
} else {
  console.log('Environment OK')
}
