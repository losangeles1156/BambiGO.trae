import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OdptClient } from '../../src/lib/odptClient'

import os from 'os'
import path from 'path'
import fs from 'fs'

describe('ODPT API Connection & Performance', () => {
  const token = process.env.ODPT_API_TOKEN || 'test-token'
  const tmpDir = path.join(os.tmpdir(), 'odpt-verify-' + Date.now())

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  })

  it('should successfully connect to ODPT API and fetch stations', async () => {
    // Check if token is real
    const isRealToken = token && token !== 'test-token' && !token.startsWith('your_')
    
    if (!isRealToken) {
      console.log('[ODPT Test] Skipping real connection test (no valid token). Using mock.')
      const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify([{ 'owl:sameAs': 'mock' }]), { 
          status: 200, 
          headers: { 'content-type': 'application/json' } 
        })
      })
      const client = new OdptClient({ token, fetchImpl: fetchMock, cacheDir: tmpDir, cacheTtlSec: 0 })
      const data = await client.stationsByOperator(['odpt.Operator:Yurikamome'])
      expect(Array.isArray(data)).toBe(true)
      return
    }

    const client = new OdptClient({ token, cacheDir: tmpDir, cacheTtlSec: 0 })
    const startTime = Date.now()
    const data = await client.stationsByOperator(['odpt.Operator:Yurikamome'])
    const duration = Date.now() - startTime
    
    console.log(`[ODPT Test] Real connection successful. Duration: ${duration}ms`)
    expect(Array.isArray(data)).toBe(true)
  }, 15000) // 15s timeout for real API

  it('should handle invalid tokens gracefully (403)', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('Forbidden', { status: 403 })
    })
    const client = new OdptClient({ token: 'invalid-token', fetchImpl: fetchMock, cacheDir: tmpDir, cacheTtlSec: 0 })
    await expect(client.stationsByOperator(['odpt.Operator:TokyoMetro']))
      .rejects.toThrow(/ODPT HTTP 403/)
  })

  it('should respect rate limiting and retry (429/503)', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls++
      if (calls === 1) {
        return new Response('Rate Limit Exceeded', { status: 429, headers: { 'content-type': 'text/plain' } })
      }
      return new Response(JSON.stringify([{ 'owl:sameAs': 'test' }]), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const client = new OdptClient({ token, fetchImpl: fetchMock, throttleMs: 0, cacheDir: tmpDir, cacheTtlSec: 0 })
    const data = await client.stationsByOperator(['odpt.Operator:TokyoMetro'])
    
    expect(calls).toBe(2)
    expect(data.length).toBe(1)
  })
})
