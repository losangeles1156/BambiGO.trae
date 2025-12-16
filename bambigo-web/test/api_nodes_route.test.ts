import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '../src/app/api/nodes/route'

describe('/api/nodes route', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.NODES_RATE_LIMIT
  })

  it('includes X-API-Version header on success without DB', async () => {
    const res = await GET(new Request('http://localhost/api/nodes'))
    expect(res.headers.get('X-API-Version')).toBe('v4.1-strict')
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })

  it('returns 400 and header for invalid bbox', async () => {
    const res = await GET(new Request('http://localhost/api/nodes?bbox=a,b,c,d'))
    expect(res.status).toBe(400)
    expect(res.headers.get('X-API-Version')).toBe('v4.1-strict')
  })

  it('rate limits when NODES_RATE_LIMIT is enabled', async () => {
    process.env.NODES_RATE_LIMIT = '1,2'
    const req1 = new Request('http://localhost/api/nodes', { headers: { 'x-forwarded-for': '1.2.3.4' } })
    const req2 = new Request('http://localhost/api/nodes', { headers: { 'x-forwarded-for': '1.2.3.4' } })
    const r1 = await GET(req1)
    const r2 = await GET(req2)
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(429)
    expect(r2.headers.get('Retry-After')).toBeTruthy()
    expect(r2.headers.get('X-API-Version')).toBe('v4.1-strict')
  })
})

