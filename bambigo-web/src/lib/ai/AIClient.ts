import { AICommand } from './control/types'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  command?: AICommand
  timestamp: number
}

type AIEventHandler<T = any> = (event: string, data: T) => void

class AIClient {
  private static instance: AIClient
  private socket: WebSocket | null = null
  private listeners: Map<string, Set<AIEventHandler>> = new Map()
  private url: string = process.env.NEXT_PUBLIC_AI_WS_URL || 'wss://api.bambigo.com/v1/ai/stream'
  private mockMode: boolean = !process.env.NEXT_PUBLIC_AI_WS_URL
  private reconnectTimer: any = null
  private maxRetries: number = 5
  private retryCount: number = 0

  private constructor() {
    if (this.mockMode && typeof window !== 'undefined') {
      console.log('[AIClient] Initialized in MOCK mode (No WebSocket URL provided)')
    }
  }

  static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient()
    }
    return AIClient.instance
  }

  connect() {
    if (typeof window === 'undefined') return
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return

    if (this.mockMode) {
      this.emit('status', 'connected')
      // Simulate incoming command after connection
      setTimeout(() => {
        this.emit<AIMessage>('message', {
          role: 'assistant',
          content: '系統已連線。隨時準備導航。',
          timestamp: Date.now()
        })
        
        // Demo: Simulate AI triggering a route after 3 seconds
        setTimeout(() => {
          this.emit<AIMessage>('message', {
            role: 'assistant',
            content: '為您規劃前往東京塔的路線。',
            command: {
              type: 'UPDATE_NAVIGATION',
              payload: {
                steps: [
                  { id: 'a1', type: 'start', instruction: '從目前位置出發', distance: 0, secondaryText: '起點' },
                  { id: 'a2', type: 'turn-right', instruction: '右轉進入櫻田通', distance: 150 },
                  { id: 'a3', type: 'straight', instruction: '直行 500 公尺', distance: 500 },
                  { id: 'a4', type: 'arrive', instruction: '抵達東京塔', distance: 0 }
                ]
              }
            },
            timestamp: Date.now()
          })
        }, 3000)
      }, 800)
      return
    }

    try {
      console.log(`[AIClient] Connecting to ${this.url}...`)
      this.socket = new WebSocket(this.url)
      
      this.socket.onopen = () => {
        console.log('[AIClient] WebSocket Connected')
        this.retryCount = 0
        this.emit('status', 'connected')
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.emit('message', data)
        } catch (e) {
          console.warn('[AIClient] Failed to parse message:', event.data)
        }
      }

      this.socket.onclose = (event) => {
        console.log(`[AIClient] WebSocket Closed: ${event.code} ${event.reason}`)
        this.emit('status', 'disconnected')
        this.attemptReconnect()
      }

      this.socket.onerror = (error) => {
        console.error('[AIClient] WebSocket Error:', error)
        this.emit('error', error)
      }
    } catch (e) {
      console.error('[AIClient] Connection failed:', e)
      this.attemptReconnect()
    }
  }

  private attemptReconnect() {
    if (this.mockMode || this.retryCount >= this.maxRetries) return
    
    this.retryCount++
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000)
    console.log(`[AIClient] Attempting reconnect in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`)
    
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.emit('status', 'disconnected')
  }

  send(message: string) {
    if (this.mockMode) {
      // Simulate response with a command based on keyword
      setTimeout(() => {
        let command: AICommand | undefined
        const lower = message.toLowerCase()
        
        if (lower.includes('nav') || lower.includes('go')) {
          command = { type: 'NAVIGATE', payload: { to: '東京鐵塔' } }
        } else if (lower.includes('dash') || lower.includes('board')) {
          command = { type: 'VIEW_MODE', payload: { mode: 'dashboard' } }
        } else if (lower.includes('explore')) {
          command = { type: 'VIEW_MODE', payload: { mode: 'explore' } }
        }

        this.emit<AIMessage>('message', {
          role: 'assistant',
          content: `模擬回應: "${message}"`,
          command,
          timestamp: Date.now()
        })
      }, 1000)
      return
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ 
        content: message,
        timestamp: Date.now()
      }))
    } else {
      console.warn('[AIClient] Cannot send message: WebSocket not open')
    }
  }

  on<T = any>(event: string, handler: AIEventHandler<T>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as AIEventHandler)
    return () => this.off(event, handler)
  }

  off<T = any>(event: string, handler: AIEventHandler<T>) {
    this.listeners.get(event)?.delete(handler as AIEventHandler)
  }

  private emit<T = any>(event: string, data: T) {
    this.listeners.get(event)?.forEach(handler => handler(event, data))
  }
}

export const aiClient = AIClient.getInstance()
