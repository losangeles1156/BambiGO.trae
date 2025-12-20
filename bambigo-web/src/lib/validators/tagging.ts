import { z } from 'zod'

// --- Shared ---
export const LocalizedStringSchema = z.object({
  ja: z.string().optional(),
  en: z.string().optional(),
  zh: z.string().optional(),
})

// --- L1 ---
export const L1CategorySchema = z.enum([
  'dining',
  'shopping',
  'medical',
  'leisure',
  'education',
  'finance',
  'accommodation',
  'business',
  'religion',
  'public',
  'transport',
  'nature',
  'residential'
])

export const L1TagSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  mainCategory: L1CategorySchema,
  subCategory: z.string(),
  detailCategory: z.string().optional(),
  brand: z.string().optional(),
  name: LocalizedStringSchema,
  distanceMeters: z.number().optional(),
  direction: z.string().optional(),
})

// --- L2 ---
export const L2LiveStatusSchema = z.object({
  transit: z.object({
    status: z.enum(['normal', 'delay', 'suspended']),
    delayMinutes: z.number().optional(),
    message: z.string().optional(),
  }),
  congestion: z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    description: z.string().optional(),
  }),
  weather: z.object({
    condition: z.enum(['sunny', 'cloudy', 'rain', 'snow']),
    temp: z.number(),
    precipChance: z.number(),
  }),
  mobility: z.object({
    availableBikes: z.number(),
    availableDocks: z.number(),
    stations: z.array(z.object({
      id: z.string(),
      name: z.string(),
      bikesAvailable: z.number(),
      docksAvailable: z.number(),
      distance: z.number(),
    })),
  }),
})

// --- L3 ---
export const L3CategorySchema = z.enum([
  'toilet',
  'charging',
  'wifi',
  'locker',
  'accessibility',
  'rest_area',
  'shelter',
  'medical_aid',
  'other'
])

export const L3ProviderTypeSchema = z.enum(['public', 'station', 'shop'])

export const L3ServiceFacilitySchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  category: L3CategorySchema,
  subCategory: z.string(),
  
  location: z.object({
    floor: z.string().optional(),
    direction: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  }),
  
  provider: z.object({
    type: L3ProviderTypeSchema,
    name: z.string().optional(),
    requiresPurchase: z.boolean().optional(),
  }),
  
  attributes: z.record(z.string(), z.unknown()),
  
  openingHours: z.string().optional(),
  source: z.enum(['manual', 'osm', 'official']).optional(),
  updatedAt: z.string().optional(),
})

// --- L4 ---
export const L4CardTypeSchema = z.enum(['primary', 'secondary', 'alert'])

export const L4ActionCardSchema = z.object({
  type: L4CardTypeSchema,
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  tags: z.array(z.string()),
  actions: z.array(z.object({
    label: z.string(),
    uri: z.string(),
  })),
})

export type ValidationResult = {
  valid: boolean
  errors?: z.ZodError
}

export function validateL3Facility(data: unknown): ValidationResult {
  const result = L3ServiceFacilitySchema.safeParse(data)
  if (result.success) return { valid: true }
  return { valid: false, errors: result.error }
}
