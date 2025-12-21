import React from 'react'
import { AlertTriangle, CloudRain, Train } from 'lucide-react'
import { WeatherAlert } from '../../lib/weather/jma_rss'
import { useLanguage } from '../../contexts/LanguageContext'

type Props = {
  weatherAlerts: WeatherAlert[]
  transitStatus?: string
  transitDelay?: number
}

export default function L2StatusMarquee({ weatherAlerts, transitStatus, transitDelay }: Props) {
  const { t } = useLanguage()

  const hasWeatherAlerts = weatherAlerts.length > 0
  const hasTransitIssues = transitStatus === 'delayed' || transitStatus === 'suspended'

  if (!hasWeatherAlerts && !hasTransitIssues) {
    return (
      <div className="bg-gray-900 text-white py-2 px-4 flex items-center gap-3 overflow-hidden whitespace-nowrap border-b-2 border-green-500 shadow-sm">
         <div className="flex items-center gap-2 text-green-400 font-bold shrink-0">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest">NORMAL OPS</span>
         </div>
         <div className="text-xs opacity-80 animate-marquee">
            {t('common.systemNormal') || 'System operating normally. Have a safe trip.'}
         </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 text-white border-b-4 border-yellow-500 shadow-md">
      {/* Marquee Content */}
      <div className="py-2 px-3 flex items-center gap-4 overflow-hidden">
        {hasTransitIssues && (
           <div className="flex items-center gap-2 text-yellow-400 font-bold shrink-0 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30">
              <Train size={14} className="animate-pulse" />
              <span className="text-xs uppercase tracking-widest">DELAY</span>
           </div>
        )}
        {hasWeatherAlerts && (
           <div className="flex items-center gap-2 text-red-400 font-bold shrink-0 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/30">
              <AlertTriangle size={14} className="animate-pulse" />
              <span className="text-xs uppercase tracking-widest">WARNING</span>
           </div>
        )}
        
        <div className="flex-1 overflow-hidden relative h-5">
            <div className="absolute whitespace-nowrap animate-marquee flex items-center gap-8 text-xs font-medium tracking-wide">
                {hasTransitIssues && (
                    <span>
                        {transitStatus === 'delayed' ? t('dashboard.transitDelayed') : t('dashboard.transitSuspended')}
                        {transitDelay && transitDelay > 0 ? ` (+${transitDelay}min)` : ''}
                    </span>
                )}
                {weatherAlerts.map((alert, i) => (
                    <span key={i} className="flex items-center gap-1">
                        <CloudRain size={12} />
                        {alert.title} ({alert.severity})
                    </span>
                ))}
            </div>
        </div>
      </div>
    </div>
  )
}
