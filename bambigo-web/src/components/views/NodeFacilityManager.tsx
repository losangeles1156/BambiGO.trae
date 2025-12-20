'use client'
import React, { useState } from 'react'
import { Plus, ArrowLeft, Loader2 } from 'lucide-react'
import FacilityList from '../lists/FacilityList'
import FacilityAttributeEditor from '../tagging/FacilityAttributeEditor'
import { L3_FACILITIES_DATA } from '../tagging/constants'
import { TaggingService } from '../../lib/api/tagging'
import type { L3ServiceFacility, L3Category } from '../../types/tagging'

type Props = {
  nodeId: string
  initialFacilities: L3ServiceFacility[]
  onUpdate?: (facilities: L3ServiceFacility[]) => void
  onSystemAlert?: (input: { severity: 'high' | 'medium' | 'low'; title: string; summary: string; ttlMs?: number; dedupeMs?: number }) => void
  onClientLog?: (entry: { level: 'error' | 'warn' | 'info'; message: string; data?: Record<string, unknown> }) => void
}

export default function NodeFacilityManager({ nodeId, initialFacilities, onUpdate, onSystemAlert, onClientLog }: Props) {
  const [facilities, setFacilities] = useState<L3ServiceFacility[]>(initialFacilities)
  const [mode, setMode] = useState<'list' | 'add_select' | 'edit'>('list')
  const [editingFacility, setEditingFacility] = useState<L3ServiceFacility | null>(null)
  const [loading, setLoading] = useState(false)

  const notify = (input: { severity: 'high' | 'medium' | 'low'; title: string; summary: string; ttlMs?: number; dedupeMs?: number }) => {
    onSystemAlert?.(input)
  }

  const handleSave = async (data: Partial<L3ServiceFacility>) => {
    setLoading(true)
    try {
      let newFacilities: L3ServiceFacility[]
      
      if (data.id && facilities.some(f => f.id === data.id)) {
        // Update existing
        const updated = await TaggingService.updateL3Facility(data as L3ServiceFacility)
        newFacilities = facilities.map(f => f.id === updated.id ? updated : f)
      } else {
        // Add new
        const newFacilityRaw = {
          ...data,
          nodeId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Omit<L3ServiceFacility, 'id'>
        
        const saved = await TaggingService.addL3Facility(newFacilityRaw)
        newFacilities = [...facilities, saved]
      }
      
      setFacilities(newFacilities)
      onUpdate?.(newFacilities)
      setMode('list')
      setEditingFacility(null)
    } catch (e) {
      console.error('Failed to save facility', e)
      onClientLog?.({ level: 'error', message: 'tagging:l3SaveFailed', data: { nodeId } })
      notify({ severity: 'medium', title: 'Tagging', summary: 'Failed to save changes', dedupeMs: 15000 })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this facility?')) return
    
    setLoading(true)
    try {
      await TaggingService.removeL3Facility(nodeId, id)
      const newFacilities = facilities.filter(f => f.id !== id)
      setFacilities(newFacilities)
      onUpdate?.(newFacilities)
    } catch (e) {
      console.error('Failed to delete facility', e)
      onClientLog?.({ level: 'error', message: 'tagging:l3DeleteFailed', data: { nodeId, id } })
      notify({ severity: 'medium', title: 'Tagging', summary: 'Failed to delete', dedupeMs: 15000 })
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySelect = (catId: string) => {
    setEditingFacility({
      id: '', // Placeholder
      nodeId,
      category: catId as L3Category,
      subCategory: catId,
      location: {},
      provider: { type: 'public' },
      attributes: {},
      source: 'manual'
    })
    setMode('edit')
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            {mode !== 'list' && (
                <button onClick={() => setMode('list')} className="mr-1 text-gray-500 hover:text-gray-700" disabled={loading}>
                    <ArrowLeft size={18} />
                </button>
            )}
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {mode === 'list' ? 'Manage Facilities' : mode === 'add_select' ? 'Select Type' : 'Edit Facility'}
                {loading && <Loader2 size={16} className="animate-spin text-blue-500" />}
            </h3>
        </div>
        {mode === 'list' && (
            <button 
                onClick={() => setMode('add_select')}
                className="bg-emerald-600 text-white p-1.5 rounded-full hover:bg-emerald-700 shadow-sm"
            >
                <Plus size={20} />
            </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'list' && (
          <FacilityList 
            items={facilities} 
            onEdit={(item) => {
                setEditingFacility(item)
                setMode('edit')
            }}
            onDelete={handleDelete}
          />
        )}

        {mode === 'add_select' && (
          <div className="grid grid-cols-2 gap-3 p-4">
            {L3_FACILITIES_DATA.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                  {cat.icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'edit' && editingFacility && (
          <FacilityAttributeEditor
            facility={editingFacility}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            className="w-full border-none shadow-none"
          />
        )}
      </div>
    </div>
  )
}
