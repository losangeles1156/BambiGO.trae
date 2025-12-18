import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OdptClient } from '../src/lib/odptClient'

describe('OdptClient', () => {
  beforeEach(() => {
    vi.stubEnv('ODPT_API_TOKEN', 'test-token')
  })

  it('retries on 429 and succeeds', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls++
      if (calls < 3) {
        return new Response('rate limited', { status: 429, headers: { 'content-type': 'text/plain' } })
      }
      return new Response(JSON.stringify([{ ok: true }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any

    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 0 })
    const data = await (client as any).request('odpt:Station', { 'odpt:operator': 'odpt.Operator:TokyoMetro' })
    expect(Array.isArray(data)).toBe(true)
    expect(calls).toBe(3)
  })

  it('parses xml when content-type is xml', async () => {
    const xml = '<root><item id="1"/></root>'
    const fetchMock = vi.fn(async () => {
      return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } })
    }) as any
    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 0 })
    const data = await (client as any).request('odpt:Dummy', {})
    expect((data as any).root.item.id).toBe('1')
  })

  it('caches responses to avoid duplicate fetch', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls++
      return new Response(JSON.stringify([{ id: calls }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any
    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 60 })
    const p1 = await (client as any).request('odpt:Station', { q: 1 })
    const p2 = await (client as any).request('odpt:Station', { q: 1 })
    expect(calls).toBe(1)
    expect(JSON.stringify(p1)).toEqual(JSON.stringify(p2))
  })
})

