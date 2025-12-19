import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWalkingRoute, clearRouteCache } from '../src/lib/sop/engine'

// Mock fetch for OSRM
global.fetch = vi.fn()

describe('Navigation QA: Accuracy & Performance', () => {
  const mockStart: [number, number] = [139.7671, 35.6812] // Tokyo Station
  const mockEnd: [number, number] = [139.7774, 35.7141]   // Ueno Station

  beforeEach(() => {
    vi.clearAllMocks()
    clearRouteCache()
  })

  it('should fetch a valid route within 2 seconds', async () => {
    const startTime = Date.now()
    
    // Mock OSRM response
    ;(fetch as any).mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 4000,
          duration: 1200,
          geometry: {
            type: 'LineString',
            coordinates: [[139.7671, 35.6812], [139.7774, 35.7141]]
          },
          legs: [{
            steps: [
              { maneuver: { instruction: 'Go North', type: 'depart', modifier: 'north' }, distance: 100, duration: 30, location: [139.7671, 35.6812] },
              { maneuver: { instruction: 'Arrive', type: 'arrive' }, distance: 0, duration: 0, location: [139.7774, 35.7141] }
            ]
          }]
        }]
      })
    })

    const route = await fetchWalkingRoute(mockStart, mockEnd)
    const duration = Date.now() - startTime

    expect(route.type).toBe('FeatureCollection')
    expect(route.features.length).toBeGreaterThan(0)
    expect(duration).toBeLessThan(2000) // Phase 3 Requirement: < 2s
  })

  it('should support multiple route preferences', async () => {
    // Mock OSRM with alternatives
    ;(fetch as any).mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [
          { distance: 5000, duration: 1500, geometry: { type: 'LineString', coordinates: [] }, legs: [] },
          { distance: 4000, duration: 1800, geometry: { type: 'LineString', coordinates: [] }, legs: [] }
        ]
      })
    })

    const fastest = await fetchWalkingRoute(mockStart, mockEnd, { preference: 'fastest' })
    expect(fastest.features[0].properties?.preference).toBe('fastest')

    const shortest = await fetchWalkingRoute(mockStart, mockEnd, { preference: 'shortest' })
    expect(shortest.features[0].properties?.preference).toBe('shortest')
    expect(shortest.features[0].properties?.distance).toBe(4000)
  })

  it('should handle disaster zone avoidance (Safest Path)', async () => {
    // Mock OSRM with one safe and one unsafe route
    ;(fetch as any).mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [
          { 
            distance: 4000, 
            duration: 1200, 
            geometry: { 
              type: 'LineString', 
              coordinates: [[139.770, 35.700]] // This will be in the disaster zone
            },
            legs: []
          },
          { 
            distance: 5000, 
            duration: 1500, 
            geometry: { 
              type: 'LineString', 
              coordinates: [[139.780, 35.720]] // This will be safe
            },
            legs: []
          }
        ]
      })
    })

    const disasterZones = [{
      id: 'd1',
      type: 'flood' as const,
      severity: 'high' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[139.769, 35.699], [139.771, 35.699], [139.771, 35.701], [139.769, 35.701], [139.769, 35.699]]]
      }
    }]

    const safest = await fetchWalkingRoute(mockStart, mockEnd, { avoidZones: disasterZones })
    expect(safest.features[0].properties?.safety_status).toBe('safe')
    expect(safest.features[0].properties?.distance).toBe(5000)
  })
})
