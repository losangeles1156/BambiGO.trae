import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Client as PgClient } from 'pg'

const bbox = { minLon: 139.73, minLat: 35.65, maxLon: 139.82, maxLat: 35.74 }

const cityFilter = 'tokyo_taito'
const onlyStations = true
const mergeCoConstructed = true
const includeSpokes = false
const mergeRadiusM = 300

const stationOperators = ['odpt.Operator:TokyoMetro']

const barrierFreeOperators = onlyStations
  ? []
  : [
      'odpt.Operator:TokyoMetro',
      'odpt.Operator:Toei',
    ]

function inBbox(lon: number, lat: number) {
  return !!assignCityId(lon, lat)
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
  console.log('Fetching stations for operators:', stationOperators)
  for (const op of stationOperators) {
    const url = `https://api.odpt.org/api/v4/odpt:Station?acl:consumerKey=${encodeURIComponent(
      token
    )}&odpt:operator=${encodeURIComponent(op)}`
    try {
      console.log(`Fetching stations for ${op}...`)
      const data = await fetchJson(url)
      console.log(`  Found ${data.length} stations for ${op}`)
      all.push(...data)
    } catch (e) {
      console.warn(`Failed to fetch stations for operator ${op}:`, e)
    }
  }
  return all
}

async function fetchTrainInformation(token: string) {
  const operators = ['odpt.Operator:TokyoMetro', 'odpt.Operator:Toei', 'odpt.Operator:JR-East']
  const all: unknown[] = []
  for (const op of operators) {
    const url = `https://api.odpt.org/api/v4/odpt:TrainInformation?acl:consumerKey=${encodeURIComponent(
      token
    )}&odpt:operator=${encodeURIComponent(op)}`
    try {
      const data = await fetchJson(url)
      all.push(...data)
    } catch {
      continue
    }
  }
  return all
}

