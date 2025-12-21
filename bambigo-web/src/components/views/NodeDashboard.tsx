'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Edit2, MessageSquare, ChevronRight, Bell, ShieldCheck } from 'lucide-react'
import ActionCarousel from '../cards/ActionCarousel'
import FacilityList from '../lists/FacilityList'
import NodeFacilityManager from './NodeFacilityManager'
import { useAuth } from '../auth/AuthContext'
import { derivePersonaFromFacilities } from '../../lib/tagging'
import { supabase } from '../../lib/supabase'
import { L1_CATEGORIES_DATA } from '../tagging/constants'
import { L3ServiceFacility, L4ActionCard, L4CardType } from '../../types/tagging'
import { adaptFacilityItem } from '../../lib/adapters/facilities'
import { FacilityItem } from '../../app/api/facilities/route'
import NodeDetailCard from '../cards/NodeDetailCard'
import { WeatherAlert } from '../../lib/weather/jma_rss'
import type { CategoryCounts } from '../node/FacilityProfile'
import L2StatusMarquee from './L2StatusMarquee'
import { getStationIdentity } from '../../config/station-identity'

type Name = { ja?: string; en?: string; zh?: string }
type Status = { label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }
interface Station {
  id: string;
  name: string;
  bikes_available: number;
  docks_available: number;
}
type Props = {
  nodeId?: string
  name: Name
  statuses: Status[]
  actions: string[]
  weatherAlerts?: WeatherAlert[]
  onAction: (a: string) => void
  onRouteHint?: (hint: string) => void
  filterSuitability?: { tag?: string; minConfidence?: number }
  onSystemAlert?: (input: { severity: 'high' | 'medium' | 'low'; title: string; summary: string; ttlMs?: number; dedupeMs?: number }) => void
  onClientLog?: (entry: { level: 'error' | 'warn' | 'info'; message: string; data?: Record<string, unknown> }) => void
}

import { useLanguage } from '../../contexts/LanguageContext'

