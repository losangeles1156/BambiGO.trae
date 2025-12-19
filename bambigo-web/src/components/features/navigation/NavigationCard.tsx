'use client'

import React from 'react'
import { ArrowUp, ArrowLeft, ArrowRight, MapPin, Navigation, Flag, Repeat } from 'lucide-react'
import { NavigationStep } from '@/types/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

export type { NavigationStep }

type Props = {
  currentStep: NavigationStep
  nextStep?: NavigationStep
  totalDistance?: number
  totalTime?: number
  progress?: number // 0-100
  className?: string
}

const getIcon = (type: NavigationStep['type'], className: string = "w-8 h-8 md:w-10 md:h-10") => {
  switch (type) {
    case 'turn-left': return <ArrowLeft className={className} />
    case 'turn-right': return <ArrowRight className={className} />
    case 'turn-slight-left': return <ArrowLeft className={`${className} -rotate-45`} />
    case 'turn-slight-right': return <ArrowRight className={`${className} rotate-45`} />
    case 'u-turn': return <Repeat className={className} />
    case 'arrive': return <MapPin className={className} />
    case 'start': return <Navigation className={className} />
    default: return <ArrowUp className={className} />
  }
}

const getBgColor = (type: NavigationStep['type']) => {
  if (type === 'arrive') return 'bg-green-500'
  if (type === 'start') return 'bg-blue-500'
  return 'bg-gray-900'
}

const getManeuverLabel = (type: NavigationStep['type'], t: (path: string) => string) => {
  switch (type) {
    case 'turn-left': return t('navigation.turnLeft')
    case 'turn-right': return t('navigation.turnRight')
    case 'turn-slight-left': return t('navigation.turnSlightLeft')
    case 'turn-slight-right': return t('navigation.turnSlightRight')
    case 'u-turn': return t('navigation.uTurn')
    case 'arrive': return t('navigation.arrive')
    case 'start': return t('navigation.start')
    default: return t('navigation.straight')
  }
}

export default function NavigationCard({ currentStep, nextStep, totalDistance, totalTime, progress = 0, className = '' }: Props) {
  const { t } = useLanguage()

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Direction Icon */}
            <div 
              className={`flex-shrink-0 w-16 h-16 ${getBgColor(currentStep.type)} text-white rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 duration-300`}
              role="img"
              aria-label={`Direction: ${currentStep.type.replace('-', ' ')}`}
            >
              {getIcon(currentStep.type)}
            </div>

            {/* Instruction & Distance */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {currentStep.distance < 1000 
                  ? `${currentStep.distance}m` 
                  : `${(currentStep.distance / 1000).toFixed(1)}km`}
              </h2>
              <p className="text-lg font-medium text-gray-800 mt-1 truncate">
                {getManeuverLabel(currentStep.type, t)}
              </p>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {currentStep.instruction}
              </p>
              {currentStep.secondaryText && (
                <p className="text-sm text-gray-500 mt-1">
                  {currentStep.secondaryText}
                </p>
              )}
            </div>
          </div>

          {/* Next Step Preview */}
          {nextStep && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3 text-gray-500 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('navigation.next')}</span>
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                {getIcon(nextStep.type, "w-3 h-3")}
              </div>
              <p className="text-sm truncate flex-1">
                {getManeuverLabel(nextStep.type, t)}: {nextStep.instruction}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Trip Summary (Optional Context) */}
      {(totalDistance !== undefined || totalTime !== undefined) && (
        <div className="mt-3 flex justify-between items-center px-4 py-2 bg-black/5 backdrop-blur-sm rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">{t('navigation.remaining')}</span>
            {totalTime && <span className="text-sm font-bold text-gray-800">{Math.ceil(totalTime)} {t('navigation.minutes')}</span>}
            {totalDistance && (
              <span className="text-xs text-gray-500">
                ({totalDistance < 1000 ? `${totalDistance}m` : `${(totalDistance/1000).toFixed(1)}km`})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Flag className="w-3 h-3" />
            <span>{t('navigation.destination')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
