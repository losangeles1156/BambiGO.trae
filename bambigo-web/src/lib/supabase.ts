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
  type PostgrestResult<T> = { data: T; error: null; count?: number | null }

  function createBuilder<T>(result: PostgrestResult<T>) {
    const builder = {
      then: (onFulfilled: (value: PostgrestResult<T>) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
      finally: (onFinally: () => void) => Promise.resolve(result).finally(onFinally),
      eq: () => builder,
      match: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
    }
    return builder
  }

  const unconfigured = {
    from(table: string) {
      if (!warnedTables.has(table)) {
        warnedTables.add(table)
        console.warn(`Supabase not configured, mocking table: ${table}`)
      }
      const listResult: PostgrestResult<unknown[]> = { data: [], error: null, count: 0 }
      return {
        select: () => createBuilder(listResult),
        insert: () => createBuilder({ data: null, error: null }),
        update: () => createBuilder({ data: null, error: null }),
        upsert: () => createBuilder({ data: null, error: null }),
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
