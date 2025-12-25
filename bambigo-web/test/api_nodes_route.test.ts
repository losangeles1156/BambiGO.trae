import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '../src/app/api/nodes/route'
import { POST as POSTStrategy } from '../src/app/api/nodes/[nodeId]/strategy/route'
import { POST as POSTTags, PUT as PUTTags } from '../src/app/api/nodes/[nodeId]/tags/route'
import { GET as GETCrowd, POST as POSTCrowd } from '../src/app/api/nodes/[nodeId]/crowd/route'

describe('/api/nodes route', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.NODES_RATE_LIMIT
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.BAMBIGO_DATA_MODE
    delete process.env.NEXT_PUBLIC_BAMBIGO_DATA_MODE
    delete process.env.BAMBIGO_MOCK_NODES
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test'
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

describe('/api/nodes/[nodeId]/strategy route', () => {
  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/nodes/mock-ueno-station/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    })
    const res = await POSTStrategy(req as unknown as Parameters<typeof POSTStrategy>[0], { params: Promise.resolve({ nodeId: 'mock-ueno-station' }) })
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j?.error?.code).toBe('INVALID_JSON')
  })
})

describe('/api/nodes/[nodeId]/tags route', () => {
  it('returns 400 for invalid JSON body on POST', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    const req = new Request('http://localhost/api/nodes/mock-ueno-station/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    })
    const res = await POSTTags(req as unknown as Parameters<typeof POSTTags>[0], { params: Promise.resolve({ nodeId: 'mock-ueno-station' }) })
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j?.error?.code).toBe('INVALID_JSON')
  })

  it('returns 400 for invalid JSON body on PUT', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    const req = new Request('http://localhost/api/nodes/mock-ueno-station/tags?id=mock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    })
    const res = await PUTTags(req as unknown as Parameters<typeof PUTTags>[0], { params: Promise.resolve({ nodeId: 'mock-ueno-station' }) })
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j?.error?.code).toBe('INVALID_JSON')
  })
})

describe('/api/nodes/[nodeId]/crowd route', () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __bambigoCrowdStore?: Map<string, unknown> }
    delete g.__bambigoCrowdStore
  })

  it('GET returns empty counts initially', async () => {
    const res = await GETCrowd(new Request('http://localhost/api/nodes/mock-ueno/crowd'), { params: Promise.resolve({ nodeId: 'mock-ueno' }) })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j).toMatchObject({
      node_id: 'mock-ueno',
      total: 0,
      counts: {
        very_comfort: 0,
        comfort: 0,
        ok: 0,
        crowded: 0,
        very_crowded: 0,
      },
    })
  })

  it('POST increments counts and total', async () => {
    const post = await POSTCrowd(
      new Request('http://localhost/api/nodes/mock-ueno/crowd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: 'ok' }),
      }),
      { params: Promise.resolve({ nodeId: 'mock-ueno' }) }
    )
    expect(post.status).toBe(200)
    const p = await post.json()
    expect(p).toMatchObject({ node_id: 'mock-ueno', total: 1 })
    expect(p.counts.ok).toBe(1)

    const get = await GETCrowd(new Request('http://localhost/api/nodes/mock-ueno/crowd'), { params: Promise.resolve({ nodeId: 'mock-ueno' }) })
    expect(get.status).toBe(200)
    const g = await get.json()
    expect(g.total).toBe(1)
    expect(g.counts.ok).toBe(1)
  })

  it('POST returns 400 for invalid choice', async () => {
    const res = await POSTCrowd(
      new Request('http://localhost/api/nodes/mock-ueno/crowd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: 'invalid' }),
      }),
      { params: Promise.resolve({ nodeId: 'mock-ueno' }) }
    )
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j?.error?.code).toBe('INVALID_CHOICE')
  })
})
