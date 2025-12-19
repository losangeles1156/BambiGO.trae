'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Navigation } from 'lucide-react'
import { clsx } from 'clsx'

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
  { id: 'home', label: '我要回家', prompt: '我想回家，請告訴我最近的車站或交通方式' },
  { id: 'shop', label: '我想逛街/吃飯', prompt: '這附近有什麼推薦的餐廳或逛街景點？' },
  { id: 'access', label: '我需要無障礙路線', prompt: '我需要無障礙設施（電梯、坡道），請協助規劃路線' }
]

export default function FullScreenAssistant({ open, onClose, nodeId }: Props) {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const esRef = useRef<EventSource | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

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
        <div className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
              <span className="text-lg">🦌</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">城市 AI 助理</h3>
              {loading && <p className="text-xs text-orange-500 animate-pulse">正在思考...</p>}
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close Assistant"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
              <div className="bg-orange-50 p-4 rounded-full mb-4">
                <Navigation className="w-8 h-8 text-orange-400" />
              </div>
              <p className="text-gray-500 text-sm">你好！我是你的城市 AI 助理，請問有什麼我可以幫你的嗎？</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div 
              key={`${msg.timestamp}-${idx}`} 
              className={clsx(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={clsx(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
              )}>
                {msg.content ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="flex space-x-1 h-5 items-center">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 text-red-600 text-xs px-3 py-1 rounded-full border border-red-100">
                {error}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        <div className="bg-white border-t px-4 py-3">
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
             {QUICK_QUESTIONS.map(q => (
               <button
                 key={q.id}
                 onClick={() => handleSubmit(q.prompt)}
                 className="flex-shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-full transition-colors whitespace-nowrap border border-gray-200"
               >
                 {q.label}
               </button>
             ))}
           </div>
        
          {/* Input Area */}
          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="你可以問我..."
                className="w-full bg-gray-100 text-gray-900 text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                disabled={loading}
              />
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={!text.trim() || loading}
              aria-label="Send Message"
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full p-2.5 shadow-sm transition-all active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
