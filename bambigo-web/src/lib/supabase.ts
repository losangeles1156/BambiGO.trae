import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let client: SupabaseClient
if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { fetch: (...args) => fetch(...args).catch(err => {
      console.error('Supabase fetch failed, possible network issue:', err);
      throw err;
    })}
  })
} else {
  // Graceful fallback for test environments without Supabase configuration
  const unconfigured = {
    from(table: string) {
      console.warn(`Supabase not configured, mocking table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
            limit: async () => ({ data: [], error: null }),
          }),
          match: () => ({ data: [], error: null }),
          limit: async () => ({ data: [], error: null, count: 0 }),
        }),
        insert: async () => ({ data: null, error: null }),
        update: async () => ({ data: null, error: null }),
        upsert: async () => ({ data: null, error: null }),
      }
    },
    auth: {
      getUser: async () => ({ data: null, error: null }),
      getSession: async () => ({ data: null, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
  client = unconfigured as unknown as SupabaseClient
}

export const supabase = client
