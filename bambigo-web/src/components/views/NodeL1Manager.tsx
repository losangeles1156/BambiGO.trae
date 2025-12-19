'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, X, Edit2, Tag } from 'lucide-react'
import TagChip from '../ui/TagChip'
import { HierarchySelector } from '../tagging/HierarchySelector'
import { TaggingService } from '../../lib/api/tagging'
import type { L1Tag, L1Category } from '../../types/tagging'
import { clsx } from 'clsx'

type Props = {
  nodeId: string
  className?: string
}

export default function NodeL1Manager({ nodeId, className }: Props) {
  const [tags, setTags] = useState<L1Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view')

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const data = await TaggingService.getL1Tags(nodeId)
      setTags(data)
    } catch (err) {
      console.error('Failed to load L1 tags', err)
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  useEffect(() => {
    if (!nodeId) return
    loadTags()
  }, [nodeId, loadTags])

  const handleAdd = async (selection: { main: L1Category; sub: string; label: string }) => {
    try {
      await TaggingService.addL1Tag({
        nodeId,
        mainCategory: selection.main,
        subCategory: selection.sub,
        name: { en: selection.label }
      })
      await loadTags()
      setMode('view')
    } catch {
      alert('Failed to add tag')
    }
  }

  const handleRemove = async (tagId: string) => {
    if (!confirm('Are you sure you want to remove this tag?')) return
    try {
      await TaggingService.removeL1Tag(nodeId, tagId)
      await loadTags()
    } catch {
      alert('Failed to remove tag')
    }
  }

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag size={16} className="text-blue-500" />
          <span>分類標籤 (L1)</span>
        </h2>
        <div className="flex items-center gap-2">
          {mode === 'view' && (
             <button 
               onClick={() => setMode('edit')}
               className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
               title="Edit Tags"
             >
               <Edit2 size={14} />
             </button>
          )}
          {mode !== 'view' && (
             <button 
               onClick={() => setMode('view')}
               className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
             >
               Done
             </button>
          )}
        </div>
      </div>

      {/* Tag List */}
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && mode === 'view' && (
          <div className="text-xs text-gray-400 italic">No category tags yet.</div>
        )}
        
        {tags.map((t) => (
          <TagChip
            key={t.id}
            label={t.name?.en || t.subCategory}
            layer="L1"
            onRemove={mode !== 'view' ? () => handleRemove(t.id) : undefined}
          />
        ))}

        {mode !== 'view' && (
          <button
            onClick={() => setMode(mode === 'add' ? 'edit' : 'add')}
            className={clsx(
              "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors rounded-lg border border-dashed",
              mode === 'add' 
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-600"
            )}
          >
            {mode === 'add' ? <X size={12} /> : <Plus size={12} />}
            {mode === 'add' ? 'Cancel' : 'Add Tag'}
          </button>
        )}
      </div>

      {/* Add Interface */}
      {mode === 'add' && (
        <div className="mt-2 animate-in fade-in slide-in-from-top-2">
          <HierarchySelector 
            onSelect={handleAdd}
            className="border-blue-200 shadow-sm"
          />
        </div>
      )}
    </div>
  )
}
