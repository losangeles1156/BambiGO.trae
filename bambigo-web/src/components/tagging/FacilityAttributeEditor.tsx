'use client'
import React, { useState, useEffect } from 'react'
import { CheckCircle2, Save, X, Coffee, Wifi, Zap, Box, Accessibility, Armchair, HelpCircle } from 'lucide-react'
import TagChip from '../ui/TagChip'
import { L3_FACILITIES_DATA } from './constants'
import type { L3ServiceFacility, L3Category } from '../../types/tagging'
import { clsx } from 'clsx'

interface Props {
  facility: Partial<L3ServiceFacility>
  onSave: (data: Partial<L3ServiceFacility>) => void
  onCancel?: () => void
  className?: string
}

const ATTRIBUTE_SCHEMAS: Record<L3Category, { key: string; label: string; type: 'boolean' | 'text' | 'select'; options?: string[] }[]> = {
  wifi: [
    { key: 'is_free', label: 'Free Access', type: 'boolean' },
    { key: 'ssid', label: 'SSID', type: 'text' },
    { key: 'has_5g', label: '5G Support', type: 'boolean' }
  ],
  toilet: [
    { key: 'is_free', label: 'Free Use', type: 'boolean' },
    { key: 'has_accessible', label: 'Wheelchair Accessible', type: 'boolean' },
    { key: 'has_baby_care', label: 'Baby Care', type: 'boolean' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['all', 'male', 'female', 'unisex'] }
  ],
  charging: [
    { key: 'is_free', label: 'Free Charging', type: 'boolean' },
    { key: 'socket_type', label: 'Socket Type', type: 'select', options: ['Type-A', 'Type-C', 'AC', 'Wireless'] },
    { key: 'count', label: 'Port Count', type: 'text' }
  ],
  locker: [
    { key: 'size', label: 'Max Size', type: 'select', options: ['S', 'M', 'L', 'XL'] },
    { key: 'payment', label: 'Payment Method', type: 'select', options: ['Cash', 'IC Card', 'QR'] }
  ],
  accessibility: [
    { key: 'elevator', label: 'Elevator', type: 'boolean' },
    { key: 'ramp', label: 'Ramp', type: 'boolean' }
  ],
  rest_area: [
    { key: 'seats', label: 'Seat Count', type: 'text' },
    { key: 'indoor', label: 'Indoor', type: 'boolean' }
  ],
  other: [
    { key: 'note', label: 'Note', type: 'text' }
  ]
}

const ICON_MAP: Record<string, any> = {
  wifi: Wifi,
  charging: Zap,
  toilet: Coffee, // Placeholder if Bath not available or use Coffee for amenity
  locker: Box,
  accessibility: Accessibility,
  rest_area: Armchair,
  other: HelpCircle
}

export default function FacilityAttributeEditor({ facility, onSave, onCancel, className }: Props) {
  const [data, setData] = useState<Partial<L3ServiceFacility>>(facility)
  const [attributes, setAttributes] = useState<Record<string, any>>(facility.attributes || {})
  const [isVerified, setIsVerified] = useState(false) // In a real app, this might come from data

  const category = (data.category || 'other') as L3Category
  const schema = ATTRIBUTE_SCHEMAS[category] || ATTRIBUTE_SCHEMAS['other']
  
  // Find icon
  const Icon = ICON_MAP[category] || HelpCircle
  const catLabel = L3_FACILITIES_DATA.find(f => f.id === category)?.label || category

  const handleAttrChange = (key: string, value: any) => {
    setAttributes(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave({
      ...data,
      attributes,
      updatedAt: new Date().toISOString()
      // In real app, we'd handle verification logic here
    })
  }

  return (
    <div className={clsx("bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden flex flex-col w-full max-w-md", className)}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagChip label={catLabel} layer="L3" icon={Icon} />
          <span className="text-xs text-gray-400">ID: {data.id?.slice(0, 8)}...</span>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Basic Info */}
        <div className="space-y-3">
           <label className="block text-sm font-medium text-gray-700">Sub Category</label>
           <input 
             type="text" 
             value={data.subCategory || ''} 
             onChange={e => setData(prev => ({ ...prev, subCategory: e.target.value }))}
             className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3 border"
             placeholder="e.g. public_toilet"
           />
        </div>

        <div className="border-t border-gray-100 my-2"></div>

        {/* Dynamic Attributes */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attributes</div>
          {schema.map((field) => (
            <div key={field.key} className="flex items-center justify-between">
              <label className="text-sm text-gray-600 flex-1">{field.label}</label>
              <div className="flex-1 flex justify-end">
                {field.type === 'boolean' ? (
                  <button 
                    onClick={() => handleAttrChange(field.key, !attributes[field.key])}
                    className={clsx(
                      "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      attributes[field.key] ? 'bg-emerald-500' : 'bg-gray-200'
                    )}
                  >
                    <span 
                      className={clsx(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        attributes[field.key] ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </button>
                ) : field.type === 'select' ? (
                  <select
                    value={attributes[field.key] || ''}
                    onChange={(e) => handleAttrChange(field.key, e.target.value)}
                    className="block w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm sm:leading-6 border px-2"
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={attributes[field.key] || ''}
                    onChange={(e) => handleAttrChange(field.key, e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 px-2"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <button 
          onClick={() => setIsVerified(!isVerified)}
          className={clsx(
            "flex items-center gap-1.5 text-sm font-medium transition-colors",
            isVerified ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <CheckCircle2 size={18} className={isVerified ? "fill-emerald-100" : ""} />
          {isVerified ? "Verified" : "Mark Verified"}
        </button>
        
        <button 
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  )
}
