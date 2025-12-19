import { describe, it, expect } from 'vitest'
import { StrategyEngine } from '../src/lib/ai/strategy'

describe('StrategyEngine', () => {
  it('generates Family Easy Access when baby care and accessibility present', () => {
    const facilities = [
      { type: 'toilet', attributes: { has_wheelchair_access: true } },
      { type: 'service', attributes: { subCategory: 'baby_care', has_baby_care: true } }
    ]
    const res = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, {})
    const card = res.find((c) => c.title === 'Family Easy Access')
    expect(card).toBeTruthy()
  })

  it('generates Time to Eat dynamically based on JST lunch window', () => {
    const facilities = [
      { type: 'dining', attributes: { subCategory: 'restaurant' } }
    ]
    const now = new Date(Date.UTC(2025, 0, 1, 3, 0, 0))
    const res = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { now })
    const card = res.find((c) => c.title === 'Time to Eat')
    expect(card).toBeTruthy()
  })

  it('uses persona labels to influence output', () => {
    const facilities = [
      { type: 'misc' }
    ]
    const res = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { personaLabels: ['親子友善'] })
    const card = res.find((c) => c.title === 'Family Easy Access')
    expect(card).toBeTruthy()
  })

  it('shows Night Safety Tips when night and no accessibility', () => {
    const facilities = [ { type: 'misc' } ]
    const now = new Date(Date.UTC(2025, 0, 1, 15, 0, 0)) // 00:00 JST
    const res = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { now })
    const card = res.find((c) => c.title === 'Night Safety Tips')
    expect(card).toBeTruthy()
  })

  it('shows Beat the Heat when temperature high and water available', () => {
    const facilities = [ { type: 'service', attributes: { subCategory: 'drinking_fountain' } } ]
    const res = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { temperatureC: 32 })
    const card = res.find((c) => c.title === 'Beat the Heat')
    expect(card).toBeTruthy()
  })

  it('gates Time to Eat by opening hours if provided', () => {
    const facilities = [ { type: 'dining', attributes: { subCategory: 'restaurant', openingHours: '11:00-14:00' } } ]
    const nowLunch = new Date(Date.UTC(2025, 0, 1, 3, 30, 0)) // 12:30 JST
    const resLunch = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { now: nowLunch })
    expect(resLunch.find((c) => c.title === 'Time to Eat')).toBeTruthy()

    const nowLate = new Date(Date.UTC(2025, 0, 1, 6, 0, 0)) // 15:00 JST
    const resLate = StrategyEngine.generate(facilities as Array<{ type: string; attributes?: Record<string, unknown> }>, { now: nowLate })
    expect(resLate.find((c) => c.title === 'Time to Eat')).toBeFalsy()
  })
})
