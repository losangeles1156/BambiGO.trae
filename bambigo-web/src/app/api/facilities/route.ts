import { NextResponse } from 'next/server'
import { Client } from 'pg'

// Rate limit buckets (per-IP)
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

// Data models (API payload types)
export type FacilityItem = {
  id: string
  node_id: string | null
  city_id: string | null
  type: string
  name?: { ja?: string; en?: string; zh?: string }
  distance_meters?: number | null
  direction?: string | null
  floor?: string | null
  has_wheelchair_access: boolean
  has_baby_care: boolean
  is_free: boolean
  is_24h: boolean
  current_status: string
  status_updated_at?: string | null
  attributes?: unknown
  booking_url?: string | null
  suitability_tags?: { tag: string; confidence: number }[]
}

export type FacilitiesResponse = {
  items: FacilityItem[]
}

function normalizeConn(s: string) {
  try {
    const u = new URL(s)
    if (u.hostname !== 'localhost' && !u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require')
    if (u.password) u.password = encodeURIComponent(decodeURIComponent(u.password))
    return u.toString()
  } catch {
    return s
  }
}

export async function GET(req: Request) {
  // Simple, configurable rate limiting
  const rateCfg = process.env.FACILITIES_RATE_LIMIT
  if (rateCfg && !/^\s*(off|false|0)\s*$/i.test(rateCfg)) {
    let max = 100
    let windowSec = 60
    const m1 = rateCfg.match(/^(\d+)\s*[,/]\s*(\d+)$/)
    if (m1) {
      max = Math.max(1, parseInt(m1[1], 10))
      windowSec = Math.max(1, parseInt(m1[2], 10))
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'local'
    const now = Date.now()
    const b = rateBuckets.get(ip) || { count: 0, resetAt: now + windowSec * 1000 }
    if (now >= b.resetAt) {
      b.count = 0
      b.resetAt = now + windowSec * 1000
    }
    b.count += 1
    rateBuckets.set(ip, b)
    if (b.count > max) {
      const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
      return new NextResponse(
        JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retry_after_seconds: retry } } }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
            'X-API-Version': 'v4.1-strict',
          },
        }
      )
    }
  }

  const url = new URL(req.url)
  const nodeId = url.searchParams.get('node_id')
  const typeParam = url.searchParams.get('type')
  const suitTag = url.searchParams.get('suitability')
  const minConfidenceParam = url.searchParams.get('min_confidence')
  const limitParam = url.searchParams.get('limit')

  if (!nodeId) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'MISSING_PARAMETER', message: 'node_id is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }

  let minConfidence = 0
  if (minConfidenceParam !== null) {
    const n = Number(minConfidenceParam)
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'min_confidence must be between 0 and 1', details: { min_confidence: minConfidenceParam } } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }
    minConfidence = n
  }

  let limit: number | undefined = undefined
  if (limitParam !== null) {
    const n = Number(limitParam)
    if (!Number.isFinite(n) || n <= 0) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'limit must be a positive integer', details: { limit: limitParam } } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }
    limit = Math.min(500, Math.max(1, Math.floor(n)))
  }

  const rawConn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL

  // If no DB configured, return empty list gracefully
  if (!rawConn) {
    const empty: FacilitiesResponse = { items: [] }
    return new NextResponse(JSON.stringify(empty), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=120',
        'X-API-Version': 'v4.1-strict',
      },
    })
  }

  const conn = normalizeConn(rawConn)
  const client = new Client({ connectionString: conn })

  try {
    await client.connect()
    try { await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'anon' })]) } catch {}
    // Build SQL with optional filters and suitability join
    const useSuitability = !!suitTag
    const values: (string | number)[] = [nodeId]
    let where = 'f.node_id = $1'
    if (typeParam) {
      values.push(typeParam)
      where += ` and f.type = $${values.length}`
    }
    if (useSuitability) {
      values.push(suitTag!)
      where += ` and s.tag = $${values.length}`
      if (minConfidence > 0) {
        values.push(minConfidence)
        where += ` and s.confidence >= $${values.length}`
      }
    }

    const limitSql = limit ? `limit ${limit}` : ''
    const sql = `
      select
        f.id::text as id,
        f.node_id,
        f.city_id,
        f.type,
        f.name,
        f.distance_meters,
        f.direction,
        f.floor,
        f.has_wheelchair_access,
        f.has_baby_care,
        f.is_free,
        f.is_24h,
        f.current_status,
        f.status_updated_at,
        f.attributes,
        f.booking_url,
        case when bool_or(s.tag is not null) then
          json_agg(json_build_object('tag', s.tag, 'confidence', s.confidence)) filter (where s.tag is not null)
        else '[]'::json end as suitability
      from public.facilities f
      ${useSuitability ? 'left join public.facility_suitability s on s.facility_id = f.id' : 'left join public.facility_suitability s on false'}
      where ${where}
      group by f.id
      order by coalesce(f.distance_meters, 999999) asc
      ${limitSql}
    `

    const r = await client.query<{
      id: string
      node_id: string | null
      city_id: string | null
      type: string
      name: unknown
      distance_meters: number | null
      direction: string | null
      floor: string | null
      has_wheelchair_access: boolean
      has_baby_care: boolean
      is_free: boolean
      is_24h: boolean
      current_status: string
      status_updated_at: string | null
      attributes: unknown
      booking_url: string | null
      suitability: unknown
    }>(sql, values)

    const items: FacilityItem[] = r.rows.map((row) => ({
      id: row.id,
      node_id: row.node_id,
      city_id: row.city_id,
      type: row.type,
      name: row.name as { ja?: string; en?: string; zh?: string },
      distance_meters: row.distance_meters,
      direction: row.direction,
      floor: row.floor,
      has_wheelchair_access: row.has_wheelchair_access,
      has_baby_care: row.has_baby_care,
      is_free: row.is_free,
      is_24h: row.is_24h,
      current_status: row.current_status,
      status_updated_at: row.status_updated_at,
      attributes: row.attributes,
      booking_url: row.booking_url,
      suitability_tags: Array.isArray(row.suitability)
        ? (row.suitability as { tag?: string; confidence?: number }[])
            .filter((x) => typeof x?.tag === 'string' && typeof x?.confidence === 'number')
            .map((x) => ({ tag: x.tag as string, confidence: x.confidence as number }))
        : [],
    }))

    const payload: FacilitiesResponse = { items }
    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=120',
        'X-API-Version': 'v4.1-strict',
      },
    })
  } catch {
    return new NextResponse(
      JSON.stringify({ items: [] } satisfies FacilitiesResponse),
      { headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  } finally {
    try { await client.end() } catch {}
  }
}
