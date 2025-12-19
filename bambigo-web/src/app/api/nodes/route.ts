import { NextResponse } from 'next/server'
import { Client } from 'pg'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

const defaultBbox = { minLon: 139.73, minLat: 35.65, maxLon: 139.82, maxLat: 35.74 }

const mockNodes = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [139.7774, 35.7141] },
    properties: {
      id: 'mock-ueno',
      name: { ja: '上野駅', en: 'Ueno Station', zh: '上野站' },
      type: 'station',
      supply_tags: ['has_train', 'has_locker', 'has_toilet'],
      suitability_tags: ['shopping', 'culture', 'park'],
    }
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [139.7671, 35.6812] },
    properties: {
      id: 'mock-tokyo',
      name: { ja: '東京駅', en: 'Tokyo Station', zh: '東京站' },
      type: 'station',
      supply_tags: ['has_train', 'has_shinkansen', 'has_shopping'],
      suitability_tags: ['business', 'travel', 'shopping'],
    }
  }
]

export async function GET(req: Request) {
  const rateCfg = process.env.NODES_RATE_LIMIT
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
  const bboxParam = url.searchParams.get('bbox')
  const typeParam = url.searchParams.get('type') || url.searchParams.get('category')
  const limitParam = url.searchParams.get('limit')
  let bbox = defaultBbox
  if (bboxParam) {
    const parts = bboxParam.split(',').map((s) => parseFloat(s))
    const ok = parts.length === 4 && parts.every((n) => Number.isFinite(n))
    if (!ok) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'bbox must be 4 comma-separated numbers', details: { bbox: bboxParam } } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }
    bbox = { minLon: parts[0], minLat: parts[1], maxLon: parts[2], maxLat: parts[3] }
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
    limit = Math.min(10000, Math.max(1, Math.floor(n)))
  }
  const allowedTypes = new Set(['station', 'bus_stop'])
  const typeFilter = typeParam || null
  if (typeFilter && !allowedTypes.has(typeFilter)) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'type must be one of station,bus_stop', details: { type: typeFilter } } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }
  const rawConn = process.env.DATABASE_URL
  if (!rawConn) {
    return new NextResponse(
      JSON.stringify({ type: 'FeatureCollection', features: [] }),
      { headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }

  // Use raw connection string to match health check logic
  // normalizeConn removed as it may conflict with ssl config or password encoding
  const conn = rawConn
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const sql = `
      select
        id,
        name,
        type,
        metadata,
        external_links,
        ST_X(location::geometry) as lon,
        ST_Y(location::geometry) as lat
      from public.nodes
      where location is not null
        and ST_X(location::geometry) >= $1
        and ST_X(location::geometry) <= $3
        and ST_Y(location::geometry) >= $2
        and ST_Y(location::geometry) <= $4
        ${typeFilter ? `and type = $5` : ``}
      ${limit ? `limit ${limit}` : ``}
    `
    const values: (number | string)[] = [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat]
    if (typeFilter) values.push(typeFilter)
    let rows: {
      id: string
      name: unknown
      type: string
      metadata: unknown
      external_links: unknown
      lon: number
      lat: number
    }[] = []
    try {
      const r1 = await client.query<{
        id: string
        name: unknown
        type: string
        metadata: unknown
        external_links: unknown
        lon: number
        lat: number
      }>(sql, values)
      rows = r1.rows
    } catch {
      const sql2 = `
        select
          id,
          name,
          type,
          metadata,
          external_links,
          ST_X(geom::geometry) as lon,
          ST_Y(geom::geometry) as lat
        from public.nodes
        where geom is not null
          and ST_Within(
            geom::geometry,
            ST_MakeEnvelope($1, $2, $3, $4, 4326)
          )
          ${typeFilter ? `and type = $5` : ``}
        ${limit ? `limit ${limit}` : ``}
      `
      const r2 = await client.query<{
        id: string
        name: unknown
        type: string
        metadata: unknown
        external_links: unknown
        lon: number
        lat: number
      }>(sql2, values)
      rows = r2.rows
    }
    const features = rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: {
        id: r.id,
        name: r.name as { ja?: string; en?: string; zh?: string },
        type: r.type,
        supply_tags: r.type === 'station' ? ['has_train'] : r.type === 'bus_stop' ? ['has_bus'] : [],
        suitability_tags: [],
        external_links: r.external_links,
        metadata: r.metadata,
      },
    }))
    
    // Fallback: If no features found from DB (or specific nodes missing), append mock nodes for demo
    if (features.length === 0) {
      features.push(...(mockNodes as any[]))
    }

    const fc = { type: 'FeatureCollection', features }
    return new NextResponse(JSON.stringify(fc), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
        'X-API-Version': 'v4.1-strict',
      },
    })
  } catch {
    return new NextResponse(
      JSON.stringify({ type: 'FeatureCollection', features: mockNodes }),
      { headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  } finally {
    try { await client.end() } catch {}
  }
}
