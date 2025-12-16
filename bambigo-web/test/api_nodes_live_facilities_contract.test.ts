import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '../src/app/api/nodes/live/facilities/route'
import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true })

// OpenAPI-derived JSON Schemas for contract validation
const geometrySchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['Point'] },
    coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 3 }
  },
  required: ['type', 'coordinates'],
}

const featureSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'Feature' },
    geometry: geometrySchema,
    properties: { type: 'object' },
  },
  required: ['type', 'geometry', 'properties'],
}

const featureCollectionSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'FeatureCollection' },
    features: { type: 'array', items: featureSchema },
  },
  required: ['type', 'features'],
}

const liveSchema = {
  type: 'object',
  properties: {
    node_id: { anyOf: [{ type: 'string' }, { type: 'null' }, { type: 'string' }] },
    bbox: { anyOf: [{ type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, { type: 'null' }] },
    transit: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['normal', 'delayed', 'suspended', 'unknown'] },
        delay_minutes: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      },
      required: ['status'],
    },
    mobility: {
      type: 'object',
      properties: {
        stations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              system_id: { type: 'string' },
              system_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              name: { type: 'string' },
              lon: { type: 'number' },
              lat: { type: 'number' },
              capacity: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              vehicle_types: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
              bikes_available: { type: 'number' },
              docks_available: { type: 'number' },
              is_renting: { type: 'boolean' },
              is_returning: { type: 'boolean' },
              status_updated_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              app_deeplink: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['id','system_id','name','lon','lat','bikes_available','docks_available','is_renting','is_returning'],
          },
        },
      },
      required: ['stations'],
    },
    updated_at: { type: 'string' },
  },
  required: ['transit','mobility','updated_at'],
}

const facilitiesSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          node_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          city_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          type: { type: 'string' },
          name: { type: 'object', additionalProperties: { type: 'string' } },
          distance_meters: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          direction: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          floor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          has_wheelchair_access: { type: 'boolean' },
          has_baby_care: { type: 'boolean' },
          is_free: { type: 'boolean' },
          is_24h: { type: 'boolean' },
          current_status: { type: 'string' },
          status_updated_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          attributes: {},
          booking_url: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          suitability_tags: {
            type: 'array', items: { type: 'object', properties: { tag: { type: 'string' }, confidence: { type: 'number' } }, required: ['tag','confidence'] }
          },
        },
        required: ['id','type','has_wheelchair_access','has_baby_care','is_free','is_24h','current_status'],
      },
    },
  },
  required: ['items'],
}

const aggSchema = {
  type: 'object',
  properties: {
    nodes: featureCollectionSchema,
    live: liveSchema,
    facilities: facilitiesSchema,
    updated_at: { type: 'string' },
  },
  required: ['nodes','live','facilities','updated_at'],
}

const validateAgg = ajv.compile(aggSchema)

describe('/api/nodes/live/facilities contract', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.SUPABASE_DB_URL
    delete process.env.SUPABASE_POSTGRES_URL
    delete process.env.SUPABASE_DATABASE_URL
    delete process.env.NODES_LIVE_FACILITIES_RATE_LIMIT
  })

  it('returns 200 with X-API-Version and valid aggregated payload (no DB)', async () => {
    const res = await GET(new Request('http://localhost/api/nodes/live/facilities?node_id=test-node&limit_facilities=2&limit_mobility=2'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-API-Version')).toBe('v4.1-strict')
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const body = await res.text()
    const json = JSON.parse(body)
    const ok = validateAgg(json)
    if (!ok) {
      throw new Error('Schema validation failed: ' + JSON.stringify(validateAgg.errors, null, 2))
    }
  })

  it('propagates 400 for invalid bbox', async () => {
    const res = await GET(new Request('http://localhost/api/nodes/live/facilities?bbox=a,b,c,d'))
    expect(res.status).toBe(400)
    expect(res.headers.get('X-API-Version')).toBe('v4.1-strict')
  })

  it('rate limits when NODES_LIVE_FACILITIES_RATE_LIMIT is enabled', async () => {
    process.env.NODES_LIVE_FACILITIES_RATE_LIMIT = '1,2'
    const req1 = new Request('http://localhost/api/nodes/live/facilities?node_id=test-node', { headers: { 'x-forwarded-for': '5.6.7.8' } })
    const req2 = new Request('http://localhost/api/nodes/live/facilities?node_id=test-node', { headers: { 'x-forwarded-for': '5.6.7.8' } })
    const r1 = await GET(req1)
    const r2 = await GET(req2)
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(429)
    expect(r2.headers.get('Retry-After')).toBeTruthy()
    expect(r2.headers.get('X-API-Version')).toBe('v4.1-strict')
  })
})
