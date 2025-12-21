"use client"
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bike,
  Briefcase,
  Info,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Timer,
  TrainFront,
  Accessibility as AccessibilityIcon,
  Baby,
  Bath,
  Box,
  Zap,
} from 'lucide-react'
import type { TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'
import { useLanguage } from '@/contexts/LanguageContext'
import { L4StrategyCard } from './L4StrategyCard'
import type { L4ActionCard } from '@/types/tagging'
import { clsx } from 'clsx'

import L1ServiceLocator from './L1ServiceLocator'

type Props = {
  value?: TagState
  onChange?: (next: TagState) => void
  nodeId?: string
}

type OdptStatus = 'normal' | 'delay' | 'suspended'

type LiveTransitStatus = 'normal' | 'delayed' | 'suspended' | 'unknown'
type LiveTransitEvent = { railway?: string; section?: string; status?: string; delay?: number; text?: string }
type LiveResponse = {
  transit: { status: LiveTransitStatus; delay_minutes?: number; events?: LiveTransitEvent[] }
  updated_at: string
}

type WeatherAlert = {
  id: string
  title: string
  updated: string
  link: string
  summary: string
  type: 'weather' | 'earthquake' | 'other'
  severity: 'high' | 'medium' | 'low'
}

export default function TagManager({ value, onChange, nodeId }: Props) {
  const { t } = useLanguage()
  const [state, setState] = useState<TagState>(value || { tags: [] })
  const [strategy, setStrategy] = useState<L4ActionCard | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)

  const [odptStatus, setOdptStatus] = useState<OdptStatus>('normal')
  const [live, setLive] = useState<LiveResponse | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [l3Facilities, setL3Facilities] = useState<Array<{ category: string; subCategory: string; location?: { floor?: string; direction?: string } }>>([])
  const [l3Loading, setL3Loading] = useState(false)

  const [l4Contexts, setL4Contexts] = useState({
    luggage: false,
    stroller: false,
    wheelchair: false,
    rush: false
  })

  useEffect(() => {
    if (value) setState(value)
  }, [value])

  const apply = useCallback((updater: (prev: TagState) => TagState) => {
    setState((prev) => {
      const next = updater(prev)
      onChange?.(next)
      return next
    })
  }, [onChange])

  const refreshLive = useCallback(async () => {
    if (!nodeId) {
      setLive(null)
      return
    }
    setLiveLoading(true)
    try {
      const res = await fetch(`/api/live?node_id=${encodeURIComponent(nodeId)}`, { method: 'GET' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as LiveResponse
      setLive(data)
    } catch {
      setLive({ transit: { status: 'unknown', delay_minutes: 0, events: [] }, updated_at: new Date().toISOString() })
    } finally {
      setLiveLoading(false)
    }
  }, [nodeId])

  const refreshAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await fetch('/api/weather/alerts', { method: 'GET' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { alerts?: WeatherAlert[] }
      setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
    } catch {
      setAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  const refreshL3 = useCallback(async () => {
    if (!nodeId) {
      setL3Facilities([])
      return
    }
    setL3Loading(true)
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/tags`, { method: 'GET' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { l3?: Array<{ category: string; subCategory: string; location?: { floor?: string; direction?: string } }> }
      setL3Facilities(Array.isArray(data.l3) ? data.l3 : [])
    } catch {
      setL3Facilities([])
    } finally {
      setL3Loading(false)
    }
  }, [nodeId])

  useEffect(() => {
    refreshLive()
    refreshL3()
  }, [refreshLive, refreshL3])

  useEffect(() => {
    refreshAlerts()
  }, [refreshAlerts])

  const derivedOdptStatus: OdptStatus = useMemo(() => {
    const s = live?.transit?.status
    if (s === 'suspended') return 'suspended'
    if (s === 'delayed') return 'delay'
    return 'normal'
  }, [live?.transit?.status])

  useEffect(() => {
    setOdptStatus(derivedOdptStatus)
  }, [derivedOdptStatus])

  useEffect(() => {
    apply((prev) => {
      let next = { ...prev, tags: prev.tags.filter((x) => !x.id.startsWith('L2:transit:')) }
      if (derivedOdptStatus !== 'normal') {
        next = tagging.createTag(next, {
          id: `L2:transit:${derivedOdptStatus}`,
          layer: 'L2',
          label: derivedOdptStatus === 'delay' ? t('tagging.l2TransitDelayed') : t('tagging.l2TransitSuspended'),
          context: { odpt: derivedOdptStatus },
        })
      }
      return next
    })
  }, [apply, derivedOdptStatus, t])

  const generateL4 = async () => {
    if (strategyLoading) return
    setStrategyLoading(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // Mock Smart Logic
      let mockStrategy: L4ActionCard;

      if (odptStatus === 'delay' || odptStatus === 'suspended') {
        if (l4Contexts.rush) {
          mockStrategy = {
            id: 'strategy-rush-delay',
            type: 'alert',
            title: t('tagging.l4Contexts.rush') + ' + ' + (odptStatus === 'suspended' ? t('tagging.l2TransitSuspended') : t('tagging.l2TransitDelayed')),
            description: odptStatus === 'suspended' 
              ? 'Train suspended. Recommended: Taxi to nearby major hub.' 
              : 'Train delayed. Recommended: Express Bus or Taxi to avoid waiting.',
            rationale: 'Time is critical. Avoid uncertain rail status.',
            knowledge: 'Note: Taxi stand at North Exit is often crowded during delays. Try South Exit app-based pickup.',
            actions: [
              { label: 'Find Taxi Stand', action: 'navigate_taxi' },
              { label: 'Check Bus Route', action: 'navigate_bus' }
            ]
          };
        } else {
          mockStrategy = {
            id: 'strategy-wait-delay',
            type: 'secondary',
            title: t('tagging.l2TransitDelayed') + ' - Relax Mode',
            description: 'Train is delayed. Why not wait at a nearby cafe?',
            rationale: 'Avoid crowd congestion on platform. Utilize L1 Cafe facilities.',
            knowledge: 'Tip: This station has a hidden underground passage to the department store (Exit B2).',
            actions: [
              { label: 'Find Nearby Cafe', action: 'filter_cafe' },
              { label: 'Check Rest Areas', action: 'filter_rest_area' }
            ]
          };
        }
      } else if (l4Contexts.luggage || l4Contexts.stroller || l4Contexts.wheelchair) {
        mockStrategy = {
          id: 'strategy-accessible',
          type: 'primary',
          title: 'Accessible Route Priority',
          description: 'Route optimized for elevators and wide gates.',
          rationale: 'Detected mobility constraints (Luggage/Stroller/Wheelchair).',
          knowledge: 'Warning: The elevator at West Gate is currently under maintenance. Use East Gate.',
          actions: [
            { label: 'Show Elevator Map', action: 'show_elevators' },
            { label: 'Station Accessibility Info', action: 'station_info' }
          ]
        };
      } else {
        mockStrategy = {
          id: 'strategy-normal',
          type: 'primary',
          title: 'Optimal Transit Route',
          description: 'Standard fastest route via subway.',
          rationale: 'Normal operation. No specific constraints.',
          knowledge: 'Did you know? Car 4 is closest to the stairs at the destination.',
          actions: [
            { label: 'Start Navigation', action: 'navigate_start' }
          ]
        };
      }

      setStrategy(mockStrategy);
    } catch (err) {
      console.error(err)
    } finally {
      setStrategyLoading(false)
    }
  }

  const transitTone = useMemo(() => {
    if (live?.transit?.status === 'suspended') return 'red'
    if (live?.transit?.status === 'delayed') return 'amber'
    if (live?.transit?.status === 'unknown') return 'slate'
    return 'emerald'
  }, [live?.transit?.status])

  const isEmergencyAlert = useCallback((a: WeatherAlert) => {
    if (a.severity === 'high') return true
    const title = a.title || ''
    if (a.type === 'earthquake') return true
    if (/(地震|震度|震源|earthquake)/i.test(title)) return true
    if (/(豪雨|大雨|暴風|洪水|土砂|特別警報|emergency)/i.test(title)) return true
    return false
  }, [])

  const facilityLocation = useCallback((items: Array<{ location?: { floor?: string; direction?: string } }>) => {
    const first = items.find((x) => x.location?.direction || x.location?.floor)
    const floor = first?.location?.floor
    const dir = first?.location?.direction
    if (dir && floor) return `${dir} · ${floor}`
    if (dir) return dir
    if (floor) return floor
    return t('tagging.l3LocationUnknown')
  }, [t])

  const l3MvpTiles = useMemo(() => {
    const all = l3Facilities
    const by = (cat: string) => all.filter((x) => x.category === cat || x.subCategory === cat)
    return [
      { key: 'toilet', icon: Bath, items: by('toilet') },
      { key: 'locker', icon: Box, items: by('locker') },
      { key: 'charging', icon: Zap, items: by('charging') },
      { key: 'atm', icon: Landmark, items: all.filter((x) => x.subCategory.includes('atm') || x.subCategory.includes('bank') || x.category === 'finance') },
      { key: 'accessibility', icon: AccessibilityIcon, items: by('accessibility') },
      { key: 'bike', icon: Bike, items: all.filter((x) => x.subCategory.includes('bike') || x.subCategory.includes('cycle') || x.subCategory.includes('share')) },
    ]
  }, [l3Facilities])

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">

      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-xs font-semibold text-gray-700">{t('tagging.activeTagsLabel')}</div>
          <div className="text-xs font-bold text-gray-900">{state.tags.length}</div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-100 rounded text-violet-600">
              <TrainFront size={16} />
            </div>
            <span className="font-bold text-gray-800 text-sm">{t('tagging.l2Title')}</span>
          </div>
          <button
            onClick={() => {
              refreshLive()
              refreshAlerts()
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={12} className={clsx(liveLoading || alertsLoading ? 'animate-spin' : '')} />
            {t('common.refresh')}
          </button>
        </div>

        {!nodeId ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 flex items-start gap-2">
            <Info size={14} className="mt-0.5" />
            <div>{t('common.tapForDetails')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={clsx(
              'rounded-xl border p-3',
              transitTone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
              transitTone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800',
              transitTone === 'red' && 'border-red-200 bg-red-50 text-red-800',
              transitTone === 'slate' && 'border-gray-200 bg-gray-50 text-gray-700'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {transitTone === 'red' || transitTone === 'amber' ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <ShieldAlert size={14} />
                  )}
                  <div className="text-xs font-bold">
                    {live?.transit?.status === 'suspended'
                      ? t('tagging.l2TransitSuspended')
                      : live?.transit?.status === 'delayed'
                        ? t('tagging.l2TransitDelayed')
                        : live?.transit?.status === 'unknown'
                          ? t('tagging.l2TransitUnknown')
                          : t('tagging.l2TransitNormal')}
                  </div>
                </div>
                <div className="text-[10px] opacity-70">
                  {live?.updated_at ? new Date(live.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
              {!!live?.transit?.delay_minutes && live.transit.delay_minutes > 0 && (
                <div className="mt-2 text-[11px] font-semibold">{t('dashboard.transitDelayMinutes')}：{live.transit.delay_minutes}</div>
              )}
              {Array.isArray(live?.transit?.events) && live!.transit.events!.length > 0 && (
                <div className="mt-2 space-y-1">
                  {live!.transit.events!.slice(0, 5).map((e, i) => (
                    <div key={`${e.section || e.railway || 'e'}-${i}`} className="rounded-lg bg-white/70 px-2 py-1 text-[10px] text-gray-700">
                      <div className="font-semibold truncate">{e.section || e.text || e.railway || '-'}</div>
                      <div className="opacity-70 truncate">{e.status || ''}{typeof e.delay === 'number' && e.delay > 0 ? ` · +${e.delay}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-800">{t('tagging.l2AlertsLabel')}</div>
                <div className="text-[10px] text-gray-400">{alertsLoading ? t('common.loading') : ''}</div>
              </div>
              {alerts.length === 0 ? (
                <div className="text-[11px] text-gray-500">{t('tagging.l2NoAlerts')}</div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((a) => {
                    const emergency = isEmergencyAlert(a)
                    return (
                      <a
                        key={a.id}
                        href={a.link}
                        target="_blank"
                        rel="noreferrer"
                        className={clsx(
                          'block rounded-lg border px-3 py-2 transition-colors',
                          emergency ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        )}
                      >
                        <div className={clsx('text-[11px] font-bold', emergency ? 'text-red-800' : 'text-gray-800')}>
                          {a.title}
                        </div>
                        <div className={clsx('mt-0.5 text-[10px] line-clamp-2', emergency ? 'text-red-700/80' : 'text-gray-600')}>
                          {a.summary}
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="font-bold text-gray-800 text-sm">{t('tagging.l1Title')}</span>
          <div className="text-xs text-gray-400">{t('common.places')}</div>
        </div>
        <L1ServiceLocator className="h-[560px]" />
      </section>

      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-800 text-sm">{t('tagging.l3Title')}</span>
          <div className="text-[10px] text-gray-400">{l3Loading ? t('common.loading') : ''}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {l3MvpTiles.map((tile) => {
            const Icon = tile.icon
            const has = tile.items.length > 0
            const loc = has ? facilityLocation(tile.items) : t('tagging.l3LocationUnknown')
            return (
              <div
                key={tile.key}
                className={clsx(
                  'rounded-2xl border p-3',
                  has ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', has ? 'bg-white text-emerald-700' : 'bg-white text-gray-400')}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className={clsx('text-xs font-bold', has ? 'text-emerald-900' : 'text-gray-700')}>
                        {t(`tagging.l3Mvp.${tile.key as 'toilet' | 'locker' | 'charging' | 'atm' | 'accessibility' | 'bike'}`)}
                      </div>
                      <div className={clsx('mt-0.5 text-[10px]', has ? 'text-emerald-800/80' : 'text-gray-500')}>
                        {loc}
                      </div>
                    </div>
                  </div>
                  <div className={clsx('text-[10px] font-semibold', has ? 'text-emerald-700' : 'text-gray-400')}>
                    {has ? t('common.monitoring') : t('common.paused')}
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-white/70 border border-white/60 px-3 py-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="text-gray-500">{t('tagging.l3ValueLabel')}</div>
                    <div className="text-gray-700 font-semibold">{t('tagging.l3ValuePlaceholder')}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* L4: Strategy Contexts & Action */}
      <section className="pt-2">
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-3xl p-5 border border-rose-100 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-rose-100 rounded text-rose-600">
                <Briefcase size={16} />
              </div>
              <span className="font-bold text-gray-900 text-sm">{t('tagging.l4Title')}</span>
           </div>

           {/* Personal Context Toggles */}
           <div className="flex flex-wrap gap-2 mb-6">
             {[
               { key: 'luggage', icon: Briefcase, label: t('tagging.l4Contexts.luggage') },
               { key: 'stroller', icon: Baby, label: t('tagging.l4Contexts.stroller') },
               { key: 'wheelchair', icon: AccessibilityIcon, label: t('tagging.l4Contexts.wheelchair') },
               { key: 'rush', icon: Timer, label: t('tagging.l4Contexts.rush') }
             ].map((ctx) => (
               <button
                 key={ctx.key}
                 onClick={() => setL4Contexts(prev => ({ ...prev, [ctx.key]: !prev[ctx.key as keyof typeof l4Contexts] }))}
                 className={clsx(
                   "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                   l4Contexts[ctx.key as keyof typeof l4Contexts]
                     ? "bg-white text-rose-600 border-rose-200 shadow-sm"
                     : "bg-white/50 text-gray-500 border-transparent hover:bg-white/80"
                 )}
               >
                 <ctx.icon size={14} />
                 {ctx.label}
               </button>
             ))}
           </div>

           {/* Strategy Card */}
           <L4StrategyCard 
             strategy={strategy}
             isLoading={strategyLoading}
             onGenerate={generateL4}
             className="bg-white/80 backdrop-blur-sm"
           />
        </div>
      </section>

    </div>
  )
}
