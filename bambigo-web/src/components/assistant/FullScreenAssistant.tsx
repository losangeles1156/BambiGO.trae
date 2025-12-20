'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Navigation, Bell, MessageSquare, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { useLanguage } from '../../contexts/LanguageContext'

type Props = {
  open: boolean
  onClose: () => void
  nodeId?: string
}

type Message = {
  role: 'user' | 'ai'
  content: string
  timestamp: number
}

const QUICK_QUESTIONS = [
  { id: 'trip_guard', label: '行程守護 (Line)', prompt: '我想要啟用行程守護功能，監控我下午從上野到羽田機場的路線。' },
  { id: 'home', label: '我要回家', prompt: '我想回家，請告訴我最近的車站或交通方式' },
  { id: 'shop', label: '我想逛街/吃飯', prompt: '這附近有什麼推薦的餐廳或逛街景點？' },
  { id: 'access', label: '我需要無障礙路線', prompt: '我需要無障礙設施（電梯、坡道），請協助規劃路線' }
]

type TripGuardStatus = 'inactive' | 'active' | 'alert'

export default function FullScreenAssistant({ open, onClose, nodeId }: Props) {
  const { t } = useLanguage()
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinePrompt, setShowLinePrompt] = useState(false)
  const [tripGuardStatus, setTripGuardStatus] = useState<TripGuardStatus>('inactive')
  
  const esRef = useRef<EventSource | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const QUICK_QUESTIONS_LOCALIZED = [
    { id: 'trip_guard', label: t('navigation.tripGuard'), prompt: t('header.langLabel') === '日' ? '上野から羽田空港までのルートをトリップガードで監視してください。' : '我想要啟用行程守護功能，監控我下午從上野到羽田機場的路線。' },
    { id: 'home', label: t('common.home'), prompt: t('header.langLabel') === '日' ? '家に帰りたいです。最寄りの駅を教えてください。' : '我想回家，請告訴我最近的車站或交通方式' },
    { id: 'shop', label: t('actions.asakusa'), prompt: t('header.langLabel') === '日' ? '浅草に行きたいです。' : '我想去淺草。' },
  ]

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, showLinePrompt])

  useEffect(() => {
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [])

  const handleSubmit = async (queryText: string = text) => {
    const q = queryText.trim()
    if (!q || loading) return

    setError(null)
    setLoading(true)
    setText('')
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }])

    // Special case for Trip Guard simulation
    if (q.includes('行程守護') || q.includes('監視') || q.includes('Trip Guard')) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: t('header.langLabel') === '日' 
            ? '了解しました。トリップガードを有効にしました。上野駅から羽田機場までのルートをリアルタイムで監視します。遅延が発生した場合はLINEで通知します。' 
            : '好的，已為您開啟行程守護。我會持續監控上野站到羽田機場的路線。若有任何延誤，我會透過 LINE 即時通知您。', 
          timestamp: Date.now() 
        }])
        setLoading(false)
        setShowLinePrompt(true)
        setTripGuardStatus('active')

        // Simulate a delayed alert
        setTimeout(() => {
          setTripGuardStatus('alert')
          setMessages(prev => [...prev, {
            role: 'ai',
            content: '🚨 【行程警報】偵測到京急線因信號故障發生延誤，預計影響 20 分鐘。建議您改搭 東京單軌電車 (Tokyo Monorail) 前往羽田機場。',
            timestamp: Date.now()
          }])
        }, 5000)
      }, 1000)
      return
    }

    try {
      // Close previous stream if any
      if (esRef.current) {
        esRef.current.close()
      }

      const params = new URLSearchParams()
      params.set('q', q)
      if (nodeId) params.set('node_id', nodeId)

      const es = new EventSource(`/api/assistant?${params.toString()}`)
      esRef.current = es

      // Initial AI message placeholder
      setMessages(prev => [...prev, { role: 'ai', content: '', timestamp: Date.now() }])

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'done') {
            es.close()
            setLoading(false)
            return
          }

          if (data.type === 'message' && data.content) {
            setMessages(prev => {
              const newMsgs = [...prev]
              const lastMsg = newMsgs[newMsgs.length - 1]
              if (lastMsg.role === 'ai') {
                lastMsg.content += data.content
              }
              return newMsgs
            })
          }

          if (data.type === 'alerts' && Array.isArray(data.content)) {
             setMessages(prev => [...prev, { 
               role: 'ai', 
               content: `⚠️ 注意：有 ${data.content.length} 個相關警報`, 
               timestamp: Date.now() 
             }])
          }
        } catch (e) {
          console.error('Failed to parse AI message:', e)
        }
      }

      es.onerror = (event) => {
        console.error('Stream error:', event)
        setError('連線中斷，請重試。')
        setLoading(false)
        es.close()
      }

    } catch (err) {
      console.error(err)
      setError('無法連接到 AI 服務')
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm md:inset-auto md:bottom-24 md:right-6 md:h-[600px] md:w-[400px] md:bg-transparent md:backdrop-blur-none pointer-events-none">
      <div className="pointer-events-auto flex h-full w-full flex-col bg-white shadow-2xl md:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-blue-200 shadow-lg">
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{t('dashboard.aiGuide')}</h3>
              <div className="flex items-center gap-1.5">
                <div className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  tripGuardStatus === 'active' ? "bg-blue-500 animate-pulse" : 
                  tripGuardStatus === 'alert' ? "bg-red-500 animate-ping" : "bg-green-500 animate-pulse"
                )} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {tripGuardStatus === 'active' ? 'Trip Guard Active' : 
                   tripGuardStatus === 'alert' ? 'Abnormal Detected' : 'Online'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close Assistant"
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-90"
          >
            <X size={22} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 space-y-4 scrollbar-hide">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-blue-50 p-6 rounded-3xl mb-4 shadow-inner">
                <Navigation className="w-10 h-10 text-blue-500" />
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">{t('dashboard.aiWelcome')}</h4>
              <p className="text-gray-400 text-sm max-w-[200px] leading-relaxed">我能為您規劃路線、尋找設施或開啟行程守護。</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div 
              key={`${msg.timestamp}-${idx}`} 
              className={clsx(
                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={clsx(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
              )}>
                {msg.content ? (
                  <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                ) : (
                  <div className="flex space-x-1.5 h-5 items-center px-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {showLinePrompt && (
            <div className="flex justify-start animate-in zoom-in-95 duration-500">
              <div className="max-w-[85%] bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl rounded-tl-none p-4 shadow-lg border border-green-400/20">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={18} />
                  <span className="font-bold">{t('dashboard.tripGuardEnroll')}</span>
                </div>
                <p className="text-xs text-green-50 mb-4 opacity-90 leading-relaxed">
                  {t('dashboard.tripGuardDesc')}
                </p>
                <button className="w-full bg-white text-green-600 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md">
                  <img src="/line-icon.png" alt="LINE" className="w-4 h-4" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  立即加入 LINE 守護
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 text-red-600 text-[10px] font-bold px-4 py-1.5 rounded-full border border-red-100 uppercase tracking-wider">
                {error}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-4">
           <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
             {QUICK_QUESTIONS_LOCALIZED.map(q => (
               <button
                 key={q.id}
                 onClick={() => handleSubmit(q.prompt)}
                 className="flex-shrink-0 px-4 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-gray-600 text-xs font-bold rounded-xl transition-all whitespace-nowrap border border-gray-100 shadow-sm active:scale-95"
               >
                 {q.label}
               </button>
             ))}
           </div>
        
          {/* Input Area */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('common.inputPlaceholder')}
                className="w-full bg-gray-50 text-gray-900 text-sm rounded-2xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-gray-100 group-hover:border-gray-200 transition-all"
                disabled={loading}
              />
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={!text.trim() || loading}
              aria-label="Send Message"
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-2xl p-3 shadow-lg shadow-blue-200 transition-all active:scale-90"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
