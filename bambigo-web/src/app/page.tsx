'use client'
import { useEffect, useState } from 'react'
import MapCanvas from '../../components/map/MapCanvas'
import SearchBar from '../components/views/SearchBar'
import NodeDashboard from '../components/views/NodeDashboard'
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
        <div style={{ position: 'fixed', top: 8, right: 8, background: '#222', color: '#fff', padding: '6px 10px', borderRadius: 6, zIndex: 1000 }}>
          離線狀態
        </div>
      )}
      {showInstall && (
        <button
          style={{ position: 'fixed', bottom: 16, right: 16, background: '#0b3d91', color: '#fff', padding: '8px 12px', borderRadius: 8, zIndex: 1000 }}
          onClick={() => {
            const ev = installEvt as { prompt?: () => Promise<void> }
            setInstallEvt(null)
            ev.prompt?.()
          }}
        >
          安裝到主畫面
        </button>
      )}
      <MapCanvas height={mapHeight} showBus={view !== 'explore' ? true : false} zone={zone} center={mapCenter || undefined} onNodeSelected={(f) => {
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
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '50vh', overflow: 'auto', padding: 12 }}>
          <NodeDashboard nodeId={nodeId || undefined} name={nodeName} statuses={l2} actions={actions} onAction={(a) => { if (a.includes('去')) setView('task') }} />
        </div>
      )}
      {zone === 'buffer' && (
        <div style={{ position: 'fixed', top: 8, left: 8, background: '#111827', color: '#fff', padding: '6px 10px', borderRadius: 6, zIndex: 1000 }}>
          此區域僅提供基本導航
        </div>
      )}
      {zone === 'outer' && (
        <div style={{ position: 'fixed', top: 8, left: 8, background: '#7f1d1d', color: '#fff', padding: '8px 12px', borderRadius: 8, zIndex: 1000 }}>
          <div style={{ marginBottom: 6 }}>超出主要支援範圍：建議回到中心區域，或使用 Google 地圖規劃路線</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ background: '#fff', color: '#111827', padding: '4px 8px', borderRadius: 6 }}
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
              style={{ background: '#f59e0b', color: '#111827', padding: '4px 8px', borderRadius: 6 }}
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
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '85vh', overflow: 'auto', padding: 12 }}>
          <TaskMode destination={'淺草'} />
        </div>
      )}
      {view !== 'explore' && (
        <button
          style={{ position: 'fixed', bottom: 80, right: 16, background: '#2563eb', color: '#fff', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 1000 }}
          onClick={() => setShowAssistant(true)}
        >
          <span style={{ fontSize: 24 }}>🤖</span>
        </button>
      )}
      <FullScreenAssistant open={showAssistant} onClose={() => setShowAssistant(false)} />
    </div>
  )
}
