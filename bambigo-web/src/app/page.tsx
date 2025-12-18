'use client'
import { useEffect, useState } from 'react'
import MapCanvas from '../../components/map/MapCanvas'
import type { FeatureCollection } from 'geojson'
import SearchBar from '../components/views/SearchBar'
import NodeDashboard from '../components/views/NodeDashboard'
import BottomSheet from '../components/sheets/BottomSheet'
import TagManager from '../components/tagging/TagManager'
import TagFilterBar from '../components/tagging/TagFilterBar'
import * as tagging from '../lib/tagging'
import TaskMode from '../components/views/TaskMode'
import FullScreenAssistant from '../components/assistant/FullScreenAssistant'
import { detectZoneFromPoint, Zone } from '../lib/zones/detector'
import { getAdapter } from '../lib/adapters'
 
export default function Home() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [installEvt, setInstallEvt] = useState<unknown>(null)
  const [view, setView] = useState<'explore' | 'dashboard' | 'task'>('explore')
  const [nodeName, setNodeName] = useState<{ ja?: string; en?: string; zh?: string }>({ zh: '上野站' })
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [zone, setZone] = useState<Zone>('core')
  const [lastCoords, setLastCoords] = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<FeatureCollection | null>(null)
  const [accessibility, setAccessibility] = useState<{ preferElevator?: boolean } | null>(null)
  const [tagState, setTagState] = useState<tagging.TagState>({ tags: [] })
  const [sheetMode, setSheetMode] = useState<'collapsed' | 'half' | 'full'>('collapsed')
  const prefersElevator = (hint: string) => /電梯|無障礙|wheelchair|elevators?|エレベータ(ー)?|バリアフリー|車椅子/i.test(hint)
  const [showAssistant, setShowAssistant] = useState(false)
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const onBIP = (e: Event) => {
      e.preventDefault?.()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onBIP as EventListener)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onBIP as EventListener)
    }
  }, [])
  const showInstall = !!installEvt
  const mapHeight = view === 'explore' ? '100vh' : view === 'dashboard' ? '50vh' : '15vh'
  const statuses = [
    { label: '天氣：雨 24°C', color: 'yellow' as const },
    { label: '雨天備援路線啟用', color: 'yellow' as const },
    { label: '目前人潮普通', color: 'yellow' as const },
    { label: '信義商圈活動中', color: 'yellow' as const },
  ]
  const l2 = statuses.map((s) => ({ label: s.label, tone: 'yellow' as const }))
  const actions = ['找廁所', '找置物櫃', '去淺草', '避難']
  return (
    <div>
      {typeof window !== 'undefined' && !online && (
        <div className="fixed top-2 right-2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm z-[1000] shadow-md">
          離線狀態
        </div>
      )}
      {showInstall && (
        <button
          className="fixed bottom-4 right-4 bg-blue-800 text-white px-4 py-2 rounded-xl shadow-lg z-[1000] active:scale-95 transition-transform"
          onClick={() => {
            const ev = installEvt as { prompt?: () => Promise<void> }
            setInstallEvt(null)
            ev.prompt?.()
          }}
        >
          安裝到主畫面
        </button>
      )}
      <MapCanvas height={mapHeight} showBus={view !== 'explore' ? true : false} zone={zone} center={mapCenter || undefined} route={route || null} accessibility={accessibility || undefined} showPopup={view === 'explore'} onNodeSelected={(f) => {
        const nm = (f.properties as { name?: { ja?: string; en?: string; zh?: string } } | undefined)?.name
        const id = (f.properties as { id?: string } | undefined)?.id
        const coords = (f.geometry as { coordinates?: [number, number] } | undefined)?.coordinates
        if (nm) setNodeName(nm)
        if (id) setNodeId(id)
        if (Array.isArray(coords) && coords.length === 2) {
          const z = detectZoneFromPoint(coords[0], coords[1])
          setZone(z)
          setLastCoords(coords)
          setMapCenter(coords)
        }
        setView('dashboard')
      }} />
      {view === 'explore' && (
        <SearchBar onSubmit={(q) => { if (q.trim()) setView('dashboard') }} onMic={() => setShowAssistant(true)} />
      )}
      {view === 'dashboard' && (
        <div className="fixed left-0 right-0 bottom-0 max-h-[50vh] overflow-auto p-3 z-10">
          <NodeDashboard nodeId={nodeId || undefined} name={nodeName} statuses={l2} actions={actions} filterSuitability={(() => { const q = tagging.buildSuitabilityQuery(tagState.tags, 0.6); return { tag: q.tag, minConfidence: q.minConfidence } })()} onAction={(a) => { if (a.includes('去')) setView('task') }} onRouteHint={async (hint) => {
            const origin = Array.isArray(mapCenter) ? mapCenter : lastCoords
            if (!origin) return
            const [lon, lat] = origin
            let dst: [number, number] | null = null
            let mid: [number, number] | null = null
            try {
              if (nodeId) {
                const url = `/api/facilities?node_id=${encodeURIComponent(nodeId)}&type=${encodeURIComponent('elevator')}&limit=10`
                const r = await fetch(url)
                if (r.ok) {
                  const j = await r.json()
                  const items = Array.isArray(j?.items) ? j.items as { distance_meters?: number; direction?: string }[] : []
                  const best = items[0]
                  if (best && typeof best?.distance_meters === 'number' && best.distance_meters > 0) {
                    const dist = best.distance_meters
                    const dir = String(best.direction || '').toLowerCase()
                    const az = dir.includes('north') || dir.includes('北') ? 0
                      : dir.includes('east') || dir.includes('東') ? 90
                      : dir.includes('south') || dir.includes('南') ? 180
                      : dir.includes('west') || dir.includes('西') ? 270
                      : 45
                    const rad = (Math.PI / 180) * az
                    const dLat = (dist / 111320) * Math.cos(rad)
                    const dLon = (dist / (111320 * Math.cos((Math.PI / 180) * lat))) * Math.sin(rad)
                    mid = [lon + dLon * 0.5, lat + dLat * 0.5]
                    dst = [lon + dLon, lat + dLat]
                  }
                }
              }
            } catch {}
            if (!dst || !mid) {
              const dx = 0.002
              const dy = 0.0015
              mid = [lon + dx * 0.5, lat + dy * 0.5]
              dst = [lon + dx, lat + dy]
            }
            const fc: FeatureCollection = {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [origin, mid, dst] }, properties: { kind: 'route', via: 'elevator', hint } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: mid }, properties: { kind: 'elevator' } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: dst }, properties: { kind: 'exit' } },
              ],
            }
            setRoute(fc)
            setAccessibility({ preferElevator: prefersElevator(hint) || true })
          }} />
          <div className="mt-2">
            <TagFilterBar state={tagState} onRemove={(id) => setTagState((s) => tagging.deleteTag(s, id))} />
          </div>
          <div className="mt-2">
            <button className="rounded bg-gray-900 px-3 py-2 text-xs text-white" onClick={() => setSheetMode(sheetMode === 'collapsed' ? 'half' : sheetMode === 'half' ? 'full' : 'collapsed')}>標籤管理</button>
          </div>
          <BottomSheet mode={sheetMode} onModeChange={(m) => setSheetMode(m)} collapsedContent={<div className="text-xs text-gray-600">上滑以管理標籤</div>} halfContent={<TagManager value={tagState} onChange={setTagState} />} fullContent={<TagManager value={tagState} onChange={setTagState} />} />
        </div>
      )}
      {zone === 'buffer' && (
        <div className="fixed top-2 left-2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm z-[1000] shadow-md">
          此區域僅提供基本導航
        </div>
      )}
      {zone === 'outer' && (
        <div className="fixed top-2 left-2 bg-red-900/90 text-white px-4 py-3 rounded-xl z-[1000] shadow-lg backdrop-blur-md max-w-[90vw]">
          <div className="mb-2 text-sm font-medium">超出主要支援範圍：建議回到中心區域，或使用 Google 地圖規劃路線</div>
          <div className="flex gap-2">
            <button
              className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm active:scale-95 transition-transform"
              onClick={() => {
                const fallback = { lat: 35.681236, lon: 139.767125 }
                const lat = Array.isArray(lastCoords) ? lastCoords[1] : fallback.lat
                const lon = Array.isArray(lastCoords) ? lastCoords[0] : fallback.lon
                const url = `https://www.google.com/maps?q=${lat},${lon}`
                window.open(url, '_blank')
              }}
            >
              用 Google 地圖導航
            </button>
            <button
              className="bg-yellow-500 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm active:scale-95 transition-transform"
              onClick={() => {
                const core = getAdapter('tokyo_core')
                if (core) {
                  const [minLon, minLat, maxLon, maxLat] = core.bounds
                  const centerLon = (minLon + maxLon) / 2
                  const centerLat = (minLat + maxLat) / 2
                  setMapCenter([centerLon, centerLat])
                } else {
                  setMapCenter([139.7774, 35.7141])
                }
                setZone('core')
              }}
            >
              回到中心區域
            </button>
          </div>
        </div>
      )}
      {view === 'task' && (
        <div className="fixed left-0 right-0 bottom-0 max-h-[85vh] overflow-auto p-3 z-10">
          <TaskMode destination={'淺草'} />
        </div>
      )}
      {view !== 'explore' && (
        <button
          className="fixed bottom-20 right-4 bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg z-[1000] active:scale-95 transition-transform"
          onClick={() => setShowAssistant(true)}
        >
          <span style={{ fontSize: 24 }}>🤖</span>
        </button>
      )}
      {view === 'dashboard' && (
        <button
          style={{ position: 'fixed', bottom: 140, right: 16, background: '#111827', color: '#fff', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 1000 }}
          onClick={() => { setRoute(null); setAccessibility(null) }}
        >
          <span style={{ fontSize: 18 }}>✕</span>
        </button>
      )}
      <FullScreenAssistant open={showAssistant} onClose={() => setShowAssistant(false)} />
    </div>
  )
}
