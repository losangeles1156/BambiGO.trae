import { describe, it, expect } from 'vitest'
import {
  createTag,
  updateTag,
  deleteTag,
  filterFacilitiesByTags,
  buildSuitabilityQuery,
  mapSuitabilityToCategory,
  makeLabel,
  derivePersonaFromFacilities,
  TagState,
  AppTag,
  FacilityItem,
} from '../src/lib/tagging'

describe('Tagging Logic', () => {
  const mockTag: AppTag = {
    id: 't1',
    layer: 'L3',
    label: 'Wifi',
    l3: { category: 'wifi', subCategory: 'wifi' },
  }

  describe('CRUD Operations', () => {
    it('should create a new tag', () => {
      const state: TagState = { tags: [] }
      const newState = createTag(state, mockTag)
      expect(newState.tags).toHaveLength(1)
      expect(newState.tags[0]).toEqual(mockTag)
    })

    it('should not duplicate tag with same id', () => {
      const state: TagState = { tags: [mockTag] }
      const newState = createTag(state, { ...mockTag, label: 'New Label' })
      expect(newState.tags).toHaveLength(1)
      expect(newState.tags[0].label).toBe('New Label')
    })

    it('should update an existing tag', () => {
      const state: TagState = { tags: [mockTag] }
      const newState = updateTag(state, 't1', { label: 'Updated Wifi' })
      expect(newState.tags[0].label).toBe('Updated Wifi')
    })

    it('should delete a tag', () => {
      const state: TagState = { tags: [mockTag] }
      const newState = deleteTag(state, 't1')
      expect(newState.tags).toHaveLength(0)
    })
  })

  describe('Filtering Facilities', () => {
    const facilities: FacilityItem[] = [
      { id: 'f1', type: 'cafe', suitability_tags: [{ tag: 'wifi', confidence: 0.9 }] },
      { id: 'f2', type: 'park', suitability_tags: [{ tag: 'toilet', confidence: 0.8 }] },
      { id: 'f3', type: 'shop', suitability_tags: [] },
    ]

    it('should return all items if no L3 tags', () => {
      const filtered = filterFacilitiesByTags(facilities, [])
      expect(filtered).toHaveLength(3)
    })

    it('should filter by specific L3 tag', () => {
      const tags: AppTag[] = [mockTag] // wifi
      const filtered = filterFacilitiesByTags(facilities, tags)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('f1')
    })
  })

  describe('Suitability Query Builder', () => {
    it('should build query from L3 tag', () => {
      const tags: AppTag[] = [mockTag]
      const query = buildSuitabilityQuery(tags, 0.5)
      expect(query).toEqual({ tag: 'wifi', minConfidence: 0.5 })
    })

    it('should return empty object if no L3 tag', () => {
      const query = buildSuitabilityQuery([], 0.5)
      expect(query).toEqual({})
    })
  })

  describe('Helpers', () => {
    it('should map suitability to category correctly', () => {
      expect(mapSuitabilityToCategory('accessible_toilet')).toBe('toilet')
      expect(mapSuitabilityToCategory('wifi')).toBe('wifi')
      expect(mapSuitabilityToCategory('power_outlet')).toBe('charging')
      expect(mapSuitabilityToCategory('unknown')).toBe('other')
    })

    it('should make correct label for L1', () => {
      const t: AppTag = {
        id: 'l1',
        layer: 'L1',
        label: 'L1',
        l1: { mainCategory: 'A', subCategory: 'B', detailCategory: 'C' },
      }
      expect(makeLabel(t)).toBe('A > B > C')
    })

    it('should make correct label for L3', () => {
      const t: AppTag = {
        id: 'l3',
        layer: 'L3',
        label: 'L3',
        l3: { category: 'Infra', subCategory: 'Wifi' },
      }
      expect(makeLabel(t)).toBe('Infra > Wifi')
    })
  })

  describe('Persona Derivation', () => {
    it('should derive digital nomad persona', () => {
      const _items = [{ type: 'cafe', suitability_tags: [{ tag: 'wifi', confidence: 1 }] }]
      // Mocking type check inside derivePersonaFromFacilities which uses type string
      const p = derivePersonaFromFacilities([{ type: 'wifi_spot' }, { type: 'charging_station' }])
      expect(p).toContain('數位遊牧友好')
    })

    it('should derive accessibility persona', () => {
      const p = derivePersonaFromFacilities([{ type: 'toilet', has_wheelchair_access: true }])
      expect(p).toContain('無障礙友善')
    })
  })
})
