import { describe, it, expect } from 'vitest'
import { dictionary } from '../src/i18n/dictionary'

describe('Multilingual Support: Consistency & Coverage', () => {
  const locales = ['zh-TW', 'en', 'ja'] as const

  it('should have consistent keys across all locales', () => {
    const zhKeys = Object.keys(dictionary['zh-TW'])
    
    locales.forEach(locale => {
      const currentKeys = Object.keys(dictionary[locale])
      expect(currentKeys).toEqual(zhKeys)
      
      // Deep check for common, header, dashboard, navigation
      const subKeys = ['common', 'header', 'dashboard', 'navigation', 'alert']
      subKeys.forEach(key => {
        const zhSub = Object.keys((dictionary['zh-TW'] as any)[key])
        const curSub = Object.keys((dictionary[locale] as any)[key])
        expect(curSub).toEqual(zhSub)
      })
    })
  })

  it('should have all navigation terms translated', () => {
    locales.forEach(locale => {
      const nav = dictionary[locale].navigation
      expect(nav.turnLeft).toBeDefined()
      expect(nav.turnRight).toBeDefined()
      expect(nav.arrive).toBeDefined()
      expect(nav.fastest).toBeDefined()
      expect(nav.safest).toBeDefined()
    })
  })
})
