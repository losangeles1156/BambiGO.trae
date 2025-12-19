import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OdptClient } from '../src/lib/odptClient'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('OdptClient', () => {
  const tmpDir = path.join(os.tmpdir(), 'odpt-test-' + Date.now())

  beforeEach(() => {
    vi.stubEnv('ODPT_API_TOKEN', 'test-token')
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('retries on 429 and succeeds', async () => {
    let calls = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      calls++
      if (calls < 3) {
        return new Response('rate limited', { status: 429, headers: { 'content-type': 'text/plain' } })
      }
      return new Response(JSON.stringify([{ ok: true }]), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 0 })
    const data = await (client as any).request('odpt:Station', { 'odpt:operator': 'odpt.Operator:TokyoMetro' })
    expect(Array.isArray(data)).toBe(true)
    expect(calls).toBe(3)
  })

  it('parses xml when content-type is xml', async () => {
    const xml = '<root><item id="1"/></root>'
    const fetchMock = vi.fn(async () => {
      return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } })
    })
    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 0 })
    const data = await (client as any).request('odpt:Dummy', {})
    const obj = data as { root: { item: { id: string } } }
    expect(obj.root.item.id).toBe('1')
  })

  it('caches responses to avoid duplicate fetch', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls++
      return new Response(JSON.stringify([{ id: calls }]), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = new OdptClient({ fetchImpl: fetchMock, throttleMs: 0, cacheTtlSec: 60, cacheDir: tmpDir })
    const p1 = await (client as any).request('odpt:Station', { q: 1 })
    const p2 = await (client as any).request('odpt:Station', { q: 1 })
    expect(calls).toBe(1)
    expect(JSON.stringify(p1)).toEqual(JSON.stringify(p2))
  })
})
