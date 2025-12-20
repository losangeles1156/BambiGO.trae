import { describe, it, expect } from 'vitest'
import {
  L1TagSchema,
  L2LiveStatusSchema,
  L3ServiceFacilitySchema,
  validateL3Facility,
} from '../src/lib/validators/tagging'

describe('validators/tagging', () => {
  it('accepts a valid L3 facility payload', () => {
    const facility = {
      id: 'facility-1',
      nodeId: 'node-1',
      category: 'toilet',
      subCategory: 'public',
      location: {
        floor: 'B1',
        direction: 'north-exit',
        coordinates: [139.0, 35.0],
      },
      provider: {
        type: 'public',
        name: 'City Office',
        requiresPurchase: false,
      },
      attributes: {
        has_wheelchair_access: true,
        has_baby_care: true,
      },
      openingHours: '09:00-18:00',
      source: 'manual',
      updatedAt: new Date().toISOString(),
    }

    const result = validateL3Facility(facility)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('rejects an invalid L3 facility payload', () => {
    const invalidFacility = {
      id: 123,
      nodeId: '',
      category: 'unknown',
      subCategory: 42,
      location: {
        coordinates: ['x', 'y'],
      },
      provider: {
        type: 'shop',
      },
      attributes: {},
    } as unknown

    const result = validateL3Facility(invalidFacility)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.issues.length).toBeGreaterThan(0)
  })

  it('validates L2 live status with boundary congestion levels', () => {
    const validLow = {
      transit: { status: 'normal' },
      congestion: { level: 1 },
      weather: { condition: 'sunny', temp: 20, precipChance: 0 },
      mobility: {
        availableBikes: 1,
        availableDocks: 1,
        stations: [
          {
            id: 's1',
            name: 'Station 1',
            bikesAvailable: 1,
            docksAvailable: 1,
            distance: 10,
          },
        ],
      },
    }

    const validHigh = {
      ...validLow,
      congestion: { level: 5 },
    }

    expect(L2LiveStatusSchema.safeParse(validLow).success).toBe(true)
    expect(L2LiveStatusSchema.safeParse(validHigh).success).toBe(true)

    const invalidTooLow = {
      ...validLow,
      congestion: { level: 0 },
    }

    const invalidTooHigh = {
      ...validLow,
      congestion: { level: 6 },
    }

    expect(L2LiveStatusSchema.safeParse(invalidTooLow).success).toBe(false)
    expect(L2LiveStatusSchema.safeParse(invalidTooHigh).success).toBe(false)
  })

  it('validates L1 tag basic fields and rejects wrong types', () => {
    const validTag = {
      id: 'tag-1',
      nodeId: 'node-1',
      mainCategory: 'shopping',
      subCategory: 'mall',
      name: {
        ja: 'モール',
        en: 'Mall',
        zh: '購物中心',
      },
      distanceMeters: 120,
      direction: 'north',
    }

    expect(L1TagSchema.safeParse(validTag).success).toBe(true)

    const invalidTag = {
      id: 'tag-2',
      nodeId: 'node-2',
      mainCategory: 'invalid',
      subCategory: 123,
      name: {},
    } as unknown

    expect(L1TagSchema.safeParse(invalidTag).success).toBe(false)
  })

  it('performs validation quickly for repeated calls', () => {
    const facility = {
      id: 'facility-perf',
      nodeId: 'node-perf',
      category: 'wifi',
      subCategory: 'cafe',
      location: {},
      provider: { type: 'shop' },
      attributes: {},
    }

    const start = Date.now()
    for (let i = 0; i < 1000; i += 1) {
      const result = L3ServiceFacilitySchema.safeParse(facility)
      expect(result.success).toBe(true)
    }
    const durationMs = Date.now() - start
    expect(durationMs).toBeLessThan(2000)
  })
})

