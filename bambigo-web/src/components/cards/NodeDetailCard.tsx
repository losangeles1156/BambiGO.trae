'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalizedName } from '../../../lib/utils/i18n'
import { Building2, Activity, MapPin, Train, Store, Briefcase, Info, Quote, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import FacilityProfile, { CategoryCounts } from '../node/FacilityProfile'
import StatusPill from '../ui/StatusPill'
import { WeatherAlert } from '../../lib/weather/jma_rss'
import { useLanguage } from '../../contexts/LanguageContext'
import { CloudRain, AlertTriangle, Zap } from 'lucide-react'

const FACILITY_ICON_MAP = {
  shop: Store,
  office: Briefcase,
  service: Activity,
} as const

type Name = { ja?: string; en?: string; zh?: string }

interface Facility {
  id: string
  name: string
  type: 'shop' | 'office' | 'service'
  icon: React.ReactNode
}

interface TrafficStatus {
  line: string
  status: string
  delay?: number
  tone: 'green' | 'yellow' | 'red'
}

import { StationIdentity } from '../../config/station-identity'

type Props = {
  nodeId?: string
  name: Name
  zone?: 'core' | 'buffer' | 'outer'
  l1Summary?: string
  facilities?: Facility[]
  traffic?: TrafficStatus[]
  crowdLevel?: 'low' | 'medium' | 'high'
  crowdTrend?: 'up' | 'down' | 'stable'
  facilityCounts?: CategoryCounts
  vibeTags?: string[]
  persona?: string
  weatherAlerts?: WeatherAlert[]
  identity?: StationIdentity
}

export default function NodeDetailCard({ 
  nodeId,
  name, 
  zone = 'core',
  l1Summary = '', 
  facilities = [],
  traffic = [],
  crowdLevel = 'medium',
  crowdTrend = 'stable',
  facilityCounts,
  vibeTags = [],
  persona = '',
  weatherAlerts = [],
  identity
}: Props) {
  const { t } = useLanguage()
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW'

  const isOuter = zone === 'outer'
  const isBuffer = zone === 'buffer'

  type CrowdChoice = 'very_comfort' | 'comfort' | 'ok' | 'crowded' | 'very_crowded'
  const crowdOptions = useMemo(() => {
    return [
      { id: 'very_comfort' as const, label: t('nodeDetail.crowdVeryComfort'), tone: 'emerald' as const },
      { id: 'comfort' as const, label: t('nodeDetail.crowdComfort'), tone: 'green' as const },
      { id: 'ok' as const, label: t('nodeDetail.crowdOk'), tone: 'slate' as const },
      { id: 'crowded' as const, label: t('nodeDetail.crowdCrowded'), tone: 'amber' as const },
      { id: 'very_crowded' as const, label: t('nodeDetail.crowdVeryCrowded'), tone: 'red' as const },
    ]
  }, [t])

  const emptyCrowdCounts = useMemo(() => {
    const base: Record<CrowdChoice, number> = {
      very_comfort: 0,
      comfort: 0,
      ok: 0,
      crowded: 0,
      very_crowded: 0,
    }
    return base
  }, [])

  const [crowdCounts, setCrowdCounts] = useState<Record<CrowdChoice, number>>(emptyCrowdCounts)
  const [crowdTotal, setCrowdTotal] = useState(0)
  const [crowdLoading, setCrowdLoading] = useState(false)
  const [crowdChoice, setCrowdChoice] = useState<CrowdChoice | null>(null)

  // Default branding if no identity provided (Blue fallback)
  const brandColor = identity?.color || '#1d4ed8' // blue-700

  const refreshCrowd = useCallback(async () => {
    if (!nodeId || isBuffer || isOuter) return
    setCrowdLoading(true)
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/crowd`, { method: 'GET', cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { counts?: Partial<Record<CrowdChoice, number>>; total?: number }
      const next = { ...emptyCrowdCounts }
      for (const k of Object.keys(next) as CrowdChoice[]) {
        const v = Number(data.counts?.[k] ?? 0)
        next[k] = Number.isFinite(v) ? Math.max(0, v) : 0
      }
      setCrowdCounts(next)
      setCrowdTotal(Math.max(0, Number(data.total ?? 0) || 0))
    } catch {
    } finally {
      setCrowdLoading(false)
    }
  }, [emptyCrowdCounts, isBuffer, isOuter, nodeId])

  useEffect(() => {
    refreshCrowd()
  }, [refreshCrowd])

  const submitCrowd = useCallback(async (choice: CrowdChoice) => {
    if (!nodeId || isBuffer || isOuter) return
    setCrowdChoice(choice)
    setCrowdCounts((prev) => ({ ...prev, [choice]: (prev[choice] || 0) + 1 }))
    setCrowdTotal((prev) => prev + 1)
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/crowd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { counts?: Partial<Record<CrowdChoice, number>>; total?: number }
      const next = { ...emptyCrowdCounts }
      for (const k of Object.keys(next) as CrowdChoice[]) {
        const v = Number(data.counts?.[k] ?? 0)
        next[k] = Number.isFinite(v) ? Math.max(0, v) : 0
      }
      setCrowdCounts(next)
      setCrowdTotal(Math.max(0, Number(data.total ?? 0) || 0))
    } catch {
      refreshCrowd()
    }
  }, [emptyCrowdCounts, isBuffer, isOuter, nodeId, refreshCrowd])

  const crowdDominant = useMemo(() => {
    let best: CrowdChoice | null = null
    let bestV = -1
    for (const k of Object.keys(crowdCounts) as CrowdChoice[]) {
      const v = crowdCounts[k] || 0
      if (v > bestV) {
        bestV = v
        best = k
      }
    }
    return best
  }, [crowdCounts])

  return (
    <div 
      data-testid="node-detail-card"
      className={clsx(
        "ui-card bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all",
        isBuffer && "opacity-90 grayscale-[0.3]"
      )}
    >
      {isOuter ? (
        <div className="p-6 bg-white flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl">🦌</div>
          <h2 className="text-xl font-bold text-gray-900">超出服務範圍</h2>
          <p className="text-gray-500 text-sm">BambiGO 目前專注於東京都心，這裡我還不太熟悉。</p>
          <div className="w-full space-y-2 pt-2">
            <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
              <MapPin size={18} />
              規劃回都心路線
            </button>
            <button className="w-full py-3 bg-gray-50 text-gray-700 rounded-xl font-bold">
              稍後再說
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* L1: Identity & Function Header (Japanese Station Style) */}
          <div className="relative bg-blue-700 text-white overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Train size={120} />
            </div>
            <div className="p-5 relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-3xl font-black tracking-tight leading-none">
                      {getLocalizedName(name as Record<string, string>, locale)}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-blue-200 text-xs font-bold uppercase tracking-widest font-mono">
                    <span className="bg-blue-800 px-1.5 py-0.5 rounded">{name.en || name.ja}</span>
                    {l1Summary && (
                      <span className="flex items-center gap-1 text-white">
                        <Building2 size={12} />
                        {l1Summary}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* L2: Live Status Dashboard (Compact & High Contrast) */}
          {!isBuffer && (
            <div 
              className="bg-gray-900 text-white text-[10px] font-mono py-1.5 px-5 flex items-center justify-between tracking-wider border-b-4"
              style={{ borderColor: traffic.some(t => t.tone === 'yellow' || t.tone === 'red') ? '#eab308' : brandColor }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">STATUS:</span>
                  <span className={clsx(
                    "font-bold",
                    weatherAlerts.length > 0 ? "text-red-400 animate-pulse" : "text-green-400"
                  )}>
                    {weatherAlerts.length > 0 ? "WARNING" : "NORMAL"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">CROWD:</span>
                  <span className={clsx(
                    "font-bold",
                    crowdLevel === 'high' ? "text-red-400" : "text-blue-400"
                  )}>
                    {crowdLevel.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">TREND:</span>
                  <span className="font-bold text-gray-200">{crowdTrend.toUpperCase()}</span>
                </div>
              </div>
              <div className="opacity-50">LIVE UPDATE</div>
            </div>
          )}

          <div className="p-5 bg-white space-y-6">
        {/* L3: Service Facilities (Grid Layout with Border Labels) */}
        {!isBuffer && facilities.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
               <div className="w-1 h-4" style={{ backgroundColor: brandColor }}></div>
               <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">FACILITIES (L3)</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facilities.map((facility) => {
                const Icon = FACILITY_ICON_MAP[facility.type] || Info
                return (
                  <div 
                    key={facility.id}
                    className="group flex items-center justify-between px-3 py-2.5 bg-white border-l-4 border-gray-200 hover:shadow-sm transition-all duration-200 cursor-default"
                    style={{ borderColor: 'transparent', borderLeftColor: '#e5e7eb' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderLeftColor = brandColor
                      e.currentTarget.style.color = brandColor
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderLeftColor = '#e5e7eb'
                      e.currentTarget.style.color = ''
                    }}
                    title={facility.name}
                  >
                    <span className="text-xs font-bold text-gray-700 truncate mr-2 group-hover:text-current transition-colors">{facility.name}</span>
                    <Icon size={14} className="text-gray-300 group-hover:text-current transition-colors shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* L1 Fingerprint & Vibe Tags (Core only) */}
        {!isBuffer && (facilityCounts || vibeTags.length > 0) && (
          <div>
             <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
               <div className="w-1 h-4 bg-gray-400"></div>
               <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">NODE PROFILE</h3>
            </div>
            <FacilityProfile 
              counts={facilityCounts || { shopping: 0, dining: 0, medical: 0, education: 0, leisure: 0, finance: 0 }} 
              vibeTags={vibeTags} 
            />
          </div>
        )}

        {/* Node Persona (Core only) */}
        {!isBuffer && persona && (
          <section className="relative">
            <Quote size={24} className="absolute -top-1 -left-1 text-blue-50 opacity-20" />
            <div className="relative z-10 pl-2">
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">節點畫像</h3>
              <p className="text-sm text-gray-600 leading-relaxed font-medium">
                {persona}
              </p>
            </div>
          </section>
        )}

        {/* Weather Alerts (L2 - P1) */}
        {weatherAlerts.length > 0 && (
          <section className="animate-in fade-in slide-in-from-top-2 duration-500" data-testid="weather-alerts-section">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-red-500 rounded-full" />
              <h3 className="text-sm font-bold text-gray-800">{t('alert.type.weather')}警報</h3>
            </div>
            <div className="space-y-2">
              {weatherAlerts.slice(0, 1).map((alert) => (
                <div 
                  key={alert.id} 
                  className={clsx(
                    "flex flex-col p-3 rounded-xl border transition-all",
                    alert.severity === 'high' 
                      ? "bg-red-50 border-red-100 text-red-900" 
                      : "bg-yellow-50 border-yellow-100 text-yellow-900"
                  )}
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {alert.type === 'earthquake' ? (
                      <Zap size={16} className="text-red-600 animate-pulse" />
                    ) : alert.severity === 'high' ? (
                      <AlertTriangle size={16} className="text-red-600" />
                    ) : (
                      <CloudRain size={16} className="text-yellow-600" />
                    )}
                    <span className="font-bold text-sm" data-testid="alert-title">{alert.title}</span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed" data-testid="alert-summary">
                    {alert.summary.replace('...', '')}
                  </p>
                  {alert.tags?.l4 && (
                    <div className="mt-2">
                      <span className={clsx(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                        alert.severity === 'high' ? "bg-red-600 text-white" : "bg-yellow-500 text-white"
                      )}>
                        {t(`alert.l4.${alert.tags.l4}`)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Real-time Traffic Status (L2) */}
        {traffic.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <h3 className="text-sm font-bold text-gray-800">即時交通狀態</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {traffic.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100/50" role="status" aria-label={`${t.line}: ${t.status}`}>
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-2 h-2 rounded-full",
                      t.tone === 'green' ? "bg-green-500" : t.tone === 'yellow' ? "bg-yellow-500" : "bg-red-500"
                    )} aria-hidden="true" />
                    <span className="font-bold text-sm text-gray-700">{t.line}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill 
                      text={t.status} 
                      severity={t.tone === 'green' ? 'success' : t.tone === 'yellow' ? 'warning' : 'error'} 
                    />
                    {t.delay && <span className="text-[10px] text-gray-400 font-bold">+{t.delay}m</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Crowd Prediction (Core only) */}
        {!isBuffer && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-orange-500 rounded-full" />
              <h3 className="text-sm font-bold text-gray-800">{t('nodeDetail.crowdTitle')}</h3>
              <div className="text-[10px] text-gray-400">{crowdLoading ? t('common.loading') : ''}</div>
            </div>
            <div className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-gray-700">{t('nodeDetail.crowdPrompt')}</div>
                {crowdTotal > 0 && crowdDominant && (
                  <div className="text-[10px] text-gray-500">
                    {t('nodeDetail.crowdCommunityLabel')}：{crowdOptions.find((x) => x.id === crowdDominant)?.label || ''}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {crowdOptions.map((opt) => {
                  const active = crowdChoice === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => submitCrowd(opt.id)}
                      className={clsx(
                        'px-3 py-2 rounded-xl text-xs font-bold border transition-colors',
                        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-white/70 bg-white/70 text-gray-800 hover:bg-white'
                      )}
                      aria-pressed={active}
                      data-testid={`crowd-choice-${opt.id}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 space-y-2">
                {crowdOptions.map((opt) => {
                  const count = crowdCounts[opt.id] || 0
                  const pct = crowdTotal > 0 ? Math.round((count / crowdTotal) * 100) : 0
                  const barTone =
                    opt.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : opt.tone === 'green'
                        ? 'bg-green-500'
                        : opt.tone === 'amber'
                          ? 'bg-amber-500'
                          : opt.tone === 'red'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className="w-20 text-[11px] font-semibold text-gray-700 truncate">{opt.label}</div>
                      <div className="flex-1 h-2 rounded-full bg-white/70 border border-white">
                        <div className={clsx('h-2 rounded-full', barTone)} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-11 text-right text-[10px] text-gray-500 tabular-nums">{pct}%</div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 text-[10px] text-gray-500">
                {crowdTotal > 0
                  ? `${t('nodeDetail.crowdReportCountPrefix')}${crowdTotal}${t('nodeDetail.crowdReportCountSuffix')}`
                  : t('nodeDetail.crowdEmpty')}
              </div>
            </div>
          </section>
        )}

        {/* Surrounding Facilities (Core only) - Removed to avoid duplication with L3 section above */}

        {/* Simplified Notice for Buffer Zone */}
        {isBuffer && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
            <p className="text-xs text-gray-500 font-medium">此區域僅提供基本導航資訊</p>
            <button className="mt-3 text-xs text-blue-600 font-bold flex items-center justify-center gap-1 mx-auto hover:underline">
              了解更多圈層差異 <ChevronRight size={14} />
            </button>
          </div>
        )}
          </div>
        </>
      )}
    </div>
  )
}
