'use client'

import React from 'react'
import { clsx } from 'clsx'

export interface CategoryCounts {
  shopping: number
  dining: number
  medical: number
  education: number
  leisure: number
  finance: number
}

interface FacilityProfileProps {
  counts: CategoryCounts
  vibeTags?: string[]
  showZero?: boolean
  className?: string
}

export const CATEGORY_CONFIG = {
  shopping: { icon: '🛒', label: '購物' },
  dining: { icon: '🍜', label: '餐飲' },
  leisure: { icon: '🎭', label: '休閒' },
  medical: { icon: '🏥', label: '醫療' },
  finance: { icon: '🏦', label: '金融' },
  education: { icon: '🎓', label: '教育' },
}

export default function FacilityProfile({ counts, vibeTags, showZero = false, className }: FacilityProfileProps) {
  // Sort categories by count, showing top 5 (or non-zero ones)
  const sortedCategories = Object.entries(counts)
    .filter(([_, count]) => showZero || (count as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)

  return (
    <div className={clsx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {sortedCategories.map(([category, count]) => (
          <div 
            key={category} 
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 shadow-sm"
            aria-label={`${CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG].label}: ${count}`}
          >
            <span className="text-sm" aria-hidden="true">{CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG].icon}</span>
            <span className="text-xs font-bold text-gray-700">{count as number}</span>
          </div>
        ))}
      </div>
      
      {vibeTags && vibeTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vibeTags.map(tag => (
            <span 
              key={tag} 
              className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
