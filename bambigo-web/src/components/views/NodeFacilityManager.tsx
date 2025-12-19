'use client'
import React, { useState } from 'react'
import { Plus, ArrowLeft } from 'lucide-react'
import FacilityList from '../lists/FacilityList'
import FacilityAttributeEditor from '../tagging/FacilityAttributeEditor'
import { L3_FACILITIES_DATA } from '../tagging/constants'
import type { L3ServiceFacility, L3Category } from '../../types/tagging'

type Props = {
  nodeId: string
  initialFacilities: L3ServiceFacility[]
  onUpdate?: (facilities: L3ServiceFacility[]) => void
}

export default function NodeFacilityManager({ nodeId, initialFacilities, onUpdate }: Props) {
  const [facilities, setFacilities] = useState<L3ServiceFacility[]>(initialFacilities)
  const [mode, setMode] = useState<'list' | 'add_select' | 'edit'>('list')
  const [editingFacility, setEditingFacility] = useState<Partial<L3ServiceFacility> | null>(null)

  const handleSave = (data: Partial<L3ServiceFacility>) => {
    let newFacilities: L3ServiceFacility[]
    if (data.id && facilities.some(f => f.id === data.id)) {
      // Update existing
      newFacilities = facilities.map(f => f.id === data.id ? { ...f, ...data } as L3ServiceFacility : f)
    } else {
      // Add new
      const newFacility = {
        ...data,
        id: data.id || crypto.randomUUID(),
        nodeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as L3ServiceFacility
      newFacilities = [...facilities, newFacility]
    }
    setFacilities(newFacilities)
    onUpdate?.(newFacilities)
    setMode('list')
    setEditingFacility(null)
  }

  const handleDelete = (id: string) => {
    const newFacilities = facilities.filter(f => f.id !== id)
    setFacilities(newFacilities)
    onUpdate?.(newFacilities)
  }

  const startAdd = () => {
    setMode('add_select')
    setEditingFacility(null)
  }

  const startEdit = (facility: L3ServiceFacility) => {
    setEditingFacility(facility)
    setMode('edit')
  }

  const selectCategory = (catId: string) => {
    setEditingFacility({
      category: catId as L3Category,
      nodeId,
      subCategory: catId // Default subCategory to category for now
    })
    setMode('edit')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            {mode !== 'list' && (
                <button onClick={() => setMode('list')} className="mr-1 text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={18} />
                </button>
            )}
            <h3 className="font-semibold text-gray-800">
                {mode === 'list' ? 'Manage Facilities' : mode === 'add_select' ? 'Select Type' : 'Edit Facility'}
            </h3>
        </div>
        {mode === 'list' && (
          <button 
            onClick={startAdd}
            className="flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'list' && (
          <div className="space-y-4">
            <FacilityList 
              items={facilities} 
              onEdit={startEdit}
              onDelete={handleDelete}
            />
            {facilities.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                    No facilities yet. Click Add to start.
                </div>
            )}
          </div>
        )}

        {mode === 'add_select' && (
          <div className="grid grid-cols-2 gap-3">
            {L3_FACILITIES_DATA.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all gap-2 group bg-white"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{cat.label}</span>
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
