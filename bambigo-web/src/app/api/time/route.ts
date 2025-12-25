import { NextResponse } from 'next/server'
import { withMonitor } from '@/lib/monitor'
import { answerTimeQueryJst, formatFullJst, formatShortJst, JST_TIMEZONE, JST_TZ_LABEL, parseIsoAllowLeapSecond } from '@/lib/time'

export const dynamic = 'force-dynamic'

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function getNetworkNowJstMs(): Promise<{ ok: true; nowMs: number; provider: string } | { ok: false; error: string }> {
  try {
    const j1 = await fetchJsonWithTimeout('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Tokyo', 2500)
    const dt = typeof j1?.dateTime === 'string' ? j1.dateTime : ''
    const parsed = parseIsoAllowLeapSecond(dt)
    if (parsed) return { ok: true, nowMs: parsed.getTime(), provider: 'timeapi.io' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  try {
    const j2 = await fetchJsonWithTimeout('https://worldtimeapi.org/api/timezone/Asia/Tokyo', 2500)
    const dt = typeof j2?.datetime === 'string' ? j2.datetime : ''
    const parsed = parseIsoAllowLeapSecond(dt)
    if (parsed) return { ok: true, nowMs: parsed.getTime(), provider: 'worldtimeapi.org' }
    return { ok: false, error: 'INVALID_UPSTREAM_DATETIME' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export const GET = withMonitor(async () => {
  const sysNowMs = Date.now()
  const net = await getNetworkNowJstMs()
  const nowMs = net.ok ? net.nowMs : sysNowMs
  const now = new Date(nowMs)
  const payload = {
    now_ms: nowMs,
    now_iso: now.toISOString(),
    jst: {
      timezone: JST_TIMEZONE,
      tz_label: JST_TZ_LABEL,
      full: formatFullJst(now),
      short: formatShortJst(now),
    },
    calibration: {
      synced: net.ok,
      source: net.ok ? 'network' : 'system',
      provider: net.ok ? net.provider : null,
      fallback_reason: net.ok ? null : net.error,
      offset_ms: net.ok ? nowMs - sysNowMs : 0,
    },
  }

  return new NextResponse(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-API-Version': 'v1',
    },
  })
})

export const POST = withMonitor(async (req: Request) => {
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>
  } catch {
    return new NextResponse(JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v1' },
    })
  }

  const q = typeof body.q === 'string' ? body.q.trim() : ''
  if (!q) {
    return new NextResponse(JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'q is required' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v1' },
    })
  }

  const result = answerTimeQueryJst(q, new Date())
  return new NextResponse(JSON.stringify({ ...result, timezone: JST_TIMEZONE, tz_label: JST_TZ_LABEL }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-API-Version': 'v1' },
  })
})

