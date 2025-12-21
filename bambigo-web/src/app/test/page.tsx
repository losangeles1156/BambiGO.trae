
'use client'

import MobileViewport from '../../components/layout/MobileViewport'
import MapCanvas from '../../components/map/MapCanvas'
import { useState } from 'react'

export default function TestPage() {
  const [locale] = useState('zh-TW')

  // Ueno Station
  const TEST_NODE = {
    type: "Feature" as const,
    properties: {
      id: "test-1",
      name: { zh: "測試點" },
      type: "station"
    },
    geometry: {
      type: "Point" as const,
      coordinates: [139.7774, 35.7141]
    }
  }

  return (
    <MobileViewport>
      {/* Test content layer */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-blue-100/80 z-50 text-black">
        <h1 className="text-xl font-bold">MapCanvas Test V2</h1>
        <p>Background should be RED if map is transparent.</p>
        <p>If map is white, tiles are loading but white, or background is white.</p>
      </div>

      {/* Map Layer Container - Red Background to detect transparency */}
      <div className="absolute inset-0 z-0 bg-red-500">
        <MapCanvas
          height="100%"
          showBus={false}
          zone="core"
          center={[139.7774, 35.7141]}
          route={null}
          accessibility={undefined}
          showPopup={true}
          onNodeSelected={(node) => console.log('Node selected:', node)}
          onLocationError={(err) => console.error('Location error:', err)}
          triggerGeolocate={0}
          nodes={{ type: 'FeatureCollection', features: [TEST_NODE] }}
          styleIndex={0}
          selectedNodeId={null}
          locale={locale}
        />
      </div>
    </MobileViewport>
  )
}
