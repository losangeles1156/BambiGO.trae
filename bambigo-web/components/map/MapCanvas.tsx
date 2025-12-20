'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Feature } from 'geojson'
import NodeCard from './NodeCard'
import { Colors, MapFilters } from '../../src/lib/designTokens'

type NodeProps = { id: string; name?: { ja?: string; en?: string; zh?: string }; type?: string; supply_tags?: string[]; suitability_tags?: string[] }
type ExtMap = MapLibreMap & { _darkObserver?: MutationObserver; _darkMql?: MediaQueryList }

const UENO_COORDS: [number, number] = [139.7774, 35.7141]
const MAX_DIST_KM = 50

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c // Distance in km
  return d
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': Colors.map.lightBg } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.8 } },
  ],
}

// 深色模式底圖（Carto Dark）。注意：需保留正確授權標示。
const OSM_STYLE_DARK: StyleSpecification = {
  version: 8,
  sources: {
    osm_dark: {
      type: 'raster',
      // Carto dark tiles（公共使用常見）。如需高流量/商用請檢查供應商條款。
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': Colors.map.darkBg } },
    { id: 'osm-dark', type: 'raster', source: 'osm_dark', paint: { 'raster-opacity': 0.9 } },
  ],
}

type Props = { height?: number | string; onNodeSelected?: (f: Feature) => void; showBus?: boolean; zone?: 'core' | 'buffer' | 'outer'; center?: [number, number]; route?: FeatureCollection | null; accessibility?: { preferElevator?: boolean }; showPopup?: boolean; filter?: { tag?: string; status?: string } }
export default function MapCanvas({ height, onNodeSelected, showBus = true, zone = 'core', center, route, accessibility, showPopup = true, filter }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [data, setData] = useState<FeatureCollection | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [styleError, setStyleError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Feature | null>(null)
  const cbRef = useRef<typeof onNodeSelected | null>(null)
  const showBusRef = useRef<boolean>(showBus)
  useEffect(() => { cbRef.current = onNodeSelected || null }, [onNodeSelected])
  useEffect(() => { showBusRef.current = showBus }, [showBus])

  const handleGeolocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const dist = getDistanceFromLatLonInKm(latitude, longitude, UENO_COORDS[1], UENO_COORDS[0])
        
        if (dist > MAX_DIST_KM) {
          // If > 50km, stay at Ueno (or fly to Ueno if not there)
          // We don't move if we are already there to avoid jitter, but forcing it ensures consistency
          mapRef.current?.flyTo({ center: UENO_COORDS, zoom: 13 })
        } else {
          // If <= 50km, fly to user
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 15 })
        }
      },
      (err) => {
        console.error('Geolocation error', err)
      }
    )
  }
  

  useEffect(() => {
    let mounted = true
    const normalizeFC = (fc: unknown): FeatureCollection => {
      const isFC = fc && typeof fc === 'object' && (fc as { type?: unknown }).type === 'FeatureCollection'
      const feats = isFC && Array.isArray((fc as { features?: unknown }).features) ? (fc as { features: Feature[] }).features : []
      // Ensure minimum shape for properties
      const safeFeatures = feats.map((f) => {
        const props = (f as Feature).properties || {}
        return { ...f, properties: props }
      })
      return { type: 'FeatureCollection', features: safeFeatures }
    }
    fetch('/api/nodes', { keepalive: true })
      .then(async (r) => {
        if (!r.ok) return { type: 'FeatureCollection', features: [] } as FeatureCollection
        return r.json()
      })
      .then((json) => {
        if (mounted) setData(normalizeFC(json))
      })
      .catch((e) => {
        if ((e as { name?: string })?.name !== 'AbortError') console.error('nodes fetch failed', e)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const prefersDark = () => {
      try {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const sys = !!mql.matches
        const cls = document.documentElement.classList.contains('dark')
        return sys || cls
      } catch {
        return false
      }
    }
    const initialStyle = prefersDark() ? OSM_STYLE_DARK : OSM_STYLE
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [139.7774, 35.7141],
      zoom: 13,
    })
    mapRef.current = map
    let retriedStyle = false
    map.on('error', (e: unknown) => {
      const err = (e as { error?: { message?: unknown; name?: unknown } })?.error
      const msg = typeof err?.message === 'string' ? err.message : ''
      const name = typeof err?.name === 'string' ? err.name : ''
      const isAbort = name === 'AbortError' || /ERR_ABORTED/i.test(msg)
      const isTileImage = /tile|image/i.test(msg)
      if (isAbort || isTileImage) return
      const isStyleLoadFailure = /style/i.test(msg) && /fail|error/i.test(msg)
      if (isStyleLoadFailure) {
        setStyleError(String(msg))
        if (!retriedStyle) {
          retriedStyle = true
          try {
            map.setStyle(prefersDark() ? OSM_STYLE_DARK : OSM_STYLE)
          } catch {}
        }
      }
    })
    map.on('styledata', () => {
      setStyleError(null)
    })
    map.on('load', () => {
      handleGeolocation()
      if (!map.getLayer('layer-bus'))
        map.addLayer({
          id: 'layer-bus',
          type: 'circle',
          source: 'src-bus',
          minzoom: 13,
          paint: {
            'circle-color': Colors.map.busFill,
            'circle-opacity': 0.95,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 15, 8, 18, 10],
            'circle-stroke-color': Colors.map.circleStroke,
            'circle-stroke-width': 2,
          },
          // MapLibre layout typing is partial; cast minimal shape
          layout: { visibility: showBusRef.current ? 'visible' : 'none' } as { visibility: 'visible' | 'none' },
        })
      if (!map.getSource('src-route')) map.addSource('src-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as FeatureCollection })
      if (!map.getLayer('layer-route'))
        map.addLayer({
          id: 'layer-route',
          type: 'line',
          source: 'src-route',
          paint: {
            'line-color': '#6b7280',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      if (!map.getSource('src-route-points')) map.addSource('src-route-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as FeatureCollection })
      if (!map.getLayer('layer-route-points'))
        map.addLayer({
          id: 'layer-route-points',
          type: 'circle',
          source: 'src-route-points',
          paint: {
            'circle-color': '#f59e0b',
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 6, 18, 7],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        })
      
      map.on('click', 'layer-station', (e: unknown) => {
        const f = (e as unknown as { features?: Feature[] }).features?.[0]
        if (f) {
          setSelected(f)
          cbRef.current?.(f)
        }
      })
      map.on('click', 'layer-bus', (e: unknown) => {
        const f = (e as unknown as { features?: Feature[] }).features?.[0]
        if (f) {
          setSelected(f)
          cbRef.current?.(f)
        }
      })
      map.on('mouseenter', 'layer-station', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'layer-station', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'layer-bus', () => { if (showBusRef.current) map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'layer-bus', () => { map.getCanvas().style.cursor = '' })
    })
    // 監聽系統深色模式變化，動態切換樣式
    let media: MediaQueryList | null = null
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        const next = media?.matches
        try {
          map.setStyle(next ? OSM_STYLE_DARK : OSM_STYLE)
        } catch {}
      }
      media.addEventListener?.('change', onChange)
      // 同時監聽 Tailwind 的 .dark 類是否切換（若有 UI 切換按鈕）
      const observer = new MutationObserver(() => {
        const clsDark = document.documentElement.classList.contains('dark')
        const sysDark = media?.matches ?? false
        const targetDark = clsDark || sysDark
        try {
          map.setStyle(targetDark ? OSM_STYLE_DARK : OSM_STYLE)
        } catch {}
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      ;(map as ExtMap)._darkObserver = observer
      ;(map as ExtMap)._darkMql = media
    } catch {}
    return () => {
      try {
        const obs: MutationObserver | undefined = (map as ExtMap)._darkObserver
        const mql: MediaQueryList | undefined = (map as ExtMap)._darkMql
        obs?.disconnect()
        mql?.removeEventListener?.('change', () => {})
      } catch {}
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !data) return
    const fc = data as FeatureCollection
    const featuresArr = Array.isArray(fc.features) ? fc.features : []

    let filteredFeatures = featuresArr
    if (filter?.tag) {
      filteredFeatures = featuresArr.filter(f => {
        const props = f.properties as NodeProps | undefined
        const tags = props?.supply_tags || []
        // Flexible match: exact match OR "has_" prefix match
        return tags.some(t => t === filter.tag || t === `has_${filter.tag}` || t.includes(filter.tag!))
      })
    }

    const stations: FeatureCollection = {
      type: 'FeatureCollection',
      features: (filteredFeatures as Feature[]).filter((f) => (f.properties as NodeProps | undefined)?.type === 'station'),
    }
    const busstops: FeatureCollection = {
      type: 'FeatureCollection',
      features: (filteredFeatures as Feature[]).filter((f) => (f.properties as NodeProps | undefined)?.type === 'bus_stop'),
    }
    const srcStation = map.getSource('src-station') as maplibregl.GeoJSONSource | undefined
    const srcBus = map.getSource('src-bus') as maplibregl.GeoJSONSource | undefined
    if (srcStation) srcStation.setData(stations)
    if (showBusRef.current && srcBus) srcBus.setData(busstops)
  }, [data, filter])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setLayoutProperty('layer-bus', 'visibility', showBusRef.current ? 'visible' : 'none')
    } catch {}
  }, [showBus])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      const preferElevator = !!accessibility?.preferElevator
      const isBuffer = zone === 'buffer'
      const isOuter = zone === 'outer'
      
      // Dynamic styling based on filter status
      let baseStationColor = Colors.map.stationFill
      if (filter?.status === 'open_now') baseStationColor = '#16a34a' // green-600
      
      const stationColor = isBuffer || isOuter ? '#9CA3AF' : baseStationColor
      const busColor = isBuffer || isOuter ? '#9CA3AF' : Colors.map.busFill
      const stationRadius = isBuffer ? ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 7, 18, 9] : ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 10, 18, 13]
      const busRadius = isBuffer ? ['interpolate', ['linear'], ['zoom'], 13, 4, 15, 6, 18, 8] : ['interpolate', ['linear'], ['zoom'], 13, 6, 15, 8, 18, 10]
      map.setPaintProperty('layer-station', 'circle-color', stationColor)
      map.setPaintProperty('layer-bus', 'circle-color', busColor)
      map.setPaintProperty('layer-station', 'circle-radius', stationRadius as unknown)
      map.setPaintProperty('layer-bus', 'circle-radius', busRadius as unknown)
      const routeColor = (preferElevator ? '#2563eb' : '#6b7280')
      if (map.getLayer('layer-route')) map.setPaintProperty('layer-route', 'line-color', routeColor)
    } catch {}
  }, [zone, accessibility, filter])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!Array.isArray(center) || center.length !== 2) return
    try {
      map.flyTo({
        center: center as [number, number],
        zoom: 15, // 自動調整到適合查看設施的層級
        speed: 1.2, // 平滑移動速度
        curve: 1.42, // 移動軌跡曲率
        essential: true
      })
    } catch {}
  }, [center])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const srcRoute = map.getSource('src-route') as maplibregl.GeoJSONSource | undefined
    const srcPoints = map.getSource('src-route-points') as maplibregl.GeoJSONSource | undefined
    try {
      const fc = route || { type: 'FeatureCollection', features: [] }
      srcRoute?.setData(fc)
      const onlyPoints: FeatureCollection = {
        type: 'FeatureCollection',
        features: (fc.features || []).filter((f) => f.geometry?.type === 'Point'),
      }
      srcPoints?.setData(onlyPoints)
    } catch {}
  }, [route])

  // MapLibre 不需要 Token；省略 Token 檢查

  return (
    <div ref={containerRef} style={{ width: '100dvw', height: height ? (typeof height === 'number' ? `${height}px` : String(height)) : '100dvh', filter: MapFilters.grayscale }}>
      {styleError && (
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 6 }}>
          <div style={{ fontWeight: 600 }}>地圖樣式載入失敗</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{styleError}</div>
          <button
            style={{ marginTop: 8, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }}
            onClick={() => {
              const map = mapRef.current
              if (map) {
                setStyleError(null)
                try {
                  const prefersDark = document.documentElement.classList.contains('dark') || window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
                  map.setStyle(prefersDark ? OSM_STYLE_DARK : OSM_STYLE)
                } catch {}
              }
            }}
          >
            重試載入
          </button>
        </div>
      )}
      {selected && showPopup && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-20">
          <div style={{ position: 'absolute', top: -8, right: -8 }}>
            <button
              style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 999, width: 24, height: 24 }}
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
          <NodeCard
            name={(selected.properties as NodeProps | undefined)?.name || { ja: '', en: '', zh: '' }}
            supply_tags={(selected.properties as NodeProps | undefined)?.supply_tags || []}
            suitability_tags={(selected.properties as NodeProps | undefined)?.suitability_tags || []}
          />
        </div>
      )}
    </div>
  )
}
