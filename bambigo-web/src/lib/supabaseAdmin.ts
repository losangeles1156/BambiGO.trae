import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const globalForSupabaseAdmin = global as unknown as { supabaseAdminWarned?: boolean }

let adminClient: SupabaseClient
if (supabaseUrl && supabaseServiceRoleKey) {
  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
} else {
  if (!globalForSupabaseAdmin.supabaseAdminWarned) {
    globalForSupabaseAdmin.supabaseAdminWarned = true
    console.warn('Missing Supabase Service Role Key - Admin operations will fail')
  }
  const unconfigured = {
    from: () => {
      throw new Error('Supabase admin client is not configured')
    },
    rpc: async () => {
      throw new Error('Supabase admin client is not configured')
    },
  }
  adminClient = unconfigured as unknown as SupabaseClient
}

export const supabaseAdmin = adminClient
