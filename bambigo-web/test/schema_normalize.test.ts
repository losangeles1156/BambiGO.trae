import { describe, it, expect } from 'vitest'
import { normalizeFeatureCollection, pickStations, pickBusStops, safeName } from '../src/lib/schema'

describe('schema normalize', () => {
  it('normalizes unknown input to empty FeatureCollection', () => {
    const fc = normalizeFeatureCollection(undefined as unknown as object)
    expect(fc.type).toBe('FeatureCollection')
    expect(Array.isArray(fc.features)).toBe(true)
    expect(fc.features.length).toBe(0)
  })
  it('ensures properties and geometry exist', () => {
    const fc = normalizeFeatureCollection({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } }],
    })
    expect(fc.features[0].properties).toBeDefined()
    expect(fc.features[0].geometry).toBeDefined()
  })
  it('filters stations and bus stops correctly', () => {
    const fc = normalizeFeatureCollection({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { type: 'station' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { type: 'bus_stop' } },
      ],
    })
    expect(pickStations(fc).features.length).toBe(1)
    expect(pickBusStops(fc).features.length).toBe(1)
  })
  it('safeName returns default when name missing', () => {
    expect(safeName(undefined)).toEqual({ ja: '', en: '', zh: '' })
  })
})

