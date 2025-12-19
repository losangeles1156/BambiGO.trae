import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let adminClient: any
if (supabaseUrl && supabaseServiceRoleKey) {
  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
} else {
  console.warn('Missing Supabase Service Role Key - Admin operations will fail')
  adminClient = {
    rpc: async () => { throw new Error('Supabase admin client is not configured') },
  }
}

export const supabaseAdmin = adminClient
