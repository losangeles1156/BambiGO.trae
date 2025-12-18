'use client'
import React, { useMemo, useState } from 'react'
import { L1_CATEGORIES_DATA, L3_FACILITIES_DATA } from './constants'
import { TagChip } from './TagChip'
import type { AppTag, TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'

type Props = {
  value?: TagState
  onChange?: (next: TagState) => void
}

export default function TagManager({ value, onChange }: Props) {
  const [state, setState] = useState<TagState>(value || { tags: [] })
  const [path, setPath] = useState<{ level: 'L1' | 'L3'; main?: string; sub?: string } | null>(null)

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

  const l1Grid = useMemo(() => L1_CATEGORIES_DATA, [])
  const l3Grid = useMemo(() => L3_FACILITIES_DATA, [])

  return (
    <div aria-label="Tag Manager" role="region" className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Active Tags" role="group">
        {state.tags.map((t) => (
          <TagChip key={t.id} label={tagging.makeLabel(t)} layer={t.layer} onRemove={() => remove(t.id)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm font-semibold mb-2">L1 類別</div>
          <div role="tree" aria-label="L1 Tree" className="grid grid-cols-2 gap-2">
            {l1Grid.map((c) => (
              <button key={c.id} role="treeitem" aria-expanded={path?.main === c.id} onClick={() => setPath({ level: 'L1', main: c.id })} className="rounded border border-gray-300 px-3 py-2 text-sm">
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
          {!!path?.main && (
            <div className="mt-2 grid grid-cols-2 gap-2" aria-label="L1 Sub Categories">
              {l1Grid.find((x) => x.id === path.main)?.subCategories.map((s) => (
                <button key={s.id} aria-selected={path?.sub === s.id} className="rounded border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setPath({ level: 'L1', main: path.main!, sub: s.id })}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {!!path?.main && !!path?.sub && (
            <div className="mt-2">
              <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => addL1(path.main!, path.sub!)}>
                新增標籤：{path.main} › {path.sub}
              </button>
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">L3 服務設施</div>
          <div className="grid grid-cols-2 gap-2" role="list">
            {l3Grid.map((f) => (
              <button key={f.id} role="listitem" className="rounded border border-gray-300 px-3 py-2 text-sm" onClick={() => addL3(tagging.mapSuitabilityToCategory(f.id), f.id)}>
                <span className="mr-1">{f.icon}</span>{f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
