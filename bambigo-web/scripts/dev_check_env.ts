import 'dotenv/config'

const provider = (process.env.AI_PROVIDER || 'mock').trim().toLowerCase()
const warnings: string[] = []
const missing: string[] = []

if (!process.env.AI_PROVIDER) warnings.push('AI_PROVIDER is missing; defaulting to mock')

const odptToken = (process.env.ODPT_API_TOKEN || process.env.ODPT_API_KEY || '').trim()
if (!odptToken) warnings.push('ODPT token missing (ODPT_API_TOKEN / ODPT_API_KEY)')

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!supabaseUrl || !supabaseAnonKey) warnings.push('Supabase public keys missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
if (!supabaseServiceKey) warnings.push('Supabase service role key missing (SUPABASE_SERVICE_ROLE_KEY)')

const databaseUrl = (process.env.DATABASE_URL || '').trim()
if (!databaseUrl) warnings.push('DATABASE_URL missing (DB-backed APIs and schema scripts will fail)')

if (provider === 'dify') {
  const difyKey = (process.env.DIFY_API_KEY || '').trim()
  const difyUrl = (process.env.DIFY_BASE_URL || process.env.DIFY_API_URL || '').trim()
  if (!difyKey) missing.push('DIFY_API_KEY')
  if (!difyUrl) missing.push('DIFY_BASE_URL (or DIFY_API_URL)')
}

if (provider === 'n8n') {
  const n8nWebhook = (process.env.N8N_WEBHOOK_URL || '').trim()
  if (!n8nWebhook) missing.push('N8N_WEBHOOK_URL')
}

if (provider !== 'mock' && provider !== 'dify' && provider !== 'n8n') {
  missing.push('AI_PROVIDER (must be mock/dify/n8n)')
}

if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '))
  process.exit(1)
}

console.log(`Environment OK (AI_PROVIDER=${provider})`)
if (warnings.length) {
  for (const w of warnings) console.warn(`Warning: ${w}`)
}
