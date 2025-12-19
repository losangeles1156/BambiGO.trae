import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let client: any
if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Graceful fallback for test environments without Supabase configuration
  client = {
    from() {
      throw new Error('Supabase client is not configured')
    },
    auth: {
      getUser: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
    },
  }
}

export const supabase = client
