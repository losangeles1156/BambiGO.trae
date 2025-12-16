'use client'
import { useEffect, useRef, useState } from 'react'
import ActionCarousel from '../cards/ActionCarousel'
import Chip from '../ui/Chip'
import FacilityList from '../lists/FacilityList'
type Name = { ja?: string; en?: string; zh?: string }
type Status = { label: string; tone?: 'yellow' | 'blue' | 'red' | 'green' }
type Props = { nodeId?: string; name: Name; statuses: Status[]; actions: string[]; onAction: (a: string) => void }
export default function NodeDashboard({ nodeId, name, statuses, actions, onAction }: Props) {
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const esRef = useRef<EventSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<{ title: string; desc?: string }[]>([])
  const [facilities, setFacilities] = useState<{ id: string; type: string; name?: { ja?: string; en?: string; zh?: string } }[]>([])
  const [stations, setStations] = useState<{ id: string; name: string; bikes_available: number; docks_available: number }[]>([])
  const persona = ['文化森林', '轉乘迷宮']
  useEffect(() => {
    let abort = false
    async function run() {
      if (!nodeId) return
      try {
        const r = await fetch(`/api/nodes/live/facilities?node_id=${encodeURIComponent(nodeId)}&limit_facilities=20&limit_mobility=50`)
        if (!r.ok) return
        type LiveStationRaw = { id: string; name?: string; bikes_available?: number; docks_available?: number }
        type FacilityItem = { id: string; type: string; name?: { ja?: string; en?: string; zh?: string } }
        type AggResponse = { live?: { mobility?: { stations?: LiveStationRaw[] } }; facilities?: { items?: FacilityItem[] }; updated_at?: string }
        const j: AggResponse = await r.json()
        const items = Array.isArray(j?.facilities?.items) ? (j.facilities?.items as FacilityItem[]) : []
        const sts = Array.isArray(j?.live?.mobility?.stations) ? (j.live?.mobility?.stations as LiveStationRaw[]) : []
        if (abort) return
        setFacilities(items)
        setStations(sts.map((s) => ({ id: String(s.id), name: String(s.name || ''), bikes_available: Number(s.bikes_available || 0), docks_available: Number(s.docks_available || 0) })))
      } catch {}
    }
    run()
    return () => { abort = true }
  }, [nodeId])
  const send = (q: string) => {
    if (!q.trim()) return
    setMsgs((v) => [...v, { role: 'user', content: q }])
    setLoading(true)
    esRef.current?.close()
    esRef.current = new EventSource(`/api/assistant?q=${encodeURIComponent(q)}`)
    esRef.current.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data)
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
        const r = await fetch(`/api/assistant?q=${encodeURIComponent(q)}`)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{name.zh || name.ja || name.en || '未知節點'}</div>
        <div className="flex gap-2">
          {persona.map((p, i) => (
            <span key={i} className="rounded-full border border-gray-300 px-2 py-1 text-xs">#{p}</span>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          {statuses.map((s, i) => (
            <Chip key={i} label={s.label} tone={s.tone || 'yellow'} />
          ))}
        </div>
      </div>
      {!!facilities.length && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">附近設施</div>
          <FacilityList items={facilities.slice(0, 12).map((f) => ({
            name: (f.name?.zh || f.name?.ja || f.name?.en || f.type),
          }))} />
        </div>
      )}
      {!!stations.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-sm">共享站點：{stations.length} 個</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {stations.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <div className="truncate">{s.name}</div>
                <div className="ml-2 text-gray-600">{s.bikes_available}/{s.docks_available}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Chip key={a} label={a} tone={'neutral'} onClick={() => { onAction(a); send(a) }} />
        ))}
      </div>
      <ActionCarousel cards={cards} />
      <div className="flex gap-2">
        <input className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="輸入你的需求" />
        <button className={`rounded px-3 py-2 text-sm text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`} onClick={() => { send(text); setText('') }}>{loading ? '處理中…' : '送出'}</button>
      </div>
      <div>
        {msgs.map((m, i) => (
          <div key={i} className={`mb-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block rounded px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>{m.content}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
