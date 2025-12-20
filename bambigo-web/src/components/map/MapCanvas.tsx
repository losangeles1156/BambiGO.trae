'use client'

import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
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

const MapCanvas = ({
  height,
  showBus,
  zone,
  center,
  route,
  accessibility,
  showPopup,
  onNodeSelected,
  onLocationError,
  nodes,
  styleIndex = 0,
  locale = 'zh-TW',
  triggerGeolocate = 0,
}: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const onNodeSelectedRef = useRef(onNodeSelected)
  const geolocateControl = useRef<maplibregl.GeolocateControl | null>(null)
  const [loaded, setLoaded] = useState(false)

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

  // Map Styles Configuration
  const MAP_STYLES = [
    'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  ]

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    const initialCenter: [number, number] = center || [139.7774, 35.7141] // Ueno Station
    let styleIndex = 0

    const initMap = (sIndex: number) => {
      if (!mapContainer.current) return

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLES[sIndex],
        center: initialCenter,
        zoom: 15,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      })

      map.current!.on('error', (e: any) => {
        // Catch tile loading errors or style errors
        if (e.error?.message?.includes('tile') || e.error?.status === 404) {
          console.warn(`Map Tile error detected on style ${sIndex}:`, e.error)
          
          // If the current style is failing and we have more styles, try the next one
          if (sIndex < MAP_STYLES.length - 1) {
            console.info('Switching to fallback map style...')
            map.current?.remove()
            map.current = null
            initMap(sIndex + 1)
          }
        }
      })
    }

    initMap(styleIndex)

    if (!map.current) return

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize()
    })
    resizeObserver.observe(mapContainer.current)

    map.current!.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.current!.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right')
    
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true
    })
    geolocateControl.current = geolocate
    map.current!.addControl(geolocate, 'bottom-right')

    const UENO_STATION_COORDS: [number, number] = [139.7774, 35.7141]

    geolocate.on('geolocate', (position: any) => {
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
          map.current?.flyTo({ center: UENO_STATION_COORDS, zoom: 15 })
          
          if (onLocationError) {
            onLocationError('OUT_OF_RANGE')
          }

          // Optionally select Ueno station if it exists in nodes
          const ueno = nodes.features.find(f => f.id === 'ueno-station' || (f.properties as any).id === 'ueno-station')
          if (ueno && onNodeSelectedRef.current) {
            onNodeSelectedRef.current(ueno)
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
          map.current?.flyTo({ center: UENO_STATION_COORDS, zoom: 15 })
          if (onLocationError) onLocationError('OUT_OF_RANGE')
        }
      }
    })

    geolocate.on('error', (e) => {
      console.warn('Geolocation error:', e)
      if (onLocationError) onLocationError('PERMISSION_DENIED')
      // Fallback: If geolocation fails, fly to initial center
      map.current?.flyTo({ center: initialCenter, zoom: 14 })
    })

    map.current!.on('load', () => {
      setLoaded(true)
      
      // Add Sources
      if (!map.current) return
      
      // Route Source
      map.current.addSource('route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      // Route Layer (Line)
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': Colors.status.blue,
          'line-width': 6,
          'line-opacity': 0.8
        }
      })
    })

    // Click Handler
    map.current!.on('click', (e: any) => {
      if (!onNodeSelectedRef.current) return
      
      const features = map.current?.queryRenderedFeatures(e.point)
      
      if (features && features.length > 0) {
        const poi = features.find((f: any) => f.source === 'openmaptiles' && (f.layer.id.includes('poi') || f.layer.id.includes('station')))
        
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
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle Bus Layer Visibility
  useEffect(() => {
    if (!map.current || !loaded) return
    
    const layers = map.current.getStyle().layers
    const transportLayers = layers.filter((l: any) => 
      l.id.includes('transport') || l.id.includes('bus') || l.id.includes('transit')
    )
    
    transportLayers.forEach((l: any) => {
      map.current.setLayoutProperty(l.id, 'visibility', showBus ? 'visible' : 'none')
    })
  }, [showBus, loaded])

  // Handle Zone Boundary/Alert
  useEffect(() => {
    if (!map.current || !loaded) return
    
    // If not in core zone, we could show a warning or change map saturation
    // For now, let's just log it or we could add a screen-space overlay if needed
    if (zone === 'outer') {
      map.current.setPaintProperty('background', 'background-color', '#fff5f5')
    } else {
      map.current.setPaintProperty('background', 'background-color', '#ffffff')
    }
  }, [zone, loaded])

  // Handle Nodes (Markers)
  useEffect(() => {
    if (!map.current || !loaded) return

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
          iconEl.setAttribute('data-testid', `marker-${feature.id || (feature.properties as any)?.id}`)
          
          const labelEl = document.createElement('div')
          const nameObj = (feature.properties as any)?.name || {}
          const langCode = locale.split('-')[0] // handle zh-TW -> zh
          const nm = nameObj[langCode] || nameObj['zh'] || nameObj['en'] || nameObj['ja'] || 'Node'
          
          labelEl.className = 'absolute top-7 px-2 py-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded text-[11px] font-bold text-gray-800 shadow-sm whitespace-nowrap pointer-events-none'
          labelEl.innerText = nm
          
          el.appendChild(iconEl)
          el.appendChild(labelEl)
          
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map.current!)
          
          // Add Popup if showPopup is true
          if (showPopup) {
            const popup = new maplibregl.Popup({ offset: 25 })
              .setHTML(`<div class="p-2 font-sans">
                <div class="font-bold text-gray-900">${nm}</div>
                <div class="text-xs text-gray-500">點擊查看詳情</div>
              </div>`)
            marker.setPopup(popup)
          }
          
          el.addEventListener('click', (e) => {
             e.stopPropagation()
             onNodeSelectedRef.current?.(feature as Feature)
          })
          
          markers.current.push(marker)
        }
      })
    }
  }, [nodes, loaded, showPopup])

  // Handle Route Updates
  useEffect(() => {
    if (!map.current || !loaded) return
    const source = map.current.getSource('route-source') as maplibregl.GeoJSONSource | undefined
    if (source && route) {
      source.setData(route)
    } else if (source) {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [route, loaded])

  // Handle View Updates
  useEffect(() => {
    if (!map.current || !center) return
    map.current.flyTo({ center, zoom: 15, essential: true })
  }, [center])

  // Handle Style Changes
  useEffect(() => {
    if (!map.current || !loaded) return
    const targetStyle = MAP_STYLES[styleIndex % MAP_STYLES.length]
    if (map.current.getStyle().name !== targetStyle) {
      map.current.setStyle(targetStyle)
    }
  }, [styleIndex, loaded])

  return <div ref={mapContainer} style={{ height, width: '100%' }} className="relative outline-none" />
}

export default MapCanvas
