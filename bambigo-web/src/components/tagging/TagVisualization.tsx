'use client'
import React, { useMemo } from 'react'
import type { FacilityItem } from '../../lib/tagging'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = { items: FacilityItem[] }

export default function TagVisualization({ items }: Props) {
  const { t } = useLanguage()
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of items) {
      const suits = Array.isArray(f.suitability_tags) ? f.suitability_tags : []
      for (const s of suits) {
        const key = s.tag
        map.set(key, (map.get(key) || 0) + 1)
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [items])
  return (
    <div aria-label="Tag Visualization" role="figure" className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold mb-2">{t('tagging.serviceTagDistribution')}</div>
      <div className="grid grid-cols-3 gap-2">
        {counts.map(([tag, count]) => (
          <div key={tag} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1 text-xs">
            <div className="truncate">{t(`tagging.l3.${tag}`) || tag}</div>
            <div className="ml-2 text-gray-600">{count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

