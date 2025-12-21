import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function isAbortLike(err: unknown, init?: RequestInit): boolean {
  const anyErr = err as { name?: unknown; message?: unknown } | null
  const name = anyErr && typeof anyErr === 'object' ? String(anyErr.name || '') : ''
  const message = anyErr && typeof anyErr === 'object' ? String(anyErr.message || '') : ''
  if (name === 'AbortError') return true
  if (init?.signal && init.signal.aborted) return true
  const m = message.toLowerCase()
  if (m.includes('abort') || m.includes('aborted') || m.includes('canceled') || m.includes('cancelled')) return true
  if (m.includes('err_aborted') || m.includes('net::err_aborted')) return true
  const s = String(err).toLowerCase()
  return s.includes('err_aborted') || s.includes('net::err_aborted')
}

let lastFetchErrorAt = 0
let lastFetchErrorMessage = ''

let client: SupabaseClient
if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          return await fetch(input, init)
        } catch (err) {
          if (!isAbortLike(err, init)) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg !== lastFetchErrorMessage) {
              lastFetchErrorMessage = msg
              lastFetchErrorAt = 0
            }
            const now = Date.now()
            if (now - lastFetchErrorAt > 60_000) {
              lastFetchErrorAt = now
              console.error('Supabase fetch failed, possible network issue:', err)
            }
          }
          throw err
        }
      },
    },
  })
} else {
  // Graceful fallback for test environments without Supabase configuration
  const warnedTables = new Set<string>()
  const unconfigured = {
    from(table: string) {
      if (!warnedTables.has(table)) {
        warnedTables.add(table)
        console.warn(`Supabase not configured, mocking table: ${table}`)
      }
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
