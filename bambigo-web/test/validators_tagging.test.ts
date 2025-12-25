import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  L1TagSchema,
  L2LiveStatusSchema,
  L3ServiceFacilitySchema,
  validateL3Facility,
} from '../src/lib/validators/tagging'

import { GET as NodesGET } from '../src/app/api/nodes/route'
import { GET as FacilitiesGET } from '../src/app/api/facilities/route'
import { GET as LiveGET } from '../src/app/api/live/route'
import { GET as AggregatorGET } from '../src/app/api/nodes/live/facilities/route'

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

  it('validates mock /api/nodes response shape', async () => {
    const res = await NodesGET(new Request('http://localhost/api/nodes?mock=1'))
    expect(res.status).toBe(200)

    const json = await res.json()

    const FeatureSchema = z.object({
      type: z.literal('Feature'),
      geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        id: z.string(),
      }).passthrough(),
    }).passthrough()

    const FeatureCollectionSchema = z.object({
      type: z.literal('FeatureCollection'),
      features: z.array(FeatureSchema),
    })

    const parsed = FeatureCollectionSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('validates mock /api/facilities response shape', async () => {
    const res = await FacilitiesGET(new Request('http://localhost/api/facilities?node_id=mock-ueno&mock=1'))
    expect(res.status).toBe(200)
    const json = await res.json()

    const FacilityItemSchema = z.object({
      id: z.string(),
      node_id: z.string().nullable(),
      city_id: z.string().nullable(),
      type: z.string(),
      name: z.object({ ja: z.string().optional(), en: z.string().optional(), zh: z.string().optional() }).optional(),
      distance_meters: z.number().nullable().optional(),
      direction: z.string().nullable().optional(),
      floor: z.string().nullable().optional(),
      has_wheelchair_access: z.boolean(),
      has_baby_care: z.boolean(),
      is_free: z.boolean(),
      is_24h: z.boolean(),
      current_status: z.string(),
      status_updated_at: z.string().nullable().optional(),
      attributes: z.unknown().optional(),
      booking_url: z.string().nullable().optional(),
      suitability_tags: z.array(z.object({ tag: z.string(), confidence: z.number() })).optional(),
      l3: z.unknown().optional(),
    }).passthrough()

    const FacilitiesResponseSchema = z.object({
      items: z.array(FacilityItemSchema),
    })

    const parsed = FacilitiesResponseSchema.safeParse(json)
    expect(parsed.success).toBe(true)

    for (const item of parsed.success ? parsed.data.items : []) {
      if (item.l3) {
        const v = validateL3Facility(item.l3)
        expect(v.valid).toBe(true)
      }
    }
  })

  it('validates mock /api/live response shape', async () => {
    const res = await LiveGET(new Request('http://localhost/api/live?node_id=mock-ueno&mock=1&sim_transit=delayed'))
    expect(res.status).toBe(200)
    const json = await res.json()

    const LiveResponseSchema = z.object({
      node_id: z.string().nullable().optional(),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
      transit: z.object({
        status: z.enum(['normal', 'delayed', 'suspended', 'unknown']),
        delay_minutes: z.number().optional(),
        events: z.array(z.object({
          railway: z.string().optional(),
          section: z.string().optional(),
          status: z.string().optional(),
          delay: z.number().optional(),
          text: z.string().optional(),
        })).optional(),
      }),
      mobility: z.object({
        stations: z.array(z.object({
          id: z.string(),
          system_id: z.string(),
          system_name: z.string().nullable().optional(),
          name: z.string(),
          lon: z.number(),
          lat: z.number(),
          capacity: z.number().nullable().optional(),
          vehicle_types: z.array(z.string()).nullable().optional(),
          bikes_available: z.number(),
          docks_available: z.number(),
          is_renting: z.boolean(),
          is_returning: z.boolean(),
          status_updated_at: z.string().nullable().optional(),
          app_deeplink: z.string().nullable().optional(),
        }).passthrough()),
      }),
      odpt_station: z.object({
        station_code: z.string().optional(),
        railway: z.string().optional(),
        operator: z.string().optional(),
        connecting_railways: z.array(z.string()).optional(),
        exits: z.array(z.string()).optional(),
        raw: z.record(z.string(), z.unknown()).optional(),
      }).optional(),
      updated_at: z.string(),
    }).passthrough()

    const parsed = LiveResponseSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('validates mock /api/nodes/live/facilities aggregation response shape', async () => {
    const res = await AggregatorGET(new Request('http://localhost/api/nodes/live/facilities?node_id=mock-ueno&mock=1'))
    expect(res.status).toBe(200)

    const json = await res.json()
    const AggregatedSchema = z.object({
      nodes: z.unknown(),
      live: z.unknown(),
      facilities: z.unknown(),
      updated_at: z.string(),
    })

    const parsed = AggregatedSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('returns simulated errors when mock_error is set', async () => {
    const res = await AggregatorGET(new Request('http://localhost/api/nodes/live/facilities?node_id=mock-ueno&mock=1&mock_error=1'))
    expect(res.status).toBe(500)

    const json = await res.json()
    const ErrorSchema = z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
    })

    const parsed = ErrorSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })
})
