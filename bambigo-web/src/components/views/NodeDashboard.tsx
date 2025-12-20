'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Heart, Edit2 } from 'lucide-react'
import ActionCarousel from '../cards/ActionCarousel'
import Chip from '../ui/Chip'
import FacilityList from '../lists/FacilityList'
import NodeFacilityManager from './NodeFacilityManager'
import NodeL1Manager from './NodeL1Manager'
import { useAuth } from '../auth/AuthContext'
import { derivePersonaFromFacilities } from '../../lib/tagging'
import { supabase } from '../../lib/supabase'
import { L1_CATEGORIES_DATA } from '../tagging/constants'
import { L3ServiceFacility, L4ActionCard, L4CardType } from '../../types/tagging'
import { adaptFacilityItem } from '../../lib/adapters/facilities'
import { FacilityItem } from '../../app/api/facilities/route'
import TagChip from '../ui/TagChip'
import { Users, Info, Bell, MessageSquare, ChevronRight, ExternalLink, ShieldCheck } from 'lucide-react'
import NodeDetailCard from '../cards/NodeDetailCard'

type Name = { ja?: string; en?: string; zh?: string }
type Status = { label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }
type Props = { nodeId?: string; name: Name; statuses: Status[]; actions: string[]; onAction: (a: string) => void; onRouteHint?: (hint: string) => void; filterSuitability?: { tag?: string; minConfidence?: number } }

import { useLanguage } from '../../contexts/LanguageContext'

