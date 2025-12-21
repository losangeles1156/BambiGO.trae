'use client'

import React, { useState, useRef } from 'react'
import { LongPressButton } from '../../common/LongPressButton'
import { clsx } from 'clsx'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface FABAction {
  id: string
  icon: React.ReactNode
  label: string
  onClick: () => void
  onLongPress?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

interface FABGroupProps {
  mainActions: FABAction[]
  secondaryActions?: FABAction[]
}

export function FABGroup({ mainActions, secondaryActions = [] }: FABGroupProps) {
  const [showSecondary, setShowSecondary] = useState(false)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartY.current) return
    const diff = touchStartY.current - e.changedTouches[0].clientY
    
    // Swipe Up (> 50px) -> Show Secondary
    if (diff > 50 && !showSecondary && secondaryActions.length > 0) {
      setShowSecondary(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20)
    }
    // Swipe Down (> 50px) -> Hide Secondary
    if (diff < -50 && showSecondary) {
      setShowSecondary(false)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20)
    }
    touchStartY.current = null
  }

  return (
    <div 
      className="absolute bottom-6 right-6 flex flex-col items-end gap-4 z-50 pointer-events-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Secondary Panel (Slide to reveal) */}
      <div className={clsx(
        "flex flex-col gap-3 transition-all duration-300 origin-bottom items-end",
        showSecondary ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-10 pointer-events-none absolute bottom-full mb-4"
      )}>
        {secondaryActions.map((action) => (
          <div key={action.id} className="flex items-center gap-2 justify-end">
             <span className="text-xs bg-black/70 text-white px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                {action.label}
             </span>
             <LongPressButton
               onShortPress={action.onClick}
               onLongPress={action.onLongPress || (() => {})}
               className={clsx(
                 "w-12 h-12 rounded-2xl",
                 "bg-white/95 text-gray-900",
                 "shadow-lg ring-1 ring-black/5",
                 "flex items-center justify-center",
                 "transition-transform duration-150 active:scale-95",
                 "hover:bg-white",
                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                 "backdrop-blur-sm"
               )}
               aria-label={action.label}
             >
               {action.icon}
             </LongPressButton>
          </div>
        ))}
      </div>

      {/* Slide Handle Indicator */}
      {secondaryActions.length > 0 && (
        <div 
          className="w-14 min-h-12 flex justify-center items-center -mb-2 z-10 opacity-70 cursor-pointer hover:opacity-100 transition-opacity active:scale-90"
          onClick={() => {
            setShowSecondary(!showSecondary)
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
          }}
          role="button"
          aria-label={showSecondary ? "Hide secondary actions" : "Show secondary actions"}
          aria-expanded={showSecondary}
        >
          <div className="bg-white/85 backdrop-blur-sm rounded-full px-4 py-1.5 border border-gray-200 shadow-sm ring-1 ring-black/5">
            {showSecondary ? <ChevronDown size={20} className="text-gray-600" /> : <ChevronUp size={20} className="text-gray-600" />}
          </div>
        </div>
      )}

      {/* Main Core Buttons */}
      <div className="flex flex-col gap-3 items-end">
        {mainActions.slice(0, 5).map((action) => (
          <div key={action.id} className="relative group">
             <LongPressButton
               onShortPress={action.onClick}
               onLongPress={action.onLongPress || (() => {})}
               className={clsx(
                 "w-14 h-14 rounded-2xl",
                 "shadow-xl ring-1 ring-black/10",
                 "flex items-center justify-center",
                 "transition-transform duration-150 active:scale-95",
                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                 "backdrop-blur-sm",
                 action.variant === 'primary'
                   ? "bg-blue-600 text-white hover:bg-blue-700"
                   : action.variant === 'danger'
                     ? "bg-red-500 text-white hover:bg-red-600"
                     : "bg-white/95 text-gray-900 hover:bg-white"
               )}
               aria-label={action.label}
             >
               {action.icon}
             </LongPressButton>
             {/* Hover Tooltip (Desktop) */}
             <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden md:block">
               {action.label}
             </span>
          </div>
        ))}
      </div>
    </div>
  )
}
