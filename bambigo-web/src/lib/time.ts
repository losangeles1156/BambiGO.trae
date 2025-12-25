export const JST_TIMEZONE = 'Asia/Tokyo'
export const JST_TZ_LABEL = 'JST'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function getTimeZoneAbbr(timeZone: string): string {
  if (timeZone === JST_TIMEZONE) return JST_TZ_LABEL
  return timeZone
}

export function getUserTimeZone(): string | null {
  if (typeof Intl === 'undefined') return null
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || null
  } catch {
    return null
  }
}

export function getZonedParts(date: Date, timeZone: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '0'
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
    second: Number(pick('second')),
  }
}

export function formatFullJst(date: Date): string {
  const p = getZonedParts(date, JST_TIMEZONE)
  return `${p.year}年${pad2(p.month)}月${pad2(p.day)}日 ${pad2(p.hour)}時${pad2(p.minute)}分${pad2(p.second)}秒 ${JST_TZ_LABEL}`
}

export function formatShortJst(date: Date): string {
  const p = getZonedParts(date, JST_TIMEZONE)
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)} ${JST_TZ_LABEL}`
}

export function formatShortInTimeZone(date: Date, timeZone: string, label?: string): string {
  const p = getZonedParts(date, timeZone)
  const tzLabel = label || getTimeZoneAbbr(timeZone)
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)} ${tzLabel}`
}

function startOfDayKeyUtcMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day)
}

export function diffDaysInTimeZone(target: Date, base: Date, timeZone: string): number {
  const a = startOfDayKeyUtcMs(target, timeZone)
  const b = startOfDayKeyUtcMs(base, timeZone)
  return Math.round((a - b) / 86_400_000)
}

export function formatRelativeJst(target: Date, base: Date = new Date()): string {
  const dayDiff = diffDaysInTimeZone(target, base, JST_TIMEZONE)
  if (dayDiff === 0) {
    const diffMs = target.getTime() - base.getTime()
    const abs = Math.abs(diffMs)
    if (abs < 10_000) return '剛剛'
    const minutes = Math.round(abs / 60_000)
    if (minutes < 1) {
      const seconds = Math.round(abs / 1000)
      return diffMs < 0 ? `${seconds} 秒前` : `${seconds} 秒後`
    }
    if (minutes < 60) return diffMs < 0 ? `${minutes} 分鐘前` : `${minutes} 分鐘後`
    const hours = Math.round(abs / 3_600_000)
    return diffMs < 0 ? `${hours} 小時前` : `${hours} 小時後`
  }

  if (dayDiff === -1) return '昨天'
  if (dayDiff === 1) return '明天'
  if (dayDiff === -2) return '前天'
  if (dayDiff === 2) return '後天'

  if (dayDiff <= -7 && dayDiff >= -13) return '上週'
  if (dayDiff >= 7 && dayDiff <= 13) return '下週'

  const absDays = Math.abs(dayDiff)
  if (absDays < 7) return dayDiff < 0 ? `${absDays} 天前` : `${absDays} 天後`
  const weeks = Math.round(absDays / 7)
  return dayDiff < 0 ? `${weeks} 週前` : `${weeks} 週後`
}

export function addDaysInJst(base: Date, days: number): Date {
  const p = getZonedParts(base, JST_TIMEZONE)
  const utcMidnight = Date.UTC(p.year, p.month - 1, p.day)
  const nextUtcMidnight = utcMidnight + days * 86_400_000
  const next = new Date(nextUtcMidnight)
  const keep = getZonedParts(base, JST_TIMEZONE)
  const nextParts = getZonedParts(next, JST_TIMEZONE)
  const desired = `${nextParts.year}-${pad2(nextParts.month)}-${pad2(nextParts.day)}T${pad2(keep.hour)}:${pad2(keep.minute)}:${pad2(keep.second)}+09:00`
  const parsed = new Date(desired)
  return Number.isFinite(parsed.getTime()) ? parsed : next
}

