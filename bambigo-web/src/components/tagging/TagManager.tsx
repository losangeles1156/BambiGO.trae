'use client'
import React, { useMemo, useState } from 'react'
import { L3_FACILITIES_DATA } from './constants'
import TagChip from '../ui/TagChip'
import { HierarchySelector } from './HierarchySelector'
import type { AppTag, TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'

type Props = {
  value?: TagState
  onChange?: (next: TagState) => void
}

export default function TagManager({ value, onChange }: Props) {
  const [state, setState] = useState<TagState>(value || { tags: [] })
  

  const apply = (next: TagState) => {
    setState(next)
    onChange?.(next)
  }

  const addL1 = (mainCategory: string, subCategory: string, detailCategory?: string) => {
    const id = `L1:${mainCategory}:${subCategory}:${detailCategory || ''}`
    const tag: AppTag = { id, layer: 'L1', label: `${mainCategory} > ${subCategory}${detailCategory ? ` > ${detailCategory}` : ''}`, l1: { mainCategory, subCategory, detailCategory: detailCategory || null } }
    apply(tagging.createTag(state, tag))
  }

  const addL3 = (category: string, subCategory: string) => {
    const id = `L3:${category}:${subCategory}`
    const tag: AppTag = { id, layer: 'L3', label: `${category} > ${subCategory}`, l3: { category, subCategory } }
    apply(tagging.createTag(state, tag))
  }

  const remove = (id: string) => apply(tagging.deleteTag(state, id))

  const l3Grid = useMemo(() => L3_FACILITIES_DATA, [])

  return (
    <div aria-label="Tag Manager" role="region" className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Active Tags" role="group">
        {state.tags.map((t) => (
          <TagChip key={t.id} label={tagging.makeLabel(t)} layer={t.layer} onRemove={() => remove(t.id)} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold mb-2 text-gray-700">L1 類別 (Structure)</div>
          <HierarchySelector 
            onSelect={(t) => addL1(t.main, t.sub)} 
            className="h-[300px]"
          />
        </div>
        <div>
          <div className="text-sm font-semibold mb-2 text-gray-700">L3 服務設施 (Utility)</div>
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1" role="list">
            {l3Grid.map((f) => (
              <button 
                key={f.id} 
                role="listitem" 
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100 transition-colors text-left" 
                onClick={() => addL3(tagging.mapSuitabilityToCategory(f.id), f.id)}
              >
                <span className="text-lg">{f.icon}</span>
                <span className="font-medium">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
