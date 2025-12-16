import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const bbox = { minLon: 139.73, minLat: 35.65, maxLon: 139.82, maxLat: 35.74 }
const stationOperators = [
  'odpt.Operator:JR-East',
  'odpt.Operator:TokyoMetro',
  'odpt.Operator:Toei',
]
const busOperators = ['odpt.Operator:Toei']

function inBbox(lon: number, lat: number) {
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat
}

function pick<T>(o: unknown, keys: string[]): T | undefined {
  if (!o || typeof o !== 'object') return undefined
  const obj = o as Record<string, unknown>
  for (const k of keys) {
    if (k in obj) return obj[k] as T
  }
  return undefined
}

type Coords = { lon: number; lat: number }
function extractCoords(item: unknown): Coords | undefined {
  const lon =
    pick<number>(item, ['geo:longitude', 'geo:long', 'longitude', 'lon', 'lng']) ??
    (() => {
      const loc = (item as Record<string, unknown>)['location'] as Record<string, unknown> | undefined
      return loc ? pick<number>(loc, ['lon', 'lng', 'longitude']) : undefined
    })() ??
    (() => {
      const loc2 = (item as Record<string, unknown>)['odpt:location'] as Record<string, unknown> | undefined
      return loc2 ? pick<number>(loc2, ['lon', 'lng', 'longitude']) : undefined
    })()
  const lat =
    pick<number>(item, ['geo:latitude', 'geo:lat', 'latitude', 'lat']) ??
    (() => {
      const loc = (item as Record<string, unknown>)['location'] as Record<string, unknown> | undefined
      return loc ? pick<number>(loc, ['lat', 'latitude']) : undefined
    })() ??
    (() => {
      const loc2 = (item as Record<string, unknown>)['odpt:location'] as Record<string, unknown> | undefined
      return loc2 ? pick<number>(loc2, ['lat', 'latitude']) : undefined
    })()
  const lonNum = typeof lon === 'string' ? parseFloat(lon as unknown as string) : lon
  const latNum = typeof lat === 'string' ? parseFloat(lat as unknown as string) : lat
  if (typeof lonNum === 'number' && Number.isFinite(lonNum) && typeof latNum === 'number' && Number.isFinite(latNum)) return { lon: lonNum, lat: latNum }
  return undefined
}

function extractId(item: unknown): string | undefined {
  return pick<string>(item, ['owl:sameAs', '@id', 'sameAs'])
}

function lastSegment(id: string) {
  const parts = id.split('.')
  return parts[parts.length - 1]
}

type Names = { ja: string; en: string; zh: string }
function extractNames(item: unknown, id: string | undefined): Names {
  const ja =
    pick<string>(item, ['dc:title', 'title', 'odpt:stationTitle', 'odpt:poleTitle']) ??
    pick<string>(item, ['name', 'ja'])
  const en =
    pick<string>(item, ['titleEnglish', 'en']) ??
    (id ? lastSegment(id) : ja)
  const zh = ja ?? en
  return { ja: String(ja ?? en ?? ''), en: String(en ?? ''), zh: String(zh ?? '') }
}

async function fetchJson(url: string) {
  let attempt = 0
  let delay = 500
  while (true) {
    const r = await fetch(url)
    if (r.ok) return r.json()
    if (r.status === 429 || r.status === 503) {
      attempt++
      if (attempt > 5) throw new Error(`fetch ${url} ${r.status}`)
      await new Promise((res) => setTimeout(res, delay + Math.floor(Math.random() * 200)))
      delay *= 2
      continue
    }
    throw new Error(`fetch ${url} ${r.status}`)
  }
}

async function fetchStations(token: string) {
  const all: unknown[] = []
  for (const op of stationOperators) {
    const url = `https://api.odpt.org/api/v4/odpt:Station?acl:consumerKey=${encodeURIComponent(
      token
    )}&odpt:operator=${encodeURIComponent(op)}`
    const data = await fetchJson(url)
    all.push(...data)
  }
  return all
}

async function fetchBusStops(token: string) {
  const all: unknown[] = []
  for (const op of busOperators) {
    const url = `https://api.odpt.org/api/v4/odpt:BusstopPole?acl:consumerKey=${encodeURIComponent(
      token
    )}&odpt:operator=${encodeURIComponent(op)}`
    const data = await fetchJson(url)
    all.push(...data)
  }
  return all
}

type NormalizedRow = {
  id: string
  name: Names
  type: 'station' | 'bus_stop'
  source_dataset: 'odpt'
  city_id?: string
  lon: number
  lat: number
  metadata: Record<string, unknown>
}

function normalize(item: unknown, kind: 'station' | 'bus_stop'): NormalizedRow | null {
  const id = extractId(item)
  const coords = extractCoords(item)
  if (!id || !coords) return null
  if (!inBbox(coords.lon, coords.lat)) return null
  const names = extractNames(item, id)
  
  // Extract extra metadata
  const metadata: Record<string, unknown> = {}
  if (kind === 'station') {
    metadata.operator = pick(item, ['odpt:operator'])
    metadata.lines = pick(item, ['odpt:railway'])
  }
  const cityId = assignCityId(coords.lon, coords.lat)
  
  return {
    id: String(id),
    name: names,
    type: kind,
    source_dataset: 'odpt',
    city_id: cityId,
    lon: coords.lon,
    lat: coords.lat,
    metadata
  }
}

