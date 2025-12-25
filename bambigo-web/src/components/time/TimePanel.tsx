'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Globe, RefreshCw, MessageCircle } from 'lucide-react'
import { formatFullJst, formatRelativeJst, formatShortInTimeZone, formatShortJst, getUserTimeZone, getZonedParts, JST_TIMEZONE, JST_TZ_LABEL } from '@/lib/time'

type TimeNowResponse = {
  now_ms: number
  now_iso: string
  jst: {
    timezone: string
    tz_label: string
    full: string
    short: string
  }
  calibration: {
    synced: boolean
    source: 'network' | 'system'
    provider: string | null
    fallback_reason: string | null
    offset_ms: number
  }
}

type TimeQueryResponse = {
  ok: boolean
  kind: string
  answer: string
  now_ms: number
  timezone: string
  tz_label: string
}

const SETTINGS_KEY = 'bambigo_time_settings'
const LOG_KEY = 'bambigo_time_logs'

function readSettings(): { showLocal: boolean } {
  if (typeof window === 'undefined') return { showLocal: false }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { showLocal?: unknown }
      return { showLocal: !!p.showLocal }
    }
  } catch {}
  return { showLocal: false }
}

function writeSettings(next: { showLocal: boolean }) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {}
}

function appendTimeLog(entry: { type: 'sync' | 'query'; ok: boolean; data?: Record<string, unknown> }) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LOG_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown[]) : []
    const next = Array.isArray(arr) ? arr.slice(-199) : []
    next.push({ ts: new Date().toISOString(), ...entry })
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {}
}

export default function TimePanel() {
  const [showLocal, setShowLocal] = useState(false)
  const [userTz, setUserTz] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [calibration, setCalibration] = useState<TimeNowResponse['calibration'] | null>(null)
  const [query, setQuery] = useState('')
  const [queryAnswer, setQueryAnswer] = useState<string>('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)

  const baseRef = useRef<{ serverMs: number; clientMs: number } | null>(null)

  useEffect(() => {
    const s = readSettings()
    setShowLocal(s.showLocal)
    setUserTz(getUserTimeZone())
  }, [])

  const syncNow = useCallback(async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/time', { cache: 'no-store' })
      const j = (await res.json()) as TimeNowResponse
      baseRef.current = { serverMs: j.now_ms, clientMs: Date.now() }
      setNow(new Date(j.now_ms))
      setCalibration(j.calibration)
      appendTimeLog({ type: 'sync', ok: true, data: { source: j.calibration.source, provider: j.calibration.provider || undefined } })
    } catch (e) {
      appendTimeLog({ type: 'sync', ok: false, data: { error: e instanceof Error ? e.message : String(e) } })
      baseRef.current = { serverMs: Date.now(), clientMs: Date.now() }
      setNow(new Date())
      setCalibration({ synced: false, source: 'system', provider: null, fallback_reason: 'SYNC_FAILED', offset_ms: 0 })
    } finally {
      setSyncLoading(false)
    }
  }, [])

  useEffect(() => {
    syncNow()
  }, [syncNow])

  useEffect(() => {
    const t = window.setInterval(() => {
      const base = baseRef.current
      if (!base) {
        setNow(new Date())
        return
      }
      const ms = base.serverMs + (Date.now() - base.clientMs)
      setNow(new Date(ms))
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => {
      syncNow()
    }, 5 * 60 * 1000)
    return () => window.clearInterval(t)
  }, [syncNow])

  const localLabel = useMemo(() => {
    if (!userTz) return null
    if (userTz === JST_TIMEZONE) return JST_TZ_LABEL
    const short = userTz.split('/').pop() || userTz
    return short
  }, [userTz])

  const startOfTodayJst = useMemo(() => {
    const p = getZonedParts(now, JST_TIMEZONE)
    return new Date(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T00:00:00+09:00`)
  }, [now])

  const handleToggleLocal = useCallback(() => {
    const next = !showLocal
    setShowLocal(next)
    writeSettings({ showLocal: next })
  }, [showLocal])

  const handleAsk = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setQueryLoading(true)
    setQueryAnswer('')
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      })
      const j = (await res.json()) as TimeQueryResponse
      const answer = typeof j.answer === 'string' ? j.answer : '查詢失敗'
      setQueryAnswer(answer)
      appendTimeLog({ type: 'query', ok: true, data: { q, kind: j.kind } })
    } catch (e) {
      setQueryAnswer('查詢失敗，請稍後重試。')
      appendTimeLog({ type: 'query', ok: false, data: { q, error: e instanceof Error ? e.message : String(e) } })
    } finally {
      setQueryLoading(false)
    }
  }, [query])

  const statusText = useMemo(() => {
    if (!calibration) return `校準：${JST_TZ_LABEL}`
    if (calibration.synced) {
      const src = calibration.provider ? `網路（${calibration.provider}）` : '網路'
      return `校準：${src}`
    }
    return '校準：系統時間（降級）'
  }, [calibration])

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-blue-50 p-2 text-blue-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-gray-900">時間與時區</div>
            <div className="text-xs text-gray-500">{statusText}</div>
          </div>
        </div>

        <button
          onClick={syncNow}
          disabled={syncLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={syncLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          重新校準
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs text-gray-500">完整格式（{JST_TZ_LABEL}）</div>
          <div className="font-mono text-sm text-gray-900">{formatFullJst(now)}</div>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs text-gray-500">簡短格式（{JST_TZ_LABEL}）</div>
          <div className="font-mono text-sm text-gray-900">{formatShortJst(now)}</div>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs text-gray-500">相對時間（以今日 00:00 {JST_TZ_LABEL} 為基準）</div>
          <div className="text-sm text-gray-900">{formatRelativeJst(startOfTodayJst, now)}</div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-sm text-gray-900">
            <Globe className="h-4 w-4 text-gray-600" />
            顯示使用者本地時間
          </div>
          <button
            onClick={handleToggleLocal}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showLocal ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition transition-transform ${showLocal ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {showLocal && userTz && (
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">本地時間（{localLabel}）</div>
            <div className="font-mono text-sm text-gray-900">{formatShortInTimeZone(now, userTz, localLabel || undefined)}</div>
            <div className="mt-1 text-xs text-gray-500">偵測到的時區：{userTz}</div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <MessageCircle className="h-4 w-4 text-gray-600" />
            時間查詢（自動以 {JST_TZ_LABEL} 回答）
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：現在日本幾點？距離新年還有幾天？三天後是幾月幾號？"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={handleAsk}
              disabled={queryLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {queryLoading ? '查詢中' : '送出'}
            </button>
          </div>
          {queryAnswer && <div className="mt-2 text-sm text-gray-900">{queryAnswer}</div>}
        </div>
      </div>
    </div>
  )
}

