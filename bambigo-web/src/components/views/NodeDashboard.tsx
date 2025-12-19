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

  // Derive Persona when dependencies change (needs to be declared before usage below)
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
      {/* Header */}
      <div className="flex-none bg-white/95 backdrop-blur-sm p-5 shadow-sm z-10 border-b border-gray-100">
        {l1Info && (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 inline-flex px-2 py-0.5 rounded-full">
            <span>{l1Info.icon}</span>
            <span>{l1Info.label}</span>
          </div>
        )}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{name.zh || name.en}</h1>
            <div className="text-sm text-gray-500 font-medium">{name.ja}</div>
          </div>
          <button 
            onClick={toggleFavorite}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${isFavorite ? 'bg-pink-50 text-pink-500 shadow-inner' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
          >
            <Heart className={isFavorite ? "fill-current" : ""} size={22} />
          </button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {statuses.map((s, i) => {
            // Map legacy tones to new Layers
            // Yellow/Red (Alerts) -> L4 (Action)
            // Blue/Green/Gray -> L2 (Atmosphere)
            const isAlert = s.tone === 'yellow' || s.tone === 'red'
            return (
              <TagChip 
                key={i} 
                label={s.label} 
                layer={isAlert ? 'L4' : 'L2'} 
              />
            )
          })}
          {persona.map((p, i) => (
            <TagChip 
              key={`p-${i}`} 
              label={`#${p}`} 
              layer="L1" 
            />
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* L1 Tag Manager */}
        <section>
          <NodeL1Manager nodeId={nodeId || ''} />
        </section>
        
        {/* Quick Actions (L0 - from props) */}
        {actions.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-gray-700">{t('dashboard.quickActions')}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => onAction(a)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 shadow-sm active:scale-95 transition-all hover:border-blue-400 hover:text-blue-600"
                >
                  {a}
                </button>
              ))}
            </div>
          </section>
        )}
        
        {/* Action Cards (L4) */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-700">{t('dashboard.suggestedActions')}</h2>
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
            <h2 className="text-sm font-semibold text-gray-700">{t('dashboard.nearbyFacilities')}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{facilities.length} {t('common.places')}</span>
              <button 
                onClick={() => setIsEditingFacilities(!isEditingFacilities)}
                className={`p-1 rounded transition-colors ${isEditingFacilities ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`}
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
            <FacilityList items={facilities} />
          )}
        </section>
        
        {/* Shared Mobility Status */}
        {stations.length > 0 && (
           <section>
             <div className="flex justify-between items-center mb-3">
               <h2 className="text-sm font-semibold text-gray-700">共享運具站點</h2>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {stations.slice(0, 4).map((s) => (
                 <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                   <div className="text-xs font-medium text-gray-900 truncate">{s.name}</div>
                   <div className="mt-1 flex justify-between text-xs text-gray-500">
                     <span>🚲 {s.bikes_available}</span>
                     <span>🅿️ {s.docks_available}</span>
                   </div>
                 </div>
               ))}
             </div>
           </section>
        )}

        {/* AI Assistant Chat */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
             <h3 className="text-xs font-semibold text-blue-800">AI 嚮導</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="max-h-48 overflow-y-auto space-y-3">
              {msgs.length === 0 && <div className="text-center text-xs text-gray-400 py-4">有什麼我可以幫你的嗎？</div>}
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <input 
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder={t('common.inputPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (send(text), setText(''))}
              />
              <button 
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} 
                onClick={() => { send(text); setText('') }}
                disabled={loading}
              >
                {loading ? '...' : t('common.send')}
              </button>
            </div>
          </div>
        </section>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pb-8">
          {actions.map((a) => (
            <Chip key={a} label={a} tone={'neutral'} onClick={() => { onAction(a); send(a) }} />
          ))}
        </div>
      </div>
    </div>
  )
}
