import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Hybrid AI Architecture Flow', () => {
  const baseUrl = 'http://localhost:3000/api/assistant'

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-key')
    vi.stubEnv('AI_PROVIDER', 'mock')
    
    // Mock global fetch to prevent timeout on localhost calls
    global.fetch = vi.fn().mockImplementation((url) => {
       if (String(url).includes('facilities')) {
          return Promise.resolve({
             json: () => Promise.resolve({
               facilities: { items: [{ id: 'f1', type: 'toilet', l3: { category: 'toilet' } }] },
               live: { mobility: { stations: [] } }
             }),
             ok: true
          })
       }
       return Promise.resolve({
          json: () => Promise.resolve({}),
          ok: true
       })
    }) as any
  })

  // Helper to fetch and parse
  async function query(q: string) {
    // In a real E2E environment we would fetch against the running server.
    // For this test suite, we might need to mock the request if we are running in unit test mode.
    // However, since we are in a "project commander" role, I'll assume we want to test the route handler logic directly 
    // or assume the server is running.
    // Given the environment, I'll assume we can import the GET handler and call it with a mock Request object.
    
    // BUT, importing app/api/assistant/route.ts directly might be tricky with Next.js app directory structure in tests.
    // So instead, let's write a test that uses the standard fetch if the server is up, OR
    // we just verify the logic by importing the handler.
    // Let's try importing the handler.
    const { GET } = await import('../src/app/api/assistant/route')
    const req = new Request(`${baseUrl}?q=${encodeURIComponent(q)}`)
    const res = await GET(req)
    return res
  }

  it('routes "toilet" query to Tool Layer (JSON Fallback)', async () => {
    const res = await query('附近有廁所嗎')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('fallback')
    // Support both legacy 'cards' array and new 'primary/secondary' structure
    const cards = json.fallback.cards || [json.fallback.primary, ...json.fallback.secondary].filter(Boolean)
    expect(cards.length).toBeGreaterThan(0)
  })

  it('routes "weather" query to Tool Layer with Weather Card', async () => {
    const res = await query('今天天氣如何')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.fallback).toBeDefined()
    
    // Check for weather card
    const cards = json.fallback.cards || [json.fallback.primary, ...json.fallback.secondary].filter(Boolean)
    const weatherCard = cards.find((c: any) => c.title === '天氣提醒')
    expect(weatherCard).toBeDefined()
    expect(weatherCard.desc).toContain('建議攜帶雨具')
  })

  it('routes "navigation" query to Tool Layer with Nav Card', async () => {
    const res = await query('導航去東京站')
    expect(res.status).toBe(200)
    const json = await res.json()
    
    const cards = json.fallback.cards || [json.fallback.primary, ...json.fallback.secondary].filter(Boolean)
    const navCard = cards.find((c: { title?: string }) => c.title === '導航指引')
    expect(navCard).toBeDefined()
    expect(navCard.desc).toContain('即將推出')
  })

  it('routes "transit delay" query to Rule Layer', async () => {
    // "延誤" triggers Rule mode
    const res = await query('電車延誤了嗎')
    expect(res.status).toBe(200)
    
    // Rule mode without node context falls through to LLM stream
    const contentType = res.headers.get('Content-Type')
    expect(contentType).toBe('text/event-stream')
    
    // We don't parse JSON for stream response
  })
})
