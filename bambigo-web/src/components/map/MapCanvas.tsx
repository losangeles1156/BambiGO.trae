'use client'

import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Zone } from '@/lib/zones/detector'
import { FeatureCollection, Feature } from 'geojson'
import { Colors } from '@/lib/designTokens'

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
  locale?: string
  triggerGeolocate?: number // Incremental value to trigger geolocate
}

const MAP_STYLES = [
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
]

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
  locale = 'zh-TW',
  triggerGeolocate = 0,
}: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<Array<maplibregl.Marker>>([])
  const onNodeSelectedRef = useRef(onNodeSelected)
  const geolocateControl = useRef<maplibregl.GeolocateControl | null>(null)
  const [loaded, setLoaded] = useState(false)
  const activeStyleIndexRef = useRef(styleIndex)
  const lastLocationErrorRef = useRef<{ code: string; at: number } | null>(null)

  // Keep callback ref up to date
  useEffect(() => {
    onNodeSelectedRef.current = onNodeSelected
  }, [onNodeSelected])

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

    const initialCenter: [number, number] = center || [139.7774, 35.7141] // Ueno Station

    const initMap = (sIndex: number): MapLibreMap | null => {
      if (!mapContainer.current) return null

      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLES[sIndex],
        center: initialCenter,
        zoom: 15,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      })

      mapInstance.on('error', (e: { error?: { message?: string; status?: number } }) => {
        if (e.error?.message?.includes('tile') || e.error?.status === 404) {
          console.warn(`Map Tile error detected on style ${sIndex}:`, e.error)
          
          if (sIndex < MAP_STYLES.length - 1) {
            console.info('Switching to fallback map style...')
            mapInstance.remove()
            const next = initMap(sIndex + 1)
            if (next) map.current = next
          }
        }
      })

      return mapInstance
    }

    const mapInstance = initMap(styleIndex)
    if (!mapInstance) return
    map.current = mapInstance

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.resize()
    })
    resizeObserver.observe(mapContainer.current)

    mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right')
    
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
      if (onLocationError) onLocationError(code)
    }

    geolocate.on('geolocate', (position: GeolocationPosition) => {
      const userCoords: [number, number] = [position.coords.longitude, position.coords.latitude]
      
      // Calculate distances to all nodes
      if (nodes && nodes.features.length > 0) {
        let minDistance = Infinity
        let nearestNode: Feature | null = null

        nodes.features.forEach((feature: Feature) => {
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
          console.log('User is > 50km from nearest node. Resetting to Ueno Station.')
          mapInstance.flyTo({ center: UENO_STATION_COORDS, zoom: 15 })

          emitLocationError('OUT_OF_RANGE')

          if (onNodeSelectedRef.current) {
            let best: Feature | null = null
            let bestDist = Infinity
            nodes.features.forEach((feature: Feature) => {
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
          const node = nearestNode as Feature;
          console.log(`User is within 50km (${minDistance.toFixed(2)}km). Selecting nearest node:`, node.id)
          onNodeSelectedRef.current(node)
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
      console.warn('Geolocation error:', e)
      const code = (e as { code?: number } | null | undefined)?.code
      if (code === 1) emitLocationError('PERMISSION_DENIED')
      else if (code === 2) emitLocationError('POSITION_UNAVAILABLE')
      else if (code === 3) emitLocationError('TIMEOUT')
      else emitLocationError('PERMISSION_DENIED')
      mapInstance.flyTo({ center: initialCenter, zoom: 14 })
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
      setLoaded(true)
    }

    mapInstance.on('load', onStyleReady)
    mapInstance.on('style.load', onStyleReady)

    // Click Handler
    mapInstance.on('click', (e: MapMouseEvent) => {
      if (!onNodeSelectedRef.current) return
      
      const features = mapInstance.queryRenderedFeatures(e.point)
      
      if (features && features.length > 0) {
        const poi = features.find((f: MapGeoJSONFeature) => f.source === 'openmaptiles' && (f.layer.id.includes('poi') || f.layer.id.includes('station')))
        
        if (poi) {
           const name = poi.properties?.name || poi.properties?.name_en
           const id = poi.id || poi.properties?.id
           const newFeature: Feature = {
             type: 'Feature',
             geometry: poi.geometry as GeoJSON.Geometry,
             properties: {
               id: String(id),
               name: { ja: name, en: poi.properties?.name_en || name },
               ...poi.properties
             }
           }
           onNodeSelectedRef.current(newFeature)
           return
        }
      }
    })

    return () => {
      resizeObserver.disconnect()
      mapInstance.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, locale])

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
      if (mapInstance.getLayer('background')) {
        mapInstance.setPaintProperty('background', 'background-color', '#fff5f5')
      }
    } else {
      if (mapInstance.getLayer('background')) {
        mapInstance.setPaintProperty('background', 'background-color', '#ffffff')
      }
    }
  }, [zone, loaded])

  // Handle Nodes (Markers)
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return

    // Clear existing markers
    markers.current.forEach(m => m.remove())
    markers.current = []

    if (nodes && nodes.features) {
      nodes.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
          // Create a marker
          const coords = feature.geometry.coordinates as [number, number]
          
          // Simple marker element
          const el = document.createElement('div')
          el.className = 'group relative flex flex-col items-center'
          
          const iconEl = document.createElement('div')
          iconEl.className = 'w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform flex items-center justify-center text-white text-[10px] font-bold'
          iconEl.innerHTML = 'B'
          iconEl.setAttribute('data-testid', `marker-${feature.id || (feature.properties as Record<string, unknown>)?.id}`)
          
          const labelEl = document.createElement('div')
          const nameObj = (feature.properties as Record<string, Record<string, string>>)?.name || {}
          const langCode = locale.split('-')[0] // handle zh-TW -> zh
          const nm = nameObj[langCode] || nameObj['zh'] || nameObj['en'] || nameObj['ja'] || 'Node'
          
          labelEl.className = 'absolute top-7 px-2 py-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded text-[11px] font-bold text-gray-800 shadow-sm whitespace-nowrap pointer-events-none'
          labelEl.innerText = nm
          
          el.appendChild(iconEl)
          el.appendChild(labelEl)
          
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(mapInstance)
          
          // Add Popup if showPopup is true
          if (showPopup) {
            const popup = new maplibregl.Popup({ offset: 25 })
              .setHTML(`<div class="p-2 font-sans">
                <div class="font-bold text-gray-900">${nm}</div>
                <div class="text-xs text-gray-500">點擊查看詳情</div>
              </div>`)
            marker.setPopup(popup)
          }
          
          el.addEventListener('click', (e: MouseEvent) => {
             e.stopPropagation()
             onNodeSelectedRef.current?.(feature as Feature)
          })
          
          markers.current.push(marker)
        }
      })
    }
  }, [nodes, loaded, showPopup, locale])

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

  // Handle Style Changes
  useEffect(() => {
    const mapInstance = map.current
    if (!mapInstance || !loaded) return
    if (activeStyleIndexRef.current === styleIndex) return
    activeStyleIndexRef.current = styleIndex

    setLoaded(false)
    const targetStyle = MAP_STYLES[styleIndex % MAP_STYLES.length]
    mapInstance.setStyle(targetStyle)
  }, [styleIndex, loaded])

  return <div ref={mapContainer} style={{ height, width: '100%' }} className="relative outline-none" />
}

export default MapCanvas
