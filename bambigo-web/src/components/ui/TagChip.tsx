'use client'
import React from 'react'
import { LucideIcon, X } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useLanguage } from '@/contexts/LanguageContext'

export type TagLayer = 'L1' | 'L2' | 'L3' | 'L4'

interface TagChipProps {
  label: string
  layer: TagLayer
  icon?: LucideIcon | React.ReactNode
  className?: string
  onClick?: () => void
  onRemove?: () => void
}

export default function TagChip({ label, layer, icon: Icon, className = '', onClick, onRemove }: TagChipProps) {
  const { t } = useLanguage()
  // Base styles
  const baseStyles = 'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1'
  const cursorStyles = onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'

  // Layer-specific styles based on specs
  const layerStyles = {
    L1: 'rounded-lg border border-blue-200 bg-blue-50 text-blue-700 focus:ring-blue-500', // Outlined, Structure
    L2: 'rounded-md bg-violet-100 text-violet-800 border border-transparent focus:ring-violet-500', // Soft Fill, Aggregation
    L3: 'rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-500', // Pill/Capsule, Facilities
    L4: 'rounded-lg bg-gradient-to-r from-rose-50 to-orange-50 text-rose-700 border border-rose-100/50 focus:ring-rose-500', // Gradient, Action
  }

  return (
    <span 
      className={twMerge(clsx(baseStyles, layerStyles[layer], cursorStyles, className))}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {Icon && (
        <span className="shrink-0 opacity-70 flex items-center justify-center">
          {(typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in Icon)) ? (
            React.createElement(Icon as React.ComponentType<{ size?: number }>, { size: 14 })
          ) : (
            Icon as React.ReactNode
          )}
        </span>
      )}
      <span className="truncate max-w-[120px]">{label}</span>
      
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 p-0.5 rounded-full hover:bg-black/10 focus:outline-none focus:bg-black/10"
          aria-label={`${t('common.remove')} ${label}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
