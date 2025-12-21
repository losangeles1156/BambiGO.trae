'use client'
import React from 'react'
import TagChip from '../ui/TagChip'
import type { TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  state: TagState
  onRemove?: (id: string) => void
}

export default function TagFilterBar({ state, onRemove }: Props) {
  const { t } = useLanguage()
  const q = tagging.buildSuitabilityQuery(state.tags, 0.6)
  return (
    <div aria-label={t('tagging.filterBarLabel')} role="group" className="flex items-center gap-2 overflow-x-auto">
      {state.tags.map((tag) => (
        <TagChip key={tag.id} label={tag.label} layer={tag.layer} onRemove={() => onRemove?.(tag.id)} />
      ))}
      {!!q.tag && (
        <span className="ml-auto text-xs text-gray-600">{t('tagging.serviceFilterPrefix')}：{q.tag} ≥ 0.6</span>
      )}
    </div>
  )
}
