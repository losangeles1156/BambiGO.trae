import { describe, it, expect } from 'vitest'
import { StrategyEngine } from '../src/lib/ai/strategy'

describe('StrategyEngine', () => {
  it('generates Family Easy Access when baby care and accessibility present', () => {
    const facilities = [
      { type: 'toilet', attributes: { has_wheelchair_access: true } },
      { type: 'service', attributes: { subCategory: 'baby_care', has_baby_care: true } }
    ]
    const res = StrategyEngine.generate(facilities as any, {})
    const card = res.find((c) => c.title === 'Family Easy Access')
    expect(card).toBeTruthy()
  })

  it('generates Time to Eat dynamically based on JST lunch window', () => {
    const facilities = [
      { type: 'dining', attributes: { subCategory: 'restaurant' } }
    ]
    const now = new Date(Date.UTC(2025, 0, 1, 3, 0, 0))
    const res = StrategyEngine.generate(facilities as any, { now })
    const card = res.find((c) => c.title === 'Time to Eat')
    expect(card).toBeTruthy()
  })

  it('uses persona labels to influence output', () => {
    const facilities = [
      { type: 'misc' }
    ]
    const res = StrategyEngine.generate(facilities as any, { personaLabels: ['親子友善'] })
    const card = res.find((c) => c.title === 'Family Easy Access')
    expect(card).toBeTruthy()
  })
})
