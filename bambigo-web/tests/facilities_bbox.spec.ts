import { describe, it, expect } from 'vitest'
import { GET as FacilitiesGET } from '../src/app/api/facilities/route'

describe('Facilities API (/api/facilities)', () => {
  it('returns 200 with bbox parameter (and no node_id)', async () => {
    // This assumes the implementation will be updated to accept bbox without node_id
    const req = new Request('http://localhost/api/facilities?bbox=139.73,35.65,139.82,35.74')
    const res = await FacilitiesGET(req)
    
    // Currently (before fix), this likely returns 400
    // We want it to return 200 (even if empty items due to no DB)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toBeTruthy()
    expect(Array.isArray(json.items)).toBe(true)
  })

  it('validates bbox format', async () => {
    const req = new Request('http://localhost/api/facilities?bbox=invalid')
    const res = await FacilitiesGET(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAMETER')
  })

  it('still supports node_id', async () => {
    const req = new Request('http://localhost/api/facilities?node_id=test-node')
    const res = await FacilitiesGET(req)
    expect(res.status).toBe(200)
  })
})
