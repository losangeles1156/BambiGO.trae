'use client'
import React from 'react'
import TagChip from '../ui/TagChip'
import type { TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'

type Props = {
  state: TagState
  onRemove?: (id: string) => void
}

export default function TagFilterBar({ state, onRemove }: Props) {
  const q = tagging.buildSuitabilityQuery(state.tags, 0.6)
  return (
    <div aria-label="Tag Filter Bar" role="group" className="flex items-center gap-2 overflow-x-auto">
      {state.tags.map((t) => (
        <TagChip key={t.id} label={tagging.makeLabel(t)} layer={t.layer} onRemove={() => onRemove?.(t.id)} />
      ))}
      {!!q.tag && (
        <span className="ml-auto text-xs text-gray-600">服務篩選：{q.tag} ≥ 0.6</span>
      )}
    </div>
  )
}

