'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Header, { BreadcrumbItem } from '../components/layout/Header'
import MapCanvas from '../components/map/MapCanvas'
import MobileViewport from '../components/layout/MobileViewport'
import { FABGroup } from '../components/features/controls/FABGroup'
import { AlertBanner, Alert, SystemAlert } from '../components/ui/AlertBanner'
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
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { useAIControl } from '../hooks/useAIControl'
import { AICommand } from '@/lib/ai/control/types'
import NavigationMenu from '../components/layout/NavigationMenu'
import { NavigationStep } from '@/types/navigation'
import { Bot, Navigation, Share2, X, AlertTriangle, Layers, Wifi } from 'lucide-react'
import { useSOP } from '../contexts/SOPContext'
import { findNearestFacility, fetchWalkingRoute, DisasterZone } from '../lib/sop/engine'
import { L3ServiceFacility } from '../types/tagging'

export default function Home() {
  const { t, locale } = useLanguage()
  const { mode, targetCategory } = useSOP()

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
  const [showAssistant, setShowAssistant] = useState(false)
  const [mapFilter, setMapFilter] = useState<{ tag?: string; status?: string } | undefined>(undefined)
  const [weatherAlerts, setWeatherAlerts] = useState<Alert[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [envStatuses, setEnvStatuses] = useState<{ label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }[]>([])
  const [disasterZones, setDisasterZones] = useState<DisasterZone[]>([])
  const [mapStyleIndex, setMapStyleIndex] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([])
  const [triggerGeolocate, setTriggerGeolocate] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const qNodeId = params.get('nodeId')
      if (qNodeId) {
        setNodeId(qNodeId)
        setView('dashboard')
        setSheetMode('half')
      }
    }
  }, [])

  const systemAlertTimersRef = useRef<Map<string, number>>(new Map())
  const alertDedupeRef = useRef<Map<string, number>>(new Map())

  const recordClientLog = useCallback((entry: { level: 'error' | 'warn' | 'info'; message: string; data?: Record<string, unknown> }) => {
    if (typeof window === 'undefined') return
    try {
      const key = 'bambigo_client_logs'
      const raw = window.localStorage.getItem(key)
      const arr = raw ? (JSON.parse(raw) as unknown[]) : []
      const next = Array.isArray(arr) ? arr.slice(-199) : []
      next.push({ ts: new Date().toISOString(), ...entry })
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {}
  }, [])

  const pushSystemAlert = useCallback((input: { severity: SystemAlert['severity']; title: string; summary: string; ttlMs?: number; dedupeMs?: number }) => {
    const now = Date.now()
    const key = `${input.severity}:${input.title}:${input.summary}`
    const dedupeMs = typeof input.dedupeMs === 'number' ? input.dedupeMs : 15000
    const last = alertDedupeRef.current.get(key) || 0
    if (now - last < dedupeMs) return
    alertDedupeRef.current.set(key, now)

    const id = `sys-${now}-${Math.random().toString(16).slice(2)}`
    const alert: SystemAlert = {
      id,
      type: 'system',
      severity: input.severity,
      title: input.title,
      summary: input.summary,
    }

    setSystemAlerts((prev) => [alert, ...prev].slice(0, 8))

    const ttl = typeof input.ttlMs === 'number'
      ? input.ttlMs
      : input.severity === 'high'
        ? 15000
        : input.severity === 'medium'
          ? 10000
          : 8000

    const timer = window.setTimeout(() => {
      setSystemAlerts((prev) => prev.filter((a) => a.id !== id))
      systemAlertTimersRef.current.delete(id)
    }, ttl)
    systemAlertTimersRef.current.set(id, timer)
  }, [])

  useEffect(() => {
    const timers = systemAlertTimersRef.current
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onError = (ev: ErrorEvent) => {
      recordClientLog({
        level: 'error',
        message: ev.message || 'Unhandled error',
        data: {
          filename: ev.filename,
          lineno: ev.lineno,
          colno: ev.colno,
        },
      })
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason)
      recordClientLog({ level: 'error', message: reason || 'Unhandled rejection' })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [recordClientLog])

  const handleLocationError = useCallback((error: string) => {
    recordClientLog({ level: 'warn', message: `location:${error}` })

    if (error === 'OUT_OF_RANGE') {
      pushSystemAlert({
        severity: 'medium',
        title: t('common.outOfRange') || '超出服務範圍',
        summary: '你目前距離服務節點超過 50 公里，已為你自動定位至上野車站。你可以手動選擇其他車站。',
        dedupeMs: 60000,
      })
      return
    }

    if (error === 'PERMISSION_DENIED') {
      pushSystemAlert({
        severity: 'medium',
        title: t('common.locationDenied') || '定位權限被拒絕',
        summary: '無法取得位置權限，請檢查瀏覽器設定。',
        dedupeMs: 60000,
      })
      return
    }

    if (error === 'TIMEOUT') {
      pushSystemAlert({
        severity: 'low',
        title: t('common.locationDenied') || '定位逾時',
        summary: '定位逾時，已使用預設位置。',
        dedupeMs: 30000,
      })
      return
    }

    if (error === 'POSITION_UNAVAILABLE') {
      pushSystemAlert({
        severity: 'low',
        title: t('common.locationDenied') || '定位不可用',
        summary: '目前無法取得定位資訊，已使用預設位置。',
        dedupeMs: 30000,
      })
    }
  }, [pushSystemAlert, recordClientLog, t])

  const mockNodes = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'mock-tokyo',
        geometry: { type: 'Point', coordinates: [139.7671, 35.6812] },
        properties: { 
          id: 'mock-tokyo',
          name: { ja: '東京駅', en: 'Tokyo Station', zh: '東京站' },
          category: 'station'
        }
      },
      {
        type: 'Feature',
        id: 'mock-ueno',
        geometry: { type: 'Point', coordinates: [139.7774, 35.7141] },
        properties: { 
          id: 'mock-ueno',
          name: { ja: '上野駅', en: 'Ueno Station', zh: '上野站' },
          category: 'station'
        }
      },
      {
        type: 'Feature',
        id: 'mock-ginza',
        geometry: { type: 'Point', coordinates: [139.763965, 35.671989] },
        properties: { 
          id: 'mock-ginza',
          name: { ja: '銀座駅', en: 'Ginza Station', zh: '銀座站' },
          category: 'station'
        }
      }
    ]
  }), [])

  const handleReportHazard = useCallback(() => {
    if (!mapCenter) return
    
    const [lon, lat] = mapCenter
    const offset = 0.001
    const newZone: DisasterZone = {
      id: `hazard-${Date.now()}`,
      type: 'closure',
      severity: 'high',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lon - offset, lat - offset],
          [lon + offset, lat - offset],
          [lon + offset, lat + offset],
          [lon - offset, lat + offset],
          [lon - offset, lat - offset]
        ]]
      }
    }
    
    setDisasterZones(prev => [...prev, newZone])
    pushSystemAlert({
      severity: 'low',
      title: t('common.hazardReported') || 'Hazard reported',
      summary: '已建立一個新的危險區域，導航將自動避開。',
      dedupeMs: 5000,
    })
    
    if (mode === 'emergency') {
    }
  }, [mapCenter, mode, pushSystemAlert, t])

  const handleReportHazardRef = useRef(handleReportHazard)
  useEffect(() => {
    handleReportHazardRef.current = handleReportHazard
  }, [handleReportHazard])

  const handleAICommand = useCallback((cmd: AICommand) => {
    console.log('🤖 AI Command:', cmd)
    if (cmd.type === 'VIEW_MODE') setView(cmd.payload.mode)
    if (cmd.type === 'SET_FILTER') setMapFilter({ tag: cmd.payload.tag, status: cmd.payload.status })
    if (cmd.type === 'TOGGLE_MENU') setIsMenuOpen(cmd.payload.open)
    if (cmd.type === 'UPDATE_NAVIGATION') {
      setNavigationSteps(cmd.payload.steps)
      setView('task')
    }
    if (cmd.type === 'NAVIGATE') {
      if (cmd.payload.to) {
        setView('task')
      }
    }
    if (cmd.type === 'REPORT_HAZARD') {
      handleReportHazardRef.current()
    }
  }, [])

  const aiControlEnabled = typeof navigator === 'undefined' ? true : !/Playwright/i.test(navigator.userAgent)
  useAIControl(handleAICommand, { enabled: aiControlEnabled })

  const prefersElevator = (hint: string) => /電梯|無障礙|wheelchair|elevators?|エレベータ(ー)?|バリアフリー|車椅子/i.test(hint)

  const currentLocationName = useMemo(() => {
    return nodeName?.[locale as 'ja' | 'en' | 'zh'] || nodeName?.zh || undefined
  }, [nodeName, locale])

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: t('common.home'), onClick: () => setView('explore') }]
    if (view === 'dashboard' || view === 'task') {
      const name = nodeName?.[locale as 'ja'|'en'|'zh'] || nodeName?.zh || t('header.defaultLocation')
      items.push({ label: name, onClick: () => setView('dashboard'), active: view === 'dashboard' })
    }
    if (view === 'task') {
      items.push({ label: t('navigation.title') || 'Navigation', active: true })
      if (items.length > 1) items[1].active = false
    }
    return items
  }, [view, nodeName, locale, t])

  // -- Effects --

  // Weather Alerts
  useEffect(() => {
    const triggerSOP = async () => {
      if (mode === 'emergency' && targetCategory) {
        console.log('🚨 SOP Activated:', targetCategory)
        
        const start: [number, number] = mapCenter || lastCoords || [139.777, 35.713] // Fallback to Ueno
        
        try {
          // 1. Fetch real facilities from DB
          const { data, error } = await supabase
            .from('facilities')
            .select('*, nodes(location, name)')
            .eq('type', targetCategory)
            .limit(20)

          if (error) throw error

          const facilities: L3ServiceFacility[] = (data || []).map(f => ({
            id: f.id,
            nodeId: f.node_id,
            category: f.type,
            subCategory: f.attributes?.sub_type || 'default',
            location: {
              coordinates: [f.nodes.location.coordinates[0], f.nodes.location.coordinates[1]] as [number, number]
            },
            provider: { type: 'public' },
            attributes: {
              ...f.attributes,
              ja: f.nodes.name?.ja,
              en: f.nodes.name?.en,
              zh: f.nodes.name?.zh,
            },
            source: 'official'
          }))

          // 2. Find nearest
          const nearest = findNearestFacility(start, facilities, targetCategory)
          
          if (nearest && nearest.location.coordinates) {
            console.log('📍 Found Nearest:', nearest.attributes.ja)
            
            // 3. Fetch Real Route (Phase 3 & 4)
            const sopRoute = await fetchWalkingRoute(start, nearest.location.coordinates, {
              avoidZones: disasterZones
            })

            // 4. Update UI
            setView('explore')
            setSheetMode('collapsed')
            setRoute(sopRoute)
            
            // Extract and set navigation steps (Phase 3)
            const steps = sopRoute.features[0]?.properties?.steps as NavigationStep[] | undefined
            if (steps) setNavigationSteps(steps)
            
            // Optionally update node name to show destination
            const attrs = nearest.attributes as { ja?: string; en?: string; zh?: string }
            setNodeName({
              ja: attrs.ja,
              en: attrs.en,
              zh: attrs.zh
            })
          }
        } catch (err) {
          console.error('Failed to execute SOP navigation:', err)
        }
      }
    }

    triggerSOP()
  }, [mode, targetCategory, mapCenter, lastCoords, disasterZones])

  useEffect(() => {
    fetch('/api/weather/alerts')
      .then(r => r.json())
      .then(data => {
        if (data.alerts && Array.isArray(data.alerts)) setWeatherAlerts(data.alerts)
      })
      .catch(err => console.error('Failed to fetch alerts:', err))
  }, [])

  // Online/Offline & PWA Install
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

  // Supabase Check
  useEffect(() => {
    const testSupabase = async () => {
      try {
        const { data, error } = await supabase.from('facilities').select('count', { count: 'exact', head: true })
        if (error) console.error('❌ Supabase Connection Failed:', error.message)
        else console.log('✅ Supabase Connection Successful! Facility Count:', data)
      } catch (err) {
        console.error('❌ Supabase Connection Exception:', err)
      }
    }
    testSupabase()
  }, [])

  // Weather/Env Status
  useEffect(() => {
    const base: { label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }[] = [
      { label: `${t('common.version')}：v1.2.0`, tone: 'blue' },
    ]
    function updateWithWeather(lat: number, lon: number) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      fetch(url)
        .then((r) => r.json())
        .then((j) => {
          const cw = j?.current_weather
          if (cw && typeof cw?.temperature === 'number') {
            const temp = Math.round(cw.temperature)
            const wcode = Number(cw.weathercode || 0)
            const isRain = [51,53,55,61,63,65,80,81,82].includes(wcode)
            const list = base.slice()
            list.push({ label: `${t('header.weather')}：${isRain ? '🌧️' : '☀️'} ${temp}°C`, tone: isRain ? 'yellow' : 'green' })
            if (isRain) list.push({ label: t('header.rainRoute'), tone: 'yellow' })
            setEnvStatuses(list)
          } else {
            setEnvStatuses(base)
          }
        })
        .catch(() => setEnvStatuses(base))
    }
    const fallback = lastCoords || mapCenter || [139.767125, 35.681236]
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateWithWeather(pos.coords.latitude, pos.coords.longitude),
        () => updateWithWeather(fallback[1], fallback[0]),
        { enableHighAccuracy: false, timeout: 3000 }
      )
    } else {
      updateWithWeather(fallback[1], fallback[0])
    }
  }, [lastCoords, mapCenter, t])

  // -- Handlers --

  const handleNodeSelected = (f: GeoJSON.Feature) => {
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
    setSheetMode('half') // Open sheet to 60%
  }

  const handleRouteHint = async (hint: string) => {
    const origin = Array.isArray(mapCenter) ? mapCenter : lastCoords
    if (!origin) return
    const [lon, lat] = origin
    let dst: [number, number] | null = null
    let mid: [number, number] | null = null
    
    // Attempt to find elevator
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
    
    // Fallback simulation
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
  }

  // -- FAB Actions --
  const fabActions = useMemo(() => {
    const common = [
      {
        id: 'gps',
        icon: <Navigation className="w-6 h-6" />,
        label: t('common.gps') || '定位',
        onClick: () => setTriggerGeolocate(prev => prev + 1),
        variant: 'primary' as const
      },
      {
        id: 'ai',
        icon: <Bot className="w-6 h-6" />,
        label: 'AI Assistant',
        onClick: () => setShowAssistant(true),
        onLongPress: () => {
          if (navigator.vibrate) navigator.vibrate([50, 50, 50])
          pushSystemAlert({
            severity: 'low',
            title: 'AI',
            summary: '語音模式尚未開放',
            dedupeMs: 5000,
          })
        },
        variant: 'primary' as const
      }
    ]

    if (view === 'explore') {
      return [
        ...common,
        {
          id: 'layers',
          icon: <Layers className="w-6 h-6" />,
          label: 'Map Layers',
          onClick: () => setMapStyleIndex(prev => (prev + 1) % 3),
          onLongPress: () => pushSystemAlert({ severity: 'low', title: 'Map', summary: '進階設定尚未開放', dedupeMs: 5000 }),
          variant: 'secondary' as const
        }
      ]
    }

    if (view === 'dashboard') {
      return [
        {
          id: 'close',
          icon: <X className="w-6 h-6" />,
          label: 'Close',
          onClick: () => {
            setView('explore')
            setRoute(null)
            setAccessibility(null)
            setSheetMode('collapsed')
          },
          variant: 'secondary' as const
        },
        ...common,
        {
          id: 'navigate',
          icon: <Navigation className="w-6 h-6" />,
          label: 'Navigate',
          onClick: () => setView('task'),
          onLongPress: () => pushSystemAlert({ severity: 'low', title: 'Navigation', summary: '快速回到首頁尚未開放', dedupeMs: 5000 }),
          variant: 'primary' as const
        }
      ]
    }

    if (view === 'task') {
      return []
    }

    return common
  }, [view, t, setTriggerGeolocate, setShowAssistant, pushSystemAlert, setMapStyleIndex])

  const secondaryFabActions = useMemo(() => [
    {
      id: 'wifi',
      icon: <Wifi className="w-5 h-5" />,
      label: 'Offline Mode',
      onClick: () => setOnline(!online),
    },
    {
      id: 'share',
      icon: <Share2 className="w-5 h-5" />,
      label: 'Share Route',
      onClick: () => {
        if (navigator.share) navigator.share({ title: 'BambiGO Route', url: window.location.href })
      },
    },
    {
      id: 'emergency',
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      label: 'Emergency',
      onClick: () => pushSystemAlert({ severity: 'medium', title: 'SOS', summary: '緊急求救尚未開放', dedupeMs: 5000 }),
      variant: 'danger' as const
    }
  ], [online, pushSystemAlert])

  const showInstall = !!installEvt
  const actions = [t('actions.toilet'), t('actions.locker'), t('actions.asakusa'), t('actions.evacuate')]

  const handleDashboardAction = (action: string) => {
     if (action === 'ai_assistant') {
       setShowAssistant(true)
     } else if (action.includes('去')) {
       setView('task')
     } else if (action.startsWith('app:filter')) {
       try {
         const url = new URL(action.replace('app:', 'http://dummy/'))
         const tag = url.searchParams.get('tag') || undefined
         const status = url.searchParams.get('status') || undefined
         const indoor = url.searchParams.get('indoor')
         let finalTag = tag
         if (indoor === 'true') finalTag = 'indoor'
         setMapFilter({ tag: finalTag, status })
         setView('explore')
         setNodeId(null)
       } catch {}
     }
   }

  return (
    <MobileViewport>
      <Header 
        breadcrumbs={breadcrumbs} 
        onMenuClick={() => setIsMenuOpen(true)} 
        locationName={currentLocationName}
      />
      
      <NavigationMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onSystemAlert={pushSystemAlert} />
      
      {/* Layer 0: Map Background */}
      <div className="absolute inset-0 z-0">
        <MapCanvas 
          height="100%"
          showBus={view !== 'explore'}
          zone={zone}
          center={mapCenter || undefined}
          route={route || null}
          accessibility={accessibility || undefined}
          showPopup={view === 'explore'}
          onNodeSelected={handleNodeSelected}
          onLocationError={handleLocationError}
          triggerGeolocate={triggerGeolocate}
          nodes={mockNodes}
          styleIndex={mapStyleIndex}
          locale={locale}
        />
      </div>

      {/* Layer 1: Bottom Search (Explore mode only) */}
      {view === 'explore' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <SearchBar 
              onSubmit={(q) => { 
                if (!q.trim()) return
                const query = q.toLowerCase()
                const found = mockNodes.features.find(f => {
                  const props = f.properties as { name: { ja?: string; en?: string; zh?: string } }
                  return props.name.zh?.toLowerCase().includes(query) || 
                         props.name.ja?.toLowerCase().includes(query) || 
                         props.name.en?.toLowerCase().includes(query)
                })
                if (found) {
                  handleNodeSelected(found)
                } else {
                  setView('dashboard') 
                }
              }} 
              onMic={() => setShowAssistant(true)} 
            />
          </div>
        </div>
      )}

      {/* Layer 2: Top UI (Alerts, Offline Indicator, Filter) */}
      <div className="absolute top-16 left-0 right-0 z-10 p-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          <AlertBanner alerts={[...systemAlerts, ...weatherAlerts]} />
          
          {/* Offline Indicator */}
          {typeof window !== 'undefined' && !online && (
            <div className="flex justify-end">
               <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm shadow-md flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-yellow-500" />
                 {t('common.offline')}
               </div>
            </div>
          )}

          {/* Filter Indicator */}
          {mapFilter && view === 'explore' && (
             <div className="flex justify-center">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-4">
                <span>Filtering: {mapFilter.tag}</span>
                {mapFilter.status && <span className="text-blue-200 text-xs">({mapFilter.status.replace('_', ' ')})</span>}
                <button 
                  onClick={() => setMapFilter(undefined)}
                  className="ml-2 w-5 h-5 flex items-center justify-center hover:bg-blue-700 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Zone Alerts */}
          {zone === 'outer' && (
            <div className="mt-2 bg-red-900/90 text-white px-4 py-3 rounded-xl shadow-lg backdrop-blur-md">
              <div className="mb-2 text-sm font-medium">{t('common.outOfRange')}</div>
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
                  {t('common.openGoogleMaps')}
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
                  {t('common.backToCenter')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer 2: Main Content (BottomSheet / Task) */}
      {view === 'dashboard' && (
        <BottomSheet 
          mode={sheetMode} 
          onModeChange={setSheetMode} 
          collapsedContent={<div className="text-xs text-gray-600 text-center py-2">{t('common.swipeUpForDetails')}</div>} 
          halfContent={
            <div className="p-4 h-full overflow-y-auto">
              <NodeDashboard 
                nodeId={nodeId || undefined} 
                name={nodeName} 
                statuses={envStatuses} 
                actions={actions} 
                filterSuitability={(() => { const q = tagging.buildSuitabilityQuery(tagState.tags, 0.6); return { tag: q.tag, minConfidence: q.minConfidence } })()} 
                onAction={handleDashboardAction} 
                onRouteHint={handleRouteHint} 
                onSystemAlert={pushSystemAlert}
                onClientLog={recordClientLog}
              />
              <div className="mt-4 pb-20">
                <TagFilterBar state={tagState} onRemove={(id) => setTagState((s) => tagging.deleteTag(s, id))} />
                <div className="mt-2">
                   <button className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700 w-full" onClick={() => setSheetMode('full')}>{t('common.manageTags')}</button>
                </div>
              </div>
            </div>
          } 
          fullContent={<TagManager value={tagState} onChange={setTagState} />} 
        />
      )}

      {view === 'task' && (
        <div className="absolute inset-0 z-50 bg-white/10 backdrop-blur-[2px] pointer-events-auto overflow-hidden animate-in fade-in duration-300">
          <TaskMode 
            destination={(typeof nodeName === 'string' ? nodeName : nodeName[locale === 'zh-TW' ? 'zh' : (locale as 'ja' | 'en' | 'zh')] || nodeName.zh) || null} 
            onExit={() => {
              setView('explore')
              setRoute(null)
              setNavigationSteps([])
            }} 
            steps={navigationSteps} 
          />
        </div>
      )}

      {/* Layer 3: Controls (FAB) */}
      <FABGroup mainActions={fabActions} secondaryActions={secondaryFabActions} />

      {/* Install Button (Special) */}
      {showInstall && (
        <div className="fixed bottom-4 left-4 z-50">
           <button
            className="bg-blue-800 text-white px-4 py-2 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center gap-2"
            onClick={() => {
              const ev = installEvt as { prompt?: () => Promise<void> }
              setInstallEvt(null)
              ev.prompt?.()
            }}
          >
            {t('common.install')}
          </button>
        </div>
      )}

      {/* Assistants / Dialogs */}
      <FullScreenAssistant open={showAssistant} onClose={() => setShowAssistant(false)} nodeId={nodeId || undefined} />
    </MobileViewport>
  )
}
