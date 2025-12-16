export type BoundingBox = [number, number, number, number]

export interface CityAdapter {
  id: string
  name: { ja?: string; en?: string; zh?: string }
  bounds: BoundingBox
  zone_type: 'core' | 'buffer'
  features?: { hasSubway?: boolean; hasSharedMobility?: boolean; hasTaxiIntegration?: boolean }
}

