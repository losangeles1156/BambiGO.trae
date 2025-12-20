import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../src/app/api/assistant/route'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        if (token === 'valid-token') return { data: { user: { id: 'user-header-123' } }, error: null }
        return { data: { user: null }, error: { message: 'Invalid token' } }
      }
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null })
        })
      })
    })
  })
}))

beforeEach(() => {
  process.env.ASSISTANT_RATE_LIMIT = 'off'
  // process.env.AI_PROVIDER is unset by default in tests unless specified
})

describe('assistant route', () => {
  it('returns 400 when q missing', async () => {
    const req = new Request('http://localhost/api/assistant')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })
  it('returns 501 when no valid provider configured', async () => {
    process.env.AI_PROVIDER = 'mock' // 'mock' is no longer supported
    const req = new Request('http://localhost/api/assistant?q=hello', { headers: { 'x-real-ip': '1.2.3.4' } })
    const res = await GET(req)
    expect(res.status).toBe(501)
    expect(await res.json()).toEqual({ error: { code: 'NOT_IMPLEMENTED', message: 'No AI provider configured (mock)' } })
  })
  it('rate limits when exceeded', async () => {
    process.env.ASSISTANT_RATE_LIMIT = '1,1'
    process.env.AI_PROVIDER = 'dify'
    process.env.DIFY_API_KEY = 'test'
    process.env.DIFY_API_URL = 'http://test'
    
    // Mock fetch for Dify
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))

    const ipHdr = { headers: { 'x-real-ip': '9.9.9.9' } }
    const r1 = await GET(new Request('http://localhost/api/assistant?q=a', ipHdr))
    expect(r1.status).toBe(200)
    const r2 = await GET(new Request('http://localhost/api/assistant?q=b', ipHdr))
    expect(r2.status).toBe(429)
    expect(r2.headers.get('Retry-After')).toBeTruthy()
  })

  it('streams SSE for dify provider with auto-retry', async () => {
    process.env.ASSISTANT_RATE_LIMIT = 'off'
    process.env.AI_PROVIDER = 'dify'
    process.env.DIFY_API_KEY = 'test-key'
    process.env.DIFY_BASE_URL = 'https://api.dify.ai/v1' // Use BASE_URL instead of API_URL
    delete process.env.DIFY_API_URL
    process.env.DIFY_MAX_RETRIES = '2'

    let calls = 0
    // Mock fetch for Dify chat-messages
    // First call fails, second returns a streaming body
    global.fetch = (async (url: any, _init?: any) => {
      if (String(url).includes('/chat-messages')) {
        calls += 1
        if (calls < 2) {
          return new Response('error', { status: 500 }) as any
        }
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"event":"message","answer":"hello"}\n\n'))
            controller.enqueue(encoder.encode('data: {"event":"message_end"}\n\n'))
            controller.close()
          }
        })
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }) as any
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any
    }) as any

    const req = new Request('http://localhost/api/assistant?q=hello', { headers: { 'x-real-ip': '8.8.8.8' } })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('maintains conversation_id across dify requests by ip', async () => {
    process.env.ASSISTANT_RATE_LIMIT = 'off'
    process.env.AI_PROVIDER = 'dify'
    process.env.DIFY_API_KEY = 'test-key'
    process.env.DIFY_API_URL = 'https://api.dify.ai/v1'

    const bodies: string[] = []
    global.fetch = (async (url: any, init?: any) => {
      if (String(url).includes('/chat-messages')) {
        if (init?.body) bodies.push(String(init.body))
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"event":"message","answer":"hello","conversation_id":"conv-xyz"}\n\n'))
            controller.enqueue(encoder.encode('data: {"event":"message_end","conversation_id":"conv-xyz"}\n\n'))
            controller.close()
          }
        })
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }) as any
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any
    }) as any

    const ipHdr = { headers: { 'x-real-ip': '1.1.1.1' } }
    const r1 = await GET(new Request('http://localhost/api/assistant?q=hi', ipHdr))
    expect(r1.status).toBe(200)
    const r2 = await GET(new Request('http://localhost/api/assistant?q=hi again', ipHdr))
    expect(r2.status).toBe(200)
    expect(bodies.length).toBeGreaterThanOrEqual(2)
    const secondBody = JSON.parse(bodies[1])
    expect(secondBody.conversation_id).toBe('conv-xyz')
  })

  it('maintains conversation_id via Authorization header', async () => {
    process.env.ASSISTANT_RATE_LIMIT = 'off'
    process.env.AI_PROVIDER = 'dify'
    process.env.DIFY_API_KEY = 'test-key'
    process.env.DIFY_API_URL = 'https://api.dify.ai/v1'

    const bodies: string[] = []
    global.fetch = (async (url: any, init?: any) => {
      if (String(url).includes('/chat-messages')) {
        if (init?.body) bodies.push(String(init.body))
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"event":"message","answer":"hi","conversation_id":"conv-auth"}\n\n'))
            controller.close()
          }
        })
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }) as any
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any
    }) as any

    const headers = { 'Authorization': 'Bearer valid-token' }
    const r1 = await GET(new Request('http://localhost/api/assistant?q=hi', { headers }))
    expect(r1.status).toBe(200)
    
    const r2 = await GET(new Request('http://localhost/api/assistant?q=hi again', { headers }))
    expect(r2.status).toBe(200)

    expect(bodies.length).toBeGreaterThanOrEqual(2)
    const secondBody = JSON.parse(bodies[1])
    expect(secondBody.conversation_id).toBe('conv-auth')
  })
})
