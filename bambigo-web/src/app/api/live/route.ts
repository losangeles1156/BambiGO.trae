import { NextResponse } from 'next/server'
import { Client } from 'pg'
import OdptClient from '@/lib/odptClient'

// Per-IP rate limiting buckets
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

// Data models (API payload types)
export type LiveTransit = {
  status: 'normal' | 'delayed' | 'suspended' | 'unknown'
  delay_minutes?: number
  events?: Array<{ railway?: string; section?: string; status?: string; delay?: number; text?: string }>
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
  const client = new Client({ 
    connectionString: conn,
    connectionTimeoutMillis: 5000, // 5s timeout
  })
  try {
    await client.connect()
  } catch (e) {
    console.error('[LiveAPI][DB_CONNECTION_ERROR] Failed to connect to PostgreSQL:', e)
    // Return partial response instead of 500 if DB is down but other logic (ODPT) might work
    const payload: LiveResponse = {
      node_id: nodeId,
      bbox,
      transit: { status: 'unknown', delay_minutes: 0 },
      mobility: { stations: [] },
      updated_at: new Date().toISOString(),
    }
    return new NextResponse(JSON.stringify(payload), {
      status: 200, // Graceful degradation
      headers: {
        'Content-Type': 'application/json',
        'X-API-Warn': 'DB_UNAVAILABLE',
        'X-API-Version': 'v4.1-strict',
      },
    })
  }

  try {
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

    // Helpers: label mapping and bbox filter
    const labelFromRailway = (id?: string) => {
      if (!id) return undefined
      const after = String(id).split(':').pop() || String(id)
      const parts = after.split('.')
      const op = parts[0] || ''
      const line = parts[1] || after
      const map: Record<string, Record<string, string>> = {
        TokyoMetro: {
          Marunouchi: '東京メトロ 丸ノ内線',
          Ginza: '東京メトロ 銀座線',
          Hibiya: '東京メトロ 日比谷線',
          Tozai: '東京メトロ 東西線',
          Chiyoda: '東京メトロ 千代田線',
          Yurakucho: '東京メトロ 有楽町線',
          Namboku: '東京メトロ 南北線',
          Fukutoshin: '東京メトロ 副都心線',
          Hanzomon: '東京メトロ 半蔵門線',
        },
        Toei: {
          Asakusa: '都営 浅草線',
          Shinjuku: '都営 新宿線',
          Mita: '都営 三田線',
          Oedo: '都営 大江戸線',
        },
        'JR-East': {
          Yamanote: 'JR東日本 山手線',
          KeihinTohoku: 'JR東日本 京浜東北線',
          Chuo: 'JR東日本 中央線',
          Sobu: 'JR東日本 総武線',
          Keiyo: 'JR東日本 京葉線',
          Saikyo: 'JR東日本 埼京線',
          ShonanShinjuku: 'JR東日本 湘南新宿ライン',
          Yokosuka: 'JR東日本 横須賀線',
          Tokaido: 'JR東日本 東海道線',
          Joban: 'JR東日本 常磐線',
          Utsunomiya: 'JR東日本 宇都宮線',
          Takasaki: 'JR東日本 高崎線',
        },
        Keio: {
          Keio: '京王線',
          KeioNew: '京王新線',
          Sagamihara: '京王相模原線',
          Inokashira: '京王井の頭線',
        },
        Odakyu: {
          OdakyuOdawara: '小田急 小田原線',
          OdakyuTama: '小田急 多摩線',
          OdakyuEnoshima: '小田急 江ノ島線',
        },
        Tokyu: {
          DenEnToshi: '東急 田園都市線',
          Toyoko: '東急 東横線',
          Meguro: '東急 目黒線',
          Oimachi: '東急 大井町線',
          Ikegami: '東急 池上線',
          Tamagawa: '東急 多摩川線',
          Setagaya: '東急 世田谷線',
        },
        Seibu: {
          SeibuIkebukuro: '西武 池袋線',
          SeibuShinjuku: '西武 新宿線',
        },
        Tobu: {
          TobuSkytree: '東武 スカイツリーライン',
          TobuTojo: '東武 東上線',
        },
        Keisei: {
          KeiseiMain: '京成 本線',
          Oshiage: '京成 押上線',
          NaritaSkyAccess: '京成 成田スカイアクセス線',
        },
        Keikyu: {
          KeikyuMain: '京急 本線',
          Airport: '京急 空港線',
        },
        TsukubaExpress: {
          TsukubaExpress: 'つくばエクスプレス',
        },
        Yurikamome: {
          Yurikamome: 'ゆりかもめ',
        },
        Rinkai: {
          Rinkai: 'りんかい線',
        },
      }
      return map[op]?.[line] || line
    }

    const withinBbox = (lon: number, lat: number, b: [number, number, number, number] | null) => {
      if (!b) return true
      return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]
    }

    const now = Date.now()
    const ttlMs = 45000
    type UnknownRec = Record<string, unknown>
    type CacheBucket = { t: number; data: UnknownRec[] }
    const g = globalThis as { __odptCache?: { infos: CacheBucket; trains: CacheBucket; stations: CacheBucket } }
    g.__odptCache = g.__odptCache || { infos: { t: 0, data: [] }, trains: { t: 0, data: [] }, stations: { t: 0, data: [] } }
    const cache = g.__odptCache!

    let delayMinutes = 0
    const transitEvents: Array<{ railway?: string; section?: string; status?: string; delay?: number; text?: string }> = []
    if (transitStatus === 'normal') {
      try {
        const odpt = new OdptClient({ cacheTtlSec: 60, throttleMs: 50 })
        const infos = (now - cache.infos.t < ttlMs) ? cache.infos.data : await odpt.trainInformationAll()
        if (infos !== cache.infos.data) { cache.infos = { t: now, data: infos as UnknownRec[] } }
        const items = Array.isArray(infos) ? (infos as UnknownRec[]) : []
        let suspended = false
        let maxDelay = 0
        for (const it of items) {
          const op = String(it['odpt:operator'] || '')
          const txt = String(it['odpt:trainInformationText'] || '')
          const stat = String(it['odpt:trainInformationStatus'] || '')
          const d = Number(it['odpt:delay'] || 0)
          const railway = String(it['odpt:railway'] || '')
          const isTarget = op.includes('TokyoMetro') || op.includes('Toei') || op.includes('JR')
          if (!isTarget) continue
          if (stat && /運休|suspend/i.test(stat)) suspended = true
          if (!Number.isNaN(d)) maxDelay = Math.max(maxDelay, d)
          if (!d && txt && /(延誤|遅延|delay)/i.test(txt)) maxDelay = Math.max(maxDelay, 5)
          transitEvents.push({ railway, section: labelFromRailway(railway), status: stat || undefined, delay: Number.isFinite(d) ? d : undefined, text: txt || undefined })
        }
        if (suspended) transitStatus = 'suspended'
        else if (maxDelay > 0) {
          transitStatus = 'delayed'
          delayMinutes = maxDelay
        }
      } catch {}
    }

    try {
      const odpt = new OdptClient({ cacheTtlSec: 120, throttleMs: 50 })
      const ops = ['odpt.Operator:TokyoMetro', 'odpt.Operator:Toei', 'odpt.Operator:JR-East']
      const stationsRaw = (now - cache.stations.t < ttlMs) ? cache.stations.data : await odpt.stationsByOperator(ops)
      if (stationsRaw !== cache.stations.data) { cache.stations = { t: now, data: stationsRaw as UnknownRec[] } }
      const sMap = new Map<string, { lat: number; lon: number; name?: string }>()
      for (const s of (stationsRaw as UnknownRec[])) {
        const id = String(s['owl:sameAs'] || s['@id'] || '')
        const latRaw = (s['geo:lat'] ?? s['geo:latitude'] ?? 0) as unknown
        const lonRaw = (s['geo:long'] ?? s['geo:longitude'] ?? 0) as unknown
        const lat = Number(typeof latRaw === 'number' || typeof latRaw === 'string' ? latRaw : 0)
        const lon = Number(typeof lonRaw === 'number' || typeof lonRaw === 'string' ? lonRaw : 0)
        const titleRaw = s['odpt:stationTitle'] as unknown
        const title = (titleRaw && typeof titleRaw === 'object') ? (titleRaw as { ja?: string; en?: string }) : undefined
        const name = (title && (title.ja || title.en)) ? String(title.ja || title.en) : undefined
        if (id && Number.isFinite(lat) && Number.isFinite(lon)) sMap.set(id, { lat, lon, name })
      }

      const trainsRaw = (now - cache.trains.t < ttlMs) ? cache.trains.data : await odpt.trainsByOperator(ops)
      if (trainsRaw !== cache.trains.data) { cache.trains = { t: now, data: trainsRaw as UnknownRec[] } }
      let added = 0
      for (const t of (trainsRaw as UnknownRec[])) {
        const fromId = String(t['odpt:fromStation'] || '')
        const toId = String(t['odpt:toStation'] || '')
        if (!fromId || !toId) continue
        const a = sMap.get(fromId)
        const b = sMap.get(toId)
        if (!a || !b) continue
        const delay = Number(t['odpt:delay'] || 0)
        const railway = String(t['odpt:railway'] || '')
        const section = `${(a.name || fromId.split(':').pop() || '')} → ${(b.name || toId.split(':').pop() || '')}`
        if (bbox && !(withinBbox(a.lon, a.lat, bbox) || withinBbox(b.lon, b.lat, bbox))) continue
        transitEvents.push({ railway, section, delay: Number.isFinite(delay) ? delay : undefined, text: labelFromRailway(railway) })
        added++
        if (added >= 4) break
      }
    } catch {}

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
      transit: { status: transitStatus, delay_minutes: delayMinutes, events: transitEvents.slice(0, 5) },
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
  } catch (e) {
    console.error('[LiveAPI] Error:', e)
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
