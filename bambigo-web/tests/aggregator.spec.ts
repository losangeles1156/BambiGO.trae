import { describe, it, expect } from 'vitest'
import { GET as AggregatorGET } from '../src/app/api/nodes/live/facilities/route'

describe('Aggregator API (/api/nodes/live/facilities)', () => {
  it('returns 200 with bbox-only and empty facilities', async () => {
    const req = new Request('http://localhost/api/nodes/live/facilities?bbox=139.73,35.65,139.82,35.74')
    const res = await AggregatorGET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toBeTruthy()
    expect(json.live).toBeTruthy()
    expect(json.nodes).toBeTruthy()
    expect(json.facilities).toBeTruthy()
    expect(Array.isArray(json.facilities.items)).toBe(true)
  })

  it('returns 200 with node_id and facilities present (may be empty without DB)', async () => {
    const req = new Request('http://localhost/api/nodes/live/facilities?node_id=test-node-1&limit_nodes=5&limit_mobility=5&limit_facilities=5')
    const res = await AggregatorGET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toBeTruthy()
    expect(json.facilities).toBeTruthy()
    expect(Array.isArray(json.facilities.items)).toBe(true)
  })
})

