import { describe, it, expect, beforeAll } from 'vitest'
import { findNearestFacility, calculateDistance } from '../src/lib/sop/engine'
import { L3ServiceFacility } from '../src/types/tagging'
import { Client } from 'pg'
import { config } from 'dotenv'
import path from 'node:path'

config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

const dbUrl = process.env.DATABASE_URL!

describe('SOP Real Data Integration Test', () => {
  let realFacilities: L3ServiceFacility[] = []

  beforeAll(async () => {
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    
    try {
      // Fetch real shelters with GeoJSON location
      const query = `
        select 
          f.id, f.node_id, f.attributes, f.name as facility_name,
          ST_X(n.location::geometry) as lon,
          ST_Y(n.location::geometry) as lat
        from facilities f
        join nodes n on f.node_id = n.id
        where f.type = 'shelter' and f.source_dataset = 'tokyo_bousai'
        limit 50
      `
      const res = await client.query(query)
      
      realFacilities = res.rows.map(f => ({
        id: f.id,
        nodeId: f.node_id,
        category: 'shelter',
        subCategory: 'evacuation_center',
        location: {
          coordinates: [f.lon, f.lat] as [number, number]
        },
        provider: { type: 'public' },
        attributes: {
          ...f.attributes,
          ja: f.facility_name?.ja || 'Unknown'
        },
        source: 'official'
      }))
    } finally {
      await client.end()
    }
    
    console.log('Fetched real facilities count:', realFacilities.length)
  })

  it('should find the nearest real shelter from Ueno Station', () => {
    // Ueno Station coordinates approx
    const uenoLocation: [number, number] = [139.777, 35.713]
    
    const nearest = findNearestFacility(uenoLocation, realFacilities, 'shelter')
    
    console.log('Nearest Shelter Found:', nearest?.attributes.ja)
    
    expect(nearest).not.toBeNull()
    expect(nearest?.category).toBe('shelter')
    expect(nearest?.location.coordinates).toBeDefined()
  })

  it('should find a shelter within reasonable distance (< 2km)', () => {
    const uenoLocation: [number, number] = [139.777, 35.713]
    const nearest = findNearestFacility(uenoLocation, realFacilities, 'shelter')
    
    expect(nearest).not.toBeNull()
    if (nearest && nearest.location.coordinates) {
      const dist = calculateDistance(uenoLocation, nearest.location.coordinates)
      console.log(`Distance to nearest shelter: ${dist.toFixed(2)} meters`)
      expect(dist).toBeLessThan(2000)
    }
  })
})
