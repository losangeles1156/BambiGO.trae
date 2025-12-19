import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

function parseWKBPoint(hex: string): [number, number] | null {
  try {
    // Basic EWKB/WKB parser for Point
    const buffer = Buffer.from(hex, 'hex')
    if (buffer.length < 21) return null // Min length for Point (1+4+16)
    
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const littleEndian = view.getUint8(0) === 1
    // const type = view.getUint32(1, littleEndian) 
    // We assume it's a Point (type 1 or 0x20000001).
    // X is at 9, Y at 17 for standard EWKB Point with SRID present?
    // Sample: 01 01000020 E6100000 ...
    // Byte 0: 01 (LE)
    // Byte 1-4: 01000020 (Type | SRID flag)
    // Byte 5-8: E6100000 (SRID 4326)
    // Byte 9-16: X
    // Byte 17-24: Y
    
    // Check if SRID flag is set (0x20000000)
    const type = view.getUint32(1, littleEndian)
    let offset = 5
    if ((type & 0x20000000) !== 0) {
      offset += 4 // Skip SRID
    }
    
    const x = view.getFloat64(offset, littleEndian)
    const y = view.getFloat64(offset + 8, littleEndian)
    return [x, y]
  } catch (e) {
    console.error('WKB Parse error:', e)
    return null
  }
}

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

  let limit = 2000 // Default higher limit to cover bbox
  if (limitParam !== null) {
    const n = Number(limitParam)
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(10000, Math.floor(n))
    }
  }

  const allowedTypes = new Set(['station', 'bus_stop'])
  const typeFilter = typeParam || null
  if (typeFilter && !allowedTypes.has(typeFilter)) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'type must be one of station,bus_stop', details: { type: typeFilter } } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }

  try {
    let features: Array<{
      type: 'Feature'
      geometry: { type: 'Point'; coordinates: [number, number] }
      properties: Record<string, unknown>
    }> = []

    const canUseAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    if (canUseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.rpc('get_nodes_in_bbox', {
          min_lon: bbox.minLon,
          min_lat: bbox.minLat,
          max_lon: bbox.maxLon,
          max_lat: bbox.maxLat,
          p_type: typeFilter || null,
          p_limit: limit,
        })
        if (error) throw error
        // RPC returns an array of GeoJSON Features already
        if (Array.isArray(data)) {
          features = data as any
        }
      } catch (e) {
        console.warn('RPC get_nodes_in_bbox unavailable, falling back:', e)
      }
    }

    if (features.length === 0) {
      let query = supabase.from('nodes').select('id, name, type, location, metadata, external_links')
      if (typeFilter) query = query.eq('type', typeFilter)
      query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      features = (data || []).reduce((acc: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, unknown> }[], node: any) => {
        if (!node.location) return acc
        const coords = parseWKBPoint(node.location)
        if (!coords) return acc
        const [lon, lat] = coords
        if (lon < bbox.minLon || lon > bbox.maxLon || lat < bbox.minLat || lat > bbox.maxLat) return acc
        acc.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords },
          properties: {
            id: node.id,
            name: node.name,
            type: node.type,
            supply_tags: node.type === 'station' ? ['has_train'] : node.type === 'bus_stop' ? ['has_bus'] : [],
            suitability_tags: [],
            external_links: node.external_links,
            metadata: node.metadata,
          },
        })
        return acc
      }, [])
    }

    return new NextResponse(JSON.stringify({ type: 'FeatureCollection', features }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
        'X-API-Version': 'v4.1-strict',
      },
    })

  } catch (err) {
    console.error('Nodes API Error:', err)
    return new NextResponse(
      JSON.stringify({ type: 'FeatureCollection', features: mockNodes }),
      { headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }
}
