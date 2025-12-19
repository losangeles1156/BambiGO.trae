import { describe, it, expect } from 'vitest'
import { dictionary } from '../src/i18n/dictionary'
import { zhTW } from '../src/i18n/locales/zh-TW'
import { en } from '../src/i18n/locales/en'
import { ja } from '../src/i18n/locales/ja'

describe('i18n Dictionary', () => {
  it('should have all required languages', () => {
    expect(dictionary['zh-TW']).toBeDefined()
    expect(dictionary['en']).toBeDefined()
    expect(dictionary['ja']).toBeDefined()
  })

  it('should have matching keys across all locales', () => {
    // Helper to flatten object keys
    const getKeys = (obj: any, prefix = ''): string[] => {
      return Object.keys(obj).reduce((res: string[], el) => {
        if(Array.isArray(obj[el])) return res;
        if( typeof obj[el] === 'object' && obj[el] !== null ) {
          return [...res, ...getKeys(obj[el], prefix + el + '.')]
        }
        return [...res, prefix + el]
      }, [])
    }

    const zhKeys = getKeys(zhTW).sort()
    const enKeys = getKeys(en).sort()
    const jaKeys = getKeys(ja).sort()

    expect(enKeys).toEqual(zhKeys)
    expect(jaKeys).toEqual(zhKeys)
  })

  it('should not have empty values', () => {
    const checkValues = (obj: any, path = '') => {
      for (const key in obj) {
        const val = obj[key]
        const currentPath = path ? `${path}.${key}` : key
        
        if (typeof val === 'object' && val !== null) {
          checkValues(val, currentPath)
        } else if (typeof val === 'string') {
          expect(val.trim().length).toBeGreaterThan(0)
        }
      }
    }

    checkValues(zhTW)
    checkValues(en)
    checkValues(ja)
  })
})