async function upsertBatchSupabase(supabase: SupabaseClient, rows: NormalizedRow[]) {
  if (rows.length === 0) return { added: 0, updated: 0 }
  const ids = rows.map((r) => r.id)
  
  // Check existing to count added/updated
  const existingRes = await supabase
    .from('nodes')
    .select('id', { head: false })
    .in('id', ids)
  const existingData = (existingRes.data || []) as { id: string }[]
  const existing = new Set<string>(existingData.map((x) => x.id))
  const addedExpected = rows.filter((r) => !existing.has(r.id)).length
  
  // Upsert basic fields
  const upsertRes = await supabase
    .from('nodes')
    .upsert(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        city_id: r.city_id,
        source_dataset: r.source_dataset,
        metadata: r.metadata,
        // Optional: Assign city_id if logic exists, for now null
      })),
      { onConflict: 'id' }
    )
  if (upsertRes.error) throw upsertRes.error
  
  // Update geometry via RPC
  const geomItems = rows.map((r) => ({ id: r.id, lon: r.lon, lat: r.lat }))
  const geomRes = await supabase.rpc('set_node_location_bulk', { p_items: geomItems })
  if (geomRes.error) throw geomRes.error
  
  const updated = rows.length - addedExpected
  return { added: addedExpected, updated }
}

// City polygons/bounds for粗略歸屬（台東區/千代田區/中央區）
type Polygon = { id: string; points: [number, number][] }
const cityPolygons: Polygon[] = [
  { id: 'tokyo_taito', points: [[139.776, 35.712], [139.806, 35.712], [139.806, 35.739], [139.776, 35.739]] },
  { id: 'tokyo_chiyoda', points: [[139.743, 35.680], [139.774, 35.680], [139.774, 35.705], [139.743, 35.705]] },
  { id: 'tokyo_chuo', points: [[139.760, 35.660], [139.790, 35.660], [139.790, 35.690], [139.760, 35.690]] },
]

function pointInPolygon(lon: number, lat: number, polygon: [number, number][]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function assignCityId(lon: number, lat: number): string | undefined {
  for (const poly of cityPolygons) {
    if (pointInPolygon(lon, lat, poly.points)) return poly.id
  }
  return undefined
}

async function main() {
  function parseEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) return
    const txt = fs.readFileSync(filePath, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const mEq = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      const mColon = line.match(/^\s*([A-Z0-9_]+)\s*:\s*(.*)\s*$/)
      const m = mEq || mColon
      if (m) {
        const k = m[1]
        let v = m[2]
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
        if (!(k in process.env) || !process.env[k]) process.env[k] = v
      }
    }
  }
  parseEnvFile(path.resolve(process.cwd(), '.env.local'))
  parseEnvFile(path.resolve(process.cwd(), '..', '.env.local'))
  
  const token = process.env.ODPT_API_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!token) {
    // try to find from file content if needed, but parseEnvFile should handle it
  }
  
  if (!token) throw new Error('ODPT_API_TOKEN missing')
  
  if (!supabaseUrl || !supabaseKey) {
    const stationsRaw = await fetchStations(token)
    const busRaw = await fetchBusStops(token)
    const stations = stationsRaw.map((x) => normalize(x, 'station')).filter(Boolean) as NormalizedRow[]
    const busstops = busRaw.map((x) => normalize(x, 'bus_stop')).filter(Boolean) as NormalizedRow[]
    console.log(
      JSON.stringify({
        stations_fetched: stationsRaw.length,
        busstops_fetched: busRaw.length,
        within_bbox: stations.length + busstops.length,
        upserted_added: 0,
        upserted_updated: 0,
        total_odpt_nodes: null,
        note: 'Supabase env missing; skipped upsert',
      })
    )
    return
  }
  
  try {
    const stationsRaw = await fetchStations(token)
    const busRaw = await fetchBusStops(token)
    const stations = stationsRaw
      .map((x) => normalize(x, 'station'))
      .filter(Boolean) as NormalizedRow[]
    const busstops = busRaw
      .map((x) => normalize(x, 'bus_stop'))
      .filter(Boolean) as NormalizedRow[]
    const all = [...stations, ...busstops]
    
    let added = 0
    let updated = 0
    const size = 300
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    for (let i = 0; i < all.length; i += size) {
      const batch = all.slice(i, i + size)
      const r = await upsertBatchSupabase(supabase, batch)
      added += r.added
      updated += r.updated
    }
    
    const totalSel = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
    const total = totalSel.count || 0
    const cityTaito = await supabase.from('nodes').select('*', { count: 'exact', head: true }).eq('city_id', 'tokyo_taito')
    const cityChiyoda = await supabase.from('nodes').select('*', { count: 'exact', head: true }).eq('city_id', 'tokyo_chiyoda')
    const cityChuo = await supabase.from('nodes').select('*', { count: 'exact', head: true }).eq('city_id', 'tokyo_chuo')
    const cityAssigned = (cityTaito.count || 0) + (cityChiyoda.count || 0) + (cityChuo.count || 0)
    
    console.log(
      JSON.stringify({
        stations_fetched: stationsRaw.length,
        busstops_fetched: busRaw.length,
        within_bbox: all.length,
        upserted_added: added,
        upserted_updated: updated,
        total_odpt_nodes: total,
        city_assigned_total: cityAssigned,
        city_breakdown: {
          tokyo_taito: cityTaito.count || 0,
          tokyo_chiyoda: cityChiyoda.count || 0,
          tokyo_chuo: cityChuo.count || 0,
        },
      })
    )
  } catch (e) {
    throw e
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