export function daysUntilNewYearJst(base: Date = new Date()): number {
  const p = getZonedParts(base, JST_TIMEZONE)
  const nextYear = p.year + 1
  const newYear = new Date(`${nextYear}-01-01T00:00:00+09:00`)
  const diff = startOfDayKeyUtcMs(newYear, JST_TIMEZONE) - startOfDayKeyUtcMs(base, JST_TIMEZONE)
  return Math.max(0, Math.round(diff / 86_400_000))
}

export function normalizeLeapSecondIso(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):60(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/)
  if (!m) return iso
  return `${m[1]}:59${m[2] || ''}${m[3]}`
}

export function parseIsoAllowLeapSecond(iso: string): Date | null {
  const normalized = normalizeLeapSecondIso(iso)
  const d = new Date(normalized)
  if (!Number.isFinite(d.getTime())) return null
  if (normalized !== iso) return new Date(d.getTime() + 1000)
  return d
}

export type TimeQueryResult =
  | { ok: true; answer: string; kind: 'now'; now_ms: number }
  | { ok: true; answer: string; kind: 'add_days'; now_ms: number; days: number; date: string }
  | { ok: true; answer: string; kind: 'until_new_year'; now_ms: number; days: number }
  | { ok: false; answer: string; kind: 'unknown'; now_ms: number }

export function answerTimeQueryJst(q: string, base: Date = new Date()): TimeQueryResult {
  const query = (q || '').trim()
  const now = base
  const nowMs = now.getTime()
  const lower = query.toLowerCase()

  const parseChineseNumber = (input: string): number | null => {
    const s = input.trim()
    if (!s) return null
    const map: Record<string, number> = { '零': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 }
    if (s === '十') return 10
    if (s.length === 2 && s[0] === '十' && map[s[1]] != null) return 10 + map[s[1]]
    if (s.length === 2 && map[s[0]] != null && s[1] === '十') return map[s[0]] * 10
    if (s.length === 3 && map[s[0]] != null && s[1] === '十' && map[s[2]] != null) return map[s[0]] * 10 + map[s[2]]
    if (s.length === 1 && map[s] != null) return map[s]
    return null
  }

  if (/日本.*(幾點|時間)|jst|tokyo.*time|現在.*(幾點|時間)/i.test(query) || lower.includes('what time') && lower.includes('japan')) {
    const full = formatFullJst(now)
    return { ok: true, kind: 'now', now_ms: nowMs, answer: `日本時間：${full}` }
  }

  const mDays = query.match(/(\d+)\s*天後/) || query.match(/(\d+)\s*days?\s*later/i)
  const mDaysZh = query.match(/([零一二兩三四五六七八九十]+)\s*天後/)
  const parsedDays = mDays ? parseInt(mDays[1], 10) : (mDaysZh ? parseChineseNumber(mDaysZh[1]) : null)
  if (parsedDays != null && Number.isFinite(parsedDays)) {
    const days = Math.max(0, parsedDays)
    const d = addDaysInJst(now, days)
    const p = getZonedParts(d, JST_TIMEZONE)
    const date = `${pad2(p.month)}月${pad2(p.day)}日`
    return {
      ok: true,
      kind: 'add_days',
      now_ms: nowMs,
      days,
      date,
      answer: `日本時間（${JST_TZ_LABEL}）${days} 天後是 ${p.year}年${pad2(p.month)}月${pad2(p.day)}日 ${JST_TZ_LABEL}`,
    }
  }

  if (/距離.*(新年|元旦)|new\s*year/i.test(query)) {
    const days = daysUntilNewYearJst(now)
    return { ok: true, kind: 'until_new_year', now_ms: nowMs, days, answer: `距離新年還有 ${days} 天（日本時間 ${JST_TZ_LABEL}）` }
  }

  return { ok: false, kind: 'unknown', now_ms: nowMs, answer: `我可以回答日本時間（${JST_TZ_LABEL}）相關問題，例如「現在日本幾點？」、「三天後是幾月幾號？」、「距離新年還有幾天？」。` }
}
