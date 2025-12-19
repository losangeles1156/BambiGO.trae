import { describe, it, expect, vi } from 'vitest'
import { fetchWalkingRoute } from '../src/lib/sop/engine'
import { dictionary } from '../src/i18n/dictionary'

describe('SOP Phase 3: Quality Assurance', () => {
  
  describe('Navigation Accuracy & Reliability', () => {
    it('should fetch a real walking route from OSRM', async () => {
      const start: [number, number] = [139.777, 35.713] // Ueno
      const end: [number, number] = [139.783, 35.706]   // Nearby shelter
      
      const route = await fetchWalkingRoute(start, end)
      
      expect(route).toBeDefined()
      expect(route.features.length).toBeGreaterThan(0)
      const properties = route.features[0].properties
      
      if (properties?.type === 'sop_route') {
        expect(properties.distance).toBeGreaterThan(0)
        expect(properties.duration).toBeGreaterThan(0)
        expect(route.features[0].geometry.type).toBe('LineString')
        if (route.features[0].geometry.type === 'LineString') {
          expect(route.features[0].geometry.coordinates.length).toBeGreaterThan(0)
        }
      }
    })

    it('should fallback to straight line on OSRM failure', async () => {
      // Mock fetch to fail
      const globalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const start: [number, number] = [139.777, 35.713]
      const end: [number, number] = [139.783, 35.706]
      
      const route = await fetchWalkingRoute(start, end)
      
      expect(route.features[0].geometry.type).toBe('LineString')
      if (route.features[0].geometry.type === 'LineString') {
        expect(route.features[0].geometry.coordinates).toHaveLength(2) // Start and End only
      }
      
      global.fetch = globalFetch
    })
  })

  describe('Multilingual Consistency', () => {
    it('should have consistent keys across all languages', () => {
      const locales = Object.keys(dictionary) as (keyof typeof dictionary)[]
      const referenceKeys = JSON.stringify(Object.keys(dictionary['zh-TW']))
      
      locales.forEach(lang => {
        expect(JSON.stringify(Object.keys(dictionary[lang]))).toBe(referenceKeys)
      })
    })

    it('should have all navigation keys translated', () => {
      const locales = Object.keys(dictionary) as (keyof typeof dictionary)[]
      locales.forEach(lang => {
        const nav = dictionary[lang].navigation
        expect(nav.title).toBeDefined()
        expect(nav.walking).toBeDefined()
        expect(nav.distance).toBeDefined()
      })
    })
  })

  describe('Performance Benchmarks', () => {
    it('should calculate route in less than 2 seconds (Real requirement: 2s)', async () => {
      const start: [number, number] = [139.777, 35.713]
      const end: [number, number] = [139.783, 35.706]
      
      const startTime = Date.now()
      await fetchWalkingRoute(start, end)
      const duration = Date.now() - startTime
      
      console.log(`Route calculation took: ${duration}ms`)
      expect(duration).toBeLessThan(2000)
    })
  })
})