export default function NodeDashboard({ nodeId, name, statuses, actions, onAction, onRouteHint, filterSuitability }: Props) {
  const { t } = useLanguage()
  const { user, session } = useAuth()
  const [isFavorite, setIsFavorite] = useState(false)
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<L4ActionCard[]>([])
  const [facilities, setFacilities] = useState<L3ServiceFacility[]>([])
  const [stations, setStations] = useState<{ id: string; name: string; bikes_available: number; docks_available: number }[]>([])
  const [nodeType, setNodeType] = useState<string>('')
  const [transitStatus, setTransitStatus] = useState<string | undefined>(undefined)
  const [isEditingFacilities, setIsEditingFacilities] = useState(false)
  const [isLineBound, setIsLineBound] = useState(false)
  const [isTripGuardActive, setIsTripGuardActive] = useState(false)

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
    const controller = new AbortController()
    let ignore = false

    async function fetchData() {
      if (!nodeId) return
      setLoading(true)

      try {
        // 1. Fetch Node Type
        if (!nodeId.startsWith('mock-')) {
          const { data } = await supabase.from('nodes').select('type').eq('id', nodeId).single()
          if (!ignore && data?.type) setNodeType(data.type)
        } else {
          if (!ignore) setNodeType('station')
        }

        // 2. Fetch Live Facilities & Mobility
        const params = new URLSearchParams({ node_id: nodeId, limit_facilities: '20', limit_mobility: '50' })
        if (filterSuitability?.tag) params.set('suitability', filterSuitability.tag)
        if (typeof filterSuitability?.minConfidence === 'number') params.set('min_confidence', String(filterSuitability.minConfidence))
        
        const r = await fetch(`/api/nodes/live/facilities?${params.toString()}`, { signal: controller.signal })
        if (!r.ok) throw new Error('Live data fetch failed')
        
        const j = await r.json()
        const rawItems = Array.isArray(j?.facilities?.items) ? (j.facilities?.items as FacilityItem[]) : []
        const adaptedItems = rawItems.map(adaptFacilityItem)
        const sts = Array.isArray(j?.live?.mobility?.stations) ? (j.live?.mobility?.stations as any[]) : []
        const tStatus = j?.live?.transit?.status
        const delay = j?.live?.transit?.delay_minutes

        // 3. Fetch AI Strategy
        let strategyCards: L4ActionCard[] = []
        try {
          const sRes = await fetch(`/api/nodes/${nodeId}/strategy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: new Date().toISOString(),
              personaLabels: Array.isArray(persona) ? persona : [],
              transitStatus: tStatus
            }),
            signal: controller.signal
          })
          if (sRes.ok) {
            const sData = await sRes.json()
            if (Array.isArray(sData)) strategyCards = sData
          }
        } catch (e) {
          console.error('Strategy fetch aborted or failed')
        }

        if (!ignore) {
          const newCards: L4ActionCard[] = []
          
          // Shared Mobility Card
          const availableBikes = sts.reduce((sum, s) => sum + (Number(s.bikes_available) || 0), 0)
          if (availableBikes > 0) {
            newCards.push({
              type: 'primary',
              title: t('dashboard.bikeTitle'),
              description: t('dashboard.bikeDesc').replace('{n}', String(sts.length)).replace('{count}', String(availableBikes)),
              rationale: 'Mobility',
              tags: ['transport', 'bike'],
              actions: [{ label: t('dashboard.bikeAction'), uri: 'app:bike' }]
            })
          }

          // Transit Card
          if (tStatus === 'delayed' || tStatus === 'suspended') {
            newCards.push({
              type: 'alert',
              title: t('dashboard.transitTitle'),
              description: `${t('common.monitoring').split('：')[0]}：${tStatus === 'delayed' ? t('dashboard.transitDelayed') : t('dashboard.transitSuspended')}${typeof delay === 'number' && delay > 0 ? `（${t('dashboard.transitDelayMinutes').replace('{n}', String(delay))}）` : ''}`,
              rationale: 'Alert',
              tags: ['transport', 'warning'],
              actions: [{ label: t('dashboard.transitAlternative'), uri: 'app:transit' }]
            })
          }

          setTransitStatus(tStatus)
          setFacilities(adaptedItems)
          setStations(sts)
          setCards([...newCards, ...strategyCards])
          setLoading(false)
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        console.error('Fetch error:', e)
        if (!ignore) setLoading(false)
      }
    }

    fetchData()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [nodeId, filterSuitability?.tag, filterSuitability?.minConfidence, persona])

  // Check Favorite Status separately
  useEffect(() => {
    if (!user || !nodeId) {
      setIsFavorite(false)
      return
    }
    supabase
      .from('saved_locations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('node_id', nodeId)
      .then(({ count }) => setIsFavorite((count || 0) > 0))
  }, [user, nodeId])

  const getL1Breadcrumb = () => {
    if (!nodeType) return null
    const l1 = L1_CATEGORIES_DATA.find(c => c.id === nodeType || c.subCategories.some(s => s.id === nodeType))
    if (l1) return { label: l1.label, icon: l1.icon }
    if (nodeType === 'station') return { label: `${t('dashboard.transport')} (${t('header.langLabel') === '日' ? '交通' : 'Transport'})`, icon: '🚉' }
    return { label: nodeType, icon: '📍' }
  }
  const l1Info = getL1Breadcrumb()

  const toggleFavorite = async () => {
    if (!user) {
      // TODO: Show login modal or toast
      alert(t('dashboard.loginRequired'))
      return
    }
    if (!nodeId) return

    if (isFavorite) {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('user_id', user.id)
        .eq('node_id', nodeId)
      
      if (!error) setIsFavorite(false)
    } else {
      const { error } = await supabase
        .from('saved_locations')
        .insert({
          user_id: user.id,
          node_id: nodeId,
          title: name.zh || name.ja || name.en // Save a snapshot of the name
        })

      if (!error) setIsFavorite(true)
    }
  }




  const send = async (q: string) => {
    if (!q.trim()) return
    setMsgs((v) => [...v, { role: 'user', content: q }])
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const tokenParam = session?.access_token ? `&token=${encodeURIComponent(session.access_token)}` : ''
    const url = `/api/assistant?q=${encodeURIComponent(q)}&node_id=${encodeURIComponent(nodeId || '')}${tokenParam}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    try {
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

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
                  const alertCards: L4ActionCard[] = arr.map((msg) => ({
                    type: 'alert',
                    title: t('dashboard.realTimeAlert'),
                    description: msg,
                    rationale: 'Real-time Alert',
                    tags: ['alert'],
                    actions: [{ label: t('dashboard.understand'), uri: 'app:dismiss' }]
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
            const type = (rawType === 'primary' || rawType === 'alert' ? rawType : 'secondary') as L4CardType
            const tags = Array.isArray(item.tags) ? (item.tags as unknown[]).map((t) => String(t)) : []
            const actions = Array.isArray(item.actions)
              ? (item.actions as unknown[]).map((a) => {
                  const obj = (a ?? {}) as Record<string, unknown>
                  return {
                    label: String(obj.label || t('dashboard.view')),
                    uri: String(obj.uri || 'app:open')
                  }
                })
              : []
            return {
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
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        {/* L1-L3 Detail Card Framework */}
        <NodeDetailCard
          name={name}
          l1Summary={l1Info?.label}
          l1Tags={persona.map(p => ({ label: p, tone: 'purple' }))}
          l2Status={statuses.filter(s => s.tone !== 'yellow' && s.tone !== 'red').map(s => ({ label: s.label, tone: 'blue' }))}
          facilities={facilities.slice(0, 6).map(f => ({
            id: f.id,
            name: f.attributes?.zh || f.attributes?.ja || f.id,
            type: f.category === 'shop' ? 'shop' : f.category === 'office' ? 'office' : 'service',
            icon: null
          }))}
          traffic={transitStatus ? [{
            line: t('dashboard.transport'),
            status: transitStatus === 'delayed' ? t('dashboard.transitDelayed') : t('common.monitoring').split('：')[1] || '正常',
            tone: transitStatus === 'delayed' ? 'yellow' : 'green'
          }] : []}
          crowdLevel="medium"
          crowdTrend="stable"
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
                    alert(t('dashboard.loginRequired'))
                  } else {
                    // Simulate Line Enrollment
                    setLoading(true)
                    setTimeout(() => {
                      setIsLineBound(true)
                      setLoading(false)
                      alert('LINE 帳號綁定成功！')
                    }, 1500)
                  }
                }}
                className="w-full bg-white text-green-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
              >
                <img src="/line-icon.png" alt="LINE" className="w-5 h-5" onError={(e) => (e.currentTarget.style.display = 'none')} />
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

        {/* AI Conversation Entry Point (Third Layer) */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 group hover:border-blue-200 transition-all cursor-pointer" onClick={() => onAction('ai_assistant')}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t('dashboard.aiGuide')}</h3>
                <p className="text-xs text-gray-500">詢問關於此節點的更多細節</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-all" />
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 italic">
            "這附近有沒有適合辦公的咖啡廳？"
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
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <FacilityList items={facilities} />
            </div>
          )}
        </section>
        
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

        {/* AI Assistant Chat Section */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between text-white">
             <div className="flex items-center gap-2">
               <MessageSquare size={18} />
               <h3 className="text-sm font-bold">{t('dashboard.aiGuide')}</h3>
             </div>
             <div className="flex items-center gap-1">
               <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
               <span className="text-[10px] font-medium opacity-80">Online</span>
             </div>
          </div>
          <div className="p-4">
            <div className="max-h-60 overflow-y-auto space-y-4 mb-4 scrollbar-hide">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-3">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">{t('dashboard.aiWelcome')}</p>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className="flex justify-start">
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none ml-auto' 
                      : 'bg-gray-100 text-gray-900 rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-500 flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    <span className="animate-bounce [animation-delay:0.4s]">.</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <input 
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder={t('common.inputPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (send(text), setText(''))}
              />
              <button 
                onClick={() => { send(text); setText(''); }}
                disabled={!text.trim() || loading}
                className="bg-blue-600 text-white p-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200 active:scale-95 transition-transform"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
