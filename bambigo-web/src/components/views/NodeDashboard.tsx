'use client'
import { useEffect, useRef, useState } from 'react'
import { Heart, Edit2 } from 'lucide-react'
import ActionCarousel from '../cards/ActionCarousel'
import Chip from '../ui/Chip'
import FacilityList from '../lists/FacilityList'
import NodeFacilityManager from './NodeFacilityManager'
import { useAuth } from '../auth/AuthContext'
import { derivePersonaFromFacilities } from '../../lib/tagging'
import { supabase } from '../../lib/supabase'
import { L1_CATEGORIES_DATA } from '../tagging/constants'
import { L3ServiceFacility } from '../../types/tagging'
import { adaptFacilityItem } from '../../lib/adapters/facilities'
import { FacilityItem } from '../../app/api/facilities/route'
import TagChip from '../ui/TagChip'

type Name = { ja?: string; en?: string; zh?: string }
type Status = { label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }
type Props = { nodeId?: string; name: Name; statuses: Status[]; actions: string[]; onAction: (a: string) => void; onRouteHint?: (hint: string) => void; filterSuitability?: { tag?: string; minConfidence?: number } }

export default function NodeDashboard({ nodeId, name, statuses, actions, onAction, onRouteHint, filterSuitability }: Props) {
  const { user } = useAuth()
  const [isFavorite, setIsFavorite] = useState(false)
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const esRef = useRef<EventSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<{ title: string; desc?: string; primary?: string }[]>([])
  const [facilities, setFacilities] = useState<L3ServiceFacility[]>([])
  const [stations, setStations] = useState<{ id: string; name: string; bikes_available: number; docks_available: number }[]>([])
  const [persona, setPersona] = useState<string[]>([])
  const [nodeType, setNodeType] = useState<string>('')
  const [transitStatus, setTransitStatus] = useState<string | undefined>(undefined)
  const [isEditingFacilities, setIsEditingFacilities] = useState(false)

  // Check Favorite Status
  useEffect(() => {
    let ignore = false
    async function checkFavorite() {
      if (!user || !nodeId) {
        if (!ignore) setIsFavorite(false)
        return
      }
      const { count } = await supabase
        .from('saved_locations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('node_id', nodeId)
      if (!ignore) setIsFavorite((count || 0) > 0)
    }
    checkFavorite()
    async function fetchNodeType() {
      if (!nodeId) return
      if (nodeId.startsWith('mock-')) {
        if (!ignore) setNodeType('station')
        return
      }
      const { data } = await supabase.from('nodes').select('type').eq('id', nodeId).single()
      if (data?.type && !ignore) setNodeType(data.type)
    }
    fetchNodeType()
    return () => { ignore = true }
  }, [user, nodeId])

  const getL1Breadcrumb = () => {
    if (!nodeType) return null
    const l1 = L1_CATEGORIES_DATA.find(c => c.id === nodeType || c.subCategories.some(s => s.id === nodeType))
    if (l1) return { label: l1.label, icon: l1.icon }
    if (nodeType === 'station') return { label: 'Transport (交通)', icon: '🚉' }
    return { label: nodeType, icon: '📍' }
  }
  const l1Info = getL1Breadcrumb()

  const toggleFavorite = async () => {
    if (!user) {
      // TODO: Show login modal or toast
      alert('請先登入以收藏地點')
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

  useEffect(() => {
    let abort = false
    async function run() {
      if (!nodeId) return
      try {
        const params = new URLSearchParams({ node_id: nodeId || '', limit_facilities: '20', limit_mobility: '50' })
        if (filterSuitability?.tag) params.set('suitability', filterSuitability.tag)
        if (typeof filterSuitability?.minConfidence === 'number') params.set('min_confidence', String(filterSuitability.minConfidence))
        const r = await fetch(`/api/nodes/live/facilities?${params.toString()}`)
        if (!r.ok) return
        type LiveStationRaw = { id: string; name?: string; bikes_available?: number; docks_available?: number }
        
        type AggResponse = { 
          live?: { 
            mobility?: { stations?: LiveStationRaw[] }; 
            transit?: { status?: string } 
          }; 
          facilities?: { items?: FacilityItem[] }; 
          updated_at?: string 
        }
        const j: AggResponse = await r.json()
        
        // Use Adapter Pattern to convert legacy API data to L3 strict types
        const rawItems = Array.isArray(j?.facilities?.items) ? (j.facilities?.items as FacilityItem[]) : []
        const adaptedItems = rawItems.map(adaptFacilityItem)

        const sts = Array.isArray(j?.live?.mobility?.stations) ? (j.live?.mobility?.stations as LiveStationRaw[]) : []
        
        // Generate Action Cards
        const newCards: { title: string; desc?: string; primary?: string }[] = []
        
        // 1. Shared Mobility
        const availableBikes = sts.reduce((sum, s) => sum + (Number(s.bikes_available) || 0), 0)
        if (availableBikes > 0) {
          newCards.push({
            title: '共享單車',
            desc: `附近 ${sts.length} 個站點，共 ${availableBikes} 台車可用`,
            primary: '預約'
          })
        }
        
        // 2. Facilities Highlights
        const hasToilet = adaptedItems.some(f => f.category === 'toilet')
        if (hasToilet) {
          newCards.push({
            title: '洗手間',
            desc: '附近有公共洗手間',
            primary: '導航'
          })
        }

        // 3. Public Transit
        const tStatus = j?.live?.transit?.status
        if (tStatus === 'delayed' || tStatus === 'suspended') {
           newCards.push({
             title: '大眾運輸',
             desc: `目前狀態：${tStatus === 'delayed' ? '延誤' : '暫停'}`,
             primary: '查看替代路線'
           })
        }

        // 4. Taxi
        const hasTaxi = adaptedItems.some(f => f.subCategory === 'taxi_stand')
        if (hasTaxi) {
          newCards.push({
            title: '計程車',
            desc: '附近有計程車招呼站',
            primary: '叫車'
          })
        }

        if (!abort) {
          setTransitStatus(tStatus)
          setFacilities(adaptedItems)
          setStations(sts.map(s => ({
            id: String(s.id),
            name: String(s.name || ''),
            bikes_available: Number(s.bikes_available || 0),
            docks_available: Number(s.docks_available || 0)
          })))
          setCards(newCards)
        }
      } catch (e) {
        console.error(e)
      }
    }
    run()
    return () => { abort = true }
  }, [nodeId])

  // Derive Persona when dependencies change
  useEffect(() => {
    // Find L1 context
    const l1 = L1_CATEGORIES_DATA.find(c => c.id === nodeType || c.subCategories.some(s => s.id === nodeType))
    const l1Main = l1?.id
    const l1Sub = nodeType

    const p = derivePersonaFromFacilities(
      facilities.map(f => ({ 
          type: f.subCategory, 
          has_wheelchair_access: !!(f.attributes as any).has_wheelchair_access,
          has_baby_care: !!(f.attributes as any).has_baby_care 
      })), 
      { 
        l1MainCategory: l1Main, 
        l1SubCategory: l1Sub,
        transit: { status: transitStatus } 
      }
    )
    setPersona(p)
  }, [facilities, nodeType, transitStatus])

  const send = (q: string) => {
    if (!q.trim()) return
    setMsgs((v) => [...v, { role: 'user', content: q }])
    setLoading(true)
    esRef.current?.close()
    // Pass nodeId to allow server to fetch specific persona/context
    const url = `/api/assistant?q=${encodeURIComponent(q)}&node_id=${encodeURIComponent(nodeId || '')}`
    esRef.current = new EventSource(url)
    esRef.current.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data)
        if (obj?.type === 'alerts') {
          const arr = Array.isArray(obj?.content) ? (obj.content as string[]) : []
          if (arr.length) {
            const alertCards = arr.map((msg) => ({ title: '即時提醒', desc: msg, primary: '了解' }))
            setCards((prev) => [...alertCards, ...prev])
          }
          return
        }
        if (obj?.type === 'done') {
          setLoading(false)
          esRef.current?.close()
          esRef.current = null
          return
        }
        const content = String(obj?.content ?? '')
        if (!content) return
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
    esRef.current.onerror = async () => {
      setLoading(false)
      esRef.current?.close()
      esRef.current = null
      try {
        const url = `/api/assistant?q=${encodeURIComponent(q)}&node_id=${encodeURIComponent(nodeId || '')}`
        const r = await fetch(url)
        if (r.ok && r.headers.get('Content-Type')?.includes('application/json')) {
          const j = await r.json()
          const primary = j?.fallback?.primary
          const secondary = Array.isArray(j?.fallback?.secondary) ? j.fallback.secondary : []
          const legacy = Array.isArray(j?.fallback?.cards) ? j.fallback.cards : []
          const merged = primary ? [primary, ...secondary] : legacy
          setCards(merged)
        }
      } catch {}
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

        {/* L1 Tag Manager - TODO: Implement NodeL1Manager
        <section>
          <NodeL1Manager nodeId={nodeId || ''} />
        </section>
        */}
        
        {/* Action Cards (L4) */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-700">建議行動</h2>
          </div>
          <ActionCarousel 
            cards={cards} 
            onPrimaryClick={(c) => { 
              if (c.title === '即時提醒' && c.desc) { 
                onRouteHint?.(c.desc)
                send(c.desc)
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
            <h2 className="text-sm font-semibold text-gray-700">周邊設施</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{facilities.length} 處</span>
              <button 
                onClick={() => setIsEditingFacilities(!isEditingFacilities)}
                className={`p-1 rounded transition-colors ${isEditingFacilities ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`}
                title={isEditingFacilities ? "Done Editing" : "Manage Facilities"}
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
                placeholder="輸入問題..." 
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (send(text), setText(''))}
              />
              <button 
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} 
                onClick={() => { send(text); setText('') }}
                disabled={loading}
              >
                {loading ? '...' : '送出'}
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
