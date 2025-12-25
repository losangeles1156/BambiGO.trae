import { describe, it, expect } from 'vitest'
import {
  answerTimeQueryJst,
  daysUntilNewYearJst,
  formatFullJst,
  formatRelativeJst,
  formatShortJst,
  parseIsoAllowLeapSecond,
} from '../src/lib/time'

describe('Time system (JST)', () => {
  it('formats full and short JST correctly from UTC date', () => {
    const d = new Date('2024-02-29T12:34:56Z')
    expect(formatFullJst(d)).toBe('2024年02月29日 21時34分56秒 JST')
    expect(formatShortJst(d)).toBe('2024/02/29 21:34 JST')
  })

  it('formats relative time within the same JST day', () => {
    const base = new Date('2025-01-02T12:00:00+09:00')
    const target = new Date(base.getTime() - 3 * 60 * 60 * 1000)
    expect(formatRelativeJst(target, base)).toBe('3 小時前')
  })

  it('formats relative day labels in JST', () => {
    const base = new Date('2025-01-02T12:00:00+09:00')
    const yesterday = new Date('2025-01-01T12:00:00+09:00')
    const tomorrow = new Date('2025-01-03T12:00:00+09:00')
    expect(formatRelativeJst(yesterday, base)).toBe('昨天')
    expect(formatRelativeJst(tomorrow, base)).toBe('明天')
  })

  it('computes days until new year in JST', () => {
    const base = new Date('2024-12-31T10:00:00+09:00')
    expect(daysUntilNewYearJst(base)).toBe(1)
  })

  it('parses leap-second ISO by normalizing and advancing 1 second', () => {
    const d = parseIsoAllowLeapSecond('2016-12-31T23:59:60Z')
    expect(d?.toISOString()).toBe('2017-01-01T00:00:00.000Z')
  })

  it('answers time queries in JST', () => {
    const base = new Date('2025-01-02T12:00:00+09:00')
    const now = answerTimeQueryJst('現在日本幾點？', base)
    expect(now.ok).toBe(true)
    expect(now.answer.includes('JST')).toBe(true)

    const after3 = answerTimeQueryJst('三天後是幾月幾號？', base)
    expect(after3.ok).toBe(true)
    expect(after3.answer.includes('3 天後')).toBe(true)
  })
})

