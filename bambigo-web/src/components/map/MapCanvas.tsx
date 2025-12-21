'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Zone } from '@/lib/zones/detector'
import { FeatureCollection, Feature } from 'geojson'
import { Colors } from '@/lib/designTokens'
import { useLanguage } from '@/contexts/LanguageContext'

// Helper: Haversine distance in km
function getDistance(coords1: [number, number], coords2: [number, number]): number {
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

interface MapCanvasProps {
  height: string | number
  showBus: boolean
  zone: Zone
  center?: [number, number]
  route?: FeatureCollection | null
  accessibility?: { preferElevator?: boolean }
  showPopup?: boolean
  onNodeSelected?: (feature: Feature) => void
  onLocationError?: (error: string) => void
  nodes?: FeatureCollection
  styleIndex?: number
  selectedNodeId?: string | null
  locale?: string
  triggerGeolocate?: number // Incremental value to trigger geolocate
}

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: 'BambiGO Minimal',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': Colors.map.lightBg },
    },
  ],
}

const CARTO_VOYAGER_STYLE: StyleSpecification = {
  version: 8,
  name: 'BambiGO Voyager',
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': Colors.map.lightBg } },
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-opacity': 0.97,
        'raster-saturation': -0.08,
        'raster-contrast': 0.06,
        'raster-brightness-min': 0.62,
        'raster-brightness-max': 1.0,
      },
    },
  ],
}

const CARTO_POSITRON_STYLE: StyleSpecification = {
  version: 8,
  name: 'BambiGO Positron',
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': Colors.map.lightBg } },
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-opacity': 0.98,
        'raster-saturation': -0.25,
        'raster-contrast': 0.02,
        'raster-brightness-min': 0.7,
        'raster-brightness-max': 1.08,
      },
    },
  ],
}

const CARTO_POSITRON_MUTED_STYLE: StyleSpecification = {
  version: 8,
  name: 'BambiGO Muted',
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': Colors.map.lightBg } },
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-opacity': 0.95,
        'raster-saturation': -0.55,
        'raster-contrast': 0.08,
        'raster-brightness-min': 0.7,
        'raster-brightness-max': 1.0,
      },
    },
  ],
}

export const MAP_STYLE_PRESETS: Array<{ id: string; name: string; style: string | StyleSpecification }> = [
  { id: 'voyager', name: 'Voyager Warm', style: CARTO_VOYAGER_STYLE },
  { id: 'positron', name: 'Positron Clean', style: CARTO_POSITRON_STYLE },
  { id: 'muted', name: 'Muted Light', style: CARTO_POSITRON_MUTED_STYLE },
]

const MAP_STYLES: Array<string | StyleSpecification> = MAP_STYLE_PRESETS.map((p) => p.style)

