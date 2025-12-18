'use client'
import { useEffect, useRef, useState } from 'react'
import FallbackCard from '../ui/FallbackCard'
import { z } from 'zod'

const StreamSchema = z.union([
  z.object({ type: z.literal('message'), content: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string().optional() })
])

type Props = { open: boolean; onClose: () => void }
export default function FullScreenAssistant({ open, onClose }: Props) {
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackCards, setFallbackCards] = useState<{ title: string; desc?: string }[] | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const bufRef = useRef<string>('')
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      esRef.current?.close()
      esRef.current = null
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] bg-white md:inset-auto md:bottom-20 md:right-4 md:h-[600px] md:w-[400px] md:rounded-xl md:shadow-2xl md:border md:border-gray-200">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-base font-semibold">城市 AI 助理</div>
          <button className="rounded border border-gray-300 px-3 py-1 text-sm" onClick={onClose}>關閉</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block rounded px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>{m.content}</span>
            </div>
          ))}
          {fallbackCards && (
            <div className="mt-4">
              {fallbackCards.map((c, i) => (
                <FallbackCard key={i} title={c.title} desc={c.desc} onRetry={() => setError(null)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="border-t p-3">
          <div className="flex gap-3">
            <input className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="你可以問我..." />
            <button
              className={`rounded px-3 py-2 text-sm text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}
              onClick={() => {
                if (!text.trim()) return
                setFallbackCards(null)
                setError(null)
                setMsgs((v) => [...v, { role: 'user', content: text }])
                setLoading(true)
                try {
                  esRef.current?.close()
                  esRef.current = new EventSource(`/api/assistant?q=${encodeURIComponent(text)}`)
                  esRef.current.onmessage = (ev) => {
                            try {
                              const json = JSON.parse(ev.data)
                              const parsed = StreamSchema.safeParse(json)
                              
                              if (!parsed.success) {
                                console.warn('Stream validation failed:', parsed.error)
                                return
                              }
                              
                              const obj = parsed.data
                              
                              if (obj.type === 'done') {
                                setLoading(false)
                                esRef.current?.close()
                                esRef.current = null
                                return
                              }
                              
                              if (obj.type === 'error') {
                                setError(obj.message || 'Unknown error')
                                setLoading(false)
                                esRef.current?.close()
                                return
                              }
                              
                              if (obj.type === 'message' && obj.content) {
                                bufRef.current += obj.content
                                if (rafRef.current == null) {
                                  rafRef.current = requestAnimationFrame(() => {
                                    rafRef.current = null
                                    const chunk = bufRef.current
                                    bufRef.current = ''
                                    setMsgs((v) => {
                                      const last = v[v.length - 1]
                                      if (last && last.role === 'ai') {
                                        const copy = v.slice()
                                        copy[copy.length - 1] = { role: 'ai', content: copy[copy.length - 1].content + chunk }
                                        return copy
                                      }
                                      return [...v, { role: 'ai', content: chunk }]
                                    })
                                  })
                                }
                              }
                            } catch {}
                          }
                  esRef.current.onerror = async () => {
                    setLoading(false)
                    esRef.current?.close()
                    esRef.current = null
                    try {
                      const r = await fetch(`/api/assistant?q=${encodeURIComponent(text)}`)
                      if (r.headers.get('Content-Type')?.includes('application/json')) {
                        const j = await r.json()
                        if (j?.fallback?.cards) setFallbackCards(j.fallback.cards)
                        else if (j?.error?.message) setError(`錯誤: ${j.error.message}`)
                        else setError('AI 服務暫不可用，請稍後重試')
                      } else {
                        setError('AI 服務暫不可用，請稍後重試')
                      }
                    } catch {
                      setError('AI 服務暫不可用，請稍後重試')
                    }
                  }
                } catch {
                  setLoading(false)
                  setError('無法建立串流連線')
                }
                setText('')
              }}
            >
              {loading ? '處理中…' : '送出'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {['我要回家', '我想逛街/吃飯', '我需要無障礙路線'].map((q) => (
              <button key={q} className="rounded border border-gray-300 px-3 py-1 text-sm" onClick={() => setText(q)}>{q}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