async function fetchBarrierFree(token: string) {
  const all: unknown[] = []
  for (const op of barrierFreeOperators) {
    const url1 = `https://api.odpt.org/api/v4/odpt:BarrierFreeFacility?acl:consumerKey=${encodeURIComponent(token)}&odpt:operator=${encodeURIComponent(op)}`
    try {
      const data = await fetchJson(url1)
      all.push(...data)
      continue
    } catch {}
    const url2 = `https://api.odpt.org/api/v4/odpt:StationFacility?acl:consumerKey=${encodeURIComponent(token)}&odpt:operator=${encodeURIComponent(op)}`
    try {
      const data2 = await fetchJson(url2)
      all.push(...data2)
    } catch {}
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
  line_ids?: string[]
  is_hub?: boolean
  parent_hub_id?: string | null
}

type HubAssignment = {
  id: string
  is_hub: boolean
  parent_hub_id: string | null
}

function metersBetween(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

function stationNameKey(row: NormalizedRow) {
  let name = (row.name?.ja || row.name?.en || row.name?.zh || '').trim()
  // Remove common suffixes and operator prefixes to group co-constructed stations
  name = name.replace(/(駅|停車場|停留所)$/, '')
  name = name.replace(/^(JR|京成|小田急|京王|西武|東武|つくばエクスプレス|東京メトロ|都営)/, '')
  
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[・･\-‐‑–—_()（）\[\]]/g, '')
}

type FacilityRow = {
  node_id: string
  city_id?: string
  type: string
  name?: { ja?: string; en?: string; zh?: string }
  has_wheelchair_access: boolean
  has_baby_care: boolean
  is_free: boolean
  is_24h: boolean
  current_status: string
  attributes?: Record<string, unknown>
  source_dataset: 'odpt'
}

type OdptEntityRow = {
  entity_type: string
  same_as: string
  operator?: string
  railway?: string
  dc_date?: string
  payload: unknown
  source_url?: string
}

type OdptTrainInformationRow = {
  content_hash: string
  operator: string
  railway?: string
  status?: string
  information_text: Record<string, unknown>
  dc_date?: string
  raw: unknown
  source_url?: string
}

function ewktPoint(lon: number, lat: number) {
  return `SRID=4326;POINT(${lon} ${lat})`
}

async function safeUpsert(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (!rows.length) return true
  const res = await supabase.from(table).upsert(rows, { onConflict })
  if (!res.error) return true
  const msg = res.error.message || ''
  if (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('Could not find the table') ||
    msg.includes('schema cache')
  ) {
    return false
  }
  throw res.error
}

async function upsertOdptEntitiesSupabase(
  supabase: SupabaseClient,
  entityType: string,
  items: unknown[],
  sourceUrl: string
) {
  const rows: OdptEntityRow[] = []
  for (const item of items) {
    const sameAs = extractId(item)
    if (!sameAs) continue
    rows.push({
      entity_type: entityType,
      same_as: String(sameAs),
      operator: pick<string>(item, ['odpt:operator']),
      railway: pick<string>(item, ['odpt:railway']),
      dc_date: pick<string>(item, ['dc:date']),
      payload: item,
      source_url: sourceUrl,
    })
  }
  return safeUpsert(supabase, 'odpt_entities', rows as unknown as Record<string, unknown>[], 'entity_type,same_as')
}

async function upsertOdptStationsSupabase(supabase: SupabaseClient, items: unknown[]) {
  const rows: Record<string, unknown>[] = []
  for (const item of items) {
    const sameAs = extractId(item)
    if (!sameAs) continue
    const coords = extractCoords(item)
    const title = pick<string>(item, ['dc:title', 'odpt:stationTitle', 'title'])
    rows.push({
      same_as: String(sameAs),
      operator: pick<string>(item, ['odpt:operator']),
      railway: pick<string>(item, ['odpt:railway']),
      station_code: pick<string>(item, ['odpt:stationCode']),
      title: title ? { ja: String(title) } : { ja: lastSegment(String(sameAs)) },
      location: coords ? ewktPoint(coords.lon, coords.lat) : null,
      dc_date: pick<string>(item, ['dc:date']),
      raw: item,
    })
  }
  return safeUpsert(supabase, 'odpt_stations', rows, 'same_as')
}

async function upsertOdptStationFacilitiesSupabase(supabase: SupabaseClient, items: unknown[]) {
  const rows: Record<string, unknown>[] = []
  for (const item of items) {
    const sameAs = extractId(item)
    if (!sameAs) continue
    const coords = extractCoords(item)
    const title = pick<string>(item, ['dc:title', 'title'])
    rows.push({
      same_as: String(sameAs),
      operator: pick<string>(item, ['odpt:operator']),
      station: pick<string>(item, ['odpt:station']),
      facility_type: pick<string>(item, ['odpt:facilityType', 'odpt:classification']),
      title: title ? { ja: String(title) } : null,
      location: coords ? ewktPoint(coords.lon, coords.lat) : null,
      dc_date: pick<string>(item, ['dc:date']),
      raw: item,
    })
  }
  return safeUpsert(supabase, 'odpt_station_facilities', rows, 'same_as')
}

async function upsertOdptTrainInformationSupabase(supabase: SupabaseClient, items: unknown[], sourceUrl: string) {
  const rows: OdptTrainInformationRow[] = []
  for (const item of items) {
    const operator = pick<string>(item, ['odpt:operator'])
    if (!operator) continue
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex')
    const infoText = pick<unknown>(item, ['odpt:trainInformationText', 'odpt:trainInformation'])
    rows.push({
      content_hash: contentHash,
      operator: String(operator),
      railway: pick<string>(item, ['odpt:railway']),
      status: pick<string>(item, ['odpt:trainInformationStatus', 'odpt:trainInformationStatusText']),
      information_text: typeof infoText === 'string' ? { ja: infoText } : (infoText && typeof infoText === 'object' ? (infoText as Record<string, unknown>) : {}),
      dc_date: pick<string>(item, ['dc:date']),
      raw: item,
      source_url: sourceUrl,
    })
  }
  return safeUpsert(supabase, 'odpt_train_information', rows as unknown as Record<string, unknown>[], 'content_hash')
}

function normalize(item: unknown, kind: 'station' | 'bus_stop'): NormalizedRow | null {
  const id = extractId(item)
  const coords = extractCoords(item)
  if (!id) return null
  
  // For railway stations, we allow missing coordinates initially to enable name-based merging
  if (kind === 'bus_stop' && !coords) return null
  
  const lon = coords?.lon ?? 0
  const lat = coords?.lat ?? 0

  if (lon !== 0 && lat !== 0 && !inBbox(lon, lat)) return null

  const names = extractNames(item, id)
  
  // Extract extra metadata
  const metadata: Record<string, unknown> = {}
  if (kind === 'station') {
    metadata.operator = pick(item, ['odpt:operator'])
    metadata.lines = pick(item, ['odpt:railway'])
  }
  const cityId = (lon !== 0 && lat !== 0) ? assignCityId(lon, lat) : undefined

  const railway = kind === 'station' ? pick<string>(item, ['odpt:railway']) : undefined
  
  return {
    id: String(id),
    name: names,
    type: kind,
    source_dataset: 'odpt',
    city_id: cityId,
    lon: lon,
    lat: lat,
    metadata,
    line_ids: railway ? [String(railway)] : undefined,
  }
}

function applyCityFilter(rows: NormalizedRow[]) {
  if (!cityFilter) return rows
  return rows.filter((r) => r.city_id === cityFilter)
}

function applyCoConstructedMerge(rows: NormalizedRow[]) {
  if (!mergeCoConstructed) return { rows, assignments: null as HubAssignment[] | null }

  const assignments = new Map<string, HubAssignment>()
  const byName = new Map<string, NormalizedRow[]>()

  // 1. Group by name
  for (const r of rows) {
    assignments.set(r.id, { id: r.id, is_hub: false, parent_hub_id: null })
    if (r.type !== 'station') continue
    const key = stationNameKey(r)
    if (!key) continue
    const arr = byName.get(key) || []
    arr.push(r)
    byName.set(key, arr)
  }

  const hubMeta = new Map<string, { ids: string[]; lineIds: string[]; lon: number; lat: number; cityId?: string }>()

  // 2. Process groups to fix coordinates and find hubs
  for (const group of byName.values()) {
    // Find representative coordinates for this name group
    const coordsRich = group.filter(r => r.lon !== 0 && r.lat !== 0)
    let groupLon = 0
    let groupLat = 0
    let groupCityId: string | undefined

    if (coordsRich.length > 0) {
      // Average coordinates of stations that have them
      groupLon = coordsRich.reduce((sum, r) => sum + r.lon, 0) / coordsRich.length
      groupLat = coordsRich.reduce((sum, r) => sum + r.lat, 0) / coordsRich.length
      groupCityId = assignCityId(groupLon, groupLat)
    }

    // Apply group coordinates to members that lack them
    for (const r of group) {
      if (r.lon === 0 || r.lat === 0) {
        r.lon = groupLon
        r.lat = groupLat
        r.city_id = groupCityId
      }
    }

    if (group.length <= 1) continue

    // For same-name stations, if they all have the same propagated coordinates, 
    // they should almost certainly be merged.
    const sorted = group.slice().sort((a, b) => a.lon - b.lon)
    type Cluster = { rows: NormalizedRow[]; center: { lon: number; lat: number } }
    const clusters: Cluster[] = []
    
    for (const r of sorted) {
      let placed = false
      for (const c of clusters) {
        // If they are within 300m OR they share the exact same propagated coordinates
        const dist = (c.center.lon === r.lon && c.center.lat === r.lat) ? 0 : metersBetween(c.center, r)
        if (dist <= mergeRadiusM) {
          c.rows.push(r)
          const n = c.rows.length
          c.center = {
            lon: (c.center.lon * (n - 1) + r.lon) / n,
            lat: (c.center.lat * (n - 1) + r.lat) / n,
          }
          placed = true
          break
        }
      }
      if (!placed) clusters.push({ rows: [r], center: { lon: r.lon, lat: r.lat } })
    }

    for (const c of clusters) {
      if (c.rows.length <= 1) continue
      const hubCandidate = c.rows
        .slice()
        .sort((a, b) => {
          // Priority: TokyoMetro > Toei > JR-East > Keisei
          const opScore = (op: string) => 
            op.includes('TokyoMetro') ? 0 
            : op.includes('Toei') ? 1 
            : op.includes('JR-East') ? 2 
            : 3
          const aScore = opScore(String(a.metadata?.operator || ''))
          const bScore = opScore(String(b.metadata?.operator || ''))
          if (aScore !== bScore) return aScore - bScore
          return a.id.localeCompare(b.id)
        })[0]

      const ids = c.rows.map((x) => x.id).slice().sort()
      const hubId = hubCandidate.id
      assignments.set(hubId, { id: hubId, is_hub: true, parent_hub_id: null })
      for (const spokeId of ids) {
        if (spokeId === hubId) continue
        assignments.set(spokeId, { id: spokeId, is_hub: false, parent_hub_id: hubId })
      }

      const lineIds = Array.from(
        new Set(c.rows.flatMap((x) => (Array.isArray(x.line_ids) ? x.line_ids : [])))
      ).sort()
      
      const clusterCityId = assignCityId(c.center.lon, c.center.lat)
      hubMeta.set(hubId, {
        ids,
        lineIds,
        lon: c.center.lon,
        lat: c.center.lat,
        cityId: clusterCityId
      })
    }
  }

  // 3. Apply hub updates and filter by city
  const nextRows = rows
    .map((r) => {
      const a = assignments.get(r.id)
      const extra = hubMeta.get(r.id)
      
      const updatedRow = { ...r }
      if (a) {
        updatedRow.is_hub = a.is_hub
        updatedRow.parent_hub_id = a.parent_hub_id
      }
      
      if (extra) {
        updatedRow.lon = extra.lon
        updatedRow.lat = extra.lat
        updatedRow.city_id = extra.cityId
        updatedRow.line_ids = extra.lineIds
        updatedRow.metadata = {
          ...updatedRow.metadata,
          co_constructed: true,
          co_constructed_station_ids: extra.ids,
          co_constructed_line_ids: extra.lineIds,
        }
      } else if (updatedRow.parent_hub_id) {
        // For spokes, update their city_id based on their coordinates (which might have been propagated)
        updatedRow.city_id = assignCityId(updatedRow.lon, updatedRow.lat)
      }
      
      return updatedRow
    })
    .filter(r => !!r.city_id)

  return { rows: nextRows, assignments: Array.from(assignments.values()) }
}

function normalizeBarrierFree(item: unknown): FacilityRow | null {
  const stationId = pick<string>(item, ['odpt:station'])
  if (!stationId) return null
  const rawType = (pick<string>(item, ['odpt:facilityType', 'odpt:classification']) || '').toLowerCase()
  const type = rawType.includes('elevator') ? 'elevator'
    : rawType.includes('escalator') ? 'escalator'
    : rawType.includes('toilet') || rawType.includes('restroom') ? 'toilet'
    : rawType.includes('wheelchair') ? 'wheelchair_support'
    : rawType || 'unknown'
  const name = extractNames(item, stationId)
  const hasWheel = type === 'elevator' || type === 'wheelchair_support' || /accessible|barrierfree|wheelchair/i.test(rawType)
  const hasBaby = /baby|nursing|care/i.test(rawType)
  return {
    node_id: String(stationId),
    type,
    name,
    has_wheelchair_access: !!hasWheel,
    has_baby_care: !!hasBaby,
    is_free: true,
    is_24h: false,
    current_status: 'unknown',
    attributes: {
      raw: item,
    },
    source_dataset: 'odpt',
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
  
  const payload = rows
    .filter((r) => !!r.city_id)
    .map((r) => ({
      id: r.id,
      city_id: r.city_id,
      name: r.name,
      type: r.type,
      location: ewktPoint(r.lon, r.lat),
      is_hub: r.is_hub ?? false,
      parent_hub_id: null,
      line_ids: r.line_ids || [],
      source_dataset: r.source_dataset,
      source_id: r.id,
      metadata: r.metadata || {},
      external_links: {},
    }))

  const upsertRes = await supabase.from('nodes').upsert(payload, { onConflict: 'id' })
  if (upsertRes.error) {
    console.error('Upsert failed:', upsertRes.error)
    throw upsertRes.error
  }
  
  const updated = rows.length - addedExpected
  return { added: addedExpected, updated }
}

async function replaceFacilitiesSupabase(supabase: SupabaseClient, nodeIds: string[], facilities: FacilityRow[]) {
  if (!nodeIds.length) return { inserted: 0 }
  await supabase
    .from('facilities')
    .delete()
    .in('node_id', nodeIds)
    .eq('source_dataset', 'odpt')
  const toInsert = facilities.map((f) => ({
    node_id: f.node_id,
    city_id: f.city_id,
    type: f.type,
    name: f.name,
    has_wheelchair_access: f.has_wheelchair_access,
    has_baby_care: f.has_baby_care,
    is_free: f.is_free,
    is_24h: f.is_24h,
    current_status: f.current_status,
    attributes: f.attributes,
    source_dataset: f.source_dataset,
  }))
  const ins = await supabase.from('facilities').insert(toInsert)
  if (ins.error) throw ins.error
  return { inserted: toInsert.length }
}

// City polygons/bounds for粗略歸屬（台東區/千代田區/中央區）
type Polygon = { id: string; points: [number, number][] }
const cityPolygons: Polygon[] = [
  { 
    id: 'tokyo_taito', 
    points: [[139.75, 35.69], [139.82, 35.69], [139.82, 35.76], [139.75, 35.76]] 
  },
  { 
    id: 'tokyo_chiyoda', 
    points: [[139.72, 35.66], [139.80, 35.66], [139.80, 35.72], [139.72, 35.72]] 
  },
  { 
    id: 'tokyo_chuo', 
    points: [[139.75, 35.63], [139.81, 35.63], [139.81, 35.71], [139.75, 35.71]] 
  },
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

async function deleteExcludedNodes(supabase: SupabaseClient, _keptIds: string[]) {
  console.log(`Cleaning up ODPT station nodes in '${cityFilter}' before rebuilding...`)

  const { data: hubs, error: hubsErr } = await supabase
    .from('nodes')
    .select('id')
    .eq('city_id', cityFilter)
    .eq('type', 'station')
    .eq('source_dataset', 'odpt')

  if (hubsErr) {
    console.warn('Cleanup failed:', hubsErr)
    return
  }

  const hubIds = (hubs || []).map((x) => String((x as { id: unknown }).id)).filter(Boolean)

  if (hubIds.length) {
    const { error: spokesErr } = await supabase
      .from('nodes')
      .delete()
      .in('parent_hub_id', hubIds)

    if (spokesErr) console.warn('Cleanup failed:', spokesErr)
  }

  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('city_id', cityFilter)
    .eq('type', 'station')
    .eq('source_dataset', 'odpt')

  if (error) console.warn('Cleanup failed:', error)
}

async function main() {
  const token = process.env.ODPT_API_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const dbConn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL
  
  if (!token) {
    // try to find from file content if needed, but parseEnvFile should handle it
  }
  
  if (!token) throw new Error('ODPT_API_TOKEN missing')

  const stationsRaw = await fetchStations(token)
  const barrierRaw = await fetchBarrierFree(token)
  const trainInfoRaw = onlyStations ? [] : await fetchTrainInformation(token)
  let stations = stationsRaw.map((x) => normalize(x, 'station')).filter(Boolean) as NormalizedRow[]
  stations = applyCityFilter(stations)
  const merged = applyCoConstructedMerge(stations)
  const idToHub = new Map<string, string>()
  if (merged.assignments) {
    const spokeIds = new Set<string>()
    for (const a of merged.assignments) {
      idToHub.set(a.id, a.parent_hub_id || a.id)
      if (a.parent_hub_id) spokeIds.add(a.id)
    }
    stations = includeSpokes ? merged.rows : merged.rows.filter((r) => !spokeIds.has(r.id))
  } else {
    stations = merged.rows
  }

  const all = stations
  const keptIds = all.map((r) => r.id)
  const nodeIds = new Set<string>(keptIds)
  const bf = barrierRaw
    .map((x) => normalizeBarrierFree(x))
    .filter((x): x is FacilityRow => !!x)
    .map((f) => ({ ...f, node_id: idToHub.get(f.node_id) || f.node_id }))
    .filter((x) => nodeIds.has(x.node_id))

  if (dbConn) {
    const client = new PgClient({
      connectionString: dbConn,
      ssl: dbConn.includes('supabase.') || dbConn.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
    })
    await client.connect()
    try {
      await client.query(
        `delete from public.nodes where parent_hub_id in (
          select id from public.nodes
          where city_id = $1 and type = 'station' and source_dataset = 'odpt'
        )`,
        [cityFilter]
      )
      await client.query(
        `delete from public.nodes where city_id = $1 and type = 'station' and source_dataset = 'odpt'`,
        [cityFilter]
      )

      const toNodeRow = (r: NormalizedRow) => ({
        id: r.id,
        city_id: r.city_id,
        name: r.name,
        type: r.type,
        lon: r.lon,
        lat: r.lat,
        is_hub: r.is_hub ?? false,
        parent_hub_id: includeSpokes ? (r.parent_hub_id || null) : null,
        line_ids: r.line_ids || [],
        source_dataset: r.source_dataset,
        source_id: r.id,
        metadata: r.metadata || {},
        external_links: {},
      })

      const hubs = includeSpokes ? all.filter((r) => !r.parent_hub_id).map(toNodeRow) : all.map(toNodeRow)
      const spokes = includeSpokes ? all.filter((r) => !!r.parent_hub_id).map(toNodeRow) : []

      const upsertSql = `
        insert into public.nodes (
          id,
          city_id,
          name,
          type,
          location,
          is_hub,
          parent_hub_id,
          line_ids,
          source_dataset,
          source_id,
          metadata,
          external_links
        )
        select
          x.id,
          x.city_id,
          x.name,
          x.type,
          ST_SetSRID(ST_MakePoint(x.lon, x.lat), 4326)::geography,
          x.is_hub,
          nullif(x.parent_hub_id, ''),
          coalesce(
            (select array_agg(e) from jsonb_array_elements_text(x.line_ids) as e),
            array[]::text[]
          ),
          x.source_dataset,
          x.source_id,
          x.metadata,
          x.external_links
        from jsonb_to_recordset($1::jsonb) as x(
          id text,
          city_id text,
          name jsonb,
          type text,
          lon float8,
          lat float8,
          is_hub boolean,
          parent_hub_id text,
          line_ids jsonb,
          source_dataset text,
          source_id text,
          metadata jsonb,
          external_links jsonb
        )
        on conflict (id) do update set
          city_id = excluded.city_id,
          name = excluded.name,
          type = excluded.type,
          location = excluded.location,
          is_hub = excluded.is_hub,
          parent_hub_id = excluded.parent_hub_id,
          line_ids = excluded.line_ids,
          source_dataset = excluded.source_dataset,
          source_id = excluded.source_id,
          metadata = excluded.metadata,
          external_links = excluded.external_links,
          updated_at = now();
      `

      if (hubs.length) await client.query(upsertSql, [JSON.stringify(hubs)])
      if (spokes.length) {
        const chunkSize = 300
        for (let i = 0; i < spokes.length; i += chunkSize) {
          await client.query(upsertSql, [JSON.stringify(spokes.slice(i, i + chunkSize))])
        }
      }

      if (bf.length) {
        const facSql = `
          insert into public.facilities (
            node_id,
            city_id,
            type,
            name,
            has_wheelchair_access,
            has_baby_care,
            is_free,
            is_24h,
            current_status,
            attributes,
            source_dataset
          )
          select
            x.node_id,
            x.city_id,
            x.type,
            x.name,
            x.has_wheelchair_access,
            x.has_baby_care,
            x.is_free,
            x.is_24h,
            x.current_status,
            x.attributes,
            x.source_dataset
          from jsonb_to_recordset($1::jsonb) as x(
            node_id text,
            city_id text,
            type text,
            name jsonb,
            has_wheelchair_access boolean,
            has_baby_care boolean,
            is_free boolean,
            is_24h boolean,
            current_status text,
            attributes jsonb,
            source_dataset text
          );
        `
        await client.query(facSql, [JSON.stringify(bf)])
      }

      const totalRes = await client.query('select count(*)::int as c from public.nodes')
      const cityRes = await client.query('select count(*)::int as c from public.nodes where city_id = $1', [cityFilter])

      console.log(
        JSON.stringify({
          stations_fetched: stationsRaw.length,
          within_bbox: all.length,
          city_filter: cityFilter,
          merge_coconstructed: mergeCoConstructed,
          merge_radius_m: mergeRadiusM,
          barrierfree_fetched: barrierRaw.length,
          train_information_fetched: trainInfoRaw.length,
          facilities_inserted: bf.length,
          total_nodes_in_db: (totalRes.rows[0]?.c as number) || 0,
          nodes_in_city: (cityRes.rows[0]?.c as number) || 0,
        })
      )
      return
    } finally {
      await client.end().catch(() => {})
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    console.log(
      JSON.stringify({
        stations_fetched: stationsRaw.length,
        barrierfree_fetched: barrierRaw.length,
        within_bbox: all.length,
        city_filter: cityFilter,
        merge_coconstructed: mergeCoConstructed,
        merge_radius_m: mergeRadiusM,
        facilities_mapped: bf.length,
        total_odpt_nodes: null,
        note: 'DATABASE_URL missing; skipped write',
      })
    )
    return
  }

  throw new Error('DATABASE_URL missing')
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
