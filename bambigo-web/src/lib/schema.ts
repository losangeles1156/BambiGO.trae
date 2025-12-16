'use client'
export type NameMulti = { ja?: string; en?: string; zh?: string }
export type NodeProps = {
  id: string
  name?: NameMulti
  type?: string
  supply_tags?: string[]
  suitability_tags?: string[]
  external_links?: unknown
  metadata?: unknown
}

export type FeatureLike = {
  type: 'Feature'
  geometry: { type: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

export type FeatureCollectionLike = {
  type: 'FeatureCollection'
  features: FeatureLike[]
}

export function normalizeFeatureCollection(input: unknown): FeatureCollectionLike {
  const isObj = !!input && typeof input === 'object'
  const type = isObj ? (input as { type?: unknown }).type : undefined
  const feats = isObj ? (input as { features?: unknown }).features : undefined
  const arr = Array.isArray(feats) ? (feats as unknown[]) : []
  const safeFeatures = arr.map((f) => {
    const isFeature = !!f && typeof f === 'object' && (f as { type?: unknown }).type === 'Feature'
    const properties = isFeature ? ((f as FeatureLike).properties || {}) : {}
    const geometry = isFeature ? ((f as FeatureLike).geometry || { type: 'Point', coordinates: [0, 0] }) : { type: 'Point', coordinates: [0, 0] }
    return { type: 'Feature', geometry, properties } as FeatureLike
  })
  return { type: 'FeatureCollection', features: safeFeatures }
}

export function pickStations(fc: FeatureCollectionLike): FeatureCollectionLike {
  const features = (fc.features || []).filter((f) => {
    const p = f.properties as NodeProps | undefined
    return p?.type === 'station'
  })
  return { type: 'FeatureCollection', features }
}

export function pickBusStops(fc: FeatureCollectionLike): FeatureCollectionLike {
  const features = (fc.features || []).filter((f) => {
    const p = f.properties as NodeProps | undefined
    return p?.type === 'bus_stop'
  })
  return { type: 'FeatureCollection', features }
}

export function safeName(props: NodeProps | undefined): NameMulti {
  return props?.name || { ja: '', en: '', zh: '' }
}

export function isValidBBoxString(s: string | null): boolean {
  if (s == null) return false
  const parts = s.split(',').map((x) => parseFloat(x))
  return parts.length === 4 && parts.every((n) => Number.isFinite(n))
}

