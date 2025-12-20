'use client'
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSOP } from '../../contexts/SOPContext'
import { WeatherAlert } from '../../lib/weather/jma_rss'

export type SystemAlert = {
  id: string
  type: 'system'
  severity: 'high' | 'medium' | 'low'
  title: string
  summary: string
  tags?: { l4?: string; l1?: string[]; l3?: string[] }
  link?: string
}

export type Alert = WeatherAlert | SystemAlert

function isSystemAlert(a: Alert): a is SystemAlert {
  return (a as SystemAlert).type === 'system'
}

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const { t } = useLanguage()
  const { activateSOP } = useSOP()
  const [expanded, setExpanded] = useState(false)
  
  if (!alerts || alerts.length === 0) return null

  const highPriority = alerts.filter(a => a.severity === 'high')
  const others = alerts.filter(a => a.severity !== 'high')
  
  const displayAlert = highPriority.length > 0 ? highPriority[0] : others[0]
  const count = alerts.length

  const bgColor = displayAlert.severity === 'high' ? 'bg-red-600' : displayAlert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-600'
  const textColor = displayAlert.severity === 'high' ? 'text-white' : displayAlert.severity === 'medium' ? 'text-gray-900' : 'text-white'

  const handleTagClick = (alert: Alert, tag: string) => {
    if (isSystemAlert(alert)) return
    activateSOP(alert, tag)
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-[2000] shadow-lg transition-all duration-300 ${expanded ? 'h-auto' : 'h-12'}`}>
      <div 
        className={`${bgColor} ${textColor} px-4 h-12 flex items-center justify-between cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl animate-pulse">
            {displayAlert.type === 'system'
              ? (displayAlert.severity === 'high' ? '⛔' : displayAlert.severity === 'medium' ? '⚠️' : 'ℹ️')
              : displayAlert.type === 'earthquake'
                ? '🌋'
                : displayAlert.severity === 'high'
                  ? '⚠️'
                  : '☂️'}
          </span>
          <div className="flex flex-col justify-center">
            <span className="font-bold truncate text-sm md:text-base">
              {displayAlert.title}
            </span>
            {displayAlert.tags?.l4 && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-1 rounded inline-block w-fit">
                {t(`alert.l4.${displayAlert.tags.l4}`) === `alert.l4.${displayAlert.tags.l4}` ? displayAlert.tags.l4 : t(`alert.l4.${displayAlert.tags.l4}`)}
              </span>
            )}
          </div>
          {count > 1 && (
            <span className="text-xs opacity-80 whitespace-nowrap bg-black/20 px-2 py-0.5 rounded-full">
              +{count - 1} {t('alert.moreSuffix')}
            </span>
          )}
        </div>
        <div className="text-xs opacity-80">
          {expanded ? t('alert.collapse') : t('alert.expand')}
        </div>
      </div>

      {expanded && (
        <div className="bg-white text-gray-900 max-h-[60vh] overflow-y-auto border-b border-gray-200">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className={`mt-1 min-w-[4px] h-10 rounded-full ${alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-yellow-400' : 'bg-blue-500'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm mb-1">{alert.title}</h4>
                    {alert.tags?.l4 && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        {t(`alert.l4.${alert.tags.l4}`) === `alert.l4.${alert.tags.l4}` ? alert.tags.l4 : t(`alert.l4.${alert.tags.l4}`)}
                      </span>
                    )}
                  </div>
                  
                  {(alert.tags?.l1?.length || alert.tags?.l3?.length) ? (
                    <div className="flex flex-wrap gap-1 my-2">
                      {alert.tags.l1?.map(t => (
                        <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">📍 {t}</span>
                      ))}
                      {alert.tags.l3?.map(t => (
                        <button 
                          key={t} 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTagClick(alert, t)
                          }}
                          className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 cursor-pointer transition-colors flex items-center gap-1"
                        >
                          🏠 {t}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                    {alert.summary}
                  </p>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                      {alert.type === 'system' ? 'SYSTEM' : t(`alert.type.${alert.type}`)}
                    </span>

                    {alert.link && (
                      <a 
                        href={alert.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {alert.type === 'system' ? t('dashboard.view') : '來源 JMA →'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
