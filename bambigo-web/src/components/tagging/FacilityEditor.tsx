'use client';

import React, { useState } from 'react';
import { L3_FACILITIES_DATA } from './constants';
import { clsx } from 'clsx';
import type { L3Category } from '@/types/tagging';

// Simple Toggle Component
const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

interface FacilityEditorProps {
  onAdd: (facility: { 
    type: L3Category; 
    label: string; 
    icon: string; 
    attributes: Record<string, any> 
  }) => void;
}

export const FacilityEditor: React.FC<FacilityEditorProps> = ({ onAdd }) => {
  const [selectedType, setSelectedType] = useState<L3Category>(L3_FACILITIES_DATA[0].id);
  const [attributes, setAttributes] = useState({
    isFree: true,
    isPublic: true,
    details: ''
  });

  const handleAdd = () => {
    const facilityDef = L3_FACILITIES_DATA.find(f => f.id === selectedType);
    if (!facilityDef) return;

    onAdd({
      type: selectedType,
      label: facilityDef.label,
      icon: facilityDef.icon,
      attributes
    });
    // Reset
    setAttributes({ isFree: true, isPublic: true, details: '' });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 w-full max-w-sm">
      <h3 className="font-semibold text-gray-700 text-sm mb-4">Add Service Facility (L3)</h3>
      
      <div className="space-y-4">
        {/* Type Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Facility Type</label>
          <div className="grid grid-cols-2 gap-2">
            {L3_FACILITIES_DATA.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedType(f.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all',
                  selectedType === f.id 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                )}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attributes Form */}
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <Toggle 
            label="Free to use" 
            checked={attributes.isFree} 
            onChange={(v) => setAttributes(prev => ({ ...prev, isFree: v }))} 
          />
          <Toggle 
            label="Public Access" 
            checked={attributes.isPublic} 
            onChange={(v) => setAttributes(prev => ({ ...prev, isPublic: v }))} 
          />
          
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Details / Location</label>
            <input 
              type="text"
              value={attributes.details}
              onChange={(e) => setAttributes(prev => ({ ...prev, details: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 2nd Floor, near elevator"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition-colors shadow-sm active:scale-[0.98]"
        >
          Add Facility Tag
        </button>
      </div>
    </div>
  );
};
