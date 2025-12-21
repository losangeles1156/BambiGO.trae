'use client'
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

  // Default branding if no identity provided (Blue fallback)
  const brandColor = identity?.color || '#1d4ed8' // blue-700

  if (zone === 'outer') {
    return (
      <div className="ui-card p-6 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-4">
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
    )
  }

  const isBuffer = zone === 'buffer'

  return (
    <div 
      data-testid="node-detail-card"
      className={clsx(
        "ui-card bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all",
        isBuffer && "opacity-90 grayscale-[0.3]"
      )}
    >
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
              {weatherAlerts.map((alert) => (
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
              <h3 className="text-sm font-bold text-gray-800">人潮預測</h3>
            </div>
            <div className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100 flex items-center justify-between relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-4">
                <div className="text-2xl font-black text-orange-600 uppercase tracking-tighter">
                  {crowdLevel === 'low' ? '舒適' : crowdLevel === 'medium' ? '適中' : '擁擠'}
                </div>
                <StatusPill text="歷史數據" severity="info" className="bg-white/50 border-orange-100" />
              </div>
              <div className="relative z-10 flex flex-col items-end">
                <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest mb-0.5">趨勢</span>
                <div className="flex items-center gap-1 text-orange-600 font-black">
                  {crowdTrend === 'up' ? <Activity size={16} className="rotate-[-45deg]" /> : crowdTrend === 'down' ? <Activity size={16} className="rotate-[45deg]" /> : <Activity size={16} />}
                  <span className="text-sm">{crowdTrend === 'up' ? '上升中' : crowdTrend === 'down' ? '緩解中' : '持平'}</span>
                </div>
              </div>
              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-8 bg-orange-500/20 rounded-full" />
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
    </div>
  )
}