const MapCanvas = ({
  height,
  showBus,
  zone,
  center,
  route,
  showPopup,
  onNodeSelected,
  onLocationError,
  nodes,
  styleIndex = 0,
  selectedNodeId,
  locale,
  triggerGeolocate = 0,
}: MapCanvasProps) => {
  const { t, locale: ctxLocale } = useLanguage()
  const effectiveLocale = locale || ctxLocale
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<Array<maplibregl.Marker>>([])
  const onNodeSelectedRef = useRef(onNodeSelected)
  const onLocationErrorRef = useRef(onLocationError)
  const nodesRef = useRef(nodes)
  const geolocateControl = useRef<maplibregl.GeolocateControl | null>(null)
  const [loaded, setLoaded] = useState(false)
  const activeStyleIndexRef = useRef(styleIndex)
  const initialCenterRef = useRef<[number, number]>(center || [139.7774, 35.7141])
  const initialStyleIndexRef = useRef(styleIndex)
  const lastLocationErrorRef = useRef<{ code: string; at: number } | null>(null)
  const fallbackStyleAppliedRef = useRef(false)
  const pendingViewRef = useRef<{ center: [number, number]; zoom: number; bearing: number; pitch: number } | null>(null)
  const [debugLogs] = useState<string[]>([])

  const tapForDetailsLabel = useMemo(() => t('common.tapForDetails'), [t])

  // Keep callback ref up to date
  useEffect(() => {
    onNodeSelectedRef.current = onNodeSelected
  }, [onNodeSelected])

  useEffect(() => {
    onLocationErrorRef.current = onLocationError
  }, [onLocationError])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // External trigger for geolocation
  useEffect(() => {
    if (triggerGeolocate > 0 && geolocateControl.current) {
      geolocateControl.current.trigger()
    }
  }, [triggerGeolocate])

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current) return
    if (map.current) return

    const initialCenter = initialCenterRef.current
    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[initialStyleIndexRef.current % MAP_STYLES.length],
      center: initialCenter,
      zoom: 15,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    map.current = mapInstance

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.resize()
    })
    resizeObserver.observe(mapContainer.current)

    mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right')

    mapInstance.on('error', (ev: unknown) => {
      if (fallbackStyleAppliedRef.current) return
      const msg = String((ev as { error?: { message?: unknown } } | null | undefined)?.error?.message || '')
      if (!msg) return
      const shouldFallback =
        msg.includes('basemaps.cartocdn.com') ||
        msg.includes('tile.openstreetmap.org') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('networkerror')
      if (!shouldFallback) return

      fallbackStyleAppliedRef.current = true
      try {
        mapInstance.setStyle(FALLBACK_STYLE)
      } catch {
        return
      }
    })
    
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true
    })
    geolocateControl.current = geolocate
    mapInstance.addControl(geolocate, 'bottom-right')

    const UENO_STATION_COORDS: [number, number] = [139.7774, 35.7141]

    const emitLocationError = (code: string) => {
      const now = Date.now()
      const last = lastLocationErrorRef.current
      if (last && last.code === code && now - last.at < 30000) return
      lastLocationErrorRef.current = { code, at: now }
      onLocationErrorRef.current?.(code)
    }

    geolocate.on('geolocate', (position: GeolocationPosition) => {
      const userCoords: [number, number] = [position.coords.longitude, position.coords.latitude]
      
      // Calculate distances to all nodes
      const currentNodes = nodesRef.current
      if (currentNodes && currentNodes.features.length > 0) {
        let minDistance = Infinity
        let nearestNode: Feature | null = null

        currentNodes.features.forEach((feature: Feature) => {
          if (feature.geometry.type === 'Point') {
            const nodeCoords = feature.geometry.coordinates as [number, number]
            const dist = getDistance(userCoords, nodeCoords)
            if (dist < minDistance) {
              minDistance = dist
              nearestNode = feature
            }
          }
        })

        // If nearest node is > 50km, default to Ueno
        if (minDistance > 50) {
          mapInstance.flyTo({ center: UENO_STATION_COORDS, zoom: 15 })

          emitLocationError('OUT_OF_RANGE')

          if (onNodeSelectedRef.current) {
            let best: Feature | null = null
            let bestDist = Infinity
            currentNodes.features.forEach((feature: Feature) => {
              if (feature.geometry.type !== 'Point') return
              const nodeCoords = feature.geometry.coordinates as [number, number]
              const d = getDistance(UENO_STATION_COORDS, nodeCoords)
              if (d < bestDist) {
                bestDist = d
                best = feature
              }
            })
            if (best) onNodeSelectedRef.current(best)
          }
        } else if (nearestNode && onNodeSelectedRef.current) {
          onNodeSelectedRef.current(nearestNode as Feature)
        }
      } else {
        // No nodes available, check distance to Ueno directly
        const distToUeno = getDistance(userCoords, UENO_STATION_COORDS)
        if (distToUeno > 50) {
          mapInstance.flyTo({ center: UENO_STATION_COORDS, zoom: 15 })
          emitLocationError('OUT_OF_RANGE')
        }
      }
    })

    geolocate.on('error', (e: unknown) => {
      void e
      const code = (e as { code?: number } | null | undefined)?.code
      if (code === 1) emitLocationError('PERMISSION_DENIED')
      else if (code === 2) emitLocationError('POSITION_UNAVAILABLE')
      else if (code === 3) emitLocationError('TIMEOUT')
      else emitLocationError('PERMISSION_DENIED')
      mapInstance.flyTo({ center: initialCenterRef.current, zoom: 14 })
    })

    const ensureRouteLayer = () => {
      try {
        if (!mapInstance.getSource('route-source')) {
          mapInstance.addSource('route-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
        }

        if (!mapInstance.getLayer('route-line')) {
          mapInstance.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': Colors.status.blue,
              'line-width': 6,
              'line-opacity': 0.8,
            },
          })
        }
      } catch {
        return
      }
    }

    const onStyleReady = () => {
      ensureRouteLayer()
      const pending = pendingViewRef.current
      if (pending) {
        pendingViewRef.current = null
        try {
          mapInstance.jumpTo({ center: pending.center, zoom: pending.zoom, bearing: pending.bearing, pitch: pending.pitch })
        } catch {}
      }
      setLoaded(true)
    }

    mapInstance.on('load', onStyleReady)
    mapInstance.on('style.load', onStyleReady)

    return () => {
      resizeObserver.disconnect()
      mapInstance.remove()
      map.current = null
    }
  }, [])

  // Handle Bus Layer Visibility
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return
    
    const style = mapInstance.getStyle()
    if (!style || !style.layers) return
    
    const transportLayers = style.layers.filter((l: LayerSpecification) => 
      l.id.includes('transport') || l.id.includes('bus') || l.id.includes('transit')
    )
    
    transportLayers.forEach((l: LayerSpecification) => {
      mapInstance.setLayoutProperty(l.id, 'visibility', showBus ? 'visible' : 'none')
    })
  }, [showBus, loaded])

  // Handle Zone Boundary/Alert
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return
    
    // If not in core zone, we could show a warning or change map saturation
    // For now, let's just log it or we could add a screen-space overlay if needed
    if (zone === 'outer') {
      if (mapInstance.getLayer('background')) mapInstance.setPaintProperty('background', 'background-color', '#fff5f5')
    } else {
      if (mapInstance.getLayer('background')) mapInstance.setPaintProperty('background', 'background-color', Colors.map.lightBg)
    }
  }, [zone, loaded])

  // Handle Nodes (Markers)
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return

    // Clear existing markers
    markers.current.forEach(m => m.remove())
    markers.current = []

    if (!nodes?.features?.length) return

    const createNodeGlyphSvg = (kind: 'station' | 'bus_stop' | 'poi') => {
      if (kind === 'bus_stop') {
        return `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M7 16V9.5C7 7.6 8.6 6 10.5 6H13.5C15.4 6 17 7.6 17 9.5V16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M8 16H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M9 20L8 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M15 20L16 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <circle cx="9" cy="18" r="1" fill="currentColor" />
            <circle cx="15" cy="18" r="1" fill="currentColor" />
          </svg>
        `.trim()
      }
      if (kind === 'poi') {
        return `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 22s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <circle cx="12" cy="11" r="2.5" fill="currentColor" />
          </svg>
        `.trim()
      }
      return `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7 18V9.5C7 7 9 5 11.5 5H12.5C15 5 17 7 17 9.5V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M7 12H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="9" cy="15" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
          <path d="M8 18L6.5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M16 18L17.5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `.trim()
    }

    nodes.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') return

      const coords = feature.geometry.coordinates as [number, number]
      const props = (feature.properties as Record<string, unknown>) || {}
      const nameObj = (props.name as Record<string, string> | undefined) || {}
      const langCode = effectiveLocale.split('-')[0]
      const nm = nameObj[langCode] || nameObj['zh'] || nameObj['en'] || nameObj['ja'] || t('common.landmark')
      const id = String((props as { id?: unknown }).id || feature.id || '')
      const type = ((props.type as string | undefined) || (props.category as string | undefined) || 'station') as string
      const kind: 'station' | 'bus_stop' | 'poi' = type === 'bus_stop' ? 'bus_stop' : type === 'poi' ? 'poi' : 'station'
      const active = !!selectedNodeId && id === selectedNodeId

      const toneClass = kind === 'bus_stop'
        ? 'bg-emerald-600'
        : kind === 'poi'
          ? 'bg-violet-600'
          : 'bg-blue-600'

      const el = document.createElement('div')
      el.className = 'group relative flex flex-col items-center select-none'
      el.style.zIndex = active ? '1000' : '1'

      if (active) {
        const glow = document.createElement('div')
        glow.className = 'absolute -inset-2 rounded-[22px] bg-blue-500/25 blur-[2px]'
        el.appendChild(glow)

        const ping = document.createElement('div')
        ping.className = 'absolute -inset-2 rounded-[22px] bg-blue-500/20 animate-ping'
        el.appendChild(ping)
      }

      const iconEl = document.createElement('button')
      iconEl.type = 'button'
      iconEl.className = [
        'w-12 h-12 rounded-2xl',
        toneClass,
        'text-white',
        'border-2 border-white',
        'shadow-lg ring-1 ring-black/10',
        'flex items-center justify-center',
        'transition-transform duration-150',
        active ? 'scale-110' : 'hover:scale-110',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      ].join(' ')
      iconEl.setAttribute('aria-label', nm)
      iconEl.setAttribute('data-testid', `marker-${id || 'unknown'}`)
      iconEl.innerHTML = createNodeGlyphSvg(kind)

      const labelEl = document.createElement('div')
      labelEl.className = [
        'absolute top-14',
        'max-w-[160px] truncate',
        'px-2.5 py-1',
        'rounded-full',
        'bg-gray-900/90 text-white',
        'text-[11px] font-semibold',
        'shadow-md ring-1 ring-black/10',
        'backdrop-blur-sm',
        'pointer-events-none',
      ].join(' ')
      labelEl.innerText = nm

      el.appendChild(iconEl)
      el.appendChild(labelEl)

      const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(mapInstance)

      if (showPopup) {
        const popup = new maplibregl.Popup({ offset: 22 }).setHTML(`<div class="p-2 font-sans">
          <div class="font-bold text-gray-900">${nm}</div>
          <div class="text-xs text-gray-500">${tapForDetailsLabel}</div>
        </div>`)
        marker.setPopup(popup)
      }

      iconEl.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        onNodeSelectedRef.current?.(feature as Feature)
      })

      markers.current.push(marker)
    })
  }, [nodes, loaded, showPopup, effectiveLocale, t, tapForDetailsLabel, selectedNodeId])

  // Handle Route Updates
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return
    try {
      const source = mapInstance.getSource('route-source') as GeoJSONSource | undefined
      if (source && route) {
        source.setData(route)
      } else if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
    } catch {
      return
    }
  }, [route, loaded])

  // Handle View Updates
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !center) return
    mapInstance.flyTo({ center, zoom: 15, essential: true })
  }, [center])

  // Handle Style Change
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance) return

    if (activeStyleIndexRef.current === styleIndex) return
    activeStyleIndexRef.current = styleIndex
    
    // We don't setLoaded(false) here because style.load event will handle it
    // and we want to keep showing the previous style until the new one is ready
    // to avoid flicker. However, we do want to know when it's loading.
    
    try {
      const targetStyle = MAP_STYLES[styleIndex % MAP_STYLES.length]
      mapInstance.setStyle(targetStyle)
    } catch (err) {
      console.error('Failed to set map style:', err)
    }
  }, [styleIndex]) // Removed 'loaded' from dependencies to avoid loop

  const e2eMode =
    (typeof window !== 'undefined' && Boolean((window as unknown as { __BAMBIGO_E2E__?: boolean }).__BAMBIGO_E2E__))
  if (e2eMode) {
    const langCode = effectiveLocale.split('-')[0]
    const pts = (nodes?.features || []).filter((f): f is Feature => f.geometry.type === 'Point')

    return (
      <div style={{ height, width: '100%' }} className="relative outline-none bg-gray-100">
        <div className="absolute top-24 left-4 flex flex-wrap gap-3">
          {pts.map((feature, idx) => {
            const props = (feature.properties as Record<string, unknown>) || {}
            const nameObj = (props.name as Record<string, string> | undefined) || {}
            const nm = nameObj[langCode] || nameObj['zh'] || nameObj['en'] || nameObj['ja'] || t('common.landmark')
            const id = String((props as { id?: unknown }).id || feature.id || idx)
            const type = ((props.type as string | undefined) || (props.category as string | undefined) || 'station') as string
            const kind: 'station' | 'bus_stop' | 'poi' = type === 'bus_stop' ? 'bus_stop' : type === 'poi' ? 'poi' : 'station'
            const active = !!selectedNodeId && id === selectedNodeId
            const toneClass = kind === 'bus_stop'
              ? 'bg-emerald-600'
              : kind === 'poi'
                ? 'bg-violet-600'
                : 'bg-blue-600'
            const tid = `marker-${id}`

            return (
              <button
                key={tid}
                type="button"
                data-testid={tid}
                aria-label={nm}
                className="relative"
                onClick={(e) => {
                  e.stopPropagation()
                  onNodeSelected?.(feature)
                }}
              >
                {active && (
                  <>
                    <div className="absolute -inset-2 rounded-[22px] bg-blue-500/25 blur-[2px]" />
                    <div className="absolute -inset-2 rounded-[22px] bg-blue-500/20 animate-ping" />
                  </>
                )}
                <div className={`w-12 h-12 rounded-2xl ${toneClass} text-white border-2 border-white shadow-lg ring-1 ring-black/10 flex items-center justify-center ${active ? 'scale-110' : ''}`}>
                  {kind === 'bus_stop' ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M7 16V9.5C7 7.6 8.6 6 10.5 6H13.5C15.4 6 17 7.6 17 9.5V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 16H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9 20L8 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M15 20L16 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="9" cy="18" r="1" fill="currentColor" />
                      <circle cx="15" cy="18" r="1" fill="currentColor" />
                    </svg>
                  ) : kind === 'poi' ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 22s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="12" cy="11" r="2.5" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M7 18V9.5C7 7 9 5 11.5 5H12.5C15 5 17 7 17 9.5V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="9" cy="15" r="1" fill="currentColor" />
                      <circle cx="15" cy="15" r="1" fill="currentColor" />
                      <path d="M8 18L6.5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M16 18L17.5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={mapContainer} 
      style={{ height, width: '100%' }} 
      className="relative outline-none bg-gray-50" 
      aria-label="Map Container"
    >
      <div className="absolute top-20 left-0 bg-black/80 text-white text-xs p-2 z-[9999] max-w-[90vw] overflow-y-auto max-h-[50vh] rounded-r pointer-events-auto">
        <div className="font-bold text-yellow-400 mb-1">Debug Info:</div>
        <div>Loaded: {loaded ? 'Yes' : 'No'}</div>
        <div className="mt-1 pt-1 border-t border-gray-600">
          {debugLogs.map((log, i) => (
            <div key={i} className="break-words mb-1 border-b border-gray-700 pb-1 last:border-0">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MapCanvas
