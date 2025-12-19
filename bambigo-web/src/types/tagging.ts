// BambiGO Tagging System v2.0
// Based on TAGGING_SYSTEM.md

export type LocalizedString = {
  ja?: string
  en?: string
  zh?: string
}

// --- L1: Life Functions ---
export type L1Category = 
  | 'dining' 
  | 'shopping' 
  | 'medical' 
  | 'leisure' 
  | 'education' 
  | 'finance'
  | 'accommodation' // 住宿
  | 'business'      // 商務/辦公
  | 'religion'      // 宗教
  | 'public'        // 公共設施
  | 'transport'     // 交通
  | 'nature'        // 自然景觀
  | 'residential'   // 住宅

export type L1Tag = {
  id: string
  nodeId: string
  mainCategory: L1Category
  subCategory: string // e.g., 'drugstore', 'izakaya'
  detailCategory?: string
  brand?: string
  name: LocalizedString
  distanceMeters?: number
  direction?: string
}

// --- L2: Live Status ---
export type L2LiveStatus = {
  transit: {
    status: 'normal' | 'delay' | 'suspended'
    delayMinutes?: number
    message?: string
  }
  congestion: {
    level: 1 | 2 | 3 | 4 | 5
    description?: string
  }
  weather: {
    condition: 'sunny' | 'cloudy' | 'rain' | 'snow'
    temp: number
    precipChance: number
  }
  mobility: {
    availableBikes: number
    availableDocks: number
    stations: Array<{
      id: string
      name: string
      bikesAvailable: number
      docksAvailable: number
      distance: number
    }>
  }
}

// --- L3: Service Facilities ---
export type L3Category = 'toilet' | 'charging' | 'wifi' | 'locker' | 'accessibility' | 'rest_area' | 'other'

export type L3ProviderType = 'public' | 'station' | 'shop'

export type L3ServiceFacility = {
  id: string
  nodeId: string
  category: L3Category
  subCategory: string // e.g., 'public_toilet', 'free_outlet'
  
  location: {
    floor?: string
    direction?: string
    coordinates?: [number, number]
  }
  
  provider: {
    type: L3ProviderType
    name?: string
    requiresPurchase?: boolean // e.g., cafe charging
  }
  
  attributes: Record<string, unknown> // Flexible attributes based on category
  
  openingHours?: string
  source?: 'manual' | 'osm' | 'official'
  updatedAt?: string
}

// --- L4: Action Strategy ---
export type L4CardType = 'primary' | 'secondary' | 'alert'

export type L4ActionCard = {
  type: L4CardType
  title: string
  description: string
  rationale: string // "Why this recommendation?"
  tags: string[] // Related L1/L3 tags
  actions: Array<{
    label: string
    uri: string // e.g., 'navigate:lat,lon', 'open:url'
  }>
}