export default function NodeDashboard({ nodeId, name, weatherAlerts = [], onAction, onRouteHint, filterSuitability, onSystemAlert, onClientLog }: Props) {
  const { t } = useLanguage()
  const { user, session } = useAuth()
  const identity = useMemo(() => getStationIdentity(nodeId), [nodeId])
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<L4ActionCard[]>([])
  const [facilities, setFacilities] = useState<L3ServiceFacility[]>([])
  const [stations, setStations] = useState<{ id: string; name: string; bikes_available: number; docks_available: number }[]>([])
  const [nodeType, setNodeType] = useState<string>('')
  const [nodeZone, setNodeZone] = useState<'core' | 'buffer' | 'outer'>('core')
  const [transitStatus, setTransitStatus] = useState<string | undefined>(undefined)
  const [transitDelay, setTransitDelay] = useState<number | undefined>(undefined)
  const [isEditingFacilities, setIsEditingFacilities] = useState(false)
  const [isLineBound, setIsLineBound] = useState(false)
  const [isTripGuardActive, setIsTripGuardActive] = useState(false)
  const [facilityCounts, setFacilityCounts] = useState<CategoryCounts | null>(null)
  const [vibeTags, setVibeTags] = useState<string[]>([])
  const [odptStation, setOdptStation] = useState<{
    station_code?: string
    railway?: string
    operator?: string
    connecting_railways?: string[]
    exits?: string[]
    raw?: unknown
  } | null>(null)

  // User State Selector
  const [userStates, setUserStates] = useState<string[]>([])
  const USER_STATE_OPTIONS = [
    { id: 'large_luggage', label: '🧳 大型行李', color: 'blue' },
    { id: 'stroller', label: '👶 推嬰兒車', color: 'pink' },
    { id: 'mobility_impaired', label: '♿ 行動不便', color: 'purple' },
    { id: 'rush', label: '⚡ 趕時間', color: 'red' }
  ]

  const toggleUserState = (id: string) => {
    setUserStates(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const notify = (input: { severity: 'high' | 'medium' | 'low'; title: string; summary: string; ttlMs?: number; dedupeMs?: number }) => {
    onSystemAlert?.(input)
  }

  const normalizeCategoryCounts = (value: unknown): CategoryCounts | null => {
    const v = (value ?? {}) as Record<string, unknown>
    const keys: Array<keyof CategoryCounts> = ['shopping', 'dining', 'medical', 'education', 'leisure', 'finance']
    const result = {
      shopping: 0,
      dining: 0,
      medical: 0,
      education: 0,
      leisure: 0,
      finance: 0
    } satisfies CategoryCounts

    let hasAny = false
    for (const k of keys) {
      const n = Number(v[k])
      if (Number.isFinite(n)) {
        result[k] = n
        if (n !== 0) hasAny = true
      }
    }
    return hasAny ? result : null
  }

  const isAbortError = (e: unknown) => {
    const err = e as { name?: unknown; message?: unknown } | null
    const name = err && typeof err === 'object' ? String(err.name || '') : ''
    const message = err && typeof err === 'object' ? String(err.message || '') : ''
    if (name === 'AbortError') return true
    const m = message.toLowerCase()
    return m.includes('abort') || m.includes('aborted') || m.includes('canceled') || m.includes('cancelled')
  }

  // Derive Persona when dependencies change
  const persona = useMemo(() => {
    const l1 = L1_CATEGORIES_DATA.find(c => c.id === nodeType || c.subCategories.some(s => s.id === nodeType))
    const l1Main = l1?.id
    const l1Sub = nodeType
    return derivePersonaFromFacilities(
      facilities.map(f => {
          const attrs = f.attributes as Record<string, unknown>
          return { 
            type: f.subCategory, 
            has_wheelchair_access: !!attrs.has_wheelchair_access,
            has_baby_care: !!attrs.has_baby_care 
          }
      }), 
      {  
        l1MainCategory: l1Main, 
        l1SubCategory: l1Sub,
        transit: { status: transitStatus } 
      }
    )
  }, [facilities, nodeType, transitStatus])

  // Cleanup SSE on unmount to prevent resource leaks
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      if (!nodeId) return
      setLoading(true)

      try {
        // 1. Fetch Node Type & L1 Profile
        let resolvedNodeType = ''
        if (!nodeId.startsWith('mock-')) {
          const { data: nodeData } = await supabase.from('nodes').select('type, zone').eq('id', nodeId).single()
          resolvedNodeType = String(nodeData?.type || resolvedNodeType || '')
          if (!ignore && nodeData?.type) setNodeType(nodeData.type)
          if (!ignore && nodeData?.zone) setNodeZone(nodeData.zone as 'core' | 'buffer' | 'outer')

          const { data: profileData } = await supabase
            .from('node_facility_profiles')
            .select('category_counts, vibe_tags')
            .eq('node_id', nodeId)
            .single()
          
          if (!ignore && profileData) {
            setFacilityCounts(normalizeCategoryCounts(profileData.category_counts))
            setVibeTags(profileData.vibe_tags || [])
          }
        } else {
          resolvedNodeType = 'station'
          if (!ignore) setNodeType('station')
        }

        // 2. Fetch Live Facilities & Mobility
        const params = new URLSearchParams({ node_id: nodeId, limit_facilities: '20', limit_mobility: '50' })
        if (filterSuitability?.tag) params.set('suitability', filterSuitability.tag)
        if (typeof filterSuitability?.minConfidence === 'number') params.set('min_confidence', String(filterSuitability.minConfidence))
        
        const r = await fetch(`/api/nodes/live/facilities?${params.toString()}`)
        if (!r.ok) throw new Error('Live data fetch failed')
        
        const j = await r.json()
        const rawItems = Array.isArray(j?.facilities?.items) ? (j.facilities?.items as FacilityItem[]) : []
        const adaptedItems = rawItems.map(adaptFacilityItem)
        const sts = Array.isArray(j?.live?.mobility?.stations) ? (j.live?.mobility?.stations as Station[]) : []
        const tStatus = j?.live?.transit?.status
        const delay = j?.live?.transit?.delay_minutes
        const odptSt = j?.live?.odpt_station

        const l1 = L1_CATEGORIES_DATA.find(c => c.id === resolvedNodeType || c.subCategories.some(s => s.id === resolvedNodeType))
        const personaLabels = derivePersonaFromFacilities(
          adaptedItems.map(f => {
            const attrs = f.attributes as Record<string, unknown>
            return {
              type: f.subCategory,
              has_wheelchair_access: !!attrs.has_wheelchair_access,
              has_baby_care: !!attrs.has_baby_care
            }
          }),
          {
            l1MainCategory: l1?.id,
            l1SubCategory: resolvedNodeType,
            transit: { status: tStatus }
          }
        )

        // 3. Fetch AI Strategy
        let strategyCards: L4ActionCard[] = []
        try {
          const sRes = await fetch(`/api/nodes/${nodeId}/strategy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: new Date().toISOString(),
              personaLabels,
              transitStatus: tStatus,
              odptStation: odptSt,
              userStates: userStates
            })
          })
          if (sRes.ok) {
            const sData = await sRes.json()
            if (Array.isArray(sData)) strategyCards = sData
          }
        } catch (e) {
          if (isAbortError(e)) throw e
          onClientLog?.({ level: 'warn', message: 'strategy:fetchFailed', data: { nodeId } })
        }

        if (!ignore) {
          const newCards: L4ActionCard[] = []
          
          // Shared Mobility Card
          const availableBikes = sts.reduce((sum, s) => sum + (Number(s.bikes_available) || 0), 0)
          if (availableBikes > 0) {
            newCards.push({
              id: 'mobility-bike',
              type: 'primary',
              title: t('dashboard.bikeTitle'),
              description: t('dashboard.bikeDesc').replace('{n}', String(sts.length)).replace('{count}', String(availableBikes)),
              rationale: 'Mobility',
              tags: ['transport', 'bike'],
              actions: [{ label: t('dashboard.bikeAction'), action: 'app:bike' }]
            })
          }

          // Transit Card
          if (tStatus === 'delayed' || tStatus === 'suspended') {
            newCards.push({
              id: 'transit-alert',
              type: 'alert',
              title: t('dashboard.transitTitle'),
              description: `${t('common.monitoring').split('：')[0]}：${tStatus === 'delayed' ? t('dashboard.transitDelayed') : t('dashboard.transitSuspended')}${typeof delay === 'number' && delay > 0 ? `（${t('dashboard.transitDelayMinutes').replace('{n}', String(delay))}）` : ''}`,
              rationale: 'Alert',
              tags: ['transport', 'warning'],
              actions: [{ label: t('dashboard.transitAlternative'), action: 'app:transit' }]
            })
          }

          setTransitStatus(tStatus)
          setTransitDelay(delay)
          setFacilities(adaptedItems)
          setStations(sts)
          setOdptStation(odptSt)
          setCards([...newCards, ...strategyCards])
          setLoading(false)
        }
      } catch (e) {
        if (isAbortError(e)) return
        onClientLog?.({
          level: 'error',
          message: 'dashboard:fetchFailed',
          data: { nodeId, error: e instanceof Error ? e.message : String(e) },
        })
        if (!ignore) setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      void fetchData()
    }, 150)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [nodeId, filterSuitability?.tag, filterSuitability?.minConfidence, t, onClientLog, userStates])

  const getL1Breadcrumb = () => {
    if (!nodeType) return null
    const l1 = L1_CATEGORIES_DATA.find(c => c.id === nodeType || c.subCategories.some(s => s.id === nodeType))
    if (l1) return { label: t(`tagging.l1.${l1.id}.label`), icon: l1.icon }
    if (nodeType === 'station') return { label: `${t('dashboard.transport')} (${t('header.langLabel') === '日' ? '交通' : 'Transport'})`, icon: '🚉' }
    return { label: nodeType, icon: '📍' }
  }
  const l1Info = getL1Breadcrumb()

  const send = async (q: string) => {
    if (!q.trim()) return
    setMsgs((v) => [...v, { role: 'user', content: q }])
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    let difyApiKey = ''
    let difyApiUrl = ''
    try {
      difyApiKey = localStorage.getItem('bambigo.dify.apiKey') || ''
      difyApiUrl = localStorage.getItem('bambigo.dify.apiUrl') || ''
    } catch {
    }

    const tokenParam = session?.access_token ? `&token=${encodeURIComponent(session.access_token)}` : ''
    const providerParam = (difyApiKey || difyApiUrl) ? '&provider=dify' : ''
    const url = `/api/assistant?q=${encodeURIComponent(q)}&node_id=${encodeURIComponent(nodeId || '')}${tokenParam}${providerParam}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    try {
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      if (difyApiKey) headers['x-dify-api-key'] = difyApiKey
      if (difyApiUrl) headers['x-dify-api-url'] = difyApiUrl

      const response = await fetch(url, {
        headers,
        signal: abortRef.current.signal
      })

      if (!response.ok || !response.body) throw new Error('Network error')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const obj = JSON.parse(line.slice(6))
              if (obj?.type === 'alerts') {
                const arr = Array.isArray(obj?.content) ? (obj.content as string[]) : []
                if (arr.length) {
                  const alertCards: L4ActionCard[] = arr.map((msg, i) => ({
                    id: `alert-${Date.now()}-${i}`,
                    type: 'alert',
                    title: t('dashboard.realTimeAlert'),
                    description: msg,
                    rationale: 'Real-time Alert',
                    tags: ['alert'],
                    actions: [{ label: t('dashboard.understand'), action: 'app:dismiss' }]
                  }))
                  setCards((prev) => [...alertCards, ...prev])
                }
                continue
              }
              if (obj?.type === 'done') {
                setLoading(false)
                return
              }
              const content = String(obj?.content ?? '')
              if (!content) continue
              setMsgs((v) => {
                const last = v[v.length - 1]
                if (last && last.role === 'ai') {
                  const copy = v.slice()
                  copy[copy.length - 1] = { role: 'ai', content: copy[copy.length - 1].content + content }
                  return copy
                }
                return [...v, { role: 'ai', content }]
              })
            } catch {}
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setLoading(false)
      // Fallback
      try {
        const r = await fetch(url, { headers })
        if (r.ok && r.headers.get('Content-Type')?.includes('application/json')) {
          const j = await r.json()
          const primary = j?.fallback?.primary
          const secondary = Array.isArray(j?.fallback?.secondary) ? j.fallback.secondary : []
          const legacy = Array.isArray(j?.fallback?.cards) ? j.fallback.cards : []
          
          const toL4 = (c: unknown): L4ActionCard => {
            const item = (c ?? {}) as Record<string, unknown>
            const rawType = String(item.type || 'secondary')
            const type: L4CardType = rawType === 'primary' || rawType === 'secondary' || rawType === 'alert' ? rawType : 'secondary'
            const tags = Array.isArray(item.tags) ? (item.tags as unknown[]).map((t) => String(t)) : []
            const actions = Array.isArray(item.actions)
              ? (item.actions as unknown[]).map((a) => {
                  const obj = (a ?? {}) as Record<string, unknown>
                  return {
                    label: String(obj.label || t('dashboard.view')),
                    action: String(obj.uri || obj.action || 'app:open')
                  }
                })
              : []
            return {
              id: String(item.id || `card-${Date.now()}-${Math.random()}`),
              type,
              title: String(item.title || 'Info'),
              description: String(item.description || item.desc || ''),
              rationale: String(item.rationale || ''),
              tags,
              actions
            }
          }

          const merged = (primary ? [primary, ...secondary] : legacy).map(toL4)
          setCards(merged)
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <L2StatusMarquee 
         weatherAlerts={weatherAlerts} 
         transitStatus={transitStatus} 
         transitDelay={transitDelay} 
      />
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        {/* Main Interaction Area: Central AI Agent Chat */}
        <section className="bg-white rounded-2xl border border-blue-100 shadow-md overflow-hidden relative z-20">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white">
             <div className="flex items-center gap-2">
               <MessageSquare size={18} />
               <h3 className="text-sm font-bold">{t('dashboard.aiGuide')}</h3>
             </div>
             <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
               <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
               <span className="text-[10px] font-bold opacity-90">ONLINE</span>
             </div>
          </div>
          <div className="p-4 bg-gradient-to-b from-blue-50/30 to-white">
            <div className="max-h-[30vh] min-h-[150px] overflow-y-auto space-y-4 mb-4 scrollbar-hide">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center opacity-70">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-3 animate-bounce">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm text-gray-500 font-bold">{t('dashboard.aiWelcome')}</p>
                  <p className="text-xs text-gray-400 mt-1">Ask about nearby facilities or route advice.</p>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className="flex justify-start">
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none ml-auto' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-500 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 relative">
              <input 
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder={t('common.inputPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (send(text), setText(''))}
              />
              <button 
                onClick={() => { send(text); setText(''); }}
                disabled={!text.trim() || loading}
                className="bg-blue-600 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </section>

        {/* L1-L3 Detail Card Framework */}
        <NodeDetailCard
          name={name}
          zone={nodeZone}
          l1Summary={l1Info?.label}
          facilities={facilities.slice(0, 6).map(f => ({
            id: f.id,
            name: String(f.provider?.name || f.subCategory || f.category || f.id),
            type: 'service',
            icon: null
          }))}
          traffic={transitStatus ? [{
            line: t('dashboard.transport'),
            status: transitStatus === 'delayed' ? t('dashboard.transitDelayed') : t('common.monitoring').split('：')[1] || '正常',
            tone: transitStatus === 'delayed' ? 'yellow' : 'green'
          }] : []}
          crowdLevel="medium"
          crowdTrend="stable"
          facilityCounts={facilityCounts ?? undefined}
          vibeTags={vibeTags}
          persona={Array.isArray(persona) ? persona.join('、') : persona}
          weatherAlerts={weatherAlerts}
          identity={identity}
        />

        {/* Trip Guard / Line Integration (Member Exclusive) */}
        <section className={`rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group transition-all ${isTripGuardActive ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-gradient-to-br from-green-500 to-emerald-600'}`}>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell size={20} className={isTripGuardActive ? "animate-pulse" : "animate-bounce"} />
                <h3 className="font-bold text-lg">{t('navigation.tripGuard')}</h3>
              </div>
              {isTripGuardActive && (
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
              )}
            </div>
            <p className="text-sm text-white/90 mb-4 leading-relaxed">
              {isTripGuardActive 
                ? '正在為您監控前往目的地的路線。若有異常將立即透過 LINE 通知。'
                : t('dashboard.tripGuardDesc')}
            </p>
            
            {!isLineBound ? (
              <button 
                onClick={() => {
                  if (!user) {
                    onClientLog?.({ level: 'warn', message: 'tripGuard:loginRequired', data: { nodeId } })
                    notify({
                      severity: 'medium',
                      title: t('dashboard.loginRequired'),
                      summary: t('dashboard.loginRequired'),
                      dedupeMs: 15000,
                    })
                  } else {
                    // Simulate Line Enrollment
                    setLoading(true)
                    setTimeout(() => {
                      setIsLineBound(true)
                      setLoading(false)
                      onClientLog?.({ level: 'info', message: 'tripGuard:lineBindSuccess', data: { nodeId } })
                      notify({ severity: 'low', title: t('navigation.tripGuard'), summary: 'LINE 帳號綁定成功！', dedupeMs: 5000 })
                    }, 1500)
                  }
                }}
                className="w-full bg-white text-green-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
              >
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-black">L</div>
                {t('dashboard.tripGuardEnroll')}
                <ChevronRight size={16} />
              </button>
            ) : (
              <button 
                onClick={() => setIsTripGuardActive(!isTripGuardActive)}
                className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md ${isTripGuardActive ? 'bg-white text-blue-600' : 'bg-white text-green-600'}`}
              >
                {isTripGuardActive ? '關閉行程守護' : '啟動行程守護'}
                <ShieldCheck size={18} />
              </button>
            )}
          </div>
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 -ml-4 -mb-4 w-24 h-24 bg-black/5 rounded-full blur-xl" />
        </section>



        {/* User State Selector */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('dashboard.myStatus') || '我的狀態'}</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style jsx>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>
            {USER_STATE_OPTIONS.map(opt => {
              const isActive = userStates.includes(opt.id)
              let activeClass = ''
              let dotClass = ''
              if (opt.color === 'blue') { activeClass = 'bg-blue-50 border-blue-200 text-blue-700'; dotClass = 'bg-blue-500' }
              else if (opt.color === 'pink') { activeClass = 'bg-pink-50 border-pink-200 text-pink-700'; dotClass = 'bg-pink-500' }
              else if (opt.color === 'purple') { activeClass = 'bg-purple-50 border-purple-200 text-purple-700'; dotClass = 'bg-purple-500' }
              else { activeClass = 'bg-red-50 border-red-200 text-red-700'; dotClass = 'bg-red-500' }

              return (
                <button
                  key={opt.id}
                  onClick={() => toggleUserState(opt.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border
                    ${isActive 
                      ? `${activeClass} shadow-sm scale-105` 
                      : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}
                  `}
                >
                  {opt.label}
                  {isActive && <div className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`} />}
                </button>
              )
            })}
          </div>
        </section>

        {/* Suggested Actions (L4) */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-orange-500 rounded-full" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('dashboard.suggestedActions')}</h2>
          </div>
          <ActionCarousel 
            cards={cards} 
            onPrimaryClick={(c) => { 
              if (c.title === t('dashboard.realTimeAlert') && c.description) { 
                onRouteHint?.(c.description)
                send(c.description)
                return 
              } 
              onAction(c.title)
              send(c.title) 
            }} 
          />
        </section>

        {/* Facilities List (L3) */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-400 rounded-full" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('dashboard.nearbyFacilities')}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{facilities.length} {t('common.places')}</span>
              <button 
                onClick={() => setIsEditingFacilities(!isEditingFacilities)}
                className={`p-1.5 rounded-lg transition-colors ${isEditingFacilities ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 bg-gray-50'}`}
                title={isEditingFacilities ? t('dashboard.doneEditing') : t('dashboard.manageFacilities')}
              >
                <Edit2 size={14} />
              </button>
            </div>
          </div>
          {isEditingFacilities ? (
            <div className="h-[400px]">
              <NodeFacilityManager 
                nodeId={nodeId || ''} 
                initialFacilities={facilities} 
                onUpdate={(newFacilities: L3ServiceFacility[]) => setFacilities(newFacilities)}
                onSystemAlert={onSystemAlert}
                onClientLog={onClientLog}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <FacilityList items={facilities} />
            </div>
          )}
        </section>
        
        {/* ODPT Station Details */}
        {odptStation && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold">{t('dashboard.stationInfo') || '車站詳細資訊'}</h3>
              </div>
              {odptStation.station_code && (
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">
                  {odptStation.station_code}
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              {/* Lines & Connecting Railways */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.lines') || '所屬/轉乘路線'}</div>
                <div className="flex flex-wrap gap-2">
                  {odptStation.railway && (
                    <div className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-xs font-bold">
                      {odptStation.railway.split(':').pop()?.split('.').pop()}
                    </div>
                  )}
                  {odptStation.connecting_railways?.map((r: string) => (
                    <div key={r} className="px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-lg border border-gray-100 text-xs font-medium">
                      {r.split(':').pop()?.split('.').pop()}
                    </div>
                  ))}
                </div>
              </div>

              {/* Exits */}
              {odptStation.exits && odptStation.exits.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.exits') || '車站出口'}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {odptStation.exits.slice(0, 9).map((exit: string) => (
                      <div key={exit} className="px-2 py-1 bg-white border border-gray-100 rounded text-[10px] text-center text-gray-500 font-medium truncate">
                        {exit.split(':').pop()?.split('.').pop()}
                      </div>
                    ))}
                    {odptStation.exits.length > 9 && (
                      <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] text-center text-gray-400 font-medium italic">
                        +{odptStation.exits.length - 9} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Shared Mobility Status */}
        {stations.length > 0 && (
           <section>
             <div className="flex items-center gap-2 mb-3">
               <div className="w-1 h-4 bg-teal-500 rounded-full" />
               <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('dashboard.sharedMobility')}</h2>
             </div>
             <div className="grid grid-cols-2 gap-3">
               {stations.slice(0, 4).map((s) => (
                 <div key={s.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:border-blue-200 transition-colors">
                   <div className="text-xs font-bold text-gray-900 truncate mb-2">{s.name}</div>
                   <div className="flex justify-between items-center text-[10px] font-semibold">
                     <div className="flex items-center gap-1 text-blue-600">
                       <span className="text-sm">🚲</span>
                       <span>{s.bikes_available}</span>
                     </div>
                     <div className="flex items-center gap-1 text-gray-400">
                       <span className="text-sm">🅿️</span>
                       <span>{s.docks_available}</span>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </section>
        )}


      </div>
    </div>
  )
}
