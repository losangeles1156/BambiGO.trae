export type TagLayer = 'L1' | 'L2' | 'L3' | 'L4'

export type L1Tag = {
  mainCategory: string
  subCategory: string
  detailCategory?: string | null
}

export type L3Tag = {
  category: string
  subCategory: string
}

export type AppTag = {
  id: string
  layer: TagLayer
  label: string
  l1?: L1Tag
  l3?: L3Tag
}

export type TagState = {
  tags: AppTag[]
}

export function createTag(state: TagState, tag: AppTag): TagState {
  const exists = state.tags.some((t) => t.id === tag.id)
  const tags = exists ? state.tags.map((t) => (t.id === tag.id ? tag : t)) : [...state.tags, tag]
  return { tags }
}

export function updateTag(state: TagState, id: string, patch: Partial<AppTag>): TagState {
  const tags = state.tags.map((t) => (t.id === id ? { ...t, ...patch } : t))
  return { tags }
}

export function deleteTag(state: TagState, id: string): TagState {
  const tags = state.tags.filter((t) => t.id !== id)
  return { tags }
}

export type FacilityItem = {
  id: string
  type: string
  name?: { ja?: string; en?: string; zh?: string }
  suitability_tags?: { tag: string; confidence: number }[]
}

export function filterFacilitiesByTags(items: FacilityItem[], tags: AppTag[]): FacilityItem[] {
  const l3 = tags.filter((t) => t.layer === 'L3' && t.l3)
  if (!l3.length) return items.slice()
  const wanted = new Set<string>(l3.map((t) => `${t.l3!.category}:${t.l3!.subCategory}`))
  return items.filter((f) => {
    const suits = Array.isArray(f.suitability_tags) ? f.suitability_tags : []
    return suits.some((s) => wanted.has(`${mapSuitabilityToCategory(s.tag)}:${s.tag}`))
  })
}

export function buildSuitabilityQuery(tags: AppTag[], minConfidence = 0): { tag?: string; minConfidence?: number } {
  const l3 = tags.find((t) => t.layer === 'L3' && t.l3)
  if (!l3) return {}
  const tag = l3.l3!.subCategory
  return { tag, minConfidence }
}

export function mapSuitabilityToCategory(sub: string): string {
  if (/toilet|accessible_toilet/i.test(sub)) return 'toilet'
  if (/wifi/i.test(sub)) return 'wifi'
  if (/charging|outlet|power/i.test(sub)) return 'charging'
  if (/locker|luggage/i.test(sub)) return 'locker'
  if (/elevator|escalator|wheelchair/i.test(sub)) return 'accessibility'
  return 'other'
}

export function makeLabel(tag: AppTag): string {
  if (tag.layer === 'L1' && tag.l1) {
    const { mainCategory, subCategory, detailCategory } = tag.l1
    return [mainCategory, subCategory, detailCategory].filter(Boolean).join(' > ')
  }
  if (tag.layer === 'L3' && tag.l3) {
    const { category, subCategory } = tag.l3
    return `${category} > ${subCategory}`
  }
  return tag.label
}

export function derivePersonaFromFacilities(
  items: Array<{ type: string; has_wheelchair_access?: boolean; has_baby_care?: boolean }>,
  extra?: { 
    l1MainCategory?: string;
    l1SubCategory?: string;
    transit?: { status?: string } 
  }
): string[] {
  const personas: string[] = []
  const types = new Set(items.map((f) => String(f.type).toLowerCase()))
  
  const hasWifi = Array.from(types).some((t) => t.includes('wifi'))
  const hasCharging = Array.from(types).some((t) => /charge|charging|outlet|power/i.test(t))
  const hasToilet = Array.from(types).some((t) => t.includes('toilet'))
  const hasAccessibility = items.some((f) => f.has_wheelchair_access === true)
  const hasBaby = items.some((f) => f.has_baby_care === true)
  const transit = extra?.transit?.status

  // L1 Context Logic
  const l1Main = extra?.l1MainCategory?.toLowerCase()
  const l1Sub = extra?.l1SubCategory?.toLowerCase()

  if (l1Main === 'nature') {
    personas.push('自然療癒') // Nature Healer
    if (l1Sub === 'mountain') personas.push('登山健行')
  }
  
  if (l1Main === 'religion') {
    personas.push('心靈寄託') // Spiritual
    if (l1Sub === 'shrine') personas.push('神社巡禮')
  }

  if (l1Main === 'business') {
    personas.push('商務核心') // Business Hub
    if (hasWifi && hasCharging) personas.push('行動辦公室')
  }
  
  if (l1Main === 'accommodation') {
    personas.push('旅途休憩') // Staycation
  }

  if (l1Main === 'transport') {
    personas.push('交通樞紐') // Transit Hub
  }

  if (l1Main === 'residential') {
    personas.push('在地生活') // Local Vibe
  }

  // Facility-based Logic
  if (hasWifi && hasCharging && l1Main !== 'business') personas.push('數位遊牧友好')
  if (hasToilet && hasAccessibility) personas.push('無障礙友善')
  if (hasBaby) personas.push('親子友善')
  
  // Live Status Logic
  if (transit === 'delayed' || transit === 'suspended') personas.push('轉乘壓力高')
  
  // Fallback
  if (!personas.length && (hasWifi || hasCharging)) personas.push('工作休憩點')
  
  return Array.from(new Set(personas)).slice(0, 3)
}
