import { NextResponse } from 'next/server'
import { withMonitor } from '../../../lib/monitor'
import { L3ServiceFacility, L3Category } from '../../../types/tagging'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  // L3 Compliance
  l3?: L3ServiceFacility
}

export type FacilitiesResponse = {
  items: FacilityItem[]
}

function parseWKBPoint(hex: string): [number, number] | null {
  try {
    const buffer = Buffer.from(hex, 'hex')
    if (buffer.length < 21) return null
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const littleEndian = view.getUint8(0) === 1
    const type = view.getUint32(1, littleEndian)
    let offset = 5
    if ((type & 0x20000000) !== 0) offset += 4

    if (offset + 16 > buffer.length) {
      console.error('[FacilitiesAPI][WKB_ERROR] Buffer too short for coordinates', { length: buffer.length, required: offset + 16 })
      return null
    }

    const x = view.getFloat64(offset, littleEndian)
    const y = view.getFloat64(offset + 8, littleEndian)
    return [x, y]
  } catch (e) {
    console.error('[FacilitiesAPI][WKB_PARSE_FATAL] Unexpected error:', e)
    return null
  }
}

const defaultBbox = { minLon: 139.73, minLat: 35.65, maxLon: 139.82, maxLat: 35.74 }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = defaultBbox

const mockFacilities: Record<string, FacilityItem[]> = {
  'mock-ueno': [
    {
      id: 'f-ueno-1', node_id: 'mock-ueno', city_id: null, type: 'toilet', name: { en: 'East Exit Toilet', zh: '東口洗手間' },
      has_wheelchair_access: true, has_baby_care: true, is_free: true, is_24h: true, current_status: 'available',
      attributes: { cleanliness: 'high' }
    }
  ],
  'mock-tokyo': [
    {
      id: 'f-tokyo-1', node_id: 'mock-tokyo', city_id: null, type: 'shop', name: { en: 'Souvenir Shop', zh: '伴手禮店' },
      has_wheelchair_access: true, has_baby_care: false, is_free: false, is_24h: false, current_status: 'open',
      attributes: { category: 'food' }
    }
  ]
}

export const GET = withMonitor(handler, 'FacilitiesAPI')

