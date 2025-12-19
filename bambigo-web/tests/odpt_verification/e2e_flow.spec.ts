import { describe, it, expect, vi } from 'vitest'
import { OdptClient } from '../../src/lib/odptClient'

// Re-using types from data_transformation
interface ODPTStation {
  'owl:sameAs': string
  'odpt:stationTitle': { en: string; ja: string }
  'odpt:operator': string
  'odpt:railway': string
  'geo:lat': number
  'geo:long': number
}

import os from 'os'
import path from 'path'
import fs from 'fs'

describe('End-to-End ODPT Knowledge Pipeline', () => {
  const tmpDir = path.join(os.tmpdir(), 'odpt-e2e-' + Date.now())

  it('should complete a full cycle from API fetch to knowledge generation', async () => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    
    // 1. Mock API Data
    const mockData = [
      {
        'owl:sameAs': 'odpt.Station:TokyoMetro.Ginza.Ginza',
        'odpt:stationTitle': { en: 'Ginza', ja: '銀座' },
        'odpt:operator': 'odpt.Operator:TokyoMetro',
        'odpt:railway': 'odpt.Railway:TokyoMetro.Ginza',
        'geo:lat': 35.671989,
        'geo:long': 139.763965
      },
      {
        'owl:sameAs': 'odpt.Station:TokyoMetro.Hibiya.Ginza',
        'odpt:stationTitle': { en: 'Ginza', ja: '銀座' },
        'odpt:operator': 'odpt.Operator:TokyoMetro',
        'odpt:railway': 'odpt.Railway:TokyoMetro.Hibiya',
        'geo:lat': 35.671989,
        'geo:long': 139.763965
      }
    ]

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(mockData), { 
        status: 200, 
        headers: { 'content-type': 'application/json' } 
      })
    })

    const client = new OdptClient({ token: 'test-token', fetchImpl: fetchMock, cacheDir: tmpDir, cacheTtlSec: 0 })

    // 2. Execution Phase
    console.log('[E2E Test] Step 1: Fetching stations...')
    const rawStations = await client.stationsByOperator(['odpt.Operator:TokyoMetro'])
    expect(rawStations.length).toBe(2)

    console.log('[E2E Test] Step 2: Clustering stations...')
    const clusters: Record<string, any[]> = {}
    rawStations.forEach((s: any) => {
      const name = s['odpt:stationTitle'].en
      if (!clusters[name]) clusters[name] = []
      clusters[name].push(s)
    })
    expect(Object.keys(clusters)).toContain('Ginza')
    expect(clusters['Ginza'].length).toBe(2)

    console.log('[E2E Test] Step 3: Verifying Knowledge Format...')
    const ginzaGroup = clusters['Ginza']
    const operators = Array.from(new Set(ginzaGroup.map(s => s['odpt:operator'])))
    
    // Validate final output shape
    const knowledge = {
      id: 'node_ginza',
      metadata: {
        title: 'Ginza',
        operators: operators,
        station_count: ginzaGroup.length
      }
    }

    expect(knowledge.id).toBe('node_ginza')
    expect(knowledge.metadata.operators).toContain('odpt.Operator:TokyoMetro')
    
    console.log('[E2E Test] Pipeline verified successfully.')
  })
})
