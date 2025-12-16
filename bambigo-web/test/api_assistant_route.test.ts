import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '../src/app/api/assistant/route'

beforeEach(() => {
  process.env.ASSISTANT_RATE_LIMIT = 'off'
  process.env.AI_PROVIDER = 'mock'
})

describe('assistant route', () => {
  it('returns 400 when q missing', async () => {
    const req = new Request('http://localhost/api/assistant')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })
  it('streams SSE for mock provider', async () => {
    const req = new Request('http://localhost/api/assistant?q=hello', { headers: { 'x-real-ip': '1.2.3.4' } })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })
  it('rate limits when exceeded', async () => {
    process.env.ASSISTANT_RATE_LIMIT = '1,1'
    const ipHdr = { headers: { 'x-real-ip': '9.9.9.9' } }
    const r1 = await GET(new Request('http://localhost/api/assistant?q=a', ipHdr))
    expect(r1.status).toBe(200)
    const r2 = await GET(new Request('http://localhost/api/assistant?q=b', ipHdr))
    expect(r2.status).toBe(429)
    expect(r2.headers.get('Retry-After')).toBeTruthy()
  })
})