async function handler(req: Request) {
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
  const bboxParam = url.searchParams.get('bbox')
  const typeParam = url.searchParams.get('type')
  const suitTag = url.searchParams.get('suitability')
  const minConfidenceParam = url.searchParams.get('min_confidence')
  const limitParam = url.searchParams.get('limit')

  let bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null = null
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

  if (!nodeId && !bbox) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'MISSING_PARAMETER', message: 'node_id or bbox is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }

  if (nodeId && (nodeId === 'mock-ueno' || nodeId === 'mock-tokyo')) {
    const items = mockFacilities[nodeId] || []
    return new NextResponse(JSON.stringify({ items }), {
      headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' }
    })
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

  try {
    let nodeIds: string[] = []
    if (nodeId) {
      nodeIds = [nodeId]
    } else if (bbox) {
      const canUseAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY
      if (canUseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.rpc('get_nodes_in_bbox', {
            min_lon: bbox.minLon,
            min_lat: bbox.minLat,
            max_lon: bbox.maxLon,
            max_lat: bbox.maxLat,
            p_type: null,
            p_limit: 5000,
          })
          if (error) throw error
          nodeIds = (data || []).map((n: { id: string | number }) => String(n.id))
        } catch {}
      }
      if (nodeIds.length === 0) {
        const { data, error } = await supabase
          .from('nodes')
          .select('id, location')
          .limit(10000)
        if (!error && Array.isArray(data)) {
          nodeIds = data
            .map((n: { id: string | number; location?: string }) => {
              const coords = n.location ? parseWKBPoint(n.location) : null
              if (!coords) return null
              const [lon, lat] = coords
              if (lon < bbox!.minLon || lon > bbox!.maxLon || lat < bbox!.minLat || lat > bbox!.maxLat) return null
              return String(n.id)
            })
            .filter(Boolean) as string[]
        }
      }
    }

    if (nodeIds.length === 0) {
      const empty: FacilitiesResponse = { items: [] }
      return new NextResponse(JSON.stringify(empty), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=120',
          'X-API-Version': 'v4.1-strict',
        },
      })
    }

    let facQuery = supabase
      .from('facilities')
      .select('*')
      .in('node_id', nodeIds)
    if (typeParam) facQuery = facQuery.eq('type', typeParam)
    if (limit) facQuery = facQuery.limit(limit)
    const { data: facRows, error: facErr } = await facQuery
    if (facErr) throw facErr

    const suitability: Record<string, { tag: string; confidence: number }[]> = {}
    if (suitTag) {
      const ids = (facRows || []).map((r: { id: string | number }) => String(r.id)).filter((x: string) => x.length > 0)
      const { data: suitRows, error: suitErr } = await supabase
        .from('facility_suitability')
        .select('facility_id, tag, confidence')
        .in('facility_id', ids)
      if (!suitErr && Array.isArray(suitRows)) {
        for (const r of suitRows as Array<{ facility_id: string | number; tag: string; confidence: number }>) {
          if (minConfidence > 0 && Number(r.confidence) < minConfidence) continue
          const arr = (suitability[String(r.facility_id)] ||= [])
          arr.push({ tag: String(r.tag), confidence: Number(r.confidence) })
        }
      }
    }

    const items: FacilityItem[] = (facRows || []).map((row: Record<string, unknown>) => {
      // Map to L3
      const typeMap: Record<string, L3Category> = {
        'toilet': 'toilet',
        'restroom': 'toilet',
        'charging': 'charging',
        'wifi': 'wifi',
        'locker': 'locker',
        'coin_locker': 'locker',
        'elevator': 'accessibility',
        'escalator': 'accessibility',
        'ramp': 'accessibility',
        'bench': 'rest_area',
        'smoking_area': 'rest_area'
      }
      const normalizedType = String(row.type || '').toLowerCase() || 'other'
      const category: L3Category = typeMap[normalizedType] || 'other'

      const l3: L3ServiceFacility = {
        id: String(row.id),
        nodeId: (row.node_id as string) || '',
        category,
        subCategory: normalizedType,
        location: {
          floor: typeof row.floor === 'string' ? row.floor : undefined,
          direction: typeof row.direction === 'string' ? row.direction : undefined,
        },
        provider: {
          type: 'public', // Default
        },
        attributes: {
          ...(row.attributes as Record<string, unknown> || {}),
          is_free: row.is_free as boolean,
          is_24h: row.is_24h as boolean,
          has_wheelchair_access: row.has_wheelchair_access as boolean,
          has_baby_care: row.has_baby_care as boolean,
          booking_url: row.booking_url as string | null
        },
        openingHours: (row.is_24h as boolean) ? '24 Hours' : undefined,
        updatedAt: (row.status_updated_at as string) || undefined,
        source: 'official'
      }

      return {
        id: String(row.id),
        node_id: row.node_id as string | null,
        city_id: row.city_id as string | null,
        type: String(row.type || ''),
        name: (row.name as { ja?: string; en?: string; zh?: string } | undefined) || undefined,
        distance_meters: row.distance_meters as number | null,
        direction: typeof row.direction === 'string' ? (row.direction as string) : undefined,
        floor: typeof row.floor === 'string' ? (row.floor as string) : undefined,
        has_wheelchair_access: row.has_wheelchair_access as boolean,
        has_baby_care: row.has_baby_care as boolean,
        is_free: row.is_free as boolean,
        is_24h: row.is_24h as boolean,
        current_status: String(row.current_status || ''),
        status_updated_at: row.status_updated_at as string | null,
        attributes: row.attributes as unknown,
        booking_url: row.booking_url as string | null,
        suitability_tags: suitability[String(row.id)] || [],
        l3
      }
    })

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
  }
}
