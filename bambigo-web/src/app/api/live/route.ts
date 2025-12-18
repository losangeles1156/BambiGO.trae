import { NextResponse } from 'next/server'
import { Client } from 'pg'

// Per-IP rate limiting buckets
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

// Data models (API payload types)
export type LiveTransit = {
  status: 'normal' | 'delayed' | 'suspended' | 'unknown'
  delay_minutes?: number
}

export type LiveMobilityStation = {
  id: string
  system_id: string
  system_name?: string | null
  name: string
  lon: number
  lat: number
  capacity?: number | null
  vehicle_types?: string[] | null
  bikes_available: number
  docks_available: number
  is_renting: boolean
  is_returning: boolean
  status_updated_at?: string | null
  app_deeplink?: string | null
}

export type LiveResponse = {
  node_id?: string | null
  bbox?: [number, number, number, number] | null
  transit: LiveTransit
  mobility: { stations: LiveMobilityStation[] }
  updated_at: string
}

function normalizeConn(s: string) {
  try {
    const u = new URL(s)
    if (u.password) u.password = encodeURIComponent(decodeURIComponent(u.password))
    return u.toString()
  } catch {
    return s
  }
}

export async function GET(req: Request) {
  // Configurable rate limit via LIVE_RATE_LIMIT env, format "<max>,<windowSec>"
  const rateCfg = process.env.LIVE_RATE_LIMIT
  if (rateCfg && !/^\s*(off|false|0)\s*$/i.test(rateCfg)) {
    let max = 60
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
  const bboxParam = url.searchParams.get('bbox')
  const limitParam = url.searchParams.get('limit')
  const simTransit = url.searchParams.get('sim_transit') // Simulation param: 'delayed', 'suspended', 'normal'

  let bbox: [number, number, number, number] | null = null
  if (bboxParam) {
    const parts = bboxParam.split(',').map((s) => parseFloat(s))
    const ok = parts.length === 4 && parts.every((n) => Number.isFinite(n))
    if (!ok) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'bbox must be 4 comma-separated numbers', details: { bbox: bboxParam } } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }
    bbox = [parts[0], parts[1], parts[2], parts[3]]
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
    limit = Math.min(1000, Math.max(1, Math.floor(n)))
  }

  const rawConn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL

  // Fallback when DB is missing
  if (!rawConn) {
    const payload: LiveResponse = {
      node_id: nodeId,
      bbox,
      transit: { status: 'unknown', delay_minutes: 0 },
      mobility: { stations: [] },
      updated_at: new Date().toISOString(),
    }
    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
        'X-API-Version': 'v4.1-strict',
      },
    })
  }

  const conn = normalizeConn(rawConn)
  const client = new Client({ connectionString: conn })
  try {
    await client.connect()

    // 1. Determine Transit Status
    // Priority: sim_transit param > node metadata > default 'normal' (instead of 'unknown')
    let transitStatus: 'normal' | 'delayed' | 'suspended' | 'unknown' = 'normal'
    
    if (simTransit && ['normal', 'delayed', 'suspended'].includes(simTransit)) {
       transitStatus = simTransit as 'normal' | 'delayed' | 'suspended'
     } else if (nodeId) {
        // Check node metadata for transit_status override
        try {
          const nodeRes = await client.query('select metadata from nodes where id = $1', [nodeId])
          if (nodeRes.rows.length > 0) {
             const meta = nodeRes.rows[0].metadata as { transit_status?: 'normal' | 'delayed' | 'suspended' | 'unknown' }
             if (meta?.transit_status) {
                 transitStatus = meta.transit_status
             }
          }
        } catch {}
     }

    // 2. Query shared mobility stations
    let sql = ''
    const values: (string | number)[] = []

    if (bbox) {
      sql = `
        select
          s.id,
          s.system_id,
          s.system_name,
          s.name,
          ST_X(s.location::geometry) as lon,
          ST_Y(s.location::geometry) as lat,
          s.capacity,
          s.vehicle_types,
          s.bikes_available,
          s.docks_available,
          s.is_renting,
          s.is_returning,
          s.status_updated_at,
          s.app_deeplink
        from public.shared_mobility_stations s
        where ST_Within(s.location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
        ${limit ? `limit ${limit}` : ''}
      `
      values.push(bbox[0], bbox[1], bbox[2], bbox[3])
    } else if (nodeId) {
      sql = `
        select
          s.id,
          s.system_id,
          s.system_name,
          s.name,
          ST_X(s.location::geometry) as lon,
          ST_Y(s.location::geometry) as lat,
          s.capacity,
          s.vehicle_types,
          s.bikes_available,
          s.docks_available,
          s.is_renting,
          s.is_returning,
          s.status_updated_at,
          s.app_deeplink
        from public.shared_mobility_stations s
        join public.nodes n on n.id = s.node_id or n.city_id = s.city_id
        where n.id = $1
        order by s.status_updated_at desc nulls last
        ${limit ? `limit ${limit}` : ''}
      `
      values.push(nodeId)
    } else {
      // No bbox or node_id provided
      return new NextResponse(
        JSON.stringify({ error: { code: 'MISSING_PARAMETER', message: 'Provide node_id or bbox' } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }

    const r = await client.query<{
      id: string
      system_id: string
      system_name: string | null
      name: string
      lon: number
      lat: number
      capacity: number | null
      vehicle_types: string[] | null
      bikes_available: number
      docks_available: number
      is_renting: boolean
      is_returning: boolean
      status_updated_at: string | null
      app_deeplink: string | null
    }>(sql, values)

    const stations: LiveMobilityStation[] = r.rows.map((s) => ({
      id: s.id,
      system_id: s.system_id,
      system_name: s.system_name,
      name: s.name,
      lon: s.lon,
      lat: s.lat,
      capacity: s.capacity,
      vehicle_types: s.vehicle_types,
      bikes_available: s.bikes_available,
      docks_available: s.docks_available,
      is_renting: s.is_renting,
      is_returning: s.is_returning,
      status_updated_at: s.status_updated_at,
      app_deeplink: s.app_deeplink,
    }))

    const payload: LiveResponse = {
      node_id: nodeId,
      bbox,
      transit: { status: transitStatus, delay_minutes: 0 },
      mobility: { stations },
      updated_at: new Date().toISOString(),
    }

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
        'X-API-Version': 'v4.1-strict',
      },
    })
  } catch {
    const payload: LiveResponse = {
      node_id: nodeId,
      bbox,
      transit: { status: 'unknown', delay_minutes: 0 },
      mobility: { stations: [] },
      updated_at: new Date().toISOString(),
    }
    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': 'v4.1-strict',
      },
    })
  } finally {
    try { await client.end() } catch {}
  }
}
